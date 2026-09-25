#!/usr/bin/env bash
# ==============================================================================
# Complete VM & Database Auto-Repair Script for Short Edge Staging
# Synchronizes credentials, cleans rogue PM2 daemons, aligns Nginx ports & restarts
# ==============================================================================
set -e

echo "========================================================"
echo "🔧 SHORT EDGE - COMPLETE VM & DATABASE AUTO-REPAIR"
echo "========================================================"

APP_DIR="$HOME/shortmarket"
OPT_DIR="/opt/shortmarket-staging"

# 1. Navigate to app directory
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
elif [ -d "$OPT_DIR" ]; then
  APP_DIR="$OPT_DIR"
  cd "$APP_DIR"
else
  APP_DIR="$(pwd)"
  cd "$APP_DIR"
fi

echo "📂 Project root: $APP_DIR"

# 2. Stash any temporary files and pull latest development branch
echo "📥 Pulling latest updates from GitHub..."
git stash || true
git fetch origin development
git checkout development
git pull origin development
echo "✔ Code updated to commit: $(git rev-parse --short HEAD)"

# 3. Locate backend/.env
ENV_FILE="$APP_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$OPT_DIR/backend/.env" ]; then
    ENV_FILE="$OPT_DIR/backend/.env"
  fi
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error: Could not find backend/.env file!"
  exit 1
fi

echo "📁 Active .env: $ENV_FILE"

# 4. Sync .env to /opt/shortmarket-staging if it exists
if [ -d "$OPT_DIR/backend" ] && [ "$ENV_FILE" != "$OPT_DIR/backend/.env" ]; then
  echo "🔄 Syncing .env to $OPT_DIR/backend/.env..."
  sudo cp "$ENV_FILE" "$OPT_DIR/backend/.env" || true
fi

# 5. Extract database credentials from .env
echo "🔑 Reading database credentials from .env..."
CREDENTIALS=$(node -e "
const fs = require('fs');
const content = fs.readFileSync('$ENV_FILE', 'utf8');
const match = content.match(/DATABASE_URL=([^\r\n]+)/);
if (!match) {
  console.error('DATABASE_URL not found in $ENV_FILE');
  process.exit(1);
}
const raw = match[1].trim().replace(/^['\"]|['\"]$/g, '');
const u = new URL(raw);
console.log(decodeURIComponent(u.username) + ':::' + decodeURIComponent(u.password) + ':::' + u.pathname.replace(/^\//, ''));
")

DB_USER=$(echo "$CREDENTIALS" | cut -d':' -f1)
DB_PASS=$(echo "$CREDENTIALS" | cut -d':' -f4)
DB_NAME=$(echo "$CREDENTIALS" | cut -d':' -f7)

echo "👤 Database User:     $DB_USER"
echo "🗄️  Database Name:     $DB_NAME"

# 6. Synchronize PostgreSQL user & privileges directly via psql
echo "🐘 Synchronizing PostgreSQL user '$DB_USER' password..."
sudo systemctl start postgresql || true
sudo -u postgres psql <<EOF
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER') THEN
      CREATE USER "$DB_USER" WITH PASSWORD '$DB_PASS' SUPERUSER;
   ELSE
      ALTER USER "$DB_USER" WITH PASSWORD '$DB_PASS' SUPERUSER;
   END IF;
END
\$\$;
GRANT ALL PRIVILEGES ON DATABASE "$DB_NAME" TO "$DB_USER";
ALTER DATABASE "$DB_NAME" OWNER TO "$DB_USER";
EOF
echo "✔ PostgreSQL user '$DB_USER' and database '$DB_NAME' aligned."

# 7. Test connection with Knex
echo "🧪 Verifying database connection using Knex..."
node -e "
require('dotenv').config({ path: '$ENV_FILE', override: true });
const knex = require('knex');
const db = knex({ client: 'pg', connection: process.env.DATABASE_URL, pool: { min: 1, max: 2, acquireTimeoutMillis: 5000 } });
db.raw('SELECT current_user, current_database();')
  .then(res => {
    const row = res.rows ? res.rows[0] : res[0];
    console.log('   🎉 Knex successfully connected as:', row.current_user, 'to:', row.current_database);
    return db.destroy();
  })
  .then(() => process.exit(0))
  .catch(err => {
    console.error('   ❌ Knex connection test failed:', err.message);
    process.exit(1);
  });
"

# 8. Check and align Nginx proxy_pass port to 5000
echo "🌐 Checking Nginx proxy configuration..."
NGINX_5001=$(grep -rl "5001" /etc/nginx/sites-available/ /etc/nginx/sites-enabled/ 2>/dev/null || true)
if [ -n "$NGINX_5001" ]; then
  echo "   Updating Nginx from port 5001 to 5000 in: $NGINX_5001"
  sudo sed -i 's/localhost:5001/localhost:5000/g' /etc/nginx/sites-available/* 2>/dev/null || true
  sudo sed -i 's/localhost:5001/localhost:5000/g' /etc/nginx/sites-enabled/* 2>/dev/null || true
  sudo sed -i 's/127.0.0.1:5001/127.0.0.1:5000/g' /etc/nginx/sites-available/* 2>/dev/null || true
  sudo sed -i 's/127.0.0.1:5001/127.0.0.1:5000/g' /etc/nginx/sites-enabled/* 2>/dev/null || true
  sudo nginx -t && sudo systemctl reload nginx
  echo "✔ Nginx reloaded on port 5000."
else
  echo "✔ Nginx already configured for port 5000."
fi

# 9. Clean up any rogue PM2 root processes
echo "🧹 Cleaning up rogue root PM2 processes..."
sudo pm2 delete all 2>/dev/null || true
sudo pm2 save 2>/dev/null || true

# 10. Clean wipe of user PM2 daemon memory to clear all stale env caches
echo "🔄 Killing PM2 daemon to clear cached in-memory environment variables..."
pm2 kill 2>/dev/null || true
sleep 2

# 11. Start fresh PM2 cluster using ecosystem.config.js
echo "🚀 Launching fresh PM2 cluster for shortmarket-backend..."
cd "$APP_DIR"
pm2 start ecosystem.config.js
pm2 save

# 12. Run database migrations to guarantee columns & composite indexes
echo "📊 Running database migrations..."
node backend/scripts/migrate_columns.js

# 13. Self-test backend health
echo "🧪 Running self-diagnostic HTTP test..."
sleep 3
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/stocks || echo "000")
echo "HTTP response status from localhost:5000/api/stocks: $HTTP_STATUS"

if [ "$HTTP_STATUS" = "200" ]; then
  echo "========================================================"
  echo "🎉 SUCCESS: Backend is healthy, database connected & live!"
  echo "========================================================"
else
  echo "⚠️ Notice: Backend returned status $HTTP_STATUS (warming up...)"
  sleep 3
  curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/stocks || true
fi
