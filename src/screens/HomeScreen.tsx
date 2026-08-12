import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  Camera,
  History,
  Laptop,
  Plus,
  Radio,
  RefreshCcw,
  Send,
  Settings,
  Shield,
  Smartphone,
  Tv,
  X,
} from "lucide-react-native";

import { FocusablePressable } from "@/components/FocusablePressable";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { formatSize } from "@/services/transferService";
import { RADIUS, SPACING } from "@/theme/colors";
import { Device, SelectedFile, TransferJob } from "@/types/domain";
import { getRuntimePlatformLabel } from "@/utils/platform";
import { IncomingApprovalRequest } from "@/services/platformFeatureService";

type Props = {
  devices: Device[];
  transfers: TransferJob[];
  transferError?: string | null;
  selectedFiles: SelectedFile[];
  onStartDiscovery: () => void;
  onPickFiles: () => void;
  onStartTransfer: (deviceId?: string) => void;
  onOpenScanner: () => void;
  onGoToTab: (tab: string) => void;
  onClearFiles: () => void;
  transferStatus?: string | null;
  isSending?: boolean;
  statusMessage?: string;
  isRefreshing?: boolean;
  discoveryEnabled?: boolean;
  approvals?: IncomingApprovalRequest[];
  onApprovalAction?: (
    id: string,
    action: "accepted" | "rejected" | "trusted",
  ) => void;
  onCreateClipboardBeam?: (text: string) => void;
  onSaveCollection?: () => void;
  receiverDeviceName?: string;
};

const DeviceIcon = ({ platform }: { platform: string }) => {
  if (platform === "android-tv") return <Tv size={20} color="#FFF" />;
  if (platform === "laptop" || platform === "web") {
    return <Laptop size={20} color="#FFF" />;
  }
  return <Smartphone size={20} color="#FFF" />;
};

