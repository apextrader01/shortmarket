// frontend/src/components/MutualFundsExplorerModal.jsx
// 🌟 Hub 06: Mutual Funds & SIP Alpha Explorer (Direct vs Regular Fee Savings, 44 AMCs & 1-Click SIP Projection)

import React, { useState, useMemo } from 'react';
import { 
  X, BarChart2, TrendingUp, Sparkles, Award, ShieldCheck, 
  ArrowUpRight, Calculator, Search, Filter, Layers, DollarSign,
  ChevronRight, ArrowRight, Percent, CheckCircle2, AlertCircle
} from 'lucide-react';

const TOP_DIRECT_FUNDS = [
  {
    id: 'ppfas_flexi',
    name: 'Parag Parikh Flexi Cap Fund Direct - Growth',
    amc: 'PPFAS Mutual Fund',
    category: 'FLEXI_CAP',
    categoryLabel: 'Flexi Cap',
    nav: 84.62,
    cagr1y: 28.4,
    cagr3y: 21.8,
    cagr5y: 24.6,
    directTer: 0.58,
    regularTer: 1.34,
    aumCr: 76420,
    risk: 'Very High',
    minSip: 1000,
    rating: 5,
    tag: 'Flagship Value'
  },
  {
    id: 'nippon_small',
    name: 'Nippon India Small Cap Fund Direct - Growth',
    amc: 'Nippon Life India AMC',
    category: 'MID_SMALL',
    categoryLabel: 'Small Cap',
    nav: 178.40,
    cagr1y: 38.6,
    cagr3y: 30.2,
    cagr5y: 31.4,
    directTer: 0.68,
    regularTer: 1.58,
    aumCr: 58910,
    risk: 'Very High',
    minSip: 500,
    rating: 5,
    tag: 'Highest 5Y Alpha'
  },
  {
    id: 'quant_small',
    name: 'Quant Small Cap Fund Direct - Growth',
    amc: 'Quant Mutual Fund',
    category: 'MID_SMALL',
    categoryLabel: 'Small Cap',
    nav: 262.15,
    cagr1y: 42.1,
    cagr3y: 32.5,
    cagr5y: 36.2,
    directTer: 0.72,
    regularTer: 1.65,
    aumCr: 24350,
    risk: 'Very High',
    minSip: 1000,
    rating: 5,
    tag: 'Dynamic Momentum'
  },
  {
    id: 'uti_nifty50',
    name: 'UTI Nifty 50 Index Fund Direct - Growth',
    amc: 'UTI Mutual Fund',
    category: 'LARGE_INDEX',
    categoryLabel: 'Index Fund',
    nav: 182.30,
    cagr1y: 24.2,
    cagr3y: 15.6,
    cagr5y: 17.8,
    directTer: 0.18,
    regularTer: 0.38,
    aumCr: 19800,
    risk: 'Very High',
    minSip: 500,
    rating: 4,
    tag: 'Lowest Tracking Error'
  },
  {
    id: 'hdfc_index_sensex',
    name: 'HDFC BSE Sensex Index Fund Direct - Growth',
    amc: 'HDFC Mutual Fund',
    category: 'LARGE_INDEX',
    categoryLabel: 'Index Fund',
    nav: 720.50,
    cagr1y: 23.8,
    cagr3y: 15.2,
    cagr5y: 17.4,
    directTer: 0.20,
    regularTer: 0.40,
    aumCr: 8450,
    risk: 'Very High',
    minSip: 500,
    rating: 4,
    tag: 'Bluechip 30'
  },
  {
    id: 'mirae_large_mid',
    name: 'Mirae Asset Large & Midcap Fund Direct - Growth',
    amc: 'Mirae Asset Investment Managers',
    category: 'LARGE_INDEX',
    categoryLabel: 'Large & Mid Cap',
    nav: 142.10,
    cagr1y: 31.5,
    cagr3y: 20.4,
    cagr5y: 22.1,
    directTer: 0.62,
    regularTer: 1.52,
    aumCr: 39500,
    risk: 'Very High',
    minSip: 1000,
    rating: 4,
    tag: 'Consistent Outperformer'
  },
  {
    id: 'motilal_midcap',
    name: 'Motilal Oswal Midcap Fund Direct - Growth',
    amc: 'Motilal Oswal AMC',
    category: 'MID_SMALL',
    categoryLabel: 'Mid Cap',
    nav: 108.90,
    cagr1y: 52.8,
    cagr3y: 34.6,
    cagr5y: 29.8,
    directTer: 0.64,
    regularTer: 1.68,
    aumCr: 16800,
    risk: 'Very High',
    minSip: 500,
    rating: 5,
    tag: 'High Conviction Beta'
  },
  {
    id: 'sbi_contra',
    name: 'SBI Contra Fund Direct - Growth',
    amc: 'SBI Mutual Fund',
    category: 'FLEXI_CAP',
    categoryLabel: 'Contra / Value',
    nav: 412.50,
    cagr1y: 36.4,
    cagr3y: 27.8,
    cagr5y: 28.2,
    directTer: 0.66,
    regularTer: 1.55,
    aumCr: 36700,
    risk: 'Very High',
    minSip: 500,
    rating: 5,
    tag: 'Contrarian Value'
  },
  {
    id: 'icici_baf',
    name: 'ICICI Prudential Balanced Advantage Direct - Growth',
    amc: 'ICICI Prudential AMC',
    category: 'HYBRID',
    categoryLabel: 'Balanced Advantage',
    nav: 76.80,
    cagr1y: 19.8,
    cagr3y: 14.5,
    cagr5y: 15.2,
    directTer: 0.88,
    regularTer: 1.62,
    aumCr: 62400,
    risk: 'Moderately High',
    minSip: 500,
    rating: 5,
    tag: 'Downside Protection'
  },
  {
    id: 'mirae_elss',
    name: 'Mirae Asset ELSS Tax Saver Fund Direct - Growth',
    amc: 'Mirae Asset Investment Managers',
    category: 'ELSS_TAX',
    categoryLabel: 'ELSS Tax Saver',
    nav: 48.70,
    cagr1y: 29.4,
    cagr3y: 18.9,
    cagr5y: 21.4,
    directTer: 0.60,
    regularTer: 1.62,
    aumCr: 24800,
    risk: 'Very High',
    minSip: 500,
    rating: 4,
    tag: 'Section 80C Benefit'
  },
  {
    id: 'quant_elss',
    name: 'Quant ELSS Tax Saver Fund Direct - Growth',
    amc: 'Quant Mutual Fund',
    category: 'ELSS_TAX',
    categoryLabel: 'ELSS Tax Saver',
    nav: 420.30,
    cagr1y: 38.2,
    cagr3y: 29.4,
    cagr5y: 33.8,
    directTer: 0.74,
    regularTer: 1.78,
    aumCr: 11200,
    risk: 'Very High',
    minSip: 500,
    rating: 5,
    tag: 'High Alpha 80C'
  },
  {
    id: 'hdfc_hybrid',
    name: 'HDFC Balanced Advantage Fund Direct - Growth',
    amc: 'HDFC Mutual Fund',
    category: 'HYBRID',
    categoryLabel: 'Balanced Advantage',
    nav: 520.10,
    cagr1y: 24.6,
    cagr3y: 19.2,
    cagr5y: 18.9,
    directTer: 0.78,
    regularTer: 1.50,
    aumCr: 88500,
    risk: 'Moderately High',
    minSip: 1000,
    rating: 5,
    tag: 'India Largest Hybrid'
  }
];

