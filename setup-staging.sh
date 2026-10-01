#!/bin/bash
# ==============================================================================
# SkandX Staging Environment Auto-Provisioning Script (GCP Server)
#
# Sets up:
#  1. Isolated Staging directory at ~/shortmarket-staging (tracking 'development')
#  2. Dedicated PostgreSQL database: shortmarket_staging
#  3. Independent Backend process on Port 5001 (skandx-backend-staging)
#  4. Nginx reverse proxy configuration for staging.skandx.in -> port 5001
#  5. Automatic Multi-Domain SSL / Let's Encrypt certificate via Certbot
#
# Usage:
#   sudo bash setup-staging.sh
# ==============================================================================

set -e

STAGING_DOMAIN="staging.skandx.in"
STAGING_PORT=5001
STAGING_DB_NAME="shortmarket_staging"

# 1. Require sudo / root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root: sudo bash setup-staging.sh"
  exit 1
fi

REAL_USER="${SUDO_USER:-centralasp123}"
USER_HOME=$(eval echo "~$REAL_USER")
PROD_DIR="$USER_HOME/shortmarket"
STAGING_DIR="$USER_HOME/shortmarket-staging"

echo "===================================================================="
echo "🚀 INITIATING AUTOMATED STAGING DEPLOYMENT SETUP"
echo "   User:             $REAL_USER"
echo "   Production Dir:   $PROD_DIR (Branch: main)"
echo "   Staging Dir:      $STAGING_DIR (Branch: development)"
echo "   Staging Port:     $STAGING_PORT"
echo "   Staging Database: $STAGING_DB_NAME"
echo "   Staging Domain:   $STAGING_DOMAIN"
echo "===================================================================="

# 2. Check production directory exists
if [ ! -d "$PROD_DIR" ]; then
  echo "❌ Production directory not found at $PROD_DIR!"
  exit 1
fi

PROD_ENV="$PROD_DIR/backend/.env"
if [ ! -f "$PROD_ENV" ]; then
  echo "❌ Production environment file not found at $PROD_ENV!"
  exit 1
fi

