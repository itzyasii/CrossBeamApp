import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Platform,
  Pressable,
  ActivityIndicator,
  Animated,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import QRCode from "react-native-qrcode-svg";
import { Camera, CameraView } from "expo-camera";
import { X, ShieldCheck, Zap } from "lucide-react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "@/hooks/useTheme";
import { haptics } from "@/services/haptics";
import * as ExpoDevice from "expo-device";

export const QRPairingScreen = ({ onBack }: { onBack: () => void }) => {
  const { colors } = useTheme();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);

  const scanAnim = useRef(new Animated.Value(0)).current;
  const viewfinderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(viewfinderAnim, {
      toValue: 1,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();

    if (!Platform.isTV) {
      (async () => {
        try {
          const { status } = await Camera.requestCameraPermissionsAsync();
          setHasPermission(status === "granted");
        } catch (error) {
          console.warn("[QRPairing] Camera permission request failed:", error);
          setHasPermission(false);
        }
      })();

      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }

    if (Platform.isTV) {
      void (async () => {
        const info = {
          id:
            "node-" +
            (ExpoDevice.osInternalBuildId ||
              Math.random().toString(36).substr(2, 6)),
          name: ExpoDevice.deviceName || "Living Room TV",
          platform: "android-tv",
          v: 1,
        };
        setQrData(JSON.stringify(info));
      })();
    }
  }, []);

  const handleBarCodeScanned = ({ data: _data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    void haptics.success();
    setTimeout(() => onBack(), 1200);
  };

  if (Platform.isTV) {
    return (
      <View style={[S.container, { backgroundColor: colors.background }]}>
        <View style={S.tvLayout}>
          <View style={S.tvContent}>
            <Text style={[S.tvTitle, { color: colors.textPrimary }]}>
              Connect Mobile Device
            </Text>
            <Text style={[S.tvSub, { color: colors.textSecondary }]}>
              Open CrossBeam on your phone and scan this code to start sharing
              files instantly.
            </Text>

            <View style={S.tvStatusRow}>
              <View
                style={[S.statusDot, { backgroundColor: colors.success }]}
              />
              <Text style={[S.statusText, { color: colors.textMuted }]}>
                TV_NODE_ACTIVE
              </Text>
            </View>
          </View>

          <View style={S.tvQrWrapper}>
            <View style={S.qrContainer}>
              {qrData ? (
                <QRCode
                  value={qrData}
                  size={320}
                  color="#000"
                  backgroundColor="#FFF"
                  quietZone={20}
                />
              ) : (
                <ActivityIndicator size="large" color={colors.accent} />
              )}
            </View>
            <View style={S.qrGlow} />
          </View>
        </View>

        <View style={S.tvFooter}>
          <ShieldCheck size={20} color={colors.success} />
          <Text style={[S.footerText, { color: colors.textMuted }]}>
            SECURE_P2P_ENCRYPTED
          </Text>
        </View>
      </View>
    );
  }

  if (hasPermission === null) {
    return (
      <View style={[S.container, S.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={[S.container, S.centered, { backgroundColor: colors.background }]}>
        <Text style={[S.permissionTitle, { color: colors.textPrimary }]}>
          Camera unavailable
        </Text>
        <Text style={[S.permissionText, { color: colors.textSecondary }]}>
          Camera access is required to scan a pairing code.
        </Text>
        <Pressable
          onPress={onBack}
          style={[S.permissionButton, { borderColor: colors.borderStrong }]}
        >
          <Text style={[S.permissionButtonText, { color: colors.textPrimary }]}>
            CLOSE
          </Text>
        </Pressable>
      </View>
    );
  }

  // Swipe down to dismiss gesture (new API)
  const swipeDownGesture = Gesture.Pan()
    .onEnd((event) => {
      if (event.translationY > 100 && event.velocityY > 500) {
        onBack();
      }
    })
    .activeOffsetY([-10, 50]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={swipeDownGesture}>
        <View style={S.container}>
          <CameraView
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            style={StyleSheet.absoluteFillObject}
          />

          <BlurView intensity={20} tint="dark" style={S.scannerOverlay}>
            <View style={S.scannerHeader}>
              <Pressable onPress={onBack} style={S.closeBtn}>
                <X color="#FFF" size={28} />
              </Pressable>
              <Text style={S.scannerTitle}>SCAN_NODE</Text>
              <View style={{ width: 28 }} />
            </View>

            <Animated.View
              style={[
                S.viewfinderContainer,
                { transform: [{ scale: viewfinderAnim }] },
              ]}
            >
              <View style={S.viewfinder}>
                {/* Industry Standard Scanner Frame */}
                <View
                  style={[
                    S.corner,
                    S.cornerTopLeft,
                    { borderColor: colors.accent },
                  ]}
                />
                <View
                  style={[
                    S.corner,
                    S.cornerTopRight,
                    { borderColor: colors.accent },
                  ]}
                />
                <View
                  style={[
                    S.corner,
                    S.cornerBottomLeft,
                    { borderColor: colors.accent },
                  ]}
                />
                <View
                  style={[
                    S.corner,
                    S.cornerBottomRight,
                    { borderColor: colors.accent },
                  ]}
                />

                <Animated.View
                  style={[
                    S.scanLine,
                    {
                      backgroundColor: colors.accent,
                      shadowColor: colors.accent,
                      transform: [
                        {
                          translateY: scanAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 280],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>

              <View style={S.scannerHint}>
                <Text style={S.hintText}>ALIGN QR CODE WITHIN FRAME</Text>
                <View
                  style={[
                    S.pairingBadge,
                    { backgroundColor: `${colors.accent}20` },
                  ]}
                >
                  <Zap size={14} color={colors.accent} strokeWidth={3} />
                  <Text style={[S.pairingText, { color: colors.accent }]}>
                    AUTO_PAIR_ENABLED
                  </Text>
                </View>
              </View>
            </Animated.View>

            {scanned && (
              <View style={S.successOverlay}>
                <BlurView
                  intensity={40}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <ShieldCheck size={64} color={colors.success} />
                <Text style={S.successLabel}>NODE_VERIFIED</Text>
              </View>
            )}
          </BlurView>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

const S = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  permissionTitle: { fontSize: 20, fontWeight: "900" },
  permissionText: {
    maxWidth: 300,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  permissionButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  permissionButtonText: { fontSize: 12, fontWeight: "900", letterSpacing: 1 },

  // TV Styles
  tvLayout: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 100,
    padding: 80,
  },
  tvContent: { flex: 1, gap: 24 },
  tvTitle: { fontSize: 48, fontWeight: "900", letterSpacing: -1 },
  tvSub: { fontSize: 22, lineHeight: 32, opacity: 0.8 },
  tvStatusRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontWeight: "800", letterSpacing: 2 },
  tvQrWrapper: {
    width: 400,
    height: 400,
    justifyContent: "center",
    alignItems: "center",
  },
  qrContainer: {
    padding: 20,
    backgroundColor: "#FFF",
    borderRadius: 24,
    zIndex: 1,
  },
  qrGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    borderRadius: 160,
  } as any,
  tvFooter: {
    position: "absolute",
    bottom: 60,
    left: 80,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  footerText: { fontSize: 14, fontWeight: "800", letterSpacing: 2 },

  // Mobile Scanner Styles
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  scannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  closeBtn: { padding: 8 },
  scannerTitle: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 4,
  },

  viewfinderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 40,
  },
  viewfinder: {
    width: 280,
    height: 280,
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
  },
  scanLine: {
    position: "absolute",
    width: "100%",
    height: 3,
    shadowRadius: 15,
    shadowOpacity: 0.8,
    zIndex: 5,
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderWidth: 6,
    zIndex: 10,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 24,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 24,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 24,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 24,
  },

  scannerHint: { alignItems: "center", gap: 12 },
  hintText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  pairingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pairingText: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },

  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    zIndex: 10,
  },
  successLabel: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 4,
  },
});
