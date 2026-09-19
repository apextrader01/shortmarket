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
        const parsedAmount = parseFloat(amount) || 0;
        if (parsedAmount <= 0) return;
        
        const user = await trx('users').where({ id: userId }).forUpdate().first();
        if (parseFloat(user.balance) < parsedAmount) {
            throw new Error('Insufficient funds');
        }
        
        await trx('users').where({ id: userId }).update({ balance: parseFloat(user.balance) - parsedAmount });
        await trx('ledger').insert({
            user_id: userId,
            amount: -parsedAmount,
            type: 'MARGIN_BLOCK',
            description
        });
    }

    /**
     * Releases exact margin when an order is cancelled or swept.
     */
    static async releaseMargin(trx, userId, amount, description) {
        const parsedAmount = parseFloat(amount) || 0;
        if (parsedAmount <= 0) return;
        
        const user = await trx('users').where({ id: userId }).forUpdate().first();
        await trx('users').where({ id: userId }).update({ balance: parseFloat(user.balance) + parsedAmount });
        await trx('ledger').insert({
            user_id: userId,
            amount: parsedAmount,
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
            const user = await trx('users').where({ id: userId }).forUpdate().first();
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
    static async closePosition(trx, userId, positionId, exitPrice, isForcedRMSExit = false, customRemark = '') {
        const position = await trx('positions').where({ id: positionId }).forUpdate().first();
        if (!position || Number(position.quantity) === 0) return;

        const quantity = Number(position.quantity);
        const entryPrice = Math.abs(parseFloat(position.average_price) || 0);
        const symbol = position.symbol;
        const productType = position.product_type;
        const side = quantity > 0 ? 'SELL' : 'BUY'; // To close long, you sell. To close short, you buy.
        const absQty = Math.abs(quantity);
        const validExitPrice = (exitPrice !== undefined && exitPrice !== null && !isNaN(Number(exitPrice)) && Number(exitPrice) > 0) 
            ? Number(exitPrice) 
            : entryPrice;

        // 1. Calculate P&L
        let realizedPnl = 0;
        if (quantity > 0) {
            realizedPnl = (validExitPrice - entryPrice) * absQty;
        } else {
            realizedPnl = (entryPrice - validExitPrice) * absQty;
        }
        realizedPnl = Math.round((realizedPnl + Number.EPSILON) * 100) / 100;

        // 2. Calculate Exit Taxes
        const taxesObj = calculateTaxes(symbol, productType, side, absQty, validExitPrice);
        const exitTaxes = taxesObj.totalTaxes;

        // 3. RMS Penalty
        const rmsPenalty = isForcedRMSExit ? 59 : 0;

        // Create completed exit order record for audit & history log
        await trx('orders').insert({
            user_id: userId,
            symbol: symbol,
            type: 'MARKET',
            side: side,
            quantity: absQty,
            filled_quantity: absQty,
            pending_quantity: 0,
            price: validExitPrice,
            average_price: validExitPrice,
            order_variety: 'REGULAR',
            status: 'EXECUTED',
            product_type: productType,
            margin: 0,
            realized_pnl: realizedPnl,
            taxes: exitTaxes,
            remarks: customRemark || (isForcedRMSExit ? 'Auto-Square-Off (RMS)' : 'Exit'),
            created_at: new Date(),
            updated_at: new Date()
        });

        // 4. Calculate Total Release Amount
        // Release Amount = (Original Blocked Margin) + (Realized P&L) - (Exit Taxes) - (RMS Penalty)
        const marginBlocked = parseFloat(position.margin) || 0;
        const netRelease = Math.round((marginBlocked + realizedPnl - exitTaxes - rmsPenalty + Number.EPSILON) * 100) / 100;

        // 5. Update Ledger & Balance
        const user = await trx('users').where({ id: userId }).forUpdate().first();
        await trx('users').where({ id: userId }).update({ balance: Math.round((parseFloat(user.balance) + netRelease + Number.EPSILON) * 100) / 100 });

        if (marginBlocked > 0) {
            await trx('ledger').insert({
                user_id: userId,
                amount: marginBlocked,
                type: 'MARGIN_RELEASE',
                description: `Margin released for closing ${symbol}`
            });
        }

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
            closed_quantity: trx.raw('COALESCE(closed_quantity, 0) + ?', [absQty]),
            exit_price: validExitPrice,
            margin: 0,
            realized_pnl: trx.raw('COALESCE(realized_pnl, 0) + ?', [realizedPnl]),
            updated_at: new Date()
        });

        return { realizedPnl, exitTaxes, rmsPenalty, netRelease };
    }

    /**
     * Auto-converts an unfilled intraday LONG position to CNC Delivery at 3:30 PM.
     * Calculates full delivery cash requirement; records debit balance / margin shortfall if cash is insufficient.
     */
    static async convertPositionToDelivery(trx, userId, positionId, currentPrice) {
        const position = await trx('positions').where({ id: positionId }).forUpdate().first();
        if (!position || Number(position.quantity) <= 0) return null;

        const quantity = Number(position.quantity);
        const symbol = position.symbol;
        const entryPrice = Math.abs(parseFloat(position.average_price) || 0);
        // Delivery principal is based on actual cost basis of purchase
        const deliveryPrincipal = Math.round((quantity * entryPrice + Number.EPSILON) * 100) / 100;
        const marginBlocked = parseFloat(position.margin) || 0;
        const additionalDebit = Math.round((deliveryPrincipal - marginBlocked + Number.EPSILON) * 100) / 100;

        // Debit the additional required cash from user balance (allows debit balance / shortfall)
        const user = await trx('users').where({ id: userId }).forUpdate().first();
        const prevBalance = parseFloat(user.balance) || 0;
        const newBalance = Math.round((prevBalance - additionalDebit + Number.EPSILON) * 100) / 100;
        await trx('users').where({ id: userId }).update({ balance: newBalance });

        if (additionalDebit > 0) {
            await trx('ledger').insert({
                user_id: userId,
                amount: -additionalDebit,
                type: 'MARGIN_SHORTFALL_CONVERSION',
                description: `Additional cash debited for delivery conversion of ${quantity} ${symbol} @ ₹${entryPrice.toFixed(2)}${newBalance < 0 ? ' (Debit Balance / Margin Shortfall)' : ''}`
            });
        }

        // Convert product type to canonical 'DEL' in positions table and store full principal as margin
        // This ensures the user's capital is 100% refunded when the delivery position is sold later!
        await trx('positions').where({ id: positionId }).update({
            product_type: 'DEL',
            margin: deliveryPrincipal,
            updated_at: new Date()
        });

        console.log(`[EOD AUTO-CONVERSION] Converted ${quantity} ${symbol} for User ${userId} to DEL Delivery. Margin: ₹${deliveryPrincipal}, New Balance: ₹${newBalance}`);
        return { success: true, quantity, symbol, entryPrice, deliveryPrincipal, newBalance };
    }

    /**
     * Settles an unfilled intraday SHORT position via Exchange Short Delivery Auction.
     * Liquidates at auction settlement price (Upper Circuit or close + 5% penalty).
     */
    static async settleShortDeliveryAuction(trx, userId, positionId, auctionPrice) {
        const position = await trx('positions').where({ id: positionId }).forUpdate().first();
        if (!position || Number(position.quantity) >= 0) return null;

        const quantity = Number(position.quantity);
        const absQty = Math.abs(quantity);
        const symbol = position.symbol;
        const entryPrice = Math.abs(parseFloat(position.average_price) || 0);
        const finalPrice = (auctionPrice && Number(auctionPrice) > 0) ? Number(auctionPrice) : (entryPrice * 1.05);

        // 5% standard exchange auction penalty
        const auctionPenalty = Math.round((finalPrice * absQty * 0.05 + Number.EPSILON) * 100) / 100;
        // Realized loss for short: (entryPrice - finalPrice) * qty
        const realizedPnl = Math.round(((entryPrice - finalPrice) * absQty + Number.EPSILON) * 100) / 100;

        const taxesObj = calculateTaxes(symbol, position.product_type, 'BUY', absQty, finalPrice);
        const exitTaxes = taxesObj.totalTaxes;

        const marginBlocked = parseFloat(position.margin) || 0;
        const netRelease = Math.round((marginBlocked + realizedPnl - auctionPenalty - exitTaxes + Number.EPSILON) * 100) / 100;

        const user = await trx('users').where({ id: userId }).forUpdate().first();
        const prevBalance = parseFloat(user.balance) || 0;
        const newBalance = Math.round((prevBalance + netRelease + Number.EPSILON) * 100) / 100;
        await trx('users').where({ id: userId }).update({ balance: newBalance });

        // Insert historical completed order record
        await trx('orders').insert({
            user_id: userId,
            symbol: symbol,
            type: 'MARKET',
            side: 'BUY',
            quantity: absQty,
            filled_quantity: absQty,
            pending_quantity: 0,
            price: finalPrice,
            average_price: finalPrice,
            order_variety: 'REGULAR',
            status: 'EXECUTED',
            product_type: position.product_type,
            margin: 0,
            realized_pnl: realizedPnl,
            taxes: exitTaxes,
            remarks: `Short Delivery Auction Settlement @ ₹${finalPrice.toFixed(2)} (+5% penalty)`,
            created_at: new Date(),
            updated_at: new Date()
        });

        if (marginBlocked > 0) {
            await trx('ledger').insert({
                user_id: userId,
                amount: marginBlocked,
                type: 'MARGIN_RELEASE',
                description: `Margin released on Short Delivery Auction settlement: ${symbol}`
            });
        }

        if (realizedPnl !== 0) {
            await trx('ledger').insert({
                user_id: userId,
                amount: realizedPnl,
                type: 'REALIZED_PNL',
                description: `Realized loss on Short Delivery Auction: ${absQty} ${symbol}`
            });
        }

        if (auctionPenalty > 0) {
            await trx('ledger').insert({
                user_id: userId,
                amount: -auctionPenalty,
                type: 'SHORT_DELIVERY_AUCTION_SETTLEMENT',
                description: `Exchange Auction Penalty (5%) for Short Delivery on ${absQty} ${symbol}`
            });
        }

        if (exitTaxes > 0) {
            await trx('ledger').insert({
                user_id: userId,
                amount: -exitTaxes,
                type: 'TAXES',
                description: `Auction Settlement Taxes for ${symbol}`
            });
        }

        // Close position
        await trx('positions').where({ id: positionId }).update({
            quantity: 0,
            closed_quantity: trx.raw('COALESCE(closed_quantity, 0) + ?', [absQty]),
            exit_price: finalPrice,
            margin: 0,
            realized_pnl: trx.raw('COALESCE(realized_pnl, 0) + ?', [realizedPnl]),
            updated_at: new Date()
        });

        console.log(`[EOD AUCTION SETTLEMENT] Settled Short Delivery of ${absQty} ${symbol} for User ${userId} @ ₹${finalPrice} (Penalty: ₹${auctionPenalty})`);
        return { success: true, absQty, symbol, finalPrice, auctionPenalty, realizedPnl, newBalance };
    }
}

module.exports = LedgerService;
