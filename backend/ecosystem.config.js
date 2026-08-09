module.exports = {
  apps: [
    {
      name: 'shortmarket-backend',
      script: './server.js',
      instances: 2, // Limit instances to 2 to prevent OOM
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    },
    {
      name: 'shortmarket-worker',
      script: './worker.js',
      instances: 1, // Only 1 worker needed for cron jobs
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
    }
  ],
};
