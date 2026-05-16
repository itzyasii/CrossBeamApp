import * as SQLite from 'expo-sqlite';
import { TransferHistory, Device } from '@/types/domain';

let db: SQLite.SQLiteDatabase | null = null;

export const initDatabase = async () => {
  if (db) return db;
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
};

export const getTransferHistory = async (): Promise<TransferHistory[]> => {
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
};

export const clearTransferHistory = async () => {
  const database = await initDatabase();
  await database.runAsync('DELETE FROM transfers');
};

export const saveTransferHistory = async (transfer: TransferHistory) => {
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
};

export const getTrustedDevices = async (): Promise<Device[]> => {
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
};

export const saveDevice = async (device: Device) => {
  const database = await initDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO devices (id, name, platform, isTrusted, lastSeenAt) VALUES (?, ?, ?, ?, ?)`,
    [device.id, device.name, device.platform, device.isTrusted ? 1 : 0, device.lastSeenAt]
  );
};

export const removeTrustedDevice = async (deviceId: string) => {
  const database = await initDatabase();
  await database.runAsync('UPDATE devices SET isTrusted = 0, lastSeenAt = ? WHERE id = ?', [Date.now(), deviceId]);
};

export const getAnalyticsData = async () => {
    const database = await initDatabase();
    
    const totalBytesRow = await database.getFirstAsync<{total: number}>('SELECT SUM(sizeBytes) as total FROM transfers WHERE status = "completed"');
    const totalBytes = totalBytesRow?.total ?? 0;

    const totalFilesRow = await database.getFirstAsync<{total: number}>('SELECT COUNT(*) as total FROM transfers WHERE status = "completed"');
    const totalFiles = totalFilesRow?.total ?? 0;

    const failedRow = await database.getFirstAsync<{total: number}>('SELECT COUNT(*) as total FROM transfers WHERE status = "failed"');
    const totalFailed = failedRow?.total ?? 0;

    return {
        totalBytes,
        totalFiles,
        totalFailed,
    };
};
