import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import { colors } from '@/theme/colors';

type HomeScreenProps = {
  deviceCount: number;
  transferCount: number;
};

export function HomeScreen({ deviceCount, transferCount }: HomeScreenProps) {
  return (
    <View style={styles.container}>
      <SectionCard
        title="CrossBeam"
        subtitle="Fast offline sharing for Android, iOS, and Android TV"
      >
        <Text style={styles.text}>Nearby devices: {deviceCount}</Text>
        <Text style={styles.text}>Transfer jobs: {transferCount}</Text>
        <Text style={styles.textMuted}>Ads are hidden while a transfer is active.</Text>
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  text: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  textMuted: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
