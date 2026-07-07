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

    if (filterPeriod === 'Week' && diffDays > 7) return false;
    if (filterPeriod === '15 Days' && diffDays > 15) return false;
    if (filterPeriod === 'Month' && diffDays > 30) return false;
    if (filterPeriod === '3 Months' && diffDays > 90) return false;

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

const TradesAndCharges = () => {
  const [filterPeriod, setFilterPeriod] = useState('15 Days');
  const { orders } = useStore();

  const executedOrders = (orders || []).filter(o => o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED');

  const filteredOrders = executedOrders.filter(entry => {
    if (filterPeriod === 'Custom' || filterPeriod === 'Year') return true;
    const entryDate = new Date(entry.created_at);
    const now = new Date();
    const diffDays = Math.ceil(Math.abs(now - entryDate) / (1000 * 60 * 60 * 24));

    if (filterPeriod === 'Week' && diffDays > 7) return false;
    if (filterPeriod === '15 Days' && diffDays > 15) return false;
    if (filterPeriod === 'Month' && diffDays > 30) return false;
    if (filterPeriod === '3 Months' && diffDays > 90) return false;
    return true;
  });

  const totalTrades = filteredOrders.length;
  // Assume a dummy flat ₹20 brokerage per trade if not provided by backend
  const totalBrokerage = filteredOrders.reduce((acc, o) => acc + (o.brokerage || (o.product_type === 'DELIVERY' ? 0 : 20)), 0);
  const totalCharges = filteredOrders.reduce((acc, o) => acc + (o.charges || (o.product_type === 'DELIVERY' ? 0 : 25)), 0);

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

        {/* Heatmap Placeholder */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '32px 0', opacity: 0.3 }}>
          <div style={{ textAlign: 'center' }}>
            <Calendar size={48} style={{ margin: '0 auto 16px auto', color: 'var(--text-secondary)' }} />
            <div style={{ fontSize: '14px' }}>Trading Activity Calendar</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              {totalTrades > 0 ? `${totalTrades} trades recorded in this period.` : 'No trades recorded in this period'}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Showing Trades and Charges Summary for current period</div>
         <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
            <span style={{ padding: '8px 16px', fontSize: '12px', cursor: 'pointer', background: 'rgba(59, 130, 246, 0.2)', color: 'var(--color-blue-light)' }}>Date-Wise View</span>
            <span style={{ padding: '8px 16px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}>Scrip-Wise View</span>
         </div>
      </div>
    </div>
  );
};

const ProfitAndLoss = () => {
  const [filterPeriod, setFilterPeriod] = useState('Year');
  const { positions, orders } = useStore();

  const filteredPositions = (positions || []).filter(entry => {
    if (filterPeriod === 'Custom' || filterPeriod === 'Year') return true;
    const entryDate = new Date(entry.updated_at || entry.created_at);
    const now = new Date();
    const diffDays = Math.ceil(Math.abs(now - entryDate) / (1000 * 60 * 60 * 24));

    if (filterPeriod === 'Week' && diffDays > 7) return false;
    if (filterPeriod === '15 Days' && diffDays > 15) return false;
    if (filterPeriod === 'Month' && diffDays > 30) return false;
    if (filterPeriod === '3 Months' && diffDays > 90) return false;
    return true;
  });

  const executedOrders = (orders || []).filter(o => o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED');
  const filteredOrders = executedOrders.filter(entry => {
    if (filterPeriod === 'Custom' || filterPeriod === 'Year') return true;
    const entryDate = new Date(entry.created_at);
    const now = new Date();
    const diffDays = Math.ceil(Math.abs(now - entryDate) / (1000 * 60 * 60 * 24));

    if (filterPeriod === 'Week' && diffDays > 7) return false;
    if (filterPeriod === '15 Days' && diffDays > 15) return false;
    if (filterPeriod === 'Month' && diffDays > 30) return false;
    if (filterPeriod === '3 Months' && diffDays > 90) return false;
    return true;
  });

  const totalCharges = filteredOrders.reduce((acc, o) => acc + (o.charges || (o.product_type === 'DELIVERY' ? 0 : 25)), 0);
  const realizedPnl = filteredPositions.reduce((acc, p) => acc + (Number(p.realized_pnl) || 0), 0);
  const netRealizedPnl = realizedPnl - totalCharges;

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
             </div>
          </div>
        </div>

        {/* Heatmap Placeholder */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '32px 0', opacity: 0.3 }}>
          <div style={{ textAlign: 'center' }}>
            <Calendar size={48} style={{ margin: '0 auto 16px auto', color: 'var(--text-secondary)' }} />
            <div style={{ fontSize: '14px' }}>P&L Activity Calendar</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>No trades recorded in this period</div>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Showing P&L Summary for current period</div>
         <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
            <span style={{ padding: '8px 16px', fontSize: '12px', cursor: 'pointer', background: 'rgba(59, 130, 246, 0.2)', color: 'var(--color-blue-light)' }}>Month-Wise View</span>
            <span style={{ padding: '8px 16px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}>Scrip-Wise View</span>
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
