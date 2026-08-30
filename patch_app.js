const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// 1. Remove from top navigation
code = code.replace("'Markets', 'Positions', 'Orders', 'Portfolio', 'Alerts', 'Analytics', 'Mutual Funds',", "'Markets', 'Positions', 'Orders', 'Portfolio', 'Analytics', 'Mutual Funds',");

// 2. Remove render block
code = code.replace("{activeTab === 'Alerts' && <div style={{ flex: 1, padding: '12px' }}><AlertsView /></div>}\\n", "");
code = code.replace("{activeTab === 'Alerts' && <div style={{ flex: 1, padding: '12px' }}><AlertsView /></div>}\\r\\n", "");

// 3. Remove from mobile menu
code = code.replace("{ label: 'Alerts', icon: TrendingUp },\\n", "");
code = code.replace("{ label: 'Alerts', icon: TrendingUp },\\r\\n", "");

// 4. Update tabsMap
code = code.replace("'orders': 'Orders', 'portfolio': 'Portfolio', 'alerts': 'Alerts',", "'orders': 'Orders', 'portfolio': 'Portfolio', 'alerts': 'Orders',");
code = code.replace("'orders': 'Orders', 'portfolio': 'Portfolio', 'alerts': 'Alerts',", "'orders': 'Orders', 'portfolio': 'Portfolio', 'alerts': 'Orders',"); // second occurrence

// 5. Remove import of AlertsView since we don't render it directly in App anymore
code = code.replace("import AlertsView from './components/AlertsView';\\n", "");
code = code.replace("import AlertsView from './components/AlertsView';\\r\\n", "");

fs.writeFileSync('frontend/src/App.jsx', code, 'utf8');
console.log('Patched App.jsx');
