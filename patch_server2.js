const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const regex = /const \[orderId\] = await db\('orders'\)\.insert\(\{[\s\S]*?res\.json\(\{ success: true, message: 'Force close order placed', orderId: typeof orderId === 'object' \? orderId\.id : orderId \}\);/m;

const newCode = `const orderPayload = {
      user_id: position.user_id,
      symbol: position.symbol,
      type: 'MARKET',
      side: side,
      quantity: quantity,
      product_type: position.product_type,
      status: 'PENDING'
    };
    
    const [orderId] = await db('orders').insert(orderPayload).returning('id');
    const finalOrderId = typeof orderId === 'object' ? orderId.id : orderId;
    orderPayload.id = finalOrderId;

    const triggerEngine = require('./services/triggerEngine');
    triggerEngine.executeOrder(orderPayload, priceCache[position.symbol]?.ltp || 0).catch(console.error);

    res.json({ success: true, message: 'Force close order placed', orderId: finalOrderId });`;

if (regex.test(code)) {
    code = code.replace(regex, newCode);
    fs.writeFileSync('backend/server.js', code);
    console.log('Successfully patched server.js using regex');
} else {
    console.log('Regex did not match!');
}
