import React from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { FileText, ShieldCheck, X } from "lucide-react-native";

import { LegalSection, LEGAL_LAST_UPDATED } from "@/constants/legal";
import { useTheme } from "@/hooks/useTheme";
import { FocusablePressable } from "@/components/FocusablePressable";

type Props = {
  kind: "privacy" | "terms";
  visible: boolean;
  sections: LegalSection[];
  onClose: () => void;
};

export const LegalDocumentModal = ({
  kind,
  visible,
  sections,
  onClose,
}: Props) => {
  const { colors } = useTheme();
  const title = kind === "privacy" ? "Privacy Policy" : "Terms of Service";
  const Icon = kind === "privacy" ? ShieldCheck : FileText;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <BlurView intensity={80} tint="dark" style={S.overlay}>
        <View
          style={[
            S.card,
            Platform.isTV && S.tvCard,
            {
              backgroundColor: colors.backgroundElevated,
              borderColor: colors.borderStrong,
            },
          ]}
        >
          <View style={S.header}>
            <Icon size={24} color={colors.accent} />
            <View style={S.headerText}>
              <Text style={[S.title, { color: colors.textPrimary }]}>
                {title}
              </Text>
              <Text style={[S.updated, { color: colors.textMuted }]}>
                Last updated {LEGAL_LAST_UPDATED}
              </Text>
            </View>
            <FocusablePressable
              accessibilityRole="button"
              accessibilityLabel={`Close ${title}`}
              onPress={onClose}
              style={S.close}
              focusedStyle={{ borderColor: colors.accent }}
            >
              <X size={24} color={colors.textSecondary} />
            </FocusablePressable>
          </View>

          <ScrollView
            style={S.scroll}
            contentContainerStyle={S.content}
            showsVerticalScrollIndicator
          >
            {sections.map((section) => (
              <View key={section.title} style={S.section}>
                <Text style={[S.sectionTitle, { color: colors.textPrimary }]}>
                  {section.title}
                </Text>
                <Text style={[S.body, { color: colors.textSecondary }]}>
                  {section.body}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </BlurView>
    </Modal>
  );
};

const S = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 720,
    maxHeight: "88%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    gap: 20,
  },
  tvCard: { maxWidth: 980, maxHeight: "82%", padding: 32 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerText: { flex: 1, gap: 4 },
  title: { fontSize: 20, fontWeight: "900", letterSpacing: 0.5 },
  updated: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  close: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flexGrow: 0 },
  content: { paddingBottom: 8, gap: 22 },
  section: { gap: 7 },
  sectionTitle: { fontSize: 15, fontWeight: "900", letterSpacing: 0.4 },
  body: { fontSize: 14, lineHeight: 22, fontWeight: "500" },
});
