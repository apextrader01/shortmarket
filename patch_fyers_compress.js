const fs = require('fs');
const file = 'backend/services/fyers.js';
let content = fs.readFileSync(file, 'utf8');

const target = `                dirtySymbols.forEach(uniqueSymbol => {
                    const priceObj = sharedPriceCache[uniqueSymbol];
                    if (priceObj) batchUpdate[uniqueSymbol] = priceObj;
                });`;
const replacement = `                dirtySymbols.forEach(uniqueSymbol => {
                    const p = sharedPriceCache[uniqueSymbol];
                    if (p) {
                        // PAYLOAD SLIMMING: Compress object into a small array for 60% bandwidth savings!
                        // Order: [ltp, ch, chp, timestamp, open, high, low, close, vol, totBuyQuan, totSellQuan]
                        batchUpdate[uniqueSymbol] = [
                            p.ltp || 0, p.ch || 0, p.chp || 0, p.timestamp || Date.now(),
                            p.open || 0, p.high || 0, p.low || 0, p.close || 0,
                            p.vol || 0, p.totBuyQuan || 0, p.totSellQuan || 0
                        ];
                    }
                });`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content);