export default function MutualFundsExplorerModal({
  isOpen,
  onClose,
  onOpenSipCalculator,
  onOpenPaperTradingMf
}) {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Interactive Direct vs Regular Calculator state
  const [sipMonthly, setSipMonthly] = useState(15000);
  const [sipYears, setSipYears] = useState(20);
  const [expectedReturn, setExpectedReturn] = useState(14); // 14% p.a.
  const [expandedFundId, setExpandedFundId] = useState(null);

  // Compute Direct vs Regular compounding savings
  const savingsCalculation = useMemo(() => {
    const P = Number(sipMonthly) || 10000;
    const n = (Number(sipYears) || 15) * 12;
    const directAnnualRate = (Number(expectedReturn) || 14) / 100;
    // Regular funds have ~1.2% higher expense ratio deducted continuously
    const regularAnnualRate = Math.max(0.01, directAnnualRate - 0.012);

    const iDirect = directAnnualRate / 12;
    const iRegular = regularAnnualRate / 12;

    const directCorpus = P * ((Math.pow(1 + iDirect, n) - 1) / iDirect) * (1 + iDirect);
    const regularCorpus = P * ((Math.pow(1 + iRegular, n) - 1) / iRegular) * (1 + iRegular);
    const totalInvested = P * n;
    const commissionLost = Math.max(0, directCorpus - regularCorpus);

    return {
      totalInvested,
      directCorpus,
      regularCorpus,
      commissionLost,
      gainPercent: ((commissionLost / regularCorpus) * 100).toFixed(1)
    };
  }, [sipMonthly, sipYears, expectedReturn]);

  const filteredFunds = useMemo(() => {
    return TOP_DIRECT_FUNDS.filter(fund => {
      if (selectedCategory !== 'ALL' && fund.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          fund.name.toLowerCase().includes(q) ||
          fund.amc.toLowerCase().includes(q) ||
          fund.categoryLabel.toLowerCase().includes(q) ||
          (fund.tag && fund.tag.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(5, 10, 20, 0.88)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div style={{
        background: 'var(--bg-panel, #0f172a)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '18px',
        width: '100%',
        maxWidth: '980px',
        height: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.85)',
        overflow: 'hidden'
      }}>
        {/* Top Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(96, 165, 250, 0.1))',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#60a5fa'
            }}>
              <BarChart2 size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#f8fafc', letterSpacing: '-0.2px' }}>
                  Mutual Funds & Direct SIP Alpha Explorer
                </h2>
                <span style={{ fontSize: '11px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                  44 Indian AMCs
                </span>
                <span style={{ fontSize: '11px', background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                  ₹0 Distributor Fee
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Discover top direct plans with lowest Expense Ratios, 5-Year CAGR track records and commission savings comparison.
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '7px',
              cursor: 'pointer',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* ───────────────────────────────────────────────────────────────────────── */}
          {/* DIRECT VS REGULAR COMMISSION SAVINGS CALCULATOR                           */}
          {/* ───────────────────────────────────────────────────────────────────────── */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.25), rgba(15, 23, 42, 0.45))',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            borderRadius: '14px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Percent size={18} color="#60a5fa" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#fff' }}>
                  Direct Plan vs Regular Plan Wealth Multiplier
                </h3>
              </div>
              <span style={{ fontSize: '11px', color: '#93c5fd', background: 'rgba(59, 130, 246, 0.15)', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                Regular plans secretly deduct 1.0% - 1.5% in distributor commissions every year
              </span>
            </div>

            {/* Sliders Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11.5px', color: '#cbd5e1', fontWeight: '600' }}>Monthly SIP Amount</label>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#60a5fa' }}>₹{sipMonthly.toLocaleString('en-IN')}</span>
                </div>
                <input 
                  type="range"
                  min="2000"
                  max="100000"
                  step="1000"
                  value={sipMonthly}
                  onChange={e => setSipMonthly(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11.5px', color: '#cbd5e1', fontWeight: '600' }}>SIP Duration</label>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#60a5fa' }}>{sipYears} Years</span>
                </div>
                <input 
                  type="range"
                  min="3"
                  max="30"
                  step="1"
                  value={sipYears}
                  onChange={e => setSipYears(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11.5px', color: '#cbd5e1', fontWeight: '600' }}>Expected CAGR Return</label>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#22c55e' }}>{expectedReturn}% p.a.</span>
                </div>
                <input 
                  type="range"
                  min="8"
                  max="22"
                  step="1"
                  value={expectedReturn}
                  onChange={e => setExpectedReturn(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#22c55e', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* Results KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '4px' }}>
              <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Total Invested Capital</span>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#fff', marginTop: '2px' }}>
                  ₹{(savingsCalculation.totalInvested / 100000).toFixed(2)} Lakhs
                </div>
              </div>

              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: '#86efac' }}>Direct Plan Corpus (₹0 Fee)</span>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#22c55e', marginTop: '2px' }}>
                  ₹{(savingsCalculation.directCorpus / 100000).toFixed(2)} Lakhs
                </div>
              </div>

              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: '#fca5a5' }}>Regular Plan Corpus (Broker Cut)</span>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#f87171', marginTop: '2px' }}>
                  ₹{(savingsCalculation.regularCorpus / 100000).toFixed(2)} Lakhs
                </div>
              </div>

              <div style={{ background: 'linear-gradient(135deg, rgba(234,179,8,0.15), rgba(245,158,11,0.05))', border: '1px solid rgba(234,179,8,0.4)', borderRadius: '10px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: '#fef08a' }}>💰 Money Saved by Going Direct</span>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#facc15', marginTop: '2px' }}>
                  +₹{(savingsCalculation.commissionLost / 100000).toFixed(2)} Lakhs
                </div>
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────────────── */}
          {/* SEARCH & CATEGORY FILTER BAR                                              */}
          {/* ───────────────────────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Search Box */}
              <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
                <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Search funds, AMC or categories (e.g. Parag Parikh, Small Cap, Nifty 50, ELSS)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    background: 'rgba(0,0,0,0.35)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                {[
                  { id: 'ALL', label: 'All Top Funds' },
                  { id: 'LARGE_INDEX', label: '🏛️ Large & Index' },
                  { id: 'FLEXI_CAP', label: '🚀 Flexi & Multi Cap' },
                  { id: 'MID_SMALL', label: '⚡ Mid & Small Cap' },
                  { id: 'ELSS_TAX', label: '🛡️ Tax Saver (80C)' },
                  { id: 'HYBRID', label: '⚖️ Hybrid / BAF' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      background: selectedCategory === cat.id ? 'rgba(59, 130, 246, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                      color: selectedCategory === cat.id ? '#60a5fa' : '#94a3b8',
                      border: selectedCategory === cat.id ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────────────── */}
          {/* DIRECT MUTUAL FUNDS LIST                                                  */}
          {/* ───────────────────────────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
            {filteredFunds.map(fund => {
              const annualSavings = (fund.regularTer - fund.directTer).toFixed(2);
              const isExpanded = expandedFundId === fund.id;

              return (
                <div
                  key={fund.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                            {fund.categoryLabel}
                          </span>
                          {fund.tag && (
                            <span style={{ fontSize: '10px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                              {fund.tag}
                            </span>
                          )}
                        </div>
                        <h4 style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: '800', color: '#f8fafc', lineHeight: '1.3' }}>
                          {fund.name}
                        </h4>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{fund.amc}</span>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#fff' }}>₹{fund.nav.toFixed(2)}</div>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>NAV</span>
                      </div>
                    </div>

                    {/* Performance CAGR Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px 10px', marginTop: '12px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>1Y Return</div>
                        <div style={{ fontSize: '12.5px', fontWeight: '800', color: fund.cagr1y >= 0 ? '#22c55e' : '#ef4444' }}>
                          +{fund.cagr1y}%
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.06)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>3Y CAGR</div>
                        <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#22c55e' }}>
                          +{fund.cagr3y}%
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>5Y CAGR</div>
                        <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#38bdf8' }}>
                          +{fund.cagr5y}%
                        </div>
                      </div>
                    </div>

                    {/* Expense Ratio Direct vs Regular Comparison */}
                    <div style={{ marginTop: '10px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(234, 179, 8, 0.06)', border: '1px solid rgba(234, 179, 8, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
                      <div>
                        <span style={{ color: '#94a3b8' }}>TER: </span>
                        <strong style={{ color: '#22c55e' }}>{fund.directTer}% Direct</strong>
                        <span style={{ color: '#64748b' }}> vs {fund.regularTer}% Regular</span>
                      </div>
                      <span style={{ color: '#facc15', fontWeight: '700' }}>Save {annualSavings}%/yr</span>
                    </div>

                    {/* AUM & Min SIP */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10.5px', color: '#64748b' }}>
                      <span>AUM: ₹{(fund.aumCr / 1000).toFixed(1)}k Cr</span>
                      <span>Min SIP: ₹{fund.minSip}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenSipCalculator) {
                          onOpenSipCalculator(fund);
                        } else {
                          setExpectedReturn(Math.round(fund.cagr5y || 15));
                          const el = document.querySelector('.modal-content') || window;
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '8px',
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.2))',
                        border: '1px solid rgba(59, 130, 246, 0.4)',
                        borderRadius: '6px',
                        color: '#60a5fa',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Calculator size={13} /> Calculate SIP Compound
                    </button>

                    {onOpenPaperTradingMf && (
                      <button
                        type="button"
                        onClick={() => onOpenPaperTradingMf(fund)}
                        title="Simulate paper trade investment"
                        style={{
                          padding: '8px 10px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          color: '#cbd5e1',
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <ArrowUpRight size={13} /> Paper Trade
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(255, 255, 255, 0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ fontSize: '11.5px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} color="#22c55e" />
            <span>SEBI mandated direct plans eliminate distributor commissions, delivering 100% compounding returns to the investor.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              color: '#f8fafc',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Close Explorer
          </button>
        </div>

      </div>
    </div>
  );
}
