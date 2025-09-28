import { AuthService, UserInfo } from './authService';
import axios from 'axios';

export interface OneDriveFile {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

export interface OneDriveFolder {
  id: string;
  name: string;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

export class OneDriveService {
  private authService: AuthService;
  private currentDriveId: string | null = null;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  /**
   * Get user's default OneDrive drive
   */
  async getDefaultDrive(): Promise<{ id: string; name: string }> {
    try {
      console.log('[ONEDRIVE:DESKTOP] Getting default OneDrive drive...');
      
      const drives = await this.authService.getOneDriveDrives();
      console.log('[ONEDRIVE:DESKTOP] Available drives:', JSON.stringify(drives, null, 2));
      
      // Find personal OneDrive drive
      let personalDrive = drives.find((drive: any) => 
        drive.driveType === 'personal'
      );

      // If no personal drive found, try to find any drive with OneDrive in the name
      if (!personalDrive) {
        personalDrive = drives.find((drive: any) => 
          drive.name && drive.name.toLowerCase().includes('onedrive')
        );
      }

      // If still no drive found, use the first available drive
      if (!personalDrive && drives.length > 0) {
        personalDrive = drives[0];
        console.log('[ONEDRIVE:DESKTOP] Using first available drive:', personalDrive.name);
      }

      if (!personalDrive) {
        throw new Error('No OneDrive drives found. Available drives: ' + JSON.stringify(drives));
      }

      this.currentDriveId = personalDrive.id;
      console.log('[ONEDRIVE:DESKTOP] Found OneDrive:', personalDrive.name, personalDrive.id);
      
      return {
        id: personalDrive.id,
        name: personalDrive.name || 'OneDrive'
      };
    } catch (error) {
      console.error('[ONEDRIVE:DESKTOP] Error getting default drive:', error);
      throw error;
    }
  }

