const fs = require('fs');
let app = fs.readFileSync('frontend/src/App.jsx', 'utf8');

const regex = /\/\/ Background Alert Checking Engine[\s\S]*?\}, \[ pendingTriggers, updatePendingTrigger, placeOrder\]\);/g;

if (regex.test(app)) {
    app = app.replace(regex, "// [HOTFIX]: Removed duplicated trigger engines that caused React Error #185");
    fs.writeFileSync('frontend/src/App.jsx', app);
    console.log("Successfully removed the duplicated engines!");
} else {
    console.log("Regex didn't match.");
}
