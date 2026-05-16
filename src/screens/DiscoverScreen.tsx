import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RefreshCcw, Send, ShieldCheck, Smartphone, Tablet, Tv, Wifi } from 'lucide-react-native';

import { GlassCard } from '@/components/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import { gradients, FONT_SIZE, RADIUS, SPACING } from '@/theme/colors';
import { Device } from '@/types/domain';

type Props = {
  devices: Device[];
  onRefresh: () => void;
  isRefreshing: boolean;
  statusMessage: string;
  onSelectDevice?: (deviceId: string) => void;
};

const platformLabel: Record<Device['platform'], string> = {
  android: 'Android Phone',
  ios: 'iPhone / iPad',
  'android-tv': 'Android TV',
};

const PlatformIcon = ({ platform, trusted }: { platform: Device['platform']; trusted?: boolean }) => {
  const { colors } = useTheme();
  const Icon = platform === 'android-tv' ? Tv : platform === 'ios' ? Tablet : Smartphone;
  return (
    <View
      style={[
        S.deviceIconBox,
        {
          backgroundColor: trusted ? colors.accentHighlight : colors.surfaceHover,
          borderColor: trusted ? colors.borderAccent : colors.border,
        },
      ]}
    >
      <Icon size={26} color={trusted ? colors.accentLight : colors.textSecondary} strokeWidth={2.2} />
    </View>
  );
};

const PulseDot = ({ active }: { active: boolean }) => {
  const { colors } = useTheme();
  const s = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(s, { toValue: 1.8, duration: 750, useNativeDriver: true }),
        Animated.timing(s, { toValue: 1, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, s]);

  return (
    <View style={S.pulseWrap}>
      {active && (
        <Animated.View
          style={[
            S.pulseHalo,
            {
              backgroundColor: colors.success,
              opacity: s.interpolate({ inputRange: [1, 1.8], outputRange: [0.4, 0] }),
              transform: [{ scale: s }],
            },
          ]}
        />
      )}
      <View style={[S.pulseCore, { backgroundColor: active ? colors.success : colors.textMuted }]} />
    </View>
  );
};

const RadarSweep = () => {
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(rotate, { toValue: 1, duration: 2200, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [rotate]);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={S.radar}>
      {[76, 126, 176, 226].map((r) => (
        <View key={r} style={[S.radarRing, { width: r, height: r, borderRadius: r / 2 }]} />
      ))}
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', transform: [{ rotate: spin }] }]}>
        <LinearGradient colors={['rgba(192,193,255,0.45)', 'transparent']} style={S.radarBeam} />
      </Animated.View>
      <View style={S.radarCore} />
    </View>
  );
};

const DeviceRow = ({
  device,
  index,
  onSelectDevice,
}: {
  device: Device;
  index: number;
  onSelectDevice?: (id: string) => void;
}) => {
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
          <PlatformIcon platform={device.platform} trusted={device.isTrusted} />
          <View style={S.deviceInfo}>
            <View style={S.nameLine}>
              <Text style={[S.deviceName, { color: colors.textPrimary }]} numberOfLines={1}>
                {device.name}
              </Text>
              {device.isTrusted && (
                <View style={[S.trusted, { backgroundColor: colors.successMuted, borderColor: `${colors.success}55` }]}>
                  <ShieldCheck size={12} color={colors.success} strokeWidth={2.5} />
                  <Text style={[S.trustedText, { color: colors.success }]}>TRUSTED</Text>
                </View>
              )}
            </View>
            <Text style={[S.deviceMeta, { color: colors.textSecondary }]} numberOfLines={1}>
              {platformLabel[device.platform]} - {device.connection.toUpperCase()}
            </Text>
          </View>
          <PulseDot active />
          <Pressable
            onPress={() => onSelectDevice?.(device.id)}
            style={[
              S.sendButton,
              {
                backgroundColor: device.isTrusted ? colors.accent : colors.surfaceHover,
                borderColor: colors.border,
              },
            ]}
            accessibilityRole="button"
          >
            <Send size={14} color={device.isTrusted ? '#FFFFFF' : colors.textPrimary} strokeWidth={2.5} />
            <Text style={[S.sendText, { color: device.isTrusted ? '#FFFFFF' : colors.textPrimary }]}>
              {device.isTrusted ? 'Send' : 'Connect'}
            </Text>
          </Pressable>
        </View>
      </GlassCard>
    </Animated.View>
  );
};

