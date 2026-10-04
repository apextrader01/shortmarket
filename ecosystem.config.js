const path = require('path');
try {
  require('./backend/node_modules/dotenv').config({ path: path.join(__dirname, 'backend/.env'), quiet: true });
} catch (_) {}

module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || 'skandx-backend',
      script: './server.js',
      cwd: './backend',
      instances: process.env.PM2_INSTANCES ? parseInt(process.env.PM2_INSTANCES, 10) : 'max', // Auto-cluster across all CPU cores for 100k - 1M concurrency
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1200M',
      node_args: '--optimize_for_size --max-old-space-size=768',
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
        DOTENV_CONFIG_QUIET: 'true',
        JWT_SECRET: process.env.JWT_SECRET,
      },
    }
  ],
};
