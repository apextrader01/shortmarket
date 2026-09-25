const fs = require('fs');
const file = 'backend/database/db.js';
let content = fs.readFileSync(file, 'utf8');

const target = "await db.raw('CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_id ON deposit_requests(user_id)');";
const replacement = target + "\n    await db.raw('CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at)');";

if (!content.includes('idx_orders_status_created')) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
}
