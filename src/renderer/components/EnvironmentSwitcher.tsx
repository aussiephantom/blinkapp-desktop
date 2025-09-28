import React, { useState, useEffect } from 'react';
import { getAllEnvironments, getEnvironmentConfig, EnvironmentConfig, ENVIRONMENTS } from '../../config/environment';

interface EnvironmentSwitcherProps {
  onEnvironmentChange: (config: EnvironmentConfig) => void;
  currentEnvironment?: EnvironmentConfig;
}

const EnvironmentSwitcher: React.FC<EnvironmentSwitcherProps> = ({ onEnvironmentChange, currentEnvironment }) => {
  const [currentEnv, setCurrentEnv] = useState<string>('local');
  const [environments] = useState<EnvironmentConfig[]>(getAllEnvironments());
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');

  useEffect(() => {
    // Load current environment from localStorage or default
    const savedEnv = localStorage.getItem('selectedEnvironment') || 'local';
    setCurrentEnv(savedEnv);
    // Don't call onEnvironmentChange on mount - let the parent handle initial environment
  }, []);

  // Sync with parent's current environment
  useEffect(() => {
    if (currentEnvironment) {
      // Find the environment key that matches the current environment's API URL
      const matchingKey = Object.entries(ENVIRONMENTS).find(([key, env]) => 
        env.apiBaseUrl === currentEnvironment.apiBaseUrl
      )?.[0];
      if (matchingKey) {
        setCurrentEnv(matchingKey);
      }
    }
  }, [currentEnvironment]);

  const handleEnvironmentChange = (envKey: string) => {
    setCurrentEnv(envKey);
    localStorage.setItem('selectedEnvironment', envKey);
    const config = getEnvironmentConfig(envKey);
    onEnvironmentChange(config);
    setConnectionStatus('unknown'); // Reset connection status when switching
  };

  const testConnection = async (config: EnvironmentConfig) => {
    setIsTestingConnection(true);
    setConnectionStatus('unknown');
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/health`);
      setConnectionStatus(response.ok ? 'connected' : 'disconnected');
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus('disconnected');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#52c41a';
      case 'disconnected': return '#ff4d4f';
      default: return '#faad14';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  return (
    <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #d9d9d9', borderRadius: '6px', backgroundColor: '#fafafa' }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#262626' }}>API Environment</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
          Select Environment:
        </label>
        <select
          value={currentEnv}
          onChange={(e) => handleEnvironmentChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            fontSize: '14px',
            backgroundColor: '#fff'
          }}
        >
          {Object.entries(ENVIRONMENTS).map(([key, env]) => (
            <option key={env.name} value={key}>
              {env.name} - {env.apiBaseUrl}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>
          <strong>Current:</strong> {getEnvironmentConfig(currentEnv).apiBaseUrl}
        </div>
        <div style={{ fontSize: '12px', color: '#999' }}>
          {getEnvironmentConfig(currentEnv).description}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={() => testConnection(getEnvironmentConfig(currentEnv))}
          disabled={isTestingConnection}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            backgroundColor: '#fff',
            cursor: isTestingConnection ? 'not-allowed' : 'pointer',
            opacity: isTestingConnection ? 0.6 : 1
          }}
        >
          {isTestingConnection ? 'Testing...' : 'Test Connection'}
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: getStatusColor()
            }}
          />
          <span style={{ fontSize: '12px', color: '#666' }}>
            {getStatusText()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default EnvironmentSwitcher;
