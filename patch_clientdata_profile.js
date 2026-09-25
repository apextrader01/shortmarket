const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ClientDataView.jsx', 'utf8');

// 1. Add import for SettingsView
if(!code.includes("import SettingsView")) {
    code = code.replace("import ReferralsView from './ReferralsView';", "import ReferralsView from './ReferralsView';\nimport SettingsView from './SettingsView';");
}

// 2. Add showProfile state
code = code.replace("const [showReferrals, setShowReferrals] = useState(false);", "const [showReferrals, setShowReferrals] = useState(false);\n  const [showProfile, setShowProfile] = useState(false);");

// 3. Make VIEW PROFILE clickable
code = code.replace("<div style={{ fontSize: '11px', color: 'var(--color-blue-light)', fontWeight: '600', cursor: 'pointer' }}>VIEW PROFILE</div>", "<div onClick={() => setShowProfile(true)} style={{ fontSize: '11px', color: 'var(--color-blue-light)', fontWeight: '600', cursor: 'pointer' }}>VIEW PROFILE &rarr;</div>");

// 4. Add the render intercept for showProfile
const renderIntercept = `
  if (showProfile) {
    return (
      <div style={{ padding: '24px', animation: 'fadeIn 0.3s ease-out' }}>
        <button 
          className="btn btn-secondary" 
          onClick={() => setShowProfile(false)} 
          style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '14px', borderRadius: '8px' }}
        >
          &larr; Back to Dashboard
        </button>
        <SettingsView />
      </div>
    );
  }
`;
code = code.replace("return (\n    <div className=\"client-data-container\"", renderIntercept + "  return (\n    <div className=\"client-data-container\"");

// 5. While I am at it, the user also mentioned the ? symbol being wrong in ClientDataView (Available Margin). 
// I'll replace the mangled ' with &#8377;
code = code.replace(/'/g, '&#8377;');

fs.writeFileSync('frontend/src/components/ClientDataView.jsx', code);
console.log("ClientDataView updated.");
