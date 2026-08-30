const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/SettingsView.jsx', 'utf8');

const regex = /\{\/\* Trading Preferences Card \*\/\}[\s\S]*?<\/button>\r?\n\s*\)\)\}\r?\n\s*<\/div>\r?\n\s*<\/div>\r?\n\r?\n\s*<\/div>\r?\n\s*<\/div>/;

if(regex.test(code)) {
    code = code.replace(regex, '');
    fs.writeFileSync('frontend/src/components/SettingsView.jsx', code);
    console.log("Replaced successfully!");
} else {
    console.log("String not found via regex!");
}
