#!/bin/bash

# Ensure script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo bash setup-ssl.sh)"
  exit 1
fi

DOMAIN="34-131-25-109.nip.io"
PORT=3000

echo "Installing Nginx and Certbot..."
apt update
apt install -y nginx certbot python3-certbot-nginx

echo "Configuring Nginx for $DOMAIN..."

cat > /etc/nginx/sites-available/$DOMAIN <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
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

echo "Done! Your backend API is now securely running at https://$DOMAIN"
