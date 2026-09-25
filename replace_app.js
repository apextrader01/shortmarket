const fs = require('fs');

let content = fs.readFileSync('frontend/src/App.jsx', 'utf8');

const search = `style={{
                      color:        activeTab === tabKey ? 'var(--text-primary)' : 'var(--text-secondary)',
                      borderBottom: activeTab === tabKey
                        ? (tabKey === 'AdminPanel' ? '2px solid var(--color-red)' : '2px solid var(--color-blue)')
                        : '2px solid transparent',
                      padding:        '16px 2px',
                      cursor:         'pointer',
                      transition:     'all 0.2s ease',
                      textTransform:  'uppercase',
                      letterSpacing:  '0.5px',
                    }}`;

const replacement = 'className={`nav-pill ${activeTab === tabKey ? "active" : ""}`} style={{ padding: "16px 2px", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.5px" }}';

content = content.replace(search, replacement);
fs.writeFileSync('frontend/src/App.jsx', content);
console.log('done');
