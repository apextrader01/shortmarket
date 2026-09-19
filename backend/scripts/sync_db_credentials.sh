#!/bin/bash
# Sync PostgreSQL shortmarket_user password with DATABASE_URL in .env
set -e

ENV_PATH=""
if [ -f "/opt/shortmarket-staging/backend/.env" ]; then
    ENV_PATH="/opt/shortmarket-staging/backend/.env"
elif [ -f "./backend/.env" ]; then
    ENV_PATH="./backend/.env"
elif [ -f "./.env" ]; then
    ENV_PATH="./.env"
fi

if [ -z "$ENV_PATH" ]; then
    echo "❌ Error: Could not locate .env file."
    exit 1
fi

echo "🔍 Reading DATABASE_URL from $ENV_PATH..."
DB_URL=$(grep -E "^DATABASE_URL=" "$ENV_PATH" | head -n1 | cut -d'=' -f2-)

if [ -z "$DB_URL" ]; then
    echo "❌ Error: DATABASE_URL not found in $ENV_PATH"
    exit 1
fi

# Parse URL using Node
PARSED=$(node -e "
try {
    const raw = process.argv[1].replace(/^['\"]|['\"]$/g, '');
    const u = new URL(raw);
    const user = decodeURIComponent(u.username);
    const pass = decodeURIComponent(u.password);
    const db = u.pathname.replace(/^\//, '');
    console.log(user + ':::' + pass + ':::' + db);
} catch(e) {
    process.exit(1);
}
" "$DB_URL")

DB_USER=$(echo "$PARSED" | cut -d':' -f1)
DB_PASS=$(echo "$PARSED" | cut -d':' -f4)
DB_NAME=$(echo "$PARSED" | cut -d':' -f7)

echo "🐘 Aligning PostgreSQL user '$DB_USER' for database '$DB_NAME'..."

sudo -u postgres psql <<EOF
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER') THEN
      CREATE USER "$DB_USER" WITH PASSWORD '$DB_PASS';
   ELSE
      ALTER USER "$DB_USER" WITH PASSWORD '$DB_PASS';
   END IF;
END
\$\$;
GRANT ALL PRIVILEGES ON DATABASE "$DB_NAME" TO "$DB_USER";
EOF

echo "✅ PostgreSQL user '$DB_USER' password successfully synchronized!"