export function HomeScreen({
  devices,
  transfers,
  transferError,
  transferStatus,
  isSending,
  selectedFiles,
  onStartDiscovery,
  onPickFiles,
  onStartTransfer,
  onOpenScanner,
  onGoToTab,
  onClearFiles,
  statusMessage,
  isRefreshing,
  discoveryEnabled = false,
  approvals = [],
  onApprovalAction,
  receiverDeviceName = "Android TV",
}: Props) {
  const { colors } = useTheme();
  const hasFiles = selectedFiles.length > 0;
  const activeTransfers = transfers.filter(
    (t) => t.status === "in-progress" || t.status === "queued",
  );
  const totalSelectedBytes = selectedFiles.reduce(
    (total, file) => total + file.sizeBytes,
    0,
  );
  const discoveryActionLabel = isRefreshing
    ? "Finding devices"
    : discoveryEnabled
      ? "Refresh"
      : "Find devices";

  return (
    <ScrollView
      style={S.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      {Platform.isTV && (
        <GlassCard style={S.tvStatusCard} accentBorder>
          <View style={S.tvStatusRow}>
            <View style={S.pulseContainer}>
              <View style={[S.pulseDot, { backgroundColor: colors.success }]} />
              <View style={[S.pulseRing, { borderColor: colors.success }]} />
            </View>
            <View style={S.tvStatusCopy}>
              <Text style={[S.tvStatusTitle, { color: colors.textPrimary }]}>
                Ready to Receive
              </Text>
              <Text style={[S.tvStatusSub, { color: colors.textSecondary }]}>
                Visible nearby as "{receiverDeviceName}"
              </Text>
            </View>
          </View>
        </GlassCard>
      )}

      <View style={S.actionHub}>
        <View style={S.mainButtons}>
          {!Platform.isTV && (
            <FocusablePressable
              onPress={onPickFiles}
              style={[S.bigBtn, { backgroundColor: colors.accent }]}
            >
              <View style={S.btnIcon}>
                <Plus size={32} color="#FFF" strokeWidth={2.5} />
              </View>
              <Text style={S.btnLabel}>Send Files</Text>
            </FocusablePressable>
          )}

          <FocusablePressable
            onPress={onOpenScanner}
            style={[
              S.bigBtn,
              {
                backgroundColor: colors.surfaceHover,
                borderWidth: 1,
                borderColor: colors.borderStrong,
              },
              Platform.isTV && { display: "none" },
            ]}
          >
            <View style={S.btnIcon}>
              <Camera size={32} color={colors.textPrimary} strokeWidth={2} />
            </View>
            <Text style={[S.btnLabel, { color: colors.textPrimary }]}>
              Scan code
            </Text>
          </FocusablePressable>
        </View>

        {hasFiles && !Platform.isTV && (
          <GlassCard animate style={S.selectionCard} accentBorder>
            <View style={S.selectionHeader}>
              <Text style={[S.selectionTitle, { color: colors.textPrimary }]}>
                {selectedFiles.length} item{selectedFiles.length > 1 ? "s" : ""}{" "}
                ready
              </Text>
              <FocusablePressable onPress={onClearFiles}>
                <X size={18} color={colors.error} />
              </FocusablePressable>
            </View>
            <Text style={[S.selectionSub, { color: colors.textSecondary }]}>
              Total size: {formatSize(totalSelectedBytes)}
            </Text>
            <FocusablePressable
              onPress={() => onStartTransfer()}
              style={[
                S.sendNowBtn,
                { backgroundColor: colors.success },
                isSending && { opacity: 0.75 },
              ]}
            >
              <Send size={18} color="#FFF" />
              <Text style={S.sendNowText}>
                {isSending ? "Sending..." : "Send Now"}
              </Text>
            </FocusablePressable>
          </GlassCard>
        )}

        {transferStatus && !transferError && (
          <GlassCard style={S.transferStatusCard} accentBorder>
            <Text style={[S.transferStatusText, { color: colors.accent }]}>
              {transferStatus}
            </Text>
          </GlassCard>
        )}

        {transferError && (
          <GlassCard style={S.transferErrorCard}>
            <Text style={[S.transferErrorText, { color: colors.warning }]}>
              {transferError}
            </Text>
          </GlassCard>
        )}
      </View>

      <GlassCard style={S.platformCard}>
        <View style={S.platformHeader}>
          <View
            style={[
              S.platformIcon,
              { backgroundColor: colors.accentHighlight },
            ]}
          >
            <Radio size={20} color={colors.accent} strokeWidth={2.4} />
          </View>
          <View style={S.platformCopy}>
            <Text style={[S.platformTitle, { color: colors.textPrimary }]}>
              This device
            </Text>
            <Text style={[S.platformSub, { color: colors.textSecondary }]}>
              Your {getRuntimePlatformLabel()}
            </Text>
            <Text
              style={[S.platformSub, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {statusMessage || "Ready to send and receive files."}
            </Text>
          </View>
        </View>

        <View style={S.discoveryActions}>
          <FocusablePressable
            onPress={onStartDiscovery}
            style={[
              S.discoveryPrimary,
              {
                backgroundColor: discoveryEnabled
                  ? colors.surfaceHover
                  : colors.accent,
                borderColor: discoveryEnabled
                  ? colors.borderStrong
                  : colors.accent,
              },
            ]}
          >
            <RefreshCcw
              size={17}
              color={discoveryEnabled ? colors.textPrimary : "#FFFFFF"}
              strokeWidth={2.4}
            />
            <Text
              style={[
                S.discoveryPrimaryText,
                { color: discoveryEnabled ? colors.textPrimary : "#FFFFFF" },
              ]}
            >
              {discoveryActionLabel}
            </Text>
          </FocusablePressable>
          <FocusablePressable
            onPress={() => onGoToTab("discover")}
            style={[S.discoverySecondary, { borderColor: colors.borderStrong }]}
          >
            <Radio size={16} color={colors.accentLight} strokeWidth={2.3} />
            <Text
              style={[
                S.discoverySecondaryText,
                { color: colors.textSecondary },
              ]}
            >
              Find devices
            </Text>
          </FocusablePressable>
        </View>
      </GlassCard>

      {approvals.length > 0 && (
        <View style={S.section}>
          <Text style={[S.sectionTitle, { color: colors.textPrimary }]}>
            Waiting for your approval
          </Text>
          {approvals.map((approval) => {
            const pending = approval.status === "pending";
            return (
              <GlassCard
                key={approval.id}
                style={S.approvalCard}
                accentBorder={pending}
              >
                <View style={S.approvalTop}>
                  <View style={S.approvalCopy}>
                    <Text
                      style={[S.approvalTitle, { color: colors.textPrimary }]}
                    >
                      {approval.fromDevice.name}
                    </Text>
                    <Text
                      style={[S.approvalMeta, { color: colors.textSecondary }]}
                    >
                      {approval.fileNames.join(", ")} -{" "}
                      {formatSize(approval.sizeBytes)}
                    </Text>
                    <Text
                      style={[
                        S.approvalStorage,
                        {
                          color:
                            approval.storageOk === false
                              ? colors.error
                              : colors.success,
                        },
                      ]}
                    >
                      {approval.storageOk === false
                        ? "Storage check: Not enough free space"
                        : "Storage check: Space looks OK"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      S.approvalStatus,
                      { color: pending ? colors.warning : colors.success },
                    ]}
                  >
                    {approval.status}
                  </Text>
                </View>
                {pending && (
                  <View style={S.approvalActions}>
                    <FocusablePressable
                      onPress={() =>
                        onApprovalAction?.(approval.id, "accepted")
                      }
                      style={[
                        S.approvalBtn,
                        { backgroundColor: colors.success },
                      ]}
                    >
                      <Text style={S.approvalBtnText}>Accept</Text>
                    </FocusablePressable>
                    {approval.fromDevice.deviceKey && (
                      <FocusablePressable
                        onPress={() =>
                          onApprovalAction?.(approval.id, "trusted")
                        }
                        style={[
                          S.approvalBtn,
                          { backgroundColor: colors.accent },
                        ]}
                      >
                        <Text style={S.approvalBtnText}>Always trust</Text>
                      </FocusablePressable>
                    )}
                    <FocusablePressable
                      onPress={() =>
                        onApprovalAction?.(approval.id, "rejected")
                      }
                      style={[S.approvalBtn, { backgroundColor: colors.error }]}
                    >
                      <Text style={S.approvalBtnText}>Reject</Text>
                    </FocusablePressable>
                  </View>
                )}
              </GlassCard>
            );
          })}
        </View>
      )}

      <View style={S.section}>
        <View style={S.sectionHeader}>
          <Text style={[S.sectionTitle, { color: colors.textPrimary }]}>
            Nearby Devices
          </Text>
          <FocusablePressable onPress={onStartDiscovery}>
            <Text style={[S.actionLink, { color: colors.accent }]}>
              {isRefreshing
                ? "Refreshing"
                : discoveryEnabled
                  ? "Refresh"
                  : "Start Scanning"}
            </Text>
          </FocusablePressable>
        </View>

        {devices.length === 0 ? (
          <GlassCard style={S.emptyCard}>
            <View style={S.emptyContent}>
              <Text style={[S.emptyText, { color: colors.textSecondary }]}>
                {discoveryEnabled
                  ? "Finding nearby devices..."
                  : "Finding devices is paused."}
              </Text>
              {!discoveryEnabled && (
                <FocusablePressable
                  onPress={onStartDiscovery}
                  style={[S.emptyButton, { backgroundColor: colors.accent }]}
                >
                  <RefreshCcw size={14} color="#FFFFFF" strokeWidth={4} />
                  <Text style={S.emptyButtonText}>Find devices</Text>
                </FocusablePressable>
              )}
            </View>
          </GlassCard>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={S.deviceList}
          >
            {devices.map((device) => (
              <FocusablePressable
                key={device.id}
                onPress={() => onStartTransfer(device.id)}
                style={S.deviceCard}
              >
                <View
                  style={[S.deviceAvatar, { backgroundColor: colors.accent }]}
                >
                  <DeviceIcon platform={device.platform} />
                </View>
                <Text
                  style={[S.deviceName, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {device.name}
                </Text>
                <Text style={[S.deviceStatus, { color: colors.textMuted }]}>
                  {device.statusMessage ??
                    (device.isTransferReady
                      ? "Ready"
                      : device.availability === "connecting"
                        ? "Connecting"
                        : device.connection === "wifi-direct"
                          ? "Tap to connect"
                          : "Discovery only")}
                </Text>
              </FocusablePressable>
            ))}
          </ScrollView>
        )}
      </View>

      {activeTransfers.length > 0 && (
        <View style={S.section}>
          <Text style={[S.sectionTitle, { color: colors.textPrimary }]}>
            Active Transfers
          </Text>
          {activeTransfers.map((job) => (
            <GlassCard key={job.id} style={S.jobCard}>
              <View style={S.jobInfo}>
                <Text
                  style={[S.jobName, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {job.fileNames[0]}
                </Text>
                <Text style={[S.jobProgress, { color: colors.accent }]}>
                  {job.progress}%
                </Text>
              </View>
              <View style={S.progressTrack}>
                <View
                  style={[
                    S.progressFill,
                    {
                      width: `${job.progress}%`,
                      backgroundColor: colors.accent,
                    },
                  ]}
                />
              </View>
            </GlassCard>
          ))}
        </View>
      )}

      <View style={S.quickLinks}>
        <FocusablePressable
          onPress={() => onGoToTab("history")}
          style={S.linkItem}
        >
          <View style={[S.linkIcon, { backgroundColor: colors.surfaceHover }]}>
            <History size={20} color={colors.textPrimary} />
          </View>
          <Text style={[S.linkLabel, { color: colors.textSecondary }]}>
            History
          </Text>
        </FocusablePressable>

        <FocusablePressable
          onPress={() => onGoToTab("settings")}
          style={S.linkItem}
        >
          <View style={[S.linkIcon, { backgroundColor: colors.surfaceHover }]}>
            <Settings size={20} color={colors.textPrimary} />
          </View>
          <Text style={[S.linkLabel, { color: colors.textSecondary }]}>
            Settings
          </Text>
        </FocusablePressable>

        <View style={S.linkItem}>
          <View style={[S.linkIcon, { backgroundColor: colors.successMuted }]}>
            <Shield size={20} color={colors.success} />
          </View>
          <Text style={[S.linkLabel, { color: colors.textSecondary }]}>
            Secure
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, paddingTop: SPACING.md },

  tvStatusCard: { marginBottom: SPACING.xl, paddingVertical: SPACING.lg },
  tvStatusRow: { flexDirection: "row", alignItems: "center", gap: SPACING.lg },
  tvStatusCopy: { flex: 1 },
  tvStatusTitle: { fontSize: 20, fontWeight: "900" },
  tvStatusSub: { fontSize: 14, fontWeight: "600", marginTop: 4 },
  pulseContainer: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseDot: { width: 12, height: 12, borderRadius: 6 },
  pulseRing: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    opacity: 0.5,
  },

  platformCard: { gap: SPACING.md, marginBottom: SPACING.xl },
  platformHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  platformIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  platformCopy: { flex: 1, gap: 3 },
  platformTitle: { fontSize: 16, fontWeight: "900" },
  platformSub: { fontSize: 12, lineHeight: 17, fontWeight: "600" },
  livePill: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  livePillText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  capabilityRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  capabilityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  capabilityText: { fontSize: 11, fontWeight: "800" },
  discoveryActions: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  discoveryPrimary: {
    minHeight: 46,
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
  },
  discoveryPrimaryText: { fontSize: 13, fontWeight: "900" },
  discoverySecondary: {
    minHeight: 46,
    minWidth: 130,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
  },
  discoverySecondaryText: { fontSize: 13, fontWeight: "900" },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  brandLabel: { fontSize: 15, fontWeight: "900" },

  actionHub: { gap: SPACING.md, marginBottom: SPACING.xl },
  mainButtons: { flexDirection: "row", gap: SPACING.md },
  bigBtn: {
    flex: 1,
    height: 140,
    borderRadius: RADIUS.lg,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  btnIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  btnLabel: { fontSize: 16, fontWeight: "800", color: "#FFF" },

  selectionCard: { gap: 8 },
  selectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectionTitle: { fontSize: 16, fontWeight: "800" },
  selectionSub: { fontSize: 13, fontWeight: "600" },
  sendNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: RADIUS.md,
    marginTop: 8,
  },
  sendNowText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  saveCollectionBtn: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  saveCollectionText: { fontSize: 13, fontWeight: "800" },
  transferStatusCard: {
    paddingVertical: SPACING.md,
  },
  transferStatusText: {
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 18,
  },
  transferErrorCard: {
    borderStyle: "dashed",
    paddingVertical: SPACING.md,
  },
  transferErrorText: {
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 18,
  },

  clipboardCard: { gap: SPACING.md, marginBottom: SPACING.xl },
  clipboardInputWrap: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    minHeight: 84,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  clipboardInput: {
    minHeight: 60,
    fontSize: 14,
    fontWeight: "600",
    textAlignVertical: "top",
  },
  clipboardBtn: {
    height: 44,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
  },
  clipboardBtnText: { color: "#FFF", fontSize: 13, fontWeight: "900" },

  approvalCard: { gap: SPACING.md },
  approvalTop: { flexDirection: "row", gap: SPACING.md },
  approvalCopy: { flex: 1 },
  approvalTitle: { fontSize: 15, fontWeight: "900" },
  approvalMeta: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  approvalStorage: { fontSize: 11, fontWeight: "800", marginTop: 5 },
  approvalStatus: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  approvalActions: { flexDirection: "row", gap: SPACING.xs, flexWrap: "wrap" },
  approvalBtn: {
    minHeight: 38,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
  },
  approvalBtnText: { color: "#FFF", fontSize: 12, fontWeight: "900" },

  section: { gap: SPACING.md, marginBottom: SPACING.xl },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 18, fontWeight: "900" },
  actionLink: { fontSize: 14, fontWeight: "700" },
  emptyCard: {
    minHeight: 116,
    justifyContent: "center",
    alignItems: "center",
    borderStyle: "dashed",
  },
  emptyContent: { alignItems: "center", gap: SPACING.md },
  emptyText: { fontSize: 14, fontWeight: "600" },
  emptyButton: {
    minHeight: 40,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
  },
  emptyButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },

  deviceList: { marginHorizontal: -SPACING.xl, paddingHorizontal: SPACING.xl },
  deviceCard: {
    width: 100,
    alignItems: "center",
    gap: 6,
    marginRight: SPACING.md,
  },
  deviceAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  deviceName: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  deviceStatus: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },

  jobCard: { gap: 8, marginBottom: SPACING.sm },
  jobInfo: { flexDirection: "row", justifyContent: "space-between" },
  jobName: { fontSize: 14, fontWeight: "700", flex: 1 },
  jobProgress: { fontSize: 14, fontWeight: "800" },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 2 },

  quickLinks: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: SPACING.md,
  },
  linkItem: { alignItems: "center", gap: 8 },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  linkLabel: { fontSize: 11, fontWeight: "700" },
});
