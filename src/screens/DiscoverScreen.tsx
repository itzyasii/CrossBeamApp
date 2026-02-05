import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import { colors } from '@/theme/colors';
import { Device } from '@/types/domain';

type DiscoverScreenProps = {
  devices: Device[];
  onRefresh: () => void;
  isRefreshing: boolean;
};

export function DiscoverScreen({ devices, onRefresh, isRefreshing }: DiscoverScreenProps) {
  return (
    <SectionCard
      title="Device Discovery"
      subtitle="Automatic local network scan (Wi‑Fi Direct / hotspot / LAN)"
    >
      <Pressable style={styles.button} onPress={onRefresh}>
        <Text style={styles.buttonLabel}>{isRefreshing ? 'Scanning…' : 'Refresh devices'}</Text>
      </Pressable>
      {devices.map((device) => (
        <View key={device.id} style={styles.row}>
          <Text style={styles.primary}>{device.name}</Text>
          <Text style={styles.secondary}>
            {device.platform} • {device.connection}
          </Text>
        </View>
      ))}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  buttonLabel: {
    color: '#041429',
    fontWeight: '700',
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardAlt,
  },
  primary: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  secondary: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
});
