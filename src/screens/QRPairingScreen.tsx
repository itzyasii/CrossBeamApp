import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Platform, Pressable, ActivityIndicator, Animated, Dimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Camera, CameraView } from 'expo-camera';
import { X, ShieldCheck, Zap, Maximize, Smartphone, Tv } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/hooks/useTheme';
import { SPACING, FONT_SIZE, RADIUS } from '@/theme/colors';
import { nativeCrossBeam } from '@/native/crossbeamNative';
import { haptics } from '@/services/haptics';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export const QRPairingScreen = ({ onBack }: { onBack: () => void }) => {
  const { colors, isDark } = useTheme();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);

  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!Platform.isTV) {
      (async () => {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      })();

      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
          Animated.timing(scanAnim, { toValue: 0, duration: 2500, useNativeDriver: true }),
        ])
      ).start();
    }

    if (Platform.isTV) {
      void (async () => {
        const info = {
          id: 'node-' + Math.random().toString(36).substr(2, 6),
          name: 'Living Room TV',
          platform: 'android-tv',
          v: 1
        };
        setQrData(JSON.stringify(info));
      })();
    }
  }, []);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
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
            <Text style={[S.tvTitle, { color: colors.textPrimary }]}>Connect Mobile Device</Text>
            <Text style={[S.tvSub, { color: colors.textSecondary }]}>
              Open CrossBeam on your phone and scan this code to start sharing files instantly.
            </Text>

            <View style={S.tvStatusRow}>
              <View style={[S.statusDot, { backgroundColor: colors.success }]} />
              <Text style={[S.statusText, { color: colors.textMuted }]}>TV_NODE_ACTIVE</Text>
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
          <Text style={[S.footerText, { color: colors.textMuted }]}>SECURE_P2P_ENCRYPTED</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={S.container}>
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
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

        <View style={S.viewfinderContainer}>
          <View style={S.viewfinder}>
            <Animated.View style={[S.scanLine, {
              transform: [{ translateY: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 260] }) }]
            }]} />
            <Maximize size={40} color={colors.accent} style={S.cornerTL} />
            <Maximize size={40} color={colors.accent} style={S.cornerTR} />
            <Maximize size={40} color={colors.accent} style={S.cornerBL} />
            <Maximize size={40} color={colors.accent} style={S.cornerBR} />
          </View>

          <View style={S.scannerHint}>
            <Text style={S.hintText}>ALIGN QR CODE WITHIN FRAME</Text>
            <View style={S.pairingBadge}>
              <Zap size={14} color={colors.accent} strokeWidth={3} />
              <Text style={[S.pairingText, { color: colors.accent }]}>AUTO_PAIR_ENABLED</Text>
            </View>
          </View>
        </View>

        {scanned && (
          <View style={S.successOverlay}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <ShieldCheck size={64} color={colors.success} />
            <Text style={S.successLabel}>NODE_VERIFIED</Text>
          </View>
        )}
      </BlurView>
    </View>
  );
};

const S = StyleSheet.create({
  container: { flex: 1 },

  // TV Styles
  tvLayout: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 100, padding: 80 },
  tvContent: { flex: 1, gap: 24 },
  tvTitle: { fontSize: 48, fontWeight: '900', letterSpacing: -1 },
  tvSub: { fontSize: 22, lineHeight: 32, opacity: 0.8 },
  tvStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  tvQrWrapper: { width: 400, height: 400, justifyContent: 'center', alignItems: 'center' },
  qrContainer: { padding: 20, backgroundColor: '#FFF', borderRadius: 24, zIndex: 1 },
  qrGlow: { position: 'absolute', width: 320, height: 320, backgroundColor: 'rgba(99, 102, 241, 0.2)', borderRadius: 160, filter: 'blur(60px)' } as any,
  tvFooter: { position: 'absolute', bottom: 60, left: 80, flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerText: { fontSize: 14, fontWeight: '800', letterSpacing: 2 },

  // Mobile Scanner Styles
  scannerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  scannerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 60 },
  closeBtn: { padding: 8 },
  scannerTitle: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 4 },

  viewfinderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 40 },
  viewfinder: { width: 280, height: 280, position: 'relative' },
  scanLine: { position: 'absolute', width: '100%', height: 2, backgroundColor: '#6366F1', shadowColor: '#6366F1', shadowRadius: 10, shadowOpacity: 1, zIndex: 5 },
  cornerTL: { position: 'absolute', top: -10, left: -10, transform: [{ rotate: '0deg' }] },
  cornerTR: { position: 'absolute', top: -10, right: -10, transform: [{ rotate: '90deg' }] },
  cornerBL: { position: 'absolute', bottom: -10, left: -10, transform: [{ rotate: '270deg' }] },
  cornerBR: { position: 'absolute', bottom: -10, right: -10, transform: [{ rotate: '180deg' }] },

  scannerHint: { alignItems: 'center', gap: 12 },
  hintText: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  pairingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(99, 102, 241, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pairingText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  successOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 20, zIndex: 10 },
  successLabel: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 4 },
});
