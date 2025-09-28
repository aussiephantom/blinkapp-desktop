import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';

export interface FileTag {
  id: number;
  name: string;
  color: string;
  category_id: number;
}

export interface FileTagCategory {
  id: number;
  name: string;
  color: string;
  tags?: FileTag[];
}

export interface UploadResponse {
  success: boolean;
  file_id: string;
  one_drive_id: string;
  message: string;
  associations?: any[];
}

export class ApiClient {
  private client = axios.create({
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': '1',
      'x-test-user-name': 'Desktop App User',
      'x-test-user-is-admin': 'true'
    }
  });

  private getMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'txt': 'text/plain',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed'
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  public async getTags(apiBaseUrl: string): Promise<FileTag[]> {
    try {
      console.log('[APICLIENT] Fetching tags from:', `${apiBaseUrl}/api/file-tags`);
      
      const response: AxiosResponse<FileTag[]> = await this.client.get(
        `${apiBaseUrl}/api/file-tags`
      );

      console.log('[APICLIENT] Retrieved', response.data.length, 'tags');
      return response.data;
    } catch (error) {
      console.error('[APICLIENT] Error fetching tags:', error);
      return [];
    }
  }

  public async getTagCategories(apiBaseUrl: string): Promise<FileTagCategory[]> {
    try {
      console.log('[APICLIENT] Fetching tag categories from:', `${apiBaseUrl}/api/file-tag-categories`);
      console.log('[APICLIENT] Request headers:', JSON.stringify(this.client.defaults.headers, null, 2));
      
      // Get categories and tags in parallel
      const [categoriesResponse, tagsResponse] = await Promise.all([
        this.client.get(`${apiBaseUrl}/api/file-tag-categories`),
        this.client.get(`${apiBaseUrl}/api/file-tags`)
      ]);

      console.log('[APICLIENT] Categories response status:', categoriesResponse.status);
      console.log('[APICLIENT] Categories response data:', JSON.stringify(categoriesResponse.data, null, 2));
      console.log('[APICLIENT] Tags response status:', tagsResponse.status);
      console.log('[APICLIENT] Tags response data:', JSON.stringify(tagsResponse.data, null, 2));

      const categories: FileTagCategory[] = categoriesResponse.data;
      const tags: FileTag[] = tagsResponse.data;

      console.log('[APICLIENT] Retrieved', categories.length, 'categories and', tags.length, 'tags');

      // Group tags by category
      const categoriesWithTags = categories.map(category => ({
        ...category,
        tags: tags.filter(tag => tag.category_id === category.id)
      }));

      return categoriesWithTags;
    } catch (error) {
      console.error('[APICLIENT] Error fetching tag categories:', error);
      return [];
    }
  }

  public async uploadFileWithTags(
    apiBaseUrl: string,
    fileData: {
      filePath: string;
      tags: number[];
      folderPath?: string;
      entityId?: number;
      transactionId?: number;
      stageKey?: string;
      notes?: string;
    }
  ): Promise<UploadResponse> {
    try {
      console.log('[APICLIENT] Uploading file with tags:', fileData.filePath);

      const formData = new FormData();

      // Add file
      const fileStream = fs.createReadStream(fileData.filePath);
      formData.append('file', fileStream, {
        filename: require('path').basename(fileData.filePath),
        contentType: this.getMimeType(fileData.filePath)
      });

      // Add metadata
      formData.append('tags', JSON.stringify(fileData.tags));
      if (fileData.folderPath) {
        formData.append('folder_path', fileData.folderPath);
      }
      if (fileData.entityId) {
        formData.append('entity_id', fileData.entityId.toString());
      }
      if (fileData.transactionId) {
        formData.append('transaction_id', fileData.transactionId.toString());
      }
      if (fileData.stageKey) {
        formData.append('stage_key', fileData.stageKey);
      }
      if (fileData.notes) {
        formData.append('notes', fileData.notes);
      }

      const response: AxiosResponse<UploadResponse> = await this.client.post(
        `${apiBaseUrl}/api/oneDrive/upload-with-tags`,
        formData,
        {
          headers: {
            ...formData.getHeaders()
          },
          timeout: 60000 // Longer timeout for file uploads
        }
      );

      console.log('[APICLIENT] Upload successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('[APICLIENT] Error uploading file:', error);
      throw new Error('Failed to upload file');
    }
  }
}
