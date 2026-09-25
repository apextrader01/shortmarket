const fs = require('fs');
let app = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// The marker
const startMarker = "// Background Alert Checking Engine";
const endMarker = "// Global Hotkey Engine (Shift+B, Shift+S)";

const startIdx = app.indexOf(startMarker);
const endIdx = app.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
    const toRemove = app.substring(startIdx, endIdx);
    app = app.replace(toRemove, "");
    fs.writeFileSync('frontend/src/App.jsx', app);
    console.log("Successfully removed old Background & Trigger engines from App.jsx");
} else {
    console.log("Could not find markers.");
}
