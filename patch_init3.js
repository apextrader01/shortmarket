const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const start = code.indexOf('    mfInitializationPromise = (async () => {');
const end = code.indexOf('    })();', start) + '    })();'.length;

const before = code.substring(0, start);
const after = code.substring(end);

const newInit = "    mfInitializationPromise = (async () => {\n        try {\n            console.log('Fetching master list from amfiindia.com (bypassing mfapi.in 502 error)...');\n            const amfiRes = await myFetch('https://www.amfiindia.com/spages/NAVAll.txt');\n            const amfiText = await amfiRes.text();\n            \n            const funds = [];\n            const lines = amfiText.split('\\n');\n            for (const line of lines) {\n                if (line.includes(';')) {\n                    const parts = line.split(';');\n                    if (parts.length >= 4 && parts[0] && !isNaN(parts[0])) {\n                        let schemeName = parts[3].trim();\n                        if (parts.length >= 6 && parts[4] && parts[5]) {\n                            schemeName += ' - ' + parts[4].trim() + ' - ' + parts[5].trim();\n                        } else if (parts.length >= 5 && parts[4]) {\n                            schemeName += ' - ' + parts[4].trim();\n                        }\n                        \n                        if (schemeName.toLowerCase().includes('growth')) {\n                            funds.push({\n                                schemeCode: parseInt(parts[0].trim()),\n                                schemeName: schemeName\n                            });\n                        }\n                    }\n                }\n            }\n            \n            allMutualFunds = funds;\n            console.log(`Successfully parsed ${allMutualFunds.length} active mutual funds from AMFI.`);\n            \n        } catch (err) {\n            console.error('Failed to fetch mutual funds master list:', err.message);\n        } finally {\n            mfInitializationPromise = null;\n        }\n    })();";

fs.writeFileSync('backend/server.js', before + newInit + after);
