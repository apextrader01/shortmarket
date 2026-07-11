import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { FileText, PieChart, BarChart2, Download, Search, Filter, ArrowLeft, Calendar, FileDown } from 'lucide-react';

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
  
  // Filter states
  const [filterPeriod, setFilterPeriod] = useState('Week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [filterType, setFilterType] = useState('All');

  const { token } = useStore();

  useEffect(() => {
    const fetchLedger = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/ledger', {
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

  // Apply filters
  const filteredLedger = ledger.filter(entry => {
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
      Net: entry.amount
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Period:</span>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
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
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#FFF', padding: '4px', borderRadius: '4px', fontSize: '12px', outline: 'none', colorScheme: 'dark' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#FFF', padding: '4px', borderRadius: '4px', fontSize: '12px', outline: 'none', colorScheme: 'dark' }} />
            </div>
          )}
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#FFF', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
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
        Combined Ledger Balance <span style={{ color: 'var(--color-green-light)' }}>₹{activeSubTab === 'MTF' ? '0.00' : (filteredLedger.reduce((acc, curr) => acc + Number(curr.amount), 0)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span> 
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '400', marginLeft: '8px' }}>(This includes both broking ledger balance of ₹{(filteredLedger.reduce((acc, curr) => acc + Number(curr.amount), 0)).toLocaleString('en-IN', {minimumFractionDigits: 2})} and MTF ledger balance of ₹0.00)</span>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '16px', fontWeight: '500' }}>Date</th>
              <th style={{ padding: '16px', fontWeight: '500' }}>Transaction Type</th>
              <th style={{ padding: '16px', fontWeight: '500' }}>Description</th>
              <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Credit</th>
              <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Debit</th>
              <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Net</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ padding: '64px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</td></tr>
            ) : filteredLedger.length === 0 || activeSubTab === 'MTF' ? (
              <tr>
                <td colSpan="6" style={{ padding: '64px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '12px' }}>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
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
    if (count === 0) return 'rgba(255,255,255,0.05)';
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
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [viewMode, setViewMode] = useState('Date-Wise View');
  const { orders } = useStore();

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
    if (o.type === 'BUY') dateWiseMap[d].buyQty += (o.quantity || 0);
    if (o.type === 'SELL') dateWiseMap[d].sellQty += (o.quantity || 0);
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
    if (o.type === 'BUY') scripWiseMap[sym].buyQty += (o.quantity || 0);
    if (o.type === 'SELL') scripWiseMap[sym].sellQty += (o.quantity || 0);
    scripWiseMap[sym].brokerage += (o.brokerage || (o.product_type === 'DELIVERY' ? 0 : 20));
    scripWiseMap[sym].charges += (o.charges || (o.product_type === 'DELIVERY' ? 0 : 25));
  });
  const scripWiseData = Object.values(scripWiseMap).sort((a, b) => b.totalTrades - a.totalTrades);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Date Range:</span>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
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
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#FFF', padding: '4px', borderRadius: '4px', fontSize: '12px', outline: 'none', colorScheme: 'dark' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#FFF', padding: '4px', borderRadius: '4px', fontSize: '12px', outline: 'none', colorScheme: 'dark' }} />
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Search size={14} color="var(--text-secondary)" /></div>
          <div style={{ width: '32px', height: '32px', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Filter size={14} color="var(--text-secondary)" /></div>
          <button onClick={() => downloadCSV(filteredOrders.length ? filteredOrders : [{Message: 'No trades'}], 'Trades_History.csv')} style={{ background: 'transparent', border: '1px solid var(--color-blue-light)', color: 'var(--color-blue-light)', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            DOWNLOAD TRADE HISTORY
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <FileText size={18} color="var(--color-purple)" />
             </div>
             <div>
               <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Trades ⓘ</div>
               <div style={{ fontSize: '16px', fontWeight: '700' }}>{totalTrades}</div>
             </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
             <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <FileText size={18} color="var(--color-purple)" />
             </div>
             <div>
               <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Brokerage ⓘ</div>
               <div style={{ fontSize: '16px', fontWeight: '700' }}>₹{totalBrokerage.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
             </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
             <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <FileText size={18} color="var(--color-purple)" />
             </div>
             <div>
               <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Charges ⓘ</div>
               <div style={{ fontSize: '16px', fontWeight: '700' }}>₹{totalCharges.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
             </div>
          </div>
        </div>

        <CalendarHeatmap orders={filteredOrders} />
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
           <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Showing Trades and Charges Summary for current period</div>
           <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
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
      </div>
    </div>
  );
};

const PnLCalendarHeatmap = ({ positions, orders }) => {
  if (!positions || positions.length === 0) {
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
  
  (orders || []).forEach(o => {
    const dt = new Date(o.created_at);
    const dStr = new Date(dt.getTime() - (dt.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    if (!dailyData[dStr]) dailyData[dStr] = { charges: 0, pnl: 0 };
    dailyData[dStr].charges += (o.charges || (o.product_type === 'DELIVERY' ? 0 : 25));
  });

  (positions || []).forEach(p => {
    const dt = new Date(p.updated_at || p.created_at);
    const dStr = new Date(dt.getTime() - (dt.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    if (!dailyData[dStr]) dailyData[dStr] = { charges: 0, pnl: 0 };
    dailyData[dStr].pnl += (Number(p.realized_pnl) || 0);
  });

  const getColor = (netPnl) => {
    if (netPnl === 0) return 'rgba(255,255,255,0.05)';
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
                      title={d.hasTrades ? `${d.dateStr}: Net PnL ₹${d.netPnl.toFixed(2)}` : `${d.dateStr}: No trades`}
                      style={{
                        width: '10px', 
                        height: '10px', 
                        borderRadius: '50%', 
                        background: d.hasTrades ? getColor(d.netPnl) : 'rgba(255,255,255,0.03)',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
               </div>
             </div>
          ))}
       </div>
    </div>
  );
};

const ProfitAndLoss = () => {
  const [filterPeriod, setFilterPeriod] = useState('Year');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [viewMode, setViewMode] = useState('Month-Wise View');
  const { positions, orders } = useStore();

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

  const totalCharges = filteredOrders.reduce((acc, o) => acc + (o.charges || (o.product_type === 'DELIVERY' ? 0 : 25)), 0);
  const realizedPnl = filteredPositions.reduce((acc, p) => acc + (Number(p.realized_pnl) || 0), 0);
  const netRealizedPnl = realizedPnl - totalCharges;

  // Aggregation Logic
  const monthWiseMap = {};
  const scripWiseMap = {};

  filteredPositions.forEach(p => {
    const dt = new Date(p.updated_at || p.created_at);
    const mStr = dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    const sym = p.symbol || 'UNKNOWN';

    if (!monthWiseMap[mStr]) monthWiseMap[mStr] = { name: mStr, rawDate: dt, pnl: 0, charges: 0 };
    monthWiseMap[mStr].pnl += (Number(p.realized_pnl) || 0);

    if (!scripWiseMap[sym]) scripWiseMap[sym] = { symbol: sym, pnl: 0, charges: 0 };
    scripWiseMap[sym].pnl += (Number(p.realized_pnl) || 0);
  });

  filteredOrders.forEach(o => {
    const dt = new Date(o.created_at);
    const mStr = dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    const sym = o.symbol || 'UNKNOWN';
    const c = (o.charges || (o.product_type === 'DELIVERY' ? 0 : 25));

    if (!monthWiseMap[mStr]) monthWiseMap[mStr] = { name: mStr, rawDate: dt, pnl: 0, charges: 0 };
    monthWiseMap[mStr].charges += c;

    if (!scripWiseMap[sym]) scripWiseMap[sym] = { symbol: sym, pnl: 0, charges: 0 };
    scripWiseMap[sym].charges += c;
  });

  const monthWiseData = Object.values(monthWiseMap).sort((a, b) => b.rawDate - a.rawDate);
  const scripWiseData = Object.values(scripWiseMap).sort((a, b) => (b.pnl - b.charges) - (a.pnl - a.charges));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Date Range:</span>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
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
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#FFF', padding: '4px', borderRadius: '4px', fontSize: '12px', outline: 'none', colorScheme: 'dark' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#FFF', padding: '4px', borderRadius: '4px', fontSize: '12px', outline: 'none', colorScheme: 'dark' }} />
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Search size={14} color="var(--text-secondary)" /></div>
          <div style={{ width: '32px', height: '32px', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Filter size={14} color="var(--text-secondary)" /></div>
          <button onClick={() => downloadCSV(filteredPositions.length ? filteredPositions : [{Message: 'No PnL'}], 'PnL_Statement.csv')} style={{ background: 'transparent', border: '1px solid var(--color-blue-light)', color: 'var(--color-blue-light)', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            DOWNLOAD P/L STATEMENT
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <PieChart size={18} color="var(--color-green-light)" />
             </div>
             <div>
               <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Realized P/L ⓘ</div>
               <div style={{ fontSize: '16px', fontWeight: '700', color: realizedPnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                 {realizedPnl >= 0 ? '+' : ''}₹{realizedPnl.toLocaleString('en-IN', {minimumFractionDigits: 2})}
               </div>
             </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
             <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <FileText size={18} color="var(--color-red-light)" />
             </div>
             <div>
               <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Charges ⓘ</div>
               <div style={{ fontSize: '16px', fontWeight: '700' }}>₹{totalCharges.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
             </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
             <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <PieChart size={18} color="var(--color-green-light)" />
             </div>
             <div>
               <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Net Realized P/L ⓘ</div>
               <div style={{ fontSize: '16px', fontWeight: '700', color: netRealizedPnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                 {netRealizedPnl >= 0 ? '+' : ''}₹{netRealizedPnl.toLocaleString('en-IN', {minimumFractionDigits: 2})}
               </div>
               <PnLCalendarHeatmap positions={filteredPositions} orders={filteredOrders} />
             </div>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
           <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Showing P&L Summary for current period</div>
           <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
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
      </div>
    </div>
  );
};

const DownloadReports = () => {
  const Card = ({ icon: Icon, title, desc }) => (
    <div className="glass-panel hoverable" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '50%' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
        <Card icon={FileDown} title="Tax P&L" desc="Scripwise Taxable P&L" />
        <Card icon={FileText} title="P & L Summary" desc="Entire P&L (taxable and non-taxable)" />
        <Card icon={FileText} title="Trades and Charges" desc="Tradewise charges and details" />
        <Card icon={FileText} title="Ledger" desc="Daywise Debits, Credits and Net Balances" />
        <Card icon={FileText} title="Contract Note" desc="Trade details of the day" />
        <Card icon={FileText} title="DP Transaction and Holding Statement" desc="Scripwise list of transactions" />
      </div>
    </div>
  );
};

// --- Main ReportsView Component ---

export default function ReportsView({ initialTab = 'Statement - Ledger', onBack }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  const tabs = [
    'Trading Insights', 
    'Trades and Charges', 
    'Statement - Ledger', 
    'Profit and Loss', 
    'Download Reports'
  ];

  return (
    <div style={{ flex: 1, padding: '32px', overflowY: 'auto', background: 'var(--bg-dark)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <div 
          onClick={onBack} 
          style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ArrowLeft size={16} />
        </div>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Reports</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>View and download your account statements</div>
        </div>
      </div>

      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid var(--border-color)', marginBottom: '32px' }}>
        {tabs.map(tab => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab ? '2px solid var(--color-blue)' : '2px solid transparent',
              paddingBottom: '12px',
              marginBottom: '-1px',
              cursor: 'pointer',
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
        {activeTab === 'Trading Insights' && (
          <div style={{ padding: '64px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <BarChart2 size={48} style={{ margin: '0 auto 16px auto', opacity: 0.5 }} />
            <div>Trading Insights coming soon!</div>
          </div>
        )}
      </div>
    </div>
  );
}
