const schedule = require('node-schedule');
const db = require('../database/db');
const { executeOrder } = require('./matchingEngine');

function isCommodity(symbol) {
    const commodities = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON'];
    for (const c of commodities) {
        if (symbol.startsWith(c)) return true;
    }
    return false;
}

async function processSquareOff(positionsToSquareOff, label, priceCache) {
    console.log(`Found ${positionsToSquareOff.length} open ${label} intraday positions to square off.`);
    for (const position of positionsToSquareOff) {
        try {
            const side = position.quantity > 0 ? 'SELL' : 'BUY';
            const quantity = Math.abs(position.quantity);
            
            let currentPrice = position.average_price;
            if (priceCache && priceCache[position.symbol] && priceCache[position.symbol].ltp) {
                currentPrice = priceCache[position.symbol].ltp;
            }

            let orderObj;
            await db.transaction(async (trx) => {
                const [id] = await trx('orders').insert({
                    user_id: position.user_id,
                    symbol: position.symbol,
                    type: 'MARKET',
                    side: side,
                    quantity: quantity,
                    price: currentPrice,
                    status: 'PENDING',
                    product_type: 'INT'
                }).returning('*');
                
                orderObj = typeof id === 'object' ? id : await trx('orders').where({ id }).first();
            });

            if (orderObj) {
                console.log(`Auto Square-Off created PENDING ${side} order #${orderObj.id} for ${quantity}x ${position.symbol}. Calling matching engine...`);
                await executeOrder(orderObj, currentPrice);
            }
        } catch (err) {
            console.error(`Failed to auto square-off position ${position.id}:`, err);
        }
    }
}

function initAutoSquareOff(priceCache) {
    console.log('🕒 Initializing Auto Square-Off Cron Jobs (3:16 PM for Equities, 11:30 PM for Commodities)...');

    // Job 1: 15:16 (3:16 PM) for Equities/Indices
    const eqRule = new schedule.RecurrenceRule();
    eqRule.dayOfWeek = [new schedule.Range(1, 5)];
    eqRule.hour = 15;
    eqRule.minute = 16;
    eqRule.tz = 'Asia/Kolkata';

    schedule.scheduleJob(eqRule, async function () {
        console.log('🚨 EQUITY AUTO SQUARE-OFF TRIGGERED AT 3:16 PM IST');
        try {
            const allIntraday = await db('positions').where('product_type', 'INT').andWhereNot('quantity', 0);
            const equityPositions = allIntraday.filter(p => !isCommodity(p.symbol));
            await processSquareOff(equityPositions, 'Equity/Index', priceCache);
        } catch (error) {
            console.error('Error during Equity auto square-off routine:', error);
        }
    });

    // Job 2: 23:30 (11:30 PM) for Commodities
    const comRule = new schedule.RecurrenceRule();
    comRule.dayOfWeek = [new schedule.Range(1, 5)];
    comRule.hour = 23;
    comRule.minute = 30;
    comRule.tz = 'Asia/Kolkata';

    schedule.scheduleJob(comRule, async function () {
        console.log('🚨 COMMODITY AUTO SQUARE-OFF TRIGGERED AT 11:30 PM IST');
        try {
            const allIntraday = await db('positions').where('product_type', 'INT').andWhereNot('quantity', 0);
            const commodityPositions = allIntraday.filter(p => isCommodity(p.symbol));
            await processSquareOff(commodityPositions, 'Commodity', priceCache);
        } catch (error) {
            console.error('Error during Commodity auto square-off routine:', error);
        }
    });
}

module.exports = { initAutoSquareOff };
