import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import { useTheme } from '@/hooks/useTheme';

type HomeScreenProps = {
  deviceCount: number;
  transferCount: number;
};

export function HomeScreen({ deviceCount, transferCount }: HomeScreenProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <SectionCard
        title="Welcome to CrossBeam"
        subtitle="Fast, private, and offline file sharing across Android, iOS, and Android TV."
      >
        <Text style={[styles.text, { color: colors.textPrimary }]}>Nearby devices discovered: {deviceCount}</Text>
        <Text style={[styles.text, { color: colors.textPrimary }]}>Total transfer jobs: {transferCount}</Text>
        <Text style={[styles.muted, { color: colors.textSecondary }]}>No ads are shown while transfers are active.</Text>
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
  },
  muted: {
    fontSize: 13,
    lineHeight: 18,
  },
});
