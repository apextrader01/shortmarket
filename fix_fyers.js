const fs = require('fs');
let content = fs.readFileSync('backend/services/fyers.js', 'utf8');

const target = const processQuotesResponse = (res) => {
                    if (res && res.s === 'ok' && res.d) {
                        res.d.forEach(item => {
                            if (item.v && (item.v.lp !== undefined || item.v.prev_close_price !== undefined || item.v.close_price !== undefined)) {
                                let syms = fyersToRequested[item.n];
                                if (!syms || syms.length === 0) {
                                    const mapped = fromFyersSymbol(item.n);
                                    if (mapped) syms = [mapped];
                                }
                                
                                if (syms && syms.length > 0) {
                                    syms.forEach(uniqueSymbol => {
                                        const priceObj = {
                                            symbol: uniqueSymbol,
                                            ltp: Number(item.v.lp) || Number(item.v.prev_close_price) || Number(item.v.close_price) || 0,
                                            open: Number(item.v.open_price) || null,
                                            high: Number(item.v.high_price) || null,
                                            low: Number(item.v.low_price) || null,
                                            close: Number(item.v.prev_close_price) || Number(item.v.close_price) || null,
                                            volume: Number(item.v.volume) || 0,
                                            change: Number(item.v.ch) || 0,
                                            pct: Number(item.v.chp) || 0
                                        };
                                        results[uniqueSymbol] = priceObj;
                                        sharedPriceCache[uniqueSymbol] = priceObj;
                                    });
                                }
                            }
                        });
                    }
                };

                if (response && response.s === 'ok') {
                    processQuotesResponse(response);
                } else if (response && response.s === 'error') {
                    console.error(\?O Fyers getQuotes error for chunk: code=\, message=\. Retrying individually...\);
                    // Retry individually to prevent one invalid symbol from ruining the batch
                    // Fyers API limit is 10 req/sec. We process sequentially with 150ms delay
                    for (let j = 0; j < chunk.length; j++) {
                        const fSym = chunk[j];
                        try {
                            await new Promise(r => setTimeout(r, 150));
                            const indRes = await fyers.getQuotes([fSym]);
                            if (indRes && indRes.s === 'ok') {
                                processQuotesResponse(indRes);
                            }
                        } catch(indErr) {
                            console.error(\Fyers getQuotes individual error for \:\, indErr.message || indErr);
                        }
                    }
                };

const replacement = const processQuotesResponse = (res) => {
                    if (res && res.s === 'ok' && res.d) {
                        res.d.forEach(item => {
                            if (item.v && (item.v.lp !== undefined || item.v.prev_close_price !== undefined || item.v.close_price !== undefined)) {
                                let syms = fyersToRequested[item.n];
                                if (!syms || syms.length === 0) {
                                    const mapped = fromFyersSymbol(item.n);
                                    if (mapped) syms = [mapped];
                                }
                                
                                if (syms && syms.length > 0) {
                                    syms.forEach(uniqueSymbol => {
                                        const priceObj = {
                                            symbol: uniqueSymbol,
                                            ltp: Number(item.v.lp) || Number(item.v.prev_close_price) || Number(item.v.close_price) || 0,
                                            open: Number(item.v.open_price) || null,
                                            high: Number(item.v.high_price) || null,
                                            low: Number(item.v.low_price) || null,
                                            close: Number(item.v.prev_close_price) || Number(item.v.close_price) || null,
                                            volume: Number(item.v.volume) || 0,
                                            change: Number(item.v.ch) || 0,
                                            pct: Number(item.v.chp) || 0
                                        };
                                        results[uniqueSymbol] = priceObj;
                                        sharedPriceCache[uniqueSymbol] = priceObj;
                                    });
                                }
                            }
                        });
                    }
                };

                if (response && response.s === 'ok') {
                    processQuotesResponse(response);
                } else if (response && response.s === 'error') {
                    console.error(\?O Fyers getQuotes error for chunk: code=\, message=\. Retrying individually...\);
                    for (let j = 0; j < chunk.length; j++) {
                        const fSym = chunk[j];
                        try {
                            await new Promise(r => setTimeout(r, 150));
                            const indRes = await fyers.getQuotes([fSym]);
                            if (indRes && indRes.s === 'ok') {
                                processQuotesResponse(indRes);
                            }
                        } catch(indErr) {}
                    }
                };

// Using string replace instead of regex to avoid mismatch due to newlines
if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('backend/services/fyers.js', content, 'utf8');
    console.log("Successfully replaced target text in fyers.js!");
} else {
    console.log("Target text not found in fyers.js");
}
