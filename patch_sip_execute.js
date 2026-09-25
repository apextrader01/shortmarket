const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

// 1. Fix next_execution_date calculation
const sipDateLogic = `
      let nextExecutionDate = new Date();
      if (frequency === 'DAILY') {
        nextExecutionDate.setDate(nextExecutionDate.getDate() + 1);
      } else if (frequency === 'WEEKLY') {
        nextExecutionDate.setDate(nextExecutionDate.getDate() + 7);
      } else {
        nextExecutionDate.setMonth(nextExecutionDate.getMonth() + 1);
      }
      
      // Ensure it's not Saturday/Sunday (skips to Monday)
      while (nextExecutionDate.getDay() === 0 || nextExecutionDate.getDay() === 6) {
          nextExecutionDate.setDate(nextExecutionDate.getDate() + 1);
      }
`;

code = code.replace(
    'const nextExecutionDate = new Date();\n        nextExecutionDate.setMonth(nextExecutionDate.getMonth() + 1);',
    sipDateLogic
);

// 2. Fix execution by directly calling executeOrder instead of going through Redis
const executionLogic = `
      const triggerEngine = require('./services/triggerEngine');
      triggerEngine.executeOrder({
        id: orderId, user_id: req.user.id, symbol, type: 'MARKET', side: 'BUY', quantity: qty, price: execPrice,
        status: 'PENDING', product_type: 'DEL', margin: finalMargin
      }, execPrice).catch(e => console.error('Immediate execution error:', e));
`;

// Replace from `await triggerEngine.addOrderToMemory` to the end of `try/catch`
const replaceRegex = /await triggerEngine\.addOrderToMemory\(\{[\s\S]*?\}\);\s*try\s*\{\s*const \{ pubClient \} = require\('\.\/services\/redisClient'\);\s*if \(pubClient\) pubClient\.publish\('reload_triggers', '1'\)\.catch\(e=>\{\}\);\s*\}\s*catch\(e\)\s*\{\}\s*try\s*\{\s*await triggerEngine\.evaluateTick\(symbol, execPrice\);\s*\}\s*catch\s*\(err\)\s*\{\s*console\.error\('Immediate evaluation error:', err\);\s*\}/;
code = code.replace(replaceRegex, executionLogic);

fs.writeFileSync('backend/server.js', code, 'utf8');
console.log('Patched SIP logic');
