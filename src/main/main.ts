import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseManager } from './databaseManager';
import { FileWatcher } from './fileWatcher';
import { ApiClient } from './apiClient';
import { NotificationManager } from './notificationManager';
import { AuthService, AuthConfig } from './authService';
import { OneDriveService } from './oneDriveService';
import { getEnvironmentConfig, DEFAULT_ENVIRONMENT } from '../config/environment';

class BrokerDesktop {
  private mainWindow: BrowserWindow | null = null;
  private databaseManager: DatabaseManager;
  private fileWatcher: FileWatcher | null = null;
  private apiClient: ApiClient;
  private notificationManager: NotificationManager;
  private tray: Tray | null = null;
  private isQuitting = false;
  private authService: AuthService | null = null;
  private oneDriveService: OneDriveService | null = null;
  private currentApiUrl: string = getEnvironmentConfig().apiBaseUrl;

  constructor() {
    this.databaseManager = new DatabaseManager();
    this.apiClient = new ApiClient();
    this.notificationManager = new NotificationManager();
  }

  async initialize() {
    try {
      console.log('[MAIN] Initializing BrokerNet Desktop...');
      
      // Initialize database (with error handling)
      try {
        await this.databaseManager.initialize();
      } catch (dbError) {
        console.warn('[MAIN] Database initialization failed, continuing without database:', dbError);
      }
      
      // Initialize authentication service
      this.initializeAuthService();
      
      // Check for existing authentication and auto-login
      this.checkExistingAuth();
      
      // Set up IPC handlers
      this.setupIpcHandlers();
      
      // Create main window
      this.createMainWindow();
      
      // Create system tray
      this.createSystemTray();
      
      // Initialize auto-updater
      this.initializeAutoUpdater();
      
      console.log('[MAIN] BrokerNet Desktop initialized successfully');
    } catch (error) {
      console.error('[MAIN] Error initializing app:', error);
    }
  }

