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
import * as DeviceInfo from "expo-device";

import { HomeScreen, SettingsScreen } from "@/screens";

const HistoryScreen = React.lazy(() =>
  import("@/screens/HistoryScreen").then((m) => ({ default: m.HistoryScreen })),
);
const DiscoverScreen = React.lazy(() =>
  import("@/screens/DiscoverScreen").then((m) => ({
    default: m.DiscoverScreen,
  })),
);
const DevicesScreen = React.lazy(() =>
  import("@/screens/DevicesScreen").then((m) => ({ default: m.DevicesScreen })),
);
const QRPairingScreen = React.lazy(() =>
  import("@/screens/QRPairingScreen").then((m) => ({
    default: m.QRPairingScreen,
  })),
);
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
  Sun,
  Moon,
} from "lucide-react-native";
import { SPACING } from "@/theme/colors";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

const { width: SCREEN_W } = Dimensions.get("window");
const DRAWER_W = 300;
const TAB_BAR_H = 98;

type Tab = "home" | "discover" | "devices" | "history" | "settings";
type TabConfig = { id: Tab; icon: any; label: string; desc: string };

const TABS: TabConfig[] = [
  { id: "home", icon: Home, label: "HOME", desc: "Send and receive" },
  { id: "discover", icon: Radar, label: "FIND", desc: "Nearby devices" },
  { id: "devices", icon: Users, label: "SAVED", desc: "Remembered devices" },
  {
    id: "history",
    icon: HistoryIcon,
    label: "HISTORY",
    desc: "Past transfers",
  },
  {
    id: "settings",
    icon: SettingsIcon,
    label: "SETTINGS",
    desc: "Preferences",
  },
];

const BOTTOM_TABS: Tab[] = [
  "discover",
  "devices",
  "home",
  "history",
  "settings",
];

import { Modal, Linking, BackHandler } from "react-native";
import { FocusablePressable } from "@/components/FocusablePressable";
import * as KeepAwake from "expo-keep-awake";
import { platformFeatureService } from "@/services/platformFeatureService";
import { notificationService } from "@/services/notificationService";
import { Device } from "@/types/domain";
import { IncomingTransferApprovalModal } from "@/components/IncomingTransferApprovalModal";
import { useIncomingTransferApprovals } from "@/hooks/useIncomingTransferApprovals";

