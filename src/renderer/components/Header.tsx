import React, { useState, useEffect } from 'react';

interface HeaderProps {
  // Add any props if needed
}

export const Header: React.FC<HeaderProps> = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<string>('');
  const [dropFolderPath, setDropFolderPath] = useState<string>('');

  useEffect(() => {
    // Check connection status
    checkConnectionStatus();
    
    // Update last sync time
    setLastSync(new Date().toLocaleTimeString());
    
    // Update sync time every minute
    const interval = setInterval(() => {
      setLastSync(new Date().toLocaleTimeString());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const preferences = await window.electronAPI.getPreferences();
      if (preferences?.apiBaseUrl) {
        // Test connection to API
        const response = await fetch(`${preferences.apiBaseUrl}/api/health`);
        setIsConnected(response.ok);
      }
      
      // Load drop folder path
      if (preferences?.dropFolderPath) {
        setDropFolderPath(preferences.dropFolderPath);
      }
    } catch (error) {
      setIsConnected(false);
    }
  };

  const handleRefresh = () => {
    checkConnectionStatus();
    setLastSync(new Date().toLocaleTimeString());
  };

  const handleOpenFolder = () => {
    if (dropFolderPath) {
      window.electronAPI.showFileInExplorer(dropFolderPath);
    } else {
      alert('Drop folder not configured. Please set up a drop folder in Settings.');
    }
  };

  return (
    <header className="header">
      <div>
        <h1>BrokerNet Desktop</h1>
        <div className="status-indicator">
          <div className={`status-dot ${isConnected ? '' : 'disconnected'}`}></div>
          <span>
            {isConnected ? 'Connected' : 'Disconnected'} • Last sync: {lastSync}
          </span>
        </div>
      </div>
      <div className="header-actions">
        <button 
          className="btn btn-secondary"
          onClick={handleRefresh}
          title="Refresh connection"
        >
          🔄 Refresh
        </button>
        <button 
          className="btn btn-secondary"
          onClick={handleOpenFolder}
          title="Open drop folder"
          disabled={!dropFolderPath}
        >
          📁 Open Folder
        </button>
      </div>
    </header>
  );
};
