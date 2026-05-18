import { Platform } from 'react-native';
import { CrossBeamNative, NativeTransferEvent } from '../native/crossbeamNative';

class BackgroundTransferAndroid {
  private static instance: BackgroundTransferAndroid;
  private activeTransfers: Map<string, NativeTransferEvent> = new Map();

  private constructor() {}

  public static getInstance(): BackgroundTransferAndroid {
    if (!BackgroundTransferAndroid.instance) {
      BackgroundTransferAndroid.instance = new BackgroundTransferAndroid();
    }
    return BackgroundTransferAndroid.instance;
  }

  public async startTransfer(peerId: string, files: any[]): Promise<string | null> {
    if (Platform.OS !== 'android') return null;
    if (!CrossBeamNative) return null;

    try {
      const { transferId } = await CrossBeamNative.sendFiles({
        peerId,
        files: files.map(f => ({
          id: f.id,
          name: f.name,
          uri: f.uri,
          sizeBytes: f.sizeBytes,
          mimeType: f.mimeType,
        })),
      });
      return transferId;
    } catch (error) {
      console.error('Failed to start background transfer on Android:', error);
      return null;
    }
  }

  public async pauseTransfer(transferId: string): Promise<void> {
    if (Platform.OS !== 'android') return;
    await CrossBeamNative?.pauseTransfer(transferId);
  }

  public async resumeTransfer(transferId: string): Promise<void> {
    if (Platform.OS !== 'android') return;
    await CrossBeamNative?.resumeTransfer(transferId);
  }

  public async cancelTransfer(transferId: string): Promise<void> {
    if (Platform.OS !== 'android') return;
    await CrossBeamNative?.cancelTransfer(transferId);
  }

  public handleProgressUpdate(event: NativeTransferEvent) {
    this.activeTransfers.set(event.transferId, event);
    if (event.status === 'completed' || event.status === 'failed' || event.status === 'cancelled') {
      this.activeTransfers.delete(event.transferId);
    }
  }

  public getActiveTransfers(): NativeTransferEvent[] {
    return Array.from(this.activeTransfers.values());
  }
}

export default BackgroundTransferAndroid.getInstance();
