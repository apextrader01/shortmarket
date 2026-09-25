const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// Remove the gear icon from the header
code = code.replace(/<div\s+onClick=\{\(\) => setActiveTab\('Settings'\)\}\s+style=\{\{\s*display:\s*'flex',\s*alignItems:\s*'center',\s*cursor:\s*'pointer',\s*padding:\s*'6px',\s*borderRadius:\s*'4px',\s*background:\s*'rgba\(255,255,255,0\.05\)'\s*\}\}\s*>\s*<Settings size=\{14\} color="var\(--text-secondary\)" \/>\s*<\/div>/g, '');

// Remove SettingsView from activeTab rendering
code = code.replace(/\{activeTab === 'Settings' && \(\r?\n\s*<div style=\{\{ flex: 1, padding: '12px' \}\}>\r?\n\s*<SettingsView \/>\r?\n\s*<\/div>\r?\n\s*\)\}/g, '');

fs.writeFileSync('frontend/src/App.jsx', code);
console.log("App.jsx cleaned");
