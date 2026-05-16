import React, { useEffect, useRef, useState } from 'react';
import { Animated, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HardDrive, Share2, AlertTriangle, CheckCircle2, Smartphone, FileText } from 'lucide-react-native';
import { GlassCard } from '@/components/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import { getAnalyticsData } from '@/store/database';
import { formatBytes, formatDate } from '@/utils/helpers';
import { gradients, FONT_SIZE, RADIUS, SPACING } from '@/theme/colors';
import { TransferJob } from '@/types/domain';

const MetricCard = ({ label, value, icon: Icon, color, delay }: { label: string; value: string; icon: any; color: string; delay: number }) => {
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
          <Icon size={18} color={color} strokeWidth={2.5} />
        </View>
        <Text style={[S.metricVal, { color }]}>{value}</Text>
        <Text style={[S.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
      </GlassCard>
    </Animated.View>
  );
};

export function AnalyticsScreen() {
  const { colors } = useTheme();
  const [data, setData] = useState<{
    totalBytes: number;
    totalFiles: number;
    totalFailed: number;
    totalJobs: number;
    dailyBytes: number[];
    topDevices: Array<{ name: string; bytes: number }>;
    recentTransfers: TransferJob[];
  }>({
    totalBytes: 0,
    totalFiles: 0,
    totalFailed: 0,
    totalJobs: 0,
    dailyBytes: [0, 0, 0, 0, 0, 0, 0],
    topDevices: [],
    recentTransfers: [],
  });
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      setData(await getAnalyticsData());
    } catch (error) {
      console.error('Failed to load analytics', error);
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const rate = data.totalFiles + data.totalFailed > 0
    ? Math.round((data.totalFiles / (data.totalFiles + data.totalFailed)) * 100) : 100;
  const maxDailyBytes = Math.max(...data.dailyBytes, 1);
  const heroParts = formatBytes(data.totalBytes).split(' ');
  const peakDayBytes = Math.max(...data.dailyBytes, 0);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={S.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.accent} />}
    >
      <Text style={[S.pageTitle, { color: colors.textPrimary }]}>Analytics</Text>

      <GlassCard animate accentBorder>
        <View style={S.heroMetric}>
          <View>
            <Text style={[S.heroLabel, { color: colors.accentLight }]}>NETWORK THROUGHPUT</Text>
            <View style={S.heroValueRow}>
              <Text style={[S.heroValue, { color: colors.accentLight }]}>{heroParts[0]}</Text>
              <Text style={[S.heroUnit, { color: colors.textSecondary }]}>{heroParts[1] ?? 'B'}</Text>
            </View>
          </View>
          <HardDrive size={28} color={colors.accentLight} strokeWidth={2.2} />
        </View>
        <Text style={[S.trendText, { color: peakDayBytes > 0 ? colors.success : colors.textMuted }]}>
          {peakDayBytes > 0 ? `${formatBytes(peakDayBytes)} moved on the busiest day this week` : 'No completed transfer data yet'}
        </Text>
      </GlassCard>

      <View style={S.grid}>
        <MetricCard label="Data Moved"   value={formatBytes(data.totalBytes)} icon={HardDrive}    color="#6366F1" delay={0} />
        <MetricCard label="Files Shared" value={String(data.totalFiles)}      icon={Share2}       color="#22D3A5" delay={80} />
        <MetricCard label="Failed"       value={String(data.totalFailed)}     icon={AlertTriangle} color="#F87171" delay={160} />
        <MetricCard label="Success Rate" value={`${rate}%`}                   icon={CheckCircle2}  color="#A78BFA" delay={240} />
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
            <Text style={[S.summaryVal, { color: colors.textPrimary }]}>{data.totalJobs}</Text>
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

      <GlassCard>
        <View style={S.chartHeader}>
          <View>
            <Text style={[S.chartTitle, { color: colors.textPrimary }]}>Weekly Activity</Text>
            <Text style={[S.chartSub, { color: colors.textMuted }]}>7-DAY LOCAL TRANSMISSION</Text>
          </View>
          <Text style={[S.chartLegend, { color: colors.textSecondary }]}>GB/Day</Text>
        </View>
        <View style={S.chart}>
          {data.dailyBytes.map((bytes, index) => {
            const active = bytes > 0 && bytes === peakDayBytes;
            const height = Math.max(4, Math.round((bytes / maxDailyBytes) * 100));
            return (
              <View key={`${bytes}-${index}`} style={S.barSlot}>
                <View style={[S.barTrackTall, { backgroundColor: colors.surfaceHover }]}>
                  <View
                    style={[
                      S.barColumn,
                      {
                        height: `${height}%`,
                        backgroundColor: active ? colors.accentLight : `${colors.accent}88`,
                      },
                    ]}
                  />
                </View>
                <Text style={[S.dayLabel, { color: active ? colors.accentLight : colors.textMuted }]}>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}
                </Text>
              </View>
            );
          })}
        </View>
      </GlassCard>

      <View style={S.logSection}>
        <Text style={[S.logHeader, { color: colors.textMuted }]}>ACTIVITY PULSE</Text>
        <GlassCard padding={0}>
          {data.recentTransfers.length === 0 ? (
            <View style={S.emptyLog}>
              <Text style={[S.logRoute, { color: colors.textMuted }]}>No transfer activity recorded yet.</Text>
            </View>
          ) : null}
          {data.recentTransfers.map((transfer, index) => (
            <View key={transfer.id} style={[S.logRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={[S.logIcon, { backgroundColor: colors.surfaceHover }]}>
                <FileText size={20} color={colors.accentLight} strokeWidth={2.3} />
              </View>
              <View style={S.logCopy}>
                <Text style={[S.logName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {transfer.fileNames?.join(', ') || transfer.fileName || 'Transfer'}
                </Text>
                <Text style={[S.logRoute, { color: colors.textMuted }]} numberOfLines={1}>
                  {transfer.fromDeviceName} to {transfer.toDeviceName} - {formatDate(transfer.updatedAt)}
                </Text>
              </View>
              <View style={S.logAmount}>
                <Text style={[S.logBytes, { color: colors.accentLight }]}>{formatBytes(transfer.sizeBytes)}</Text>
                <Text style={[S.logStatus, { color: transfer.status === 'completed' ? colors.success : colors.warning }]}>{transfer.status.toUpperCase()}</Text>
              </View>
            </View>
          ))}
        </GlassCard>
      </View>

      <View style={S.logSection}>
        <Text style={[S.logHeader, { color: colors.textMuted }]}>TOP DEVICES</Text>
        <GlassCard padding={0}>
          {data.topDevices.length === 0 ? (
            <View style={S.emptyLog}>
              <Text style={[S.logRoute, { color: colors.textMuted }]}>Completed transfers will identify top peers here.</Text>
            </View>
          ) : null}
          {data.topDevices.map((device, index) => (
            <View key={device.name} style={[S.logRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={[S.logIcon, { backgroundColor: colors.surfaceHover }]}>
                <Smartphone size={20} color={colors.accentLight} strokeWidth={2.3} />
              </View>
              <View style={S.logCopy}>
                <Text style={[S.logName, { color: colors.textPrimary }]} numberOfLines={1}>{device.name}</Text>
                <Text style={[S.logRoute, { color: colors.textMuted }]}>Completed transfer volume</Text>
              </View>
              <Text style={[S.logBytes, { color: colors.accentLight }]}>{formatBytes(device.bytes)}</Text>
            </View>
          ))}
        </GlassCard>
      </View>
    </ScrollView>
  );
}

const S = StyleSheet.create({
  scroll:   { gap: SPACING.md, paddingBottom: SPACING.md },
  pageTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '800', letterSpacing: -0.8 },
  heroMetric: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroLabel: { fontSize: FONT_SIZE.xs, fontWeight: '900', letterSpacing: 1.1 },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.xs, marginTop: SPACING.sm },
  heroValue: { fontSize: FONT_SIZE.hero, fontWeight: '900' },
  heroUnit: { fontSize: FONT_SIZE.lg, fontWeight: '800' },
  trendText: { marginTop: SPACING.sm, fontSize: FONT_SIZE.xs, fontWeight: '900' },

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
  chartHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: SPACING.xl },
  chartTitle: { fontSize: FONT_SIZE.base, fontWeight: '900' },
  chartSub: { fontSize: FONT_SIZE.xs, fontWeight: '900', letterSpacing: 0.8, marginTop: 3 },
  chartLegend: { fontSize: FONT_SIZE.xs, fontWeight: '800' },
  chart: { height: 148, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: SPACING.sm },
  barSlot: { flex: 1, alignItems: 'center', gap: SPACING.sm },
  barTrackTall: { width: '100%', height: 116, borderRadius: RADIUS.sm, overflow: 'hidden', justifyContent: 'flex-end' },
  barColumn: { width: '100%', borderTopLeftRadius: RADIUS.sm, borderTopRightRadius: RADIUS.sm },
  dayLabel: { fontSize: FONT_SIZE.xs, fontWeight: '900' },
  logSection: { gap: SPACING.sm },
  logHeader: { fontSize: FONT_SIZE.xs, fontWeight: '900', letterSpacing: 1.1 },
  logRow: { padding: SPACING.md, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  logIcon: { width: 40, height: 40, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  logCopy: { flex: 1, minWidth: 0 },
  logName: { fontSize: FONT_SIZE.base, fontWeight: '900' },
  logRoute: { fontSize: 10, fontWeight: '800', marginTop: 3 },
  logAmount: { alignItems: 'flex-end' },
  logBytes: { fontSize: FONT_SIZE.xs, fontWeight: '900' },
  logStatus: { fontSize: 10, fontWeight: '900', marginTop: 3 },
  emptyLog: { padding: SPACING.md, alignItems: 'center' },
});
