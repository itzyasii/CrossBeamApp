import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { GlassCard } from '@/components/GlassCard';
import { getAnalyticsData } from '@/store/database';
import { formatBytes } from '@/utils/helpers';

export function AnalyticsScreen() {
  const { colors } = useTheme();
  const [data, setData] = useState({ totalBytes: 0, totalFiles: 0, totalFailed: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const result = await getAnalyticsData();
      setData(result);
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
      <Text style={[styles.title, { color: colors.textPrimary }]}>Analytics Dashboard</Text>
      
      <View style={styles.grid}>
        <GlassCard style={styles.card}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Total Data Transferred</Text>
          <Text style={[styles.value, { color: colors.textPrimary }]}>{formatBytes(data.totalBytes)}</Text>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Files Sent & Received</Text>
          <Text style={[styles.value, { color: colors.textPrimary }]}>{data.totalFiles}</Text>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Failed Transfers</Text>
          <Text style={[styles.value, { color: colors.error }]}>{data.totalFailed}</Text>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Success Rate</Text>
          <Text style={[styles.value, { color: colors.success }]}>
            {data.totalFiles + data.totalFailed > 0 
                ? Math.round((data.totalFiles / (data.totalFiles + data.totalFailed)) * 100) + '%'
                : '100%'}
          </Text>
        </GlassCard>
      </View>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: {
    width: '47%',
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
