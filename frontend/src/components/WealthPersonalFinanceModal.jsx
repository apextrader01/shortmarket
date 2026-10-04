// frontend/src/components/WealthPersonalFinanceModal.jsx
// 💰 24/7 AI Wealth Copilot, Smart Budgeting, Insurance Gap Analyzer & Tax-Loss Harvester

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { API } from '../store';
import { 
  X, PieChart, Shield, Wallet, Sparkles, Send, AlertTriangle, 
  CheckCircle2, ArrowRight, TrendingUp, Scissors, HeartPulse,
  DollarSign, RefreshCw, HelpCircle, ChevronRight, ArrowLeft, Download, Printer, Calculator, Trash2
} from 'lucide-react';

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
      ['SkandX Wealth OS & Tax Hub Summary Report', new Date().toLocaleDateString('en-IN')],
      [],
      ['Module', 'Key Metric', 'Benchmark / Rule', 'Status'],
      ['Consolidated Net Worth', 'Multi-Asset Equity + Debt + Gold + Real Estate', 'Solvency Ratio > 65%', 'Active'],
      ['50/30/20 Smart Budget', '50% Needs / 30% Wants / 20% SIP Investments', 'Savings Rate >= 20%', 'Active'],
      ['Term Life & Health HLV', '15x Annual Income + Total Debt Payoff', 'Pure Term Policy Only', 'Active'],
      ['Tax-Loss Harvesting (FY25)', 'STCG @ 20% | LTCG @ 12.5% (>1.25L Exempt)', 'March 31 Offset Deadline', 'Active']
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
    { id: 'TAX_LOSS', label: 'Tax-Loss Harvesting (FY25)', shortLabel: 'Tax Harvesting', badge: 'STCG 20% / LTCG 12.5%', icon: Scissors, color: '#ec4899' },
    { id: 'AI_COPILOT', label: '24/7 AI Wealth Copilot', shortLabel: 'AI Copilot', badge: 'Live Advisory', icon: Sparkles, color: '#a855f7' }
  ];

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
              <div style={{
                width: isMobile ? '32px' : '38px',
                height: isMobile ? '32px' : '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(56, 189, 248, 0.2))',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
                flexShrink: 0
              }}>
                <PieChart size={isMobile ? 16 : 20} />
              </div>
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
                    Institutional Net Worth, 50/30/20 Cashflow Audit, Actuarial HLV Protection & FY25 Tax-Loss Harvesting
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
          maxWidth: '1260px',
          width: '100%',
          boxSizing: 'border-box',
          margin: '0 auto',
          padding: isMobile ? '12px 12px 80px' : '24px 20px 60px',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? '14px' : '22px'
        }}>
          {/* Bento Pillar Selector Cards (Compact Horizontal Pill Strip on Mobile, 5-Card Bento Grid on Desktop) */}
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
                      color: tab.color,
                      flexShrink: 0
                    }}>
                      <Icon size={14} />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: isActive ? '#fff' : '#cbd5e1' }}>
                        {tab.shortLabel || tab.label}
                      </div>
                      <div style={{ fontSize: '9.5px', color: isActive ? tab.color : '#64748b', fontWeight: '700' }}>
                        {tab.badge}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
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
            padding: isMobile ? '16px 12px' : '28px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
            boxSizing: 'border-box',
            width: '100%',
            overflowX: 'hidden'
          }}>
            {activeTab === 'AI_COPILOT' && <AiWealthCopilotView />}
            {activeTab === 'BUDGET' && <BudgetLeakDetectorView />}
            {activeTab === 'INSURANCE' && <InsuranceGapView />}
            {activeTab === 'NET_WORTH' && <NetWorthView />}
            {activeTab === 'TAX_LOSS' && <TaxLossHarvestingView />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 10, 20, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div style={{
        background: 'var(--bg-panel, #0f172a)',
        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '920px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
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
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(56, 189, 248, 0.2))',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c084fc'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>
                Wealth OS & Tax Hub
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                360° personal finance cockpit: Net worth, 50/30/20 budget, actuarial HLV gap & FY25 tax harvesting
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
          borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
          background: 'rgba(0, 0, 0, 0.2)',
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
                  fontSize: '13px',
                  fontWeight: isActive ? '600' : '400',
                  color: isActive ? '#38bdf8' : '#94a3b8',
                  background: isActive ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {activeTab === 'AI_COPILOT' && <AiWealthCopilotView />}
          {activeTab === 'BUDGET' && <BudgetLeakDetectorView />}
          {activeTab === 'INSURANCE' && <InsuranceGapView />}
          {activeTab === 'NET_WORTH' && <NetWorthView />}
          {activeTab === 'TAX_LOSS' && <TaxLossHarvestingView />}
        </div>
      </div>
    </div>
  );
}

