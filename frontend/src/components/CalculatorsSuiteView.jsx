// frontend/src/components/CalculatorsSuiteView.jsx
// 🧮 SkandX Institutional Calculators & Financial Tools Suite (Fyers-Style Full-Page Platform)

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, TrendingUp, DollarSign, Percent, ArrowLeft, ArrowRight,
  Download, FileText, PieChart, Table, RefreshCw, Plus, Trash2, CheckCircle2,
  HelpCircle, AlertCircle, Sparkles, Building2, ShieldAlert, Receipt, LineChart,
  BarChart2, Award, Clock, ChevronRight, Search, Sliders, ExternalLink, Share2, Printer
} from 'lucide-react';

// ============================================================================
// CALCULATOR DEFINITIONS & CATALOG DATA (Matching Fyers Directory)
// ============================================================================
const CALCULATORS_CATALOG = [
  // Investment & Wealth
  {
    id: 'sip',
    category: 'INVESTMENT',
    categoryLabel: 'Investment & Wealth',
    title: 'SIP Calculator',
    shortDesc: 'Calculate wealth created through disciplined systematic investment plans with annual step-up compounding.',
    icon: TrendingUp,
    color: '#0284c7',
    badge: 'Flagship Compounder',
    badgeColor: '#38bdf8'
  },
  {
    id: 'lumpsum',
    category: 'INVESTMENT',
    categoryLabel: 'Investment & Wealth',
    title: 'Lumpsum Calculator',
    shortDesc: 'Project exponential growth and wealth doubling periods for one-time capital allocations in equity and mutual funds.',
    icon: DollarSign,
    color: '#10b981',
    badge: 'Wealth Multiplier',
    badgeColor: '#34d399'
  },
  {
    id: 'mutual-funds',
    category: 'INVESTMENT',
    categoryLabel: 'Investment & Wealth',
    title: 'Mutual Funds & Fee Savings',
    shortDesc: 'Estimate mutual funds returns and see how much extra wealth you save by eliminating regular distributor trail commissions.',
    icon: BarChart2,
    color: '#3b82f6',
    badge: 'Direct vs Regular',
    badgeColor: '#60a5fa'
  },

  // Loans & Debt (Requested by User)
  {
    id: 'reducing-loan',
    category: 'LOANS',
    categoryLabel: 'Loans & Debt',
    title: 'Reducing Balance Loan Calculator',
    shortDesc: 'Institutional EMI calculator for Home and Auto loans where interest is calculated strictly on the declining principal balance.',
    icon: Building2,
    color: '#8b5cf6',
    badge: 'Bank Standard (SBI/HDFC)',
    badgeColor: '#a78bfa'
  },
  {
    id: 'fixed-loan',
    category: 'LOANS',
    categoryLabel: 'Loans & Debt',
    title: 'Fixed / Flat Rate Loan Calculator',
    shortDesc: 'Calculate Flat interest loan EMIs and uncover the true Effective APR to avoid hidden interest rate traps.',
    icon: Receipt,
    color: '#ec4899',
    badge: 'Flat vs APR Trap Detector',
    badgeColor: '#f472b6'
  },

  // Trading & Equities (From Fyers)
  {
    id: 'average-price',
    category: 'TRADING',
    categoryLabel: 'Trading & Equities',
    title: 'Average Share Price Calculator',
    shortDesc: 'Calculate weighted average purchase price across multiple accumulation tranches and calculate breakeven profit targets.',
    icon: RefreshCw,
    color: '#f59e0b',
    badge: 'Dip Buying & Averaging',
    badgeColor: '#fbbf24'
  },
  {
    id: 'mtf',
    category: 'TRADING',
    categoryLabel: 'Trading & Equities',
    title: 'MTF (Margin Trading Facility)',
    shortDesc: 'Calculate daily/monthly holding interest on 4x leveraged delivery shares and find the stock move required to break even.',
    icon: Sliders,
    color: '#06b6d4',
    badge: '4x Margin Funding',
    badgeColor: '#22d3ee'
  },
  {
    id: 'brokerage',
    category: 'TRADING',
    categoryLabel: 'Trading & Equities',
    title: 'Brokerage & Statutory STT',
    shortDesc: 'Net P&L calculator with revised Oct 2024 SEBI STT rates, exchange turnover fees, SEBI charges, Stamp Duty, and 18% GST.',
    icon: Receipt,
    color: '#eab308',
    badge: 'Oct 2024 SEBI Rates',
    badgeColor: '#facc15'
  },

  // Risk & Derivatives
  {
    id: 'position-size',
    category: 'RISK',
    categoryLabel: 'Risk & Derivatives',
    title: 'Position Sizing & Risk/Reward',
    shortDesc: 'Size your trades scientifically based on account capital, maximum risk percentage, stop loss, and target risk-to-reward ratio.',
    icon: ShieldAlert,
    color: '#ef4444',
    badge: 'Capital Protection',
    badgeColor: '#f87171'
  },
  {
    id: 'options-greeks',
    category: 'RISK',
    categoryLabel: 'Risk & Derivatives',
    title: 'Options Greeks (Black-Scholes)',
    shortDesc: 'Continuous compounding Black-Scholes pricing model for Delta, Gamma, Theta decay per day, and Vega volatility sensitivity.',
    icon: LineChart,
    color: '#a855f7',
    badge: 'F&O Derivatives',
    badgeColor: '#c084fc'
  }
];

const normalizeCalcId = (type) => {
  if (!type || type.toLowerCase() === 'all' || type.toLowerCase() === 'catalog') return 'CATALOG';
  const clean = type.toLowerCase().trim();
  if (clean === 'position-sizing') return 'position-size';
  if (clean === 'black-scholes') return 'options-greeks';
  if (clean === 'loan' || clean === 'emi') return 'reducing-loan';
  return clean;
};

