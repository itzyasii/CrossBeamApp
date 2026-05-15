/**
 * File transfer service for managing transfers
 */

import { Transfer, TransferFile, TransferHistory } from '@/types';
import { generateId } from '@/utils/helpers';
import storage from '@/utils/storage';

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

    transfer.status = 'failed';
    transfer.error =
      'Native streaming transfer engine is not installed. Real transfers require Android and iOS native adapters.';
    transfer.endTime = Date.now();
    this.notifyListeners(transfer);
    await this.saveTransferToHistory(transfer);
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
      transfer.status = 'failed';
      transfer.error =
        'Resume requires a native chunked transfer engine with checkpoint support.';
      this.notifyListeners(transfer);
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

  async getTransferHistory(): Promise<TransferHistory[]> {
    return storage.getTransferHistory();
  }

  async deleteTransferHistory(transferId: string): Promise<void> {
    await storage.deleteTransferFromHistory(transferId);
  }

  /**
   * Remove completed transfer
   */
  removeTransfer(transferId: string): void {
    this.activeTransfers.delete(transferId);
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