  private initializeAuthService() {
    try {
      // Initialize MSAL authentication using existing backend Azure AD app
      const config: AuthConfig = {
        clientId: process.env.AZURE_AD_CLIENT_ID || '46e03f8e-72b6-4f45-9bcb-4d20288aad8e', // Your BrokerNet Desktop client ID
        tenantId: process.env.AZURE_AD_TENANT_ID || 'a246120e-0a1e-46c1-adad-470ebea973b1',
        authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || 'a246120e-0a1e-46c1-adad-470ebea973b1'}`
      };

      this.authService = new AuthService(config);
      this.oneDriveService = new OneDriveService(this.authService);
      
      console.log('[MAIN] Authentication service initialized with MSAL');
    } catch (error) {
      console.error('[MAIN] Error initializing auth service:', error);
    }
  }

  private async checkExistingAuth() {
    try {
      if (this.authService) {
        console.log('[MAIN] Checking for existing authentication...');
        const user = await this.authService.checkExistingAuth();
        if (user) {
          console.log('[MAIN] Auto-login successful for user:', user.name);
          // Notify renderer process about the authenticated user
          if (this.mainWindow) {
            this.mainWindow.webContents.send('user-authenticated', user);
          }
        } else {
          console.log('[MAIN] No existing authentication found');
        }
      }
    } catch (error) {
      console.error('[MAIN] Error checking existing authentication:', error);
    }
  }

  private createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: false // Allow local file loading for development
      },
      icon: path.join(__dirname, '../src/assets/icon.png'),
      titleBarStyle: 'default',
      show: false
    });

    // Set the main window in notification manager
    this.notificationManager.setMainWindow(this.mainWindow);

    // Load the renderer
    this.mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Handle window closed - minimize to tray instead of closing
    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
        console.log('[MAIN] Window minimized to tray');
      }
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.webContents.openDevTools();
    }
  }

  private createSystemTray() {
    try {
      // Create a simple icon for the tray
      const iconPath = path.join(__dirname, '../src/assets/icon.png');
      const trayIcon = nativeImage.createFromPath(iconPath);
      
      // Resize icon for tray (16x16 or 32x32)
      const resizedIcon = trayIcon.resize({ width: 16, height: 16 });
      
      this.tray = new Tray(resizedIcon);
      
      // Set tooltip
      this.tray.setToolTip('BrokerNet Desktop - File Processing');
      
      // Create context menu
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Open BrokerNet Desktop',
          click: () => {
            if (this.mainWindow) {
              this.mainWindow.show();
              this.mainWindow.focus();
            }
          }
        },
        {
          label: 'Open Drop Folder',
          click: () => {
            this.openDropFolder();
          }
        },
        {
          label: 'Settings',
          click: () => {
            if (this.mainWindow) {
              this.mainWindow.show();
              this.mainWindow.focus();
              // Switch to settings tab
              this.mainWindow.webContents.send('switch-to-settings');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            this.isQuitting = true;
            app.quit();
          }
        }
      ]);
      
      this.tray.setContextMenu(contextMenu);
      
      // Double-click to show window
      this.tray.on('double-click', () => {
        if (this.mainWindow) {
          this.mainWindow.show();
          this.mainWindow.focus();
        }
      });
      
      console.log('[MAIN] System tray created successfully');
    } catch (error) {
      console.error('[MAIN] Error creating system tray:', error);
    }
  }

  private async getPreferences(): Promise<any> {
    try {
      const prefsPath = path.join(app.getPath('userData'), 'preferences.json');
      if (fs.existsSync(prefsPath)) {
        const data = fs.readFileSync(prefsPath, 'utf-8');
        return JSON.parse(data);
      }
      return {};
    } catch (error) {
      console.error('[MAIN] Error loading preferences:', error);
      return {};
    }
  }

  private async openDropFolder() {
    try {
      const preferences = await this.getPreferences();
      if (preferences.dropFolderPath) {
        shell.openPath(preferences.dropFolderPath);
        console.log('[MAIN] Opened drop folder:', preferences.dropFolderPath);
      } else {
        console.log('[MAIN] No drop folder configured');
      }
    } catch (error) {
      console.error('[MAIN] Error opening drop folder:', error);
    }
  }

  private setupIpcHandlers() {
    // File processing
    ipcMain.handle('process-file', async (event, filePath: string, tags: number[], folderPath?: string) => {
      try {
        console.log('[MAIN:IPC] Processing file:', filePath);
        
        const result = await this.apiClient.uploadFileWithTags(
          this.currentApiUrl,
          {
            filePath,
            tags,
            folderPath,
            stageKey: 'desktop-upload',
            notes: `Uploaded via BrokerNet Desktop on ${new Date().toLocaleString()}`
          }
        );

        console.log('[MAIN:IPC] File processed successfully:', result);
        return result;
      } catch (error) {
        console.error('[MAIN:IPC] Error processing file:', error);
        throw error;
      }
    });

    // Preferences
    ipcMain.handle('get-preferences', async () => {
      try {
        const prefsPath = path.join(app.getPath('userData'), 'preferences.json');
        console.log('[MAIN:IPC] Preferences file path:', prefsPath);
        console.log('[MAIN:IPC] Preferences file exists:', fs.existsSync(prefsPath));
        
        if (fs.existsSync(prefsPath)) {
          const data = fs.readFileSync(prefsPath, 'utf8');
          console.log('[MAIN:IPC] Raw preferences file content:', data);
          const parsed = JSON.parse(data);
          console.log('[MAIN:IPC] Parsed preferences:', parsed);
          return parsed;
        }
        console.log('[MAIN:IPC] No preferences file found, returning null');
        return null;
      } catch (error) {
        console.error('[MAIN:IPC] Error loading preferences:', error);
        return null;
      }
    });

    ipcMain.handle('save-preferences', async (event, preferences: any) => {
      try {
        const prefsPath = path.join(app.getPath('userData'), 'preferences.json');
        console.log('[MAIN:IPC] Saving preferences to:', prefsPath);
        console.log('[MAIN:IPC] Preferences to save:', preferences);
        fs.writeFileSync(prefsPath, JSON.stringify(preferences, null, 2));
        console.log('[MAIN:IPC] Preferences saved successfully');
        return true;
      } catch (error) {
        console.error('[MAIN:IPC] Error saving preferences:', error);
        return false;
      }
    });

    // File watcher
    ipcMain.handle('start-file-watcher', async (event, folderPath: string) => {
      try {
        console.log('[MAIN:IPC] Starting file watcher for:', folderPath);
        
        if (this.fileWatcher) {
          this.fileWatcher.stop();
        }

        this.fileWatcher = new FileWatcher(
          folderPath,
          (filePath: string) => {
            console.log('[MAIN:IPC] File detected:', filePath);
            
            // Show Windows notification
            const fileName = path.basename(filePath);
            this.notificationManager.showFileDetectedNotification(fileName, filePath);
            
            // Notify renderer process
            this.mainWindow?.webContents.send('file-detected', filePath);
          }
        );

        await this.fileWatcher.start();
        return true;
      } catch (error) {
        console.error('[MAIN:IPC] Error starting file watcher:', error);
        return false;
      }
    });

    ipcMain.handle('stop-file-watcher', async () => {
      try {
        if (this.fileWatcher) {
          this.fileWatcher.stop();
          this.fileWatcher = null;
        }
        return true;
      } catch (error) {
        console.error('[MAIN:IPC] Error stopping file watcher:', error);
        return false;
      }
    });

    ipcMain.handle('restart-file-watcher', async () => {
      try {
        console.log('[MAIN:IPC] Restarting file watcher...');
        
        if (this.fileWatcher) {
          this.fileWatcher.stop();
          this.fileWatcher = null;
        }

        // Get current preferences to restart with same path
        const prefsPath = path.join(app.getPath('userData'), 'preferences.json');
        if (fs.existsSync(prefsPath)) {
          const data = fs.readFileSync(prefsPath, 'utf8');
          const preferences = JSON.parse(data);
          
          if (preferences.dropFolderPath) {
            this.fileWatcher = new FileWatcher(
              preferences.dropFolderPath,
              (filePath: string) => {
                console.log('[MAIN:IPC] File detected:', filePath);
                this.mainWindow?.webContents.send('file-detected', filePath);
              }
            );
            await this.fileWatcher.start();
          }
        }
        
        return true;
      } catch (error) {
        console.error('[MAIN:IPC] Error restarting file watcher:', error);
        return false;
      }
    });

    // Environment switching
    ipcMain.handle('set-api-url', async (event, apiUrl: string) => {
      console.log('[MAIN:IPC] Setting API URL to:', apiUrl);
      this.currentApiUrl = apiUrl;
      return { success: true };
    });

    // Tag categories
    ipcMain.handle('get-tag-categories', async () => {
      try {
        const apiUrl = this.currentApiUrl;
        console.log('[MAIN:IPC] Fetching tag categories from:', apiUrl);
        const categories = await this.apiClient.getTagCategories(apiUrl);
        console.log('[MAIN:IPC] Retrieved', categories.length, 'tag categories');
        return categories;
      } catch (error) {
        console.error('[MAIN:IPC] Error fetching tag categories:', error);
        return [];
      }
    });

    // OneDrive folder selection
    ipcMain.handle('select-onedrive-folder', async (event, defaultPath?: string) => {
      try {
        console.log('[MAIN:IPC] Opening OneDrive folder selection dialog...');
        
        const result = await dialog.showOpenDialog(this.mainWindow!, {
          title: 'Select OneDrive Root Folder',
          defaultPath: defaultPath || app.getPath('home'),
          properties: ['openDirectory']
        });

        if (!result.canceled && result.filePaths.length > 0) {
          console.log('[MAIN:IPC] Selected folder:', result.filePaths[0]);
          return result.filePaths[0];
        }
        
        return null;
      } catch (error) {
        console.error('[MAIN:IPC] Error selecting OneDrive folder:', error);
        return null;
      }
    });

    // OneDrive account detection
    ipcMain.handle('detect-onedrive-accounts', async () => {
      try {
        console.log('[MAIN:IPC] Detecting OneDrive accounts...');
        
        const accounts = [];
        const homeDir = app.getPath('home');
        
        // Common OneDrive paths
        const commonPaths = [
          path.join(homeDir, 'OneDrive'),
          path.join(homeDir, 'OneDrive - Personal'),
          path.join(homeDir, 'OneDrive - Business'),
        ];

        // Check for OneDrive folders in home directory
        try {
          const homeContents = fs.readdirSync(homeDir);
          const oneDriveFolders = homeContents.filter(item => 
            item.startsWith('OneDrive') && 
            fs.statSync(path.join(homeDir, item)).isDirectory()
          );
          
          oneDriveFolders.forEach(folder => {
            commonPaths.push(path.join(homeDir, folder));
          });
        } catch (error) {
          console.log('[MAIN:IPC] Could not read home directory:', error);
        }

        // Check which paths exist
        for (const folderPath of commonPaths) {
          try {
            if (fs.existsSync(folderPath)) {
              const stats = fs.statSync(folderPath);
              if (stats.isDirectory()) {
                // Basic check to see if it looks like OneDrive
                const contents = fs.readdirSync(folderPath);
                const hasOneDriveFiles = contents.some(item => 
                  item.includes('OneDrive') || 
                  item.includes('Documents') || 
                  item.includes('Pictures')
                );

                if (hasOneDriveFiles || contents.length > 0) {
                  const folderName = path.basename(folderPath);
                  let type = 'personal';
                  
                  if (folderName.includes('Business')) {
                    type = 'business';
                  } else if (folderName.includes('Personal')) {
                    type = 'personal';
                  }

                  accounts.push({
                    name: folderName,
                    path: folderPath,
                    type: type
                  });
                }
              }
            }
          } catch (error) {
            console.log('[MAIN:IPC] Could not access folder:', folderPath, error);
          }
        }

        console.log('[MAIN:IPC] Found OneDrive accounts:', accounts);
        return accounts;
      } catch (error) {
        console.error('[MAIN:IPC] Error detecting OneDrive accounts:', error);
        return [];
      }
    });

    // File operations
  ipcMain.handle('delete-file', async (event, filePath: string) => {
    try {
      console.log('[MAIN:IPC] Deleting file:', filePath);
      await fs.promises.unlink(filePath);
      console.log('[MAIN:IPC] File deleted successfully');
      return true;
    } catch (error) {
      console.error('[MAIN:IPC] Error deleting file:', error);
      return false;
    }
  });

  ipcMain.handle('list-files-in-folder', async (event, folderPath: string) => {
    try {
      console.log('[MAIN:IPC] Listing files in folder:', folderPath);
      const files = await fs.promises.readdir(folderPath);
      const filePaths = files.map(file => path.join(folderPath, file));
      console.log('[MAIN:IPC] Found files:', filePaths.length);
      return filePaths;
    } catch (error) {
      console.error('[MAIN:IPC] Error listing files in folder:', error);
      return [];
    }
  });

    ipcMain.handle('show-file-in-explorer', async (event, filePath: string) => {
      try {
        console.log('[MAIN:IPC] Opening file/folder in explorer:', filePath);
        
        // Check if the path exists
        if (!fs.existsSync(filePath)) {
          throw new Error(`Path does not exist: ${filePath}`);
        }
        
        // Check if it's a file or folder
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          // For folders, open the folder directly
          await shell.openPath(filePath);
        } else {
          // For files, show the file in its parent folder
          shell.showItemInFolder(filePath);
        }
        
        return true;
      } catch (error) {
        console.error('[MAIN:IPC] Error opening file/folder in explorer:', error);
        return false;
      }
    });

    ipcMain.handle('open-external', async (event, url: string) => {
      try {
        console.log('[MAIN:IPC] Opening external URL:', url);
        await shell.openExternal(url);
        return true;
      } catch (error) {
        console.error('[MAIN:IPC] Error opening external URL:', error);
        return false;
      }
    });

    // Authentication handlers - using MSAL
    ipcMain.handle('authenticate-user', async () => {
      try {
        if (!this.authService) {
          throw new Error('Authentication service not initialized');
        }
        
        console.log('[MAIN:IPC] Starting MSAL authentication...');
        const userInfo = await this.authService.authenticate();
        console.log('[MAIN:IPC] User authenticated:', userInfo.name);
        return userInfo;
      } catch (error) {
        console.error('[MAIN:IPC] Error authenticating user:', error);
        throw error;
      }
    });

    ipcMain.handle('get-current-user', async () => {
      try {
        if (!this.authService) {
          return null;
        }
        
        const user = this.authService.getCurrentUser();
        return user;
      } catch (error) {
        console.error('[MAIN:IPC] Error getting current user:', error);
        return null;
      }
    });

    ipcMain.handle('sign-out-user', async () => {
      try {
        console.log('[MAIN:IPC] Sign out requested');
        return true;
      } catch (error) {
        console.error('[MAIN:IPC] Error signing out user:', error);
        return false;
      }
    });

    // OneDrive handlers - using MSAL authenticated service
    ipcMain.handle('get-onedrive-drives', async () => {
      try {
        if (!this.oneDriveService) {
          throw new Error('OneDrive service not initialized');
        }
        
        console.log('[MAIN:IPC] Getting OneDrive drives via MSAL...');
        const drives = await this.oneDriveService.getDefaultDrive();
        return [drives]; // Return as array for consistency
      } catch (error) {
        console.error('[MAIN:IPC] Error getting OneDrive drives:', error);
        throw error;
      }
    });

    ipcMain.handle('upload-to-onedrive', async (event, filePath: string, fileName: string, folderPath?: string) => {
      try {
        if (!this.oneDriveService) {
          throw new Error('OneDrive service not initialized');
        }
        
        console.log('[MAIN:IPC] Uploading file to OneDrive via MSAL:', fileName);
        const result = await this.oneDriveService.uploadFile(filePath, fileName, folderPath);
        console.log('[MAIN:IPC] File uploaded successfully:', result.name);
        return result;
      } catch (error) {
        console.error('[MAIN:IPC] Error uploading to OneDrive:', error);
        throw error;
      }
    });

    ipcMain.handle('find-onedrive-folder', async (event, folderPath: string) => {
      try {
        if (!this.oneDriveService) {
          throw new Error('OneDrive service not initialized');
        }
        
        console.log('[MAIN:IPC] Finding OneDrive folder via MSAL:', folderPath);
        const folder = await this.oneDriveService.findFolderByPath(folderPath);
        return folder;
      } catch (error) {
        console.error('[MAIN:IPC] Error finding OneDrive folder:', error);
        return null;
      }
    });

    // App quit
    ipcMain.handle('quit-app', () => {
      this.isQuitting = true;
      app.quit();
    });

    // Switch to settings tab
    ipcMain.handle('switch-to-settings', () => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('switch-to-settings');
      }
    });

    // Auto-updater IPC handlers
    ipcMain.handle('check-for-updates', () => {
      return autoUpdater.checkForUpdatesAndNotify();
    });

    ipcMain.handle('quit-and-install', () => {
      autoUpdater.quitAndInstall();
    });
  }

  private initializeAutoUpdater() {
    // Configure auto-updater
    autoUpdater.checkForUpdatesAndNotify();
    
    // Check for updates every 4 hours
    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 4 * 60 * 60 * 1000);

    // Auto-updater events
    autoUpdater.on('checking-for-update', () => {
      console.log('[AUTO-UPDATER] Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('[AUTO-UPDATER] Update available:', info.version);
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-available', info);
      }
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('[AUTO-UPDATER] Update not available:', info.version);
    });

    autoUpdater.on('error', (err) => {
      console.error('[AUTO-UPDATER] Error:', err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      let log_message = "Download speed: " + progressObj.bytesPerSecond;
      log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
      log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
      console.log('[AUTO-UPDATER]', log_message);
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('download-progress', progressObj);
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[AUTO-UPDATER] Update downloaded:', info.version);
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-downloaded', info);
      }
    });
  }
}

// Initialize app when Electron is ready
app.whenReady().then(async () => {
  const brokerApp = new BrokerDesktop();
  await brokerApp.initialize();
});

// Don't quit when all windows are closed - keep running in tray
app.on('window-all-closed', () => {
  // Keep the app running in the system tray
  console.log('[MAIN] All windows closed, keeping app running in tray');
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const brokerApp = new BrokerDesktop();
    brokerApp.initialize();
  }
});
