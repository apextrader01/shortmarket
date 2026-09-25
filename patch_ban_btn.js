const fs = require('fs');
const file = 'frontend/src/components/AdminDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `Manage Client
                        </button>`;
                        
const replacement = `Manage Client
                        </button>
                        <button
                          style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            background: u.is_banned ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)',
                            color: u.is_banned ? 'var(--color-green-light)' : 'var(--color-yellow)',
                            border: \`1px solid \${u.is_banned ? 'rgba(34,197,94,0.2)' : 'rgba(234,179,8,0.2)'}\`
                          }}
                          onClick={async () => {
                            if (window.confirm(\`Are you sure you want to \${u.is_banned ? 'UNBAN' : 'BAN'} \${u.username}?\`)) {
                              try {
                                await toggleUserBan(u.id);
                              } catch(e) {
                                alert(e.message);
                              }
                            }
                          }}
                        >
                          {u.is_banned ? 'Unban' : 'Ban'}
                        </button>`;

if (content.includes('toggleUserBan(u.id)')) {
  console.log('Already added');
} else {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log('Added Ban button successfully');
}
