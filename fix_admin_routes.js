const fs = require('fs');
let server = fs.readFileSync('backend/server.js', 'utf8');

server = server.replace(/\.orderBy\('positions\.id', 'desc'\);/g, `.orderBy('positions.id', 'desc')
      .limit(500);`);

server = server.replace(/\.orderBy\('deposit_requests\.created_at', 'desc'\);/g, `.orderBy('deposit_requests.created_at', 'desc')
      .limit(500);`);

fs.writeFileSync('backend/server.js', server);
console.log("Fixed unpaginated admin routes.");
