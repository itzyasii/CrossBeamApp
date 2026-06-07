import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Network from "expo-network";
import { Platform } from "react-native";

import { nativeCrossBeam } from "@/native/crossbeamNative";
import { Device, SelectedFile, TransferJob } from "@/types/domain";
import { generateId } from "@/utils/helpers";
import { getRuntimePlatform } from "@/utils/platform";
import { saveDevice } from "@/store/database";

const APPROVALS_KEY = "@crossbeam/incoming-approvals";
const COLLECTIONS_KEY = "@crossbeam/transfer-collections";
const INTEGRITY_KEY = "@crossbeam/integrity-reports";

export type IncomingApprovalStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "trusted";

export type IncomingApprovalRequest = {
  id: string;
  fromDevice: Device;
  fileNames: string[];
  sizeBytes: number;
  requestedAt: number;
  status: IncomingApprovalStatus;
  storageOk?: boolean;
};

export type TransferCollection = {
  id: string;
  name: string;
  fileNames: string[];
  totalBytes: number;
  createdAt: number;
  lastSentAt?: number;
};

export type IntegrityReport = {
  transferId: string;
  checksum: string;
  durationMs: number;
  averageBytesPerSecond: number;
  savedPath?: string;
  verifiedAt: number;
};

export type DiagnosticsReport = {
  platform: ReturnType<typeof getRuntimePlatform>;
  isWifiConnected: boolean;
  isInternetReachable: boolean;
  ipAddress?: string;
  nativeAvailable: boolean;
  capabilities: string[];
  freeDiskBytes: number;
  blockedPermissions: string[];
};

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (error) {
    console.warn(`[PlatformFeatures] Ignoring invalid stored data for ${key}`, error);
    return fallback;
  }
};

const writeJson = async <T>(key: string, value: T): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`[PlatformFeatures] Failed to store ${key}`, error);
  }
};

const syntheticChecksum = (job: TransferJob): string => {
  const source = `${job.id}:${job.fileNames.join("|")}:${job.sizeBytes}:${job.updatedAt}`;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").repeat(8).slice(0, 64);
};

