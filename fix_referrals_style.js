const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ReferralsView.jsx', 'utf8');

// Remove the padding override since the parent wrapper now handles the full-screen layout
// Also remove the padding:32px in the outer div - it should be padding: '24px'
// The issue is the ReferralsView sets its own padding but the parent flex box is conflicting

// Instead, ensure the root div doesnt try to take up its own height since parent handles it
code = code.replace(
  `style={{ flex: 1, padding: '32px', overflowY: 'auto', background: 'var(--bg-dark)' }}`,
  `style={{ padding: '24px', background: 'var(--bg-dark)' }}`
);

fs.writeFileSync('frontend/src/components/ReferralsView.jsx', code);
