/**
 * End-to-End Order Routing & Validation Test
 * Simulates order payloads arriving at /api/orders across various market sessions
 */
const { isCommodityContract, isDerivativeContract, getAssetSubsegment } = require('./services/instrumentsCache');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  \x1b[32m✔ PASS:\x1b[0m ${message}`);
    } else {
        failedTests++;
        console.error(`  \x1b[31m✖ FAIL:\x1b[0m ${message}`);
    }
}

console.log('\n=============================================================');
console.log('ORDER ROUTING & VALIDATION UNIT / E2E TEST');
console.log('=============================================================');

// Mock order processor imitating /api/orders validation and routing logic
function simulateOrderPlacement(orderPayload, simulatedSession) {
    const { symbol, product_type, type, price, isClosingOrder, rawVariety } = orderPayload;
    const isMF = symbol.endsWith('-MF') || symbol.includes('MUTUALFUND');

    let isAmo = (rawVariety === 'AMO' || Boolean(orderPayload.is_amo));
    let isCas = (rawVariety === 'CAS' || Boolean(orderPayload.is_cas));
    let postMarketPrice = null;

    if (!isMF) {
        const isCommodity = isCommodityContract(symbol);
        const marketCheck = simulatedSession;

        if (!marketCheck.open) {
            if (marketCheck.isTotalBlock) {
                return { status: 400, error: marketCheck.reason };
            }
            const userWantsAmo = (rawVariety === 'AMO' || Boolean(orderPayload.is_amo));
            if (userWantsAmo) {
                if (!marketCheck.isAmoWindow) {
                    const amoTimingMsg = isCommodity
                        ? 'After Market Orders (AMO) for MCX can only be placed between 11:30 PM and 08:57 AM. Regular market session is currently active.'
                        : 'After Market Orders (AMO) can only be placed between 03:45 PM and 08:57 AM. Normal market session is currently active.';
                    return { status: 400, error: marketCheck.reason || amoTimingMsg };
                }
                isAmo = true;
            } else {
                if (marketCheck.isAmoWindow) {
                    const hoursDesc = isCommodity ? '09:00 AM - 11:30 PM' : '09:15 AM - 03:30 PM';
                    const marketName = isCommodity ? 'MCX Commodity Market' : 'Market';
                    return {
                        status: 400,
                        error: `${marketName} is closed. Regular orders can only be placed during trading hours (${hoursDesc}). Please select AMO to place an After Market Order.`
                    };
                }
                return { status: 400, error: marketCheck.reason };
            }
        } else {
            if (marketCheck.isCas || marketCheck.session === 'PRE_MARKET' || marketCheck.session === 'CLOSING_AUCTION') {
                isCas = true;
            }
            if (marketCheck.isPostMarket || marketCheck.session === 'POST_MARKET') {
                postMarketPrice = orderPayload.mockClosePrice || 2500;
            }
        }
    }

    // BO / CO disallowed in AMO
    if (isAmo && (product_type === 'BO' || product_type === 'CO')) {
        return {
            status: 400,
            error: 'Bracket Orders (BO) and Cover Orders (CO) are not permitted in After Market Orders (AMO).'
        };
    }

    const orderVariety = isCas ? 'CAS' : (isAmo ? 'AMO' : 'REGULAR');
    const orderStatus = (isAmo || isCas) ? 'AMO_PENDING' : (type === 'MARKET' ? 'PENDING' : 'PENDING');
    const execPrice = postMarketPrice ? postMarketPrice : price;

    return {
        status: 200,
        order: {
            symbol,
            product_type,
            order_variety: orderVariety,
            order_status: orderStatus,
            price: execPrice
        }
    };
}

// Test Cases:
// 1. Explicit AMO Order during AMO Window at 08:30 AM
const amoRes = simulateOrderPlacement(
    { symbol: 'RELIANCE', product_type: 'DEL', type: 'LIMIT', price: 2900, is_amo: true },
    { open: false, isAmoWindow: true, session: 'AMO', reason: 'AMO Active' }
);
assert(amoRes.status === 200 && amoRes.order.order_variety === 'AMO' && amoRes.order.order_status === 'AMO_PENDING', '08:30 AM: Explicit AMO order routes as AMO (status: AMO_PENDING)');

// 1b. Regular order outside market hours is strictly rejected (NOT auto-converted to AMO)
const regularClosedRes = simulateOrderPlacement(
    { symbol: 'RELIANCE', product_type: 'DEL', type: 'LIMIT', price: 2900, is_amo: false },
    { open: false, isAmoWindow: true, session: 'AMO', reason: 'AMO Active' }
);
assert(regularClosedRes.status === 400 && regularClosedRes.error.includes('Regular orders can only be placed during trading hours'), 'Regular order outside market hours is rejected with 400 error');

// 2. BO / CO order during AMO is strictly blocked
const amoBoRes = simulateOrderPlacement(
    { symbol: 'RELIANCE', product_type: 'BO', type: 'LIMIT', price: 2900, is_amo: true },
    { open: false, isAmoWindow: true, session: 'AMO', reason: 'AMO Active' }
);
assert(amoBoRes.status === 400 && amoBoRes.error.includes('Bracket Orders'), '08:30 AM: Bracket Order during AMO is blocked with 400 error');

// 3. Pre-market Delivery at 09:05 AM routes as CAS
const preMarketDelRes = simulateOrderPlacement(
    { symbol: 'RELIANCE', product_type: 'DEL', type: 'LIMIT', price: 2900 },
    { open: true, isCas: true, session: 'PRE_MARKET' }
);
assert(preMarketDelRes.status === 200 && preMarketDelRes.order.order_variety === 'CAS' && preMarketDelRes.order.order_status === 'AMO_PENDING', '09:05 AM: Pre-Market Delivery order routes as CAS (status: AMO_PENDING)');

// 4. Pre-market Intraday at 09:05 AM is rejected with 400
const preMarketIntRes = simulateOrderPlacement(
    { symbol: 'RELIANCE', product_type: 'INT', type: 'LIMIT', price: 2900 },
    { open: false, session: 'PRE_MARKET', reason: 'Intraday orders blocked during pre-market' }
);
assert(preMarketIntRes.status === 400 && preMarketIntRes.error.includes('pre-market'), '09:05 AM: Pre-Market Intraday order is rejected with descriptive reason');

// 5. Normal session regular order
const normalRes = simulateOrderPlacement(
    { symbol: 'RELIANCE', product_type: 'INT', type: 'LIMIT', price: 2900 },
    { open: true, session: 'NORMAL' }
);
assert(normalRes.status === 200 && normalRes.order.order_variety === 'REGULAR' && normalRes.order.order_status === 'PENDING', '11:00 AM: Continuous trading orders route as REGULAR (status: PENDING)');

// 6. Intraday blocked at 03:07 PM for F&O Cash
const fnoCutoffRes = simulateOrderPlacement(
    { symbol: 'RELIANCE', product_type: 'INT', type: 'LIMIT', price: 2900 },
    { open: false, session: 'INTRADAY_CUTOFF', reason: 'Intraday cutoff passed for F&O cash' }
);
assert(fnoCutoffRes.status === 400 && fnoCutoffRes.error.includes('cutoff passed'), '03:07 PM: F&O Cash Intraday order is rejected with cutoff reason');

// 7. Post-Market Delivery executed at closing price
const postMarketRes = simulateOrderPlacement(
    { symbol: 'RELIANCE', product_type: 'DEL', type: 'MARKET', price: 0, mockClosePrice: 2950.50 },
    { open: true, isPostMarket: true, session: 'POST_MARKET' }
);
assert(postMarketRes.status === 200 && postMarketRes.order.price === 2950.50, '03:55 PM: Post-Market Delivery order executes at official closing price (2950.50)');

// 8. MCX Commodity Regular order outside hours displays MCX hours (09:00 AM - 11:30 PM)
const mcxClosedRes = simulateOrderPlacement(
    { symbol: 'CRUDEOIL', product_type: 'DEL', type: 'LIMIT', price: 6500, is_amo: false },
    { open: false, isAmoWindow: true, session: 'AMO', reason: 'AMO Active' }
);
assert(mcxClosedRes.status === 400 && mcxClosedRes.error.includes('09:00 AM - 11:30 PM') && mcxClosedRes.error.includes('MCX Commodity Market'), 'MCX Commodity regular order rejected outside trading hours with (09:00 AM - 11:30 PM)');

// 9. MCX Commodity AMO order placed outside AMO window is rejected with MCX-specific hours
const mcxAmoBlockedRes = simulateOrderPlacement(
    { symbol: 'CRUDEOIL', product_type: 'DEL', type: 'LIMIT', price: 6500, is_amo: true },
    { open: false, isAmoWindow: false, session: 'NORMAL', reason: '' }
);
assert(mcxAmoBlockedRes.status === 400 && mcxAmoBlockedRes.error.includes('11:30 PM and 08:57 AM'), 'MCX Commodity AMO rejected during regular hours with (11:30 PM and 08:57 AM)');

console.log('\n=============================================================');
console.log(`TOTAL E2E ROUTING TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('=============================================================\n');

if (failedTests > 0) process.exit(1);
process.exit(0);
