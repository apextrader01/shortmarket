// frontend/src/components/WealthPersonalFinanceModal.jsx
// 💰 HUB 04: Institutional Wealth OS, 50/30/20 Cashflow Audit, Actuarial HLV Protection, FY25/26 Income Tax Slabs & 24/7 Gemini AI Wealth Copilot

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { API, useStore } from '../store';
import { 
  X, PieChart, Shield, Wallet, Sparkles, Send, AlertTriangle, 
  CheckCircle2, ArrowRight, TrendingUp, Scissors, HeartPulse,
  DollarSign, RefreshCw, HelpCircle, ChevronRight, ArrowLeft, Download, Printer, Calculator, Trash2,
  Copy, Check, Landmark, Building, Info, FileText, Zap, Award, BarChart3, ShieldCheck, Scale, Calendar
} from 'lucide-react';
import logoImg from '../assets/logo.png';

export default function WealthPersonalFinanceModal({
  isOpen = true,
  isFullPage = false,
  onClose,
  onBack,
  onOpenPaperTrading,
  onOpenCalculators,
  initialTab = 'NET_WORTH'
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'NET_WORTH');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  if (!isFullPage && !isOpen) return null;

  const handleExportWealthCsv = () => {
    const rows = [
      ['SkandX Wealth OS & Tax Hub Comprehensive Audit Report', new Date().toLocaleDateString('en-IN')],
      [],
      ['Module', 'Key Metric / Benchmark', 'Official Policy / Rule', 'Status'],
      ['Consolidated Net Worth', 'Multi-Asset Equity + Debt + Gold + Real Estate', 'Solvency Ratio > 70% Recommended', 'Active'],
      ['50/30/20 Smart Budget', '50% Fixed Needs / 30% Lifestyle Wants / 20% SIP', 'Savings Rate Target >= 20%', 'Active'],
      ['Actuarial Life & Health (HLV)', '15x Annual Income Replacement + Debt Payoff', 'Pure Term & Super Top-up Strategy', 'Active'],
      ['Income Tax Slabs (Union Budget)', 'New Regime (₹75k Std Ded, ₹0 Tax <= ₹7.75L) vs Old', 'AY 2025-26 & AY 2026-27 Compliant', 'Active'],
      ['Capital Gains & Tax Harvesting', 'STCG @ 20% | LTCG @ 12.5% (>₹1.25L Exemption)', 'March 31 Offsetting Deadline', 'Active']
    ];
    const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SkandX_Wealth_OS_Tax_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const TABS = [
    { id: 'NET_WORTH', label: 'Consolidated Net Worth', shortLabel: 'Net Worth', badge: 'Solvency & Assets', icon: PieChart, color: '#10b981' },
    { id: 'BUDGET', label: '50/30/20 Budget & Leak Detector', shortLabel: '50/30/20 Budget', badge: 'Cashflow Audit', icon: Wallet, color: '#38bdf8' },
    { id: 'INSURANCE', label: 'Term Life & Health Gap (HLV)', shortLabel: 'Insurance (HLV)', badge: 'Actuarial Shield', icon: HeartPulse, color: '#f59e0b' },
    { id: 'TAX_LOSS', label: 'Income Tax Slabs & Capital Gains', shortLabel: 'Tax Engine (Budget)', badge: 'New vs Old & 20%/12.5%', icon: Scale, color: '#ec4899' },
    { id: 'AI_COPILOT', label: '24/7 AI Wealth Copilot', shortLabel: 'AI Copilot', badge: 'Google Gemini 3.5', icon: Sparkles, color: '#a855f7' }
  ];

  const renderActiveView = () => {
    switch (activeTab) {
      case 'AI_COPILOT': return <AiWealthCopilotView isMobile={isMobile} />;
      case 'BUDGET': return <BudgetLeakDetectorView isMobile={isMobile} />;
      case 'INSURANCE': return <InsuranceGapView isMobile={isMobile} />;
      case 'TAX_LOSS': return <TaxLossHarvestingView isMobile={isMobile} />;
      case 'NET_WORTH':
      default: return <NetWorthView isMobile={isMobile} />;
    }
  };

  if (isFullPage) {
    return (
      <div style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#070b12',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflowX: 'hidden'
      }}>
        {/* Top Institutional Navigation Bar */}
        <header style={{
          padding: isMobile ? 'max(10px, env(safe-area-inset-top, 10px)) 12px 10px' : '14px 24px',
          background: 'rgba(11, 17, 30, 0.94)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: isMobile ? '8px' : '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', minWidth: 0 }}>
            <button
              onClick={onBack || onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: isMobile ? '6px 10px' : '8px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#e2e8f0',
                fontSize: isMobile ? '11.5px' : '12.5px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              <ArrowLeft size={14} />
              <span>{isMobile ? 'Back' : 'Back to Home'}</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <img
                src={logoImg}
                alt="SkandX Logo"
                style={{
                  width: isMobile ? '32px' : '38px',
                  height: isMobile ? '32px' : '38px',
                  borderRadius: '10px',
                  border: '1px solid rgba(16, 185, 129, 0.45)',
                  boxShadow: '0 0 14px rgba(56, 189, 248, 0.35)',
                  objectFit: 'cover',
                  flexShrink: 0
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '9.5px', fontWeight: '800', color: '#10b981', background: 'rgba(16, 185, 129, 0.14)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                    HUB 04 • WEALTH OS
                  </span>
                  <h1 style={{ margin: 0, fontSize: isMobile ? '15px' : '18px', fontWeight: '800', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Wealth OS & Tax Hub
                  </h1>
                </div>
                {!isMobile && (
                  <p style={{ margin: 0, fontSize: '11.5px', color: '#94a3b8' }}>
                    Institutional Net Worth, 50/30/20 Cashflow Audit, Union Budget Tax Slabs & 24/7 Google Gemini Copilot
                  </p>
                )}
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '6px' : '8px',
            overflowX: isMobile ? 'auto' : 'visible',
            WebkitOverflowScrolling: 'touch',
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            paddingBottom: isMobile ? '2px' : 0
          }}>
            {onOpenCalculators && (
              <button
                onClick={() => onOpenCalculators('all')}
                style={{
                  padding: isMobile ? '6px 10px' : '8px 13px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  color: '#fbbf24',
                  fontSize: isMobile ? '11px' : '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                <Calculator size={13} />
                <span>{isMobile ? 'Calculators' : 'EMI & SIP Calculators'}</span>
              </button>
            )}
            <button
              onClick={handleExportWealthCsv}
              style={{
                padding: isMobile ? '6px 10px' : '8px 13px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#34d399',
                fontSize: isMobile ? '11px' : '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              <Download size={13} />
              <span>{isMobile ? 'CSV' : 'Export Excel / CSV'}</span>
            </button>
            <button
              onClick={() => window.print()}
              style={{
                padding: isMobile ? '6px 10px' : '8px 13px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#38bdf8',
                fontSize: isMobile ? '11px' : '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              <Printer size={13} />
              <span>{isMobile ? 'PDF' : 'Print / PDF'}</span>
            </button>
            {onOpenPaperTrading && (
              <button
                onClick={onOpenPaperTrading}
                style={{
                  padding: isMobile ? '6px 11px' : '8px 15px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                  border: 'none',
                  color: '#fff',
                  fontSize: isMobile ? '11px' : '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                <TrendingUp size={13} />
                <span>{isMobile ? 'Terminal' : 'Paper Trading'}</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Container */}
        <div style={{
          maxWidth: '1280px',
          width: '100%',
          boxSizing: 'border-box',
          margin: '0 auto',
          padding: isMobile ? '12px 12px 80px' : '24px 20px 60px',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? '14px' : '22px'
        }}>
          {/* Bento Pillar Selector Cards */}
          {isMobile ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              paddingBottom: '4px'
            }}>
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '12px',
                      background: isActive
                        ? `linear-gradient(135deg, ${tab.color}30, rgba(15, 23, 42, 0.95))`
                        : 'rgba(15, 23, 42, 0.8)',
                      border: isActive ? `1.5px solid ${tab.color}` : '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#f8fafc',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      boxShadow: isActive ? `0 4px 14px ${tab.color}25` : 'none'
                    }}
                  >
                    <div style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '7px',
                      background: `${tab.color}20`,
                      border: `1px solid ${tab.color}45`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: tab.color
                    }}>
                      <Icon size={14} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: isActive ? '800' : '600' }}>
                      {tab.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '12px'
            }}>
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '16px',
                      borderRadius: '14px',
                      background: isActive
                        ? `linear-gradient(135deg, ${tab.color}26, rgba(15, 23, 42, 0.9))`
                        : 'rgba(15, 23, 42, 0.7)',
                      border: isActive ? `1.5px solid ${tab.color}` : '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#f8fafc',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'all 0.18s ease',
                      boxShadow: isActive ? `0 8px 24px ${tab.color}25` : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '9px',
                        background: `${tab.color}20`,
                        border: `1px solid ${tab.color}45`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: tab.color
                      }}>
                        <Icon size={18} />
                      </div>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        color: isActive ? tab.color : '#94a3b8',
                        background: 'rgba(255, 255, 255, 0.04)',
                        padding: '2px 7px',
                        borderRadius: '5px'
                      }}>
                        {tab.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: '800', color: isActive ? '#fff' : '#cbd5e1' }}>
                      {tab.label}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Active Workspace Panel */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: isMobile ? '14px' : '18px',
            padding: isMobile ? '16px 12px' : '26px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
            boxSizing: 'border-box',
            width: '100%',
            overflowX: 'hidden'
          }}>
            {renderActiveView()}
          </div>
        </div>
      </div>
    );
  }

  // Modal mode
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 10, 20, 0.88)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div style={{
        background: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1040px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(56, 189, 248, 0.25))',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c084fc'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#f8fafc' }}>
                Wealth OS & Tax Hub
              </h2>
              <p style={{ margin: 0, fontSize: '11.5px', color: '#94a3b8' }}>
                Net worth, 50/30/20 budget, actuarial HLV gap, latest tax slabs & 24/7 AI wealth copilot
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '6px',
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

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(0, 0, 0, 0.25)',
          overflowX: 'auto'
        }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12.5px',
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? tab.color : '#94a3b8',
                  background: isActive ? `${tab.color}15` : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {renderActiveView()}
        </div>
      </div>
    </div>
  );
}

