const fs = require('fs');
let content = fs.readFileSync('C:/Users/h4har/Documents/shortmarket/backend/server.js', 'utf8');

content = content.replace(
    /cacheSubClient\.subscribe\('fyers_subscribe', \(message\) => {[\s\S]*?}\);/g,
    cacheSubClient.on('ready', () => {\n            cacheSubClient.subscribe('fyers_subscribe', (message) => {\n                try {\n                    const symbols = JSON.parse(message);\n                    const { addSubscriptionBatch } = require('./services/fyers');\n                    if (addSubscriptionBatch) {\n                        addSubscriptionBatch(symbols.map(sym => ({ symbol: sym })), io, priceCache);\n                    }\n                } catch(e) {\n                    console.error('Error processing fyers_subscribe message:', e);\n                }\n            }).catch(err => { /* ignore */ });\n        });
);

fs.writeFileSync('C:/Users/h4har/Documents/shortmarket/backend/server.js', content);
console.log('Fixed fyers_subscribe');