  /**
   * Upload file to OneDrive
   */
  async uploadFile(
    filePath: string, 
    fileName: string, 
    folderPath: string = 'root'
  ): Promise<OneDriveFile> {
    try {
      console.log('[ONEDRIVE:DESKTOP] Uploading file:', fileName, 'to folder:', folderPath);
      
      const accessToken = await this.authService.getAccessToken();
      const driveId = this.currentDriveId || (await this.getDefaultDrive()).id;
      
      // Read file
      const fs = require('fs');
      const fileBuffer = fs.readFileSync(filePath);
      
      console.log('[ONEDRIVE:DESKTOP] File size:', fileBuffer.length, 'bytes');
      
      // Convert folder path to proper OneDrive format
      let targetPath = 'root';
      if (folderPath && folderPath !== 'root' && folderPath !== '') {
        console.log('[ONEDRIVE:DESKTOP] Original folderPath:', folderPath);
        
        // Convert Windows path to OneDrive path
        if (folderPath.includes('\\')) {
          // Handle Windows paths with backslashes
          targetPath = folderPath
            .replace(/^E:\\365\\/, '') // Remove E:\365\ prefix
            .replace(/\\/g, '/'); // Convert backslashes to forward slashes
          
          // Remove OneDrive - Broadlink prefix if present
          if (targetPath.startsWith('OneDrive - Broadlink/')) {
            targetPath = targetPath.substring('OneDrive - Broadlink/'.length);
          }
          console.log('[ONEDRIVE:DESKTOP] After Windows path conversion:', targetPath);
        } else {
          // Handle paths that are already in forward slash format
          console.log('[ONEDRIVE:DESKTOP] Processing forward slash path:', folderPath);
          targetPath = folderPath.startsWith('OneDrive - Broadlink/') 
            ? folderPath.substring('OneDrive - Broadlink/'.length)
            : folderPath;
          console.log('[ONEDRIVE:DESKTOP] After forward slash conversion:', targetPath);
        }
      }
      
      console.log('[ONEDRIVE:DESKTOP] Final targetPath:', targetPath);
      
      try {
        // Create upload session for the target folder
        const sessionUrl = targetPath === 'root' 
          ? `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${fileName}:/createUploadSession`
          : `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${targetPath}/${fileName}:/createUploadSession`;
        console.log('[ONEDRIVE:DESKTOP] Creating upload session:', sessionUrl);
        
        const sessionData = {
          item: {
            name: fileName,
            file: {}
          }
        };
        
        const sessionResponse = await axios.post(sessionUrl, sessionData, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('[ONEDRIVE:DESKTOP] Session response:', JSON.stringify(sessionResponse.data, null, 2));
        
        const sessionUploadUrl = sessionResponse.data.uploadUrl;
        console.log('[ONEDRIVE:DESKTOP] Upload session created, uploading to:', sessionUploadUrl);
        
        // Upload file content to session URL
        const uploadResponse = await axios.put(sessionUploadUrl, fileBuffer, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': fileBuffer.length.toString()
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });
        
        console.log('[ONEDRIVE:DESKTOP] Upload completed via session');
        console.log('[ONEDRIVE:DESKTOP] Upload response:', JSON.stringify(uploadResponse.data, null, 2));
        
        return this.handleUploadResponse(uploadResponse);
        
      } catch (error: any) {
        console.log('[ONEDRIVE:DESKTOP] Upload session failed, trying simple root upload...');
        
        // Fallback: Try simple upload to target folder
        try {
          const fallbackUploadUrl = targetPath === 'root'
            ? `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${fileName}:/content`
            : `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${targetPath}/${fileName}:/content`;
          console.log('[ONEDRIVE:DESKTOP] Trying simple upload:', fallbackUploadUrl);
          
          const response = await axios.put(fallbackUploadUrl, fileBuffer, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/octet-stream',
              'Content-Length': fileBuffer.length.toString()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          });
          
          console.log('[ONEDRIVE:DESKTOP] Simple upload successful');
          return this.handleUploadResponse(response);
          
        } catch (fallbackError: any) {
          console.log('[ONEDRIVE:DESKTOP] All upload methods failed');
          throw fallbackError;
        }
      }
    } catch (error: any) {
      console.error('[ONEDRIVE:DESKTOP] Error uploading file:', error);
      
      // Provide more detailed error information
      if (error.response) {
        console.error('[ONEDRIVE:DESKTOP] Response status:', error.response.status);
        console.error('[ONEDRIVE:DESKTOP] Response data:', JSON.stringify(error.response.data, null, 2));
        console.error('[ONEDRIVE:DESKTOP] Response headers:', error.response.headers);
        
        throw new Error(`Upload failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        console.error('[ONEDRIVE:DESKTOP] Request error:', error.request);
        throw new Error('Network error during upload: ' + error.message);
      } else {
        throw new Error('Upload error: ' + error.message);
      }
    }
  }

  /**
   * Handle upload response
   */
  private handleUploadResponse(response: any): OneDriveFile {
    if (response.status >= 200 && response.status < 300) {
      const result = response.data;
      console.log('[ONEDRIVE:DESKTOP] Upload successful:', {
        id: result.id,
        name: result.name,
        webUrl: result.webUrl,
        size: result.size
      });
      
      return {
        id: result.id,
        name: result.name,
        webUrl: result.webUrl,
        size: result.size,
        createdDateTime: result.createdDateTime,
        lastModifiedDateTime: result.lastModifiedDateTime
      };
    } else {
      throw new Error(`Upload failed with status ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Create folder in OneDrive
   */
  async createFolder(folderName: string, parentFolderId: string = 'root'): Promise<OneDriveFolder> {
    try {
      console.log('[ONEDRIVE:DESKTOP] Creating folder:', folderName, 'in parent:', parentFolderId);
      
      const accessToken = await this.authService.getAccessToken();
      const driveId = this.currentDriveId || (await this.getDefaultDrive()).id;
      
      const createUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${parentFolderId}/children`;
      
      const folderData = {
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename'
      };
      
      const response = await axios.post(createUrl, folderData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status >= 200 && response.status < 300) {
        const result = response.data;
        console.log('[ONEDRIVE:DESKTOP] Folder created successfully:', result.name, result.id);
        
        return {
          id: result.id,
          name: result.name,
          webUrl: result.webUrl,
          createdDateTime: result.createdDateTime,
          lastModifiedDateTime: result.lastModifiedDateTime
        };
      } else {
        throw new Error(`Folder creation failed with status ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[ONEDRIVE:DESKTOP] Error creating folder:', error);
      throw error;
    }
  }

  /**
   * Find folder by path in OneDrive
   */
  async findFolderByPath(folderPath: string): Promise<OneDriveFolder | null> {
    try {
      console.log('[ONEDRIVE:DESKTOP] Finding folder by path:', folderPath);
      
      const accessToken = await this.authService.getAccessToken();
      const driveId = this.currentDriveId || (await this.getDefaultDrive()).id;
      
      // Convert Windows path to OneDrive path format
      let cleanPath = folderPath;
      if (cleanPath.includes(':')) {
        // Remove drive letter
        cleanPath = cleanPath.substring(cleanPath.indexOf(':') + 1);
      }
      // Convert backslashes to forward slashes and clean up
      cleanPath = cleanPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
      
      console.log('[ONEDRIVE:DESKTOP] Cleaned path:', cleanPath);
      
      // Try to get folder by path
      const getUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${cleanPath}`;
      
      try {
        const response = await axios.get(getUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        });
        
        const folder = response.data;
        console.log('[ONEDRIVE:DESKTOP] Found folder:', folder.name, folder.id);
        
        return {
          id: folder.id,
          name: folder.name,
          webUrl: folder.webUrl,
          createdDateTime: folder.createdDateTime,
          lastModifiedDateTime: folder.lastModifiedDateTime
        };
      } catch (getError: any) {
        if (getError.response?.status === 404) {
          console.log('[ONEDRIVE:DESKTOP] Folder not found by path, trying to create...');
          
          // Try to create the folder structure
          const pathParts = cleanPath.split('/').filter(part => part.length > 0);
          let currentFolderId = 'root';
          
          for (const part of pathParts) {
            try {
              const folder = await this.createFolder(part, currentFolderId);
              currentFolderId = folder.id;
            } catch (createError) {
              console.error('[ONEDRIVE:DESKTOP] Error creating folder part:', part, createError);
              return null;
            }
          }
          
          // Return the last created folder
          const finalResponse = await axios.get(`https://graph.microsoft.com/v1.0/drives/${driveId}/items/${currentFolderId}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            }
          });
          
          const finalFolder = finalResponse.data;
          return {
            id: finalFolder.id,
            name: finalFolder.name,
            webUrl: finalFolder.webUrl,
            createdDateTime: finalFolder.createdDateTime,
            lastModifiedDateTime: finalFolder.lastModifiedDateTime
          };
        } else {
          throw getError;
        }
      }
    } catch (error) {
      console.error('[ONEDRIVE:DESKTOP] Error finding folder by path:', error);
      return null;
    }
  }

  /**
   * Get folder contents
   */
  async getFolderContents(folderId: string = 'root'): Promise<(OneDriveFile | OneDriveFolder)[]> {
    try {
      console.log('[ONEDRIVE:DESKTOP] Getting folder contents for:', folderId);
      
      const accessToken = await this.authService.getAccessToken();
      const driveId = this.currentDriveId || (await this.getDefaultDrive()).id;
      
      const childrenUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/children`;
      
      const response = await axios.get(childrenUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });

      const items = response.data.value || [];
      console.log('[ONEDRIVE:DESKTOP] Found', items.length, 'items in folder');
      
      return items.map((item: any) => ({
        id: item.id,
        name: item.name,
        webUrl: item.webUrl,
        size: item.size || 0,
        createdDateTime: item.createdDateTime,
        lastModifiedDateTime: item.lastModifiedDateTime
      }));
    } catch (error) {
      console.error('[ONEDRIVE:DESKTOP] Error getting folder contents:', error);
      throw error;
    }
  }
}
