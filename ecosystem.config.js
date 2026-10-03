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
        JWT_SECRET: process.env.JWT_SECRET || '612f4b8a0208e38fa0dd69708a8b7e4215def8230cef6353cbe3cfd2549f7ac26d738f1d5c40b26c11b7aec1958f56347e5b845a97142c66787905c92c9c69e3',
      },
    }
  ],
};
