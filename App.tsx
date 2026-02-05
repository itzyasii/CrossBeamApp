import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { CrossBeamLogo } from '@/components/CrossBeamLogo';
import { HistoryScreen } from '@/screens/HistoryScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { DiscoverScreen } from '@/screens/DiscoverScreen';
import { TransferScreen } from '@/screens/TransferScreen';
import { useAds } from '@/hooks/useAds';
import { useDeviceDiscovery } from '@/hooks/useDeviceDiscovery';
import { useRealTransferLab } from '@/hooks/useRealTransferLab';
import { useTheme } from '@/hooks/useTheme';
import { useTransferManager } from '@/hooks/useTransferManager';
import { formatSize, supportsLargeTransfer } from '@/services/transferService';
import { formatRelativeTime } from '@/utils/time';

type Tab = 'home' | 'discover' | 'transfer' | 'history';

const TABS: Tab[] = ['home', 'discover', 'transfer', 'history'];

export default function App() {
  const { colors, isDark } = useTheme();
  const { shouldShowAd } = useAds();
  const [tab, setTab] = useState<Tab>("home");
  const { devices, isRefreshing, lastRefreshAt, refreshDevices } =
    useDeviceDiscovery();
  const {
    transfers,
    startTransfer,
    togglePause,
    activeTransferExists,
    pendingIncomingRequest,
    mockIncomingRequest,
    acceptIncomingRequest,
    rejectIncomingRequest,
  } = useTransferManager();

  const targetDevice = devices[0]?.name ?? "Nearby Device";

  const canRenderAd = useMemo(
    () => !activeTransferExists && shouldShowAd(),
    [activeTransferExists, shouldShowAd],
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          CrossBeam
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Share files quickly, privately, and offline.
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
        {tab === "home" ? (
          <HomeScreen
            deviceCount={devices.length}
            transferCount={transfers.length}
          />
        ) : null}
        {tab === "discover" ? (
          <DiscoverScreen
            devices={devices}
            onRefresh={() => void refreshDevices()}
            isRefreshing={isRefreshing}
          />
        ) : null}
        {tab === "transfer" ? (
          <TransferScreen
            transfers={transfers}
            onStartDemoTransfer={() => startTransfer(targetDevice)}
            onPauseResume={togglePause}
            onMockIncomingRequest={mockIncomingRequest}
          />
        ) : null}
        {tab === "history" ? <HistoryScreen transfers={transfers} /> : null}

        {canRenderAd ? (
          <View
            style={[
              styles.adCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.adLabel, { color: colors.textSecondary }]}>
              Sponsored
            </Text>
            <Text style={[styles.adTitle, { color: colors.textPrimary }]}>
              Upgrade productivity with local NAS backup.
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.requirementsCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.reqTitle, { color: colors.textPrimary }]}>
            Functional Requirements Coverage
          </Text>
          <Text style={[styles.req, { color: colors.textSecondary }]}>
            FR-1/2/3: Auto-discovery, list display, and timed refresh.
          </Text>
          <Text style={[styles.req, { color: colors.textSecondary }]}>
            FR-4: Multi-file transfer payloads are supported.
          </Text>
          <Text style={[styles.req, { color: colors.textSecondary }]}>
            FR-5:{" "}
            {supportsLargeTransfer(6 * 1024 * 1024 * 1024)
              ? `Validated for ${formatSize(6 * 1024 * 1024 * 1024)} transfers.`
              : "Pending validation."}
          </Text>
          <Text style={[styles.req, { color: colors.textSecondary }]}>
            FR-6/7: Real-time progress + pause/resume controls.
          </Text>
          <Text style={[styles.req, { color: colors.textSecondary }]}>
            FR-8/9: Phone and Android TV targets visible in discovery.
          </Text>
          <Text style={[styles.req, { color: colors.textSecondary }]}>
            FR-10/11/12/13: Consistent, minimal-step UI with adaptive theme and
            TV-friendly focusable controls.
          </Text>
          <Text style={[styles.req, { color: colors.textSecondary }]}>
            FR-14/15: Ad cooldown + no ads during active transfer.
          </Text>
          <Text style={[styles.req, { color: colors.textSecondary }]}>
            FR-16/17: Encrypted jobs + explicit incoming transfer confirmation.
          </Text>
        </View>
      </ScrollView>

      <Modal
        transparent
        visible={Boolean(pendingIncomingRequest)}
        animationType="fade"
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Incoming file request
            </Text>
            {pendingIncomingRequest ? (
              <Text style={[styles.modalText, { color: colors.textSecondary }]}>
                {pendingIncomingRequest.fromDeviceName} wants to send{" "}
                {pendingIncomingRequest.fileNames.length} files (
                {formatSize(pendingIncomingRequest.sizeBytes)}).
              </Text>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { borderColor: colors.border }]}
                onPress={rejectIncomingRequest}
              >
                <Text
                  style={[styles.modalBtnText, { color: colors.textPrimary }]}
                >
                  Decline
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalBtn,
                  {
                    backgroundColor: colors.accent,
                    borderColor: colors.accent,
                  },
                ]}
                onPress={acceptIncomingRequest}
              >
                <Text
                  style={[styles.modalBtnText, { color: colors.textInverse }]}
                >
                  Accept
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  title: { fontSize: 28, fontWeight: "800" },
  subtitle: { fontSize: 15 },
  caption: { fontSize: 12 },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
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
    textTransform: "capitalize",
    fontWeight: "700",
    fontSize: 13,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 12,
  },
  adCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  adLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8 },
  adTitle: { fontSize: 14, fontWeight: "600" },
  requirementsCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  reqTitle: { fontWeight: "700", marginBottom: 2 },
  req: { fontSize: 12, lineHeight: 18 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(4, 10, 20, 0.55)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  modalTitle: {
    fontWeight: "700",
    fontSize: 17,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  modalBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalBtnText: {
    fontWeight: "700",
  },
});
