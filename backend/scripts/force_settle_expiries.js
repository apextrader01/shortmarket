const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
process.env.TZ = 'Asia/Kolkata';

const db = require('../database/db');
const positionsEngine = require('../services/positionsEngine');

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('⚡ [MANUAL / IMMEDIATE EXPIRY SETTLEMENT SCRIPT]');
    console.log(`⏰ Current IST Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}`);
    console.log('═══════════════════════════════════════════════════════════════');

    try {
        console.log('\n🔄 0. Verifying database columns and indexes...');
        try {
            await db.raw('ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_exit BOOLEAN DEFAULT false;');
            await db.raw('ALTER TABLE orders_archive ADD COLUMN IF NOT EXISTS is_exit BOOLEAN DEFAULT false;');
            await db.raw('ALTER TABLE journal_trades ADD COLUMN IF NOT EXISTS trade_date VARCHAR(20);');
        } catch (dbErr) {
            console.warn('DB alter warning (non-fatal):', dbErr.message);
        }
        if (typeof db.ensureCriticalColumns === 'function') {
            await db.ensureCriticalColumns();
        }

        console.log('\n🔍 1. Settling Equities, Index Options & Stock Futures Expiries...');
        await positionsEngine.settleExpiries(false, false);

        console.log('\n🔍 2. Settling MCX Commodity Expiries...');
        await positionsEngine.settleExpiries(true, true);

        console.log('\n🔍 3. Verifying and Restoring any Erroneously Lapsed ITM Contracts...');
        const erroneouslyLapsed = await db('positions')
            .where({ exit_price: 0, quantity: 0 })
            .where('closed_quantity', '>', 0)
            .where(builder => {
                builder.where('symbol', 'like', '%PE%').orWhere('symbol', 'like', '%CE%');
            });

        for (const pos of erroneouslyLapsed) {
            const cleanSym = pos.symbol.replace(/^(NSE:|BSE:|MCX:)/i, '');
            let underlying = null;
            let strike = 0;
            let optType = null;

            const mMatch = cleanSym.match(/^([A-Z0-9]+?)(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?:(\d+)(CE|PE)|FUT)?$/i);
            if (mMatch) {
                underlying = mMatch[1].toUpperCase();
                if (mMatch[4] && mMatch[5]) {
                    strike = parseFloat(mMatch[4]);
                    optType = mMatch[5].toUpperCase();
                }
            } else {
                const wMatch = cleanSym.match(/^([A-Z0-9]+?)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$/i);
                if (wMatch) {
                    underlying = wMatch[1].toUpperCase();
                    strike = parseFloat(wMatch[5]);
                    optType = wMatch[6].toUpperCase();
                }
            }

            if (underlying && strike > 0 && optType) {
                // Dynamically resolve spot price from live cache, executed orders, or CLI overrides
                let spot = 0;
                for (const arg of process.argv) {
                    if (arg.toLowerCase().startsWith(`--spot-${underlying.toLowerCase()}=`)) {
                        const val = parseFloat(arg.split('=')[1]);
                        if (val > 0) spot = val;
                    }
                }

                if (spot === 0) {
                    let priceCache = {};
                    try {
                        const { getPriceFromCache } = require('../services/fyers');
                        if (typeof getPriceFromCache === 'function') priceCache = getPriceFromCache() || {};
                    } catch (e) {}

                    const candidates = [
                        `NSE:${underlying}50-INDEX`, `NSE:${underlying}BANK-INDEX`, `NSE:${underlying}-INDEX`,
                        `BSE:${underlying}-INDEX`, `MCX:${underlying}`, `NSE:${underlying}`, `BSE:${underlying}`, underlying
                    ];

                    for (const cand of candidates) {
                        if (priceCache[cand]?.ltp > 0) { spot = Number(priceCache[cand].ltp); break; }
                        if (priceCache[cand]?.close > 0) { spot = Number(priceCache[cand].close); break; }
                        if (priceCache[cand]?.prev_close_price > 0) { spot = Number(priceCache[cand].prev_close_price); break; }
                    }

                    if (spot === 0) {
                        const lastSpotOrder = await db('orders')
                            .whereIn('symbol', candidates)
                            .where({ status: 'EXECUTED' })
                            .orderBy('created_at', 'desc')
                            .first();
                        if (lastSpotOrder && Number(lastSpotOrder.price) > 0) {
                            spot = Number(lastSpotOrder.price);
                        }
                    }
                }

                if (!spot || spot <= 0) {
                    console.warn(`⚠️ [ITM Settlement] Skipping ${pos.symbol}: Cannot resolve spot close for ${underlying}. Pass --spot-${underlying}=<price> to settle.`);
                    continue;
                }

                if (spot) {
                    const intrinsic = optType === 'CE' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
                    if (intrinsic > 0) {
                        const correctLtp = parseFloat(intrinsic.toFixed(2));
                        const orderQty = Math.abs(parseFloat(pos.closed_quantity));
                        const entryPrice = Math.abs(parseFloat(pos.average_price));
                        const correctRealizedPnl = Math.round(((correctLtp - entryPrice) * orderQty + Number.EPSILON) * 100) / 100;
                        const payout = Math.round((correctLtp * orderQty + Number.EPSILON) * 100) / 100;

                        console.log(`\n⚡ Found erroneously lapsed ITM contract ${pos.symbol} for User ${pos.user_id}!`);
                        console.log(`   Strike: ${strike} ${optType}, Spot Close: ${spot}, True Value: ₹${correctLtp}`);
                        console.log(`   Qty: ${orderQty}, Entry: ₹${entryPrice}, Correct PnL: +₹${correctRealizedPnl}, Crediting User: ₹${payout}`);

                        await db.transaction(async (trx) => {
                            await trx.raw('SELECT pg_advisory_xact_lock(?)', [pos.user_id]);
                            
                            // 1. Update position record with true exit price and realized PnL
                            await trx('positions').where({ id: pos.id }).update({
                                exit_price: correctLtp,
                                realized_pnl: correctRealizedPnl,
                                updated_at: new Date()
                            });

                            // 2. Remove bogus "worthless loss" ledger entries for this contract
                            await trx('ledger')
                                .where({ user_id: pos.user_id })
                                .where('description', 'like', `%worthless%${pos.symbol}%`)
                                .del();

                            // 3. Credit user's balance with the full settlement payout
                            const u = await trx('users').where({ id: pos.user_id }).forUpdate().first();
                            if (u) {
                                const newBalance = Math.round((parseFloat(u.balance) + payout + Number.EPSILON) * 100) / 100;
                                await trx('users').where({ id: pos.user_id }).update({ balance: newBalance });
                            }

                            // 4. Insert accurate ledger records
                            await trx('ledger').insert({
                                user_id: pos.user_id,
                                amount: Math.round((entryPrice * orderQty) * 100) / 100,
                                type: 'MARGIN_RELEASE',
                                description: `Holding principal released for ITM settlement: ${pos.symbol}`
                            });
                            if (correctRealizedPnl !== 0) {
                                await trx('ledger').insert({
                                    user_id: pos.user_id,
                                    amount: correctRealizedPnl,
                                    type: 'REALIZED_PNL',
                                    description: `Realized profit on ITM expiry settlement: ${pos.symbol} (Settled @ ₹${correctLtp})`
                                });
                            }
                        });
                        console.log(`✅ [REPAIRED] ${pos.symbol} restored successfully for User ${pos.user_id}!`);
                    }
                }
            }
        }

        console.log('\n✅ All expired contracts (Positions & Holdings) processed successfully.');
    } catch (err) {
        console.error('❌ Expiry Settlement failed:', err);
    } finally {
        setTimeout(async () => {
            try {
                if (db.destroy) await db.destroy();
            } catch (e) {}
            process.exit(0);
        }, 3000);
    }
}

main();
