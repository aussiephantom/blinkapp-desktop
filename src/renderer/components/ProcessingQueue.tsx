import React, { useState, useEffect } from 'react';

interface ProcessingQueueItem {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: string;
  processedAt?: string;
}

export const ProcessingQueue: React.FC = () => {
  const [queueItems, setQueueItems] = useState<ProcessingQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadQueueItems();
    
    // Refresh every 5 seconds
    const interval = setInterval(loadQueueItems, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadQueueItems = async () => {
    try {
      const items: any[] = []; // Mock for now - queue functionality not implemented
      setQueueItems(items);
    } catch (error) {
      console.error('Error loading queue items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async (fileId: string) => {
    try {
      // Mock retry functionality
      console.log('Retrying file processing for file:', fileId);
      loadQueueItems(); // Refresh the queue
    } catch (error) {
      console.error('Error retrying file processing:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'processing':
        return '🔄';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '❓';
    }
  };

  if (isLoading) {
    return (
      <div className="processing-queue">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading processing queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="processing-queue">
      <h2>Processing Queue</h2>
      
      {queueItems.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <h3>No files in queue</h3>
          <p>Files will appear here when they are detected in your drop folder</p>
        </div>
      ) : (
        <div className="queue-list">
          {queueItems.map((item) => (
            <div key={item.id} className="queue-item">
              <div className="queue-item-header">
                <div className="queue-item-info">
                  <div className="queue-item-name">
                    {getStatusIcon(item.status)} {item.fileName}
                  </div>
                  <div className="queue-item-details">
                    {formatFileSize(item.fileSize)} • {formatDate(item.createdAt)}
                  </div>
                </div>
                <div className="queue-item-actions">
                  <span className={`queue-status ${item.status}`}>
                    {item.status.toUpperCase()}
                  </span>
                  {item.status === 'failed' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleRetry(item.id)}
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
              
              {item.errorMessage && (
                <div className="queue-error">
                  <strong>Error:</strong> {item.errorMessage}
                </div>
              )}
              
              {item.processedAt && (
                <div className="queue-processed">
                  <strong>Processed:</strong> {formatDate(item.processedAt)}
                </div>
              )}
              
              <div className="queue-path">
                <strong>Path:</strong> {item.filePath}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
