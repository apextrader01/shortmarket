import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { Users, CreditCard, CheckCircle, Clock, Search, Shield, X, RefreshCw, Check, XCircle, Activity, Mail, Phone, Edit, User, Download, Trash2, Zap, Play, Pause, TrendingUp, HardDrive, Key, Settings, Lock, Eye, EyeOff, ShieldCheck, Calendar, ChevronLeft, ChevronRight, Sparkles, Plus, Info, Sun, Moon, AlertTriangle } from 'lucide-react';
import { exportToExcel, exportToPDF } from '../utils/adminExport';

const calculateDateBounds = (preset, customStart, customEnd) => {
  const now = new Date();
  if (preset === 'week') {
    return {
      startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: ''
    };
  }
  if (preset === '15days') {
    return {
      startDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: ''
    };
  }
  if (preset === 'month') {
    return {
      startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: ''
    };
  }
  if (preset === '3months') {
    return {
      startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: ''
    };
  }
  if (preset === 'custom') {
    return {
      startDate: customStart ? new Date(customStart + 'T00:00:00.000Z').toISOString() : '',
      endDate: customEnd ? new Date(customEnd + 'T23:59:59.999Z').toISOString() : ''
    };
  }
  return { startDate: '', endDate: '' };
};

function DateRangeExportBar({
  datePreset,
  setDatePreset,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  onExportExcel,
  onExportPDF,
  exporting
}) {
  const presets = [
    { id: 'week', label: 'Week' },
    { id: '15days', label: '15 Days' },
    { id: 'month', label: 'Month' },
    { id: '3months', label: '3 Months' },
    { id: 'all', label: 'All' },
    { id: 'custom', label: '📅 Custom' }
  ];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '6px',
      padding: '4px 8px',
      background: 'rgba(255, 255, 255, 0.02)',
      borderRadius: '5px',
      border: '1px solid var(--border-color)',
      margin: '2px 0'
    }}>
      {/* Date Presets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', fontWeight: '600', marginRight: '2px' }}>
          Date Range:
        </span>
        {presets.map(p => {
          const isActive = datePreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setDatePreset(p.id)}
              style={{
                background: isActive ? 'var(--color-blue)' : 'rgba(255, 255, 255, 0.04)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                border: isActive ? '1px solid var(--color-blue)' : '1px solid var(--border-color)',
                borderRadius: '3px',
                padding: '2px 6px',
                fontSize: '9.5px',
                fontWeight: isActive ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.12s ease'
              }}
            >
              {p.label}
            </button>
          );
        })}

        {/* Custom date range picker if custom selected */}
        {datePreset === 'custom' && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '4px' }}>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '3px',
                padding: '1px 4px',
                fontSize: '9.5px',
                color: 'var(--text-primary)',
                height: '20px'
              }}
            />
            <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>to</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '3px',
                padding: '1px 4px',
                fontSize: '9.5px',
                color: 'var(--text-primary)',
                height: '20px'
              }}
            />
          </div>
        )}
      </div>

      {/* Export Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <button
          type="button"
          onClick={onExportExcel}
          disabled={exporting}
          title="Download Excel / CSV format"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            background: 'rgba(16, 185, 129, 0.12)',
            color: '#10b981',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '3px',
            padding: '2px 8px',
            fontSize: '9.5px',
            fontWeight: '600',
            cursor: exporting ? 'not-allowed' : 'pointer',
            opacity: exporting ? 0.6 : 1,
            transition: 'all 0.12s ease'
          }}
        >
          <span>📥</span> Excel
        </button>

        <button
          type="button"
          onClick={onExportPDF}
          disabled={exporting}
          title="Print or Save PDF report"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            background: 'rgba(239, 68, 68, 0.12)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '3px',
            padding: '2px 8px',
            fontSize: '9.5px',
            fontWeight: '600',
            cursor: exporting ? 'not-allowed' : 'pointer',
            opacity: exporting ? 0.6 : 1,
            transition: 'all 0.12s ease'
          }}
        >
          <span>📄</span> PDF
        </button>
      </div>
    </div>
  );
}

const isMarketHours = () => {
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const day = ist.getUTCDay();
  const hr = ist.getUTCHours();
  const min = ist.getUTCMinutes();
  const timeNum = hr * 100 + min;
  if (day === 0 || day === 6) return false;
  return timeNum >= 900 && timeNum <= 2330;
};

function SystemStatusTab({ onOpenAutoLoginModal, onTriggerAutoLogin, autoLoginLoading }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const { marketStatus, updateMarketStatus, fetchMarketStatus } = useStore();
  const [marketUpdating, setMarketUpdating] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchMarketStatus?.();
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/fyers/status`);
        const data = await res.json();
        setStatus(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div style={{ padding: '24px', color: 'var(--text-secondary)' }}>Loading system status...</div>;
  if (!status) return <div style={{ padding: '24px', color: 'var(--color-red)' }}>Failed to fetch system status. Is the backend running?</div>;

  const isMarketOpenNow = isMarketHours();
  const isHealthy = status.hasAccessToken && !status.tokenExpired && (status.secondsSinceLastTick < 30 || !isMarketOpenNow || status.isFyersConnected);
  const statusText = (!status.hasAccessToken || status.tokenExpired)
    ? 'Fyers Token Expired or Disconnected (Action Required)'
    : status.secondsSinceLastTick < 30
      ? 'System is Healthy & Receiving Live Data'
      : !isMarketOpenNow
        ? 'System is Healthy & Authenticated (Standing By - Markets Closed / Weekend)'
        : 'System Connected (Waiting for Live Exchange Ticks)';

  return (
    <div style={{ padding: '12px 16px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-panel)', padding: '12px 16px', borderRadius: '10px', border: `1px solid ${isHealthy ? 'var(--color-green)' : 'var(--color-red)'}` }}>
        <Activity size={24} color={isHealthy ? 'var(--color-green)' : 'var(--color-red)'} />
        <div>
          <h3 style={{ margin: '0 0 2px 0', fontSize: '15px' }}>Broker & Market Engine Status</h3>
          <div style={{ color: isHealthy ? 'var(--color-green)' : 'var(--color-red)', fontWeight: 'bold', fontSize: '12px' }}>
            {statusText}
          </div>
        </div>
      </div>

      {/* Automated Daily Headless Login Card */}
      <div style={{ background: 'var(--bg-panel)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} style={{ color: '#eab308' }} />
            <div>
              <h4 style={{ margin: '0 0 2px 0', fontSize: '14px', color: 'var(--text-primary)' }}>100% Automated Daily Headless Login (TOTP)</h4>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                Refreshes Fyers access token automatically every morning at 08:00 AM & 08:30 AM IST using 2FA TOTP.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={onTriggerAutoLogin}
              disabled={autoLoginLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: '#fff',
                border: 'none',
                padding: '5px 11px',
                borderRadius: '5px',
                fontWeight: '600',
                fontSize: '11px',
                cursor: autoLoginLoading ? 'not-allowed' : 'pointer',
                opacity: autoLoginLoading ? 0.7 : 1
              }}
            >
              {autoLoginLoading ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
              {autoLoginLoading ? 'Logging In...' : '⚡ Run Auto-Login Now'}
            </button>
            <button
              onClick={onOpenAutoLoginModal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '5px 11px',
                borderRadius: '5px',
                fontWeight: '600',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              <Settings size={12} /> Setup Credentials
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>SCHEDULED CRON</div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '2px' }}>⏰ 08:00 AM & 08:30 AM IST</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>TOKEN STATUS</div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: (status.hasAccessToken && !status.tokenExpired) ? 'var(--color-green)' : 'var(--color-red)', marginTop: '2px' }}>
              {(status.hasAccessToken && !status.tokenExpired) ? '🟢 Valid & Active' : status.tokenExpired ? '🔴 Expired (Action Needed)' : '🟡 Not Authenticated'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>AUTHENTICATION TYPE</div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-blue)', marginTop: '2px' }}>🔐 RFC 6238 TOTP + 4-Digit PIN</div>
          </div>
        </div>
      </div>

      {/* Market Trading Session Controls in System Status */}
      <div style={{ background: 'var(--bg-panel)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h4 style={{ margin: '0 0 2px 0', fontSize: '14px', color: 'var(--text-primary)' }}>Market Trading Session Control (Switches)</h4>
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
              Override default weekday/weekend schedules for special Saturday/Sunday sessions or declare trading holidays.
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
          {/* Equity Box */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '700', fontSize: '13px' }}>📈 NSE / BSE Equities</span>
              <span style={{ 
                padding: '2px 6px', 
                borderRadius: '4px', 
                fontSize: '10px', 
                fontWeight: '700',
                background: marketStatus?.equity === 'OPEN' ? 'rgba(34,197,94,0.15)' : marketStatus?.equity === 'CLOSED' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                color: marketStatus?.equity === 'OPEN' ? 'var(--color-green)' : marketStatus?.equity === 'CLOSED' ? 'var(--color-red)' : 'var(--color-blue)',
                border: `1px solid ${marketStatus?.equity === 'OPEN' ? 'rgba(34,197,94,0.3)' : marketStatus?.equity === 'CLOSED' ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}`
              }}>
                {marketStatus?.equity === 'OPEN' ? '🟢 FORCED OPEN' : marketStatus?.equity === 'CLOSED' ? '🔴 FORCED CLOSED' : '⚡ AUTO (SCHEDULED)'}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Standard hours: Mon–Fri, 9:15 AM – 3:15 PM IST.
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
              {['AUTO', 'OPEN', 'CLOSED'].map(mode => (
                <button
                  key={mode}
                  disabled={marketUpdating}
                  onClick={async () => {
                    setMarketUpdating(true);
                    await updateMarketStatus(mode, marketStatus?.commodity || 'AUTO');
                    setMarketUpdating(false);
                  }}
                  style={{
                    flex: 1,
                    padding: '5px 4px',
                    borderRadius: '5px',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: (marketStatus?.equity || 'AUTO') === mode 
                      ? (mode === 'OPEN' ? 'var(--color-green)' : mode === 'CLOSED' ? 'var(--color-red)' : 'var(--color-blue)')
                      : 'rgba(255,255,255,0.05)',
                    color: (marketStatus?.equity || 'AUTO') === mode ? '#fff' : 'var(--text-secondary)',
                    border: (marketStatus?.equity || 'AUTO') === mode ? 'none' : '1px solid var(--border-color)'
                  }}
                >
                  {mode === 'AUTO' ? '⚡ AUTO' : mode === 'OPEN' ? '🟢 OPEN' : '🔴 CLOSED'}
                </button>
              ))}
            </div>
          </div>

          {/* Commodity Box */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '700', fontSize: '13px' }}>🪙 MCX Commodities</span>
              <span style={{ 
                padding: '2px 6px', 
                borderRadius: '4px', 
                fontSize: '10px', 
                fontWeight: '700',
                background: marketStatus?.commodity === 'OPEN' ? 'rgba(34,197,94,0.15)' : marketStatus?.commodity === 'CLOSED' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                color: marketStatus?.commodity === 'OPEN' ? 'var(--color-green)' : marketStatus?.commodity === 'CLOSED' ? 'var(--color-red)' : 'var(--color-blue)',
                border: `1px solid ${marketStatus?.commodity === 'OPEN' ? 'rgba(34,197,94,0.3)' : marketStatus?.commodity === 'CLOSED' ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}`
              }}>
                {marketStatus?.commodity === 'OPEN' ? '🟢 FORCED OPEN' : marketStatus?.commodity === 'CLOSED' ? '🔴 FORCED CLOSED' : '⚡ AUTO (SCHEDULED)'}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Standard hours: Mon–Fri, 9:00 AM – 10:50 PM IST.
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
              {['AUTO', 'OPEN', 'CLOSED'].map(mode => (
                <button
                  key={mode}
                  disabled={marketUpdating}
                  onClick={async () => {
                    setMarketUpdating(true);
                    await updateMarketStatus(marketStatus?.equity || 'AUTO', mode);
                    setMarketUpdating(false);
                  }}
                  style={{
                    flex: 1,
                    padding: '5px 4px',
                    borderRadius: '5px',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: (marketStatus?.commodity || 'AUTO') === mode 
                      ? (mode === 'OPEN' ? 'var(--color-green)' : mode === 'CLOSED' ? 'var(--color-red)' : 'var(--color-blue)')
                      : 'rgba(255,255,255,0.05)',
                    color: (marketStatus?.commodity || 'AUTO') === mode ? '#fff' : 'var(--text-secondary)',
                    border: (marketStatus?.commodity || 'AUTO') === mode ? 'none' : '1px solid var(--border-color)'
                  }}
                >
                  {mode === 'AUTO' ? '⚡ AUTO' : mode === 'OPEN' ? '🟢 OPEN' : '🔴 CLOSED'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: isMobile ? '8px' : '10px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>Fyers Access Token</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: status.hasAccessToken ? 'var(--color-green)' : 'var(--color-red)' }}>
            {status.hasAccessToken ? 'Valid & Loaded' : 'Missing / Expired'}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>WebSocket Connection</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: status.isFyersConnected ? 'var(--color-green)' : 'var(--color-red)' }}>
            {status.isFyersConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>Time Since Last Tick</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: status.secondsSinceLastTick < 15 ? 'var(--color-green)' : 'var(--color-yellow)' }}>
            {status.secondsSinceLastTick !== null && status.secondsSinceLastTick !== undefined ? `${status.secondsSinceLastTick.toFixed(1)}s ago` : 'N/A'}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>Active Subscriptions</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
            {status.subscriptions?.length || 0} symbols
          </div>
        </div>
      </div>

      {status.lastDataSocketError && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-red)', padding: '10px 14px', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--color-red)' }}>Recent WebSocket Error</h4>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '11px', color: 'var(--color-red-light)' }}>
            {status.lastDataSocketError}
          </pre>
        </div>
      )}

      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--text-primary)' }}>Currently Subscribed Symbols (Live Data)</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {status.subscriptions && status.subscriptions.length > 0 ? status.subscriptions.map(sym => (
            <span key={sym} style={{ background: 'var(--bg-panel)', padding: '3px 6px', borderRadius: '4px', fontSize: '11px', border: '1px solid var(--border-color)' }}>
              {sym}
            </span>
          )) : (
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>No active subscriptions</span>
          )}
        </div>
      </div>
    </div>
  );
}

