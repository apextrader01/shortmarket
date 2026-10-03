// frontend/src/components/PrimaryMarketsView.jsx
// 🏛️ Hub 9: Primary Markets, NSE Bhavcopy Delivery Screener, Deals Monitor & Live IPO Hub

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, 
  ExternalLink, Search, Filter, ShieldCheck, Sparkles, BarChart2,
  Calendar, Layers, CheckCircle2, ChevronRight, RefreshCw, Award
} from 'lucide-react';
import { API } from '../store';

export default function PrimaryMarketsView({ onBack, onOpenPaperTrading }) {
  const [activeTab, setActiveTab] = useState('BHAVCOPY'); // 'BHAVCOPY' | 'DEALS' | 'IPOS'
  const [bhavcopyData, setBhavcopyData] = useState([]);
  const [dealsData, setDealsData] = useState([]);
  const [ipoData, setIpoData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Bhavcopy filters
  const [minDelivery, setMinDelivery] = useState(60);
  const [bhavSearch, setBhavSearch] = useState('');
  const [onlySurge, setOnlySurge] = useState(false);
  const [onlyBreakout, setOnlyBreakout] = useState(false);

  // Deals filter
  const [dealTypeFilter, setDealTypeFilter] = useState('ALL');

  // IPO filter & Allotment Modal
  const [ipoCategory, setIpoCategory] = useState('ALL'); // 'ALL' | 'MAINBOARD' | 'SME'
  const [selectedIpoForCheck, setSelectedIpoForCheck] = useState(null);
  const [panNumber, setPanNumber] = useState('');

  const fetchPrimaryMarketData = async () => {
    setLoading(true);
    try {
      const [bhavRes, dealsRes, iposRes] = await Promise.all([
        API.get('/api/bhavcopy/delivery').catch(() => ({ data: { data: [] } })),
        API.get('/api/market-deals').catch(() => ({ data: { deals: [] } })),
        API.get('/api/ipos').catch(() => ({ data: { ipos: [] } }))
      ]);

      if (bhavRes?.data?.data) setBhavcopyData(bhavRes.data.data);
      if (dealsRes?.data?.deals) setDealsData(dealsRes.data.deals);
      if (iposRes?.data?.ipos) setIpoData(iposRes.data.ipos);
    } catch (err) {
      console.warn('Failed to fetch primary market data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrimaryMarketData();
  }, []);

  const filteredBhavcopy = useMemo(() => {
    return bhavcopyData.filter(item => {
      if (item.delivPct < minDelivery) return false;
      if (onlySurge && item.surgeMult < 2.0) return false;
      if (onlyBreakout && !item.is52wHigh) return false;
      if (bhavSearch) {
        const q = bhavSearch.toLowerCase();
        return item.symbol.toLowerCase().includes(q) || (item.name && item.name.toLowerCase().includes(q));
      }
      return true;
    });
  }, [bhavcopyData, minDelivery, onlySurge, onlyBreakout, bhavSearch]);

  const filteredDeals = useMemo(() => {
    if (dealTypeFilter === 'ALL') return dealsData;
    return dealsData.filter(d => d.dealType === dealTypeFilter);
  }, [dealsData, dealTypeFilter]);

  const filteredIpos = useMemo(() => {
    if (ipoCategory === 'ALL') return ipoData;
    return ipoData.filter(i => i.category === ipoCategory);
  }, [ipoData, ipoCategory]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100vh', background: 'var(--bg-dark, #0b0e14)', color: '#fff', overflowY: 'auto', padding: '16px 20px 100px' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button 
            type="button" 
            onClick={onBack}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
          >
            ← Back to Hub
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🏛️</span>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', letterSpacing: '-0.3px' }}>Primary Markets & Institutional Intelligence</h1>
              <span style={{ fontSize: '10px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>₹0 Exchange API</span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: 'var(--text-secondary, #94a3b8)' }}>Official daily NSE Bhavcopy delivery accumulation, SEBI bulk deals, and Mainboard/SME IPO GMP live tracker.</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={fetchPrimaryMarketData}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh Data
          </button>
          {onOpenPaperTrading && (
            <button
              type="button"
              onClick={onOpenPaperTrading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
            >
              📈 Trade Live <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 3 Master Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '22px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', overflowX: 'auto' }}>
        <button
          type="button"
          onClick={() => setActiveTab('BHAVCOPY')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px',
            background: activeTab === 'BHAVCOPY' ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.04)',
            border: activeTab === 'BHAVCOPY' ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
            color: activeTab === 'BHAVCOPY' ? '#60a5fa' : '#94a3b8',
            fontSize: '13px', fontWeight: '700', cursor: 'pointer'
          }}
        >
          <BarChart2 size={16} /> 📈 1. NSE Bhavcopy & Delivery Screener
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('DEALS')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px',
            background: activeTab === 'DEALS' ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.04)',
            border: activeTab === 'DEALS' ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.08)',
            color: activeTab === 'DEALS' ? '#c084fc' : '#94a3b8',
            fontSize: '13px', fontWeight: '700', cursor: 'pointer'
          }}
        >
          <Building2 size={16} /> 🏛️ 2. Bulk, Block & Insider Deals
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('IPOS')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px',
            background: activeTab === 'IPOS' ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.04)',
            border: activeTab === 'IPOS' ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.08)',
            color: activeTab === 'IPOS' ? '#4ade80' : '#94a3b8',
            fontSize: '13px', fontWeight: '700', cursor: 'pointer'
          }}
        >
          <Sparkles size={16} /> 🚀 3. IPO & SME Allotment & GMP Hub
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: DAILY NSE BHAVCOPY SCREENER & DELIVERY TRACKER                         */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'BHAVCOPY' && (
        <div>
          {/* Controls Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)', marginBottom: '18px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Search Stock</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="e.g. RELIANCE, HDFCBANK..."
                  value={bhavSearch}
                  onChange={e => setBhavSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px 8px 32px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Min Delivery %</label>
                <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: '800' }}>≥ {minDelivery}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="90"
                step="5"
                value={minDelivery}
                onChange={e => setMinDelivery(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: onlySurge ? '#60a5fa' : '#cbd5e1' }}>
                <input type="checkbox" checked={onlySurge} onChange={e => setOnlySurge(e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                <span>⚡ Volume Surges (2x+)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: onlyBreakout ? '#22c55e' : '#cbd5e1' }}>
                <input type="checkbox" checked={onlyBreakout} onChange={e => setOnlyBreakout(e.target.checked)} style={{ accentColor: '#22c55e' }} />
                <span>🔥 52W High Breakouts</span>
              </label>
            </div>
          </div>

          {/* Delivery Table */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)', textTransform: 'uppercase', fontSize: '11px' }}>
                  <th style={{ padding: '12px 16px' }}>Stock / Sector</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>LTP (₹)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Day Change</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Traded Vol</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Delivery Vol</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Delivery %</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Signals</th>
                </tr>
              </thead>
              <tbody>
                {filteredBhavcopy.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No stocks matched your delivery criteria. Lower the delivery filter or clear search.</td>
                  </tr>
                ) : (
                  filteredBhavcopy.map((stock, idx) => (
                    <tr key={stock.symbol || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: '700', color: '#fff' }}>{stock.symbol}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{stock.sector || stock.name}</div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700' }}>₹{stock.ltp?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: stock.change >= 0 ? '#22c55e' : '#ef4444' }}>
                        {stock.change >= 0 ? `+${stock.change}%` : `${stock.change}%`}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#cbd5e1' }}>{(stock.volume / 100000).toFixed(2)} L</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#cbd5e1' }}>{(stock.delivQty / 100000).toFixed(2)} L</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: stock.delivPct >= 75 ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)', color: stock.delivPct >= 75 ? '#22c55e' : '#60a5fa', border: `1px solid ${stock.delivPct >= 75 ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.3)'}`, padding: '3px 10px', borderRadius: '12px', fontWeight: '800' }}>
                          {stock.delivPct}%
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          {stock.is52wHigh && <span title="52-Week High Breakout" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: '700' }}>🔥 52W High</span>}
                          {stock.surgeMult >= 2.0 && <span title="Volume Surge 2x+" style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: '700' }}>⚡ {stock.surgeMult}x Vol</span>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: BULK, BLOCK & INSIDER DEALS MONITOR                                    */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'DEALS' && (
        <div>
          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {['ALL', 'BULK_DEAL', 'BLOCK_DEAL', 'INSIDER_PROMOTER'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setDealTypeFilter(type)}
                style={{
                  padding: '7px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                  background: dealTypeFilter === type ? '#a855f7' : 'rgba(255,255,255,0.06)',
                  color: dealTypeFilter === type ? '#fff' : '#cbd5e1',
                  border: 'none'
                }}
              >
                {type === 'ALL' ? 'All Institutional Deals' : type.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)', textTransform: 'uppercase', fontSize: '11px' }}>
                  <th style={{ padding: '12px 16px' }}>Date</th>
                  <th style={{ padding: '12px 16px' }}>Stock</th>
                  <th style={{ padding: '12px 16px' }}>Client / Institution</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Type</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Shares Traded</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Price (₹)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Value (₹ Cr)</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.map((deal) => (
                  <tr key={deal.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{deal.date}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#fff' }}>{deal.symbol}</td>
                    <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>
                      <div style={{ fontWeight: '600' }}>{deal.client}</div>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>{deal.dealType}</div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ background: deal.type === 'BUY' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: deal.type === 'BUY' ? '#22c55e' : '#ef4444', border: `1px solid ${deal.type === 'BUY' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, padding: '2px 8px', borderRadius: '6px', fontWeight: '700', fontSize: '11px' }}>
                        {deal.type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>{deal.qty?.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}>₹{deal.price?.toFixed(2)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#f8fafc' }}>₹{deal.valueCr?.toFixed(2)} Cr</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: IPO & SME ALLOTMENT & GMP HUB                                          */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'IPOS' && (
        <div>
          {/* Category Toggle */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
            {['ALL', 'MAINBOARD', 'SME'].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setIpoCategory(cat)}
                style={{
                  padding: '7px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                  background: ipoCategory === cat ? '#22c55e' : 'rgba(255,255,255,0.06)',
                  color: ipoCategory === cat ? '#0b0e14' : '#cbd5e1',
                  border: 'none'
                }}
              >
                {cat === 'ALL' ? 'All IPOs' : cat === 'MAINBOARD' ? '🏢 Mainboard IPOs' : '🚀 SME IPOs'}
              </button>
            ))}
          </div>

          {/* IPO Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {filteredIpos.map((ipo) => (
              <div 
                key={ipo.id} 
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '10.5px', background: ipo.category === 'MAINBOARD' ? 'rgba(59,130,246,0.15)' : 'rgba(234,179,8,0.15)', color: ipo.category === 'MAINBOARD' ? '#60a5fa' : '#eab308', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                      {ipo.category}
                    </span>
                    <h3 style={{ margin: '6px 0 0', fontSize: '15px', fontWeight: '700' }}>{ipo.name}</h3>
                  </div>
                  <span style={{ fontSize: '11px', background: ipo.status === 'OPEN' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)', color: ipo.status === 'OPEN' ? '#22c55e' : '#94a3b8', border: `1px solid ${ipo.status === 'OPEN' ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, padding: '3px 8px', borderRadius: '6px', fontWeight: '700' }}>
                    {ipo.status}
                  </span>
                </div>

                {/* GMP & Expected Listing Gain Badge */}
                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', padding: '10px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Estimated GMP (Grey Market)</div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#22c55e' }}>+₹{ipo.gmp} ({ipo.gmpPct}%)</div>
                  </div>
                  <Award size={22} color="#22c55e" />
                </div>

                {/* Key Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                  <div>
                    <div style={{ color: '#64748b' }}>Price Band</div>
                    <div style={{ fontWeight: '700', color: '#fff', marginTop: '2px' }}>{ipo.priceBand}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b' }}>Lot Size</div>
                    <div style={{ fontWeight: '700', color: '#fff', marginTop: '2px' }}>{ipo.lotSize} Shares</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b' }}>Issue Size</div>
                    <div style={{ fontWeight: '700', color: '#fff', marginTop: '2px' }}>₹{ipo.issueSizeCr} Cr</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b' }}>Subscription</div>
                    <div style={{ fontWeight: '700', color: '#fff', marginTop: '2px' }}>{ipo.subscription.total > 0 ? `${ipo.subscription.total}x` : 'Opens Soon'}</div>
                  </div>
                </div>

                {/* Dates */}
                <div style={{ fontSize: '11px', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                  📅 Open: <span style={{ color: '#fff' }}>{ipo.openDate}</span> | Close: <span style={{ color: '#fff' }}>{ipo.closeDate}</span>
                </div>

                {/* 1-Click Allotment Status Button */}
                <button
                  type="button"
                  onClick={() => setSelectedIpoForCheck(ipo)}
                  style={{ width: '100%', padding: '9px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', color: '#60a5fa', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <CheckCircle2 size={14} /> 1-Click Allotment Status Check
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 1-CLICK ALLOTMENT STATUS MODAL                                                */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {selectedIpoForCheck && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', maxWidth: '480px', width: '100%', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>🔍 Check Allotment Status</h3>
              <button type="button" onClick={() => setSelectedIpoForCheck(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '14px' }}>
              Company: <strong style={{ color: '#fff' }}>{selectedIpoForCheck.name}</strong><br />
              Official Registrar: <strong style={{ color: '#60a5fa' }}>{selectedIpoForCheck.registrar}</strong>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', display: 'block', marginBottom: '6px' }}>Enter Your PAN Number</label>
              <input
                type="text"
                placeholder="ABCDE1234F"
                maxLength="10"
                value={panNumber}
                onChange={e => setPanNumber(e.target.value.toUpperCase())}
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href={selectedIpoForCheck.registrarUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px', background: '#2563eb', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: '700', fontSize: '13px' }}
              >
                Open Official {selectedIpoForCheck.registrar} Portal <ExternalLink size={14} />
              </a>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
                Allotment records are securely hosted directly on SEBI-certified registrar servers.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
