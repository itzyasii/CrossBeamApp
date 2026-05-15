/**
 * Transfer History Screen
 * Screen for viewing past file transfers
 */

import React, { useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Text, Divider } from 'react-native-paper';
import { useAppStore } from '@/store';
import { GlassCard } from '@/components/GlassCard';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { formatBytes, formatTime } from '@/utils/helpers';
import { fileTransferService } from '@/services';
import { format } from 'date-fns';

export const TransferHistoryScreen: React.FC = () => {
  const { transferHistory, setTransferHistory } = useAppStore();

  useEffect(() => {
    // Load transfer history on mount
    const loadHistory = async () => {
      const history = await fileTransferService.getTransferHistory();
      if (history.length > 0) {
        setTransferHistory(history);
      }
    };

    loadHistory();
  }, []);

  const handleDeleteHistoryItem = async (historyId: string) => {
    try {
      await fileTransferService.deleteTransferHistory(historyId);
      const updatedHistory = transferHistory.filter((h) => h.id !== historyId);
      setTransferHistory(updatedHistory);
    } catch (error) {
      console.error('Error deleting history item:', error);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return Colors.success;
      case 'failed':
        return Colors.error;
      case 'cancelled':
        return Colors.warning;
      default:
        return Colors.gray[400];
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'failed':
        return '✕';
      case 'cancelled':
        return '⊘';
      default:
        return '○';
    }
  };

  const renderHistoryItem = (item: any) => {
    const { transfer, timestamp, status } = item;
    const transferTime =
      transfer.completedAt && transfer.startedAt
        ? Math.floor(
            (transfer.completedAt.getTime() - transfer.startedAt.getTime()) /
              1000
          )
        : 0;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.historyItem}
        onLongPress={() => handleDeleteHistoryItem(item.id)}
      >
        <GlassCard style={styles.card} elevation="sm">
          <View style={styles.historyHeader}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(status) },
              ]}
            >
              <Text style={styles.statusIcon}>
                {getStatusIcon(status)}
              </Text>
            </View>

            <View style={styles.historyInfo}>
              <Text
                style={[styles.fileName, { fontWeight: Typography.fontWeight.semibold }]}
                numberOfLines={1}
              >
                {transfer.files[0]?.name}
              </Text>
              <Text style={styles.timestamp}>
                {format(new Date(timestamp), 'MMM d, yyyy HH:mm')}
              </Text>
            </View>

            <View style={styles.historyDetails}>
              <Text style={[styles.size, { fontWeight: Typography.fontWeight.semibold }]}>
                {formatBytes(transfer.totalSize)}
              </Text>
              <Text style={styles.duration}>
                {transferTime > 0 ? formatTime(transferTime) : '--'}
              </Text>
            </View>
          </View>

          {transfer.files.length > 1 && (
            <>
              <Divider style={styles.divider} />
              <Text style={styles.filesCount}>
                +{transfer.files.length - 1} more file
                {transfer.files.length - 1 !== 1 ? 's' : ''}
              </Text>
            </>
          )}
        </GlassCard>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={[styles.emptyTitle, { fontWeight: Typography.fontWeight.semibold }]}>
        No Transfer History
      </Text>
      <Text style={styles.emptySubtitle}>
        Completed transfers will appear here
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontWeight: Typography.fontWeight.bold }]}>
          History
        </Text>
        <Text style={styles.subtitle}>
          {transferHistory.length} transfer{transferHistory.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {transferHistory.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={transferHistory}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderHistoryItem(item)}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    color: Colors.black,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.gray[500],
    marginTop: Spacing.xs,
  },
  listContent: {
    paddingVertical: Spacing.md,
  },
  historyItem: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
  },
  card: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  statusIcon: {
    fontSize: 20,
    color: Colors.white,
    fontWeight: Typography.fontWeight.bold,
  },
  historyInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: Typography.fontSize.sm,
    color: Colors.black,
    marginBottom: Spacing.xs,
  },
  timestamp: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray[500],
  },
  historyDetails: {
    alignItems: 'flex-end',
  },
  size: {
    fontSize: Typography.fontSize.sm,
    color: Colors.black,
  },
  duration: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray[500],
    marginTop: Spacing.xs,
  },
  divider: {
    marginVertical: Spacing.sm,
  },
  filesCount: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray[600],
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.lg,
    color: Colors.black,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.gray[600],
    textAlign: 'center',
  },
});
