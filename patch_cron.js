const fs = require('fs');
let code = fs.readFileSync('backend/services/cronJobs.js', 'utf8');

const sipCronLogic = `
    // --- 9:30 AM SIP Execution ---
    cron.schedule('30 9 * * 1-5', async () => {
        console.log('[CRON] 9:30 AM: Executing due SIPs...');
        try {
            await db.transaction(async (trx) => {
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                
                const dueSips = await trx('sips')
                    .where('status', 'ACTIVE')
                    .where('next_execution_date', '<=', today);
                
                for (const sip of dueSips) {
                    try {
                        const user = await trx('users').where({ id: sip.user_id }).first();
                        const finalMargin = Number(sip.amount);
                        
                        if (Number(user.balance) < finalMargin) {
                            console.log(\`[SIP] Skipped \${sip.id} for user \${user.id} - Insufficient Funds\`);
                            continue;
                        }
                        
                        // Deduct balance
                        const newBalance = Number(user.balance) - finalMargin;
                        await trx('users').where({ id: sip.user_id }).update({ balance: newBalance });
                        
                        await trx('ledger').insert({
                            user_id: sip.user_id,
                            amount: -finalMargin,
                            type: 'MARGIN_BLOCK',
                            description: \`Auto SIP installment blocked for \${sip.symbol}\`
                        });
                        
                        // Execute Market Order
                        const execPrice = priceCache[sip.symbol]?.ltp || 1;
                        const qty = parseFloat((finalMargin / execPrice).toFixed(4));
                        
                        const [id] = await trx('orders').insert({
                            user_id: sip.user_id, symbol: sip.symbol, type: 'MARKET', side: 'BUY', quantity: qty, price: execPrice,
                            status: 'PENDING', product_type: 'DEL', margin: finalMargin
                        }).returning('id');
                        const orderId = typeof id === 'object' ? id.id : id;
                        
                        triggerEngine.executeOrder({
                            id: orderId, user_id: sip.user_id, symbol: sip.symbol, type: 'MARKET', side: 'BUY', quantity: qty, price: execPrice,
                            status: 'PENDING', product_type: 'DEL', margin: finalMargin
                        }, execPrice).catch(e => console.error('SIP execution error:', e));
                        
                        // Calculate next date
                        let nextExecutionDate = new Date(sip.next_execution_date);
                        if (sip.frequency === 'DAILY') {
                            nextExecutionDate.setDate(nextExecutionDate.getDate() + 1);
                        } else if (sip.frequency === 'WEEKLY') {
                            nextExecutionDate.setDate(nextExecutionDate.getDate() + 7);
                        } else {
                            nextExecutionDate.setMonth(nextExecutionDate.getMonth() + 1);
                        }
                        while (nextExecutionDate.getDay() === 0 || nextExecutionDate.getDay() === 6) {
                            nextExecutionDate.setDate(nextExecutionDate.getDate() + 1);
                        }
                        
                        // Update Next Execution Date
                        await trx('sips').where({ id: sip.id }).update({ next_execution_date: nextExecutionDate });
                        
                    } catch (e) {
                        console.error(\`[SIP] Error processing SIP \${sip.id}:\`, e);
                    }
                }
            });
        } catch (err) {
            console.error('[CRON] SIP execution error:', err);
        }
    }, TZ);
`;

code = code.replace(
    '// --- 1:00 AM Expired Watchlist Cleanup ---',
    sipCronLogic + '\n    // --- 1:00 AM Expired Watchlist Cleanup ---'
);

fs.writeFileSync('backend/services/cronJobs.js', code, 'utf8');
console.log('Patched cronJobs.js with SIP executor');
