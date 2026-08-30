const fs = require('fs');

// 1. Delete the file
try {
  fs.unlinkSync('frontend/src/components/DOMLadderModal.jsx');
  console.log("Deleted DOMLadderModal.jsx");
} catch(e) { console.log(e.message); }

// 2. Remove from App.jsx
let app = fs.readFileSync('frontend/src/App.jsx', 'utf8');
app = app.replace(/import DOMLadderModal from '.\/components\/DOMLadderModal';\n/, '');
app = app.replace(/\s*<DOMLadderModal \/>\n/, '\n');
fs.writeFileSync('frontend/src/App.jsx', app);

// 3. Remove from store.js
let store = fs.readFileSync('frontend/src/store.js', 'utf8');
store = store.replace(/\s*domLadderModal: \{ isOpen: false, symbol: null, lotsize: 1 \},/g, '');
store = store.replace(/\s*openDomLadderModal: \(symbol, lotsize\) => set\(\{ domLadderModal: \{ isOpen: true, symbol, lotsize: lotsize \|\| 1 \} \}\),/g, '');
store = store.replace(/\s*closeDomLadderModal: \(\) => set\(\{ domLadderModal: \{ isOpen: false, symbol: null, lotsize: 1 \} \}\),/g, '');
fs.writeFileSync('frontend/src/store.js', store);

// 4. Remove from MarketWatch.jsx
let mw = fs.readFileSync('frontend/src/components/MarketWatch.jsx', 'utf8');
mw = mw.replace(/, openDomLadderModal/, '');
mw = mw.replace(/, openDomLadderModal: state\.openDomLadderModal/, '');
fs.writeFileSync('frontend/src/components/MarketWatch.jsx', mw);

// 5. Remove from OptionChainView.jsx
let ocv = fs.readFileSync('frontend/src/components/OptionChainView.jsx', 'utf8');
ocv = ocv.replace(/\s*const openDomLadderModal = useStore\(\(state\) => state\.openDomLadderModal\);/, '');
ocv = ocv.replace(/\s*openDomLadderModal=\{openDomLadderModal\}/, '');
fs.writeFileSync('frontend/src/components/OptionChainView.jsx', ocv);

// 6. Remove from OptionChainRow.jsx
let ocr = fs.readFileSync('frontend/src/components/OptionChainRow.jsx', 'utf8');
ocr = ocr.replace(/,\s*openDomLadderModal/, '');
fs.writeFileSync('frontend/src/components/OptionChainRow.jsx', ocr);

console.log("Completely removed DOM Ladder from codebase.");
