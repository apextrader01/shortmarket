import re

with open('backend/services/fyers.js', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r"const processQuotesResponse = \(res\) => \{[\s\S]*?\};\s*if \(response && response\.s === 'ok'\) \{[\s\S]*?processQuotesResponse\(response\);\s*\} else if \(response && response\.s === 'error'\) \{[\s\S]*?\}\s*\} catch\(chunkErr\) \{")

replacement = """if (response && response.s === 'ok' && response.d) {
                    response.d.forEach(item => {
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
                } else if (response && response.s === 'error') {
                    for (let j = 0; j < chunk.length; j++) {
                        const fSym = chunk[j];
                        try {
                            const indRes = await fyers.getQuotes([fSym]);
                            if (indRes && indRes.s === 'ok' && indRes.d) {
                                indRes.d.forEach(item => {
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
                        } catch(indErr) {}
                    }
                }
            } catch(chunkErr) {"""

new_content = pattern.sub(replacement, content)
with open('backend/services/fyers.js', 'w', encoding='utf-8') as f:
    f.write(new_content)