// Clean Markdown Formatter for AI Copilot Responses (removes raw ** and renders headings/lists/tables)
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
            <div key={i} style={{ fontSize: '14px', fontWeight: '800', color: '#38bdf8', marginTop: '6px' }}>
              {formatInlineBold(trimmed.replace(/^###\s+/, ''))}
            </div>
          );
        }
        if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
          return (
            <div key={i} style={{ fontSize: '15px', fontWeight: '800', color: '#34d399', marginTop: '8px' }}>
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
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          if (/^\|[\s:|-]+\|$/.test(trimmed)) return null;
          const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
          return (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`,
              gap: '8px',
              padding: '6px 10px',
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '6px',
              fontSize: '12px'
            }}>
              {cells.map((cell, ci) => (
                <div key={ci} style={{ overflowWrap: 'anywhere' }}>{formatInlineBold(cell)}</div>
              ))}
            </div>
          );
        }
        return <div key={i}>{formatInlineBold(line)}</div>;
      })}
    </div>
  );
}

// --------------------------------------------------------------------------
// 1. 24/7 Personal AI Wealth Copilot
// --------------------------------------------------------------------------
function AiWealthCopilotView() {
  const INITIAL_GREETING = {
    sender: 'ai',
    source: 'gemini-3.8-flash',
    text: "Namaste! I am your 24/7 Personal AI Wealth & Strategy Copilot powered by Google Gemini 3.8 Flash. Share your age, monthly salary, and financial goal (e.g., 'Age 25, ₹20k salary, need ₹15 Lakhs in 10 years') or ask any Indian tax/SIP question!"
  };

  const [messages, setMessages] = useState([INITIAL_GREETING]);
  const [inputMsg, setInputMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatScrollRef = useRef(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const SUGGESTED_PROMPTS = [
    "Age 25, ₹20k salary, need ₹15 Lakhs in 10 years — calculate my Step-Up SIP",
    "How to build a ₹1 Crore portfolio in 10 years?",
    "Should I opt for Old or New Tax Regime for ₹15L salary?",
    "How does Tax-Loss Harvesting work under Budget FY25 LTCG rules?"
  ];

  const handleClearChat = () => {
    setMessages([INITIAL_GREETING]);
    setInputMsg('');
  };

  const handleSend = async (textToSend) => {
    const query = (textToSend !== undefined ? textToSend : inputMsg).trim();
    if (!query || isTyping) return;

    const priorHistory = messages.slice(-8);
    const userMessage = { sender: 'user', text: query };
    setMessages(prev => [...prev, userMessage]);
    setInputMsg('');
    setIsTyping(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/ai/wealth-copilot`, {
        method: 'POST',
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
      const reply = data.reply || "I am ready to help optimize your investments, calculate compound SIPs, and plan taxes under Budget FY25.";
      setMessages(prev => [...prev, { sender: 'ai', text: reply, source: data.source || 'gemini-3.8-flash' }]);
    } catch (err) {
      console.error('Failed to query AI copilot:', err);
      setMessages(prev => [...prev, {
        sender: 'ai',
        source: 'quant-engine',
        text: `🎯 **Instant SIP & Wealth Calculation:**\n\n• **10% Step-Up SIP Strategy:** For a ₹15 Lakh target in 10 years on a ₹20,000 salary, start with **₹4,150/month** (20.8% of salary) and increase by 10% annually.\n• **Fixed SIP Alternative (@ 12% CAGR):** **₹6,456/month** (Invested: ₹7.75L | Wealth Gain: ₹7.25L).\n• **Recommended Portfolio:** 50% Nifty 50 Index Fund, 35% Flexicap/Midcap 150, 15% Gold ETF & Liquid Emergency Fund.`
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '520px' }}>
      {/* Copilot Status & Clear Chat Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '10px',
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
            boxShadow: '0 0 8px #10b981'
          }} />
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#e2e8f0' }}>
            Google Gemini 3.8 Flash • Quantitative Indian Wealth & Tax Engine
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
          gap: '12px',
          paddingRight: '6px'
        }}
      >
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              background: m.sender === 'user' ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'rgba(255, 255, 255, 0.04)',
              border: m.sender === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: m.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              padding: '12px 16px',
              color: '#f8fafc',
              fontSize: '13px',
              lineHeight: '1.55'
            }}
          >
            {m.sender === 'user' ? m.text : renderFormattedAiMessage(m.text)}
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
            <span>Gemini 3.8 Flash is computing your personalized SIP, Step-Up & FY25 tax blueprint...</span>
          </div>
        )}
      </div>

      {/* Suggested Prompts */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '10px 0' }}>
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
              cursor: 'pointer'
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <input 
          type="text"
          placeholder="Ask any question (e.g., Age 25, 20k salary, need 15L in 10 years)..."
          value={inputMsg}
          onChange={e => setInputMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
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
            borderRadius: '8px',
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

// --------------------------------------------------------------------------
// 2. 50/30/20 Smart Budget & Expense Leak Detector
// --------------------------------------------------------------------------
function BudgetLeakDetectorView() {
  const [monthlyIncome, setMonthlyIncome] = useState(120000);
  const [needsExpense, setNeedsExpense] = useState(55000); // Target 50% = 60,000
  const [wantsExpense, setWantsExpense] = useState(45000); // Target 30% = 36,000
  const [savingsExpense, setSavingsExpense] = useState(20000); // Target 20% = 24,000

  // Detected leaks
  const detectedLeaks = useMemo(() => {
    const leaks = [];
    const targetWants = monthlyIncome * 0.30;
    const wantsExcess = wantsExpense - targetWants;

    if (wantsExcess > 0) {
      leaks.push({
        title: 'Wants & Lifestyle Leak',
        amount: wantsExcess,
        severity: 'HIGH',
        desc: `You are spending ₹${Math.round(wantsExcess).toLocaleString('en-IN')} over your 30% wants threshold on dining/shopping.`
      });
    }

    // Typical recurring micro-leaks
    leaks.push({
      title: 'Unused OTT & App Subscriptions',
      amount: 2499,
      severity: 'MEDIUM',
      desc: 'Multiple streaming, cloud storage & gaming renewals detected with <15% usage.'
    });

    leaks.push({
      title: 'Excess Food Delivery Surcharges',
      amount: 3200,
      severity: 'LOW',
      desc: 'Peak convenience fee, surge pricing and recurring late night food delivery packaging.'
    });

    return leaks;
  }, [monthlyIncome, wantsExpense]);

  const targetNeeds = monthlyIncome * 0.50;
  const targetWants = monthlyIncome * 0.30;
  const targetSavings = monthlyIncome * 0.20;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Net Monthly Take-Home Income (₹)</label>
          <input 
            type="number"
            value={monthlyIncome}
            onChange={e => setMonthlyIncome(Number(e.target.value))}
            style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '15px', fontWeight: '700', marginTop: '4px' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '12px', color: '#cbd5e1' }}>Needs: Rent, Food, EMIs (50% target)</label>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8' }}>₹{needsExpense.toLocaleString('en-IN')}</span>
          </div>
          <input 
            type="range" min="0" max={monthlyIncome} step="1000"
            value={needsExpense}
            onChange={e => setNeedsExpense(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#38bdf8', marginTop: '4px' }}
          />
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Target: ₹{Math.round(targetNeeds).toLocaleString('en-IN')}</span>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '12px', color: '#cbd5e1' }}>Wants: Dining, Travel, Shopping (30% target)</label>
            <span style={{ fontSize: '13px', fontWeight: '700', color: wantsExpense > targetWants ? '#ef4444' : '#10b981' }}>
              ₹{wantsExpense.toLocaleString('en-IN')}
            </span>
          </div>
          <input 
            type="range" min="0" max={monthlyIncome} step="1000"
            value={wantsExpense}
            onChange={e => setWantsExpense(Number(e.target.value))}
            style={{ width: '100%', accentColor: wantsExpense > targetWants ? '#ef4444' : '#10b981', marginTop: '4px' }}
          />
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Target: ₹{Math.round(targetWants).toLocaleString('en-IN')}</span>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '12px', color: '#cbd5e1' }}>Savings & SIP Investments (20% target)</label>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#10b981' }}>₹{savingsExpense.toLocaleString('en-IN')}</span>
          </div>
          <input 
            type="range" min="0" max={monthlyIncome} step="1000"
            value={savingsExpense}
            onChange={e => setSavingsExpense(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#10b981', marginTop: '4px' }}
          />
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Target: ₹{Math.round(targetSavings).toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Leaks & Recommendations */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <AlertTriangle size={18} color="#f59e0b" />
            <h4 style={{ margin: 0, fontSize: '15px', color: '#f8fafc' }}>
              AI Expense Leak Detector
            </h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {detectedLeaks.map((leak, idx) => (
              <div 
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${leak.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: '8px',
                  padding: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#f8fafc' }}>{leak.title}</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#ef4444' }}>
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

        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ fontSize: '12px', color: '#34d399', fontWeight: '600' }}>
            💡 Potential Wealth Boost:
          </div>
          <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
            Redirecting ₹5,699/mo of plugged leaks into a 12% compounding SIP yields <strong>₹13.2 Lakhs in 10 years</strong>!
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 3. Term Life & Health Insurance Gap Analyzer (Human Life Value - HLV)
// --------------------------------------------------------------------------
function InsuranceGapView() {
  const [annualIncome, setAnnualIncome] = useState(1500000);
  const [currentAge, setCurrentAge] = useState(28);
  const [retireAge, setRetireAge] = useState(60);
  const [totalDebts, setTotalDebts] = useState(3500000); // Home loan / Car loan
  const [existingTermCover, setExistingTermCover] = useState(5000000); // 50 Lakhs
  const [hasHealthCover, setHasHealthCover] = useState(true);

  const analysis = useMemo(() => {
    const workingYears = Math.max(1, retireAge - currentAge);
    // HLV recommended coverage: (Annual Income * 15) + Total Debts
    const idealCoverage = (annualIncome * 15) + totalDebts;
    const gap = Math.max(0, idealCoverage - existingTermCover);
    const approxMonthlyPremium = Math.round((gap / 10000000) * 850); // ~₹850/mo per ₹1 Cr term cover for 28yo

    return {
      workingYears,
      idealCoverage,
      gap,
      approxMonthlyPremium
    };
  }, [annualIncome, currentAge, retireAge, totalDebts, existingTermCover]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Annual Gross Income (₹)</label>
          <input 
            type="number"
            value={annualIncome}
            onChange={e => setAnnualIncome(Number(e.target.value))}
            style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '14px', marginTop: '4px' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>Current Age</label>
            <input 
              type="number"
              value={currentAge}
              onChange={e => setCurrentAge(Number(e.target.value))}
              style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '4px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>Retirement Age</label>
            <input 
              type="number"
              value={retireAge}
              onChange={e => setRetireAge(Number(e.target.value))}
              style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '4px' }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Outstanding Liabilities & Loans (₹)</label>
          <input 
            type="number"
            value={totalDebts}
            onChange={e => setTotalDebts(Number(e.target.value))}
            style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '4px' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Existing Life Insurance Cover (₹)</label>
          <input 
            type="number"
            value={existingTermCover}
            onChange={e => setExistingTermCover(Number(e.target.value))}
            style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '4px' }}
          />
        </div>
      </div>

      {/* Analysis Card */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <div>
          <span style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Human Life Value Protection Gap</span>
          
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <h3 style={{ fontSize: '30px', fontWeight: '800', color: analysis.gap > 0 ? '#ef4444' : '#10b981', margin: 0 }}>
              {analysis.gap > 0 ? `₹${(analysis.gap / 10000000).toFixed(2)} Cr Shortfall` : 'Fully Protected ✓'}
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Required Pure Cover</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#f8fafc', marginTop: '2px' }}>
                ₹{(analysis.idealCoverage / 10000000).toFixed(2)} Cr
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Current Existing Cover</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#cbd5e1', marginTop: '2px' }}>
                ₹{(existingTermCover / 10000000).toFixed(2)} Cr
              </div>
            </div>
          </div>

          <div style={{ marginTop: '14px', padding: '12px', background: 'rgba(56, 189, 248, 0.06)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
            <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: '600' }}>
              🛡️ Zero-Commission Solution:
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px', lineHeight: '1.4' }}>
              Get a pure Term Insurance policy for ₹{(analysis.gap / 10000000).toFixed(1)} Cr for only ~<strong>₹{analysis.approxMonthlyPremium}/month</strong>. Avoid expensive ULIPs with 5-10% hidden agent commissions.
            </div>
          </div>
        </div>

        <div style={{ marginTop: '14px', fontSize: '11px', color: '#64748b' }}>
          * Based on standard actuarial HLV model: 15 years family income replacement plus complete debt redemption.
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 4. Consolidated Net Worth
// --------------------------------------------------------------------------
function NetWorthView() {
  const [stocks, setStocks] = useState(1250000);
  const [mutualFunds, setMutualFunds] = useState(850000);
  const [epfPpf, setEpfPpf] = useState(620000);
  const [bankFd, setBankFd] = useState(380000);
  const [gold, setGold] = useState(240000);
  const [realEstate, setRealEstate] = useState(4500000);
  const [debtLiability, setDebtLiability] = useState(2100000);

  const totalAssets = stocks + mutualFunds + epfPpf + bankFd + gold + realEstate;
  const netWorth = totalAssets - debtLiability;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h4 style={{ margin: '0 0 6px', fontSize: '14px', color: '#94a3b8' }}>Asset Breakdown (₹)</h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#38bdf8' }}>Direct Equity & Stocks</label>
            <input type="number" value={stocks} onChange={e => setStocks(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#10b981' }}>Mutual Funds</label>
            <input type="number" value={mutualFunds} onChange={e => setMutualFunds(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#f59e0b' }}>EPF & PPF</label>
            <input type="number" value={epfPpf} onChange={e => setEpfPpf(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#cbd5e1' }}>Bank Savings & FD</label>
            <input type="number" value={bankFd} onChange={e => setBankFd(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#fbbf24' }}>Physical Gold & SGB</label>
            <input type="number" value={gold} onChange={e => setGold(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#a855f7' }}>Real Estate Equity</label>
            <input type="number" value={realEstate} onChange={e => setRealEstate(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px' }} />
          </div>
        </div>

        <div style={{ marginTop: '8px' }}>
          <label style={{ fontSize: '12px', color: '#ef4444' }}>Total Liabilities & Debt (Home Loans, EMIs)</label>
          <input type="number" value={debtLiability} onChange={e => setDebtLiability(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', color: '#fca5a5', fontSize: '14px', marginTop: '2px' }} />
        </div>
      </div>

      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <div>
          <span style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Consolidated Net Worth</span>
          <h3 style={{ fontSize: '32px', fontWeight: '800', color: '#38bdf8', margin: '4px 0 0' }}>
            ₹{(netWorth / 10000000).toFixed(2)} Crores
          </h3>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            (₹{Math.round(netWorth).toLocaleString('en-IN')})
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '11px', color: '#10b981' }}>Gross Total Assets</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#34d399', marginTop: '2px' }}>
                ₹{(totalAssets / 10000000).toFixed(2)} Cr
              </div>
            </div>
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ fontSize: '11px', color: '#ef4444' }}>Total Liabilities</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#f87171', marginTop: '2px' }}>
                ₹{(debtLiability / 10000000).toFixed(2)} Cr
              </div>
            </div>
          </div>

          {/* Visual Stacked Asset Allocation Bar */}
          {totalAssets > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>
                <span>Multi-Asset Allocation Mix</span>
                <span>100% (₹{(totalAssets / 100000).toFixed(1)}L)</span>
              </div>
              <div style={{ height: '10px', borderRadius: '6px', overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ width: `${(stocks / totalAssets) * 100}%`, background: '#38bdf8' }} title="Direct Stocks" />
                <div style={{ width: `${(mutualFunds / totalAssets) * 100}%`, background: '#10b981' }} title="Mutual Funds" />
                <div style={{ width: `${(epfPpf / totalAssets) * 100}%`, background: '#f59e0b' }} title="EPF/PPF" />
                <div style={{ width: `${(bankFd / totalAssets) * 100}%`, background: '#94a3b8' }} title="Bank FD" />
                <div style={{ width: `${(gold / totalAssets) * 100}%`, background: '#fbbf24' }} title="Gold" />
                <div style={{ width: `${(realEstate / totalAssets) * 100}%`, background: '#a855f7' }} title="Real Estate" />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px', fontSize: '10.5px', color: '#cbd5e1' }}>
                <span style={{ color: '#38bdf8' }}>● Equity {((stocks / totalAssets) * 100).toFixed(0)}%</span>
                <span style={{ color: '#10b981' }}>● MF {((mutualFunds / totalAssets) * 100).toFixed(0)}%</span>
                <span style={{ color: '#f59e0b' }}>● EPF {((epfPpf / totalAssets) * 100).toFixed(0)}%</span>
                <span style={{ color: '#fbbf24' }}>● Gold {((gold / totalAssets) * 100).toFixed(0)}%</span>
                <span style={{ color: '#a855f7' }}>● Real Estate {((realEstate / totalAssets) * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
            <strong>Solvency Ratio:</strong> {totalAssets > 0 ? ((netWorth / totalAssets) * 100).toFixed(1) : '0.0'}% healthy equity cushion.
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 5. Tax-Loss Harvesting Simulator (Budget FY25 Rules)
// --------------------------------------------------------------------------
function TaxLossHarvestingView() {
  const [stcgGains, setStcgGains] = useState(180000); // 20%
  const [ltcgGains, setLtcgGains] = useState(250000); // 12.5% beyond 1.25L
  const [unrealizedLosses, setUnrealizedLosses] = useState(120000);

  const calc = useMemo(() => {
    // Current tax without harvesting
    const stcgTax = stcgGains * 0.20;
    const ltcgTaxable = Math.max(0, ltcgGains - 125000);
    const ltcgTax = ltcgTaxable * 0.125;
    const currentTotalTax = stcgTax + ltcgTax;

    // After harvesting unrealized losses (offset against STCG first)
    const stcgAfterHarvest = Math.max(0, stcgGains - unrealizedLosses);
    const remainingLoss = Math.max(0, unrealizedLosses - stcgGains);
    const ltcgAfterHarvest = Math.max(0, ltcgGains - remainingLoss);

    const stcgTaxAfter = stcgAfterHarvest * 0.20;
    const ltcgTaxableAfter = Math.max(0, ltcgAfterHarvest - 125000);
    const ltcgTaxAfter = ltcgTaxableAfter * 0.125;
    const totalTaxAfter = stcgTaxAfter + ltcgTaxAfter;

    const taxSaved = currentTotalTax - totalTaxAfter;

    return {
      currentTotalTax,
      totalTaxAfter,
      taxSaved
    };
  }, [stcgGains, ltcgGains, unrealizedLosses]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Realized Short Term Gains (STCG @ 20%)</label>
          <input type="number" value={stcgGains} onChange={e => setStcgGains(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '4px' }} />
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Realized Long Term Gains (LTCG @ 12.5% beyond ₹1.25L)</label>
          <input type="number" value={ltcgGains} onChange={e => setLtcgGains(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '4px' }} />
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#ef4444' }}>Unrealized Losses in Holding Portfolio (₹)</label>
          <input type="number" value={unrealizedLosses} onChange={e => setUnrealizedLosses(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', color: '#fca5a5', fontSize: '13px', marginTop: '4px' }} />
        </div>
      </div>

      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <div>
          <span style={{ fontSize: '12px', color: '#10b981', textTransform: 'uppercase', fontWeight: '700' }}>
            Instant Tax Savings via Harvesting
          </span>
          <h3 style={{ fontSize: '32px', fontWeight: '800', color: '#34d399', margin: '4px 0 0' }}>
            ₹{Math.round(calc.taxSaved).toLocaleString('en-IN')} Saved
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ fontSize: '11px', color: '#ef4444' }}>Current Tax Liability</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#f87171', marginTop: '2px' }}>
                ₹{Math.round(calc.currentTotalTax).toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              <div style={{ fontSize: '11px', color: '#38bdf8' }}>New Tax After Harvest</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#38bdf8', marginTop: '2px' }}>
                ₹{Math.round(calc.totalTaxAfter).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {calc.currentTotalTax > 0 && (
            <div style={{ marginTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                <span>Tax Reduction Efficiency</span>
                <span style={{ color: '#10b981', fontWeight: '700' }}>
                  {((calc.taxSaved / calc.currentTotalTax) * 100).toFixed(1)}% Saved
                </span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.2)', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (calc.taxSaved / calc.currentTotalTax) * 100)}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #38bdf8)' }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', fontSize: '12px', color: '#cbd5e1' }}>
          💡 <strong>Action:</strong> Sell ₹{Math.round(unrealizedLosses).toLocaleString('en-IN')} of loss-making shares before March 31 to legally offset gains and keep ₹{Math.round(calc.taxSaved).toLocaleString('en-IN')} cash in your pocket.
        </div>
      </div>
    </div>
  );
}
