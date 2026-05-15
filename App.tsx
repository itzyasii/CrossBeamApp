import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { HistoryScreen } from '@/screens/HistoryScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { DiscoverScreen } from '@/screens/DiscoverScreen';
import { TransferScreen } from '@/screens/TransferScreen';
import { useDeviceDiscovery } from '@/hooks/useDeviceDiscovery';
import { useTheme } from '@/hooks/useTheme';
import { useTransferManager } from '@/hooks/useTransferManager';
import { formatRelativeTime } from '@/utils/time';

type Tab = 'home' | 'discover' | 'transfer' | 'history';

const TABS: Tab[] = ['home', 'discover', 'transfer', 'history'];

export default function App() {
  const { colors, isDark } = useTheme();
  const [tab, setTab] = useState<Tab>('home');
  const { devices, isRefreshing, lastRefreshAt, statusMessage, refreshDevices } =
    useDeviceDiscovery();
  const {
    transfers,
    selectedFiles,
    transferError,
    pickFiles,
    clearSelectedFiles,
    startTransfer,
    togglePause,
  } = useTransferManager();

  const targetDevice = devices[0] ?? null;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          CrossBeam
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Private, local file sharing for phones and Android TV.
        </Text>
        <Text style={[styles.caption, { color: colors.textSecondary }]}>
          Last discovery refresh: {formatRelativeTime(lastRefreshAt)}
        </Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((item) => {
          const selected = tab === item;
          return (
            <Pressable
              key={item}
              onPress={() => setTab(item)}
              style={[
                styles.tab,
                {
                  backgroundColor: selected ? colors.accent : colors.surface,
                  borderColor: colors.border,
                },
              ]}
              accessibilityRole="button"
              focusable
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: selected ? colors.textInverse : colors.textPrimary },
                ]}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'home' ? (
          <HomeScreen
            deviceCount={devices.length}
            transferCount={transfers.length}
            discoveryStatus={statusMessage}
          />
        ) : null}
        {tab === 'discover' ? (
          <DiscoverScreen
            devices={devices}
            onRefresh={() => void refreshDevices()}
            isRefreshing={isRefreshing}
            statusMessage={statusMessage}
          />
        ) : null}
        {tab === 'transfer' ? (
          <TransferScreen
            transfers={transfers}
            selectedFiles={selectedFiles}
            transferError={transferError}
            onPickFiles={() => void pickFiles()}
            onClearSelectedFiles={clearSelectedFiles}
            onStartTransfer={() =>
              void startTransfer(targetDevice?.id ?? null, targetDevice?.name ?? 'No peer selected')
            }
            onPauseResume={togglePause}
          />
        ) : null}
        {tab === 'history' ? <HistoryScreen transfers={transfers} /> : null}

        <View
          style={[
            styles.statusCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>
            Production Readiness
          </Text>
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            This build is ad-free and no longer fabricates nearby devices,
            incoming requests, or transfer progress.
          </Text>
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            Real file selection is enabled. Real peer discovery, secure pairing,
            streaming transfer, foreground service, and iOS Multipeer
            Connectivity require native adapters.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 4,
  },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 15 },
  caption: { fontSize: 12 },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabLabel: {
    textTransform: 'capitalize',
    fontWeight: '700',
    fontSize: 13,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 12,
  },
  statusCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  statusTitle: { fontWeight: '700', marginBottom: 2 },
  statusText: { fontSize: 12, lineHeight: 18 },
});
