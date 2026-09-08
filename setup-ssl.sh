#!/bin/bash

# Ensure script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo bash setup-ssl.sh)"
  exit 1
fi

# Determine Domain: Uses $1 if provided (e.g. sudo bash setup-ssl.sh shortmarket.in), otherwise auto-detects VM IP for nip.io
if [ -n "$1" ]; then
  DOMAIN="$1"
else
  PUBLIC_IP=$(curl -s -4 ifconfig.me || curl -s -4 icanhazip.com || echo "34.93.99.22")
  DOMAIN=$(echo "$PUBLIC_IP" | tr '.' '-')".nip.io"
fi

PORT=5000

echo "Installing Nginx and Certbot..."
apt update
apt install -y nginx certbot python3-certbot-nginx

echo "Configuring High-Performance Nginx for $DOMAIN..."

cat > /etc/nginx/sites-available/$DOMAIN <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Maximum file upload size for KYC & profile images (20MB)
    client_max_body_size 20M;

    # Gzip Compression - Slashes Network Bandwidth by 65-70%
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

    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;

        # WebSocket Long-Lived Connection Timeout (Keeps live ticks alive 24/7)
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx config and restart
nginx -t && systemctl restart nginx

echo "Obtaining SSL certificate via Certbot..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email

echo "Done! Your platform is now securely running at https://$DOMAIN"

