const { createClient } = require('redis');
const client = createClient();
client.connect().catch(e => console.log('Connect error', e));
try {
    client.subscribe('test', () => {}).catch(e => console.log('Subscribe error:', e));
} catch(e) {
    console.log('Sync error:', e);
}
