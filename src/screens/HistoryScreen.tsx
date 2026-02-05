import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import { colors } from '@/theme/colors';
import { TransferJob } from '@/types/domain';

type HistoryScreenProps = {
  transfers: TransferJob[];
};

export function HistoryScreen({ transfers }: HistoryScreenProps) {
  return (
    <SectionCard title="Transfer History" subtitle="Recent jobs and completion states">
      {transfers.length === 0 ? <Text style={styles.empty}>No transfer history yet.</Text> : null}
      {transfers.map((job) => (
        <View key={job.id} style={styles.item}>
          <Text style={styles.name}>{job.fileName}</Text>
          <Text style={styles.status}>{job.status}</Text>
        </View>
      ))}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  empty: {
    color: colors.textSecondary,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardAlt,
  },
  name: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  status: {
    color: colors.warning,
    fontSize: 12,
  },
});
