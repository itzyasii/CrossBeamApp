import React, { useState } from 'react';
import {
  Platform,
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
import { AnalyticsScreen } from '@/screens/AnalyticsScreen';
import { DevicesScreen } from '@/screens/DevicesScreen';
import { useDeviceDiscovery } from '@/hooks/useDeviceDiscovery';
import { useTheme } from '@/hooks/useTheme';
import { useTransferManager } from '@/hooks/useTransferManager';
import { useShareIntent } from '@/hooks/useShareIntent';
import { formatRelativeTime } from '@/utils/time';

type Tab = 'home' | 'discover' | 'transfer' | 'history' | 'analytics' | 'devices';

const TABS: Tab[] = ['home', 'discover', 'transfer', 'history', 'analytics', 'devices'];

export default function App() {
  const { colors, isDark } = useTheme();
  const [tab, setTab] = useState<Tab>('home');
  const { devices, isRefreshing, lastRefreshAt, statusMessage, refreshDevices } =
    useDeviceDiscovery();
  const { sharedFiles, setSharedFiles } = useShareIntent();
  const {
    transfers,
    selectedFiles,
    transferError,
    pickFiles,
    clearSelectedFiles,
    startTransfer,
    togglePause,
    cancelTransfer,
    addSelectedFiles,
  } = useTransferManager();

  React.useEffect(() => {
    if (sharedFiles.length > 0) {
      addSelectedFiles(sharedFiles);
      setSharedFiles([]);
      setTab('transfer'); // Auto navigate to transfer screen
    }
  }, [sharedFiles, addSelectedFiles, setSharedFiles]);

  const targetDevice = devices[0] ?? null;
  const isTV = Platform.isTV;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={isTV ? styles.tvLayout : styles.mobileLayout}>
        <View style={isTV ? styles.tvSidebar : undefined}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              CrossBeam
            </Text>
            {!isTV && (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Private, local file sharing for phones and Android TV.
              </Text>
            )}
          </View>

          <View style={isTV ? styles.tvTabs : styles.mobileTabs}>
            {TABS.map((item) => {
              const selected = tab === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setTab(item)}
                  style={[
                    styles.tab,
                    isTV && styles.tvTab,
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
        </View>

        <ScrollView contentContainerStyle={[styles.content, isTV && styles.tvContent]}>
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
              onCancel={(id) => void cancelTransfer(id)}
            />
          ) : null}
          {tab === 'history' ? <HistoryScreen transfers={transfers as any} /> : null}
          {tab === 'analytics' ? <AnalyticsScreen /> : null}
          {tab === 'devices' ? <DevicesScreen /> : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  tvLayout: { flex: 1, flexDirection: 'row' },
  mobileLayout: { flex: 1, flexDirection: 'column' },
  tvSidebar: { width: 250, borderRightWidth: 1, borderColor: '#333', padding: 16 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 4,
    marginBottom: 10,
  },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 15 },
  mobileTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tvTabs: {
    flexDirection: 'column',
    gap: 12,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  tvTab: {
    paddingVertical: 12,
    borderRadius: 12,
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
  tvContent: {
    padding: 32,
  }
});
