const fetch = require('node-fetch');

async function test() {
    const res = await fetch('https://34-93-99-22.nip.io/api/ltp-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: ['NSE:NIFTY2681824150PE', 'NSE:NIFTY2681824150CE', 'NSE:NIFTY2681823950CE', 'NSE:NIFTY50-INDEX'] })
    });
    const data = await res.json();
    console.log("Prices:", data);
}
test();
