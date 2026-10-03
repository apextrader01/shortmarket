// frontend/src/components/LandingHomeView.jsx
// 🌟 Optimized 12-Hub Fintech Portal & Command Center (Compact, High-Converting & Instant Navigation)

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, BookOpen, Building2, Calculator, Link2, 
  Sparkles, ShieldCheck, ArrowRight, CheckCircle2, ChevronRight, 
  BarChart2, Award, Zap, Layers, Cpu, PieChart, Scissors, 
  HeartPulse, Wallet, Bot, Globe, Shield, RefreshCw, Search,
  Filter, Check, Star, Lock
} from 'lucide-react';

export default function LandingHomeView({
  onOpenPaperTrading,
  onOpenTradeDiary,
  onOpenPrimaryMarkets,
  onOpenCalculators,
  onOpenBrokerConnect,
  onOpenWealthFinance,
  onOpenMutualFunds,
  onOpenLeaderboard
}) {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const TICKERS = [
    { symbol: 'NIFTY 50', ltp: '25,014.60', change: '+104.20 (+0.42%)', isUp: true },
    { symbol: 'SENSEX', ltp: '81,688.45', change: '+310.80 (+0.38%)', isUp: true },
    { symbol: 'BANK NIFTY', ltp: '51,462.10', change: '+318.50 (+0.62%)', isUp: true },
    { symbol: 'NIFTY IT', ltp: '42,180.20', change: '-45.10 (-0.11%)', isUp: false },
    { symbol: 'FINNIFTY', ltp: '23,890.75', change: '+120.30 (+0.51%)', isUp: true },
    { symbol: 'INDIA VIX', ltp: '12.85', change: '-0.32 (-2.43%)', isUp: false },
    { symbol: 'GOLD (10g)', ltp: '₹76,450', change: '+180.00 (+0.24%)', isUp: true },
    { symbol: 'CRUDE OIL', ltp: '₹6,120', change: '-45.00 (-0.73%)', isUp: false }
  ];

  const HUBS = [
    {
      id: 1,
      hubNum: '01',
      category: 'TRADING',
      title: 'Paper Trading Terminal',
      shortDesc: 'Trade NSE/BSE Equities, F&O & Futures with ₹10,00,000 real-time virtual capital.',
      icon: TrendingUp,
      color: '#0284c7',
      gradient: 'linear-gradient(135deg, rgba(2, 132, 199, 0.18), rgba(56, 189, 248, 0.04))',
      border: 'rgba(56, 189, 248, 0.35)',
      badge: 'Free ₹10L Capital',
      badgeColor: '#38bdf8',
      tags: ['Live WebSockets', 'F&O Options Chain', 'Bracket Orders', 'TradingView Charts'],
      actionLabel: 'Launch Terminal Now',
      primaryAction: onOpenPaperTrading,
      quickLinks: [
        { label: 'Live Terminal', action: onOpenPaperTrading },
        { label: 'Option Chain', action: () => onOpenPaperTrading() }
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
      gradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(129, 140, 248, 0.04))',
      border: 'rgba(129, 140, 248, 0.35)',
      badge: '8 Core Pillars',
      badgeColor: '#818cf8',
      tags: ['Checklist', 'Trades', 'Strategies', 'Rules', 'Mistakes', 'AI Summary', 'Reports', 'Risk'],
      actionLabel: 'Open Trade Diary',
      primaryAction: onOpenTradeDiary,
      quickLinks: [
        { label: 'Trading Checklist', action: onOpenTradeDiary },
        { label: 'AI Summarizer', action: onOpenTradeDiary }
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
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(52, 211, 153, 0.04))',
      border: 'rgba(16, 185, 129, 0.35)',
      badge: '₹0 NSE Feed',
      badgeColor: '#10b981',
      tags: ['5:35 PM Daily Cron', 'Bulk & Block Deals', 'Live GMP', 'PAN Allotment'],
      actionLabel: 'Explore Primary Markets',
      primaryAction: onOpenPrimaryMarkets,
      quickLinks: [
        { label: 'Delivery Screener', action: onOpenPrimaryMarkets },
        { label: 'IPO & SME Hub', action: onOpenPrimaryMarkets }
      ]
    },
    {
      id: 4,
      hubNum: '04',
      category: 'CALCULATORS',
      title: 'Financial & Trading Calculators',
      shortDesc: 'Compounding SIPs, position sizing with R:R, revised Oct 2024 STT & Options Greeks.',
      icon: Calculator,
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(251, 191, 36, 0.04))',
      border: 'rgba(245, 158, 11, 0.35)',
      badge: 'SEBI Oct 2024 Rates',
      badgeColor: '#f59e0b',
      tags: ['SIP & Step-Up', 'Position Sizing', 'STT & Turnover', 'Black-Scholes Greeks'],
      actionLabel: 'Launch Calculators',
      primaryAction: () => onOpenCalculators('SIP'),
      quickLinks: [
        { label: 'SIP Compounder', action: () => onOpenCalculators('SIP') },
        { label: 'Position Sizer', action: () => onOpenCalculators('POSITION') },
        { label: 'STT & Brokerage', action: () => onOpenCalculators('BROKERAGE') }
      ]
    },
    {
      id: 5,
      hubNum: '05',
      category: 'TRADING',
      title: 'Multi-Broker & MF Connect',
      shortDesc: 'Connect Zerodha, Fyers V3 OAuth, Upstox, INDmoney and CAMS/KFintech e-CAS.',
      icon: Link2,
      color: '#06b6d4',
      gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.18), rgba(34, 211, 238, 0.04))',
      border: 'rgba(6, 182, 212, 0.35)',
      badge: 'Read-Only Sync',
      badgeColor: '#06b6d4',
      tags: ['Zerodha Kite', 'Fyers OAuth', 'Upstox v2', 'INDmoney', 'MF Central CAS'],
      actionLabel: 'Connect Accounts',
      primaryAction: onOpenBrokerConnect,
      quickLinks: [
        { label: 'Fyers OAuth', action: onOpenBrokerConnect },
        { label: 'Zerodha Kite', action: onOpenBrokerConnect },
        { label: 'MF Central CAS', action: onOpenBrokerConnect }
      ]
    },
    {
      id: 6,
      hubNum: '06',
      category: 'MARKETS',
      title: 'Mutual Funds & SIP Explorer',
      shortDesc: 'Discover top direct mutual funds across 44 AMCs with zero expense distributor fees.',
      icon: BarChart2,
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(96, 165, 250, 0.04))',
      border: 'rgba(59, 130, 246, 0.35)',
      badge: '44 Indian AMCs',
      badgeColor: '#3b82f6',
      tags: ['Direct vs Regular', 'Rolling Returns', 'Alpha Comparison', 'NAV History'],
      actionLabel: 'Explore Mutual Funds',
      primaryAction: onOpenMutualFunds,
      quickLinks: [
        { label: 'Top SIPs', action: onOpenMutualFunds },
        { label: 'Index Funds', action: onOpenMutualFunds }
      ]
    },
    {
      id: 7,
      hubNum: '07',
      category: 'WEALTH',
      title: '24/7 Personal AI Wealth Copilot',
      shortDesc: 'Instant advisory on Indian tax regimes, portfolio compounding, retirement & insurance.',
      icon: Bot,
      color: '#c084fc',
      gradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.18), rgba(192, 132, 252, 0.04))',
      border: 'rgba(192, 132, 252, 0.35)',
      badge: 'Generative AI',
      badgeColor: '#c084fc',
      tags: ['Old vs New Tax', '₹1 Cr Roadmap', 'SEBI Guidelines', 'Asset Allocation'],
      actionLabel: 'Ask AI Copilot',
      primaryAction: () => onOpenWealthFinance('AI_COPILOT'),
      quickLinks: [
        { label: 'Tax Regime', action: () => onOpenWealthFinance('AI_COPILOT') },
        { label: '₹1 Cr Roadmap', action: () => onOpenWealthFinance('AI_COPILOT') }
      ]
    },
    {
      id: 8,
      hubNum: '08',
      category: 'WEALTH',
      title: '50/30/20 Budget & Leak Detector',
      shortDesc: 'Automate Needs (50%), Wants (30%), Savings (20%) and plug recurring subscription leaks.',
      icon: Wallet,
      color: '#ef4444',
      gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(248, 113, 113, 0.04))',
      border: 'rgba(239, 68, 68, 0.35)',
      badge: 'Leak Alert',
      badgeColor: '#ef4444',
      tags: ['Needs 50%', 'Wants 30%', 'Savings 20%', 'Recurring Leak Detector'],
      actionLabel: 'Analyze Expense Leaks',
      primaryAction: () => onOpenWealthFinance('BUDGET'),
      quickLinks: [
        { label: 'Budget Rule', action: () => onOpenWealthFinance('BUDGET') },
        { label: 'Leak Detector', action: () => onOpenWealthFinance('BUDGET') }
      ]
    },
    {
      id: 9,
      hubNum: '09',
      category: 'WEALTH',
      title: 'Term Life & Health Gap (HLV)',
      shortDesc: 'Human Life Value protection shortfall analyzer. Zero-commission pure term strategies.',
      icon: HeartPulse,
      color: '#ec4899',
      gradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.18), rgba(244, 114, 182, 0.04))',
      border: 'rgba(236, 72, 153, 0.35)',
      badge: 'Actuarial HLV',
      badgeColor: '#ec4899',
      tags: ['Pure Term Cover', 'Debt Protection', 'Family Floater', 'Zero Agent Cut'],
      actionLabel: 'Calculate Protection Gap',
      primaryAction: () => onOpenWealthFinance('INSURANCE'),
      quickLinks: [
        { label: 'HLV Gap', action: () => onOpenWealthFinance('INSURANCE') },
        { label: 'Family Floater', action: () => onOpenWealthFinance('INSURANCE') }
      ]
    },
    {
      id: 10,
      hubNum: '10',
      category: 'WEALTH',
      title: 'Consolidated Net Worth',
      shortDesc: 'Track Stocks, MFs, EPF/PPF, Bank FDs, Gold and Real Estate against debt liabilities.',
      icon: PieChart,
      color: '#14b8a6',
      gradient: 'linear-gradient(135deg, rgba(20, 184, 166, 0.18), rgba(45, 212, 191, 0.04))',
      border: 'rgba(20, 184, 166, 0.35)',
      badge: 'Balance Sheet',
      badgeColor: '#14b8a6',
      tags: ['Equities', 'Mutual Funds', 'EPF & PPF', 'Gold & Real Estate', 'Debt Solvency'],
      actionLabel: 'View Net Worth',
      primaryAction: () => onOpenWealthFinance('NET_WORTH'),
      quickLinks: [
        { label: 'Asset Breakdown', action: () => onOpenWealthFinance('NET_WORTH') },
        { label: 'Solvency Cushion', action: () => onOpenWealthFinance('NET_WORTH') }
      ]
    },
    {
      id: 11,
      hubNum: '11',
      category: 'WEALTH',
      title: 'Tax-Loss Harvesting (FY25)',
      shortDesc: 'Simulate capital gains tax savings under Budget FY25 (STCG 20%, LTCG 12.5%).',
      icon: Scissors,
      color: '#eab308',
      gradient: 'linear-gradient(135deg, rgba(234, 179, 8, 0.18), rgba(250, 204, 21, 0.04))',
      border: 'rgba(234, 179, 8, 0.35)',
      badge: 'Budget 2024-25',
      badgeColor: '#eab308',
      tags: ['STCG @ 20%', 'LTCG @ 12.5%', 'Offset Losses', 'Save Tax Before Mar 31'],
      actionLabel: 'Simulate Tax Savings',
      primaryAction: () => onOpenWealthFinance('TAX_LOSS'),
      quickLinks: [
        { label: 'Offset Gains', action: () => onOpenWealthFinance('TAX_LOSS') },
        { label: 'March 31 Deadline', action: () => onOpenWealthFinance('TAX_LOSS') }
      ]
    },
    {
      id: 12,
      hubNum: '12',
      category: 'TRADING',
      title: 'Algo Automation & Strategy Studio',
      shortDesc: 'Rule-based strategy automations, TradingView webhook triggers & bracket risk controls.',
      icon: Cpu,
      color: '#8b5cf6',
      gradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.18), rgba(167, 139, 250, 0.04))',
      border: 'rgba(139, 92, 246, 0.35)',
      badge: 'Webhook Engine',
      badgeColor: '#8b5cf6',
      tags: ['TradingView Signals', 'Trailing SL', 'Multi-Leg Execution', 'API Orders'],
      actionLabel: 'Open Strategy Terminal',
      primaryAction: onOpenPaperTrading,
      quickLinks: [
        { label: 'Webhooks', action: onOpenPaperTrading },
        { label: 'Auto SL Engine', action: onOpenPaperTrading }
      ]
    }
  ];

  // Filtering hubs
  const filteredHubs = useMemo(() => {
    return HUBS.filter(hub => {
      const matchCat = selectedCategory === 'ALL' || hub.category === selectedCategory;
      const matchSearch = !searchQuery.trim() || 
        hub.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hub.shortDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hub.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-main, #090d16)',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* 1. Ticker Tape Header */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.95)',
        borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        padding: '6px 16px',
        overflowX: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        fontSize: '11.5px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: '700', whiteSpace: 'nowrap' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
          LIVE NSE/BSE:
        </div>
        <div style={{ display: 'flex', gap: '18px', whiteSpace: 'nowrap' }}>
          {TICKERS.map((t, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: '600', color: '#cbd5e1' }}>{t.symbol}</span>
              <span style={{ fontWeight: '700', color: '#f8fafc' }}>{t.ltp}</span>
              <span style={{ color: t.isUp ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                {t.change}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Compact Top Navbar */}
      <header style={{
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(9, 13, 22, 0.92)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
            <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>12-Hub Trading & Wealth Platform</span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button 
            onClick={onOpenTradeDiary}
            style={{ padding: '6px 12px', background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '12.5px', fontWeight: '500', cursor: 'pointer', borderRadius: '6px' }}
          >
            Trade Diary
          </button>
          <button 
            onClick={onOpenPrimaryMarkets}
            style={{ padding: '6px 12px', background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '12.5px', fontWeight: '500', cursor: 'pointer', borderRadius: '6px' }}
          >
            Bhavcopy & IPO Hub
          </button>
          <button 
            onClick={() => onOpenCalculators('SIP')}
            style={{ padding: '6px 12px', background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '12.5px', fontWeight: '500', cursor: 'pointer', borderRadius: '6px' }}
          >
            Calculators
          </button>
          <button 
            onClick={onOpenBrokerConnect}
            style={{ padding: '6px 12px', background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '12.5px', fontWeight: '500', cursor: 'pointer', borderRadius: '6px' }}
          >
            Connect Brokers
          </button>
          <button 
            onClick={() => onOpenWealthFinance('AI_COPILOT')}
            style={{ padding: '6px 12px', background: 'transparent', border: 'none', color: '#c084fc', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Sparkles size={13} /> AI Wealth
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

      {/* 3. Streamlined, Highly Optimized Hero Banner */}
      <section style={{
        padding: '24px 20px 18px',
        maxWidth: '1240px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        {/* Subtle Feature Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: '16px',
          color: '#38bdf8',
          fontSize: '11.5px',
          fontWeight: '600',
          marginBottom: '12px'
        }}>
          <Sparkles size={13} />
          <span>Next-Gen Operating System • Zero-Risk Virtual Capital • Institutional ₹0 Architecture</span>
        </div>

        {/* Hero Title */}
        <h1 style={{
          fontSize: 'clamp(24px, 3.8vw, 42px)',
          fontWeight: '900',
          lineHeight: '1.2',
          margin: '0 0 10px',
          letterSpacing: '-0.5px',
          maxWidth: '850px'
        }}>
          Everything You Need to Trade & Grow Wealth: <span style={{ background: 'linear-gradient(to right, #38bdf8, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>All 12 Hubs in One View</span>
        </h1>

        {/* Concise Subtitle */}
        <p style={{
          fontSize: 'clamp(13px, 1.6vw, 15px)',
          color: '#94a3b8',
          lineHeight: '1.5',
          maxWidth: '720px',
          margin: '0 0 20px'
        }}>
          Practice risk-free with ₹10,00,000 live virtual capital, track Bhavcopy deliveries, check IPO allotments, connect external brokers, and calculate net worth with AI guidance.
        </p>

        {/* Quick Launch Buttons & Trust Badges Row */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '12px'
        }}>
          <button
            onClick={onOpenPaperTrading}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontWeight: '800',
              fontSize: '14.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(2, 132, 199, 0.45)',
              transition: 'transform 0.15s ease'
            }}
          >
            <TrendingUp size={18} />
            Launch Paper Trading (Free ₹10L)
            <ArrowRight size={16} />
          </button>

          <button
            onClick={onOpenTradeDiary}
            style={{
              padding: '12px 22px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: '10px',
              color: '#f8fafc',
              fontWeight: '700',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <BookOpen size={16} color="#38bdf8" />
            Open 8-Pillar Trade Diary
          </button>
        </div>

        {/* Inline Micro Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px', fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle2 size={13} color="#10b981" /> 100% Risk Free (Virtual Capital)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle2 size={13} color="#10b981" /> Real-time NSE/BSE WebSockets
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle2 size={13} color="#10b981" /> SEBI-Compliant ₹0 Architecture
          </span>
        </div>
      </section>

      {/* 4. Interactive 12-Hub Filter & Search Command Bar */}
      <section style={{
        maxWidth: '1240px',
        margin: '0 auto',
        width: '100%',
        padding: '0 20px 14px'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '12px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          {/* Category Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            {[
              { id: 'ALL', label: 'All 12 Hubs' },
              { id: 'TRADING', label: '📈 Trading & Execution' },
              { id: 'MARKETS', label: '🏛️ Primary Markets & MFs' },
              { id: 'CALCULATORS', label: '🧮 Calculators & Tax' },
              { id: 'WEALTH', label: '💰 Personal Wealth & AI' }
            ].map(cat => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: 'none',
                    background: isActive ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'rgba(255, 255, 255, 0.05)',
                    color: isActive ? '#fff' : '#94a3b8',
                    fontSize: '12px',
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

          {/* Quick Search Input */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '6px 12px',
            minWidth: '260px',
            flex: '1',
            maxWidth: '380px'
          }}>
            <Search size={14} color="#94a3b8" />
            <input 
              type="text"
              placeholder="Search 12 hubs (e.g. SIP, Bhavcopy, Fyers, HLV)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '12px',
                width: '100%',
                outline: 'none'
              }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 5. The 12-Hub Launcher Cards Grid (Immediately Visible!) */}
      <section style={{
        maxWidth: '1240px',
        margin: '0 auto',
        width: '100%',
        padding: '0 20px 40px'
      }}>
        {filteredHubs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
            No tools found matching "{searchQuery}". Try searching for "SIP", "IPO", "Option", or "Tax".
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px'
          }}>
            {filteredHubs.map(hub => {
              const Icon = hub.icon;
              return (
                <div
                  key={hub.id}
                  style={{
                    background: hub.gradient,
                    border: `1px solid ${hub.border}`,
                    borderRadius: '14px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                    transition: 'transform 0.2s ease, border-color 0.2s ease'
                  }}
                  className="hover:scale-[1.01]"
                >
                  <div>
                    {/* Card Header: Hub Number, Icon & Status Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: `${hub.color}22`,
                          border: `1px solid ${hub.color}55`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: hub.color
                        }}>
                          <Icon size={20} />
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '800', letterSpacing: '0.8px' }}>
                            HUB {hub.hubNum}
                          </span>
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#f8fafc', lineHeight: '1.2' }}>
                            {hub.title}
                          </h3>
                        </div>
                      </div>

                      <span style={{
                        fontSize: '11px',
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

                    {/* Short Description */}
                    <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: '#94a3b8', lineHeight: '1.45' }}>
                      {hub.shortDesc}
                    </p>

                    {/* Tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' }}>
                      {hub.tags.slice(0, 4).map((tag, tIdx) => (
                        <span 
                          key={tIdx}
                          style={{
                            fontSize: '10.5px',
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: '#cbd5e1',
                            padding: '2px 7px',
                            borderRadius: '4px'
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Direct Sub-links for Instant Navigation */}
                    {hub.quickLinks && hub.quickLinks.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '4px' }}>
                        {hub.quickLinks.map((ql, qIdx) => (
                          <button
                            key={qIdx}
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

                  {/* Primary Action Button */}
                  <button
                    onClick={hub.primaryAction}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: `linear-gradient(135deg, ${hub.color}, ${hub.color}cc)`,
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: `0 4px 12px ${hub.color}33`,
                      transition: 'opacity 0.15s ease'
                    }}
                  >
                    <span>{hub.actionLabel}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 6. Streamlined Footer */}
      <footer style={{
        marginTop: 'auto',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(0, 0, 0, 0.45)',
        padding: '20px 24px',
        fontSize: '12px',
        color: '#94a3b8'
      }}>
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontWeight: '700', color: '#f8fafc', fontSize: '13px', marginBottom: '2px' }}>
              SKANDX PRO • Zero-Cost Trading & Wealth Operating System
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Designed for retail traders. Paper trading simulator uses virtual currency for educational purposes.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '14px', fontSize: '12px' }}>
            <span style={{ cursor: 'pointer', color: '#cbd5e1' }} onClick={onOpenPaperTrading}>Paper Trading</span>
            <span style={{ cursor: 'pointer', color: '#cbd5e1' }} onClick={onOpenTradeDiary}>Trade Diary</span>
            <span style={{ cursor: 'pointer', color: '#cbd5e1' }} onClick={onOpenPrimaryMarkets}>Bhavcopy & Deals</span>
            <span style={{ cursor: 'pointer', color: '#cbd5e1' }} onClick={() => onOpenCalculators('SIP')}>Calculators</span>
            <span style={{ cursor: 'pointer', color: '#c084fc' }} onClick={() => onOpenWealthFinance('AI_COPILOT')}>AI Wealth</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
