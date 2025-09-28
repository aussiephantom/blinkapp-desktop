import React, { useState, useEffect } from 'react';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

interface UpdateNotificationProps {
  onInstallUpdate: () => void;
  onDismiss: () => void;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onInstallUpdate, onDismiss }) => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (window.electronAPI) {
      // Listen for update available
      window.electronAPI.onUpdateAvailable((info: UpdateInfo) => {
        console.log('[UPDATE] Update available:', info);
        setUpdateInfo(info);
      });

      // Listen for download progress
      window.electronAPI.onDownloadProgress((progress: any) => {
        console.log('[UPDATE] Download progress:', progress);
        setDownloadProgress(progress.percent);
        setIsDownloading(true);
      });

      // Listen for update downloaded
      window.electronAPI.onUpdateDownloaded((info: UpdateInfo) => {
        console.log('[UPDATE] Update downloaded:', info);
        setIsDownloading(false);
        setDownloadProgress(100);
      });
    }
  }, []);

  if (!updateInfo) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: '#fff',
      border: '1px solid #d9d9d9',
      borderRadius: '8px',
      padding: '16px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      zIndex: 1000,
      minWidth: '300px',
      maxWidth: '400px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{
          width: '24px',
          height: '24px',
          background: '#52c41a',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: '8px'
        }}>
          <span style={{ color: 'white', fontSize: '14px' }}>↻</span>
        </div>
        <h3 style={{ margin: 0, fontSize: '16px', color: '#262626' }}>
          Update Available
        </h3>
      </div>

      <p style={{ margin: '0 0 12px 0', color: '#595959', fontSize: '14px' }}>
        BrokerNet Desktop v{updateInfo.version} is available for download.
      </p>

      {isDownloading && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            background: '#f0f0f0',
            borderRadius: '4px',
            height: '8px',
            overflow: 'hidden',
            marginBottom: '4px'
          }}>
            <div style={{
              background: '#1890ff',
              height: '100%',
              width: `${downloadProgress}%`,
              transition: 'width 0.3s ease'
            }} />
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#8c8c8c' }}>
            Downloading... {Math.round(downloadProgress)}%
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={onDismiss}
          style={{
            padding: '6px 12px',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            background: '#fff',
            color: '#595959',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Later
        </button>
        <button
          onClick={onInstallUpdate}
          disabled={isDownloading}
          style={{
            padding: '6px 12px',
            border: 'none',
            borderRadius: '4px',
            background: isDownloading ? '#d9d9d9' : '#1890ff',
            color: 'white',
            cursor: isDownloading ? 'not-allowed' : 'pointer',
            fontSize: '12px'
          }}
        >
          {isDownloading ? 'Downloading...' : 'Install Update'}
        </button>
      </div>
    </div>
  );
};

export default UpdateNotification;
