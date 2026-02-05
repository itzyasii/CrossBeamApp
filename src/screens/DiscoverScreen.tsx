import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import { useTheme } from '@/hooks/useTheme';
import { Device } from '@/types/domain';

type DiscoverScreenProps = {
  devices: Device[];
  onRefresh: () => void;
  isRefreshing: boolean;
};

const platformLabel: Record<Device['platform'], string> = {
  android: 'Android Phone',
  ios: 'iPhone/iPad',
  'android-tv': 'Android TV',
};

export function DiscoverScreen({ devices, onRefresh, isRefreshing }: DiscoverScreenProps) {
  const { colors } = useTheme();

  return (
    <SectionCard
      title="Nearby Devices"
      subtitle="Automatic local discovery over Wi‑Fi Direct, hotspot, and LAN."
      rightSlot={
        <Pressable
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={onRefresh}
          accessibilityRole="button"
          focusable
        >
          <Text style={[styles.buttonLabel, { color: colors.textInverse }]}>
            {isRefreshing ? 'Scanning…' : 'Refresh'}
          </Text>
        </Pressable>
      }
    >
      {devices.map((device) => (
        <View key={device.id} style={[styles.row, { borderBottomColor: colors.border }]}>
          <Text style={[styles.primary, { color: colors.textPrimary }]}>{device.name}</Text>
          <Text style={[styles.secondary, { color: colors.textSecondary }]}>
            {platformLabel[device.platform]} • {device.connection}
          </Text>
        </View>
      ))}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 110,
    alignItems: 'center',
  },
  buttonLabel: {
    fontWeight: '700',
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  primary: {
    fontSize: 15,
    fontWeight: '600',
  },
  secondary: {
    fontSize: 12,
    marginTop: 4,
  },
});
