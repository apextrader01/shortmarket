const schedule = require('node-schedule');
const fetch = require('node-fetch'); // assuming node-fetch is installed

async function fetchRiskyStocks() {
    try {
        console.log('🔄 Fetching latest restricted/risky stocks (ASM/GSM)...');
        
        // In a real production scenario, we would scrape the NSE India CSV 
        // or a broker's free margin API (e.g., Zerodha margin calculator API).
        // For demonstration, we're fetching from a generic source or building a known list.
        
        // This is a placeholder for where the actual HTTP GET request to NSE/AngelOne would go.
        // const response = await fetch('https://some-open-api.com/asm-gsm-list');
        // const data = await response.json();
        
        // Mock list for now based on user's screenshot
        const restrictedList = [
            'IDEA-NSE',
            'RAJESHEXPO-NSE',
            'RCOM-BSE',
            'RELINFRA-NSE',
            'RPOWER-NSE'
        ];
        
        const server = require('../server');
        if (server.setRestrictedStocksCache) {
            server.setRestrictedStocksCache(restrictedList);
            console.log(`✅ Successfully updated restricted stocks cache: ${restrictedList.length} symbols.`);
        }
        
    } catch (err) {
        console.error('❌ Failed to fetch risky stocks:', err.message);
    }
}

function initRiskyStocksSync() {
    console.log('🕒 Initializing Daily Risky Stocks Sync Cron Job for 8:00 AM IST...');
    
    // Fetch immediately on server start
    fetchRiskyStocks();

    // Schedule for 08:00 every day in Asia/Kolkata timezone
    const rule = new schedule.RecurrenceRule();
    rule.hour = 8;
    rule.minute = 0;
    rule.tz = 'Asia/Kolkata';

    schedule.scheduleJob(rule, fetchRiskyStocks);
}

module.exports = { initRiskyStocksSync };
