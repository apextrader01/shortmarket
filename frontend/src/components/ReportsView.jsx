import { useShallow } from 'zustand/react/shallow';
import React, { useState, useEffect, useMemo } from 'react';
import { useStore, API } from '../store';
import { 
  FileText, PieChart, BarChart2, Download, Search, Filter, ArrowLeft, 
  Calendar, FileDown, TrendingUp, TrendingDown, Target, Clock, Activity, 
  AlertCircle, ChevronDown, Check, X, Shield, Layers, Receipt, Briefcase
} from 'lucide-react';
import {
  calculateIndianCharges,
  generateTaxPnLReport,
  generatePnLSummaryReport,
  generateTradesAndChargesReport,
  generateLedgerReport,
  generateContractNoteReport,
  generateDPHoldingReport,
  getISTDateString,
  filterRecordsByPeriod
} from '../utils/clientReportGenerator';
import TradingJournalView from './TradingJournalView';

// --- Subcomponents for Tabs ---

// ─────────────────────────────────────────────────────────────────────────────
// 1. STATEMENT - LEDGER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const LedgerStatement = () => {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('Broking');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Filter states
  const [filterPeriod, setFilterPeriod] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [filterType, setFilterType] = useState('All');

  const { token, user } = useStore(useShallow(state => ({ token: state.token, user: state.user })));

  useEffect(() => {
    const fetchLedger = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/api/ledger`, {
          headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
        });
        const data = await res.json();
        if (Array.isArray(data)) setLedger(data);
        else setLedger([]);
      } catch (err) {
        console.error('Failed to fetch ledger:', err);
        setLedger([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLedger();
  }, [token]);

  // Calculate running balances using user's current balance
  const ledgerWithBalance = useMemo(() => {
    if (!user || !ledger.length) return ledger;
    let currentBalance = parseFloat(user.balance || 0);
    return ledger.map(entry => {
       const balanceAfter = currentBalance;
       currentBalance -= Number(entry.amount);
       return { ...entry, running_balance: balanceAfter };
    });
  }, [ledger, user]);

  // Apply filters
  const filteredLedger = useMemo(() => {
    return ledgerWithBalance.filter(entry => {
      if (filterType === 'Credits' && Number(entry.amount) <= 0) return false;
      if (filterType === 'Debits' && Number(entry.amount) >= 0) return false;

      const entryDate = new Date(entry.created_at);
      const now = new Date();
      const diffTime = Math.abs(now - entryDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (filterPeriod === 'Custom') {
        if (customStart) {
          const start = new Date(customStart);
          start.setHours(0, 0, 0, 0);
          if (entryDate < start) return false;
        }
        if (customEnd) {
          const end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
          if (entryDate > end) return false;
        }
      } else {
        if (filterPeriod === 'Week' && diffDays > 7) return false;
        if (filterPeriod === '15 Days' && diffDays > 15) return false;
        if (filterPeriod === 'Month' && diffDays > 30) return false;
        if (filterPeriod === '3 Months' && diffDays > 90) return false;
        if (filterPeriod === 'All') return true;
      }

      return true;
    });
  }, [ledgerWithBalance, filterType, filterPeriod, customStart, customEnd]);

  const pageSize = 50;
  const totalPages = Math.ceil(filteredLedger.length / pageSize) || 1;
  const paginatedLedger = filteredLedger.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalCredits = filteredLedger.filter(l => Number(l.amount) > 0).reduce((a, b) => a + Number(b.amount), 0);
  const totalDebits = filteredLedger.filter(l => Number(l.amount) < 0).reduce((a, b) => a + Math.abs(Number(b.amount)), 0);

  const renderLedgerBadge = (type, amount) => {
    const t = (type || '').toUpperCase();
    let bg = 'rgba(59,130,246,0.15)';
    let color = '#60a5fa';
    let label = type ? type.replace(/_/g, ' ') : 'TRANSACTION';

    if (t === 'MARGIN_BLOCK') {
      bg = 'rgba(245, 158, 11, 0.15)';
      color = '#f59e0b';
      label = 'Margin Block';
    } else if (t === 'MARGIN_RELEASE') {
      bg = 'rgba(6, 182, 212, 0.15)';
      color = '#06b6d4';
      label = 'Margin Release';
    } else if (t === 'TAXES') {
      bg = 'rgba(168, 85, 247, 0.15)';
      color = '#c084fc';
      label = 'Taxes & Charges';
    } else if (t === 'REALIZED_PNL') {
      const isProfit = Number(amount) >= 0;
      bg = isProfit ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';
      color = isProfit ? '#4ade80' : '#f87171';
      label = 'Realized P&L';
    } else if (t === 'DEPOSIT') {
      bg = 'rgba(34, 197, 94, 0.15)';
      color = '#22c55e';
      label = 'Deposit';
    } else if (t === 'WITHDRAWAL') {
      bg = 'rgba(249, 115, 22, 0.15)';
      color = '#fb923c';
      label = 'Withdrawal';
    } else if (t === 'HOLDING_RELEASE') {
      bg = 'rgba(59, 130, 246, 0.15)';
      color = '#60a5fa';
      label = 'Holding Release';
    } else if (t === 'RMS_PENALTY') {
      bg = 'rgba(239, 68, 68, 0.2)';
      color = '#ef4444';
      label = 'RMS Penalty';
    }

    return (
      <span style={{ background: bg, color, padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', textTransform: 'capitalize', display: 'inline-block', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Sub Tabs */}
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <span 
          onClick={() => setActiveSubTab('Broking')}
          style={{ cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: activeSubTab === 'Broking' ? 'var(--color-blue-light)' : 'var(--text-secondary)', borderBottom: activeSubTab === 'Broking' ? '2px solid var(--color-blue-light)' : 'none', paddingBottom: '12px', marginBottom: '-13px' }}
        >Broking</span>
        <span 
          onClick={() => setActiveSubTab('MTF')}
          style={{ cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: activeSubTab === 'MTF' ? 'var(--color-blue-light)' : 'var(--text-secondary)', borderBottom: activeSubTab === 'MTF' ? '2px solid var(--color-blue-light)' : 'none', paddingBottom: '12px', marginBottom: '-13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >MTF <span style={{ background: 'var(--color-red)', color: '#FFF', fontSize: '9px', padding: '2px 6px', borderRadius: '12px' }}>NEW</span></span>
      </div>

      {/* Filters and Download Options */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Period:</span>
          <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: '6px', overflow: 'hidden' }}>
            {['Week', '15 Days', 'Month', '3 Months', 'All'].map(p => (
              <span 
                key={p} 
                onClick={() => setFilterPeriod(p)}
                style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer', background: p === filterPeriod ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: p === filterPeriod ? 'var(--color-blue-light)' : 'var(--text-secondary)' }}
              >
                {p}
              </span>
            ))}
          </div>
          <span 
            onClick={() => setFilterPeriod('Custom')}
            style={{ fontSize: '12px', color: filterPeriod === 'Custom' ? 'var(--color-blue-light)' : 'var(--text-secondary)', padding: '6px 12px', border: filterPeriod === 'Custom' ? '1px solid var(--color-blue-light)' : '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }}
          >
            <Calendar size={12} style={{display:'inline', marginRight:'4px'}}/> Custom
          </span>
          {filterPeriod === 'Custom' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px', borderRadius: '4px', fontSize: '12px', outline: 'none', colorScheme: 'dark' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px', borderRadius: '4px', fontSize: '12px', outline: 'none', colorScheme: 'dark' }} />
            </div>
          )}
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
          >
            <option value="All" style={{ color: '#000' }}>All Transactions</option>
            <option value="Credits" style={{ color: '#000' }}>Credits (+)</option>
            <option value="Debits" style={{ color: '#000' }}>Debits (-)</option>
          </select>
        </div>
        
        {/* Export Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={() => generateLedgerReport(filteredLedger, user || {}, filterPeriod, 'excel')} 
            style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: 'var(--color-blue-light)', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={13} /> Excel (.csv)
          </button>
          <button 
            onClick={() => generateLedgerReport(filteredLedger, user || {}, filterPeriod, 'pdf')} 
            style={{ background: 'var(--color-blue)', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText size={13} /> PDF Statement
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px' }}>
        <div className="glass-panel" style={{ padding: '14px', borderRadius: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Combined Balance</div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-blue-light)', marginTop: '4px' }}>
            ₹{Number(user?.balance || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '14px', borderRadius: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Period Credits</div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-green-light)', marginTop: '4px' }}>
            +₹{totalCredits.toLocaleString('en-IN', {minimumFractionDigits: 2})}
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '14px', borderRadius: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Period Debits</div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-red-light)', marginTop: '4px' }}>
            -₹{totalDebits.toLocaleString('en-IN', {minimumFractionDigits: 2})}
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '14px', borderRadius: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Entries</div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#fff', marginTop: '4px' }}>
            {filteredLedger.length} Records
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ maxWidth: "100%", boxSizing: "border-box",  padding: isMobile ? '12px' : '0', overflow: 'hidden', borderRadius: '12px' }}>
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading ledger...</div>
            ) : filteredLedger.length === 0 || activeSubTab === 'MTF' ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No Results Found.</div>
            ) : (
              paginatedLedger.map((entry) => (
                <div key={entry.id} style={{ padding: '12px 14px', background: 'var(--bg-hover)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {renderLedgerBadge(entry.type, entry.amount)}
                    <span style={{ fontWeight: '800', fontSize: '14px', color: Number(entry.amount) >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                      {Number(entry.amount) >= 0 ? '+' : ''}₹{Math.abs(Number(entry.amount)).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {entry.description || entry.type}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <span>{new Date(entry.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                    <span>Balance: <strong style={{ color: '#fff' }}>₹{Number(entry.running_balance).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '16px', fontWeight: '500' }}>Date & Time</th>
                <th style={{ padding: '16px', fontWeight: '500' }}>Transaction Type</th>
                <th style={{ padding: '16px', fontWeight: '500' }}>Description</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Credit (+)</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Debit (-)</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Net</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Available Balance</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ padding: '64px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</td></tr>
              ) : filteredLedger.length === 0 || activeSubTab === 'MTF' ? (
                <tr>
                  <td colSpan="7" style={{ padding: '64px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                      <div style={{ background: 'var(--bg-hover)', padding: '24px', borderRadius: '12px' }}>
                        <FileText size={48} color="var(--text-secondary)" />
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No Results Found.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLedger.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '16px' }}>
                      <div>{new Date(entry.created_at).toLocaleDateString('en-GB')}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {new Date(entry.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      {renderLedgerBadge(entry.type, entry.amount)}
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{entry.description || entry.type}</td>
                    <td style={{ padding: '16px', textAlign: 'right', color: 'var(--color-green-light)' }}>
                      {Number(entry.amount) > 0 ? `₹${Number(entry.amount).toFixed(2)}` : '-'}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', color: 'var(--color-red-light)' }}>
                      {Number(entry.amount) < 0 ? `₹${Math.abs(Number(entry.amount)).toFixed(2)}` : '-'}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: '600' }}>
                      ₹{Number(entry.amount).toFixed(2)}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: 'var(--color-blue-light)' }}>
                      ₹{Number(entry.running_balance).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filteredLedger.length} pageSize={pageSize} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. TRADES AND CHARGES COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const TradesAndCharges = () => {
  const [filterPeriod, setFilterPeriod] = useState('All');
  const [tradesPage, setTradesPage] = useState(1);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [viewMode, setViewMode] = useState('Date-Wise View');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { orders, user } = useStore(useShallow(state => ({ orders: state.orders, user: state.user })));

  const executedOrders = useMemo(() => {
    return (orders || []).filter(o => o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED');
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return executedOrders.filter(entry => {
      const entryDate = new Date(entry.created_at);
      const now = new Date();
      const diffDays = Math.ceil(Math.abs(now - entryDate) / (1000 * 60 * 60 * 24));

      if (filterPeriod === 'Custom') {
        if (customStart) {
          const start = new Date(customStart);
          start.setHours(0, 0, 0, 0);
          if (entryDate < start) return false;
        }
        if (customEnd) {
          const end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
          if (entryDate > end) return false;
        }
      } else if (filterPeriod !== 'All') {
        if (filterPeriod === 'Week' && diffDays > 7) return false;
        if (filterPeriod === '15 Days' && diffDays > 15) return false;
        if (filterPeriod === 'Month' && diffDays > 30) return false;
        if (filterPeriod === '3 Months' && diffDays > 90) return false;
      }
      return true;
    });
  }, [executedOrders, filterPeriod, customStart, customEnd]);

  const totalTrades = filteredOrders.length;
  
  let totalBrokerage = 0;
  let totalSTT = 0;
  let totalCharges = 0;
  let totalTurnover = 0;

  filteredOrders.forEach(o => {
    const ch = calculateIndianCharges(o);
    totalBrokerage += ch.brokerage;
    totalSTT += ch.stt;
    totalCharges += ch.totalCharges;
    totalTurnover += ch.tradeValue;
  });

  // Date-wise Aggregation
  const dateWiseData = useMemo(() => {
    const map = {};
    filteredOrders.forEach(o => {
      const d = new Date(o.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      if (!map[d]) map[d] = { date: d, rawDate: new Date(o.created_at), totalTrades: 0, buyQty: 0, sellQty: 0, brokerage: 0, charges: 0, turnover: 0 };
      const ch = calculateIndianCharges(o);
      map[d].totalTrades += 1;
      const isBuy = (o.side === 'BUY' || o.type === 'BUY');
      const qty = Number(o.quantity) || 0;
      if (isBuy) map[d].buyQty += qty;
      else map[d].sellQty += qty;
      map[d].brokerage += ch.brokerage;
      map[d].charges += ch.totalCharges;
      map[d].turnover += ch.tradeValue;
    });
    return Object.values(map).sort((a, b) => b.rawDate - a.rawDate);
  }, [filteredOrders]);

  // Scrip-wise Aggregation
  const scripWiseData = useMemo(() => {
    const map = {};
    filteredOrders.forEach(o => {
      const sym = o.symbol || 'UNKNOWN';
      if (!map[sym]) map[sym] = { symbol: sym, totalTrades: 0, buyQty: 0, sellQty: 0, brokerage: 0, charges: 0, turnover: 0 };
      const ch = calculateIndianCharges(o);
      map[sym].totalTrades += 1;
      const isBuy = (o.side === 'BUY' || o.type === 'BUY');
      const qty = Number(o.quantity) || 0;
      if (isBuy) map[sym].buyQty += qty;
      else map[sym].sellQty += qty;
      map[sym].brokerage += ch.brokerage;
      map[sym].charges += ch.totalCharges;
      map[sym].turnover += ch.tradeValue;
    });
    return Object.values(map).sort((a, b) => b.totalTrades - a.totalTrades);
  }, [filteredOrders]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Date Range:</span>
          <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: '6px', overflow: 'hidden' }}>
            {['Week', '15 Days', 'Month', '3 Months', 'All'].map(p => (
              <span 
                key={p} 
                onClick={() => setFilterPeriod(p)}
                style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer', background: p === filterPeriod ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: p === filterPeriod ? 'var(--color-blue-light)' : 'var(--text-secondary)' }}
              >
                {p}
              </span>
            ))}
          </div>
          <span 
            onClick={() => setFilterPeriod('Custom')}
            style={{ fontSize: '12px', color: filterPeriod === 'Custom' ? 'var(--color-blue-light)' : 'var(--text-secondary)', padding: '6px 12px', border: filterPeriod === 'Custom' ? '1px solid var(--color-blue-light)' : '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }}
          >
            Custom
          </span>
          {filterPeriod === 'Custom' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px', borderRadius: '4px', fontSize: '12px', outline: 'none', colorScheme: 'dark' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px', borderRadius: '4px', fontSize: '12px', outline: 'none', colorScheme: 'dark' }} />
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => generateTradesAndChargesReport(filteredOrders, user || {}, filterPeriod, 'excel')} 
            style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: 'var(--color-blue-light)', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={13} /> Excel (.csv)
          </button>
          <button 
            onClick={() => generateTradesAndChargesReport(filteredOrders, user || {}, filterPeriod, 'pdf')} 
            style={{ background: 'var(--color-blue)', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText size={13} /> PDF Statement
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ maxWidth: "100%", boxSizing: "border-box",  padding: '20px', borderRadius: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? '14px' : '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <div style={{ width: '38px', height: '38px', background: 'var(--bg-hover)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
               <FileText size={18} color="#60a5fa" />
             </div>
             <div>
               <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Trades</div>
               <div style={{ fontSize: '18px', fontWeight: '800' }}>{totalTrades}</div>
             </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: isMobile ? 'none' : '1px solid var(--border-color)', paddingLeft: isMobile ? '0' : '20px' }}>
             <div style={{ width: '38px', height: '38px', background: 'var(--bg-hover)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
               <Receipt size={18} color="#38bdf8" />
             </div>
             <div>
               <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Turnover</div>
               <div style={{ fontSize: '18px', fontWeight: '800' }}>₹{totalTurnover.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
             </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: isMobile ? 'none' : '1px solid var(--border-color)', paddingLeft: isMobile ? '0' : '20px' }}>
             <div style={{ width: '38px', height: '38px', background: 'var(--bg-hover)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
               <FileText size={18} color="#f59e0b" />
             </div>
             <div>
               <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Brokerage</div>
               <div style={{ fontSize: '18px', fontWeight: '800' }}>₹{totalBrokerage.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
             </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: isMobile ? 'none' : '1px solid var(--border-color)', paddingLeft: isMobile ? '0' : '20px' }}>
             <div style={{ width: '38px', height: '38px', background: 'var(--bg-hover)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
               <FileText size={18} color="#ef4444" />
             </div>
             <div>
               <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Taxes & Charges</div>
               <div style={{ fontSize: '18px', fontWeight: '800', color: '#f87171' }}>₹{totalCharges.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
             </div>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ maxWidth: "100%", boxSizing: "border-box",  padding: '24px', borderRadius: '12px' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
           <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Showing Trades and Charges Summary for current period</div>
           <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: '6px', overflow: 'hidden' }}>
              <span 
                onClick={() => setViewMode('Date-Wise View')}
                style={{ padding: '8px 16px', fontSize: '12px', cursor: 'pointer', background: viewMode === 'Date-Wise View' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: viewMode === 'Date-Wise View' ? 'var(--color-blue-light)' : 'var(--text-secondary)' }}
              >
                Date-Wise View
              </span>
              <span 
                onClick={() => setViewMode('Scrip-Wise View')}
                style={{ padding: '8px 16px', fontSize: '12px', cursor: 'pointer', background: viewMode === 'Scrip-Wise View' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: viewMode === 'Scrip-Wise View' ? 'var(--color-blue-light)' : 'var(--text-secondary)' }}
              >
                Scrip-Wise View
              </span>
           </div>
         </div>

         {isMobile ? (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
               {(viewMode === 'Date-Wise View' ? dateWiseData : scripWiseData).length === 0 ? (
                 <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No trading activity</div>
               ) : (
                 (viewMode === 'Date-Wise View' ? dateWiseData : scripWiseData).map((row, idx) => (
                   <div key={idx} style={{ padding: '14px', background: 'var(--bg-hover)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                       <span style={{ fontWeight: '700', fontSize: '13px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{viewMode === 'Date-Wise View' ? row.date : row.symbol}</span>
                       <span style={{ flexShrink: 0, fontSize: '11px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                         {row.totalTrades} Trades
                       </span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                       <span>Buy Qty: <strong style={{ color: 'var(--color-green-light)' }}>{Number(row.buyQty)}</strong></span>
                       <span>Sell Qty: <strong style={{ color: 'var(--color-red-light)' }}>{Number(row.sellQty)}</strong></span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                       <span>Brokerage: <strong style={{ color: '#fff' }}>₹{row.brokerage.toFixed(2)}</strong></span>
                       <span>Charges: <strong style={{ color: '#f87171' }}>₹{row.charges.toFixed(2)}</strong></span>
                     </div>
                   </div>
                 ))
               )}
             </div>
           ) : (
             <div style={{ overflowX: 'auto' }}>
               <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
             <thead>
               <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                 <th style={{ padding: '12px', fontWeight: '500' }}>{viewMode === 'Date-Wise View' ? 'Date' : 'Scrip'}</th>
                 <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Total Trades</th>
                 <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Buy Qty</th>
                 <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Sell Qty</th>
                 <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Turnover</th>
                 <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Brokerage</th>
                 <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Charges</th>
               </tr>
             </thead>
             <tbody>
               {viewMode === 'Date-Wise View' ? (
                 dateWiseData.length === 0 ? (
                   <tr><td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No trading activity</td></tr>
                 ) : (
                   dateWiseData.map((row, idx) => (
                     <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                       <td style={{ padding: '12px', fontWeight: '500' }}>{row.date}</td>
                       <td style={{ padding: '12px', textAlign: 'right' }}>{row.totalTrades}</td>
                       <td style={{ padding: '12px', textAlign: 'right', color: row.buyQty > 0 ? 'var(--color-green-light)' : 'inherit' }}>{row.buyQty}</td>
                       <td style={{ padding: '12px', textAlign: 'right', color: row.sellQty > 0 ? 'var(--color-red-light)' : 'inherit' }}>{row.sellQty}</td>
                       <td style={{ padding: '12px', textAlign: 'right' }}>₹{row.turnover.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                       <td style={{ padding: '12px', textAlign: 'right' }}>₹{row.brokerage.toFixed(2)}</td>
                       <td style={{ padding: '12px', textAlign: 'right', color: '#f87171' }}>₹{row.charges.toFixed(2)}</td>
                     </tr>
                   ))
                 )
               ) : (
                 scripWiseData.length === 0 ? (
                   <tr><td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No trading activity</td></tr>
                 ) : (
                   scripWiseData.map((row, idx) => (
                     <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                       <td style={{ padding: '12px', fontWeight: '500' }}><strong>{row.symbol}</strong></td>
                       <td style={{ padding: '12px', textAlign: 'right' }}>{row.totalTrades}</td>
                       <td style={{ padding: '12px', textAlign: 'right', color: row.buyQty > 0 ? 'var(--color-green-light)' : 'inherit' }}>{row.buyQty}</td>
                       <td style={{ padding: '12px', textAlign: 'right', color: row.sellQty > 0 ? 'var(--color-red-light)' : 'inherit' }}>{row.sellQty}</td>
                       <td style={{ padding: '12px', textAlign: 'right' }}>₹{row.turnover.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                       <td style={{ padding: '12px', textAlign: 'right' }}>₹{row.brokerage.toFixed(2)}</td>
                       <td style={{ padding: '12px', textAlign: 'right', color: '#f87171' }}>₹{row.charges.toFixed(2)}</td>
                     </tr>
                   ))
                 )
               )}
             </tbody>
           </table>
             </div>
           )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. PROFIT AND LOSS (P&L) COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const ProfitAndLoss = () => {
  const [filterPeriod, setFilterPeriod] = useState('Month');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [viewMode, setViewMode] = useState('Month-Wise View');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { positions, orders, user } = useStore(useShallow(state => ({ positions: state.positions, orders: state.orders, user: state.user })));

  const executedOrders = useMemo(() => {
    return (orders || []).filter(o => o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED');
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return executedOrders.filter(entry => {
      const entryDate = new Date(entry.created_at);
      const now = new Date();
      const diffDays = Math.ceil(Math.abs(now - entryDate) / (1000 * 60 * 60 * 24));

      if (filterPeriod === 'Custom') {
        if (customStart) {
          const start = new Date(customStart);
          start.setHours(0, 0, 0, 0);
          if (entryDate < start) return false;
        }
        if (customEnd) {
          const end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
          if (entryDate > end) return false;
        }
      } else if (filterPeriod !== 'All') {
        if (filterPeriod === 'Week' && diffDays > 7) return false;
        if (filterPeriod === '15 Days' && diffDays > 15) return false;
        if (filterPeriod === 'Month' && diffDays > 30) return false;
        if (filterPeriod === '3 Months' && diffDays > 90) return false;
      }
      return true;
    });
  }, [executedOrders, filterPeriod, customStart, customEnd]);

  let totalCharges = 0;
  let realizedPnl = 0;

  filteredOrders.forEach(o => {
    const ch = calculateIndianCharges(o);
    totalCharges += ch.totalCharges;
    if (o.realized_pnl !== null && o.realized_pnl !== undefined) {
      realizedPnl += parseFloat(o.realized_pnl || 0);
    }
  });
  
  const netRealizedPnl = realizedPnl - totalCharges;

  // Aggregation Logic
  const monthWiseData = useMemo(() => {
    const map = {};
    filteredOrders.forEach(o => {
      const dt = new Date(o.created_at);
      const mStr = dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      const ch = calculateIndianCharges(o);
      let pnl = (o.realized_pnl !== null && o.realized_pnl !== undefined) ? parseFloat(o.realized_pnl) : 0;

      if (!map[mStr]) map[mStr] = { name: mStr, rawDate: dt, pnl: 0, charges: 0, trades: 0 };
      map[mStr].charges += ch.totalCharges;
      map[mStr].pnl += pnl;
      map[mStr].trades += 1;
    });
    return Object.values(map).sort((a, b) => b.rawDate - a.rawDate);
  }, [filteredOrders]);

  const scripWiseData = useMemo(() => {
    const map = {};
    filteredOrders.forEach(o => {
      const sym = o.symbol || 'UNKNOWN';
      const ch = calculateIndianCharges(o);
      let pnl = (o.realized_pnl !== null && o.realized_pnl !== undefined) ? parseFloat(o.realized_pnl) : 0;

      if (!map[sym]) map[sym] = { symbol: sym, pnl: 0, charges: 0, trades: 0 };
      map[sym].charges += ch.totalCharges;
      map[sym].pnl += pnl;
      map[sym].trades += 1;
    });
    return Object.values(map).sort((a, b) => (b.pnl - b.charges) - (a.pnl - a.charges));
  }, [filteredOrders]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Date Range:</span>
          <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: '6px', overflow: 'hidden' }}>
            {['Week', '15 Days', 'Month', '3 Months', 'All'].map(p => (
              <span 
                key={p} 
                onClick={() => setFilterPeriod(p)}
                style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer', background: p === filterPeriod ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: p === filterPeriod ? 'var(--color-blue-light)' : 'var(--text-secondary)' }}
              >
                {p}
              </span>
            ))}
          </div>
          <span 
            onClick={() => setFilterPeriod('Custom')}
            style={{ fontSize: '12px', color: filterPeriod === 'Custom' ? 'var(--color-blue-light)' : 'var(--text-secondary)', padding: '6px 12px', border: filterPeriod === 'Custom' ? '1px solid var(--color-blue-light)' : '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }}
          >
            Custom
          </span>
          {filterPeriod === 'Custom' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px', borderRadius: '4px', fontSize: '12px', outline: 'none', colorScheme: 'dark' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px', borderRadius: '4px', fontSize: '12px', outline: 'none', colorScheme: 'dark' }} />
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => generatePnLSummaryReport(filteredOrders, positions || [], user || {}, filterPeriod, 'excel')} 
            style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: 'var(--color-blue-light)', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={13} /> Excel (.csv)
          </button>
          <button 
            onClick={() => generatePnLSummaryReport(filteredOrders, positions || [], user || {}, filterPeriod, 'pdf')} 
            style={{ background: 'var(--color-blue)', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText size={13} /> PDF Statement
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ maxWidth: "100%", boxSizing: "border-box",  padding: '24px', borderRadius: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? '14px' : '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <div style={{ width: '38px', height: '38px', background: 'var(--bg-hover)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
               <PieChart size={18} color="var(--color-green-light)" />
             </div>
             <div>
               <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Gross Realized P/L</div>
               <div style={{ fontSize: '18px', fontWeight: '800', color: realizedPnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                 {realizedPnl >= 0 ? '+' : ''}₹{realizedPnl.toLocaleString('en-IN', {minimumFractionDigits: 2})}
               </div>
             </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: isMobile ? 'none' : '1px solid var(--border-color)', paddingLeft: isMobile ? '0' : '24px' }}>
             <div style={{ width: '38px', height: '38px', background: 'var(--bg-hover)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
               <FileText size={18} color="var(--color-red-light)" />
             </div>
             <div>
               <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Charges & Taxes</div>
               <div style={{ fontSize: '18px', fontWeight: '800', color: '#f87171' }}>₹{totalCharges.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
             </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: isMobile ? 'none' : '1px solid var(--border-color)', paddingLeft: isMobile ? '0' : '24px' }}>
             <div style={{ width: '38px', height: '38px', background: 'var(--bg-hover)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
               <PieChart size={18} color={netRealizedPnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)'} />
             </div>
             <div>
               <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Net Realized P/L</div>
               <div style={{ fontSize: '18px', fontWeight: '800', color: netRealizedPnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                 {netRealizedPnl >= 0 ? '+' : ''}₹{netRealizedPnl.toLocaleString('en-IN', {minimumFractionDigits: 2})}
               </div>
             </div>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ maxWidth: "100%", boxSizing: "border-box",  padding: '24px', borderRadius: '12px' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
           <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Showing P&L Summary for selected period</div>
           <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: '6px', overflow: 'hidden' }}>
              <span 
                onClick={() => setViewMode('Month-Wise View')}
                style={{ padding: '8px 16px', fontSize: '12px', cursor: 'pointer', background: viewMode === 'Month-Wise View' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: viewMode === 'Month-Wise View' ? 'var(--color-blue-light)' : 'var(--text-secondary)' }}
              >
                Month-Wise View
              </span>
              <span 
                onClick={() => setViewMode('Scrip-Wise View')}
                style={{ padding: '8px 16px', fontSize: '12px', cursor: 'pointer', background: viewMode === 'Scrip-Wise View' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: viewMode === 'Scrip-Wise View' ? 'var(--color-blue-light)' : 'var(--text-secondary)' }}
              >
                Scrip-Wise View
              </span>
           </div>
         </div>

         {isMobile ? (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
               {(viewMode === 'Month-Wise View' ? monthWiseData : scripWiseData).length === 0 ? (
                 <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No trading activity</div>
               ) : (
                 (viewMode === 'Month-Wise View' ? monthWiseData : scripWiseData).map((row, idx) => {
                   const net = (row.pnl - row.charges);
                   return (
                     <div key={idx} style={{ padding: '14px', background: 'var(--bg-hover)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                         <span style={{ fontWeight: '700', fontSize: '13px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{viewMode === 'Month-Wise View' ? row.name : row.symbol}</span>
                         <span style={{ flexShrink: 0, fontWeight: '800', fontSize: '14px', color: net >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                           {net >= 0 ? '+' : ''}₹{net.toFixed(2)}
                         </span>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                         <span>Gross P&L: <strong style={{ color: row.pnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>{row.pnl >= 0 ? '+' : ''}₹{row.pnl.toFixed(2)}</strong></span>
                         <span>Charges: <strong style={{ color: '#fff' }}>₹{row.charges.toFixed(2)}</strong></span>
                       </div>
                     </div>
                   );
                 })
               )}
             </div>
           ) : (
             <div style={{ overflowX: 'auto' }}>
               <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
             <thead>
               <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                 <th style={{ padding: '12px', fontWeight: '500' }}>{viewMode === 'Month-Wise View' ? 'Month' : 'Scrip'}</th>
                 <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Trades</th>
                 <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Gross P&L</th>
                 <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Total Charges</th>
                 <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Net Realized P&L</th>
               </tr>
             </thead>
             <tbody>
               {viewMode === 'Month-Wise View' ? (
                 monthWiseData.length === 0 ? (
                   <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No trading activity</td></tr>
                 ) : (
                   monthWiseData.map((row, idx) => (
                     <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                       <td style={{ padding: '12px', fontWeight: '500' }}>{row.name}</td>
                       <td style={{ padding: '12px', textAlign: 'right' }}>{row.trades}</td>
                       <td style={{ padding: '12px', textAlign: 'right', color: row.pnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                         {row.pnl >= 0 ? '+' : ''}₹{row.pnl.toFixed(2)}
                       </td>
                       <td style={{ padding: '12px', textAlign: 'right', color: '#f87171' }}>₹{row.charges.toFixed(2)}</td>
                       <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: (row.pnl - row.charges) >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                         {(row.pnl - row.charges) >= 0 ? '+' : ''}₹{(row.pnl - row.charges).toFixed(2)}
                       </td>
                     </tr>
                   ))
                 )
               ) : (
                 scripWiseData.length === 0 ? (
                   <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No trading activity</td></tr>
                 ) : (
                   scripWiseData.map((row, idx) => (
                     <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                       <td style={{ padding: '12px', fontWeight: '500' }}><strong>{row.symbol}</strong></td>
                       <td style={{ padding: '12px', textAlign: 'right' }}>{row.trades}</td>
                       <td style={{ padding: '12px', textAlign: 'right', color: row.pnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                         {row.pnl >= 0 ? '+' : ''}₹{row.pnl.toFixed(2)}
                       </td>
                       <td style={{ padding: '12px', textAlign: 'right', color: '#f87171' }}>₹{row.charges.toFixed(2)}</td>
                       <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: (row.pnl - row.charges) >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                         {(row.pnl - row.charges) >= 0 ? '+' : ''}₹{(row.pnl - row.charges).toFixed(2)}
                       </td>
                     </tr>
                   ))
                 )
               )}
             </tbody>
           </table>
             </div>
           )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. TRADING INSIGHTS COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const TradingInsights = () => {
  const [insightsPage, setInsightsPage] = useState(1);
  const [filterPeriod, setFilterPeriod] = useState('Month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('All');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const { orders, positions, user } = useStore(useShallow(state => ({ 
    orders: state.orders,
    positions: state.positions,
    user: state.user
  })));

  const allExecutedOrders = useMemo(() => {
    return (orders || []).filter(o => o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED');
  }, [orders]);

  const executedOrders = useMemo(() => {
    return allExecutedOrders.filter(entry => {
      // Segment Filter
      if (selectedSegment !== 'All') {
        const sym = entry.symbol || '';
        if (selectedSegment === 'Equity' && (/(CE|PE|OPT|FUT|MCX)/i.test(sym))) return false;
        if (selectedSegment === 'F&O' && (!/(CE|PE|OPT|FUT)/i.test(sym) || /MCX/i.test(sym))) return false;
        if (selectedSegment === 'Commodity' && !/(MCX|GOLD|SILVER|CRUDE)/i.test(sym)) return false;
      }

      const entryDate = new Date(entry.created_at);
      const now = new Date();
      const diffDays = Math.ceil(Math.abs(now - entryDate) / (1000 * 60 * 60 * 24));

      if (filterPeriod === 'Custom') {
        if (customStart) {
          const start = new Date(customStart);
          start.setHours(0, 0, 0, 0);
          if (entryDate < start) return false;
        }
        if (customEnd) {
          const end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
          if (entryDate > end) return false;
        }
      } else if (filterPeriod !== 'All') {
        if (filterPeriod === 'Week' && diffDays > 7) return false;
        if (filterPeriod === '15 Days' && diffDays > 15) return false;
        if (filterPeriod === 'Month' && diffDays > 30) return false;
        if (filterPeriod === '3 Months' && diffDays > 90) return false;
      }
      return true;
    });
  }, [allExecutedOrders, selectedSegment, filterPeriod, customStart, customEnd]);

  let grossPnl = 0;
  let profitableTrades = 0;
  let lossTrades = 0;
  let totalTrades = 0;
  let totalGrossProfit = 0;
  let totalGrossLoss = 0;

  executedOrders.forEach(o => {
    if (o.realized_pnl !== null && o.realized_pnl !== undefined && parseFloat(o.realized_pnl) !== 0) {
      const pnl = parseFloat(o.realized_pnl);
      grossPnl += pnl;
      totalTrades++;
      if (pnl > 0) {
        profitableTrades++;
        totalGrossProfit += pnl;
      } else if (pnl < 0) {
        lossTrades++;
        totalGrossLoss += Math.abs(pnl);
      }
    }
  });

  const pnlPerDay = {};
  executedOrders.forEach(o => {
    if (o.realized_pnl !== null && o.realized_pnl !== undefined && parseFloat(o.realized_pnl) !== 0) {
      const dt = new Date(o.created_at);
      const dStr = new Date(dt.getTime() - (dt.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      if (!pnlPerDay[dStr]) pnlPerDay[dStr] = 0;
      pnlPerDay[dStr] += parseFloat(o.realized_pnl);
    }
  });

  const daysArr = Object.values(pnlPerDay);
  const totalDays = daysArr.length;
  const profitableDays = daysArr.filter(pnl => pnl > 0).length;
  const profitableDayPercent = totalDays > 0 ? ((profitableDays / totalDays) * 100).toFixed(1) + '%' : '-';

  const profitableTradePercent = totalTrades > 0 ? ((profitableTrades / totalTrades) * 100).toFixed(1) : '-';
  const profitFactor = totalGrossLoss > 0 ? (totalGrossProfit / totalGrossLoss).toFixed(2) : (totalGrossProfit > 0 ? 'MAX' : '-');

  const StatCard = ({ title, value, sub, icon: Icon, colorClass }) => (
    <div className="glass-panel hoverable" style={{ padding: isMobile ? '14px 12px' : '20px', display: 'flex', flexDirection: 'column', gap: '6px', borderRadius: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{title}</div>
        {Icon && <Icon size={16} color="var(--text-secondary)" />}
      </div>
      <div style={{ fontSize: '22px', fontWeight: '700', color: colorClass ? `var(${colorClass})` : 'white' }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header / Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
           {/* Segment Selector */}
           <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: '6px', overflow: 'hidden' }}>
             {['All', 'Equity', 'F&O', 'Commodity'].map(seg => (
               <div 
                 key={seg} 
                 onClick={() => setSelectedSegment(seg)} 
                 style={{ padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', background: selectedSegment === seg ? 'rgba(59, 130, 246, 0.25)' : 'transparent', color: selectedSegment === seg ? 'var(--color-blue-light)' : 'var(--text-secondary)' }}
               >
                 {seg}
               </div>
             ))}
           </div>

           {/* Date Range Selector */}
           <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: '6px', overflow: 'hidden' }}>
             {['Week', '15 Days', 'Month', '3 Months', 'All'].map(f => (
               <div key={f} onClick={() => setFilterPeriod(f)} style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer', background: filterPeriod === f ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: filterPeriod === f ? 'var(--color-blue-light)' : 'var(--text-secondary)' }}>
                 {f}
               </div>
             ))}
           </div>
           <span 
             onClick={() => setFilterPeriod('Custom')}
             style={{ fontSize: '12px', color: filterPeriod === 'Custom' ? 'var(--color-blue-light)' : 'var(--text-secondary)', padding: '6px 12px', border: filterPeriod === 'Custom' ? '1px solid var(--color-blue-light)' : '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', background: filterPeriod === 'Custom' ? 'rgba(59, 130, 246, 0.2)' : 'transparent' }}
           >
             Custom
           </span>
           {filterPeriod === 'Custom' && (
             <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
               <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', outline: 'none', colorScheme: 'dark' }} />
               <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>to</span>
               <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', outline: 'none', colorScheme: 'dark' }} />
             </div>
           )}
        </div>

        <button 
          onClick={() => generatePnLSummaryReport(executedOrders, positions || [], user || {}, `${selectedSegment} - ${filterPeriod}`, 'pdf')} 
          style={{ background: 'var(--color-blue)', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <FileText size={13} /> Export Insights (PDF)
        </button>
      </div>

      {/* Key Metrics */}
      <div>
        <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: 'var(--text-secondary)' }}>Key Trading Metrics ({selectedSegment})</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: isMobile ? '10px' : '16px' }}>
          <StatCard title="Gross Realized P/L" value={`${grossPnl >= 0 ? '+' : ''}₹${grossPnl.toFixed(2)}`} colorClass={grossPnl >= 0 ? '--color-green-light' : '--color-red-light'} />
          <StatCard title="Profitable Day %" value={profitableDayPercent} sub={totalDays > 0 ? totalDays + " ACTIVE DAYS" : "DAYS"} colorClass={profitableDays > (totalDays/2) ? "--color-green-light" : "--text-primary"} />
          <StatCard title="Win Rate" value={`${profitableTradePercent}%`} sub={`${profitableTrades} OF ${totalTrades} TRADES`} colorClass="--color-green-light" />
          <StatCard title="Profit Factor" value={profitFactor} icon={Target} />
        </div>
      </div>

      {/* Day Summary Progress Bar */}
      <div className="glass-panel" style={{ maxWidth: "100%", boxSizing: "border-box",  padding: isMobile ? '16px' : '24px', borderRadius: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: isMobile ? '14px' : '20px' }}>Win vs Loss Ratio</div>
        {totalTrades === 0 ? (
           <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>No executed trade data in selected period</div>
        ) : (
          <>
            <div style={{ height: '10px', display: 'flex', borderRadius: '5px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ width: `${profitableTradePercent}%`, background: 'var(--color-green-light)' }}></div>
              <div style={{ width: `${100 - parseFloat(profitableTradePercent)}%`, background: 'var(--color-red-light)' }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <div>Profitable Trades: <strong style={{ color: 'var(--color-green-light)' }}>{profitableTrades}</strong> ({profitableTradePercent}%)</div>
              <div>Loss-Making Trades: <strong style={{ color: 'var(--color-red-light)' }}>{lossTrades}</strong> ({(100 - parseFloat(profitableTradePercent)).toFixed(1)}%)</div>
            </div>
          </>
        )}
      </div>

      {/* Trades List */}
      <div className="glass-panel" style={{ maxWidth: "100%", boxSizing: "border-box",  padding: isMobile ? '16px' : '24px', overflowX: 'auto', borderRadius: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: isMobile ? '14px' : '20px' }}>Trade Execution Log</div>
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {executedOrders.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No trade data available</div>
            ) : (
              executedOrders.slice().reverse().slice((insightsPage - 1) * 50, insightsPage * 50).map((o, idx) => {
                const isPnLAvailable = o.realized_pnl !== null && o.realized_pnl !== undefined && parseFloat(o.realized_pnl) !== 0;
                const pnlVal = isPnLAvailable ? parseFloat(o.realized_pnl) : null;
                const side = o.side || o.type || 'BUY';
                return (
                  <div key={idx} style={{ padding: '12px 14px', background: 'var(--bg-hover)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                        <span style={{ flexShrink: 0, color: side === 'BUY' ? 'var(--color-blue-light)' : 'var(--color-red-light)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>
                          {side}
                        </span>
                        <span style={{ fontWeight: '700', fontSize: '13px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.symbol}</span>
                      </div>
                      <div style={{ flexShrink: 0, fontWeight: '700', fontSize: '13px', color: pnlVal > 0 ? 'var(--color-green-light)' : (pnlVal < 0 ? 'var(--color-red-light)' : 'var(--text-secondary)') }}>
                        {pnlVal !== null ? `${pnlVal > 0 ? '+' : ''}₹${pnlVal.toFixed(2)}` : '--'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span>Qty: <strong style={{ color: '#fff' }}>{Number(o.quantity || 0)}</strong> @ ₹{Number(o.average_price || o.price || 0).toFixed(2)}</span>
                      <span>{new Date(o.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '12px', fontWeight: '500' }}>Scrip Name</th>
                <th style={{ padding: '12px', fontWeight: '500' }}>Timing</th>
                <th style={{ padding: '12px', fontWeight: '500' }}>Side</th>
                <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Quantity</th>
                <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Execution Price</th>
                <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Realized P/L</th>
              </tr>
            </thead>
            <tbody>
              {executedOrders.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No trade data available</td></tr>
              ) : (
                executedOrders.slice().reverse().slice((insightsPage - 1) * 50, insightsPage * 50).map((o, idx) => {
                  const isPnLAvailable = o.realized_pnl !== null && o.realized_pnl !== undefined && parseFloat(o.realized_pnl) !== 0;
                  const pnl = isPnLAvailable ? parseFloat(o.realized_pnl).toFixed(2) : '--';
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px', fontWeight: '600' }}>{o.symbol}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{new Date(o.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                      <td style={{ padding: '12px' }}>
                         <span style={{ color: o.side === 'BUY' ? 'var(--color-blue-light)' : 'var(--color-red-light)', background: 'var(--bg-hover)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                            {o.side}
                         </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{Number(o.quantity || 0)}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>₹{Number(o.average_price || o.price || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: pnl > 0 ? 'var(--color-green-light)' : (pnl < 0 ? 'var(--color-red-light)' : 'var(--text-secondary)') }}>
                         {pnl > 0 ? '+' : ''}{pnl !== '--' ? `₹${pnl}` : pnl}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
        <Pagination currentPage={insightsPage} totalPages={Math.ceil(executedOrders.length / 50) || 1} onPageChange={setInsightsPage} totalItems={executedOrders.length} pageSize={50} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// 5. DOWNLOAD REPORTS WITH REPORT CONFIGURATION MODAL
// ─────────────────────────────────────────────────────────────────────────────
const DownloadReports = () => {
  const { positions, orders, holdings, token, user, prices } = useStore(useShallow(state => ({ 
    positions: state.positions, 
    orders: state.orders, 
    holdings: state.holdings,
    token: state.token,
    user: state.user,
    prices: state.prices
  })));

  const [activeCard, setActiveCard] = useState('tax_pnl');
  const [selectedPeriods, setSelectedPeriods] = useState({
    tax_pnl: 'FY 2025-26',
    pnl_summary: 'FY 2025-26',
    trades_charges: 'FY 2025-26',
    ledger: 'FY 2025-26'
  });
  const [contractDate, setContractDate] = useState(() => getISTDateString(new Date()));
  const [customDates, setCustomDates] = useState({
    tax_pnl: { start: '', end: '' },
    pnl_summary: { start: '', end: '' },
    trades_charges: { start: '', end: '' },
    ledger: { start: '', end: '' }
  });
  const [ledgerData, setLedgerData] = useState([]);
  const [ordersData, setOrdersData] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    fetch(`${API}/api/orders`, { headers, credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setOrdersData(data);
      })
      .catch(() => {});

    fetch(`${API}/api/ledger`, { headers, credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setLedgerData(data);
      })
      .catch(() => {});
  }, [token]);

  const effectiveOrders = ordersData.length > 0 ? ordersData : (orders || []);
  const effectiveLedger = ledgerData.length > 0 ? ledgerData : [];

  const handleDownloadAction = (reportId, format, reportTitle) => {
    const period = selectedPeriods[reportId] || 'FY 2025-26';
    const cDates = customDates[reportId] || { start: '', end: '' };

    try {
      if (reportId === 'tax_pnl') {
        generateTaxPnLReport(effectiveOrders, positions, user, period, format, cDates.start, cDates.end);
      } else if (reportId === 'pnl_summary') {
        generatePnLSummaryReport(effectiveOrders, positions, user, period, format, cDates.start, cDates.end);
      } else if (reportId === 'trades_charges') {
        generateTradesAndChargesReport(effectiveOrders, user, period, format, cDates.start, cDates.end);
      } else if (reportId === 'ledger') {
        generateLedgerReport(effectiveLedger, user, period, format, cDates.start, cDates.end);
      } else if (reportId === 'contract_note') {
        generateContractNoteReport(effectiveOrders, user, contractDate, format);
      } else if (reportId === 'dp_holdings') {
        generateDPHoldingReport(holdings, prices, user, format);
      }

      showToast(`✅ ${reportTitle} (${format.toUpperCase()}) triggered successfully!`);
    } catch (err) {
      console.error('Download error:', err);
      alert(`Could not generate statement: ${err.message || 'Unknown error'}`);
    }
  };

  const periodOptions = ['Today', 'This Week', 'This Month', 'FY 2025-26', 'FY 2024-25', 'All Time', 'Custom'];

  const reportsList = [
    {
      id: 'tax_pnl',
      title: 'Tax P&L Statement',
      desc: 'Scripwise Taxable Profit & Loss with Buy/Sell values, turnover, and STT schedule.',
      icon: FileDown,
      color: '#3b82f6',
      badge: 'Income Tax Ready'
    },
    {
      id: 'pnl_summary',
      title: 'P & L Summary Statement',
      desc: 'Segmentwise realized/unrealized P&L, gross turnover, and total regulatory charges.',
      icon: PieChart,
      color: '#10b981',
      badge: 'Segment Breakdown'
    },
    {
      id: 'trades_charges',
      title: 'Trades and Regulatory Charges',
      desc: 'Tradewise charges breakdown including Brokerage, STT/CTT, Exchange Txn Fees, GST, and Stamp Duty.',
      icon: Receipt,
      color: '#f59e0b',
      badge: 'Statutory Taxes'
    },
    {
      id: 'ledger',
      title: 'Financial Ledger Statement',
      desc: 'Daywise debits, credits, fund deposits, withdrawals, and closing ledger balance.',
      icon: Layers,
      color: '#6366f1',
      badge: 'Cash Flow'
    },
    {
      id: 'contract_note',
      title: 'Electronic Contract Note (ECN)',
      desc: 'Official daily broker contract note with trade execution times, order IDs, and net settlement pay-in/pay-out.',
      icon: FileText,
      color: '#ec4899',
      badge: 'Daily SEBI Note',
      isContractNote: true
    },
    {
      id: 'dp_holdings',
      title: 'DP & Holding Statement',
      desc: 'Complete Demat holding valuation statement with ISIN, buy average, live market prices, and unrealized gain/loss.',
      icon: Briefcase,
      color: '#8b5cf6',
      badge: 'Demat Valuation',
      isHolding: true
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Visual Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '70px',
          right: '24px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(59, 130, 246, 0.5)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          zIndex: 99999,
          fontSize: '13px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          <span>{toastMessage}</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>Official Trading Statements & Tax Reports</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Instant client-side generation in Excel (.csv), HTML, or printable PDF format
          </div>
        </div>
        <div style={{ fontSize: '11px', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(59,130,246,0.2)', fontWeight: '600' }}>
          Client: {user?.client_id || user?.id || 'SE000001'}
        </div>
      </div>

      {/* Accordion Cards Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {reportsList.map((item) => {
          const isOpen = activeCard === item.id;
          const currentPeriod = selectedPeriods[item.id] || 'FY 2025-26';
          const cDateObj = customDates[item.id] || { start: '', end: '' };
          const IconComponent = item.icon;

          return (
            <div
              key={item.id}
              style={{
                borderRadius: '12px',
                border: isOpen ? `1px solid ${item.color}66` : '1px solid rgba(255,255,255,0.08)',
                background: isOpen ? 'rgba(30, 41, 59, 0.45)' : 'rgba(15, 23, 42, 0.35)',
                boxShadow: isOpen ? `0 8px 24px rgba(0,0,0,0.3)` : 'none',
                transition: 'all 0.2s ease-in-out',
                overflow: 'hidden'
              }}
            >
              {/* Card Header Row */}
              <div
                onClick={() => setActiveCard(isOpen ? null : item.id)}
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: isOpen ? `linear-gradient(90deg, ${item.color}15, transparent)` : 'transparent'
                }}
              >
                <div style={{
                  background: `${item.color}20`,
                  color: item.color,
                  padding: '10px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <IconComponent size={22} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>{item.title}</span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: `${item.color}18`,
                      color: item.color,
                      border: `1px solid ${item.color}40`,
                      textTransform: 'uppercase'
                    }}>
                      {item.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: '1.4' }}>
                    {item.desc}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  {!item.isHolding && !item.isContractNote && (
                    <span style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '6px', fontWeight: '600' }} className="hide-on-mobile">
                      {currentPeriod}
                    </span>
                  )}
                  <button
                    type="button"
                    style={{
                      background: isOpen ? `${item.color}25` : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${isOpen ? item.color : 'rgba(255,255,255,0.1)'}`,
                      color: isOpen ? item.color : 'var(--text-primary)',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {isOpen ? '▲ HIDE' : '▼ CONFIGURE'}
                  </button>
                </div>
              </div>

              {/* Card Expand Body */}
              {isOpen && (
                <div style={{
                  padding: '16px 20px 20px 20px',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(10, 15, 29, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  {/* Period Selection Controls */}
                  {!item.isHolding && !item.isContractNote && (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '8px' }}>
                        Select Statement Time Range:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {periodOptions.map((p) => {
                          const isSel = currentPeriod === p;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPeriods(prev => ({ ...prev, [item.id]: p }));
                              }}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                fontWeight: '600',
                                border: isSel ? `1px solid ${item.color}` : '1px solid rgba(255,255,255,0.1)',
                                background: isSel ? `${item.color}25` : 'rgba(255,255,255,0.04)',
                                color: isSel ? item.color : 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>

                      {currentPeriod === 'Custom' && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px', maxWidth: '400px' }}>
                          <input
                            type="date"
                            value={cDateObj.start || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomDates(prev => ({ ...prev, [item.id]: { ...prev[item.id], start: val } }));
                            }}
                            style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', colorScheme: 'dark' }}
                          />
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>to</span>
                          <input
                            type="date"
                            value={cDateObj.end || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomDates(prev => ({ ...prev, [item.id]: { ...prev[item.id], end: val } }));
                            }}
                            style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', colorScheme: 'dark' }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Contract Note Trade Date */}
                  {item.isContractNote && (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '8px' }}>
                        Select Trade Execution Date:
                      </div>
                      <input
                        type="date"
                        value={contractDate}
                        onChange={(e) => setContractDate(e.target.value)}
                        style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontSize: '12.5px', colorScheme: 'dark', width: '220px' }}
                      />
                    </div>
                  )}

                  {/* DP Holding snapshot info */}
                  {item.isHolding && (
                    <div style={{ fontSize: '12px', color: '#94a3b8', background: 'rgba(139,92,246,0.08)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.2)' }}>
                      📊 Current Demat portfolio snapshot as on today — <strong>{holdings?.length || 0} holding(s)</strong> with real-time LTP valuation.
                    </div>
                  )}

                  {/* Action Download Buttons Row */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', paddingTop: '4px' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadAction(item.id, 'excel', item.title);
                      }}
                      style={{
                        background: 'rgba(59, 130, 246, 0.14)',
                        border: '1px solid rgba(59, 130, 246, 0.4)',
                        color: '#60a5fa',
                        padding: '10px 18px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s'
                      }}
                    >
                      <Download size={14} /> Download Excel (.csv)
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadAction(item.id, 'html', item.title);
                      }}
                      style={{
                        background: 'rgba(16, 185, 129, 0.14)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        color: '#34d399',
                        padding: '10px 18px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s'
                      }}
                    >
                      <Download size={14} /> Download HTML File
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadAction(item.id, 'pdf', item.title);
                      }}
                      style={{
                        background: item.color,
                        border: 'none',
                        color: '#fff',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: `0 4px 14px ${item.color}55`,
                        transition: 'all 0.15s'
                      }}
                    >
                      <FileText size={14} /> Print / Save as PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION HELPER
