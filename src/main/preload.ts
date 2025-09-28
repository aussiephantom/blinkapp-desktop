import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File processing
  processFile: (filePath: string, tags: number[], folderPath?: string) => 
    ipcRenderer.invoke('process-file', filePath, tags, folderPath),

  // Preferences
  getPreferences: () => ipcRenderer.invoke('get-preferences'),
  savePreferences: (preferences: any) => ipcRenderer.invoke('save-preferences', preferences),

  // File watcher
  startFileWatcher: (folderPath: string) => ipcRenderer.invoke('start-file-watcher', folderPath),
  stopFileWatcher: () => ipcRenderer.invoke('stop-file-watcher'),
  restartFileWatcher: () => ipcRenderer.invoke('restart-file-watcher'),

  // File events
  onFileDetected: (callback: (filePath: string) => void) => {
    ipcRenderer.on('file-detected', (event, filePath) => callback(filePath));
  },

  // Notification events
  onNotificationClicked: (callback: (data: { fileName: string; filePath: string }) => void) => {
    ipcRenderer.on('notification-clicked', (event, data) => callback(data));
  },

  // User authentication events
  onUserAuthenticated: (callback: (user: any) => void) => {
    ipcRenderer.on('user-authenticated', (event, user) => callback(user));
  },

  // Switch to settings events
  onSwitchToSettings: (callback: () => void) => {
    ipcRenderer.on('switch-to-settings', () => callback());
  },

  // Environment switching
  setApiUrl: (apiUrl: string) => ipcRenderer.invoke('set-api-url', apiUrl),

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-available', (event, info) => callback(info));
  },
  onDownloadProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('download-progress', (event, progress) => callback(progress));
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    ipcRenderer.on('update-downloaded', (event, info) => callback(info));
  },

  // Tag categories
  getTagCategories: () => ipcRenderer.invoke('get-tag-categories'),

  // OneDrive folder selection
  selectOneDriveFolder: (defaultPath?: string) => 
    ipcRenderer.invoke('select-onedrive-folder', defaultPath),

  // OneDrive account detection
  detectOneDriveAccounts: () => ipcRenderer.invoke('detect-onedrive-accounts'),

      // File operations
      deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
      showFileInExplorer: (filePath: string) => ipcRenderer.invoke('show-file-in-explorer', filePath),
      openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
      listFilesInFolder: (folderPath: string) => ipcRenderer.invoke('list-files-in-folder', folderPath),

      // Authentication
      authenticateUser: () => ipcRenderer.invoke('authenticate-user'),
      getCurrentUser: () => ipcRenderer.invoke('get-current-user'),
      signOutUser: () => ipcRenderer.invoke('sign-out-user'),

      // OneDrive
      getOneDriveDrives: () => ipcRenderer.invoke('get-onedrive-drives'),
      uploadToOneDrive: (filePath: string, fileName: string, folderPath?: string) => 
        ipcRenderer.invoke('upload-to-onedrive', filePath, fileName, folderPath),
      findOneDriveFolder: (folderPath: string) => ipcRenderer.invoke('find-onedrive-folder', folderPath)
});

// TypeScript interface for the exposed API
declare global {
  interface Window {
    electronAPI: {
      processFile: (filePath: string, tags: number[], folderPath?: string) => Promise<any>;
      getPreferences: () => Promise<any>;
      savePreferences: (preferences: any) => Promise<boolean>;
      startFileWatcher: (folderPath: string) => Promise<boolean>;
      stopFileWatcher: () => Promise<boolean>;
      restartFileWatcher: () => Promise<boolean>;
      onFileDetected: (callback: (filePath: string) => void) => void;
      onNotificationClicked: (callback: (data: { fileName: string; filePath: string }) => void) => void;
      onUserAuthenticated: (callback: (user: any) => void) => void;
      onSwitchToSettings: (callback: () => void) => void;
      setApiUrl: (apiUrl: string) => Promise<{ success: boolean }>;
      checkForUpdates: () => Promise<any>;
      quitAndInstall: () => Promise<void>;
      onUpdateAvailable: (callback: (info: any) => void) => void;
      onDownloadProgress: (callback: (progress: any) => void) => void;
      onUpdateDownloaded: (callback: (info: any) => void) => void;
      getTagCategories: () => Promise<any[]>;
      selectOneDriveFolder: (defaultPath?: string) => Promise<string | null>;
      detectOneDriveAccounts: () => Promise<any[]>;
          deleteFile: (filePath: string) => Promise<boolean>;
          showFileInExplorer: (filePath: string) => Promise<boolean>;
          openExternal: (url: string) => Promise<boolean>;
          listFilesInFolder: (folderPath: string) => Promise<string[]>;
          authenticateUser: () => Promise<any>;
          getCurrentUser: () => Promise<any>;
          signOutUser: () => Promise<boolean>;
          getOneDriveDrives: () => Promise<any[]>;
          uploadToOneDrive: (filePath: string, fileName: string, folderPath?: string) => Promise<any>;
          findOneDriveFolder: (folderPath: string) => Promise<any>;
        };
      }
    }
