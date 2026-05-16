import React, { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '@/components/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import { gradients, FONT_SIZE, RADIUS, SPACING } from '@/theme/colors';
import { formatSize } from '@/services/transferService';
import { SelectedFile, TransferJob } from '@/types/domain';

type Props = {
  transfers: TransferJob[];
  selectedFiles: SelectedFile[];
  transferError: string | null;
  onPickFiles: () => void;
  onClearSelectedFiles: () => void;
  onStartTransfer: () => void;
  onPauseResume: (id: string) => void;
  onCancel: (id: string) => void;
};

const STATUS_COLOR: Record<string, string> = {
  completed: '#22D3A5',
  'in-progress': '#6366F1',
  queued: '#FBBF24',
  failed: '#F87171',
  cancelled: '#56566A',
  blocked: '#FBBF24',
};

const AnimatedBar = ({ progress, status }: { progress: number; status: string }) => {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: progress, duration: 600, useNativeDriver: false }).start();
  }, [progress, w]);
  return (
    <View style={S.track}>
      <Animated.View style={[S.fill, {
        width: w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
        backgroundColor: STATUS_COLOR[status] ?? '#6366F1',
      }]} />
    </View>
  );
};

export function TransferScreen({
  transfers, selectedFiles, transferError,
  onPickFiles, onClearSelectedFiles, onStartTransfer, onPauseResume, onCancel,
}: Props) {
  const { colors } = useTheme();
  const total = selectedFiles.reduce((s, f) => s + f.sizeBytes, 0);
  const hasFiles = selectedFiles.length > 0;

  return (
    <View style={S.container}>
      {/* ── File picker card ─────────────────────────────────────────────── */}
      <GlassCard animate>
        <Text style={[S.sectionTitle, { color: colors.textPrimary }]}>Files to Send</Text>

        {/* Big pick-files area when empty */}
        {!hasFiles && (
          <Pressable onPress={onPickFiles} style={[S.dropzone, { borderColor: colors.borderStrong }]}>
            <Image source={require('../../assets/icon.png')} style={S.dropzoneImage} />
            <Text style={[S.dropzoneTitle, { color: colors.textPrimary }]}>Choose Files</Text>
            <Text style={[S.dropzoneSub, { color: colors.textSecondary }]}>
              Documents, photos, videos & more
            </Text>
          </Pressable>
        )}

        {/* File chips when selected */}
        {hasFiles && (
          <>
            <View style={S.chipsMeta}>
              <Text style={[S.chipCount, { color: colors.textSecondary }]}>
                {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} · {formatSize(total)}
              </Text>
              <Pressable onPress={onClearSelectedFiles} hitSlop={8}>
                <Text style={[S.clearBtn, { color: colors.error }]}>Clear all</Text>
              </Pressable>
            </View>
            <View style={S.chips}>
              {selectedFiles.map(f => (
                <View key={f.id} style={[S.chip, { backgroundColor: colors.accentHighlight, borderColor: colors.border }]}>
                  <Text style={S.chipIcon}>📄</Text>
                  <Text style={[S.chipName, { color: colors.textPrimary }]} numberOfLines={1}>{f.name}</Text>
                  <Text style={[S.chipSize, { color: colors.textMuted }]}>{formatSize(f.sizeBytes)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Action row — always visible when files exist */}
        {hasFiles && (
          <View style={S.actionRow}>
            <Pressable onPress={onPickFiles} style={[S.addMoreBtn, { borderColor: colors.border }]}>
              <Text style={[S.addMoreText, { color: colors.textSecondary }]}>＋ Add more</Text>
            </Pressable>
            <Pressable onPress={onStartTransfer} style={S.sendBtnWrap}>
              <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.sendBtn}>
                <Text style={S.sendBtnText}>⚡  Send Now</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </GlassCard>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {transferError && (
        <GlassCard>
          <View style={S.errorRow}>
            <Text style={{ fontSize: 20 }}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={[S.errorTitle, { color: colors.error }]}>Error</Text>
              <Text style={[S.errorMsg, { color: colors.textSecondary }]}>{transferError}</Text>
            </View>
          </View>
        </GlassCard>
      )}

      {/* ── Active transfers ──────────────────────────────────────────────── */}
      {transfers.length > 0 && (
        <>
          <Text style={[S.listHeader, { color: colors.textMuted }]}>ACTIVE TRANSFERS</Text>
          {transfers.map(job => (
            <GlassCard key={job.id}>
              <View style={S.jobHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[S.jobName, { color: colors.textPrimary }]} numberOfLines={1}>{job.fileNames.join(', ')}</Text>
                  <Text style={[S.jobRoute, { color: colors.textSecondary }]}>
                    {job.fromDeviceName} → {job.toDeviceName} · {formatSize(job.sizeBytes)}
                  </Text>
                </View>
                <View style={[S.statusPill, { backgroundColor: `${STATUS_COLOR[job.status] ?? '#6366F1'}1A` }]}>
                  <Text style={[S.statusText, { color: STATUS_COLOR[job.status] ?? '#6366F1' }]}>{job.status}</Text>
                </View>
              </View>

              <AnimatedBar progress={job.progress} status={job.status} />

              <View style={S.jobMeta}>
                <Text style={[S.metaText, { color: colors.textMuted }]}>{job.progress}%</Text>
                {job.bytesTransferred != null && job.totalBytes != null && (
                  <Text style={[S.metaText, { color: colors.textMuted }]}>
                    {formatSize(job.bytesTransferred)} / {formatSize(job.totalBytes)}
                  </Text>
                )}
              </View>

              {job.errorMessage && <Text style={[S.errorMsg, { color: colors.error, marginBottom: SPACING.sm }]}>{job.errorMessage}</Text>}

              <View style={S.jobActions}>
                <Pressable onPress={() => onPauseResume(job.id)} style={[S.jobBtn, { borderColor: colors.border }]}>
                  <Text style={[S.jobBtnText, { color: colors.textSecondary }]}>⏸  Pause</Text>
                </Pressable>
                <Pressable onPress={() => onCancel(job.id)} style={[S.jobBtn, { borderColor: `${colors.error}40` }]}>
                  <Text style={[S.jobBtnText, { color: colors.error }]}>✕  Cancel</Text>
                </Pressable>
              </View>
            </GlassCard>
          ))}
        </>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  container: { gap: SPACING.md },

  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', letterSpacing: -0.3, marginBottom: SPACING.md },

  dropzone: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: RADIUS.md, paddingVertical: SPACING.xxxl, alignItems: 'center', gap: SPACING.sm },
  dropzoneImage: { width: 64, height: 64, borderRadius: 16, marginBottom: SPACING.sm },
  dropzoneTitle: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  dropzoneSub:   { fontSize: FONT_SIZE.sm, textAlign: 'center' },

  chipsMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  chipCount: { fontSize: FONT_SIZE.sm, fontWeight: '500' },
  clearBtn:  { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: RADIUS.sm, borderWidth: 1, maxWidth: '100%' },
  chipIcon: { fontSize: 14 },
  chipName: { fontSize: FONT_SIZE.sm, fontWeight: '600', flexShrink: 1, maxWidth: 160 },
  chipSize: { fontSize: FONT_SIZE.xs },

  actionRow:   { flexDirection: 'row', gap: SPACING.sm },
  addMoreBtn:  { borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: 13, paddingHorizontal: SPACING.lg, alignItems: 'center' },
  addMoreText: { fontSize: FONT_SIZE.base, fontWeight: '600' },
  sendBtnWrap: { flex: 1 },
  sendBtn:     { borderRadius: RADIUS.md, paddingVertical: 13, alignItems: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.base },

  errorRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  errorTitle: { fontSize: FONT_SIZE.base, fontWeight: '700', marginBottom: 3 },
  errorMsg:   { fontSize: FONT_SIZE.sm, lineHeight: 20 },

  listHeader: { fontSize: FONT_SIZE.xs, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },

  jobHead:   { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md, alignItems: 'flex-start' },
  jobName:   { fontSize: FONT_SIZE.base, fontWeight: '700', marginBottom: 3 },
  jobRoute:  { fontSize: FONT_SIZE.sm },
  statusPill: { borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 4, alignSelf: 'flex-start' },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: '700', textTransform: 'capitalize' },

  track: { height: 5, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: SPACING.xs },
  fill:  { height: '100%', borderRadius: RADIUS.full },

  jobMeta:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md },
  metaText:  { fontSize: FONT_SIZE.xs },

  jobActions: { flexDirection: 'row', gap: SPACING.sm },
  jobBtn:     { flex: 1, borderWidth: 1, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: 'center' },
  jobBtnText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
});