// ─────────────────────────────────────────────────────────────────────────────
function Pagination({ currentPage, totalPages, onPageChange, totalItems, pageSize = 50 }) {
  if (!totalItems || totalPages <= 1) return null;
  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalItems);

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 12px', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        Showing <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{startIdx}</span> - <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{endIdx}</span> of <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{totalItems}</span> entries
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          style={{
            padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border-color)',
            background: currentPage === 1 ? 'transparent' : 'var(--bg-hover)',
            color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '600'
          }}
        >
          Previous
        </button>

        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum;
          if (totalPages <= 5) pageNum = i + 1;
          else if (currentPage <= 3) pageNum = i + 1;
          else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
          else pageNum = currentPage - 2 + i;
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              style={{
                padding: '5px 10px', borderRadius: '6px',
                border: pageNum === currentPage ? '1px solid var(--color-blue)' : '1px solid var(--border-color)',
                background: pageNum === currentPage ? 'var(--color-blue)' : 'var(--bg-hover)',
                color: pageNum === currentPage ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: '12px', fontWeight: '700', minWidth: '32px'
              }}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          style={{
            padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border-color)',
            background: currentPage === totalPages ? 'transparent' : 'var(--bg-hover)',
            color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '600'
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN REPORTS VIEW COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ReportsView({ initialTab = 'Statement - Ledger', onBack }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    useStore.getState().fetchUserData();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const tabs = [
    'Trading Journal',
    'Trading Insights', 
    'Trades and Charges', 
    'Statement - Ledger', 
    'Profit and Loss', 
    'Download Reports'
  ];

  return (
    <div style={{ flex: 1, padding: isMobile ? '12px 10px 60px 10px' : '20px 32px 48px 32px', overflowY: 'auto', overflowX: 'hidden', background: 'var(--bg-dark)', width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div 
          onClick={onBack} 
          style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
        >
          <ArrowLeft size={18} />
        </div>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>Reports & Statements</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>View and download your official trading statements, ledger, and analytics</div>
        </div>
      </div>

      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: isMobile ? '16px' : '28px', borderBottom: '1px solid var(--border-color)', marginBottom: isMobile ? '20px' : '28px', overflowX: 'auto', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch' }} className="scrollbar-hide">
        {tabs.map(tab => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              fontSize: isMobile ? '13px' : '14px',
              fontWeight: '600',
              color: activeTab === tab ? 'var(--color-blue-light)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab ? '2px solid var(--color-blue-light)' : '2px solid transparent',
              paddingBottom: '10px',
              marginBottom: '-1px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 0.2s ease'
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ minHeight: '400px', width: '100%' }}>
        {activeTab === 'Trading Journal' && <TradingJournalView onBack={() => setActiveTab('Trading Insights')} />}
        {activeTab === 'Statement - Ledger' && <LedgerStatement />}
        {activeTab === 'Trades and Charges' && <TradesAndCharges />}
        {activeTab === 'Profit and Loss' && <ProfitAndLoss />}
        {activeTab === 'Download Reports' && <DownloadReports />}
        {activeTab === 'Trading Insights' && <TradingInsights />}
      </div>
    </div>
  );
}
