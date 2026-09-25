const fs = require('fs');
let code = fs.readFileSync('backend/database/db.js', 'utf8');

const referralsSQL = `
    // Ensure referrals table always exists (guaranteed path - no migration needed)
    await db.raw(\`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referred_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        reward_amount DECIMAL(14,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    \`);

`;

// Insert after system_configs creation block
code = code.replace(
  "    // Retroactively assign professional client IDs",
  referralsSQL + "    // Retroactively assign professional client IDs"
);

fs.writeFileSync('backend/database/db.js', code);
console.log('Done. Verifying...');
