const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/OrdersView.jsx', 'utf8');

// Add import
if (!code.includes("import AlertsView")) {
    code = code.replace("import { Box } from 'lucide-react';", "import { Box } from 'lucide-react';\\nimport AlertsView from './AlertsView';");
}

// Replace top of Content Area
const topSearch = "{/* Content Area */}\\r\\n      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center'";
const topSearchLF = "{/* Content Area */}\\n      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center'";

const topReplace = "{/* Content Area */}\\n      {activeTab === 'Alerts' ? (\\n        <AlertsView />\\n      ) : (\\n      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center'";

if (code.includes(topSearch)) {
    code = code.replace(topSearch, topReplace);
} else if (code.includes(topSearchLF)) {
    code = code.replace(topSearchLF, topReplace);
} else {
    // try just replacing Content Area
    code = code.replace("{/* Content Area */}", "{/* Content Area */}\\n      {activeTab === 'Alerts' ? <AlertsView /> : (");
}

// Replace right before Order Details Modal
const bottomSearch = "      {/* Order Details Modal */}";
const bottomReplace = "      )}\\n      {/* Order Details Modal */}";

code = code.replace(bottomSearch, bottomReplace);

fs.writeFileSync('frontend/src/components/OrdersView.jsx', code, 'utf8');
console.log('Patched OrdersView.jsx correctly');
