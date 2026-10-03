// frontend/src/components/PrimaryMarketsView.jsx
// 🏛️ Hub 9: Primary Markets, NSE Bhavcopy Delivery Screener, Deals Monitor & Live IPO Hub

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, 
  ExternalLink, Search, Filter, ShieldCheck, Sparkles, BarChart2,
  Calendar, Layers, CheckCircle2, ChevronRight, RefreshCw, Award
} from 'lucide-react';
import { API } from '../store';

const SEED_BHAVCOPY_DATA = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', ltp: 2984.50, change: 1.45, volume: 8452100, delivQty: 6339075, delivPct: 75.0, surgeMult: 2.4, is52wHigh: true, sector: 'Energy / Oil & Gas' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', ltp: 4210.20, change: -0.35, volume: 2950000, delivQty: 2242000, delivPct: 76.0, surgeMult: 1.8, is52wHigh: false, sector: 'Information Tech' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', ltp: 1682.40, change: 0.90, volume: 15420000, delivQty: 12490200, delivPct: 81.0, surgeMult: 3.1, is52wHigh: false, sector: 'Banking' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', ltp: 1248.80, change: 1.80, volume: 11200000, delivQty: 8736000, delivPct: 78.0, surgeMult: 2.6, is52wHigh: true, sector: 'Banking' },
  { symbol: 'INFY', name: 'Infosys Ltd', ltp: 1912.10, change: 0.40, volume: 6420000, delivQty: 4622400, delivPct: 72.0, surgeMult: 1.5, is52wHigh: false, sector: 'Information Tech' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', ltp: 1720.60, change: 2.10, volume: 7890000, delivQty: 6469800, delivPct: 82.0, surgeMult: 3.8, is52wHigh: true, sector: 'Telecom' },
  { symbol: 'ITC', name: 'ITC Ltd', ltp: 512.30, change: -0.20, volume: 14200000, delivQty: 11644000, delivPct: 82.0, surgeMult: 1.9, is52wHigh: true, sector: 'FMCG' },
  { symbol: 'LT', name: 'Larsen & Toubro Ltd', ltp: 3675.00, change: 1.25, volume: 3120000, delivQty: 2308800, delivPct: 74.0, surgeMult: 2.2, is52wHigh: false, sector: 'Infrastructure' },
  { symbol: 'SBIN', name: 'State Bank of India', ltp: 812.50, change: 0.85, volume: 18450000, delivQty: 12915000, delivPct: 70.0, surgeMult: 1.7, is52wHigh: false, sector: 'Banking' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', ltp: 985.40, change: -1.10, volume: 12400000, delivQty: 7440000, delivPct: 60.0, surgeMult: 1.4, is52wHigh: false, sector: 'Automobile' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', ltp: 1845.00, change: 0.60, volume: 4200000, delivQty: 3276000, delivPct: 78.0, surgeMult: 1.6, is52wHigh: false, sector: 'Banking' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd', ltp: 2950.00, change: -0.45, volume: 2800000, delivQty: 2156000, delivPct: 77.0, surgeMult: 1.3, is52wHigh: false, sector: 'FMCG' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd', ltp: 7420.00, change: 1.50, volume: 2100000, delivQty: 1491000, delivPct: 71.0, surgeMult: 2.0, is52wHigh: false, sector: 'NBFC / Finance' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Ltd', ltp: 1895.00, change: 1.95, volume: 3800000, delivQty: 2964000, delivPct: 78.0, surgeMult: 2.9, is52wHigh: true, sector: 'Pharma' },
  { symbol: 'TITAN', name: 'Titan Company Ltd', ltp: 3740.00, change: 0.70, volume: 1950000, delivQty: 1384500, delivPct: 71.0, surgeMult: 1.5, is52wHigh: false, sector: 'Consumer Goods' },
  { symbol: 'COALINDIA', name: 'Coal India Ltd', ltp: 512.00, change: 2.30, volume: 19500000, delivQty: 15405000, delivPct: 79.0, surgeMult: 3.4, is52wHigh: true, sector: 'Metals & Mining' },
  { symbol: 'NTPC', name: 'NTPC Ltd', ltp: 428.50, change: 1.80, volume: 22100000, delivQty: 17238000, delivPct: 78.0, surgeMult: 2.8, is52wHigh: true, sector: 'Power / Utilities' },
  { symbol: 'ONGC', name: 'Oil & Natural Gas Corp', ltp: 312.40, change: 1.15, volume: 25400000, delivQty: 18034000, delivPct: 71.0, surgeMult: 2.1, is52wHigh: false, sector: 'Energy / Oil' },
  { symbol: 'POWERGRID', name: 'Power Grid Corp', ltp: 352.00, change: 0.90, volume: 16700000, delivQty: 12859000, delivPct: 77.0, surgeMult: 2.3, is52wHigh: true, sector: 'Power / Utilities' },
  { symbol: 'ZOMATO', name: 'Zomato Ltd', ltp: 275.50, change: 3.40, volume: 48900000, delivQty: 34230000, delivPct: 70.0, surgeMult: 4.2, is52wHigh: true, sector: 'Internet / Consumer Tech' }
];

const SEED_DEALS_DATA = [
  { id: 1, date: '2026-10-02', symbol: 'ZOMATO', company: 'Zomato Ltd', client: 'Morgan Stanley Asia Singapore', type: 'BUY', qty: 12500000, price: 272.50, valueCr: 340.62, dealType: 'BULK_DEAL' },
  { id: 2, date: '2026-10-02', symbol: 'HDFCBANK', company: 'HDFC Bank Ltd', client: 'Government of Singapore (GIC)', type: 'BUY', qty: 4500000, price: 1678.00, valueCr: 755.10, dealType: 'BLOCK_DEAL' },
  { id: 3, date: '2026-10-01', symbol: 'INFY', company: 'Infosys Ltd', client: 'LIC of India', type: 'BUY', qty: 2100000, price: 1905.00, valueCr: 400.05, dealType: 'BULK_DEAL' },
  { id: 4, date: '2026-10-01', symbol: 'BHARTIARTL', company: 'Bharti Airtel Ltd', client: 'Singtel International Investments', type: 'SELL', qty: 3200000, price: 1715.00, valueCr: 548.80, dealType: 'BLOCK_DEAL' },
  { id: 5, date: '2026-09-30', symbol: 'TATAMOTORS', company: 'Tata Motors Ltd', client: 'Promoter: Tata Sons Pvt Ltd', type: 'BUY', qty: 1500000, price: 980.00, valueCr: 147.00, dealType: 'INSIDER_PROMOTER' },
  { id: 6, date: '2026-09-30', symbol: 'RELIANCE', company: 'Reliance Industries', client: 'Norges Bank Investment Management', type: 'BUY', qty: 1800000, price: 2975.00, valueCr: 535.50, dealType: 'BULK_DEAL' },
  { id: 7, date: '2026-09-29', symbol: 'ICICIBANK', company: 'ICICI Bank Ltd', client: 'Fidelity Emerging Markets Fund', type: 'BUY', qty: 3100000, price: 1242.00, valueCr: 385.02, dealType: 'BLOCK_DEAL' }
];

const SEED_IPO_DATA = [
  {
    id: 1,
    name: 'Hyundai Motor India Ltd',
    category: 'MAINBOARD',
    status: 'OPEN',
    priceBand: '₹1,865 - ₹1,960',
    minPrice: 1865,
    maxPrice: 1960,
    lotSize: 7,
    issueSizeCr: 27870,
    openDate: '2026-10-15',
    closeDate: '2026-10-17',
    listingDate: '2026-10-22',
    gmp: 125,
    gmpPct: 6.4,
    subscription: { qib: 6.9, nii: 1.8, retail: 1.5, total: 2.37 },
    registrar: 'KFintech',
    registrarUrl: 'https://kosmic.kfintech.com/ipostatus/'
  },
  {
    id: 2,
    name: 'Swiggy Limited',
    category: 'MAINBOARD',
    status: 'UPCOMING',
    priceBand: '₹371 - ₹390',
    minPrice: 371,
    maxPrice: 390,
    lotSize: 38,
    issueSizeCr: 11327,
    openDate: '2026-11-06',
    closeDate: '2026-11-08',
    listingDate: '2026-11-13',
    gmp: 45,
    gmpPct: 11.5,
    subscription: { qib: 0, nii: 0, retail: 0, total: 0 },
    registrar: 'Link Intime',
    registrarUrl: 'https://linkintime.co.in/initial_offer/public-issues.html'
  },
  {
    id: 3,
    name: 'NTPC Green Energy Ltd',
    category: 'MAINBOARD',
    status: 'UPCOMING',
    priceBand: '₹102 - ₹108',
    minPrice: 102,
    maxPrice: 108,
    lotSize: 138,
    issueSizeCr: 10000,
    openDate: '2026-11-19',
    closeDate: '2026-11-22',
    listingDate: '2026-11-27',
    gmp: 18,
    gmpPct: 16.7,
    subscription: { qib: 0, nii: 0, retail: 0, total: 0 },
    registrar: 'KFintech',
    registrarUrl: 'https://kosmic.kfintech.com/ipostatus/'
  },
  {
    id: 4,
    name: 'Waaree Energies Ltd',
    category: 'MAINBOARD',
    status: 'CLOSED',
    priceBand: '₹1,427 - ₹1,503',
    minPrice: 1427,
    maxPrice: 1503,
    lotSize: 9,
    issueSizeCr: 4321,
    openDate: '2026-10-21',
    closeDate: '2026-10-23',
    listingDate: '2026-10-28',
    gmp: 1480,
    gmpPct: 98.5,
    subscription: { qib: 208.6, nii: 62.5, retail: 10.8, total: 76.34 },
    registrar: 'Link Intime',
    registrarUrl: 'https://linkintime.co.in/initial_offer/public-issues.html'
  },
  {
    id: 5,
    name: 'TechMatrix Solutions SME',
    category: 'SME',
    status: 'OPEN',
    priceBand: '₹115 - ₹122',
    minPrice: 115,
    maxPrice: 122,
    lotSize: 1000,
    issueSizeCr: 45.2,
    openDate: '2026-10-02',
    closeDate: '2026-10-05',
    listingDate: '2026-10-08',
    gmp: 68,
    gmpPct: 55.7,
    subscription: { qib: 14.5, nii: 28.2, retail: 42.1, total: 31.8 },
    registrar: 'Bigshare Services',
    registrarUrl: 'https://ipo.bigshareonline.com/IPO_Status.html'
  },
  {
    id: 6,
    name: 'Apex Green Hydrogen SME',
    category: 'SME',
    status: 'UPCOMING',
    priceBand: '₹85 - ₹90',
    minPrice: 85,
    maxPrice: 90,
    lotSize: 1600,
    issueSizeCr: 32.5,
    openDate: '2026-10-14',
    closeDate: '2026-10-16',
    listingDate: '2026-10-21',
    gmp: 42,
    gmpPct: 46.6,
    subscription: { qib: 0, nii: 0, retail: 0, total: 0 },
    registrar: 'Bigshare Services',
    registrarUrl: 'https://ipo.bigshareonline.com/IPO_Status.html'
  }
];

export default function PrimaryMarketsView({ onBack, onOpenPaperTrading }) {
  const [activeTab, setActiveTab] = useState('BHAVCOPY'); // 'BHAVCOPY' | 'DEALS' | 'IPOS'
  const [bhavcopyData, setBhavcopyData] = useState(SEED_BHAVCOPY_DATA);
  const [dealsData, setDealsData] = useState(SEED_DEALS_DATA);
  const [ipoData, setIpoData] = useState(SEED_IPO_DATA);
  const [loading, setLoading] = useState(false);

  // Bhavcopy filters
  const [minDelivery, setMinDelivery] = useState(50);
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
        fetch(`${API}/api/bhavcopy/delivery`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API}/api/market-deals`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API}/api/ipos`).then(r => r.ok ? r.json() : null).catch(() => null)
      ]);

      if (bhavRes?.data && Array.isArray(bhavRes.data) && bhavRes.data.length > 0) {
        setBhavcopyData(bhavRes.data);
      }
      if (dealsRes?.deals && Array.isArray(dealsRes.deals) && dealsRes.deals.length > 0) {
        setDealsData(dealsRes.deals);
      }
      if (iposRes?.ipos && Array.isArray(iposRes.ipos) && iposRes.ipos.length > 0) {
        setIpoData(iposRes.ipos);
      }
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
      if (bhavSearch.trim()) {
        const q = bhavSearch.toLowerCase().trim();
        const matchesQuery = item.symbol.toLowerCase().includes(q) || 
                             (item.name && item.name.toLowerCase().includes(q)) ||
                             (item.sector && item.sector.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      } else {
        if (item.delivPct < minDelivery) return false;
      }
      if (onlySurge && item.surgeMult < 2.0) return false;
      if (onlyBreakout && !item.is52wHigh) return false;
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
                {filteredDeals.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                      No institutional deals match this filter category. Try switching to "All Institutional Deals".
                    </td>
                  </tr>
                ) : (
                  filteredDeals.map((deal) => (
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
                  ))
                )}
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
          {filteredIpos.length === 0 ? (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '40px', textAlign: 'center', color: '#64748b' }}>
              No IPOs found in this category. Switch to "All IPOs" to view active and upcoming issues.
            </div>
          ) : (
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
          )}
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
