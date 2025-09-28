import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { getEnvironmentConfig, DEFAULT_ENVIRONMENT, EnvironmentConfig } from '../config/environment';
import EnvironmentSwitcher from './components/EnvironmentSwitcher';
import UpdateNotification from './components/UpdateNotification';

// Dynamic API URL - will be set by environment switcher
let API_BASE_URL = getEnvironmentConfig().apiBaseUrl;

interface UserPreferences {
  dropFolderPath: string;
  oneDriveRootFolder: string;
  autoProcess: boolean;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  accessToken: string;
  expiresOn: Date;
}

interface FileProcessingState {
  fileName: string;
  displayName: string; // User-editable display name for the file
  filePath: string;
  timestamp: Date;
  selectedFolder: string;
  selectedTags: number[];
  isProcessing: boolean;
  isProcessed: boolean;
  result?: any;
  error?: string;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('file-processor');
  const [preferences, setPreferences] = useState<UserPreferences>({
    dropFolderPath: '',
    oneDriveRootFolder: '/',
    autoProcess: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [detectedFiles, setDetectedFiles] = useState<FileProcessingState[]>([]);
  const [tagCategories, setTagCategories] = useState<any[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const loadedPreferencesRef = useRef<UserPreferences | null>(null);
  const [currentEnvironment, setCurrentEnvironment] = useState<EnvironmentConfig>(getEnvironmentConfig());
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      await loadPreferences();
      checkAuthentication();
      loadTagCategories();
    };
    
    initializeApp();

    // Listen for auto-login events from main process
    const handleUserAuthenticated = (user: any) => {
      console.log('[APP] Received auto-login user:', user);
      setCurrentUser(user);
    };

    if (window.electronAPI) {
      window.electronAPI.onUserAuthenticated?.(handleUserAuthenticated);
    }

    // Listen for switch-to-settings events from main process
    const handleSwitchToSettings = () => {
      console.log('[APP] Switching to settings tab');
      setActiveTab('settings');
    };

          if (window.electronAPI) {
            window.electronAPI.onSwitchToSettings?.(handleSwitchToSettings);
          }

          // Listen for update events
          if (window.electronAPI) {
            window.electronAPI.onUpdateAvailable?.(() => {
              console.log('[APP] Update available notification received');
              setShowUpdateNotification(true);
            });

            window.electronAPI.onUpdateDownloaded?.(() => {
              console.log('[APP] Update downloaded notification received');
              setShowUpdateNotification(true);
            });
          }

          return () => {
            // Cleanup listeners if needed
          };
  }, []);

  // Start file watcher after preferences are loaded
  useEffect(() => {
    if (preferencesLoaded && preferences.dropFolderPath) {
      console.log('[APP] Starting file watcher after preferences loaded');
      setupFileWatcher();
      
      // Auto-load existing files in the drop folder when app starts
      loadExistingFiles();
    }
  }, [preferencesLoaded, preferences.dropFolderPath]);

  const loadExistingFiles = async () => {
    try {
      if (!preferences.dropFolderPath) {
        console.log('[APP] No drop folder path configured, skipping existing file load');
        return;
      }

      console.log('[APP] Loading existing files from drop folder:', preferences.dropFolderPath);
      
      if (window.electronAPI && window.electronAPI.listFilesInFolder) {
        const existingFiles = await window.electronAPI.listFilesInFolder(preferences.dropFolderPath);
        console.log('[APP] Found existing files:', existingFiles);
        
        // Add existing files to the detected files list
        existingFiles.forEach((filePath: string) => {
          handleFileDetected(filePath, preferences);
        });
      } else {
        console.log('[APP] listFilesInFolder API not available, skipping existing file load');
      }
    } catch (error) {
      console.error('[APP] Error loading existing files:', error);
    }
  };

  const loadTagCategories = async () => {
    try {
      setIsLoadingTags(true);
      console.log('[APP] Loading tag categories using electronAPI...');
      
      if (window.electronAPI) {
        const categories = await window.electronAPI.getTagCategories();
        console.log('[APP] Loaded tag categories:', categories?.length || 0);
        setTagCategories(categories || []);
      } else {
        console.error('[APP] electronAPI not available');
        setTagCategories([]);
      }
    } catch (error) {
      console.error('[APP] Error loading tag categories:', error);
      setTagCategories([]);
    } finally {
      setIsLoadingTags(false);
    }
  };

  const checkAuthentication = async () => {
    try {
      if (window.electronAPI) {
        const user = await window.electronAPI.getCurrentUser();
        setCurrentUser(user);
        console.log('[APP] Current user:', user);
      }
    } catch (error) {
      console.error('[APP] Error checking authentication:', error);
    }
  };