export default function App() {
  const { colors, isDark } = useTheme();
  // Keep the drawer visually tied to the main canvas. The elevated light token is
  // intentionally cream-colored for the bottom navigation and other accents.
  const DRAWER_BACKGROUND = colors.background;
  const DRAWER_TEXT_PRIMARY = colors.textPrimary;
  const DRAWER_TEXT_SECONDARY = colors.textSecondary;
  const DRAWER_TEXT_MUTED = colors.textMuted;
  const DRAWER_SURFACE = colors.surface;
  const DRAWER_SURFACE_HOVER = colors.surfaceHover;
  const DRAWER_BORDER = colors.border;
  const DRAWER_BORDER_STRONG = colors.borderStrong;
  const { biometricLockEnabled, setThemePreference } = useAppStore();
  const { authenticate } = useBiometrics();
  const [isLocked, setIsLocked] = useState(false);
  const [showQrPairing, setShowQrPairing] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [targetDevice, setTargetDevice] = useState<Device | null>(null);
  const tvDiscoveryPermissionRequested = useRef(false);
  const insets = useSafeAreaInsets();
  const [tabIndex, setTabIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [discoveryEnabled, setDiscoveryEnabled] = useState(Platform.isTV);

  const {
    getMissingPermissions,
    getMissingDiscoveryPermissions,
    requestDiscoveryPermissions,
  } = usePermissions();
  const { devices, isRefreshing, statusMessage, refreshDevices, connectDevice } =
    useDeviceDiscovery(discoveryEnabled);
  const { approvals, activeApproval, handleApprovalAction } =
    useIncomingTransferApprovals(devices);
  const { sharedFiles, setSharedFiles } = useShareIntent();
  const {
    transfers,
    transferError,
    transferStatus,
    isSending,
    selectedFiles,
    pickFiles,
    clearSelectedFiles,
    startTransfer,
    addSelectedFiles,
    retryTransfer,
    reportTransferError,
  } = useTransferManager(devices);

  useEffect(() => {
    if (!Platform.isTV || tvDiscoveryPermissionRequested.current) return;
    tvDiscoveryPermissionRequested.current = true;
    // NSD can still receive on a LAN when optional Wi-Fi Direct/BLE permissions
    // are declined, so TV receiver mode must remain active.
    void requestDiscoveryPermissions().finally(() => setDiscoveryEnabled(true));
  }, [requestDiscoveryPermissions]);

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
      if (activeApproval) {
        void handleApprovalAction(activeApproval.id, "rejected");
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
    activeApproval,
    handleApprovalAction,
  ]);

  // Keep screen on during active transfers (especially for TV)
  useEffect(() => {
    const hasActiveTransfer = transfers.some((t) => t.status === "in-progress");
    if (hasActiveTransfer || (Platform.isTV && discoveryEnabled)) {
      void KeepAwake.activateKeepAwakeAsync("crossbeam-active-transfer");
    } else {
      void KeepAwake.deactivateKeepAwake("crossbeam-active-transfer");
    }
  }, [discoveryEnabled, transfers]);

  useEffect(() => {
    if (Platform.OS === "android") {
      void NavigationBar.setVisibilityAsync("hidden").catch((error) => {
        console.warn("[App] Navigation bar update failed:", error);
      });
    }
    void SystemUI.setBackgroundColorAsync(colors.background).catch((error) => {
      console.warn("[App] System UI update failed:", error);
    });
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
    void notificationService.requestPermissions();
  }, []);

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
    void Linking.openURL(
      "mailto:yasirpechuho1@gmail.com?subject=CrossBeam Support Request",
    ).catch((error) => {
      console.warn("[App] Unable to open support email:", error);
    });
  };

  const sendToDevice = useCallback(
    async (device: Device) => {
      try {
        const readyDevice = device.isTransferReady
          ? device
          : device.connection === "wifi-direct"
            ? await connectDevice(device.id)
            : null;
        if (!readyDevice?.isTransferReady) {
          throw new Error(device.statusMessage || "This device isn't ready to receive files yet.");
        }
        setTargetDevice(readyDevice);
        setShowDevicePicker(false);
        await startTransfer(readyDevice.id, readyDevice.name);
      } catch (error) {
        console.warn("[App] Device connection failed:", error);
        reportTransferError(error);
      }
    },
    [connectDevice, reportTransferError, startTransfer],
  );

  const handleStartTransferRequest = useCallback(
    (deviceId?: string) => {
      if (deviceId) {
        const device = devices.find((d) => d.id === deviceId);
        if (device) void sendToDevice(device);
        return;
      }
      if (devices.length > 1) {
        setShowDevicePicker(true);
        return;
      }
      if (devices.length === 1) {
        void sendToDevice(devices[0]);
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
            <React.Suspense
              fallback={
                <View style={{ padding: 24 }}>
                  <Text>Loading scanner…</Text>
                </View>
              }
            >
              <QRPairingScreen onBack={() => setShowQrPairing(false)} />
            </React.Suspense>
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
                      transferStatus={transferStatus}
                      isSending={isSending}
                      selectedFiles={selectedFiles}
                      isRefreshing={isRefreshing}
                      discoveryEnabled={discoveryEnabled}
                      approvals={approvals}
                      onApprovalAction={handleApprovalAction}
                      onCreateClipboardBeam={handleCreateClipboardBeam}
                      onSaveCollection={handleSaveCollection}
                      receiverDeviceName={DeviceInfo.deviceName || "Android TV"}
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
                    <React.Suspense
                      fallback={
                        <View style={{ padding: 24 }}>
                          <Text>Loading…</Text>
                        </View>
                      }
                    >
                      <DiscoverScreen
                        devices={devices}
                        isRefreshing={isRefreshing}
                        discoveryEnabled={discoveryEnabled}
                        statusMessage={statusMessage}
                        onRefresh={handleStartDiscovery}
                        onSelectDevice={(id) => handleStartTransferRequest(id)}
                      />
                    </React.Suspense>
                  )}
                  {t.id === "devices" && (
                    <React.Suspense
                      fallback={
                        <View style={{ padding: 24 }}>
                          <Text>Loading…</Text>
                        </View>
                      }
                    >
                      <DevicesScreen
                        onPairDevice={() => setShowQrPairing(true)}
                      />
                    </React.Suspense>
                  )}
                  {t.id === "history" && (
                    <React.Suspense
                      fallback={
                        <View style={{ padding: 24 }}>
                          <Text>Loading…</Text>
                        </View>
                      }
                    >
                      <HistoryScreen transfers={transfers} onRetry={retryTransfer} />
                    </React.Suspense>
                  )}
                  {t.id === "settings" && <SettingsScreen />}
                </View>
              </View>
            )}
          />

          {/* ── Bottom Nav ── */}
          <View
            pointerEvents="box-none"
            style={[S.tabBarWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}
          >
            <View style={S.tabBar}>
              <BlurView
                intensity={isDark ? 34 : 55}
                tint={isDark ? "dark" : "light"}
                pointerEvents="none"
                style={[
                  S.tabBarBackground,
                  {
                    backgroundColor: isDark
                      ? "rgba(5,43,58,0.88)"
                      : "rgba(253,252,220,0.9)",
                    borderColor: isDark
                      ? "rgba(128,206,215,0.22)"
                      : "rgba(0,126,167,0.14)",
                  },
                ]}
              />
              {BOTTOM_TABS.map((id) => {
                if (id === "home") return <View key={id} style={S.centerGap} />;

                const tabIndexForItem = TABS.findIndex((tab) => tab.id === id);
                const tab = TABS[tabIndexForItem];
                const isActive = tabIndex === tabIndexForItem;
                const Icon = tab.icon;

                return (
                  <FocusablePressable
                    key={id}
                    accessibilityRole="tab"
                    accessibilityLabel={tab.label}
                    accessibilityState={{ selected: isActive }}
                    onPress={() => {
                      void haptics.light();
                      goToTab(tabIndexForItem);
                    }}
                    style={S.tabItem}
                    focusedStyle={S.tabItemFocused}
                  >
                    <Icon
                      size={22}
                      color={isActive ? colors.accentLight : colors.textMuted}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />
                    <View
                      style={[
                        S.tabIndicator,
                        {
                          backgroundColor: isActive
                            ? colors.accentLight
                            : "transparent",
                        },
                      ]}
                    />
                  </FocusablePressable>
                );
              })}

              <FocusablePressable
                accessibilityRole="tab"
                accessibilityLabel="Home"
                accessibilityState={{ selected: tabIndex === 0 }}
                onPress={() => {
                  void haptics.medium();
                  goToTab(0);
                }}
                style={[
                  S.centerTab,
                  {
                    backgroundColor: colors.accent,
                    borderColor: colors.background,
                    shadowColor: colors.accentLight,
                  },
                ]}
                focusedStyle={S.centerTabFocused}
              >
                <Home size={27} color="#FFFFFF" strokeWidth={2.1} />
              </FocusablePressable>
              <View
                pointerEvents="none"
                style={[
                  S.centerIndicator,
                  {
                    backgroundColor:
                      tabIndex === 0 ? colors.accentLight : "transparent",
                  },
                ]}
              />
            </View>
          </View>

          {isLocked && (
            <View
              style={[S.lockScreen, { backgroundColor: colors.background }]}
            >
              <Fingerprint size={64} color={colors.accent} strokeWidth={1} />
              <Text style={[S.lockTitle, { color: colors.textPrimary }]}>
                CrossBeam is locked
              </Text>
              <Pressable
                style={[S.unlockBtn, { borderColor: colors.borderStrong }]}
                onPress={async () => {
                  if (await authenticate()) setIsLocked(false);
                }}
              >
                <Text style={[S.unlockText, { color: colors.textSecondary }]}>
                  Unlock
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
                    Choose a device
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
                          {device.statusMessage ?? (device.isTransferReady ? "Ready to share" : "Nearby")}
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
                  backgroundColor: DRAWER_BACKGROUND,
                  paddingTop: insets.top + 24,
                  borderRightWidth: isDark ? 0 : 1,
                  borderRightColor: DRAWER_BORDER,
                },
              ]}
            >
              {/* Header */}
              <View style={S.drawerHeader}>
                <View style={S.drawerHeaderTop}>
                  <CrossBeamWordmark width={220} />
                  <Text style={[S.drawerVersion, { color: DRAWER_TEXT_MUTED }]}>
                    Version 0.1
                  </Text>
                </View>

                <View
                  style={[
                    S.statusBadge,
                    {
                      backgroundColor: discoveryEnabled
                        ? colors.successMuted
                        : DRAWER_SURFACE_HOVER,
                      borderColor: discoveryEnabled
                        ? `${colors.success}55`
                        : DRAWER_BORDER_STRONG,
                    },
                  ]}
                >
                  <View
                    style={[
                      S.statusDot,
                      {
                        backgroundColor: discoveryEnabled
                          ? colors.success
                          : DRAWER_TEXT_MUTED,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      S.statusText,
                      {
                        color: discoveryEnabled
                          ? colors.success
                          : DRAWER_TEXT_MUTED,
                      },
                    ]}
                  >
                    {discoveryEnabled ? "FINDING DEVICES" : "NOT LOOKING"}
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
                                : DRAWER_SURFACE_HOVER,
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
                                  : DRAWER_TEXT_SECONDARY
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
                                  : DRAWER_TEXT_PRIMARY,
                              },
                              isActive && { fontWeight: "900" },
                            ]}
                          >
                            {t.label}
                          </Text>
                          <Text
                            style={[S.itemDesc, { color: DRAWER_TEXT_MUTED }]}
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
                <Text style={[S.sectionLabel, { color: DRAWER_TEXT_MUTED }]}>
                  AT A GLANCE
                </Text>
                <View style={S.statsRow}>
                  <View
                    style={[S.statBox, { backgroundColor: DRAWER_SURFACE }]}
                  >
                    <Wifi size={16} color={colors.accent} />
                    <Text style={[S.statVal, { color: DRAWER_TEXT_PRIMARY }]}>
                      {devices.length}
                    </Text>
                    <Text style={[S.statLabel, { color: DRAWER_TEXT_MUTED }]}>
                      NEARBY
                    </Text>
                  </View>
                  <View
                    style={[S.statBox, { backgroundColor: DRAWER_SURFACE }]}
                  >
                    <Activity size={16} color={colors.success} />
                    <Text style={[S.statVal, { color: DRAWER_TEXT_PRIMARY }]}>
                      {
                        transfers.filter((t) => t.status === "in-progress")
                          .length
                      }
                    </Text>
                    <Text style={[S.statLabel, { color: DRAWER_TEXT_MUTED }]}>
                      SENDING
                    </Text>
                  </View>
                </View>
              </View>

              {/* Footer */}
              <View
                style={[
                  S.drawerFooter,
                  {
                    borderTopColor: DRAWER_BORDER_STRONG,
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
                        : DRAWER_SURFACE_HOVER,
                      borderColor: DRAWER_BORDER_STRONG,
                    },
                  ]}
                >
                  {isDark ? (
                    <Sun size={18} color={colors.warning} strokeWidth={2.2} />
                  ) : (
                    <Moon size={18} color={colors.accent} strokeWidth={2.2} />
                  )}
                  <Text
                    style={[S.themeSwitchText, { color: DRAWER_TEXT_PRIMARY }]}
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
                    CrossBeam sends files straight to a nearby device. Your
                    files aren't uploaded to CrossBeam.
                    {"\n\n"}• Your sharing history stays on this device.{"\n"}• You
                    choose whether to accept each new sender.{"\n"}• Encrypted
                    connections are still being developed, so share only with
                    people you trust.
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
                    1. Share only files you have the right to share.{"\n"}
                    2. Respect other people and their devices.{"\n"}
                    3. Understand that speed and availability depend on the
                    connection between your devices.
                  </Text>
                </ScrollView>
              </View>
            </BlurView>
          </Modal>

          {/* Incoming transfer approval modal (shows when an approval is active) */}
          <IncomingTransferApprovalModal
            approval={activeApproval}
            onAccept={() =>
              void (
                activeApproval &&
                handleApprovalAction(activeApproval.id, "accepted")
              )
            }
            onReject={() =>
              void (
                activeApproval &&
                handleApprovalAction(activeApproval.id, "rejected")
              )
            }
            onTrust={() =>
              void (
                activeApproval &&
                handleApprovalAction(activeApproval.id, "trusted")
              )
            }
          />
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
    left: SPACING.lg,
    right: SPACING.lg,
    zIndex: 50,
    alignItems: "center",
  },
  tabBar: {
    width: "100%",
    maxWidth: 560,
    flexDirection: "row",
    height: 66,
    alignItems: "center",
    borderRadius: 27,
    overflow: "visible",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 16,
  },
  tabBarBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 27,
    borderWidth: 1,
    overflow: "hidden",
  },
  tabItem: {
    flex: 1,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 20,
  },
  tabItemFocused: { borderWidth: 1 },
  tabIndicator: { width: 5, height: 5, borderRadius: 3 },
  centerGap: { flex: 1.08 },
  centerTab: {
    position: "absolute",
    top: -25,
    left: "50%",
    width: 68,
    height: 68,
    marginLeft: -34,
    borderRadius: 34,
    borderWidth: 7,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 12,
    elevation: 18,
  },
  centerTabFocused: { borderWidth: 7 },
  centerIndicator: {
    position: "absolute",
    bottom: 7,
    left: "50%",
    width: 5,
    height: 5,
    marginLeft: -2.5,
    borderRadius: 3,
  },

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
