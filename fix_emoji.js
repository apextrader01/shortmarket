const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

code = code.replace("setHotkeyToast('? Placing BUY order...');", "setHotkeyToast('? Placing BUY order...');");
code = code.replace("setHotkeyToast('? BUY MARKET PLACED: ' + selectedSymbol);", "setHotkeyToast('? BUY MARKET PLACED: ' + selectedSymbol);");
code = code.replace("setHotkeyToast('? ' + errorMsg);", "setHotkeyToast('? ' + errorMsg);");

code = code.replace("setHotkeyToast('? Placing SELL order...');", "setHotkeyToast('? Placing SELL order...');");
code = code.replace("setHotkeyToast('? SELL MARKET PLACED: ' + selectedSymbol);", "setHotkeyToast('? SELL MARKET PLACED: ' + selectedSymbol);");

fs.writeFileSync('frontend/src/App.jsx', code);
console.log("Fixed emojis");
