import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';

import {
  HomeScreen,
  HistoryScreen,
  SettingsScreen,
  QRPairingScreen
} from '@/screens';
import { useDeviceDiscovery } from '@/hooks/useDeviceDiscovery';
import { useTheme } from '@/hooks/useTheme';
import { useTransferManager } from '@/hooks/useTransferManager';
import { useShareIntent } from '@/hooks/useShareIntent';
import { useAppStore } from '@/store';
import { useBiometrics } from '@/hooks/useBiometrics';
import { haptics } from '@/services/haptics';
import {
  Home,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Fingerprint,
  Box,
  Radar
} from 'lucide-react-native';
import { SPACING } from '@/theme/colors';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = 300;
const TAB_BAR_H = 76;

type Tab = 'home' | 'history' | 'settings';

const TABS: { id: Tab; icon: any; label: string }[] = [
  { id: 'home',      icon: Home,         label: 'HOME' },
  { id: 'history',   icon: HistoryIcon,  label: 'HISTORY' },
  { id: 'settings',  icon: SettingsIcon, label: 'SETTINGS' },
];

export default function App() {
  const { colors, isDark } = useTheme();
  const { biometricLockEnabled } = useAppStore();
  const { authenticate } = useBiometrics();
  const [isLocked, setIsLocked] = useState(false);
  const [showQrPairing, setShowQrPairing] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS === 'android') {
      void NavigationBar.setVisibilityAsync('hidden');
    }
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  useEffect(() => {
    if (biometricLockEnabled) {
      setIsLocked(true);
      void (async () => {
        if (await authenticate()) setIsLocked(false);
      })();
    }
  }, []);

  const [tabIndex, setTabIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const tab = TABS[tabIndex].id;

  const { devices, isRefreshing, statusMessage, refreshDevices } = useDeviceDiscovery();
  const { sharedFiles, setSharedFiles } = useShareIntent();
  const { transfers, selectedFiles, pickFiles, clearSelectedFiles, startTransfer, togglePause, cancelTransfer, addSelectedFiles } = useTransferManager();

  const pagerRef = useRef<FlatList>(null);
  const goToTab = useCallback((idx: number) => {
    setTabIndex(idx);
    pagerRef.current?.scrollToIndex({ index: idx, animated: true });
  }, []);

  const drawerX = useRef(new Animated.Value(-DRAWER_W)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const openDrawer = () => {
    void haptics.light();
    setDrawerOpen(true);
    Animated.parallel([
      Animated.spring(drawerX, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.spring(drawerX, { toValue: -DRAWER_W, tension: 85, friction: 13, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setDrawerOpen(false));
  };

  useEffect(() => {
    if (sharedFiles.length > 0) {
      addSelectedFiles(sharedFiles);
      setSharedFiles([]);
      goToTab(0); // Go to Home
    }
  }, [sharedFiles, addSelectedFiles, setSharedFiles, goToTab]);

  const handleDiscoveryPress = () => {
    void haptics.medium();
    setShowQrPairing(true);
  };

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <StatusBar style="light" translucent />

      {drawerOpen && (
        <Animated.View style={[S.overlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeDrawer} />
        </Animated.View>
      )}

      {/* ── Header ── */}
      <View style={[S.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={openDrawer} style={S.menuIcon}>
          <View style={[S.menuDot, { backgroundColor: colors.textPrimary }]} />
          <View style={[S.menuDot, { backgroundColor: colors.textPrimary }]} />
        </Pressable>
        <Text style={[S.headerTitle, { color: colors.textPrimary }]}>CROSSBEAM</Text>
        <Pressable onPress={handleDiscoveryPress} style={S.headerIcon}>
           <Radar size={22} color={devices.length > 0 ? colors.accent : colors.textPrimary} strokeWidth={1.5} />
        </Pressable>
      </View>

      {showQrPairing && <QRPairingScreen onBack={() => setShowQrPairing(false)} />}

      <FlatList
        ref={pagerRef}
        data={TABS}
        keyExtractor={t => t.id}
        horizontal
        pagingEnabled
        scrollEnabled={!isLocked}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setTabIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
        renderItem={({ item: t }) => (
          <View style={{ width: SCREEN_W }}>
            <View style={[S.pageContent, { paddingTop: insets.top + 60, paddingBottom: TAB_BAR_H + insets.bottom }]}>
              {t.id === 'home' && (
                <HomeScreen
                  devices={devices}
                  transfers={transfers}
                  selectedFiles={selectedFiles}
                  onStartDiscovery={refreshDevices}
                  onPickFiles={pickFiles}
                  onStartTransfer={() => startTransfer(null, 'Device')}
                  onOpenScanner={() => setShowQrPairing(true)}
                  onGoToTab={(id) => goToTab(TABS.findIndex(x => x.id === id))}
                  onClearFiles={clearSelectedFiles}
                />
              )}
              {t.id === 'history' && <HistoryScreen transfers={transfers} />}
              {t.id === 'settings' && <SettingsScreen />}
            </View>
          </View>
        )}
      />

      {/* ── Bottom Nav ── */}
      <BlurView intensity={20} tint="dark" style={[S.tabBarWrap, { paddingBottom: insets.bottom }]}>
        <View style={S.tabBar}>
          {TABS.map((t, i) => (
            <Pressable key={t.id} onPress={() => goToTab(i)} style={S.tabItem}>
              <t.icon size={22} color={tabIndex === i ? colors.accent : colors.textMuted} />
              <Text style={[S.tabLabel, { color: tabIndex === i ? colors.textPrimary : colors.textMuted }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </BlurView>

      {isLocked && (
        <View style={[S.lockScreen, { backgroundColor: colors.background }]}>
          <Fingerprint size={64} color={colors.accent} strokeWidth={1} />
          <Text style={[S.lockTitle, { color: colors.textPrimary }]}>LOCKED</Text>
          <Pressable style={[S.unlockBtn, { borderColor: colors.borderStrong }]} onPress={async () => {
            if (await authenticate()) setIsLocked(false);
          }}>
            <Text style={[S.unlockText, { color: colors.textSecondary }]}>UNLOCK APP</Text>
          </Pressable>
        </View>
      )}

      {/* ── Drawer ── */}
      <Animated.View style={[S.drawer, { transform: [{ translateX: drawerX }] }]}>
        <View style={[S.drawerInner, { backgroundColor: colors.backgroundElevated, paddingTop: insets.top + 20 }]}>
           <View style={S.drawerHeader}>
              <Box size={32} color={colors.accent} strokeWidth={1} />
              <Text style={[S.drawerBrand, { color: colors.textPrimary }]}>CROSSBEAM</Text>
            </View>
            <View style={S.drawerList}>
              {TABS.map((t, i) => (
                <Pressable key={t.id} onPress={() => { goToTab(i); closeDrawer(); }} style={S.drawerItem}>
                   <t.icon size={20} color={tabIndex === i ? colors.accent : colors.textSecondary} />
                   <Text style={[S.drawerLabel, { color: tabIndex === i ? colors.textPrimary : colors.textSecondary }]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
        </View>
      </Animated.View>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 100 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.xl },
  menuIcon: { width: 32, height: 32, justifyContent: 'center', gap: 4 },
  menuDot: { width: 4, height: 4, borderRadius: 2 },
  headerTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 3 },
  headerIcon: { width: 32 },

  pageContent: { flex: 1, paddingHorizontal: SPACING.xl },

  tabBarWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.05)' },
  tabBar: { flexDirection: 'row', height: TAB_BAR_H, alignItems: 'center', justifyContent: 'space-around' },
  tabItem: { alignItems: 'center', gap: 4 },
  tabLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },

  lockScreen: { ...StyleSheet.absoluteFillObject, zIndex: 2000, justifyContent: 'center', alignItems: 'center', gap: 32 },
  lockTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 4 },
  unlockBtn: { borderWidth: 0.5, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 4 },
  unlockText: { fontSize: 10, fontWeight: '800', letterSpacing: 2 },

  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: DRAWER_W, zIndex: 200 },
  drawerInner: { flex: 1, paddingHorizontal: SPACING.xl, gap: 40 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  drawerBrand: { fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  drawerList: { gap: 24 },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  drawerLabel: { fontSize: 14, fontWeight: '700', letterSpacing: 1 },
});
