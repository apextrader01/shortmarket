const fs = require('fs');
let dbCode = fs.readFileSync('backend/database/db.js', 'utf8');

const tableLogic = `
      // 10. Referrals Table
      const hasReferrals = await db.schema.hasTable('referrals');
      if (!hasReferrals) {
        await db.schema.createTable('referrals', table => {
          table.increments('id').primary();
          table.integer('referrer_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
          table.integer('referred_user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
          table.string('status').defaultTo('pending');
          table.decimal('reward_amount', 14, 2).defaultTo(0);
          table.timestamps(true, true);
        });
        console.log('Created referrals table');
      }
`;

// Regex matches the previously injected block (including trailing spaces and newlines)
dbCode = dbCode.replace(/\s*\/\/ 10\. Referrals Table[\s\S]+?console\.log\('Created referrals table'\);\n      \}\n\n/, '');

// Add it back cleanly outside the `if (!hasIsOnboarded)` block
dbCode = dbCode.replace("console.log('Added is_onboarded to users table');\n      }", "console.log('Added is_onboarded to users table');\n      }\n" + tableLogic);

fs.writeFileSync('backend/database/db.js', dbCode);
