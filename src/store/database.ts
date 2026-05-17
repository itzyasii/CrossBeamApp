import * as SQLite from 'expo-sqlite';
import { TransferHistory, Device } from '@/types/domain';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export const initDatabase = async () => {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      db = await SQLite.openDatabaseAsync('crossbeam.db');

      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS transfers (
          id TEXT PRIMARY KEY NOT NULL,
          fileName TEXT,
          fileNames TEXT,
          sizeBytes INTEGER NOT NULL,
          bytesTransferred INTEGER NOT NULL,
          progress INTEGER NOT NULL,
          status TEXT NOT NULL,
          fromDeviceName TEXT NOT NULL,
          toDeviceName TEXT NOT NULL,
          startedAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          errorMessage TEXT
        );
        CREATE TABLE IF NOT EXISTS devices (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          platform TEXT NOT NULL,
          isTrusted INTEGER NOT NULL DEFAULT 0,
          lastSeenAt INTEGER NOT NULL
        );
      `);
      return db;
    } catch (error) {
      console.error('[Database] Initialization failed:', error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
};

export const getTransferHistory = async (): Promise<TransferHistory[]> => {
  try {
    const database = await initDatabase();
    const result = await database.getAllAsync<any>('SELECT * FROM transfers ORDER BY updatedAt DESC');
    return result.map((row: any) => ({
      id: row.id,
      fileName: row.fileName,
      fileNames: row.fileNames ? JSON.parse(row.fileNames) : [],
      sizeBytes: row.sizeBytes,
      bytesTransferred: row.bytesTransferred,
      totalBytes: row.sizeBytes,
      progress: row.progress,
      status: row.status,
      fromDeviceName: row.fromDeviceName,
      toDeviceName: row.toDeviceName,
      encrypted: true,
      startedAt: row.startedAt,
      updatedAt: row.updatedAt,
      errorMessage: row.errorMessage,
    }));
  } catch (e) {
    console.error('[Database] getTransferHistory error:', e);
    return [];
  }
};

export const clearTransferHistory = async () => {
  try {
    const database = await initDatabase();
    await database.runAsync('DELETE FROM transfers');
  } catch (e) {
    console.error('[Database] clearTransferHistory error:', e);
  }
};

export const saveTransferHistory = async (transfer: TransferHistory) => {
  try {
    const database = await initDatabase();
    await database.runAsync(
      `INSERT OR REPLACE INTO transfers (id, fileName, fileNames, sizeBytes, bytesTransferred, progress, status, fromDeviceName, toDeviceName, startedAt, updatedAt, errorMessage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transfer.id,
        transfer.fileName ?? null,
        JSON.stringify(transfer.fileNames ?? []),
        transfer.sizeBytes ?? 0,
        transfer.bytesTransferred ?? 0,
        transfer.progress ?? 0,
        transfer.status ?? "queued",
        transfer.fromDeviceName ?? "unknown",
        transfer.toDeviceName ?? "unknown",
        transfer.startedAt ?? Date.now(),
        transfer.updatedAt ?? Date.now(),
        transfer.errorMessage ?? null
      ]
    );
  } catch (e) {
    console.error('[Database] saveTransferHistory error:', e);
  }
};

export const getTrustedDevices = async (): Promise<Device[]> => {
  try {
    const database = await initDatabase();
    const result = await database.getAllAsync<any>('SELECT * FROM devices WHERE isTrusted = 1');
    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      platform: row.platform as any,
      connection: 'local-network',
      isTrusted: true,
      lastSeenAt: row.lastSeenAt,
    }));
  } catch (e) {
    console.error('[Database] getTrustedDevices error:', e);
    return [];
  }
};

export const saveDevice = async (device: Device) => {
  try {
    const database = await initDatabase();
    await database.runAsync(
      `INSERT OR REPLACE INTO devices (id, name, platform, isTrusted, lastSeenAt) VALUES (?, ?, ?, ?, ?)`,
      [device.id, device.name, device.platform, device.isTrusted ? 1 : 0, device.lastSeenAt]
    );
  } catch (e) {
    console.error('[Database] saveDevice error:', e);
  }
};

export const removeTrustedDevice = async (deviceId: string) => {
  try {
    const database = await initDatabase();
    await database.runAsync('UPDATE devices SET isTrusted = 0, lastSeenAt = ? WHERE id = ?', [Date.now(), deviceId]);
  } catch (e) {
    console.error('[Database] removeTrustedDevice error:', e);
  }
};

export const getAnalyticsData = async () => {
  try {
    const database = await initDatabase();

    const rows = await database.getAllAsync<any>('SELECT * FROM transfers ORDER BY updatedAt DESC');
    const transfers = rows.map((row: any) => ({
      id: row.id,
      fileName: row.fileName,
      fileNames: row.fileNames ? JSON.parse(row.fileNames) : [],
      sizeBytes: row.sizeBytes,
      bytesTransferred: row.bytesTransferred,
      totalBytes: row.sizeBytes,
      progress: row.progress,
      status: row.status,
      fromDeviceName: row.fromDeviceName,
      toDeviceName: row.toDeviceName,
      encrypted: true,
      startedAt: row.startedAt,
      updatedAt: row.updatedAt,
      errorMessage: row.errorMessage,
    })) as TransferHistory[];

    const completed = transfers.filter((transfer) => transfer.status === 'completed');
    const failed = transfers.filter((transfer) => transfer.status === 'failed' || transfer.status === 'blocked' || transfer.status === 'rejected');
    const totalBytes = completed.reduce((sum, transfer) => sum + (transfer.sizeBytes ?? 0), 0);
    const totalFiles = completed.reduce((sum, transfer) => sum + Math.max(transfer.fileNames?.length ?? 0, transfer.fileName ? 1 : 0), 0);
    const totalFailed = failed.length;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const dailyBytes = Array.from({ length: 7 }, (_, index) => {
      const dayStart = startOfToday.getTime() - (6 - index) * 24 * 60 * 60 * 1000;
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      return completed
        .filter((transfer) => transfer.updatedAt >= dayStart && transfer.updatedAt < dayEnd)
        .reduce((sum, transfer) => sum + (transfer.sizeBytes ?? 0), 0);
    });

    const deviceTotals = new Map<string, number>();
    completed.forEach((transfer) => {
      const peerName = transfer.fromDeviceName === 'This Device' ? transfer.toDeviceName : transfer.fromDeviceName;
      deviceTotals.set(peerName, (deviceTotals.get(peerName) ?? 0) + (transfer.sizeBytes ?? 0));
    });

    const topDevices = Array.from(deviceTotals.entries())
      .map(([name, bytes]) => ({ name, bytes }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 5);

    return {
      totalBytes,
      totalFiles,
      totalFailed,
      totalJobs: transfers.length,
      dailyBytes,
      topDevices,
      recentTransfers: transfers.slice(0, 8),
    };
  } catch (e) {
    console.error('[Database] getAnalyticsData error:', e);
    return {
      totalBytes: 0,
      totalFiles: 0,
      totalFailed: 0,
      totalJobs: 0,
      dailyBytes: [0, 0, 0, 0, 0, 0, 0],
      topDevices: [],
      recentTransfers: [],
    };
  }
};
