const fs = require('fs');
let dbCode = fs.readFileSync('backend/database/db.js', 'utf8');

// Strip out the incorrectly placed table creation
dbCode = dbCode.replace(/\s*\/\/ 10\. Referrals Table[\s\S]+?Created referrals table'\);\n      \}/, '');

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

// Insert it right before the catch (error) block
dbCode = dbCode.replace(/\s*\/\/ Check if we need to migrate existing better-sqlite3 data\?/, tableLogic + "\n      // Check if we need to migrate existing better-sqlite3 data?");

fs.writeFileSync('backend/database/db.js', dbCode);
