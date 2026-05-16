import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Clock3, FileText, Trash2, XCircle } from 'lucide-react-native';

import { GlassCard } from '@/components/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import { clearTransferHistory, getTransferHistory } from '@/store/database';
import { TransferJob } from '@/types/domain';
import { formatBytes, formatDate } from '@/utils/helpers';
import { FONT_SIZE, RADIUS, SPACING } from '@/theme/colors';

type HistoryScreenProps = {
  transfers: TransferJob[];
};

const statusColor = (status: TransferJob['status'], colors: ReturnType<typeof useTheme>['colors']) => {
  if (status === 'completed') return colors.success;
  if (status === 'failed' || status === 'cancelled' || status === 'rejected') return colors.error;
  if (status === 'blocked' || status === 'paused') return colors.warning;
  return colors.accent;
};

const statusIcon = (status: TransferJob['status']) => {
  if (status === 'completed') return CheckCircle2;
  if (status === 'failed' || status === 'cancelled' || status === 'rejected') return XCircle;
  return Clock3;
};

export function HistoryScreen({ transfers }: HistoryScreenProps) {
  const { colors } = useTheme();
  const [storedTransfers, setStoredTransfers] = useState<TransferJob[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    setRefreshing(true);
    try {
      setStoredTransfers(await getTransferHistory());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, transfers.length]);

  const mergedTransfers = useMemo(() => {
    const byId = new Map<string, TransferJob>();
    [...transfers, ...storedTransfers].forEach((job) => byId.set(job.id, job));
    return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [storedTransfers, transfers]);

  const clearHistory = () => {
    Alert.alert('Clear transfer history?', 'This only clears local history records. It does not delete files.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearTransferHistory();
          await loadHistory();
        },
      },
    ]);
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={S.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadHistory} tintColor={colors.accent} />}
    >
      <View style={S.header}>
        <View style={S.headerCopy}>
          <Text style={[S.title, { color: colors.textPrimary }]}>Transfer History</Text>
          <Text style={[S.subtitle, { color: colors.textSecondary }]}>Completed, paused, failed, and rejected jobs.</Text>
        </View>
        {mergedTransfers.length > 0 && (
          <Pressable onPress={clearHistory} style={[S.clearButton, { borderColor: `${colors.error}44` }]}>
            <Trash2 size={16} color={colors.error} strokeWidth={2.2} />
            <Text style={[S.clearText, { color: colors.error }]}>Clear</Text>
          </Pressable>
        )}
      </View>

      {mergedTransfers.length === 0 ? (
        <GlassCard animate>
          <View style={S.empty}>
            <FileText size={34} color={colors.accentLight} strokeWidth={2.1} />
            <Text style={[S.emptyTitle, { color: colors.textPrimary }]}>No history yet</Text>
            <Text style={[S.emptyText, { color: colors.textSecondary }]}>
              Shared files will appear here after the first transfer starts.
            </Text>
          </View>
        </GlassCard>
      ) : (
        <View style={S.list}>
          {mergedTransfers.map((job) => {
            const color = statusColor(job.status, colors);
            const Icon = statusIcon(job.status);
            return (
              <GlassCard key={job.id} padding={SPACING.md}>
                <View style={S.item}>
                  <View style={[S.statusIcon, { backgroundColor: `${color}1F` }]}>
                    <Icon size={20} color={color} strokeWidth={2.4} />
                  </View>
                  <View style={S.itemCopy}>
                    <Text style={[S.name, { color: colors.textPrimary }]} numberOfLines={1}>
                      {job.fileNames?.join(', ') || job.fileName || 'Transfer'}
                    </Text>
                    <Text style={[S.route, { color: colors.textSecondary }]} numberOfLines={1}>
                      {job.fromDeviceName} to {job.toDeviceName} - {formatBytes(job.sizeBytes)}
                    </Text>
                    <Text style={[S.date, { color: colors.textMuted }]}>{formatDate(job.updatedAt)}</Text>
                  </View>
                  <View style={[S.statusPill, { backgroundColor: `${color}18`, borderColor: `${color}44` }]}>
                    <Text style={[S.statusText, { color }]}>{job.status}</Text>
                  </View>
                </View>
              </GlassCard>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { gap: SPACING.md, paddingBottom: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: SPACING.md },
  headerCopy: { flex: 1, gap: SPACING.xs },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: '800' },
  subtitle: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  clearButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md },
  clearText: { fontSize: FONT_SIZE.sm, fontWeight: '800' },
  list: { gap: SPACING.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  statusIcon: { width: 42, height: 42, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  itemCopy: { flex: 1, minWidth: 0 },
  name: { fontSize: FONT_SIZE.base, fontWeight: '800' },
  route: { fontSize: FONT_SIZE.sm, marginTop: 3 },
  date: { fontSize: FONT_SIZE.xs, marginTop: 5, fontWeight: '700' },
  statusPill: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 5, alignSelf: 'flex-start' },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: '800', textTransform: 'capitalize' },
  empty: { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xxl },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800' },
  emptyText: { textAlign: 'center', fontSize: FONT_SIZE.sm, lineHeight: 20, maxWidth: 280 },
});
