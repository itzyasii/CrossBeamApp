import React, { useEffect, useRef, useState } from 'react';
import { Animated, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '@/components/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import { getAnalyticsData } from '@/store/database';
import { formatBytes } from '@/utils/helpers';
import { gradients, FONT_SIZE, RADIUS, SPACING } from '@/theme/colors';

const MetricCard = ({ label, value, icon, color, delay }: { label: string; value: string; icon: string; color: string; delay: number }) => {
  const { colors } = useTheme();
  const fade  = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 65, friction: 9, delay, useNativeDriver: true }),
    ]).start();
  }, [fade, scale, delay]);
  return (
    <Animated.View style={{ opacity: fade, transform: [{ scale }], flex: 1, minWidth: '45%' }}>
      <GlassCard>
        <View style={[S.iconWrap, { backgroundColor: `${color}1A` }]}>
          <Text style={{ fontSize: 18 }}>{icon}</Text>
        </View>
        <Text style={[S.metricVal, { color }]}>{value}</Text>
        <Text style={[S.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
      </GlassCard>
    </Animated.View>
  );
};

export function AnalyticsScreen() {
  const { colors } = useTheme();
  const [data, setData] = useState({ totalBytes: 0, totalFiles: 0, totalFailed: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try { setData(await getAnalyticsData()); } catch {} finally { setRefreshing(false); }
  };
  useEffect(() => { void load(); }, []);

  const rate = data.totalFiles + data.totalFailed > 0
    ? Math.round((data.totalFiles / (data.totalFiles + data.totalFailed)) * 100) : 100;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={S.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.accent} />}
    >
      <Text style={[S.pageTitle, { color: colors.textPrimary }]}>Analytics</Text>

      <View style={S.grid}>
        <MetricCard label="Data Moved"   value={formatBytes(data.totalBytes)} icon="💾" color="#6366F1" delay={0} />
        <MetricCard label="Files Shared" value={String(data.totalFiles)}      icon="📤" color="#22D3A5" delay={80} />
        <MetricCard label="Failed"       value={String(data.totalFailed)}     icon="⚠" color="#F87171" delay={160} />
        <MetricCard label="Success Rate" value={`${rate}%`}                   icon="✓" color="#A78BFA" delay={240} />
      </View>

      {/* Efficiency bar */}
      <GlassCard>
        <View style={S.efficiencyRow}>
          <View style={{ flex: 1 }}>
            <Text style={[S.efficiencyLabel, { color: colors.textSecondary }]}>Success Rate</Text>
            <View style={S.barTrack}>
              <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[S.barFill, { width: `${rate}%` }]} />
            </View>
          </View>
          <Text style={[S.efficiencyVal, { color: colors.accent }]}>{rate}%</Text>
        </View>

        <View style={[S.divider, { backgroundColor: colors.border }]} />

        <View style={S.summaryRow}>
          <View style={S.summaryItem}>
            <Text style={[S.summaryVal, { color: colors.textPrimary }]}>{data.totalFiles + data.totalFailed}</Text>
            <Text style={[S.summaryLabel, { color: colors.textSecondary }]}>Total Jobs</Text>
          </View>
          <View style={[S.vertDivider, { backgroundColor: colors.border }]} />
          <View style={S.summaryItem}>
            <Text style={[S.summaryVal, { color: colors.textPrimary }]}>{formatBytes(data.totalBytes)}</Text>
            <Text style={[S.summaryLabel, { color: colors.textSecondary }]}>Total Data</Text>
          </View>
          <View style={[S.vertDivider, { backgroundColor: colors.border }]} />
          <View style={S.summaryItem}>
            <Text style={[S.summaryVal, { color: colors.error }]}>{data.totalFailed}</Text>
            <Text style={[S.summaryLabel, { color: colors.textSecondary }]}>Failed</Text>
          </View>
        </View>
      </GlassCard>
    </ScrollView>
  );
}

const S = StyleSheet.create({
  scroll:   { gap: SPACING.md, paddingBottom: SPACING.md },
  pageTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '800', letterSpacing: -0.8 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  iconWrap:    { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  metricVal:   { fontSize: FONT_SIZE.xl, fontWeight: '800', letterSpacing: -0.5 },
  metricLabel: { fontSize: FONT_SIZE.sm, fontWeight: '500', marginTop: 3 },

  efficiencyRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, marginBottom: SPACING.lg },
  efficiencyLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', marginBottom: SPACING.sm },
  barTrack: { height: 8, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: RADIUS.full },
  efficiencyVal: { fontSize: FONT_SIZE.xl, fontWeight: '800', letterSpacing: -0.5 },

  divider: { height: StyleSheet.hairlineWidth, marginBottom: SPACING.lg },
  summaryRow:  { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 3 },
  summaryVal:  { fontSize: FONT_SIZE.md, fontWeight: '800' },
  summaryLabel: { fontSize: FONT_SIZE.xs, fontWeight: '600' },
  vertDivider: { width: StyleSheet.hairlineWidth, height: 36 },
});
