const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../node_modules/smartapi-javascript/lib/websocket2.0.js');

if (!fs.existsSync(targetFile)) {
    console.error(`❌ Target file not found: ${targetFile}`);
    process.exit(1);
}

let content = fs.readFileSync(targetFile, 'utf8');

// 1. Fix ping interval crash (checking readyState before sending, independent of spaces/tabs/newlines)
const pingRegex = /ws\.send\(\s*['"]ping['"]\s*\);/g;
if (pingRegex.test(content)) {
    content = content.replace(pingRegex, "if (ws && ws.readyState === 1) { try { ws.send('ping'); } catch (e) {} }");
    console.log('✅ Patched ws.send ping safety.');
} else {
    console.warn('⚠️ ws.send ping pattern match not found. Already patched?');
}

// 2. Prevent uncaught exception throws on errors
content = content.replace(/throw new Error\(evt\.message\);/g, 'console.error("WS Error:", evt.message);');
content = content.replace(/throw new Error\(error\);/g, 'console.error("WS Close Error:", error);');

// 3. Prevent ws.close() readyState check crashes
content = content.replace(/ws\?\._readyState === open/g, 'ws && (ws._readyState === open || ws.readyState === 1)');

fs.writeFileSync(targetFile, content, 'utf8');
console.log('🎉 SDK Patch applied successfully.');
process.exit(0);
