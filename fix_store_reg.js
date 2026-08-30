const fs = require('fs');
let code = fs.readFileSync('frontend/src/store.js', 'utf8');

const oldReg = `body: JSON.stringify({ username, email, phone, password }),`;
const newReg = `body: JSON.stringify({ username, email, phone, password, referral_code: localStorage.getItem('referral_code') }),`;

code = code.replace(oldReg, newReg);
fs.writeFileSync('frontend/src/store.js', code);
