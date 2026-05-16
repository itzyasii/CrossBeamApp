/**
 * Settings Screen
 * Screen for app settings and preferences
 */

import React from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { Text, Switch, Divider } from 'react-native-paper';
import { GlassCard } from '@/components/GlassCard';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { StorageService } from '@/utils/storage';

export const SettingsScreen: React.FC = () => {
  const [settings, setSettings] = React.useState({
    notifications: true,
    autoTransfer: false,
    useMeteredNetworks: false,
  });

  const handleSettingChange = (key: string, value: boolean) => {
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);
    void StorageService.updateSettings({
      enableNotifications: updatedSettings.notifications,
      autoTransfer: updatedSettings.autoTransfer,
      enableMeteredNetworks: updatedSettings.useMeteredNetworks,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontWeight: Typography.fontWeight.bold }]}>
          Settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Notifications Section */}
        <GlassCard style={styles.section}>
          <Text style={[styles.sectionTitle, { fontWeight: Typography.fontWeight.semibold }]}>
            Notifications
          </Text>
          <Divider style={styles.divider} />

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Transfer Notifications</Text>
            <Switch
              value={settings.notifications}
              onValueChange={(value) =>
                handleSettingChange('notifications', value)
              }
              color={Colors.success}
            />
          </View>
        </GlassCard>

        {/* Transfer Settings Section */}
        <GlassCard style={styles.section}>
          <Text style={[styles.sectionTitle, { fontWeight: Typography.fontWeight.semibold }]}>
            Transfer
          </Text>
          <Divider style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Auto Transfer</Text>
              <Text style={styles.settingDescription}>
                Automatically accept transfers from paired devices
              </Text>
            </View>
            <Switch
              value={settings.autoTransfer}
              onValueChange={(value) =>
                handleSettingChange('autoTransfer', value)
              }
              color={Colors.success}
            />
          </View>

          <Divider style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Use Metered Networks</Text>
              <Text style={styles.settingDescription}>
                Allow transfers over cellular connections
              </Text>
            </View>
            <Switch
              value={settings.useMeteredNetworks}
              onValueChange={(value) =>
                handleSettingChange('useMeteredNetworks', value)
              }
              color={Colors.success}
            />
          </View>
        </GlassCard>

        {/* About Section */}
        <GlassCard style={styles.section}>
          <Text style={[styles.sectionTitle, { fontWeight: Typography.fontWeight.semibold }]}>
            About
          </Text>
          <Divider style={styles.divider} />

          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>App Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Build Number</Text>
            <Text style={styles.aboutValue}>2026.05.15.001</Text>
          </View>
        </GlassCard>

        {/* Info Text */}
        <Text style={styles.infoText}>
          CrossBeam • Crystal Cross-Platform File Sharing
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    color: Colors.black,
  },
  content: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  section: {
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.base,
    color: Colors.black,
    marginBottom: Spacing.md,
  },
  divider: {
    marginVertical: Spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  settingText: {
    flex: 1,
    marginRight: Spacing.md,
  },
  settingLabel: {
    fontSize: Typography.fontSize.base,
    color: Colors.black,
    fontWeight: Typography.fontWeight.semibold,
  },
  settingDescription: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray[500],
    marginTop: Spacing.xs,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  aboutLabel: {
    fontSize: Typography.fontSize.base,
    color: Colors.black,
  },
  aboutValue: {
    fontSize: Typography.fontSize.base,
    color: Colors.gray[600],
    fontWeight: Typography.fontWeight.semibold,
  },
  infoText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray[400],
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
