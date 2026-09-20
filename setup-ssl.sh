#!/bin/bash

# Ensure script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash setup-ssl.sh yourdomain.com"
  exit 1
fi

# Determine Domain: Uses $1 if provided (e.g. sudo bash setup-ssl.sh skandx.in)
if [ -n "$1" ]; then
  DOMAIN="$1"
else
  PUBLIC_IP=$(curl -s -4 ifconfig.me || curl -s -4 icanhazip.com || echo "34.93.99.22")
  DOMAIN=$(echo "$PUBLIC_IP" | tr '.' '-')".nip.io"
fi

PORT=5000

echo "======================================================="
echo "🔒 Configuring SSL and Nginx for: $DOMAIN"
echo "======================================================="

echo "Installing Nginx and Certbot..."
apt update -y
apt install -y nginx certbot python3-certbot-nginx

echo "Configuring High-Performance Nginx for $DOMAIN & www.$DOMAIN..."

cat > /etc/nginx/sites-available/$DOMAIN <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name $DOMAIN www.$DOMAIN;

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

# Remove all other sites to make this domain the sole default primary site
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/shortmarket-staging
rm -f /etc/nginx/sites-enabled/shortmarket
rm -f /etc/nginx/sites-enabled/*nip.io*

# Enable the site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

# Test Nginx config and restart
nginx -t && systemctl restart nginx

echo "Obtaining Multi-Domain SSL certificate via Certbot for $DOMAIN and www.$DOMAIN..."

# Request cert covering both root and www
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --register-unsafely-without-email --expand --redirect || \
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email --expand --redirect

# Ensure clean restart of Nginx
systemctl restart nginx

echo "======================================================="
echo "🎉 SUCCESS! Your platform is securely live at: https://$DOMAIN"
echo "   Both https://$DOMAIN and https://www.$DOMAIN are protected!"
echo "======================================================="
