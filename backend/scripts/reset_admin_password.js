/**
 * Admin Account Password Reset Helper
 * Usage: node backend/scripts/reset_admin_password.js "YourNewPassword"
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const db = require('../database/db');

async function main() {
  const newPassword = process.argv[2];
  if (!newPassword) {
    console.error('❌ Please provide a new password. Example:');
    console.error('   node backend/scripts/reset_admin_password.js "YourNewPassword"');
    process.exit(1);
  }

  const adminEmail = 'appwebsitetester@gmail.com';

  try {
    const user = await db('users').where({ email: adminEmail }).first();
    if (!user) {
      console.error(`❌ Admin account ${adminEmail} not found!`);
      process.exit(1);
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await db('users').where({ id: user.id }).update({
      password_hash,
      is_admin: true, // Keep admin privileges
      is_banned: false,
      updated_at: new Date()
    });

    console.log('====================================================');
    console.log(`✅ Admin Password Successfully Updated!`);
    console.log(`   Account:   ${adminEmail}`);
    console.log(`   Username:  ${user.username}`);
    console.log(`   Admin:     YES (is_admin: true)`);
    console.log(`   Password:  ${newPassword}`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Failed to update admin password:', err.message);
  } finally {
    process.exit(0);
  }
}

main();
