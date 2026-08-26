const fs = require('fs');
let code = fs.readFileSync('backend/services/fyers.js', 'utf8');

const gcSearch = 'const staleFyersSymbols = [];';
const gcInject = \
      // --- ANTI-GC FOR PENDING ORDERS ---
      try {
          const db = require('../database/db');
          db('orders').whereIn('status', ['PENDING', 'PENDING_TRIGGER']).distinct('symbol')
              .then(rows => {
                  rows.forEach(row => {
                      symbolLastSeen.set(row.symbol, now); // Prevent GC
                      if (!clientSubscriptions.has(row.symbol)) {
                          clientSubscriptions.add(row.symbol);
                          const fSym = toFyersSymbol(row.symbol);
                          if (fSym && !subQueue.includes(fSym)) {
                              subQueue.push(fSym);
                          }
                      }
                  });
              }).catch(e => {});
      } catch(e) {}
      // ----------------------------------
\;

code = code.replace(gcSearch, gcSearch + '\n' + gcInject);
fs.writeFileSync('backend/services/fyers.js', code);
