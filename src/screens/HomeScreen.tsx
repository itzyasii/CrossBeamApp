import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '@/components/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import { gradients, FONT_SIZE, RADIUS, SPACING } from '@/theme/colors';

type Props = { deviceCount: number; transferCount: number; discoveryStatus: string };

const PulseRing = ({ size, delay }: { size: number; delay: number }) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(a, { toValue: 1, duration: 2800, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 0,    useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a, delay]);
  return (
    <Animated.View style={{
      position: 'absolute', width: size, height: size, borderRadius: size / 2,
      borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)',
      opacity: a.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.9, 0.25, 0] }),
      transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.6] }) }],
    }} />
  );
};

const Stat = ({ value, label, color, delay }: { value: string; label: string; color: string; delay: number }) => {
  const { colors } = useTheme();
  const fade = useRef(new Animated.Value(0)).current;
  const y    = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 380, delay, useNativeDriver: true }),
      Animated.spring(y,    { toValue: 0, tension: 70, friction: 10, delay, useNativeDriver: true }),
    ]).start();
  }, [fade, y, delay]);
  return (
    <Animated.View style={[S.statWrap, { opacity: fade, transform: [{ translateY: y }] }]}>
      <GlassCard padding={SPACING.lg}>
        <View style={[S.statDot, { backgroundColor: color }]} />
        <Text style={[S.statValue, { color: colors.textPrimary }]}>{value}</Text>
        <Text style={[S.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      </GlassCard>
    </Animated.View>
  );
};

export function HomeScreen({ deviceCount, transferCount, discoveryStatus }: Props) {
  const { colors } = useTheme();

  return (
    <View style={S.container}>
      {/* Hero card */}
      <GlassCard animate accentBorder>
        <View style={S.heroInner}>
          <View style={S.orbArea}>
            <PulseRing size={150} delay={0} />
            <PulseRing size={210} delay={900} />
            <PulseRing size={270} delay={1800} />
            <LinearGradient colors={gradients.primary} style={S.orb} />
          </View>
          <Text style={[S.heroTitle, { color: colors.textPrimary }]}>CrossBeam</Text>
          <Text style={[S.heroSub, { color: colors.textSecondary }]}>
            Instant peer-to-peer file sharing.{'\n'}No cloud. No limits. No ads.
          </Text>
          <View style={[S.badge, { backgroundColor: colors.accentHighlight, borderColor: colors.borderAccent }]}>
            <View style={[S.badgeDot, { backgroundColor: deviceCount > 0 ? colors.success : colors.warning }]} />
            <Text style={[S.badgeText, { color: colors.textSecondary }]}>{discoveryStatus}</Text>
          </View>
        </View>
      </GlassCard>

      {/* Stats */}
      <View style={S.statsRow}>
        <Stat value={String(deviceCount)} label="Nearby"    color={colors.accent}  delay={80}  />
        <Stat value={String(transferCount)} label="Transfers" color={colors.success} delay={160} />
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  container: { gap: SPACING.md },

  heroInner: { alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.xs },
  orbArea:   { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  orb:       { width: 52, height: 52, borderRadius: 26, shadowColor: '#6366f1', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 18, elevation: 10 },
  heroTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '800', letterSpacing: -1 },
  heroSub:   { fontSize: FONT_SIZE.base, textAlign: 'center', lineHeight: 23, maxWidth: 260 },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1 },
  badgeDot:  { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: FONT_SIZE.xs, fontWeight: '600' },

  statsRow:   { flexDirection: 'row', gap: SPACING.md },
  statWrap:   { flex: 1 },
  statDot:    { width: 8, height: 8, borderRadius: 4, marginBottom: SPACING.sm },
  statValue:  { fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  statLabel:  { fontSize: FONT_SIZE.xs, fontWeight: '600', marginTop: 3 },
});
