export interface EnvironmentConfig {
  name: string;
  apiBaseUrl: string;
  description: string;
}

export const ENVIRONMENTS: Record<string, EnvironmentConfig> = {
  local: {
    name: 'Local Development',
    apiBaseUrl: 'http://localhost:5002',
    description: 'Local backend server for development'
  },
  production: {
    name: 'Production (Vercel)',
    apiBaseUrl: 'https://blink-api-sigma.vercel.app',
    description: 'Production API hosted on Vercel'
  }
};

export const DEFAULT_ENVIRONMENT = 'local';

export function getEnvironmentConfig(env: string = DEFAULT_ENVIRONMENT): EnvironmentConfig {
  return ENVIRONMENTS[env] || ENVIRONMENTS[DEFAULT_ENVIRONMENT];
}

export function getAllEnvironments(): EnvironmentConfig[] {
  return Object.values(ENVIRONMENTS);
}
