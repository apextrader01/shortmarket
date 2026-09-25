const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// Fix the Referrals rendering to have proper wrapper just like other views
code = code.replace(
  `{activeTab === 'Referrals' && <ReferralsView setActiveTab={setActiveTab} />}`,
  `{activeTab === 'Referrals' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0, overflowY: 'auto' }}>
              <ReferralsView setActiveTab={setActiveTab} />
            </div>
          )}`
);

fs.writeFileSync('frontend/src/App.jsx', code);
