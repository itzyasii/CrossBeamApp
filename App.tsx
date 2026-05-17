import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';

import { HistoryScreen } from '@/screens/HistoryScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { DiscoverScreen } from '@/screens/DiscoverScreen';
import { TransferScreen } from '@/screens/TransferScreen';
import { AnalyticsScreen } from '@/screens/AnalyticsScreen';
import { DevicesScreen } from '@/screens/DevicesScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { useDeviceDiscovery } from '@/hooks/useDeviceDiscovery';
import { useTheme } from '@/hooks/useTheme';
import { useTransferManager } from '@/hooks/useTransferManager';
import { useShareIntent } from '@/hooks/useShareIntent';
import { useAppStore } from '@/store';
import { nativeCrossBeam } from '@/native/crossbeamNative';
import { 
  Home, 
  Radio, 
  Zap, 
  Clock, 
  BarChart2, 
  Smartphone,
  Settings,
  Lock
} from 'lucide-react-native';
import { gradients, FONT_SIZE, RADIUS, SPACING } from '@/theme/colors';
import { haptics } from '@/services/haptics';
import { useBiometrics } from '@/hooks/useBiometrics';
import { QRPairingScreen } from '@/screens/QRPairingScreen';
import { PinVerificationModal } from '@/components/PinVerificationModal';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = 280;
const TAB_BAR_H = 72;

type Tab = 'home' | 'discover' | 'transfer' | 'history' | 'analytics' | 'devices' | 'settings';

const TABS: { id: Tab; icon: any; label: string }[] = [
  { id: 'home',      icon: Home,       label: 'Home' },
  { id: 'discover',  icon: Radio,      label: 'Discover' },
  { id: 'transfer',  icon: Zap,        label: 'Transfer' },
  { id: 'history',   icon: Clock,      label: 'History' },
  { id: 'analytics', icon: BarChart2,  label: 'Analytics' },
  { id: 'devices',   icon: Smartphone, label: 'Devices' },
  { id: 'settings',  icon: Settings,   label: 'Settings' },
];

