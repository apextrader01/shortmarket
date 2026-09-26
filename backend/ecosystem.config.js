module.exports = {
  apps: [
    {
      name: 'skandx-backend',
      script: './server.js',
      instances: 2, // 2 cluster workers for high-concurrency API & WS
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1500M',
      node_args: '--max-old-space-size=1536',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        DOTENV_CONFIG_QUIET: 'true',
        JWT_SECRET: process.env.JWT_SECRET || '612f4b8a0208e38fa0dd69708a8b7e4215def8230cef6353cbe3cfd2549f7ac26d738f1d5c40b26c11b7aec1958f56347e5b845a97142c66787905c92c9c69e3',
      },
    }
  ],
};
