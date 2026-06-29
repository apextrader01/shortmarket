const fetch = require('node-fetch');
async function test() {
    const res = await fetch('https://api.mfapi.in/mf/119062');
    const data = await res.json();
    const historicalData = data.data;
    const latestNav = parseFloat(historicalData[0].nav);
    const oldestData = historicalData[historicalData.length - 1];
    const oldestNav = parseFloat(oldestData.nav);
    const [d1, m1, y1] = historicalData[0].date.split('-');
    const [d2, m2, y2] = oldestData.date.split('-');
    const latestDate = new Date(y1 + '-' + m1 + '-' + d1);
    const oldestDate = new Date(y2 + '-' + m2 + '-' + d2);
    const years = (latestDate - oldestDate) / (1000 * 60 * 60 * 24 * 365.25);
    const cagr = (Math.pow((latestNav / oldestNav), (1 / years)) - 1) * 100;
    console.log('Years:', years);
    console.log('Latest NAV:', latestNav);
    console.log('Oldest NAV:', oldestNav);
    console.log('CAGR:', cagr);
    console.log('Absolute Return:', ((latestNav - oldestNav) / oldestNav) * 100);
}
test();
