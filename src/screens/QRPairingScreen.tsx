import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Platform,
  Pressable,
  ActivityIndicator,
  Animated,
  Image,
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
import { nativeCrossBeam } from "@/native/crossbeamNative";
import { Device } from "@/types/domain";
import qrCenterBadge from "../../assets/QR/crossbeam-qr-center-badge.png";
import qrCornerFrame from "../../assets/QR/crossbeam-qr-corner-frame.png";

// A pale brand surface preserves the QR quiet zone and camera contrast without
// falling back to a generic white card.
const QR_LIGHT_SURFACE = "#DDF9FC";
const QR_DARK_MODULE = "#031C26";

export const QRPairingScreen = ({
  onBack,
  onPaired,
}: {
  onBack: () => void;
  onPaired?: (device: Device) => void;
}) => {
  const { colors } = useTheme();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);

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
        const payload = await nativeCrossBeam.getPairingPayload();
        if (!payload) {
          setPairingError("Connect this TV to Wi-Fi to create a pairing code.");
          return;
        }
        setQrData(JSON.stringify(payload));
      })();
    }
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    try {
      const payload = JSON.parse(data);
      if (
        payload?.scheme !== "crossbeam-pair" ||
        payload?.version !== 1 ||
        typeof payload.host !== "string" ||
        typeof payload.port !== "number"
      ) {
        throw new Error("This is not a CrossBeam pairing code.");
      }
      const device = await nativeCrossBeam.addQrPeer(payload);
      setScanned(true);
      void haptics.success();
      onPaired?.(device);
      setTimeout(onBack, 1200);
    } catch (error) {
      void haptics.error();
      setPairingError(
        error instanceof Error ? error.message : "Could not pair with this device.",
      );
    }
  };

  if (Platform.isTV) {
    return (
      <View style={[S.container, S.tvScreen]}>
        <View style={S.tvLayout}>
          <View style={S.tvContent}>
            <Text style={[S.tvTitle, { color: colors.textPrimary }]}>
              PAIR WITH THIS TV
            </Text>
            <Text style={[S.tvSub, { color: colors.textSecondary }]}>
              Scan with CrossBeam to connect instantly.
            </Text>

            <View style={S.tvStatusRow}>
              <View
                style={[S.statusDot, { backgroundColor: colors.success }]}
              />
              <Text style={[S.statusText, { color: colors.textMuted }]}>
                Ready to scan
              </Text>
            </View>
          </View>

          <View style={S.tvQrWrapper}>
            <View style={S.qrHalo} />
            <Image
              source={qrCornerFrame}
              style={S.tvCornerFrame}
              resizeMode="contain"
            />
            <View style={[S.qrContainer, { backgroundColor: QR_LIGHT_SURFACE }]}>
              {qrData ? (
                <QRCode
                  value={qrData}
                  size={400}
                  color={QR_DARK_MODULE}
                  backgroundColor={QR_LIGHT_SURFACE}
                  quietZone={26}
                  ecl="H"
                />
              ) : (
                <ActivityIndicator size="large" color={colors.accent} />
              )}
              {qrData && (
                <Image source={qrCenterBadge} style={S.qrLogoBadge} resizeMode="contain" />
              )}
            </View>
            <View style={S.qrGlow} />
          </View>
        </View>

        <View style={S.tvFooter}>
          <ShieldCheck size={20} color={colors.success} />
          <Text style={[S.footerText, { color: colors.textMuted }]}>
            {pairingError ?? "Secure local pairing · code expires in 10 minutes"}
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
          Camera access needed
        </Text>
        <Text style={[S.permissionText, { color: colors.textSecondary }]}>
          Allow camera access to scan a device code.
        </Text>
        <Pressable
          onPress={onBack}
          style={[S.permissionButton, { borderColor: colors.borderStrong }]}
        >
          <Text style={[S.permissionButtonText, { color: colors.textPrimary }]}>
            Go back
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
              <Text style={S.scannerTitle}>Scan a device</Text>
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
                <Text style={S.hintText}>Place the code inside the frame</Text>
                <View
                  style={[
                    S.pairingBadge,
                    { backgroundColor: `${colors.accent}20` },
                  ]}
                >
                  <Zap size={14} color={colors.accent} strokeWidth={3} />
                  <Text style={[S.pairingText, { color: colors.accent }]}>
                    Early access
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
                <Text style={S.successLabel}>TV CONNECTED</Text>
              </View>
            )}
            {pairingError && !scanned && (
              <View style={S.scanError}>
                <Text style={S.scanErrorText}>{pairingError}</Text>
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
  tvScreen: { backgroundColor: "#080E12" },
  tvLayout: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 48,
    paddingVertical: 40,
  },
  tvContent: { alignItems: "center", gap: 12 },
  tvTitle: { fontSize: 34, fontWeight: "900", letterSpacing: 3 },
  tvSub: { fontSize: 18, lineHeight: 26, opacity: 0.8, textAlign: "center" },
  tvStatusRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontWeight: "800", letterSpacing: 2 },
  tvQrWrapper: {
    width: 560,
    height: 560,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#02070A",
    borderRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(57, 217, 238, 0.18)",
    shadowOpacity: 0.9,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  qrContainer: {
    padding: 14,
    borderRadius: 8,
    zIndex: 1,
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(112, 232, 244, 0.56)",
  },
  qrHalo: {
    position: "absolute",
    width: 488,
    height: 488,
    backgroundColor: "rgba(34, 211, 238, 0.07)",
    borderRadius: 244,
  } as any,
  qrGlow: {
    position: "absolute",
    width: 470,
    height: 470,
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.22)",
    borderRadius: 235,
  } as any,
  tvCornerFrame: {
    position: "absolute",
    width: 560,
    height: 560,
    zIndex: 2,
  },
  qrLogoBadge: {
    position: "absolute",
    width: 68,
    height: 68,
    alignSelf: "center",
    top: "50%",
    marginTop: -34,
    zIndex: 3,
  },
  tvFooter: {
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
  scanError: { position: "absolute", bottom: 72, left: 24, right: 24, alignItems: "center" },
  scanErrorText: { color: "#fff", textAlign: "center", fontSize: 13, fontWeight: "700" },
});
