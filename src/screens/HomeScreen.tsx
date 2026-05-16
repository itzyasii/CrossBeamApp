import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Radio, Zap, Rocket } from 'lucide-react-native';
import { GlassCard } from '@/components/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import { gradients, FONT_SIZE, RADIUS, SPACING } from '@/theme/colors';

type Props = { deviceCount: number; transferCount: number; discoveryStatus: string };

const OrbCore = () => {
  const scale = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.12, duration: 2200, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 2200, useNativeDriver: true }),
        ]),
        Animated.timing(spin, { toValue: 1, duration: 15000, useNativeDriver: true }),
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
      Animated.timing(fade, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, tension: 50, friction: 8, delay, useNativeDriver: true }),
    ]).start();
  }, [fade, slide, delay]);

  return (
    <Animated.View style={{ flex, opacity: fade, transform: [{ translateY: slide }] }}>
      <GlassCard padding={SPACING.lg} style={S.bentoCard}>
        <View style={S.bentoHeader}>
          <View style={[S.bentoIconWrap, { backgroundColor: `${color}20` }]}>
            <Icon size={16} color={color} strokeWidth={2.5} />
          </View>
          <Text style={[S.bentoTitle, { color: colors.textMuted }]}>{title}</Text>
        </View>
        <Text style={[S.bentoValue, { color: colors.textPrimary }]}>{value}</Text>
        <Text style={[S.bentoLabel, { color: colors.textSecondary }]}>{label}</Text>
      </GlassCard>
    </Animated.View>
  );
};

export function HomeScreen({ deviceCount, transferCount, discoveryStatus }: Props) {
  const { colors } = useTheme();

  return (
    <View style={S.container}>
      {/* ── Header Area ── */}
      <View style={S.welcomeArea}>
        <Text style={[S.welcomeTitle, { color: colors.textPrimary }]}>Local Network</Text>
        <View style={[S.statusBadge, { backgroundColor: colors.accentHighlight }]}>
          <View style={[S.statusDot, { backgroundColor: deviceCount > 0 ? colors.success : colors.warning }]} />
          <Text style={[S.statusText, { color: colors.textSecondary }]}>{discoveryStatus}</Text>
        </View>
      </View>

      {/* ── Hero Mesh Section ── */}
      <GlassCard animate accentBorder style={S.heroMesh}>
        <LinearGradient
          colors={['rgba(99, 102, 241, 0.15)', 'transparent', 'rgba(34, 211, 165, 0.05)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={S.heroContent}>
          <OrbCore />
          <View style={S.heroText}>
            <Text style={[S.heroHeadline, { color: colors.textPrimary }]}>CrossBeam Node</Text>
            <Text style={[S.heroSubline, { color: colors.textSecondary }]}>
              Securely connected to your{'\n'}private local mesh.
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
            color="#6366F1" 
            delay={100}
          />
          <BentoCard 
            title="JOBS" 
            value={String(transferCount)} 
            label="Active Shifts" 
            icon={Zap} 
            color="#22D3A5" 
            delay={200}
          />
        </View>

        <View style={S.row}>
          <Pressable style={{ flex: 1 }}>
            <GlassCard padding={SPACING.lg} style={S.wideAction}>
              <LinearGradient
                colors={['#6366F1', '#4F46E5']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <View style={S.actionInner}>
                <View>
                  <Text style={S.actionTitle}>Start Discovery</Text>
                  <Text style={S.actionSub}>Broadcast your presence</Text>
                </View>
                <Rocket size={24} color="#fff" strokeWidth={2} />
              </View>
            </GlassCard>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  container: { gap: SPACING.lg },

  welcomeArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  welcomeTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', letterSpacing: -0.5 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  heroMesh: { height: 180, justifyContent: 'center' },
  heroContent: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xl, paddingHorizontal: SPACING.lg },
  heroText: { flex: 1, gap: 4 },
  heroHeadline: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  heroSubline: { fontSize: FONT_SIZE.sm, lineHeight: 18 },

  orbContainer: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  orbInner: { width: 56, height: 56, borderRadius: 14, overflow: 'hidden' },
  orbGlow: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(99, 102, 241, 0.25)', filter: 'blur(15px)' } as any,

  grid: { gap: SPACING.md },
  row: { flexDirection: 'row', gap: SPACING.md },
  
  bentoCard: { minHeight: 120, justifyContent: 'space-between' },
  bentoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bentoIconWrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8, overflow: 'hidden' },
  bentoTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  bentoValue: { fontSize: 32, fontWeight: '800', letterSpacing: -1, marginTop: SPACING.sm },
  bentoLabel: { fontSize: 11, fontWeight: '600' },

  wideAction: { height: 80, justifyContent: 'center', overflow: 'hidden' },
  actionInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionTitle: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  actionSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500' },
});
