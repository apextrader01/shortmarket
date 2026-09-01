import { useShallow } from 'zustand/react/shallow';
import React, { useState, useEffect } from 'react';
import { useStore, API } from '../store';
import { FileText, PieChart, BarChart2, Download, Search, Filter, ArrowLeft, Calendar, FileDown, TrendingUp, TrendingDown, Target, Clock, Activity, AlertCircle } from 'lucide-react';

// --- Utility function for CSV Download ---
const downloadCSV = (data, filename) => {
  if (!data || data.length === 0) {
    alert("No data available to download.");
    return;
  }
  const headers = Object.keys(data[0]);
  const csvRows = [];
  csvRows.push(headers.join(','));

  for (const row of data) {
    const values = headers.map(header => {
      const escaped = ('' + row[header]).replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// --- Subcomponents for Tabs ---

const LedgerStatement = () => {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('Broking');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Filter states
  const [filterPeriod, setFilterPeriod] = useState('Week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [filterType, setFilterType] = useState('All');

  const { token, user } = useStore(useShallow(state => ({ token: state.token, user: state.user })));

  useEffect(() => {
    const fetchLedger = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/api/ledger`, {
          headers: { 'Authorization': `Bearer ${token}` }
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
  const ledgerWithBalance = React.useMemo(() => {
    if (!user || !ledger.length) return ledger;
    let currentBalance = parseFloat(user.balance || 0);
    // Ledger is sorted by created_at DESC (newest first)
    return ledger.map(entry => {
       const balanceAfter = currentBalance;
       currentBalance -= Number(entry.amount);
       return { ...entry, running_balance: balanceAfter };
    });
  }, [ledger, user]);

  // Apply filters
  const filteredLedger = ledgerWithBalance.filter(entry => {
    // Transaction type filter
    if (filterType === 'Credits' && entry.amount <= 0) return false;
    if (filterType === 'Debits' && entry.amount >= 0) return false;

    // Period filter
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
    }

    return true;
  });

  const handleDownload = () => {
    const formattedData = filteredLedger.map(entry => ({
      Date: new Date(entry.created_at).toLocaleString(),
      TransactionType: entry.type,
      Description: entry.description || entry.type,
      Credit: entry.amount > 0 ? entry.amount : 0,
      Debit: entry.amount < 0 ? Math.abs(entry.amount) : 0,
      Net: entry.amount,
      'Available Balance': entry.running_balance
    }));
    downloadCSV(formattedData, 'Ledger_Statement.csv');
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

      {/* Filters and Download */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Period:</span>
          <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: '6px', overflow: 'hidden' }}>
            {['Week', '15 Days', 'Month', '3 Months'].map(p => (
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
            <option value="All" style={{ color: '#000' }}>Transaction Type</option>
            <option value="Credits" style={{ color: '#000' }}>Credits</option>
            <option value="Debits" style={{ color: '#000' }}>Debits</option>
          </select>
        </div>
        
        <button onClick={handleDownload} style={{ background: 'transparent', border: '1px solid var(--color-blue-light)', color: 'var(--color-blue-light)', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          DOWNLOAD STATEMENT
        </button>
      </div>

      <div style={{ fontSize: '14px', fontWeight: '600' }}>
        Combined Ledger Balance <span style={{ color: 'var(--color-green-light)' }}>₹{activeSubTab === 'MTF' ? '0.00' : Number(user?.balance || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span> 
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '400', marginLeft: '8px' }}>(This includes both broking ledger balance of ₹{Number(user?.balance || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})} and MTF ledger balance of ₹0.00)</span>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ padding: isMobile ? '12px' : '0', overflow: 'hidden', borderRadius: '12px' }}>
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading ledger...</div>
            ) : filteredLedger.length === 0 || activeSubTab === 'MTF' ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No Results Found.</div>
            ) : (
              filteredLedger.map((entry) => (
                <div key={entry.id} style={{ padding: '12px 14px', background: 'var(--bg-hover)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                      {entry.type.replace('_', ' ')}
                    </span>
                    <span style={{ fontWeight: '800', fontSize: '14px', color: entry.amount >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                      {entry.amount >= 0 ? '+' : ''}₹{Math.abs(Number(entry.amount)).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {entry.description || entry.type}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <span>{new Date(entry.created_at).toLocaleString()}</span>
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
                <th style={{ padding: '16px', fontWeight: '500' }}>Date</th>
                <th style={{ padding: '16px', fontWeight: '500' }}>Transaction Type</th>
                <th style={{ padding: '16px', fontWeight: '500' }}>Description</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Credit</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Debit</th>
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
                filteredLedger.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '16px' }}>
                      <div>{new Date(entry.created_at).toLocaleDateString('en-GB')}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {new Date(entry.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>{entry.type.replace('_', ' ')}</td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{entry.description || entry.type}</td>
                    <td style={{ padding: '16px', textAlign: 'right', color: 'var(--color-green-light)' }}>
                      {entry.amount > 0 ? `₹${Number(entry.amount).toFixed(2)}` : '-'}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', color: 'var(--color-red-light)' }}>
                      {entry.amount < 0 ? `₹${Math.abs(entry.amount).toFixed(2)}` : '-'}
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
      </div>
    </div>
  );
};

const CalendarHeatmap = ({ orders }) => {
  if (!orders || orders.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '32px 0', opacity: 0.3 }}>
        <div style={{ textAlign: 'center' }}>
          <Calendar size={48} style={{ margin: '0 auto 16px auto', color: 'var(--text-secondary)' }} />
          <div style={{ fontSize: '14px' }}>Trading Activity Calendar</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            No trades recorded in this period
          </div>
        </div>
      </div>
    );
  }

  const heatmapData = {};
  orders.forEach(o => {
    const dStr = new Date(o.created_at).toISOString().split('T')[0];
    if (!heatmapData[dStr]) heatmapData[dStr] = 0;
    heatmapData[dStr] += 1;
  });

  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d);
  }

  const getColor = (count) => {
    if (count === 0) return 'var(--bg-hover)';
    if (count < 3) return 'rgba(59, 130, 246, 0.3)';
    if (count < 10) return 'rgba(59, 130, 246, 0.6)';
    return 'rgba(59, 130, 246, 1)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0' }}>
       <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', fontWeight: '600' }}>30-Day Trading Heatmap</div>
       <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxWidth: '400px', justifyContent: 'center' }}>
          {dates.map((d, i) => {
            const dStr = d.toISOString().split('T')[0];
            const count = heatmapData[dStr] || 0;
            return (
              <div 
                key={i} 
                title={`${dStr}: ${count} trades`}
                style={{
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%', 
                  background: getColor(count),
                  cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
              />
            );
          })}
       </div>
    </div>
  );
};

const TradesAndCharges = () => {
  const [filterPeriod, setFilterPeriod] = useState('15 Days');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [viewMode, setViewMode] = useState('Date-Wise View');
  const { orders } = useStore(useShallow(state => ({ orders: state.orders })));

  const executedOrders = (orders || []).filter(o => o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED');

  const filteredOrders = executedOrders.filter(entry => {
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
    } else if (filterPeriod !== 'Year') {
      if (filterPeriod === 'Week' && diffDays > 7) return false;
      if (filterPeriod === '15 Days' && diffDays > 15) return false;
      if (filterPeriod === 'Month' && diffDays > 30) return false;
      if (filterPeriod === '3 Months' && diffDays > 90) return false;
    }
    return true;
  });

  const totalTrades = filteredOrders.length;
  // Assume a dummy flat ₹20 brokerage per trade if not provided by backend
  const totalBrokerage = filteredOrders.reduce((acc, o) => acc + (o.brokerage || (o.product_type === 'DELIVERY' ? 0 : 20)), 0);
  const totalCharges = filteredOrders.reduce((acc, o) => acc + (o.charges || (o.product_type === 'DELIVERY' ? 0 : 25)), 0);

  // Date-wise Aggregation
  const dateWiseMap = {};
  filteredOrders.forEach(o => {
    const d = new Date(o.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    if (!dateWiseMap[d]) dateWiseMap[d] = { date: d, rawDate: new Date(o.created_at), totalTrades: 0, buyQty: 0, sellQty: 0, brokerage: 0, charges: 0 };
    dateWiseMap[d].totalTrades += 1;
    const isBuy = (o.side === 'BUY' || o.type === 'BUY');
    const isSell = (o.side === 'SELL' || o.type === 'SELL');
    const qty = Number(o.quantity) || 0;
    if (isBuy) dateWiseMap[d].buyQty += qty;
    if (isSell) dateWiseMap[d].sellQty += qty;
    dateWiseMap[d].brokerage += (o.brokerage || (o.product_type === 'DELIVERY' ? 0 : 20));
    dateWiseMap[d].charges += (o.charges || (o.product_type === 'DELIVERY' ? 0 : 25));
  });
  const dateWiseData = Object.values(dateWiseMap).sort((a, b) => b.rawDate - a.rawDate);

  // Scrip-wise Aggregation
  const scripWiseMap = {};
  filteredOrders.forEach(o => {
    const sym = o.symbol || 'UNKNOWN';
    if (!scripWiseMap[sym]) scripWiseMap[sym] = { symbol: sym, totalTrades: 0, buyQty: 0, sellQty: 0, brokerage: 0, charges: 0 };
    scripWiseMap[sym].totalTrades += 1;
    const isBuy = (o.side === 'BUY' || o.type === 'BUY');
    const isSell = (o.side === 'SELL' || o.type === 'SELL');
    const qty = Number(o.quantity) || 0;
    if (isBuy) scripWiseMap[sym].buyQty += qty;
    if (isSell) scripWiseMap[sym].sellQty += qty;
    scripWiseMap[sym].brokerage += (o.brokerage || (o.product_type === 'DELIVERY' ? 0 : 20));
    scripWiseMap[sym].charges += (o.charges || (o.product_type === 'DELIVERY' ? 0 : 25));
  });
  const scripWiseData = Object.values(scripWiseMap).sort((a, b) => b.totalTrades - a.totalTrades);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Date Range:</span>
          <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: '6px', overflow: 'hidden' }}>
            {['Week', '15 Days', 'Month', '3 Months'].map(p => (
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
          <div style={{ width: '32px', height: '32px', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Search size={14} color="var(--text-secondary)" /></div>
          <div style={{ width: '32px', height: '32px', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Filter size={14} color="var(--text-secondary)" /></div>
          <button onClick={() => downloadCSV(filteredOrders.length ? filteredOrders : [{Message: 'No trades'}], 'Trades_History.csv')} style={{ background: 'transparent', border: '1px solid var(--color-blue-light)', color: 'var(--color-blue-light)', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            DOWNLOAD TRADE HISTORY
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? '14px' : '24px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <div style={{ width: '38px', height: '38px', background: 'var(--bg-hover)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
               <FileText size={18} color="#60a5fa" />
             </div>
             <div>
               <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Trades</div>
               <div style={{ fontSize: '18px', fontWeight: '800' }}>{totalTrades}</div>
             </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: isMobile ? 'none' : '1px solid var(--border-color)', paddingLeft: isMobile ? '0' : '24px' }}>
             <div style={{ width: '38px', height: '38px', background: 'var(--bg-hover)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
               <FileText size={18} color="#f59e0b" />
             </div>
             <div>
               <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Brokerage</div>
               <div style={{ fontSize: '18px', fontWeight: '800' }}>₹{totalBrokerage.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
             </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: isMobile ? 'none' : '1px solid var(--border-color)', paddingLeft: isMobile ? '0' : '24px' }}>
             <div style={{ width: '38px', height: '38px', background: 'var(--bg-hover)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
               <FileText size={18} color="#ef4444" />
             </div>
             <div>
               <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Charges</div>
               <div style={{ fontSize: '18px', fontWeight: '800' }}>₹{totalCharges.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
             </div>
          </div>
        </div>

        <CalendarHeatmap orders={filteredOrders} />
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
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
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <span style={{ fontWeight: '700', fontSize: '14px', color: '#fff' }}>{viewMode === 'Date-Wise View' ? row.date : row.symbol}</span>
                       <span style={{ fontSize: '11px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                         {row.totalTrades} Trades
                       </span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                       <span>Buy Qty: <strong style={{ color: 'var(--color-green-light)' }}>{Number(row.buyQty)}</strong></span>
                       <span>Sell Qty: <strong style={{ color: 'var(--color-red-light)' }}>{Number(row.sellQty)}</strong></span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                       <span>Brokerage: <strong style={{ color: '#fff' }}>₹{row.brokerage.toFixed(2)}</strong></span>
                       <span>Charges: <strong style={{ color: '#fff' }}>₹{row.charges.toFixed(2)}</strong></span>
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
                 <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Brokerage</th>
                 <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Charges</th>
               </tr>
             </thead>
             <tbody>
               {viewMode === 'Date-Wise View' ? (
                 dateWiseData.length === 0 ? (
                   <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No trading activity</td></tr>
                 ) : (
                   dateWiseData.map((row, idx) => (
                     <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                       <td style={{ padding: '12px', fontWeight: '500' }}>{row.date}</td>
                       <td style={{ padding: '12px', textAlign: 'right' }}>{row.totalTrades}</td>
                       <td style={{ padding: '12px', textAlign: 'right', color: row.buyQty > 0 ? 'var(--color-green-light)' : 'inherit' }}>{row.buyQty}</td>
                       <td style={{ padding: '12px', textAlign: 'right', color: row.sellQty > 0 ? 'var(--color-red-light)' : 'inherit' }}>{row.sellQty}</td>
                       <td style={{ padding: '12px', textAlign: 'right' }}>₹{row.brokerage.toFixed(2)}</td>
                       <td style={{ padding: '12px', textAlign: 'right' }}>₹{row.charges.toFixed(2)}</td>
                     </tr>
                   ))
                 )
               ) : (
                 scripWiseData.length === 0 ? (
                   <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No trading activity</td></tr>
                 ) : (
                   scripWiseData.map((row, idx) => (
                     <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                       <td style={{ padding: '12px', fontWeight: '500' }}>{row.symbol}</td>
                       <td style={{ padding: '12px', textAlign: 'right' }}>{row.totalTrades}</td>
                       <td style={{ padding: '12px', textAlign: 'right', color: row.buyQty > 0 ? 'var(--color-green-light)' : 'inherit' }}>{row.buyQty}</td>
                       <td style={{ padding: '12px', textAlign: 'right', color: row.sellQty > 0 ? 'var(--color-red-light)' : 'inherit' }}>{row.sellQty}</td>
                       <td style={{ padding: '12px', textAlign: 'right' }}>₹{row.brokerage.toFixed(2)}</td>
                       <td style={{ padding: '12px', textAlign: 'right' }}>₹{row.charges.toFixed(2)}</td>
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

const PnLCalendarHeatmap = ({ positions, orders }) => {
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, data: null });

  const executedOrders = (orders || []).filter(o => o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED');
  
  if (!executedOrders || executedOrders.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '32px 0', opacity: 0.3 }}>
        <div style={{ textAlign: 'center' }}>
          <Calendar size={48} style={{ margin: '0 auto 16px auto', color: 'var(--text-secondary)' }} />
          <div style={{ fontSize: '14px' }}>P&L Activity Calendar</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>No trades recorded in this period</div>
        </div>
      </div>
    );
  }

  const dailyData = {};
  
  executedOrders.forEach(o => {
    const dt = new Date(o.created_at);
    const dStr = new Date(dt.getTime() - (dt.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    if (!dailyData[dStr]) dailyData[dStr] = { charges: 0, pnl: 0 };
    dailyData[dStr].charges += (o.charges || (o.product_type === 'DELIVERY' ? 0 : 25));
    
    // Only aggregate realized_pnl if it exists and is not zero
    if (o.realized_pnl !== null && o.realized_pnl !== undefined) {
      dailyData[dStr].pnl += (Number(o.realized_pnl) || 0);
    }
  });

  const getColor = (netPnl) => {
    if (netPnl === 0) return 'var(--bg-hover)';
    if (netPnl > 0) return 'rgba(16, 185, 129, 0.8)';
    return 'rgba(239, 68, 68, 0.8)';
  };

  const months = [];
  const now = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const days = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDay = new Date(d.getFullYear(), d.getMonth(), day);
      if (currentDay > now) break; 
      
      const localDStr = new Date(currentDay.getTime() - (currentDay.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const data = dailyData[localDStr] || { pnl: 0, charges: 0 };
      const netPnl = data.pnl - data.charges;
      const hasTrades = data.charges > 0 || data.pnl !== 0;
      
      days.push({
        dateStr: localDStr,
        netPnl: netPnl,
        pnl: data.pnl,
        charges: data.charges,
        hasTrades: hasTrades
      });
    }
    
    months.push({ name: monthName, days: days });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', width: '100%' }}>
       <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', width: '100%', paddingBottom: '8px' }}>
          {months.map((m, idx) => (
             <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '60px' }}>
               <div style={{ fontSize: '11px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>{m.name}</div>
               <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', width: '70px', alignContent: 'flex-start' }}>
                  {m.days.map((d, i) => (
                    <div 
                      key={i} 
                      onMouseEnter={(e) => {
                        if (d.hasTrades) {
                           setTooltip({ visible: true, x: e.clientX, y: e.clientY, data: d });
                        }
                      }}
                      onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, data: null })}
                      style={{
                        width: '10px', 
                        height: '10px', 
                        borderRadius: '50%', 
                        background: d.hasTrades ? getColor(d.netPnl) : 'rgba(255,255,255,0.03)',
                        cursor: d.hasTrades ? 'pointer' : 'default'
                      }}
                    />
                  ))}
               </div>
             </div>
          ))}
       </div>
       {tooltip.visible && tooltip.data && (
         <div style={{
           position: 'fixed',
           left: tooltip.x + 15,
           top: tooltip.y + 15,
           background: 'rgba(15, 23, 42, 0.95)',
           border: '1px solid var(--border-color)',
           padding: '12px',
           borderRadius: '8px',
           zIndex: 1000,
           pointerEvents: 'none',
           boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
           display: 'flex',
           flexDirection: 'column',
           gap: '4px',
           backdropFilter: 'blur(8px)',
           minWidth: '150px'
         }}>
           <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
             {new Date(tooltip.data.dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
           </div>
           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
             <span style={{ color: 'var(--text-secondary)' }}>Gross P&L:</span>
             <span style={{ color: tooltip.data.pnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
               {tooltip.data.pnl >= 0 ? '+' : ''}₹{tooltip.data.pnl.toFixed(2)}
             </span>
           </div>
           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
             <span style={{ color: 'var(--text-secondary)' }}>Charges:</span>
             <span>₹{tooltip.data.charges.toFixed(2)}</span>
           </div>
           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
             <span>Net P&L:</span>
             <span style={{ color: tooltip.data.netPnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
               {tooltip.data.netPnl >= 0 ? '+' : ''}₹{tooltip.data.netPnl.toFixed(2)}
             </span>
           </div>
         </div>
       )}
    </div>
  );
};

const ProfitAndLoss = () => {
  const [filterPeriod, setFilterPeriod] = useState('Year');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [viewMode, setViewMode] = useState('Month-Wise View');
  const { positions, orders } = useStore(useShallow(state => ({ positions: state.positions, orders: state.orders })));

  const filteredPositions = (positions || []).filter(entry => {
    const entryDate = new Date(entry.updated_at || entry.created_at);
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
    } else if (filterPeriod !== 'Year') {
      if (filterPeriod === 'Week' && diffDays > 7) return false;
      if (filterPeriod === '15 Days' && diffDays > 15) return false;
      if (filterPeriod === 'Month' && diffDays > 30) return false;
      if (filterPeriod === '3 Months' && diffDays > 90) return false;
    }
    return true;
  });

  const allExecutedOrders = (orders || []).filter(o => o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED');
  const executedOrders = allExecutedOrders.filter(entry => {
      const entryDate = new Date(entry.created_at);
      const now = new Date();
      const diffDays = Math.ceil(Math.abs(now - entryDate) / (1000 * 60 * 60 * 24));
      if (filterPeriod === 'Week' && diffDays > 7) return false;
      if (filterPeriod === '15 Days' && diffDays > 15) return false;
      if (filterPeriod === 'Month' && diffDays > 30) return false;
      if (filterPeriod === '3 Months' && diffDays > 90) return false;
      return true;
  });
  const filteredOrders = executedOrders.filter(entry => {
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
    } else if (filterPeriod !== 'Year') {
      if (filterPeriod === 'Week' && diffDays > 7) return false;
      if (filterPeriod === '15 Days' && diffDays > 15) return false;
      if (filterPeriod === 'Month' && diffDays > 30) return false;
      if (filterPeriod === '3 Months' && diffDays > 90) return false;
    }
    return true;
  });

  const totalCharges = filteredOrders.reduce((acc, o) => acc + (o.charges || (o.product_type === 'DELIVERY' ? 0 : 25)), 0);
  
  const realizedPnl = filteredOrders.reduce((acc, o) => {
    if (o.realized_pnl !== null && o.realized_pnl !== undefined && parseFloat(o.realized_pnl) !== 0) {
      return acc + parseFloat(o.realized_pnl);
    }
    return acc;
  }, 0);
  
  const netRealizedPnl = realizedPnl - totalCharges;

  // Aggregation Logic
  const monthWiseMap = {};
  const scripWiseMap = {};

  filteredOrders.forEach(o => {
    const dt = new Date(o.created_at);
    const mStr = dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    const sym = o.symbol || 'UNKNOWN';
    const c = (o.charges || (o.product_type === 'DELIVERY' ? 0 : 25));
    let pnl = 0;

    if (o.realized_pnl !== null && o.realized_pnl !== undefined && parseFloat(o.realized_pnl) !== 0) {
      pnl = parseFloat(o.realized_pnl);
    }

    if (!monthWiseMap[mStr]) monthWiseMap[mStr] = { name: mStr, rawDate: dt, pnl: 0, charges: 0 };
    monthWiseMap[mStr].charges += c;
    monthWiseMap[mStr].pnl += pnl;

    if (!scripWiseMap[sym]) scripWiseMap[sym] = { symbol: sym, pnl: 0, charges: 0 };
    scripWiseMap[sym].charges += c;
    scripWiseMap[sym].pnl += pnl;
  });

  const monthWiseData = Object.values(monthWiseMap).sort((a, b) => b.rawDate - a.rawDate);
  const scripWiseData = Object.values(scripWiseMap).sort((a, b) => (b.pnl - b.charges) - (a.pnl - a.charges));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Date Range:</span>
          <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: '6px', overflow: 'hidden' }}>
            {['Week', '15 Days', 'Month', '3 Months', 'Year'].map(p => (
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
          <div style={{ width: '32px', height: '32px', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Search size={14} color="var(--text-secondary)" /></div>
          <div style={{ width: '32px', height: '32px', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Filter size={14} color="var(--text-secondary)" /></div>
          <button onClick={() => {
            const exportData = scripWiseData.length > 0 ? scripWiseData.map(s => ({
              Scrip: s.symbol,
              'Gross P&L': s.pnl.toFixed(2),
              'Total Charges': s.charges.toFixed(2),
              'Net Realized P&L': (s.pnl - s.charges).toFixed(2)
            })) : [{Message: 'No PnL'}];
            downloadCSV(exportData, 'PnL_Statement.csv');
          }} style={{ background: 'transparent', border: '1px solid var(--color-blue-light)', color: 'var(--color-blue-light)', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            DOWNLOAD P/L STATEMENT
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? '14px' : '24px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <div style={{ width: '38px', height: '38px', background: 'var(--bg-hover)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
               <PieChart size={18} color="var(--color-green-light)" />
             </div>
             <div>
               <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Realized P/L</div>
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
               <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Charges</div>
               <div style={{ fontSize: '18px', fontWeight: '800' }}>₹{totalCharges.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
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
        <PnLCalendarHeatmap positions={filteredPositions} orders={filteredOrders} />
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
           <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Showing P&L Summary for current period</div>
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
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontWeight: '700', fontSize: '13px', color: '#fff' }}>{viewMode === 'Month-Wise View' ? row.name : row.symbol}</span>
                         <span style={{ fontWeight: '800', fontSize: '14px', color: net >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
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
                 <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Gross P&L</th>
                 <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Total Charges</th>
                 <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Net Realized P&L</th>
               </tr>
             </thead>
             <tbody>
               {viewMode === 'Month-Wise View' ? (
                 monthWiseData.length === 0 ? (
                   <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No trading activity</td></tr>
                 ) : (
                   monthWiseData.map((row, idx) => (
                     <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                       <td style={{ padding: '12px', fontWeight: '500' }}>{row.name}</td>
                       <td style={{ padding: '12px', textAlign: 'right', color: row.pnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                         {row.pnl >= 0 ? '+' : ''}₹{row.pnl.toFixed(2)}
                       </td>
                       <td style={{ padding: '12px', textAlign: 'right' }}>₹{row.charges.toFixed(2)}</td>
                       <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: (row.pnl - row.charges) >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                         {(row.pnl - row.charges) >= 0 ? '+' : ''}₹{(row.pnl - row.charges).toFixed(2)}
                       </td>
                     </tr>
                   ))
                 )
               ) : (
                 scripWiseData.length === 0 ? (
                   <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No trading activity</td></tr>
                 ) : (
                   scripWiseData.map((row, idx) => (
                     <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                       <td style={{ padding: '12px', fontWeight: '500' }}>{row.symbol}</td>
                       <td style={{ padding: '12px', textAlign: 'right', color: row.pnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                         {row.pnl >= 0 ? '+' : ''}₹{row.pnl.toFixed(2)}
                       </td>
                       <td style={{ padding: '12px', textAlign: 'right' }}>₹{row.charges.toFixed(2)}</td>
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

const DownloadReports = () => {
  const { positions, orders, holdings, token } = useStore(useShallow(state => ({ 
    positions: state.positions, 
    orders: state.orders, 
    holdings: state.holdings,
    token: state.token
  })));

  const handleDownloadTaxPnL = () => {
    const data = (positions || []).map(p => ({
      Symbol: p.symbol,
      Product: p.product_type,
      Realized_PnL: parseFloat(p.realized_pnl || 0).toFixed(2),
      Status: p.quantity === 0 ? 'CLOSED' : 'OPEN'
    }));
    downloadCSV(data, 'tax_pnl_report.csv');
  };

  const handleDownloadPnLSummary = () => {
    const data = (positions || []).map(p => {
      const pnl = p.pnl || 0;
      const realized = parseFloat(p.realized_pnl || 0);
      return {
        Symbol: p.symbol,
        Buy_Avg: p.average_price,
        Quantity: p.quantity,
        Realized_PnL: realized.toFixed(2),
        Unrealized_PnL: pnl.toFixed(2),
        Total_PnL: (pnl + realized).toFixed(2)
      };
    });
    downloadCSV(data, 'pnl_summary.csv');
  };

  const handleDownloadTrades = () => {
    const executed = (orders || []).filter(o => o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED');
    const data = executed.map(o => ({
      Date: new Date(o.created_at).toLocaleString(),
      Symbol: o.symbol,
      Type: o.side,
      Quantity: o.quantity,
      Price: o.average_price || o.price,
      Charges: (o.charges || (o.product_type === 'DELIVERY' ? 0 : 25)).toFixed(2)
    }));
    downloadCSV(data, 'trades_and_charges.csv');
  };

  const handleDownloadLedger = async () => {
    try {
      const res = await fetch(`${API}/api/ledger`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const ledger = await res.json();
      if (!ledger || ledger.length === 0) return alert('No ledger data found');
      const data = ledger.map(l => ({
        Date: new Date(l.created_at).toLocaleString(),
        Description: l.description,
        Amount: l.amount,
        Type: l.type,
        Balance: l.balance
      }));
      downloadCSV(data, 'ledger_statement.csv');
    } catch(e) {
      alert('Failed to download ledger');
    }
  };

  const handleDownloadContractNote = () => {
    const executed = (orders || []).filter(o => o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED');
    const data = executed.map(o => ({
      Trade_Date: new Date(o.created_at).toLocaleDateString(),
      Trade_Time: new Date(o.created_at).toLocaleTimeString(),
      Symbol: o.symbol,
      Action: o.side,
      Quantity: o.quantity,
      Execution_Price: o.average_price || o.price,
      Order_ID: o.id,
      Product: o.product_type
    }));
    downloadCSV(data, 'contract_note.csv');
  };

  const handleDownloadHoldings = () => {
    const data = (holdings || []).map(h => ({
      Symbol: h.symbol,
      Quantity: h.quantity,
      Average_Price: h.average_price,
      Invested_Value: (h.quantity * h.average_price).toFixed(2)
    }));
    downloadCSV(data, 'dp_holdings.csv');
  };

  const Card = ({ icon: Icon, title, desc, onClick }) => (
    <div className="glass-panel hoverable" onClick={onClick} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ background: 'var(--bg-hover)', padding: '12px', borderRadius: '50%' }}>
          <Icon size={24} color="var(--color-blue-light)" />
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>{title}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{desc}</div>
        </div>
      </div>
      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-blue-light)', cursor: 'pointer', marginTop: 'auto' }}>DOWNLOAD REPORT</div>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '24px' }}>Stocks, SGBs, Bonds and FnO</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
        <Card icon={FileDown} title="Tax P&L" desc="Scripwise Taxable P&L" onClick={handleDownloadTaxPnL} />
        <Card icon={FileText} title="P & L Summary" desc="Entire P&L (taxable and non-taxable)" onClick={handleDownloadPnLSummary} />
        <Card icon={FileText} title="Trades and Charges" desc="Tradewise charges and details" onClick={handleDownloadTrades} />
        <Card icon={FileText} title="Ledger" desc="Daywise Debits, Credits and Net Balances" onClick={handleDownloadLedger} />
        <Card icon={FileText} title="Contract Note" desc="Trade details of the day" onClick={handleDownloadContractNote} />
        <Card icon={FileText} title="DP Transaction and Holding Statement" desc="Scripwise list of transactions" onClick={handleDownloadHoldings} />
      </div>
    </div>
  );
};

const TradingInsights = () => {
  const [filterPeriod, setFilterPeriod] = useState('Month');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const { positions, orders } = useStore(useShallow(state => ({ 
    positions: state.positions, 
    orders: state.orders 
  })));

  // Daily orders (for Day Trades list)
  const allExecutedOrders = (orders || []).filter(o => o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED');
  const executedOrders = allExecutedOrders.filter(entry => {
      const entryDate = new Date(entry.created_at);
      const now = new Date();
      const diffDays = Math.ceil(Math.abs(now - entryDate) / (1000 * 60 * 60 * 24));
      if (filterPeriod === 'Week' && diffDays > 7) return false;
      if (filterPeriod === '15 Days' && diffDays > 15) return false;
      if (filterPeriod === 'Month' && diffDays > 30) return false;
      if (filterPeriod === '3 Months' && diffDays > 90) return false;
      return true;
  });

  // Aggregate metrics from historical orders instead of positions (since positions are wiped at EOD)
  let grossPnl = 0;
  let profitableTrades = 0;
  let lossTrades = 0;
  let totalTrades = 0;
  let totalGrossProfit = 0;
  let totalGrossLoss = 0;

  executedOrders.forEach(o => {
    // Only count orders that generated a realized PnL
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

  let totalHoldingSeconds = 0;
  let totalHoldingTrades = 0;
  const symbolOrders = {};
  executedOrders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(o => {
    if (!symbolOrders[o.symbol]) symbolOrders[o.symbol] = [];
    symbolOrders[o.symbol].push(o);
  });

  Object.values(symbolOrders).forEach(ordersList => {
    let positionQty = 0;
    let entryOrders = [];
    ordersList.forEach(o => {
       const qty = Number(o.quantity);
       const isBuy = o.side === 'BUY';
       const time = new Date(o.created_at).getTime();
       if (positionQty === 0) {
         entryOrders.push({ qty, time });
         positionQty = isBuy ? qty : -qty;
       } else if ((positionQty > 0 && isBuy) || (positionQty < 0 && !isBuy)) {
         entryOrders.push({ qty, time });
         positionQty += (isBuy ? qty : -qty);
       } else {
         let remainingCloseQty = qty;
         while (remainingCloseQty > 0 && entryOrders.length > 0) {
           const firstEntry = entryOrders[0];
           const closeQty = Math.min(firstEntry.qty, remainingCloseQty);
           const holdingTimeMs = time - firstEntry.time;
           totalHoldingSeconds += (holdingTimeMs / 1000) * closeQty;
           totalHoldingTrades += closeQty;
           firstEntry.qty -= closeQty;
           remainingCloseQty -= closeQty;
           if (firstEntry.qty === 0) entryOrders.shift();
         }
         positionQty += (isBuy ? qty : -qty);
         if (remainingCloseQty > 0) entryOrders.push({ qty: remainingCloseQty, time });
       }
    });
  });

  const formatHoldingTime = (seconds) => {
    if (!seconds && seconds !== 0) return '-';
    if (seconds < 60) return Math.round(seconds) + 's';
    const mins = seconds / 60;
    if (mins < 60) return Math.round(mins) + 'm';
    const hours = mins / 60;
    if (hours < 24) return Math.round(hours) + 'h';
    return Math.round(hours / 24) + 'd';
  };
  const avgHoldingTime = totalHoldingTrades > 0 ? formatHoldingTime(totalHoldingSeconds / totalHoldingTrades) : '-';

  const profitableTradePercent = totalTrades > 0 ? ((profitableTrades / totalTrades) * 100).toFixed(1) : '-';
  const profitFactor = totalGrossLoss > 0 ? (totalGrossProfit / totalGrossLoss).toFixed(2) : (totalGrossProfit > 0 ? 'MAX' : '-');

  const StatCard = ({ title, value, sub, icon: Icon, colorClass }) => (
    <div className="glass-panel hoverable" style={{ padding: isMobile ? '14px 12px' : '20px', display: 'flex', flexDirection: 'column', gap: '6px', borderRadius: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{title}</div>
        {Icon && <Icon size={16} color="var(--text-secondary)" />}
      </div>
      <div style={{ fontSize: '24px', fontWeight: '700', color: colorClass ? `var(${colorClass})` : 'white' }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header / Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
           <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Instrument: <span style={{ color: 'var(--color-blue-light)' }}>F/O Trading Insights</span></div>
           <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: '6px', overflow: 'hidden' }}>
             {['Week', '15 Days', 'Month', '3 Months', 'Custom'].map(f => (
               <div key={f} onClick={() => setFilterPeriod(f)} style={{ padding: '8px 16px', fontSize: '12px', cursor: 'pointer', background: filterPeriod === f ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: filterPeriod === f ? 'var(--color-blue-light)' : 'var(--text-secondary)' }}>
                 {f}
               </div>
             ))}
           </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div>
        <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px' }}>F&O Key Metrics</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: isMobile ? '10px' : '16px' }}>
          <StatCard title="Gross P/L" value={`${grossPnl >= 0 ? '+' : ''}₹${grossPnl.toFixed(2)}`} colorClass={grossPnl >= 0 ? '--color-green-light' : '--color-red-light'} />
          <StatCard title="Profitable Day %" value={profitableDayPercent} sub={totalDays > 0 ? totalDays + " DAYS" : "DAYS"} colorClass={profitableDays > (totalDays/2) ? "--color-green-light" : "--text-primary"} />
          <StatCard title="Profitable Trade %" value={`${profitableTradePercent}%`} sub={`${profitableTrades} TRADES`} colorClass="--color-green-light" />
          <StatCard title="Profit Factor" value={profitFactor} icon={Target} />
          <StatCard title="Avg. Holding Time" value={avgHoldingTime} icon={Clock} />
        </div>
      </div>

      {/* Day Summary Progress Bar */}
      <div className="glass-panel" style={{ padding: isMobile ? '16px' : '24px', borderRadius: '12px' }}>
        <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: isMobile ? '14px' : '24px' }}>Day Summary</div>
        {totalTrades === 0 ? (
           <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>No trade data</div>
        ) : (
          <>
            <div style={{ height: '8px', display: 'flex', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ width: `${profitableTradePercent}%`, background: 'var(--color-green-light)' }}></div>
              <div style={{ width: `${100 - parseFloat(profitableTradePercent)}%`, background: 'var(--color-red-light)' }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <div>Profitable Trades ({profitableTrades})</div>
              <div>Loss Making Trades ({lossTrades})</div>
            </div>
          </>
        )}
      </div>

      {/* Heatmap */}
      <div className="glass-panel" style={{ padding: isMobile ? '16px' : '24px', borderRadius: '12px' }}>
         <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: isMobile ? '14px' : '24px' }}>Performance</div>
         <PnLCalendarHeatmap positions={positions} orders={orders} />
      </div>

      {/* Trades List */}
      <div className="glass-panel" style={{ padding: isMobile ? '16px' : '24px', overflowX: 'auto', borderRadius: '12px' }}>
        <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: isMobile ? '14px' : '24px' }}>Per Day Trade Summary</div>
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {executedOrders.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No trade data available</div>
            ) : (
              executedOrders.slice().reverse().slice(0, 50).map((o, idx) => {
                const isPnLAvailable = o.realized_pnl !== null && o.realized_pnl !== undefined && parseFloat(o.realized_pnl) !== 0;
                const pnlVal = isPnLAvailable ? parseFloat(o.realized_pnl) : null;
                const side = o.side || o.type || 'BUY';
                return (
                  <div key={idx} style={{ padding: '12px 14px', background: 'var(--bg-hover)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: side === 'BUY' ? 'var(--color-blue-light)' : 'var(--color-red-light)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>
                          {side}
                        </span>
                        <span style={{ fontWeight: '700', fontSize: '13px', color: '#fff' }}>{o.symbol}</span>
                      </div>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: pnlVal > 0 ? 'var(--color-green-light)' : (pnlVal < 0 ? 'var(--color-red-light)' : 'var(--text-secondary)') }}>
                        {pnlVal !== null ? `${pnlVal > 0 ? '+' : ''}₹${pnlVal.toFixed(2)}` : '--'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span>Qty: <strong style={{ color: '#fff' }}>{Number(o.quantity || 0)}</strong></span>
                      <span>{new Date(o.created_at).toLocaleString()}</span>
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
                <th style={{ padding: '12px', fontWeight: '500' }}>Type</th>
                <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Quantity</th>
                <th style={{ padding: '12px', fontWeight: '500', textAlign: 'right' }}>Net P/L</th>
              </tr>
            </thead>
            <tbody>
              {executedOrders.length === 0 ? (
                <tr><td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No trade data available</td></tr>
              ) : (
                executedOrders.slice().reverse().slice(0, 50).map((o, idx) => {
                  const isPnLAvailable = o.realized_pnl !== null && o.realized_pnl !== undefined && parseFloat(o.realized_pnl) !== 0;
                  const pnl = isPnLAvailable ? parseFloat(o.realized_pnl).toFixed(2) : '--';
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px', fontWeight: '500' }}>{o.symbol}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{new Date(o.created_at).toLocaleString()}</td>
                      <td style={{ padding: '12px' }}>
                         <span style={{ color: o.side === 'BUY' ? 'var(--color-blue-light)' : 'var(--color-red-light)', background: 'var(--bg-hover)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                            {o.side}
                         </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{Number(o.quantity || 0)}</td>
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
      </div>
    </div>
  );
};

// --- Main ReportsView Component ---

export default function ReportsView({ initialTab = 'Statement - Ledger', onBack }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const tabs = [
    'Trading Insights', 
    'Trades and Charges', 
    'Statement - Ledger', 
    'Profit and Loss', 
    'Download Reports'
  ];

  return (
    <div style={{ flex: 1, padding: isMobile ? '12px 8px 60px 8px' : '32px', overflowY: 'auto', background: 'var(--bg-dark)', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <div 
          onClick={onBack} 
          style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ArrowLeft size={16} />
        </div>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Reports</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>View and download your account statements</div>
        </div>
      </div>

      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: isMobile ? '16px' : '28px', borderBottom: '1px solid var(--border-color)', marginBottom: isMobile ? '20px' : '32px', overflowX: 'auto', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch' }} className="scrollbar-hide">
        {tabs.map(tab => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              fontSize: isMobile ? '13px' : '14px',
              fontWeight: '600',
              color: activeTab === tab ? 'var(--color-blue)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab ? '2px solid var(--color-blue)' : '2px solid transparent',
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
      <div style={{ minHeight: '400px' }}>
        {activeTab === 'Statement - Ledger' && <LedgerStatement />}
        {activeTab === 'Trades and Charges' && <TradesAndCharges />}
        {activeTab === 'Profit and Loss' && <ProfitAndLoss />}
        {activeTab === 'Download Reports' && <DownloadReports />}
        {activeTab === 'Trading Insights' && <TradingInsights />}
      </div>
    </div>
  );
}








