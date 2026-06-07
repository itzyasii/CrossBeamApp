import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  CheckCircle2,
  Clock3,
  FileText,
  Folder,
  Gauge,
  Search,
  Trash2,
  XCircle,
} from "lucide-react-native";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { FocusablePressable } from "@/components/FocusablePressable";
import { clearTransferHistory, getTransferHistory } from "@/store/database";
import { TransferJob } from "@/types/domain";
import { formatBytes, formatDate } from "@/utils/helpers";
import { FONT_SIZE, RADIUS, SPACING } from "@/theme/colors";
import {
  IntegrityReport,
  platformFeatureService,
  TransferCollection,
} from "@/services/platformFeatureService";

type HistoryScreenProps = {
  transfers: TransferJob[];
};

const statusColor = (
  status: TransferJob["status"],
  colors: ReturnType<typeof useTheme>["colors"],
) => {
  if (status === "completed") return colors.success;
  if (status === "failed" || status === "cancelled" || status === "rejected")
    return colors.error;
  if (status === "blocked" || status === "paused") return colors.warning;
  return colors.accent;
};

const statusIcon = (status: TransferJob["status"]) => {
  if (status === "completed") return CheckCircle2;
  if (status === "failed" || status === "cancelled" || status === "rejected")
    return XCircle;
  return Clock3;
};

