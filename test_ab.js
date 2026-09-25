const https = require('https');
https.get('https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        const opts = json.filter(d => d.instrumenttype === 'OPTSTK' || d.instrumenttype === 'OPTIDX');
        console.log(opts.slice(0, 2).map(o => o.expiry));
    });
});
