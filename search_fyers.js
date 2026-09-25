const fs = require('fs');
const data = JSON.parse(fs.readFileSync('backend/database/fyers_map.json', 'utf8'));
const fyersToToken = data.fyersToToken || {};
const tokenToFyers = data.tokenToFyers || {};
const nameToFyers = data.nameToFyers || {};

console.log("Searching tokenToFyers for 24150:");
for (let key in tokenToFyers) {
    if (key.includes('24150') || tokenToFyers[key].includes('24150')) {
        console.log(key, "->", tokenToFyers[key]);
    }
}
console.log("Searching nameToFyers for 24150:");
for (let key in nameToFyers) {
    if (key.includes('24150') || nameToFyers[key].includes('24150')) {
        console.log(key, "->", nameToFyers[key]);
    }
}

console.log("Searching tokenToFyers for 23950:");
for (let key in tokenToFyers) {
    if (key.includes('23950') || tokenToFyers[key].includes('23950')) {
        console.log(key, "->", tokenToFyers[key]);
    }
}
