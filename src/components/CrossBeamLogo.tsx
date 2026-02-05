import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type CrossBeamLogoProps = {
  compact?: boolean;
};

export function CrossBeamLogo({ compact = false }: CrossBeamLogoProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <View style={styles.mark}>
        <View style={[styles.beam, styles.beamA, { backgroundColor: '#6FF8F2' }]} />
        <View style={[styles.beam, styles.beamB, { backgroundColor: '#9B63FF' }]} />
        <View style={[styles.centerNode, { borderColor: colors.textInverse, backgroundColor: colors.surface }]}>
          <View style={[styles.centerPulse, { backgroundColor: colors.accent }]} />
        </View>
      </View>
      <Text style={[styles.wordmark, { color: colors.textPrimary }, compact && styles.compactWordmark]}>
        CrossBeamApp
      </Text>
      {!compact ? (
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>Elegant UI • Less Ads • Faster • Offline Sharing</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 10,
  },
  compactContainer: {
    alignItems: 'flex-start',
    gap: 4,
  },
  mark: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beam: {
    position: 'absolute',
    width: 96,
    height: 28,
    borderRadius: 14,
    opacity: 0.95,
  },
  beamA: {
    transform: [{ rotate: '45deg' }],
  },
  beamB: {
    transform: [{ rotate: '-45deg' }],
  },
  centerNode: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPulse: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  wordmark: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  compactWordmark: {
    fontSize: 24,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