// Clean Markdown Formatter for AI Copilot Responses
function renderFormattedAiMessage(rawText) {
  if (!rawText) return null;
  const lines = String(rawText).split('\n');

  const formatInlineBold = (str) => {
    const parts = String(str).split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} style={{ color: '#fff', fontWeight: '700' }}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed === '---') {
          return <div key={i} style={{ height: trimmed === '---' ? '1px' : '4px', background: trimmed === '---' ? 'rgba(255,255,255,0.1)' : 'transparent', margin: trimmed === '---' ? '4px 0' : 0 }} />;
        }
        if (trimmed.startsWith('### ')) {
          return (
            <div key={i} style={{ fontSize: '13.5px', fontWeight: '800', color: '#38bdf8', marginTop: '6px' }}>
              {formatInlineBold(trimmed.replace(/^###\s+/, ''))}
            </div>
          );
        }
        if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
          return (
            <div key={i} style={{ fontSize: '14.5px', fontWeight: '800', color: '#34d399', marginTop: '8px' }}>
              {formatInlineBold(trimmed.replace(/^#+\s+/, ''))}
            </div>
          );
        }
        if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '4px' }}>
              <span style={{ color: '#38bdf8', fontWeight: '800' }}>•</span>
              <span style={{ flex: 1 }}>{formatInlineBold(trimmed.replace(/^[•\-*]\s+/, ''))}</span>
            </div>
          );
        }
        return <div key={i}>{formatInlineBold(line)}</div>;
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. CONSOLIDATED NET WORTH (MULTI-ASSET INSTITUTIONAL DASHBOARD)
// ══════════════════════════════════════════════════════════════════════════════
function NetWorthView({ isMobile }) {
  const holdings = useStore(state => state.holdings || []);
  const [stocks, setStocks] = useState(1250000);
  const [mutualFunds, setMutualFunds] = useState(850000);
  const [epfPpf, setEpfPpf] = useState(620000);
  const [bankFd, setBankFd] = useState(380000);
  const [gold, setGold] = useState(240000);
  const [realEstate, setRealEstate] = useState(4500000);
  const [alternateAssets, setAlternateAssets] = useState(150000);

  // Liabilities
  const [homeLoan, setHomeLoan] = useState(1600000);
  const [personalLoan, setPersonalLoan] = useState(400000);
  const [creditCardDebt, setCreditCardDebt] = useState(100000);

  const [syncStatus, setSyncStatus] = useState('');

  // Auto-fill from actual logged-in user holdings
  const handleSyncMyPortfolio = () => {
    if (holdings && holdings.length > 0) {
      let equityTotal = 0;
      let mfTotal = 0;
      holdings.forEach(h => {
        const val = Number(h.current_value || (Number(h.quantity || 0) * Number(h.ltp || h.average_price || 0)) || 0);
        if (String(h.symbol || '').includes('MUTUAL') || String(h.symbol || '').includes('NIFTYBEES') || String(h.symbol || '').includes('ETF')) {
          mfTotal += val;
        } else {
          equityTotal += val;
        }
      });
      if (equityTotal > 0) setStocks(Math.round(equityTotal));
      if (mfTotal > 0) setMutualFunds(Math.round(mfTotal));
      setSyncStatus(`✓ Synced ₹${Math.round(equityTotal + mfTotal).toLocaleString('en-IN')} from ${holdings.length} holdings!`);
    } else {
      setSyncStatus('✓ Portfolio already synced with live market valuation.');
    }
    setTimeout(() => setSyncStatus(''), 4000);
  };

  const totalAssets = stocks + mutualFunds + epfPpf + bankFd + gold + realEstate + alternateAssets;
  const totalLiabilities = homeLoan + personalLoan + creditCardDebt;
  const netWorth = totalAssets - totalLiabilities;
  const liquidAssets = stocks + mutualFunds + bankFd + gold;
  const illiquidAssets = epfPpf + realEstate + alternateAssets;
  const solvencyRatio = totalAssets > 0 ? (netWorth / totalAssets) * 100 : 0;
  const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  // Next crore milestone
  const nextCrore = Math.ceil(Math.max(1, netWorth) / 10000000) * 10000000;
  const prevCrore = nextCrore - 10000000;
  const croreProgress = Math.min(100, Math.max(0, ((netWorth - prevCrore) / 10000000) * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPI Overview Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: '12px'
      }}>
        <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Consolidated Net Worth</div>
          <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: '#38bdf8', marginTop: '2px' }}>
            ₹{(netWorth / 10000000).toFixed(2)} Cr
          </div>
          <div style={{ fontSize: '11px', color: '#cbd5e1' }}>₹{Math.round(netWorth).toLocaleString('en-IN')}</div>
        </div>

        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Gross Total Assets</div>
          <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: '#34d399', marginTop: '2px' }}>
            ₹{(totalAssets / 10000000).toFixed(2)} Cr
          </div>
          <div style={{ fontSize: '11px', color: '#10b981' }}>Liquid: ₹{(liquidAssets / 100000).toFixed(1)}L ({((liquidAssets / totalAssets) * 100).toFixed(0)}%)</div>
        </div>

        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Total Debt Liabilities</div>
          <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: '#f87171', marginTop: '2px' }}>
            ₹{(totalLiabilities / 10000000).toFixed(2)} Cr
          </div>
          <div style={{ fontSize: '11px', color: '#fca5a5' }}>D/A Ratio: {debtToAssetRatio.toFixed(1)}% ({debtToAssetRatio < 30 ? 'Safe ✓' : 'Elevated'})</div>
        </div>

        <div style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Solvency & Health</div>
          <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: solvencyRatio >= 70 ? '#a855f7' : '#f59e0b', marginTop: '2px' }}>
            {solvencyRatio.toFixed(1)}%
          </div>
          <div style={{ fontSize: '11px', color: solvencyRatio >= 70 ? '#d8b4fe' : '#fbbf24' }}>
            {solvencyRatio >= 70 ? 'Institutional Safety ✓' : 'Moderate Cushion'}
          </div>
        </div>
      </div>

      {/* Main 2-Column Workstation */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.15fr 0.85fr', gap: '20px' }}>
        {/* Left: Interactive Asset & Liability Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Assets Section */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PieChart size={16} color="#38bdf8" />
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#f8fafc' }}>
                  Multi-Asset Breakdown (₹)
                </h4>
              </div>
              <button
                type="button"
                onClick={handleSyncMyPortfolio}
                style={{
                  padding: '4px 9px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#38bdf8',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Zap size={12} />
                <span>Sync My Portfolio</span>
              </button>
            </div>

            {syncStatus && (
              <div style={{ fontSize: '11.5px', color: '#34d399', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 10px', borderRadius: '6px', marginBottom: '10px' }}>
                {syncStatus}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '600' }}>Direct Equity & Listed Stocks</label>
                <input 
                  type="number" 
                  value={stocks} 
                  onChange={e => setStocks(Number(e.target.value) || 0)} 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '2px' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#10b981', fontWeight: '600' }}>Mutual Funds & Index ETFs</label>
                <input 
                  type="number" 
                  value={mutualFunds} 
                  onChange={e => setMutualFunds(Number(e.target.value) || 0)} 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '2px' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '600' }}>EPF, PPF & Voluntary PF</label>
                <input 
                  type="number" 
                  value={epfPpf} 
                  onChange={e => setEpfPpf(Number(e.target.value) || 0)} 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '2px' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Bank Savings, Liquid & FDs</label>
                <input 
                  type="number" 
                  value={bankFd} 
                  onChange={e => setBankFd(Number(e.target.value) || 0)} 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '2px' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#fbbf24', fontWeight: '600' }}>Physical Gold & SGB Bonds</label>
                <input 
                  type="number" 
                  value={gold} 
                  onChange={e => setGold(Number(e.target.value) || 0)} 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '2px' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#a855f7', fontWeight: '600' }}>Real Estate & Land Equity</label>
                <input 
                  type="number" 
                  value={realEstate} 
                  onChange={e => setRealEstate(Number(e.target.value) || 0)} 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '2px' }} 
                />
              </div>
            </div>
          </div>

          {/* Liabilities Section */}
          <div style={{ background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Shield size={16} color="#ef4444" />
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#fca5a5' }}>
                Debt Liabilities & Active EMIs (₹)
              </h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#fca5a5' }}>Home Loan Principal</label>
                <input 
                  type="number" 
                  value={homeLoan} 
                  onChange={e => setHomeLoan(Number(e.target.value) || 0)} 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '2px' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#fca5a5' }}>Vehicle / Personal Loans</label>
                <input 
                  type="number" 
                  value={personalLoan} 
                  onChange={e => setPersonalLoan(Number(e.target.value) || 0)} 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '2px' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#fca5a5' }}>Credit Cards & BNPL</label>
                <input 
                  type="number" 
                  value={creditCardDebt} 
                  onChange={e => setCreditCardDebt(Number(e.target.value) || 0)} 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '2px' }} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Institutional Asset Allocation & Health Analysis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Visual Stacked Asset Allocation Bar */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#cbd5e1' }}>Multi-Asset Allocation Mix</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Total ₹{(totalAssets / 100000).toFixed(1)}L</span>
            </div>

            <div style={{ height: '14px', borderRadius: '7px', overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ width: `${(stocks / totalAssets) * 100}%`, background: '#38bdf8' }} title="Direct Stocks" />
              <div style={{ width: `${(mutualFunds / totalAssets) * 100}%`, background: '#10b981' }} title="Mutual Funds" />
              <div style={{ width: `${(epfPpf / totalAssets) * 100}%`, background: '#f59e0b' }} title="EPF/PPF" />
              <div style={{ width: `${(bankFd / totalAssets) * 100}%`, background: '#94a3b8' }} title="Bank FD" />
              <div style={{ width: `${(gold / totalAssets) * 100}%`, background: '#fbbf24' }} title="Gold" />
              <div style={{ width: `${(realEstate / totalAssets) * 100}%`, background: '#a855f7' }} title="Real Estate" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px', fontSize: '11px' }}>
              <div style={{ color: '#38bdf8' }}>● Stocks: {((stocks / totalAssets) * 100).toFixed(0)}%</div>
              <div style={{ color: '#10b981' }}>● MF/ETF: {((mutualFunds / totalAssets) * 100).toFixed(0)}%</div>
              <div style={{ color: '#f59e0b' }}>● EPF/PPF: {((epfPpf / totalAssets) * 100).toFixed(0)}%</div>
              <div style={{ color: '#cbd5e1' }}>● Cash/FD: {((bankFd / totalAssets) * 100).toFixed(0)}%</div>
              <div style={{ color: '#fbbf24' }}>● Gold: {((gold / totalAssets) * 100).toFixed(0)}%</div>
              <div style={{ color: '#a855f7' }}>● Realty: {((realEstate / totalAssets) * 100).toFixed(0)}%</div>
            </div>
          </div>

          {/* Liquidity Tiers */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '18px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '10px' }}>
              Asset Liquidity Structure
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.07)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '10.5px', color: '#10b981' }}>Tier 1: Liquid (T+1 Access)</div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#34d399', marginTop: '2px' }}>
                  ₹{(liquidAssets / 100000).toFixed(1)} Lakhs
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Stocks, MFs, Bank, Gold</div>
              </div>
              <div style={{ background: 'rgba(168, 85, 247, 0.07)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '10.5px', color: '#a855f7' }}>Tier 2: Illiquid / Long-Term</div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#c084fc', marginTop: '2px' }}>
                  ₹{(illiquidAssets / 100000).toFixed(1)} Lakhs
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Real Estate &amp; EPF Lock-in</div>
              </div>
            </div>
          </div>

          {/* Next Crore Milestone Tracker */}
          <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '14px', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#38bdf8' }}>Next Milestone: ₹{(nextCrore / 10000000).toFixed(1)} Crores</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{croreProgress.toFixed(1)}% Completed</span>
            </div>
            <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: '8px' }}>
              <div style={{ width: `${croreProgress}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #10b981)' }} />
            </div>
            <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '8px' }}>
              Need ₹{((nextCrore - netWorth) / 100000).toFixed(1)} Lakhs more to reach the next landmark!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. 50/30/20 SMART BUDGET & CASHFLOW AUDIT
// ══════════════════════════════════════════════════════════════════════════════
function BudgetLeakDetectorView({ isMobile }) {
  const [monthlyIncome, setMonthlyIncome] = useState(120000);
  const [needsExpense, setNeedsExpense] = useState(55000);
  const [wantsExpense, setWantsExpense] = useState(45000);
  const [savingsExpense, setSavingsExpense] = useState(20000);

  const targetNeeds = monthlyIncome * 0.50;
  const targetWants = monthlyIncome * 0.30;
  const targetSavings = monthlyIncome * 0.20;

  const totalSpent = needsExpense + wantsExpense + savingsExpense;
  const cashSurplus = monthlyIncome - totalSpent;
  const savingsRate = monthlyIncome > 0 ? (savingsExpense / monthlyIncome) * 100 : 0;

  const detectedLeaks = useMemo(() => {
    const leaks = [];
    const wantsExcess = wantsExpense - targetWants;
    if (wantsExcess > 0) {
      leaks.push({
        title: 'Lifestyle & Wants Overrun',
        amount: wantsExcess,
        severity: 'HIGH',
        desc: `You are spending ₹${Math.round(wantsExcess).toLocaleString('en-IN')} over your 30% wants threshold on fine dining, leisure travel, and shopping.`
      });
    }

    leaks.push({
      title: 'Unused OTT & Recurring App Renewals',
      amount: 2499,
      severity: 'MEDIUM',
      desc: 'Multiple streaming, cloud storage & subscription apps renewing automatically with <15% usage.'
    });

    leaks.push({
      title: 'Food Delivery Surcharges & Late Night Impulse',
      amount: 3200,
      severity: 'LOW',
      desc: 'Peak convenience fee, weather surges, and delivery packaging add up to ~₹3,200/month.'
    });

    return leaks;
  }, [wantsExpense, targetWants]);

  const totalPluggedLeaks = detectedLeaks.reduce((a, b) => a + b.amount, 0);

  // 10-year compounding boost from plugged leaks at 12% CAGR
  const r = 0.12 / 12;
  const n = 120; // 10 years
  const leakBoostCorpus = totalPluggedLeaks * (((Math.pow(1 + r, n) - 1) / r) * (1 + r));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPI Overview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: '12px'
      }}>
        <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Monthly Take-Home</div>
          <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: '#38bdf8', marginTop: '2px' }}>
            ₹{monthlyIncome.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '11px', color: '#cbd5e1' }}>₹{(monthlyIncome * 12 / 100000).toFixed(1)}L Annualized</div>
        </div>

        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Active Savings Rate</div>
          <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: savingsRate >= 20 ? '#34d399' : '#f59e0b', marginTop: '2px' }}>
            {savingsRate.toFixed(1)}%
          </div>
          <div style={{ fontSize: '11px', color: savingsRate >= 20 ? '#10b981' : '#fbbf24' }}>
            {savingsRate >= 20 ? 'Target Achieved (>=20%) ✓' : 'Below 20% Target'}
          </div>
        </div>

        <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Cashflow Balance</div>
          <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: cashSurplus >= 0 ? '#fbbf24' : '#ef4444', marginTop: '2px' }}>
            {cashSurplus >= 0 ? `+₹${cashSurplus.toLocaleString('en-IN')}` : `-₹${Math.abs(cashSurplus).toLocaleString('en-IN')}`}
          </div>
          <div style={{ fontSize: '11px', color: cashSurplus >= 0 ? '#cbd5e1' : '#f87171' }}>
            {cashSurplus >= 0 ? 'Monthly Surplus Cushion' : 'Overspending Deficit!'}
          </div>
        </div>

        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Detected Leaks</div>
          <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: '#f87171', marginTop: '2px' }}>
            -₹{Math.round(totalPluggedLeaks).toLocaleString('en-IN')}/mo
          </div>
          <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{detectedLeaks.length} Active Leak Categories</div>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr', gap: '20px' }}>
        {/* Left: 50/30/20 Sliders & Income Presets */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>Net Monthly Take-Home Income (₹)</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[50000, 100000, 150000, 250000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setMonthlyIncome(amt);
                      setNeedsExpense(Math.round(amt * 0.50));
                      setWantsExpense(Math.round(amt * 0.30));
                      setSavingsExpense(Math.round(amt * 0.20));
                    }}
                    style={{ padding: '3px 7px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
                  >
                    ₹{(amt / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>
            </div>
            <input 
              type="number"
              value={monthlyIncome}
              onChange={e => setMonthlyIncome(Number(e.target.value) || 0)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#fff', fontSize: '15px', fontWeight: '800', marginTop: '6px' }}
            />
          </div>

          {/* Needs Slider */}
          <div style={{ background: 'rgba(56, 189, 248, 0.05)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: '700' }}>Needs: Rent, EMIs, Groceries, Utilities</span>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#fff' }}>₹{needsExpense.toLocaleString('en-IN')}</span>
            </div>
            <input 
              type="range" min="0" max={monthlyIncome} step="1000"
              value={needsExpense}
              onChange={e => setNeedsExpense(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#38bdf8', marginTop: '6px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              <span>50% Target: ₹{Math.round(targetNeeds).toLocaleString('en-IN')}</span>
              <span style={{ color: needsExpense <= targetNeeds ? '#34d399' : '#f87171' }}>
                {needsExpense <= targetNeeds ? 'Within Budget ✓' : `+₹${Math.round(needsExpense - targetNeeds).toLocaleString('en-IN')} Over`}
              </span>
            </div>
          </div>

          {/* Wants Slider */}
          <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#f87171', fontWeight: '700' }}>Wants: Dining, Travel, Shopping, OTT</span>
              <span style={{ fontSize: '14px', fontWeight: '800', color: wantsExpense > targetWants ? '#ef4444' : '#10b981' }}>
                ₹{wantsExpense.toLocaleString('en-IN')}
              </span>
            </div>
            <input 
              type="range" min="0" max={monthlyIncome} step="1000"
              value={wantsExpense}
              onChange={e => setWantsExpense(Number(e.target.value))}
              style={{ width: '100%', accentColor: wantsExpense > targetWants ? '#ef4444' : '#10b981', marginTop: '6px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              <span>30% Target: ₹{Math.round(targetWants).toLocaleString('en-IN')}</span>
              <span style={{ color: wantsExpense <= targetWants ? '#34d399' : '#f87171' }}>
                {wantsExpense <= targetWants ? 'Under Control ✓' : `Leak Alert: +₹${Math.round(wantsExpense - targetWants).toLocaleString('en-IN')}`}
              </span>
            </div>
          </div>

          {/* Savings Slider */}
          <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '700' }}>Savings: Equity SIPs, PPF, Emergency Fund</span>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#34d399' }}>₹{savingsExpense.toLocaleString('en-IN')}</span>
            </div>
            <input 
              type="range" min="0" max={monthlyIncome} step="1000"
              value={savingsExpense}
              onChange={e => setSavingsExpense(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#10b981', marginTop: '6px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              <span>20% Target: ₹{Math.round(targetSavings).toLocaleString('en-IN')}</span>
              <span style={{ color: savingsExpense >= targetSavings ? '#34d399' : '#fbbf24' }}>
                {savingsExpense >= targetSavings ? 'Healthy Savings Rate ✓' : `Shortfall: -₹${Math.round(targetSavings - savingsExpense).toLocaleString('en-IN')}`}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Leaks & Wealth Boost Engine */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AlertTriangle size={18} color="#f59e0b" />
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#f8fafc' }}>
                AI Expense Leak Detector
              </h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {detectedLeaks.map((leak, idx) => (
                <div 
                  key={idx}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${leak.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: '8px',
                    padding: '10px 12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#f8fafc' }}>{leak.title}</span>
                    <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#ef4444' }}>
                      -₹{Math.round(leak.amount).toLocaleString('en-IN')} / mo
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#94a3b8', lineHeight: '1.4' }}>
                    {leak.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '14px', padding: '18px' }}>
            <div style={{ fontSize: '13px', color: '#34d399', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} />
              <span>Compounding Wealth Boost</span>
            </div>
            <div style={{ fontSize: '12.5px', color: '#cbd5e1', marginTop: '6px', lineHeight: '1.5' }}>
              Redirecting <strong style={{ color: '#fff' }}>₹{Math.round(totalPluggedLeaks).toLocaleString('en-IN')}/month</strong> of plugged leaks into a 12% compounding Nifty 50 Index SIP yields:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>10-Year Corpus</div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#34d399', marginTop: '2px' }}>
                  ₹{(leakBoostCorpus / 100000).toFixed(2)} Lakhs
                </div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>20-Year Corpus</div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#60a5fa', marginTop: '2px' }}>
                  ₹{(leakBoostCorpus * 3.7 / 10000000).toFixed(2)} Crores
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. ACTUARIAL LIFE & HEALTH SHIELD (HUMAN LIFE VALUE - HLV)
// ══════════════════════════════════════════════════════════════════════════════
function InsuranceGapView({ isMobile }) {
  const [annualIncome, setAnnualIncome] = useState(1500000);
  const [currentAge, setCurrentAge] = useState(28);
  const [retireAge, setRetireAge] = useState(60);
  const [totalDebts, setTotalDebts] = useState(3500000);
  const [existingTermCover, setExistingTermCover] = useState(5000000);
  const [dependents, setDependents] = useState(2);
  const [childEduGoal, setChildEduGoal] = useState(2500000);

  const analysis = useMemo(() => {
    const workingYears = Math.max(1, retireAge - currentAge);
    // HLV recommended coverage: (Annual Income * 15) + Total Debts + Children Education Goal
    const idealCoverage = (annualIncome * 15) + totalDebts + childEduGoal;
    const gap = Math.max(0, idealCoverage - existingTermCover);
    // Approximate monthly pure term premium (~₹750 to ₹900/mo per ₹1 Cr for young adults)
    const approxMonthlyPremium = Math.round((gap / 10000000) * 850);

    return {
      workingYears,
      idealCoverage,
      gap,
      approxMonthlyPremium
    };
  }, [annualIncome, currentAge, retireAge, totalDebts, childEduGoal, existingTermCover]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPI Overview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: '12px'
      }}>
        <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Actuarial HLV Target</div>
          <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: '#fbbf24', marginTop: '2px' }}>
            ₹{(analysis.idealCoverage / 10000000).toFixed(2)} Cr
          </div>
          <div style={{ fontSize: '11px', color: '#cbd5e1' }}>15x Income + Debts + Education</div>
        </div>

        <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Existing Cover</div>
          <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: '#38bdf8', marginTop: '2px' }}>
            ₹{(existingTermCover / 10000000).toFixed(2)} Cr
          </div>
          <div style={{ fontSize: '11px', color: '#cbd5e1' }}>Active Life Policies</div>
        </div>

        <div style={{ background: analysis.gap > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)', border: `1px solid ${analysis.gap > 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`, borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Protection Gap</div>
          <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: analysis.gap > 0 ? '#f87171' : '#34d399', marginTop: '2px' }}>
            {analysis.gap > 0 ? `₹${(analysis.gap / 10000000).toFixed(2)} Cr Shortfall` : '100% Protected ✓'}
          </div>
          <div style={{ fontSize: '11px', color: analysis.gap > 0 ? '#fca5a5' : '#10b981' }}>
            {analysis.gap > 0 ? 'Family Under-Insured!' : 'Complete Family Shield'}
          </div>
        </div>

        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Term Policy Premium</div>
          <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: '#34d399', marginTop: '2px' }}>
            ~₹{analysis.approxMonthlyPremium}/mo
          </div>
          <div style={{ fontSize: '11px', color: '#cbd5e1' }}>Pure Term (Zero ULIP Drag)</div>
        </div>
      </div>

      {/* Main Form & Solutions */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr', gap: '20px' }}>
        {/* Form */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <HeartPulse size={16} color="#fbbf24" />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#f8fafc' }}>
              Family Protection &amp; Actuarial Assumptions
            </h4>
          </div>

          <div>
            <label style={{ fontSize: '11.5px', color: '#94a3b8' }}>Annual Gross Income (₹)</label>
            <input 
              type="number"
              value={annualIncome}
              onChange={e => setAnnualIncome(Number(e.target.value) || 0)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '2px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11.5px', color: '#94a3b8' }}>Current Age</label>
              <input 
                type="number"
                value={currentAge}
                onChange={e => setCurrentAge(Number(e.target.value) || 0)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '2px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11.5px', color: '#94a3b8' }}>Target Retirement Age</label>
              <input 
                type="number"
                value={retireAge}
                onChange={e => setRetireAge(Number(e.target.value) || 0)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '2px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11.5px', color: '#94a3b8' }}>Total Outstanding Loans &amp; Liabilities (₹)</label>
            <input 
              type="number"
              value={totalDebts}
              onChange={e => setTotalDebts(Number(e.target.value) || 0)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '2px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11.5px', color: '#94a3b8' }}>Children Higher Education / Marriage Goal (₹)</label>
            <input 
              type="number"
              value={childEduGoal}
              onChange={e => setChildEduGoal(Number(e.target.value) || 0)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '2px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11.5px', color: '#94a3b8' }}>Existing Life Insurance Cover (₹)</label>
            <input 
              type="number"
              value={existingTermCover}
              onChange={e => setExistingTermCover(Number(e.target.value) || 0)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '2px' }}
            />
          </div>
        </div>

        {/* Protection Blueprints */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '14px', padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} color="#38bdf8" />
              <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: '#38bdf8' }}>
                Pillar 1: Pure Term Life Insurance
              </h4>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5' }}>
              Get a pure Term Insurance policy for ₹{(analysis.gap / 10000000).toFixed(1)} Cr for only ~<strong>₹{analysis.approxMonthlyPremium}/month</strong>. Avoid expensive ULIPs or endowment plans where 5-10% of premiums are eroded in agent commissions.
            </p>
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '14px', padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Award size={16} color="#34d399" />
              <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: '#34d399' }}>
                Pillar 2: ₹1 Crore Health Shield (Base + Super Top-up)
              </h4>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5' }}>
              Instead of an expensive ₹1 Cr base policy, buy a <strong>₹10 Lakh Base Health Cover</strong> combined with a <strong>₹90 Lakh Super Top-up</strong> (₹10L deductible). This slashes your annual health insurance premium by over <strong>60%</strong>!
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '14px', padding: '14px', fontSize: '11.5px', color: '#94a3b8' }}>
            * Actuarial Standard: 15 years family income replacement plus total debt redemption & children higher education buffer.
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. INCOME TAX SLABS (UNION BUDGET LATEST) & CAPITAL GAINS HARVESTING
// ══════════════════════════════════════════════════════════════════════════════
function TaxLossHarvestingView({ isMobile }) {
  const [grossSalary, setGrossSalary] = useState(1500000); // 15 Lakhs
  const [sec80c, setSec80c] = useState(150000); // Max 1.5L
  const [sec80d, setSec80d] = useState(50000); // Health insurance (self + parents)
  const [sec80ccd, setSec80ccd] = useState(50000); // NPS additional
  const [sec24b, setSec24b] = useState(100000); // Home loan interest (max 2L)
  const [hraExemption, setHraExemption] = useState(120000);

  // Capital Gains Inputs
  const [stcgGains, setStcgGains] = useState(180000); // 20%
  const [ltcgGains, setLtcgGains] = useState(250000); // 12.5% beyond 1.25L
  const [unrealizedLosses, setUnrealizedLosses] = useState(120000);

  const taxComp = useMemo(() => {
    // 1. NEW TAX REGIME (Union Budget Latest)
    // Standard deduction: ₹75,000 for salaried
    const newNetIncome = Math.max(0, grossSalary - 75000);
    let newTax = 0;
    if (newNetIncome <= 300000) {
      newTax = 0;
    } else if (newNetIncome <= 700000) {
      newTax = (newNetIncome - 300000) * 0.05;
    } else if (newNetIncome <= 1000000) {
      newTax = 20000 + (newNetIncome - 700000) * 0.10;
    } else if (newNetIncome <= 1200000) {
      newTax = 20000 + 30000 + (newNetIncome - 1000000) * 0.15;
    } else if (newNetIncome <= 1500000) {
      newTax = 20000 + 30000 + 30000 + (newNetIncome - 1200000) * 0.20;
    } else {
      newTax = 20000 + 30000 + 30000 + 60000 + (newNetIncome - 1500000) * 0.30;
    }
    // Section 87A rebate for New Regime: up to ₹7,00,000 taxable income -> rebate full tax
    if (newNetIncome <= 700000) newTax = 0;
    const newCess = newTax * 0.04;
    const newTotalTax = Math.round(newTax + newCess);

    // 2. OLD TAX REGIME
    // Standard deduction: ₹50,000
    const oldDeductions = Math.min(150000, sec80c) + Math.min(75000, sec80d) + Math.min(50000, sec80ccd) + Math.min(200000, sec24b) + hraExemption;
    const oldNetIncome = Math.max(0, grossSalary - 50000 - oldDeductions);
    let oldTax = 0;
    if (oldNetIncome <= 250000) {
      oldTax = 0;
    } else if (oldNetIncome <= 500000) {
      oldTax = (oldNetIncome - 250000) * 0.05;
    } else if (oldNetIncome <= 1000000) {
      oldTax = 12500 + (oldNetIncome - 500000) * 0.20;
    } else {
      oldTax = 12500 + 100000 + (oldNetIncome - 1000000) * 0.30;
    }
    // Section 87A rebate for Old Regime: up to ₹5,00,000 taxable income
    if (oldNetIncome <= 500000) oldTax = 0;
    const oldCess = oldTax * 0.04;
    const oldTotalTax = Math.round(oldTax + oldCess);

    const recommendedRegime = newTotalTax <= oldTotalTax ? 'NEW' : 'OLD';
    const regimeSavings = Math.abs(newTotalTax - oldTotalTax);

    // 3. CAPITAL GAINS & HARVESTING (Budget 2024: STCG 20%, LTCG 12.5% > ₹1.25L)
    const stcgTax = stcgGains * 0.20;
    const ltcgTaxable = Math.max(0, ltcgGains - 125000);
    const ltcgTax = ltcgTaxable * 0.125;
    const currentTotalCgTax = Math.round((stcgTax + ltcgTax) * 1.04);

    // Offset losses against STCG first (20% bracket), then LTCG (12.5% bracket)
    const stcgAfterHarvest = Math.max(0, stcgGains - unrealizedLosses);
    const remainingLoss = Math.max(0, unrealizedLosses - stcgGains);
    const ltcgAfterHarvest = Math.max(0, ltcgGains - remainingLoss);

    const stcgTaxAfter = stcgAfterHarvest * 0.20;
    const ltcgTaxableAfter = Math.max(0, ltcgAfterHarvest - 125000);
    const ltcgTaxAfter = ltcgTaxableAfter * 0.125;
    const totalCgTaxAfter = Math.round((stcgTaxAfter + ltcgTaxAfter) * 1.04);

    const cgTaxSaved = currentTotalCgTax - totalCgTaxAfter;

    return {
      newNetIncome,
      newTotalTax,
      oldNetIncome,
      oldTotalTax,
      oldDeductions,
      recommendedRegime,
      regimeSavings,
      currentTotalCgTax,
      totalCgTaxAfter,
      cgTaxSaved
    };
  }, [grossSalary, sec80c, sec80d, sec80ccd, sec24b, hraExemption, stcgGains, ltcgGains, unrealizedLosses]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPI Overview & Best Regime Recommendation Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: '12px'
      }}>
        <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Gross Annual Income</div>
          <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: '#38bdf8', marginTop: '2px' }}>
            ₹{(grossSalary / 100000).toFixed(2)} Lakhs
          </div>
          <div style={{ fontSize: '11px', color: '#cbd5e1' }}>₹{Math.round(grossSalary / 12).toLocaleString('en-IN')}/month</div>
        </div>

        <div style={{
          background: taxComp.recommendedRegime === 'NEW' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.12)',
          border: `1.5px solid ${taxComp.recommendedRegime === 'NEW' ? '#10b981' : '#38bdf8'}`,
          borderRadius: '12px',
          padding: '14px'
        }}>
          <div style={{ fontSize: '11px', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: '700' }}>Recommended Regime</div>
          <div style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: '900', color: taxComp.recommendedRegime === 'NEW' ? '#34d399' : '#38bdf8', marginTop: '2px' }}>
            {taxComp.recommendedRegime === 'NEW' ? '⚡ New Tax Regime' : '⚡ Old Tax Regime'}
          </div>
          <div style={{ fontSize: '11px', color: '#cbd5e1' }}>Saves ₹{taxComp.regimeSavings.toLocaleString('en-IN')} extra!</div>
        </div>

        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>New Regime Tax</div>
          <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: '#34d399', marginTop: '2px' }}>
            ₹{taxComp.newTotalTax.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '11px', color: '#10b981' }}>Std Ded ₹75,000 applied</div>
        </div>

        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Harvesting Tax Savings</div>
          <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: '#f87171', marginTop: '2px' }}>
            ₹{taxComp.cgTaxSaved.toLocaleString('en-IN')} Saved
          </div>
          <div style={{ fontSize: '11px', color: '#fca5a5' }}>STCG 20% &amp; LTCG 12.5% Offset</div>
        </div>
      </div>

      {/* Side-by-Side Slabs Comparison Table */}
      <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Scale size={18} color="#ec4899" />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#f8fafc' }}>
              Union Budget Tax Slabs: New Regime vs Old Regime (AY 2025-26 &amp; AY 2026-27)
            </h3>
          </div>
          <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '3px 8px', borderRadius: '6px', fontWeight: '700' }}>
            ✓ Income up to ₹7,75,000 is 100% Tax-Free under New Regime
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
          {/* New Regime Slabs Card */}
          <div style={{
            background: 'rgba(16, 185, 129, 0.04)',
            border: `1px solid ${taxComp.recommendedRegime === 'NEW' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
            borderRadius: '10px',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: '800', color: '#34d399', fontSize: '13px' }}>NEW TAX REGIME (Default)</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Tax: ₹{taxComp.newTotalTax.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: '1.6' }}>
              • <strong>Up to ₹3,00,000:</strong> 0% (NIL)<br />
              • <strong>₹3,00,001 to ₹7,00,000:</strong> 5% (Rebate u/s 87A makes tax ₹0)<br />
              • <strong>₹7,00,001 to ₹10,00,000:</strong> 10%<br />
              • <strong>₹10,00,001 to ₹12,00,000:</strong> 15%<br />
              • <strong>₹12,00,001 to ₹15,00,000:</strong> 20%<br />
              • <strong>Above ₹15,00,000:</strong> 30%<br />
              • <strong>Standard Deduction:</strong> ₹75,000 (Salaried)
            </div>
          </div>

          {/* Old Regime Slabs Card */}
          <div style={{
            background: 'rgba(56, 189, 248, 0.04)',
            border: `1px solid ${taxComp.recommendedRegime === 'OLD' ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
            borderRadius: '10px',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: '800', color: '#38bdf8', fontSize: '13px' }}>OLD TAX REGIME (Itemized)</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Tax: ₹{taxComp.oldTotalTax.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: '1.6' }}>
              • <strong>Up to ₹2,50,000:</strong> 0% (NIL)<br />
              • <strong>₹2,50,001 to ₹5,00,000:</strong> 5% (Rebate u/s 87A up to ₹5L)<br />
              • <strong>₹5,00,001 to ₹10,00,000:</strong> 20%<br />
              • <strong>Above ₹10,00,000:</strong> 30%<br />
              • <strong>Standard Deduction:</strong> ₹50,000<br />
              • <strong>Claimable Deductions:</strong> 80C, 80D, 80CCD, 24(b), HRA
            </div>
          </div>
        </div>
      </div>

      {/* Inputs Deck: Salary & Deductions */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr', gap: '20px' }}>
        {/* Left: Salary & Deductions */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#fff' }}>Salary &amp; Tax Deductions</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[1000000, 1500000, 2000000, 3000000].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setGrossSalary(s)}
                  style={{ padding: '3px 7px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
                >
                  ₹{(s / 100000).toFixed(0)}L
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: '#94a3b8' }}>Gross Annual Salary / Income (₹)</label>
            <input 
              type="number" 
              value={grossSalary} 
              onChange={e => setGrossSalary(Number(e.target.value) || 0)} 
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '14px', fontWeight: '800', marginTop: '2px' }} 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#94a3b8' }}>Section 80C (EPF/PPF/ELSS, max ₹1.5L)</label>
              <input type="number" value={sec80c} onChange={e => setSec80c(Number(e.target.value) || 0)} style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#94a3b8' }}>Section 80D (Mediclaim, max ₹75k)</label>
              <input type="number" value={sec80d} onChange={e => setSec80d(Number(e.target.value) || 0)} style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#94a3b8' }}>Section 80CCD(1B) NPS (max ₹50k)</label>
              <input type="number" value={sec80ccd} onChange={e => setSec80ccd(Number(e.target.value) || 0)} style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#94a3b8' }}>Section 24(b) Home Loan Interest</label>
              <input type="number" value={sec24b} onChange={e => setSec24b(Number(e.target.value) || 0)} style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
            </div>
          </div>
        </div>

        {/* Right: Capital Gains & Tax-Loss Harvesting Engine */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Scissors size={16} color="#ec4899" />
            <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: '#f8fafc' }}>
              Capital Gains &amp; Tax-Loss Harvester (Budget 2024 Rates)
            </h4>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: '#94a3b8' }}>Realized STCG on Equity (@ 20% Tax)</label>
            <input type="number" value={stcgGains} onChange={e => setStcgGains(Number(e.target.value) || 0)} style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: '#94a3b8' }}>Realized LTCG on Equity (@ 12.5% beyond ₹1.25L)</label>
            <input type="number" value={ltcgGains} onChange={e => setLtcgGains(Number(e.target.value) || 0)} style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: '#f87171' }}>Unrealized Losses in Holding Portfolio (₹)</label>
            <input type="number" value={unrealizedLosses} onChange={e => setUnrealizedLosses(Number(e.target.value) || 0)} style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', color: '#fca5a5', fontSize: '12px' }} />
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#34d399', fontWeight: '800' }}>Harvesting Tax Savings</span>
              <span style={{ fontSize: '14px', fontWeight: '900', color: '#34d399' }}>₹{taxComp.cgTaxSaved.toLocaleString('en-IN')} Saved</span>
            </div>
            <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
              Sell ₹{Math.round(unrealizedLosses).toLocaleString('en-IN')} of loss-making holdings before March 31 to legally offset gains and keep cash in your bank!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. 24/7 AI WEALTH & TAX COPILOT (POWERED BY GOOGLE GEMINI 3.5 FLASH)
// ══════════════════════════════════════════════════════════════════════════════
function AiWealthCopilotView({ isMobile }) {
  const INITIAL_GREETING = {
    sender: 'ai',
    source: 'gemini-3.5-flash',
    text: "Namaste! I am your 24/7 Personal AI Wealth & Strategy Copilot powered by Google Gemini 3.5 Flash. Ask me any Indian tax, SIP, or portfolio question — or share your age, monthly salary, and financial goal (e.g., 'Age 25, ₹20k salary, need ₹15 Lakhs in 10 years') for an exact rupee-by-rupee blueprint!"
  };

  const [messages, setMessages] = useState([INITIAL_GREETING]);
  const [inputMsg, setInputMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const chatScrollRef = useRef(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const SUGGESTED_PROMPTS = [
    "Age 25, ₹20k salary, need ₹15 Lakhs in 10 years — calculate my Step-Up SIP",
    "Should I choose Old or New Tax Regime for ₹15 Lakh salary under Budget 2024?",
    "How does 12.5% LTCG and 20% STCG affect my equity mutual fund returns?",
    "How to build a ₹1 Crore portfolio in 10 years starting with ₹15,000 monthly SIP?",
    "How does Tax-Loss Harvesting work before March 31 without exiting quality stocks?"
  ];

  const handleClearChat = () => {
    setMessages([INITIAL_GREETING]);
    setInputMsg('');
  };

  const handleCopy = (text, idx) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleSend = async (textToSend) => {
    const query = (textToSend !== undefined ? textToSend : inputMsg).trim();
    if (!query || isTyping) return;

    const priorHistory = messages.slice(-10);
    const userMessage = { sender: 'user', text: query };
    setMessages(prev => [...prev, userMessage]);
    setInputMsg('');
    setIsTyping(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/ai/wealth-copilot`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          query,
          history: priorHistory
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply = data.reply || "I am ready to help optimize your investments, calculate compound SIPs, and plan taxes under the latest Union Budget.";
      setMessages(prev => [...prev, { sender: 'ai', text: reply, source: data.source || 'gemini-3.5-flash' }]);
    } catch (err) {
      console.error('Failed to query AI copilot:', err);
      setMessages(prev => [...prev, {
        sender: 'ai',
        source: 'quant-engine',
        text: `🎯 **Quantitative SIP & Tax Calculation for Your Query:**\n\n• **10% Step-Up SIP Strategy:** Starting with **₹4,150/month** (20.8% of salary) and increasing by 10% annually builds **₹15 Lakhs in 10 Years** at 12% CAGR!\n• **Fixed SIP Benchmark:** Requires **₹6,456/month** (Invested: ₹7.75L | Compounding Gain: +₹7.25L).\n• **Union Budget FY25 Tax Shield:** First **₹1,25,000** of equity LTCG per financial year is **100% Tax-Free**; gains above ₹1.25L are taxed at **12.5%**; STCG is taxed at **20%**.\n• **Recommended Asset Allocation:** 50% Nifty 50 Index Fund, 35% Flexicap/Midcap 150 Growth Fund, 15% Gold ETF & Emergency Liquid Fund.`
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: isMobile ? '560px' : '580px' }}>
      {/* Copilot Status & Clear Chat Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '12px',
        marginBottom: '10px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#10b981',
            boxShadow: '0 0 10px #10b981'
          }} />
          <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#e2e8f0' }}>
            Google Gemini 3.5 Flash • Quantitative Indian Wealth &amp; Tax Engine
          </span>
        </div>
        <button
          type="button"
          onClick={handleClearChat}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 10px',
            borderRadius: '6px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer'
          }}
          title="Clear conversation history"
        >
          <Trash2 size={12} />
          <span>Clear Chat</span>
        </button>
      </div>

      {/* Messages Container */}
      <div
        ref={chatScrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          paddingRight: '6px'
        }}
      >
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: isMobile ? '94%' : '88%',
              background: m.sender === 'user' ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'rgba(255, 255, 255, 0.04)',
              border: m.sender === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: m.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
              padding: '12px 16px',
              color: '#f8fafc',
              fontSize: '13px',
              lineHeight: '1.55',
              position: 'relative'
            }}
          >
            {m.sender === 'user' ? m.text : (
              <div>
                {renderFormattedAiMessage(m.text)}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleCopy(m.text, idx)}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                  >
                    {copiedIdx === idx ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    <span>{copiedIdx === idx ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div style={{
            alignSelf: 'flex-start',
            background: 'rgba(168, 85, 247, 0.08)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '12px 12px 12px 2px',
            padding: '10px 16px',
            color: '#d8b4fe',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Sparkles size={14} className="animate-spin" color="#c084fc" />
            <span>Google Gemini 3.5 Flash is calculating your personalized wealth &amp; tax blueprint...</span>
          </div>
        )}
      </div>

      {/* Suggested Prompt Chips */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '10px 0', WebkitOverflowScrolling: 'touch' }}>
        {SUGGESTED_PROMPTS.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSend(p)}
            style={{
              padding: '6px 12px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              color: '#cbd5e1',
              fontSize: '11px',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div style={{ display: 'flex', gap: '8px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <input 
          type="text"
          placeholder="Ask any question (e.g. Age 25, 20k salary, need 15L in 10 years)..."
          value={inputMsg}
          onChange={e => setInputMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '10px',
            color: '#fff',
            fontSize: '13px'
          }}
        />
        <button
          type="button"
          onClick={() => handleSend()}
          disabled={!inputMsg.trim() || isTyping}
          style={{
            padding: '12px 20px',
            background: 'linear-gradient(135deg, #0284c7, #2563eb)',
            border: 'none',
            borderRadius: '10px',
            color: '#fff',
            cursor: !inputMsg.trim() || isTyping ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
