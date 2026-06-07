import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import {
  FileDown,
  ShieldCheck,
  Smartphone,
  X,
  XCircle,
} from "lucide-react-native";

import { useTheme } from "@/hooks/useTheme";
import { FocusablePressable } from "@/components/FocusablePressable";
import { IncomingApprovalRequest } from "@/services/platformFeatureService";
import { formatBytes } from "@/utils/helpers";
import { FONT_SIZE, RADIUS, SPACING } from "@/theme/colors";

type Props = {
  approval: IncomingApprovalRequest | null;
  onAccept: () => void;
  onReject: () => void;
  onTrust: () => void;
};

export function IncomingTransferApprovalModal({
  approval,
  onAccept,
  onReject,
  onTrust,
}: Props) {
  const { colors } = useTheme();

  if (!approval) return null;

  const fileLabel =
    approval.fileNames.length > 1
      ? `${approval.fileNames.length} files`
      : (approval.fileNames[0] ?? "Unknown file");

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={S.overlay}>
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />

        <View
          style={[
            S.modal,
            {
              backgroundColor: colors.backgroundElevated,
              borderColor: colors.borderStrong,
            },
          ]}
        >
          <View style={S.header}>
            <View
              style={[S.iconWrap, { backgroundColor: `${colors.accent}22` }]}
            >
              <FileDown size={24} color={colors.accent} strokeWidth={2.2} />
            </View>
            <View style={S.headerCopy}>
              <Text style={[S.title, { color: colors.textPrimary }]}>
                Incoming Transfer
              </Text>
              <Text style={[S.subtitle, { color: colors.textSecondary }]}>
                A nearby device wants to send files
              </Text>
            </View>
            <Pressable onPress={onReject} style={S.closeBtn} hitSlop={8}>
              <X size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View
            style={[
              S.senderCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                S.senderIcon,
                { backgroundColor: colors.accentHighlight },
              ]}
            >
              <Smartphone
                size={20}
                color={colors.accentLight}
                strokeWidth={2.2}
              />
            </View>
            <View style={S.senderCopy}>
              <Text
                style={[S.senderName, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {approval.fromDevice.name}
              </Text>
              <Text style={[S.senderMeta, { color: colors.textSecondary }]}>
                {fileLabel} · {formatBytes(approval.sizeBytes)}
              </Text>
            </View>
          </View>

          {approval.fileNames.length > 1 && (
            <ScrollView style={S.fileList} nestedScrollEnabled>
              {approval.fileNames.map((fileName) => (
                <Text
                  key={fileName}
                  style={[S.fileItem, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  • {fileName}
                </Text>
              ))}
            </ScrollView>
          )}

          {approval.storageOk === false && (
            <View
              style={[
                S.warningBox,
                {
                  backgroundColor: `${colors.warning}18`,
                  borderColor: `${colors.warning}44`,
                },
              ]}
            >
              <Text style={[S.warningText, { color: colors.warning }]}>
                Low storage — this transfer may fail if you accept.
              </Text>
            </View>
          )}

          <View style={S.actions}>
            <FocusablePressable
              onPress={onAccept}
              style={[S.primaryBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={S.primaryBtnText}>Accept</Text>
            </FocusablePressable>

            <FocusablePressable
              onPress={onTrust}
              style={[
                S.secondaryBtn,
                {
                  backgroundColor: colors.surfaceHover,
                  borderColor: colors.border,
                },
              ]}
            >
              <ShieldCheck size={16} color={colors.success} strokeWidth={2.4} />
              <Text style={[S.secondaryBtnText, { color: colors.textPrimary }]}>
                Always trust
              </Text>
            </FocusablePressable>

            <FocusablePressable
              onPress={onReject}
              style={[
                S.secondaryBtn,
                {
                  backgroundColor: `${colors.error}14`,
                  borderColor: `${colors.error}44`,
                },
              ]}
            >
              <XCircle size={16} color={colors.error} strokeWidth={2.4} />
              <Text style={[S.secondaryBtnText, { color: colors.error }]}>
                Reject
              </Text>
            </FocusablePressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: SPACING.lg,
  },
  modal: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, gap: 4 },
  title: { fontSize: FONT_SIZE.lg, fontWeight: "900" },
  subtitle: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  senderCard: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  senderIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  senderCopy: { flex: 1, minWidth: 0 },
  senderName: { fontSize: FONT_SIZE.base, fontWeight: "800" },
  senderMeta: { fontSize: FONT_SIZE.sm, marginTop: 3 },
  fileList: { maxHeight: 96 },
  fileItem: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  warningBox: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  warningText: { fontSize: FONT_SIZE.sm, fontWeight: "700" },
  actions: { gap: SPACING.sm },
  primaryBtn: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: FONT_SIZE.base,
    fontWeight: "900",
  },
  secondaryBtn: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
  },
  secondaryBtnText: { fontSize: FONT_SIZE.sm, fontWeight: "800" },
});