// ─── Bottom Tab Item ──────────────────────────────────────────────────────────
function BottomTabItem({ tab, active, onPress }: { tab: typeof TABS[0]; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const [tooltip, setTooltip] = useState(false);

  const pressIn  = () => {
    void haptics.light();
    Animated.spring(scale, { toValue: 0.82, useNativeDriver: true, tension: 250, friction: 8 }).start();
  };
  const pressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 250, friction: 8 }).start();
  const longPress = () => {
    void haptics.medium();
    setTooltip(true);
    setTimeout(() => setTooltip(false), 1200);
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onLongPress={longPress}
      accessibilityRole="button"
      accessibilityLabel={tab.label}
      style={S.tabItem}
    >
      <Animated.View style={{ alignItems: 'center', transform: [{ scale }] }}>
        {active ? (
          <LinearGradient colors={gradients.primary} style={S.tabPillActive}>
            <tab.icon size={20} color="#fff" strokeWidth={2.5} />
          </LinearGradient>
        ) : (
          <View style={S.tabPillInactive}>
            <tab.icon size={20} color={colors.textSecondary} opacity={0.4} strokeWidth={2} />
          </View>
        )}
        {tooltip && (
          <View style={[S.tooltip, { backgroundColor: colors.backgroundElevated, borderColor: colors.borderStrong }]}>
            <Text style={[S.tooltipText, { color: colors.textPrimary }]}>{tab.label}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── Drawer ──────────────────────────────────────────────────────────────────
function DrawerContent({ tab, onSelect, onClose, deviceCount, transferCount }: {
  tab: Tab; onSelect: (t: Tab) => void; onClose: () => void;
  deviceCount: number; transferCount: number;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[S.drawerInner, { backgroundColor: colors.backgroundElevated, paddingTop: insets.top + SPACING.lg }]}>
      <View style={S.drawerLogo}>
        <Image source={require('./assets/icon.png')} style={S.drawerOrb} />
        <View>
          <Text style={[S.drawerAppName, { color: colors.textPrimary }]}>CrossBeam</Text>
          <Text style={[S.drawerAppSub,  { color: colors.textMuted    }]}>v0.1.0 · Local P2P</Text>
        </View>
      </View>

      <View style={[S.drawerStats, { backgroundColor: colors.accentHighlight, borderColor: colors.borderAccent }]}>
        <View style={S.drawerStat}>
          <Text style={[S.drawerStatVal,   { color: colors.accent }]}>{deviceCount}</Text>
          <Text style={[S.drawerStatLabel, { color: colors.textSecondary }]}>Nearby</Text>
        </View>
        <View style={[S.drawerDivLine, { backgroundColor: colors.border }]} />
        <View style={S.drawerStat}>
          <Text style={[S.drawerStatVal,   { color: colors.success }]}>{transferCount}</Text>
          <Text style={[S.drawerStatLabel, { color: colors.textSecondary }]}>Transfers</Text>
        </View>
      </View>

      <Text style={[S.drawerSectionLabel, { color: colors.textMuted }]}>NAVIGATION</Text>

      {TABS.map(t => {
        const active = t.id === tab;
        return (
          <Pressable
            key={t.id}
            onPress={() => { onSelect(t.id); onClose(); }}
            style={[S.drawerItem, active && { backgroundColor: colors.accentHighlight }]}
          >
            <t.icon size={20} color={active ? colors.accent : colors.textSecondary} opacity={active ? 1 : 0.6} strokeWidth={active ? 2.5 : 2} />
            <Text style={[S.drawerLabel, { color: active ? colors.accentLight : colors.textSecondary, fontWeight: active ? '700' : '500' }]}>
              {t.label}
            </Text>
            {active && <View style={[S.drawerActiveDot, { backgroundColor: colors.accent }]} />}
          </Pressable>
        );
      })}

      <View style={{ flex: 1 }} />
      <Text style={[S.drawerFooter, { color: colors.textMuted, paddingBottom: insets.bottom + SPACING.sm }]}>
        Private · Local · Ad-free
      </Text>
    </View>
  );
}

// ─── TV Sidebar ───────────────────────────────────────────────────────────────
function TVSidebar({ tab, onSelect }: { tab: Tab; onSelect: (t: Tab) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[S.tvSidebar, { backgroundColor: colors.backgroundElevated, borderRightColor: colors.border }]}>
      <View style={S.tvLogo}>
        <Image source={require('./assets/icon.png')} style={S.drawerOrb} />
        <Text style={[S.drawerAppName, { color: colors.textPrimary }]}>CrossBeam</Text>
      </View>
      {TABS.map(t => {
        const active = t.id === tab;
        return (
          <Pressable
            key={t.id} onPress={() => onSelect(t.id)} focusable
            style={[S.drawerItem, active && { backgroundColor: colors.accentHighlight }]}
          >
            <t.icon size={20} color={active ? colors.accent : colors.textSecondary} opacity={active ? 1 : 0.6} strokeWidth={active ? 2.5 : 2} />
            <Text style={[S.drawerLabel, { color: active ? colors.accentLight : colors.textSecondary, fontWeight: active ? '700' : '500' }]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const { colors, isDark } = useTheme();
  const { biometricLockEnabled } = useAppStore();
  const { authenticate } = useBiometrics();
  const [isLocked, setIsLocked] = useState(false);
  const [showQrPairing, setShowQrPairing] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  useEffect(() => {
    if (biometricLockEnabled) {
      setIsLocked(true);
      void (async () => {
        const success = await authenticate();
        if (success) setIsLocked(false);
      })();
    }
  }, [biometricLockEnabled]);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS === 'android') {
      void NavigationBar.setBackgroundColorAsync(colors.background);
      void NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
    }
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background, isDark]);

  const [tabIndex, setTabIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const tab = TABS[tabIndex].id;

  const { devices, isRefreshing, statusMessage, refreshDevices } = useDeviceDiscovery();
  const { sharedFiles, setSharedFiles } = useShareIntent();
  const { transfers, selectedFiles, transferError, pickFiles, clearSelectedFiles,
    startTransfer, togglePause, cancelTransfer, addSelectedFiles } = useTransferManager();

  useEffect(() => {
    const checkCapabilities = async () => {
      try {
        const caps = await nativeCrossBeam.getCapabilities();
        console.log("[CrossBeam] Native Capabilities:", caps);
      } catch (e) {
        console.error("[CrossBeam] Capability check failed:", e);
      }
    };
    void checkCapabilities();
  }, []);

  // Swipe pager ref
  const pagerRef = useRef<FlatList>(null);

  const goToTab = useCallback((idx: number) => {
    setTabIndex(idx);
    pagerRef.current?.scrollToIndex({ index: idx, animated: true });
  }, []);

  const handleTabPress = (idx: number) => goToTab(idx);

  const handleMomentumScrollEnd = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setTabIndex(idx);
  }, []);

  // Drawer animation
  const drawerX = useRef(new Animated.Value(-DRAWER_W)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const openDrawer = () => {
    void haptics.light();
    setDrawerOpen(true);
    Animated.parallel([
      Animated.spring(drawerX,       { toValue: 0,         tension: 65, friction: 11, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.spring(drawerX,       { toValue: -DRAWER_W, tension: 85, friction: 13, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setDrawerOpen(false));
  };

  useEffect(() => {
    if (sharedFiles.length > 0) {
      addSelectedFiles(sharedFiles);
      setSharedFiles([]);
      goToTab(TABS.findIndex(t => t.id === 'transfer'));
    }
  }, [sharedFiles, addSelectedFiles, setSharedFiles, goToTab]);

  const targetDevice = devices.find(device => device.id === selectedDeviceId) ?? devices[0] ?? null;
  const screenProps = {
    devices, isRefreshing, statusMessage,
    refreshDevices: () => void refreshDevices(),
    transfers, selectedFiles, transferError,
    pickFiles, clearSelectedFiles, startTransfer, togglePause, cancelTransfer, targetDevice,
    selectedDeviceId,
    selectDeviceForTransfer: (id: string) => {
      setSelectedDeviceId(id);
      goToTab(TABS.findIndex(t => t.id === 'transfer'));
    },
    goToTab: (id: Tab) => goToTab(TABS.findIndex(t => t.id === id)),
  };

  // Heights for layout
  const headerH  = 52 + insets.top;
  const contentPB = TAB_BAR_H + insets.bottom + SPACING.lg;

  if (Platform.isTV) {
    return (
      <View style={[S.root, { backgroundColor: colors.background }]}>
        <StatusBar style="light" />
        <View style={[S.tvLayout, { paddingTop: insets.top }]}>
          <TVSidebar tab={tab} onSelect={id => setTabIndex(TABS.findIndex(t => t.id === id))} />
          <ScrollView contentContainerStyle={{ padding: SPACING.xxl, gap: SPACING.md }}>
            {renderScreen(tab, screenProps, contentPB)}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />

      {/* Overlay for drawer */}
      {drawerOpen && (
        <Animated.View style={[S.overlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeDrawer} />
        </Animated.View>
      )}

      {/* Slide-in Drawer */}
      <Animated.View style={[S.drawer, { transform: [{ translateX: drawerX }] }]}>
        <DrawerContent
          tab={tab}
          onSelect={id => { goToTab(TABS.findIndex(t => t.id === id)); }}
          onClose={closeDrawer}
          deviceCount={devices.length}
          transferCount={transfers.length}
        />
      </Animated.View>

      {/* Header — sits on top of status bar */}
      <BlurView
        intensity={isDark ? 28 : 48}
        tint={isDark ? 'dark' : 'light'}
        style={[S.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}
      >
        {/* Hamburger */}
        <Pressable onPress={openDrawer} style={S.menuBtn} accessibilityLabel="Open menu">
          <View style={[S.menuLine, { backgroundColor: colors.textPrimary }]} />
          <View style={[S.menuLine, S.menuLineShort, { backgroundColor: colors.textPrimary }]} />
          <View style={[S.menuLine, { backgroundColor: colors.textPrimary }]} />
        </Pressable>

        {/* Logo */}
        <View style={S.headerCenter}>
          <Image source={require('./assets/icon.png')} style={S.headerOrb} />
          <Text style={[S.headerTitle, { color: colors.textPrimary }]}>CrossBeam</Text>
        </View>

        {/* Online indicator */}
        <View style={S.headerRight}>
          <Pressable onPress={() => setShowQrPairing(true)}>
            <Radio size={22} color={devices.length > 0 ? colors.success : colors.textMuted} />
          </Pressable>
        </View>
      </BlurView>

      {showQrPairing && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
          <QRPairingScreen onBack={() => setShowQrPairing(false)} />
        </View>
      )}

      {isLocked && (
        <View style={[S.lockScreen, { backgroundColor: colors.background }]}>
          <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <Lock size={48} color={colors.accent} />
          <Text style={[S.lockTitle, { color: colors.textPrimary }]}>CrossBeam Locked</Text>
          <Pressable style={[S.unlockBtn, { backgroundColor: colors.accent }]} onPress={async () => {
            if (await authenticate()) setIsLocked(false);
          }}>
            <Text style={S.unlockText}>Unlock with Biometrics</Text>
          </Pressable>
        </View>
      )}

      <PinVerificationModal
        visible={showPinModal}
        onConfirm={() => setShowPinModal(false)}
        onCancel={() => setShowPinModal(false)}
      />

      {/* ── Swipeable Pager ─────────────────────────────────────────────────── */}
      <FlatList
        ref={pagerRef}
        data={TABS}
        keyExtractor={t => t.id}
        horizontal
        pagingEnabled
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
        initialScrollIndex={0}
        renderItem={({ item: t }) => (
          <ScrollView
            style={{ width: SCREEN_W }}
            contentContainerStyle={[S.pageContent, { paddingTop: headerH, paddingBottom: contentPB }]}
            showsVerticalScrollIndicator={false}
          >
            {renderScreen(t.id, screenProps, contentPB)}
          </ScrollView>
        )}
      />

      {/* ── Bottom Tab Bar ───────────────────────────────────────────────────── */}
      <BlurView
        intensity={isDark ? 42 : 62}
        tint={isDark ? 'dark' : 'light'}
        style={[S.tabBarWrap, { paddingBottom: insets.bottom }]}
      >
        <View style={[S.tabBar, { borderTopColor: colors.border }]}>
          {TABS.map((t, i) => (
            <BottomTabItem
              key={t.id}
              tab={t}
              active={tabIndex === i}
              onPress={() => handleTabPress(i)}
            />
          ))}
        </View>
      </BlurView>
    </View>
  );
}

// ─── Screen Factory ───────────────────────────────────────────────────────────
function renderScreen(tab: Tab, p: any, _contentPB: number) {
  switch (tab) {
    case 'home':
      return <HomeScreen deviceCount={p.devices.length} transferCount={p.transfers.length} discoveryStatus={p.statusMessage} onStartDiscovery={p.refreshDevices} />;
    case 'discover':
      return <DiscoverScreen devices={p.devices} onRefresh={p.refreshDevices} isRefreshing={p.isRefreshing} statusMessage={p.statusMessage} onSelectDevice={p.selectDeviceForTransfer} />;
    case 'transfer':
      return (
        <TransferScreen
          transfers={p.transfers}
          selectedFiles={p.selectedFiles}
          transferError={p.transferError}
          onPickFiles={() => void p.pickFiles()}
          onClearSelectedFiles={p.clearSelectedFiles}
          onStartTransfer={() => void p.startTransfer(p.targetDevice?.id ?? null, p.targetDevice?.name ?? 'No peer')}
          targetDeviceName={p.targetDevice?.name ?? null}
          onPauseResume={p.togglePause}
          onCancel={(id: string) => void p.cancelTransfer(id)}
        />
      );
    case 'history':   return <HistoryScreen transfers={p.transfers as any} />;
    case 'analytics': return <AnalyticsScreen />;
    case 'devices':   return <DevicesScreen onPairDevice={() => p.goToTab('discover')} />;
    case 'settings':  return <SettingsScreen />;
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1 },

  // TV
  tvLayout: { flex: 1, flexDirection: 'row' },
  tvSidebar: { width: 236, borderRightWidth: StyleSheet.hairlineWidth, paddingTop: SPACING.lg },
  tvLogo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg, marginBottom: SPACING.sm },

  // Overlay + Drawer
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.58)', zIndex: 50 },
  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: DRAWER_W, zIndex: 100 },
  drawerInner: { flex: 1, paddingHorizontal: SPACING.lg, gap: SPACING.xs, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(255,255,255,0.06)' },
  drawerLogo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
  drawerOrb: { width: 38, height: 38, borderRadius: RADIUS.sm + 2 },
  drawerAppName: { fontSize: FONT_SIZE.md, fontWeight: '800', letterSpacing: -0.4 },
  drawerAppSub: { fontSize: FONT_SIZE.xs, fontWeight: '500', marginTop: 1 },
  drawerStats: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, marginBottom: SPACING.md, gap: SPACING.sm },
  drawerStat: { flex: 1, alignItems: 'center', gap: 2 },
  drawerStatVal: { fontSize: FONT_SIZE.xl, fontWeight: '800', letterSpacing: -0.5 },
  drawerStatLabel: { fontSize: FONT_SIZE.xs, fontWeight: '600' },
  drawerDivLine: { width: 1, height: 28 },
  drawerSectionLabel: { fontSize: FONT_SIZE.xs, fontWeight: '700', letterSpacing: 1.2, marginVertical: SPACING.xs, marginLeft: SPACING.xs },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: 13, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.md },
  drawerIcon: { fontSize: 18 },
  drawerLabel: { fontSize: FONT_SIZE.base, flex: 1 },
  drawerActiveDot: { width: 5, height: 5, borderRadius: 3 },
  drawerFooter: { fontSize: FONT_SIZE.xs, textAlign: 'center' },

  // Header
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  menuBtn: { padding: SPACING.xs, gap: 5, justifyContent: 'center', width: 36 },
  menuLine: { width: 20, height: 2, borderRadius: 1 },
  menuLineShort: { width: 13 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, justifyContent: 'center' },
  headerOrb: { width: 26, height: 26, borderRadius: 8 },
  headerTitle: { fontSize: FONT_SIZE.md, fontWeight: '800', letterSpacing: -0.5 },
  headerRight: { width: 36, alignItems: 'center' },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },

  // Swipe Pager
  pageContent: { paddingHorizontal: SPACING.lg, gap: SPACING.md },

  // Tab Bar
  tabBarWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACING.sm, paddingHorizontal: SPACING.xs, justifyContent: 'space-evenly', height: TAB_BAR_H },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lockScreen: { ...StyleSheet.absoluteFillObject, zIndex: 2000, justifyContent: 'center', alignItems: 'center', gap: 20 },
  lockTitle: { fontSize: 20, fontWeight: '800' },
  unlockBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.full },
  unlockText: { color: '#FFF', fontWeight: '700' },
  tabPillActive: { width: 46, height: 38, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  tabPillInactive: { width: 46, height: 38, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { fontSize: 20, lineHeight: 24 },
  tooltip: { position: 'absolute', bottom: 46, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: RADIUS.sm, borderWidth: 1, minWidth: 56, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  tooltipText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
});
