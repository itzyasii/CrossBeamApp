import React, { useCallback, useEffect, useRef, useState } from "react";
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
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as NavigationBar from "expo-navigation-bar";
import * as SystemUI from "expo-system-ui";

import {
  HomeScreen,
  HistoryScreen,
  SettingsScreen,
  QRPairingScreen,
  DiscoverScreen,
  DevicesScreen,
} from "@/screens";
import { CrossBeamLogo, CrossBeamWordmark } from "@/components/CrossBeamLogo";
import { useDeviceDiscovery } from "@/hooks/useDeviceDiscovery";
import { useTheme } from "@/hooks/useTheme";
import { useTransferManager } from "@/hooks/useTransferManager";
import { useShareIntent } from "@/hooks/useShareIntent";
import { useAppStore } from "@/store";
import { useBiometrics } from "@/hooks/useBiometrics";
import { usePermissions } from "@/hooks/usePermissions";
import { haptics } from "@/services/haptics";
import {
  Home,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Fingerprint,
  Radar,
  Activity,
  ShieldCheck,
  HelpCircle,
  ChevronRight,
  Wifi,
  FileText,
  X,
  Smartphone,
  Users,
} from "lucide-react-native";
import { SPACING } from "@/theme/colors";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

const { width: SCREEN_W } = Dimensions.get("window");
const DRAWER_W = 300;
const TAB_BAR_H = 76;

type Tab = "home" | "discover" | "devices" | "history" | "settings";

const TABS: { id: Tab; icon: any; label: string }[] = [
  { id: "home", icon: Home, label: "HOME" },
  { id: "discover", icon: Radar, label: "RADAR" },
  { id: "devices", icon: Users, label: "TRUST" },
  { id: "history", icon: HistoryIcon, label: "HISTORY" },
  { id: "settings", icon: SettingsIcon, label: "SETTINGS" },
];

import { Modal, Linking, BackHandler } from "react-native";
import { FocusablePressable } from "@/components/FocusablePressable";
import * as KeepAwake from "expo-keep-awake";
import {
  IncomingApprovalRequest,
  platformFeatureService,
} from "@/services/platformFeatureService";
import { Device } from "@/types/domain";

