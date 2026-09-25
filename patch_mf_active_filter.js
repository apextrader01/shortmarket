const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const regex = /mfInitializationPromise = \(async \(\) => \{\s*try \{\s*console\.log\('Fetching master list of all Mutual Funds from mfapi\.in\.\.\.'\);\s*const res = await myFetch\('https:\/\/api\.mfapi\.in\/mf'\);\s*const data = await res\.json\(\);\s*if \(Array\.isArray\(data\) && data\.length > 0\) \{\s*allMutualFunds = data;\s*console\.log\(`Loaded \$\{allMutualFunds\.length\} mutual funds into memory\.`\);\s*\}\s*\} catch \(err\) \{\s*console\.error\('Failed to fetch mutual funds master list:', err\.message\);\s*\} finally \{\s*mfInitializationPromise = null;\s*\}\s*\}\)\(\);/;

const newLogic = `mfInitializationPromise = (async () => {
        try {
            console.log('Fetching master list from mfapi.in and active list from amfiindia.com...');
            
            const [mfapiRes, amfiRes] = await Promise.all([
                myFetch('https://api.mfapi.in/mf'),
                myFetch('https://www.amfiindia.com/spages/NAVAll.txt')
            ]);
            
            const rawData = await mfapiRes.json();
            const amfiText = await amfiRes.text();
            
            if (Array.isArray(rawData) && rawData.length > 0) {
                const activeCodes = new Set();
                const lines = amfiText.split('\\n');
                for (const line of lines) {
                    if (line.includes(';')) {
                        const parts = line.split(';');
                        if (parts[0] && !isNaN(parts[0])) {
                            activeCodes.add(String(parts[0]).trim());
                        }
                    }
                }
                
                allMutualFunds = rawData.filter(f => activeCodes.has(String(f.schemeCode)));
                
                // Fallback in case AMFI file parsing failed
                if (allMutualFunds.length === 0) {
                    allMutualFunds = rawData;
                }
                
                console.log(\`Filtered down to \${allMutualFunds.length} active mutual funds (from \${rawData.length} total).\`);
            }
        } catch (err) {
            console.error('Failed to fetch mutual funds master list:', err.message);
        } finally {
            mfInitializationPromise = null;
        }
    })();`;

code = code.replace(regex, newLogic);
fs.writeFileSync('backend/server.js', code, 'utf8');
console.log('Patched active funds filter');
