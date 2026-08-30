const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ClientDataView.jsx', 'utf8');

const mainReturnRegex = /\s*return\s*\(\s*<div style=\{\{ flex: 1, padding: '32px'/;

const renderIntercept = `
  if (showProfile) {
    return (
      <div style={{ padding: '24px', animation: 'fadeIn 0.3s ease-out', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <button 
          className="btn btn-secondary" 
          onClick={() => setShowProfile(false)} 
          style={{ marginBottom: '24px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '14px', borderRadius: '8px', cursor: 'pointer', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
        >
          &larr; Back to Dashboard
        </button>
        <SettingsView />
      </div>
    );
  }
`;

if (mainReturnRegex.test(code)) {
    code = code.replace(mainReturnRegex, renderIntercept + "\n  return (\n    <div style={{ flex: 1, padding: '32px'");
    fs.writeFileSync('frontend/src/components/ClientDataView.jsx', code);
    console.log("Injected showProfile intercept safely.");
} else {
    console.log("Could not find main return block!");
}