export default function App() {
  const { colors } = useTheme();
  const { biometricLockEnabled } = useAppStore();
  const { authenticate } = useBiometrics();
  const [isLocked, setIsLocked] = useState(false);
  const [showQrPairing, setShowQrPairing] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [targetDevice, setTargetDevice] = useState<Device | null>(null);
  const [approvals, setApprovals] = useState<IncomingApprovalRequest[]>([]);
  const insets = useSafeAreaInsets();
  const [tabIndex, setTabIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [discoveryEnabled, setDiscoveryEnabled] = useState(false);

  const {
    getMissingPermissions,
    getMissingDiscoveryPermissions,
    requestDiscoveryPermissions,
  } = usePermissions();
  const { devices, isRefreshing, statusMessage, refreshDevices } =
    useDeviceDiscovery(discoveryEnabled);
  const { sharedFiles, setSharedFiles } = useShareIntent();
  const {
    transfers,
    transferError,
    selectedFiles,
    pickFiles,
    clearSelectedFiles,
    startTransfer,
    addSelectedFiles,
  } = useTransferManager(devices);

  const loadApprovals = useCallback(async () => {
    setApprovals(await platformFeatureService.getApprovals());
  }, []);

  // Handle Back Button for TV and Android
  useEffect(() => {
    const backAction = () => {
      if (showPrivacyModal) {
        setShowPrivacyModal(false);
        return true;
      }
      if (showTermsModal) {
        setShowTermsModal(false);
        return true;
      }
      if (showQrPairing) {
        setShowQrPairing(false);
        return true;
      }
      if (showDevicePicker) {
        setShowDevicePicker(false);
        return true;
      }
      if (drawerOpen) {
        closeDrawer();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, [
    drawerOpen,
    showDevicePicker,
    showQrPairing,
    showPrivacyModal,
    showTermsModal,
  ]);

  // Keep screen on during active transfers (especially for TV)
  useEffect(() => {
    const hasActiveTransfer = transfers.some((t) => t.status === "in-progress");
    if (hasActiveTransfer) {
      void KeepAwake.activateKeepAwakeAsync("crossbeam-active-transfer");
    } else {
      void KeepAwake.deactivateKeepAwake("crossbeam-active-transfer");
    }
  }, [transfers]);

  useEffect(() => {
    if (Platform.OS === "android") {
      void NavigationBar.setVisibilityAsync("hidden");
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

  const handleStartDiscovery = useCallback(async () => {
    const missingDiscovery = await getMissingDiscoveryPermissions();
    if (missingDiscovery.length > 0) {
      const granted = await requestDiscoveryPermissions();
      if (!granted) {
        const missing = await getMissingPermissions();
        if (missing.length > 0) {
          console.warn(`[App] Missing permissions: ${missing.join(", ")}`);
        }
        setDiscoveryEnabled(false);
        return;
      }
    }

    if (discoveryEnabled) {
      await refreshDevices();
      return;
    }

    setDiscoveryEnabled(true);
  }, [
    discoveryEnabled,
    getMissingDiscoveryPermissions,
    getMissingPermissions,
    refreshDevices,
    requestDiscoveryPermissions,
  ]);

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals, transfers.length]);

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
      Animated.spring(drawerX, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.spring(drawerX, {
        toValue: -DRAWER_W,
        tension: 85,
        friction: 13,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
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
    goToTab(1);
  };

  const handleSupportPress = () => {
    void haptics.light();
    Linking.openURL(
      "mailto:yasirpechuho1@gmail.com?subject=CrossBeam Support Request",
    );
  };

  const sendToDevice = useCallback(
    (device: Device) => {
      setTargetDevice(device);
      setShowDevicePicker(false);
      void startTransfer(device.id, device.name);
    },
    [startTransfer],
  );

  const handleStartTransferRequest = useCallback(
    (deviceId?: string) => {
      if (deviceId) {
        const device = devices.find((d) => d.id === deviceId);
        if (device) sendToDevice(device);
        return;
      }
      if (devices.length > 1) {
        setShowDevicePicker(true);
        return;
      }
      if (devices.length === 1) {
        sendToDevice(devices[0]);
        return;
      }
      void startTransfer(null, "Device");
    },
    [devices, sendToDevice, startTransfer],
  );

  const handleCreateClipboardBeam = useCallback(
    async (text: string) => {
      const file = await platformFeatureService.createClipboardBeamFile(text);
      if (file) addSelectedFiles([file]);
    },
    [addSelectedFiles],
  );

  const handleSaveCollection = useCallback(async () => {
    await platformFeatureService.saveCollection(
      `Batch ${new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      selectedFiles,
    );
  }, [selectedFiles]);

  const handleApprovalAction = useCallback(
    async (id: string, action: "accepted" | "rejected" | "trusted") => {
      setApprovals(await platformFeatureService.updateApproval(id, action));
    },
    [],
  );

  // Main app swipe gesture (new API)
  const mainSwipeGesture = Gesture.Pan()
    .onEnd((event) => {
      if (isLocked) return;
      const { translationX, translationY, velocityX, velocityY, x, y } = event;

      // Only process gestures that are clearly intentional swipes
      const isHorizontal = Math.abs(translationX) > Math.abs(translationY);

      // Horizontal Swipe for Drawer (only from left edge or when drawer is open)
      if (isHorizontal && Math.abs(velocityX) > 300) {
        // Open drawer only if swiping from left edge (x < 50) and drawer is closed
        if (translationX > 100 && x < 50 && !drawerOpen) {
          openDrawer();
        }
        // Close drawer if swiping left while drawer is open
        else if (translationX < -100 && drawerOpen) {
          closeDrawer();
        }
      }
      // Vertical Swipe for QR Scanner (only from top edge when scanner is closed)
      else if (!isHorizontal && Math.abs(velocityY) > 400) {
        // Open scanner only if swiping down from top edge (y < 60)
        if (translationY > 120 && y < 60 && !showQrPairing) {
          setShowQrPairing(true);
          void haptics.medium();
        }
      }
    })
    .minDistance(30)
    .activeOffsetX([-50, 50])
    .activeOffsetY([-60, 60]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={mainSwipeGesture}>
        <View style={[S.root, { backgroundColor: colors.background }]}>
          <StatusBar style="light" translucent />

          {/* Top Handle for vertical swipe down */}
          <View style={S.gestureOverlay} pointerEvents="none" />

          {drawerOpen && (
            <Animated.View style={[S.overlay, { opacity: overlayOpacity }]}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={closeDrawer}
              />
            </Animated.View>
          )}

          {/* ── Header ── */}
          <View style={[S.header, { paddingTop: insets.top + 10 }]}>
            <FocusablePressable onPress={openDrawer} style={S.menuIcon}>
              <View
                style={[S.menuDot, { backgroundColor: colors.textPrimary }]}
              />
              <View
                style={[S.menuDot, { backgroundColor: colors.textPrimary }]}
              />
            </FocusablePressable>
            <View style={S.headerCenter}>
              <CrossBeamLogo size={24} />
              <Text style={[S.headerTitle, { color: colors.textPrimary }]}>
                CROSSBEAM
              </Text>
            </View>
            <FocusablePressable
              onPress={handleDiscoveryPress}
              style={[
                S.headerIcon,
                {
                  backgroundColor: discoveryEnabled
                    ? colors.successMuted
                    : colors.surfaceHover,
                  borderColor: discoveryEnabled
                    ? `${colors.success}55`
                    : colors.borderStrong,
                },
                Platform.isTV && { display: "none" },
              ]}
            >
              <Radar
                size={22}
                color={discoveryEnabled ? colors.success : colors.textPrimary}
                strokeWidth={1.5}
              />
            </FocusablePressable>
          </View>

          {showQrPairing && (
            <QRPairingScreen onBack={() => setShowQrPairing(false)} />
          )}

          <FlatList
            ref={pagerRef}
            data={TABS}
            keyExtractor={(t) => t.id}
            horizontal
            pagingEnabled
            scrollEnabled={!isLocked}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setTabIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
            }
            renderItem={({ item: t }) => (
              <View style={{ width: SCREEN_W }}>
                <View
                  style={[
                    S.pageContent,
                    {
                      paddingTop: insets.top + 60,
                      paddingBottom: TAB_BAR_H + insets.bottom,
                    },
                  ]}
                >
                  {t.id === "home" && (
                    <HomeScreen
                      devices={devices}
                      transfers={transfers}
                      transferError={transferError}
                      selectedFiles={selectedFiles}
                      statusMessage={statusMessage}
                      isRefreshing={isRefreshing}
                      discoveryEnabled={discoveryEnabled}
                      approvals={approvals}
                      onApprovalAction={handleApprovalAction}
                      onCreateClipboardBeam={handleCreateClipboardBeam}
                      onSaveCollection={handleSaveCollection}
                      onStartDiscovery={handleStartDiscovery}
                      onPickFiles={pickFiles}
                      onStartTransfer={handleStartTransferRequest}
                      onOpenScanner={() => setShowQrPairing(true)}
                      onGoToTab={(id) =>
                        goToTab(TABS.findIndex((x) => x.id === id))
                      }
                      onClearFiles={clearSelectedFiles}
                    />
                  )}
                  {t.id === "discover" && (
                    <DiscoverScreen
                      devices={devices}
                      isRefreshing={isRefreshing}
                      discoveryEnabled={discoveryEnabled}
                      statusMessage={statusMessage}
                      onRefresh={handleStartDiscovery}
                    />
                  )}
                  {t.id === "devices" && (
                    <DevicesScreen
                      onPairDevice={() => setShowQrPairing(true)}
                    />
                  )}
                  {t.id === "history" && (
                    <HistoryScreen transfers={transfers} />
                  )}
                  {t.id === "settings" && <SettingsScreen />}
                </View>
              </View>
            )}
          />

          {/* ── Bottom Nav ── */}
          <BlurView
            intensity={20}
            tint="dark"
            style={[S.tabBarWrap, { paddingBottom: insets.bottom }]}
          >
            <View style={S.tabBar}>
              {TABS.map((t, i) => {
                const isActive = tabIndex === i;
                return (
                  <FocusablePressable
                    key={t.id}
                    onPress={() => goToTab(i)}
                    style={S.tabItem}
                  >
                    <t.icon
                      size={20}
                      color={isActive ? colors.accent : colors.textMuted}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <Text
                      style={[
                        S.tabLabel,
                        {
                          color: isActive
                            ? colors.textPrimary
                            : colors.textMuted,
                        },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </FocusablePressable>
                );
              })}
            </View>
          </BlurView>

          {isLocked && (
            <View
              style={[S.lockScreen, { backgroundColor: colors.background }]}
            >
              <Fingerprint size={64} color={colors.accent} strokeWidth={1} />
              <Text style={[S.lockTitle, { color: colors.textPrimary }]}>
                LOCKED
              </Text>
              <Pressable
                style={[S.unlockBtn, { borderColor: colors.borderStrong }]}
                onPress={async () => {
                  if (await authenticate()) setIsLocked(false);
                }}
              >
                <Text style={[S.unlockText, { color: colors.textSecondary }]}>
                  UNLOCK APP
                </Text>
              </Pressable>
            </View>
          )}

          {/* ── Drawer ── */}
          <Modal visible={showDevicePicker} animationType="slide" transparent>
            <BlurView intensity={80} tint="dark" style={S.modalContainer}>
              <View
                style={[
                  S.modalContent,
                  { backgroundColor: colors.backgroundElevated },
                ]}
              >
                <View style={S.modalHeader}>
                  <Smartphone size={24} color={colors.accent} />
                  <Text style={[S.modalTitle, { color: colors.textPrimary }]}>
                    Choose Device
                  </Text>
                  <Pressable
                    onPress={() => setShowDevicePicker(false)}
                    style={S.modalClose}
                  >
                    <X size={24} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <View style={S.devicePickerList}>
                  {devices.map((device) => (
                    <FocusablePressable
                      key={device.id}
                      onPress={() => sendToDevice(device)}
                      style={[
                        S.devicePickerItem,
                        {
                          borderColor:
                            targetDevice?.id === device.id
                              ? colors.accent
                              : colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            S.devicePickerName,
                            { color: colors.textPrimary },
                          ]}
                          numberOfLines={1}
                        >
                          {device.name}
                        </Text>
                        <Text
                          style={[
                            S.devicePickerMeta,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {device.platform} - {device.connection}
                        </Text>
                      </View>
                      <ChevronRight size={18} color={colors.accent} />
                    </FocusablePressable>
                  ))}
                </View>
              </View>
            </BlurView>
          </Modal>

          <Animated.View
            style={[S.drawer, { transform: [{ translateX: drawerX }] }]}
          >
            <View
              style={[
                S.drawerInner,
                {
                  backgroundColor: isDark
                    ? "#161622"
                    : colors.backgroundElevated,
                  paddingTop: insets.top + 24,
                  borderRightWidth: isDark ? 0 : 1,
                  borderRightColor: colors.border,
                },
              ]}
            >
              {/* Header */}
              <View style={S.drawerHeader}>
                <View style={S.drawerHeaderTop}>
                  <CrossBeamWordmark
                    width={220}
                    color={isDark ? undefined : colors.textPrimary}
                  />
                  <Text style={[S.drawerVersion, { color: colors.textMuted }]}>
                    Version 0.1
                  </Text>
                </View>

                <View
                  style={[
                    S.statusBadge,
                    {
                      backgroundColor: discoveryEnabled
                        ? colors.successMuted
                        : colors.surfaceHover,
                      borderColor: discoveryEnabled
                        ? `${colors.success}55`
                        : colors.borderStrong,
                    },
                  ]}
                >
                  <View
                    style={[
                      S.statusDot,
                      {
                        backgroundColor: discoveryEnabled
                          ? colors.success
                          : colors.textMuted,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      S.statusText,
                      {
                        color: discoveryEnabled
                          ? colors.success
                          : colors.textMuted,
                      },
                    ]}
                  >
                    {discoveryEnabled ? "SCANNING" : "SCANNING OFF"}
                  </Text>
                </View>
              </View>

              {/* Navigation */}
              <View style={S.drawerSection}>
                <View style={S.drawerList}>
                  {TABS.map((t, i) => {
                    const isActive = tabIndex === i;
                    const Icon = t.icon;
                    return (
                      <FocusablePressable
                        key={t.id}
                        onPress={() => {
                          goToTab(i);
                          closeDrawer();
                        }}
                        style={[
                          S.drawerItem,
                          isActive && {
                            backgroundColor: isDark
                              ? `${colors.accent}10`
                              : colors.accentHighlight,
                            borderColor: isDark
                              ? `${colors.accent}30`
                              : `${colors.accent}20`,
                          },
                        ]}
                      >
                        <View
                          style={[
                            S.itemIconWrap,
                            isActive && { backgroundColor: colors.accent },
                            !isActive && {
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.03)"
                                : colors.surfaceHover,
                            },
                          ]}
                        >
                          <Icon
                            size={18}
                            color={
                              isActive
                                ? "#FFFFFF"
                                : isDark
                                  ? colors.textSecondary
                                  : colors.textPrimary
                            }
                            strokeWidth={isActive ? 2.5 : 2}
                          />
                        </View>
                        <View style={S.itemTextWrap}>
                          <Text
                            style={[
                              S.itemName,
                              {
                                color: isActive
                                  ? colors.accent
                                  : colors.textPrimary,
                              },
                              isActive && { fontWeight: "900" },
                            ]}
                          >
                            {t.label}
                          </Text>
                          <Text
                            style={[S.itemDesc, { color: colors.textMuted }]}
                          >
                            {t.desc}
                          </Text>
                        </View>
                      </FocusablePressable>
                    );
                  })}
                </View>
              </View>

              {/* Quick Stats */}
              <View style={S.drawerSection}>
                <Text style={[S.sectionLabel, { color: colors.textMuted }]}>
                  ACTIVITY
                </Text>
                <View style={S.statsRow}>
                  <View
                    style={[S.statBox, { backgroundColor: colors.surface }]}
                  >
                    <Wifi size={16} color={colors.accent} />
                    <Text style={[S.statVal, { color: colors.textPrimary }]}>
                      {devices.length}
                    </Text>
                    <Text style={[S.statLabel, { color: colors.textMuted }]}>
                      DEVICES
                    </Text>
                  </View>
                  <View
                    style={[S.statBox, { backgroundColor: colors.surface }]}
                  >
                    <Activity size={16} color={colors.success} />
                    <Text style={[S.statVal, { color: colors.textPrimary }]}>
                      {
                        transfers.filter((t) => t.status === "in-progress")
                          .length
                      }
                    </Text>
                    <Text style={[S.statLabel, { color: colors.textMuted }]}>
                      TRANSFERS
                    </Text>
                  </View>
                </View>
              </View>

              {/* Footer */}
              <View
                style={[
                  S.drawerFooter,
                  {
                    borderTopColor: isDark
                      ? colors.border
                      : colors.borderStrong,
                  },
                ]}
              >
                <FocusablePressable
                  onPress={() => {
                    void haptics.light();
                    setThemePreference(isDark ? "light" : "dark");
                  }}
                  style={[
                    S.themeSwitch,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.05)"
                        : colors.surfaceHover,
                      borderColor: colors.borderStrong,
                    },
                  ]}
                >
                  {isDark ? (
                    <Sun size={18} color={colors.warning} strokeWidth={2.2} />
                  ) : (
                    <Moon size={18} color={colors.accent} strokeWidth={2.2} />
                  )}
                  <Text
                    style={[S.themeSwitchText, { color: colors.textPrimary }]}
                  >
                    {isDark ? "Light Mode" : "Dark Mode"}
                  </Text>
                </FocusablePressable>
              </View>
            </View>
          </Animated.View>

          {/* ── Privacy Policy Modal ── */}
          <Modal visible={showPrivacyModal} animationType="slide" transparent>
            <BlurView intensity={80} tint="dark" style={S.modalContainer}>
              <View
                style={[
                  S.modalContent,
                  { backgroundColor: colors.backgroundElevated },
                ]}
              >
                <View style={S.modalHeader}>
                  <ShieldCheck size={24} color={colors.accent} />
                  <Text style={[S.modalTitle, { color: colors.textPrimary }]}>
                    Privacy Policy
                  </Text>
                  <Pressable
                    onPress={() => setShowPrivacyModal(false)}
                    style={S.modalClose}
                  >
                    <X size={24} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <ScrollView style={S.modalScroll}>
                  <Text style={[S.modalText, { color: colors.textSecondary }]}>
                    Your privacy is paramount. CrossBeam uses end-to-end
                    peer-to-peer encryption for all transfers.
                    {"\n\n"}• No files are stored on our servers.{"\n"}• Data
                    stays on your local network.{"\n"}• We do not collect
                    personal identifiers.{"\n"}• Analytics are anonymous and
                    optional.
                  </Text>
                </ScrollView>
              </View>
            </BlurView>
          </Modal>

          {/* ── Terms Modal ── */}
          <Modal visible={showTermsModal} animationType="slide" transparent>
            <BlurView intensity={80} tint="dark" style={S.modalContainer}>
              <View
                style={[
                  S.modalContent,
                  { backgroundColor: colors.backgroundElevated },
                ]}
              >
                <View style={S.modalHeader}>
                  <FileText size={24} color={colors.accent} />
                  <Text style={[S.modalTitle, { color: colors.textPrimary }]}>
                    Terms of Service
                  </Text>
                  <Pressable
                    onPress={() => setShowTermsModal(false)}
                    style={S.modalClose}
                  >
                    <X size={24} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <ScrollView style={S.modalScroll}>
                  <Text style={[S.modalText, { color: colors.textSecondary }]}>
                    By using CrossBeam, you agree to:{"\n\n"}
                    1. Use the service for legal file sharing only.{"\n"}
                    2. Not attempt to reverse engineer the protocol.{"\n"}
                    3. Acknowledge that transfers depend on local network
                    quality.
                  </Text>
                </ScrollView>
              </View>
            </BlurView>
          </Modal>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    zIndex: 100,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.xl,
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  menuIcon: { width: 32, height: 32, justifyContent: "center", gap: 4 },
  menuDot: { width: 4, height: 4, borderRadius: 2 },
  headerTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 3 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  pageContent: { flex: 1, paddingHorizontal: SPACING.xl },

  tabBarWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  tabBar: {
    flexDirection: "row",
    height: TAB_BAR_H,
    alignItems: "center",
    justifyContent: "space-around",
  },
  tabItem: { alignItems: "center", gap: 4 },
  tabLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },

  lockScreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
    justifyContent: "center",
    alignItems: "center",
    gap: 32,
  },
  lockTitle: { fontSize: 14, fontWeight: "900", letterSpacing: 4 },
  unlockBtn: {
    borderWidth: 0.5,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 4,
  },
  unlockText: { fontSize: 10, fontWeight: "800", letterSpacing: 2 },

  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_W,
    zIndex: 200,
  },
  drawerInner: { flex: 1, paddingHorizontal: SPACING.xl, gap: 32 },
  drawerHeader: { gap: 16 },
  drawerHeaderTop: { gap: 8 },
  drawerVersion: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    opacity: 0.6,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },

  drawerSection: { gap: 16 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    opacity: 0.5,
  },

  drawerList: { gap: 12 },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  itemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  drawerLabel: { flex: 1, fontSize: 14, fontWeight: "700", letterSpacing: 0.5 },

  // Gesture Helpers
  gestureOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    zIndex: 1000,
  },

  statsRow: { flexDirection: "row", gap: 12 },
  statBox: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    alignItems: "center",
    gap: 4,
  },
  statVal: { fontSize: 18, fontWeight: "900" },
  statLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },

  drawerFooter: {
    paddingTop: 24,
    marginTop: "auto",
    paddingBottom: 24,
    borderTopWidth: 1,
    gap: 16,
  },
  themeSwitch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  themeSwitchText: {
    fontSize: 14,
    fontWeight: "800",
  },
  drawerLabel: { fontSize: 14, fontWeight: "800" },
  itemTextWrap: { flex: 1, gap: 2 },
  itemName: { fontSize: 15, fontWeight: "800" },
  itemDesc: { fontSize: 11, fontWeight: "600", opacity: 0.7 },

  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxHeight: "80%",
    borderRadius: 24,
    padding: 24,
    gap: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
  },
  modalClose: {
    padding: 4,
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  devicePickerList: { gap: 10 },
  devicePickerItem: {
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  devicePickerName: { fontSize: 15, fontWeight: "900" },
  devicePickerMeta: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    textTransform: "capitalize",
  },
});
