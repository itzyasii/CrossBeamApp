import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import { colors } from '@/theme/colors';
import { TransferJob } from '@/types/domain';

type TransferScreenProps = {
  transfers: TransferJob[];
  onStartDemoTransfer: () => void;
  onPauseResume: (id: string) => void;
};

export function TransferScreen({ transfers, onStartDemoTransfer, onPauseResume }: TransferScreenProps) {
  return (
    <SectionCard title="File Transfer" subtitle="Encrypted transfer with pause/resume">
      <Pressable style={styles.button} onPress={onStartDemoTransfer}>
        <Text style={styles.buttonLabel}>Start demo transfer</Text>
      </Pressable>
      {transfers.map((job) => (
        <View key={job.id} style={styles.jobCard}>
          <Text style={styles.fileName}>{job.fileName}</Text>
          <Text style={styles.meta}>
            {job.fromDeviceName} → {job.toDeviceName}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${job.progress}%` }]} />
          </View>
          <Text style={styles.meta}>Status: {job.status} • {job.progress}%</Text>
          <Pressable style={styles.secondaryButton} onPress={() => onPauseResume(job.id)}>
            <Text style={styles.secondaryLabel}>
              {job.status === 'paused' ? 'Resume' : 'Pause'}
            </Text>
          </Pressable>
        </View>
      ))}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  buttonLabel: {
    color: '#053320',
    fontWeight: '700',
  },
  jobCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  fileName: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#324A71',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.textSecondary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  secondaryLabel: {
    color: colors.textPrimary,
    fontSize: 12,
  },
});
