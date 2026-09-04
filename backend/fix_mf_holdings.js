const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('./database/db');
const axios = require('axios');

const MF_MAP = {
    'EDEL-MF': { code: '118615', fallbackNav: 61.66, targetInvested: 500 },
    'EDEL':    { code: '118615', fallbackNav: 61.66, targetInvested: 500 },
    'MIRA-MF': { code: '118825', fallbackNav: 126.99, targetInvested: 5000 },
    'MIRA':    { code: '118825', fallbackNav: 126.99, targetInvested: 5000 },
    'NIPP-MF': { code: '118778', fallbackNav: 209.96, targetInvested: 500 },
    'NIPP':    { code: '118778', fallbackNav: 209.96, targetInvested: 500 }
};

async function fixHoldings() {
    console.log('Checking holdings in database...');
    try {
        const holdings = await db('holdings').whereIn('symbol', Object.keys(MF_MAP));
        console.log('Found legacy mutual fund holding(s):', holdings.map(h => ({ id: h.id, symbol: h.symbol, qty: h.quantity, avg: h.average_price })));

        if (holdings.length === 0) {
            console.log('No legacy mutual fund holdings to update.');
            await db.destroy();
            return;
        }

        for (const h of holdings) {
            const config = MF_MAP[h.symbol];
            if (!config) continue;

            let liveNav = config.fallbackNav;
            try {
                const res = await axios.get('https://api.mfapi.in/mf/' + config.code, { timeout: 4000 });
                if (res.data && res.data.data && res.data.data[0] && res.data.data[0].nav) {
                    const parsed = parseFloat(res.data.data[0].nav);
                    if (!isNaN(parsed) && parsed > 0) liveNav = parsed;
                }
            } catch (e) {
                console.log('Could not fetch live NAV for ' + h.symbol + ', using fallback ' + liveNav);
            }

            const prevInvested = parseFloat(h.quantity) * parseFloat(h.average_price);
            const investedAmount = prevInvested > 0 ? prevInvested : config.targetInvested;
            const newUnits = parseFloat((investedAmount / liveNav).toFixed(4));

            console.log('Updating ' + h.symbol + ' (ID: ' + h.id + '):');
            console.log('  Previous: Qty=' + h.quantity + ', AvgPrice=' + h.average_price + ' (Invested=' + prevInvested + ')');
            console.log('  Updated:  Qty=' + newUnits + ', AvgPrice=' + liveNav.toFixed(2) + ' (Invested=' + investedAmount.toFixed(2) + ')');

            await db('holdings').where({ id: h.id }).update({
                quantity: newUnits,
                average_price: liveNav
            });
        }

        console.log('Successfully updated legacy mutual fund holdings to real AMFI NAVs!');
    } catch (err) {
        console.error('Error updating holdings:', err.message);
    } finally {
        await db.destroy();
    }
}

fixHoldings();
