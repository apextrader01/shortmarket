const fs = require('fs');

// Fix store.js
let storeCode = fs.readFileSync('frontend/src/store.js', 'utf8');
storeCode = storeCode.replace('skipOnboarding: async () => { `r`n    localStorage.setItem("hasSkippedOnboarding", "true"); `r`n    set({ hasSkippedOnboarding: true }); `r`n    try { await fetch(`${API}/api/auth/skip-onboarding`, { method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } }); } catch (e) {}`r`n  },',
`skipOnboarding: async () => {
    localStorage.setItem("hasSkippedOnboarding", "true");
    set({ hasSkippedOnboarding: true });
    try { await fetch(\`\${API}/api/auth/skip-onboarding\`, { method: "POST", headers: { "Authorization": \`Bearer \${localStorage.getItem("token")}\` } }); } catch (e) {}
  },`);
fs.writeFileSync('frontend/src/store.js', storeCode);

// Fix ClientDataView.jsx
let clientCode = fs.readFileSync('frontend/src/components/ClientDataView.jsx', 'utf8');
if (!clientCode.trim().endsWith('}')) {
  clientCode += '\n  );\n}\n';
}
fs.writeFileSync('frontend/src/components/ClientDataView.jsx', clientCode);