  const handleAuthenticate = async () => {
    try {
      setIsAuthenticating(true);
      if (window.electronAPI) {
        const user = await window.electronAPI.authenticateUser();
        setCurrentUser(user);
        console.log('[APP] User authenticated:', user);
      }
    } catch (error) {
      console.error('[APP] Error authenticating:', error);
      alert('Authentication failed: ' + error);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.signOutUser();
        setCurrentUser(null);
        console.log('[APP] User signed out');
      }
    } catch (error) {
      console.error('[APP] Error signing out:', error);
    }
  };

  useEffect(() => {
    // Start file watcher when drop folder path changes
    if (preferences.dropFolderPath) {
      startFileWatcher(preferences.dropFolderPath);
    }
  }, [preferences.dropFolderPath]);

  // Process any pending files when preferences are loaded
  useEffect(() => {
    if (preferencesLoaded && detectedFiles.length > 0) {
      console.log('[APP] Preferences loaded, processing any pending files');
      // Re-process all detected files with the correct preferences
      setDetectedFiles(prev => prev.map(file => {
        // Convert OneDrive root folder to user-friendly display path
        let displayFolder = preferences.oneDriveRootFolder;
        if (displayFolder === '/' || displayFolder === '' || !displayFolder) {
          displayFolder = 'OneDrive Root';
        } else if (displayFolder.includes('\\')) {
          // Convert Windows path to user-friendly format
          displayFolder = displayFolder
            .replace(/^E:\\365\\/, '') // Remove E:\365\ prefix
            .replace(/\\/g, '/'); // Convert backslashes to forward slashes
        }
        
        return {
          ...file,
          selectedFolder: displayFolder
        };
      }));
    }
  }, [preferencesLoaded, preferences.oneDriveRootFolder]);

  const loadPreferences = async () => {
    try {
      if (window.electronAPI) {
        console.log('[APP] Loading preferences from electronAPI...');
        const savedPrefs = await window.electronAPI.getPreferences();
        console.log('[APP] Raw preferences from electronAPI:', savedPrefs);
        console.log('[APP] Raw preferences type:', typeof savedPrefs);
        console.log('[APP] Raw preferences keys:', savedPrefs ? Object.keys(savedPrefs) : 'null');
        console.log('[APP] Raw preferences oneDriveRootFolder:', savedPrefs?.oneDriveRootFolder);
        
        if (savedPrefs && savedPrefs !== null) {
          setPreferences(savedPrefs);
          setPreferencesLoaded(true);
          loadedPreferencesRef.current = savedPrefs;
          console.log('[APP] Set preferences state to:', savedPrefs);
          console.log('[APP] Set preferencesLoaded to true');
          
          // Process any files that were detected before preferences were loaded
          // We'll do this by checking if there are any files in the drop folder
          // and re-processing them with the correct preferences
          setTimeout(() => {
            console.log('[APP] Re-checking for files that need processing with loaded preferences');
            console.log('[APP] Current preferences state after timeout:', preferences);
            console.log('[APP] Current preferencesLoaded state after timeout:', preferencesLoaded);
            console.log('[APP] Current loadedPreferencesRef after timeout:', loadedPreferencesRef.current);
            // The file watcher will detect existing files and now process them correctly
          }, 100);
          
          // Update existing detected files with the correct folder path
          setDetectedFiles(prev => prev.map(file => {
            // Convert OneDrive root folder to user-friendly display path
            let displayFolder = savedPrefs.oneDriveRootFolder;
            if (displayFolder === '/' || displayFolder === '' || !displayFolder) {
              displayFolder = 'OneDrive Root';
            } else if (displayFolder.includes('\\')) {
              // Convert Windows path to user-friendly format
              displayFolder = displayFolder
                .replace(/^E:\\365\\/, '') // Remove E:\365\ prefix
                .replace(/\\/g, '/'); // Convert backslashes to forward slashes
            }
            
            return {
              ...file,
              selectedFolder: displayFolder
            };
          }));
        } else {
          console.log('[APP] No saved preferences found, using defaults');
          console.log('[APP] Current default preferences:', preferences);
        }
      } else {
        console.error('[APP] electronAPI not available');
      }
    } catch (error) {
      console.error('[APP] Error loading preferences:', error);
    }
  };

  const savePreferences = async (newPrefs: UserPreferences) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.savePreferences(newPrefs);
        setPreferences(newPrefs);
      }
    } catch (error) {
      console.error('[APP] Error saving preferences:', error);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    console.log('[APP] Tab changed to:', tab);
    
    // Reload preferences when switching to file processor tab to ensure latest settings
    if (tab === 'file-processor') {
      loadPreferences();
    }
  };

  const handleOpenFolder = async () => {
    try {
      console.log('[APP] Open folder clicked');
      if (preferences.dropFolderPath) {
        if (window.electronAPI) {
          await window.electronAPI.showFileInExplorer(preferences.dropFolderPath);
        }
      } else {
        alert('No drop folder configured. Please configure a drop folder in Settings first.');
      }
    } catch (error) {
      console.error('[APP] Error opening folder:', error);
      alert('Error opening folder: ' + error);
    }
  };

  const handleSelectDropFolder = async () => {
    try {
      setIsLoading(true);
      if (window.electronAPI) {
        const selectedPath = await window.electronAPI.selectOneDriveFolder();
        if (selectedPath) {
          const newPrefs = { ...preferences, dropFolderPath: selectedPath };
          await savePreferences(newPrefs);
          alert(`Drop folder configured: ${selectedPath}`);
        }
      }
    } catch (error) {
      console.error('[APP] Error selecting drop folder:', error);
      alert('Error selecting drop folder: ' + error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOneDriveRootFolder = async () => {
    try {
      setIsLoading(true);
      if (window.electronAPI) {
        const selectedPath = await window.electronAPI.selectOneDriveFolder();
        if (selectedPath) {
          const newPrefs = { ...preferences, oneDriveRootFolder: selectedPath };
          await savePreferences(newPrefs);
          alert(`OneDrive root folder configured: ${selectedPath}`);
        }
      }
    } catch (error) {
      console.error('[APP] Error selecting OneDrive root folder:', error);
      alert('Error selecting OneDrive root folder: ' + error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupFileWatcher = () => {
    if (window.electronAPI) {
      // Listen for file detection events from main process
      window.electronAPI.onFileDetected((filePath: string) => {
        console.log('[APP] File detected:', filePath);
        handleFileDetected(filePath);
      });

      // Listen for notification click events
      window.electronAPI.onNotificationClicked((data: { fileName: string; filePath: string }) => {
        console.log('[APP] Notification clicked:', data);
        handleNotificationClicked(data);
      });
    }
  };

  const startFileWatcher = async (folderPath: string) => {
    try {
      console.log('[APP] Starting file watcher for:', folderPath);
      if (window.electronAPI) {
        const success = await window.electronAPI.startFileWatcher(folderPath);
        if (success) {
          console.log('[APP] File watcher started successfully');
        } else {
          console.error('[APP] Failed to start file watcher');
        }
      }
    } catch (error) {
      console.error('[APP] Error starting file watcher:', error);
    }
  };

  const handleFileDetected = (filePath: string, loadedPrefs?: any) => {
    console.log('[APP] File detected:', filePath);
    console.log('[APP] Current preferences:', preferences);
    console.log('[APP] Preferences loaded:', preferencesLoaded);
    console.log('[APP] Loaded preferences parameter:', loadedPrefs);
    
    // Use loaded preferences from ref if available, otherwise use current state
    const currentPrefs = loadedPrefs || loadedPreferencesRef.current || preferences;
    
    // Don't process files until we have preferences
    if (!currentPrefs || !preferencesLoaded) {
      console.log('[APP] Preferences not loaded yet, skipping file processing');
      return;
    }
    
    const fileName = filePath.split('\\').pop() || filePath.split('/').pop() || 'Unknown file';
    
    // Check if file already exists in the list to prevent duplicates
    setDetectedFiles(prev => {
      const exists = prev.some(file => file.filePath === filePath);
      if (!exists) {
        console.log('[APP] Adding new file to list:', fileName);
        
        // Convert OneDrive root folder to user-friendly display path
        let displayFolder = currentPrefs.oneDriveRootFolder;
        console.log('[APP] Raw OneDrive root folder:', displayFolder);
        
        if (displayFolder === '/' || displayFolder === '' || !displayFolder) {
          // If no OneDrive root folder is configured, try to infer it from the file path
          // and suggest it to the user
          const fileDriveRoot = filePath.substring(0, filePath.indexOf('\\', 3)); // E:\365\OneDrive - Broadlink
          if (fileDriveRoot.includes('OneDrive')) {
            displayFolder = 'OneDrive Root (Configure in Settings)';
            console.log('[APP] No OneDrive root configured, inferred from file path:', fileDriveRoot);
          } else {
            displayFolder = 'OneDrive Root';
          }
        } else if (displayFolder.includes('\\')) {
          // Convert Windows path to user-friendly format
          displayFolder = displayFolder
            .replace(/^E:\\365\\/, '') // Remove E:\365\ prefix
            .replace(/\\/g, '/'); // Convert backslashes to forward slashes
        }
        
        console.log('[APP] Display folder for new file:', displayFolder);
        
        const newFile: FileProcessingState = {
          fileName,
          displayName: fileName, // Initialize with original filename
          filePath,
          timestamp: new Date(),
          selectedFolder: displayFolder,
          selectedTags: [],
          isProcessing: false,
          isProcessed: false
        };
        return [...prev, newFile];
      } else {
        console.log('[APP] File already exists in list, skipping:', fileName);
        return prev;
      }
    });
  };

  const handleNotificationClicked = (data: { fileName: string; filePath: string }) => {
    console.log('[APP] Notification clicked, switching to file processor tab');
    console.log('[APP] Preferences loaded:', preferencesLoaded);
    
    // Don't process files until preferences are loaded
    if (!preferencesLoaded || !loadedPreferencesRef.current) {
      console.log('[APP] Preferences not loaded yet, skipping notification processing');
      return;
    }
    
    // Switch to file processor tab
    setActiveTab('file-processor');
    
    // Add the file to detected files if not already there
    setDetectedFiles(prev => {
      const exists = prev.some(file => file.filePath === data.filePath);
      if (!exists) {
        // Convert OneDrive root folder to user-friendly display path
        let displayFolder = loadedPreferencesRef.current?.oneDriveRootFolder || preferences.oneDriveRootFolder;
        console.log('[APP] Raw OneDrive root folder for notification:', displayFolder);
        
        if (displayFolder === '/' || displayFolder === '' || !displayFolder) {
          // If no OneDrive root folder is configured, try to infer it from the file path
          const fileDriveRoot = data.filePath.substring(0, data.filePath.indexOf('\\', 3)); // E:\365\OneDrive - Broadlink
          if (fileDriveRoot.includes('OneDrive')) {
            displayFolder = 'OneDrive Root (Configure in Settings)';
            console.log('[APP] No OneDrive root configured, inferred from file path:', fileDriveRoot);
          } else {
            displayFolder = 'OneDrive Root';
          }
        } else if (displayFolder.includes('\\')) {
          // Convert Windows path to user-friendly format
          displayFolder = displayFolder
            .replace(/^E:\\365\\/, '') // Remove E:\365\ prefix
            .replace(/\\/g, '/'); // Convert backslashes to forward slashes
        }
        
        console.log('[APP] Display folder for notification file:', displayFolder);
        
        const newFile: FileProcessingState = {
          fileName: data.fileName,
          displayName: data.fileName, // Initialize with original filename
          filePath: data.filePath,
          timestamp: new Date(),
          selectedFolder: displayFolder,
          selectedTags: [],
          isProcessing: false,
          isProcessed: false
        };
        return [...prev, newFile];
      }
      return prev;
    });
  };

  const handleRemoveFile = async (index: number) => {
    const file = detectedFiles[index];
    const confirmed = confirm(`Remove "${file.fileName}" from the processing list?\n\nThis will delete the file from your drop folder.`);
    
    if (confirmed) {
      try {
        // Delete the physical file from the drop folder
        if (window.electronAPI && window.electronAPI.deleteFile) {
          await window.electronAPI.deleteFile(file.filePath);
          console.log('[APP] File deleted from drop folder:', file.filePath);
        }
        
        // Remove from the UI list
        setDetectedFiles(prev => prev.filter((_, i) => i !== index));
      } catch (error) {
        console.error('[APP] Error deleting file:', error);
        // Still remove from UI even if file deletion fails
        setDetectedFiles(prev => prev.filter((_, i) => i !== index));
        alert(`File removed from processing list, but there was an error deleting the file from the drop folder: ${error}`);
      }
    }
  };

  const handleFileFolderChange = (index: number, newFolder: string) => {
    // Convert user input to OneDrive format if needed
    let oneDriveFolder = newFolder;
    if (newFolder === 'OneDrive Root') {
      oneDriveFolder = 'root';
    } else if (newFolder.includes('/') && !newFolder.includes('\\')) {
      // Convert forward slashes back to OneDrive format
      oneDriveFolder = newFolder;
    }
    
    setDetectedFiles(prev => prev.map((file, i) => 
      i === index ? { ...file, selectedFolder: newFolder } : file
    ));
  };

  const handleFileTagToggle = (index: number, tagId: number) => {
    setDetectedFiles(prev => prev.map((file, i) => 
      i === index ? {
        ...file,
        selectedTags: file.selectedTags.includes(tagId)
          ? file.selectedTags.filter(id => id !== tagId)
          : [...file.selectedTags, tagId]
      } : file
    ));
  };

  const handleFileNameChange = (index: number, newName: string) => {
    setDetectedFiles(prev => prev.map((file, i) => {
      if (i === index) {
        // Extract the original file extension
        const originalExtension = file.fileName.substring(file.fileName.lastIndexOf('.'));
        
        // If the new name doesn't have an extension, add the original one
        let finalName = newName;
        if (!newName.includes('.') && originalExtension) {
          finalName = newName + originalExtension;
        }
        
        return { ...file, displayName: finalName };
      }
      return file;
    }));
  };

  const handleApplyFolderToAll = (folderPath: string) => {
    const confirmed = confirm(`Apply this folder to all files?\n\n"${folderPath}"\n\nThis will update the target folder for all files in the processing list.`);
    
    if (confirmed) {
      setDetectedFiles(prev => prev.map(file => ({
        ...file,
        selectedFolder: folderPath
      })));
    }
  };

  const handleClearAllFiles = async () => {
    // Only count files that haven't been processed yet (still exist in drop folder)
    const unprocessedFiles = detectedFiles.filter(file => !file.isProcessed);
    
    if (unprocessedFiles.length === 0) {
      // If no unprocessed files, just clear the list without confirmation
      setDetectedFiles([]);
      console.log('[APP] No unprocessed files to delete, clearing list');
      return;
    }
    
    const confirmed = confirm(`Clear all unprocessed files from the processing list?\n\nThis will delete ${unprocessedFiles.length} unprocessed file(s) from your drop folder.\n\nFiles to be deleted: ${unprocessedFiles.length}`);
    
    if (confirmed) {
      try {
        // Delete only unprocessed physical files from the drop folder
        const deletePromises = unprocessedFiles.map(async (file) => {
          try {
            if (window.electronAPI && window.electronAPI.deleteFile) {
              await window.electronAPI.deleteFile(file.filePath);
              console.log('[APP] Unprocessed file deleted from drop folder:', file.filePath);
              return { success: true, filePath: file.filePath };
            }
            return { success: false, filePath: file.filePath, error: 'deleteFile API not available' };
          } catch (error) {
            console.error('[APP] Error deleting unprocessed file:', file.filePath, error);
            return { success: false, filePath: file.filePath, error: error instanceof Error ? error.message : String(error) };
          }
        });

        const results = await Promise.all(deletePromises);
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        // Clear the UI list regardless of deletion results
        setDetectedFiles([]);

        if (failed > 0) {
          alert(`Cleared ${successful} unprocessed files successfully, but ${failed} files could not be deleted from the drop folder. Check the console for details.`);
        } else {
          console.log(`[APP] Successfully cleared all ${successful} unprocessed files from drop folder`);
        }
      } catch (error) {
        console.error('[APP] Error clearing unprocessed files:', error);
        // Still clear the UI list even if there was an error
        setDetectedFiles([]);
        alert(`Files removed from processing list, but there was an error deleting some unprocessed files from the drop folder: ${error}`);
      }
    }
  };

  const handleProcessSingleFile = async (index: number) => {
    const file = detectedFiles[index];
    if (!file || file.isProcessing || file.isProcessed) return;

    // Update file state to processing
    setDetectedFiles(prev => prev.map((f, i) => 
      i === index ? { ...f, isProcessing: true, error: undefined } : f
    ));

    try {
      console.log('[APP] Processing file:', file.fileName);
      console.log('[APP] Selected tags:', file.selectedTags);
      console.log('[APP] Selected folder:', file.selectedFolder);

      // Tags are now optional - files can be processed without tags

      if (!currentUser) {
        throw new Error('Please authenticate with Microsoft to upload files to OneDrive.');
      }

      // Upload to OneDrive first using desktop app service
      if (window.electronAPI) {
        console.log('[APP] Uploading file to OneDrive...');
        
        // Convert display folder back to OneDrive format
        let oneDriveFolder: string | undefined = file.selectedFolder;
        if (oneDriveFolder === 'OneDrive Root') {
          oneDriveFolder = undefined; // Let OneDrive service use default
        } else if (oneDriveFolder && oneDriveFolder !== 'root') {
          // Convert user-friendly path back to OneDrive format if needed
          // The OneDrive service will handle the path conversion
          oneDriveFolder = oneDriveFolder;
        }
        
        const oneDriveResult = await window.electronAPI.uploadToOneDrive(
          file.filePath,
          file.displayName, // Use the user-editable display name
          oneDriveFolder
        );

        console.log('[APP] OneDrive upload result:', JSON.stringify(oneDriveResult, null, 2));

        // Create tag associations using the backend API (only if tags are selected)
        let associationResult: any[] = [];
        if (file.selectedTags.length > 0) {
          const tagResult = await fetch(`${API_BASE_URL}/api/file-tags/associations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-test-user-id': '1',
              'x-test-user-name': currentUser?.name || 'Desktop App User',
              'x-test-user-is-admin': 'true'
            },
            body: JSON.stringify({
              associations: file.selectedTags.map(tagId => ({
                file_id: oneDriveResult.id,
                tag_id: tagId,
                item_type: 'file',
                drive_id: 'onedrive',
                notes: `Uploaded via BrokerNet Desktop on ${new Date().toLocaleString()}`
              }))
            })
          });

          if (!tagResult.ok) {
            throw new Error(`Failed to create tag associations: ${tagResult.statusText}`);
          }

          associationResult = await tagResult.json();
          console.log('[APP] Tag associations created:', JSON.stringify(associationResult, null, 2));
        } else {
          console.log('[APP] No tags selected, skipping tag associations');
        }
        
        // Combine results
        const result = {
          success: true,
          file_id: oneDriveResult.id,
          one_drive_id: oneDriveResult.id,
          web_url: oneDriveResult.webUrl,
          message: 'File uploaded and tagged successfully',
          associations: associationResult
        };
        
        console.log('[APP] Complete file processing result:', JSON.stringify(result, null, 2));
        
        // Delete the file from the drop folder after successful processing
        try {
          if (window.electronAPI) {
            console.log('[APP] Deleting processed file from drop folder:', file.filePath);
            const deleteSuccess = await window.electronAPI.deleteFile(file.filePath);
            if (deleteSuccess) {
              console.log('[APP] File successfully deleted from drop folder');
            } else {
              console.warn('[APP] Failed to delete file from drop folder');
            }
          }
        } catch (deleteError) {
          console.error('[APP] Error deleting file from drop folder:', deleteError);
          // Don't fail the entire process if file deletion fails
        }
        
        // Update file state to processed
        setDetectedFiles(prev => prev.map((f, i) => 
          i === index ? { ...f, isProcessing: false, isProcessed: true, result } : f
        ));
      }
    } catch (error) {
      console.error('[APP] Error processing file:', error);
      setDetectedFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, isProcessing: false, error: error instanceof Error ? error.message : String(error) } : f
      ));
    }
  };

  const handleProcessAllFiles = async () => {
    const filesToProcess = detectedFiles.filter(f => !f.isProcessed && !f.isProcessing);
    if (filesToProcess.length === 0) {
      alert('No files ready to process.');
      return;
    }

    for (let i = 0; i < filesToProcess.length; i++) {
      const fileIndex = detectedFiles.findIndex(f => f.filePath === filesToProcess[i].filePath);
      if (fileIndex !== -1) {
        await handleProcessSingleFile(fileIndex);
        // Small delay between files to avoid overwhelming the API
        if (i < filesToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  };

  const handleOpenLocalFolder = async (file: FileProcessingState) => {
    try {
      if (window.electronAPI) {
        // Open the OneDrive synced folder where the file would be located
        // Convert the selected folder back to the actual OneDrive path
        let oneDriveFolder = file.selectedFolder;
        if (oneDriveFolder === 'OneDrive Root') {
          // Use the user's configured OneDrive root folder
          oneDriveFolder = preferences.oneDriveRootFolder;
        }
        
        // Convert OneDrive path to local synced path
        let localFolderPath = oneDriveFolder;
        if (localFolderPath && localFolderPath !== '/' && localFolderPath !== 'OneDrive Root') {
          // If it's a relative path, prepend with the OneDrive sync root
          if (!localFolderPath.includes('\\') && !localFolderPath.startsWith('E:')) {
            // Extract the OneDrive sync root from the file path
            const fileDriveRoot = file.filePath.substring(0, file.filePath.indexOf('\\', 3)); // E:\365\OneDrive - Broadlink
            localFolderPath = `${fileDriveRoot}\\${localFolderPath.replace(/\//g, '\\')}`;
          }
        } else {
          // Default to the OneDrive root
          const fileDriveRoot = file.filePath.substring(0, file.filePath.indexOf('\\', 3)); // E:\365\OneDrive - Broadlink
          localFolderPath = fileDriveRoot;
        }
        
        console.log('[APP] Opening OneDrive synced folder:', localFolderPath);
        await window.electronAPI.showFileInExplorer(localFolderPath);
      }
    } catch (error) {
      console.error('[APP] Error opening local folder:', error);
    }
  };

  const handleOpenOneDriveWebFolder = (file: FileProcessingState) => {
    try {
      if (file.result?.web_url) {
        // Convert file URL to folder URL by removing the filename
        const webUrl = file.result.web_url;
        console.log('[APP] Original file URL:', webUrl);
        
        // Remove the filename from the URL to get the folder URL
        const lastSlashIndex = webUrl.lastIndexOf('/');
        const folderUrl = webUrl.substring(0, lastSlashIndex);
        
        console.log('[APP] Opening OneDrive folder URL:', folderUrl);
        window.electronAPI.openExternal(folderUrl);
      } else {
        alert('OneDrive file URL not available.');
      }
    } catch (error) {
      console.error('[APP] Error opening OneDrive web folder:', error);
    }
  };

  const handleOpenOneDriveWebFile = (file: FileProcessingState) => {
    try {
      if (file.result?.web_url) {
        // Open the actual file in OneDrive web
        const webUrl = file.result.web_url;
        window.electronAPI.openExternal(webUrl);
      } else {
        alert('OneDrive file URL not available.');
      }
    } catch (error) {
      console.error('[APP] Error opening OneDrive web file:', error);
    }
  };

  const handleEnvironmentChange = useCallback(async (config: EnvironmentConfig) => {
    // Only update if the environment actually changed
    if (currentEnvironment.apiBaseUrl !== config.apiBaseUrl) {
      console.log('[APP] Environment changed to:', config.name, config.apiBaseUrl);
      setCurrentEnvironment(config);
      // Update the global API_BASE_URL
      API_BASE_URL = config.apiBaseUrl;
      
      // Update the main process API URL
      if (window.electronAPI) {
        try {
          await window.electronAPI.setApiUrl(config.apiBaseUrl);
          console.log('[APP] Main process API URL updated to:', config.apiBaseUrl);
        } catch (error) {
          console.error('[APP] Error updating main process API URL:', error);
        }
      }
      
      // Reload tag categories with new environment
      loadTagCategories();
    }
  }, [currentEnvironment.apiBaseUrl]);

  const handleInstallUpdate = useCallback(() => {
    if (window.electronAPI) {
      window.electronAPI.quitAndInstall();
    }
  }, []);

  const handleDismissUpdate = useCallback(() => {
    setShowUpdateNotification(false);
  }, []);

  return (
    <div className="app">
      {showUpdateNotification && (
        <UpdateNotification
          onInstallUpdate={handleInstallUpdate}
          onDismiss={handleDismissUpdate}
        />
      )}
      <div className="sidebar">
        <div 
          className={`sidebar-item ${activeTab === 'file-processor' ? 'active' : ''}`}
          onClick={() => handleTabChange('file-processor')}
        >
          <span className="sidebar-item-icon">📁</span>
          <span className="sidebar-item-text">File Processor</span>
        </div>
        <div 
          className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => handleTabChange('settings')}
        >
          <span className="sidebar-item-icon">⚙️</span>
          <span className="sidebar-item-text">Settings</span>
        </div>
      </div>
      
      <div className="main-content">
        <div className="header">
          <div>
            <h1 className="header-title">BrokerNet Desktop</h1>
            <p className="header-version">v1.0.0</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={handleOpenFolder}>
              📁 Open Folder
            </button>
          </div>
        </div>
        
        <div className="content-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 className="content-title" style={{ margin: 0 }}>
              {activeTab === 'file-processor' && 'File Processor'}
              {activeTab === 'settings' && 'Settings'}
            </h2>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {currentUser ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>
                    👤 {currentUser.name}
                  </span>
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleSignOut}
                    style={{ padding: '5px 10px', fontSize: '12px' }}
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button 
                  className="btn btn-primary" 
                  onClick={handleAuthenticate}
                  disabled={isAuthenticating}
                  style={{ padding: '5px 10px', fontSize: '12px' }}
                >
                  {isAuthenticating ? 'Authenticating...' : '🔐 Sign In'}
                </button>
              )}
            </div>
          </div>
          
          {activeTab === 'file-processor' && (
            <div>
              {!currentUser && (
                <div style={{
                  padding: '15px',
                  backgroundColor: '#fff3cd',
                  border: '1px solid #ffeaa7',
                  borderRadius: '6px',
                  marginBottom: '20px',
                  color: '#856404'
                }}>
                  <strong>⚠️ Authentication Required:</strong> Please sign in with your Microsoft account to upload files to OneDrive and tag them.
                </div>
              )}
              {detectedFiles.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📁</div>
                  <h3 className="empty-state-title">No files detected</h3>
                  <p className="empty-state-description">
                    Drop files into your configured folder to start processing.
                  </p>
                  <p style={{ color: '#7f8c8d', marginTop: '10px' }}>
                    <strong>Drop folder:</strong> {preferences.dropFolderPath || 'Not configured'}
                  </p>
                  {preferences.dropFolderPath && (
                    <div style={{ marginTop: '20px' }}>
                      <button className="btn btn-primary" onClick={handleOpenFolder}>
                        📁 Open Drop Folder
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, color: '#2c3e50' }}>Detected Files ({detectedFiles.length})</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {(() => {
                        const filesToProcess = detectedFiles.filter(f => !f.isProcessed && !f.isProcessing);
                        if (filesToProcess.length > 1) {
                          return (
                            <button 
                              className="btn btn-primary" 
                              onClick={handleProcessAllFiles}
                              disabled={!currentUser}
                              style={{ 
                                fontSize: '12px', 
                                padding: '5px 10px',
                                opacity: !currentUser ? 0.5 : 1,
                                cursor: !currentUser ? 'not-allowed' : 'pointer'
                              }}
                              title={!currentUser ? 'Please sign in to process files' : ''}
                            >
                              🚀 Process All ({filesToProcess.length})
                            </button>
                          );
                        }
                        return null;
                      })()}
                      <button 
                        className="btn btn-danger" 
                        onClick={handleClearAllFiles}
                        disabled={!currentUser}
                        style={{ 
                          fontSize: '12px', 
                          padding: '5px 10px',
                          backgroundColor: !currentUser ? '#6c757d' : '#dc3545',
                          border: `1px solid ${!currentUser ? '#6c757d' : '#dc3545'}`,
                          color: 'white',
                          opacity: !currentUser ? 0.5 : 1,
                          cursor: !currentUser ? 'not-allowed' : 'pointer'
                        }}
                        title={!currentUser ? 'Please sign in to manage files' : ''}
                      >
                        🗑️ Clear All
                      </button>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {detectedFiles.map((file, index) => (
                      <div key={index} style={{ 
                        border: file.isProcessed ? '2px solid #27ae60' : file.error ? '2px solid #e74c3c' : '1px solid #e1e8ed', 
                        borderRadius: '8px', 
                        padding: '20px',
                        backgroundColor: file.isProcessed ? '#f8fff8' : file.error ? '#fff8f8' : '#f8f9fa'
                      }}>
                        {/* File Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                              <h4 style={{ margin: 0, color: '#2c3e50' }}>{file.fileName}</h4>
                              {file.isProcessed && <span style={{ color: '#27ae60', fontSize: '14px' }}>✅ Processed</span>}
                              {file.error && <span style={{ color: '#e74c3c', fontSize: '14px' }}>❌ Error</span>}
                              {file.isProcessing && <span style={{ color: '#f39c12', fontSize: '14px' }}>⏳ Processing...</span>}
                            </div>
                            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#7f8c8d' }}>
                              {file.filePath}
                            </p>
                            <p style={{ margin: 0, fontSize: '11px', color: '#95a5a6' }}>
                              Detected: {file.timestamp.toLocaleString()}
                            </p>
                          </div>
                          {!file.isProcessed && (
                            <button 
                              className="btn btn-danger" 
                              onClick={() => handleRemoveFile(index)}
                              disabled={!currentUser}
                              style={{ 
                                fontSize: '12px', 
                                padding: '8px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: !currentUser ? '#6c757d' : '#dc3545',
                                border: `1px solid ${!currentUser ? '#6c757d' : '#dc3545'}`,
                                color: 'white',
                                opacity: !currentUser ? 0.5 : 1,
                                cursor: !currentUser ? 'not-allowed' : 'pointer'
                              }}
                              title={!currentUser ? 'Please sign in to manage files' : ''}
                            >
                              <span style={{ color: 'white', fontSize: '14px' }}>✕</span>
                              Remove
                            </button>
                          )}
                        </div>

                        {/* Processing Controls */}
                        {!file.isProcessed && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {/* Filename Selection */}
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '5px' }}>
                                📝 Filename (for OneDrive)
                              </label>
                              <input 
                                type="text" 
                                value={file.displayName}
                                onChange={(e) => currentUser && handleFileNameChange(index, e.target.value)}
                                disabled={!currentUser}
                                style={{ 
                                  width: '100%', 
                                  padding: '8px 12px', 
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '14px',
                                  backgroundColor: !currentUser ? '#f8f9fa' : '#fff',
                                  opacity: !currentUser ? 0.5 : 1,
                                  cursor: !currentUser ? 'not-allowed' : 'text'
                                }}
                                placeholder={!currentUser ? 'Please sign in to edit filename' : `Enter filename (extension will be preserved: ${file.fileName.substring(file.fileName.lastIndexOf('.'))})`}
                              />
                              <small style={{ color: '#7f8c8d', fontSize: '11px', marginTop: '2px', display: 'block' }}>
                                Original: {file.fileName} • Extension will be automatically preserved
                              </small>
                            </div>
                            
                            {/* Folder Selection */}
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '5px' }}>
                                📁 Target Folder
                              </label>
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <input 
                                  type="text" 
                                  value={file.selectedFolder}
                                  onChange={(e) => currentUser && handleFileFolderChange(index, e.target.value)}
                                  disabled={!currentUser}
                                  style={{ 
                                    flex: 1, 
                                    padding: '8px 12px', 
                                    border: '1px solid #ddd', 
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    backgroundColor: !currentUser ? '#f8f9fa' : '#fff',
                                    opacity: !currentUser ? 0.5 : 1,
                                    cursor: !currentUser ? 'not-allowed' : 'text'
                                  }}
                                  placeholder={!currentUser ? 'Please sign in to edit folder' : 'OneDrive folder path'}
                                />
                                <button 
                                  className="btn btn-secondary" 
                                  onClick={async () => {
                                    if (!currentUser) return;
                                    try {
                                      if (window.electronAPI) {
                                        // Use the actual OneDrive root folder for browsing
                                        const defaultPath = preferences.oneDriveRootFolder;
                                        const selectedPath = await window.electronAPI.selectOneDriveFolder(defaultPath);
                                        if (selectedPath) {
                                          // Convert the selected path to user-friendly format
                                          let displayPath = selectedPath;
                                          if (displayPath === '/' || displayPath === '') {
                                            displayPath = 'OneDrive Root';
                                          } else if (displayPath.includes('\\')) {
                                            // Convert Windows path to user-friendly format
                                            displayPath = displayPath
                                              .replace(/^E:\\365\\/, '') // Remove E:\365\ prefix
                                              .replace(/\\/g, '/'); // Convert backslashes to forward slashes
                                          }
                                          handleFileFolderChange(index, displayPath);
                                        }
                                      }
                                    } catch (error) {
                                      console.error('[APP] Error selecting folder:', error);
                                    }
                                  }}
                                  disabled={!currentUser}
                                  style={{ 
                                    fontSize: '12px', 
                                    padding: '8px 12px', 
                                    whiteSpace: 'nowrap',
                                    opacity: !currentUser ? 0.5 : 1,
                                    cursor: !currentUser ? 'not-allowed' : 'pointer'
                                  }}
                                  title={!currentUser ? 'Please sign in to select folders' : ''}
                                >
                                  📁 Browse
                                </button>
                                {detectedFiles.length > 1 && (
                                  <button 
                                    className="btn btn-info" 
                                    onClick={() => handleApplyFolderToAll(file.selectedFolder)}
                                    disabled={!currentUser}
                                    style={{ 
                                      fontSize: '12px', 
                                      padding: '8px 12px', 
                                      whiteSpace: 'nowrap',
                                      backgroundColor: !currentUser ? '#6c757d' : '#17a2b8',
                                      border: `1px solid ${!currentUser ? '#6c757d' : '#17a2b8'}`,
                                      color: 'white',
                                      opacity: !currentUser ? 0.5 : 1,
                                      cursor: !currentUser ? 'not-allowed' : 'pointer'
                                    }}
                                    title={!currentUser ? 'Please sign in to manage files' : 'Apply this folder to all files'}
                                  >
                                    📋 Apply to All
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Tag Selection */}
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '5px' }}>
                                🏷️ Tags ({file.selectedTags.length} selected)
                              </label>
                              <div style={{ 
                                border: '1px solid #ddd', 
                                borderRadius: '4px', 
                                padding: '10px', 
                                maxHeight: '150px', 
                                overflowY: 'auto',
                                backgroundColor: '#fff'
                              }}>
                                {tagCategories.length > 0 ? (
                                  tagCategories
                                    .filter(category => category.tags && category.tags.filter((tag: any) => tag.tag_type === 'file' || tag.tag_type === 'both').length > 0)
                                    .map(category => (
                                    <div key={category.id} style={{ marginBottom: '10px' }}>
                                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#7f8c8d', marginBottom: '5px', textTransform: 'uppercase' }}>
                                        {category.name}
                                      </div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                        {category.tags?.filter((tag: any) => tag.tag_type === 'file' || tag.tag_type === 'both').map((tag: any) => (
                                          <button
                                            key={tag.id}
                                            onClick={() => currentUser && handleFileTagToggle(index, tag.id)}
                                            disabled={!currentUser}
                                            style={{
                                              padding: '4px 8px',
                                              fontSize: '11px',
                                              border: '1px solid #ddd',
                                              borderRadius: '12px',
                                              backgroundColor: file.selectedTags.includes(tag.id) ? '#3498db' : '#fff',
                                              color: file.selectedTags.includes(tag.id) ? '#fff' : '#333',
                                              cursor: !currentUser ? 'not-allowed' : 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              opacity: !currentUser ? 0.5 : 1
                                            }}
                                            title={!currentUser ? 'Please sign in to select tags' : ''}
                                          >
                                            <span style={{ 
                                              width: '8px', 
                                              height: '8px', 
                                              borderRadius: '50%', 
                                              backgroundColor: tag.color || '#95a5a6' 
                                            }}></span>
                                            {tag.name}
                                            <span style={{ fontSize: '9px', opacity: 0.7 }}>System</span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div style={{ textAlign: 'center', color: '#7f8c8d', fontSize: '12px', padding: '20px' }}>
                                    Loading tags...
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Process Button */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <button 
                                className="btn btn-primary" 
                                onClick={() => handleProcessSingleFile(index)}
                                disabled={file.isProcessing || !currentUser}
                                style={{ 
                                  fontSize: '12px', 
                                  padding: '10px 20px',
                                  opacity: !currentUser ? 0.5 : 1,
                                  cursor: !currentUser ? 'not-allowed' : 'pointer'
                                }}
                                title={!currentUser ? 'Please sign in to process files' : ''}
                              >
                                {file.isProcessing ? '⏳ Processing...' : '🚀 Process File'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Success State */}
                        {file.isProcessed && file.result && (
                          <div style={{ 
                            border: '1px solid #27ae60', 
                            borderRadius: '6px', 
                            padding: '15px', 
                            backgroundColor: '#f8fff8',
                            marginTop: '10px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                              <span style={{ color: '#27ae60', fontSize: '16px' }}>✅</span>
                              <span style={{ color: '#27ae60', fontWeight: 'bold' }}>File Processed Successfully!</span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#2c3e50', marginBottom: '15px' }}>
                              <div><strong>File:</strong> {file.displayName}</div>
                              <div><strong>Original:</strong> {file.fileName}</div>
                              <div><strong>Tags:</strong> {file.selectedTags.length} selected</div>
                              <div><strong>Folder:</strong> {file.selectedFolder}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button 
                                className="btn btn-primary" 
                                onClick={() => handleOpenLocalFolder(file)}
                                style={{ fontSize: '12px', padding: '8px 12px' }}
                              >
                                📁 Open Local Folder
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                onClick={() => handleOpenOneDriveWebFolder(file)}
                                style={{ fontSize: '12px', padding: '8px 12px' }}
                              >
                                🌐 Open to Web Folder
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                onClick={() => handleOpenOneDriveWebFile(file)}
                                style={{ fontSize: '12px', padding: '8px 12px' }}
                              >
                                📄 Open File on OneDrive
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Error State */}
                        {file.error && (
                          <div style={{ 
                            border: '1px solid #e74c3c', 
                            borderRadius: '6px', 
                            padding: '15px', 
                            backgroundColor: '#fff8f8',
                            marginTop: '10px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                              <span style={{ color: '#e74c3c', fontSize: '16px' }}>❌</span>
                              <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>Processing Failed</span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#2c3e50', marginBottom: '15px' }}>
                              {file.error}
                            </div>
                            <button 
                              className="btn btn-primary" 
                              onClick={() => handleProcessSingleFile(index)}
                              style={{ fontSize: '12px', padding: '8px 12px' }}
                            >
                              🔄 Retry
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          
          {activeTab === 'settings' && (
            <div>
              <EnvironmentSwitcher 
                onEnvironmentChange={handleEnvironmentChange} 
                currentEnvironment={currentEnvironment}
              />
              
              <div className="form-group">
                <label className="form-label">Drop Folder Path</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={preferences.dropFolderPath}
                    readOnly
                    placeholder="Select a folder for file processing"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button 
                    className="btn btn-primary" 
                    onClick={handleSelectDropFolder}
                    disabled={isLoading}
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {isLoading ? '⏳' : '📁'} Select Folder
                  </button>
                </div>
                {preferences.dropFolderPath && (
                  <p style={{ color: '#27ae60', fontSize: '12px', marginTop: '5px' }}>
                    ✅ Drop folder configured: {preferences.dropFolderPath}
                  </p>
                )}
              </div>
              
              <div className="form-group">
                <label className="form-label">OneDrive Root Folder</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={preferences.oneDriveRootFolder}
                    onChange={(e) => {
                      const newPrefs = { ...preferences, oneDriveRootFolder: e.target.value };
                      setPreferences(newPrefs);
                      savePreferences(newPrefs);
                    }}
                    placeholder="Default OneDrive root folder"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleSelectOneDriveRootFolder}
                    disabled={isLoading}
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {isLoading ? '⏳' : '📁'} Select Folder
                  </button>
                </div>
                {preferences.oneDriveRootFolder && preferences.oneDriveRootFolder !== '/' && (
                  <p style={{ color: '#27ae60', fontSize: '12px', marginTop: '5px' }}>
                    ✅ OneDrive root configured: {preferences.oneDriveRootFolder}
                  </p>
                )}
              </div>
              
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input 
                    type="checkbox" 
                    checked={preferences.autoProcess}
                    onChange={(e) => {
                      const newPrefs = { ...preferences, autoProcess: e.target.checked };
                      setPreferences(newPrefs);
                      savePreferences(newPrefs);
                    }}
                  />
                  Auto-process files when detected
                </label>
              </div>
              
              <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Status</h4>
                <p style={{ margin: '5px 0', fontSize: '14px' }}>
                  <strong>API:</strong> {API_BASE_URL}
                </p>
                <p style={{ margin: '5px 0', fontSize: '14px' }}>
                  <strong>Drop Folder:</strong> {preferences.dropFolderPath || 'Not configured'}
                </p>
                <p style={{ margin: '5px 0', fontSize: '14px' }}>
                  <strong>Auto Process:</strong> {preferences.autoProcess ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;