export const platformFeatureService = {
  async getApprovals(): Promise<IncomingApprovalRequest[]> {
    return readJson<IncomingApprovalRequest[]>(APPROVALS_KEY, []);
  },

  async queueApproval(
    request: Omit<IncomingApprovalRequest, "id" | "requestedAt" | "status">,
  ): Promise<IncomingApprovalRequest> {
    const approvals = await this.getApprovals();
    const approval: IncomingApprovalRequest = {
      ...request,
      id: generateId(),
      requestedAt: Date.now(),
      status: "pending",
    };
    await writeJson(APPROVALS_KEY, [approval, ...approvals].slice(0, 25));
    return approval;
  },

  async updateApproval(
    id: string,
    status: IncomingApprovalStatus,
  ): Promise<IncomingApprovalRequest[]> {
    const approvals = await this.getApprovals();
    const updated = approvals.map((approval) =>
      approval.id === id ? { ...approval, status } : approval,
    );
    const approval = updated.find((item) => item.id === id);
    if (approval && status === "trusted") {
      await saveDevice({ ...approval.fromDevice, isTrusted: true });
    }
    await writeJson(APPROVALS_KEY, updated);
    return updated;
  },

  async clearResolvedApprovals(): Promise<void> {
    const approvals = await this.getApprovals();
    await writeJson(
      APPROVALS_KEY,
      approvals.filter((approval) => approval.status === "pending"),
    );
  },

  async getCollections(): Promise<TransferCollection[]> {
    return readJson<TransferCollection[]>(COLLECTIONS_KEY, []);
  },

  async saveCollection(
    name: string,
    files: SelectedFile[],
  ): Promise<TransferCollection | null> {
    if (files.length === 0) return null;
    const collections = await this.getCollections();
    const collection: TransferCollection = {
      id: generateId(),
      name: name.trim() || `Batch ${collections.length + 1}`,
      fileNames: files.map((file) => file.name),
      totalBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
      createdAt: Date.now(),
    };
    await writeJson(COLLECTIONS_KEY, [collection, ...collections].slice(0, 30));
    return collection;
  },

  async markCollectionSent(id: string): Promise<void> {
    const collections = await this.getCollections();
    await writeJson(
      COLLECTIONS_KEY,
      collections.map((collection) =>
        collection.id === id ? { ...collection, lastSentAt: Date.now() } : collection,
      ),
    );
  },

  async deleteCollection(id: string): Promise<void> {
    const collections = await this.getCollections();
    await writeJson(
      COLLECTIONS_KEY,
      collections.filter((collection) => collection.id !== id),
    );
  },

  async getIntegrityReports(): Promise<IntegrityReport[]> {
    return readJson<IntegrityReport[]>(INTEGRITY_KEY, []);
  },

  async ensureIntegrityReport(job: TransferJob): Promise<IntegrityReport> {
    const reports = await this.getIntegrityReports();
    const existing = reports.find((report) => report.transferId === job.id);
    if (existing) return existing;

    const durationMs = Math.max(1, job.updatedAt - job.startedAt);
    const report: IntegrityReport = {
      transferId: job.id,
      checksum: syntheticChecksum(job),
      durationMs,
      averageBytesPerSecond: Math.floor(job.sizeBytes / (durationMs / 1000)),
      savedPath:
        job.toDeviceName === "This Device"
          ? job.savedFilePaths?.[0] ??
            (job.mimeType?.startsWith("image/")
              ? "Download/CrossBeam/Images"
              : job.mimeType?.startsWith("video/")
                ? "Download/CrossBeam/Videos"
                : job.mimeType?.startsWith("audio/")
                  ? "Download/CrossBeam/Audio"
                  : "Download/CrossBeam/Others")
          : job.localFilePaths?.[0],
      verifiedAt: Date.now(),
    };
    await writeJson(INTEGRITY_KEY, [report, ...reports].slice(0, 100));
    return report;
  },

  async getFreeDiskBytes(): Promise<number> {
    try {
      return await FileSystem.getFreeDiskStorageAsync();
    } catch {
      return 0;
    }
  },

  async createClipboardBeamFile(text: string): Promise<SelectedFile | null> {
    const content = text.trim();
    if (!content) return null;
    if (!FileSystem.cacheDirectory) return null;

    const fileName = `clipboard-beam-${Date.now()}.txt`;
    const uri = `${FileSystem.cacheDirectory}${fileName}`;
    try {
      await FileSystem.writeAsStringAsync(uri, content);
    } catch (error) {
      console.warn("[PlatformFeatures] Failed to create clipboard beam file", error);
      return null;
    }

    return {
      id: `clipboard-${Date.now()}`,
      name: fileName,
      uri,
      mimeType: "text/plain",
      sizeBytes: content.length,
    };
  },

  async getDiagnostics(): Promise<DiagnosticsReport> {
    const network = await Network.getNetworkStateAsync();
    const nativeAvailable = await nativeCrossBeam.isAvailable();
    const capabilities = await nativeCrossBeam.getCapabilities();
    const freeDiskBytes = await this.getFreeDiskBytes();
    const blockedPermissions: string[] = [];

    if (Platform.OS === "android" && !capabilities.includes("wifi-direct-api-available")) {
      blockedPermissions.push("Wi-Fi Direct unavailable on this OS/runtime");
    }
    if (!nativeAvailable) {
      blockedPermissions.push("Native CrossBeam bridge unavailable");
    }
    if (network.type !== Network.NetworkStateType.WIFI) {
      blockedPermissions.push("Wi-Fi is not the active network");
    }

    return {
      platform: getRuntimePlatform(),
      isWifiConnected: network.type === Network.NetworkStateType.WIFI,
      isInternetReachable: network.isInternetReachable ?? false,
      ipAddress: await Network.getIpAddressAsync().catch(() => undefined),
      nativeAvailable,
      capabilities,
      freeDiskBytes,
      blockedPermissions,
    };
  },
};

