const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const regexOrder = /const isMutualFund = ord\.symbol\.endsWith\('-MF'\);\s*const realLtp = isMutualFund \? ord\.price : \(priceCache\[ord\.symbol\]\?\.ltp \|\| 0\);\s*if \(realLtp > 0\) \{\s*try \{\s*await triggerEngine\.evaluateTick\(ord\.symbol, realLtp\);\s*\/\/[^\n]*\n\s*await new Promise\(r => setTimeout\(r, 250\)\);\s*\} catch \(err\) \{\s*console\.error\('Immediate evaluation error:', err\);\s*\}\s*\}/g;

code = code.replace(regexOrder, `
      const isMutualFund = ord.symbol.endsWith('-MF') || /^\\d+$/.test(ord.symbol);
      if (isMutualFund) {
         try {
             const triggerEngineLocal = require('./services/triggerEngine');
             triggerEngineLocal.removeOrderFromMemory(ord.id, ord.symbol);
             triggerEngineLocal.executeOrder(ord, ord.price).catch(e => console.error(e));
         } catch(e) {}
      } else {
         const realLtp = priceCache[ord.symbol]?.ltp || 0;
         if (realLtp > 0) {
            try {
              await triggerEngine.evaluateTick(ord.symbol, realLtp);
              await new Promise(r => setTimeout(r, 250));
            } catch (err) {
              console.error('Immediate evaluation error:', err);
            }
         }
      }
`);

const regexBasket = /const isMutualFund = ord\.symbol\.endsWith\('-MF'\);\s*const realLtp = isMutualFund \? ord\.execPrice : \(priceCache\[ord\.symbol\]\?\.ltp \|\| 0\);\s*if \(realLtp > 0\) \{\s*try \{\s*await triggerEngine\.evaluateTick\(ord\.symbol, realLtp\);\s*\} catch \(err\) \{\s*console\.error\('Immediate evaluation error for basket item:', err\);\s*\}\s*\}/g;

code = code.replace(regexBasket, `
          const isMutualFund = ord.symbol.endsWith('-MF') || /^\\d+$/.test(ord.symbol);
          if (isMutualFund) {
             try {
                 const triggerEngineLocal = require('./services/triggerEngine');
                 triggerEngineLocal.removeOrderFromMemory(ord.id, ord.symbol);
                 triggerEngineLocal.executeOrder(ord, ord.execPrice).catch(e => console.error(e));
             } catch(e) {}
          } else {
             const realLtp = priceCache[ord.symbol]?.ltp || 0;
             if (realLtp > 0) {
                try {
                  await triggerEngine.evaluateTick(ord.symbol, realLtp);
                } catch (err) {
                  console.error('Immediate evaluation error for basket item:', err);
                }
             }
          }
`);

fs.writeFileSync('backend/server.js', code, 'utf8');
console.log('Patched isMutualFund logic');
