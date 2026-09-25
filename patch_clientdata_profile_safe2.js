const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ClientDataView.jsx', 'utf8');

if(!code.includes("import SettingsView")) {
    code = code.replace("import ReferralsView from './ReferralsView';", "import ReferralsView from './ReferralsView';\nimport SettingsView from './SettingsView';");
}

code = code.replace("const [showReferrals, setShowReferrals] = useState(false);", "const [showReferrals, setShowReferrals] = useState(false);\n  const [showProfile, setShowProfile] = useState(false);");

code = code.replace("<div style={{ fontSize: '11px', color: 'var(--color-blue-light)', fontWeight: '600', cursor: 'pointer' }}>VIEW PROFILE</div>", "<div onClick={() => setShowProfile(true)} style={{ fontSize: '11px', color: 'var(--color-blue-light)', fontWeight: '600', cursor: 'pointer' }}>VIEW PROFILE &rarr;</div>");

const renderIntercept = `
  if (showProfile) {
    return (
      <div style={{ padding: '24px', animation: 'fadeIn 0.3s ease-out', maxWidth: '1000px', margin: '0 auto' }}>
        <button 
          className="btn btn-secondary" 
          onClick={() => setShowProfile(false)} 
          style={{ marginBottom: '24px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '14px', borderRadius: '8px' }}
        >
          &larr; Back to Dashboard
        </button>
        <SettingsView />
      </div>
    );
  }
`;
code = code.replace("return (\n    <div className=\"client-data-container\"", renderIntercept + "  return (\n    <div className=\"client-data-container\"");

// Target the exact mangled string in the available margin
code = code.replace(/Available Margin: [^\s]+Number\(user/g, 'Available Margin: &#8377;{Number(user');
// Target the one in the reset alert
code = code.replace(/balance to [^\s]+10,00,000/g, 'balance to Rs. 10,00,000');

fs.writeFileSync('frontend/src/components/ClientDataView.jsx', code);
console.log("ClientDataView updated safely.");