export function DiscoverScreen({ devices, onRefresh, isRefreshing, statusMessage, onSelectDevice }: Props) {
  const { colors } = useTheme();
  const connections = Array.from(new Set(devices.map((device) => device.connection.toUpperCase())));
  const trustedCount = devices.filter((device) => device.isTrusted).length;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>
      <GlassCard animate style={S.scanCard}>
        <View style={S.scanBody}>
          <RadarSweep />
          <Text style={[S.scanTitle, { color: colors.textPrimary }]}>
            {isRefreshing ? 'Scanning for nearby devices...' : 'Device Radar'}
          </Text>
          <Text style={[S.scanProtocol, { color: colors.textMuted }]}>WIFI-DIRECT - LAN - BLUETOOTH</Text>
          <Text style={[S.scanSub, { color: colors.textSecondary }]}>{statusMessage}</Text>
          <Pressable onPress={onRefresh} accessibilityRole="button">
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.scanBtn}>
              <RefreshCcw size={16} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={S.scanBtnText}>{isRefreshing ? 'Scanning...' : 'Refresh'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </GlassCard>

      {devices.length === 0 ? (
        <GlassCard>
          <View style={S.empty}>
            <Wifi size={42} color={colors.accentLight} strokeWidth={2.1} />
            <Text style={[S.emptyTitle, { color: colors.textPrimary }]}>No Devices Found</Text>
            <Text style={[S.emptySub, { color: colors.textSecondary }]}>
              Make sure both devices share the same Wi-Fi, or have Bluetooth enabled.
            </Text>
          </View>
        </GlassCard>
      ) : (
        <View style={S.list}>
          <Text style={[S.listHeader, { color: colors.textMuted }]}>
            AVAILABLE TARGETS - {devices.length} DEVICE{devices.length !== 1 ? 'S' : ''}
          </Text>
          {devices.map((device, index) => (
            <DeviceRow key={device.id} device={device} index={index} onSelectDevice={onSelectDevice} />
          ))}
        </View>
      )}

      <View style={S.statsGrid}>
        <GlassCard padding={SPACING.md} style={S.statCard}>
          <Text style={[S.statLabel, { color: colors.textMuted }]}>ACTIVE LINKS</Text>
          <Text style={[S.statValue, { color: colors.accentLight }]}>{connections.length || 0}</Text>
          <Text style={[S.statSub, { color: colors.textMuted }]} numberOfLines={1}>
            {connections.length > 0 ? connections.join(', ') : 'No peers visible'}
          </Text>
        </GlassCard>
        <GlassCard padding={SPACING.md} style={S.statCard}>
          <Text style={[S.statLabel, { color: colors.textMuted }]}>TRUSTED</Text>
          <Text style={[S.statValue, { color: colors.success }]}>{trustedCount}</Text>
          <Text style={[S.statSub, { color: colors.textMuted }]}>{devices.length} discovered</Text>
        </GlassCard>
      </View>
    </ScrollView>
  );
}

const S = StyleSheet.create({
  scroll: { gap: SPACING.md, paddingBottom: SPACING.md },
  scanCard: {},
  scanBody: { alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },
  scanTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', textAlign: 'center' },
  scanProtocol: { fontSize: FONT_SIZE.xs, fontWeight: '800', letterSpacing: 1.1 },
  scanSub: { fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  scanBtn: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    marginTop: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  scanBtnText: { color: '#fff', fontWeight: '800', fontSize: FONT_SIZE.base },
  radar: { width: 226, height: 226, alignItems: 'center', justifyContent: 'center' },
  radarRing: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(192,193,255,0.16)' },
  radarBeam: { width: 3, height: 112, borderRadius: 2 },
  radarCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#C0C1FF',
    shadowColor: '#C0C1FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
  },
  pulseWrap: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  pulseHalo: { position: 'absolute', width: 14, height: 14, borderRadius: 7 },
  pulseCore: { width: 8, height: 8, borderRadius: 4 },
  list: { gap: SPACING.sm },
  listHeader: { fontSize: FONT_SIZE.xs, fontWeight: '800', letterSpacing: 1.2, marginBottom: SPACING.xs },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  deviceIconBox: { width: 48, height: 48, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  deviceInfo: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  deviceName: { fontSize: FONT_SIZE.base, fontWeight: '800', flexShrink: 1 },
  deviceMeta: { fontSize: FONT_SIZE.xs, marginTop: 3, fontWeight: '700' },
  trusted: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: RADIUS.full, borderWidth: 1 },
  trustedText: { fontSize: 9, fontWeight: '900' },
  sendButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: RADIUS.sm, borderWidth: 1, paddingHorizontal: SPACING.sm },
  sendText: { fontSize: FONT_SIZE.xs, fontWeight: '900' },
  empty: { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.md, fontWeight: '800' },
  emptySub: { fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20, maxWidth: 260 },
  statsGrid: { flexDirection: 'row', gap: SPACING.md },
  statCard: { flex: 1 },
  statLabel: { fontSize: FONT_SIZE.xs, fontWeight: '900', letterSpacing: 1 },
  statValue: { fontSize: FONT_SIZE.lg, fontWeight: '900', marginTop: SPACING.sm },
  statSub: { fontSize: FONT_SIZE.xs, fontWeight: '700', marginTop: 2 },
});
