import { Notification, BrowserWindow } from 'electron';

export class NotificationManager {
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    // Initialize notification manager
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  showNotification(title: string, body: string, icon?: string, onClick?: () => void): void {
    try {
      if (Notification.isSupported()) {
        const notification = new Notification({
          title,
          body,
          icon: icon || undefined,
          actions: [
            {
              type: 'button',
              text: 'Process File'
            }
          ]
        });

        // Handle notification click
        notification.on('click', () => {
          console.log('[NOTIFICATION] Notification clicked');
          if (onClick) {
            onClick();
          } else {
            // Default behavior: focus the main window
            this.focusMainWindow();
          }
        });

        // Handle action button click
        notification.on('action', (event, index) => {
          console.log('[NOTIFICATION] Action button clicked:', index);
          if (onClick) {
            onClick();
          } else {
            this.focusMainWindow();
          }
        });

        notification.show();
      } else {
        console.log('[NOTIFICATION] Notifications not supported on this platform');
      }
    } catch (error) {
      console.error('[NOTIFICATION] Error showing notification:', error);
    }
  }

  private focusMainWindow() {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.focus();
      this.mainWindow.show();
    }
  }

  showFileProcessedNotification(fileName: string, success: boolean): void {
    const title = success ? 'File Processed Successfully' : 'File Processing Failed';
    const body = success 
      ? `"${fileName}" has been tagged and uploaded to OneDrive`
      : `Failed to process "${fileName}". Check the app for details.`;

    this.showNotification(title, body);
  }

  showFileDetectedNotification(fileName: string, filePath?: string): void {
    this.showNotification(
      'New File Detected',
      `"${fileName}" has been added to the processing queue`,
      undefined,
      () => {
        // When notification is clicked, focus the app and switch to file processor tab
        this.focusMainWindow();
        // Send message to renderer to switch to file processor tab
        if (this.mainWindow) {
          this.mainWindow.webContents.send('notification-clicked', { fileName, filePath });
        }
      }
    );
  }
}
