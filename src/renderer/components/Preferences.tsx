import React, { useState, useEffect } from 'react';

interface UserPreferences {
  dropFolderPath: string;
  autoProcessFiles: boolean;
  notificationEnabled: boolean;
  apiBaseUrl: string;
  oneDriveRootFolder: string;
}

interface PreferencesProps {
  preferences: UserPreferences | null;
  onPreferencesChange: (preferences: UserPreferences) => void;
}

export const Preferences: React.FC<PreferencesProps> = ({
  preferences,
  onPreferencesChange
}) => {
  const [formData, setFormData] = useState<UserPreferences>({
    dropFolderPath: '',
    autoProcessFiles: true,
    notificationEnabled: true,
    apiBaseUrl: 'https://blink-api-sigma.vercel.app',
    oneDriveRootFolder: '/'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');

  useEffect(() => {
    if (preferences) {
      setFormData(preferences);
    }
  }, [preferences]);


  const handleInputChange = (field: keyof UserPreferences, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSelectDropFolder = async () => {
    try {
      const selectedPath = await window.electronAPI.selectOneDriveFolder();
      if (selectedPath) {
        handleInputChange('dropFolderPath', selectedPath);
      }
    } catch (error) {
      console.error('Error selecting drop folder:', error);
    }
  };

  const handleSelectOneDriveRoot = async () => {
    try {
      const selectedPath = await window.electronAPI.selectOneDriveFolder();
      if (selectedPath) {
        handleInputChange('oneDriveRootFolder', selectedPath);
      }
    } catch (error) {
      console.error('Error selecting OneDrive root folder:', error);
    }
  };

  const handleTestConnection = async () => {
    try {
      setIsLoading(true);
      setConnectionStatus('unknown');
      
      const response = await fetch(`${formData.apiBaseUrl}/api/health`);
      setConnectionStatus(response.ok ? 'connected' : 'disconnected');
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus('disconnected');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      await onPreferencesChange(formData);
      alert('Preferences saved successfully!');
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Error saving preferences. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return '🟢';
      case 'disconnected':
        return '🔴';
      default:
        return '🟡';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="preferences">
      <h2>Settings</h2>
      
      <div className="preferences-form">
        <div className="form-group">
          <label className="form-label">Drop Folder Path</label>
          <div className="input-group">
            <input
              type="text"
              className="form-input"
              value={formData.dropFolderPath}
              onChange={(e) => handleInputChange('dropFolderPath', e.target.value)}
              placeholder="Select a folder to monitor for new files"
            />
            <button
              className="btn btn-secondary"
              onClick={handleSelectDropFolder}
            >
              Browse
            </button>
          </div>
          <p className="form-help">
            Files dropped into this folder will be automatically detected and queued for processing.
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">API Base URL</label>
          <div className="input-group">
            <input
              type="url"
              className="form-input"
              value={formData.apiBaseUrl}
              onChange={(e) => handleInputChange('apiBaseUrl', e.target.value)}
              placeholder="https://your-api-url.com"
            />
            <button
              className="btn btn-secondary"
              onClick={handleTestConnection}
              disabled={isLoading}
            >
              {isLoading ? 'Testing...' : 'Test'}
            </button>
          </div>
          <div className="connection-status">
            {getConnectionStatusIcon()} {getConnectionStatusText()}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">OneDrive Root Folder</label>
          <div className="input-group">
            <input
              type="text"
              className="form-input"
              value={formData.oneDriveRootFolder}
              onChange={(e) => handleInputChange('oneDriveRootFolder', e.target.value)}
              placeholder="Select OneDrive root folder"
              readOnly
            />
            <button
              className="btn btn-secondary"
              onClick={handleSelectOneDriveRoot}
            >
              Select Folder
            </button>
          </div>
          <small className="form-help">
            The default folder to start from when selecting where to save files. This will be used as the starting point for the folder selection dialog.
          </small>
        </div>


        <div className="form-group">
          <label className="form-label">
            <input
              type="checkbox"
              className="form-checkbox"
              checked={formData.autoProcessFiles}
              onChange={(e) => handleInputChange('autoProcessFiles', e.target.checked)}
            />
            Auto-process files
          </label>
          <p className="form-help">
            Automatically process files when they are detected in the drop folder.
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">
            <input
              type="checkbox"
              className="form-checkbox"
              checked={formData.notificationEnabled}
              onChange={(e) => handleInputChange('notificationEnabled', e.target.checked)}
            />
            Enable notifications
          </label>
          <p className="form-help">
            Show desktop notifications when files are detected and processed.
          </p>
        </div>

        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
};
