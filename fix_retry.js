const fs = require('fs');
let code = fs.readFileSync('./backend/services/fyers.js', 'utf8');

const regex = /for \(let j = 0; j < chunk\.length; j \+= 10\) \{[\s\S]*?console\.log\(\`Processing next mini-chunk\.\.\.\`\);\s*\}/;

const newCode = `for (let j = 0; j < chunk.length; j++) {
                        const fSym = chunk[j];
                        try {
                            await new Promise(r => setTimeout(r, 150));
                            const indRes = await fyers.getQuotes([fSym]);
                            if (indRes && indRes.s === 'ok') {
                                processQuotesResponse(indRes);
                            }
                        } catch(indErr) {
                            console.error(\`Fyers getQuotes individual error for \${fSym}:\`, indErr.message || indErr);
                        }
                    }`;

if (code.match(regex)) {
    code = code.replace(regex, newCode);
    fs.writeFileSync('./backend/services/fyers.js', code);
    console.log('Replaced successfully');
} else {
    console.log('Not found');
}
