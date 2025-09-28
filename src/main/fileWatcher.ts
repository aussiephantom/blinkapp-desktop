import * as chokidar from 'chokidar';
import * as path from 'path';

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private folderPath: string;
  private onFileDetected: (filePath: string) => void;

  constructor(folderPath: string, onFileDetected: (filePath: string) => void) {
    this.folderPath = folderPath;
    this.onFileDetected = onFileDetected;
  }

  async start(): Promise<void> {
    try {
      console.log('[FILEWATCHER] Starting file watcher for:', this.folderPath);

      this.watcher = chokidar.watch(this.folderPath, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100
        }
      });

      this.watcher.on('add', (filePath: string) => {
        console.log('[FILEWATCHER] File added:', filePath);
        this.onFileDetected(filePath);
      });

      this.watcher.on('change', (filePath: string) => {
        console.log('[FILEWATCHER] File changed:', filePath);
        this.onFileDetected(filePath);
      });

      console.log('[FILEWATCHER] File watcher started successfully');
    } catch (error) {
      console.error('[FILEWATCHER] Error starting file watcher:', error);
      throw error;
    }
  }

  stop(): void {
    if (this.watcher) {
      console.log('[FILEWATCHER] Stopping file watcher');
      this.watcher.close();
      this.watcher = null;
    }
  }

  isWatching(): boolean {
    return this.watcher !== null;
  }
}
