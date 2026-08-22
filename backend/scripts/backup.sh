#!/bin/bash

# Configuration
DB_NAME="shortmarket"
DB_USER="postgres"
BACKUP_DIR="$HOME/db_backups"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="shortmarket_backup_$DATE.sql.gz"
LOCAL_FILE="$BACKUP_DIR/$FILENAME"

# 1. Create local backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# 2. Dump the database and compress it
echo "Taking backup of $DB_NAME..."
sudo -u postgres pg_dump -d "$DB_NAME" | gzip > "$LOCAL_FILE"

if [ $? -eq 0 ]; then
  echo "? Backup successfully created at $LOCAL_FILE"
else
  echo "? Error creating backup."
  exit 1
fi

# 3. Upload to Google Cloud Storage
# Replace YOUR_BUCKET_NAME with your actual bucket name when ready
# gsutil cp "$LOCAL_FILE" gs://YOUR_BUCKET_NAME/backups/

# 4. Delete old backups (keep last 7 days) to save space
echo "Cleaning up backups older than 7 days..."
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +7 -exec rm {} \;

echo "Backup process completed."
