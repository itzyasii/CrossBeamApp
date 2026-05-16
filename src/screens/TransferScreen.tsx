import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, FilePlus2, FileText, Pause, Radio, Send, X } from 'lucide-react-native';

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
  targetDeviceName?: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  completed: '#22D3A5',
  'in-progress': '#6366F1',
  queued: '#FBBF24',
  paused: '#FBBF24',
  failed: '#F87171',
  cancelled: '#56566A',
  blocked: '#FBBF24',
  rejected: '#F87171',
};

const AnimatedBar = ({ progress, status }: { progress: number; status: string }) => {
  const w = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(w, { toValue: progress, duration: 600, useNativeDriver: false }).start();
  }, [progress, w]);

  return (
    <View style={S.track}>
      <Animated.View
        style={[
          S.fill,
          {
            width: w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
            backgroundColor: STATUS_COLOR[status] ?? '#6366F1',
          },
        ]}
      />
    </View>
  );
};

export function TransferScreen({
  transfers,
  selectedFiles,
  transferError,
  onPickFiles,
  onClearSelectedFiles,
  onStartTransfer,
  onPauseResume,
  onCancel,
  targetDeviceName,
}: Props) {
  const { colors } = useTheme();
  const total = selectedFiles.reduce((sum, file) => sum + file.sizeBytes, 0);
  const hasFiles = selectedFiles.length > 0;

  return (
    <View style={S.container}>
      <GlassCard animate>
        <Text style={[S.sectionTitle, { color: colors.textPrimary }]}>Select files to send</Text>

        {!hasFiles && (
          <Pressable onPress={onPickFiles} style={[S.dropzone, { borderColor: colors.borderStrong }]} accessibilityRole="button">
            <View style={[S.dropIcon, { backgroundColor: colors.accentHighlight }]}>
              <FilePlus2 size={34} color={colors.accentLight} strokeWidth={2.2} />
            </View>
            <Text style={[S.dropzoneTitle, { color: colors.textPrimary }]}>Choose Files</Text>
            <Text style={[S.dropzoneSub, { color: colors.textSecondary }]}>Tap to browse documents, photos, videos and more.</Text>
          </Pressable>
        )}

        {hasFiles && (
          <>
            <View style={S.chipsMeta}>
              <Text style={[S.chipCount, { color: colors.textSecondary }]}>
                {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} - {formatSize(total)}
              </Text>
              <Pressable onPress={onClearSelectedFiles} hitSlop={8}>
                <Text style={[S.clearBtn, { color: colors.error }]}>Clear all</Text>
              </Pressable>
            </View>
            <View style={S.chips}>
              {selectedFiles.map((file) => (
                <View key={file.id} style={[S.chip, { backgroundColor: colors.accentHighlight, borderColor: colors.border }]}>
                  <FileText size={14} color={colors.success} strokeWidth={2.3} />
                  <Text style={[S.chipName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={[S.chipSize, { color: colors.textMuted }]}>{formatSize(file.sizeBytes)}</Text>
                </View>
              ))}
            </View>

            <View style={S.actionRow}>
              <Pressable onPress={onPickFiles} style={[S.addMoreBtn, { borderColor: colors.border }]} accessibilityRole="button">
                <FilePlus2 size={16} color={colors.textSecondary} strokeWidth={2.3} />
                <Text style={[S.addMoreText, { color: colors.textSecondary }]}>Add more</Text>
              </Pressable>
              <Pressable onPress={onStartTransfer} style={S.sendBtnWrap} accessibilityRole="button">
                <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.sendBtn}>
                  <Send size={16} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={S.sendBtnText} numberOfLines={1}>
                    {targetDeviceName ? `Send to ${targetDeviceName}` : 'Send Now'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </>
        )}
      </GlassCard>

      {transferError && (
        <GlassCard>
          <View style={S.errorRow}>
            <AlertTriangle size={22} color={colors.error} strokeWidth={2.4} />
            <View style={{ flex: 1 }}>
              <Text style={[S.errorTitle, { color: colors.error }]}>Transfer blocked</Text>
              <Text style={[S.errorMsg, { color: colors.textSecondary }]}>{transferError}</Text>
            </View>
          </View>
        </GlassCard>
      )}

      {transfers.length > 0 && (
        <>
          <Text style={[S.listHeader, { color: colors.textMuted }]}>ACTIVE TRANSFERS</Text>
          {transfers.map((job) => {
            const color = STATUS_COLOR[job.status] ?? colors.accent;
            return (
              <GlassCard key={job.id} accentBorder={job.status === 'in-progress'}>
                <View style={S.jobHead}>
                  <View style={[S.peerIcon, { backgroundColor: `${color}1A`, borderColor: `${color}55` }]}>
                    <Radio size={22} color={color} strokeWidth={2.4} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[S.jobName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {job.fileNames.join(', ')}
                    </Text>
                    <Text style={[S.jobRoute, { color: colors.textSecondary }]}>
                      {job.fromDeviceName} to {job.toDeviceName} - {formatSize(job.sizeBytes)}
                    </Text>
                  </View>
                  <View style={[S.statusPill, { backgroundColor: `${color}1A`, borderColor: `${color}44` }]}>
                    <Text style={[S.statusText, { color }]}>{job.status}</Text>
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
                    <Pause size={15} color={colors.textSecondary} strokeWidth={2.4} />
                    <Text style={[S.jobBtnText, { color: colors.textSecondary }]}>{job.status === 'paused' ? 'Resume' : 'Pause'}</Text>
                  </Pressable>
                  <Pressable onPress={() => onCancel(job.id)} style={[S.jobBtn, { borderColor: `${colors.error}40` }]}>
                    <X size={15} color={colors.error} strokeWidth={2.4} />
                    <Text style={[S.jobBtnText, { color: colors.error }]}>Cancel</Text>
                  </Pressable>
                </View>
              </GlassCard>
            );
          })}
        </>
      )}

      <View style={S.transferRadar}>
        {[192, 144, 96].map((size) => (
          <View key={size} style={[S.transferRing, { width: size, height: size, borderRadius: size / 2 }]} />
        ))}
        <View style={[S.transferCore, { backgroundColor: colors.accent }]}>
          <Radio size={22} color="#FFFFFF" strokeWidth={2.4} />
        </View>
        <Text style={[S.radarCaption, { color: colors.textMuted }]}>SCANNING LOCAL BEAM RANGE...</Text>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  container: { gap: SPACING.md },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '800', marginBottom: SPACING.md },
  dropzone: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: RADIUS.md, paddingVertical: SPACING.xxxl, alignItems: 'center', gap: SPACING.sm },
  dropIcon: { width: 68, height: 68, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  dropzoneTitle: { fontSize: FONT_SIZE.md, fontWeight: '800' },
  dropzoneSub: { fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20, maxWidth: 270 },
  chipsMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  chipCount: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  clearBtn: { fontSize: FONT_SIZE.sm, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACING.sm, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1, maxWidth: '100%' },
  chipName: { fontSize: FONT_SIZE.sm, fontWeight: '700', flexShrink: 1, maxWidth: 160 },
  chipSize: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: SPACING.sm },
  addMoreBtn: { borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: 13, paddingHorizontal: SPACING.md, alignItems: 'center', flexDirection: 'row', gap: SPACING.xs },
  addMoreText: { fontSize: FONT_SIZE.base, fontWeight: '700' },
  sendBtnWrap: { flex: 1 },
  sendBtn: { borderRadius: RADIUS.md, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.sm },
  sendBtnText: { color: '#fff', fontWeight: '800', fontSize: FONT_SIZE.base, flexShrink: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  errorTitle: { fontSize: FONT_SIZE.base, fontWeight: '800', marginBottom: 3 },
  errorMsg: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  listHeader: { fontSize: FONT_SIZE.xs, fontWeight: '900', letterSpacing: 1.5 },
  jobHead: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md, alignItems: 'center' },
  peerIcon: { width: 48, height: 48, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  jobName: { fontSize: FONT_SIZE.base, fontWeight: '800', marginBottom: 3 },
  jobRoute: { fontSize: FONT_SIZE.sm },
  statusPill: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 4, alignSelf: 'flex-start' },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: '800', textTransform: 'capitalize' },
  track: { height: 6, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: SPACING.xs },
  fill: { height: '100%', borderRadius: RADIUS.full },
  jobMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md },
  metaText: { fontSize: FONT_SIZE.xs, fontWeight: '800' },
  jobActions: { flexDirection: 'row', gap: SPACING.sm },
  jobBtn: { flex: 1, borderWidth: 1, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: SPACING.xs },
  jobBtnText: { fontSize: FONT_SIZE.sm, fontWeight: '800' },
  transferRadar: { height: 220, alignItems: 'center', justifyContent: 'center' },
  transferRing: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(192,193,255,0.14)' },
  transferCore: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', shadowColor: '#C0C1FF', shadowOpacity: 0.6, shadowRadius: 18 },
  radarCaption: { position: 'absolute', bottom: SPACING.sm, fontSize: FONT_SIZE.xs, fontWeight: '900', letterSpacing: 1.1 },
});
