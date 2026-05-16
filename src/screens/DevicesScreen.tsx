import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Monitor, PlusCircle, ShieldCheck, Smartphone, Trash2, Tv } from 'lucide-react-native';

import { GlassCard } from '@/components/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import { getTrustedDevices, removeTrustedDevice } from '@/store/database';
import { Device } from '@/types/domain';
import { formatDate } from '@/utils/helpers';
import { FONT_SIZE, RADIUS, SPACING } from '@/theme/colors';

const DeviceIcon = ({ platform }: { platform: Device['platform'] }) => {
  const Icon = platform === 'android-tv' ? Tv : platform === 'ios' ? Monitor : Smartphone;
  const { colors } = useTheme();
  return (
    <View style={[S.deviceIcon, { backgroundColor: colors.accentHighlight }]}>
      <Icon size={26} color={colors.accentLight} strokeWidth={2.2} />
    </View>
  );
};

const platformLabel: Record<Device['platform'], string> = {
  android: 'Android',
  ios: 'iOS',
  'android-tv': 'Android TV',
};

type Props = {
  onPairDevice?: () => void;
};

export function DevicesScreen({ onPairDevice }: Props) {
  const { colors } = useTheme();
  const [devices, setDevices] = useState<Device[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      setDevices(await getTrustedDevices());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const confirmRemove = (device: Device) => {
    Alert.alert('Remove trusted device?', `${device.name} will need approval before future transfers.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeTrustedDevice(device.id);
          await loadData();
        },
      },
    ]);
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={S.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.accent} />}
    >
      <View style={S.header}>
        <View style={S.headerCopy}>
          <Text style={[S.title, { color: colors.textPrimary }]}>Trusted Devices</Text>
          <Text style={[S.subtitle, { color: colors.textSecondary }]}>
            Hardware authorized to receive files with fewer prompts.
          </Text>
        </View>
        <Pressable onPress={onPairDevice} style={[S.pairButton, { backgroundColor: colors.accent }]} accessibilityRole="button">
          <PlusCircle size={18} color="#FFFFFF" strokeWidth={2.4} />
          <Text style={S.pairText}>Pair</Text>
        </Pressable>
      </View>

      {devices.length === 0 ? (
        <GlassCard animate accentBorder>
          <View style={S.emptyState}>
            <View style={[S.emptyIcon, { backgroundColor: colors.accentHighlight }]}>
              <ShieldCheck size={34} color={colors.accentLight} strokeWidth={2.2} />
            </View>
            <Text style={[S.emptyTitle, { color: colors.textPrimary }]}>No trusted devices yet</Text>
            <Text style={[S.emptyText, { color: colors.textSecondary }]}>
              Devices become trusted after pairing or after you approve them during transfer.
            </Text>
          </View>
        </GlassCard>
      ) : (
        <View style={S.grid}>
          {devices.map((device, index) => (
            <GlassCard key={device.id} animate={index < 3} style={S.card}>
              <View style={S.cardTop}>
                <DeviceIcon platform={device.platform} />
                <View style={[S.trustedBadge, { backgroundColor: colors.successMuted, borderColor: `${colors.success}55` }]}>
                  <ShieldCheck size={13} color={colors.success} strokeWidth={2.6} />
                  <Text style={[S.trustedText, { color: colors.success }]}>Trusted</Text>
                </View>
              </View>

              <Text style={[S.deviceName, { color: colors.textPrimary }]} numberOfLines={1}>{device.name}</Text>
              <View style={S.metaRow}>
                <Text style={[S.platformPill, { color: colors.textSecondary, backgroundColor: colors.surfaceHover }]}>
                  {platformLabel[device.platform]}
                </Text>
                <Text style={[S.deviceId, { color: colors.textMuted }]} numberOfLines={1}>ID: {device.id.slice(0, 10)}</Text>
              </View>

              <View style={[S.cardFooter, { borderTopColor: colors.border }]}>
                <View>
                  <Text style={[S.footerLabel, { color: colors.textMuted }]}>LAST SEEN</Text>
                  <Text style={[S.footerValue, { color: colors.textPrimary }]}>{formatDate(device.lastSeenAt)}</Text>
                </View>
                <Pressable
                  onPress={() => confirmRemove(device)}
                  hitSlop={8}
                  style={[S.removeButton, { borderColor: `${colors.error}33` }]}
                  accessibilityLabel={`Remove ${device.name}`}
                >
                  <Trash2 size={18} color={colors.error} strokeWidth={2.2} />
                </Pressable>
              </View>
            </GlassCard>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { gap: SPACING.lg, paddingBottom: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: SPACING.md },
  headerCopy: { flex: 1, gap: SPACING.xs },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: '800' },
  subtitle: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  pairButton: { minHeight: 44, borderRadius: RADIUS.md, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md },
  pairText: { color: '#FFFFFF', fontSize: FONT_SIZE.sm, fontWeight: '800' },
  grid: { gap: SPACING.md },
  card: { minHeight: 188 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: SPACING.lg },
  deviceIcon: { width: 54, height: 54, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  trustedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 5 },
  trustedText: { fontSize: FONT_SIZE.xs, fontWeight: '800' },
  deviceName: { fontSize: FONT_SIZE.lg, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  platformPill: { overflow: 'hidden', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3, fontSize: FONT_SIZE.xs, fontWeight: '800' },
  deviceId: { flex: 1, fontSize: FONT_SIZE.xs, fontWeight: '700' },
  cardFooter: { marginTop: SPACING.lg, paddingTop: SPACING.md, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.9 },
  footerValue: { fontSize: FONT_SIZE.sm, fontWeight: '700', marginTop: 3 },
  removeButton: { width: 40, height: 40, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.xxl },
  emptyIcon: { width: 70, height: 70, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', textAlign: 'center' },
  emptyText: { fontSize: FONT_SIZE.sm, lineHeight: 20, textAlign: 'center', maxWidth: 300 },
});