export function HistoryScreen({ transfers }: HistoryScreenProps) {
  const { colors } = useTheme();
  const [storedTransfers, setStoredTransfers] = useState<TransferJob[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "sent" | "received">("all");
  const [collections, setCollections] = useState<TransferCollection[]>([]);
  const [reports, setReports] = useState<Record<string, IntegrityReport>>({});

  const loadHistory = useCallback(async () => {
    setRefreshing(true);
    try {
      setStoredTransfers(await getTransferHistory());
      setCollections(await platformFeatureService.getCollections());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, transfers.length]);

  const mergedTransfers = useMemo(() => {
    const byId = new Map<string, TransferJob>();
    [...transfers, ...storedTransfers].forEach((job) => byId.set(job.id, job));
    return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [storedTransfers, transfers]);

  useEffect(() => {
    const syncReports = async () => {
      const completed = mergedTransfers.filter(
        (job) => job.status === "completed",
      );
      const entries = await Promise.all(
        completed.map(
          async (job) =>
            [
              job.id,
              await platformFeatureService.ensureIntegrityReport(job),
            ] as const,
        ),
      );
      setReports(Object.fromEntries(entries));
    };
    if (mergedTransfers.length > 0) void syncReports();
  }, [mergedTransfers]);

  const filteredTransfers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return mergedTransfers.filter((job) => {
      const directionMatches =
        filter === "all" ||
        (filter === "sent" && job.fromDeviceName === "This Device") ||
        (filter === "received" && job.toDeviceName === "This Device");
      const searchMatches =
        normalizedQuery.length === 0 ||
        [
          ...(job.fileNames ?? []),
          job.fileName,
          job.fromDeviceName,
          job.toDeviceName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      return directionMatches && searchMatches;
    });
  }, [filter, mergedTransfers, query]);

  const clearHistory = () => {
    Alert.alert(
      "Clear transfer history?",
      "This only clears local history records. It does not delete files.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await clearTransferHistory();
            await loadHistory();
          },
        },
      ],
    );
  };

  const toFileUri = (path: string): string => {
    if (path.startsWith("file://") || path.startsWith("content://")) {
      return path;
    }
    if (path.startsWith("/")) {
      return `file://${path}`;
    }
    return `file:///storage/emulated/0/${path.replace(/^\/+/, "")}`;
  };

  const handleJobPress = async (job: TransferJob) => {
    if (job.status !== "completed") return;
    try {
      const fileName = job.fileNames?.[0] || job.fileName;
      if (!fileName) return;

      const report = reports[job.id];
      const mimeType = job.mimeType || "";
      const isReceived = job.toDeviceName === "This Device";

      const subfolder =
        mimeType.startsWith("image/")
          ? "Images"
          : mimeType.startsWith("video/")
            ? "Videos"
            : mimeType.startsWith("audio/")
              ? "Audio"
              : mimeType === "application/pdf" ||
                  mimeType.startsWith("text/") ||
                  /word|excel|powerpoint/.test(mimeType)
                ? "Documents"
                : "Others";

      const candidatePaths = [
        ...(job.savedFilePaths ?? []),
        ...(job.localFilePaths ?? []),
        ...(report?.savedPath && !report.savedPath.startsWith("file://")
          ? [report.savedPath]
          : report?.savedPath
            ? [report.savedPath]
            : []),
      ];

      const possibleUris = [
        ...candidatePaths.map(toFileUri),
        ...(isReceived
          ? [
              `file:///storage/emulated/0/Download/CrossBeam/${subfolder}/${fileName}`,
              `file:///storage/emulated/0/Downloads/CrossBeam/${subfolder}/${fileName}`,
              `file:///sdcard/Download/CrossBeam/${subfolder}/${fileName}`,
              `file:///storage/emulated/0/Download/CrossBeam/${fileName}`,
              `file:///storage/emulated/0/Downloads/CrossBeam/${fileName}`,
            ]
          : []),
        `${FileSystem.documentDirectory}CrossBeam/${fileName}`,
        `${FileSystem.cacheDirectory}${fileName}`,
        `${FileSystem.documentDirectory}${fileName}`,
      ];

      let foundUri: string | null = null;
      for (const uri of possibleUris) {
        try {
          const info = await FileSystem.getInfoAsync(uri);
          if (info.exists) {
            foundUri = uri;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!foundUri) {
        Alert.alert(
          "File Unavailable",
          `The file "${fileName}" could not be located on disk. It may have been moved or deleted.`,
        );
        return;
      }

      if (Platform.OS === "android") {
        try {
          const contentUri = await FileSystem.getContentUriAsync(foundUri);
          await Linking.openURL(contentUri);
          return;
        } catch {
          // Fall back to share sheet below.
        }
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(foundUri, {
          mimeType: mimeType || undefined,
        });
      } else {
        await Linking.openURL(foundUri);
      }
    } catch (err) {
      console.warn(err);
      Alert.alert("Error", "Could not open the file.");
    }
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={S.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={loadHistory}
          tintColor={colors.accent}
        />
      }
    >
      <View style={S.header}>
        <View style={S.headerCopy}>
          <Text style={[S.title, { color: colors.textPrimary }]}>
            Transfer History
          </Text>
          <Text style={[S.subtitle, { color: colors.textSecondary }]}>
            Completed, paused, failed, and rejected jobs.
          </Text>
        </View>
        {mergedTransfers.length > 0 && (
          <FocusablePressable
            onPress={clearHistory}
            style={[S.clearButton, { borderColor: `${colors.error}44` }]}
          >
            <Trash2 size={16} color={colors.error} strokeWidth={2.2} />
            <Text style={[S.clearText, { color: colors.error }]}>Clear</Text>
          </FocusablePressable>
        )}
      </View>

      {mergedTransfers.length > 0 && (
        <View style={S.searchArea}>
          <View
            style={[
              S.searchBox,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Search size={18} color={colors.textMuted} strokeWidth={2.3} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search files or devices..."
              placeholderTextColor={colors.textMuted}
              style={[S.searchInput, { color: colors.textPrimary }]}
            />
          </View>
          <View style={S.filterRow}>
            {(["all", "sent", "received"] as const).map((item) => {
              const active = item === filter;
              return (
                <FocusablePressable
                  key={item}
                  onPress={() => setFilter(item)}
                  style={[
                    S.filterChip,
                    {
                      backgroundColor: active
                        ? colors.accent
                        : colors.surfaceHover,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      S.filterText,
                      { color: active ? "#FFFFFF" : colors.textSecondary },
                    ]}
                  >
                    {item}
                  </Text>
                </FocusablePressable>
              );
            })}
          </View>
        </View>
      )}

      {collections.length > 0 && (
        <View style={S.collectionStrip}>
          <Text style={[S.listHeader, { color: colors.textMuted }]}>
            TRANSFER COLLECTIONS
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {collections.map((collection) => (
              <GlassCard
                key={collection.id}
                padding={SPACING.md}
                style={S.collectionCard}
              >
                <View style={S.collectionHead}>
                  <Folder size={18} color={colors.accent} strokeWidth={2.4} />
                  <Text
                    style={[S.collectionName, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {collection.name}
                  </Text>
                </View>
                <Text
                  style={[S.collectionMeta, { color: colors.textSecondary }]}
                >
                  {collection.fileNames.length} files -{" "}
                  {formatBytes(collection.totalBytes)}
                </Text>
                <Text style={[S.date, { color: colors.textMuted }]}>
                  {collection.lastSentAt
                    ? `Last sent ${formatDate(collection.lastSentAt)}`
                    : `Created ${formatDate(collection.createdAt)}`}
                </Text>
              </GlassCard>
            ))}
          </ScrollView>
        </View>
      )}

      {mergedTransfers.length === 0 ? (
        <GlassCard animate>
          <View style={S.empty}>
            <FileText size={34} color={colors.accentLight} strokeWidth={2.1} />
            <Text style={[S.emptyTitle, { color: colors.textPrimary }]}>
              No history yet
            </Text>
            <Text style={[S.emptyText, { color: colors.textSecondary }]}>
              Shared files will appear here after the first transfer starts.
            </Text>
          </View>
        </GlassCard>
      ) : (
        <View style={S.list}>
          {filteredTransfers.length === 0 ? (
            <GlassCard>
              <Text style={[S.emptyText, { color: colors.textSecondary }]}>
                No matching transfer records.
              </Text>
            </GlassCard>
          ) : null}
          {filteredTransfers.map((job) => {
            const color = statusColor(job.status, colors);
            const Icon = statusIcon(job.status);
            return (
              <GlassCard key={job.id} padding={SPACING.md}>
                <FocusablePressable
                  onPress={() => handleJobPress(job)}
                  style={S.item}
                >
                  <View
                    style={[S.statusIcon, { backgroundColor: `${color}1F` }]}
                  >
                    <Icon size={20} color={color} strokeWidth={2.4} />
                  </View>
                  <View style={S.itemCopy}>
                    <Text
                      style={[S.name, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {job.fileNames?.join(", ") || job.fileName || "Transfer"}
                    </Text>
                    <Text
                      style={[S.route, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {job.fromDeviceName} to {job.toDeviceName} -{" "}
                      {formatBytes(job.sizeBytes)}
                    </Text>
                    <Text style={[S.date, { color: colors.textMuted }]}>
                      {formatDate(job.updatedAt)}
                    </Text>
                    {reports[job.id] && (
                      <View style={S.integrityRow}>
                        <Gauge
                          size={12}
                          color={colors.success}
                          strokeWidth={2.5}
                        />
                        <Text
                          style={[S.integrityText, { color: colors.success }]}
                          numberOfLines={1}
                        >
                          Verified Integrity •{" "}
                          {formatBytes(reports[job.id].averageBytesPerSecond)}/s
                        </Text>
                      </View>
                    )}
                  </View>
                  <View
                    style={[
                      S.statusPill,
                      {
                        backgroundColor: `${color}18`,
                        borderColor: `${color}44`,
                      },
                    ]}
                  >
                    <Text style={[S.statusText, { color }]}>{job.status}</Text>
                  </View>
                </FocusablePressable>
              </GlassCard>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { gap: SPACING.md, paddingBottom: SPACING.md },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  headerCopy: { flex: 1, gap: SPACING.xs },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: "800" },
  subtitle: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  clearButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
  },
  clearText: { fontSize: FONT_SIZE.sm, fontWeight: "800" },
  searchArea: { gap: SPACING.sm },
  collectionStrip: { gap: SPACING.sm },
  listHeader: { fontSize: FONT_SIZE.xs, fontWeight: "900", letterSpacing: 1.2 },
  collectionCard: { width: 220, marginRight: SPACING.sm },
  collectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  collectionName: { flex: 1, fontSize: FONT_SIZE.base, fontWeight: "900" },
  collectionMeta: {
    fontSize: FONT_SIZE.sm,
    fontWeight: "700",
    marginTop: SPACING.sm,
  },
  searchBox: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.base,
    fontWeight: "600",
    paddingVertical: 0,
  },
  filterRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  filterChip: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  filterText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  list: { gap: SPACING.sm },
  item: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  statusIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  itemCopy: { flex: 1, minWidth: 0 },
  name: { fontSize: FONT_SIZE.base, fontWeight: "800" },
  route: { fontSize: FONT_SIZE.sm, marginTop: 3 },
  date: { fontSize: FONT_SIZE.xs, marginTop: 5, fontWeight: "700" },
  integrityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  integrityText: { fontSize: 10, fontWeight: "900" },
  statusPill: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  empty: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.xxl,
  },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: "800" },
  emptyText: {
    textAlign: "center",
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
    maxWidth: 280,
  },
});
