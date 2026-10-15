import React, { useState, useMemo } from 'react';
import { X, Search, RefreshCw, Activity, MousePointer, Globe, Clock, Shield, Laptop, ArrowUpRight } from 'lucide-react';

function formatTimeAgo(ts) {
  if (!ts) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - Number(ts)) / 1000));
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function formatFullTime(ts) {
  if (!ts) return '';
  try {
    const d = new Date(Number(ts));
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true
    });
  } catch (_) {
    return String(ts);
  }
}

export default function UserActivityInspectorModal({
  isOpen,
  data,
  loading,
  onRefresh,
  onClose,
  isLight = false
}) {
  const [activeTab, setActiveTab] = useState('CLICKS'); // 'CLICKS' | 'APIS'
  const [searchQuery, setSearchQuery] = useState('');

  const user = data?.user || {};
  const stats = data?.stats || {};
  const apiLogs = data?.apiLogs || [];
  const activityLogs = data?.activityLogs || [];

  const filteredActivities = useMemo(() => {
    if (!searchQuery.trim()) return activityLogs;
    const q = searchQuery.toLowerCase().trim();
    return activityLogs.filter(act => 
      (act.action || '').toLowerCase().includes(q) ||
      (act.type || '').toLowerCase().includes(q) ||
      (act.url || '').toLowerCase().includes(q) ||
      (act.target || '').toLowerCase().includes(q)
    );
  }, [activityLogs, searchQuery]);

  const filteredApis = useMemo(() => {
    if (!searchQuery.trim()) return apiLogs;
    const q = searchQuery.toLowerCase().trim();
    return apiLogs.filter(api => 
      (api.path || '').toLowerCase().includes(q) ||
      (api.method || '').toLowerCase().includes(q) ||
      String(api.status || '').includes(q) ||
      (api.ip || '').toLowerCase().includes(q)
    );
  }, [apiLogs, searchQuery]);

  if (!isOpen || !data) return null;

  const totalBytesFormatted = ((stats.apiBytes || 0) / (1024 * 1024)).toFixed(3);
  const marketTimeFormatted = (stats.wsMinutes || 0) >= 60
    ? `${Math.floor((stats.wsMinutes || 0) / 60)}h ${(stats.wsMinutes || 0) % 60}m`
    : `${stats.wsMinutes || 0} mins`;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1200, padding: '16px'
    }}>
      <div style={{
        background: 'var(--bg-panel, #0f172a)',
        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
        borderRadius: '16px',
        width: '900px', maxWidth: '96vw',
        maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden'
      }}>
        {/* Header Bar */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: isLight ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.3))',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px'
            }}>
              🔍
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: 'var(--text-primary, #fff)' }}>
                  {user.username || 'User Activity'}
                </h3>
                {user.client_id && (
                  <span style={{
                    color: 'var(--color-blue, #3b82f6)',
                    fontFamily: 'monospace', fontWeight: '700', fontSize: '11px',
                    background: 'rgba(59, 130, 246, 0.12)', padding: '2px 7px',
                    borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.25)'
                  }}>
                    {user.client_id}
                  </span>
                )}
                {user.phone && (
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', fontFamily: 'monospace' }}>
                    📱 +91 {user.phone}
                  </span>
                )}
                {user.email && (
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)' }}>
                    • {user.email}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>💻 <strong>{user.device_model || 'Desktop PC'}</strong> ({user.browser_name || 'Chrome'} on {user.os_name || 'Windows'})</span>
                <span>• IP: <strong style={{ color: 'var(--color-blue, #3b82f6)', fontFamily: 'monospace' }}>{user.last_ip || user.registration_ip || 'Unknown'}</strong></span>
                {(user.city || user.state) && (
                  <span>• 📍 {user.city ? `${user.city}, ` : ''}{user.state || 'India'}</span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              style={{
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: 'var(--color-blue, #3b82f6)',
                padding: '6px 12px', borderRadius: '6px',
                fontSize: '11.5px', fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px'
              }}
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              {loading ? 'Refreshing...' : 'Live Refresh'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--text-secondary, #94a3b8)',
                cursor: 'pointer', padding: '4px',
                display: 'flex', alignItems: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Real-time KPI Stats Bar */}
        <div style={{
          padding: '12px 20px',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px',
          borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
          background: isLight ? '#f8fafc' : 'rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-panel, #0f172a)', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary, #94a3b8)', fontWeight: '600' }}>TOTAL API HITS</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary, #fff)', marginTop: '2px' }}>
              {(stats.apiCalls || apiLogs.length || 0).toLocaleString()}
            </div>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-panel, #0f172a)', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary, #94a3b8)', fontWeight: '600' }}>BANDWIDTH USED</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--color-blue, #3b82f6)', marginTop: '2px' }}>
              {totalBytesFormatted} MB
            </div>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-panel, #0f172a)', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary, #94a3b8)', fontWeight: '600' }}>MARKET / ACTIVE TIME</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
              {marketTimeFormatted}
            </div>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-panel, #0f172a)', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary, #94a3b8)', fontWeight: '600' }}>AVG API LATENCY</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#f59e0b', marginTop: '2px' }}>
              {stats.avgLatencyMs || 0} ms
            </div>
          </div>
        </div>

        {/* Tabs & Search Bar */}
        <div style={{
          padding: '10px 20px',
          borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '10px'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('CLICKS')}
              style={{
                padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '700',
                border: activeTab === 'CLICKS' ? '1px solid var(--color-blue, #3b82f6)' : '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                background: activeTab === 'CLICKS' ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                color: activeTab === 'CLICKS' ? '#fff' : 'var(--text-secondary, #94a3b8)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              🖱️ What They Clicked & Did
              <span style={{
                background: activeTab === 'CLICKS' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                padding: '1px 6px', borderRadius: '10px', fontSize: '10px'
              }}>
                {activityLogs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('APIS')}
              style={{
                padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '700',
                border: activeTab === 'APIS' ? '1px solid var(--color-blue, #3b82f6)' : '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                background: activeTab === 'APIS' ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                color: activeTab === 'APIS' ? '#fff' : 'var(--text-secondary, #94a3b8)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              ⚡ What APIs They Called
              <span style={{
                background: activeTab === 'APIS' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                padding: '1px 6px', borderRadius: '10px', fontSize: '10px'
              }}>
                {apiLogs.length}
              </span>
            </button>
          </div>

          <div style={{ position: 'relative', width: '240px' }}>
            <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary, #94a3b8)' }} />
            <input
              type="text"
              placeholder={activeTab === 'CLICKS' ? "Search clicks & actions..." : "Search API route (e.g. /orders)..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-primary, #020617)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                borderRadius: '6px',
                padding: '5px 24px 5px 26px',
                fontSize: '11px',
                color: 'var(--text-primary, #fff)',
                outline: 'none'
              }}
            />
            {searchQuery && (
              <X size={12} onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }} />
            )}
          </div>
        </div>

        {/* Tab Content List / Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', minHeight: '320px' }}>
          {/* TAB 1: CLICKS & ACTIONS */}
          {activeTab === 'CLICKS' && (
            <div>
              {filteredActivities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-secondary, #94a3b8)' }}>
                  <div style={{ fontSize: '36px', marginBottom: '10px' }}>🖱️</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary, #fff)' }}>
                    {searchQuery ? 'No clicks or actions match your search' : 'No user clickstream events recorded yet'}
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '6px', maxWidth: '420px', margin: '6px auto 0' }}>
                    As {user.username || 'this user'} clicks buttons, switches tabs, places orders, or visits pages on the terminal, every action will stream here live.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredActivities.map((act, i) => {
                    const isNav = act.type === 'NAVIGATE';
                    const isTrade = act.type === 'TRADE';
                    return (
                      <div
                        key={i}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          background: isNav
                            ? 'rgba(59, 130, 246, 0.06)'
                            : isTrade
                            ? 'rgba(16, 185, 129, 0.06)'
                            : isLight ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.02)',
                          border: `1px solid ${isNav ? 'rgba(59, 130, 246, 0.2)' : isTrade ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-color, rgba(255, 255, 255, 0.06))'}`,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                            background: isNav ? 'rgba(59, 130, 246, 0.18)' : isTrade ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                            color: isNav ? '#60a5fa' : isTrade ? '#34d399' : 'var(--text-secondary, #94a3b8)',
                            letterSpacing: '0.5px'
                          }}>
                            {isNav ? '🧭 NAVIGATE' : isTrade ? '⚡ TRADE' : '🖱️ CLICK'}
                          </span>
                          <div>
                            <div style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-primary, #fff)' }}>
                              {act.action}
                            </div>
                            {act.url && (
                              <div style={{ fontSize: '10.5px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px', fontFamily: 'monospace' }}>
                                Route: {act.url}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary, #fff)' }}>
                            {formatTimeAgo(act.timestamp)}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary, #94a3b8)', marginTop: '1px' }}>
                            {formatFullTime(act.timestamp)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: API CALLS AUDIT */}
          {activeTab === 'APIS' && (
            <div>
              {filteredApis.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-secondary, #94a3b8)' }}>
                  <div style={{ fontSize: '36px', marginBottom: '10px' }}>⚡</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary, #fff)' }}>
                    {searchQuery ? 'No API calls match your search' : 'No API calls recorded yet'}
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '6px', maxWidth: '420px', margin: '6px auto 0' }}>
                    Every network request made by {user.username || 'this user'} (e.g. /api/orders, /api/positions, /api/auth/profile) will be logged here with HTTP method, latency, and status.
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-panel, #0f172a)', zIndex: 1 }}>
                      <tr style={{ borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))', color: 'var(--text-secondary, #94a3b8)', textAlign: 'left' }}>
                        <th style={{ padding: '6px 8px' }}>Method</th>
                        <th style={{ padding: '6px 8px' }}>API Route / Endpoint</th>
                        <th style={{ padding: '6px 8px' }}>Status</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Latency</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Payload Size</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApis.map((api, i) => {
                        const isGet = api.method === 'GET';
                        const isPost = api.method === 'POST';
                        const isDelete = api.method === 'DELETE';
                        const isSuccess = api.status >= 200 && api.status < 300;
                        const isError = api.status >= 400;
                        const sizeStr = api.bytes ? `${(api.bytes / 1024).toFixed(1)} KB` : '0 KB';

                        return (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                            <td style={{ padding: '7px 8px' }}>
                              <span style={{
                                fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '3px',
                                background: isGet ? 'rgba(59, 130, 246, 0.15)' : isPost ? 'rgba(16, 185, 129, 0.15)' : isDelete ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                                color: isGet ? '#60a5fa' : isPost ? '#34d399' : isDelete ? '#f87171' : '#facc15'
                              }}>
                                {api.method}
                              </span>
                            </td>
                            <td style={{ padding: '7px 8px', fontFamily: 'monospace', fontWeight: '600', color: 'var(--text-primary, #fff)' }}>
                              {api.path}
                            </td>
                            <td style={{ padding: '7px 8px' }}>
                              <span style={{
                                fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '3px',
                                background: isSuccess ? 'rgba(16, 185, 129, 0.12)' : isError ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                                color: isSuccess ? '#10b981' : isError ? '#ef4444' : 'var(--text-secondary, #94a3b8)'
                              }}>
                                {api.status || 200}
                              </span>
                            </td>
                            <td style={{
                              padding: '7px 8px', textAlign: 'right', fontWeight: '700',
                              color: (api.timeMs || 0) < 50 ? '#10b981' : (api.timeMs || 0) < 200 ? '#f59e0b' : '#ef4444'
                            }}>
                              {api.timeMs || 0} ms
                            </td>
                            <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--text-secondary, #94a3b8)', fontFamily: 'monospace' }}>
                              {sizeStr}
                            </td>
                            <td style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--text-primary, #fff)' }}>
                                {formatTimeAgo(api.timestamp)}
                              </div>
                              <div style={{ fontSize: '9.5px', color: 'var(--text-secondary, #94a3b8)' }}>
                                {formatFullTime(api.timestamp)}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
