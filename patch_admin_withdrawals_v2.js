const fs = require('fs');
const file = 'frontend/src/components/AdminDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/adminMasterSquareOff \} = useStore/, 'adminMasterSquareOff, fetchAdminWithdrawals, processAdminWithdrawal } = useStore');
content = content.replace(/state\.adminMasterSquareOff, fetchAdminUsers: state\.fetchAdminUsers,/, 'adminMasterSquareOff: state.adminMasterSquareOff, fetchAdminWithdrawals: state.fetchAdminWithdrawals, processAdminWithdrawal: state.processAdminWithdrawal, fetchAdminUsers: state.fetchAdminUsers,');

content = content.replace(/const \[deposits, setDeposits\] = useState\(\[\]\);/, 'const [deposits, setDeposits] = useState([]);\n  const [withdrawals, setWithdrawals] = useState([]);');

content = content.replace(/\} else if \(activeTab === 'deposits'\) \{/, `} else if (activeTab === 'withdrawals') {\n      const data = await fetchAdminWithdrawals();\n      setWithdrawals(data);\n    } else if (activeTab === 'deposits') {`);

content = content.replace(/Deposit Requests\r?\n\s*<\/button>/, `Deposit Requests\n            </button>\n            <button \n              onClick={() => setActiveTab('withdrawals')} \n              style={{ background: 'none', border: 'none', padding: '8px 0', borderBottom: activeTab === 'withdrawals' ? '2px solid var(--color-blue)' : '2px solid transparent', color: activeTab === 'withdrawals' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'withdrawals' ? '600' : '500', cursor: 'pointer', whiteSpace: 'nowrap' }}\n            >\n              Withdrawals\n            </button>`);

const replaceTable = `) : activeTab === 'withdrawals' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '16px', fontWeight: '500' }}>Date</th>
                <th style={{ padding: '16px', fontWeight: '500' }}>Client</th>
                <th style={{ padding: '16px', fontWeight: '500' }}>Bank / UPI Details</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(!withdrawals || withdrawals.length === 0) ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No withdrawal requests found</td>
                </tr>
              ) : (
                withdrawals.map(w => (
                  <tr key={w.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '16px' }}>{new Date(w.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                    <td style={{ padding: '16px' }}><div style={{ fontWeight: '600' }}>{w.username}</div><div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{w.phone}</div></td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>UPI: <span style={{color: '#fff'}}>{w.upi_id || 'N/A'}</span></div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>A/C: <span style={{color: '#fff'}}>{w.bank_account_no || 'N/A'}</span></div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>IFSC: <span style={{color: '#fff'}}>{w.bank_ifsc || 'N/A'}</span></div>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: '600' }}>?{parseFloat(w.amount).toFixed(2)}</td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{
                        color: w.status === 'CREDITED' ? 'var(--color-green-light)' : w.status === 'REJECTED' ? 'var(--color-red-light)' : w.status === 'PROCESSING' ? 'var(--color-blue)' : 'var(--color-yellow)',
                        background: w.status === 'CREDITED' ? 'rgba(34,197,94,0.1)' : w.status === 'REJECTED' ? 'rgba(239,68,68,0.1)' : w.status === 'PROCESSING' ? 'rgba(59,130,246,0.1)' : 'rgba(234,179,8,0.1)',
                        padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600'
                      }}>{w.status}</span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        {w.status === 'PENDING' && (
                          <>
                            <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={async () => {
                              if(window.confirm('Approve this withdrawal? User will see "Processing".')) {
                                await processAdminWithdrawal(w.id, 'PROCESSING');
                                loadData();
                              }
                            }}>Approve</button>
                            <button className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '11px', borderColor: 'var(--color-red)', color: 'var(--color-red)' }} onClick={async () => {
                              if(window.confirm('Reject this withdrawal? Amount will return to user.')) {
                                await processAdminWithdrawal(w.id, 'REJECTED');
                                loadData();
                              }
                            }}>Reject</button>
                          </>
                        )}
                        {w.status === 'PROCESSING' && (
                          <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--color-green)' }} onClick={async () => {
                            if(window.confirm('Mark as Credited? This means you have successfully transferred the money.')) {
                              await processAdminWithdrawal(w.id, 'CREDITED');
                              loadData();
                            }
                          }}>Mark Credited</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : activeTab === 'deposits' ? (`;

content = content.replace(/\) : activeTab === 'deposits' \? \(/, replaceTable);

fs.writeFileSync(file, content);
