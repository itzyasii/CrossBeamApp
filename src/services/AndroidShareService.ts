import { Platform } from 'react-native';

export interface SharedFile {
  id: string;
  name: string;
  sizeBytes: number;
  uri: string;
  mimeType?: string;
}

class AndroidShareService {
  private static instance: AndroidShareService;
  private sharedFiles: SharedFile[] = [];
  private listeners: ((files: SharedFile[]) => void)[] = [];

  private constructor() {}

  public static getInstance(): AndroidShareService {
    if (!AndroidShareService.instance) {
      AndroidShareService.instance = new AndroidShareService();
    }
    return AndroidShareService.instance;
  }

  public handleIncomingFiles(files: SharedFile[]) {
    if (Platform.OS !== 'android') return;
    
    this.sharedFiles = [...this.sharedFiles, ...files];
    this.notifyListeners();
  }

  public getSharedFiles(): SharedFile[] {
    return this.sharedFiles;
  }

  public clearSharedFiles() {
    this.sharedFiles = [];
    this.notifyListeners();
  }

  public subscribe(listener: (files: SharedFile[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.sharedFiles));
  }
}

export default AndroidShareService.getInstance();
