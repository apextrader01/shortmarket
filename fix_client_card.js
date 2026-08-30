const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ClientDataView.jsx', 'utf8');

code = code.replace(/<Card icon=\{Users\} title="Refer & Earn".*?\/>/s, '<Card icon={Users} title="Refer & Earn" desc="Refer a friend & get 10% of their subscription" color="#34D399" onClick={() => setActiveTab(\'Referrals\')} />');

fs.writeFileSync('frontend/src/components/ClientDataView.jsx', code);