export default function CalculatorsSuiteView({ initialType = 'all', onBack, onOpenPaperTrading }) {
  // Current active view: 'CATALOG' or specific calculator id (e.g. 'sip', 'reducing-loan')
  const [selectedCalcId, setSelectedCalcId] = useState(() => {
    if (typeof window !== 'undefined') {
      const parts = window.location.pathname.toLowerCase().split('/').filter(Boolean);
      if (parts[0] === 'calculators' && parts[1]) {
        return normalizeCalcId(parts[1]);
      }
    }
    return normalizeCalcId(initialType);
  });
  const [activeCatalogCategory, setActiveCatalogCategory] = useState('ALL');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [viewMode, setViewMode] = useState('CHART'); // 'CHART' | 'TABLE'
  const [copiedLink, setCopiedLink] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update selectedCalcId if initialType prop changes
  useEffect(() => {
    if (initialType) {
      setSelectedCalcId(normalizeCalcId(initialType));
    }
  }, [initialType]);

  // Sync deep-linked calculator URL (/calculators/:slug) for Google Search SEO & direct sharing
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const slugMap = {
      'position-size': 'position-sizing',
      'options-greeks': 'black-scholes'
    };
    const slug = slugMap[selectedCalcId] || selectedCalcId;
    const targetPath = selectedCalcId === 'CATALOG' ? '/calculators' : `/calculators/${slug}`;
    if (window.location.pathname.toLowerCase().startsWith('/calculators') && window.location.pathname !== targetPath) {
      window.history.replaceState(null, '', targetPath);
    }
    import('../utils/seoEngine').then(m => {
      if (m && typeof m.applyDynamicSEO === 'function') {
        m.applyDynamicSEO(targetPath);
      }
    }).catch(() => {});
  }, [selectedCalcId]);

  const handleCopyShareLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const activeCalcMeta = useMemo(() => {
    return CALCULATORS_CATALOG.find(c => c.id === selectedCalcId) || CALCULATORS_CATALOG[0];
  }, [selectedCalcId]);

  // Filtered Catalog
  const filteredCatalog = useMemo(() => {
    return CALCULATORS_CATALOG.filter(c => {
      const matchCat = activeCatalogCategory === 'ALL' || c.category === activeCatalogCategory;
      const matchSearch = !catalogSearch.trim() || 
        c.title.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        c.shortDesc.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        c.categoryLabel.toLowerCase().includes(catalogSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeCatalogCategory, catalogSearch]);

  // Export CSV Helper
  const downloadCSV = (filename, headers, rows) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print / PDF Helper
  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: 'var(--bg-main, #090d16)',
      color: '#f8fafc',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      overflowX: 'hidden'
    }}>
      {/* ── Topbar (Edge-to-Edge Institutional Header) ── */}
      <header style={{
        height: isMobile ? 'auto' : '62px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        padding: isMobile ? 'max(10px, env(safe-area-inset-top, 10px)) 12px 10px' : '0 24px',
        gap: isMobile ? '8px' : '16px',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: isMobile ? '8px' : '16px', width: isMobile ? '100%' : 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px', minWidth: 0, flex: 1 }}>
            <button
              onClick={() => {
                if (selectedCalcId !== 'CATALOG') {
                  setSelectedCalcId('CATALOG');
                } else if (onBack) {
                  onBack();
                }
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: isMobile ? '6px 10px' : '6px 12px',
                color: '#94a3b8',
                fontSize: isMobile ? '11.5px' : '12.5px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
            >
              <ArrowLeft size={14} />
              <span>{selectedCalcId === 'CATALOG' ? (isMobile ? 'Back' : 'Back to Home') : (isMobile ? 'All Tools' : 'All Calculators')}</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <div style={{
                width: isMobile ? '28px' : '32px',
                height: isMobile ? '28px' : '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0
              }}>
                <Calculator size={isMobile ? 15 : 18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? '13.5px' : '15px', fontWeight: '800', letterSpacing: '-0.3px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  SkandX Calculators
                </div>
                {!isMobile && (
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {selectedCalcId === 'CATALOG' ? 'Directory & Tools' : activeCalcMeta.title}
                  </span>
                )}
              </div>
            </div>
          </div>

          {isMobile && onOpenPaperTrading && (
            <button
              onClick={onOpenPaperTrading}
              style={{
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 10px',
                color: '#fff',
                fontSize: '11.5px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                boxShadow: '0 0 12px rgba(2, 132, 199, 0.35)'
              }}
            >
              <span>Terminal</span>
              <ArrowRight size={12} />
            </button>
          )}
        </div>

        {/* Topbar Right Actions */}
        {(selectedCalcId !== 'CATALOG' || (!isMobile && onOpenPaperTrading)) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px', width: isMobile ? '100%' : 'auto' }}>
            {selectedCalcId !== 'CATALOG' && (
              <>
                {/* Calculator Quick-Switch Dropdown */}
                <select
                  value={selectedCalcId}
                  onChange={e => setSelectedCalcId(e.target.value)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: isMobile ? '12px' : '12.5px',
                    fontWeight: '600',
                    padding: isMobile ? '6px 8px' : '7px 12px',
                    outline: 'none',
                    cursor: 'pointer',
                    flex: isMobile ? 1 : 'initial',
                    minWidth: 0
                  }}
                >
                  {CALCULATORS_CATALOG.map(calc => (
                    <option key={calc.id} value={calc.id} style={{ background: '#0f172a', color: '#fff' }}>
                      {calc.title}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleCopyShareLink}
                  style={{
                    background: copiedLink ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: copiedLink ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    padding: isMobile ? '6px 10px' : '7px 12px',
                    color: copiedLink ? '#34d399' : '#cbd5e1',
                    fontSize: '11.5px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                  title="Copy Direct Calculator Link"
                >
                  <Share2 size={13} />
                  <span>{copiedLink ? 'Copied!' : (isMobile ? 'Share' : 'Share Link')}</span>
                </button>

                <button
                  onClick={handlePrintPDF}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    padding: isMobile ? '6px 10px' : '7px 12px',
                    color: '#cbd5e1',
                    fontSize: '11.5px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                  title="Print or Save as PDF"
                >
                  <Printer size={13} />
                  <span>PDF</span>
                </button>
              </>
            )}

            {!isMobile && onOpenPaperTrading && (
              <button
                onClick={onOpenPaperTrading}
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 14px',
                  color: '#fff',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 0 16px rgba(2, 132, 199, 0.35)'
                }}
              >
                <span>Paper Trading</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── Main View Content ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedCalcId === 'CATALOG' ? (
          <CatalogDirectoryView 
            catalog={filteredCatalog}
            selectedCategory={activeCatalogCategory}
            onSelectCategory={setActiveCatalogCategory}
            searchQuery={catalogSearch}
            onSearchChange={setCatalogSearch}
            onSelectCalculator={setSelectedCalcId}
            isMobile={isMobile}
          />
        ) : (
          <DedicatedCalculatorView 
            calcId={selectedCalcId}
            calcMeta={activeCalcMeta}
            viewMode={viewMode}
            onToggleViewMode={setViewMode}
            onBackToCatalog={() => setSelectedCalcId('CATALOG')}
            onDownloadCSV={downloadCSV}
            onPrintPDF={handlePrintPDF}
            onOpenPaperTrading={onOpenPaperTrading}
            isMobile={isMobile}
          />
        )}
      </main>
    </div>
  );
}

// ============================================================================
// COMPONENT 1: CATALOG DIRECTORY VIEW (Matching Fyers Screen 1)
// ============================================================================
function CatalogDirectoryView({
  catalog, selectedCategory, onSelectCategory, searchQuery, onSearchChange, onSelectCalculator, isMobile
}) {
  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', padding: isMobile ? '16px 12px 60px' : '32px 24px', boxSizing: 'border-box' }}>
      {/* Hero Banner */}
      <div style={{ marginBottom: isMobile ? '18px' : '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
          <Sparkles size={14} />
          <span>Institutional Computational Math</span>
        </div>
        <h1 style={{ fontSize: isMobile ? '22px' : 'clamp(24px, 3vw, 32px)', fontWeight: '900', margin: 0, letterSpacing: '-0.5px', color: '#f8fafc' }}>
          Financial & Trading Calculators
        </h1>
        <p style={{ fontSize: isMobile ? '12.5px' : '14px', color: '#94a3b8', margin: '6px 0 0', maxWidth: '720px', lineHeight: '1.5' }}>
          Explore our suite of compounding models, multi-tranche stock averaging, MTF leverage costs, SEBI tax calculations, and loan amortization engines.
        </p>
      </div>

      {/* Search & Category Filter Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: isMobile ? '16px' : '24px' }}>
        {/* Category Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', paddingBottom: '4px', width: isMobile ? '100%' : 'auto' }}>
          {[
            { id: 'ALL', label: `All (${CALCULATORS_CATALOG.length})` },
            { id: 'INVESTMENT', label: '📈 Investment (3)' },
            { id: 'TRADING', label: '⚡ Trading (3)' },
            { id: 'LOANS', label: '🏦 Loans (2)' },
            { id: 'RISK', label: '🎯 Risk & Greeks (2)' }
          ].map(cat => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                style={{
                  padding: isMobile ? '7px 12px' : '8px 16px',
                  borderRadius: '20px',
                  border: 'none',
                  background: isActive ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'rgba(255, 255, 255, 0.05)',
                  color: isActive ? '#fff' : '#94a3b8',
                  fontSize: isMobile ? '12px' : '13px',
                  fontWeight: isActive ? '700' : '500',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '10px',
          padding: '8px 14px',
          minWidth: isMobile ? '100%' : '280px',
          width: isMobile ? '100%' : 'auto',
          boxSizing: 'border-box'
        }}>
          <Search size={16} color="#94a3b8" />
          <input 
            type="text"
            placeholder="Search calculators (e.g. Loan, SIP, MTF)..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '13px', width: '100%', outline: 'none' }}
          />
        </div>
      </div>

      {/* Grid of Calculator Cards (Fyers Layout) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: isMobile ? '14px' : '20px' }}>
        {catalog.map(calc => {
          const Icon = calc.icon;
          return (
            <div
              key={calc.id}
              onClick={() => onSelectCalculator(calc.id)}
              style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: isMobile ? '16px' : '22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.5)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: `${calc.color}22`,
                    border: `1px solid ${calc.color}44`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: calc.color
                  }}>
                    <Icon size={20} />
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: calc.badgeColor,
                    background: `${calc.color}15`,
                    border: `1px solid ${calc.color}35`,
                    padding: '3px 8px',
                    borderRadius: '6px'
                  }}>
                    {calc.badge}
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '2px' }}>
                  {calc.categoryLabel}
                </div>
                <h3 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#f8fafc', margin: '0 0 6px', lineHeight: '1.3' }}>
                  {calc.title}
                </h3>
                <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '0 0 14px', lineHeight: '1.5' }}>
                  {calc.shortDesc}
                </p>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)'
              }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#38bdf8' }}>
                  Launch Calculator
                </span>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8'
                }}>
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT 2: DEDICATED FULL-PAGE CALCULATOR VIEW (Matching Fyers Screen 2)
// ============================================================================
function DedicatedCalculatorView({
  calcId, calcMeta, viewMode, onToggleViewMode, onBackToCatalog, onDownloadCSV, onPrintPDF, onOpenPaperTrading, isMobile
}) {
  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', padding: isMobile ? '14px 12px 60px' : '24px', boxSizing: 'border-box' }}>
      {/* Calculator Header Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: isMobile ? '16px' : '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
              {calcMeta.categoryLabel}
            </span>
            <span style={{ color: '#475569' }}>•</span>
            <span style={{ fontSize: '11px', color: calcMeta.badgeColor, fontWeight: '700' }}>
              {calcMeta.badge}
            </span>
          </div>
          <h1 style={{ fontSize: isMobile ? '20px' : '26px', fontWeight: '900', color: '#f8fafc', margin: '4px 0 0' }}>
            {calcMeta.title}
          </h1>
        </div>

        {/* Chart vs Table View Toggle + Export Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex',
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            padding: '3px'
          }}>
            <button
              onClick={() => onToggleViewMode('CHART')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'CHART' ? '#0284c7' : 'transparent',
                color: viewMode === 'CHART' ? '#fff' : '#94a3b8',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <PieChart size={14} />
              <span>Chart</span>
            </button>
            <button
              onClick={() => onToggleViewMode('TABLE')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'TABLE' ? '#0284c7' : 'transparent',
                color: viewMode === 'TABLE' ? '#fff' : '#94a3b8',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Table size={14} />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Calculator Specific View */}
      {calcId === 'sip' && (
        <SipCalculatorEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
          onOpenPaperTrading={onOpenPaperTrading}
        />
      )}
      {calcId === 'lumpsum' && (
        <LumpsumCalculatorEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
          onOpenPaperTrading={onOpenPaperTrading}
        />
      )}
      {calcId === 'mutual-funds' && (
        <MutualFundsCalculatorEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
          onOpenPaperTrading={onOpenPaperTrading}
        />
      )}
      {calcId === 'reducing-loan' && (
        <ReducingLoanCalculatorEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
        />
      )}
      {calcId === 'fixed-loan' && (
        <FixedLoanCalculatorEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
        />
      )}
      {calcId === 'average-price' && (
        <AverageSharePriceEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
          onOpenPaperTrading={onOpenPaperTrading}
        />
      )}
      {calcId === 'mtf' && (
        <MtfCalculatorEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
          onOpenPaperTrading={onOpenPaperTrading}
        />
      )}
      {calcId === 'brokerage' && (
        <BrokerageTaxEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
          onOpenPaperTrading={onOpenPaperTrading}
        />
      )}
      {calcId === 'position-size' && (
        <PositionSizerEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
          onOpenPaperTrading={onOpenPaperTrading}
        />
      )}
      {calcId === 'options-greeks' && (
        <OptionGreeksEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
          onOpenPaperTrading={onOpenPaperTrading}
        />
      )}
    </div>
  );
}

// ============================================================================
// 1. REDUCING BALANCE LOAN EMI CALCULATOR (Requested by User)
// ============================================================================
function ReducingLoanCalculatorEngine({ viewMode, onDownloadCSV }) {
  const [loanAmount, setLoanAmount] = useState(2500000);
  const [interestRate, setInterestRate] = useState(8.75); // % p.a.
  const [tenureYears, setTenureYears] = useState(20);

  const math = useMemo(() => {
    const P = loanAmount;
    const n = tenureYears * 12;
    const r = interestRate / 12 / 100;

    let emi = 0;
    if (r > 0 && n > 0) {
      emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    } else {
      emi = P / n;
    }

    const totalRepayment = emi * n;
    const totalInterest = Math.max(0, totalRepayment - P);

    // Build Amortization Schedule
    let balance = P;
    const schedule = [];
    for (let yr = 1; yr <= tenureYears; yr++) {
      let yrPrincipal = 0;
      let yrInterest = 0;
      for (let m = 1; m <= 12; m++) {
        const mInterest = balance * r;
        const mPrincipal = emi - mInterest;
        balance = Math.max(0, balance - mPrincipal);
        yrPrincipal += mPrincipal;
        yrInterest += mInterest;
      }
      schedule.push({
        year: yr,
        emiPaid: Math.round(emi * 12),
        principalPaid: Math.round(yrPrincipal),
        interestPaid: Math.round(yrInterest),
        balance: Math.round(balance)
      });
    }

    return {
      emi: Math.round(emi),
      totalInterest: Math.round(totalInterest),
      totalRepayment: Math.round(totalRepayment),
      schedule,
      interestRatio: totalRepayment > 0 ? ((totalInterest / totalRepayment) * 100).toFixed(1) : '0'
    };
  }, [loanAmount, interestRate, tenureYears]);

  const handleExport = () => {
    const headers = ['Year', 'Annual EMI Paid (₹)', 'Principal Repaid (₹)', 'Interest Paid (₹)', 'Remaining Balance (₹)'];
    const rows = math.schedule.map(row => [row.year, row.emiPaid, row.principalPaid, row.interestPaid, row.balance]);
    onDownloadCSV(`reducing_loan_emi_${loanAmount}`, headers, rows);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
      {/* Left Input Sliders Panel */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {/* Loan Amount Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Loan Amount</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: '#38bdf8', fontWeight: '700' }}>₹</span>
              <input 
                type="number"
                value={loanAmount}
                onChange={e => setLoanAmount(Math.max(10000, Number(e.target.value)))}
                style={{ width: '110px', background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', fontWeight: '800', outline: 'none' }}
              />
            </div>
          </div>
          <input 
            type="range" min="100000" max="20000000" step="50000"
            value={loanAmount} onChange={e => setLoanAmount(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#8b5cf6', marginTop: '12px' }}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            {[1000000, 2500000, 5000000, 10000000].map(amt => (
              <button key={amt} onClick={() => setLoanAmount(amt)} style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', fontSize: '11px', cursor: 'pointer' }}>
                ₹{(amt / 100000).toFixed(0)}L
              </button>
            ))}
          </div>
        </div>

        {/* Interest Rate Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Reducing Interest Rate (p.a)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <input 
                type="number" step="0.05"
                value={interestRate}
                onChange={e => setInterestRate(Math.max(1, Number(e.target.value)))}
                style={{ width: '60px', background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', fontWeight: '800', outline: 'none' }}
              />
              <span style={{ color: '#8b5cf6', fontWeight: '700' }}>%</span>
            </div>
          </div>
          <input 
            type="range" min="5" max="20" step="0.1"
            value={interestRate} onChange={e => setInterestRate(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#8b5cf6', marginTop: '12px' }}
          />
        </div>

        {/* Tenure Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Loan Tenure</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <input 
                type="number"
                value={tenureYears}
                onChange={e => setTenureYears(Math.max(1, Number(e.target.value)))}
                style={{ width: '50px', background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', fontWeight: '800', outline: 'none' }}
              />
              <span style={{ color: '#10b981', fontWeight: '700' }}>Yrs</span>
            </div>
          </div>
          <input 
            type="range" min="1" max="30" step="1"
            value={tenureYears} onChange={e => setTenureYears(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#8b5cf6', marginTop: '12px' }}
          />
        </div>

        <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#c4b5fd', lineHeight: '1.4' }}>
          💡 <strong>Reducing Balance Formula:</strong> Monthly interest is assessed only on your remaining balance. As you repay principal, the interest share shrinks each month!
        </div>
      </div>

      {/* Right Results Panel (Chart vs Table Toggle) */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        {viewMode === 'CHART' ? (
          <div>
            <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Monthly EMI Repayment
            </div>
            <div style={{ fontSize: '36px', fontWeight: '900', color: '#8b5cf6', margin: '4px 0 16px' }}>
              ₹{math.emi.toLocaleString('en-IN')} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: '500' }}>/ month</span>
            </div>

            {/* Results Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '600' }}>Principal Loan</div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                  ₹{loanAmount.toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#fca5a5', fontWeight: '600' }}>Total Interest</div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                  ₹{math.totalInterest.toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#86efac', fontWeight: '600' }}>Total Payment</div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                  ₹{math.totalRepayment.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* SVG Visual Donut Chart (Fyers Style) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '20px', margin: '16px 0' }}>
              <svg width="180" height="180" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#0284c7" strokeWidth="6" />
                <circle 
                  cx="21" cy="21" r="15.91549430918954" fill="transparent" 
                  stroke="#ef4444" strokeWidth="6" 
                  strokeDasharray={`${math.interestRatio} ${100 - math.interestRatio}`}
                  strokeDashoffset="25"
                />
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#0284c7' }} />
                  <span style={{ fontSize: '12.5px', color: '#cbd5e1' }}>Principal: {(100 - math.interestRatio).toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ef4444' }} />
                  <span style={{ fontSize: '12.5px', color: '#cbd5e1' }}>Interest: {math.interestRatio}%</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Year</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Annual EMI</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Principal</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Interest</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {math.schedule.map(row => (
                  <tr key={row.year} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px', fontWeight: '700' }}>Yr {row.year}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#cbd5e1' }}>₹{row.emiPaid.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#38bdf8' }}>₹{row.principalPaid.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#f87171' }}>₹{row.interestPaid.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#f8fafc' }}>₹{row.balance.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Download Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
          <button
            onClick={handleExport}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Download size={14} />
            <span>Export Amortization Schedule (CSV)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. FIXED / FLAT RATE LOAN CALCULATOR (Requested by User)
// ============================================================================
function FixedLoanCalculatorEngine({ viewMode, onDownloadCSV }) {
  const [loanAmount, setLoanAmount] = useState(500000);
  const [flatRate, setFlatRate] = useState(10.0); // % p.a.
  const [tenureYears, setTenureYears] = useState(3);

  const math = useMemo(() => {
    const P = loanAmount;
    const T = tenureYears;
    const n = T * 12;

    const totalInterest = P * (flatRate / 100) * T;
    const totalRepayment = P + totalInterest;
    const emi = totalRepayment / n;

    // Approximate Effective APR (Flat Rate vs Reducing Rate Converter)
    // Approximate rule of thumb: Effective APR ≈ Flat Rate * (2n / (n + 1))
    const effectiveApr = n > 0 ? (flatRate * ((2 * n) / (n + 1))).toFixed(2) : flatRate;

    // Build Schedule
    const schedule = [];
    const monthlyPrincipal = P / n;
    const monthlyInterest = totalInterest / n;
    for (let yr = 1; yr <= tenureYears; yr++) {
      schedule.push({
        year: yr,
        annualPaid: Math.round(emi * 12),
        principalPaid: Math.round(monthlyPrincipal * 12),
        interestPaid: Math.round(monthlyInterest * 12),
        remainingCost: Math.round(Math.max(0, totalRepayment - (emi * 12 * yr)))
      });
    }

    return {
      emi: Math.round(emi),
      totalInterest: Math.round(totalInterest),
      totalRepayment: Math.round(totalRepayment),
      effectiveApr,
      schedule,
      interestRatio: totalRepayment > 0 ? ((totalInterest / totalRepayment) * 100).toFixed(1) : '0'
    };
  }, [loanAmount, flatRate, tenureYears]);

  const handleExport = () => {
    const headers = ['Year', 'Annual EMI (₹)', 'Principal Repaid (₹)', 'Flat Interest Paid (₹)', 'Remaining Total Repayment (₹)'];
    const rows = math.schedule.map(row => [row.year, row.annualPaid, row.principalPaid, row.interestPaid, row.remainingCost]);
    onDownloadCSV(`flat_rate_loan_${loanAmount}`, headers, rows);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
      {/* Input Sliders */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Loan Amount</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: '#ec4899', fontWeight: '700' }}>₹</span>
              <input 
                type="number"
                value={loanAmount}
                onChange={e => setLoanAmount(Math.max(10000, Number(e.target.value)))}
                style={{ width: '100px', background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', fontWeight: '800', outline: 'none' }}
              />
            </div>
          </div>
          <input 
            type="range" min="50000" max="5000000" step="10000"
            value={loanAmount} onChange={e => setLoanAmount(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#ec4899', marginTop: '12px' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Quoted Flat Interest Rate</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <input 
                type="number" step="0.1"
                value={flatRate}
                onChange={e => setFlatRate(Math.max(1, Number(e.target.value)))}
                style={{ width: '60px', background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', fontWeight: '800', outline: 'none' }}
              />
              <span style={{ color: '#ec4899', fontWeight: '700' }}>%</span>
            </div>
          </div>
          <input 
            type="range" min="3" max="25" step="0.25"
            value={flatRate} onChange={e => setFlatRate(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#ec4899', marginTop: '12px' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Tenure</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <input 
                type="number"
                value={tenureYears}
                onChange={e => setTenureYears(Math.max(1, Number(e.target.value)))}
                style={{ width: '50px', background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', fontWeight: '800', outline: 'none' }}
              />
              <span style={{ color: '#10b981', fontWeight: '700' }}>Yrs</span>
            </div>
          </div>
          <input 
            type="range" min="1" max="10" step="1"
            value={tenureYears} onChange={e => setTenureYears(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#ec4899', marginTop: '12px' }}
          />
        </div>

        {/* Warning Callout about Flat vs Effective APR */}
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontSize: '13px', fontWeight: '700' }}>
            <AlertCircle size={15} />
            <span>Hidden APR Trap Detector</span>
          </div>
          <div style={{ fontSize: '12px', color: '#fca5a5', marginTop: '4px', lineHeight: '1.45' }}>
            A <strong>{flatRate}% flat rate</strong> feels cheap, but because interest is charged on the original principal for the entire loan, your <strong>True Effective APR is ~{math.effectiveApr}%</strong>!
          </div>
        </div>
      </div>

      {/* Results Panel */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Monthly EMI
          </div>
          <div style={{ fontSize: '36px', fontWeight: '900', color: '#ec4899', margin: '4px 0 16px' }}>
            ₹{math.emi.toLocaleString('en-IN')} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: '500' }}>/ month</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '12px', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '600' }}>Principal Amount</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                ₹{loanAmount.toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#fca5a5', fontWeight: '600' }}>Flat Interest</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                ₹{math.totalInterest.toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ background: 'rgba(236, 72, 153, 0.08)', border: '1px solid rgba(236, 72, 153, 0.2)', padding: '12px', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#f472b6', fontWeight: '600' }}>True APR Rate</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#f472b6', marginTop: '2px' }}>
                {math.effectiveApr}% p.a.
              </div>
            </div>
          </div>

          {/* Donut Chart */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '20px', margin: '16px 0' }}>
            <svg width="180" height="180" viewBox="0 0 42 42">
              <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#0284c7" strokeWidth="6" />
              <circle 
                cx="21" cy="21" r="15.91549430918954" fill="transparent" 
                stroke="#ec4899" strokeWidth="6" 
                strokeDasharray={`${math.interestRatio} ${100 - math.interestRatio}`}
                strokeDashoffset="25"
              />
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#0284c7' }} />
                <span style={{ fontSize: '12.5px', color: '#cbd5e1' }}>Principal: {(100 - math.interestRatio).toFixed(1)}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ec4899' }} />
                <span style={{ fontSize: '12.5px', color: '#cbd5e1' }}>Interest: {math.interestRatio}%</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleExport}
          style={{
            padding: '10px',
            borderRadius: '8px',
            background: 'rgba(236, 72, 153, 0.1)',
            border: '1px solid rgba(236, 72, 153, 0.3)',
            color: '#f472b6',
            fontSize: '12.5px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Download size={14} />
          <span>Export Flat Loan Summary (CSV)</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 3. AVERAGE SHARE PRICE CALCULATOR (From Fyers)
// ============================================================================
function AverageSharePriceEngine({ viewMode, onDownloadCSV, onOpenPaperTrading }) {
  const [tranches, setTranches] = useState([
    { id: 1, price: 2450, qty: 50 },
    { id: 2, price: 2320, qty: 75 },
    { id: 3, price: 2180, qty: 100 }
  ]);
  const [targetGainPct, setTargetGainPct] = useState(15);

  const math = useMemo(() => {
    let totalQty = 0;
    let totalInvestment = 0;

    const list = tranches.map(t => {
      const cost = t.price * t.qty;
      totalQty += t.qty;
      totalInvestment += cost;
      return {
        ...t,
        cost,
        runningAvg: totalQty > 0 ? (totalInvestment / totalQty).toFixed(2) : '0'
      };
    });

    const avgPrice = totalQty > 0 ? totalInvestment / totalQty : 0;
    const targetSellPrice = avgPrice * (1 + targetGainPct / 100);
    const targetProfitAmount = totalInvestment * (targetGainPct / 100);

    return {
      totalQty,
      totalInvestment,
      avgPrice: avgPrice.toFixed(2),
      targetSellPrice: targetSellPrice.toFixed(2),
      targetProfitAmount: Math.round(targetProfitAmount),
      list
    };
  }, [tranches, targetGainPct]);

  const addTranche = () => {
    setTranches(prev => [
      ...prev,
      { id: Date.now(), price: 2000, qty: 50 }
    ]);
  };

  const removeTranche = (id) => {
    if (tranches.length <= 1) return;
    setTranches(prev => prev.filter(t => t.id !== id));
  };

  const updateTranche = (id, field, value) => {
    setTranches(prev => prev.map(t => {
      if (t.id === id) {
        return { ...t, [field]: Number(value) };
      }
      return t;
    }));
  };

  const handleExport = () => {
    const headers = ['Tranche #', 'Purchase Price (₹)', 'Shares Bought', 'Total Tranche Cost (₹)', 'Cumulative Avg (₹)'];
    const rows = math.list.map((t, idx) => [idx + 1, t.price, t.qty, t.cost, t.runningAvg]);
    onDownloadCSV('average_share_price_calculation', headers, rows);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
      {/* Left Tranches Input Panel */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#f8fafc' }}>
              Stock Accumulation Tranches
            </h3>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Add all purchases to compute weighted average</span>
          </div>
          <button
            onClick={addTranche}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Plus size={14} />
            <span>Add Buy Lot</span>
          </button>
        </div>

        {/* Tranche Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {tranches.map((t, idx) => (
            <div 
              key={t.id}
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', minWidth: '40px' }}>
                LOT #{idx + 1}
              </span>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10.5px', color: '#94a3b8' }}>Price (₹)</label>
                <input 
                  type="number"
                  value={t.price}
                  onChange={e => updateTranche(t.id, 'price', e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px', color: '#fff', fontSize: '13px', fontWeight: '700', marginTop: '2px' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10.5px', color: '#94a3b8' }}>Qty</label>
                <input 
                  type="number"
                  value={t.qty}
                  onChange={e => updateTranche(t.id, 'qty', e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px', color: '#fff', fontSize: '13px', fontWeight: '700', marginTop: '2px' }}
                />
              </div>
              <button
                onClick={() => removeTranche(t.id)}
                disabled={tranches.length <= 1}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: tranches.length > 1 ? '#ef4444' : '#475569',
                  cursor: tranches.length > 1 ? 'pointer' : 'default',
                  padding: '6px',
                  marginTop: '14px'
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Target Gain Slider */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '12.5px', color: '#94a3b8', fontWeight: '600' }}>Target Profit Goal (%)</label>
            <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#10b981' }}>+{targetGainPct}%</span>
          </div>
          <input 
            type="range" min="2" max="100" step="1"
            value={targetGainPct} onChange={e => setTargetGainPct(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#10b981', marginTop: '8px' }}
          />
        </div>
      </div>

      {/* Right Weighted Average Results Panel */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <div>
          <span style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Weighted Average Purchase Price
          </span>
          <div style={{ fontSize: '38px', fontWeight: '900', color: '#f59e0b', margin: '4px 0 16px' }}>
            ₹{Number(math.avgPrice).toLocaleString('en-IN')} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: '500' }}>/ share</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '12px', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '600' }}>Total Shares Owned</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                {math.totalQty.toLocaleString('en-IN')} units
              </div>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#86efac', fontWeight: '600' }}>Total Capital Invested</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                ₹{math.totalInvestment.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Target Sell Target Card */}
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11.5px', color: '#86efac', fontWeight: '700', textTransform: 'uppercase' }}>
                  Target Sell Price for +{targetGainPct}% Gain
                </div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
                  ₹{Number(math.targetSellPrice).toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>Target Net Profit</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                  +₹{math.targetProfitAmount.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleExport}
          style={{
            padding: '10px',
            borderRadius: '8px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#fbbf24',
            fontSize: '12.5px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Download size={14} />
          <span>Export Tranches & Average Price (CSV)</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 4. MTF (MARGIN TRADING FACILITY) CALCULATOR (From Fyers)
// ============================================================================
function MtfCalculatorEngine({ viewMode, onDownloadCSV, onOpenPaperTrading }) {
  const [tradeValue, setTradeValue] = useState(200000);
  const [marginPct, setMarginPct] = useState(25); // e.g. 25% margin = 4x leverage
  const [holdingDays, setHoldingDays] = useState(30);
  const [mtfInterestRate, setMtfInterestRate] = useState(12.5); // % p.a.

  const math = useMemo(() => {
    const clientMargin = tradeValue * (marginPct / 100);
    const borrowedAmount = tradeValue - clientMargin;
    const dailyInterestRate = (mtfInterestRate / 100) / 365;
    const dailyInterest = borrowedAmount * dailyInterestRate;
    const totalInterest = dailyInterest * holdingDays;
    const breakevenStockMovePct = tradeValue > 0 ? (totalInterest / tradeValue) * 100 : 0;

    return {
      clientMargin: Math.round(clientMargin),
      borrowedAmount: Math.round(borrowedAmount),
      dailyInterest: dailyInterest.toFixed(2),
      totalInterest: Math.round(totalInterest),
      breakevenStockMovePct: breakevenStockMovePct.toFixed(2),
      leverageMultiplier: marginPct > 0 ? (100 / marginPct).toFixed(1) : '1.0'
    };
  }, [tradeValue, marginPct, holdingDays, mtfInterestRate]);

  const handleExport = () => {
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Stock Trade Value', `₹${tradeValue}`],
      ['Client Cash Margin', `₹${math.clientMargin}`],
      ['Broker MTF Borrowed Funds', `₹${math.borrowedAmount}`],
      ['Leverage Multiplier', `${math.leverageMultiplier}x`],
      ['Holding Period', `${holdingDays} Days`],
      ['MTF Annual Interest Rate', `${mtfInterestRate}%`],
      ['Daily Interest Cost', `₹${math.dailyInterest}`],
      ['Total MTF Interest Cost', `₹${math.totalInterest}`],
      ['Breakeven Stock Move', `+${math.breakevenStockMovePct}%`]
    ];
    onDownloadCSV(`mtf_calculator_${tradeValue}`, headers, rows);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
      {/* Inputs */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Total Trade Value (Stock)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: '#06b6d4', fontWeight: '700' }}>₹</span>
              <input 
                type="number"
                value={tradeValue}
                onChange={e => setTradeValue(Math.max(10000, Number(e.target.value)))}
                style={{ width: '100px', background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', fontWeight: '800', outline: 'none' }}
              />
            </div>
          </div>
          <input 
            type="range" min="20000" max="2000000" step="10000"
            value={tradeValue} onChange={e => setTradeValue(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#06b6d4', marginTop: '12px' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Client Margin Required (%)</label>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#06b6d4' }}>{marginPct}% ({math.leverageMultiplier}x Leverage)</span>
          </div>
          <input 
            type="range" min="20" max="50" step="5"
            value={marginPct} onChange={e => setMarginPct(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#06b6d4', marginTop: '12px' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Holding Duration</label>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#10b981' }}>{holdingDays} Days</span>
          </div>
          <input 
            type="range" min="1" max="365" step="1"
            value={holdingDays} onChange={e => setHoldingDays(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#06b6d4', marginTop: '12px' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Broker MTF Interest (p.a)</label>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#f59e0b' }}>{mtfInterestRate}% p.a.</span>
          </div>
          <input 
            type="range" min="9" max="18" step="0.5"
            value={mtfInterestRate} onChange={e => setMtfInterestRate(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#06b6d4', marginTop: '12px' }}
          />
        </div>
      </div>

      {/* Results */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <div>
          <span style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Total MTF Financing Cost
          </span>
          <div style={{ fontSize: '38px', fontWeight: '900', color: '#06b6d4', margin: '4px 0 16px' }}>
            ₹{math.totalInterest.toLocaleString('en-IN')} <span style={{ fontSize: '13.5px', color: '#94a3b8', fontWeight: '500' }}>for {holdingDays} days</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#86efac', fontWeight: '600' }}>Your Cash Margin</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                ₹{math.clientMargin.toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '12px', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '600' }}>Broker Borrowed Funds</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                ₹{math.borrowedAmount.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Daily Interest Debit:</span>
              <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#f59e0b' }}>₹{math.dailyInterest} / day</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Breakeven Stock Gain:</span>
              <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#10b981' }}>+{math.breakevenStockMovePct}%</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleExport}
          style={{
            padding: '10px',
            borderRadius: '8px',
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            color: '#22d3ee',
            fontSize: '12.5px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Download size={14} />
          <span>Export MTF Financing Breakdown (CSV)</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 5. SIP COMPONENT ENGINE (Fyers Style)
// ============================================================================
function SipCalculatorEngine({ viewMode, onDownloadCSV, onOpenPaperTrading }) {
  const [monthlyInvestment, setMonthlyInvestment] = useState(25000);
  const [expectedReturn, setExpectedReturn] = useState(12);
  const [tenureYears, setTenureYears] = useState(10);
  const [stepUpPct, setStepUpPct] = useState(10); // annual step-up %

  const math = useMemo(() => {
    const rateMonthly = expectedReturn / 12 / 100;
    const totalMonths = tenureYears * 12;

    let totalInvested = 0;
    let currentMonthly = monthlyInvestment;
    let futureVal = 0;
    const schedule = [];

    let runningCorpus = 0;
    for (let yr = 1; yr <= tenureYears; yr++) {
      let yrInvested = 0;
      for (let m = 1; m <= 12; m++) {
        yrInvested += currentMonthly;
        totalInvested += currentMonthly;
        const remainingMonths = totalMonths - ((yr - 1) * 12 + m) + 1;
        futureVal += currentMonthly * Math.pow(1 + rateMonthly, remainingMonths);
      }
      runningCorpus = futureVal;
      schedule.push({
        year: yr,
        annualDeposit: Math.round(yrInvested),
        totalInvested: Math.round(totalInvested),
        futureVal: Math.round(futureVal)
      });
      if (stepUpPct > 0) {
        currentMonthly = currentMonthly * (1 + stepUpPct / 100);
      }
    }

    const estimatedReturn = Math.max(0, futureVal - totalInvested);
    const wealthRatio = futureVal > 0 ? ((totalInvested / futureVal) * 100).toFixed(1) : '50';

    return {
      totalInvested: Math.round(totalInvested),
      estimatedReturn: Math.round(estimatedReturn),
      totalValue: Math.round(futureVal),
      wealthRatio,
      schedule
    };
  }, [monthlyInvestment, expectedReturn, tenureYears, stepUpPct]);

  const handleExport = () => {
    const headers = ['Year', 'Annual Deposit (₹)', 'Total Cumulative Invested (₹)', 'Maturity Corpus (₹)'];
    const rows = math.schedule.map(row => [row.year, row.annualDeposit, row.totalInvested, row.futureVal]);
    onDownloadCSV(`sip_schedule_${monthlyInvestment}`, headers, rows);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
      {/* Input Sliders */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Monthly Investment</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: '#0284c7', fontWeight: '700' }}>₹</span>
              <input 
                type="number"
                value={monthlyInvestment}
                onChange={e => setMonthlyInvestment(Math.max(500, Number(e.target.value)))}
                style={{ width: '90px', background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', fontWeight: '800', outline: 'none' }}
              />
            </div>
          </div>
          <input 
            type="range" min="1000" max="200000" step="1000"
            value={monthlyInvestment} onChange={e => setMonthlyInvestment(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#0284c7', marginTop: '12px' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Expected Return Rate (p.a)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <input 
                type="number" step="0.5"
                value={expectedReturn}
                onChange={e => setExpectedReturn(Math.max(1, Number(e.target.value)))}
                style={{ width: '50px', background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', fontWeight: '800', outline: 'none' }}
              />
              <span style={{ color: '#0284c7', fontWeight: '700' }}>%</span>
            </div>
          </div>
          <input 
            type="range" min="5" max="30" step="0.5"
            value={expectedReturn} onChange={e => setExpectedReturn(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#0284c7', marginTop: '12px' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Time Period</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <input 
                type="number"
                value={tenureYears}
                onChange={e => setTenureYears(Math.max(1, Number(e.target.value)))}
                style={{ width: '45px', background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', fontWeight: '800', outline: 'none' }}
              />
              <span style={{ color: '#10b981', fontWeight: '700' }}>Yr</span>
            </div>
          </div>
          <input 
            type="range" min="1" max="40" step="1"
            value={tenureYears} onChange={e => setTenureYears(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#0284c7', marginTop: '12px' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Annual Step-Up (% / year)</label>
            <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#f59e0b' }}>+{stepUpPct}%</span>
          </div>
          <input 
            type="range" min="0" max="25" step="1"
            value={stepUpPct} onChange={e => setStepUpPct(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#0284c7', marginTop: '12px' }}
          />
        </div>
      </div>

      {/* Results (Matching Fyers Screen 2 Donut & Table) */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        {viewMode === 'CHART' ? (
          <div>
            <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600', marginBottom: '8px' }}>
              After {tenureYears} years of investment
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>Invested Value</span>
                <span style={{ fontSize: '15px', fontWeight: '800', color: '#0284c7' }}>₹{math.totalInvested.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>Estimated Return</span>
                <span style={{ fontSize: '15px', fontWeight: '800', color: '#10b981' }}>₹{math.estimatedReturn.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#f8fafc' }}>Total Value</span>
                <span style={{ fontSize: '20px', fontWeight: '900', color: '#38bdf8' }}>₹{math.totalValue.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Donut Chart (Fyers Screen 2 Exact Visual Style) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '20px', margin: '16px 0' }}>
              <svg width="180" height="180" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#0284c7" strokeWidth="6" />
                <circle 
                  cx="21" cy="21" r="15.91549430918954" fill="transparent" 
                  stroke="#10b981" strokeWidth="6" 
                  strokeDasharray={`${100 - math.wealthRatio} ${math.wealthRatio}`}
                  strokeDashoffset="25"
                />
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#0284c7' }} />
                  <span style={{ fontSize: '12.5px', color: '#cbd5e1' }}>Invested Value</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }} />
                  <span style={{ fontSize: '12.5px', color: '#cbd5e1' }}>Estimated Return</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Year</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Annual Deposit</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Total Invested</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Future Value</th>
                </tr>
              </thead>
              <tbody>
                {math.schedule.map(row => (
                  <tr key={row.year} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px', fontWeight: '700' }}>Yr {row.year}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#cbd5e1' }}>₹{row.annualDeposit.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#38bdf8' }}>₹{row.totalInvested.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#10b981' }}>₹{row.futureVal.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button
            onClick={handleExport}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              background: '#0284c7',
              border: 'none',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Download size={14} />
            <span>Download Schedule (CSV)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 6. LUMPSUM CALCULATOR ENGINE
// ============================================================================
function LumpsumCalculatorEngine({ viewMode, onDownloadCSV, onOpenPaperTrading }) {
  const [investment, setInvestment] = useState(100000);
  const [cagr, setCagr] = useState(14);
  const [years, setYears] = useState(10);

  const math = useMemo(() => {
    const futureVal = investment * Math.pow(1 + cagr / 100, years);
    const gains = futureVal - investment;
    const schedule = [];
    for (let yr = 1; yr <= years; yr++) {
      schedule.push({
        year: yr,
        value: Math.round(investment * Math.pow(1 + cagr / 100, yr))
      });
    }
    return {
      invested: investment,
      gains: Math.round(gains),
      futureVal: Math.round(futureVal),
      schedule,
      ratio: futureVal > 0 ? ((investment / futureVal) * 100).toFixed(1) : '50'
    };
  }, [investment, cagr, years]);

  const handleExport = () => {
    const headers = ['Year', 'Compounded Value (₹)'];
    const rows = math.schedule.map(r => [r.year, r.value]);
    onDownloadCSV(`lumpsum_growth_${investment}`, headers, rows);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Initial Lumpsum Capital</label>
            <span style={{ fontSize: '15px', fontWeight: '800', color: '#10b981' }}>₹{investment.toLocaleString('en-IN')}</span>
          </div>
          <input type="range" min="10000" max="5000000" step="10000" value={investment} onChange={e => setInvestment(Number(e.target.value))} style={{ width: '100%', accentColor: '#10b981', marginTop: '12px' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Expected CAGR (%)</label>
            <span style={{ fontSize: '15px', fontWeight: '800', color: '#10b981' }}>{cagr}%</span>
          </div>
          <input type="range" min="4" max="30" step="0.5" value={cagr} onChange={e => setCagr(Number(e.target.value))} style={{ width: '100%', accentColor: '#10b981', marginTop: '12px' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Tenure</label>
            <span style={{ fontSize: '15px', fontWeight: '800', color: '#10b981' }}>{years} Years</span>
          </div>
          <input type="range" min="1" max="35" step="1" value={years} onChange={e => setYears(Number(e.target.value))} style={{ width: '100%', accentColor: '#10b981', marginTop: '12px' }} />
        </div>
      </div>

      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>After {years} years of compounding</div>
          <div style={{ fontSize: '38px', fontWeight: '900', color: '#10b981', margin: '6px 0 16px' }}>₹{math.futureVal.toLocaleString('en-IN')}</div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1, background: 'rgba(56, 189, 248, 0.08)', padding: '12px', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#38bdf8' }}>Invested</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#f8fafc' }}>₹{investment.toLocaleString('en-IN')}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.08)', padding: '12px', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#86efac' }}>Gains</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#f8fafc' }}>₹{math.gains.toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>
        <button onClick={handleExport} style={{ marginTop: '20px', padding: '10px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#86efac', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Download size={14} /> Export Schedule (CSV)
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 7. MUTUAL FUNDS DIRECT VS REGULAR ENGINE
// ============================================================================
function MutualFundsCalculatorEngine({ viewMode, onDownloadCSV, onOpenPaperTrading }) {
  const [monthlySip, setMonthlySip] = useState(15000);
  const [tenureYears, setTenureYears] = useState(15);
  const [expectedCagr, setExpectedCagr] = useState(14);
  const [regularTer, setRegularTer] = useState(1.65);
  const [directTer, setDirectTer] = useState(0.65);

  const feeSavings = useMemo(() => {
    const months = tenureYears * 12;
    const directMonthlyRate = (expectedCagr - directTer) / 12 / 100;
    const regularMonthlyRate = (expectedCagr - regularTer) / 12 / 100;

    let directCorpus = 0;
    let regularCorpus = 0;
    for (let m = 1; m <= months; m++) {
      directCorpus += monthlySip * Math.pow(1 + directMonthlyRate, months - m + 1);
      regularCorpus += monthlySip * Math.pow(1 + regularMonthlyRate, months - m + 1);
    }
    const savedAmount = Math.max(0, directCorpus - regularCorpus);
    return {
      directCorpus: Math.round(directCorpus),
      regularCorpus: Math.round(regularCorpus),
      savedAmount: Math.round(savedAmount)
    };
  }, [monthlySip, tenureYears, expectedCagr, regularTer, directTer]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Monthly SIP</label>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#3b82f6' }}>₹{monthlySip.toLocaleString('en-IN')}</span>
          </div>
          <input type="range" min="1000" max="100000" step="1000" value={monthlySip} onChange={e => setMonthlySip(Number(e.target.value))} style={{ width: '100%', accentColor: '#3b82f6', marginTop: '10px' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Tenure</label>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#10b981' }}>{tenureYears} Years</span>
          </div>
          <input type="range" min="3" max="30" step="1" value={tenureYears} onChange={e => setTenureYears(Number(e.target.value))} style={{ width: '100%', accentColor: '#3b82f6', marginTop: '10px' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#f87171' }}>Regular TER (Agent)</label>
            <input type="number" step="0.05" value={regularTer} onChange={e => setRegularTer(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#fca5a5' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#34d399' }}>Direct TER (Zero Fee)</label>
            <input type="number" step="0.05" value={directTer} onChange={e => setDirectTer(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', color: '#86efac' }} />
          </div>
        </div>
      </div>

      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Extra Wealth Gained via Direct Plan</div>
          <div style={{ fontSize: '38px', fontWeight: '900', color: '#10b981', margin: '4px 0 16px' }}>+₹{feeSavings.savedAmount.toLocaleString('en-IN')}</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1, background: 'rgba(16,185,129,0.08)', padding: '12px', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#86efac' }}>Direct Corpus</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#f8fafc' }}>₹{feeSavings.directCorpus.toLocaleString('en-IN')}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(239,68,68,0.08)', padding: '12px', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#fca5a5' }}>Regular Corpus</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#cbd5e1' }}>₹{feeSavings.regularCorpus.toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '16px', lineHeight: '1.4' }}>
          * Calculated based on 44 Indian AMCs statutory disclosure data. Direct plans carry zero broker commission.
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 8. BROKERAGE & SEBI TAX ENGINE (Oct 2024 Rates)
// ============================================================================
function BrokerageTaxEngine({ viewMode, onDownloadCSV, onOpenPaperTrading }) {
  const [segment, setSegment] = useState('EQUITY_INTRADAY'); // 'EQUITY_DELIVERY' | 'EQUITY_INTRADAY' | 'FUTURES' | 'OPTIONS'
  const [buyPrice, setBuyPrice] = useState(500);
  const [sellPrice, setSellPrice] = useState(510);
  const [qty, setQty] = useState(100);

  const taxes = useMemo(() => {
    const turnover = (buyPrice + sellPrice) * qty;
    const grossPnl = (sellPrice - buyPrice) * qty;

    let brokerage = 0;
    let stt = 0;
    let etc = turnover * 0.0000325; // 0.00325%

    if (segment === 'EQUITY_DELIVERY') {
      brokerage = 0; // ₹0 delivery
      stt = (turnover / 2) * 0.001; // 0.1% on buy & sell
    } else if (segment === 'EQUITY_INTRADAY') {
      brokerage = Math.min(40, turnover * 0.0003); // max ₹20 per leg
      stt = (sellPrice * qty) * 0.00025; // 0.025% on sell
    } else if (segment === 'FUTURES') {
      brokerage = 40;
      stt = (sellPrice * qty) * 0.0002; // Oct 2024 0.02%
    } else {
      brokerage = 40;
      stt = (sellPrice * qty) * 0.001; // Oct 2024 0.10%
    }

    const gst = (brokerage + etc) * 0.18;
    const stampDuty = (buyPrice * qty) * 0.00003;
    const sebiFee = turnover * 0.000001;
    const totalCharges = brokerage + stt + etc + gst + stampDuty + sebiFee;
    const netPnl = grossPnl - totalCharges;

    return {
      turnover: Math.round(turnover),
      grossPnl: Math.round(grossPnl),
      brokerage: Math.round(brokerage),
      stt: Math.round(stt),
      etc: Math.round(etc),
      gst: Math.round(gst),
      stampDuty: Math.round(stampDuty),
      totalCharges: Math.round(totalCharges),
      netPnl: Math.round(netPnl)
    };
  }, [segment, buyPrice, sellPrice, qty]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px' }}>
          {[
            { id: 'EQUITY_INTRADAY', label: 'Intraday' },
            { id: 'EQUITY_DELIVERY', label: 'Delivery' },
            { id: 'FUTURES', label: 'Futures' },
            { id: 'OPTIONS', label: 'Options' }
          ].map(s => (
            <button key={s.id} onClick={() => setSegment(s.id)} style={{ flex: 1, padding: '6px', borderRadius: '6px', border: 'none', background: segment === s.id ? '#eab308' : 'transparent', color: segment === s.id ? '#000' : '#94a3b8', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer' }}>
              {s.label}
            </button>
          ))}
        </div>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Buy Price (₹)</label>
          <input type="number" value={buyPrice} onChange={e => setBuyPrice(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Sell Price (₹)</label>
          <input type="number" value={sellPrice} onChange={e => setSellPrice(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Quantity</label>
          <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
      </div>

      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Net Profit / Loss</div>
          <div style={{ fontSize: '38px', fontWeight: '900', color: taxes.netPnl >= 0 ? '#10b981' : '#ef4444', margin: '4px 0 16px' }}>
            {taxes.netPnl >= 0 ? '+' : ''}₹{taxes.netPnl.toLocaleString('en-IN')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8' }}>Statutory STT:</span> <strong>₹{taxes.stt}</strong>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8' }}>Brokerage:</span> <strong>₹{taxes.brokerage}</strong>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8' }}>GST (18%):</span> <strong>₹{taxes.gst}</strong>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8' }}>Total Taxes:</span> <strong style={{ color: '#f87171' }}>₹{taxes.totalCharges}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 9. POSITION SIZING & RISK/REWARD ENGINE
// ============================================================================
function PositionSizerEngine({ viewMode, onDownloadCSV, onOpenPaperTrading }) {
  const [capital, setCapital] = useState(500000);
  const [riskPct, setRiskPct] = useState(1.5);
  const [entryPrice, setEntryPrice] = useState(1450);
  const [stopLoss, setStopLoss] = useState(1420);
  const [targetPrice, setTargetPrice] = useState(1540);

  const math = useMemo(() => {
    const riskAmount = capital * (riskPct / 100);
    const riskPerShare = Math.max(0.01, Math.abs(entryPrice - stopLoss));
    const positionQty = Math.floor(riskAmount / riskPerShare);
    const positionValue = positionQty * entryPrice;
    const rewardPerShare = Math.max(0, targetPrice - entryPrice);
    const rewardToRisk = riskPerShare > 0 ? (rewardPerShare / riskPerShare).toFixed(2) : '0';
    const totalPotentialProfit = positionQty * rewardPerShare;

    return {
      riskAmount: Math.round(riskAmount),
      riskPerShare: riskPerShare.toFixed(2),
      positionQty,
      positionValue: Math.round(positionValue),
      rewardToRisk,
      totalPotentialProfit: Math.round(totalPotentialProfit)
    };
  }, [capital, riskPct, entryPrice, stopLoss, targetPrice]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Total Account Capital (₹)</label>
          <input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Risk Per Trade (%): {riskPct}%</label>
          <input type="range" min="0.5" max="5" step="0.1" value={riskPct} onChange={e => setRiskPct(Number(e.target.value))} style={{ width: '100%', accentColor: '#ef4444' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#38bdf8' }}>Entry Price</label>
            <input type="number" value={entryPrice} onChange={e => setEntryPrice(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#f87171' }}>Stop Loss</label>
            <input type="number" value={stopLoss} onChange={e => setStopLoss(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#34d399' }}>Target Price</label>
            <input type="number" value={targetPrice} onChange={e => setTargetPrice(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          </div>
        </div>
      </div>

      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Recommended Position Size</div>
          <div style={{ fontSize: '38px', fontWeight: '900', color: '#38bdf8', margin: '4px 0 16px' }}>
            {math.positionQty.toLocaleString('en-IN')} <span style={{ fontSize: '14px', color: '#94a3b8' }}>shares</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#f87171' }}>Capital at Risk</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#f8fafc' }}>₹{math.riskAmount}</div>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#34d399' }}>Risk:Reward Ratio</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#f8fafc' }}>1 : {math.rewardToRisk}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 10. OPTIONS GREEKS BLACK-SCHOLES ENGINE
// ============================================================================
function OptionGreeksEngine({ viewMode, onDownloadCSV, onOpenPaperTrading }) {
  const [spotPrice, setSpotPrice] = useState(24500);
  const [strikePrice, setStrikePrice] = useState(24500);
  const [daysToExpiry, setDaysToExpiry] = useState(7);
  const [ivPct, setIvPct] = useState(14.5);
  const [optionType, setOptionType] = useState('CE'); // 'CE' | 'PE'

  const greeks = useMemo(() => {
    const S = spotPrice;
    const K = strikePrice;
    const T = Math.max(0.001, daysToExpiry / 365);
    const sigma = Math.max(0.01, ivPct / 100);
    const r = 0.07;

    const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);

    const normalCdf = (x) => {
      const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
      const sign = x < 0 ? -1 : 1;
      const absX = Math.abs(x) / Math.sqrt(2.0);
      const t = 1.0 / (1.0 + p * absX);
      const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
      return 0.5 * (1.0 + sign * y);
    };

    const normalPdf = (x) => (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);

    let price = 0;
    let delta = 0;
    if (optionType === 'CE') {
      price = S * normalCdf(d1) - K * Math.exp(-r * T) * normalCdf(d2);
      delta = normalCdf(d1);
    } else {
      price = K * Math.exp(-r * T) * normalCdf(-d2) - S * normalCdf(-d1);
      delta = normalCdf(d1) - 1;
    }

    const gamma = normalPdf(d1) / (S * sigma * Math.sqrt(T));
    const theta = (-(S * normalPdf(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normalCdf(optionType === 'CE' ? d2 : -d2)) / 365;
    const vega = (S * Math.sqrt(T) * normalPdf(d1)) / 100;

    return {
      price: Math.max(0, price).toFixed(2),
      delta: delta.toFixed(3),
      gamma: gamma.toFixed(5),
      theta: theta.toFixed(2),
      vega: vega.toFixed(2)
    };
  }, [spotPrice, strikePrice, daysToExpiry, ivPct, optionType]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setOptionType('CE')} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: optionType === 'CE' ? '#10b981' : 'rgba(255,255,255,0.05)', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Call (CE)</button>
          <button onClick={() => setOptionType('PE')} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: optionType === 'PE' ? '#ef4444' : 'rgba(255,255,255,0.05)', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Put (PE)</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#94a3b8' }}>Spot Price (₹)</label>
            <input type="number" value={spotPrice} onChange={e => setSpotPrice(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#94a3b8' }}>Strike Price (₹)</label>
            <input type="number" value={strikePrice} onChange={e => setStrikePrice(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }} />
          </div>
        </div>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Days to Expiry: {daysToExpiry} Days</label>
          <input type="range" min="1" max="60" step="1" value={daysToExpiry} onChange={e => setDaysToExpiry(Number(e.target.value))} style={{ width: '100%', accentColor: '#a855f7' }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Implied Volatility: {ivPct}%</label>
          <input type="range" min="5" max="80" step="0.5" value={ivPct} onChange={e => setIvPct(Number(e.target.value))} style={{ width: '100%', accentColor: '#a855f7' }} />
        </div>
      </div>

      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Theoretical Option Premium</div>
          <div style={{ fontSize: '38px', fontWeight: '900', color: '#a855f7', margin: '4px 0 16px' }}>₹{greeks.price}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Δ Delta</div>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>{greeks.delta}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Γ Gamma</div>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>{greeks.gamma}</div>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.08)', padding: '10px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#f87171' }}>Θ Theta Decay</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#fca5a5' }}>₹{greeks.theta}/day</div>
            </div>
            <div style={{ background: 'rgba(168,85,247,0.08)', padding: '10px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#c084fc' }}>V Vega</div>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>₹{greeks.vega}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
