const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const port = parseInt(process.env.PORT || '5000', 10);
const isStaging = port === 5001 || process.env.NODE_ENV === 'staging';
const appName = process.env.PM2_APP_NAME || (isStaging ? 'skandx-backend-staging' : 'skandx-backend');
const instances = process.env.PM2_INSTANCES ? parseInt(process.env.PM2_INSTANCES, 10) : (isStaging ? 1 : 2);
const execMode = instances === 1 ? 'fork' : 'cluster';

module.exports = {
  apps: [
    {
      name: appName,
      script: './server.js',
      instances: instances,
      exec_mode: execMode,
      watch: false,
      max_memory_restart: isStaging ? '600M' : '800M',
      node_args: '--optimize_for_size --max-old-space-size=384 --expose-gc',
      env: {
        NODE_ENV: process.env.NODE_ENV || (isStaging ? 'staging' : 'production'),
        PORT: port,
        DOTENV_CONFIG_QUIET: 'true',
        JWT_SECRET: process.env.JWT_SECRET || '612f4b8a0208e38fa0dd69708a8b7e4215def8230cef6353cbe3cfd2549f7ac26d738f1d5c40b26c11b7aec1958f56347e5b845a97142c66787905c92c9c69e3',
      },
    }
  ],
};
