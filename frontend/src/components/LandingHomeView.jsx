// frontend/src/components/LandingHomeView.jsx
// 🌟 Institutional 6-Hub Fintech Command Center (Live Telemetry, 0ms Chunk Prefetch, Deep-Linked SEO & Zero Dummy Buttons)

import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { 
  TrendingUp, BookOpen, Building2, Calculator, Link2, 
  Sparkles, ShieldCheck, ArrowRight, CheckCircle2, ChevronRight, 
  BarChart2, Award, Zap, Layers, Cpu, PieChart, Scissors, 
  HeartPulse, Wallet, Bot, Globe, Shield, RefreshCw, Search,
  ChevronDown, Flame, DollarSign, Target, Activity, ArrowUpRight, FileSpreadsheet
} from 'lucide-react';

export default function LandingHomeView({
  onOpenPaperTrading,
  onOpenOptionChain,
  onOpenTradeDiary,
  onOpenPrimaryMarkets,
  onOpenCalculators,
  onOpenBrokerConnect,
  onOpenWealthFinance,
  onOpenMutualFunds,
  onOpenLeaderboard,
  onOpenAlgoBridge
}) {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const { user, prices, positions, orders, setSelectedSymbol } = useStore(
    useShallow(state => ({
      user: state.user,
      prices: state.prices,
      positions: state.positions,
      orders: state.orders,
      setSelectedSymbol: state.setSelectedSymbol
    }))
  );

  // Prefetch lazy chunks on hover so clicking any Hub opens in 0ms under high load
  const prefetchHubChunk = (hubId) => {
    try {
      if (hubId === 2) import('./TradeDiaryView');
      else if (hubId === 3) import('./PrimaryMarketsView');
      else if (hubId === 4) import('./CalculatorsSuiteView');
      else if (hubId === 5) import('./WealthPersonalFinanceModal');
      else if (hubId === 6) import('./SkandxAlgoView');
    } catch (_) {}
  };

  // Real-Time Live Tickers wired to WebSocket / Store prices with instant click-to-chart action
  const LIVE_TICKERS = useMemo(() => {
    const resolvePrice = (keys, fallbackLtp, fallbackChange, fallbackUp) => {
      for (const k of keys) {
        const p = prices?.[k];
        if (p && Number(p.ltp) > 0) {
          const ltpNum = Number(p.ltp);
          const chNum = Number(p.ch ?? p.change ?? 0);
          const chpNum = Number(p.chp ?? p.pct ?? 0);
          const isUp = chNum >= 0;
          return {
            ltp: ltpNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            change: `${isUp ? '+' : ''}${chNum.toFixed(2)} (${isUp ? '+' : ''}${chpNum.toFixed(2)}%)`,
            isUp
          };
        }
      }
      return { ltp: fallbackLtp, change: fallbackChange, isUp: fallbackUp };
    };

    return [
      { label: 'NIFTY 50', targetSymbol: 'NSE:NIFTY50-INDEX', ...resolvePrice(['NSE:NIFTY50-INDEX', 'NIFTY50-INDEX', 'NIFTY 50'], '25,014.60', '+104.20 (+0.42%)', true) },
      { label: 'SENSEX', targetSymbol: 'BSE:SENSEX-INDEX', ...resolvePrice(['BSE:SENSEX-INDEX', 'SENSEX-INDEX', 'SENSEX'], '81,688.45', '+310.80 (+0.38%)', true) },
      { label: 'BANK NIFTY', targetSymbol: 'NSE:NIFTYBANK-INDEX', ...resolvePrice(['NSE:NIFTYBANK-INDEX', 'NIFTYBANK-INDEX', 'BANKNIFTY'], '51,462.10', '+318.50 (+0.62%)', true) },
      { label: 'FINNIFTY', targetSymbol: 'NSE:FINNIFTY-INDEX', ...resolvePrice(['NSE:FINNIFTY-INDEX', 'FINNIFTY-INDEX'], '23,890.75', '+120.30 (+0.51%)', true) },
      { label: 'RELIANCE', targetSymbol: 'NSE:RELIANCE-EQ', ...resolvePrice(['NSE:RELIANCE-EQ', 'RELIANCE-EQ', 'RELIANCE'], '1,294.50', '+14.80 (+1.16%)', true) },
      { label: 'TCS', targetSymbol: 'NSE:TCS-EQ', ...resolvePrice(['NSE:TCS-EQ', 'TCS-EQ', 'TCS'], '4,142.00', '+32.40 (+0.79%)', true) },
      { label: 'GOLD1 ETF', targetSymbol: 'NSE:GOLD1-EQ', ...resolvePrice(['NSE:GOLD1-EQ', 'GOLD1-EQ'], '122.74', '+0.45 (+0.37%)', true) },
      { label: 'EGOLD', targetSymbol: 'NSE:EGOLD-EQ', ...resolvePrice(['NSE:EGOLD-EQ', 'EGOLD-EQ'], '146.85', '+0.60 (+0.41%)', true) }
    ];
  }, [prices]);

  // Live Account & Session Telemetry
  const liveTelemetry = useMemo(() => {
    const balance = Number(user?.balance ?? 1000000);
    const activePositions = (positions || []).filter(p => Number(p.quantity) !== 0);
    const todayOrders = (orders || []).filter(o => o.status === 'EXECUTED' || o.status === 'COMPLETED');
    let realizedPnl = 0;
    todayOrders.forEach(o => {
      if (o.realized_pnl !== undefined && o.realized_pnl !== null) {
        realizedPnl += Number(o.realized_pnl) || 0;
      }
    });
    return {
      balance,
      openCount: activePositions.length,
      executedCount: todayOrders.length,
      realizedPnl
    };
  }, [user?.balance, positions, orders]);

  const handleTickerClick = (symbol) => {
    if (typeof setSelectedSymbol === 'function' && symbol) {
      setSelectedSymbol(symbol);
    }
    if (onOpenPaperTrading) onOpenPaperTrading();
  };

  const scrollToHubs = () => {
    const el = document.getElementById('hubs-command-center');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const HUBS = [
    {
      id: 1,
      hubNum: '01',
      category: 'TRADING',
      title: 'Paper Trading Terminal',
      shortDesc: 'Trade NSE/BSE Equities, F&O & Futures with ₹10,00,000 live virtual capital.',
      icon: TrendingUp,
      color: '#0284c7',
      gradient: 'linear-gradient(135deg, rgba(2, 132, 199, 0.24), rgba(15, 23, 42, 0.92))',
      border: 'rgba(56, 189, 248, 0.35)',
      badge: 'Free ₹10L Capital',
      badgeColor: '#38bdf8',
      kpiLeft: { label: 'Virtual Margin', value: `₹${(liveTelemetry.balance / 100000).toFixed(2)}L` },
      kpiRight: { label: 'Active Positions', value: `${liveTelemetry.openCount} Open` },
      tags: ['Live WebSockets', 'F&O Options Chain', 'Bracket Orders', 'TradingView Charts'],
      tagActions: {
        'Live WebSockets': () => onOpenPaperTrading(),
        'F&O Options Chain': () => (onOpenOptionChain ? onOpenOptionChain() : onOpenPaperTrading()),
        'Bracket Orders': () => onOpenPaperTrading(),
        'TradingView Charts': () => onOpenPaperTrading()
      },
      actionLabel: 'Launch Terminal Now',
      primaryAction: onOpenPaperTrading,
      quickLinks: [
        { label: 'Live Terminal', action: onOpenPaperTrading },
        { label: 'Option Chain', action: () => (onOpenOptionChain ? onOpenOptionChain() : onOpenPaperTrading()) },
        { label: 'Mutual Funds Desk', action: () => (onOpenMutualFunds ? onOpenMutualFunds() : onOpenPaperTrading()) },
        { label: 'Trader Leaderboard', action: () => (onOpenLeaderboard ? onOpenLeaderboard() : onOpenPaperTrading()) }
      ]
    },
    {
      id: 2,
      hubNum: '02',
      category: 'TRADING',
      title: '8-Pillar Trade Diary & Journal',
      shortDesc: 'Institutional journaling covering checklists, strategies, discipline rules & leaks.',
      icon: BookOpen,
      color: '#818cf8',
      gradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.24), rgba(15, 23, 42, 0.92))',
      border: 'rgba(129, 140, 248, 0.35)',
      badge: '8 Core Pillars',
      badgeColor: '#818cf8',
      kpiLeft: { label: 'Architecture', value: '8-Pillar Audit' },
      kpiRight: { label: 'Export Ready', value: 'CSV & Print PDF' },
      tags: ['Checklist', 'Trades', 'Strategies', 'Rules', 'Mistakes', 'AI Summary', 'Reports', 'Risk'],
      tagActions: {
        'Checklist': () => onOpenTradeDiary('CHECKLIST'),
        'Trades': () => onOpenTradeDiary('TRADES'),
        'Strategies': () => onOpenTradeDiary('STRATEGIES'),
        'Rules': () => onOpenTradeDiary('RULES'),
        'Mistakes': () => onOpenTradeDiary('MISTAKES'),
        'AI Summary': () => onOpenTradeDiary('AI_SUMMARY'),
        'Reports': () => onOpenTradeDiary('REPORTS'),
        'Risk': () => onOpenTradeDiary('RISK')
      },
      actionLabel: 'Open Trade Diary',
      primaryAction: () => onOpenTradeDiary('CHECKLIST'),
      quickLinks: [
        { label: 'Pre-Trade Checklist', action: () => onOpenTradeDiary('CHECKLIST') },
        { label: 'Strategy & Mistake Matrix', action: () => onOpenTradeDiary('STRATEGIES') },
        { label: 'AI Journal Summarizer', action: () => onOpenTradeDiary('AI_SUMMARY') },
        { label: 'Risk & Leak Detector', action: () => onOpenTradeDiary('RISK') }
      ]
    },
    {
      id: 3,
      hubNum: '03',
      category: 'MARKETS',
      title: 'Bhavcopy Screener & Deals Hub',
      shortDesc: 'Daily NSE delivery tracker (>60%), 2x+ surges, Bulk/Block deals & 1-click IPO allotment.',
      icon: Building2,
      color: '#10b981',
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.24), rgba(15, 23, 42, 0.92))',
      border: 'rgba(16, 185, 129, 0.35)',
      badge: '₹0 NSE Feed',
      badgeColor: '#10b981',
      kpiLeft: { label: 'Delivery Filter', value: '>60% Institutional' },
      kpiRight: { label: 'Primary Desk', value: 'IPO GMP & Deals' },
      tags: ['5:35 PM Daily Cron', 'Bulk & Block Deals', 'Live GMP', 'PAN Allotment'],
      tagActions: {
        '5:35 PM Daily Cron': () => onOpenPrimaryMarkets('BHAVCOPY'),
        'Bulk & Block Deals': () => onOpenPrimaryMarkets('DEALS'),
        'Live GMP': () => onOpenPrimaryMarkets('IPO'),
        'PAN Allotment': () => onOpenPrimaryMarkets('ALLOTMENT')
      },
      actionLabel: 'Explore Primary Markets',
      primaryAction: () => onOpenPrimaryMarkets('BHAVCOPY'),
      quickLinks: [
        { label: 'NSE Delivery Screener (>60%)', action: () => onOpenPrimaryMarkets('BHAVCOPY') },
        { label: 'Bulk & Block Deals Tape', action: () => onOpenPrimaryMarkets('DEALS') },
        { label: 'IPO & SME GMP Hub', action: () => onOpenPrimaryMarkets('IPO') },
        { label: '1-Click PAN IPO Allotment', action: () => onOpenPrimaryMarkets('ALLOTMENT') }
      ]
    },
    {
      id: 4,
      hubNum: '04',
      category: 'CALCULATORS',
      title: 'Financial Calculators Suite & AI Wealth Planning',
      shortDesc: 'Comprehensive Fyers-style institutional calculators: Reducing & Flat EMI Loans, SIP Compounder, MTF 4x Leverage, Averaging, Mutual Funds, STT & AI Wealth Copilot.',
      icon: Calculator,
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.24), rgba(15, 23, 42, 0.92))',
      border: 'rgba(245, 158, 11, 0.35)',
      badge: 'Full Suite + PDF/Excel',
      badgeColor: '#f59e0b',
      kpiLeft: { label: 'Active Engines', value: '10 Calculators' },
      kpiRight: { label: 'Schedules', value: 'Chart + PDF/Excel' },
      tags: ['Reducing Loan EMI', 'Fixed Loan', 'Average Price', 'MTF 4x', 'SIP & Step-Up', 'Mutual Funds', 'AI Tax Copilot', 'Export Schedules'],
      tagActions: {
        'Reducing Loan EMI': () => onOpenCalculators('reducing-loan'),
        'Fixed Loan': () => onOpenCalculators('fixed-loan'),
        'Average Price': () => onOpenCalculators('average-price'),
        'MTF 4x': () => onOpenCalculators('mtf'),
        'SIP & Step-Up': () => onOpenCalculators('sip'),
        'Mutual Funds': () => onOpenCalculators('mutual-funds'),
        'AI Tax Copilot': () => onOpenWealthFinance('AI_COPILOT'),
        'Export Schedules': () => onOpenCalculators('all')
      },
      actionLabel: 'Launch Full Calculator Suite',
      primaryAction: () => onOpenCalculators('all'),
      quickLinks: [
        { label: 'All Calculators Catalog', action: () => onOpenCalculators('all') },
        { label: 'Reducing Loan EMI (Home/Car)', action: () => onOpenCalculators('reducing-loan') },
        { label: 'Fixed / Flat Rate Loan', action: () => onOpenCalculators('fixed-loan') },
        { label: 'Average Share Price', action: () => onOpenCalculators('average-price') },
        { label: 'MTF Financing (4x Leverage)', action: () => onOpenCalculators('mtf') },
        { label: 'SIP & Step-Up Compounder', action: () => onOpenCalculators('sip') },
        { label: 'Mutual Funds & Fee Savings', action: () => onOpenCalculators('mutual-funds') },
        { label: 'AI Wealth Copilot & Tax Advisory', action: () => onOpenWealthFinance('AI_COPILOT') }
      ]
    },
    {
      id: 5,
      hubNum: '05',
      category: 'WEALTH',
      title: 'Wealth OS & Tax Hub',
      shortDesc: 'Complete 360° personal financial command center: Multi-asset net worth tracking, 50/30/20 budget & leak detector, actuarial term/health HLV gap, and FY25 tax-loss harvesting.',
      icon: PieChart,
      color: '#10b981',
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.24), rgba(15, 23, 42, 0.92))',
      border: 'rgba(16, 185, 129, 0.35)',
      badge: '360° Financial Cockpit',
      badgeColor: '#10b981',
      kpiLeft: { label: 'Tax Regime', value: 'FY25 STCG/LTCG' },
      kpiRight: { label: 'Protection', value: 'Actuarial HLV + Solvency' },
      tags: ['Consolidated Net Worth', '50/30/20 Budget', 'Expense Leaks', 'Actuarial HLV Gap', 'Family Floater', 'Tax-Loss Harvesting FY25', 'STCG 20% / LTCG 12.5%'],
      tagActions: {
        'Consolidated Net Worth': () => onOpenWealthFinance('NET_WORTH'),
        '50/30/20 Budget': () => onOpenWealthFinance('BUDGET'),
        'Expense Leaks': () => onOpenWealthFinance('BUDGET'),
        'Actuarial HLV Gap': () => onOpenWealthFinance('INSURANCE'),
        'Family Floater': () => onOpenWealthFinance('INSURANCE'),
        'Tax-Loss Harvesting FY25': () => onOpenWealthFinance('TAX_LOSS'),
        'STCG 20% / LTCG 12.5%': () => onOpenWealthFinance('TAX_LOSS')
      },
      actionLabel: 'Launch Wealth OS & Tax Hub',
      primaryAction: () => onOpenWealthFinance('NET_WORTH'),
      quickLinks: [
        { label: 'Consolidated Net Worth & Solvency', action: () => onOpenWealthFinance('NET_WORTH') },
        { label: '50/30/20 Budget & Leak Detector', action: () => onOpenWealthFinance('BUDGET') },
        { label: 'Term Life & Health Protection Gap (HLV)', action: () => onOpenWealthFinance('INSURANCE') },
        { label: 'Tax-Loss Harvesting (Budget FY25)', action: () => onOpenWealthFinance('TAX_LOSS') },
        { label: '24/7 AI Wealth Copilot Advisory', action: () => onOpenWealthFinance('AI_COPILOT') }
      ]
    },
    {
      id: 6,
      hubNum: '06',
      category: 'TRADING',
      title: 'SkandX Algo Multi-Broker Demat & Bridge Suite',
      shortDesc: 'Multi-broker Demat connection, Dedicated Static IPs, TradingView JSON Webhook Bridge & copy trading.',
      icon: Cpu,
      color: '#0284c7',
      gradient: 'linear-gradient(135deg, rgba(2, 132, 199, 0.24), rgba(15, 23, 42, 0.92))',
      border: 'rgba(56, 189, 248, 0.35)',
      badge: 'SKANDX ALGO PRO',
      badgeColor: '#38bdf8',
      kpiLeft: { label: 'Supported Brokers', value: 'Zerodha, Fyers, Dhan+' },
      kpiRight: { label: 'Bridge Latency', value: '<15ms Webhook' },
      tags: ['Share Demat Link', 'Demat API Keys', 'Static IPs', 'JSON Webhook Bridge', 'TradingView Alerts'],
      tagActions: {
        'Share Demat Link': () => onOpenAlgoBridge('SHARE_LINK'),
        'Demat API Keys': () => onOpenAlgoBridge('API_KEYS'),
        'Static IPs': () => onOpenAlgoBridge('STATIC_IP'),
        'JSON Webhook Bridge': () => onOpenAlgoBridge('WEBHOOK'),
        'TradingView Alerts': () => onOpenAlgoBridge('WEBHOOK')
      },
      actionLabel: 'Launch SkandX Algo Console',
      primaryAction: () => (onOpenAlgoBridge ? onOpenAlgoBridge('SHARE_LINK') : onOpenPaperTrading()),
      quickLinks: [
        { label: 'Share Demat Link', action: () => onOpenAlgoBridge('SHARE_LINK') },
        { label: 'Demat API Keys & Credentials', action: () => onOpenAlgoBridge('API_KEYS') },
        { label: 'Dedicated Static IP Routing', action: () => onOpenAlgoBridge('STATIC_IP') },
        { label: 'JSON Webhook Bridge', action: () => onOpenAlgoBridge('WEBHOOK') }
      ]
    }
  ];

  const SPOTLIGHT_TOOLS = [
    { label: '🧮 SIP & Step-Up Calculator', action: () => onOpenCalculators('sip'), color: '#38bdf8' },
    { label: '🏠 Reducing Balance Loan EMI', action: () => onOpenCalculators('reducing-loan'), color: '#10b981' },
    { label: '🏦 Fixed / Flat Rate Loan', action: () => onOpenCalculators('fixed-loan'), color: '#f59e0b' },
    { label: '⚡ MTF 4x Leverage Calculator', action: () => onOpenCalculators('mtf'), color: '#a855f7' },
    { label: '📉 Share Price Averaging', action: () => onOpenCalculators('average-price'), color: '#06b6d4' },
    { label: '✂️ FY25 Tax-Loss Harvester', action: () => onOpenWealthFinance('TAX_LOSS'), color: '#ec4899' },
    { label: '🏛️ Live IPO GMP & Allotment', action: () => onOpenPrimaryMarkets('IPO'), color: '#34d399' },
    { label: '🤖 TradingView Webhook Bridge', action: () => onOpenAlgoBridge('WEBHOOK'), color: '#60a5fa' }
  ];

  const filteredHubs = useMemo(() => {
    return HUBS.filter(hub => {
      const matchCat = selectedCategory === 'ALL' || hub.category === selectedCategory;
      const matchSearch = !searchQuery.trim() || 
        hub.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hub.shortDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hub.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        hub.quickLinks.some(q => q.label.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [selectedCategory, searchQuery, liveTelemetry]);

  return (
    <div style={{
      width: '100%',
      minHeight: '100%',
      backgroundColor: 'var(--bg-main, #090d16)',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative'
    }}>
      {/* 1. Real-Time Clickable Ticker Tape Header */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.96)',
        borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        padding: '6px 16px',
        overflowX: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        fontSize: '11.5px',
        position: 'sticky',
        top: 0,
        zIndex: 60
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: '800', whiteSpace: 'nowrap' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
          LIVE NSE/BSE (CLICK TO CHART):
        </div>
        <div style={{ display: 'flex', gap: '12px', whiteSpace: 'nowrap' }}>
          {LIVE_TICKERS.map((t, idx) => (
            <button
              key={idx}
              onClick={() => handleTickerClick(t.targetSymbol)}
              title={`Open ${t.label} Live Chart in Paper Trading`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: '6px',
                padding: '3px 9px',
                cursor: 'pointer',
                color: '#f8fafc',
                fontSize: '11.5px'
              }}
            >
              <span style={{ fontWeight: '700', color: '#cbd5e1' }}>{t.label}</span>
              <span style={{ fontWeight: '800', color: '#f8fafc' }}>{t.ltp}</span>
              <span style={{ color: t.isUp ? '#10b981' : '#ef4444', fontWeight: '700' }}>
                {t.change}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Top Navigation Bar */}
      <header style={{
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: '34px',
        zIndex: 50,
        background: 'rgba(9, 13, 22, 0.92)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={scrollToHubs}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284c7, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(56, 189, 248, 0.4)'
          }}>
            <TrendingUp size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: '900', fontSize: '17px', letterSpacing: '0.5px', background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                SKANDX
              </span>
              <span style={{ fontSize: '9.5px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>
                PRO
              </span>
            </div>
            <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>Institutional Trading & Wealth OS</span>
          </div>
        </div>

        {/* Desktop Quick Jump Links */}
        <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button 
            onClick={scrollToHubs}
            style={{ padding: '6px 12px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span>Explore Hubs</span>
            <ChevronDown size={14} />
          </button>
          <button 
            onClick={() => onOpenTradeDiary('CHECKLIST')}
            onMouseEnter={() => prefetchHubChunk(2)}
            style={{ padding: '6px 12px', background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '12.5px', fontWeight: '500', cursor: 'pointer', borderRadius: '6px' }}
          >
            Trade Diary
          </button>
          <button 
            onClick={() => onOpenPrimaryMarkets('BHAVCOPY')}
            onMouseEnter={() => prefetchHubChunk(3)}
            style={{ padding: '6px 12px', background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '12.5px', fontWeight: '500', cursor: 'pointer', borderRadius: '6px' }}
          >
            Bhavcopy & IPO Hub
          </button>
          <button 
            onClick={() => onOpenCalculators('all')}
            onMouseEnter={() => prefetchHubChunk(4)}
            style={{ padding: '6px 12px', background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '12.5px', fontWeight: '500', cursor: 'pointer', borderRadius: '6px' }}
          >
            Calculators & Loans
          </button>
          <button 
            onClick={() => onOpenWealthFinance('NET_WORTH')}
            onMouseEnter={() => prefetchHubChunk(5)}
            style={{ padding: '6px 12px', background: 'transparent', border: 'none', color: '#10b981', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <PieChart size={13} /> Wealth OS & Tax
          </button>
          <button 
            onClick={() => onOpenAlgoBridge('SHARE_LINK')}
            onMouseEnter={() => prefetchHubChunk(6)}
            style={{ padding: '6px 12px', background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '12.5px', fontWeight: '500', cursor: 'pointer', borderRadius: '6px' }}
          >
            SkandX Algo
          </button>
        </div>

        {/* Direct Action Button */}
        <button
          onClick={onOpenPaperTrading}
          style={{
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #0284c7, #2563eb)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '8px',
            color: '#fff',
            fontWeight: '700',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            boxShadow: '0 0 16px rgba(2, 132, 199, 0.35)'
          }}
        >
          <Zap size={14} /> Launch Paper Trading
        </button>
      </header>

      {/* 3. Hero Banner with Instant Spotlight Tool Launcher */}
      <section style={{
        padding: '32px 20px 20px',
        maxWidth: '1240px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Subtle Feature Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '16px',
          color: '#38bdf8',
          fontSize: '11.5px',
          fontWeight: '600',
          marginBottom: '14px'
        }}>
          <Sparkles size={13} />
          <span>1 Lakh+ Concurrent User Cluster • Zero-Risk ₹10L Virtual Capital • Institutional Calculators & Tax OS</span>
        </div>

        {/* Hero Headline */}
        <h1 style={{
          fontSize: 'clamp(26px, 4.2vw, 48px)',
          fontWeight: '900',
          lineHeight: '1.16',
          margin: '0 0 14px',
          letterSpacing: '-0.5px',
          maxWidth: '900px'
        }}>
          Master Markets with <span style={{ background: 'linear-gradient(to right, #38bdf8, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>₹10,00,000 Virtual Capital</span> & 6 Institutional Powerhouse Hubs
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 'clamp(13px, 1.6vw, 15px)',
          color: '#94a3b8',
          lineHeight: '1.55',
          maxWidth: '760px',
          margin: '0 0 22px'
        }}>
          Practice risk-free with live NSE/BSE/MCX WebSocket ticks, run Reducing & Fixed Loan amortization schedules, audit your 360° Net Worth & FY25 Taxes, and automate TradingView Webhooks.
        </p>

        {/* Primary Action Row */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <button
            onClick={onOpenPaperTrading}
            style={{
              padding: '13px 26px',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontWeight: '800',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(2, 132, 199, 0.45)'
            }}
          >
            <TrendingUp size={18} />
            Launch Paper Trading (Free ₹10L)
            <ArrowRight size={16} />
          </button>

          <button
            onClick={() => onOpenCalculators('all')}
            onMouseEnter={() => prefetchHubChunk(4)}
            style={{
              padding: '13px 22px',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '10px',
              color: '#fbbf24',
              fontWeight: '700',
              fontSize: '14.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <Calculator size={16} color="#fbbf24" />
            Financial & Loan Calculators
          </button>

          <button
            onClick={() => onOpenWealthFinance('NET_WORTH')}
            onMouseEnter={() => prefetchHubChunk(5)}
            style={{
              padding: '13px 22px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '10px',
              color: '#34d399',
              fontWeight: '700',
              fontSize: '14.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <PieChart size={16} color="#10b981" />
            Wealth OS & Tax Hub
          </button>
        </div>

        {/* 1-Click Direct Tool Spotlight Launcher */}
        <div style={{
          maxWidth: '1040px',
          width: '100%',
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '12px 16px',
          marginBottom: '14px'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
            ⚡ Instant 1-Click Tool Launcher (Direct Access):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px' }}>
            {SPOTLIGHT_TOOLS.map((tool, idx) => (
              <button
                key={idx}
                onClick={tool.action}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${tool.color}35`,
                  color: '#e2e8f0',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{tool.label}</span>
                <ArrowUpRight size={12} color={tool.color} />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Real Live Account & Market Telemetry Bar */}
      <section style={{
        maxWidth: '1240px',
        margin: '0 auto',
        width: '100%',
        padding: '0 20px 24px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(2, 132, 199, 0.14))',
          border: '1px solid rgba(56, 189, 248, 0.28)',
          borderRadius: '16px',
          padding: '18px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981'
            }}>
              <Activity size={24} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
                {user?.username ? `Live Trading Desk • ${user.username}` : 'Live Simulated Trading Desk'}
              </div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                ₹{Math.round(liveTelemetry.balance).toLocaleString('en-IN')} Available Virtual Capital
              </div>
              <div style={{ fontSize: '12px', color: liveTelemetry.realizedPnl >= 0 ? '#34d399' : '#f87171', fontWeight: '600' }}>
                Open Positions: {liveTelemetry.openCount} • Executed Orders: {liveTelemetry.executedCount} • Realized P&L: {liveTelemetry.realizedPnl >= 0 ? '+' : ''}₹{liveTelemetry.realizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleTickerClick('NSE:NIFTY50-INDEX')}
              style={{
                padding: '9px 16px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '8px',
                color: '#34d399',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>Chart Nifty 50 Live</span>
              <ArrowUpRight size={14} />
            </button>
            <button
              onClick={() => (onOpenOptionChain ? onOpenOptionChain() : onOpenPaperTrading())}
              style={{
                padding: '9px 16px',
                background: 'rgba(129, 140, 248, 0.15)',
                border: '1px solid rgba(129, 140, 248, 0.35)',
                borderRadius: '8px',
                color: '#a5b4fc',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>Live Option Chain</span>
              <Layers size={14} />
            </button>
            <button
              onClick={onOpenPaperTrading}
              style={{
                padding: '9px 18px',
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 16px rgba(2, 132, 199, 0.35)'
              }}
            >
              <span>Open Trading Terminal</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* 5. The 6-Hub Institutional Command Center */}
      <section 
        id="hubs-command-center" 
        style={{
          maxWidth: '1240px',
          margin: '0 auto',
          width: '100%',
          padding: '10px 20px 48px'
        }}
      >
        {/* Section Header */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: '16px',
          gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
              <Sparkles size={14} />
              <span>Full Platform Ecosystem</span>
            </div>
            <h2 style={{ fontSize: '26px', fontWeight: '900', color: '#f8fafc', margin: 0 }}>
              6 Specialized Platform Hubs & Suites
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
              Click any Hub card, tag pill, or shortcut below to jump straight into that tool.
            </p>
          </div>

          {/* Quick Search Input */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '10px',
            padding: '8px 14px',
            minWidth: '280px',
            maxWidth: '380px'
          }}>
            <Search size={15} color="#38bdf8" />
            <input 
              type="text"
              placeholder="Search tools (e.g. Loan, SIP, Tax, Algo, IPO)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '12.5px',
                width: '100%',
                outline: 'none'
              }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '14px',
          marginBottom: '18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          {[
            { id: 'ALL', label: `All Hubs (${HUBS.length})` },
            { id: 'TRADING', label: `📈 Trading & Algo (${HUBS.filter(h => h.category === 'TRADING').length})` },
            { id: 'MARKETS', label: `🏛️ Primary Markets & IPO (${HUBS.filter(h => h.category === 'MARKETS').length})` },
            { id: 'CALCULATORS', label: `🧮 Financial & Loan Calculators (${HUBS.filter(h => h.category === 'CALCULATORS').length})` },
            { id: 'WEALTH', label: `💰 Wealth OS & Tax Hub (${HUBS.filter(h => h.category === 'WEALTH').length})` }
          ].map(cat => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  border: 'none',
                  background: isActive ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'rgba(255, 255, 255, 0.04)',
                  color: isActive ? '#fff' : '#94a3b8',
                  fontSize: '12.5px',
                  fontWeight: isActive ? '700' : '500',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* 6-Hub Grid Cards */}
        {filteredHubs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
            No tools found matching "{searchQuery}". Try searching for "SIP", "Loan", "IPO", "Option", or "Tax".
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '20px'
          }}>
            {filteredHubs.map(hub => {
              const Icon = hub.icon;
              return (
                <div
                  key={hub.id}
                  onMouseEnter={() => prefetchHubChunk(hub.id)}
                  style={{
                    background: hub.gradient,
                    border: `1px solid ${hub.border}`,
                    borderRadius: '18px',
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
                    transition: 'transform 0.2s ease, border-color 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Faint Hub Number Watermark */}
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '14px',
                    fontSize: '46px',
                    fontWeight: '900',
                    color: 'rgba(255, 255, 255, 0.03)',
                    userSelect: 'none',
                    pointerEvents: 'none'
                  }}>
                    {hub.hubNum}
                  </div>

                  <div>
                    {/* Header: Icon, Number & Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '11px',
                          background: `${hub.color}22`,
                          border: `1px solid ${hub.color}55`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: hub.color,
                          flexShrink: 0
                        }}>
                          <Icon size={22} />
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '800', letterSpacing: '0.8px' }}>
                            HUB {hub.hubNum}
                          </span>
                          <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: '800', color: '#f8fafc', lineHeight: '1.22' }}>
                            {hub.title}
                          </h3>
                        </div>
                      </div>

                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: '700',
                        color: hub.badgeColor,
                        background: `${hub.color}18`,
                        border: `1px solid ${hub.color}35`,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        whiteSpace: 'nowrap'
                      }}>
                        {hub.badge}
                      </span>
                    </div>

                    {/* Description */}
                    <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: '#94a3b8', lineHeight: '1.48' }}>
                      {hub.shortDesc}
                    </p>

                    {/* Live Mini Telemetry Strip inside Hub Card */}
                    {hub.kpiLeft && hub.kpiRight && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        marginBottom: '12px',
                        padding: '8px 10px',
                        borderRadius: '10px',
                        background: 'rgba(0, 0, 0, 0.28)',
                        border: '1px solid rgba(255, 255, 255, 0.06)'
                      }}>
                        <div>
                          <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>{hub.kpiLeft.label}</div>
                          <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#e2e8f0', marginTop: '1px' }}>{hub.kpiLeft.value}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>{hub.kpiRight.label}</div>
                          <div style={{ fontSize: '12.5px', fontWeight: '800', color: hub.badgeColor, marginTop: '1px' }}>{hub.kpiRight.value}</div>
                        </div>
                      </div>
                    )}

                    {/* Interactive Deep-Linked Tag Pills (100% Real Actionable Buttons!) */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                      {hub.tags.map((tag, tIdx) => (
                        <button
                          key={tIdx}
                          type="button"
                          onClick={() => {
                            const fn = hub.tagActions?.[tag] || hub.primaryAction;
                            if (fn) fn();
                          }}
                          title={`Open ${tag}`}
                          style={{
                            fontSize: '10.5px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: '#e2e8f0',
                            padding: '3px 8px',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {tag} ↗
                        </button>
                      ))}
                    </div>

                    {/* Direct Shortcut Sub-links */}
                    {hub.quickLinks && hub.quickLinks.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
                        {hub.quickLinks.map((ql, qIdx) => (
                          <button
                            key={qIdx}
                            type="button"
                            onClick={ql.action}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#38bdf8',
                              fontSize: '11.5px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              padding: '2px 0',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <span>• {ql.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* High-Impact Launch Button */}
                  <button
                    type="button"
                    onClick={hub.primaryAction}
                    style={{
                      width: '100%',
                      padding: '11px 16px',
                      background: `linear-gradient(135deg, ${hub.color}, ${hub.color}cc)`,
                      border: 'none',
                      borderRadius: '9px',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: `0 4px 14px ${hub.color}33`,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{hub.actionLabel}</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 6. High-Concurrency & Enterprise Performance Guarantee Banner */}
      <section style={{
        background: 'rgba(15, 23, 42, 0.7)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '28px 20px',
        width: '100%'
      }}>
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', flexShrink: 0 }}>
              <Zap size={18} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#f8fafc' }}>
                1 Lakh+ User Multi-Core Cluster
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#94a3b8', lineHeight: '1.4' }}>
                Singleflight request coalescing, zero-zlib WebSocket fan-out, and 50-connection pooled PostgreSQL engineered for 1,00,000+ active users.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#f8fafc' }}>
                Sub-Millisecond RAM Edge Cache
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#94a3b8', lineHeight: '1.4' }}>
                Live option chains, Bhavcopy screeners, and batch quotes served straight from RAM with zero database bottlenecks.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(129, 140, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', flexShrink: 0 }}>
              <Cpu size={18} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#f8fafc' }}>
                0ms Hover Chunk Prefetching
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#94a3b8', lineHeight: '1.4' }}>
                Intelligent bundle preloading and jittered WebSocket reconnection ensure instant page transitions without loading spinners.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Crawlable SEO Deep-Link Footer for Google Search Indexing */}
      <footer style={{
        marginTop: 'auto',
        background: 'rgba(0, 0, 0, 0.55)',
        padding: '28px 24px',
        fontSize: '12px',
        color: '#94a3b8'
      }}>
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          {/* SEO Direct Crawlable Links Row */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            paddingBottom: '16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            fontSize: '11.5px'
          }}>
            <span style={{ color: '#64748b', fontWeight: '700' }}>Direct Tools & Calculators:</span>
            <a href="/paper-trading" onClick={(e) => { e.preventDefault(); onOpenPaperTrading(); }} style={{ color: '#38bdf8', textDecoration: 'none' }}>Paper Trading India</a>
            <span>•</span>
            <a href="/calculators/sip" onClick={(e) => { e.preventDefault(); onOpenCalculators('sip'); }} style={{ color: '#cbd5e1', textDecoration: 'none' }}>SIP Calculator</a>
            <span>•</span>
            <a href="/calculators/reducing-loan" onClick={(e) => { e.preventDefault(); onOpenCalculators('reducing-loan'); }} style={{ color: '#cbd5e1', textDecoration: 'none' }}>Reducing Balance Loan EMI</a>
            <span>•</span>
            <a href="/calculators/fixed-loan" onClick={(e) => { e.preventDefault(); onOpenCalculators('fixed-loan'); }} style={{ color: '#cbd5e1', textDecoration: 'none' }}>Fixed Interest Loan Calculator</a>
            <span>•</span>
            <a href="/calculators/mtf" onClick={(e) => { e.preventDefault(); onOpenCalculators('mtf'); }} style={{ color: '#cbd5e1', textDecoration: 'none' }}>MTF 4x Calculator</a>
            <span>•</span>
            <a href="/calculators/average-price" onClick={(e) => { e.preventDefault(); onOpenCalculators('average-price'); }} style={{ color: '#cbd5e1', textDecoration: 'none' }}>Stock Average Calculator</a>
            <span>•</span>
            <a href="/calculators/brokerage" onClick={(e) => { e.preventDefault(); onOpenCalculators('brokerage'); }} style={{ color: '#cbd5e1', textDecoration: 'none' }}>NSE/BSE Brokerage & STT</a>
            <span>•</span>
            <a href="/wealth-hub" onClick={(e) => { e.preventDefault(); onOpenWealthFinance('NET_WORTH'); }} style={{ color: '#10b981', textDecoration: 'none' }}>Wealth OS & Tax Hub</a>
            <span>•</span>
            <a href="/algo-trading" onClick={(e) => { e.preventDefault(); onOpenAlgoBridge('SHARE_LINK'); }} style={{ color: '#38bdf8', textDecoration: 'none' }}>SkandX Algo Webhook Bridge</a>
            <span>•</span>
            <a href="/primary-markets" onClick={(e) => { e.preventDefault(); onOpenPrimaryMarkets('BHAVCOPY'); }} style={{ color: '#cbd5e1', textDecoration: 'none' }}>Bhavcopy & IPO GMP</a>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontWeight: '700', color: '#f8fafc', fontSize: '13px', marginBottom: '2px' }}>
                SKANDX PRO • High-Concurrency Trading & Wealth Operating System
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Paper trading simulator uses virtual currency for educational purposes. Fully compliant with Indian regulatory guidelines.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '12px', flexWrap: 'wrap' }}>
              <span style={{ cursor: 'pointer', color: '#cbd5e1' }} onClick={onOpenPaperTrading}>Paper Trading</span>
              <span style={{ cursor: 'pointer', color: '#cbd5e1' }} onClick={() => onOpenTradeDiary('CHECKLIST')}>Trade Diary</span>
              <span style={{ cursor: 'pointer', color: '#cbd5e1' }} onClick={() => onOpenPrimaryMarkets('BHAVCOPY')}>Bhavcopy & Deals</span>
              <span style={{ cursor: 'pointer', color: '#cbd5e1' }} onClick={() => onOpenCalculators('all')}>Calculators</span>
              <span style={{ cursor: 'pointer', color: '#10b981' }} onClick={() => onOpenWealthFinance('NET_WORTH')}>Wealth OS & Tax</span>
              <span style={{ cursor: 'pointer', color: '#38bdf8' }} onClick={() => onOpenAlgoBridge('SHARE_LINK')}>SkandX Algo</span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(148, 163, 184, 0.08)',
            fontSize: '11.5px'
          }}>
            <div style={{ color: '#64748b' }}>
              &copy; {new Date().getFullYear()} SkandX Technologies Pvt. Ltd. All rights reserved.
            </div>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
              <a href="/aboutus" style={{ color: '#94a3b8', textDecoration: 'none' }}>About Us</a>
              <a href="/pricing" style={{ color: '#94a3b8', textDecoration: 'none' }}>Pricing</a>
              <a href="/privacy-policy" style={{ color: '#94a3b8', textDecoration: 'none' }}>Privacy Policy</a>
              <a href="/terms" style={{ color: '#94a3b8', textDecoration: 'none' }}>Terms of Service</a>
              <a href="/risk-policy" style={{ color: '#94a3b8', textDecoration: 'none' }}>Risk Disclosure</a>
              <a href="/data-rights" style={{ color: '#94a3b8', textDecoration: 'none' }}>Data Rights (DPDP)</a>
              <a href="/accessibility" style={{ color: '#94a3b8', textDecoration: 'none' }}>Accessibility</a>
              <a href="/delete-account" style={{ color: '#f87171', textDecoration: 'none', fontWeight: '600' }}>Delete Account</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
