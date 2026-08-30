const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/OrdersView.jsx', 'utf8');

// 1. Update imports
code = code.replace("import { Box } from 'lucide-react';", "import { Box, Clock, Target, History, ShoppingBag } from 'lucide-react';");

// 2. Replace empty state block
const searchStr = `<div style={{ textAlign: 'center' }}>
              <div style={{ 
                width: '120px', height: '100px', background: 'var(--bg-panel)', 
                borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)', margin: '0 auto 24px', position: 'relative'
              }}>
                <Box size={40} color="var(--color-green-light)" />
                <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '24px' }}>✨</div>
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>You don't have any {activeTab.toLowerCase()}</h2>
  
            </div>`;

const replaceStr = `<div style={{ textAlign: 'center' }}>
              {(() => {
                let Icon = Box;
                let subtitle = '';
                if (activeTab === 'Open Orders') { Icon = Clock; subtitle = 'Limit and Stop orders waiting to be executed will appear here.'; }
                else if (activeTab === 'Pending Triggers') { Icon = Target; subtitle = 'Bracket (BO), Cover (CO), and GTT orders waiting for a price trigger will be listed here.'; }
                else if (activeTab === 'Order History') { Icon = History; subtitle = 'Your executed, cancelled, and rejected orders for today will appear here.'; }
                else if (activeTab === 'Basket Orders') { Icon = ShoppingBag; subtitle = 'Create and execute multiple orders simultaneously.'; }

                return (
                  <>
                    <div style={{ 
                      width: '120px', height: '100px', background: 'var(--bg-panel)', 
                      borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.2)', margin: '0 auto 24px', position: 'relative'
                    }}>
                      <Icon size={40} color="var(--color-green-light)" />
                      <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '24px' }}>✨</div>
                    </div>
                    <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>You don't have any {activeTab.toLowerCase()}</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '300px', margin: '0 auto', lineHeight: '1.5' }}>{subtitle}</p>
                  </>
                );
              })()}
            </div>`;

if(code.includes(searchStr)) {
    code = code.replace(searchStr, replaceStr);
    fs.writeFileSync('frontend/src/components/OrdersView.jsx', code, 'utf8');
    console.log('Patched properly.');
} else {
    // maybe newlines are \r\n
    const searchStrRN = searchStr.replace(/\\n/g, '\\r\\n');
    if(code.includes(searchStrRN)) {
        code = code.replace(searchStrRN, replaceStr);
        fs.writeFileSync('frontend/src/components/OrdersView.jsx', code, 'utf8');
        console.log('Patched properly with RN.');
    } else {
        console.log('Could not find search string.');
    }
}
