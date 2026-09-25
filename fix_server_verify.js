const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const injection = `
        // --- Referral Reward Logic ---
        try {
          const pendingRef = await db('referrals')
            .where({ referred_user_id: req.user.id, status: 'pending' })
            .first();

          if (pendingRef) {
            const rewardAmount = plan === 'monthly' ? 9.9 : 49.9;
            
            // Mark as completed
            await db('referrals')
              .where({ id: pendingRef.id })
              .update({ status: 'completed', reward_amount: rewardAmount });
            
            // Credit referrer
            await db('users')
              .where({ id: pendingRef.referrer_id })
              .increment('balance', rewardAmount);
          }
        } catch (e) {
          console.error('Failed to process referral reward', e);
        }
        // -----------------------------
`;

code = code.replace(/subscription_expires: expires\s+\}\);\s+res\.json/, "subscription_expires: expires\n        });\n" + injection + "\n        res.json");
fs.writeFileSync('backend/server.js', code);
