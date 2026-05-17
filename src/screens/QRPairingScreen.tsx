import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Platform, Pressable, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Camera, X, RefreshCcw, ShieldCheck } from 'lucide-react-native';
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
        const { status } = await BarCodeScanner.requestPermissionsAsync();
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
          <Text style={{ color: colors.error }}>No camera permission</Text>
        ) : (
          <BarCodeScanner
            onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
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
          <Pressable style={[S.retryBtn, { backgroundColor: colors.accent }]} onPress={() => setScanned(false)}>
            <RefreshCcw size={18} color="#FFF" />
            <Text style={S.retryText}>Rescan</Text>
          </Pressable>
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

  header: { padding: SPACING.lg, paddingTop: 50, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800' },
  scannerContainer: { flex: 1, overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFillObject },
  unfocusedContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  focusedRow: { flexDirection: 'row', height: 260 },
  focusedContainer: { flex: 1, borderWidth: 2, borderRadius: 20 },
  footer: { padding: SPACING.xl, alignItems: 'center', gap: SPACING.md },
  footerHint: { fontSize: FONT_SIZE.sm, textAlign: 'center' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: RADIUS.full },
  retryText: { color: '#FFF', fontWeight: '800' },
});
