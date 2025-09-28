import React, { useState, useEffect } from 'react';

interface OneDriveAccount {
  path: string;
  name: string;
  type: 'personal' | 'business';
}

interface OneDriveAccountSelectorProps {
  onAccountSelected: (account: OneDriveAccount) => void;
  onSkip: () => void;
}

export const OneDriveAccountSelector: React.FC<OneDriveAccountSelectorProps> = ({
  onAccountSelected,
  onSkip
}) => {
  const [accounts, setAccounts] = useState<OneDriveAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<OneDriveAccount | null>(null);

  useEffect(() => {
    loadOneDriveAccounts();
  }, []);

  const loadOneDriveAccounts = async () => {
    try {
      setIsLoading(true);
      const detectedAccounts = await window.electronAPI.detectOneDriveAccounts();
      setAccounts(detectedAccounts);
      
      // Auto-select if only one account found
      if (detectedAccounts.length === 1) {
        setSelectedAccount(detectedAccounts[0]);
      }
    } catch (error) {
      console.error('Error loading OneDrive accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccountSelect = (account: OneDriveAccount) => {
    setSelectedAccount(account);
  };

  const handleContinue = () => {
    if (selectedAccount) {
      onAccountSelected(selectedAccount);
    }
  };

  const getAccountIcon = (type: 'personal' | 'business') => {
    return type === 'personal' ? '👤' : '🏢';
  };

  const getAccountDescription = (type: 'personal' | 'business') => {
    return type === 'personal' 
      ? 'Personal OneDrive account for personal files'
      : 'Business OneDrive account for work files';
  };

  if (isLoading) {
    return (
      <div className="account-selector">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Detecting OneDrive accounts...</p>
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="account-selector">
        <div className="no-accounts">
          <h3>No OneDrive Accounts Found</h3>
          <p>We couldn't detect any OneDrive accounts on your system.</p>
          <p>You can configure OneDrive settings later in the Preferences.</p>
          <button className="btn btn-primary" onClick={onSkip}>
            Continue Without OneDrive
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="account-selector">
      <div className="account-selector-header">
        <h2>Select OneDrive Account</h2>
        <p>Choose which OneDrive account you'd like to use for file uploads:</p>
      </div>

      <div className="account-list">
        {accounts.map((account) => (
          <div
            key={account.path}
            className={`account-item ${selectedAccount?.path === account.path ? 'selected' : ''}`}
            onClick={() => handleAccountSelect(account)}
          >
            <div className="account-icon">
              {getAccountIcon(account.type)}
            </div>
            <div className="account-details">
              <div className="account-name">{account.name}</div>
              <div className="account-description">
                {getAccountDescription(account.type)}
              </div>
              <div className="account-path">{account.path}</div>
            </div>
            {selectedAccount?.path === account.path && (
              <div className="account-selected">✓</div>
            )}
          </div>
        ))}
      </div>

      <div className="account-selector-actions">
        <button
          className="btn btn-secondary"
          onClick={onSkip}
        >
          Skip for Now
        </button>
        <button
          className="btn btn-primary"
          onClick={handleContinue}
          disabled={!selectedAccount}
        >
          Continue with {selectedAccount?.name || 'Selected Account'}
        </button>
      </div>
    </div>
  );
};
