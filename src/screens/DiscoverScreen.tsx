import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '@/components/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import { gradients, FONT_SIZE, RADIUS, SPACING } from '@/theme/colors';
import { Device } from '@/types/domain';

type Props = {
  devices: Device[];
  onRefresh: () => void;
  isRefreshing: boolean;
  statusMessage: string;
};

const platformLabel: Record<Device['platform'], string> = {
  android: 'Android Phone',
  ios: 'iPhone / iPad',
  'android-tv': 'Android TV',
};
const platformIcon: Record<Device['platform'], string> = {
  android: '📱',
  ios: '',
  'android-tv': '📺',
};

const PulseDot = ({ active }: { active: boolean }) => {
  const { colors } = useTheme();
  const s = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(s, { toValue: 1.8, duration: 750, useNativeDriver: true }),
        Animated.timing(s, { toValue: 1, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, s]);
  return (
    <View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
      {active && (
        <Animated.View style={{
          position: 'absolute', width: 14, height: 14, borderRadius: 7,
          backgroundColor: colors.success, opacity: s.interpolate({ inputRange: [1, 1.8], outputRange: [0.4, 0] }),
          transform: [{ scale: s }],
        }} />
      )}
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: active ? colors.success : colors.textMuted }} />
    </View>
  );
};

const RadarSweep = () => {
  const rotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: 2200, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [rotate]);
  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={S.radar}>
      {[60, 96, 132].map(r => (
        <View key={r} style={[S.radarRing, { width: r, height: r, borderRadius: r / 2 }]} />
      ))}
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', transform: [{ rotate: spin }] }]}>
        <LinearGradient colors={['rgba(99,102,241,0.7)', 'transparent']} style={{ width: 2, height: 66, borderRadius: 1 }} />
      </Animated.View>
      <View style={S.radarCore} />
    </View>
  );
};

const DeviceRow = ({ device, index }: { device: Device; index: number }) => {
  const { colors } = useTheme();
  const fade = useRef(new Animated.Value(0)).current;
  const tx = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 320, delay: index * 70, useNativeDriver: true }),
      Animated.spring(tx, { toValue: 0, tension: 90, friction: 12, delay: index * 70, useNativeDriver: true }),
    ]).start();
  }, [fade, tx, index]);

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateX: tx }] }}>
      <GlassCard padding={SPACING.md}>
        <View style={S.deviceRow}>
          <Text style={S.platformIcon}>{platformIcon[device.platform]}</Text>
          <View style={S.deviceInfo}>
            <Text style={[S.deviceName, { color: colors.textPrimary }]}>{device.name}</Text>
            <Text style={[S.deviceMeta, { color: colors.textSecondary }]}>
              {platformLabel[device.platform]} · {device.connection.toUpperCase()}
            </Text>
          </View>
          <PulseDot active />
          {device.isTrusted && (
            <View style={[S.trusted, { backgroundColor: colors.accentHighlight }]}>
              <Text style={[S.trustedText, { color: colors.accentLight }]}>Trusted</Text>
            </View>
          )}
        </View>
      </GlassCard>
    </Animated.View>
  );
};

export function DiscoverScreen({ devices, onRefresh, isRefreshing, statusMessage }: Props) {
  const { colors } = useTheme();

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>
      {/* Scan card */}
      <GlassCard animate style={S.scanCard}>
        <View style={S.scanBody}>
          <RadarSweep />
          <Text style={[S.scanTitle, { color: colors.textPrimary }]}>
            {isRefreshing ? 'Scanning…' : 'Device Radar'}
          </Text>
          <Text style={[S.scanSub, { color: colors.textSecondary }]}>{statusMessage}</Text>
          <Pressable onPress={onRefresh} accessibilityRole="button">
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.scanBtn}>
              <Text style={S.scanBtnText}>{isRefreshing ? 'Scanning…' : '  Refresh'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </GlassCard>

      {/* Device list */}
      {devices.length === 0 ? (
        <GlassCard>
          <View style={S.empty}>
            <Text style={S.emptyIcon}>📡</Text>
            <Text style={[S.emptyTitle, { color: colors.textPrimary }]}>No Devices Found</Text>
            <Text style={[S.emptySub, { color: colors.textSecondary }]}>
              Make sure both devices share the same Wi-Fi, or have Bluetooth enabled.
            </Text>
          </View>
        </GlassCard>
      ) : (
        <View style={S.list}>
          <Text style={[S.listHeader, { color: colors.textMuted }]}>
            {devices.length} DEVICE{devices.length !== 1 ? 'S' : ''} FOUND
          </Text>
          {devices.map((d, i) => <DeviceRow key={d.id} device={d} index={i} />)}
        </View>
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  scroll: { gap: SPACING.md, paddingBottom: SPACING.md },
  scanCard: {},
  scanBody: { alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },
  scanTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', letterSpacing: -0.4 },
  scanSub: { fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20, maxWidth: 260 },
  scanBtn: { borderRadius: RADIUS.full, paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md, marginTop: SPACING.xs },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.base },

  radar: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
  radarRing: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)' },
  radarCore: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6366f1', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8 },

  list: { gap: SPACING.sm },
  listHeader: { fontSize: FONT_SIZE.xs, fontWeight: '700', letterSpacing: 1.2, marginBottom: SPACING.xs },

  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  platformIcon: { fontSize: 26 },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: FONT_SIZE.base, fontWeight: '700' },
  deviceMeta: { fontSize: FONT_SIZE.sm, marginTop: 2 },
  trusted: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  trustedText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },

  empty: { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.md },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  emptySub: { fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20, maxWidth: 260 },
});
