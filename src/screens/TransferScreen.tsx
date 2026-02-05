import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SectionCard } from "@/components/SectionCard";
import { useTheme } from "@/hooks/useTheme";
import { formatSize } from "@/services/transferService";
import { TransferJob } from "@/types/domain";

type TransferScreenProps = {
  transfers: TransferJob[];
  onStartDemoTransfer: () => void;
  onPauseResume: (id: string) => void;
  onMockIncomingRequest: () => void;
  endpoint: string;
  onChangeEndpoint: (value: string) => void;
  downloadUrl: string;
  onChangeDownloadUrl: (value: string) => void;
  onProbeEndpoint: () => void;
  onSendPacket: () => void;
  onRunDownloadTest: () => void;
  isRealTransferRunning: boolean;
  realTransferResult: { kind: 'probe' | 'send' | 'download'; ok: boolean; durationMs: number; details: string } | null;
};

export function TransferScreen({
  transfers,
  onStartDemoTransfer,
  onPauseResume,
  onMockIncomingRequest,
  endpoint,
  onChangeEndpoint,
  downloadUrl,
  onChangeDownloadUrl,
  onProbeEndpoint,
  onSendPacket,
  onRunDownloadTest,
  isRealTransferRunning,
  realTransferResult,
}: TransferScreenProps) {
  const { colors } = useTheme();

  return (
    <SectionCard title="Transfers" subtitle="Encrypted, resumable transfers + real LAN endpoint tests.">
      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: colors.success }]}
          onPress={onStartDemoTransfer}
          accessibilityRole="button"
          focusable
        >
          <Text style={[styles.primaryLabel, { color: colors.textInverse }]}>Send files</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, { borderColor: colors.border }]}
          onPress={onMockIncomingRequest}
          accessibilityRole="button"
          focusable
        >
          <Text style={[styles.secondaryLabel, { color: colors.textPrimary }]}>Simulate receive request</Text>
        </Pressable>
      </View>

      {transfers.map((job) => (
        <View
          key={job.id}
          style={[styles.jobCard, { backgroundColor: colors.surfaceAlt }]}
        >
          <Text style={[styles.fileName, { color: colors.textPrimary }]}>
            {job.fileNames.join(", ")}
          </Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {job.fromDeviceName} → {job.toDeviceName} •{" "}
            {formatSize(job.sizeBytes)}
          </Text>
          <View
            style={[styles.progressTrack, { backgroundColor: colors.border }]}
          >
            <View
              style={[
                styles.progressFill,
                { width: `${job.progress}%`, backgroundColor: colors.accent },
              ]}
            />
          </View>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            Status: {job.status} • {job.progress}%
          </Text>
          <Pressable
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={() => onPauseResume(job.id)}
            accessibilityRole="button"
            focusable
          >
            <Text
              style={[styles.secondaryLabel, { color: colors.textPrimary }]}
            >
              {job.status === "paused" ? "Resume" : "Pause"}
            </Text>
          </Pressable>
        </View>
      ))}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  primaryLabel: {
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  secondaryLabel: {
    fontWeight: "600",
    fontSize: 12,
  },
  jobCard: {
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  fileName: {
    fontWeight: "700",
    fontSize: 14,
  },
  meta: {
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
  },
});
