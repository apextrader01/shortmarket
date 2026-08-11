const fs = require('fs');
const path = require('path');
const DataSocket = require("fyers-api-v3").fyersDataSocket;
const token = fs.readFileSync(path.join(__dirname, 'fyers_token.txt'), 'utf8').trim();
console.log("Token:", token.substring(0, 10) + "...");

const APP_ID = process.env.FYERS_APP_ID || 'HBIQP0RPMK-200';
const ws = DataSocket.getInstance(`${APP_ID}:${token}`, './logs', false);
ws.mode(ws.SymbolUpdate || 'SymbolUpdate');

ws.on('connect', () => {
    console.log('Connected to Fyers');
    ws.subscribe(['NSE:RELIANCE-EQ', 'NSE:NIFTY50-INDEX', 'BSE:SENSEX-INDEX']);
});

ws.on('message', (msg) => {
    console.log('Got message:', msg);
    process.exit(0);
});

ws.on('error', (err) => console.log('Error:', err));
ws.connect();

setTimeout(() => { console.log('Timeout waiting for ticks'); process.exit(1); }, 10000);
