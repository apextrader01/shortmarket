// frontend/src/components/LandingHomeView.jsx
// 🌟 Impressive 12-Hub Fintech Portal & Command Center (High-Impact Visuals, Smooth Scrolling & Zero-Lag Architecture)

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, BookOpen, Building2, Calculator, Link2, 
  Sparkles, ShieldCheck, ArrowRight, CheckCircle2, ChevronRight, 
  BarChart2, Award, Zap, Layers, Cpu, PieChart, Scissors, 
  HeartPulse, Wallet, Bot, Globe, Shield, RefreshCw, Search,
  ChevronDown, Flame, DollarSign, Target, Activity, ArrowUpRight
} from 'lucide-react';

export default function LandingHomeView({
  onOpenPaperTrading,
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
      gradient: 'linear-gradient(135deg, rgba(2, 132, 199, 0.22), rgba(56, 189, 248, 0.05))',
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
      gradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.22), rgba(129, 140, 248, 0.05))',
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
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.22), rgba(52, 211, 153, 0.05))',
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
      gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.22), rgba(251, 191, 36, 0.05))',
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
      category: 'MARKETS',
      title: 'Mutual Funds & Direct SIP Explorer',
      shortDesc: 'Compare top direct mutual funds across 44 AMCs with zero expense distributor fees.',
      icon: BarChart2,
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.22), rgba(96, 165, 250, 0.05))',
      border: 'rgba(59, 130, 246, 0.35)',
      badge: '44 Indian AMCs',
      badgeColor: '#3b82f6',
      tags: ['Direct vs Regular', 'Fee Savings Calculator', 'Top 5Y CAGR', 'Zero Commission'],
      actionLabel: 'Explore Mutual Funds',
      primaryAction: onOpenMutualFunds,
      quickLinks: [
        { label: 'Direct vs Regular Calculator', action: onOpenMutualFunds },
        { label: 'Top SIP Funds', action: onOpenMutualFunds }
      ]
    },
    {
      id: 6,
      hubNum: '06',
      category: 'WEALTH',
      title: '24/7 Personal AI Wealth Copilot',
      shortDesc: 'Instant advisory on Indian tax regimes, portfolio compounding, retirement & insurance.',
      icon: Bot,
      color: '#c084fc',
      gradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.22), rgba(192, 132, 252, 0.05))',
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
      id: 7,
      hubNum: '07',
      category: 'WEALTH',
      title: '50/30/20 Budget & Leak Detector',
      shortDesc: 'Automate Needs (50%), Wants (30%), Savings (20%) and plug recurring subscription leaks.',
      icon: Wallet,
      color: '#ef4444',
      gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.22), rgba(248, 113, 113, 0.05))',
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
      id: 8,
      hubNum: '08',
      category: 'WEALTH',
      title: 'Term Life & Health Gap (HLV)',
      shortDesc: 'Human Life Value protection shortfall analyzer. Zero-commission pure term strategies.',
      icon: HeartPulse,
      color: '#ec4899',
      gradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.22), rgba(244, 114, 182, 0.05))',
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
      id: 9,
      hubNum: '09',
      category: 'WEALTH',
      title: 'Consolidated Net Worth',
      shortDesc: 'Track Stocks, MFs, EPF/PPF, Bank FDs, Gold and Real Estate against debt liabilities.',
      icon: PieChart,
      color: '#14b8a6',
      gradient: 'linear-gradient(135deg, rgba(20, 184, 166, 0.22), rgba(45, 212, 191, 0.05))',
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
      id: 10,
      hubNum: '10',
      category: 'CALCULATORS',
      title: 'Tax-Loss Harvesting (FY25)',
      shortDesc: 'Simulate capital gains tax savings under Budget FY25 (STCG 20%, LTCG 12.5%).',
      icon: Scissors,
      color: '#eab308',
      gradient: 'linear-gradient(135deg, rgba(234, 179, 8, 0.22), rgba(250, 204, 21, 0.05))',
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
      id: 11,
      hubNum: '11',
      category: 'TRADING',
      title: 'AlgoDelta Multi-Broker Demat & Bridge Suite',
      shortDesc: 'Multi-broker Demat connection, Dedicated Static IPs, TradingView JSON Webhook Bridge & copy trading.',
      icon: Cpu,
      color: '#ef4444',
      gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.22), rgba(249, 115, 22, 0.05))',
      border: 'rgba(239, 68, 68, 0.35)',
      badge: 'ALGODELTA v4.9',
      badgeColor: '#ef4444',
      tags: ['Share Demat Link', 'Demat API Keys', 'Static IPs', 'JSON Webhook Bridge', 'TradingView Alerts'],
      actionLabel: 'Launch AlgoDelta Console',
      primaryAction: onOpenAlgoBridge || onOpenPaperTrading,
      quickLinks: [
        { label: 'Share Demat Link', action: onOpenAlgoBridge },
        { label: 'JSON Webhook Bridge', action: onOpenAlgoBridge }
      ]
    }
  ];

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
      minHeight: '100%',
      backgroundColor: 'var(--bg-main, #090d16)',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative'
    }}>
      {/* 1. Real-Time Ticker Tape Header */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.95)',
        borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        padding: '6px 16px',
        overflowX: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        fontSize: '11.5px',
        position: 'sticky',
        top: 0,
        zIndex: 60
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

      {/* 2. Top Navigation Bar */}
      <header style={{
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: '32px',
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

        {/* Desktop Quick Jump Links */}
        <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button 
            onClick={scrollToHubs}
            style={{ padding: '6px 12px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span>Explore 12 Hubs</span>
            <ChevronDown size={14} />
          </button>
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
            onClick={onOpenAlgoBridge}
            style={{ padding: '6px 12px', background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '12.5px', fontWeight: '500', cursor: 'pointer', borderRadius: '6px' }}
          >
            AlgoDelta Demat Bridge
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

      {/* 3. Hero Banner with Interactive Visuals & Scroll Cue */}
      <section style={{
        padding: '32px 20px 24px',
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
          <span>Next-Gen Operating System • Zero-Risk Virtual Capital • Institutional ₹0 Architecture</span>
        </div>

        {/* Hero Headline */}
        <h1 style={{
          fontSize: 'clamp(26px, 4.2vw, 48px)',
          fontWeight: '900',
          lineHeight: '1.18',
          margin: '0 0 14px',
          letterSpacing: '-0.5px',
          maxWidth: '880px'
        }}>
          Master Markets with <span style={{ background: 'linear-gradient(to right, #38bdf8, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>₹10,00,000 Virtual Capital</span> & 12 Specialized Hubs
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 'clamp(13px, 1.6vw, 15px)',
          color: '#94a3b8',
          lineHeight: '1.55',
          maxWidth: '720px',
          margin: '0 0 24px'
        }}>
          Practice risk-free with live F&O WebSocket ticks, maintain an 8-pillar institutional journal, screen daily NSE deliveries & IPOs, and optimize your wealth with 24/7 AI advisory.
        </p>

        {/* Dual CTA Buttons */}
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
              padding: '13px 24px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: '10px',
              color: '#f8fafc',
              fontWeight: '700',
              fontSize: '14.5px',
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

        {/* Trust Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px', fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle2 size={13} color="#10b981" /> 100% Risk Free (Virtual Capital)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle2 size={13} color="#10b981" /> Real-time NSE/BSE WebSockets
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle2 size={13} color="#10b981" /> High-Concurrency Zero-Lag Engine
          </span>
        </div>

        {/* Bouncing Scroll Cue Button */}
        <button
          onClick={scrollToHubs}
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '24px',
            padding: '8px 16px',
            color: '#38bdf8',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
          }}
        >
          <span>Scroll Down to Explore All 12 Hubs</span>
          <ChevronDown size={14} className="animate-bounce" />
        </button>
      </section>

      {/* 4. Live Simulated Demo Card (Makes the page visually impressive!) */}
      <section style={{
        maxWidth: '1240px',
        margin: '0 auto',
        width: '100%',
        padding: '0 20px 24px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(2, 132, 199, 0.12))',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '16px',
          padding: '18px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Simulated Trading Sandbox
              </div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                ₹10,00,000 Virtual Capital Active
              </div>
              <div style={{ fontSize: '12px', color: '#34d399', fontWeight: '600' }}>
                Today's Simulated P&L: +₹24,850.00 (+2.48%)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={onOpenPaperTrading}
              style={{
                padding: '9px 18px',
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
              <span>Buy 1 Lot Nifty (Demo)</span>
              <ArrowUpRight size={14} />
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
              <span>Open Real Terminal</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* 5. The 12-Hub Command Center (Target of Smooth Scroll) */}
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
              All 12 Platform Hubs & Tools
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
              Select any hub below to launch its dedicated terminal or modal directly.
            </p>
          </div>

          {/* Quick Search Input */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            padding: '8px 14px',
            minWidth: '280px',
            maxWidth: '380px'
          }}>
            <Search size={15} color="#94a3b8" />
            <input 
              type="text"
              placeholder="Search 12 hubs (e.g. SIP, Bhavcopy, F&O, Tax)..."
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
          marginBottom: '14px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          {[
            { id: 'ALL', label: 'All 12 Hubs (12)' },
            { id: 'TRADING', label: '📈 Trading & Orders (4)' },
            { id: 'MARKETS', label: '🏛️ Primary Markets & MFs (2)' },
            { id: 'CALCULATORS', label: '🧮 Calculators & Tax (2)' },
            { id: 'WEALTH', label: '💰 Personal Wealth & AI (4)' }
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

        {/* 12-Hub Grid Cards */}
        {filteredHubs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
            No tools found matching "{searchQuery}". Try searching for "SIP", "IPO", "Option", or "Tax".
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '18px'
          }}>
            {filteredHubs.map(hub => {
              const Icon = hub.icon;
              return (
                <div
                  key={hub.id}
                  style={{
                    background: hub.gradient,
                    border: `1px solid ${hub.border}`,
                    borderRadius: '16px',
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    boxShadow: '0 6px 24px rgba(0, 0, 0, 0.28)',
                    transition: 'transform 0.2s ease, border-color 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  className="hover:scale-[1.01]"
                >
                  {/* Faint Hub Number Watermark */}
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '12px',
                    fontSize: '44px',
                    fontWeight: '900',
                    color: 'rgba(255, 255, 255, 0.03)',
                    userSelect: 'none',
                    pointerEvents: 'none'
                  }}>
                    {hub.hubNum}
                  </div>

                  <div>
                    {/* Header: Icon, Number & Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: `${hub.color}22`,
                          border: `1px solid ${hub.color}55`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: hub.color
                        }}>
                          <Icon size={22} />
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '800', letterSpacing: '0.8px' }}>
                            HUB {hub.hubNum}
                          </span>
                          <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: '800', color: '#f8fafc', lineHeight: '1.2' }}>
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

                    {/* Description */}
                    <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: '#94a3b8', lineHeight: '1.45' }}>
                      {hub.shortDesc}
                    </p>

                    {/* Tag Badges */}
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

                    {/* Direct Shortcut Sub-links */}
                    {hub.quickLinks && hub.quickLinks.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
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

                  {/* High-Impact Launch Button */}
                  <button
                    onClick={hub.primaryAction}
                    style={{
                      width: '100%',
                      padding: '11px 16px',
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
                Zero-Lag Multi-Core Cluster
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#94a3b8', lineHeight: '1.4' }}>
                Automated PM2 cluster workers across all VM CPU cores engineered for 1 Lakh to 10 Lakh concurrent users.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#f8fafc' }}>
                In-Memory Edge Caching
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#94a3b8', lineHeight: '1.4' }}>
                Sub-millisecond Bhavcopy, deal flow, and public feeds served straight from RAM with zero database bottlenecks.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(129, 140, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', flexShrink: 0 }}>
              <Cpu size={18} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#f8fafc' }}>
                Hardware Accelerated 60 FPS
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#94a3b8', lineHeight: '1.4' }}>
                GPU-accelerated CSS rendering, smooth scrolling, and code-split chunks for lightning fast mobile and web browsing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer style={{
        marginTop: 'auto',
        background: 'rgba(0, 0, 0, 0.5)',
        padding: '24px 24px',
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
              SKANDX PRO • High-Concurrency Trading & Wealth Operating System
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Paper trading simulator uses virtual currency for educational purposes. Fully compliant with Indian regulatory guidelines.
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
