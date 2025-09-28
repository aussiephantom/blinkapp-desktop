import React, { useState, useEffect } from 'react';
import { TagSelector } from './TagSelector';
import { FolderSelector } from './FolderSelector';
import { TransactionSelector } from './TransactionSelector';

interface FileData {
  id: string;
  path: string;
  name: string;
  size: number;
}

interface UserPreferences {
  dropFolderPath: string;
  autoProcessFiles: boolean;
  notificationEnabled: boolean;
  apiBaseUrl: string;
  oneDriveRootFolder: string;
}

interface FileTag {
  id: number;
  name: string;
  description?: string;
  color: string;
  category_id: number;
}

interface Entity {
  entity_id: number;
  entity_name: string;
  trading_name?: string;
}

interface Transaction {
  transaction_id: number;
  transaction_name: string;
  entity_id: number;
  status: string;
}

interface FileProcessorProps {
  files: FileData[];
  preferences: UserPreferences;
  onFileProcessed: (fileId: string) => void;
}

export const FileProcessor: React.FC<FileProcessorProps> = ({
  files,
  preferences,
  onFileProcessed
}) => {
  const [tags, setTags] = useState<FileTag[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const tagsData = await window.electronAPI.getTagCategories();
      setTags(tagsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileProcess = async (file: FileData, selectedTags: number[], folderPath?: string) => {
    try {
      setIsLoading(true);
      
      const fileData = {
        filePath: file.path,
        tags: selectedTags,
        folderPath,
        stageKey: 'settlement', // Default stage
        notes: `Processed via BrokerNet Desktop on ${new Date().toLocaleString()}`
      };

      const result = await window.electronAPI.processFile(
        fileData.filePath,
        fileData.tags,
        fileData.folderPath
      );
      
      if (result.success) {
        onFileProcessed(file.id);
        // Show success notification
        console.log('File processed successfully:', result);
      } else {
        throw new Error(result.message || 'Failed to process file');
      }
    } catch (error) {
      console.error('Error processing file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Error processing file: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileCancel = async (file: FileData) => {
    try {
      // Delete the file from the drop folder
      await window.electronAPI.deleteFile(file.path);
      
      // Remove from processing queue
      onFileProcessed(file.id);
      
      console.log('File cancelled and deleted:', file.name);
    } catch (error) {
      console.error('Error cancelling file:', error);
      alert(`Error cancelling file: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading && files.length === 0) {
    return (
      <div className="file-processor">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading file processor...</p>
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="file-processor">
        <h2>File Processor</h2>
        <div className="empty-state">
          <div className="empty-state-icon">📁</div>
          <h3>No files to process</h3>
          <p>Drop files into your drop folder to get started</p>
          <p><strong>Drop folder:</strong> {preferences.dropFolderPath || 'Not configured'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="file-processor">
      <h2>File Processor</h2>
      <div className="file-list">
        {files.map((file) => (
          <FileProcessorItem
            key={file.id}
            file={file}
            tags={tags}
            selectedFolder={selectedFolder}
            preferences={preferences}
            onFolderChange={setSelectedFolder}
            onProcess={handleFileProcess}
            onCancel={handleFileCancel}
            isLoading={isLoading}
            formatFileSize={formatFileSize}
          />
        ))}
      </div>
    </div>
  );
};

interface FileProcessorItemProps {
  file: FileData;
  tags: FileTag[];
  selectedFolder: string | null;
  preferences: UserPreferences;
  onFolderChange: (folderPath: string | null) => void;
  onProcess: (file: FileData, tags: number[], folderPath?: string) => void;
  onCancel: (file: FileData) => void;
  isLoading: boolean;
  formatFileSize: (bytes: number) => string;
}

const FileProcessorItem: React.FC<FileProcessorItemProps> = ({
  file,
  tags,
  selectedFolder,
  preferences,
  onFolderChange,
  onProcess,
  onCancel,
  isLoading,
  formatFileSize
}) => {
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [isExpanded, setIsExpanded] = useState(true); // Expanded by default

  const handleTagToggle = (tagId: number) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleProcess = () => {
    if (selectedTags.length === 0) {
      alert('Please select at least one tag');
      return;
    }
    if (!selectedFolder) {
      alert('Please select a folder to save the file');
      return;
    }
    onProcess(file, selectedTags, selectedFolder);
  };

  const handleCancel = () => {
    const confirmed = window.confirm(
      `Are you sure you want to cancel processing "${file.name}"?\n\n` +
      `This will DELETE the file from the drop folder and remove it from the processing queue.\n\n` +
      `This action cannot be undone.`
    );
    
    if (confirmed) {
      onCancel(file);
    }
  };

  return (
    <div className="file-item">
      <div className="file-item-header">
        <div>
          <div className="file-name">{file.name}</div>
          <div className="file-size">{formatFileSize(file.size)}</div>
        </div>
            <div className="file-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? '▼' : '▶'} {isExpanded ? 'Collapse' : 'Expand'}
              </button>
              <button
                className="btn btn-danger"
                onClick={handleCancel}
                disabled={isLoading}
              >
                ❌ Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleProcess}
                disabled={isLoading || selectedTags.length === 0 || !selectedFolder}
              >
                {isLoading ? '⏳ Processing...' : '✅ Process File'}
              </button>
            </div>
      </div>
      
      <div className="file-path">{file.path}</div>
      
          {isExpanded && (
            <div className="file-processor-form">
              <div className="form-group">
                <label className="form-label">Select Folder:</label>
                <FolderSelector
                  rootFolder={preferences?.oneDriveRootFolder || '/'}
                  selectedFolder={selectedFolder}
                  onFolderChange={onFolderChange}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Select Tags:</label>
                <TagSelector
                  tags={tags}
                  selectedTags={selectedTags}
                  onTagToggle={handleTagToggle}
                />
              </div>
          
        </div>
      )}
    </div>
  );
};
