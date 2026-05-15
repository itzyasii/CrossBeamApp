/**
 * File transfer service for managing transfers
 */

import { Transfer, TransferFile, TransferStatus, TransferHistory } from '@types/index';
import {
  calculatePercentage,
  calculateSpeed,
  calculateRemainingTime,
  generateId,
} from '@utils/helpers';
import storage from '@utils/storage';

type TransferListener = (transfer: Transfer) => void;

class FileTransferService {
  private activeTransfers: Map<string, Transfer> = new Map();
  private listeners: Set<TransferListener> = new Set();

  /**
   * Subscribe to transfer updates
   */
  subscribe(transferId: string, listener: TransferListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Initiate a new transfer
   */
  async initiateTransfer(
    fromDevice: any,
    toDevice: any,
    files: Array<{ name: string; size: number; type: string; uri: string }>
  ): Promise<Transfer> {
    const transferId = generateId();
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

    const transferFiles: TransferFile[] = files.map((f) => ({
      id: generateId(),
      name: f.name,
      size: f.size,
      type: f.type,
      uri: f.uri,
      bytesTransferred: 0,
    }));

    const transfer: Transfer = {
      id: transferId,
      fromDevice,
      toDevice,
      files: transferFiles,
      status: 'pending',
      totalBytes,
      bytesTransferred: 0,
      startTime: Date.now(),
      pauses: [],
      speed: 0,
      remainingTime: 0,
      progress: 0,
    };

    this.activeTransfers.set(transferId, transfer);
    this.notifyListeners(transfer);

    return transfer;
  }

  /**
   * Start transfer
   */
  async startTransfer(transferId: string): Promise<void> {
    const transfer = this.activeTransfers.get(transferId);

    if (!transfer) {
      throw new Error(`Transfer ${transferId} not found`);
    }

    transfer.status = 'in-progress';
    transfer.startTime = Date.now();
    this.notifyListeners(transfer);

    // Simulate transfer progress
    await this.simulateTransfer(transferId);
  }

  /**
   * Pause transfer
   */
  pauseTransfer(transferId: string): void {
    const transfer = this.activeTransfers.get(transferId);

    if (!transfer) {
      console.error(`Transfer ${transferId} not found`);
      return;
    }

    if (transfer.status === 'in-progress') {
      transfer.status = 'paused';
      transfer.pauses.push(Date.now());
      this.notifyListeners(transfer);
    }
  }

  /**
   * Resume transfer
   */
  async resumeTransfer(transferId: string): Promise<void> {
    const transfer = this.activeTransfers.get(transferId);

    if (!transfer) {
      throw new Error(`Transfer ${transferId} not found`);
    }

    if (transfer.status === 'paused') {
      transfer.status = 'in-progress';
      transfer.resumeTime = Date.now();
      this.notifyListeners(transfer);

      await this.simulateTransfer(transferId);
    }
  }

  /**
   * Cancel transfer
   */
  async cancelTransfer(transferId: string): Promise<void> {
    const transfer = this.activeTransfers.get(transferId);

    if (!transfer) {
      throw new Error(`Transfer ${transferId} not found`);
    }

    transfer.status = 'cancelled';
    transfer.endTime = Date.now();
    this.notifyListeners(transfer);

    // Save to history
    await this.saveTransferToHistory(transfer);
  }

  /**
   * Get transfer by ID
   */
  getTransfer(transferId: string): Transfer | null {
    return this.activeTransfers.get(transferId) ?? null;
  }

  /**
   * Get all active transfers
   */
  getActiveTransfers(): Transfer[] {
    return Array.from(this.activeTransfers.values());
  }

  /**
   * Remove completed transfer
   */
  removeTransfer(transferId: string): void {
    this.activeTransfers.delete(transferId);
  }

  /**
   * Simulate file transfer with progress updates
   */
  private async simulateTransfer(transferId: string): Promise<void> {
    const transfer = this.activeTransfers.get(transferId);

    if (!transfer) return;

    const chunkSize = 1024 * 100; // 100KB chunks for simulation
    const totalChunks = Math.ceil(transfer.totalBytes / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      if (transfer.status !== 'in-progress') {
        break; // Transfer was paused or cancelled
      }

      // Simulate network delay (50-200ms per chunk)
      const delay = Math.random() * 150 + 50;
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Update bytes transferred
      const newBytesTransferred = Math.min(
        (i + 1) * chunkSize,
        transfer.totalBytes
      );

      transfer.bytesTransferred = newBytesTransferred;

      // Calculate metrics
      const elapsed = (Date.now() - transfer.startTime) / 1000; // seconds
      transfer.speed = Math.floor(transfer.bytesTransferred / elapsed);
      transfer.progress = calculatePercentage(
        transfer.bytesTransferred,
        transfer.totalBytes
      );
      transfer.remainingTime = calculateRemainingTime(
        transfer.totalBytes - transfer.bytesTransferred,
        transfer.speed
      );

      this.notifyListeners(transfer);

      // Complete transfer when all bytes transferred
      if (transfer.bytesTransferred >= transfer.totalBytes) {
        transfer.status = 'completed';
        transfer.endTime = Date.now();
        transfer.progress = 100;
        this.notifyListeners(transfer);

        // Save to history
        await this.saveTransferToHistory(transfer);
        break;
      }
    }
  }

  /**
   * Save transfer to history
   */
  private async saveTransferToHistory(transfer: Transfer): Promise<void> {
    try {
      const duration = (transfer.endTime ?? Date.now()) - transfer.startTime;
      const avgSpeed = Math.floor(transfer.totalBytes / (duration / 1000));

      const history: TransferHistory = {
        id: transfer.id,
        fromDevice: {
          id: transfer.fromDevice.id,
          name: transfer.fromDevice.name,
          platform: transfer.fromDevice.platform,
        },
        toDevice: {
          id: transfer.toDevice.id,
          name: transfer.toDevice.name,
          platform: transfer.toDevice.platform,
        },
        fileCount: transfer.files.length,
        totalBytes: transfer.totalBytes,
        status: (transfer.status as 'completed' | 'failed' | 'cancelled'),
        duration,
        timestamp: transfer.startTime,
        speed: avgSpeed,
        error: transfer.error,
      };

      await storage.saveTransfer(history);
    } catch (error) {
      console.error('Error saving transfer to history:', error);
    }
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(transfer: Transfer): void {
    this.listeners.forEach((listener) => {
      try {
        listener(transfer);
      } catch (error) {
        console.error('Error notifying transfer listener:', error);
      }
    });
  }
}

// Export singleton instance
export default new FileTransferService();
