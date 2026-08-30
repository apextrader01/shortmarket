const fs = require('fs');
let code = fs.readFileSync('backend/services/mtmRiskManager.js', 'utf8');

const regex = /const userPositions = \{\};[\s\S]*?\} catch \(err\) \{/m;

const newLogic = `const userPositions = {};
            openPositions.forEach(pos => {
                if (!userPositions[pos.user_id]) userPositions[pos.user_id] = [];
                userPositions[pos.user_id].push(pos);
            });

            const userIdsInLoss = [];
            const userLossMap = {};

            // 1. Calculate P&L for everyone in memory (0 DB Queries)
            for (const [userId, positions] of Object.entries(userPositions)) {
                let totalMtmLoss = 0;

                for (const pos of positions) {
                    const ltp = this.priceCache[pos.symbol]?.ltp;
                    if (!ltp) continue; // Skip if no live price

                    let pnl = 0;
                    const absQty = Math.abs(pos.quantity);
                    if (pos.quantity > 0) {
                        pnl = (ltp - pos.average_price) * absQty;
                    } else {
                        pnl = (pos.average_price - ltp) * absQty;
                    }

                    if (pnl < 0) {
                        totalMtmLoss += Math.abs(pnl);
                    }
                }

                if (totalMtmLoss > 0) {
                    userIdsInLoss.push(userId);
                    userLossMap[userId] = totalMtmLoss;
                }
            }

            // 2. Fetch ALL balances in ONE single trip to the DB! (The N+1 Fix)
            if (userIdsInLoss.length > 0) {
                const users = await db('users')
                    .whereIn('id', userIdsInLoss)
                    .select('id', 'balance');

                for (const user of users) {
                    const totalMtmLoss = userLossMap[user.id];
                    const availableBalance = Number(user.balance);

                    // 95% Threshold Check against Available Balance
                    if (totalMtmLoss >= (availableBalance * 0.95)) {
                        console.log(\`[RMS ALERT] User \${user.id} hit 95% MTM Loss (\${totalMtmLoss} >= \${availableBalance * 0.95}). Liquidating!\`);
                        await this.liquidateUser(user.id, userPositions[user.id]);
                    }
                }
            }
        } catch (err) {`;

code = code.replace(regex, newLogic);
fs.writeFileSync('backend/services/mtmRiskManager.js', code);
console.log('Successfully patched mtmRiskManager to fix N+1 Loop');
