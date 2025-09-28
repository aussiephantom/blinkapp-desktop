#!/usr/bin/env node

/**
 * Environment Switcher Script
 * 
 * Usage:
 *   node scripts/switch-env.js local     # Switch to local development
 *   node scripts/switch-env.js production # Switch to production
 *   node scripts/switch-env.js status    # Show current environment
 */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env.local');
const ENVIRONMENTS = {
  local: {
    NODE_ENV: 'development',
    API_BASE_URL: 'http://localhost:5002',
    DESCRIPTION: 'Local development environment'
  },
  production: {
    NODE_ENV: 'production',
    API_BASE_URL: 'https://blinkapp-backend.vercel.app',
    DESCRIPTION: 'Production environment (Vercel)'
  }
};

function showUsage() {
  console.log('\n🔧 Environment Switcher');
  console.log('======================');
  console.log('\nUsage:');
  console.log('  node scripts/switch-env.js <environment>');
  console.log('\nAvailable environments:');
  Object.keys(ENVIRONMENTS).forEach(env => {
    console.log(`  ${env.padEnd(12)} - ${ENVIRONMENTS[env].DESCRIPTION}`);
  });
  console.log('\nCommands:');
  console.log('  status      - Show current environment');
  console.log('  help        - Show this help message');
  console.log('\nExamples:');
  console.log('  node scripts/switch-env.js local');
  console.log('  node scripts/switch-env.js production');
  console.log('  node scripts/switch-env.js status');
}

function writeEnvFile(env) {
  const envContent = Object.entries(env)
    .filter(([key]) => key !== 'DESCRIPTION')
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  fs.writeFileSync(ENV_FILE, envContent);
  console.log(`✅ Environment switched to: ${env.DESCRIPTION}`);
  console.log(`📁 Environment file: ${ENV_FILE}`);
  console.log(`🌐 API Base URL: ${env.API_BASE_URL}`);
}

function readCurrentEnv() {
  if (!fs.existsSync(ENV_FILE)) {
    return null;
  }
  
  const content = fs.readFileSync(ENV_FILE, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  const env = {};
  
  lines.forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      env[key] = value;
    }
  });
  
  return env;
}

function showStatus() {
  const current = readCurrentEnv();
  
  console.log('\n📊 Current Environment Status');
  console.log('=============================');
  
  if (!current) {
    console.log('❌ No environment file found');
    console.log('💡 Run: node scripts/switch-env.js local');
    return;
  }
  
  console.log(`🌐 API Base URL: ${current.API_BASE_URL || 'Not set'}`);
  console.log(`🔧 Node Environment: ${current.NODE_ENV || 'Not set'}`);
  console.log(`📁 Environment file: ${ENV_FILE}`);
  
  // Find matching environment
  const matchingEnv = Object.entries(ENVIRONMENTS).find(([name, config]) => 
    config.API_BASE_URL === current.API_BASE_URL
  );
  
  if (matchingEnv) {
    console.log(`✅ Active Environment: ${matchingEnv[0]} - ${matchingEnv[1].DESCRIPTION}`);
  } else {
    console.log('⚠️  Custom environment configuration detected');
  }
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help') {
  showUsage();
  process.exit(0);
}

if (command === 'status') {
  showStatus();
  process.exit(0);
}

if (!ENVIRONMENTS[command]) {
  console.error(`❌ Unknown environment: ${command}`);
  showUsage();
  process.exit(1);
}

writeEnvFile(ENVIRONMENTS[command]);
console.log('\n🚀 Next steps:');
console.log('1. Restart the development server: npm run dev');
console.log('2. Or rebuild the app: npm run build');
console.log('3. The app will now use the selected environment');
