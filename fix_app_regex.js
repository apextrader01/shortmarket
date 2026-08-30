const fs = require('fs');
let app = fs.readFileSync('frontend/src/App.jsx', 'utf8');
app = app.replace(/import DOMLadderModal from '\.\/components\/DOMLadderModal';\r?\n?/g, "");
app = app.replace(/[ \t]*<DOMLadderModal \/>\r?\n?/g, "");
fs.writeFileSync('frontend/src/App.jsx', app);
console.log("Successfully removed lingering DOMLadderModal references.");
