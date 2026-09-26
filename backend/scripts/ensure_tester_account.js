/**
 * Google Play Store Reviewer & QA Demo Account Provisioner
 * Run via: node backend/scripts/ensure_tester_account.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const db = require('../database/db');

async function main() {
  console.log('====================================================');
  console.log('📱 Google Play Store Tester Account Provisioning');
  console.log('====================================================\n');

  const testerEmail = 'appwebsitetester@gmail.com';
  const testerPass = 'Tester@12345';
  const testerUsername = 'playstore_tester';

  try {
    const password_hash = await bcrypt.hash(testerPass, 10);
    const existing = await db('users').where({ email: testerEmail }).first();

    const defaultWatchlists = JSON.stringify([
      { id: 1, name: 'Nifty 50', symbols: ['NSE:RELIANCE-EQ', 'NSE:TCS-EQ', 'NSE:INFY-EQ', 'NSE:HDFCBANK-EQ'] },
      { id: 2, name: 'Options & Futures', symbols: ['NSE:NIFTY26SEPFUT', 'NSE:BANKNIFTY26SEPFUT'] }
    ]);

    if (!existing) {
      const [newUserId] = await db('users').insert({
        username: testerUsername,
        email: testerEmail,
        password_hash,
        balance: 1000000.0,
        phone: '9876543210',
        subscription_tier: 'PRO',
        is_admin: false,
        is_onboarded: true,
        watchlists: defaultWatchlists,
        created_at: new Date(),
        updated_at: new Date()
      }).returning('id');

      const id = typeof newUserId === 'object' ? newUserId.id : newUserId;
      const clientId = 'SE' + Number(id).toString(36).toUpperCase().padStart(6, '0');
      await db('users').where({ id }).update({ client_id: clientId });

      console.log(`✅ Successfully created Google Play Store tester account!`);
      console.log(`   User ID:   ${id}`);
      console.log(`   Client ID: ${clientId}`);
    } else {
      await db('users').where({ id: existing.id }).update({
        password_hash,
        is_banned: false,
        is_onboarded: true,
        updated_at: new Date()
      });
      console.log(`✅ Successfully updated & unbanned existing tester account (ID: ${existing.id})!`);
    }

    console.log('\n====================================================');
    console.log('📋 GOOGLE PLAY CONSOLE APP ACCESS CREDENTIALS:');
    console.log('====================================================');
    console.log(`Email / Username: ${testerEmail}`);
    console.log(`Password:         ${testerPass}`);
    console.log(`Static 2FA OTP:   123456`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Failed to provision tester account:', err.message);
  } finally {
    process.exit(0);
  }
}

main();
