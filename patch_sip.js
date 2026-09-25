const fs = require('fs');
let code = fs.readFileSync('backend/services/cronJobs.js', 'utf8');

const regex = /if \(Number\(user\.balance\) < finalMargin\) \{([\s\S]*?)const execPrice = priceCache\[sip\.symbol\]\?\.ltp \|\| 1;/m;

const replacement = `const execPrice = priceCache[sip.symbol]?.ltp;
                          if (!execPrice || execPrice <= 0) {
                              console.log(\`[SIP] Skipped \${sip.id} for user \${user.id} - Live price unavailable for \${sip.symbol}. Will retry tomorrow.\`);
                              continue;
                          }

                          if (Number(user.balance) < finalMargin) {
                              console.log(\`[SIP] Skipped \${sip.id} for user \${user.id} - Insufficient Funds\`);
                              continue;
                          }
                          
                          // Deduct balance
                          const newBalance = Number(user.balance) - finalMargin;
                          await trx('users').where({ id: sip.user_id }).update({ balance: newBalance });
                          
                          await trx('ledger').insert({
                              user_id: sip.user_id,
                              amount: -finalMargin,
                              type: 'MARGIN_BLOCK',
                              description: \`Auto SIP installment blocked for \${sip.symbol}\`
                          });
                          
                          // Execute Market Order`;

if (code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('backend/services/cronJobs.js', code);
    console.log('Successfully patched SIP price fallback bug');
} else {
    console.log('Regex failed to match');
}
