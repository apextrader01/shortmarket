module.exports = {
  apps: [
    {
      name: 'shortmarket-backend',
      script: './server.js',
      instances: 'max', // Scale to all available CPU cores
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    },
  ],
};
