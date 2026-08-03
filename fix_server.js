const fs = require('fs');
let content = fs.readFileSync('C:/Users/h4har/Documents/shortmarket/backend/server.js', 'utf8');

content = content.replace(
    /globalSubClient\.subscribe\('fyers_token_updated', \(\) => {[\s\S]*?}\);/g,
    globalSubClient.on('ready', () => {\n        globalSubClient.subscribe('fyers_token_updated', () => {\n            try {\n                const { reloadFyersToken } = require('./services/fyers');\n                if (reloadFyersToken) reloadFyersToken();\n            } catch(e) {}\n        }).catch(e => {});\n    });
);

content = content.replace(
    /cacheSubClient\.subscribe\('fyers_subscribe', \(message\) => {[\s\S]*?}\);/g,
    cacheSubClient.on('ready', () => {\n            cacheSubClient.subscribe('fyers_subscribe', (message) => {\n                try {\n                    const symbols = JSON.parse(message);\n                    const { addSubscriptionBatch } = require('./services/fyers');\n                    if (addSubscriptionBatch) {\n                        addSubscriptionBatch(symbols.map(sym => ({ symbol: sym })), io, priceCache);\n                    }\n                } catch(e) {\n                    console.error('Error processing fyers_subscribe message:', e);\n                }\n            }).catch(e => {});\n        });
);

fs.writeFileSync('C:/Users/h4har/Documents/shortmarket/backend/server.js', content);
console.log('Fixed server.js');