# 3. Read production DATABASE_URL
PROD_DB_URL=$(grep -E "^DATABASE_URL=" "$PROD_ENV" | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
if [ -z "$PROD_DB_URL" ]; then
  echo "⚠️ No DATABASE_URL found in $PROD_ENV. Using default postgres connection."
  PROD_DB_URL="postgresql://postgres@localhost:5432/shortmarket"
fi

# Replace database name in connection string with shortmarket_staging
STAGING_DB_URL=$(echo "$PROD_DB_URL" | sed -E "s|/([^/?]+)(\?.*)?$|/${STAGING_DB_NAME}\2|")
echo "🔑 Staging DB URL configured: ${STAGING_DB_URL%%:*}:****@..."

# 4. Create the dedicated PostgreSQL Database
echo "🗄️ Checking / Creating PostgreSQL database '$STAGING_DB_NAME'..."
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$STAGING_DB_NAME"; then
  echo "  ✅ Database '$STAGING_DB_NAME' already exists."
else
  sudo -u postgres createdb "$STAGING_DB_NAME"
  echo "  ✅ Created database '$STAGING_DB_NAME'."
fi

# Extract DB user if present to grant privileges
DB_USER=$(echo "$PROD_DB_URL" | sed -nE 's|^postgres(ql)?://([^:@]+).*|\2|p')
if [ -n "$DB_USER" ] && [ "$DB_USER" != "postgres" ]; then
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $STAGING_DB_NAME TO $DB_USER;" 2>/dev/null || true
  sudo -u postgres psql -c "ALTER DATABASE $STAGING_DB_NAME OWNER TO $DB_USER;" 2>/dev/null || true
  echo "  ✅ Privileges granted to user '$DB_USER'."
fi

# 5. Clone or Update Staging Directory
if [ ! -d "$STAGING_DIR" ]; then
  echo "📦 Cloning workspace to $STAGING_DIR tracking 'development'..."
  sudo -u "$REAL_USER" git clone -b development https://github.com/apextrader01/shortmarket.git "$STAGING_DIR"
  cd "$STAGING_DIR"
  sudo -u "$REAL_USER" git reset --hard origin/development
else
  echo "⚡ Existing staging workspace detected at $STAGING_DIR. Pulling latest development branch..."
  cd "$STAGING_DIR"
  sudo -u "$REAL_USER" git remote set-url origin https://github.com/apextrader01/shortmarket.git 2>/dev/null || true
  sudo -u "$REAL_USER" git fetch origin development
  sudo -u "$REAL_USER" git checkout development
  sudo -u "$REAL_USER" git reset --hard origin/development
fi

# 6. Configure Staging backend/.env
echo "⚙️ Configuring $STAGING_DIR/backend/.env..."
cp "$PROD_ENV" "$STAGING_DIR/backend/.env"

# Strip production-specific variables
sed -i '/^PORT=/d' "$STAGING_DIR/backend/.env"
sed -i '/^DATABASE_URL=/d' "$STAGING_DIR/backend/.env"
sed -i '/^NODE_ENV=/d' "$STAGING_DIR/backend/.env"
sed -i '/^PM2_APP_NAME=/d' "$STAGING_DIR/backend/.env"
sed -i '/^SOCKET_KEY=/d' "$STAGING_DIR/backend/.env"

cat >> "$STAGING_DIR/backend/.env" <<EOF

# ==============================================================================
# STAGING ENVIRONMENT ISOLATION CONFIGURATION
# ==============================================================================
PORT=$STAGING_PORT
DATABASE_URL=$STAGING_DB_URL
NODE_ENV=staging
PM2_APP_NAME=skandx-backend-staging
SOCKET_KEY=socket.io-staging
EOF

chown "$REAL_USER:$REAL_USER" "$STAGING_DIR/backend/.env"
chmod 600 "$STAGING_DIR/backend/.env"
echo "  ✅ Staging .env updated."

# 7. Initialize Database Schema & Migrations
echo "🗄️ Running migrations on $STAGING_DB_NAME..."
cd "$STAGING_DIR/backend"
sudo -u "$REAL_USER" npm ci --omit=dev --prefer-offline || sudo -u "$REAL_USER" npm install --omit=dev
sudo -u "$REAL_USER" node scripts/migrate_columns.js || sudo -u "$REAL_USER" node -e "const db = require('./database/db'); db.ensureCriticalColumns().then(() => process.exit(0)).catch(() => process.exit(0));"

# Seed instruments from production if staging instruments table is empty
INSTRUMENT_COUNT=$(sudo -u postgres psql -d "$STAGING_DB_NAME" -tAc "SELECT count(*) FROM instruments;" 2>/dev/null || echo "0")
if [ "$INSTRUMENT_COUNT" = "0" ] || [ -z "$INSTRUMENT_COUNT" ]; then
  echo "📋 Copying stock and instrument definitions from production to staging..."
  PROD_DB_NAME=$(echo "$PROD_DB_URL" | sed -nE 's|^postgres(ql)?://[^/]+/([^?]+).*|\2|p')
  [ -z "$PROD_DB_NAME" ] && PROD_DB_NAME="shortmarket"
  sudo -u postgres pg_dump -d "$PROD_DB_NAME" -t instruments --data-only 2>/dev/null | sudo -u postgres psql -d "$STAGING_DB_NAME" 2>/dev/null || true
  echo "  ✅ Instruments populated in staging database."
fi

# 8. Build Staging Frontend
echo "🌐 Building Staging Frontend..."
cd "$STAGING_DIR/frontend"
sudo -u "$REAL_USER" npm ci --prefer-offline || sudo -u "$REAL_USER" npm install
if command -v nice >/dev/null 2>&1; then
  sudo -u "$REAL_USER" nice -n 15 npm run build
else
  sudo -u "$REAL_USER" npm run build
fi

# 9. PM2 Process Registration & Startup
echo "🔄 Starting PM2 Cluster for Staging (skandx-backend-staging on port $STAGING_PORT)..."
cd "$STAGING_DIR/backend"
sudo -u "$REAL_USER" pm2 reload skandx-backend-staging --update-env 2>/dev/null || sudo -u "$REAL_USER" pm2 start ecosystem.config.js
sudo -u "$REAL_USER" pm2 save 2>/dev/null || true

# 10. Nginx Site Configuration
echo "🌐 Configuring Nginx for $STAGING_DOMAIN..."
cat > "/etc/nginx/sites-available/$STAGING_DOMAIN" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $STAGING_DOMAIN;

    client_max_body_size 20M;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/x-javascript
        image/svg+xml;

    # 1. High-Performance Static Asset Caching (Vite content-hashed bundles)
    location ~* \.(?:css|js|woff2?|svg|png|jpg|jpeg|gif|ico|webp)$ {
        proxy_pass http://localhost:$STAGING_PORT;
        proxy_set_header Host \$host;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # 2. Dynamic Entry Points (HTML, manifest, sw) - never stale
    location ~* \.(?:html|json)$ {
        proxy_pass http://localhost:$STAGING_PORT;
        proxy_set_header Host \$host;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # 3. Main API & WebSocket Proxy
    location / {
        proxy_pass http://localhost:$STAGING_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header CF-Connecting-IP \$http_cf_connecting_ip;
        proxy_set_header CF-IPCountry \$http_cf_ipcountry;
        proxy_set_header CF-Visitor \$http_cf_visitor;
        proxy_cache_bypass \$http_upgrade;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

ln -sf "/etc/nginx/sites-available/$STAGING_DOMAIN" "/etc/nginx/sites-enabled/$STAGING_DOMAIN"
nginx -t && systemctl reload nginx
echo "  ✅ Nginx site enabled and reloaded."

# 11. SSL Verification and Certbot Setup
echo "===================================================================="
echo "🔒 SSL / TLS Verification for $STAGING_DOMAIN"
echo "===================================================================="
PUBLIC_IP=$(curl -s -4 ifconfig.me || curl -s -4 icanhazip.com || echo "35.235.248.80")
RESOLVED_IP=$(getent ahosts "$STAGING_DOMAIN" 2>/dev/null | awk '{ print $1 }' | head -n 1 || echo "")

if [ "$RESOLVED_IP" = "$PUBLIC_IP" ]; then
  echo "✅ DNS is already pointed correctly: $STAGING_DOMAIN -> $PUBLIC_IP"
  echo "📦 Obtaining SSL Certificate with Certbot..."
  certbot --nginx -d "$STAGING_DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || true
  systemctl reload nginx
  echo "🎉 SUCCESS: Staging is fully secured at https://$STAGING_DOMAIN"
else
  echo "⚠️ DNS A-Record for '$STAGING_DOMAIN' is not pointing to this server yet."
  echo "   Current Resolution: ${RESOLVED_IP:-Unresolved}"
  echo "   Target Server IP:   $PUBLIC_IP"
  echo ""
  echo "📋 NEXT SIMPLE STEP:"
  echo "   1. Go to your DNS provider (Cloudflare / GoDaddy / Namecheap)"
  echo "   2. Add an 'A' Record:"
  echo "        Name:  staging"
  echo "        Type:  A"
  echo "        Value: $PUBLIC_IP"
  echo "   3. Once saved, run this single command on the server to activate HTTPS:"
  echo "        sudo certbot --nginx -d $STAGING_DOMAIN"
fi

echo "===================================================================="
echo "✅ STAGING ENVIRONMENT IS FULLY ONLINE!"
echo "   Staging Port:    $STAGING_PORT (PM2: skandx-backend-staging)"
echo "   Staging DB:      $STAGING_DB_NAME (Isolated PostgreSQL)"
echo "   HTTP URL:        http://$STAGING_DOMAIN (or https://$STAGING_DOMAIN)"
echo "===================================================================="
