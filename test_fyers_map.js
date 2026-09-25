const https = require('https');
https.get('https://public.fyers.in/sym_details/NSE_FO.csv', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const lines = data.split('\n');
        const matches = lines.filter(l => l.includes('NIFTY') && l.includes('CE'));
        console.log("Random matches:");
        console.log(matches.slice(0, 5).map(l => l.split(',')[13]));
    });
});
