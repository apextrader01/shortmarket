const fs = require('fs');
const file = 'backend/database/db.js';
let content = fs.readFileSync(file, 'utf8');

const target = `    console.log('? Critical columns and indexes verified on tables');`;
const replacement = `
    // Add bank details to users
    const hasUpiId = await db.schema.hasColumn('users', 'upi_id');
    if (!hasUpiId) {
      await db.schema.alterTable('users', table => {
        table.string('upi_id');
        table.string('bank_account_no');
        table.string('bank_ifsc');
      });
      console.log('Added bank details columns to users');
    }

    // Create reward_withdrawals table
    const hasRewardWithdrawals = await db.schema.hasTable('reward_withdrawals');
    if (!hasRewardWithdrawals) {
      await db.schema.createTable('reward_withdrawals', table => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.decimal('amount', 14, 2).notNullable();
        table.string('status').notNullable().defaultTo('PENDING'); // PENDING, PROCESSING, CREDITED, REJECTED
        table.string('admin_notes');
        table.timestamps(true, true);
      });
      console.log('Created reward_withdrawals table');
    }

    console.log('? Critical columns and indexes verified on tables');`;

content = content.replace(target, replacement);
fs.writeFileSync(file, content);
