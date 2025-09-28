import React from 'react';

interface FolderSelectorProps {
  rootFolder: string;
  selectedFolder: string | null;
  onFolderChange: (folderPath: string | null) => void;
}

export const FolderSelector: React.FC<FolderSelectorProps> = ({
  rootFolder,
  selectedFolder,
  onFolderChange
}) => {
  const handleSelectFolder = async () => {
    try {
      const selectedPath = await window.electronAPI.selectOneDriveFolder();
      if (selectedPath) {
        onFolderChange(selectedPath);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  };

  const getDisplayPath = (path: string | null): string => {
    if (!path) return 'No folder selected';
    
    // Convert Windows path to a more readable format
    const pathParts = path.split('\\');
    if (pathParts.length > 3) {
      // Show last 3 parts for readability
      return '...' + pathParts.slice(-3).join('\\');
    }
    return path;
  };

  return (
    <div className="folder-selector">
      <div className="folder-display">
        <div className="folder-path-display">
          <span className="folder-icon">📁</span>
          <span className="folder-path">{getDisplayPath(selectedFolder)}</span>
        </div>
        <button
          className="btn btn-secondary"
          onClick={handleSelectFolder}
        >
          Select Folder
        </button>
      </div>
      
      {selectedFolder && (
        <div className="selected-folder-info">
          <p><strong>Selected folder:</strong> {selectedFolder}</p>
        </div>
      )}
    </div>
  );
};
