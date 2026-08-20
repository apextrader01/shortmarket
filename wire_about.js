const fs = require('fs');
let appContent = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// Add import
appContent = appContent.replace("import ClientDataView from './components/ClientDataView';", "import ClientDataView from './components/ClientDataView';\nimport AboutUsView from './components/AboutUsView';");

// Update both tabsMaps
appContent = appContent.replace(
  /'reports': 'Reports'/g,
  "'reports': 'Reports',\n        'aboutus': 'AboutUs'"
);

// Add Route
const clientDataRouteStr = `{activeTab === 'ClientData' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <ClientDataView onDepositClick={() => setShowDepositModal(true)} setActiveTab={setActiveTab} />
            </div>
          )}`;

const aboutUsRouteStr = `{activeTab === 'ClientData' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <ClientDataView onDepositClick={() => setShowDepositModal(true)} setActiveTab={setActiveTab} />
            </div>
          )}
          {activeTab === 'AboutUs' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <AboutUsView setActiveTab={setActiveTab} />
            </div>
          )}`;

appContent = appContent.replace(clientDataRouteStr, aboutUsRouteStr);
fs.writeFileSync('frontend/src/App.jsx', appContent);

// Update ClientDataView
let clientDataContent = fs.readFileSync('frontend/src/components/ClientDataView.jsx', 'utf8');
const oldAboutUs = `<div className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px' }}><Info size={16} color="var(--color-blue)" /></div>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>About Us</span>
            </div>`;

const newAboutUs = `<div className="glass-panel hoverable" onClick={() => setActiveTab('AboutUs')} style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px' }}><Info size={16} color="var(--color-blue)" /></div>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>About Us</span>
            </div>`;

clientDataContent = clientDataContent.replace(oldAboutUs, newAboutUs);
fs.writeFileSync('frontend/src/components/ClientDataView.jsx', clientDataContent);

console.log('App and ClientDataView updated');
