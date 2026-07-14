const db = require('../database/db');
const { calculateTaxes } = require('./taxCalculator');

/**
 * Handles all strictly regulated ledger transactions.
 */
class LedgerService {
    /**
     * Blocks margin when an order is placed (PENDING).
     */
    static async blockMargin(trx, userId, amount, description) {
        if (amount <= 0) return;
        
        const user = await trx('users').where({ id: userId }).first();
        if (user.balance < amount) {
            throw new Error('Insufficient funds');
        }
        
        await trx('users').where({ id: userId }).update({ balance: parseFloat(user.balance) - amount });
        await trx('ledger').insert({
            user_id: userId,
            amount: -amount,
            type: 'MARGIN_BLOCK',
            description
        });
    }

    /**
     * Releases exact margin when an order is cancelled or swept.
     */
    static async releaseMargin(trx, userId, amount, description) {
        if (amount <= 0) return;
        
        const user = await trx('users').where({ id: userId }).first();
        await trx('users').where({ id: userId }).update({ balance: parseFloat(user.balance) + amount });
        await trx('ledger').insert({
            user_id: userId,
            amount: amount,
            type: 'MARGIN_RELEASE',
            description
        });
    }

    /**
     * Deducts Brokerage & Taxes when an order becomes EXECUTED.
     */
    static async chargeExecutionTaxes(trx, userId, symbol, productType, side, quantity, price) {
        const taxesObj = calculateTaxes(symbol, productType, side, quantity, price);
        const totalTaxes = taxesObj.totalTaxes;
        
        if (totalTaxes > 0) {
            const user = await trx('users').where({ id: userId }).first();
            await trx('users').where({ id: userId }).update({ balance: parseFloat(user.balance) - totalTaxes });
            await trx('ledger').insert({
                user_id: userId,
                amount: -totalTaxes,
                type: 'TAXES',
                description: `Taxes & Brokerage for ${side} ${quantity} ${symbol}`
            });
        }
        return totalTaxes;
    }

    /**
     * Handles position exit, applying realized P&L, taxes, and margin release.
     * Optionally applies a ₹59 RMS Penalty for forced exits.
     */
    static async closePosition(trx, userId, positionId, exitPrice, isForcedRMSExit = false) {
        const position = await trx('positions').where({ id: positionId }).first();
        if (!position || position.quantity === 0) return;

        const quantity = position.quantity;
        const entryPrice = position.average_price;
        const symbol = position.symbol;
        const productType = position.product_type;
        const side = quantity > 0 ? 'SELL' : 'BUY'; // To close long, you sell. To close short, you buy.
        const absQty = Math.abs(quantity);

        // 1. Calculate P&L
        let realizedPnl = 0;
        if (quantity > 0) {
            realizedPnl = (exitPrice - entryPrice) * absQty;
        } else {
            realizedPnl = (entryPrice - exitPrice) * absQty;
        }

        // 2. Calculate Exit Taxes
        const taxesObj = calculateTaxes(symbol, productType, side, absQty, exitPrice);
        const exitTaxes = taxesObj.totalTaxes;

        // 3. RMS Penalty
        const rmsPenalty = isForcedRMSExit ? 59 : 0;

        // 4. Calculate Total Release Amount
        // Release Amount = (Original Blocked Margin) + (Realized P&L) - (Exit Taxes) - (RMS Penalty)
        const marginBlocked = position.margin;
        const netRelease = marginBlocked + realizedPnl - exitTaxes - rmsPenalty;

        // 5. Update Ledger & Balance
        const user = await trx('users').where({ id: userId }).first();
        await trx('users').where({ id: userId }).update({ balance: parseFloat(user.balance) + netRelease });

        await trx('ledger').insert({
            user_id: userId,
            amount: marginBlocked,
            type: 'MARGIN_RELEASE',
            description: `Margin released for closing ${symbol}`
        });

        if (realizedPnl !== 0) {
            await trx('ledger').insert({
                user_id: userId,
                amount: realizedPnl,
                type: 'REALIZED_PNL',
                description: `Realized P&L for ${symbol}`
            });
        }

        if (exitTaxes > 0) {
            await trx('ledger').insert({
                user_id: userId,
                amount: -exitTaxes,
                type: 'TAXES',
                description: `Exit Taxes & Brokerage for ${symbol}`
            });
        }

        if (rmsPenalty > 0) {
            await trx('ledger').insert({
                user_id: userId,
                amount: -rmsPenalty,
                type: 'RMS_PENALTY',
                description: `Auto-Square-Off RMS Penalty for ${symbol}`
            });
        }

        // 6. Update Position
        await trx('positions').where({ id: positionId }).update({
            quantity: 0,
            closed_quantity: trx.raw('closed_quantity + ?', [absQty]),
            exit_price: exitPrice,
            margin: 0
        });

        return { realizedPnl, exitTaxes, rmsPenalty, netRelease };
    }
}

module.exports = LedgerService;
