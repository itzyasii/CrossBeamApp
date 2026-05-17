import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Radio, Zap, Rocket, ShieldCheck } from 'lucide-react-native';
import { GlassCard } from '@/components/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import { FONT_SIZE, RADIUS, SPACING } from '@/theme/colors';
import { haptics } from '@/services/haptics';

type Props = {
  deviceCount: number;
  transferCount: number;
  discoveryStatus: string;
  onStartDiscovery?: () => void;
};

const OrbCore = () => {
  const scale = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.08, duration: 2500, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 2500, useNativeDriver: true }),
        ]),
        Animated.timing(spin, { toValue: 1, duration: 20000, useNativeDriver: true }),
      ])
    ).start();
  }, [scale, spin]);

  return (
    <View style={S.orbContainer}>
      <Animated.View style={[S.orbGlow, { transform: [{ scale }] }]} />
      <Animated.Image 
        source={require('../../assets/icon.png')} 
        style={[S.orbInner, { 
          transform: [
            { scale },
            { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }
          ] 
        }]} 
      />
    </View>
  );
};

const BentoCard = ({ 
  title, 
  value, 
  label, 
  icon: Icon, 
  color, 
  flex = 1, 
  delay = 0 
}: { 
  title: string; 
  value: string; 
  label: string; 
  icon: any; 
  color: string; 
  flex?: number; 
  delay?: number 
}) => {
  const { colors } = useTheme();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, delay, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, tension: 40, friction: 8, delay, useNativeDriver: true }),
    ]).start();
  }, [fade, slide, delay]);

  return (
    <Animated.View style={{ flex, opacity: fade, transform: [{ translateY: slide }] }}>
      <GlassCard padding={SPACING.lg} style={S.bentoCard}>
        <View style={S.bentoHeader}>
          <View style={[S.bentoIconWrap, { backgroundColor: `${color}15` }]}>
            <Icon size={18} color={color} strokeWidth={2.5} />
          </View>
          <Text style={[S.bentoTitle, { color: colors.textMuted }]}>{title}</Text>
        </View>
        <View>
          <Text style={[S.bentoValue, { color: colors.textPrimary }]}>{value}</Text>
          <Text style={[S.bentoLabel, { color: colors.textSecondary }]}>{label}</Text>
        </View>
      </GlassCard>
    </Animated.View>
  );
};

export function HomeScreen({ deviceCount, transferCount, discoveryStatus, onStartDiscovery }: Props) {
  const { colors, isDark } = useTheme();

  const handleStartDiscovery = () => {
    void haptics.medium();
    onStartDiscovery?.();
  };

  return (
    <View style={S.container}>
      {/* ── Header Area ── */}
      <View style={S.welcomeArea}>
        <View>
          <Text style={[S.welcomeTitle, { color: colors.textPrimary }]}>Local Mesh</Text>
          <Text style={[S.welcomeSub, { color: colors.textSecondary }]}>Secure P2P Network</Text>
        </View>
        <View style={[S.statusBadge, { backgroundColor: colors.accentHighlight }]}>
          <View style={[S.statusDot, { backgroundColor: deviceCount > 0 ? colors.success : colors.warning }]} />
          <Text style={[S.statusText, { color: colors.accent }]}>{deviceCount > 0 ? 'ACTIVE' : 'IDLE'}</Text>
        </View>
      </View>

      {/* ── Hero Section ── */}
      <GlassCard animate accentBorder style={S.heroMesh} elevation={2}>
        <LinearGradient
          colors={isDark ? ['rgba(99, 102, 241, 0.12)', 'transparent'] : ['rgba(99, 102, 241, 0.05)', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={S.heroContent}>
          <OrbCore />
          <View style={S.heroText}>
            <View style={S.heroTitleRow}>
              <Text style={[S.heroHeadline, { color: colors.textPrimary }]}>Local Node</Text>
              <ShieldCheck size={16} color={colors.success} strokeWidth={2.5} />
            </View>
            <Text style={[S.heroSubline, { color: colors.textSecondary }]}>
              {discoveryStatus || 'Ready to discover nearby peers securely.'}
            </Text>
          </View>
        </View>
      </GlassCard>

      {/* ── Bento Grid ── */}
      <View style={S.grid}>
        <View style={S.row}>
          <BentoCard 
            title="PEERS" 
            value={String(deviceCount)} 
            label="Nearby Devices" 
            icon={Radio} 
            color={colors.accent}
            delay={100}
          />
          <BentoCard 
            title="JOBS" 
            value={String(transferCount)} 
            label="Active Transfers"
            icon={Zap} 
            color={colors.success}
            delay={200}
          />
        </View>

        <View style={S.row}>
          <Pressable onPress={handleStartDiscovery} style={{ flex: 1 }} accessibilityRole="button">
            {({ pressed }) => (
              <GlassCard padding={0} style={[S.wideAction, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]} elevation={2}>
                <LinearGradient
                  colors={['#6366F1', '#4F46E5']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
                <View style={S.actionInner}>
                  <View>
                    <Text style={S.actionTitle}>Start Discovery</Text>
                    <Text style={S.actionSub}>Broadcast presence to mesh</Text>
                  </View>
                  <View style={S.actionIconCircle}>
                    <Rocket size={22} color="#6366F1" strokeWidth={2.5} />
                  </View>
                </View>
              </GlassCard>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  container: { gap: SPACING.lg },

  welcomeArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  welcomeTitle: { fontSize: FONT_SIZE.xl, fontWeight: '900', letterSpacing: -1 },
  welcomeSub: { fontSize: FONT_SIZE.xs, fontWeight: '700', marginTop: -2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  heroMesh: { height: 160, justifyContent: 'center' },
  heroContent: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, paddingHorizontal: SPACING.lg },
  heroText: { flex: 1, gap: 2 },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroHeadline: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  heroSubline: { fontSize: FONT_SIZE.sm, lineHeight: 18, fontWeight: '500' },

  orbContainer: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  orbInner: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden' },
  orbGlow: { position: 'absolute', width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(99, 102, 241, 0.2)', ...Platform.select({ ios: { shadowColor: '#6366F1', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 15 }, android: { elevation: 0 } }) } as any,

  grid: { gap: SPACING.md },
  row: { flexDirection: 'row', gap: SPACING.md },
  
  bentoCard: { minHeight: 130, justifyContent: 'space-between' },
  bentoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bentoIconWrap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm },
  bentoTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  bentoValue: { fontSize: 32, fontWeight: '900', letterSpacing: -1.5 },
  bentoLabel: { fontSize: 11, fontWeight: '700', marginTop: -2 },

  wideAction: { height: 84, justifyContent: 'center', overflow: 'hidden' },
  actionInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.xl },
  actionTitle: { color: '#fff', fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  actionSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  actionIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
