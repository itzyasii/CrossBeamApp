import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import { useTheme } from '@/hooks/useTheme';
import { TransferJob } from '@/types/domain';

type HistoryScreenProps = {
  transfers: TransferJob[];
};

export function HistoryScreen({ transfers }: HistoryScreenProps) {
  const { colors } = useTheme();

  return (
    <SectionCard title="Transfer History" subtitle="Track completed, paused, failed, and rejected jobs.">
      {transfers.length === 0 ? <Text style={{ color: colors.textSecondary }}>No transfer history yet.</Text> : null}
      {transfers.map((job) => (
        <View key={job.id} style={[styles.item, { borderBottomColor: colors.border }]}>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
            {job.fileNames[0]}
          </Text>
          <Text style={[styles.status, { color: colors.textSecondary }]}>{job.status}</Text>
        </View>
      ))}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  name: {
    fontWeight: '600',
    flex: 1,
  },
  status: {
    textTransform: 'capitalize',
    fontSize: 12,
  },
});
