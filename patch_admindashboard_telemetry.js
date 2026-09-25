const fs = require('fs');
const file = 'frontend/src/components/AdminDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const storeTarget = `fetchAdminLedger } = useStore`;
const storeReplacement = `fetchAdminLedger, fetchAdminTelemetry, adminTelemetry } = useStore`;
content = content.replace(storeTarget, storeReplacement);

const fetchTarget = `} else if (activeTab === 'withdrawals') {`;
const fetchReplacement = `} else if (activeTab === 'telemetry') {
      fetchAdminTelemetry();
    } else if (activeTab === 'withdrawals') {`;
content = content.replace(fetchTarget, fetchReplacement);

const tabTarget = `              Withdrawals
            </button>
          </div>`;
const tabReplacement = `              Withdrawals
            </button>
            <button 
              onClick={() => setActiveTab('telemetry')} 
              style={{ background: 'none', border: 'none', padding: '8px 0', borderBottom: activeTab === 'telemetry' ? '2px solid var(--color-blue)' : '2px solid transparent', color: activeTab === 'telemetry' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'telemetry' ? '600' : '500', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Resource Telemetry
            </button>
          </div>`;
content = content.replace(tabTarget, tabReplacement);

// Render logic: Find the end of withdrawals map
const uiTarget = `                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : null}
      </div>`;
const uiReplacement = `                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : activeTab === 'telemetry' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* API APM TABLE */}
            <div className="card" style={{ padding: '24px', overflowX: 'auto' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={18} color="var(--color-blue)" /> API Performance (APM)</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>Route</th>
                    <th style={{ padding: '12px' }}>Hits</th>
                    <th style={{ padding: '12px' }}>Avg Latency</th>
                    <th style={{ padding: '12px' }}>Bandwidth</th>
                  </tr>
                </thead>
                <tbody>
                  {adminTelemetry?.api?.length === 0 ? <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>No telemetry collected yet</td></tr> : 
                    [...(adminTelemetry?.api || [])].sort((a,b) => b.totalTime - a.totalTime).map(row => {
                      const avgLatency = row.count > 0 ? (row.totalTime / row.count).toFixed(2) : 0;
                      const sizeKb = (row.totalBytes / 1024).toFixed(2);
                      return (
                        <tr key={row.route} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px', fontFamily: 'monospace' }}>{row.route}</td>
                          <td style={{ padding: '12px' }}>{row.count}</td>
                          <td style={{ padding: '12px', color: avgLatency > 100 ? 'var(--color-red)' : 'var(--color-green-light)' }}>{avgLatency} ms</td>
                          <td style={{ padding: '12px' }}>{sizeKb} KB</td>
                        </tr>
                      )
                    })
                  }
                </tbody>
              </table>
            </div>

            {/* USER RESOURCE TABLE */}
            <div className="card" style={{ padding: '24px', overflowX: 'auto' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={18} color="var(--color-blue)" /> Expensive Users</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>User</th>
                    <th style={{ padding: '12px' }}>Live Market Time</th>
                    <th style={{ padding: '12px' }}>API Calls</th>
                    <th style={{ padding: '12px' }}>Bandwidth</th>
                  </tr>
                </thead>
                <tbody>
                  {adminTelemetry?.users?.length === 0 ? <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>No telemetry collected yet</td></tr> : 
                    [...(adminTelemetry?.users || [])].sort((a,b) => b.apiBytes - a.apiBytes).map(u => {
                      const sizeMb = (u.apiBytes / (1024 * 1024)).toFixed(3);
                      return (
                        <tr key={u.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold' }}>{u.username}</td>
                          <td style={{ padding: '12px' }}>{u.wsMinutes} mins</td>
                          <td style={{ padding: '12px' }}>{u.apiCalls}</td>
                          <td style={{ padding: '12px' }}>{sizeMb} MB</td>
                        </tr>
                      )
                    })
                  }
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>`;
content = content.replace(uiTarget, uiReplacement);

fs.writeFileSync(file, content);
