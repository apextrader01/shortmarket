const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const oldCode = `    const [orderId] = await db('orders').insert({
      user_id: position.user_id,
      symbol: position.symbol,
      type: 'MARKET',
      side: side,
      quantity: quantity,
      product_type: position.product_type,
      status: 'PENDING'
    }).returning('id');

    res.json({ success: true, message: 'Force close order placed', orderId: typeof orderId === 'object' ? orderId.id : orderId });`;

const newCode = `    const orderPayload = {
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

    // Immediately pass to Trigger Engine for instant execution (bypassing the slow polling)
    const triggerEngine = require('./services/triggerEngine');
    triggerEngine.executeOrder(orderPayload, priceCache[position.symbol]?.ltp || 0).catch(console.error);

    res.json({ success: true, message: 'Force close order placed and executed', orderId: finalOrderId });`;

code = code.replace(oldCode, newCode);

fs.writeFileSync('backend/server.js', code);
console.log('Patched server.js admin route for instant execution');
