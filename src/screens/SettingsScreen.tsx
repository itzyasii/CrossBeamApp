import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Bell, Database, LockKeyhole, ShieldCheck, Smartphone, Wifi, Palette, Moon, Sun, Monitor } from 'lucide-react-native';

import { GlassCard } from '@/components/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import { FONT_SIZE, RADIUS, SPACING } from '@/theme/colors';
import { StorageService } from '@/utils/storage';
import { clearTransferHistory } from '@/store/database';
import { useAppStore } from '@/store';
import { haptics } from '@/services/haptics';

type SettingsState = {
  notifications: boolean;
  autoTransfer: boolean;
  useMeteredNetworks: boolean;
  requireEncryption: boolean;
  verifyChecksum: boolean;
};

const DEFAULTS: SettingsState = {
  notifications: true,
  autoTransfer: false,
  useMeteredNetworks: false,
  requireEncryption: true,
  verifyChecksum: true,
};

const SettingRow = ({
  icon: Icon,
  title,
  description,
  value,
  onValueChange,
  disabled,
}: {
  icon: any;
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) => {
  const { colors } = useTheme();
  return (
    <View style={[S.settingRow, disabled && { opacity: 0.55 }]}>
      <View style={[S.iconBox, { backgroundColor: colors.accentHighlight }]}>
        <Icon size={18} color={colors.accent} strokeWidth={2.4} />
      </View>
      <View style={S.settingCopy}>
        <Text style={[S.settingTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[S.settingDescription, { color: colors.textSecondary }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          void haptics.light();
          onValueChange(v);
        }}
        trackColor={{ false: colors.borderStrong, true: colors.accent }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
};

export const SettingsScreen: React.FC = () => {
  const { colors, themePreference } = useTheme();
  const { setThemePreference, biometricLockEnabled, setBiometricLock } = useAppStore();
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS);
  const [storageBytes, setStorageBytes] = useState(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const saved = await StorageService.getSettings();
      const storage = await StorageService.getStorageInfo();
      if (!mounted) return;
      setSettings({
        notifications: saved.enableNotifications ?? DEFAULTS.notifications,
        autoTransfer: saved.autoTransfer ?? DEFAULTS.autoTransfer,
        useMeteredNetworks: saved.enableMeteredNetworks ?? DEFAULTS.useMeteredNetworks,
        requireEncryption: (saved as any).requireEncryption ?? DEFAULTS.requireEncryption,
        verifyChecksum: (saved as any).verifyChecksum ?? DEFAULTS.verifyChecksum,
      });
      setStorageBytes(storage.used);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const updateSetting = (key: keyof SettingsState, value: boolean) => {
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);
    void StorageService.updateSettings({
      enableNotifications: updatedSettings.notifications,
      autoTransfer: updatedSettings.autoTransfer,
      enableMeteredNetworks: updatedSettings.useMeteredNetworks,
      requireEncryption: updatedSettings.requireEncryption,
      verifyChecksum: updatedSettings.verifyChecksum,
    } as any);
  };

  const clearLocalData = () => {
    void haptics.warning();
    Alert.alert(
      'Clear local data?',
      'This removes cached preferences and transfer history from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            void haptics.error();
            void StorageService.clearAllData();
            void clearTransferHistory();
            setSettings(DEFAULTS);
            setStorageBytes(0);
          },
        },
      ],
    );
  };

  const handleThemeChange = (pref: 'system' | 'light' | 'dark') => {
    void haptics.medium();
    void setThemePreference(pref);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.content}>
      <View style={S.header}>
        <Text style={[S.title, { color: colors.textPrimary }]}>Settings</Text>
        <Text style={[S.subtitle, { color: colors.textSecondary }]}>
          Configure your local node and appearance.
        </Text>
      </View>

      <GlassCard animate accentBorder>
        <View style={S.nodeHeader}>
          <View style={[S.nodeAvatar, { backgroundColor: colors.accentHighlight }]}>
            <ShieldCheck size={30} color={colors.accent} strokeWidth={2.2} />
          </View>
          <View style={S.nodeCopy}>
            <Text style={[S.nodeTitle, { color: colors.textPrimary }]}>Local Node</Text>
            <Text style={[S.nodeMeta, { color: colors.textSecondary }]}>Encrypted by default - no cloud relay</Text>
          </View>
          <View style={[S.statusPill, { backgroundColor: colors.successMuted, borderColor: `${colors.success}55` }]}>
            <Text style={[S.statusText, { color: colors.success }]}>SECURE</Text>
          </View>
        </View>
      </GlassCard>

      <View style={S.section}>
        <Text style={[S.sectionLabel, { color: colors.textMuted }]}>APPEARANCE</Text>
        <GlassCard padding={SPACING.md}>
          <View style={S.appearanceRow}>
            <View style={[S.iconBox, { backgroundColor: colors.accentHighlight }]}>
              <Palette size={18} color={colors.accent} strokeWidth={2.4} />
            </View>
            <View style={S.settingCopy}>
              <Text style={[S.settingTitle, { color: colors.textPrimary }]}>Theme</Text>
              <Text style={[S.settingDescription, { color: colors.textSecondary }]}>Light, dark or follow system.</Text>
            </View>
          </View>
          <View style={S.themeToggleContainer}>
            {[
              { id: 'light', icon: Sun, label: 'Light' },
              { id: 'dark', icon: Moon, label: 'Dark' },
              { id: 'system', icon: Monitor, label: 'System' },
            ].map((t) => {
              const active = themePreference === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => handleThemeChange(t.id as any)}
                  style={[
                    S.themeOption,
                    { backgroundColor: active ? colors.accent : colors.surfaceHover },
                    active && { borderColor: colors.accent },
                  ]}
                >
                  <t.icon size={16} color={active ? '#FFFFFF' : colors.textSecondary} strokeWidth={2.5} />
                  <Text style={[S.themeOptionText, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>
      </View>

      <View style={S.section}>
        <Text style={[S.sectionLabel, { color: colors.textMuted }]}>TRANSFER SETTINGS</Text>
        <GlassCard padding={0}>
          <SettingRow
            icon={Bell}
            title="Transfer notifications"
            description="Alerts for incoming and outgoing beams."
            value={settings.notifications}
            onValueChange={(value) => updateSetting('notifications', value)}
          />
          <View style={[S.divider, { backgroundColor: colors.border }]} />
          <SettingRow
            icon={Smartphone}
            title="Auto-accept trusted devices"
            description="Skip confirmation for paired hardware only."
            value={settings.autoTransfer}
            onValueChange={(value) => updateSetting('autoTransfer', value)}
          />
          <View style={[S.divider, { backgroundColor: colors.border }]} />
          <SettingRow
            icon={Wifi}
            title="Use metered networks"
            description="Allow transfers over cellular or metered Wi-Fi."
            value={settings.useMeteredNetworks}
            onValueChange={(value) => updateSetting('useMeteredNetworks', value)}
          />
        </GlassCard>
      </View>

      <View style={S.section}>
        <Text style={[S.sectionLabel, { color: colors.textMuted }]}>SECURITY & PRIVACY</Text>
        <GlassCard padding={0}>
          <SettingRow
            icon={ShieldCheck}
            title="Biometric Lock"
            description="Require authentication to open the app."
            value={biometricLockEnabled}
            onValueChange={setBiometricLock}
          />
          <View style={[S.divider, { backgroundColor: colors.border }]} />
          <SettingRow
            icon={LockKeyhole}
            title="Require encrypted tunnel"
            description="Block transfers that cannot negotiate E2EE."
            value={settings.requireEncryption}
            onValueChange={(value) => updateSetting('requireEncryption', value)}
          />
          <View style={[S.divider, { backgroundColor: colors.border }]} />
          <SettingRow
            icon={ShieldCheck}
            title="Verify file checksum"
            description="Confirm integrity after each completed transfer."
            value={settings.verifyChecksum}
            onValueChange={(value) => updateSetting('verifyChecksum', value)}
          />
        </GlassCard>
      </View>

      <GlassCard>
        <View style={S.dataRow}>
          <View style={[S.iconBox, { backgroundColor: colors.warningMuted }]}>
            <Database size={18} color={colors.warning} strokeWidth={2.4} />
          </View>
          <View style={S.settingCopy}>
            <Text style={[S.settingTitle, { color: colors.textPrimary }]}>Local cache</Text>
            <Text style={[S.settingDescription, { color: colors.textSecondary }]}>
              Approx. {Math.max(1, Math.ceil(storageBytes / 1024))} KB stored on this device.
            </Text>
          </View>
          <Pressable onPress={clearLocalData} style={[S.clearButton, { borderColor: `${colors.error}55` }]}>
            <Text style={[S.clearButtonText, { color: colors.error }]}>Clear</Text>
          </Pressable>
        </View>
      </GlassCard>

      <Text style={[S.footer, { color: colors.textMuted }]}>CrossBeam 1.0.0 · Private · Local · Fast</Text>
    </ScrollView>
  );
};

const S = StyleSheet.create({
  content: { gap: SPACING.lg, paddingBottom: SPACING.xl },
  header: { gap: SPACING.xs },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: FONT_SIZE.sm, lineHeight: 20, fontWeight: '500' },
  nodeHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  nodeAvatar: { width: 56, height: 56, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
  nodeCopy: { flex: 1 },
  nodeTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800' },
  nodeMeta: { fontSize: FONT_SIZE.sm, marginTop: 3, fontWeight: '500' },
  statusPill: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 5 },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: '800', letterSpacing: 0.8 },
  section: { gap: SPACING.md },
  sectionLabel: { fontSize: FONT_SIZE.xs, fontWeight: '900', letterSpacing: 1.5, marginLeft: 4 },
  settingRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg },
  iconBox: { width: 38, height: 38, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  settingCopy: { flex: 1, gap: 2 },
  settingTitle: { fontSize: FONT_SIZE.base, fontWeight: '800' },
  settingDescription: { fontSize: FONT_SIZE.sm, lineHeight: 18, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 68 },
  dataRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  clearButton: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  clearButtonText: { fontSize: FONT_SIZE.sm, fontWeight: '800' },
  footer: { textAlign: 'center', fontSize: FONT_SIZE.xs, paddingVertical: SPACING.sm, fontWeight: '600' },

  appearanceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  themeToggleContainer: { flexDirection: 'row', gap: SPACING.sm },
  themeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'transparent' },
  themeOptionText: { fontSize: 13, fontWeight: '800' },
});
