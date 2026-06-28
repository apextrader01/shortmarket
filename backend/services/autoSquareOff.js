const schedule = require('node-schedule');
const db = require('../database/db');

function initAutoSquareOff() {
    console.log('🕒 Initializing Auto Square-Off Cron Job for 3:14 PM IST...');

    // Schedule for 15:14 (3:14 PM) every weekday (Monday-Friday) in Asia/Kolkata timezone
    const rule = new schedule.RecurrenceRule();
    rule.dayOfWeek = [new schedule.Range(1, 5)];
    rule.hour = 15;
    rule.minute = 14;
    rule.tz = 'Asia/Kolkata';

    schedule.scheduleJob(rule, async function () {
        console.log('🚨 AUTO SQUARE-OFF TRIGGERED AT 3:14 PM IST');
        try {
            // Find all open intraday positions (product_type = 'INT' and quantity != 0)
            const openIntradayPositions = await db('positions')
                .where('product_type', 'INT')
                .andWhereNot('quantity', 0);
            
            console.log(`Found ${openIntradayPositions.length} open intraday positions to square off.`);

            for (const position of openIntradayPositions) {
                try {
                    // Determine side (if quantity > 0, we are long so we must SELL. If quantity < 0, we are short so we must BUY)
                    const side = position.quantity > 0 ? 'SELL' : 'BUY';
                    const quantity = Math.abs(position.quantity);

                    // Insert MARKET order to close position
                    await db.transaction(async (trx) => {
                        const [id] = await trx('orders').insert({
                            user_id: position.user_id,
                            symbol: position.symbol,
                            type: 'MARKET',
                            side: side,
                            quantity: quantity,
                            price: null, // Market order
                            status: 'PENDING',
                            product_type: 'INT'
                        }).returning('id');
                        
                        const orderId = typeof id === 'object' ? id.id : id;
                        console.log(`Auto Square-Off generated ${side} order #${orderId} for ${quantity}x ${position.symbol} (User: ${position.user_id})`);
                    });
                } catch (err) {
                    console.error(`Failed to auto square-off position ${position.id}:`, err);
                }
            }
        } catch (error) {
            console.error('Error during auto square-off routine:', error);
        }
    });
}

module.exports = { initAutoSquareOff };
