const fs = require('fs');
const file = 'frontend/src/components/AdminDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetUseStore = `updateUserDetails , toggleUserBan } = useStore(useShallow(state => ({ toggleUserBan: 
state.toggleUserBan, fetchAdminUsers: state.fetchAdminUsers,`;
const replacementUseStore = `updateUserDetails , toggleUserBan, adminMasterSquareOff } = useStore(useShallow(state => ({ toggleUserBan: 
state.toggleUserBan, adminMasterSquareOff: state.adminMasterSquareOff, fetchAdminUsers: state.fetchAdminUsers,`;
content = content.replace(targetUseStore, replacementUseStore);

const targetPosTab = `) : activeTab === 'positions' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>`;
const replacementPosTab = `) : activeTab === 'positions' ? (
          <>
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid var(--border-color)' }}>
              <button
                onClick={async () => {
                  if (window.confirm('?? WARNING: This will immediately close ALL open positions for ALL users. Are you sure you want to execute a Master Square-Off?')) {
                    try {
                      await adminMasterSquareOff();
                      alert('Master Square-Off initiated! Positions are being closed in the background. Refresh the page in a few seconds.');
                      loadData();
                    } catch (e) {
                      alert(e.message);
                    }
                  }
                }}
                style={{
                  background: 'var(--color-red)',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                ?? MASTER SQUARE-OFF (ALL USERS)
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>`;

content = content.replace(targetPosTab, replacementPosTab);
content = content.replace(`              )}
            </tbody>
          </table>
        ) : activeTab === 'ledger' ? (`, `              )}
            </tbody>
          </table>
          </>
        ) : activeTab === 'ledger' ? (`);

fs.writeFileSync(file, content);
