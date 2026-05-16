import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import { useTheme } from '@/hooks/useTheme';
import { formatSize } from '@/services/transferService';
import { SelectedFile, TransferJob } from '@/types/domain';

type TransferScreenProps = {
  transfers: TransferJob[];
  selectedFiles: SelectedFile[];
  transferError: string | null;
  onPickFiles: () => void;
  onClearSelectedFiles: () => void;
  onStartTransfer: () => void;
  onPauseResume: (id: string) => void;
  onCancel: (id: string) => void;
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
}: TransferScreenProps) {
  const { colors } = useTheme();

  const selectedBytes = selectedFiles.reduce(
    (sum, file) => sum + file.sizeBytes,
    0,
  );

  return (
    <SectionCard
      title="Transfers"
      subtitle="Select real files now. Sending unlocks when native transfer adapters are installed."
    >
      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: colors.success }]}
          onPress={onPickFiles}
          accessibilityRole="button"
          focusable
        >
          <Text style={[styles.primaryLabel, { color: colors.textInverse }]}>
            Select files
          </Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, { borderColor: colors.border }]}
          onPress={onStartTransfer}
          accessibilityRole="button"
          focusable
        >
          <Text style={[styles.secondaryLabel, { color: colors.textPrimary }]}>
            Start transfer
          </Text>
        </Pressable>
      </View>

      {selectedFiles.length > 0 ? (
        <View style={[styles.selectionCard, { borderColor: colors.border }]}>
          <View style={styles.selectionHeader}>
            <Text style={[styles.fileName, { color: colors.textPrimary }]}>
              Selected files
            </Text>
            <Pressable onPress={onClearSelectedFiles}>
              <Text style={[styles.linkLabel, { color: colors.accent }]}>
                Clear
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} -{' '}
            {formatSize(selectedBytes)}
          </Text>
          {selectedFiles.map((file) => (
            <Text
              key={file.id}
              style={[styles.meta, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {file.name} ({formatSize(file.sizeBytes)})
            </Text>
          ))}
        </View>
      ) : (
        <View style={[styles.selectionCard, { borderColor: colors.border }]}>
          <Text style={[styles.fileName, { color: colors.textPrimary }]}>
            No files selected
          </Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            Use the system picker to choose documents, photos, videos, archives,
            or other supported files.
          </Text>
        </View>
      )}

      {transferError ? (
        <View style={[styles.errorCard, { borderColor: colors.error }]}>
          <Text style={[styles.fileName, { color: colors.error }]}>
            Transfer unavailable
          </Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {transferError}
          </Text>
        </View>
      ) : null}

      {transfers.map((job) => (
        <View
          key={job.id}
          style={[styles.jobCard, { backgroundColor: colors.surfaceHighlight }]}
        >
          <Text style={[styles.fileName, { color: colors.textPrimary }]}>
            {job.fileNames.join(', ')}
          </Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {job.fromDeviceName} - {job.toDeviceName} - {formatSize(job.sizeBytes)}
          </Text>
          <View
            style={[styles.progressTrack, { backgroundColor: colors.border }]}
          >
            <View
              style={[
                styles.progressFill,
                { width: `${job.progress}%`, backgroundColor: colors.accent },
              ]}
            />
          </View>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            Status: {job.status} - {job.progress}%
          </Text>
          {typeof job.bytesTransferred === 'number' && typeof job.totalBytes === 'number' ? (
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {formatSize(job.bytesTransferred)} / {formatSize(job.totalBytes)}
            </Text>
          ) : null}
          {job.errorMessage ? (
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {job.errorMessage}
            </Text>
          ) : null}
          <Pressable
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={() => onPauseResume(job.id)}
            accessibilityRole="button"
            focusable
          >
            <Text
              style={[styles.secondaryLabel, { color: colors.textPrimary }]}
            >
              Pause / resume
            </Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={() => onCancel(job.id)}
            accessibilityRole="button"
            focusable
          >
            <Text
              style={[styles.secondaryLabel, { color: colors.textPrimary }]}
            >
              Cancel
            </Text>
          </Pressable>
        </View>
      ))}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  primaryLabel: {
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  secondaryLabel: {
    fontWeight: '600',
    fontSize: 12,
  },
  selectionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  jobCard: {
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  fileName: {
    fontWeight: '700',
    fontSize: 14,
  },
  linkLabel: {
    fontWeight: '700',
    fontSize: 12,
  },
  meta: {
    fontSize: 12,
    lineHeight: 18,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
});
