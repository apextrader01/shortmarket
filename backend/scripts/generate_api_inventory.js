const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, '../server.js');
const content = fs.readFileSync(serverFile, 'utf8');

const regex = /app\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]\s*,\s*([^)]+)\)/g;
let match;
const endpoints = [];

while ((match = regex.exec(content)) !== null) {
  const method = match[1].toUpperCase();
  const endpoint = match[2];
  const handlers = match[3];

  let classification = 'PUBLIC';
  if (endpoint.startsWith('/api/admin') || handlers.includes('requireAdmin')) {
    classification = 'ADMIN';
  } else if (handlers.includes('authenticateToken') || endpoint.startsWith('/api/order') || endpoint.startsWith('/api/user') || endpoint.startsWith('/api/wallet')) {
    classification = 'AUTHENTICATED USER';
  } else if (endpoint.includes('webhook')) {
    classification = 'WEBHOOK';
  } else if (endpoint.startsWith('/api/market') || endpoint.startsWith('/api/option-chain') || endpoint.startsWith('/api/quote')) {
    classification = 'PUBLIC MARKET DATA';
  } else if (endpoint.startsWith('/api/auth') || endpoint.includes('login') || endpoint.includes('register') || endpoint.includes('password')) {
    classification = 'PUBLIC AUTH';
  }

  endpoints.push({ method, endpoint, classification });
}

console.log(`Total Extracted: ${endpoints.length}`);
const counts = {};
endpoints.forEach(e => counts[e.classification] = (counts[e.classification] || 0) + 1);
console.log('Breakdown:', counts);

fs.writeFileSync(path.join(__dirname, '../API_INVENTORY.json'), JSON.stringify(endpoints, null, 2));
