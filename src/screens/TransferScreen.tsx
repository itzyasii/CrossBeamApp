import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import { useTheme } from '@/hooks/useTheme';
import { formatSize } from '@/services/transferService';
import { TransferJob } from '@/types/domain';

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
        <View key={job.id} style={[styles.jobCard, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.fileName, { color: colors.textPrimary }]}>{job.fileNames.join(', ')}</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}> 
            {job.fromDeviceName} → {job.toDeviceName} • {formatSize(job.sizeBytes)}
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${job.progress}%`, backgroundColor: colors.accent }]} />
          </View>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>Status: {job.status} • {job.progress}%</Text>
          <Pressable
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={() => onPauseResume(job.id)}
            accessibilityRole="button"
            focusable
          >
            <Text style={[styles.secondaryLabel, { color: colors.textPrimary }]}>
              {job.status === 'paused' ? 'Resume' : 'Pause'}
            </Text>
          </Pressable>
        </View>
      ))}

      <View style={[styles.realLabCard, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}> 
        <Text style={[styles.realLabTitle, { color: colors.textPrimary }]}>Real network test lab</Text>
        <Text style={[styles.realLabText, { color: colors.textSecondary }]}>Use another device on the same LAN exposing an HTTP endpoint to validate real packet send/receive and download throughput.</Text>

        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
          value={endpoint}
          onChangeText={onChangeEndpoint}
          placeholder="Receiver endpoint (e.g. http://192.168.1.10:8080)"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
          value={downloadUrl}
          onChangeText={onChangeDownloadUrl}
          placeholder="Download test URL"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.actionsRow}>
          <Pressable style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={onProbeEndpoint}>
            <Text style={[styles.secondaryLabel, { color: colors.textPrimary }]}>Probe endpoint</Text>
          </Pressable>
          <Pressable style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={onSendPacket}>
            <Text style={[styles.secondaryLabel, { color: colors.textPrimary }]}>Send test packet</Text>
          </Pressable>
          <Pressable style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={onRunDownloadTest}>
            <Text style={[styles.secondaryLabel, { color: colors.textPrimary }]}>Run download test</Text>
          </Pressable>
        </View>

        <Text style={[styles.realLabText, { color: colors.textSecondary }]}>Status: {isRealTransferRunning ? 'Running…' : 'Idle'}</Text>
        {realTransferResult ? (
          <Text style={[styles.realLabText, { color: realTransferResult.ok ? colors.success : colors.danger }]}> 
            {realTransferResult.kind.toUpperCase()} • {realTransferResult.durationMs}ms • {realTransferResult.details}
          </Text>
        ) : null}
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  primaryLabel: {
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  secondaryLabel: {
    fontWeight: '600',
    fontSize: 12,
  },
  jobCard: {
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  fileName: {
    fontWeight: '700',
    fontSize: 14,
  },
  meta: {
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  realLabCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  realLabTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  realLabText: {
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
});
