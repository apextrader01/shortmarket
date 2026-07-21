#!/usr/bin/env bash
# ==============================================================================
# Google Cloud Staging Setup Script for ShortMarket
# Installs: Node.js 20, PostgreSQL, Nginx, PM2, and configures database & envs
# ==============================================================================

# Ensure script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run this script as root (use sudo): sudo bash $0"
  exit 1
fi

echo "======================================================="
echo "🚀 Starting ShortMarket Google Cloud Staging Setup"
echo "======================================================="

# 1. Update and Upgrade System
echo "🔄 Updating system packages..."
apt-get update && apt-get upgrade -y
apt-get install -y curl git ufw nginx

# 2. Configure 2GB Swap Memory (Critical for 1GB RAM instances)
echo "💾 Configuring 2GB Swap Memory..."
if [ -f /swapfile ]; then
    echo "Swap file already exists, skipping creation."
else
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "✅ Swap memory enabled."
fi

# 3. Install Node.js 20 LTS
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
echo "✅ Node version: $(node -v)"
echo "✅ NPM version: $(npm -v)"

# 4. Install & Configure PostgreSQL
echo "🐘 Installing PostgreSQL..."
apt-get install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

DB_PASSWORD=$(openssl rand -hex 16)
echo "🔑 Configuring PostgreSQL database and user..."
sudo -u postgres psql -c "CREATE USER shortmarket_user WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE shortmarket_staging OWNER shortmarket_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE shortmarket_staging TO shortmarket_user;"
echo "✅ Database 'shortmarket_staging' created successfully."

# 5. Clone GitHub Repository
echo "-------------------------------------------------------"
echo "📂 Cloning GitHub Repository"
echo "-------------------------------------------------------"
echo "Since the repository is private, please provide your GitHub credentials."
read -p "GitHub Username: " GIT_USER
read -sp "GitHub Personal Access Token (or password): " GIT_TOKEN
echo ""

CLONE_DIR="/opt/shortmarket-staging"
rm -rf "$CLONE_DIR"

echo "Downloading code from GitHub..."
git clone "https://${GIT_USER}:${GIT_TOKEN}@github.com/apextrader01/shortmarket.git" "$CLONE_DIR"

if [ ! -d "$CLONE_DIR" ]; then
    echo "❌ Git clone failed! Please check your credentials and try again."
    exit 1
fi

# Switch clone folder to development branch for staging
cd "$CLONE_DIR"
git checkout development
echo "✅ Checked out development branch."

# 6. Configure Environment Variables
echo "-------------------------------------------------------"
echo "⚙️  Configuring Environment Variables (.env)"
echo "-------------------------------------------------------"
read -p "Enter Angel One Client ID (ANGEL_CLIENT_ID): " ANGEL_CLIENT_ID
read -p "Enter Angel One API Key (ANGEL_API_KEY): " ANGEL_API_KEY
read -sp "Enter Angel One PIN (ANGEL_PIN): " ANGEL_PIN
echo ""
read -p "Enter Angel One TOTP Secret (ANGEL_TOTP_SECRET): " ANGEL_TOTP_SECRET

JWT_SECRET=$(openssl rand -hex 32)
ENV_FILE="$CLONE_DIR/backend/.env"

cat <<EOT > "$ENV_FILE"
PORT=5001
NODE_ENV=production
DATABASE_URL=postgres://shortmarket_user:${DB_PASSWORD}@localhost:5432/shortmarket_staging
ANGEL_CLIENT_ID="${ANGEL_CLIENT_ID}"
ANGEL_API_KEY="${ANGEL_API_KEY}"
ANGEL_PIN="${ANGEL_PIN}"
ANGEL_TOTP_SECRET="${ANGEL_TOTP_SECRET}"
JWT_SECRET="${JWT_SECRET}"
EOT

echo "✅ Environment variables written to backend/.env"

# 7. Build Frontend and Backend
echo "-------------------------------------------------------"
echo "🛠️  Building Application"
echo "-------------------------------------------------------"
npm run install
npm run build

# 8. Setup PM2 Process Manager
echo "🏃 Starting Node.js server with PM2..."
npm install -g pm2
cd "$CLONE_DIR/backend"
pm2 delete shortmarket-staging 2>/dev/null || true
pm2 start server.js --name "shortmarket-staging" -- --dns-result-order=ipv4first
pm2 save
pm2 startup systemd -u root --hp /root --save

# 9. Configure Nginx Reverse Proxy
echo "🌐 Configuring Nginx Reverse Proxy..."
NGINX_CONF="/etc/nginx/sites-available/shortmarket-staging"

cat <<EOT > "$NGINX_CONF"
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOT

rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/shortmarket-staging
ln -s "$NGINX_CONF" /etc/nginx/sites-enabled/
systemctl restart nginx

# 10. Configure Firewall
echo "🛡️  Configuring Firewall rules..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
echo "y" | ufw enable

echo "======================================================="
echo "🎉 Setup Complete!"
echo "======================================================="
echo "Staging environment is live and running!"
echo "Access it via http://YOUR_GOOGLE_VM_EXTERNAL_IP"
echo "Logs can be viewed using: pm2 logs shortmarket-staging"
echo "======================================================="
