import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Platform, Pressable, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Camera, CameraView } from 'expo-camera';
import { X, RefreshCcw, ShieldCheck } from 'lucide-react-native';
import { GlassCard } from '@/components/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import { SPACING, FONT_SIZE, RADIUS } from '@/theme/colors';
import { nativeCrossBeam } from '@/native/crossbeamNative';
import { haptics } from '@/services/haptics';

export const QRPairingScreen = ({ onBack }: { onBack: () => void }) => {
  const { colors, isDark } = useTheme();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' && !Platform.isTV) {
      (async () => {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      })();
    }

    if (Platform.isTV) {
      // Generate Pairing Data for TV
      void (async () => {
        const caps = await nativeCrossBeam.getCapabilities();
        const info = {
          id: 'tv-' + Math.random().toString(36).substr(2, 9),
          name: 'Android TV Node',
          platform: 'android-tv',
          timestamp: Date.now(),
        };
        setQrData(JSON.stringify(info));
      })();
    }
  }, []);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    void haptics.success();
    console.log('[QR] Scanned data:', data);
    // Logic to initiate pairing with the scanned data
    setTimeout(() => onBack(), 1500);
  };

  if (Platform.isTV) {
    return (
      <View style={S.container}>
        <GlassCard animate style={S.tvCard}>
          <Text style={[S.title, { color: colors.textPrimary }]}>Pair with Mobile</Text>
          <Text style={[S.subtitle, { color: colors.textSecondary }]}>
            Scan this code with the CrossBeam app on your phone to instantly pair.
          </Text>
          <View style={S.qrContainer}>
            {qrData ? (
              <View style={S.qrBorder}>
                <QRCode
                  value={qrData}
                  size={240}
                  color={isDark ? '#FFF' : '#000'}
                  backgroundColor="transparent"
                />
              </View>
            ) : (
              <ActivityIndicator size="large" color={colors.accent} />
            )}
          </View>
          <View style={S.tvFooter}>
            <ShieldCheck size={20} color={colors.success} />
            <Text style={[S.footerText, { color: colors.textMuted }]}>
              Secure Peer-to-Peer Encrypted Pairing
            </Text>
          </View>
        </GlassCard>
      </View>
    );
  }

  return (
    <View style={S.container}>
      <View style={S.header}>
        <Pressable onPress={onBack} style={S.backBtn}>
          <X color={colors.textPrimary} size={28} />
        </Pressable>
        <Text style={[S.headerTitle, { color: colors.textPrimary }]}>Scan QR Code</Text>
      </View>

      <View style={S.scannerContainer}>
        {hasPermission === null ? (
          <ActivityIndicator size="large" color={colors.accent} />
        ) : hasPermission === false ? (
          <View style={S.errorContainer}>
            <Text style={[S.errorText, { color: colors.error }]}>No camera permission</Text>
            <Pressable style={[S.retryBtn, { backgroundColor: colors.accent, marginTop: 20 }]} onPress={async () => {
              const { status } = await Camera.requestCameraPermissionsAsync();
              setHasPermission(status === 'granted');
            }}>
              <Text style={S.retryText}>Grant Permission</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            style={StyleSheet.absoluteFillObject}
          />
        )}
        <View style={S.overlay}>
          <View style={S.unfocusedContainer}></View>
          <View style={S.focusedRow}>
            <View style={S.unfocusedContainer}></View>
            <View style={[S.focusedContainer, { borderColor: colors.accent }]}></View>
            <View style={S.unfocusedContainer}></View>
          </View>
          <View style={S.unfocusedContainer}></View>
        </View>
      </View>

      <View style={S.footer}>
        <Text style={[S.footerHint, { color: colors.textSecondary }]}>
          Align the QR code on the TV screen within the frame to pair.
        </Text>
        {scanned && (
          <View style={[S.successBadge, { backgroundColor: colors.successMuted }]}>
            <ShieldCheck size={18} color={colors.success} />
            <Text style={[S.successText, { color: colors.success }]}>Paired Successfully</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  tvCard: { alignItems: 'center', padding: SPACING.xxl, gap: SPACING.lg },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: '900' },
  subtitle: { fontSize: FONT_SIZE.base, textAlign: 'center', maxWidth: 400 },
  qrContainer: { padding: SPACING.xl, backgroundColor: '#FFF', borderRadius: RADIUS.lg },
  qrBorder: { padding: 10 },
  tvFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },

  header: { padding: SPACING.lg, paddingTop: 50, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, zIndex: 10 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800' },
  scannerContainer: { flex: 1, overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFillObject },
  unfocusedContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  focusedRow: { flexDirection: 'row', height: 260 },
  focusedContainer: { flex: 1, borderWidth: 2, borderRadius: 20 },
  footer: { padding: SPACING.xl, alignItems: 'center', gap: SPACING.md, backgroundColor: '#000' },
  footerHint: { fontSize: FONT_SIZE.sm, textAlign: 'center' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: RADIUS.full },
  retryText: { color: '#FFF', fontWeight: '800' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorText: { textAlign: 'center', fontSize: FONT_SIZE.base, fontWeight: '600' },
  successBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full },
  successText: { fontWeight: '800', fontSize: FONT_SIZE.sm },
});
