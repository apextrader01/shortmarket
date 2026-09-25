const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/OrdersView.jsx', 'utf8');

const targetStr = `{/* Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: (activeTab === 'Pending Triggers' ? displayTriggers.length === 0 : displayOrders.length === 0) ? 'center' : 'flex-start', minHeight: 0, width: '100%' }}>
        {(activeTab === 'Pending Triggers' ? displayTriggers.length === 0 : displayOrders.length === 0) ? (`

const replacementStr = `{/* Content Area */}
      {activeTab === 'Alerts' ? (
        <AlertsView />
      ) : (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: (activeTab === 'Pending Triggers' ? displayTriggers.length === 0 : displayOrders.length === 0) ? 'center' : 'flex-start', minHeight: 0, width: '100%' }}>
        {(activeTab === 'Pending Triggers' ? displayTriggers.length === 0 : displayOrders.length === 0) ? (`

code = code.replace(targetStr, replacementStr);

const endStr = `        </div>
      )}
    </div>
  );
}`;

const endReplacement = `        </div>
        )}
      </div>
      )}
    </div>
  );
}`;

code = code.replace(endStr, endReplacement);
fs.writeFileSync('frontend/src/components/OrdersView.jsx', code, 'utf8');
console.log('Patched OrdersView.jsx');
