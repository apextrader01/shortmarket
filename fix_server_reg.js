const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

// 1. Destructure referral_code
code = code.replace(/const \{ username, email, phone, password \} = req.body;/, 'const { username, email, phone, password, referral_code } = req.body;');

// 2. Insert referral code logic after generating client ID
const refLogic = `
    // Handle Referral Logic
    if (referral_code) {
      try {
        const referrer = await db('users').where({ id: referral_code }).first();
        if (referrer && referrer.id !== userId) {
          await db('referrals').insert({
            referrer_id: referrer.id,
            referred_user_id: userId,
            status: 'pending',
            reward_amount: 0
          });
        }
      } catch (e) {
        console.error('Failed to process referral code', e);
      }
    }
`;
code = code.replace(/await db\('users'\)\.where\(\{ id: userId \}\)\.update\(\{ client_id: clientId \}\);/, "await db('users').where({ id: userId }).update({ client_id: clientId });" + refLogic);

fs.writeFileSync('backend/server.js', code);
