const fs = require('fs');
const file = 'frontend/src/components/AdminDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `<button
                          onClick={() => {
                            if (window.confirm(\`Are you sure you want to RESET \${u.username}'s account? This wipes all positions, orders, and ledger entries.\`)) {
                              adminResetUser(u.id);
                            }
                          }}`;
                          
const replacement = `<button
                          onClick={() => {
                            if (window.confirm(\`Are you sure you want to \${u.is_banned ? 'UNBAN' : 'BAN'} \${u.username}?\`)) {
                              toggleUserBan(u.id).then(() => alert('User ban status updated')).catch(e => alert(e.message));
                            }
                          }}
                          style={{
                            background: u.is_banned ? 'var(--color-green)' : 'var(--color-yellow)',
                            color: '#000',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          {u.is_banned ? 'Unban' : 'Ban'}
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(\`Are you sure you want to RESET \${u.username}'s account? This wipes all positions, orders, and ledger entries.\`)) {
                              adminResetUser(u.id);
                            }
                          }}`;

if (content.includes('toggleUserBan(u.id)')) {
  console.log('Already added');
} else {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log('Added Ban button');
}
