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

function getDerivativeType(symbol) {
    if (isCommodity(symbol)) return 'commodity';
    const isIndex = symbol.startsWith('NIFTY') || symbol.startsWith('BANKNIFTY') || symbol.startsWith('FINNIFTY') || symbol.startsWith('MIDCPNIFTY') || symbol.startsWith('SENSEX') || symbol.startsWith('BANKEX');
    if (isIndex) return 'index';
    return 'stock';
}

function isExpiringToday(symbol) {
    const match = symbol.match(/(\d{2}[A-Z]{3}\d{2})/);
    if (!match) return false;
    
    const expiryStr = match[1];
    const day = parseInt(expiryStr.slice(0, 2), 10);
    const monthStr = expiryStr.slice(2, 5).toUpperCase();
    let year = parseInt(expiryStr.slice(5), 10);
    if (year < 100) year += 2000;
    
    const monthMap = { 'JAN':0, 'FEB':1, 'MAR':2, 'APR':3, 'MAY':4, 'JUN':5, 'JUL':6, 'AUG':7, 'SEP':8, 'OCT':9, 'NOV':10, 'DEC':11 };
    const month = monthMap[monthStr];
    
    if (!isNaN(day) && month !== undefined && !isNaN(year)) {
        const expiryDate = new Date(year, month, day);
        const today = new Date();
        return expiryDate.getFullYear() === today.getFullYear() &&
               expiryDate.getMonth() === today.getMonth() &&
               expiryDate.getDate() === today.getDate();
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

    // ─── EXPIRY DAY AUTO SQUARE-OFF JOBS ──────────────────────────────────────

    // Job 3: 15:15 (3:15 PM) for Expiring Stock Options & Futures
    const stockExpiryRule = new schedule.RecurrenceRule();
    stockExpiryRule.dayOfWeek = [new schedule.Range(1, 5)];
    stockExpiryRule.hour = 15;
    stockExpiryRule.minute = 15;
    stockExpiryRule.tz = 'Asia/Kolkata';

    schedule.scheduleJob(stockExpiryRule, async function () {
        console.log('🚨 EXPIRY DAY AUTO SQUARE-OFF TRIGGERED FOR STOCK DERIVATIVES AT 3:15 PM IST');
        try {
            const allPositions = await db('positions').whereNot('quantity', 0);
            const expiringStockDerivatives = allPositions.filter(p => isExpiringToday(p.symbol) && getDerivativeType(p.symbol) === 'stock');
            if (expiringStockDerivatives.length > 0) {
                await processSquareOff(expiringStockDerivatives, 'Expiring Stock Derivative', priceCache);
            }
        } catch (error) {
            console.error('Error during Expiring Stock auto square-off:', error);
        }
    });

    // Job 4: 15:25 (3:25 PM) for Expiring Index Options & Futures
    const indexExpiryRule = new schedule.RecurrenceRule();
    indexExpiryRule.dayOfWeek = [new schedule.Range(1, 5)];
    indexExpiryRule.hour = 15;
    indexExpiryRule.minute = 25;
    indexExpiryRule.tz = 'Asia/Kolkata';

    schedule.scheduleJob(indexExpiryRule, async function () {
        console.log('🚨 EXPIRY DAY AUTO SQUARE-OFF TRIGGERED FOR INDEX DERIVATIVES AT 3:25 PM IST');
        try {
            const allPositions = await db('positions').whereNot('quantity', 0);
            const expiringIndexDerivatives = allPositions.filter(p => isExpiringToday(p.symbol) && getDerivativeType(p.symbol) === 'index');
            if (expiringIndexDerivatives.length > 0) {
                await processSquareOff(expiringIndexDerivatives, 'Expiring Index Derivative', priceCache);
            }
        } catch (error) {
            console.error('Error during Expiring Index auto square-off:', error);
        }
    });

    // Job 5: 19:00 (7:00 PM) for Expiring Commodity Options & Futures
    const commodityExpiryRule = new schedule.RecurrenceRule();
    commodityExpiryRule.dayOfWeek = [new schedule.Range(1, 5)];
    commodityExpiryRule.hour = 19;
    commodityExpiryRule.minute = 0;
    commodityExpiryRule.tz = 'Asia/Kolkata';

    schedule.scheduleJob(commodityExpiryRule, async function () {
        console.log('🚨 EXPIRY DAY AUTO SQUARE-OFF TRIGGERED FOR COMMODITY DERIVATIVES AT 7:00 PM IST');
        try {
            const allPositions = await db('positions').whereNot('quantity', 0);
            const expiringCommodityDerivatives = allPositions.filter(p => isExpiringToday(p.symbol) && getDerivativeType(p.symbol) === 'commodity');
            if (expiringCommodityDerivatives.length > 0) {
                await processSquareOff(expiringCommodityDerivatives, 'Expiring Commodity Derivative', priceCache);
            }
        } catch (error) {
            console.error('Error during Expiring Commodity auto square-off:', error);
        }
    });
}

module.exports = { initAutoSquareOff };
