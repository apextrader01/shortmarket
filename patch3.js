const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/OrdersView.jsx', 'utf8');

const parts = code.split('{/* Content Area */}');
if (parts.length === 2) {
    code = parts[0] + '{/* Content Area */}\\n      {activeTab === \\'Alerts\\' ? <AlertsView /> : (' + parts[1].replace(/\\s+$/,'') + '\\n      )}\\n    </div>\\n  );\\n}\\n';
    fs.writeFileSync('frontend/src/components/OrdersView.jsx', code, 'utf8');
    console.log('Success');
} else {
    console.log('Failed to split');
}
