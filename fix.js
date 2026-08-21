const fs=require('fs');
let code=fs.readFileSync('backend/services/triggerEngine.js','utf8');
code = code.replace(/pubClient\.publish\('reload_triggers', '1'\)/g, "pubClient.publish('reload_triggers', '1').catch(e=>{})");
fs.writeFileSync('backend/services/triggerEngine.js', code);