function MarketCalendarTab({ isMobile }) {
  const { marketCalendar, fetchMarketCalendar, saveMarketCalendarDate, deleteMarketCalendarDate, seedMarketHolidays } = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [searchFilter, setSearchFilter] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [holidaySeeding, setHolidaySeeding] = useState(false);

  const [editForm, setEditForm] = useState({
    date: '',
    equity_status: 'DEFAULT',
    commodity_status: 'DEFAULT',
    equity_start_time: '09:15',
    equity_end_time: '15:30',
    commodity_start_time: '09:00',
    commodity_end_time: '23:30',
    reason: ''
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  useEffect(() => {
    fetchMarketCalendar?.();
  }, [monthStr]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const jumpToToday = () => {
    setCurrentDate(new Date());
  };

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarMap = React.useMemo(() => {
    const map = {};
    (marketCalendar || []).forEach(rule => {
      map[rule.date] = rule;
    });
    return map;
  }, [marketCalendar]);

  const today = new Date();
  const istToday = new Date(today.getTime() + (5.5 * 60 * 60 * 1000));
  const todayStr = `${istToday.getUTCFullYear()}-${String(istToday.getUTCMonth() + 1).padStart(2, '0')}-${String(istToday.getUTCDate()).padStart(2, '0')}`;

  const handleOpenEdit = (dateStr) => {
    const existing = calendarMap[dateStr];
    if (existing) {
      setEditForm({
        date: dateStr,
        equity_status: existing.equity_status || 'DEFAULT',
        commodity_status: existing.commodity_status || 'DEFAULT',
        equity_start_time: existing.equity_start_time || '09:15',
        equity_end_time: existing.equity_end_time || '15:30',
        commodity_start_time: existing.commodity_start_time || '09:00',
        commodity_end_time: existing.commodity_end_time || '23:30',
        reason: existing.reason || ''
      });
    } else {
      setEditForm({
        date: dateStr,
        equity_status: 'DEFAULT',
        commodity_status: 'DEFAULT',
        equity_start_time: '09:15',
        equity_end_time: '15:30',
        commodity_start_time: '09:00',
        commodity_end_time: '23:30',
        reason: ''
      });
    }
    setSelectedDateStr(dateStr);
    setEditModalOpen(true);
  };

  const handleSaveRule = async (e) => {
    if (e) e.preventDefault();
    setActionLoading(true);
    const res = await saveMarketCalendarDate(editForm);
    setActionLoading(false);
    if (res.success) {
      setEditModalOpen(false);
    } else {
      alert('Error saving calendar rule: ' + (res.error || 'Unknown error'));
    }
  };

  const handleDeleteRule = async () => {
    if (!selectedDateStr) return;
    if (!window.confirm(`Reset ${selectedDateStr} back to Default Auto schedule?`)) return;
    setActionLoading(true);
    const res = await deleteMarketCalendarDate(selectedDateStr);
    setActionLoading(false);
    if (res.success) {
      setEditModalOpen(false);
    } else {
      alert('Error deleting calendar rule: ' + (res.error || 'Unknown error'));
    }
  };

  const handleBulkSeed = async () => {
    if (!window.confirm('Import the official 2026 Indian Stock Market Holidays list (NSE/BSE + MCX evening sessions)? This will pre-fill all 16 official exchange holidays.')) return;
    setHolidaySeeding(true);
    const res = await seedMarketHolidays();
    setHolidaySeeding(false);
    if (res.success) {
      alert(`✅ Successfully imported ${res.count || 16} official Indian market holidays for 2026!`);
    } else {
      alert('Error importing holidays: ' + (res.error || 'Unknown error'));
    }
  };

  const applyPreset = (type) => {
    if (type === 'HOLIDAY_ALL') {
      setEditForm(prev => ({
        ...prev,
        equity_status: 'CLOSED',
        commodity_status: 'CLOSED',
        reason: prev.reason || 'Market Holiday'
      }));
    } else if (type === 'MCX_EVENING_ONLY') {
      setEditForm(prev => ({
        ...prev,
        equity_status: 'CLOSED',
        commodity_status: 'OPEN',
        commodity_start_time: '17:00',
        commodity_end_time: '23:30',
        reason: prev.reason || 'Holiday - MCX Evening Session Open (5:00 PM - 11:30 PM)'
      }));
    } else if (type === 'MUHURAT') {
      setEditForm(prev => ({
        ...prev,
        equity_status: 'OPEN',
        commodity_status: 'OPEN',
        equity_start_time: '18:15',
        equity_end_time: '19:15',
        commodity_start_time: '18:15',
        commodity_end_time: '19:15',
        reason: prev.reason || 'Diwali Muhurat Trading Session (6:15 PM - 7:15 PM)'
      }));
    } else if (type === 'WEEKEND_SPECIAL') {
      setEditForm(prev => ({
        ...prev,
        equity_status: 'OPEN',
        commodity_status: 'OPEN',
        equity_start_time: '09:15',
        equity_end_time: '15:30',
        commodity_start_time: '09:00',
        commodity_end_time: '23:30',
        reason: prev.reason || 'Special Weekend Live Trading Session'
      }));
    } else if (type === 'RESET_DEFAULT') {
      setEditForm(prev => ({
        ...prev,
        equity_status: 'DEFAULT',
        commodity_status: 'DEFAULT',
        reason: ''
      }));
    }
  };

  const filteredRules = (marketCalendar || []).filter(r => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (r.date && r.date.toLowerCase().includes(q)) || (r.reason && r.reason.toLowerCase().includes(q));
  });

  return (
    <div style={{ padding: isMobile ? '8px' : '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Calendar Tab Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
            <Calendar size={17} style={{ color: '#c084fc' }} />
            Market Trading Calendar & Scheduled Holidays
          </h3>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
            Configure specific dates in advance for NSE/BSE & MCX (Declare holidays, schedule Saturday/Sunday live trading, or enable MCX evening sessions).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={handleBulkSeed}
            disabled={holidaySeeding}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: 'linear-gradient(135deg, #9333ea, #6366f1)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '5px 11px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: holidaySeeding ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(147, 51, 234, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <Sparkles size={13} />
            {holidaySeeding ? 'Importing...' : '✨ Import 2026 Official Exchange Holidays'}
          </button>

          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? 'var(--color-blue)' : 'transparent',
                color: viewMode === 'grid' ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 9px',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              🗓️ Month Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                background: viewMode === 'list' ? 'var(--color-blue)' : 'transparent',
                color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 9px',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              📋 Scheduled Rules ({(marketCalendar || []).length})
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: isMobile ? '8px' : '10px 14px' }}>
          {/* Month Navigation Controls & Legend */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={prevMonth}
                style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '5px', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
              >
                <ChevronLeft size={14} />
              </button>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', minWidth: '130px' }}>
                {monthNames[month]} {year}
              </h4>
              <button
                onClick={nextMonth}
                style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '5px', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
              >
                <ChevronRight size={14} />
              </button>
              <button
                onClick={jumpToToday}
                style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--color-blue)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '5px', padding: '3px 8px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}
              >
                Today
              </button>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '10px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--color-green)' }} /> Open / Special</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#eab308' }} /> MCX Evening Only</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--color-red)' }} /> Closed / Holiday</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} /> Standard</span>
            </div>
          </div>

          {/* Days of Week Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '4px' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
              <div key={d} style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: (i === 0 || i === 6) ? '#f87171' : 'var(--text-secondary)', padding: '2px' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid Cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {/* Blank offset boxes */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`blank-${i}`} style={{ minHeight: isMobile ? '55px' : '65px', background: 'rgba(0,0,0,0.06)', borderRadius: '5px', opacity: 0.15 }} />
            ))}

            {/* Days in Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayOfWeek = new Date(year, month, dayNum).getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const isToday = dateStr === todayStr;
              const rule = calendarMap[dateStr];

              const hasRule = !!rule;
              const isFullHoliday = rule && rule.equity_status === 'CLOSED' && rule.commodity_status === 'CLOSED';
              const isEveningOnly = rule && rule.equity_status === 'CLOSED' && rule.commodity_status === 'OPEN';
              const isSpecialOpen = rule && (rule.equity_status === 'OPEN' || (isWeekend && rule.commodity_status === 'OPEN'));

              let cellBg = 'rgba(0,0,0,0.2)';
              let cellBorder = '1px solid var(--border-color)';

              if (isFullHoliday) {
                cellBg = 'rgba(239, 68, 68, 0.08)';
                cellBorder = '1px solid rgba(239, 68, 68, 0.35)';
              } else if (isEveningOnly) {
                cellBg = 'rgba(234, 179, 8, 0.08)';
                cellBorder = '1px solid rgba(234, 179, 8, 0.35)';
              } else if (isSpecialOpen) {
                cellBg = 'rgba(34, 197, 94, 0.08)';
                cellBorder = '1px solid rgba(34, 197, 94, 0.35)';
              } else if (isWeekend) {
                cellBg = 'rgba(255,255,255,0.015)';
              }

              if (isToday) {
                cellBorder = '2px solid #3b82f6';
                cellBg = 'rgba(59, 130, 246, 0.08)';
              }

              return (
                <div
                  key={dateStr}
                  onClick={() => handleOpenEdit(dateStr)}
                  style={{
                    minHeight: isMobile ? '55px' : '65px',
                    background: cellBg,
                    border: cellBorder,
                    borderRadius: '5px',
                    padding: '4px 6px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.borderColor = isToday ? '#60a5fa' : 'rgba(255,255,255,0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = cellBorder.split(' ')[2];
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: isToday ? '800' : '700',
                      color: isToday ? '#fff' : isWeekend ? '#f87171' : 'var(--text-primary)',
                      background: isToday ? '#3b82f6' : 'transparent',
                      width: isToday ? '20px' : 'auto',
                      height: isToday ? '20px' : 'auto',
                      borderRadius: isToday ? '50%' : '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {dayNum}
                    </span>

                    {hasRule && (
                      <span style={{ fontSize: '9px', background: 'rgba(192, 132, 252, 0.2)', color: '#c084fc', padding: '1px 4px', borderRadius: '3px', fontWeight: '700' }}>
                        Custom
                      </span>
                    )}
                  </div>

                  {/* Badges / Status Preview */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                    {hasRule ? (
                      <>
                        {rule.reason && (
                          <div style={{ fontSize: '9px', fontWeight: '700', color: isFullHoliday ? '#fca5a5' : isEveningOnly ? '#fde047' : '#86efac', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rule.reason}>
                            {rule.reason}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '8px',
                            fontWeight: '700',
                            padding: '1px 3px',
                            borderRadius: '3px',
                            background: rule.equity_status === 'CLOSED' ? 'rgba(239, 68, 68, 0.25)' : rule.equity_status === 'OPEN' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255,255,255,0.1)',
                            color: rule.equity_status === 'CLOSED' ? 'var(--color-red-light)' : rule.equity_status === 'OPEN' ? 'var(--color-green-light)' : 'var(--text-secondary)'
                          }}>
                            NSE:{rule.equity_status === 'CLOSED' ? 'OFF' : 'ON'}
                          </span>
                          <span style={{
                            fontSize: '8px',
                            fontWeight: '700',
                            padding: '1px 3px',
                            borderRadius: '3px',
                            background: rule.commodity_status === 'CLOSED' ? 'rgba(239, 68, 68, 0.25)' : (rule.commodity_status === 'OPEN' && rule.commodity_start_time === '17:00') ? 'rgba(234, 179, 8, 0.25)' : rule.commodity_status === 'OPEN' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255,255,255,0.1)',
                            color: rule.commodity_status === 'CLOSED' ? 'var(--color-red-light)' : (rule.commodity_status === 'OPEN' && rule.commodity_start_time === '17:00') ? '#fef08a' : rule.commodity_status === 'OPEN' ? 'var(--color-green-light)' : 'var(--text-secondary)'
                          }}>
                            MCX:{rule.commodity_status === 'OPEN' && rule.commodity_start_time === '17:00' ? 'EVE' : rule.commodity_status === 'CLOSED' ? 'OFF' : 'ON'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '9px', color: isWeekend ? 'rgba(255,255,255,0.25)' : 'var(--text-secondary)', fontStyle: 'italic' }}>
                        {isWeekend ? '🔒 Weekend' : '⚡ Regular'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List View of Scheduled Rules */
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)' }}>Configured Calendar Rules & Holidays ({filteredRules.length})</h4>
            </div>
            <input
              type="text"
              placeholder="Search by date or reason..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', color: '#fff', width: '220px' }}
            />
          </div>

          {filteredRules.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              No custom rules match your filter. Click "✨ Import 2026 Official Exchange Holidays" or select a date on the month grid.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredRules.map(rule => {
                const dt = new Date(rule.date);
                const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dt.getDay()];
                return (
                  <div
                    key={rule.date}
                    onClick={() => handleOpenEdit(rule.date)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      cursor: 'pointer',
                      flexWrap: 'wrap',
                      gap: '10px',
                      transition: 'border-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{rule.date}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{dayName}</span>
                      </div>
                      {rule.reason && (
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#c084fc', background: 'rgba(192, 132, 252, 0.1)', padding: '3px 8px', borderRadius: '5px' }}>
                          ⭐ {rule.reason}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: rule.equity_status === 'CLOSED' ? 'rgba(239, 68, 68, 0.2)' : rule.equity_status === 'OPEN' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)',
                        color: rule.equity_status === 'CLOSED' ? 'var(--color-red-light)' : rule.equity_status === 'OPEN' ? 'var(--color-green-light)' : 'var(--text-secondary)'
                      }}>
                        NSE: {rule.equity_status} {rule.equity_status === 'OPEN' ? `(${rule.equity_start_time || '09:15'}-${rule.equity_end_time || '15:30'})` : ''}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: rule.commodity_status === 'CLOSED' ? 'rgba(239, 68, 68, 0.2)' : (rule.commodity_status === 'OPEN' && rule.commodity_start_time === '17:00') ? 'rgba(234, 179, 8, 0.2)' : rule.commodity_status === 'OPEN' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)',
                        color: rule.commodity_status === 'CLOSED' ? 'var(--color-red-light)' : (rule.commodity_status === 'OPEN' && rule.commodity_start_time === '17:00') ? '#fef08a' : rule.commodity_status === 'OPEN' ? 'var(--color-green-light)' : 'var(--text-secondary)'
                      }}>
                        MCX: {rule.commodity_status === 'OPEN' && rule.commodity_start_time === '17:00' ? 'EVENING (17:00-23:30)' : rule.commodity_status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Date Edit Modal */}
      {editModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 3px 0', fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} style={{ color: 'var(--color-blue)' }} />
                  Configure Trading Schedule
                </h3>
                <div style={{ fontSize: '13px', color: 'var(--color-blue-light)', fontWeight: '600' }}>
                  📅 {editForm.date} ({new Date(editForm.date).toLocaleDateString('en-US', { weekday: 'long' })})
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Preset Buttons */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                QUICK 1-CLICK PRESETS:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => applyPreset('HOLIDAY_ALL')}
                  style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-red-light)', border: '1px solid rgba(239,68,68,0.3)', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                >
                  🔴 Full Market Holiday
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('MCX_EVENING_ONLY')}
                  style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#fef08a', border: '1px solid rgba(234,179,8,0.3)', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                >
                  🌙 MCX Evening Only (5 PM - 11:30 PM)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('MUHURAT')}
                  style={{ background: 'rgba(192, 132, 252, 0.15)', color: '#c084fc', border: '1px solid rgba(192,132,252,0.3)', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                >
                  🪔 Diwali Muhurat Session
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('WEEKEND_SPECIAL')}
                  style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--color-green-light)', border: '1px solid rgba(34,197,94,0.3)', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                >
                  ⚡ Saturday Live Session
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('RESET_DEFAULT')}
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                >
                  🔄 Auto Default
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveRule} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Reason / Title */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Holiday / Session Name or Reason:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Diwali Muhurat Trading, Mahashivratri, Special DR Session"
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              {/* Segment 1: NSE / BSE Equities */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  📈 NSE / BSE Equities & Derivatives:
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={editForm.equity_status}
                    onChange={(e) => setEditForm({ ...editForm, equity_status: e.target.value })}
                    style={{ flex: 1, minWidth: '180px', background: 'rgba(0,0,0,0.35)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', fontSize: '12px', fontWeight: '600' }}
                  >
                    <option value="DEFAULT">DEFAULT (Mon-Fri Scheduled, Weekend Closed)</option>
                    <option value="OPEN">OPEN (Special Trading Session)</option>
                    <option value="CLOSED">CLOSED (Market Holiday / Halt)</option>
                  </select>

                  {editForm.equity_status === 'OPEN' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="time"
                        value={editForm.equity_start_time}
                        onChange={(e) => setEditForm({ ...editForm, equity_start_time: e.target.value })}
                        style={{ background: 'rgba(0,0,0,0.35)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 8px', fontSize: '12px' }}
                      />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>to</span>
                      <input
                        type="time"
                        value={editForm.equity_end_time}
                        onChange={(e) => setEditForm({ ...editForm, equity_end_time: e.target.value })}
                        style={{ background: 'rgba(0,0,0,0.35)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 8px', fontSize: '12px' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Segment 2: MCX Commodities */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  🛢️ MCX Commodities:
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={editForm.commodity_status}
                    onChange={(e) => setEditForm({ ...editForm, commodity_status: e.target.value })}
                    style={{ flex: 1, minWidth: '180px', background: 'rgba(0,0,0,0.35)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', fontSize: '12px', fontWeight: '600' }}
                  >
                    <option value="DEFAULT">DEFAULT (Mon-Fri Scheduled, Weekend Closed)</option>
                    <option value="OPEN">OPEN (Active Session / Custom Hours)</option>
                    <option value="CLOSED">CLOSED (Market Holiday / Halt)</option>
                  </select>

                  {editForm.commodity_status === 'OPEN' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="time"
                        value={editForm.commodity_start_time}
                        onChange={(e) => setEditForm({ ...editForm, commodity_start_time: e.target.value })}
                        style={{ background: 'rgba(0,0,0,0.35)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 8px', fontSize: '12px' }}
                      />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>to</span>
                      <input
                        type="time"
                        value={editForm.commodity_end_time}
                        onChange={(e) => setEditForm({ ...editForm, commodity_end_time: e.target.value })}
                        style={{ background: 'rgba(0,0,0,0.35)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 8px', fontSize: '12px' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', gap: '10px' }}>
                {calendarMap[editForm.date] ? (
                  <button
                    type="button"
                    onClick={handleDeleteRule}
                    disabled={actionLoading}
                    style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-red-light)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Reset to Default
                  </button>
                ) : <div />}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border-color)', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    style={{ background: 'var(--color-blue)', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: actionLoading ? 'not-allowed' : 'pointer' }}
                  >
                    {actionLoading ? 'Saving...' : '💾 Save Schedule Rule'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { fetchAdminTelemetry, resetAdminTelemetry, adminTelemetry, fetchAdminUsers, updateUserBalance, fetchDepositRequests, processDeposit, fetchAdminAnalytics, fetchAdminOrders, fetchAdminPositions, fetchAdminLedger, forceCloseUserPosition, adminResetUser, adminDeleteUser, updateUserDetails , toggleUserBan, announcement, setAdminAnnouncement, bannedEntities, fetchBannedEntities, banEntity, unbanEntity, marketStatus, fetchMarketStatus, updateMarketStatus, fetchFyersStatus, fetchAdminWithdrawals, processAdminWithdrawal } = useStore(useShallow(state => ({ fetchAdminTelemetry: state.fetchAdminTelemetry, resetAdminTelemetry: state.resetAdminTelemetry, adminTelemetry: state.adminTelemetry, toggleUserBan: state.toggleUserBan, fetchAdminUsers: state.fetchAdminUsers, updateUserBalance: state.updateUserBalance, fetchDepositRequests: state.fetchDepositRequests, processDeposit: state.processDeposit, fetchAdminAnalytics: state.fetchAdminAnalytics, fetchAdminOrders: state.fetchAdminOrders, fetchAdminPositions: state.fetchAdminPositions, fetchAdminLedger: state.fetchAdminLedger, forceCloseUserPosition: state.forceCloseUserPosition, adminResetUser: state.adminResetUser, adminDeleteUser: state.adminDeleteUser, updateUserDetails: state.updateUserDetails, announcement: state.announcement, setAdminAnnouncement: state.setAdminAnnouncement, bannedEntities: state.bannedEntities, fetchBannedEntities: state.fetchBannedEntities, banEntity: state.banEntity, unbanEntity: state.unbanEntity, marketStatus: state.marketStatus, fetchMarketStatus: state.fetchMarketStatus, updateMarketStatus: state.updateMarketStatus, fetchFyersStatus: state.fetchFyersStatus, fetchAdminWithdrawals: state.fetchAdminWithdrawals, processAdminWithdrawal: state.processAdminWithdrawal })));
  
  const [fyersStatus, setFyersStatus] = useState(null);
  const [fyersLoading, setFyersLoading] = useState(true);
  const [marketUpdating, setMarketUpdating] = useState(false);
  const isMarketOpenNow = isMarketHours();

  useEffect(() => {
    fetchMarketStatus?.();
    const checkFyers = async () => {
      try {
        const data = await fetchFyersStatus?.();
        if (data) setFyersStatus(data);
      } catch (e) {}
      finally { setFyersLoading(false); }
    };
    checkFyers();
    const interval = setInterval(checkFyers, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fyers Auto-Login States
  const [showAutoLoginModal, setShowAutoLoginModal] = useState(false);
  const [autoLoginLoading, setAutoLoginLoading] = useState(false);
  const [autoLoginStatus, setAutoLoginStatus] = useState(null);
  const [fyersUserId, setFyersUserId] = useState('');
  const [fyersPin, setFyersPin] = useState('');
  const [fyersTotpKey, setFyersTotpKey] = useState('');
  const [hasSavedPin, setHasSavedPin] = useState(false);
  const [hasSavedTotpKey, setHasSavedTotpKey] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showTotpKey, setShowTotpKey] = useState(false);

  const fetchFyersCredentials = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/fyers/credentials`, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data.success) {
        if (data.fyers_user_id) setFyersUserId(data.fyers_user_id);
        setHasSavedPin(!!data.has_pin);
        setHasSavedTotpKey(!!data.has_totp_key);
      }
    } catch (e) {
      console.error('Failed to load Fyers credentials', e);
    }
  };

  useEffect(() => {
    fetchFyersCredentials();
  }, []);

  const handleSaveAndAutoLogin = async (e) => {
    if (e) e.preventDefault();
    if (!fyersUserId) {
      alert('Please enter your Fyers User ID (e.g. XF01234)');
      return;
    }
    if (!fyersPin && !hasSavedPin) {
      alert('Please enter your Fyers 4-digit PIN');
      return;
    }
    if (!fyersTotpKey && !hasSavedTotpKey) {
      alert('Please enter your Fyers TOTP Authenticator Key');
      return;
    }
    setAutoLoginLoading(true);
    setAutoLoginStatus(null);
    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/fyers/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          fyers_user_id: fyersUserId.trim(),
          fyers_pin: fyersPin ? fyersPin.trim() : undefined,
          fyers_totp_key: fyersTotpKey ? fyersTotpKey.trim() : undefined
        })
      });
      const data = await res.json();
      if (data.success && data.loginResult?.success) {
        setAutoLoginStatus({ type: 'success', message: '✅ Credentials saved & Fyers Auto-Login succeeded! Fresh token generated and active.' });
        fetchFyersCredentials();
        fetchFyersStatus?.();
        setTimeout(() => setShowAutoLoginModal(false), 2200);
      } else {
        const err = data.loginResult?.error || data.error || 'Auto-login failed. Please verify your User ID, PIN, and TOTP key.';
        setAutoLoginStatus({ type: 'error', message: `❌ Login failed: ${err}` });
      }
    } catch (err) {
      setAutoLoginStatus({ type: 'error', message: 'Error: ' + err.message });
    } finally {
      setAutoLoginLoading(false);
    }
  };

  const handleTriggerAutoLogin = async () => {
    setAutoLoginLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/fyers/auto-login`, {
        method: 'POST',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Automated Fyers Login Successful!\nFresh access token generated and loaded across all cluster processes.');
        fetchFyersStatus?.();
      } else {
        alert('❌ Auto-Login Failed: ' + (data.error || 'Unknown error') + '\n\nPlease open "Setup Auto-Login" to configure your User ID, PIN, and TOTP key.');
        setShowAutoLoginModal(true);
      }
    } catch (err) {
      alert('Error triggering auto-login: ' + err.message);
    } finally {
      setAutoLoginLoading(false);
    }
  };

  const [manualBanType, setManualBanType] = useState('IP');
  const [manualBanValue, setManualBanValue] = useState('');
  const [manualBanReason, setManualBanReason] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const [activeTab, setActiveTab] = useState('analytics');
  const [telemetryTimeframe, setTelemetryTimeframe] = useState('all');
  const [isLiveTelemetry, setIsLiveTelemetry] = useState(true);
  const [apmSearch, setApmSearch] = useState('');
  const [apmMethod, setApmMethod] = useState('ALL'); // 'ALL' | 'GET' | 'POST' | 'SLOW'
  const [apmSort, setApmSort] = useState('bandwidth'); // 'bandwidth' | 'hits' | 'latency' | 'fastest'
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState('ALL'); // 'ALL' | 'ACTIVE_ONLY' | 'DELETED_ONLY' | 'HEAVY'
  const [userSort, setUserSort] = useState('bandwidth'); // 'bandwidth' | 'calls' | 'market_time'

  const filteredApm = useMemo(() => {
    let list = adminTelemetry?.api || [];
    if (apmSearch.trim()) {
      const q = apmSearch.toLowerCase().trim();
      list = list.filter(r => r.route && r.route.toLowerCase().includes(q));
    }
    if (apmMethod === 'GET') {
      list = list.filter(r => r.route && (r.route.startsWith('GET') || r.route.includes('GET')));
    } else if (apmMethod === 'POST') {
      list = list.filter(r => r.route && (r.route.startsWith('POST') || r.route.startsWith('PUT') || r.route.startsWith('DELETE') || r.route.includes('POST')));
    } else if (apmMethod === 'SLOW') {
      list = list.filter(r => {
        const avgLat = r.count > 0 ? (r.totalTime / r.count) : 0;
        return avgLat >= 100;
      });
    }
    return [...list].sort((a, b) => {
      const avgLatA = a.count > 0 ? a.totalTime / a.count : 0;
      const avgLatB = b.count > 0 ? b.totalTime / b.count : 0;
      if (apmSort === 'bandwidth') return (b.totalBytes || 0) - (a.totalBytes || 0);
      if (apmSort === 'hits') return (b.count || 0) - (a.count || 0);
      if (apmSort === 'latency') return avgLatB - avgLatA;
      if (apmSort === 'fastest') return avgLatA - avgLatB;
      return (b.totalTime || 0) - (a.totalTime || 0);
    });
  }, [adminTelemetry?.api, apmSearch, apmMethod, apmSort]);

  const filteredUsers = useMemo(() => {
    let list = adminTelemetry?.users || [];
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase().trim();
      list = list.filter(u => 
        (u.clientId && u.clientId.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) || 
        String(u.userId || '').toLowerCase().includes(q)
      );
    }
    if (userFilter === 'ACTIVE_ONLY') {
      list = list.filter(u => !String(u.username || '').includes('Deleted') && !String(u.username || '').includes('Anonymous') && u.userId !== 'unknown');
    } else if (userFilter === 'DELETED_ONLY') {
      list = list.filter(u => String(u.username || '').includes('Deleted') || String(u.username || '').includes('Anonymous') || u.userId === 'unknown');
    } else if (userFilter === 'HEAVY') {
      list = list.filter(u => (u.apiCalls || 0) >= 500 || (u.apiBytes || 0) >= 1048576);
    }
    return [...list].sort((a, b) => {
      if (userSort === 'bandwidth') return (b.apiBytes || 0) - (a.apiBytes || 0);
      if (userSort === 'calls') return (b.apiCalls || 0) - (a.apiCalls || 0);
      if (userSort === 'market_time') return (b.wsMinutes || 0) - (a.wsMinutes || 0);
      return (b.apiBytes || 0) - (a.apiBytes || 0);
    });
  }, [adminTelemetry?.users, userSearch, userFilter, userSort]);
  const [announcementInput, setAnnouncementInput] = useState('');
  const [announcementType, setAnnouncementType] = useState('info');
  const [exporting, setExporting] = useState(false);

  // Client Management State & Date Filters
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [usersDatePreset, setUsersDatePreset] = useState('all');
  const [usersCustomStart, setUsersCustomStart] = useState('');
  const [usersCustomEnd, setUsersCustomEnd] = useState('');

  // Order Flow State & Date Filters
  const [orders, setOrders] = useState([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotalPages, setOrdersTotalPages] = useState(1);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersDatePreset, setOrdersDatePreset] = useState('all');
  const [ordersCustomStart, setOrdersCustomStart] = useState('');
  const [ordersCustomEnd, setOrdersCustomEnd] = useState('');

  // Live Positions State & Date Filters
  const [positions, setPositions] = useState([]);
  const [positionsPage, setPositionsPage] = useState(1);
  const [positionsTotalPages, setPositionsTotalPages] = useState(1);
  const [positionsTotal, setPositionsTotal] = useState(0);
  const [positionsDatePreset, setPositionsDatePreset] = useState('all');
  const [positionsCustomStart, setPositionsCustomStart] = useState('');
  const [positionsCustomEnd, setPositionsCustomEnd] = useState('');

  // Platform Ledger State & Date Filters
  const [ledger, setLedger] = useState([]);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerDatePreset, setLedgerDatePreset] = useState('all');
  const [ledgerCustomStart, setLedgerCustomStart] = useState('');
  const [ledgerCustomEnd, setLedgerCustomEnd] = useState('');

  // Deposit Requests State & Date Filters
  const [deposits, setDeposits] = useState([]);
  const [depositsPage, setDepositsPage] = useState(1);
  const [depositsTotalPages, setDepositsTotalPages] = useState(1);
  const [depositsTotal, setDepositsTotal] = useState(0);
  const [depositsDatePreset, setDepositsDatePreset] = useState('all');
  const [depositsCustomStart, setDepositsCustomStart] = useState('');
  const [depositsCustomEnd, setDepositsCustomEnd] = useState('');

  // Withdrawal Requests State & Date Filters
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalsPage, setWithdrawalsPage] = useState(1);
  const [withdrawalsTotalPages, setWithdrawalsTotalPages] = useState(1);
  const [withdrawalsTotal, setWithdrawalsTotal] = useState(0);
  const [withdrawalsDatePreset, setWithdrawalsDatePreset] = useState('all');
  const [withdrawalsCustomStart, setWithdrawalsCustomStart] = useState('');
  const [withdrawalsCustomEnd, setWithdrawalsCustomEnd] = useState('');

  const [analytics, setAnalytics] = useState(null);

  // Client Management Filters & Sorting
  const [clientSearch, setClientSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'BANNED' | 'PRO' | 'KYC_VERIFIED' | 'KYC_MISSING' | 'SHARED_IP'
  const [clientSort, setClientSort] = useState('balance_desc'); // 'balance_desc' | 'balance_asc' | 'name_asc' | 'newest'

  const filteredClients = useMemo(() => {
    let list = users || [];
    if (clientSearch.trim()) {
      const q = clientSearch.toLowerCase().trim();
      list = list.filter(u => 
        (u.client_id && u.client_id.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.toLowerCase().includes(q)) ||
        (u.last_ip && u.last_ip.toLowerCase().includes(q)) ||
        String(u.id).includes(q)
      );
    }
    if (clientFilter === 'ACTIVE') {
      list = list.filter(u => !u.is_banned);
    } else if (clientFilter === 'BANNED') {
      list = list.filter(u => u.is_banned);
    } else if (clientFilter === 'PRO') {
      list = list.filter(u => u.subscription_tier === 'PRO');
    } else if (clientFilter === 'KYC_VERIFIED') {
      list = list.filter(u => u.kyc_pan_url && u.kyc_aadhar_url);
    } else if (clientFilter === 'KYC_MISSING') {
      list = list.filter(u => !u.kyc_pan_url || !u.kyc_aadhar_url);
    } else if (clientFilter === 'SHARED_IP') {
      list = list.filter(u => (u.shared_ip_count || 0) > 1);
    }
    return [...list].sort((a, b) => {
      if (clientSort === 'balance_desc') return (Number(b.balance) || 0) - (Number(a.balance) || 0);
      if (clientSort === 'balance_asc') return (Number(a.balance) || 0) - (Number(b.balance) || 0);
      if (clientSort === 'name_asc') return (a.username || '').localeCompare(b.username || '');
      if (clientSort === 'newest') return (b.id || 0) - (a.id || 0);
      return 0;
    });
  }, [users, clientSearch, clientFilter, clientSort]);

  // Withdrawal Requests Filters & Sorting
  const [withdrawalSearch, setWithdrawalSearch] = useState('');
  const [withdrawalFilter, setWithdrawalFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'PROCESSING' | 'CREDITED' | 'REJECTED' | 'SHARED_IP'
  const [withdrawalSort, setWithdrawalSort] = useState('date_desc'); // 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'

  const filteredWithdrawals = useMemo(() => {
    let list = withdrawals || [];
    if (withdrawalSearch.trim()) {
      const q = withdrawalSearch.toLowerCase().trim();
      list = list.filter(w => 
        (w.client_id && w.client_id.toLowerCase().includes(q)) ||
        (w.username && w.username.toLowerCase().includes(q)) ||
        (w.phone && w.phone.toLowerCase().includes(q)) ||
        (w.upi_id && w.upi_id.toLowerCase().includes(q)) ||
        (w.bank_account_no && w.bank_account_no.toLowerCase().includes(q)) ||
        (w.bank_ifsc && w.bank_ifsc.toLowerCase().includes(q)) ||
        String(w.amount).includes(q)
      );
    }
    if (withdrawalFilter === 'PENDING') {
      list = list.filter(w => w.status === 'PENDING');
    } else if (withdrawalFilter === 'PROCESSING') {
      list = list.filter(w => w.status === 'PROCESSING');
    } else if (withdrawalFilter === 'CREDITED') {
      list = list.filter(w => w.status === 'CREDITED' || w.status === 'APPROVED');
    } else if (withdrawalFilter === 'REJECTED') {
      list = list.filter(w => w.status === 'REJECTED');
    } else if (withdrawalFilter === 'SHARED_IP') {
      list = list.filter(w => (w.shared_ip_count || 0) > 1);
    }
    return [...list].sort((a, b) => {
      if (withdrawalSort === 'date_desc') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (withdrawalSort === 'date_asc') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      if (withdrawalSort === 'amount_desc') return (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0);
      if (withdrawalSort === 'amount_asc') return (parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0);
      return 0;
    });
  }, [withdrawals, withdrawalSearch, withdrawalFilter, withdrawalSort]);

  // Deposit Requests Filters & Sorting
  const [depositSearch, setDepositSearch] = useState('');
  const [depositFilter, setDepositFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'
  const [depositSort, setDepositSort] = useState('date_desc'); // 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'

  const filteredDeposits = useMemo(() => {
    let list = deposits || [];
    if (depositSearch.trim()) {
      const q = depositSearch.toLowerCase().trim();
      list = list.filter(d => 
        (d.client_id && d.client_id.toLowerCase().includes(q)) ||
        (d.username && d.username.toLowerCase().includes(q)) ||
        (d.email && d.email.toLowerCase().includes(q)) ||
        String(d.amount).includes(q)
      );
    }
    if (depositFilter === 'PENDING') {
      list = list.filter(d => d.status === 'PENDING');
    } else if (depositFilter === 'APPROVED') {
      list = list.filter(d => d.status === 'APPROVED');
    } else if (depositFilter === 'REJECTED') {
      list = list.filter(d => d.status === 'REJECTED');
    }
    return [...list].sort((a, b) => {
      if (depositSort === 'date_desc') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (depositSort === 'date_asc') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      if (depositSort === 'amount_desc') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      if (depositSort === 'amount_asc') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
      return 0;
    });
  }, [deposits, depositSearch, depositFilter, depositSort]);

  // Order Flow Filters & Sorting
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('ALL'); // 'ALL' | 'EXECUTED' | 'REJECTED' | 'PENDING' | 'BUY' | 'SELL'
  const [orderSort, setOrderSort] = useState('date_desc'); // 'date_desc' | 'date_asc' | 'value_desc'

  const filteredOrders = useMemo(() => {
    let list = orders || [];
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase().trim();
      list = list.filter(o => 
        (o.client_id && o.client_id.toLowerCase().includes(q)) ||
        (o.username && o.username.toLowerCase().includes(q)) ||
        (o.symbol && o.symbol.toLowerCase().includes(q)) ||
        String(o.id).includes(q)
      );
    }
    if (orderFilter === 'EXECUTED') {
      list = list.filter(o => o.status === 'EXECUTED');
    } else if (orderFilter === 'REJECTED') {
      list = list.filter(o => o.status === 'REJECTED');
    } else if (orderFilter === 'PENDING') {
      list = list.filter(o => o.status === 'PENDING' || o.status === 'OPEN');
    } else if (orderFilter === 'BUY') {
      list = list.filter(o => o.side === 'BUY');
    } else if (orderFilter === 'SELL') {
      list = list.filter(o => o.side === 'SELL');
    }
    return [...list].sort((a, b) => {
      if (orderSort === 'date_desc') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (orderSort === 'date_asc') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      if (orderSort === 'value_desc') {
        const valA = (a.quantity || 0) * (Number(a.average_price || a.price) || 0);
        const valB = (b.quantity || 0) * (Number(b.average_price || b.price) || 0);
        return valB - valA;
      }
      return 0;
    });
  }, [orders, orderSearch, orderFilter, orderSort]);

  // Live Positions Filters & Sorting
  const [positionSearch, setPositionSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL'); // 'ALL' | 'LONG' | 'SHORT'
  const [positionSort, setPositionSort] = useState('qty_desc'); // 'qty_desc' | 'symbol_asc' | 'client_asc'

  const filteredPositions = useMemo(() => {
    let list = positions || [];
    if (positionSearch.trim()) {
      const q = positionSearch.toLowerCase().trim();
      list = list.filter(p => 
        (p.client_id && p.client_id.toLowerCase().includes(q)) ||
        (p.username && p.username.toLowerCase().includes(q)) ||
        (p.symbol && p.symbol.toLowerCase().includes(q))
      );
    }
    if (positionFilter === 'LONG') {
      list = list.filter(p => p.quantity > 0);
    } else if (positionFilter === 'SHORT') {
      list = list.filter(p => p.quantity < 0);
    }
    return [...list].sort((a, b) => {
      if (positionSort === 'qty_desc') return Math.abs(b.quantity || 0) - Math.abs(a.quantity || 0);
      if (positionSort === 'symbol_asc') return (a.symbol || '').localeCompare(b.symbol || '');
      if (positionSort === 'client_asc') return (a.username || '').localeCompare(b.username || '');
      return 0;
    });
  }, [positions, positionSearch, positionFilter, positionSort]);

  // Platform Ledger Filters & Sorting
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState('ALL'); // 'ALL' | 'CREDIT' | 'DEBIT'
  const [ledgerSort, setLedgerSort] = useState('date_desc'); // 'date_desc' | 'amount_desc'

  const filteredLedger = useMemo(() => {
    let list = ledger || [];
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.toLowerCase().trim();
      list = list.filter(l => 
        (l.client_id && l.client_id.toLowerCase().includes(q)) ||
        (l.username && l.username.toLowerCase().includes(q)) ||
        (l.description && l.description.toLowerCase().includes(q)) ||
        (l.type && l.type.toLowerCase().includes(q))
      );
    }
    if (ledgerFilter === 'CREDIT') {
      list = list.filter(l => l.amount >= 0);
    } else if (ledgerFilter === 'DEBIT') {
      list = list.filter(l => l.amount < 0);
    }
    return [...list].sort((a, b) => {
      if (ledgerSort === 'date_desc') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (ledgerSort === 'amount_desc') return Math.abs(b.amount || 0) - Math.abs(a.amount || 0);
      return 0;
    });
  }, [ledger, ledgerSearch, ledgerFilter, ledgerSort]);

  const handleMasterSquareOff = async () => {
    if (window.confirm('⚠️ WARNING: This will immediately close ALL open positions for ALL users at MARKET price. Are you sure you want to execute a Master Square-Off?')) {
      try {
        const API_URL = import.meta.env.VITE_API_URL || '';
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/admin/master_square_off`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        const data = await res.json();
        if (data.success) {
          alert('Master Square-Off initiated! Positions are being closed in the background.');
          loadData();
        } else {
          alert(data.error || 'Failed to initiate Master Square-Off');
        }
      } catch (e) {
        alert(e.message);
      }
    }
  };

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedClientSearch, setDebouncedClientSearch] = useState('');
  
  // Debounce searches
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedClientSearch(clientSearch || search);
      setPage(1); // reset to page 1 on search
    }, 400);
    return () => clearTimeout(timer);
  }, [clientSearch, search]);

  const [debouncedOrderSearch, setDebouncedOrderSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOrderSearch(orderSearch);
      setOrdersPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [orderSearch]);

  const [debouncedPositionSearch, setDebouncedPositionSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPositionSearch(positionSearch);
      setPositionsPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [positionSearch]);

  const [debouncedLedgerSearch, setDebouncedLedgerSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLedgerSearch(ledgerSearch);
      setLedgerPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [ledgerSearch]);

  const [debouncedDepositSearch, setDebouncedDepositSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedDepositSearch(depositSearch);
      setDepositsPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [depositSearch]);

  const [debouncedWithdrawalSearch, setDebouncedWithdrawalSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedWithdrawalSearch(withdrawalSearch);
      setWithdrawalsPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [withdrawalSearch]);

  // Live 5-second polling for Resource Telemetry tab
  useEffect(() => {
    if (activeTab !== 'telemetry' || !isLiveTelemetry) return;
    const interval = setInterval(() => {
      fetchAdminTelemetry?.(telemetryTimeframe);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab, isLiveTelemetry, telemetryTimeframe]);

  // Modal state
  const [selectedUser, setSelectedUser] = useState(null);
  const [newBalance, setNewBalance] = useState('');
  const [newSubTier, setNewSubTier] = useState('BASIC');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const { startDate, endDate } = calculateDateBounds(usersDatePreset, usersCustomStart, usersCustomEnd);
        const res = await fetchAdminUsers?.(page, 50, debouncedClientSearch, startDate, endDate);
        if (res?.success) {
          setUsers(res.users || []);
          setTotalPages(res.totalPages || 1);
        }
      } else if (activeTab === 'security') {
        await fetchBannedEntities?.();
      } else if (activeTab === 'telemetry') {
        await fetchAdminTelemetry?.(telemetryTimeframe);
      } else if (activeTab === 'withdrawals') {
        const { startDate, endDate } = calculateDateBounds(withdrawalsDatePreset, withdrawalsCustomStart, withdrawalsCustomEnd);
        const res = await fetchAdminWithdrawals?.(withdrawalsPage, 50, debouncedWithdrawalSearch, startDate, endDate);
        if (res?.success) {
          setWithdrawals(res.withdrawals || []);
          setWithdrawalsTotalPages(res.totalPages || 1);
          setWithdrawalsTotal(res.total || (res.withdrawals || []).length);
        }
      } else if (activeTab === 'deposits') {
        const { startDate, endDate } = calculateDateBounds(depositsDatePreset, depositsCustomStart, depositsCustomEnd);
        const res = await fetchDepositRequests?.(depositsPage, 50, debouncedDepositSearch, startDate, endDate);
        if (res?.success) {
          setDeposits(res.deposits || []);
          setDepositsTotalPages(res.totalPages || 1);
          setDepositsTotal(res.total || (res.deposits || []).length);
        }
      } else if (activeTab === 'analytics') {
        const res = await fetchAdminAnalytics?.();
        if (res?.success) setAnalytics(res.data);
      } else if (activeTab === 'orders') {
        const { startDate, endDate } = calculateDateBounds(ordersDatePreset, ordersCustomStart, ordersCustomEnd);
        const res = await fetchAdminOrders?.(ordersPage, 50, debouncedOrderSearch, startDate, endDate);
        if (res?.success) {
          setOrders(res.orders || []);
          setOrdersTotalPages(res.totalPages || 1);
          setOrdersTotal(res.total || (res.orders || []).length);
        }
      } else if (activeTab === 'positions') {
        const { startDate, endDate } = calculateDateBounds(positionsDatePreset, positionsCustomStart, positionsCustomEnd);
        const res = await fetchAdminPositions?.(positionsPage, 50, debouncedPositionSearch, startDate, endDate);
        if (res?.success) {
          setPositions(res.positions || []);
          setPositionsTotalPages(res.totalPages || 1);
          setPositionsTotal(res.total || (res.positions || []).length);
        }
      } else if (activeTab === 'ledger') {
        const { startDate, endDate } = calculateDateBounds(ledgerDatePreset, ledgerCustomStart, ledgerCustomEnd);
        const res = await fetchAdminLedger?.(ledgerPage, 50, debouncedLedgerSearch, startDate, endDate);
        if (res?.success) {
          setLedger(res.ledger || []);
          setLedgerTotalPages(res.totalPages || 1);
          setLedgerTotal(res.total || (res.ledger || []).length);
        }
      }
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    activeTab, 
    page, debouncedClientSearch, usersDatePreset, usersCustomStart, usersCustomEnd,
    ordersPage, debouncedOrderSearch, ordersDatePreset, ordersCustomStart, ordersCustomEnd,
    positionsPage, debouncedPositionSearch, positionsDatePreset, positionsCustomStart, positionsCustomEnd,
    ledgerPage, debouncedLedgerSearch, ledgerDatePreset, ledgerCustomStart, ledgerCustomEnd,
    depositsPage, debouncedDepositSearch, depositsDatePreset, depositsCustomStart, depositsCustomEnd,
    withdrawalsPage, debouncedWithdrawalSearch, withdrawalsDatePreset, withdrawalsCustomStart, withdrawalsCustomEnd
  ]);

  // --- Export Handlers ---
  const handleExportUsers = async (format) => {
    setExporting(true);
    try {
      const { startDate, endDate } = calculateDateBounds(usersDatePreset, usersCustomStart, usersCustomEnd);
      const res = await fetchAdminUsers?.(1, 10000, debouncedClientSearch, startDate, endDate, true);
      const exportData = res?.users || users || [];
      const cols = [
        { header: 'User ID', key: 'id' },
        { header: 'Client ID', key: 'client_id' },
        { header: 'Username', key: 'username' },
        { header: 'Email', key: 'email' },
        { header: 'Phone', key: 'phone' },
        { header: 'Wallet Balance (₹)', key: 'balance', format: b => `₹${Number(b || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, align: 'right' },
        { header: 'Plan', key: 'subscription_tier' },
        { header: 'Status', key: 'is_banned', format: b => b ? 'BANNED' : 'ACTIVE' },
        { header: 'Registration IP', key: 'registration_ip' },
        { header: 'Last IP', key: 'last_ip' },
        { header: 'Registered On', key: 'created_at', format: d => d ? new Date(d).toLocaleString('en-IN') : '-' }
      ];
      const subtitle = `Filter: ${usersDatePreset.toUpperCase()}${debouncedClientSearch ? ` | Search: "${debouncedClientSearch}"` : ''}`;
      if (format === 'excel') exportToExcel(exportData, cols, 'client_management_export', 'Client Accounts Roster');
      else exportToPDF(exportData, cols, 'client_management_report', 'Client Accounts Roster', subtitle);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPositions = async (format) => {
    setExporting(true);
    try {
      const { startDate, endDate } = calculateDateBounds(positionsDatePreset, positionsCustomStart, positionsCustomEnd);
      const res = await fetchAdminPositions?.(1, 10000, debouncedPositionSearch, startDate, endDate, true);
      const exportData = res?.positions || positions || [];
      const cols = [
        { header: 'Client ID', key: 'client_id' },
        { header: 'Client Name', key: 'username' },
        { header: 'Symbol', key: 'symbol' },
        { header: 'Product', key: 'product_type' },
        { header: 'Quantity', key: 'quantity', format: q => q > 0 ? `+${q} (LONG)` : `${q} (SHORT)`, align: 'right' },
        { header: 'Buy Price (₹)', key: 'buy_price', format: p => p ? `₹${Number(p).toFixed(2)}` : '-', align: 'right' },
        { header: 'Sell Price (₹)', key: 'sell_price', format: p => p ? `₹${Number(p).toFixed(2)}` : '-', align: 'right' },
        { header: 'Opened At', key: 'created_at', format: d => d ? new Date(d).toLocaleString('en-IN') : '-' }
      ];
      const subtitle = `Filter: ${positionsDatePreset.toUpperCase()}${debouncedPositionSearch ? ` | Search: "${debouncedPositionSearch}"` : ''}`;
      if (format === 'excel') exportToExcel(exportData, cols, 'live_positions_export', 'Live Positions Audit Report');
      else exportToPDF(exportData, cols, 'live_positions_report', 'Live Positions Audit Report', subtitle);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportOrders = async (format) => {
    setExporting(true);
    try {
      const { startDate, endDate } = calculateDateBounds(ordersDatePreset, ordersCustomStart, ordersCustomEnd);
      const res = await fetchAdminOrders?.(1, 10000, debouncedOrderSearch, startDate, endDate, true);
      const exportData = res?.orders || orders || [];
      const cols = [
        { header: 'Order ID', key: 'id' },
        { header: 'Client ID', key: 'client_id' },
        { header: 'Client Name', key: 'username' },
        { header: 'Symbol', key: 'symbol' },
        { header: 'Side', key: 'side' },
        { header: 'Order Type', key: 'order_type' },
        { header: 'Product', key: 'product_type' },
        { header: 'Qty', key: 'quantity', align: 'right' },
        { header: 'Price (₹)', key: 'price', format: p => `₹${Number(p || 0).toFixed(2)}`, align: 'right' },
        { header: 'Avg Price (₹)', key: 'average_price', format: p => p ? `₹${Number(p).toFixed(2)}` : '-', align: 'right' },
        { header: 'Status', key: 'status' },
        { header: 'Remarks', key: 'rejection_reason' },
        { header: 'Timestamp', key: 'created_at', format: d => d ? new Date(d).toLocaleString('en-IN') : '-' }
      ];
      const subtitle = `Filter: ${ordersDatePreset.toUpperCase()}${debouncedOrderSearch ? ` | Search: "${debouncedOrderSearch}"` : ''}`;
      if (format === 'excel') exportToExcel(exportData, cols, 'order_flow_export', 'Order Flow Audit Log');
      else exportToPDF(exportData, cols, 'order_flow_report', 'Order Flow Audit Log', subtitle);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportLedger = async (format) => {
    setExporting(true);
    try {
      const { startDate, endDate } = calculateDateBounds(ledgerDatePreset, ledgerCustomStart, ledgerCustomEnd);
      const res = await fetchAdminLedger?.(1, 10000, debouncedLedgerSearch, startDate, endDate, true);
      const exportData = res?.ledger || ledger || [];
      const cols = [
        { header: 'Entry ID', key: 'id' },
        { header: 'Client ID', key: 'client_id' },
        { header: 'Client Name', key: 'username' },
        { header: 'Type', key: 'type' },
        { header: 'Amount (₹)', key: 'amount', format: a => `${Number(a) >= 0 ? '+' : ''}₹${Number(a || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, align: 'right' },
        { header: 'Balance After (₹)', key: 'balance_after', format: b => b !== undefined && b !== null ? `₹${Number(b).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-', align: 'right' },
        { header: 'Description', key: 'description' },
        { header: 'Timestamp', key: 'created_at', format: d => d ? new Date(d).toLocaleString('en-IN') : '-' }
      ];
      const subtitle = `Filter: ${ledgerDatePreset.toUpperCase()}${debouncedLedgerSearch ? ` | Search: "${debouncedLedgerSearch}"` : ''}`;
      if (format === 'excel') exportToExcel(exportData, cols, 'platform_ledger_export', 'Platform Financial Ledger');
      else exportToPDF(exportData, cols, 'platform_ledger_report', 'Platform Financial Ledger', subtitle);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportDeposits = async (format) => {
    setExporting(true);
    try {
      const { startDate, endDate } = calculateDateBounds(depositsDatePreset, depositsCustomStart, depositsCustomEnd);
      const res = await fetchDepositRequests?.(1, 10000, debouncedDepositSearch, startDate, endDate, true);
      const exportData = res?.deposits || deposits || [];
      const cols = [
        { header: 'Request ID', key: 'id' },
        { header: 'Client ID', key: 'client_id' },
        { header: 'Client Name', key: 'username' },
        { header: 'Email', key: 'email' },
        { header: 'Amount (₹)', key: 'amount', format: a => `₹${Number(a || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, align: 'right' },
        { header: 'UTR / Ref No', key: 'utr_number' },
        { header: 'Status', key: 'status' },
        { header: 'Requested At', key: 'created_at', format: d => d ? new Date(d).toLocaleString('en-IN') : '-' },
        { header: 'Processed At', key: 'updated_at', format: d => d ? new Date(d).toLocaleString('en-IN') : '-' }
      ];
      const subtitle = `Filter: ${depositsDatePreset.toUpperCase()}${debouncedDepositSearch ? ` | Search: "${debouncedDepositSearch}"` : ''}`;
      if (format === 'excel') exportToExcel(exportData, cols, 'deposit_requests_export', 'Deposit Requests Report');
      else exportToPDF(exportData, cols, 'deposit_requests_report', 'Deposit Requests Report', subtitle);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportWithdrawals = async (format) => {
    setExporting(true);
    try {
      const { startDate, endDate } = calculateDateBounds(withdrawalsDatePreset, withdrawalsCustomStart, withdrawalsCustomEnd);
      const res = await fetchAdminWithdrawals?.(1, 10000, debouncedWithdrawalSearch, startDate, endDate, true);
      const exportData = res?.withdrawals || withdrawals || [];
      const cols = [
        { header: 'Withdrawal ID', key: 'id' },
        { header: 'Client ID', key: 'client_id' },
        { header: 'Client Name', key: 'username' },
        { header: 'Phone', key: 'phone' },
        { header: 'Amount (₹)', key: 'amount', format: a => `₹${Number(a || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, align: 'right' },
        { header: 'UPI ID', key: 'upi_id' },
        { header: 'Bank Acc No', key: 'bank_account_no' },
        { header: 'IFSC Code', key: 'bank_ifsc' },
        { header: 'Status', key: 'status' },
        { header: 'Requested At', key: 'created_at', format: d => d ? new Date(d).toLocaleString('en-IN') : '-' },
        { header: 'Processed At', key: 'processed_at', format: d => d ? new Date(d).toLocaleString('en-IN') : '-' }
      ];
      const subtitle = `Filter: ${withdrawalsDatePreset.toUpperCase()}${debouncedWithdrawalSearch ? ` | Search: "${debouncedWithdrawalSearch}"` : ''}`;
      if (format === 'excel') exportToExcel(exportData, cols, 'withdrawals_export', 'Withdrawals Report');
      else exportToPDF(exportData, cols, 'withdrawals_report', 'Withdrawals Report', subtitle);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleUpdateSubscription = async (e) => {
    e.preventDefault();
    if (!selectedUser || !newSubTier) return;
    
    // Set expiry to 1 year from now if PRO, else null
    let expires = null;
    if (newSubTier === 'PRO') {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      expires = d.toISOString();
    }
    
    setUpdating(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/user/${selectedUser.id}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tier: newSubTier, expires })
      });
      const data = await res.json();
      if (data.success) {
        alert('Subscription updated successfully!');
        setUsers(users.map(u => u.id === selectedUser.id ? { ...u, subscription_tier: newSubTier, subscription_expires: expires } : u));
        setSelectedUser({ ...selectedUser, subscription_tier: newSubTier, subscription_expires: expires });
      } else throw new Error(data.error);
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateBalance = async (e) => {
    e.preventDefault();
    if (!selectedUser || !newBalance) return;
    setUpdating(true);
    const res = await updateUserBalance(selectedUser.id, parseFloat(newBalance));
    if (res.success) {
      alert('Balance updated successfully!');
      setSelectedUser(null);
      loadData();
    } else {
      alert(`Error updating balance: ${res.error}`);
    }
    setUpdating(false);
  };

  const handleUpdateDetails = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setUpdating(true);
    const res = await updateUserDetails(selectedUser.id, {
      username: newUsername,
      email: newEmail,
      phone: newPhone
    });
    if (res.success) {
      alert('Client details updated successfully!');
      setSelectedUser(null);
      loadData();
    } else {
      alert(`Error updating details: ${res.error}`);
    }
    setUpdating(false);
  };

  const handleResetUser = async () => {
    if (!selectedUser) return;
    if (window.confirm(`Are you absolutely sure you want to reset ${selectedUser.username}'s account? This will permanently delete ALL their trades, positions, and reset their balance to ₹10,00,000. This CANNOT be undone.`)) {
      setUpdating(true);
      const res = await adminResetUser(selectedUser.id);
      if (res.success) {
        alert(`${selectedUser.username}'s account successfully reset to ₹10,00,000!`);
        loadData();
        setSelectedUser(null);
      } else {
        alert(res.error || 'Failed to reset user account');
      }
      setUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    const confirmation = window.prompt(
      `⚠️ PERMANENT DELETE ⚠️\n\nThis will PERMANENTLY delete ${selectedUser.username}'s account and ALL their data (orders, positions, holdings, ledger, deposits).\n\nThis CANNOT be undone!\n\nType the username "${selectedUser.username}" to confirm:`
    );
    if (confirmation !== selectedUser.username) {
      if (confirmation !== null) alert('Username did not match. Deletion cancelled.');
      return;
    }
    setUpdating(true);
    const res = await adminDeleteUser(selectedUser.id);
    if (res.success) {
      alert(`✅ ${selectedUser.username}'s account has been permanently deleted.`);
      loadData();
      setSelectedUser(null);
    } else {
      alert(res.error || 'Failed to delete user account');
    }
    setUpdating(false);
  };

  const handleProcessDeposit = async (id, action) => {
    const res = await processDeposit(id, action);
    if (res.success) {
      loadData();
    } else {
      alert(`Error: ${res.error}`);
    }
  };

  const handleForceClose = async (id) => {
    if (!window.confirm("Are you sure you want to force close this position? A market order will be placed to close it.")) return;
    const res = await forceCloseUserPosition(id);
    if (res.success) {
      alert(`Force close order placed (ID: ${res.orderId})`);
      loadData();
    } else {
      alert(`Error: ${res.error}`);
    }
  };

  return (
    <div style={{ padding: isMobile ? '8px' : '10px 18px', display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '10px', height: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', margin: 0, color: '#fff' }}>
            <Shield size={18} style={{ color: 'var(--color-red)' }} />
            Admin Control Center
          </h2>
        
          {/* Fyers Live Status Hint / Badge */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '600',
              background: (fyersStatus?.hasAccessToken && !fyersStatus?.tokenExpired && (fyersStatus?.secondsSinceLastTick < 30 || !isMarketOpenNow))
                ? 'rgba(34, 197, 94, 0.12)' 
                : (fyersStatus?.hasAccessToken && !fyersStatus?.tokenExpired)
                  ? 'rgba(234, 179, 8, 0.12)'
                  : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${
                fyersLoading 
                  ? 'var(--border-color)' 
                  : (fyersStatus?.hasAccessToken && !fyersStatus?.tokenExpired && (fyersStatus?.secondsSinceLastTick < 30 || !isMarketOpenNow))
                    ? 'rgba(34, 197, 94, 0.4)' 
                    : (fyersStatus?.hasAccessToken && !fyersStatus?.tokenExpired)
                      ? 'rgba(234, 179, 8, 0.4)'
                      : 'rgba(239, 68, 68, 0.5)'
              }`,
              color: fyersLoading 
                ? 'var(--text-secondary)' 
                : (fyersStatus?.hasAccessToken && !fyersStatus?.tokenExpired && (fyersStatus?.secondsSinceLastTick < 30 || !isMarketOpenNow))
                  ? 'var(--color-green)' 
                  : (fyersStatus?.hasAccessToken && !fyersStatus?.tokenExpired)
                    ? 'var(--color-yellow)'
                    : 'var(--color-red)'
            }}
            title={
              fyersStatus?.hasAccessToken
                ? `Fyers Token Loaded. Last tick: ${fyersStatus?.secondsSinceLastTick !== null && fyersStatus?.secondsSinceLastTick !== undefined ? fyersStatus.secondsSinceLastTick.toFixed(1) + 's ago' : 'N/A'}`
                : 'No active Fyers token loaded. Daily login required!'
            }
          >
            <span style={{ 
              width: '7px', 
              height: '7px', 
              borderRadius: '50%', 
              background: (fyersStatus?.hasAccessToken && !fyersStatus?.tokenExpired && (fyersStatus?.secondsSinceLastTick < 30 || !isMarketOpenNow))
                ? 'var(--color-green)' 
                : (fyersStatus?.hasAccessToken && !fyersStatus?.tokenExpired)
                  ? 'var(--color-yellow)' 
                  : 'var(--color-red)',
              boxShadow: (fyersStatus?.hasAccessToken && !fyersStatus?.tokenExpired && (fyersStatus?.secondsSinceLastTick < 30 || !isMarketOpenNow))
                ? '0 0 6px var(--color-green)'
                : '0 0 6px var(--color-red)'
            }} />
            {fyersLoading ? (
              <span>Checking Fyers...</span>
            ) : (fyersStatus?.hasAccessToken && !fyersStatus?.tokenExpired && fyersStatus?.secondsSinceLastTick < 30) ? (
              <span>🟢 Fyers Live ({fyersStatus.secondsSinceLastTick.toFixed(0)}s)</span>
            ) : (fyersStatus?.hasAccessToken && !fyersStatus?.tokenExpired && !isMarketOpenNow) ? (
              <span>🟢 Fyers Ready</span>
            ) : (fyersStatus?.hasAccessToken && !fyersStatus?.tokenExpired) ? (
              <span>🟡 Waiting Ticks</span>
            ) : (
              <span>🔴 Token Expired</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Quick Headless Auto-Login Button */}
          <button
            className="btn"
            onClick={handleTriggerAutoLogin}
            disabled={autoLoginLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#fff',
              border: '1px solid #3b82f6',
              cursor: autoLoginLoading ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              padding: '4px 9px',
              borderRadius: '5px',
              fontSize: '11px',
              height: '28px'
            }}
            title="Automatically generates TOTP code and logs into Fyers headlessly"
          >
            {autoLoginLoading ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />}
            {autoLoginLoading ? 'Logging In...' : 'Auto-Login'}
          </button>

          {/* Auto-Login Settings Modal Trigger */}
          <button
            className="btn"
            onClick={() => {
              fetchFyersCredentials();
              setShowAutoLoginModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              fontWeight: '600',
              padding: '4px 9px',
              borderRadius: '5px',
              fontSize: '11px',
              height: '28px'
            }}
            title="Configure Fyers Client ID, PIN, and TOTP Key"
          >
            <Settings size={11} /> Setup
          </button>

          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                const API_URL = import.meta.env.VITE_API_URL || '';
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/api/fyers/auth-url`, {
                  headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
                });
                const data = await res.json();
                if (data.url) {
                  window.location.href = data.url;
                } else {
                  alert('Failed to get Fyers auth URL');
                }
              } catch (e) {
                console.error(e);
                alert('Error connecting Fyers');
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid var(--border-color)', fontSize: '11px', padding: '4px 9px', height: '28px' }}
            title="Manual OAuth Web Login"
          >
            Connect Web
          </button>

          <div className="input-group" style={{ width: '150px' }}>
            <Search size={12} style={{ position: 'absolute', left: '8px', top: '8px', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Search..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '24px', paddingRight: '6px', height: '28px', fontSize: '11px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '5px' }}
            />
          </div>

          <button 
            className="btn btn-secondary" 
            onClick={loadData}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', height: '28px', fontSize: '11px' }}
          >
            <RefreshCw size={11} /> Refresh
          </button>

          <button
            className="btn btn-secondary"
            onClick={async () => {
              if (!window.confirm('Process all due/overdue SIP installments across all active users now?')) return;
              try {
                const res = await fetch(`${API}/api/admin/sips/process-all`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                  }
                });
                const data = await res.json();
                alert(data.message || 'SIP processing complete');
                loadData();
              } catch (e) {
                alert('Error: ' + e.message);
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '4px 9px', height: '28px', background: 'rgba(59,130,246,0.15)', color: 'var(--color-blue)', border: '1px solid rgba(59,130,246,0.3)', cursor: 'pointer' }}
          >
            ⚡ Due SIPs
          </button>
        </div>
      </div>

      {/* Sleek 1-Line Quick Controls Strip (Market Switches + Live Broadcast) */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '5px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        {/* Market Controls Inline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Activity size={13} style={{ color: 'var(--color-blue)' }} /> SESSIONS:
          </span>

          {/* NSE / BSE Equities Switch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(0,0,0,0.35)', padding: '2px 8px', borderRadius: '5px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)' }}>NSE/BSE</span>
            <select
              value={marketStatus?.equity || 'AUTO'}
              disabled={marketUpdating}
              onChange={async (e) => {
                const val = e.target.value;
                setMarketUpdating(true);
                const res = await updateMarketStatus(val, marketStatus?.commodity || 'AUTO');
                setMarketUpdating(false);
                if (!res?.success) alert('Failed to update: ' + (res?.error || 'Unknown error'));
              }}
              style={{
                background: 'transparent',
                color: (marketStatus?.equity === 'OPEN') ? 'var(--color-green)' : (marketStatus?.equity === 'CLOSED') ? 'var(--color-red)' : '#60a5fa',
                border: 'none',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="AUTO" style={{ background: '#1e293b', color: '#fff' }}>⚡ AUTO (9:15-3:15)</option>
              <option value="OPEN" style={{ background: '#1e293b', color: '#22c55e' }}>🟢 OPEN (Special)</option>
              <option value="CLOSED" style={{ background: '#1e293b', color: '#ef4444' }}>🔴 CLOSED (Halt)</option>
            </select>
          </div>

          {/* MCX Commodities Switch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(0,0,0,0.35)', padding: '2px 8px', borderRadius: '5px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)' }}>MCX</span>
            <select
              value={marketStatus?.commodity || 'AUTO'}
              disabled={marketUpdating}
              onChange={async (e) => {
                const val = e.target.value;
                setMarketUpdating(true);
                const res = await updateMarketStatus(marketStatus?.equity || 'AUTO', val);
                setMarketUpdating(false);
                if (!res?.success) alert('Failed to update: ' + (res?.error || 'Unknown error'));
              }}
              style={{
                background: 'transparent',
                color: (marketStatus?.commodity === 'OPEN') ? 'var(--color-green)' : (marketStatus?.commodity === 'CLOSED') ? 'var(--color-red)' : '#60a5fa',
                border: 'none',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="AUTO" style={{ background: '#1e293b', color: '#fff' }}>⚡ AUTO (9:00-22:50)</option>
              <option value="OPEN" style={{ background: '#1e293b', color: '#22c55e' }}>🟢 OPEN (Special)</option>
              <option value="CLOSED" style={{ background: '#1e293b', color: '#ef4444' }}>🔴 CLOSED (Halt)</option>
            </select>
          </div>

          <button
            onClick={() => setActiveTab('calendar')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(139, 92, 246, 0.15)',
              color: '#c084fc',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              borderRadius: '5px',
              padding: '2px 8px',
              fontSize: '10px',
              fontWeight: '700',
              cursor: 'pointer',
              height: '24px'
            }}
          >
            <Calendar size={11} /> Calendar
          </button>
        </div>

        {/* Live Announcement Broadcast Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, maxWidth: isMobile ? '100%' : '520px' }}>
          <span style={{ fontSize: '13px' }}>📢</span>
          <input
            type="text"
            placeholder="Live announcement banner to traders..."
            value={announcementInput}
            onChange={(e) => setAnnouncementInput(e.target.value)}
            style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '5px', padding: '3px 8px', color: '#fff', fontSize: '11px', height: '24px' }}
          />
          <select
            value={announcementType}
            onChange={(e) => setAnnouncementType(e.target.value)}
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '5px', padding: '2px 4px', color: '#fff', fontSize: '11px', height: '24px' }}
          >
            <option value="info">Info</option>
            <option value="warning">Warn</option>
            <option value="alert">Alert</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={async () => {
              if (!announcementInput.trim()) return;
              await setAdminAnnouncement(announcementInput, announcementType);
              alert('Live announcement broadcasted!');
            }}
            style={{ padding: '2px 10px', fontSize: '11px', background: 'var(--color-blue)', color: '#fff', cursor: 'pointer', height: '24px', borderRadius: '5px' }}
          >
            Broadcast
          </button>
          {announcement && announcement.text && (
            <button
              className="btn btn-secondary"
              onClick={async () => {
                await setAdminAnnouncement('', 'info');
                setAnnouncementInput('');
                alert('Banner cleared!');
              }}
              style={{ padding: '2px 6px', fontSize: '10px', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-red-light)', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', height: '24px', borderRadius: '5px' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation Bar (Full Width) */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '1px', overflowX: 'auto' }} className="scrollbar-hide">
        <button 
          onClick={() => setActiveTab('system')} 
          style={{ background: 'none', border: 'none', padding: '6px 0', borderBottom: activeTab === 'system' ? '2px solid var(--color-blue)' : '2px solid transparent', color: activeTab === 'system' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'system' ? '700' : '500', fontSize: '11.5px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          System Status
        </button>
        <button 
          onClick={() => setActiveTab('calendar')} 
          style={{ background: 'none', border: 'none', padding: '6px 0', borderBottom: activeTab === 'calendar' ? '2px solid #8b5cf6' : '2px solid transparent', color: activeTab === 'calendar' ? '#c084fc' : 'var(--text-secondary)', fontWeight: activeTab === 'calendar' ? '700' : '500', fontSize: '11.5px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          📅 Trading Calendar
        </button>
        <button 
          onClick={() => setActiveTab('analytics')}
          style={{ background: 'none', border: 'none', padding: '6px 0', borderBottom: activeTab === 'analytics' ? '2px solid var(--color-blue)' : '2px solid transparent', color: activeTab === 'analytics' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'analytics' ? '700' : '500', fontSize: '11.5px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Analytics & Insights
        </button>
        <button 
          onClick={() => setActiveTab('users')} 
          style={{ background: 'none', border: 'none', padding: '6px 0', borderBottom: activeTab === 'users' ? '2px solid var(--color-blue)' : '2px solid transparent', color: activeTab === 'users' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'users' ? '700' : '500', fontSize: '11.5px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Client Management
        </button>
        <button 
          onClick={() => setActiveTab('positions')} 
          style={{ background: 'none', border: 'none', padding: '6px 0', borderBottom: activeTab === 'positions' ? '2px solid var(--color-blue)' : '2px solid transparent', color: activeTab === 'positions' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'positions' ? '700' : '500', fontSize: '11.5px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Live Positions
        </button>
        <button 
          onClick={() => setActiveTab('orders')} 
          style={{ background: 'none', border: 'none', padding: '6px 0', borderBottom: activeTab === 'orders' ? '2px solid var(--color-blue)' : '2px solid transparent', color: activeTab === 'orders' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'orders' ? '700' : '500', fontSize: '11.5px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Order Flow
        </button>
        <button 
          onClick={() => setActiveTab('ledger')} 
          style={{ background: 'none', border: 'none', padding: '6px 0', borderBottom: activeTab === 'ledger' ? '2px solid var(--color-blue)' : '2px solid transparent', color: activeTab === 'ledger' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'ledger' ? '700' : '500', fontSize: '11.5px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Platform Ledger
        </button>
        <button 
          onClick={() => setActiveTab('deposits')} 
          style={{ background: 'none', border: 'none', padding: '6px 0', borderBottom: activeTab === 'deposits' ? '2px solid var(--color-blue)' : '2px solid transparent', color: activeTab === 'deposits' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'deposits' ? '700' : '500', fontSize: '11.5px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Deposit Requests
        </button>
        <button 
          onClick={() => setActiveTab('withdrawals')} 
          style={{ background: 'none', border: 'none', padding: '6px 0', borderBottom: activeTab === 'withdrawals' ? '2px solid var(--color-blue)' : '2px solid transparent', color: activeTab === 'withdrawals' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'withdrawals' ? '700' : '500', fontSize: '11.5px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Withdrawals
        </button>
        <button 
          onClick={() => setActiveTab('security')} 
          style={{ background: 'none', border: 'none', padding: '6px 0', borderBottom: activeTab === 'security' ? '2px solid var(--color-red)' : '2px solid transparent', color: activeTab === 'security' ? '#ef4444' : 'var(--text-secondary)', fontWeight: activeTab === 'security' ? '700' : '500', fontSize: '11.5px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          🛡️ Security Shield
        </button>
        <button 
          onClick={() => setActiveTab('telemetry')} 
          style={{ background: 'none', border: 'none', padding: '6px 0', borderBottom: activeTab === 'telemetry' ? '2px solid var(--color-blue)' : '2px solid transparent', color: activeTab === 'telemetry' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'telemetry' ? '700' : '500', fontSize: '11.5px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          ⚡ Resource Telemetry
        </button>
      </div>

      {/* Content Container */}
      <div style={{ background: 'var(--bg-panel)', borderRadius: '10px', border: '1px solid var(--border-color)', flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>Loading platform data...</div>
        ) : activeTab === 'security' ? (
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Manual Ban Card */}
            <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '10px 14px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '700', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🛡️ Restriction & Ban Engine (0.01ms Fast Drop)
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
                Instantly drop connections from abusive IPs, fraudulent phone numbers, or suspicious accounts via Redis cache.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <select
                  value={manualBanType}
                  onChange={(e) => setManualBanType(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border-color)', borderRadius: '5px', padding: '4px 8px', color: '#fff', fontSize: '11px', height: '28px' }}
                >
                  <option value="IP">IP Address</option>
                  <option value="PHONE">Phone Number</option>
                  <option value="USER">Username / Client ID</option>
                </select>
                <input
                  type="text"
                  placeholder={manualBanType === 'IP' ? 'e.g. 152.58.16.5' : manualBanType === 'PHONE' ? 'e.g. 9876543210' : 'e.g. johndoe'}
                  value={manualBanValue}
                  onChange={(e) => setManualBanValue(e.target.value)}
                  style={{ flex: 1, minWidth: '180px', background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border-color)', borderRadius: '5px', padding: '4px 8px', color: '#fff', fontSize: '11px', height: '28px' }}
                />
                <input
                  type="text"
                  placeholder="Reason (Optional)"
                  value={manualBanReason}
                  onChange={(e) => setManualBanReason(e.target.value)}
                  style={{ flex: 1, minWidth: '160px', background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border-color)', borderRadius: '5px', padding: '4px 8px', color: '#fff', fontSize: '11px', height: '28px' }}
                />
                <button
                  onClick={async () => {
                    if (!manualBanValue.trim()) return alert('Please enter a value to ban');
                    const res = await banEntity(manualBanType, manualBanValue.trim(), manualBanReason.trim());
                    if (res.success) {
                      alert(res.message || 'Entity banned successfully!');
                      setManualBanValue('');
                      setManualBanReason('');
                      loadData();
                    } else {
                      alert(res.error || 'Failed to ban entity');
                    }
                  }}
                  style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '5px', padding: '4px 12px', fontWeight: '700', fontSize: '11px', height: '28px', cursor: 'pointer' }}
                >
                  🚫 Apply Ban
                </button>
              </div>
            </div>

            {/* Active Bans Table */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: '700', fontSize: '12px', color: '#fff' }}>
                  Active Restricted Entities ({bannedEntities?.length || 0})
                </div>
                <button onClick={loadData} className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '10px' }}>
                  Refresh
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '6px 12px', fontWeight: '600' }}>Type</th>
                    <th style={{ padding: '6px 12px', fontWeight: '600' }}>Target Value</th>
                    <th style={{ padding: '6px 12px', fontWeight: '600' }}>Reason</th>
                    <th style={{ padding: '6px 12px', fontWeight: '600' }}>Date Banned</th>
                    <th style={{ padding: '6px 12px', fontWeight: '600', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(!bannedEntities || bannedEntities.length === 0) ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '18px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No active IP or Phone bans in place.
                      </td>
                    </tr>
                  ) : (
                    bannedEntities.map(b => (
                      <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '6px 12px' }}>
                          <span style={{
                            background: b.type === 'IP' ? 'rgba(59,130,246,0.15)' : b.type === 'PHONE' ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
                            color: b.type === 'IP' ? '#60a5fa' : b.type === 'PHONE' ? '#eab308' : '#ef4444',
                            border: `1px solid ${b.type === 'IP' ? 'rgba(59,130,246,0.3)' : b.type === 'PHONE' ? 'rgba(234,179,8,0.3)' : 'rgba(239,68,68,0.3)'}`,
                            padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: '700'
                          }}>
                            {b.type}
                          </span>
                        </td>
                        <td style={{ padding: '6px 12px', fontWeight: '700', color: '#fff' }}>
                          {b.value}
                        </td>
                        <td style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>
                          {b.reason || 'Restricted by Admin'}
                        </td>
                        <td style={{ padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '11px' }}>
                          {b.created_at ? new Date(b.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-'}
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                          <button
                            onClick={async () => {
                              if (window.confirm(`Unban ${b.type} ${b.value}?`)) {
                                const res = await unbanEntity({ id: b.id, type: b.type, value: b.value });
                                if (res.success) {
                                  alert('Unbanned successfully!');
                                  loadData();
                                } else {
                                  alert(res.error || 'Failed to unban');
                                }
                              }
                            }}
                            style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            🟢 Unban
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'system' ? (
          <SystemStatusTab
            onOpenAutoLoginModal={() => { fetchFyersCredentials(); setShowAutoLoginModal(true); }}
            onTriggerAutoLogin={handleTriggerAutoLogin}
            autoLoginLoading={autoLoginLoading}
          />
        ) : activeTab === 'calendar' ? (
          <MarketCalendarTab isMobile={isMobile} />
        ) : activeTab === 'analytics' ? (
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {analytics ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '3px' }}>Total Platform AUM</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>₹{(analytics.totalAum || 0).toFixed(2)}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '3px' }}>Today's Realized P&L</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: (analytics.todayRealizedPnl || 0) >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                    {(analytics.todayRealizedPnl || 0) >= 0 ? '+' : '-'}₹{Math.abs(analytics.todayRealizedPnl || 0).toFixed(2)}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '3px' }}>Today's Total Volume</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-blue)' }}>₹{(analytics.todayVolume || 0).toFixed(2)}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Top Traded Symbols</div>
                  {(analytics.topSymbols || []).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {(analytics.topSymbols || []).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                          <span style={{ fontWeight: '500' }}>{item.symbol}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>₹{(item.volume || 0).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  ) : <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>No trades today.</div>}
                </div>
              </div>
            ) : <div style={{ color: 'var(--text-secondary)', fontSize: '12px', padding: '16px' }}>No analytics data available.</div>}
          </div>
        ) : activeTab === 'orders' ? (
          <div>
            {/* Toolbar */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={13} color="var(--color-blue)" />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Order Flow</span>
                  <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontWeight: '600' }}>
                    {ordersTotal > 0 ? `${filteredOrders.length} shown / ${ordersTotal} total (Page ${ordersPage} of ${ordersTotalPages})` : `${filteredOrders.length} Orders`}
                  </span>
                </div>

                {/* Sort selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Sort:</span>
                  <select
                    value={orderSort}
                    onChange={e => setOrderSort(e.target.value)}
                    style={{
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '10px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="date_desc">Date (Newest First)</option>
                    <option value="date_asc">Date (Oldest First)</option>
                    <option value="value_desc">Total Value (High → Low)</option>
                  </select>
                </div>
              </div>

              {/* Date Filter Pills & Export Bar */}
              <DateRangeExportBar
                datePreset={ordersDatePreset}
                setDatePreset={p => { setOrdersDatePreset(p); setOrdersPage(1); }}
                customStart={ordersCustomStart}
                setCustomStart={v => { setOrdersCustomStart(v); setOrdersPage(1); }}
                customEnd={ordersCustomEnd}
                setCustomEnd={v => { setOrdersCustomEnd(v); setOrdersPage(1); }}
                onExportExcel={() => handleExportOrders('excel')}
                onExportPDF={() => handleExportOrders('pdf')}
                exporting={exporting}
              />

              {/* Search & Filter Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
                  <Search size={11} style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    placeholder="Search orders (symbol, client, ID)..."
                    value={orderSearch}
                    onChange={e => setOrderSearch(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      padding: '3px 20px 3px 22px',
                      fontSize: '10.5px',
                      color: 'var(--text-primary)'
                    }}
                  />
                  {orderSearch && (
                    <X
                      size={11}
                      onClick={() => setOrderSearch('')}
                      style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    />
                  )}
                </div>

                {/* Filter Chips */}
                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'All', val: 'ALL' },
                    { label: '✅ Executed', val: 'EXECUTED' },
                    { label: '❌ Rejected', val: 'REJECTED' },
                    { label: '⏳ Pending', val: 'PENDING' },
                    { label: 'BUY', val: 'BUY' },
                    { label: 'SELL', val: 'SELL' }
                  ].map(chip => (
                    <button
                      key={chip.val}
                      type="button"
                      onClick={() => setOrderFilter(chip.val)}
                      style={{
                        padding: '2px 6px',
                        fontSize: '10px',
                        fontWeight: '600',
                        borderRadius: '3px',
                        border: '1px solid',
                        borderColor: orderFilter === chip.val ? 'var(--color-blue)' : 'var(--border-color)',
                        background: orderFilter === chip.val ? 'rgba(59,130,246,0.2)' : 'transparent',
                        color: orderFilter === chip.val ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 12px', fontWeight: '600' }}>Date</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600' }}>Client</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600' }}>Symbol</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600', textAlign: 'center' }}>Type</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600', textAlign: 'right' }}>Qty @ Price</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(!filteredOrders || filteredOrders.length === 0) ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '18px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {orderSearch || orderFilter !== 'ALL' ? 'No orders match your filter criteria' : 'No orders found'}
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(o => (
                    <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '11px' }}>{o.created_at ? new Date(o.created_at).toLocaleString() : '-'}</td>
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--color-blue)', fontFamily: 'monospace', fontWeight: '700', fontSize: '10.5px', background: 'rgba(59,130,246,0.1)', padding: '1px 4px', borderRadius: '3px', border: '1px solid rgba(59,130,246,0.2)' }}>
                            {o.client_id || (o.user_id ? `SE${String(o.user_id).padStart(6, '0')}` : 'CLIENT')}
                          </span>
                          <span style={{ fontWeight: '600' }}>{o.username || 'Unknown'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '6px 12px', fontWeight: '600' }}>{o.symbol}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                        <span style={{ color: o.side === 'BUY' ? 'var(--color-blue)' : 'var(--color-red)', fontWeight: '700' }}>{o.side}</span> {o.type}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right' }}>{o.quantity} @ ₹{Number(o.average_price || o.price || 0).toFixed(2)}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                        <span style={{ 
                          color: o.status === 'EXECUTED' ? 'var(--color-green-light)' : o.status === 'REJECTED' ? 'var(--color-red-light)' : 'var(--color-yellow)',
                          background: o.status === 'EXECUTED' ? 'rgba(34,197,94,0.1)' : o.status === 'REJECTED' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                          padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: '700'
                        }}>{o.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Page {ordersPage} of {ordersTotalPages} ({ordersTotal || orders.length} orders)
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setOrdersPage(p => Math.max(1, p - 1))} 
                  disabled={ordersPage === 1}
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                >
                  Previous
                </button>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setOrdersPage(p => Math.min(ordersTotalPages, p + 1))} 
                  disabled={ordersPage >= ordersTotalPages}
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'positions' ? (
          <div>
            {/* Toolbar */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={13} color="var(--color-blue)" />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Live Positions</span>
                  <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontWeight: '600' }}>
                    {filteredPositions.length} / {positions.length}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Sort selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Sort:</span>
                    <select
                      value={positionSort}
                      onChange={e => setPositionSort(e.target.value)}
                      style={{
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '10px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="qty_desc">Quantity (High → Low)</option>
                      <option value="symbol_asc">Symbol (A → Z)</option>
                      <option value="client_asc">Client (A → Z)</option>
                    </select>
                  </div>

                  <button
                    onClick={handleMasterSquareOff}
                    style={{
                      background: 'var(--color-red)',
                      color: '#fff',
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      fontSize: '10px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    🚨 MASTER SQUARE-OFF (ALL USERS)
                  </button>
                </div>
              </div>

              {/* Date Filter Pills & Export Bar */}
              <DateRangeExportBar
                datePreset={positionsDatePreset}
                setDatePreset={p => { setPositionsDatePreset(p); setPositionsPage(1); }}
                customStart={positionsCustomStart}
                setCustomStart={v => { setPositionsCustomStart(v); setPositionsPage(1); }}
                customEnd={positionsCustomEnd}
                setCustomEnd={v => { setPositionsCustomEnd(v); setPositionsPage(1); }}
                onExportExcel={() => handleExportPositions('excel')}
                onExportPDF={() => handleExportPositions('pdf')}
                exporting={exporting}
              />

              {/* Search & Filter Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
                  <Search size={11} style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    placeholder="Search position (symbol, client)..."
                    value={positionSearch}
                    onChange={e => setPositionSearch(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      padding: '3px 20px 3px 22px',
                      fontSize: '10.5px',
                      color: 'var(--text-primary)'
                    }}
                  />
                  {positionSearch && (
                    <X
                      size={11}
                      onClick={() => setPositionSearch('')}
                      style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    />
                  )}
                </div>

                {/* Filter Chips */}
                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'All', val: 'ALL' },
                    { label: '🟢 Long (BUY)', val: 'LONG' },
                    { label: '🔴 Short (SELL)', val: 'SHORT' }
                  ].map(chip => (
                    <button
                      key={chip.val}
                      type="button"
                      onClick={() => setPositionFilter(chip.val)}
                      style={{
                        padding: '2px 6px',
                        fontSize: '10px',
                        fontWeight: '600',
                        borderRadius: '3px',
                        border: '1px solid',
                        borderColor: positionFilter === chip.val ? 'var(--color-blue)' : 'var(--border-color)',
                        background: positionFilter === chip.val ? 'rgba(59,130,246,0.2)' : 'transparent',
                        color: positionFilter === chip.val ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 12px', fontWeight: '600' }}>Client</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600' }}>Symbol</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600', textAlign: 'right' }}>Avg Price</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(!filteredPositions || filteredPositions.length === 0) ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '18px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {positionSearch || positionFilter !== 'ALL' ? 'No positions match your filter criteria' : 'No active positions found'}
                    </td>
                  </tr>
                ) : (
                  filteredPositions.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--color-blue)', fontFamily: 'monospace', fontWeight: '700', fontSize: '10.5px', background: 'rgba(59,130,246,0.1)', padding: '1px 4px', borderRadius: '3px', border: '1px solid rgba(59,130,246,0.2)' }}>
                            {p.client_id || (p.user_id ? `SE${String(p.user_id).padStart(6, '0')}` : 'CLIENT')}
                          </span>
                          <span style={{ fontWeight: '600' }}>{p.username || 'Unknown'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '6px 12px', fontWeight: '600' }}>{p.symbol}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: '700', color: p.quantity > 0 ? 'var(--color-blue)' : 'var(--color-red)' }}>{p.quantity}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'right' }}>₹{Number(p.average_price || 0).toFixed(2)}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                        <button 
                          onClick={() => handleForceClose(p.id)}
                          className="btn"
                          style={{ padding: '2px 6px', fontSize: '10px', background: 'rgba(239,68,68,0.1)', color: 'var(--color-red-light)', border: '1px solid rgba(239,68,68,0.2)' }}
                        >
                          Force Close
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Page {positionsPage} of {positionsTotalPages} ({positionsTotal || positions.length} positions)
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setPositionsPage(p => Math.max(1, p - 1))} 
                  disabled={positionsPage === 1}
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                >
                  Previous
                </button>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setPositionsPage(p => Math.min(positionsTotalPages, p + 1))} 
                  disabled={positionsPage >= positionsTotalPages}
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'ledger' ? (
          <div>
            {/* Toolbar */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={13} color="var(--color-blue)" />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Platform Ledger</span>
                  <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontWeight: '600' }}>
                    {ledgerTotal > 0 ? `${filteredLedger.length} shown / ${ledgerTotal} total (Page ${ledgerPage} of ${ledgerTotalPages})` : `${filteredLedger.length} Entries`}
                  </span>
                </div>

                {/* Sort selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Sort:</span>
                  <select
                    value={ledgerSort}
                    onChange={e => setLedgerSort(e.target.value)}
                    style={{
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '10px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="date_desc">Date (Newest First)</option>
                    <option value="amount_desc">Amount (High → Low)</option>
                  </select>
                </div>
              </div>

              {/* Date Filter Pills & Export Bar */}
              <DateRangeExportBar
                datePreset={ledgerDatePreset}
                setDatePreset={p => { setLedgerDatePreset(p); setLedgerPage(1); }}
                customStart={ledgerCustomStart}
                setCustomStart={v => { setLedgerCustomStart(v); setLedgerPage(1); }}
                customEnd={ledgerCustomEnd}
                setCustomEnd={v => { setLedgerCustomEnd(v); setLedgerPage(1); }}
                onExportExcel={() => handleExportLedger('excel')}
                onExportPDF={() => handleExportLedger('pdf')}
                exporting={exporting}
              />

              {/* Search & Filter Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
                  <Search size={11} style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    placeholder="Search ledger (client, description, type)..."
                    value={ledgerSearch}
                    onChange={e => setLedgerSearch(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      padding: '3px 20px 3px 22px',
                      fontSize: '10.5px',
                      color: 'var(--text-primary)'
                    }}
                  />
                  {ledgerSearch && (
                    <X
                      size={11}
                      onClick={() => setLedgerSearch('')}
                      style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    />
                  )}
                </div>

                {/* Filter Chips */}
                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'All', val: 'ALL' },
                    { label: '🟢 Credit (+)', val: 'CREDIT' },
                    { label: '🔴 Debit (-)', val: 'DEBIT' }
                  ].map(chip => (
                    <button
                      key={chip.val}
                      type="button"
                      onClick={() => setLedgerFilter(chip.val)}
                      style={{
                        padding: '2px 6px',
                        fontSize: '10px',
                        fontWeight: '600',
                        borderRadius: '3px',
                        border: '1px solid',
                        borderColor: ledgerFilter === chip.val ? 'var(--color-blue)' : 'var(--border-color)',
                        background: ledgerFilter === chip.val ? 'rgba(59,130,246,0.2)' : 'transparent',
                        color: ledgerFilter === chip.val ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 12px', fontWeight: '600' }}>Date</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600' }}>Client</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600' }}>Type</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600' }}>Description</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(!filteredLedger || filteredLedger.length === 0) ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '18px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {ledgerSearch || ledgerFilter !== 'ALL' ? 'No ledger entries match your filter criteria' : 'No ledger entries found'}
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map(l => (
                    <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '11px' }}>{l.created_at ? new Date(l.created_at).toLocaleString() : '-'}</td>
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--color-blue)', fontFamily: 'monospace', fontWeight: '700', fontSize: '10.5px', background: 'rgba(59,130,246,0.1)', padding: '1px 4px', borderRadius: '3px', border: '1px solid rgba(59,130,246,0.2)' }}>
                            {l.client_id || (l.user_id ? `SE${String(l.user_id).padStart(6, '0')}` : 'CLIENT')}
                          </span>
                          <span style={{ fontWeight: '600' }}>{l.username || 'Unknown'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <span style={{ background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: '3px', fontSize: '10px' }}>{l.type}</span>
                      </td>
                      <td style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>{l.description}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: '600', color: l.amount >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                        {l.amount >= 0 ? '+' : ''}₹{Number(l.amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Page {ledgerPage} of {ledgerTotalPages} ({ledgerTotal || ledger.length} entries)
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setLedgerPage(p => Math.max(1, p - 1))} 
                  disabled={ledgerPage === 1}
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                >
                  Previous
                </button>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setLedgerPage(p => Math.min(ledgerTotalPages, p + 1))} 
                  disabled={ledgerPage >= ledgerTotalPages}
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'users' ? (
          <div>
            {/* Toolbar */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={13} color="var(--color-blue)" />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Client Accounts</span>
                  <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontWeight: '600' }}>
                    {filteredClients.length} / {users.length} Clients
                  </span>
                </div>

                {/* Sort selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Sort:</span>
                  <select
                    value={clientSort}
                    onChange={e => setClientSort(e.target.value)}
                    style={{
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '10px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="balance_desc">Balance (High → Low)</option>
                    <option value="balance_asc">Balance (Low → High)</option>
                    <option value="name_asc">Name (A → Z)</option>
                    <option value="newest">Newest First</option>
                  </select>
                </div>
              </div>

              {/* Date Filter Pills & Export Bar */}
              <DateRangeExportBar
                datePreset={usersDatePreset}
                setDatePreset={p => { setUsersDatePreset(p); setPage(1); }}
                customStart={usersCustomStart}
                setCustomStart={v => { setUsersCustomStart(v); setPage(1); }}
                customEnd={usersCustomEnd}
                setCustomEnd={v => { setUsersCustomEnd(v); setPage(1); }}
                onExportExcel={() => handleExportUsers('excel')}
                onExportPDF={() => handleExportUsers('pdf')}
                exporting={exporting}
              />

              {/* Search & Filter Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
                  <Search size={11} style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    placeholder="Search client (username, email, phone, IP)..."
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      padding: '3px 20px 3px 22px',
                      fontSize: '10.5px',
                      color: 'var(--text-primary)'
                    }}
                  />
                  {clientSearch && (
                    <X
                      size={11}
                      onClick={() => setClientSearch('')}
                      style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    />
                  )}
                </div>

                {/* Filter Chips */}
                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'All', val: 'ALL' },
                    { label: '🟢 Active', val: 'ACTIVE' },
                    { label: '🚫 Banned', val: 'BANNED' },
                    { label: '⭐ PRO Tier', val: 'PRO' },
                    { label: '📄 Verified KYC', val: 'KYC_VERIFIED' },
                    { label: '⚠️ KYC Missing', val: 'KYC_MISSING' },
                    { label: '⚠️ Multi-IP', val: 'SHARED_IP' }
                  ].map(chip => (
                    <button
                      key={chip.val}
                      type="button"
                      onClick={() => setClientFilter(chip.val)}
                      style={{
                        padding: '2px 6px',
                        fontSize: '10px',
                        fontWeight: '600',
                        borderRadius: '3px',
                        border: '1px solid',
                        borderColor: clientFilter === chip.val ? 'var(--color-blue)' : 'var(--border-color)',
                        background: clientFilter === chip.val ? 'rgba(59,130,246,0.2)' : 'transparent',
                        color: chip.val === 'BANNED' && clientFilter === 'BANNED' ? '#ef4444' : clientFilter === chip.val ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 12px', fontWeight: '600' }}>Client</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600' }}>Contact</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600', textAlign: 'right' }}>Margin Balance</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600', textAlign: 'center' }}>KYC Status</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '18px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {clientSearch || clientFilter !== 'ALL' ? 'No clients match your filter criteria' : 'No users found'}
                    </td>
                  </tr>
                ) : (
                  filteredClients.map(u => {
                    const hasKyc = Boolean(u.kyc_pan_url && u.kyc_aadhar_url);
                    const hasPartialKyc = Boolean(u.kyc_pan_url || u.kyc_aadhar_url);
                    
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '6px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: u.is_admin ? 'var(--color-red)' : 'var(--color-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 'bold' }}>
                              {(u.username || 'U').substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                <span style={{ color: 'var(--color-blue)', fontFamily: 'monospace', fontWeight: '700', fontSize: '10.5px', background: 'rgba(59,130,246,0.1)', padding: '1px 4px', borderRadius: '3px', border: '1px solid rgba(59,130,246,0.2)' }}>
                                  {u.client_id || (u.id ? `SE${String(u.id).padStart(6, '0')}` : 'CLIENT')}
                                </span>
                                <span>{u.username || 'Unknown User'}</span>
                                {u.is_admin && <span style={{ fontSize: '8px', background: 'var(--color-red)', padding: '1px 3px', borderRadius: '3px' }}>ADMIN</span>}
                                {u.subscription_tier === 'PRO' && <span style={{ fontSize: '8px', background: 'rgba(34,197,94,0.15)', color: 'var(--color-green-light)', border: '1px solid rgba(34,197,94,0.3)', padding: '1px 4px', borderRadius: '3px', fontWeight: '700' }}>PRO</span>}
                                {u.shared_ip_count > 1 && (
                                  <span 
                                    title={`Multi-Account Risk! ${u.shared_ip_count} accounts on this IP (${u.shared_users?.join(', ') || ''})`}
                                    style={{ 
                                      background: 'rgba(239, 68, 68, 0.15)', 
                                      color: '#ef4444', 
                                      border: '1px solid rgba(239, 68, 68, 0.3)', 
                                      padding: '1px 4px', 
                                      borderRadius: '3px', 
                                      fontSize: '8px', 
                                      fontWeight: '700',
                                      cursor: 'help' 
                                    }}
                                  >
                                    ⚠️ {u.shared_ip_count} ACCOUNTS
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>
                          <div>{u.email}</div>
                          <div style={{ fontSize: '10px' }}>{u.phone || 'No phone'}</div>
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: '600' }}>
                          ₹{Number(u.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                          {hasKyc ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-green-light)', padding: '1px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: '600' }}>
                              <CheckCircle size={9} /> Verified
                            </div>
                          ) : hasPartialKyc ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: 'rgba(234, 179, 8, 0.1)', color: 'var(--color-yellow)', padding: '1px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: '600' }}>
                              <Clock size={9} /> Pending
                            </div>
                          ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: 'var(--bg-hover)', color: 'var(--text-secondary)', padding: '1px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: '600' }}>
                              Missing
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '6px 12px' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {!u.is_admin && (
                              <>
                                <button
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    background: u.is_banned ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                                    color: u.is_banned ? '#22c55e' : '#ef4444',
                                    border: `1px solid ${u.is_banned ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`
                                  }}
                                  onClick={async () => {
                                    if (window.confirm(`Are you sure you want to ${u.is_banned ? 'UNBAN' : 'BAN'} ${u.username}?`)) {
                                      try {
                                        await toggleUserBan(u.id);
                                        loadData();
                                      } catch(e) {
                                        alert(e.message);
                                      }
                                    }
                                  }}
                                >
                                  {u.is_banned ? '🟢 Unban' : '🚫 Ban'}
                                </button>
                                {u.last_ip && (
                                  <button
                                    style={{
                                      padding: '2px 5px',
                                      borderRadius: '3px',
                                      fontSize: '9px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      background: 'rgba(239,68,68,0.1)',
                                      color: '#ef4444',
                                      border: '1px solid rgba(239,68,68,0.3)'
                                    }}
                                    onClick={async () => {
                                      if (window.confirm(`Ban IP address ${u.last_ip}? All accounts on this IP will be blocked from accessing the website.`)) {
                                        const res = await banEntity('IP', u.last_ip, `Banned from client ${u.username}`);
                                        alert(res.message || `IP ${u.last_ip} has been banned!`);
                                        loadData();
                                      }
                                    }}
                                  >
                                    Ban IP
                                  </button>
                                )}
                              </>
                            )}
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '2px 7px', fontSize: '10px' }}
                              onClick={() => { 
                                setSelectedUser(u); 
                                setNewBalance(u.balance); 
                                setNewSubTier(u.subscription_tier || 'BASIC');
                                setNewUsername(u.username || '');
                                setNewEmail(u.email || '');
                                setNewPhone(u.phone || '');
                              }}
                            >
                              Manage
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages}
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page === 1}
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                >
                  Previous
                </button>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                  disabled={page >= totalPages}
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'withdrawals' ? (
          <div>
            {/* Toolbar */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={13} color="var(--color-blue)" />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Withdrawal Requests</span>
                  <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontWeight: '600' }}>
                    {withdrawalsTotal > 0 ? `${filteredWithdrawals.length} shown / ${withdrawalsTotal} total (Page ${withdrawalsPage} of ${withdrawalsTotalPages})` : `${filteredWithdrawals.length} Requests`}
                  </span>
                  {(() => {
                    const pendingTotal = (withdrawals || []).filter(w => w.status === 'PENDING').reduce((acc, w) => acc + (parseFloat(w.amount) || 0), 0);
                    return pendingTotal > 0 ? (
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(234,179,8,0.15)', color: 'var(--color-yellow)', fontWeight: '700' }}>
                        Pending: ₹{pendingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    ) : null;
                  })()}
                </div>

                {/* Sort selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Sort:</span>
                  <select
                    value={withdrawalSort}
                    onChange={e => setWithdrawalSort(e.target.value)}
                    style={{
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '10px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="date_desc">Date (Newest First)</option>
                    <option value="date_asc">Date (Oldest First)</option>
                    <option value="amount_desc">Amount (High → Low)</option>
                    <option value="amount_asc">Amount (Low → High)</option>
                  </select>
                </div>
              </div>

              {/* Date Filter Pills & Export Bar */}
              <DateRangeExportBar
                datePreset={withdrawalsDatePreset}
                setDatePreset={p => { setWithdrawalsDatePreset(p); setWithdrawalsPage(1); }}
                customStart={withdrawalsCustomStart}
                setCustomStart={v => { setWithdrawalsCustomStart(v); setWithdrawalsPage(1); }}
                customEnd={withdrawalsCustomEnd}
                setCustomEnd={v => { setWithdrawalsCustomEnd(v); setWithdrawalsPage(1); }}
                onExportExcel={() => handleExportWithdrawals('excel')}
                onExportPDF={() => handleExportWithdrawals('pdf')}
                exporting={exporting}
              />

              {/* Search & Filter Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
                  <Search size={11} style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    placeholder="Search withdrawal (client, UPI, bank, IFSC, amount)..."
                    value={withdrawalSearch}
                    onChange={e => setWithdrawalSearch(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      padding: '3px 20px 3px 22px',
                      fontSize: '10.5px',
                      color: 'var(--text-primary)'
                    }}
                  />
                  {withdrawalSearch && (
                    <X
                      size={11}
                      onClick={() => setWithdrawalSearch('')}
                      style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    />
                  )}
                </div>

                {/* Filter Chips */}
                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'All', val: 'ALL' },
                    { label: '⏳ Pending', val: 'PENDING' },
                    { label: '🔄 Processing', val: 'PROCESSING' },
                    { label: '✅ Credited', val: 'CREDITED' },
                    { label: '❌ Rejected', val: 'REJECTED' },
                    { label: '⚠️ Multi-IP', val: 'SHARED_IP' }
                  ].map(chip => (
                    <button
                      key={chip.val}
                      type="button"
                      onClick={() => setWithdrawalFilter(chip.val)}
                      style={{
                        padding: '2px 6px',
                        fontSize: '10px',
                        fontWeight: '600',
                        borderRadius: '3px',
                        border: '1px solid',
                        borderColor: withdrawalFilter === chip.val ? 'var(--color-blue)' : 'var(--border-color)',
                        background: withdrawalFilter === chip.val ? 'rgba(59,130,246,0.2)' : 'transparent',
                        color: withdrawalFilter === chip.val ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 12px', fontWeight: '600' }}>Date</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600' }}>Client</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600' }}>Bank / UPI Details</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(!filteredWithdrawals || filteredWithdrawals.length === 0) ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '18px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {withdrawalSearch || withdrawalFilter !== 'ALL' ? 'No withdrawal requests match your filter criteria' : 'No withdrawal requests found'}
                    </td>
                  </tr>
                ) : (
                  filteredWithdrawals.map(w => (
                    <tr key={w.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '6px 12px', fontSize: '10px' }}>{new Date(w.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--color-blue)', fontFamily: 'monospace', fontWeight: '700', fontSize: '10.5px', background: 'rgba(59,130,246,0.1)', padding: '1px 4px', borderRadius: '3px', border: '1px solid rgba(59,130,246,0.2)' }}>
                            {w.client_id || (w.user_id ? `SE${String(w.user_id).padStart(6, '0')}` : 'CLIENT')}
                          </span>
                          <span>{w.username}</span>
                          {w.shared_ip_count > 1 && (
                            <span 
                              title={`Multi-Account Fraud Risk! ${w.shared_ip_count} accounts share this IP (${w.shared_users?.join(', ') || ''})`}
                              style={{ 
                                background: 'rgba(239, 68, 68, 0.15)', 
                                color: '#ef4444', 
                                border: '1px solid rgba(239, 68, 68, 0.3)', 
                                padding: '1px 4px', 
                                borderRadius: '3px', 
                                fontSize: '8px', 
                                fontWeight: '700', 
                                cursor: 'help' 
                              }}
                            >
                              ⚠️ {w.shared_ip_count} ON IP
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{w.phone}</div>
                        {w.last_ip && <div style={{ fontSize: '8px', color: 'var(--text-secondary)', opacity: 0.6 }}>IP: {w.last_ip}</div>}
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>UPI: <span style={{color: '#fff'}}>{w.upi_id || 'N/A'}</span></div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>A/C: <span style={{color: '#fff'}}>{w.bank_account_no || 'N/A'}</span></div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>IFSC: <span style={{color: '#fff'}}>{w.bank_ifsc || 'N/A'}</span></div>
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: '600' }}>₹{parseFloat(w.amount).toFixed(2)}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                        <span style={{
                          color: w.status === 'CREDITED' ? 'var(--color-green-light)' : w.status === 'REJECTED' ? 'var(--color-red-light)' : w.status === 'PROCESSING' ? 'var(--color-blue)' : 'var(--color-yellow)',
                          background: w.status === 'CREDITED' ? 'rgba(34,197,94,0.1)' : w.status === 'REJECTED' ? 'rgba(239,68,68,0.1)' : w.status === 'PROCESSING' ? 'rgba(59,130,246,0.1)' : 'rgba(234,179,8,0.1)',
                          padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: '700'
                        }}>{w.status}</span>
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          {w.status === 'PENDING' && (
                            <>
                              <button className="btn btn-primary" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={async () => {
                                if(window.confirm('Approve this withdrawal? User will see "Processing".')) {
                                  await processAdminWithdrawal(w.id, 'PROCESSING');
                                  loadData();
                                }
                              }}>Approve</button>
                              <button className="btn btn-outline" style={{ padding: '2px 6px', fontSize: '10px', borderColor: 'var(--color-red)', color: 'var(--color-red)' }} onClick={async () => {
                                if(window.confirm('Reject this withdrawal? Amount will return to user.')) {
                                  await processAdminWithdrawal(w.id, 'REJECTED');
                                  loadData();
                                }
                              }}>Reject</button>
                            </>
                          )}
                          {w.status === 'PROCESSING' && (
                            <button className="btn btn-primary" style={{ padding: '2px 6px', fontSize: '10px', background: 'var(--color-green)' }} onClick={async () => {
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Page {withdrawalsPage} of {withdrawalsTotalPages} ({withdrawalsTotal || withdrawals.length} requests)
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setWithdrawalsPage(p => Math.max(1, p - 1))} 
                  disabled={withdrawalsPage === 1}
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                >
                  Previous
                </button>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setWithdrawalsPage(p => Math.min(withdrawalsTotalPages, p + 1))} 
                  disabled={withdrawalsPage >= withdrawalsTotalPages}
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'telemetry' ? (
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* TOP CONTROLS & TIMEFRAME SELECTOR */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              
              {/* Timeframe Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                <Clock size={13} color="var(--color-blue)" />
                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Window:</span>
                <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                  {[
                    { label: '1m', val: '1m' },
                    { label: '5m', val: '5m' },
                    { label: '10m', val: '10m' },
                    { label: '15m', val: '15m' },
                    { label: '30m', val: '30m' },
                    { label: '45m', val: '45m' },
                    { label: '1h', val: '1h' },
                    { label: '4h', val: '4h' },
                    { label: '6h', val: '6h' },
                    { label: '8h', val: '8h' },
                    { label: '12h', val: '12h' },
                    { label: '24h', val: '24h' },
                    { label: 'All', val: 'all' }
                  ].map(tf => (
                    <button
                      key={tf.val}
                      onClick={() => {
                        setTelemetryTimeframe(tf.val);
                        fetchAdminTelemetry?.(tf.val);
                      }}
                      style={{
                        padding: '1px 5px',
                        fontSize: '10px',
                        fontWeight: '600',
                        borderRadius: '3px',
                        border: '1px solid',
                        borderColor: telemetryTimeframe === tf.val ? 'var(--color-blue)' : 'var(--border-color)',
                        background: telemetryTimeframe === tf.val ? 'rgba(59,130,246,0.2)' : 'transparent',
                        color: telemetryTimeframe === tf.val ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons: Live Toggle, CSV Export, Reset Metrics */}
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {/* Live Polling Toggle */}
                <button
                  onClick={() => setIsLiveTelemetry(!isLiveTelemetry)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: '600',
                    border: '1px solid',
                    borderColor: isLiveTelemetry ? 'var(--color-green)' : 'var(--border-color)',
                    background: isLiveTelemetry ? 'rgba(34,197,94,0.1)' : 'transparent',
                    color: isLiveTelemetry ? 'var(--color-green-light)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {isLiveTelemetry ? (
                    <>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-green)', display: 'inline-block', boxShadow: '0 0 4px var(--color-green)' }}></span>
                      LIVE
                    </>
                  ) : (
                    <>
                      <Pause size={9} /> PAUSED
                    </>
                  )}
                </button>

                {/* Export CSV */}
                <button
                  onClick={() => {
                    if (!adminTelemetry) return;
                    let csv = 'Type,Identifier,Hits_or_Calls,Avg_Latency_ms,Bandwidth_Bytes\n';
                    (adminTelemetry.api || []).forEach(r => {
                      const avgLat = r.count > 0 ? (r.totalTime / r.count).toFixed(2) : 0;
                      csv += `API,"${r.route}",${r.count},${avgLat},${r.totalBytes}\n`;
                    });
                    (adminTelemetry.users || []).forEach(u => {
                      csv += `USER,"${u.username} (${u.userId})",${u.apiCalls},0,${u.apiBytes}\n`;
                    });
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.setAttribute('hidden', '');
                    a.setAttribute('href', url);
                    a.setAttribute('download', `shortmarket_telemetry_${telemetryTimeframe}_${Date.now()}.csv`);
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: '600',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-panel)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={10} /> CSV
                </button>

                {/* Reset Metrics */}
                <button
                  onClick={async () => {
                    if (window.confirm('⚠️ Reset all telemetry counters? This will clear all recorded hits and bandwidth data in Redis.')) {
                      const res = await resetAdminTelemetry();
                      if (res?.success) {
                        alert('✅ Telemetry metrics successfully reset!');
                        fetchAdminTelemetry?.(telemetryTimeframe);
                      } else {
                        alert(res?.error || 'Failed to reset telemetry');
                      }
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: '600',
                    border: '1px solid rgba(239,68,68,0.3)',
                    background: 'rgba(239,68,68,0.1)',
                    color: 'var(--color-red-light)',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={10} /> Reset
                </button>
              </div>
            </div>

            {/* INFRASTRUCTURE HARDWARE & CLOUD COST KPI CARDS */}
            {(() => {
              const totalBandwidth = (adminTelemetry?.api || []).reduce((acc, r) => acc + (r.totalBytes || 0), 0);
              const totalCalls = (adminTelemetry?.api || []).reduce((acc, r) => acc + (r.count || 0), 0);
              const totalTime = (adminTelemetry?.api || []).reduce((acc, r) => acc + (r.totalTime || 0), 0);
              const avgLat = totalCalls > 0 ? (totalTime / totalCalls).toFixed(1) : '0';
              const userCount = (adminTelemetry?.users || []).length;
              const formattedBw = totalBandwidth > 1048576 
                ? (totalBandwidth / 1048576).toFixed(2) + ' MB'
                : (totalBandwidth / 1024).toFixed(2) + ' KB';
              const bandwidthGB = totalBandwidth / (1024 * 1024 * 1024);
              const estimatedCostINR = (bandwidthGB * 10.00).toFixed(2);
              const estimatedCostUSD = (bandwidthGB * 0.12).toFixed(2);
              const sys = adminTelemetry?.system;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Row 1: Host VM Hardware & Capacity */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                    {/* Host RAM */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <HardDrive size={12} color="var(--color-blue)" /> Host VM RAM
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: parseFloat(sys?.ram?.pct || 0) > 85 ? 'var(--color-red)' : parseFloat(sys?.ram?.pct || 0) > 70 ? 'var(--color-yellow)' : 'var(--text-primary)' }}>
                        {sys?.ram ? `${sys.ram.usedGB} / ${sys.ram.totalGB} GB` : 'Monitoring...'}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {sys?.ram ? `${sys.ram.pct}% utilized` : 'Collecting...'}
                      </div>
                    </div>

                    {/* Host CPU */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Zap size={12} color="var(--color-green)" /> Host CPU ({sys?.cpu?.cores || 1} vCPUs)
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: parseFloat(sys?.cpu?.loadPct || 0) > 80 ? 'var(--color-red)' : 'var(--color-green-light)' }}>
                        {sys?.cpu ? `${sys.cpu.loadPct}% Load` : 'Active'}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {sys?.cpu?.loadAvg ? `Load 1m: ${sys.cpu.loadAvg[0]}` : 'Idle'}
                      </div>
                    </div>

                    {/* Disk Storage */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <HardDrive size={12} color="var(--color-blue)" /> VM Disk Storage
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {sys?.disk ? `${sys.disk.usedGB} / ${sys.disk.totalGB} GB` : 'Storage Active'}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {sys?.disk ? `${sys.disk.pct}% used (${sys.disk.freeGB} GB free)` : 'Persistent Disk'}
                      </div>
                    </div>

                    {/* Server Uptime & Node RSS */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} color="var(--color-blue)" /> Server Uptime
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {sys?.uptime || 'Online'}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {sys?.process?.rssMB ? `Node RSS: ${sys.process.rssMB} MB` : 'Cluster Online'}
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Cloud Traffic & Estimated Cost Drivers */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                    {/* Network Egress */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <HardDrive size={12} color="var(--color-blue)" /> Egress Bandwidth ({telemetryTimeframe})
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>{formattedBw}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {bandwidthGB.toFixed(3)} GB egress
                      </div>
                    </div>

                    {/* Estimated GCP Egress Cost */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <TrendingUp size={12} color="var(--color-green)" /> Est. GCP Egress Cost
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-green-light)' }}>
                        ₹ {estimatedCostINR}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        ${estimatedCostUSD} (@ $0.12/GB standard)
                      </div>
                    </div>

                    {/* API Hits & Avg Latency */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Activity size={12} color="var(--color-blue)" /> Total API Hits ({telemetryTimeframe})
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>{totalCalls.toLocaleString()}</div>
                      <div style={{ fontSize: '10px', color: parseFloat(avgLat) > 200 ? 'var(--color-red)' : 'var(--color-green-light)', marginTop: '2px' }}>
                        Avg Latency: {avgLat} ms
                      </div>
                    </div>

                    {/* Tracked Users */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={12} color="var(--color-blue)" /> Tracked Users
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-primary)' }}>{userCount} Users</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Monitored in Redis
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* TABLES GRID WITH INTERACTIVE FILTERS & SORTING */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '8px' : '10px' }}>
              {/* API APM TABLE */}
              <div className="card" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                {/* Header Toolbar */}
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Activity size={13} color="var(--color-blue)" />
                      <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>API Performance (APM)</span>
                      <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontWeight: '600' }}>
                        {filteredApm.length} / {(adminTelemetry?.api || []).length}
                      </span>
                    </div>

                    {/* Sort Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Sort:</span>
                      <select
                        value={apmSort}
                        onChange={e => setApmSort(e.target.value)}
                        style={{
                          background: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '10px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="bandwidth">Bandwidth (High → Low)</option>
                        <option value="hits">Hits (High → Low)</option>
                        <option value="latency">Slowest (High Latency)</option>
                        <option value="fastest">Fastest (Low Latency)</option>
                      </select>
                    </div>
                  </div>

                  {/* Search and Filter Chips */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '120px' }}>
                      <Search size={11} style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input
                        type="text"
                        placeholder="Search route (e.g. /order, /market)..."
                        value={apmSearch}
                        onChange={e => setApmSearch(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          padding: '3px 20px 3px 22px',
                          fontSize: '10.5px',
                          color: 'var(--text-primary)'
                        }}
                      />
                      {apmSearch && (
                        <X
                          size={11}
                          onClick={() => setApmSearch('')}
                          style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        />
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                      {[
                        { label: 'All', val: 'ALL' },
                        { label: 'GET', val: 'GET' },
                        { label: 'POST', val: 'POST' },
                        { label: '🐢 Slow >100ms', val: 'SLOW' }
                      ].map(chip => (
                        <button
                          key={chip.val}
                          type="button"
                          onClick={() => setApmMethod(chip.val)}
                          style={{
                            padding: '2px 6px',
                            fontSize: '10px',
                            fontWeight: '600',
                            borderRadius: '3px',
                            border: '1px solid',
                            borderColor: apmMethod === chip.val ? 'var(--color-blue)' : 'var(--border-color)',
                            background: apmMethod === chip.val ? 'rgba(59,130,246,0.2)' : 'transparent',
                            color: apmMethod === chip.val ? '#fff' : 'var(--text-secondary)',
                            cursor: 'pointer'
                          }}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Table Body */}
                <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-panel)', zIndex: 1 }}>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '6px 8px' }}>Route</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', cursor: 'pointer' }} onClick={() => setApmSort('hits')}>
                          Hits {apmSort === 'hits' && '▼'}
                        </th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', cursor: 'pointer' }} onClick={() => setApmSort(apmSort === 'latency' ? 'fastest' : 'latency')}>
                          Avg Latency {apmSort === 'latency' ? '▼' : apmSort === 'fastest' ? '▲' : ''}
                        </th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', cursor: 'pointer' }} onClick={() => setApmSort('bandwidth')}>
                          Bandwidth {apmSort === 'bandwidth' && '▼'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApm.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            {apmSearch || apmMethod !== 'ALL' ? 'No routes match your filter criteria' : `No telemetry collected for ${telemetryTimeframe}`}
                          </td>
                        </tr>
                      ) : (
                        filteredApm.map(row => {
                          const avgLatency = row.count > 0 ? (row.totalTime / row.count).toFixed(2) : 0;
                          const sizeKb = (row.totalBytes / 1024).toFixed(2);
                          const latNum = parseFloat(avgLatency);
                          
                          return (
                            <tr key={row.route} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '5px 8px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{row.route}</td>
                              <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '600' }}>{row.count.toLocaleString()}</td>
                              <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                                <span style={{
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  fontSize: '9px',
                                  fontWeight: '700',
                                  background: latNum > 500 ? 'rgba(239,68,68,0.15)' : latNum > 100 ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)',
                                  color: latNum > 500 ? 'var(--color-red-light)' : latNum > 100 ? 'var(--color-yellow)' : 'var(--color-green-light)'
                                }}>
                                  {avgLatency} ms
                                </span>
                              </td>
                              <td style={{ padding: '5px 8px', textAlign: 'right' }}>{sizeKb} KB</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* USER RESOURCE TABLE */}
              <div className="card" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                {/* Header Toolbar */}
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={13} color="var(--color-blue)" />
                      <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Top Resource Users</span>
                      <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontWeight: '600' }}>
                        {filteredUsers.length} / {(adminTelemetry?.users || []).length}
                      </span>
                    </div>

                    {/* Sort Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Sort:</span>
                      <select
                        value={userSort}
                        onChange={e => setUserSort(e.target.value)}
                        style={{
                          background: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '10px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="bandwidth">Bandwidth (High → Low)</option>
                        <option value="calls">API Calls (High → Low)</option>
                        <option value="market_time">Market Time (Most Active)</option>
                      </select>
                    </div>
                  </div>

                  {/* Search and Filter Chips */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '120px' }}>
                      <Search size={11} style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input
                        type="text"
                        placeholder="Search user / ID..."
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          padding: '3px 20px 3px 22px',
                          fontSize: '10.5px',
                          color: 'var(--text-primary)'
                        }}
                      />
                      {userSearch && (
                        <X
                          size={11}
                          onClick={() => setUserSearch('')}
                          style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        />
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                      {[
                        { label: 'All', val: 'ALL' },
                        { label: '✅ Active', val: 'ACTIVE_ONLY' },
                        { label: '🗑️ Deleted', val: 'DELETED_ONLY' },
                        { label: '🔥 Heavy', val: 'HEAVY' }
                      ].map(chip => (
                        <button
                          key={chip.val}
                          type="button"
                          onClick={() => setUserFilter(chip.val)}
                          style={{
                            padding: '2px 6px',
                            fontSize: '10px',
                            fontWeight: '600',
                            borderRadius: '3px',
                            border: '1px solid',
                            borderColor: userFilter === chip.val ? 'var(--color-blue)' : 'var(--border-color)',
                            background: userFilter === chip.val ? 'rgba(59,130,246,0.2)' : 'transparent',
                            color: userFilter === chip.val ? '#fff' : 'var(--text-secondary)',
                            cursor: 'pointer'
                          }}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Table Body */}
                <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-panel)', zIndex: 1 }}>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '6px 8px' }}>User</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', cursor: 'pointer' }} onClick={() => setUserSort('market_time')}>
                          Market Time {userSort === 'market_time' && '▼'}
                        </th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', cursor: 'pointer' }} onClick={() => setUserSort('calls')}>
                          API Calls {userSort === 'calls' && '▼'}
                        </th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', cursor: 'pointer' }} onClick={() => setUserSort('bandwidth')}>
                          Bandwidth {userSort === 'bandwidth' && '▼'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            {userSearch || userFilter !== 'ALL' ? 'No users match your filter criteria' : `No telemetry collected for ${telemetryTimeframe}`}
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u, idx) => {
                          const sizeMb = (u.apiBytes / (1024 * 1024)).toFixed(3);
                          const isDeleted = String(u.username || '').includes('Deleted') || String(u.username || '').includes('Anonymous');
                          
                          return (
                            <tr key={u.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '5px 8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                  <span style={{
                                    fontSize: '9px',
                                    fontWeight: '700',
                                    padding: '0 4px',
                                    borderRadius: '2px',
                                    background: idx === 0 ? '#eab308' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'rgba(255,255,255,0.08)',
                                    color: idx <= 2 ? '#000' : 'var(--text-secondary)'
                                  }}>
                                    #{idx + 1}
                                  </span>
                                  {(u.clientId || (u.userId && u.userId !== 'anonymous')) && (
                                    <span style={{ color: 'var(--color-blue)', fontFamily: 'monospace', fontWeight: '700', fontSize: '10px', background: 'rgba(59,130,246,0.1)', padding: '1px 4px', borderRadius: '3px', border: '1px solid rgba(59,130,246,0.2)' }}>
                                      {u.clientId || `SE${String(u.userId).padStart(6, '0')}`}
                                    </span>
                                  )}
                                  <span style={{ fontWeight: 'bold', color: isDeleted ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                                    {u.username}
                                  </span>
                                  {isDeleted && (
                                    <span style={{ fontSize: '8.5px', padding: '0 4px', borderRadius: '2px', background: 'rgba(239,68,68,0.15)', color: 'var(--color-red-light)', fontWeight: '600' }}>
                                      inactive
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '5px 8px', textAlign: 'right' }}>{u.wsMinutes} mins</td>
                              <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '600' }}>{u.apiCalls.toLocaleString()}</td>
                              <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--color-blue)', fontWeight: '600' }}>{sizeMb} MB</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {/* Toolbar */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={13} color="var(--color-blue)" />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Deposit Requests</span>
                  <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontWeight: '600' }}>
                    {depositsTotal > 0 ? `${filteredDeposits.length} shown / ${depositsTotal} total (Page ${depositsPage} of ${depositsTotalPages})` : `${filteredDeposits.length} Requests`}
                  </span>
                  {deposits.filter(d => d.status === 'PENDING').length > 0 && (
                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(234,179,8,0.15)', color: 'var(--color-yellow)', fontWeight: '700' }}>
                      ⏳ {deposits.filter(d => d.status === 'PENDING').length} Pending (₹{deposits.filter(d => d.status === 'PENDING').reduce((acc, d) => acc + (Number(d.amount) || 0), 0).toLocaleString('en-IN')})
                    </span>
                  )}
                </div>

                {/* Sort selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Sort:</span>
                  <select
                    value={depositSort}
                    onChange={e => setDepositSort(e.target.value)}
                    style={{
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '10px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="date_desc">Date (Newest First)</option>
                    <option value="date_asc">Date (Oldest First)</option>
                    <option value="amount_desc">Amount (High → Low)</option>
                    <option value="amount_asc">Amount (Low → High)</option>
                  </select>
                </div>
              </div>

              {/* Date Filter Pills & Export Bar */}
              <DateRangeExportBar
                datePreset={depositsDatePreset}
                setDatePreset={p => { setDepositsDatePreset(p); setDepositsPage(1); }}
                customStart={depositsCustomStart}
                setCustomStart={v => { setDepositsCustomStart(v); setDepositsPage(1); }}
                customEnd={depositsCustomEnd}
                setCustomEnd={v => { setDepositsCustomEnd(v); setDepositsPage(1); }}
                onExportExcel={() => handleExportDeposits('excel')}
                onExportPDF={() => handleExportDeposits('pdf')}
                exporting={exporting}
              />

              {/* Search & Filter Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
                  <Search size={11} style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    placeholder="Search deposits (client, email, amount)..."
                    value={depositSearch}
                    onChange={e => setDepositSearch(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      padding: '3px 20px 3px 22px',
                      fontSize: '10.5px',
                      color: 'var(--text-primary)'
                    }}
                  />
                  {depositSearch && (
                    <X
                      size={11}
                      onClick={() => setDepositSearch('')}
                      style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    />
                  )}
                </div>

                {/* Filter Chips */}
                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'All', val: 'ALL' },
                    { label: '⏳ Pending', val: 'PENDING' },
                    { label: '✅ Approved', val: 'APPROVED' },
                    { label: '❌ Rejected', val: 'REJECTED' }
                  ].map(chip => (
                    <button
                      key={chip.val}
                      type="button"
                      onClick={() => setDepositFilter(chip.val)}
                      style={{
                        padding: '2px 6px',
                        fontSize: '10px',
                        fontWeight: '600',
                        borderRadius: '3px',
                        border: '1px solid',
                        borderColor: depositFilter === chip.val ? 'var(--color-blue)' : 'var(--border-color)',
                        background: depositFilter === chip.val ? 'rgba(59,130,246,0.2)' : 'transparent',
                        color: depositFilter === chip.val ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 12px', fontWeight: '600' }}>Date</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600' }}>Client</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '6px 12px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeposits.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '18px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {depositSearch || depositFilter !== 'ALL' ? 'No deposit requests match your filter criteria' : 'No deposit requests found'}
                    </td>
                  </tr>
                ) : (
                  filteredDeposits.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '11px' }}>{new Date(d.created_at).toLocaleString()}</td>
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--color-blue)', fontFamily: 'monospace', fontWeight: '700', fontSize: '10.5px', background: 'rgba(59,130,246,0.1)', padding: '1px 4px', borderRadius: '3px', border: '1px solid rgba(59,130,246,0.2)' }}>
                            {d.client_id || (d.user_id ? `SE${String(d.user_id).padStart(6, '0')}` : 'CLIENT')}
                          </span>
                          <span style={{ fontWeight: '600' }}>{d.username}</span>
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{d.email}</div>
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: '600' }}>
                        ₹{Number(d.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                        {d.status === 'PENDING' && <span style={{ color: 'var(--color-yellow)', background: 'rgba(234,179,8,0.1)', padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: '600' }}>PENDING</span>}
                        {d.status === 'APPROVED' && <span style={{ color: 'var(--color-green-light)', background: 'rgba(34,197,94,0.1)', padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: '600' }}>APPROVED</span>}
                        {d.status === 'REJECTED' && <span style={{ color: 'var(--color-red-light)', background: 'rgba(239,68,68,0.1)', padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: '600' }}>REJECTED</span>}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                        {d.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            <button onClick={() => handleProcessDeposit(d.id, 'approve')} className="btn" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--color-green-light)', border: '1px solid rgba(34,197,94,0.2)', padding: '3px 6px', borderRadius: '3px', display: 'flex', alignItems: 'center' }}>
                              <Check size={12} />
                            </button>
                            <button onClick={() => handleProcessDeposit(d.id, 'reject')} className="btn" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-red-light)', border: '1px solid rgba(239,68,68,0.2)', padding: '3px 6px', borderRadius: '3px', display: 'flex', alignItems: 'center' }}>
                              <XCircle size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Page {depositsPage} of {depositsTotalPages} ({depositsTotal || deposits.length} requests)
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setDepositsPage(p => Math.max(1, p - 1))} 
                  disabled={depositsPage === 1}
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                >
                  Previous
                </button>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setDepositsPage(p => Math.min(depositsTotalPages, p + 1))} 
                  disabled={depositsPage >= depositsTotalPages}
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Manage User Modal */}
      {selectedUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
            borderRadius: '16px', width: '500px', maxWidth: '90vw', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Manage {selectedUser.username}</h3>
                <span style={{ color: 'var(--color-blue)', fontFamily: 'monospace', fontWeight: '700', fontSize: '12px', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.2)' }}>
                  {selectedUser.client_id || (selectedUser.id ? `SE${String(selectedUser.id).padStart(6, '0')}` : '')}
                </span>
              </div>
              <X size={20} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setSelectedUser(null)} />
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
              {/* Client Details Editor */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Edit size={14} style={{ color: 'var(--color-blue)' }} /> Client Details
                </h4>
                <form onSubmit={handleUpdateDetails} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="input-group">
                    <User size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} />
                    <input type="text" className="input-field" placeholder="Username" value={newUsername} onChange={e => setNewUsername(e.target.value)} style={{ paddingLeft: '36px' }} required />
                  </div>
                  <div className="input-group">
                    <Mail size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} />
                    <input type="email" className="input-field" placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={{ paddingLeft: '36px' }} required />
                  </div>
                  <div className="input-group">
                    <Phone size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} />
                    <input type="text" className="input-field" placeholder="Phone (optional)" value={newPhone} onChange={e => setNewPhone(e.target.value)} style={{ paddingLeft: '36px' }} />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={updating}>
                    {updating ? 'Saving...' : 'Update Details'}
                  </button>
                </form>
              </div>

              {/* Balance Editor */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={14} style={{ color: 'var(--color-blue)' }} /> Margin Balance
                </h4>
                <form onSubmit={handleUpdateBalance} style={{ display: 'flex', gap: '12px' }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <span style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }}>₹</span>
                    <input 
                      type="number" 
                      step="0.01"
                      value={newBalance}
                      onChange={e => setNewBalance(e.target.value)}
                      style={{ paddingLeft: '24px', width: '100%' }}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={updating}>
                    {updating ? 'Saving...' : 'Update Balance'}
                  </button>
                </form>
              </div>

              {/* Subscription Editor */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={14} style={{ color: 'var(--color-blue)' }} /> Subscription Tier
                </h4>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Current Tier: <strong style={{ color: selectedUser.subscription_tier === 'PRO' ? 'var(--color-green-light)' : 'var(--text-primary)' }}>{selectedUser.subscription_tier || 'BASIC'}</strong>
                  {selectedUser.subscription_expires && ` (Expires: ${new Date(selectedUser.subscription_expires).toLocaleDateString()})`}
                </div>
                <form onSubmit={handleUpdateSubscription} style={{ display: 'flex', gap: '12px' }}>
                  <select 
                    className="input-field" 
                    value={newSubTier} 
                    onChange={e => setNewSubTier(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="BASIC">Basic (3 Watchlists)</option>
                    <option value="PRO">PRO (5 Watchlists)</option>
                  </select>
                  <button type="submit" className="btn btn-primary" disabled={updating}>
                    {updating ? 'Saving...' : 'Update Tier'}
                  </button>
                </form>
              </div>

              {/* Device & Security Fingerprint Card */}
              <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🛡️ Device & Security Fingerprint
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Device Model:</span> <strong style={{ color: '#fff', marginLeft: '4px' }}>{selectedUser.device_model || 'Desktop PC'}</strong></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>OS & Browser:</span> <span style={{ color: '#fff', marginLeft: '4px' }}>{selectedUser.os_name || 'Windows'} ({selectedUser.browser_name || 'Chrome'})</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Network IP:</span> <span style={{ color: '#93c5fd', marginLeft: '4px' }}>{selectedUser.last_ip || selectedUser.registration_ip || 'Not recorded'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Detected IP Location:</span> <span style={{ color: '#4ade80', marginLeft: '4px' }}>{selectedUser.ip_city ? `${selectedUser.ip_city}${selectedUser.ip_state ? `, ${selectedUser.ip_state}` : ''}` : (selectedUser.ip_state ? `${selectedUser.ip_state}, India` : (selectedUser.last_ip && selectedUser.last_ip !== '::1' && selectedUser.last_ip !== '127.0.0.1' ? 'India' : 'Localhost / Network'))}</span></div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {selectedUser.last_ip && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm(`Ban IP ${selectedUser.last_ip}?`)) {
                          await banEntity('IP', selectedUser.last_ip, `Banned from ${selectedUser.username}`);
                          alert(`IP ${selectedUser.last_ip} banned successfully!`);
                          loadData();
                        }
                      }}
                      style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      🚫 Ban IP ({selectedUser.last_ip})
                    </button>
                  )}
                  {selectedUser.phone && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm(`Ban Phone ${selectedUser.phone}?`)) {
                          await banEntity('PHONE', selectedUser.phone, `Banned from ${selectedUser.username}`);
                          alert(`Phone ${selectedUser.phone} banned successfully!`);
                          loadData();
                        }
                      }}
                      style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      🚫 Ban Phone ({selectedUser.phone})
                    </button>
                  )}
                </div>
              </div>

              {/* User Profile Details */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={14} style={{ color: 'var(--color-blue)' }} /> Client Profile (Onboarding Data)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Client ID:</span> <span style={{ color: 'var(--color-blue)', fontFamily: 'monospace', fontWeight: '700' }}>{selectedUser.client_id || (selectedUser.id ? `SE${String(selectedUser.id).padStart(6, '0')}` : 'N/A')}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>DOB:</span> <span style={{ color: 'white' }}>{selectedUser.dob || 'N/A'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Gender:</span> <span style={{ color: 'white' }}>{selectedUser.gender || 'N/A'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>State:</span> <span style={{ color: 'white' }}>{selectedUser.onboarding_state || selectedUser.state || 'N/A'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>City:</span> <span style={{ color: 'white' }}>{selectedUser.onboarding_city || selectedUser.city || 'N/A'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Occupation:</span> <span style={{ color: 'white' }}>{selectedUser.occupation || 'N/A'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Income:</span> <span style={{ color: 'white' }}>{selectedUser.annual_income || 'N/A'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Goal:</span> <span style={{ color: 'white' }}>{selectedUser.financial_goal || 'N/A'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Experience:</span> <span style={{ color: 'white' }}>{selectedUser.trading_experience || 'N/A'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Segment:</span> <span style={{ color: 'white' }}>{selectedUser.preferred_segment || 'N/A'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Style:</span> <span style={{ color: 'white' }}>{selectedUser.trading_style || 'N/A'}</span></div>
                </div>
              </div>

              {/* KYC Documents */}
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={14} style={{ color: 'var(--color-blue)' }} /> Identity Documents
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>PAN Card (ID: {selectedUser.pan_card || 'Not set'})</div>
                    {selectedUser.kyc_pan_url ? (
                      <a href={selectedUser.kyc_pan_url} target="_blank" rel="noreferrer">
                        <img src={selectedUser.kyc_pan_url} alt="PAN" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px' }} />
                      </a>
                    ) : (
                      <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>No Document</div>
                    )}
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Aadhar (ID: {selectedUser.aadhar_number || 'Not set'})</div>
                    {selectedUser.kyc_aadhar_url ? (
                      <a href={selectedUser.kyc_aadhar_url} target="_blank" rel="noreferrer">
                        <img src={selectedUser.kyc_aadhar_url} alt="Aadhar" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px' }} />
                      </a>
                    ) : (
                      <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>No Document</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', marginTop: '8px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--color-red-light)' }}>Danger Zone</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Wipe all trades, positions, ledger, and reset balance to ₹10,00,000.
                  </div>
                  <button 
                    onClick={handleResetUser}
                    disabled={updating}
                    style={{ background: 'var(--color-red)', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: '12px' }}
                  >
                    {updating ? 'WORKING...' : 'RESET ACCOUNT'}
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span style={{ color: '#ff4444', fontWeight: '700' }}>PERMANENT:</span> Delete this account and all associated data. This cannot be undone.
                  </div>
                  <button
                    onClick={handleDeleteUser}
                    disabled={updating}
                    style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #dc2626', padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: '12px' }}
                  >
                    {updating ? 'WORKING...' : '🗑️ DELETE ACCOUNT'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fyers Auto-Login Configuration Modal */}
      {showAutoLoginModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
        }}>
          <div style={{
            background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
            borderRadius: '16px', width: '520px', maxWidth: '92vw', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} color="#eab308" />
                <h3 style={{ fontSize: '17px', fontWeight: '700', margin: 0 }}>Fyers Automated Login Setup</h3>
              </div>
              <X size={20} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowAutoLoginModal(false)} />
            </div>

            <form onSubmit={handleSaveAndAutoLogin} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Enter your Fyers account details and 2FA TOTP Secret Key. Our headless engine will automatically generate the 6-digit TOTP code and refresh your session token daily at 08:00 AM IST.
              </div>

              {autoLoginStatus && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  background: autoLoginStatus.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  border: `1px solid ${autoLoginStatus.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  color: autoLoginStatus.type === 'success' ? 'var(--color-green-light)' : 'var(--color-red-light)'
                }}>
                  {autoLoginStatus.message}
                </div>
              )}

              {/* Fyers User ID */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  FYERS USER ID / CLIENT ID *
                </label>
                <div className="input-group">
                  <User size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. XF01234"
                    value={fyersUserId}
                    onChange={e => setFyersUserId(e.target.value.toUpperCase())}
                    style={{ paddingLeft: '36px', textTransform: 'uppercase' }}
                    required
                  />
                </div>
              </div>

              {/* 4-Digit PIN */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  FYERS 4-DIGIT PIN * {hasSavedPin && <span style={{ color: 'var(--color-green)', fontWeight: 'normal' }}>(✓ Saved in Database)</span>}
                </label>
                <div className="input-group" style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type={showPin ? 'text' : 'password'}
                    className="input-field"
                    placeholder={hasSavedPin ? '•••• (Leave blank to keep existing)' : 'Enter 4-digit PIN'}
                    value={fyersPin}
                    onChange={e => setFyersPin(e.target.value)}
                    maxLength={6}
                    style={{ paddingLeft: '36px', paddingRight: '40px' }}
                    required={!hasSavedPin}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* TOTP Key */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  FYERS 32-CHARACTER TOTP SECRET KEY * {hasSavedTotpKey && <span style={{ color: 'var(--color-green)', fontWeight: 'normal' }}>(✓ Saved in Database)</span>}
                </label>
                <div className="input-group" style={{ position: 'relative' }}>
                  <Key size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type={showTotpKey ? 'text' : 'password'}
                    className="input-field"
                    placeholder={hasSavedTotpKey ? '•••••••••••••••• (Leave blank to keep existing)' : 'Paste 32-char Base32 Secret Key'}
                    value={fyersTotpKey}
                    onChange={e => setFyersTotpKey(e.target.value.replace(/\s+/g, '').toUpperCase())}
                    style={{ paddingLeft: '36px', paddingRight: '40px', fontFamily: 'monospace' }}
                    required={!hasSavedTotpKey}
                  />
                  <button
                    type="button"
                    onClick={() => setShowTotpKey(!showTotpKey)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    {showTotpKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Instructions Guide */}
              <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px', padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <strong style={{ color: 'var(--color-blue)', display: 'block', marginBottom: '4px' }}>💡 How to get your Fyers TOTP Key:</strong>
                1. Go to <span style={{ color: '#fff', fontWeight: '600' }}>myaccount.fyers.in</span> → Security / 2FA.<br/>
                2. Enable <strong>External TOTP (Authenticator App)</strong>.<br/>
                3. Under the QR code, click <strong>"Can't scan QR?"</strong> to view the alphanumeric secret key.<br/>
                4. Copy the 32-character key and paste it above.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAutoLoginModal(false)}
                  disabled={autoLoginLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={autoLoginLoading}
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    fontWeight: '700',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: autoLoginLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {autoLoginLoading ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                  {autoLoginLoading ? 'Saving & Verifying...' : 'Save & Run Auto-Login'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


