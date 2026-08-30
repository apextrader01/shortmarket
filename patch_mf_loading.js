const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const regex = /async function initMutualFundsList\(\) \{\s*try \{\s*console\.log\([^)]+\);\s*const res = await myFetch\('https:\/\/api\.mfapi\.in\/mf'\);\s*const data = await res\.json\(\);\s*if \(Array\.isArray\(data\)\) \{\s*allMutualFunds = data;\s*console\.log\([^)]+\);\s*\}\s*\} catch \(err\) \{\s*console\.error\([^)]+\);\s*\}\s*\}/;

const newLogic = `
let mfInitializationPromise = null;

async function initMutualFundsList() {
    if (allMutualFunds.length > 0) return; // already loaded
    
    // Prevent concurrent initialization attempts
    if (mfInitializationPromise) return mfInitializationPromise;

    mfInitializationPromise = (async () => {
        try {
            console.log('Fetching master list of all Mutual Funds from mfapi.in...');
            const res = await myFetch('https://api.mfapi.in/mf');
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                allMutualFunds = data;
                console.log(\`Loaded \${allMutualFunds.length} mutual funds into memory.\`);
            }
        } catch (err) {
            console.error('Failed to fetch mutual funds master list:', err.message);
        } finally {
            mfInitializationPromise = null;
        }
    })();
    return mfInitializationPromise;
}
`;

code = code.replace(regex, newLogic);

// Then, in /api/mf/search, if allMutualFunds is empty, call initMutualFundsList() and wait
const searchRegex = /app\.get\('\/api\/mf\/search', async \(req, res\) => \{\s*try \{\s*const query = \(req\.query\.q \|\| ''\)\.toLowerCase\(\)\.trim\(\);/;

const newSearchLogic = `app.get('/api/mf/search', async (req, res) => {
    try {
        if (allMutualFunds.length === 0) {
            await initMutualFundsList();
        }
        const query = (req.query.q || '').toLowerCase().trim();`;

code = code.replace(searchRegex, newSearchLogic);

fs.writeFileSync('backend/server.js', code, 'utf8');
console.log('Patched Mutual Funds initialization retry logic');
