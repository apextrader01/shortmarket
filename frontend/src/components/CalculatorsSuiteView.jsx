// frontend/src/components/CalculatorsSuiteView.jsx
// 🧮 SkandX Institutional Calculators & Financial Tools Suite (Fyers-Style Full-Page Platform)

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Calculator, TrendingUp, DollarSign, Percent, ArrowLeft, ArrowRight,
  Download, FileText, PieChart, Table, RefreshCw, Plus, Trash2, CheckCircle2,
  HelpCircle, AlertCircle, Sparkles, Building2, ShieldAlert, Receipt, LineChart,
  BarChart2, Award, Clock, ChevronRight, Search, Sliders, ExternalLink, Share2, Printer
} from 'lucide-react';
import logoImg from '../assets/logo.png';

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

  const reportDataRef = useRef(null);
  const handleRegisterReport = useCallback((payload) => {
    reportDataRef.current = payload;
  }, []);

  // Institutional A4 Printable PDF Report Generator
  const handlePrintPDF = useCallback(() => {
    const data = reportDataRef.current;
    const calcTitle = data?.title || activeCalcMeta?.title || 'Financial Calculator Report';
    const calcSubtitle = data?.subtitle || activeCalcMeta?.shortDesc || 'Institutional Computational Analysis';
    const calcCategory = activeCalcMeta?.categoryLabel || 'Quantitative Analytics';
    const calcBadge = activeCalcMeta?.badge || 'Verified Model';
    const inputs = data?.inputs || [];
    const kpis = data?.kpis || [];
    const bars = data?.bars || [];
    const tableHeaders = data?.tableHeaders || [];
    const tableRows = data?.tableRows || [];
    const notes = data?.notes || 'Computed using SkandX Institutional Financial & Trading Mathematics Engine. Figures are indicative and subject to market execution parameters.';
    const logoUrl = new URL(logoImg, window.location.origin).href;
    const reportId = `SKX-${(selectedCalcId || 'CALC').toUpperCase()}-${Date.now().toString().slice(-6)}`;
    const generatedAt = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const printWin = window.open('', '_blank', 'width=1024,height=860');
    if (!printWin) {
      window.print();
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>SkandX Report — ${calcTitle}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      margin: 0;
      padding: 24px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0f172a;
      background: #f1f5f9;
      line-height: 1.45;
    }
    .page-sheet {
      max-width: 840px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      padding: 28px 32px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
    }
    .toolbar {
      max-width: 840px;
      margin: 0 auto 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #f8fafc;
      padding: 12px 20px;
      border-radius: 12px;
    }
    .toolbar-btn {
      background: linear-gradient(135deg, #0284c7, #2563eb);
      color: #fff;
      border: none;
      padding: 9px 18px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 18px;
      border-bottom: 2px solid #0f172a;
      margin-bottom: 20px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand img {
      width: 44px;
      height: 44px;
      object-fit: contain;
      border-radius: 10px;
      background: #0f172a;
      padding: 4px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #0f172a;
      margin: 0;
    }
    .brand-sub {
      font-size: 11px;
      font-weight: 700;
      color: #0284c7;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .meta-box {
      text-align: right;
      font-size: 11px;
      color: #475569;
    }
    .meta-id {
      font-family: monospace;
      font-weight: 700;
      color: #0f172a;
      background: #f1f5f9;
      padding: 3px 8px;
      border-radius: 5px;
      display: inline-block;
      margin-bottom: 4px;
    }
    .report-banner {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #f8fafc;
      padding: 18px 22px;
      border-radius: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .report-banner h1 {
      font-size: 20px;
      font-weight: 800;
      margin: 4px 0;
    }
    .report-banner p {
      font-size: 12px;
      color: #94a3b8;
      margin: 0;
    }
    .badge {
      background: rgba(56, 189, 248, 0.16);
      border: 1px solid rgba(56, 189, 248, 0.4);
      color: #38bdf8;
      font-size: 11px;
      font-weight: 700;
      padding: 5px 10px;
      border-radius: 6px;
      white-space: nowrap;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #475569;
      margin: 0 0 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .inputs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 10px;
      margin-bottom: 20px;
    }
    .input-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .input-label {
      font-size: 10.5px;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 3px;
    }
    .input-val {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      font-family: 'JetBrains Mono', monospace;
    }
    .kpis-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .kpi-card {
      border: 1px solid #cbd5e1;
      border-top: 4px solid #0284c7;
      border-radius: 10px;
      padding: 12px 14px;
      background: #ffffff;
    }
    .kpi-label {
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 4px;
    }
    .kpi-val {
      font-size: 18px;
      font-weight: 900;
      color: #0f172a;
      font-family: 'JetBrains Mono', monospace;
    }
    .kpi-sub {
      font-size: 10.5px;
      color: #475569;
      margin-top: 3px;
    }
    .bars-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 22px;
    }
    .bar-track {
      height: 14px;
      width: 100%;
      background: #e2e8f0;
      border-radius: 7px;
      overflow: hidden;
      display: flex;
      margin-bottom: 10px;
    }
    .bar-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 11.5px;
      color: #334155;
      font-weight: 600;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 3px;
      display: inline-block;
      margin-right: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
      margin-bottom: 20px;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      text-align: right;
      padding: 9px 10px;
      border: 1px solid #0f172a;
    }
    th:first-child, td:first-child {
      text-align: left;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
      text-align: right;
      font-family: 'JetBrains Mono', monospace;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .footer {
      margin-top: 20px;
      padding-top: 14px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10.5px;
      color: #64748b;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .page-sheet { box-shadow: none; border: none; padding: 0; max-width: 100%; }
      .toolbar { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div style="font-size:13px;font-weight:700;">📄 SkandX Institutional PDF Report Preview — Ready to Save as PDF</div>
    <div style="display:flex;gap:10px;">
      <button class="toolbar-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>
  </div>
  <div class="page-sheet">
    <div class="header">
      <div class="brand">
        <img src="${logoUrl}" alt="SkandX" />
        <div>
          <div class="brand-sub">SkandX Quantitative Research</div>
          <h2 class="brand-title">www.skandx.in</h2>
        </div>
      </div>
      <div class="meta-box">
        <div class="meta-id">${reportId}</div>
        <div>Generated: ${generatedAt}</div>
        <div>Category: ${calcCategory}</div>
      </div>
    </div>

    <div class="report-banner">
      <div>
        <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:0.8px;color:#38bdf8;font-weight:700;">${calcCategory}</div>
        <h1>${calcTitle}</h1>
        <p>${calcSubtitle}</p>
      </div>
      <div class="badge">${calcBadge}</div>
    </div>

    ${inputs.length > 0 ? `
      <div class="section-title">1. Configured Model Parameters</div>
      <div class="inputs-grid">
        ${inputs.map(inp => `
          <div class="input-card">
            <div class="input-label">${inp.label}</div>
            <div class="input-val">${inp.value}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${kpis.length > 0 ? `
      <div class="section-title">2. Executive Computational Output</div>
      <div class="kpis-grid">
        ${kpis.map(kpi => `
          <div class="kpi-card" style="border-top-color: ${kpi.color || '#0284c7'}">
            <div class="kpi-label">${kpi.label}</div>
            <div class="kpi-val" style="color: ${kpi.color || '#0f172a'}">${kpi.value}</div>
            ${kpi.sub ? `<div class="kpi-sub">${kpi.sub}</div>` : ''}
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${bars.length > 0 ? `
      <div class="section-title">3. Capital & Cost Structure Distribution</div>
      <div class="bars-box">
        <div class="bar-track">
          ${bars.map(b => `<div style="width:${Math.max(2, b.pct)}%;background:${b.color || '#0284c7'};height:100%;"></div>`).join('')}
        </div>
        <div class="bar-legend">
          ${bars.map(b => `<div><span class="dot" style="background:${b.color || '#0284c7'}"></span>${b.label}: <strong>${b.value}</strong> (${Number(b.pct).toFixed(1)}%)</div>`).join('')}
        </div>
      </div>
    ` : ''}

    ${tableHeaders.length > 0 && tableRows.length > 0 ? `
      <div class="section-title">4. Detailed Schedule & Quantitative Breakdown</div>
      <table>
        <thead>
          <tr>${tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${tableRows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    ` : ''}

    <div style="background:#f8fafc;border-left:3px solid #0284c7;padding:10px 14px;font-size:11px;color:#475569;border-radius:6px;">
      <strong>Analytical Note:</strong> ${notes}
    </div>

    <div class="footer">
      <div>© ${new Date().getFullYear()} SkandX Institutional Financial Terminal (www.skandx.in)</div>
      <div>Verified Computational Engine • Page 1 of 1</div>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 350);
    };
  </script>
</body>
</html>`;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  }, [activeCalcMeta, selectedCalcId]);

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

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <img
                src={logoImg}
                alt="SkandX"
                style={{
                  width: isMobile ? '28px' : '32px',
                  height: isMobile ? '28px' : '32px',
                  borderRadius: '8px',
                  objectFit: 'contain',
                  flexShrink: 0
                }}
              />
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
                    background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.25), rgba(37, 99, 235, 0.25))',
                    border: '1px solid rgba(56, 189, 248, 0.45)',
                    borderRadius: '8px',
                    padding: isMobile ? '6px 10px' : '7px 12px',
                    color: '#38bdf8',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                  title="Generate Institutional A4 PDF Report"
                >
                  <Printer size={13} />
                  <span>PDF Report</span>
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
            onRegisterReport={handleRegisterReport}
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
  calcId, calcMeta, viewMode, onToggleViewMode, onBackToCatalog, onDownloadCSV, onPrintPDF, onRegisterReport, onOpenPaperTrading, isMobile
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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

          <button
            onClick={onPrintPDF}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              background: 'rgba(2, 132, 199, 0.14)',
              color: '#38bdf8',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={14} />
            <span>Download PDF Report</span>
          </button>
        </div>
      </div>

      {/* Dynamic Calculator Specific View */}
      {calcId === 'sip' && (
        <SipCalculatorEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
          onRegisterReport={onRegisterReport}
          onOpenPaperTrading={onOpenPaperTrading}
        />
      )}
      {calcId === 'lumpsum' && (
        <LumpsumCalculatorEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
          onRegisterReport={onRegisterReport}
          onOpenPaperTrading={onOpenPaperTrading}
        />
      )}
      {calcId === 'mutual-funds' && (
        <MutualFundsCalculatorEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
          onRegisterReport={onRegisterReport}
          onOpenPaperTrading={onOpenPaperTrading}
        />
      )}
      {calcId === 'reducing-loan' && (
        <ReducingLoanCalculatorEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
          onRegisterReport={onRegisterReport}
        />
      )}
      {calcId === 'fixed-loan' && (
        <FixedLoanCalculatorEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
          onRegisterReport={onRegisterReport}
        />
      )}
      {calcId === 'average-price' && (
        <AverageSharePriceEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
          onRegisterReport={onRegisterReport}
          onOpenPaperTrading={onOpenPaperTrading}
        />
      )}
      {calcId === 'mtf' && (
        <MtfCalculatorEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
          onRegisterReport={onRegisterReport}
          onOpenPaperTrading={onOpenPaperTrading}
        />
      )}
      {calcId === 'brokerage' && (
        <BrokerageTaxEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
          onRegisterReport={onRegisterReport}
          onOpenPaperTrading={onOpenPaperTrading}
        />
      )}
      {calcId === 'position-size' && (
        <PositionSizerEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
          onRegisterReport={onRegisterReport}
          onOpenPaperTrading={onOpenPaperTrading}
        />
      )}
      {calcId === 'options-greeks' && (
        <OptionGreeksEngine 
          viewMode={viewMode} 
          onDownloadCSV={onDownloadCSV}
          onRegisterReport={onRegisterReport}
          onOpenPaperTrading={onOpenPaperTrading}
        />
      )}
    </div>
  );
}

// ============================================================================
// 1. REDUCING BALANCE LOAN EMI CALCULATOR (With Processing Charges, GST & Prepayment)
// ============================================================================
function ReducingLoanCalculatorEngine({ viewMode, onDownloadCSV, onRegisterReport }) {
  const [loanAmount, setLoanAmount] = useState(2500000);
  const [interestRate, setInterestRate] = useState(8.75); // % p.a.
  const [tenureYears, setTenureYears] = useState(20);
  // Processing & Bank Charges
  const [procFeeMode, setProcFeeMode] = useState('PCT'); // 'PCT' | 'FLAT'
  const [procFeePct, setProcFeePct] = useState(0.5); // % of loan amount
  const [procFeeFlat, setProcFeeFlat] = useState(12500); // ₹ flat
  const [includeGstOnFee, setIncludeGstOnFee] = useState(true); // 18% GST on processing & doc charges
  const [docLegalCharges, setDocLegalCharges] = useState(5000); // Legal / Valuation / MODT Stamp Duty (₹)
  const [insuranceCost, setInsuranceCost] = useState(0); // Optional Loan Protection Insurance (₹)
  const [monthlyPrepayment, setMonthlyPrepayment] = useState(0); // Optional extra monthly principal payment (₹)

  const math = useMemo(() => {
    const P = Math.max(1000, loanAmount);
    const n = Math.max(1, tenureYears * 12);
    const r = interestRate / 12 / 100;

    let emi = 0;
    if (r > 0 && n > 0) {
      emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    } else {
      emi = P / n;
    }

    // Upfront Processing, Legal/MODT & GST calculation
    const baseProcessingFee = procFeeMode === 'PCT' ? (P * (procFeePct / 100)) : procFeeFlat;
    const gstAmount = includeGstOnFee ? (baseProcessingFee + docLegalCharges) * 0.18 : 0;
    const totalProcessingAndCharges = Math.round(baseProcessingFee + gstAmount + docLegalCharges + insuranceCost);
    const netDisbursedAmount = Math.max(0, Math.round(P - totalProcessingAndCharges));

    // Standard full-tenure interest (without extra prepayment) for comparison
    const baselineTotalRepayment = emi * n;
    const baselineTotalInterest = Math.max(0, baselineTotalRepayment - P);

    // Month-by-month amortization (supports optional extra monthly prepayment)
    let balance = P;
    const schedule = [];
    let totalInterestActual = 0;
    let totalPrincipalActual = 0;
    let activeMonths = 0;

    for (let yr = 1; yr <= tenureYears; yr++) {
      if (balance <= 0.5) break;
      let yrPrincipal = 0;
      let yrInterest = 0;
      let yrEmiPaid = 0;
      for (let m = 1; m <= 12; m++) {
        if (balance <= 0.5) break;
        activeMonths++;
        const mInterest = balance * r;
        const scheduledPrincipal = Math.max(0, emi - mInterest);
        const desiredPrincipal = scheduledPrincipal + Math.max(0, monthlyPrepayment);
        const actualPrincipal = Math.min(balance, desiredPrincipal);
        const actualPayment = actualPrincipal + mInterest;

        balance = Math.max(0, balance - actualPrincipal);
        yrPrincipal += actualPrincipal;
        yrInterest += mInterest;
        yrEmiPaid += actualPayment;
        totalInterestActual += mInterest;
        totalPrincipalActual += actualPrincipal;
      }
      schedule.push({
        year: yr,
        emiPaid: Math.round(yrEmiPaid),
        principalPaid: Math.round(yrPrincipal),
        interestPaid: Math.round(yrInterest),
        balance: Math.round(balance)
      });
    }

    const totalLoanRepayment = P + totalInterestActual;
    const totalAllInOutflow = totalLoanRepayment + totalProcessingAndCharges;
    const interestSaved = Math.max(0, Math.round(baselineTotalInterest - totalInterestActual));
    const monthsSaved = Math.max(0, n - activeMonths);

    // Effective All-In APR approximation factoring upfront processing & legal charges
    const feeDragAnnualPct = tenureYears > 0 ? ((totalProcessingAndCharges / P) * 100) / (tenureYears * 0.6) : 0;
    const effectiveAllInApr = (interestRate + feeDragAnnualPct).toFixed(2);

    const principalPct = totalAllInOutflow > 0 ? ((P / totalAllInOutflow) * 100) : 0;
    const interestPct = totalAllInOutflow > 0 ? ((totalInterestActual / totalAllInOutflow) * 100) : 0;
    const chargesPct = Math.max(0, 100 - principalPct - interestPct);

    return {
      emi: Math.round(emi),
      baseProcessingFee: Math.round(baseProcessingFee),
      gstAmount: Math.round(gstAmount),
      totalProcessingAndCharges,
      netDisbursedAmount,
      totalInterest: Math.round(totalInterestActual),
      totalRepayment: Math.round(totalLoanRepayment),
      totalAllInOutflow: Math.round(totalAllInOutflow),
      effectiveAllInApr,
      interestSaved,
      monthsSaved,
      activeMonths,
      schedule,
      principalRatio: principalPct.toFixed(1),
      interestRatio: interestPct.toFixed(1),
      chargesRatio: chargesPct.toFixed(1)
    };
  }, [loanAmount, interestRate, tenureYears, procFeeMode, procFeePct, procFeeFlat, includeGstOnFee, docLegalCharges, insuranceCost, monthlyPrepayment]);

  useEffect(() => {
    if (!onRegisterReport) return;
    onRegisterReport({
      title: 'Reducing Balance Loan EMI & Processing Charges Report',
      subtitle: 'Monthly reducing principal amortization, processing fees, 18% GST, net disbursement & effective APR',
      inputs: [
        { label: 'Sanctioned Loan Amount', value: `₹${loanAmount.toLocaleString('en-IN')}` },
        { label: 'Reducing Interest Rate', value: `${interestRate}% p.a.` },
        { label: 'Loan Tenure', value: `${tenureYears} Years (${tenureYears * 12} Months)` },
        { label: 'Processing Fee', value: procFeeMode === 'PCT' ? `${procFeePct}% (₹${math.baseProcessingFee.toLocaleString('en-IN')})` : `₹${math.baseProcessingFee.toLocaleString('en-IN')} Flat` },
        { label: 'Legal / MODT + Insurance', value: `₹${(docLegalCharges + insuranceCost).toLocaleString('en-IN')}${includeGstOnFee ? ` (+₹${math.gstAmount.toLocaleString('en-IN')} GST)` : ''}` },
        { label: 'Net Disbursed in Hand', value: `₹${math.netDisbursedAmount.toLocaleString('en-IN')}` }
      ],
      kpis: [
        { label: 'Monthly EMI', value: `₹${math.emi.toLocaleString('en-IN')}`, sub: monthlyPrepayment > 0 ? `+₹${monthlyPrepayment.toLocaleString('en-IN')}/mo prepayment` : 'Fixed monthly installment', color: '#8b5cf6' },
        { label: 'Net Disbursed (In-Hand)', value: `₹${math.netDisbursedAmount.toLocaleString('en-IN')}`, sub: `Upfront Fees: ₹${math.totalProcessingAndCharges.toLocaleString('en-IN')}`, color: '#0284c7' },
        { label: 'Total Interest Payable', value: `₹${math.totalInterest.toLocaleString('en-IN')}`, sub: math.interestSaved > 0 ? `Saved ₹${math.interestSaved.toLocaleString('en-IN')} (${math.monthsSaved} mos)` : `${math.interestRatio}% of total outflow`, color: '#ef4444' },
        { label: 'Total All-In Outflow', value: `₹${math.totalAllInOutflow.toLocaleString('en-IN')}`, sub: `All-In Effective APR: ${math.effectiveAllInApr}%`, color: '#10b981' }
      ],
      bars: [
        { label: 'Principal Repaid', value: `₹${loanAmount.toLocaleString('en-IN')}`, pct: Number(math.principalRatio), color: '#0284c7' },
        { label: 'Total Interest Paid', value: `₹${math.totalInterest.toLocaleString('en-IN')}`, pct: Number(math.interestRatio), color: '#ef4444' },
        { label: 'Processing, GST & Bank Charges', value: `₹${math.totalProcessingAndCharges.toLocaleString('en-IN')}`, pct: Number(math.chargesRatio), color: '#f59e0b' }
      ],
      tableHeaders: ['Year', 'Annual Outflow (₹)', 'Principal Repaid (₹)', 'Interest Paid (₹)', 'Closing Balance (₹)'],
      tableRows: math.schedule.map(r => [
        `Year ${r.year}`,
        `₹${r.emiPaid.toLocaleString('en-IN')}`,
        `₹${r.principalPaid.toLocaleString('en-IN')}`,
        `₹${r.interestPaid.toLocaleString('en-IN')}`,
        `₹${r.balance.toLocaleString('en-IN')}`
      ]),
      notes: `Upfront processing fee (₹${math.baseProcessingFee.toLocaleString('en-IN')}), legal/MODT charges (₹${docLegalCharges.toLocaleString('en-IN')}), insurance (₹${insuranceCost.toLocaleString('en-IN')}), and 18% GST (₹${math.gstAmount.toLocaleString('en-IN')}) total ₹${math.totalProcessingAndCharges.toLocaleString('en-IN')}, resulting in a net disbursement of ₹${math.netDisbursedAmount.toLocaleString('en-IN')} and an all-inclusive effective APR of ${math.effectiveAllInApr}% p.a.`
    });
  }, [loanAmount, interestRate, tenureYears, procFeeMode, procFeePct, docLegalCharges, insuranceCost, includeGstOnFee, monthlyPrepayment, math, onRegisterReport]);

  const handleExport = () => {
    const headers = ['Year', 'Annual EMI Paid (₹)', 'Principal Repaid (₹)', 'Interest Paid (₹)', 'Remaining Balance (₹)'];
    const summaryRows = [
      ['Sanctioned Loan', loanAmount, 'Processing & Bank Charges (incl GST)', math.totalProcessingAndCharges, `Net Disbursed: ${math.netDisbursedAmount}`],
      ['Quoted Interest Rate', `${interestRate}%`, 'All-In Effective APR', `${math.effectiveAllInApr}%`, `Total All-In Outflow: ${math.totalAllInOutflow}`],
      ...math.schedule.map(row => [row.year, row.emiPaid, row.principalPaid, row.interestPaid, row.balance])
    ];
    onDownloadCSV(`reducing_loan_emi_${loanAmount}`, headers, summaryRows);
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
        gap: '20px'
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
            style={{ width: '100%', accentColor: '#8b5cf6', marginTop: '10px' }}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
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
            style={{ width: '100%', accentColor: '#8b5cf6', marginTop: '10px' }}
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
            style={{ width: '100%', accentColor: '#8b5cf6', marginTop: '10px' }}
          />
        </div>

        {/* ── Processing Fee, 18% GST & Bank Charges Box ── */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.28)',
          border: '1px solid rgba(245, 158, 11, 0.28)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🏦 Processing Fee & Bank Charges
            </span>
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.06)', padding: '2px', borderRadius: '6px' }}>
              <button
                type="button"
                onClick={() => setProcFeeMode('PCT')}
                style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: procFeeMode === 'PCT' ? '#f59e0b' : 'transparent', color: procFeeMode === 'PCT' ? '#000' : '#94a3b8', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
              >
                % of Loan
              </button>
              <button
                type="button"
                onClick={() => setProcFeeMode('FLAT')}
                style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: procFeeMode === 'FLAT' ? '#f59e0b' : 'transparent', color: procFeeMode === 'FLAT' ? '#000' : '#94a3b8', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
              >
                Flat ₹
              </button>
            </div>
          </div>

          {procFeeMode === 'PCT' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1' }}>
                <span>Processing Fee (%)</span>
                <strong style={{ color: '#fbbf24' }}>{procFeePct}% (₹{math.baseProcessingFee.toLocaleString('en-IN')})</strong>
              </div>
              <input
                type="range" min="0" max="3" step="0.1"
                value={procFeePct} onChange={e => setProcFeePct(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#f59e0b', marginTop: '6px' }}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Flat Processing Fee (₹)</span>
              <input
                type="number" step="500"
                value={procFeeFlat} onChange={e => setProcFeeFlat(Math.max(0, Number(e.target.value)))}
                style={{ width: '100px', padding: '5px 8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fbbf24', fontSize: '13px', fontWeight: '700', textAlign: 'right' }}
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Legal / Doc / MODT (₹)</label>
              <input
                type="number" step="500"
                value={docLegalCharges} onChange={e => setDocLegalCharges(Math.max(0, Number(e.target.value)))}
                style={{ width: '100%', padding: '6px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12.5px', fontWeight: '700', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Loan Insurance (₹)</label>
              <input
                type="number" step="1000"
                value={insuranceCost} onChange={e => setInsuranceCost(Math.max(0, Number(e.target.value)))}
                style={{ width: '100%', padding: '6px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12.5px', fontWeight: '700', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeGstOnFee}
                onChange={e => setIncludeGstOnFee(e.target.checked)}
                style={{ accentColor: '#f59e0b' }}
              />
              <span>Add 18% GST on Fees (₹{math.gstAmount.toLocaleString('en-IN')})</span>
            </label>
            <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#f59e0b' }}>
              Total Fee: ₹{math.totalProcessingAndCharges.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Optional Extra Monthly Prepayment */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '12.5px', color: '#34d399', fontWeight: '700' }}>⚡ Extra Monthly Prepayment (Optional)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.25)' }}>
              <span style={{ color: '#34d399', fontWeight: '700', fontSize: '12px' }}>+₹</span>
              <input
                type="number" step="1000"
                value={monthlyPrepayment}
                onChange={e => setMonthlyPrepayment(Math.max(0, Number(e.target.value)))}
                style={{ width: '75px', background: 'transparent', border: 'none', color: '#34d399', fontSize: '13.5px', fontWeight: '800', outline: 'none' }}
              />
            </div>
          </div>
          <input
            type="range" min="0" max="50000" step="1000"
            value={monthlyPrepayment} onChange={e => setMonthlyPrepayment(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#10b981', marginTop: '8px' }}
          />
          {math.interestSaved > 0 && (
            <div style={{ marginTop: '6px', fontSize: '11.5px', color: '#34d399', fontWeight: '600' }}>
              ✓ Saves <strong>₹{math.interestSaved.toLocaleString('en-IN')}</strong> in interest & closes loan <strong>{math.monthsSaved} months</strong> early!
            </div>
          )}
        </div>

        <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#c4b5fd', lineHeight: '1.4' }}>
          💡 <strong>Reducing Balance + Processing Charges:</strong> Banks deduct Processing Fee + 18% GST + Legal/MODT upfront, so your <strong>Net Disbursed in Hand is ₹{math.netDisbursedAmount.toLocaleString('en-IN')}</strong> (All-In Effective APR: <strong>{math.effectiveAllInApr}%</strong>).
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Monthly EMI Repayment
                </div>
                <div style={{ fontSize: '36px', fontWeight: '900', color: '#8b5cf6', margin: '4px 0 12px' }}>
                  ₹{math.emi.toLocaleString('en-IN')} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: '500' }}>/ month</span>
                </div>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '8px 12px', textAlign: 'right' }}>
                <div style={{ fontSize: '10.5px', color: '#fbbf24', fontWeight: '700', textTransform: 'uppercase' }}>All-In Effective APR</div>
                <div style={{ fontSize: '18px', fontWeight: '900', color: '#f59e0b' }}>{math.effectiveAllInApr}% p.a.</div>
              </div>
            </div>

            {/* Results Grid (6 comprehensive cards) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '600' }}>Sanctioned Loan</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                  ₹{loanAmount.toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: '600' }}>Processing & Charges</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#fbbf24', marginTop: '2px' }}>
                  ₹{math.totalProcessingAndCharges.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                  Fee ₹{math.baseProcessingFee.toLocaleString('en-IN')} + GST ₹{math.gstAmount.toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.3)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#7dd3fc', fontWeight: '600' }}>Net Disbursed in Hand</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#38bdf8', marginTop: '2px' }}>
                  ₹{math.netDisbursedAmount.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                  Credited after upfront fees
                </div>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#fca5a5', fontWeight: '600' }}>Total Interest</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                  ₹{math.totalInterest.toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#c4b5fd', fontWeight: '600' }}>Loan Repayment (P+I)</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                  ₹{math.totalRepayment.toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#86efac', fontWeight: '600' }}>Total All-In Outflow</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
                  ₹{math.totalAllInOutflow.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                  Principal + Interest + Fees
                </div>
              </div>
            </div>

            {/* SVG Visual Donut Chart (Principal vs Interest vs Processing Charges) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '20px', margin: '12px 0' }}>
              <svg width="175" height="175" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#0284c7" strokeWidth="6" />
                <circle 
                  cx="21" cy="21" r="15.91549430918954" fill="transparent" 
                  stroke="#ef4444" strokeWidth="6" 
                  strokeDasharray={`${math.interestRatio} ${100 - Number(math.interestRatio)}`}
                  strokeDashoffset="25"
                />
                {Number(math.chargesRatio) > 0 && (
                  <circle 
                    cx="21" cy="21" r="15.91549430918954" fill="transparent" 
                    stroke="#f59e0b" strokeWidth="6" 
                    strokeDasharray={`${math.chargesRatio} ${100 - Number(math.chargesRatio)}`}
                    strokeDashoffset={`${25 - Number(math.interestRatio)}`}
                  />
                )}
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#0284c7' }} />
                  <span style={{ fontSize: '12.5px', color: '#cbd5e1' }}>Principal: {math.principalRatio}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ef4444' }} />
                  <span style={{ fontSize: '12.5px', color: '#cbd5e1' }}>Interest: {math.interestRatio}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f59e0b' }} />
                  <span style={{ fontSize: '12.5px', color: '#fbbf24' }}>Processing & Charges: {math.chargesRatio}%</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '460px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', fontSize: '12px', color: '#cbd5e1', background: 'rgba(245, 158, 11, 0.08)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <span>Upfront Charges (incl. GST): <strong style={{ color: '#fbbf24' }}>₹{math.totalProcessingAndCharges.toLocaleString('en-IN')}</strong></span>
              <span>Net Disbursed: <strong style={{ color: '#38bdf8' }}>₹{math.netDisbursedAmount.toLocaleString('en-IN')}</strong></span>
            </div>
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
            <span>Export Amortization & Charges Schedule (CSV)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. FIXED / FLAT RATE LOAN CALCULATOR (With Processing Charges, File Fee & GST)
// ============================================================================
function FixedLoanCalculatorEngine({ viewMode, onDownloadCSV, onRegisterReport }) {
  const [loanAmount, setLoanAmount] = useState(500000);
  const [flatRate, setFlatRate] = useState(10.0); // % p.a.
  const [tenureYears, setTenureYears] = useState(3);
  const [procFeeMode, setProcFeeMode] = useState('PCT'); // 'PCT' | 'FLAT'
  const [procFeePct, setProcFeePct] = useState(1.5); // % of loan
  const [procFeeFlat, setProcFeeFlat] = useState(7500); // ₹ flat
  const [fileDocCharges, setFileDocCharges] = useState(2500); // File / Stamp Duty / Documentation (₹)
  const [includeGstOnFee, setIncludeGstOnFee] = useState(true); // 18% GST on fees

  const math = useMemo(() => {
    const P = Math.max(1000, loanAmount);
    const T = Math.max(1, tenureYears);
    const n = T * 12;

    const totalInterest = P * (flatRate / 100) * T;
    const totalRepayment = P + totalInterest;
    const emi = totalRepayment / n;
    const effectiveAprNum = n > 0 ? (flatRate * ((2 * n) / (n + 1))) : flatRate;

    const baseProcessingFee = procFeeMode === 'PCT' ? P * (procFeePct / 100) : procFeeFlat;
    const gstAmount = includeGstOnFee ? (baseProcessingFee + fileDocCharges) * 0.18 : 0;
    const totalProcessingAndCharges = Math.round(baseProcessingFee + fileDocCharges + gstAmount);
    const netDisbursedAmount = Math.max(0, Math.round(P - totalProcessingAndCharges));
    const totalAllInOutflow = Math.round(totalRepayment + totalProcessingAndCharges);

    const feeAprBoost = T > 0 ? ((totalProcessingAndCharges / P) * 100) / (T * 0.55) : 0;
    const allInEffectiveApr = (effectiveAprNum + feeAprBoost).toFixed(2);

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

    const principalPct = totalAllInOutflow > 0 ? (P / totalAllInOutflow) * 100 : 0;
    const interestPct = totalAllInOutflow > 0 ? (totalInterest / totalAllInOutflow) * 100 : 0;
    const chargesPct = Math.max(0, 100 - principalPct - interestPct);

    return {
      emi: Math.round(emi),
      baseProcessingFee: Math.round(baseProcessingFee),
      gstAmount: Math.round(gstAmount),
      totalProcessingAndCharges,
      netDisbursedAmount,
      totalInterest: Math.round(totalInterest),
      totalRepayment: Math.round(totalRepayment),
      totalAllInOutflow,
      effectiveApr: effectiveAprNum.toFixed(2),
      allInEffectiveApr,
      schedule,
      principalRatio: principalPct.toFixed(1),
      interestRatio: interestPct.toFixed(1),
      chargesRatio: chargesPct.toFixed(1)
    };
  }, [loanAmount, flatRate, tenureYears, procFeeMode, procFeePct, procFeeFlat, fileDocCharges, includeGstOnFee]);

  useEffect(() => {
    if (!onRegisterReport) return;
    onRegisterReport({
      title: 'Fixed / Flat Rate Loan EMI & Processing Charges Report',
      subtitle: 'Flat interest vs True Effective Reducing APR comparison, processing fees & yearly repayment schedule',
      inputs: [
        { label: 'Sanctioned Loan Amount', value: `₹${loanAmount.toLocaleString('en-IN')}` },
        { label: 'Quoted Flat Rate', value: `${flatRate}% p.a.` },
        { label: 'Loan Tenure', value: `${tenureYears} Years (${tenureYears * 12} Months)` },
        { label: 'Processing & File Charges', value: `₹${math.totalProcessingAndCharges.toLocaleString('en-IN')} (incl. GST)` },
        { label: 'Net Disbursed in Hand', value: `₹${math.netDisbursedAmount.toLocaleString('en-IN')}` },
        { label: 'All-In Effective APR', value: `${math.allInEffectiveApr}% p.a.` }
      ],
      kpis: [
        { label: 'Monthly EMI', value: `₹${math.emi.toLocaleString('en-IN')}`, sub: 'Fixed monthly installment', color: '#ec4899' },
        { label: 'Net Disbursed (In-Hand)', value: `₹${math.netDisbursedAmount.toLocaleString('en-IN')}`, sub: `Upfront Fees: ₹${math.totalProcessingAndCharges.toLocaleString('en-IN')}`, color: '#0284c7' },
        { label: 'Flat Interest Total', value: `₹${math.totalInterest.toLocaleString('en-IN')}`, sub: `${math.interestRatio}% of total outflow`, color: '#ef4444' },
        { label: 'Total All-In Outflow', value: `₹${math.totalAllInOutflow.toLocaleString('en-IN')}`, sub: `All-In APR: ${math.allInEffectiveApr}%`, color: '#10b981' }
      ],
      bars: [
        { label: 'Principal Amount', value: `₹${loanAmount.toLocaleString('en-IN')}`, pct: Number(math.principalRatio), color: '#0284c7' },
        { label: 'Flat Interest', value: `₹${math.totalInterest.toLocaleString('en-IN')}`, pct: Number(math.interestRatio), color: '#ec4899' },
        { label: 'Processing & File Charges', value: `₹${math.totalProcessingAndCharges.toLocaleString('en-IN')}`, pct: Number(math.chargesRatio), color: '#f59e0b' }
      ],
      tableHeaders: ['Year', 'Annual EMI Outflow (₹)', 'Principal Repaid (₹)', 'Flat Interest Paid (₹)', 'Remaining Payable (₹)'],
      tableRows: math.schedule.map(r => [
        `Year ${r.year}`,
        `₹${r.annualPaid.toLocaleString('en-IN')}`,
        `₹${r.principalPaid.toLocaleString('en-IN')}`,
        `₹${r.interestPaid.toLocaleString('en-IN')}`,
        `₹${r.remainingCost.toLocaleString('en-IN')}`
      ]),
      notes: `A quoted flat interest rate of ${flatRate}% p.a. equals ~${math.effectiveApr}% reducing APR, and after factoring upfront processing & file charges of ₹${math.totalProcessingAndCharges.toLocaleString('en-IN')}, your true All-In APR is ~${math.allInEffectiveApr}% p.a.`
    });
  }, [loanAmount, flatRate, tenureYears, math, onRegisterReport]);

  const handleExport = () => {
    const headers = ['Year', 'Annual EMI (₹)', 'Principal Repaid (₹)', 'Flat Interest Paid (₹)', 'Remaining Total Repayment (₹)'];
    const rows = [
      ['Sanctioned Loan', loanAmount, 'Processing & File Charges (incl GST)', math.totalProcessingAndCharges, `Net Disbursed: ${math.netDisbursedAmount}`],
      ['Quoted Flat Rate', `${flatRate}%`, 'All-In Effective APR', `${math.allInEffectiveApr}%`, `Total Outflow: ${math.totalAllInOutflow}`],
      ...math.schedule.map(row => [row.year, row.annualPaid, row.principalPaid, row.interestPaid, row.remainingCost])
    ];
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
        gap: '20px'
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
            style={{ width: '100%', accentColor: '#ec4899', marginTop: '10px' }}
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
            style={{ width: '100%', accentColor: '#ec4899', marginTop: '10px' }}
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
            style={{ width: '100%', accentColor: '#ec4899', marginTop: '10px' }}
          />
        </div>

        {/* ── Processing Fee, File Charges & 18% GST Box ── */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.28)',
          border: '1px solid rgba(245, 158, 11, 0.28)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🏦 Processing & File Charges
            </span>
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.06)', padding: '2px', borderRadius: '6px' }}>
              <button
                type="button"
                onClick={() => setProcFeeMode('PCT')}
                style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: procFeeMode === 'PCT' ? '#f59e0b' : 'transparent', color: procFeeMode === 'PCT' ? '#000' : '#94a3b8', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
              >
                % of Loan
              </button>
              <button
                type="button"
                onClick={() => setProcFeeMode('FLAT')}
                style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: procFeeMode === 'FLAT' ? '#f59e0b' : 'transparent', color: procFeeMode === 'FLAT' ? '#000' : '#94a3b8', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
              >
                Flat ₹
              </button>
            </div>
          </div>

          {procFeeMode === 'PCT' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1' }}>
                <span>Processing Fee (%)</span>
                <strong style={{ color: '#fbbf24' }}>{procFeePct}% (₹{math.baseProcessingFee.toLocaleString('en-IN')})</strong>
              </div>
              <input
                type="range" min="0" max="5" step="0.25"
                value={procFeePct} onChange={e => setProcFeePct(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#f59e0b', marginTop: '6px' }}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Flat Processing Fee (₹)</span>
              <input
                type="number" step="500"
                value={procFeeFlat} onChange={e => setProcFeeFlat(Math.max(0, Number(e.target.value)))}
                style={{ width: '100px', padding: '5px 8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fbbf24', fontSize: '13px', fontWeight: '700', textAlign: 'right' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '11.5px', color: '#94a3b8' }}>File / Stamp Duty Charges (₹)</label>
            <input
              type="number" step="500"
              value={fileDocCharges} onChange={e => setFileDocCharges(Math.max(0, Number(e.target.value)))}
              style={{ width: '100px', padding: '5px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12.5px', fontWeight: '700', textAlign: 'right' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeGstOnFee}
                onChange={e => setIncludeGstOnFee(e.target.checked)}
                style={{ accentColor: '#f59e0b' }}
              />
              <span>Add 18% GST on Fees (₹{math.gstAmount.toLocaleString('en-IN')})</span>
            </label>
            <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#f59e0b' }}>
              Total Fee: ₹{math.totalProcessingAndCharges.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Warning Callout about Flat vs Effective APR */}
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontSize: '13px', fontWeight: '700' }}>
            <AlertCircle size={15} />
            <span>Hidden APR Trap Detector</span>
          </div>
          <div style={{ fontSize: '12px', color: '#fca5a5', marginTop: '4px', lineHeight: '1.45' }}>
            A <strong>{flatRate}% flat rate</strong> equals <strong>~{math.effectiveApr}% reducing APR</strong>, and once you include <strong>₹{math.totalProcessingAndCharges.toLocaleString('en-IN')}</strong> in processing & file fees, your <strong>All-In Effective APR jumps to ~{math.allInEffectiveApr}%</strong>!
          </div>
        </div>
      </div>

      {/* Results Panel (Supports CHART and TABLE modes) */}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Monthly EMI
                </div>
                <div style={{ fontSize: '36px', fontWeight: '900', color: '#ec4899', margin: '4px 0 14px' }}>
                  ₹{math.emi.toLocaleString('en-IN')} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: '500' }}>/ month</span>
                </div>
              </div>
              <div style={{ background: 'rgba(236, 72, 153, 0.12)', border: '1px solid rgba(236, 72, 153, 0.3)', borderRadius: '10px', padding: '8px 12px', textAlign: 'right' }}>
                <div style={{ fontSize: '10.5px', color: '#f472b6', fontWeight: '700', textTransform: 'uppercase' }}>All-In True APR</div>
                <div style={{ fontSize: '18px', fontWeight: '900', color: '#f472b6' }}>{math.allInEffectiveApr}% p.a.</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '600' }}>Sanctioned Loan</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                  ₹{loanAmount.toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: '600' }}>Processing & File Fee</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#fbbf24', marginTop: '2px' }}>
                  ₹{math.totalProcessingAndCharges.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                  Incl. ₹{math.gstAmount.toLocaleString('en-IN')} GST
                </div>
              </div>
              <div style={{ background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.3)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#7dd3fc', fontWeight: '600' }}>Net Disbursed in Hand</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#38bdf8', marginTop: '2px' }}>
                  ₹{math.netDisbursedAmount.toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#fca5a5', fontWeight: '600' }}>Flat Interest Total</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                  ₹{math.totalInterest.toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ background: 'rgba(236, 72, 153, 0.08)', border: '1px solid rgba(236, 72, 153, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#f472b6', fontWeight: '600' }}>Base Reducing APR</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#f472b6', marginTop: '2px' }}>
                  {math.effectiveApr}% p.a.
                </div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#86efac', fontWeight: '600' }}>Total All-In Outflow</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
                  ₹{math.totalAllInOutflow.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Donut Chart */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '20px', margin: '12px 0' }}>
              <svg width="175" height="175" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#0284c7" strokeWidth="6" />
                <circle 
                  cx="21" cy="21" r="15.91549430918954" fill="transparent" 
                  stroke="#ec4899" strokeWidth="6" 
                  strokeDasharray={`${math.interestRatio} ${100 - Number(math.interestRatio)}`}
                  strokeDashoffset="25"
                />
                {Number(math.chargesRatio) > 0 && (
                  <circle 
                    cx="21" cy="21" r="15.91549430918954" fill="transparent" 
                    stroke="#f59e0b" strokeWidth="6" 
                    strokeDasharray={`${math.chargesRatio} ${100 - Number(math.chargesRatio)}`}
                    strokeDashoffset={`${25 - Number(math.interestRatio)}`}
                  />
                )}
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#0284c7' }} />
                  <span style={{ fontSize: '12.5px', color: '#cbd5e1' }}>Principal: {math.principalRatio}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ec4899' }} />
                  <span style={{ fontSize: '12.5px', color: '#cbd5e1' }}>Flat Interest: {math.interestRatio}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f59e0b' }} />
                  <span style={{ fontSize: '12.5px', color: '#fbbf24' }}>Processing & Charges: {math.chargesRatio}%</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#f472b6', marginBottom: '10px' }}>
              Annual Flat-Rate Loan Amortization Schedule ({tenureYears} Years)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Year</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Annual EMI</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Principal</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Flat Interest</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Remaining Payable</th>
                </tr>
              </thead>
              <tbody>
                {math.schedule.map(row => (
                  <tr key={row.year} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px', fontWeight: '700' }}>Yr {row.year}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#cbd5e1' }}>₹{row.annualPaid.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#38bdf8' }}>₹{row.principalPaid.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#f472b6' }}>₹{row.interestPaid.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#f8fafc' }}>₹{row.remainingCost.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          onClick={handleExport}
          style={{
            marginTop: '20px',
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
          <span>Export Flat Loan & Charges Summary (CSV)</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 3. AVERAGE SHARE PRICE CALCULATOR (With Delivery Brokerage, STT & DP Charges)
// ============================================================================
function AverageSharePriceEngine({ viewMode, onDownloadCSV, onRegisterReport, onOpenPaperTrading }) {
  const [tranches, setTranches] = useState([
    { id: 1, price: 2450, qty: 50 },
    { id: 2, price: 2320, qty: 75 },
    { id: 3, price: 2180, qty: 100 }
  ]);
  const [targetGainPct, setTargetGainPct] = useState(15);
  const [includeDeliveryTaxes, setIncludeDeliveryTaxes] = useState(true); // Statutory 0.1% STT + Stamp + Exchange + GST
  const [brokeragePerOrder, setBrokeragePerOrder] = useState(0); // ₹0 (Discount) or ₹20/order
  const [dpChargeOnSell, setDpChargeOnSell] = useState(15.93); // Depository Participant CDSL/NSDL charge incl. 18% GST

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
        runningQty: totalQty,
        runningAvg: totalQty > 0 ? (totalInvestment / totalQty).toFixed(2) : '0'
      };
    });

    const avgPrice = totalQty > 0 ? totalInvestment / totalQty : 0;
    const grossSellValue = totalInvestment * (1 + targetGainPct / 100);
    const targetSellPrice = avgPrice * (1 + targetGainPct / 100);
    const grossProfitAmount = grossSellValue - totalInvestment;

    // Calculate Buy + Sell Delivery Charges & Processing Fees
    const totalOrders = tranches.length + 1; // N buy lots + 1 exit order
    const totalBrokerage = brokeragePerOrder * totalOrders;
    const sttBuyAndSell = includeDeliveryTaxes ? (totalInvestment + grossSellValue) * 0.001 : 0; // 0.1% STT on delivery buy & sell
    const stampDutyBuy = includeDeliveryTaxes ? totalInvestment * 0.00015 : 0; // 0.015% on delivery buy
    const exchAndSebi = includeDeliveryTaxes ? (totalInvestment + grossSellValue) * 0.0000335 : 0;
    const gstOnFees = includeDeliveryTaxes ? (totalBrokerage + exchAndSebi) * 0.18 : 0;
    const dpCharge = includeDeliveryTaxes ? dpChargeOnSell : 0;

    const totalCharges = totalBrokerage + sttBuyAndSell + stampDutyBuy + exchAndSebi + gstOnFees + dpCharge;
    const netBreakevenPrice = totalQty > 0 ? (totalInvestment + totalCharges) / totalQty : avgPrice;
    const netProfitAfterCharges = grossProfitAmount - totalCharges;

    return {
      totalQty,
      totalInvestment,
      avgPrice: avgPrice.toFixed(2),
      netBreakevenPrice: netBreakevenPrice.toFixed(2),
      targetSellPrice: targetSellPrice.toFixed(2),
      grossProfitAmount: Math.round(grossProfitAmount),
      totalCharges: Math.round(totalCharges),
      targetProfitAmount: Math.round(netProfitAfterCharges),
      list: list.map(item => ({
        ...item,
        weightPct: totalInvestment > 0 ? ((item.cost / totalInvestment) * 100).toFixed(1) : '0.0'
      }))
    };
  }, [tranches, targetGainPct, includeDeliveryTaxes, brokeragePerOrder, dpChargeOnSell]);

  useEffect(() => {
    if (!onRegisterReport) return;
    const palette = ['#0284c7', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];
    onRegisterReport({
      title: 'Stock Average Share Price, Breakeven & Charges Report',
      subtitle: 'Multi-lot equity accumulation cost-basis, delivery STT/DP charges & target exit calculation',
      inputs: [
        { label: 'Total Buy Tranches', value: `${tranches.length} Lots` },
        { label: 'Total Quantity Accumulated', value: `${math.totalQty.toLocaleString('en-IN')} Shares` },
        { label: 'Total Capital Deployed', value: `₹${math.totalInvestment.toLocaleString('en-IN')}` },
        { label: 'Delivery Taxes, STT & DP Fee', value: `₹${math.totalCharges.toLocaleString('en-IN')}` },
        { label: 'Target Profit Goal', value: `+${targetGainPct}%` }
      ],
      kpis: [
        { label: 'Weighted Avg Price', value: `₹${Number(math.avgPrice).toLocaleString('en-IN')}`, sub: `Net Breakeven: ₹${Number(math.netBreakevenPrice).toLocaleString('en-IN')}`, color: '#f59e0b' },
        { label: 'Total Capital Invested', value: `₹${math.totalInvestment.toLocaleString('en-IN')}`, sub: `Charges: ₹${math.totalCharges.toLocaleString('en-IN')}`, color: '#0284c7' },
        { label: `Target Exit (+${targetGainPct}%)`, value: `₹${Number(math.targetSellPrice).toLocaleString('en-IN')}`, sub: 'Required sell price/share', color: '#10b981' },
        { label: 'Net Profit (After Charges)', value: `+₹${math.targetProfitAmount.toLocaleString('en-IN')}`, sub: `Gross: +₹${math.grossProfitAmount.toLocaleString('en-IN')}`, color: '#10b981' }
      ],
      bars: math.list.map((t, idx) => ({
        label: `Lot #${idx + 1} (₹${t.price} × ${t.qty})`,
        value: `₹${t.cost.toLocaleString('en-IN')}`,
        pct: Number(t.weightPct),
        color: palette[idx % palette.length]
      })),
      tableHeaders: ['Tranche', 'Buy Price (₹)', 'Quantity', 'Tranche Cost (₹)', 'Capital Weight', 'Cumulative Avg (₹)'],
      tableRows: math.list.map((t, idx) => [
        `Lot #${idx + 1}`,
        `₹${t.price.toLocaleString('en-IN')}`,
        `${t.qty.toLocaleString('en-IN')}`,
        `₹${t.cost.toLocaleString('en-IN')}`,
        `${t.weightPct}%`,
        `₹${Number(t.runningAvg).toLocaleString('en-IN')}`
      ]),
      notes: `Weighted average share price is ₹${math.avgPrice}, and after factoring ₹${math.totalCharges.toLocaleString('en-IN')} in delivery STT (0.1%), stamp duty, brokerage & DP charges, your true net breakeven is ₹${math.netBreakevenPrice}/share.`
    });
  }, [tranches, targetGainPct, math, onRegisterReport]);

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
    const headers = ['Tranche #', 'Purchase Price (₹)', 'Shares Bought', 'Total Tranche Cost (₹)', 'Capital Weight (%)', 'Cumulative Avg (₹)'];
    const rows = [
      ...math.list.map((t, idx) => [idx + 1, t.price, t.qty, t.cost, t.weightPct, t.runningAvg]),
      ['SUMMARY', `Weighted Avg: ${math.avgPrice}`, `Total Qty: ${math.totalQty}`, `Invested: ${math.totalInvestment}`, `Charges: ${math.totalCharges}`, `Net Breakeven: ${math.netBreakevenPrice}`]
    ];
    onDownloadCSV('average_share_price_calculation', headers, rows);
  };

  const lotColors = ['#38bdf8', '#f59e0b', '#10b981', '#a855f7', '#ec4899', '#06b6d4'];

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
        gap: '16px'
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
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
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

        {/* Delivery Brokerage, STT & DP Charges Box */}
        <div style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#fbbf24', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeDeliveryTaxes}
                onChange={e => setIncludeDeliveryTaxes(e.target.checked)}
                style={{ accentColor: '#f59e0b' }}
              />
              <span>Include STT (0.1%), Stamp & DP Charges</span>
            </label>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#f87171' }}>
              ₹{math.totalCharges.toLocaleString('en-IN')}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '10.5px', color: '#94a3b8' }}>Brokerage / Order (₹)</label>
              <input
                type="number" step="5"
                value={brokeragePerOrder}
                onChange={e => setBrokeragePerOrder(Math.max(0, Number(e.target.value)))}
                style={{ width: '100%', padding: '5px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: '700', marginTop: '2px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10.5px', color: '#94a3b8' }}>DP Exit Charge (₹)</label>
              <input
                type="number" step="1"
                value={dpChargeOnSell}
                onChange={e => setDpChargeOnSell(Math.max(0, Number(e.target.value)))}
                style={{ width: '100%', padding: '5px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: '700', marginTop: '2px', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Weighted Average Results Panel (Supports CHART vs TABLE modes) */}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Weighted Average Purchase Price
                </span>
                <div style={{ fontSize: '36px', fontWeight: '900', color: '#f59e0b', margin: '4px 0 14px' }}>
                  ₹{Number(math.avgPrice).toLocaleString('en-IN')} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: '500' }}>/ share</span>
                </div>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '8px 12px', textAlign: 'right' }}>
                <div style={{ fontSize: '10.5px', color: '#fbbf24', fontWeight: '700', textTransform: 'uppercase' }}>Net Breakeven (Incl. Charges)</div>
                <div style={{ fontSize: '18px', fontWeight: '900', color: '#f59e0b' }}>₹{Number(math.netBreakevenPrice).toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '10px', marginBottom: '18px' }}>
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '600' }}>Total Shares Owned</div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                  {math.totalQty.toLocaleString('en-IN')} units
                </div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#86efac', fontWeight: '600' }}>Capital Invested</div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                  ₹{math.totalInvestment.toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#fca5a5', fontWeight: '600' }}>STT, DP & Taxes</div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#f87171', marginTop: '2px' }}>
                  ₹{math.totalCharges.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Visual Tranche Capital Allocation Bars */}
            <div style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#cbd5e1', marginBottom: '8px' }}>
                Capital Weight Distribution Across Tranches
              </div>
              <div style={{ height: '14px', width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '7px', overflow: 'hidden', display: 'flex', marginBottom: '10px' }}>
                {math.list.map((t, idx) => (
                  <div
                    key={t.id}
                    style={{
                      width: `${Math.max(2, Number(t.weightPct))}%`,
                      background: lotColors[idx % lotColors.length],
                      height: '100%'
                    }}
                    title={`Lot #${idx + 1}: ${t.weightPct}%`}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {math.list.map((t, idx) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#cbd5e1' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: lotColors[idx % lotColors.length] }} />
                    <span>Lot #{idx + 1}: <strong>₹{t.price}</strong> ({t.weightPct}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Target Sell Target Card */}
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '16px', marginBottom: '8px' }}>
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
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>Net Profit (After STT & DP)</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                    +₹{math.targetProfitAmount.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#fbbf24', marginBottom: '10px' }}>
              Tranche-by-Tranche Cost Basis & Running Average Schedule
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Lot</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Buy Price</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Shares</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Lot Cost</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Weight</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Running Avg</th>
                </tr>
              </thead>
              <tbody>
                {math.list.map((t, idx) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px', fontWeight: '700', color: lotColors[idx % lotColors.length] }}>Lot #{idx + 1}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#cbd5e1' }}>₹{t.price.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#38bdf8' }}>{t.qty.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#f8fafc' }}>₹{t.cost.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>{t.weightPct}%</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#fbbf24' }}>₹{Number(t.runningAvg).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          onClick={handleExport}
          style={{
            marginTop: '16px',
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
// 4. MTF (MARGIN TRADING FACILITY) CALCULATOR (With Pledge/Unpledge & Statutory Charges)
// ============================================================================
function MtfCalculatorEngine({ viewMode, onDownloadCSV, onRegisterReport, onOpenPaperTrading }) {
  const [tradeValue, setTradeValue] = useState(200000);
  const [marginPct, setMarginPct] = useState(25); // e.g. 25% margin = 4x leverage
  const [holdingDays, setHoldingDays] = useState(30);
  const [mtfInterestRate, setMtfInterestRate] = useState(12.5); // % p.a.
  // MTF Processing, Pledge/Unpledge & Statutory Delivery Charges
  const [pledgeUnpledgeFee, setPledgeUnpledgeFee] = useState(40); // ₹20 Pledge + ₹20 Unpledge
  const [mtfBrokerageFee, setMtfBrokerageFee] = useState(40); // Buy + Sell MTF Order Brokerage
  const [includeMtfStatutoryTaxes, setIncludeMtfStatutoryTaxes] = useState(true); // 0.1% STT + Stamp + Exchange + 18% GST + DP

  const math = useMemo(() => {
    const clientMargin = tradeValue * (marginPct / 100);
    const borrowedAmount = tradeValue - clientMargin;
    const dailyInterestRate = (mtfInterestRate / 100) / 365;
    const dailyInterest = borrowedAmount * dailyInterestRate;
    const totalInterest = dailyInterest * holdingDays;

    // Processing Charges: Pledge/Unpledge + Brokerage + 18% GST + Statutory Delivery STT/Stamp/DP
    const gstOnPledgeAndBrok = (pledgeUnpledgeFee + mtfBrokerageFee) * 0.18;
    const sttAndStamp = includeMtfStatutoryTaxes ? (tradeValue * 2 * 0.001) + (tradeValue * 0.00015) + (tradeValue * 2 * 0.0000335) + 15.93 : 0;
    const totalProcessingAndTaxes = Math.round(pledgeUnpledgeFee + mtfBrokerageFee + gstOnPledgeAndBrok + sttAndStamp);
    const totalAllInMtfCost = Math.round(totalInterest + totalProcessingAndTaxes);

    const breakevenStockMovePct = tradeValue > 0 ? (totalAllInMtfCost / tradeValue) * 100 : 0;

    // Multi-horizon holding schedule for TABLE mode and PDF report
    const dayHorizons = Array.from(new Set([7, 15, 30, 60, 90, 180, 365, holdingDays])).sort((a, b) => a - b);
    const schedule = dayHorizons.map(days => {
      const interestForDays = dailyInterest * days;
      const totalCostForDays = interestForDays + totalProcessingAndTaxes;
      const breakevenPct = tradeValue > 0 ? (totalCostForDays / tradeValue) * 100 : 0;
      const grossProfitAt10Pct = tradeValue * 0.10;
      const netProfitAt10Pct = grossProfitAt10Pct - totalCostForDays;
      const roeOnMarginPct = clientMargin > 0 ? (netProfitAt10Pct / clientMargin) * 100 : 0;
      return {
        days,
        isCurrent: days === holdingDays,
        borrowed: Math.round(borrowedAmount),
        interest: Math.round(interestForDays),
        totalCost: Math.round(totalCostForDays),
        breakevenPct: breakevenPct.toFixed(2),
        netProfitAt10Pct: Math.round(netProfitAt10Pct),
        roeOnMarginPct: roeOnMarginPct.toFixed(1)
      };
    });

    return {
      clientMargin: Math.round(clientMargin),
      borrowedAmount: Math.round(borrowedAmount),
      dailyInterest: dailyInterest.toFixed(2),
      totalInterest: Math.round(totalInterest),
      totalProcessingAndTaxes,
      totalAllInMtfCost,
      breakevenStockMovePct: breakevenStockMovePct.toFixed(2),
      leverageMultiplier: marginPct > 0 ? (100 / marginPct).toFixed(1) : '1.0',
      schedule
    };
  }, [tradeValue, marginPct, holdingDays, mtfInterestRate, pledgeUnpledgeFee, mtfBrokerageFee, includeMtfStatutoryTaxes]);

  useEffect(() => {
    if (!onRegisterReport) return;
    onRegisterReport({
      title: 'MTF (Margin Trading Facility) Leverage, Interest & Charges Report',
      subtitle: 'Pay-Later stock funding breakdown, daily interest, pledge/unpledge fees & statutory charges',
      inputs: [
        { label: 'Total Stock Trade Value', value: `₹${tradeValue.toLocaleString('en-IN')}` },
        { label: 'Client Margin Required', value: `${marginPct}% (${math.leverageMultiplier}x Leverage)` },
        { label: 'Holding Duration', value: `${holdingDays} Days` },
        { label: 'Broker MTF Interest Rate', value: `${mtfInterestRate}% p.a.` },
        { label: 'Pledge, Brokerage & STT Charges', value: `₹${math.totalProcessingAndTaxes.toLocaleString('en-IN')}` }
      ],
      kpis: [
        { label: `All-In MTF Cost (${holdingDays}d)`, value: `₹${math.totalAllInMtfCost.toLocaleString('en-IN')}`, sub: `Interest ₹${math.totalInterest.toLocaleString('en-IN')} + Fees ₹${math.totalProcessingAndTaxes.toLocaleString('en-IN')}`, color: '#06b6d4' },
        { label: 'Your Cash Margin', value: `₹${math.clientMargin.toLocaleString('en-IN')}`, sub: `${marginPct}% upfront capital`, color: '#10b981' },
        { label: 'Broker Funded Capital', value: `₹${math.borrowedAmount.toLocaleString('en-IN')}`, sub: `${100 - marginPct}% MTF loan`, color: '#0284c7' },
        { label: 'All-In Breakeven Move', value: `+${math.breakevenStockMovePct}%`, sub: 'Covers interest + pledge + STT', color: '#f59e0b' }
      ],
      bars: [
        { label: 'Your Cash Margin', value: `₹${math.clientMargin.toLocaleString('en-IN')}`, pct: marginPct, color: '#10b981' },
        { label: 'Broker MTF Funded', value: `₹${math.borrowedAmount.toLocaleString('en-IN')}`, pct: 100 - marginPct, color: '#0284c7' }
      ],
      tableHeaders: ['Holding Period', 'MTF Interest (₹)', 'All-In Cost incl. Fees (₹)', 'Breakeven Move (%)', 'Net Profit @ +10% Move (₹)', 'Leveraged ROE on Margin'],
      tableRows: math.schedule.map(r => [
        `${r.days} Days${r.isCurrent ? ' (Selected)' : ''}`,
        `₹${r.interest.toLocaleString('en-IN')}`,
        `₹${r.totalCost.toLocaleString('en-IN')}`,
        `+${r.breakevenPct}%`,
        `₹${r.netProfitAt10Pct.toLocaleString('en-IN')}`,
        `${r.roeOnMarginPct}%`
      ]),
      notes: 'MTF all-in cost includes daily interest on broker-funded capital plus CDSL pledge/unpledge processing charges, brokerage, 18% GST, and delivery STT.'
    });
  }, [tradeValue, marginPct, holdingDays, mtfInterestRate, math, onRegisterReport]);

  const handleExport = () => {
    const headers = ['Holding Days', 'Client Margin (₹)', 'Broker Funded (₹)', 'MTF Interest (₹)', 'All-In Cost incl Charges (₹)', 'Breakeven Move (%)', 'Net Profit at +10% Move (₹)', 'ROE on Margin (%)'];
    const rows = math.schedule.map(r => [
      r.days,
      math.clientMargin,
      r.borrowed,
      r.interest,
      r.totalCost,
      `${r.breakevenPct}%`,
      r.netProfitAt10Pct,
      `${r.roeOnMarginPct}%`
    ]);
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
        gap: '18px'
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
            style={{ width: '100%', accentColor: '#06b6d4', marginTop: '10px' }}
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
            style={{ width: '100%', accentColor: '#06b6d4', marginTop: '10px' }}
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
            style={{ width: '100%', accentColor: '#06b6d4', marginTop: '10px' }}
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
            style={{ width: '100%', accentColor: '#06b6d4', marginTop: '10px' }}
          />
        </div>

        {/* MTF Processing, Pledge/Unpledge & Statutory Charges */}
        <div style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(6, 182, 212, 0.28)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#22d3ee', textTransform: 'uppercase' }}>
            ⚡ MTF Processing, Pledge & Statutory Charges
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '10.5px', color: '#94a3b8' }}>Pledge + Unpledge Fee (₹)</label>
              <input
                type="number" step="10"
                value={pledgeUnpledgeFee}
                onChange={e => setPledgeUnpledgeFee(Math.max(0, Number(e.target.value)))}
                style={{ width: '100%', padding: '5px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: '700', marginTop: '2px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10.5px', color: '#94a3b8' }}>MTF Brokerage (Buy+Sell ₹)</label>
              <input
                type="number" step="10"
                value={mtfBrokerageFee}
                onChange={e => setMtfBrokerageFee(Math.max(0, Number(e.target.value)))}
                style={{ width: '100%', padding: '5px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: '700', marginTop: '2px', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeMtfStatutoryTaxes}
                onChange={e => setIncludeMtfStatutoryTaxes(e.target.checked)}
                style={{ accentColor: '#06b6d4' }}
              />
              <span>Include 18% GST, STT (0.1%) & DP Charges</span>
            </label>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#fbbf24' }}>
              ₹{math.totalProcessingAndTaxes.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Results (Distinct CHART vs TABLE modes) */}
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
            <span style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Total All-In MTF Cost (Interest + Pledge & Taxes)
            </span>
            <div style={{ fontSize: '38px', fontWeight: '900', color: '#06b6d4', margin: '4px 0 14px' }}>
              ₹{math.totalAllInMtfCost.toLocaleString('en-IN')} <span style={{ fontSize: '13.5px', color: '#94a3b8', fontWeight: '500' }}>for {holdingDays} days</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '10px', marginBottom: '18px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#86efac', fontWeight: '600' }}>Your Cash Margin</div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                  ₹{math.clientMargin.toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '600' }}>Broker Borrowed</div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                  ₹{math.borrowedAmount.toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#22d3ee', fontWeight: '600' }}>MTF Interest ({holdingDays}d)</div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                  ₹{math.totalInterest.toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: '600' }}>Pledge, GST & STT</div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#fbbf24', marginTop: '2px' }}>
                  ₹{math.totalProcessingAndTaxes.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* SVG Donut Chart for Margin vs Broker Funding */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '20px', margin: '12px 0 18px' }}>
              <svg width="165" height="165" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#0284c7" strokeWidth="6" />
                <circle
                  cx="21" cy="21" r="15.91549430918954" fill="transparent"
                  stroke="#10b981" strokeWidth="6"
                  strokeDasharray={`${marginPct} ${100 - marginPct}`}
                  strokeDashoffset="25"
                />
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }} />
                  <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Client Margin: {marginPct}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#0284c7' }} />
                  <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Broker Funded: {100 - marginPct}%</span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#38bdf8', fontWeight: '700', marginTop: '4px' }}>
                  Effective Leverage: {math.leverageMultiplier}x
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '12px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Daily Interest Debit:</span>
                <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#f59e0b' }}>₹{math.dailyInterest} / day</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                <span style={{ fontSize: '12px', color: '#cbd5e1' }}>All-In Breakeven Stock Gain:</span>
                <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#10b981' }}>+{math.breakevenStockMovePct}%</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#22d3ee', marginBottom: '10px' }}>
              MTF Holding Duration Interest, Charges & Breakeven Schedule
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Holding Days</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>MTF Interest</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>All-In Cost</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Breakeven %</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Net @ +10% Move</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>ROE on Margin</th>
                </tr>
              </thead>
              <tbody>
                {math.schedule.map(row => (
                  <tr
                    key={row.days}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: row.isCurrent ? 'rgba(6, 182, 212, 0.14)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '8px', fontWeight: '700', color: row.isCurrent ? '#22d3ee' : '#f8fafc' }}>
                      {row.days} Days {row.isCurrent ? '★' : ''}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#f59e0b', fontWeight: '700' }}>
                      ₹{row.interest.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#fbbf24', fontWeight: '700' }}>
                      ₹{row.totalCost.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#cbd5e1' }}>
                      +{row.breakevenPct}%
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', color: row.netProfitAt10Pct >= 0 ? '#10b981' : '#ef4444', fontWeight: '700' }}>
                      ₹{row.netProfitAt10Pct.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#38bdf8', fontWeight: '700' }}>
                      {row.roeOnMarginPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          onClick={handleExport}
          style={{
            marginTop: '16px',
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
          <span>Export MTF Financing & Charges Breakdown (CSV)</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 5. SIP COMPONENT ENGINE (With Expense Ratio, Stamp Duty & Post-Tax LTCG)
// ============================================================================
function SipCalculatorEngine({ viewMode, onDownloadCSV, onRegisterReport, onOpenPaperTrading }) {
  const [monthlyInvestment, setMonthlyInvestment] = useState(25000);
  const [expectedReturn, setExpectedReturn] = useState(12);
  const [tenureYears, setTenureYears] = useState(10);
  const [stepUpPct, setStepUpPct] = useState(10); // annual step-up %
  const [expenseRatioPct, setExpenseRatioPct] = useState(0.5); // AMC Expense Ratio (TER %)
  const [deductLtcgTax, setDeductLtcgTax] = useState(true); // 12.5% LTCG above ₹1.25L exemption

  const math = useMemo(() => {
    const netAnnualRate = Math.max(0.1, expectedReturn - expenseRatioPct);
    const rateMonthlyNet = netAnnualRate / 12 / 100;
    const rateMonthlyGross = expectedReturn / 12 / 100;
    const totalMonths = tenureYears * 12;

    let totalInvested = 0;
    let totalStampDuty = 0;
    let currentMonthly = monthlyInvestment;
    let futureValNet = 0;
    let futureValGross = 0;
    const schedule = [];

    for (let yr = 1; yr <= tenureYears; yr++) {
      let yrInvested = 0;
      for (let m = 1; m <= 12; m++) {
        yrInvested += currentMonthly;
        totalInvested += currentMonthly;
        // SEBI 0.005% Stamp Duty deducted on Mutual Fund purchase
        const stamp = currentMonthly * 0.00005;
        totalStampDuty += stamp;
        const netDeposit = currentMonthly - stamp;
        const remainingMonths = totalMonths - ((yr - 1) * 12 + m) + 1;
        futureValNet += netDeposit * Math.pow(1 + rateMonthlyNet, remainingMonths);
        futureValGross += currentMonthly * Math.pow(1 + rateMonthlyGross, remainingMonths);
      }
      schedule.push({
        year: yr,
        annualDeposit: Math.round(yrInvested),
        totalInvested: Math.round(totalInvested),
        estGains: Math.round(Math.max(0, futureValNet - totalInvested)),
        futureVal: Math.round(futureValNet)
      });
      if (stepUpPct > 0) {
        currentMonthly = currentMonthly * (1 + stepUpPct / 100);
      }
    }

    const estimatedReturn = Math.max(0, futureValNet - totalInvested);
    const expenseAndStampDrag = Math.max(0, Math.round(futureValGross - futureValNet));
    const taxableGains = Math.max(0, estimatedReturn - 125000); // ₹1.25L LTCG exemption
    const ltcgTaxAmount = deductLtcgTax ? Math.round(taxableGains * 0.125) : 0; // 12.5% LTCG
    const postTaxCorpus = Math.round(futureValNet - ltcgTaxAmount);
    const wealthRatio = futureValNet > 0 ? ((totalInvested / futureValNet) * 100).toFixed(1) : '50';

    return {
      totalInvested: Math.round(totalInvested),
      totalStampDuty: Math.round(totalStampDuty),
      expenseAndStampDrag,
      estimatedReturn: Math.round(estimatedReturn),
      totalValue: Math.round(futureValNet),
      ltcgTaxAmount,
      postTaxCorpus,
      wealthRatio,
      schedule
    };
  }, [monthlyInvestment, expectedReturn, tenureYears, stepUpPct, expenseRatioPct, deductLtcgTax]);

  useEffect(() => {
    if (!onRegisterReport) return;
    const investedPct = Number(math.wealthRatio);
    const returnPct = Number((100 - investedPct).toFixed(1));
    onRegisterReport({
      title: 'SIP (Systematic Investment Plan) Wealth & Post-Tax Report',
      subtitle: 'Step-Up monthly SIP projection, AMC expense ratio, stamp duty & LTCG tax schedule',
      inputs: [
        { label: 'Starting Monthly SIP', value: `₹${monthlyInvestment.toLocaleString('en-IN')}` },
        { label: 'Expected Gross Return', value: `${expectedReturn}% p.a. (TER: ${expenseRatioPct}%)` },
        { label: 'Investment Horizon', value: `${tenureYears} Years` },
        { label: 'Annual Step-Up Rate', value: `+${stepUpPct}% / yr` }
      ],
      kpis: [
        { label: 'Projected Maturity Value', value: `₹${math.totalValue.toLocaleString('en-IN')}`, sub: `Post-Tax In-Hand: ₹${math.postTaxCorpus.toLocaleString('en-IN')}`, color: '#0284c7' },
        { label: 'Total Capital Invested', value: `₹${math.totalInvested.toLocaleString('en-IN')}`, sub: `Stamp Duty: ₹${math.totalStampDuty.toLocaleString('en-IN')}`, color: '#38bdf8' },
        { label: 'Estimated Wealth Gain', value: `+₹${math.estimatedReturn.toLocaleString('en-IN')}`, sub: `LTCG Tax: ₹${math.ltcgTaxAmount.toLocaleString('en-IN')}`, color: '#10b981' },
        { label: 'AMC TER & Fee Impact', value: `-₹${math.expenseAndStampDrag.toLocaleString('en-IN')}`, sub: `${expenseRatioPct}% p.a. expense ratio`, color: '#f59e0b' }
      ],
      bars: [
        { label: 'Invested Capital', value: `₹${math.totalInvested.toLocaleString('en-IN')}`, pct: investedPct, color: '#0284c7' },
        { label: 'Compounded Returns', value: `₹${math.estimatedReturn.toLocaleString('en-IN')}`, pct: returnPct, color: '#10b981' }
      ],
      tableHeaders: ['Year', 'Annual SIP Deposit (₹)', 'Cumulative Invested (₹)', 'Compounded Gains (₹)', 'Projected Corpus (₹)'],
      tableRows: math.schedule.map(r => [
        `Year ${r.year}`,
        `₹${r.annualDeposit.toLocaleString('en-IN')}`,
        `₹${r.totalInvested.toLocaleString('en-IN')}`,
        `+₹${r.estGains.toLocaleString('en-IN')}`,
        `₹${r.futureVal.toLocaleString('en-IN')}`
      ]),
      notes: `SIP projections factor in ${expenseRatioPct}% p.a. AMC Expense Ratio (TER), 0.005% SEBI stamp duty on purchase, and 12.5% LTCG tax above ₹1.25L exemption.`
    });
  }, [monthlyInvestment, expectedReturn, tenureYears, stepUpPct, expenseRatioPct, math, onRegisterReport]);

  const handleExport = () => {
    const headers = ['Year', 'Annual Deposit (₹)', 'Total Cumulative Invested (₹)', 'Estimated Gains (₹)', 'Maturity Corpus (₹)'];
    const rows = math.schedule.map(row => [row.year, row.annualDeposit, row.totalInvested, row.estGains, row.futureVal]);
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
        gap: '18px'
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
            style={{ width: '100%', accentColor: '#0284c7', marginTop: '10px' }}
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
            style={{ width: '100%', accentColor: '#0284c7', marginTop: '10px' }}
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
            style={{ width: '100%', accentColor: '#0284c7', marginTop: '10px' }}
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
            style={{ width: '100%', accentColor: '#0284c7', marginTop: '10px' }}
          />
        </div>

        {/* AMC Expense Ratio, Stamp Duty & LTCG Tax Box */}
        <div style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(2, 132, 199, 0.3)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '600' }}>AMC Expense Ratio (TER %)</span>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#fbbf24' }}>{expenseRatioPct}% p.a.</span>
          </div>
          <input
            type="range" min="0" max="2.5" step="0.05"
            value={expenseRatioPct} onChange={e => setExpenseRatioPct(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#f59e0b' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#cbd5e1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={deductLtcgTax}
                onChange={e => setDeductLtcgTax(e.target.checked)}
                style={{ accentColor: '#0284c7' }}
              />
              <span>Calculate 12.5% LTCG Tax (&gt;₹1.25L gain)</span>
            </label>
            <span style={{ color: '#f87171', fontWeight: '700' }}>-₹{math.ltcgTaxAmount.toLocaleString('en-IN')}</span>
          </div>
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
        {viewMode === 'CHART' ? (
          <div>
            <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600', marginBottom: '8px' }}>
              After {tenureYears} years of investment
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>Invested Value (Stamp Duty: ₹{math.totalStampDuty.toLocaleString('en-IN')})</span>
                <span style={{ fontSize: '15px', fontWeight: '800', color: '#0284c7' }}>₹{math.totalInvested.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>Estimated Return (Net of {expenseRatioPct}% TER)</span>
                <span style={{ fontSize: '15px', fontWeight: '800', color: '#10b981' }}>+₹{math.estimatedReturn.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#fbbf24' }}>AMC Fee & Stamp Duty Impact</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#fbbf24' }}>-₹{math.expenseAndStampDrag.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#f8fafc' }}>Maturity Value</span>
                <span style={{ fontSize: '20px', fontWeight: '900', color: '#38bdf8' }}>₹{math.totalValue.toLocaleString('en-IN')}</span>
              </div>
              {deductLtcgTax && (
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.08)', padding: '8px 10px', borderRadius: '8px', marginTop: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#86efac', fontWeight: '700' }}>Post-Tax In-Hand (After 12.5% LTCG)</span>
                  <span style={{ fontSize: '15px', fontWeight: '900', color: '#10b981' }}>₹{math.postTaxCorpus.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            {/* Donut Chart */}
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
                  <span style={{ fontSize: '12.5px', color: '#cbd5e1' }}>Invested Value ({math.wealthRatio}%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }} />
                  <span style={{ fontSize: '12.5px', color: '#cbd5e1' }}>Estimated Return ({(100 - math.wealthRatio).toFixed(1)}%)</span>
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
                  <th style={{ padding: '8px', textAlign: 'right' }}>Est. Gains</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Future Value</th>
                </tr>
              </thead>
              <tbody>
                {math.schedule.map(row => (
                  <tr key={row.year} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px', fontWeight: '700' }}>Yr {row.year}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#cbd5e1' }}>₹{row.annualDeposit.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#38bdf8' }}>₹{row.totalInvested.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#34d399' }}>+₹{row.estGains.toLocaleString('en-IN')}</td>
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
// 6. LUMPSUM CALCULATOR ENGINE (With Expense Ratio, Stamp Duty & LTCG Tax)
// ============================================================================
function LumpsumCalculatorEngine({ viewMode, onDownloadCSV, onRegisterReport, onOpenPaperTrading }) {
  const [investment, setInvestment] = useState(100000);
  const [cagr, setCagr] = useState(14);
  const [years, setYears] = useState(10);
  const [expenseRatioPct, setExpenseRatioPct] = useState(0.5); // AMC TER %
  const [deductLtcgTax, setDeductLtcgTax] = useState(true); // 12.5% LTCG > ₹1.25L

  const math = useMemo(() => {
    const stampDuty = investment * 0.00005; // 0.005% SEBI stamp duty on MF purchase
    const netInvested = investment - stampDuty;
    const netCagr = Math.max(0.1, cagr - expenseRatioPct);
    const futureValGross = investment * Math.pow(1 + cagr / 100, years);
    const futureVal = netInvested * Math.pow(1 + netCagr / 100, years);
    const gains = Math.max(0, futureVal - investment);
    const expenseAndStampDrag = Math.max(0, Math.round(futureValGross - futureVal));
    const taxableGains = Math.max(0, gains - 125000);
    const ltcgTaxAmount = deductLtcgTax ? Math.round(taxableGains * 0.125) : 0;
    const postTaxCorpus = Math.round(futureVal - ltcgTaxAmount);

    const schedule = [];
    for (let yr = 1; yr <= years; yr++) {
      const val = Math.round(netInvested * Math.pow(1 + netCagr / 100, yr));
      const prevVal = yr === 1 ? investment : Math.round(netInvested * Math.pow(1 + netCagr / 100, yr - 1));
      schedule.push({
        year: yr,
        yearlyGain: val - prevVal,
        totalGain: val - investment,
        value: val
      });
    }
    return {
      invested: investment,
      stampDuty: Math.round(stampDuty),
      expenseAndStampDrag,
      gains: Math.round(gains),
      futureVal: Math.round(futureVal),
      ltcgTaxAmount,
      postTaxCorpus,
      schedule,
      ratio: futureVal > 0 ? ((investment / futureVal) * 100).toFixed(1) : '50'
    };
  }, [investment, cagr, years, expenseRatioPct, deductLtcgTax]);

  useEffect(() => {
    if (!onRegisterReport) return;
    const invPct = Number(math.ratio);
    const gainPct = Number((100 - invPct).toFixed(1));
    onRegisterReport({
      title: 'Lumpsum Capital Compounding & Post-Tax Report',
      subtitle: 'Single-tranche exponential CAGR growth projection, AMC expense ratio & LTCG tax schedule',
      inputs: [
        { label: 'Initial Lumpsum Capital', value: `₹${investment.toLocaleString('en-IN')}` },
        { label: 'Expected CAGR Rate', value: `${cagr}% p.a. (TER: ${expenseRatioPct}%)` },
        { label: 'Compounding Horizon', value: `${years} Years` }
      ],
      kpis: [
        { label: 'Maturity Corpus', value: `₹${math.futureVal.toLocaleString('en-IN')}`, sub: `Post-Tax In-Hand: ₹${math.postTaxCorpus.toLocaleString('en-IN')}`, color: '#10b981' },
        { label: 'Initial Principal', value: `₹${investment.toLocaleString('en-IN')}`, sub: `${invPct}% of final value`, color: '#0284c7' },
        { label: 'Compounded Gains', value: `+₹${math.gains.toLocaleString('en-IN')}`, sub: `LTCG Tax: ₹${math.ltcgTaxAmount.toLocaleString('en-IN')}`, color: '#10b981' },
        { label: 'AMC Fee & Stamp Drag', value: `-₹${math.expenseAndStampDrag.toLocaleString('en-IN')}`, sub: `${expenseRatioPct}% p.a. TER impact`, color: '#f59e0b' }
      ],
      bars: [
        { label: 'Initial Principal', value: `₹${investment.toLocaleString('en-IN')}`, pct: invPct, color: '#0284c7' },
        { label: 'Compounded Gains', value: `₹${math.gains.toLocaleString('en-IN')}`, pct: gainPct, color: '#10b981' }
      ],
      tableHeaders: ['Year', 'Initial Principal (₹)', 'Yearly Interest Added (₹)', 'Cumulative Gain (₹)', 'Compounded Value (₹)'],
      tableRows: math.schedule.map(r => [
        `Year ${r.year}`,
        `₹${investment.toLocaleString('en-IN')}`,
        `+₹${r.yearlyGain.toLocaleString('en-IN')}`,
        `+₹${r.totalGain.toLocaleString('en-IN')}`,
        `₹${r.value.toLocaleString('en-IN')}`
      ]),
      notes: `Lumpsum compounding accounts for ${expenseRatioPct}% p.a. AMC Expense Ratio, 0.005% SEBI purchase stamp duty, and 12.5% LTCG tax above ₹1.25L exemption.`
    });
  }, [investment, cagr, years, expenseRatioPct, math, onRegisterReport]);

  const handleExport = () => {
    const headers = ['Year', 'Initial Principal (₹)', 'Annual Gain (₹)', 'Total Gain (₹)', 'Compounded Value (₹)'];
    const rows = math.schedule.map(r => [r.year, investment, r.yearlyGain, r.totalGain, r.value]);
    onDownloadCSV(`lumpsum_growth_${investment}`, headers, rows);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Initial Lumpsum Capital</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: '#10b981', fontWeight: '700' }}>₹</span>
              <input type="number" value={investment} onChange={e => setInvestment(Math.max(1000, Number(e.target.value)))} style={{ width: '100px', background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', fontWeight: '800', outline: 'none' }} />
            </div>
          </div>
          <input type="range" min="10000" max="5000000" step="10000" value={investment} onChange={e => setInvestment(Number(e.target.value))} style={{ width: '100%', accentColor: '#10b981', marginTop: '10px' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Expected CAGR (%)</label>
            <span style={{ fontSize: '15px', fontWeight: '800', color: '#10b981' }}>{cagr}%</span>
          </div>
          <input type="range" min="4" max="30" step="0.5" value={cagr} onChange={e => setCagr(Number(e.target.value))} style={{ width: '100%', accentColor: '#10b981', marginTop: '10px' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Tenure</label>
            <span style={{ fontSize: '15px', fontWeight: '800', color: '#10b981' }}>{years} Years</span>
          </div>
          <input type="range" min="1" max="35" step="1" value={years} onChange={e => setYears(Number(e.target.value))} style={{ width: '100%', accentColor: '#10b981', marginTop: '10px' }} />
        </div>

        {/* AMC Expense Ratio & LTCG Tax Box */}
        <div style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(16, 185, 129, 0.28)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '600' }}>AMC Expense Ratio (TER %)</span>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#fbbf24' }}>{expenseRatioPct}% p.a.</span>
          </div>
          <input
            type="range" min="0" max="2.5" step="0.05"
            value={expenseRatioPct} onChange={e => setExpenseRatioPct(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#f59e0b' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#cbd5e1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={deductLtcgTax}
                onChange={e => setDeductLtcgTax(e.target.checked)}
                style={{ accentColor: '#10b981' }}
              />
              <span>Calculate 12.5% LTCG Tax (&gt;₹1.25L gain)</span>
            </label>
            <span style={{ color: '#f87171', fontWeight: '700' }}>-₹{math.ltcgTaxAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {viewMode === 'CHART' ? (
          <div>
            <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>After {years} years of compounding</div>
            <div style={{ fontSize: '38px', fontWeight: '900', color: '#10b981', margin: '6px 0 12px' }}>₹{math.futureVal.toLocaleString('en-IN')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '600' }}>Invested Principal</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>₹{investment.toLocaleString('en-IN')}</div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#86efac', fontWeight: '600' }}>Compounded Gains</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>+₹{math.gains.toLocaleString('en-IN')}</div>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: '600' }}>AMC TER & Stamp Drag</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#fbbf24', marginTop: '2px' }}>-₹{math.expenseAndStampDrag.toLocaleString('en-IN')}</div>
              </div>
              <div style={{ background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.3)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#7dd3fc', fontWeight: '600' }}>Post-Tax In-Hand</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#38bdf8', marginTop: '2px' }}>₹{math.postTaxCorpus.toLocaleString('en-IN')}</div>
              </div>
            </div>

            {/* SVG Donut Chart */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '20px', margin: '12px 0' }}>
              <svg width="175" height="175" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#0284c7" strokeWidth="6" />
                <circle
                  cx="21" cy="21" r="15.91549430918954" fill="transparent"
                  stroke="#10b981" strokeWidth="6"
                  strokeDasharray={`${100 - math.ratio} ${math.ratio}`}
                  strokeDashoffset="25"
                />
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#0284c7' }} />
                  <span style={{ fontSize: '12.5px', color: '#cbd5e1' }}>Principal: {math.ratio}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }} />
                  <span style={{ fontSize: '12.5px', color: '#cbd5e1' }}>Wealth Gain: {(100 - math.ratio).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#10b981', marginBottom: '10px' }}>
              Year-by-Year Lumpsum Compounding Schedule
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Year</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Yearly Gain</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Total Gain</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Total Value</th>
                </tr>
              </thead>
              <tbody>
                {math.schedule.map(row => (
                  <tr key={row.year} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px', fontWeight: '700' }}>Yr {row.year}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#38bdf8' }}>+₹{row.yearlyGain.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#34d399' }}>+₹{row.totalGain.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#10b981' }}>₹{row.value.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={handleExport} style={{ marginTop: '20px', padding: '10px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#86efac', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Download size={14} /> Export Schedule (CSV)
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 7. MUTUAL FUNDS DIRECT VS REGULAR ENGINE (With Exit Load, Stamp Duty & LTCG)
// ============================================================================
function MutualFundsCalculatorEngine({ viewMode, onDownloadCSV, onRegisterReport, onOpenPaperTrading }) {
  const [monthlySip, setMonthlySip] = useState(15000);
  const [tenureYears, setTenureYears] = useState(15);
  const [expectedCagr, setExpectedCagr] = useState(14);
  const [regularTer, setRegularTer] = useState(1.65);
  const [directTer, setDirectTer] = useState(0.65);
  const [exitLoadPct, setExitLoadPct] = useState(0); // Optional Exit Load (0% - 2%)
  const [deductLtcgTax, setDeductLtcgTax] = useState(true); // 12.5% LTCG > ₹1.25L

  const feeSavings = useMemo(() => {
    const months = tenureYears * 12;
    const directMonthlyRate = (expectedCagr - directTer) / 12 / 100;
    const regularMonthlyRate = (expectedCagr - regularTer) / 12 / 100;
    const netSipAfterStamp = monthlySip * (1 - 0.00005); // 0.005% SEBI stamp duty

    let directCorpus = 0;
    let regularCorpus = 0;
    const schedule = [];

    for (let yr = 1; yr <= tenureYears; yr++) {
      const mCount = yr * 12;
      let dYr = 0;
      let rYr = 0;
      for (let m = 1; m <= mCount; m++) {
        dYr += netSipAfterStamp * Math.pow(1 + directMonthlyRate, mCount - m + 1);
        rYr += netSipAfterStamp * Math.pow(1 + regularMonthlyRate, mCount - m + 1);
      }
      schedule.push({
        year: yr,
        invested: monthlySip * mCount,
        directVal: Math.round(dYr),
        regularVal: Math.round(rYr),
        savedVal: Math.round(Math.max(0, dYr - rYr))
      });
      if (yr === tenureYears) {
        directCorpus = dYr * (1 - exitLoadPct / 100);
        regularCorpus = rYr * (1 - exitLoadPct / 100);
      }
    }

    const totalInvested = monthlySip * months;
    const stampDutyTotal = Math.round(totalInvested * 0.00005);
    const savedAmount = Math.max(0, directCorpus - regularCorpus);
    const lossPct = directCorpus > 0 ? ((savedAmount / directCorpus) * 100).toFixed(1) : '0.0';

    const directGains = Math.max(0, directCorpus - totalInvested);
    const directLtcgTax = deductLtcgTax ? Math.round(Math.max(0, directGains - 125000) * 0.125) : 0;
    const directPostTax = Math.round(directCorpus - directLtcgTax);

    return {
      totalInvested,
      stampDutyTotal,
      directCorpus: Math.round(directCorpus),
      regularCorpus: Math.round(regularCorpus),
      savedAmount: Math.round(savedAmount),
      directLtcgTax,
      directPostTax,
      lossPct,
      schedule
    };
  }, [monthlySip, tenureYears, expectedCagr, regularTer, directTer, exitLoadPct, deductLtcgTax]);

  useEffect(() => {
    if (!onRegisterReport) return;
    const regPct = Number((100 - Number(feeSavings.lossPct)).toFixed(1));
    onRegisterReport({
      title: 'Mutual Fund Direct vs Regular TER Commission & Post-Tax Report',
      subtitle: 'Impact of distributor trail commissions, Total Expense Ratio (TER), Stamp Duty & LTCG on SIP wealth',
      inputs: [
        { label: 'Monthly SIP Amount', value: `₹${monthlySip.toLocaleString('en-IN')}` },
        { label: 'Investment Horizon', value: `${tenureYears} Years` },
        { label: 'Gross Fund CAGR', value: `${expectedCagr}% p.a.` },
        { label: 'Direct vs Regular TER', value: `${directTer}% vs ${regularTer}%` }
      ],
      kpis: [
        { label: 'Extra Wealth in Direct', value: `+₹${feeSavings.savedAmount.toLocaleString('en-IN')}`, sub: 'Saved from agent commissions', color: '#10b981' },
        { label: 'Direct Plan Corpus', value: `₹${feeSavings.directCorpus.toLocaleString('en-IN')}`, sub: `Post-Tax: ₹${feeSavings.directPostTax.toLocaleString('en-IN')}`, color: '#0284c7' },
        { label: 'Regular Plan Corpus', value: `₹${feeSavings.regularCorpus.toLocaleString('en-IN')}`, sub: `Net CAGR: ${(expectedCagr - regularTer).toFixed(2)}%`, color: '#ef4444' },
        { label: 'Commission Drag', value: `${feeSavings.lossPct}%`, sub: 'Corpus lost to regular TER', color: '#f59e0b' }
      ],
      bars: [
        { label: 'Regular Plan Maturity', value: `₹${feeSavings.regularCorpus.toLocaleString('en-IN')}`, pct: regPct, color: '#0284c7' },
        { label: 'Direct Plan Extra Alpha', value: `+₹${feeSavings.savedAmount.toLocaleString('en-IN')}`, pct: Number(feeSavings.lossPct), color: '#10b981' }
      ],
      tableHeaders: ['Year', 'Total Invested (₹)', 'Direct Plan Value (₹)', 'Regular Plan Value (₹)', 'Commission Saved (₹)'],
      tableRows: feeSavings.schedule.map(r => [
        `Year ${r.year}`,
        `₹${r.invested.toLocaleString('en-IN')}`,
        `₹${r.directVal.toLocaleString('en-IN')}`,
        `₹${r.regularVal.toLocaleString('en-IN')}`,
        `+₹${r.savedVal.toLocaleString('en-IN')}`
      ]),
      notes: 'Direct mutual fund plans eliminate distributor trail commissions, allowing the annual TER differential to compound in your favor.'
    });
  }, [monthlySip, tenureYears, expectedCagr, regularTer, directTer, feeSavings, onRegisterReport]);

  const handleExport = () => {
    const headers = ['Year', 'Cumulative Invested (₹)', 'Direct Plan Corpus (₹)', 'Regular Plan Corpus (₹)', 'Commission Saved (₹)'];
    const rows = feeSavings.schedule.map(r => [r.year, r.invested, r.directVal, r.regularVal, r.savedVal]);
    onDownloadCSV(`mutual_fund_ter_comparison_${monthlySip}`, headers, rows);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Monthly SIP</label>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#3b82f6' }}>₹{monthlySip.toLocaleString('en-IN')}</span>
          </div>
          <input type="range" min="1000" max="100000" step="1000" value={monthlySip} onChange={e => setMonthlySip(Number(e.target.value))} style={{ width: '100%', accentColor: '#3b82f6', marginTop: '8px' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Tenure</label>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#10b981' }}>{tenureYears} Years</span>
          </div>
          <input type="range" min="3" max="30" step="1" value={tenureYears} onChange={e => setTenureYears(Number(e.target.value))} style={{ width: '100%', accentColor: '#3b82f6', marginTop: '8px' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Gross Fund Return (CAGR)</label>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#38bdf8' }}>{expectedCagr}% p.a.</span>
          </div>
          <input type="range" min="8" max="24" step="0.5" value={expectedCagr} onChange={e => setExpectedCagr(Number(e.target.value))} style={{ width: '100%', accentColor: '#3b82f6', marginTop: '8px' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#f87171' }}>Regular TER (%)</label>
            <input type="number" step="0.05" value={regularTer} onChange={e => setRegularTer(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#fca5a5', marginTop: '4px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#34d399' }}>Direct TER (%)</label>
            <input type="number" step="0.05" value={directTer} onChange={e => setDirectTer(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', color: '#86efac', marginTop: '4px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#fbbf24' }}>Exit Load (%)</label>
            <input type="number" step="0.25" value={exitLoadPct} onChange={e => setExitLoadPct(Math.max(0, Number(e.target.value)))} style={{ width: '100%', padding: '6px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', color: '#fbbf24', marginTop: '4px', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#cbd5e1', background: 'rgba(0,0,0,0.25)', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input type="checkbox" checked={deductLtcgTax} onChange={e => setDeductLtcgTax(e.target.checked)} style={{ accentColor: '#3b82f6' }} />
            <span>12.5% LTCG Tax & 0.005% Stamp Duty</span>
          </label>
          <span style={{ color: '#38bdf8', fontWeight: '700' }}>Post-Tax Direct: ₹{feeSavings.directPostTax.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {viewMode === 'CHART' ? (
          <div>
            <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Extra Wealth Gained via Direct Plan</div>
            <div style={{ fontSize: '38px', fontWeight: '900', color: '#10b981', margin: '4px 0 16px' }}>+₹{feeSavings.savedAmount.toLocaleString('en-IN')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '10px', marginBottom: '20px' }}>
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#86efac', fontWeight: '600' }}>Direct Corpus ({directTer}% TER)</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>₹{feeSavings.directCorpus.toLocaleString('en-IN')}</div>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#fca5a5', fontWeight: '600' }}>Regular Corpus ({regularTer}% TER)</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#cbd5e1', marginTop: '2px' }}>₹{feeSavings.regularCorpus.toLocaleString('en-IN')}</div>
              </div>
              <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '600' }}>Direct Post-Tax In-Hand</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#38bdf8', marginTop: '2px' }}>₹{feeSavings.directPostTax.toLocaleString('en-IN')}</div>
              </div>
            </div>

            {/* Visual Comparison Bars */}
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: '#86efac', fontWeight: '700' }}>Direct Plan (100% Potential)</span>
                  <span style={{ color: '#fff', fontWeight: '800' }}>₹{feeSavings.directCorpus.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ height: '10px', width: '100%', background: '#10b981', borderRadius: '5px' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: '#fca5a5', fontWeight: '700' }}>Regular Plan (-{feeSavings.lossPct}% Trail Fee Drag)</span>
                  <span style={{ color: '#cbd5e1', fontWeight: '800' }}>₹{feeSavings.regularCorpus.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ height: '10px', width: `${Math.max(10, 100 - Number(feeSavings.lossPct))}%`, background: '#ef4444', borderRadius: '5px' }} />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#60a5fa', marginBottom: '10px' }}>
              Year-by-Year Direct vs Regular Plan Corpus Comparison
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Year</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Direct Plan</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Regular Plan</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Fee Saved</th>
                </tr>
              </thead>
              <tbody>
                {feeSavings.schedule.map(row => (
                  <tr key={row.year} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px', fontWeight: '700' }}>Yr {row.year}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#34d399', fontWeight: '700' }}>₹{row.directVal.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#fca5a5' }}>₹{row.regularVal.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#38bdf8', fontWeight: '800' }}>+₹{row.savedVal.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={handleExport} style={{ marginTop: '16px', padding: '10px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.35)', color: '#60a5fa', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Download size={14} /> Export Direct vs Regular Schedule (CSV)
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 8. BROKERAGE & SEBI TAX ENGINE (With Custom Brokerage, DP & IPFT Charges)
// ============================================================================
function BrokerageTaxEngine({ viewMode, onDownloadCSV, onRegisterReport, onOpenPaperTrading }) {
  const [segment, setSegment] = useState('EQUITY_INTRADAY'); // 'EQUITY_DELIVERY' | 'EQUITY_INTRADAY' | 'FUTURES' | 'OPTIONS'
  const [buyPrice, setBuyPrice] = useState(500);
  const [sellPrice, setSellPrice] = useState(510);
  const [qty, setQty] = useState(100);
  const [customOrderBrokerage, setCustomOrderBrokerage] = useState(20); // ₹20/order default
  const [includeDpCharge, setIncludeDpCharge] = useState(true); // ₹15.93 CDSL DP charge on Delivery Sell

  const taxes = useMemo(() => {
    const buyVal = buyPrice * qty;
    const sellVal = sellPrice * qty;
    const turnover = buyVal + sellVal;
    const grossPnl = (sellPrice - buyPrice) * qty;

    let brokerage = 0;
    let stt = 0;
    let stampDuty = 0;
    let etc = turnover * 0.0000325; // NSE Exchange Txn Charge
    let dpCharge = 0;

    if (segment === 'EQUITY_DELIVERY') {
      brokerage = 0; // Zero Delivery Brokerage
      stt = turnover * 0.001; // 0.1% on both Buy & Sell
      stampDuty = buyVal * 0.00015; // 0.015% on Delivery Buy
      dpCharge = includeDpCharge && sellVal > 0 ? 15.93 : 0; // CDSL DP Charge ₹13.5 + 18% GST
    } else if (segment === 'EQUITY_INTRADAY') {
      brokerage = Math.min(customOrderBrokerage, buyVal * 0.0003) + Math.min(customOrderBrokerage, sellVal * 0.0003);
      stt = sellVal * 0.00025; // 0.025% on Sell
      stampDuty = buyVal * 0.00003; // 0.003% on Buy
    } else if (segment === 'FUTURES') {
      brokerage = customOrderBrokerage * 2;
      stt = sellVal * 0.0002; // 0.02% revised Oct 2024
      stampDuty = buyVal * 0.00002;
      etc = turnover * 0.0000173;
    } else {
      brokerage = customOrderBrokerage * 2;
      stt = sellVal * 0.001; // 0.1% on Option Premium Sell (revised Oct 2024)
      stampDuty = buyVal * 0.00003;
      etc = turnover * 0.0003503;
    }

    const sebiFee = turnover * 0.000001; // ₹10 / Crore
    const ipftCharge = turnover * 0.000001; // NSE IPFT Charge ₹10 / Crore
    const gst = (brokerage + etc + sebiFee + ipftCharge) * 0.18;
    const totalCharges = brokerage + stt + etc + gst + stampDuty + sebiFee + ipftCharge + dpCharge;
    const netPnl = grossPnl - totalCharges;
    const breakevenMovePerShare = qty > 0 ? totalCharges / qty : 0;

    const breakdown = [
      { name: 'Brokerage Fee', amount: brokerage.toFixed(2), rule: segment === 'EQUITY_DELIVERY' ? '₹0 Zero Delivery' : `Max ₹${customOrderBrokerage}/order`, color: '#38bdf8' },
      { name: 'Securities Transaction Tax (STT)', amount: stt.toFixed(2), rule: 'Statutory Govt Levy', color: '#ef4444' },
      { name: 'Exchange Transaction Charges', amount: etc.toFixed(2), rule: 'NSE/BSE Turnover Levy', color: '#f59e0b' },
      { name: 'GST (18% on Brok + Exchange + SEBI)', amount: gst.toFixed(2), rule: '18% Statutory Tax', color: '#a855f7' },
      { name: 'Stamp Duty', amount: stampDuty.toFixed(2), rule: segment === 'EQUITY_DELIVERY' ? '0.015% on Buy' : '0.003% on Buy', color: '#ec4899' },
      { name: 'SEBI + IPFT Turnover Charges', amount: (sebiFee + ipftCharge).toFixed(2), rule: '₹20 / Crore Total', color: '#10b981' },
      ...(dpCharge > 0 ? [{ name: 'DP (Depository) Sell Charge', amount: dpCharge.toFixed(2), rule: '₹13.50 + 18% GST CDSL', color: '#06b6d4' }] : [])
    ];

    return {
      turnover: Math.round(turnover),
      grossPnl: Math.round(grossPnl),
      brokerage: brokerage.toFixed(2),
      stt: stt.toFixed(2),
      etc: etc.toFixed(2),
      gst: gst.toFixed(2),
      stampDuty: stampDuty.toFixed(2),
      sebiFee: (sebiFee + ipftCharge).toFixed(2),
      dpCharge: dpCharge.toFixed(2),
      totalCharges: totalCharges.toFixed(2),
      netPnl: Math.round(netPnl),
      breakevenMovePerShare: breakevenMovePerShare.toFixed(2),
      breakdown
    };
  }, [segment, buyPrice, sellPrice, qty, customOrderBrokerage, includeDpCharge]);

  useEffect(() => {
    if (!onRegisterReport) return;
    const totalNum = Math.max(0.01, Number(taxes.totalCharges));
    onRegisterReport({
      title: 'Brokerage, STT, DP & SEBI Statutory Tax Contract Note',
      subtitle: `Updated SEBI & Exchange transaction cost breakdown (${segment.replace('_', ' ')})`,
      inputs: [
        { label: 'Market Segment', value: segment.replace('_', ' ') },
        { label: 'Buy Price', value: `₹${buyPrice.toLocaleString('en-IN')}` },
        { label: 'Sell Price', value: `₹${sellPrice.toLocaleString('en-IN')}` },
        { label: 'Quantity', value: `${qty.toLocaleString('en-IN')} Units` }
      ],
      kpis: [
        { label: 'Net Realized P&L', value: `${taxes.netPnl >= 0 ? '+' : ''}₹${taxes.netPnl.toLocaleString('en-IN')}`, sub: `Gross P&L: ₹${taxes.grossPnl.toLocaleString('en-IN')}`, color: taxes.netPnl >= 0 ? '#10b981' : '#ef4444' },
        { label: 'Total Turnover', value: `₹${taxes.turnover.toLocaleString('en-IN')}`, sub: 'Buy + Sell value', color: '#0284c7' },
        { label: 'Total Taxes & Charges', value: `₹${taxes.totalCharges}`, sub: 'All statutory levies', color: '#f59e0b' },
        { label: 'Breakeven Move / Share', value: `₹${taxes.breakevenMovePerShare}`, sub: 'Points needed to cover cost', color: '#8b5cf6' }
      ],
      bars: taxes.breakdown.map(b => ({
        label: b.name,
        value: `₹${b.amount}`,
        pct: (Number(b.amount) / totalNum) * 100,
        color: b.color
      })),
      tableHeaders: ['Statutory Charge Head', 'Applicable Rate / Rule', 'Calculated Charge (₹)', 'Share of Total Cost'],
      tableRows: taxes.breakdown.map(b => [
        b.name,
        b.rule,
        `₹${b.amount}`,
        `${((Number(b.amount) / totalNum) * 100).toFixed(1)}%`
      ]),
      notes: 'Computed using revised SEBI & Union Budget STT rates (0.02% on Futures, 0.10% on Options premium) plus 18% GST, IPFT, and CDSL DP charges.'
    });
  }, [segment, buyPrice, sellPrice, qty, taxes, onRegisterReport]);

  const handleExport = () => {
    const headers = ['Charge Component', 'Rule / Rate', 'Amount (₹)'];
    const rows = [
      ['Total Turnover', segment, taxes.turnover],
      ['Gross P&L', '', taxes.grossPnl],
      ...taxes.breakdown.map(b => [b.name, b.rule, b.amount]),
      ['Total Statutory Charges', '', taxes.totalCharges],
      ['Net Realized P&L', '', taxes.netPnl]
    ];
    onDownloadCSV(`brokerage_contract_note_${segment.toLowerCase()}`, headers, rows);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>Buy Price (₹)</label>
            <input type="number" value={buyPrice} onChange={e => setBuyPrice(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginTop: '4px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>Sell Price (₹)</label>
            <input type="number" value={sellPrice} onChange={e => setSellPrice(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginTop: '4px', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>Quantity</label>
            <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginTop: '4px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>Max Brok / Order (₹)</label>
            <input type="number" value={customOrderBrokerage} onChange={e => setCustomOrderBrokerage(Math.max(0, Number(e.target.value)))} style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#facc15', fontWeight: '700', marginTop: '4px', boxSizing: 'border-box' }} />
          </div>
        </div>
        {segment === 'EQUITY_DELIVERY' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#cbd5e1', cursor: 'pointer', background: 'rgba(0,0,0,0.25)', padding: '8px 10px', borderRadius: '8px' }}>
            <input type="checkbox" checked={includeDpCharge} onChange={e => setIncludeDpCharge(e.target.checked)} style={{ accentColor: '#eab308' }} />
            <span>Include CDSL Depository (DP) Sell Charge (₹15.93 incl. GST)</span>
          </label>
        )}
      </div>

      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {viewMode === 'CHART' ? (
          <div>
            <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Net Profit / Loss (After All Levies)</div>
            <div style={{ fontSize: '38px', fontWeight: '900', color: taxes.netPnl >= 0 ? '#10b981' : '#ef4444', margin: '4px 0 14px' }}>
              {taxes.netPnl >= 0 ? '+' : ''}₹{taxes.netPnl.toLocaleString('en-IN')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Turnover:</span> <strong style={{ color: '#38bdf8' }}>₹{taxes.turnover.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Gross P&L:</span> <strong style={{ color: taxes.grossPnl >= 0 ? '#34d399' : '#f87171' }}>₹{taxes.grossPnl.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Statutory STT:</span> <strong>₹{taxes.stt}</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Total Charges:</span> <strong style={{ color: '#f87171' }}>₹{taxes.totalCharges}</strong>
              </div>
            </div>

            {/* Visual Tax Share Bar */}
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#cbd5e1', marginBottom: '8px' }}>
                Statutory Cost Composition (Breakeven: ₹{taxes.breakevenMovePerShare}/share)
              </div>
              <div style={{ height: '12px', width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', overflow: 'hidden', display: 'flex', marginBottom: '8px' }}>
                {taxes.breakdown.map(b => (
                  <div
                    key={b.name}
                    style={{
                      width: `${Math.max(2, (Number(b.amount) / Math.max(0.01, Number(taxes.totalCharges))) * 100)}%`,
                      background: b.color,
                      height: '100%'
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '11px', color: '#cbd5e1' }}>
                {taxes.breakdown.map(b => (
                  <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: b.color }} />
                    <span>{b.name.split(' ')[0]}: ₹{b.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#facc15', marginBottom: '10px' }}>
              Itemized Contract Note & Statutory Tax Table
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Charge Head</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Rate / Basis</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {taxes.breakdown.map(row => (
                  <tr key={row.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px', fontWeight: '700', color: row.color }}>{row.name}</td>
                    <td style={{ padding: '8px', color: '#94a3b8' }}>{row.rule}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#f8fafc' }}>₹{row.amount}</td>
                  </tr>
                ))}
                <tr style={{ background: 'rgba(234, 179, 8, 0.1)', fontWeight: '800' }}>
                  <td style={{ padding: '8px', color: '#facc15' }}>Total Charges</td>
                  <td style={{ padding: '8px', color: '#cbd5e1' }}>Breakeven: +₹{taxes.breakevenMovePerShare}/sh</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#f87171' }}>₹{taxes.totalCharges}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <button onClick={handleExport} style={{ marginTop: '16px', padding: '10px', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.35)', color: '#facc15', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Download size={14} /> Export Contract Note Breakdown (CSV)
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 9. POSITION SIZING & RISK/REWARD ENGINE (With Brokerage & Slippage Buffer)
// ============================================================================
function PositionSizerEngine({ viewMode, onDownloadCSV, onRegisterReport, onOpenPaperTrading }) {
  const [capital, setCapital] = useState(500000);
  const [riskPct, setRiskPct] = useState(1.5);
  const [entryPrice, setEntryPrice] = useState(1450);
  const [stopLoss, setStopLoss] = useState(1420);
  const [targetPrice, setTargetPrice] = useState(1540);
  const [slippageAndChargesPerShare, setSlippageAndChargesPerShare] = useState(1.5); // ₹ buffer per share for brokerage + STT + slippage

  const math = useMemo(() => {
    const riskAmount = capital * (riskPct / 100);
    const rawRiskPerShare = Math.max(0.01, Math.abs(entryPrice - stopLoss));
    const effectiveRiskPerShare = rawRiskPerShare + Math.max(0, slippageAndChargesPerShare);
    const positionQty = Math.floor(riskAmount / effectiveRiskPerShare);
    const positionValue = positionQty * entryPrice;
    const totalEstimatedCharges = Math.round(positionQty * slippageAndChargesPerShare);
    const rewardPerShare = Math.max(0, Math.abs(targetPrice - entryPrice) - slippageAndChargesPerShare);
    const rewardToRisk = effectiveRiskPerShare > 0 ? (rewardPerShare / effectiveRiskPerShare).toFixed(2) : '0';
    const totalPotentialProfit = positionQty * rewardPerShare;
    const capitalAllocationPct = capital > 0 ? Math.min(100, (positionValue / capital) * 100).toFixed(1) : '0';

    // R-Multiple payoff ladder for TABLE mode & PDF report
    const rMultiples = [-1, 0, 1, 1.5, 2, 3, 5];
    const ladder = rMultiples.map(rMult => {
      const pricePoint = entryPrice >= stopLoss
        ? entryPrice + rMult * rawRiskPerShare
        : entryPrice - rMult * rawRiskPerShare;
      const pnl = Math.round(positionQty * (rMult * rawRiskPerShare - slippageAndChargesPerShare));
      const acctImpactPct = capital > 0 ? ((pnl / capital) * 100).toFixed(2) : '0.00';
      return {
        label: rMult === -1 ? '-1R (Stop Loss)' : rMult === 0 ? '0R (Breakeven)' : `+${rMult}R Target`,
        pricePoint: pricePoint.toFixed(2),
        pnl,
        acctImpactPct
      };
    });

    return {
      riskAmount: Math.round(riskAmount),
      riskPerShare: effectiveRiskPerShare.toFixed(2),
      rewardPerShare: rewardPerShare.toFixed(2),
      positionQty,
      positionValue: Math.round(positionValue),
      totalEstimatedCharges,
      rewardToRisk,
      totalPotentialProfit: Math.round(totalPotentialProfit),
      capitalAllocationPct,
      ladder
    };
  }, [capital, riskPct, entryPrice, stopLoss, targetPrice, slippageAndChargesPerShare]);

  useEffect(() => {
    if (!onRegisterReport) return;
    onRegisterReport({
      title: 'Position Sizing & Risk-Reward Discipline Report',
      subtitle: 'Institutional R-Multiple trade sizing, stop-loss risk cap, slippage buffer & target payoff matrix',
      inputs: [
        { label: 'Total Trading Capital', value: `₹${capital.toLocaleString('en-IN')}` },
        { label: 'Max Risk Per Trade', value: `${riskPct}% (₹${math.riskAmount.toLocaleString('en-IN')})` },
        { label: 'Entry / Stop-Loss', value: `₹${entryPrice} / ₹${stopLoss}` },
        { label: 'Target / Slippage Buffer', value: `₹${targetPrice} (₹${slippageAndChargesPerShare}/sh buffer)` }
      ],
      kpis: [
        { label: 'Recommended Quantity', value: `${math.positionQty.toLocaleString('en-IN')} Shares`, sub: `Position Value: ₹${math.positionValue.toLocaleString('en-IN')}`, color: '#0284c7' },
        { label: 'Max Capital at Risk (1R)', value: `-₹${math.riskAmount.toLocaleString('en-IN')}`, sub: `Incl. ₹${math.totalEstimatedCharges} charges buffer`, color: '#ef4444' },
        { label: 'Net Target Profit', value: `+₹${math.totalPotentialProfit.toLocaleString('en-IN')}`, sub: `₹${math.rewardPerShare} net reward/share`, color: '#10b981' },
        { label: 'Net Risk : Reward', value: `1 : ${math.rewardToRisk}`, sub: `${math.capitalAllocationPct}% capital deployed`, color: '#8b5cf6' }
      ],
      bars: [
        { label: 'Deployed Position Capital', value: `₹${math.positionValue.toLocaleString('en-IN')}`, pct: Number(math.capitalAllocationPct), color: '#0284c7' },
        { label: 'Unallocated Cash Reserve', value: `₹${Math.max(0, capital - math.positionValue).toLocaleString('en-IN')}`, pct: Math.max(0, 100 - Number(math.capitalAllocationPct)), color: '#10b981' }
      ],
      tableHeaders: ['R-Multiple Level', 'Stock Price Trigger (₹)', 'Net Realized P&L (₹)', 'Account Equity Impact (%)'],
      tableRows: math.ladder.map(row => [
        row.label,
        `₹${Number(row.pricePoint).toLocaleString('en-IN')}`,
        `${row.pnl >= 0 ? '+' : ''}₹${row.pnl.toLocaleString('en-IN')}`,
        `${Number(row.acctImpactPct) >= 0 ? '+' : ''}${row.acctImpactPct}%`
      ]),
      notes: 'Position quantity is strictly capped so that even after brokerage, taxes, and slippage, a stop-loss hit never exceeds your 1R risk cap.'
    });
  }, [capital, riskPct, entryPrice, stopLoss, targetPrice, slippageAndChargesPerShare, math, onRegisterReport]);

  const handleExport = () => {
    const headers = ['R-Multiple', 'Trigger Price (₹)', 'Projected Net P&L (₹)', 'Account Impact (%)'];
    const rows = math.ladder.map(r => [r.label, r.pricePoint, r.pnl, `${r.acctImpactPct}%`]);
    onDownloadCSV(`position_sizing_${entryPrice}`, headers, rows);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Total Account Capital (₹)</label>
          <input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginTop: '4px', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Risk Per Trade (%): <strong style={{ color: '#f87171' }}>{riskPct}%</strong></label>
          <input type="range" min="0.5" max="5" step="0.1" value={riskPct} onChange={e => setRiskPct(Number(e.target.value))} style={{ width: '100%', accentColor: '#ef4444', marginTop: '6px' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#38bdf8' }}>Entry Price</label>
            <input type="number" value={entryPrice} onChange={e => setEntryPrice(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginTop: '4px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#f87171' }}>Stop Loss</label>
            <input type="number" value={stopLoss} onChange={e => setStopLoss(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginTop: '4px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#34d399' }}>Target Price</label>
            <input type="number" value={targetPrice} onChange={e => setTargetPrice(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginTop: '4px', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '10px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11.5px', color: '#fbbf24', fontWeight: '700' }}>Brokerage, Taxes & Slippage Buffer (₹/sh)</div>
            <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>Est. Charges: ₹{math.totalEstimatedCharges.toLocaleString('en-IN')}</div>
          </div>
          <input
            type="number" step="0.25"
            value={slippageAndChargesPerShare}
            onChange={e => setSlippageAndChargesPerShare(Math.max(0, Number(e.target.value)))}
            style={{ width: '75px', padding: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fbbf24', fontWeight: '800', textAlign: 'right' }}
          />
        </div>
      </div>

      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {viewMode === 'CHART' ? (
          <div>
            <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Recommended Position Size</div>
            <div style={{ fontSize: '38px', fontWeight: '900', color: '#38bdf8', margin: '4px 0 16px' }}>
              {math.positionQty.toLocaleString('en-IN')} <span style={{ fontSize: '14px', color: '#94a3b8' }}>shares (₹{math.positionValue.toLocaleString('en-IN')})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#f87171' }}>Capital at Risk (1R incl. Charges)</div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#f8fafc' }}>-₹{math.riskAmount.toLocaleString('en-IN')}</div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#34d399' }}>Net Target Reward ({math.rewardToRisk}R)</div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#10b981' }}>+₹{math.totalPotentialProfit.toLocaleString('en-IN')}</div>
              </div>
            </div>

            {/* Visual Risk vs Reward Bar */}
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#cbd5e1', marginBottom: '6px' }}>
                <span>All-In Risk: ₹{math.riskPerShare}/sh</span>
                <span style={{ fontWeight: '800', color: '#34d399' }}>Net R:R = 1 : {math.rewardToRisk}</span>
                <span>Net Reward: ₹{math.rewardPerShare}/sh</span>
              </div>
              <div style={{ height: '12px', width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${(1 / (1 + Math.max(0.1, Number(math.rewardToRisk)))) * 100}%`, background: '#ef4444', height: '100%' }} />
                <div style={{ flex: 1, background: '#10b981', height: '100%' }} />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#38bdf8', marginBottom: '10px' }}>
              R-Multiple Payoff Ladder ({math.positionQty} Shares)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>R-Multiple</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Stock Price</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Net P&L</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Equity Impact</th>
                </tr>
              </thead>
              <tbody>
                {math.ladder.map(row => (
                  <tr key={row.label} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px', fontWeight: '700', color: row.pnl < 0 ? '#f87171' : row.pnl > 0 ? '#34d399' : '#cbd5e1' }}>{row.label}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#f8fafc' }}>₹{Number(row.pricePoint).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: row.pnl < 0 ? '#f87171' : '#10b981' }}>{row.pnl >= 0 ? '+' : ''}₹{row.pnl.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#38bdf8' }}>{Number(row.acctImpactPct) >= 0 ? '+' : ''}{row.acctImpactPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={handleExport} style={{ marginTop: '16px', padding: '10px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#fca5a5', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Download size={14} /> Export R-Multiple Payoff Ladder (CSV)
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 10. OPTIONS GREEKS BLACK-SCHOLES ENGINE (With Lot Size & F&O Charges)
// ============================================================================
function OptionGreeksEngine({ viewMode, onDownloadCSV, onRegisterReport, onOpenPaperTrading }) {
  const [spotPrice, setSpotPrice] = useState(24500);
  const [strikePrice, setStrikePrice] = useState(24500);
  const [daysToExpiry, setDaysToExpiry] = useState(7);
  const [ivPct, setIvPct] = useState(14.5);
  const [optionType, setOptionType] = useState('CE'); // 'CE' | 'PE'
  const [lotSize, setLotSize] = useState(75); // e.g. 75 NIFTY, 30 BANKNIFTY

  const greeks = useMemo(() => {
    const normalCdf = (x) => {
      const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
      const sign = x < 0 ? -1 : 1;
      const absX = Math.abs(x) / Math.sqrt(2.0);
      const t = 1.0 / (1.0 + p * absX);
      const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
      return 0.5 * (1.0 + sign * y);
    };
    const normalPdf = (x) => (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);

    const calcBS = (S, K, dte, iv, type) => {
      const T = Math.max(0.001, dte / 365);
      const sigma = Math.max(0.01, iv / 100);
      const r = 0.07;
      const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
      const d2 = d1 - sigma * Math.sqrt(T);

      const callPrice = Math.max(0, S * normalCdf(d1) - K * Math.exp(-r * T) * normalCdf(d2));
      const putPrice = Math.max(0, K * Math.exp(-r * T) * normalCdf(-d2) - S * normalCdf(-d1));
      const price = type === 'CE' ? callPrice : putPrice;
      const delta = type === 'CE' ? normalCdf(d1) : normalCdf(d1) - 1;
      const gamma = normalPdf(d1) / (S * sigma * Math.sqrt(T));
      const theta = (-(S * normalPdf(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normalCdf(type === 'CE' ? d2 : -d2)) / 365;
      const vega = (S * Math.sqrt(T) * normalPdf(d1)) / 100;
      const intrinsic = type === 'CE' ? Math.max(0, S - K) : Math.max(0, K - S);
      const extrinsic = Math.max(0, price - intrinsic);
      return { price, callPrice, putPrice, delta, gamma, theta, vega, intrinsic, extrinsic };
    };

    const current = calcBS(spotPrice, strikePrice, daysToExpiry, ivPct, optionType);
    const lotValue = current.price * lotSize;
    // F&O Option Round-Trip Brokerage (₹40) + STT (0.1% on sell) + Exchange Txn + 18% GST
    const fnOCharges = 40 + (lotValue * 0.001) + (lotValue * 2 * 0.0003503) + (40 + lotValue * 2 * 0.0003503) * 0.18;

    // Build Strike Matrix around current strike for TABLE view & PDF report
    const step = spotPrice > 10000 ? 100 : spotPrice > 1000 ? 50 : 10;
    const offsets = [-3, -2, -1, 0, 1, 2, 3];
    const chainRows = offsets.map(offset => {
      const k = Math.max(step, strikePrice + offset * step);
      const rowMath = calcBS(spotPrice, k, daysToExpiry, ivPct, optionType);
      return {
        strike: k,
        isSelected: offset === 0,
        callLtp: rowMath.callPrice.toFixed(2),
        putLtp: rowMath.putPrice.toFixed(2),
        delta: rowMath.delta.toFixed(3),
        theta: rowMath.theta.toFixed(2),
        vega: rowMath.vega.toFixed(2)
      };
    });

    const totalPrem = Math.max(0.01, current.price);
    const intrinsicPct = Math.min(100, (current.intrinsic / totalPrem) * 100).toFixed(1);

    return {
      price: current.price.toFixed(2),
      lotValue: Math.round(lotValue),
      fnOCharges: Math.round(fnOCharges),
      lotTheta: Math.round(current.theta * lotSize),
      delta: current.delta.toFixed(3),
      gamma: current.gamma.toFixed(5),
      theta: current.theta.toFixed(2),
      vega: current.vega.toFixed(2),
      intrinsic: current.intrinsic.toFixed(2),
      extrinsic: current.extrinsic.toFixed(2),
      intrinsicPct,
      chainRows
    };
  }, [spotPrice, strikePrice, daysToExpiry, ivPct, optionType, lotSize]);

  useEffect(() => {
    if (!onRegisterReport) return;
    const intrPct = Number(greeks.intrinsicPct);
    const extrPct = Number((100 - intrPct).toFixed(1));
    onRegisterReport({
      title: `Black-Scholes Options Pricing & Greeks Report (${optionType})`,
      subtitle: 'Theoretical option premium decomposition, lot exposure, F&O charges & strike matrix',
      inputs: [
        { label: 'Option Type / Lot Size', value: `${optionType === 'CE' ? 'Call (CE)' : 'Put (PE)'} • ${lotSize} Units` },
        { label: 'Underlying Spot Price', value: `₹${spotPrice.toLocaleString('en-IN')}` },
        { label: 'Strike Price', value: `₹${strikePrice.toLocaleString('en-IN')}` },
        { label: 'Days to Expiry / IV', value: `${daysToExpiry} Days • ${ivPct}% IV` }
      ],
      kpis: [
        { label: `Theoretical ${optionType} Price`, value: `₹${greeks.price}`, sub: `1 Lot Capital: ₹${greeks.lotValue.toLocaleString('en-IN')}`, color: '#a855f7' },
        { label: 'Δ Delta / Γ Gamma', value: `${greeks.delta} / ${greeks.gamma}`, sub: `Est. F&O Charges: ₹${greeks.fnOCharges}`, color: '#0284c7' },
        { label: 'Θ Theta Decay', value: `₹${greeks.theta} / day`, sub: `Per Lot: ₹${greeks.lotTheta}/day`, color: '#ef4444' },
        { label: 'V Vega Sensitivity', value: `₹${greeks.vega} / 1% IV`, sub: 'Volatility impact per 1% IV', color: '#10b981' }
      ],
      bars: [
        { label: 'Intrinsic Value', value: `₹${greeks.intrinsic}`, pct: intrPct, color: '#10b981' },
        { label: 'Time / Extrinsic Value', value: `₹${greeks.extrinsic}`, pct: extrPct, color: '#a855f7' }
      ],
      tableHeaders: ['Strike Price', 'Call Premium (CE)', 'Put Premium (PE)', `${optionType} Delta (Δ)`, `${optionType} Theta (Θ/day)`, 'Vega (V)'],
      tableRows: greeks.chainRows.map(r => [
        `₹${r.strike.toLocaleString('en-IN')}${r.isSelected ? ' (ATM/Selected)' : ''}`,
        `₹${r.callLtp}`,
        `₹${r.putLtp}`,
        r.delta,
        `₹${r.theta}`,
        `₹${r.vega}`
      ]),
      notes: 'Computed via continuous-time Black-Scholes-Merton formula assuming a 7.0% risk-free rate (MIBOR/91-Day T-Bill proxy) plus F&O brokerage & STT.'
    });
  }, [spotPrice, strikePrice, daysToExpiry, ivPct, optionType, lotSize, greeks, onRegisterReport]);

  const handleExport = () => {
    const headers = ['Strike Price (₹)', 'Call Premium (₹)', 'Put Premium (₹)', `${optionType} Delta`, `${optionType} Theta/Day`, 'Vega'];
    const rows = greeks.chainRows.map(r => [r.strike, r.callLtp, r.putLtp, r.delta, r.theta, r.vega]);
    onDownloadCSV(`option_greeks_matrix_${strikePrice}_${optionType}`, headers, rows);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setOptionType('CE')} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: optionType === 'CE' ? '#10b981' : 'rgba(255,255,255,0.05)', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Call (CE)</button>
          <button onClick={() => setOptionType('PE')} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: optionType === 'PE' ? '#ef4444' : 'rgba(255,255,255,0.05)', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Put (PE)</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#94a3b8' }}>Spot Price (₹)</label>
            <input type="number" value={spotPrice} onChange={e => setSpotPrice(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginTop: '4px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#94a3b8' }}>Strike Price (₹)</label>
            <input type="number" value={strikePrice} onChange={e => setStrikePrice(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', marginTop: '4px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#c084fc' }}>Lot Size (Qty)</label>
            <input type="number" value={lotSize} onChange={e => setLotSize(Math.max(1, Number(e.target.value)))} style={{ width: '100%', padding: '6px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '6px', color: '#e9d5ff', fontWeight: '700', marginTop: '4px', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Days to Expiry: <strong>{daysToExpiry} Days</strong></label>
          <input type="range" min="1" max="60" step="1" value={daysToExpiry} onChange={e => setDaysToExpiry(Number(e.target.value))} style={{ width: '100%', accentColor: '#a855f7', marginTop: '6px' }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Implied Volatility: <strong>{ivPct}%</strong></label>
          <input type="range" min="5" max="80" step="0.5" value={ivPct} onChange={e => setIvPct(Number(e.target.value))} style={{ width: '100%', accentColor: '#a855f7', marginTop: '6px' }} />
        </div>
      </div>

      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {viewMode === 'CHART' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Theoretical Option Premium ({optionType})</div>
                <div style={{ fontSize: '38px', fontWeight: '900', color: '#a855f7', margin: '4px 0 12px' }}>₹{greeks.price}</div>
              </div>
              <div style={{ background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '10px', padding: '8px 12px', textAlign: 'right' }}>
                <div style={{ fontSize: '10.5px', color: '#e9d5ff', fontWeight: '700', textTransform: 'uppercase' }}>1 Lot Value ({lotSize} Qty)</div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#c084fc' }}>₹{greeks.lotValue.toLocaleString('en-IN')}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Est. F&O Charges: ₹{greeks.fnOCharges}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Δ Delta</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#38bdf8' }}>{greeks.delta}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Γ Gamma</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#f8fafc' }}>{greeks.gamma}</div>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.08)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#f87171' }}>Θ Theta Decay</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#fca5a5' }}>₹{greeks.theta}/d (₹{greeks.lotTheta}/lot)</div>
              </div>
              <div style={{ background: 'rgba(168,85,247,0.08)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#c084fc' }}>V Vega</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#e9d5ff' }}>₹{greeks.vega}</div>
              </div>
            </div>

            {/* Intrinsic vs Time Value Bar */}
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#cbd5e1', marginBottom: '6px' }}>
                <span>Intrinsic: ₹{greeks.intrinsic} ({greeks.intrinsicPct}%)</span>
                <span>Time Value: ₹{greeks.extrinsic} ({(100 - Number(greeks.intrinsicPct)).toFixed(1)}%)</span>
              </div>
              <div style={{ height: '12px', width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${greeks.intrinsicPct}%`, background: '#10b981', height: '100%' }} />
                <div style={{ flex: 1, background: '#a855f7', height: '100%' }} />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#c084fc', marginBottom: '10px' }}>
              Multi-Strike Option Chain & Greeks Sensitivity Matrix
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Strike</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Call (CE)</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Put (PE)</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Δ ({optionType})</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Θ/day</th>
                </tr>
              </thead>
              <tbody>
                {greeks.chainRows.map(row => (
                  <tr
                    key={row.strike}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: row.isSelected ? 'rgba(168, 85, 247, 0.16)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '8px', fontWeight: '700', color: row.isSelected ? '#e9d5ff' : '#f8fafc' }}>
                      ₹{row.strike.toLocaleString('en-IN')} {row.isSelected ? '★' : ''}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#34d399', fontWeight: '700' }}>₹{row.callLtp}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#f87171', fontWeight: '700' }}>₹{row.putLtp}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#38bdf8' }}>{row.delta}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#fca5a5' }}>₹{row.theta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={handleExport} style={{ marginTop: '16px', padding: '10px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.35)', color: '#c084fc', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Download size={14} /> Export Option Chain & Greeks Matrix (CSV)
        </button>
      </div>
    </div>
  );
}

