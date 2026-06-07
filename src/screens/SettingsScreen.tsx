import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import {
  Activity,
  Bell,
  Database,
  Eye,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  Wifi,
  Palette,
  Moon,
  Sun,
  Monitor,
} from "lucide-react-native";

import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { FocusablePressable } from "@/components/FocusablePressable";
import { FONT_SIZE, RADIUS, SPACING } from "@/theme/colors";
import { StorageService } from "@/utils/storage";
import { clearTransferHistory } from "@/store/database";
import { useAppStore } from "@/store";
import { haptics } from "@/services/haptics";
import {
  DiagnosticsReport,
  platformFeatureService,
} from "@/services/platformFeatureService";
import { formatBytes } from "@/utils/helpers";
import { chunkedTransferService } from "@/services/chunkedTransferService";

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
        <Text style={[S.settingTitle, { color: colors.textPrimary }]}>
          {title}
        </Text>
        <Text style={[S.settingDescription, { color: colors.textSecondary }]}>
          {description}
        </Text>
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
  const { setThemePreference, biometricLockEnabled, setBiometricLock } =
    useAppStore();
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS);
  const [storageBytes, setStorageBytes] = useState(0);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsReport | null>(
    null,
  );
  const chunkPlan = chunkedTransferService.getPlan();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const saved = await StorageService.getSettings();
      const storage = await StorageService.getStorageInfo();
      const report = await platformFeatureService.getDiagnostics();
      if (!mounted) return;
      setSettings({
        notifications: saved.enableNotifications ?? DEFAULTS.notifications,
        autoTransfer: saved.autoTransfer ?? DEFAULTS.autoTransfer,
        useMeteredNetworks:
          saved.enableMeteredNetworks ?? DEFAULTS.useMeteredNetworks,
        requireEncryption:
          (saved as any).requireEncryption ?? DEFAULTS.requireEncryption,
        verifyChecksum:
          (saved as any).verifyChecksum ?? DEFAULTS.verifyChecksum,
      });
      setStorageBytes(storage.used);
      setDiagnostics(report);
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
      "Clear local data?",
      "This removes cached preferences and transfer history from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
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

  const handleThemeChange = (pref: "system" | "light" | "dark") => {
    void haptics.medium();
    void setThemePreference(pref);
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={S.content}
    >
      <View style={S.header}>
        <Text style={[S.title, { color: colors.textPrimary }]}>Settings</Text>
        <Text style={[S.subtitle, { color: colors.textSecondary }]}>
          Choose the settings you want.
        </Text>
      </View>

      <GlassCard animate accentBorder>
        <View style={S.nodeHeader}>
          <View
            style={[S.nodeAvatar, { backgroundColor: colors.accentHighlight }]}
          >
            <ShieldCheck size={30} color={colors.accent} strokeWidth={2.2} />
          </View>
          <View style={S.nodeCopy}>
            <Text style={[S.nodeTitle, { color: colors.textPrimary }]}>
              This Device
            </Text>
            <Text style={[S.nodeMeta, { color: colors.textSecondary }]}>
              Transfers are direct and private
            </Text>
          </View>
          <View
            style={[
              S.statusPill,
              {
                backgroundColor: colors.successMuted,
                borderColor: `${colors.success}55`,
              },
            ]}
          >
            <Text style={[S.statusText, { color: colors.success }]}>
              SECURE
            </Text>
          </View>
        </View>
      </GlassCard>

      {diagnostics && (
        <View style={S.section}>
          <Text style={[S.sectionLabel, { color: colors.textMuted }]}>
            STATUS
          </Text>
          <GlassCard padding={SPACING.md}>
            <View style={S.diagnosticsGrid}>
              {[
                {
                  label: "Platform",
                  value: diagnostics.platform,
                },
                {
                  label: "Native bridge",
                  value: diagnostics.nativeAvailable
                    ? "Available"
                    : "Unavailable",
                },
                {
                  label: "Wi-Fi",
                  value: diagnostics.isWifiConnected ? "Connected" : "Inactive",
                },
                {
                  label: "Free space",
                  value: formatBytes(diagnostics.freeDiskBytes),
                },
                {
                  label: "Chunk size",
                  value: formatBytes(chunkPlan.chunkSizeBytes),
                },
                {
                  label: "Transport",
                  value: chunkPlan.transport,
                },
              ].map((item) => (
                <View key={item.label} style={S.diagnosticItem}>
                  <View
                    style={[
                      S.iconBox,
                      { backgroundColor: colors.surfaceHover },
                    ]}
                  >
                    <Activity
                      size={17}
                      color={colors.accent}
                      strokeWidth={2.4}
                    />
                  </View>
                  <View style={S.settingCopy}>
                    <Text style={[S.footerLabel, { color: colors.textMuted }]}>
                      {item.label}
                    </Text>
                    <Text
                      style={[S.settingTitle, { color: colors.textPrimary }]}
                    >
                      {item.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            {diagnostics.blockedPermissions.length > 0 && (
              <View style={S.blockedList}>
                {diagnostics.blockedPermissions.map((item) => (
                  <Text
                    key={item}
                    style={[S.blockedText, { color: colors.warning }]}
                  >
                    {item}
                  </Text>
                ))}
              </View>
            )}
          </GlassCard>
        </View>
      )}

      <View style={S.section}>
        <Text style={[S.sectionLabel, { color: colors.textMuted }]}>
          APPEARANCE
        </Text>
        <GlassCard padding={SPACING.md}>
          <View style={S.appearanceRow}>
            <View
              style={[S.iconBox, { backgroundColor: colors.accentHighlight }]}
            >
              <Palette size={18} color={colors.accent} strokeWidth={2.4} />
            </View>
            <View style={S.settingCopy}>
              <Text style={[S.settingTitle, { color: colors.textPrimary }]}>
                Theme
              </Text>
              <Text
                style={[S.settingDescription, { color: colors.textSecondary }]}
              >
                Light, dark or follow system.
              </Text>
            </View>
          </View>
          <View style={S.themeToggleContainer}>
            {[
              { id: "light", icon: Sun, label: "Light" },
              { id: "dark", icon: Moon, label: "Dark" },
              { id: "system", icon: Monitor, label: "System" },
            ].map((t) => {
              const active = themePreference === t.id;
              return (
                <FocusablePressable
                  key={t.id}
                  onPress={() => handleThemeChange(t.id as any)}
                  style={[
                    S.themeOption,
                    {
                      backgroundColor: active
                        ? colors.accent
                        : colors.surfaceHover,
                    },
                    active && { borderColor: colors.accent },
                  ]}
                >
                  <t.icon
                    size={16}
                    color={active ? "#FFFFFF" : colors.textSecondary}
                    strokeWidth={2.5}
                  />
                  <Text
                    style={[
                      S.themeOptionText,
                      { color: active ? "#FFFFFF" : colors.textSecondary },
                    ]}
                  >
                    {t.label}
                  </Text>
                </FocusablePressable>
              );
            })}
          </View>
        </GlassCard>
      </View>

      <View style={S.section}>
        <Text style={[S.sectionLabel, { color: colors.textMuted }]}>
          TRANSFERS
        </Text>
        <GlassCard padding={0}>
          <SettingRow
            icon={Bell}
            title="Transfer notifications"
            description="Get a simple alert when files are incoming or sent."
            value={settings.notifications}
            onValueChange={(value) => updateSetting("notifications", value)}
          />
          <View style={[S.divider, { backgroundColor: colors.border }]} />
          <SettingRow
            icon={Smartphone}
            title="Auto-accept trusted devices"
            description="Skip extra steps for devices you already trust."
            value={settings.autoTransfer}
            onValueChange={(value) => updateSetting("autoTransfer", value)}
          />
          <View style={[S.divider, { backgroundColor: colors.border }]} />
          <SettingRow
            icon={Wifi}
            title="Use metered networks"
            description="Allow transfers over cellular or limited Wi-Fi."
            value={settings.useMeteredNetworks}
            onValueChange={(value) =>
              updateSetting("useMeteredNetworks", value)
            }
          />
        </GlassCard>
      </View>

      <View style={S.section}>
        <Text style={[S.sectionLabel, { color: colors.textMuted }]}>
          PRIVACY & SECURITY
        </Text>
        <GlassCard padding={0}>
          <SettingRow
            icon={ShieldCheck}
            title="App lock"
            description="Require fingerprint or face to open the app."
            value={biometricLockEnabled}
            onValueChange={setBiometricLock}
          />
          <View style={[S.divider, { backgroundColor: colors.border }]} />
          <SettingRow
            icon={LockKeyhole}
            title="Secure mode"
            description="Use extra protection for device connections."
            value={settings.requireEncryption}
            onValueChange={(value) => updateSetting("requireEncryption", value)}
          />
          <View style={[S.divider, { backgroundColor: colors.border }]} />
          <SettingRow
            icon={ShieldCheck}
            title="Check transfers"
            description="Make sure files arrive safely."
            value={settings.verifyChecksum}
            onValueChange={(value) => updateSetting("verifyChecksum", value)}
          />
        </GlassCard>
      </View>

      <View style={S.section}>
        <Text style={[S.sectionLabel, { color: colors.textMuted }]}>
          KEEP IT PRIVATE
        </Text>
        <GlassCard padding={0}>
          {[
            "Files move directly between nearby devices without a cloud relay.",
            "Discovery happens locally on your network.",
            "Trusted device settings stay on this device only.",
            "Transfer history and settings stay private here.",
          ].map((line) => (
            <View key={line} style={S.auditRow}>
              <View
                style={[S.iconBox, { backgroundColor: colors.successMuted }]}
              >
                <Eye size={17} color={colors.success} strokeWidth={2.4} />
              </View>
              <Text style={[S.auditText, { color: colors.textSecondary }]}>
                {line}
              </Text>
            </View>
          ))}
        </GlassCard>
      </View>

      <GlassCard>
        <View style={S.dataRow}>
          <View style={[S.iconBox, { backgroundColor: colors.warningMuted }]}>
            <Database size={18} color={colors.warning} strokeWidth={2.4} />
          </View>
          <View style={S.settingCopy}>
            <Text style={[S.settingTitle, { color: colors.textPrimary }]}>
              Local cache
            </Text>
            <Text
              style={[S.settingDescription, { color: colors.textSecondary }]}
            >
              Approx. {Math.max(1, Math.ceil(storageBytes / 1024))} KB stored on
              this device.
            </Text>
          </View>
          <FocusablePressable
            onPress={clearLocalData}
            style={[S.clearButton, { borderColor: `${colors.error}55` }]}
          >
            <Text style={[S.clearButtonText, { color: colors.error }]}>
              Clear
            </Text>
          </FocusablePressable>
        </View>
      </GlassCard>

      <Text style={[S.footer, { color: colors.textMuted }]}>
        CrossBeam · Private · Local · Fast
      </Text>
    </ScrollView>
  );
};

const S = StyleSheet.create({
  content: { gap: SPACING.lg, paddingBottom: SPACING.xl },
  header: { gap: SPACING.xs },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: "900", letterSpacing: -1 },
  subtitle: { fontSize: FONT_SIZE.sm, lineHeight: 20, fontWeight: "500" },
  nodeHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  nodeAvatar: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeCopy: { flex: 1 },
  nodeTitle: { fontSize: FONT_SIZE.lg, fontWeight: "800" },
  nodeMeta: { fontSize: FONT_SIZE.sm, marginTop: 3, fontWeight: "500" },
  statusPill: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: "800", letterSpacing: 0.8 },
  section: { gap: SPACING.md },
  sectionLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginLeft: 4,
  },
  settingRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  settingCopy: { flex: 1, gap: 2 },
  settingTitle: { fontSize: FONT_SIZE.base, fontWeight: "800" },
  settingDescription: {
    fontSize: FONT_SIZE.sm,
    lineHeight: 18,
    fontWeight: "500",
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 68 },
  dataRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  clearButton: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  clearButtonText: { fontSize: FONT_SIZE.sm, fontWeight: "800" },
  footer: {
    textAlign: "center",
    fontSize: FONT_SIZE.xs,
    paddingVertical: SPACING.sm,
    fontWeight: "600",
  },
  diagnosticsGrid: { padding: SPACING.md, gap: SPACING.sm },
  diagnosticItem: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  capabilityWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    padding: SPACING.md,
  },
  capabilityPill: {
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    fontSize: FONT_SIZE.xs,
    fontWeight: "800",
  },
  blockedList: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: 4,
  },
  blockedText: { fontSize: FONT_SIZE.xs, fontWeight: "800" },
  auditRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  auditText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    lineHeight: 19,
    fontWeight: "600",
  },
  protocolGrid: { gap: SPACING.sm },
  protocolItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  footerLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  footerValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: "800",
    textAlign: "right",
  },

  appearanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  themeToggleContainer: { flexDirection: "row", gap: SPACING.sm },
  themeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "transparent",
  },
  themeOptionText: { fontSize: 13, fontWeight: "800" },
});
