import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { GlassCard } from '@/components/GlassCard';
import { getTrustedDevices } from '@/store/database';
import { Device } from '@/types/domain';
import { formatDate } from '@/utils/helpers';

export function DevicesScreen() {
  const { colors } = useTheme();
  const [devices, setDevices] = useState<Device[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const result = await getTrustedDevices();
      setDevices(result);
    } catch (error) {
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.accent} />}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>Trusted Devices</Text>
      
      {devices.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No trusted devices yet. Connect to a peer to add them to your trusted list.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {devices.map(device => (
            <GlassCard key={device.id} style={styles.card}>
              <View style={styles.row}>
                <View>
                  <Text style={[styles.deviceName, { color: colors.textPrimary }]}>{device.name}</Text>
                  <Text style={[styles.deviceInfo, { color: colors.textSecondary }]}>
                    {device.platform.toUpperCase()} • Last seen {formatDate(device.lastSeenAt)}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: colors.accent + '20' }]}>
                  <Text style={[styles.badgeText, { color: colors.accent }]}>Trusted</Text>
                </View>
              </View>
            </GlassCard>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 20,
  },
  list: {
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  deviceInfo: {
    fontSize: 13,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 16,
    borderStyle: 'dashed',
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 20,
  }
});
