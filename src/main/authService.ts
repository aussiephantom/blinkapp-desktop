import { PublicClientApplication, AccountInfo, AuthenticationResult } from '@azure/msal-node';
import { EventEmitter } from 'events';

export interface AuthConfig {
  clientId: string;
  tenantId: string;
  authority: string;
}

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  accessToken: string;
  refreshToken?: string;
  expiresOn: Date;
}

export class AuthService extends EventEmitter {
  private msalInstance: PublicClientApplication;
  private config: AuthConfig;
  private currentUser: UserInfo | null = null;
  private tokenCache: Map<string, string> = new Map();

  constructor(config: AuthConfig) {
    super();
    this.config = config;
    
    this.msalInstance = new PublicClientApplication({
      auth: {
        clientId: config.clientId,
        authority: config.authority,
      },
      cache: {
        cachePlugin: {
          beforeCacheAccess: async (cacheContext) => {
            // Load token cache from file system
            try {
              const fs = require('fs');
              const path = require('path');
              const cachePath = path.join(require('os').homedir(), '.blinkapp', 'token-cache.json');
              if (fs.existsSync(cachePath)) {
                const cacheData = fs.readFileSync(cachePath, 'utf-8');
                (cacheContext as any).tokenCache = JSON.parse(cacheData);
              }
            } catch (error) {
              console.log('[AUTH:SERVICE] No existing token cache found');
            }
          },
          afterCacheAccess: async (cacheContext) => {
            // Save token cache to file system
            try {
              const fs = require('fs');
              const path = require('path');
              const os = require('os');
              const cacheDir = path.join(os.homedir(), '.blinkapp');
              const cachePath = path.join(cacheDir, 'token-cache.json');
              
              if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
              }
              
              if ((cacheContext as any).cacheHasChanged) {
                fs.writeFileSync(cachePath, JSON.stringify((cacheContext as any).tokenCache, null, 2));
              }
            } catch (error) {
              console.error('[AUTH:SERVICE] Error saving token cache:', error);
            }
          }
        }
      }
    });
  }

  /**
   * Check if user is already authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null && this.isTokenValid();
  }

  /**
   * Get current user info
   */
  getCurrentUser(): UserInfo | null {
    return this.currentUser;
  }

  /**
   * Check if current token is still valid
   */
  private isTokenValid(): boolean {
    if (!this.currentUser) return false;
    return new Date() < this.currentUser.expiresOn;
  }

  /**
   * Get access token for Microsoft Graph API
   */
  async getAccessToken(): Promise<string> {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    if (this.isTokenValid()) {
      return this.currentUser.accessToken;
    }

    // Try to refresh token
    try {
      await this.refreshToken();
      return this.currentUser!.accessToken;
    } catch (error) {
      console.error('[AUTH:SERVICE] Token refresh failed:', error);
      throw new Error('Token expired and refresh failed. Please re-authenticate.');
    }
  }

  /**
   * Authenticate user with Microsoft account
   */
  async authenticate(): Promise<UserInfo> {
    try {
      console.log('[AUTH:SERVICE] Starting authentication...');
      
      // Use device code flow for desktop apps (no redirect URI needed)
      const deviceCodeRequest = {
        scopes: [
          'https://graph.microsoft.com/Files.ReadWrite',
          'https://graph.microsoft.com/User.Read',
          'https://graph.microsoft.com/offline_access'
        ],
        deviceCodeCallback: async (response: any) => {
          console.log('[AUTH:SERVICE] Device code authentication required:');
          console.log('[AUTH:SERVICE] Please go to:', response.verificationUri);
          console.log('[AUTH:SERVICE] Enter code:', response.userCode);
          
          // Automatically open the authentication page in the user's browser
          const { shell } = require('electron');
          await shell.openExternal(response.verificationUri);
          
          // Show a user-friendly dialog with the code
          const { dialog, clipboard } = require('electron');
          
          // Copy the code to clipboard automatically
          clipboard.writeText(response.userCode);
          
          const result = await dialog.showMessageBox({
            type: 'info',
            title: 'BrokerNet Desktop Authentication',
            message: 'Authentication page opened in your browser',
            detail: `Please enter this code in the browser:\n\n${response.userCode}\n\n✅ Code copied to clipboard automatically!\n\nThen click OK to continue.`,
            buttons: ['OK', 'Cancel'],
            defaultId: 0,
            cancelId: 1
          });
          
          if (result.response === 1) {
            throw new Error('Authentication cancelled by user');
          }
        }
      };

      const response: AuthenticationResult | null = await this.msalInstance.acquireTokenByDeviceCode(deviceCodeRequest);
      
      if (!response) {
        throw new Error('Authentication failed - no response received');
      }
      
      if (response.account) {
        this.currentUser = {
          id: response.account.homeAccountId,
          name: response.account.name || 'Unknown User',
          email: response.account.username || '',
          accessToken: response.accessToken,
          refreshToken: undefined, // MSAL doesn't provide refresh token in interactive flow
          expiresOn: response.expiresOn || new Date(Date.now() + 3600000) // 1 hour default
        };

        console.log('[AUTH:SERVICE] Authentication successful:', {
          name: this.currentUser.name,
          email: this.currentUser.email,
          expiresOn: this.currentUser.expiresOn
        });

        this.emit('authenticated', this.currentUser);
        return this.currentUser;
      } else {
        throw new Error('No account information received from authentication');
      }
    } catch (error) {
      console.error('[AUTH:SERVICE] Authentication failed:', error);
      this.emit('authenticationError', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  private async refreshToken(): Promise<void> {
    if (!this.currentUser) {
      throw new Error('No user logged in');
    }

    try {
      console.log('[AUTH:SERVICE] Refreshing token...');
      
      // Get account info for silent request
      const accounts = await this.msalInstance.getAllAccounts();
      const account = accounts.find((acc: any) => acc.homeAccountId === this.currentUser!.id);
      
      if (!account) {
        throw new Error('Account not found for token refresh');
      }
      
      const refreshRequest = {
        scopes: [
          'https://graph.microsoft.com/Files.ReadWrite',
          'https://graph.microsoft.com/User.Read',
          'https://graph.microsoft.com/offline_access'
        ],
        account: account
      };

      const response: AuthenticationResult = await this.msalInstance.acquireTokenSilent(refreshRequest);
      
      this.currentUser.accessToken = response.accessToken;
      this.currentUser.expiresOn = response.expiresOn || new Date(Date.now() + 3600000);

      console.log('[AUTH:SERVICE] Token refreshed successfully');
    } catch (error) {
      console.error('[AUTH:SERVICE] Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Check for existing authentication and auto-login if valid
   */
  async checkExistingAuth(): Promise<UserInfo | null> {
    try {
      console.log('[AUTH:SERVICE] Checking for existing authentication...');
      
      const accounts = await this.msalInstance.getAllAccounts();
      if (accounts.length === 0) {
        console.log('[AUTH:SERVICE] No cached accounts found');
        return null;
      }

      console.log('[AUTH:SERVICE] Found cached accounts:', accounts.length);
      
      // Try to get a fresh token silently
      const account = accounts[0];
      const silentRequest = {
        scopes: [
          'https://graph.microsoft.com/Files.ReadWrite',
          'https://graph.microsoft.com/User.Read',
          'https://graph.microsoft.com/offline_access'
        ],
        account: account,
      };

      const response = await this.msalInstance.acquireTokenSilent(silentRequest);
      
      if (response) {
        this.currentUser = {
          id: response.account?.homeAccountId || '',
          name: response.account?.name || '',
          email: response.account?.username || '',
          accessToken: response.accessToken,
          refreshToken: response.account?.idToken,
          expiresOn: new Date(response.expiresOn || Date.now() + 3600000)
        };
        
        console.log('[AUTH:SERVICE] Auto-login successful for user:', this.currentUser.name);
        this.emit('userChanged', this.currentUser);
        return this.currentUser;
      }
      
      return null;
    } catch (error) {
      console.log('[AUTH:SERVICE] No valid cached authentication found:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<void> {
    try {
      if (this.currentUser) {
        const accounts = await this.msalInstance.getAllAccounts();
        const account = accounts.find((acc: any) => acc.homeAccountId === this.currentUser!.id);
        if (account) {
          await this.msalInstance.getTokenCache().removeAccount(account);
        }
      }
      
      this.currentUser = null;
      this.tokenCache.clear();
      
      console.log('[AUTH:SERVICE] User signed out successfully');
      this.emit('signedOut');
    } catch (error) {
      console.error('[AUTH:SERVICE] Sign out failed:', error);
      throw error;
    }
  }

  /**
   * Get user's OneDrive drives
   */
  async getOneDriveDrives(): Promise<any[]> {
    const accessToken = await this.getAccessToken();
    
    try {
      const axios = require('axios');
      
      // Try to get drives using /me/drives endpoint
      let response;
      try {
        response = await axios.get('https://graph.microsoft.com/v1.0/me/drives', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (meError: any) {
        console.log('[AUTH:SERVICE] /me/drives failed, trying /drives endpoint...');
        
        // Fallback to /drives endpoint
        response = await axios.get('https://graph.microsoft.com/v1.0/drives', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
      }

      const drives = response.data.value || [];
      console.log('[AUTH:SERVICE] Found OneDrive drives:', drives.length);
      console.log('[AUTH:SERVICE] Drive details:', JSON.stringify(drives, null, 2));
      
      return drives;
    } catch (error) {
      console.error('[AUTH:SERVICE] Error getting OneDrive drives:', error);
      throw error;
    }
  }
}
