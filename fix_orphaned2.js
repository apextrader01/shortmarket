const fs = require('fs');
let server = fs.readFileSync('backend/server.js', 'utf8');

let startIndex = server.indexOf('    const page = parseInt(req.query.page) || 1;', server.indexOf('app.get(\'/api/admin/users\'') + 200);
let endIndex = server.indexOf('});', startIndex) + 3;

if (startIndex !== -1 && endIndex !== -1) {
    let toRemove = server.substring(startIndex, endIndex);
    server = server.replace(toRemove, "");
    fs.writeFileSync('backend/server.js', server);
    console.log("Successfully removed orphaned code.");
} else {
    console.log("Could not find start or end index.");
}
