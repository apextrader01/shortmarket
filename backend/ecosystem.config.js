module.exports = {
  apps: [
    {
      name: 'shortmarket-backend',
      script: './server.js',
      instances: 2, // 2 cluster workers for high-concurrency API & WS
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1500M',
      node_args: '--max-old-space-size=1536',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    }
  ],
};
