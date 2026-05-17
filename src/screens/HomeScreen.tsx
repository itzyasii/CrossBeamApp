import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, Pressable, Platform, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Send, History, Settings, Shield, Plus, X, Laptop, Smartphone, Tv } from 'lucide-react-native';
import { GlassCard } from '@/components/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import { FONT_SIZE, RADIUS, SPACING } from '@/theme/colors';
import { haptics } from '@/services/haptics';
import { formatSize } from '@/services/transferService';

const { width: SCREEN_W } = Dimensions.get('window');

type Props = {
  devices: any[];
  transfers: any[];
  selectedFiles: any[];
  onStartDiscovery: () => void;
  onPickFiles: () => void;
  onStartTransfer: () => void;
  onOpenScanner: () => void;
  onGoToTab: (tab: string) => void;
  onClearFiles: () => void;
};

const DeviceIcon = ({ platform }: { platform: string }) => {
  if (platform === 'android-tv') return <Tv size={20} color="#FFF" />;
  if (platform === 'laptop' || platform === 'web') return <Laptop size={20} color="#FFF" />;
  return <Smartphone size={20} color="#FFF" />;
};

export function HomeScreen({
  devices,
  transfers,
  selectedFiles,
  onStartDiscovery,
  onPickFiles,
  onStartTransfer,
  onOpenScanner,
  onGoToTab,
  onClearFiles
}: Props) {
  const { colors, isDark } = useTheme();

  const hasFiles = selectedFiles.length > 0;
  const activeTransfers = transfers.filter(t => t.status === 'in-progress' || t.status === 'queued');

  return (
    <ScrollView style={S.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

      {/* ── Main Action Hub ── */}
      <View style={S.actionHub}>
        <View style={S.mainButtons}>
          <Pressable
            onPress={onPickFiles}
            style={({ pressed }) => [S.bigBtn, { backgroundColor: colors.accent }, pressed && S.pressed]}
          >
            <View style={S.btnIcon}>
              <Plus size={32} color="#FFF" strokeWidth={2.5} />
            </View>
            <Text style={S.btnLabel}>Send Files</Text>
          </Pressable>

          <Pressable
            onPress={onOpenScanner}
            style={({ pressed }) => [S.bigBtn, { backgroundColor: colors.surfaceHover, borderWidth: 1, borderColor: colors.borderStrong }, pressed && S.pressed]}
          >
            <View style={S.btnIcon}>
              <Camera size={32} color={colors.textPrimary} strokeWidth={2} />
            </View>
            <Text style={[S.btnLabel, { color: colors.textPrimary }]}>Scan QR</Text>
          </Pressable>
        </View>

        {hasFiles && (
          <GlassCard animate style={S.selectionCard} accentBorder>
            <View style={S.selectionHeader}>
              <Text style={[S.selectionTitle, { color: colors.textPrimary }]}>
                {selectedFiles.length} item{selectedFiles.length > 1 ? 's' : ''} ready
              </Text>
              <Pressable onPress={onClearFiles}>
                <X size={18} color={colors.error} />
              </Pressable>
            </View>
            <Text style={[S.selectionSub, { color: colors.textSecondary }]}>
              Total size: {formatSize(selectedFiles.reduce((a, b) => a + b.sizeBytes, 0))}
            </Text>
            <Pressable onPress={onStartTransfer} style={[S.sendNowBtn, { backgroundColor: colors.success }]}>
              <Send size={18} color="#FFF" />
              <Text style={S.sendNowText}>Send Now</Text>
            </Pressable>
          </GlassCard>
        )}
      </View>

      {/* ── Quick Discovery ── */}
      <View style={S.section}>
        <View style={S.sectionHeader}>
          <Text style={[S.sectionTitle, { color: colors.textPrimary }]}>Nearby Devices</Text>
          <Pressable onPress={onStartDiscovery}>
            <Text style={[S.actionLink, { color: colors.accent }]}>Refresh</Text>
          </Pressable>
        </View>

        {devices.length === 0 ? (
          <GlassCard style={S.emptyCard}>
            <Text style={[S.emptyText, { color: colors.textSecondary }]}>Looking for devices nearby...</Text>
          </GlassCard>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.deviceList}>
            {devices.map((device) => (
              <Pressable key={device.id} style={S.deviceCard}>
                <View style={[S.deviceAvatar, { backgroundColor: colors.accent }]}>
                  <DeviceIcon platform={device.platform} />
                </View>
                <Text style={[S.deviceName, { color: colors.textPrimary }]} numberOfLines={1}>{device.name}</Text>
                <Text style={[S.deviceStatus, { color: colors.textMuted }]}>{device.isTrusted ? 'Trusted' : 'New'}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Active Work ── */}
      {activeTransfers.length > 0 && (
        <View style={S.section}>
          <Text style={[S.sectionTitle, { color: colors.textPrimary }]}>Active Transfers</Text>
          {activeTransfers.map((job) => (
            <GlassCard key={job.id} style={S.jobCard}>
              <View style={S.jobInfo}>
                <Text style={[S.jobName, { color: colors.textPrimary }]} numberOfLines={1}>{job.fileNames[0]}</Text>
                <Text style={[S.jobProgress, { color: colors.accent }]}>{job.progress}%</Text>
              </View>
              <View style={S.progressTrack}>
                <View style={[S.progressFill, { width: `${job.progress}%`, backgroundColor: colors.accent }]} />
              </View>
            </GlassCard>
          ))}
        </View>
      )}

      {/* ── Quick Links ── */}
      <View style={S.quickLinks}>
        <Pressable onPress={() => onGoToTab('history')} style={S.linkItem}>
          <View style={[S.linkIcon, { backgroundColor: colors.surfaceHover }]}>
            <History size={20} color={colors.textPrimary} />
          </View>
          <Text style={[S.linkLabel, { color: colors.textSecondary }]}>History</Text>
        </Pressable>

        <Pressable onPress={() => onGoToTab('settings')} style={S.linkItem}>
          <View style={[S.linkIcon, { backgroundColor: colors.surfaceHover }]}>
            <Settings size={20} color={colors.textPrimary} />
          </View>
          <Text style={[S.linkLabel, { color: colors.textSecondary }]}>Settings</Text>
        </Pressable>

        <View style={S.linkItem}>
          <View style={[S.linkIcon, { backgroundColor: colors.successMuted }]}>
            <Shield size={20} color={colors.success} />
          </View>
          <Text style={[S.linkLabel, { color: colors.textSecondary }]}>Secure</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, paddingTop: SPACING.md },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },

  actionHub: { gap: SPACING.md, marginBottom: SPACING.xl },
  mainButtons: { flexDirection: 'row', gap: SPACING.md },
  bigBtn: { flex: 1, height: 140, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center', gap: 12 },
  btnIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  btnLabel: { fontSize: 16, fontWeight: '800', color: '#FFF' },

  selectionCard: { gap: 8 },
  selectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectionTitle: { fontSize: 16, fontWeight: '800' },
  selectionSub: { fontSize: 13, fontWeight: '600' },
  sendNowBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: RADIUS.md, marginTop: 8 },
  sendNowText: { color: '#FFF', fontWeight: '800', fontSize: 15 },

  section: { gap: SPACING.md, marginBottom: SPACING.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  actionLink: { fontSize: 14, fontWeight: '700' },

  emptyCard: { height: 100, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed' },
  emptyText: { fontSize: 14, fontWeight: '600' },

  deviceList: { marginHorizontal: -SPACING.xl, paddingHorizontal: SPACING.xl },
  deviceCard: { width: 100, alignItems: 'center', gap: 6, marginRight: SPACING.md },
  deviceAvatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  deviceName: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  deviceStatus: { fontSize: 11, fontWeight: '600' },

  jobCard: { gap: 8, marginBottom: SPACING.sm },
  jobInfo: { flexDirection: 'row', justifyContent: 'space-between' },
  jobName: { fontSize: 14, fontWeight: '700', flex: 1 },
  jobProgress: { fontSize: 14, fontWeight: '800' },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },

  quickLinks: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: SPACING.md },
  linkItem: { alignItems: 'center', gap: 8 },
  linkIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  linkLabel: { fontSize: 11, fontWeight: '700' },
});
