// frontend/src/components/LandingHomeView.jsx
// 🌟 Root Fintech Landing Page & Multi-Hub Portal (Simple, Welcoming & High-Impact)

import React, { useState } from 'react';
import { 
  TrendingUp, BookOpen, Building2, Calculator, Link2, 
  Sparkles, ShieldCheck, ArrowRight, CheckCircle2, ChevronRight, 
  BarChart2, Award, Zap, Layers, Cpu, PieChart, Scissors, 
  HeartPulse, Wallet, Bot, Globe, Shield, RefreshCw
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
  const [tickerIndex, setTickerIndex] = useState(0);

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
        padding: '8px 16px',
        overflowX: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        fontSize: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: '700', whiteSpace: 'nowrap' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
          LIVE NSE/BSE:
        </div>
        <div style={{ display: 'flex', gap: '20px', whiteSpace: 'nowrap' }}>
          {TICKERS.map((t, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(9, 13, 22, 0.85)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #0284c7, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(56, 189, 248, 0.4)'
          }}>
            <TrendingUp size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: '900', fontSize: '18px', letterSpacing: '0.5px', background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                SKANDX
              </span>
              <span style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                PRO
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Fintech & Trading OS</span>
          </div>
        </div>

        {/* Desktop Quick Links */}
        <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={onOpenTradeDiary}
            style={{ padding: '8px 14px', background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '13px', fontWeight: '500', cursor: 'pointer', borderRadius: '8px' }}
          >
            Trade Diary
          </button>
          <button 
            onClick={onOpenPrimaryMarkets}
            style={{ padding: '8px 14px', background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '13px', fontWeight: '500', cursor: 'pointer', borderRadius: '8px' }}
          >
            Bhavcopy & IPO Hub
          </button>
          <button 
            onClick={() => onOpenCalculators('SIP')}
            style={{ padding: '8px 14px', background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '13px', fontWeight: '500', cursor: 'pointer', borderRadius: '8px' }}
          >
            Calculators
          </button>
          <button 
            onClick={onOpenBrokerConnect}
            style={{ padding: '8px 14px', background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '13px', fontWeight: '500', cursor: 'pointer', borderRadius: '8px' }}
          >
            Connect Brokers
          </button>
          <button 
            onClick={() => onOpenWealthFinance('AI_COPILOT')}
            style={{ padding: '8px 14px', background: 'transparent', border: 'none', color: '#c084fc', fontSize: '13px', fontWeight: '600', cursor: 'pointer', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <Sparkles size={14} /> AI Wealth
          </button>
        </div>

        {/* Glowing Direct Paper Trading CTA */}
        <button
          onClick={onOpenPaperTrading}
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #0284c7, #2563eb)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '10px',
            color: '#fff',
            fontWeight: '700',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 0 20px rgba(2, 132, 199, 0.4)',
            transition: 'all 0.2s ease'
          }}
        >
          <Zap size={16} /> Launch Paper Trading
        </button>
      </header>

      {/* 3. Hero Section */}
      <section style={{
        padding: '60px 24px 40px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          background: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '20px',
          color: '#38bdf8',
          fontSize: '12px',
          fontWeight: '600',
          marginBottom: '20px'
        }}>
          <Sparkles size={14} />
          <span>Zero-Cost Architecture • Real-Time NSE/BSE WebSockets • SEBI Compliant</span>
        </div>

        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 54px)',
          fontWeight: '900',
          lineHeight: '1.15',
          margin: '0 0 20px',
          letterSpacing: '-0.5px',
          maxWidth: '900px'
        }}>
          Master Markets with <span style={{ background: 'linear-gradient(to right, #38bdf8, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>₹10,00,000 Virtual Capital</span> & Institutional Tools
        </h1>

        <p style={{
          fontSize: 'clamp(14px, 2vw, 17px)',
          color: '#94a3b8',
          lineHeight: '1.6',
          maxWidth: '750px',
          margin: '0 0 32px'
        }}>
          A simple, welcoming platform for every trader. Practice risk-free paper trading, maintain an institutional 8-pillar trade journal, track live Bhavcopy delivery surges & IPO allotments, and optimize your wealth with 24/7 AI guidance.
        </p>

        {/* Dual High-Impact Action CTAs */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '14px',
          justifyContent: 'center',
          marginBottom: '40px'
        }}>
          <button
            onClick={onOpenPaperTrading}
            style={{
              padding: '16px 32px',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              fontWeight: '800',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              boxShadow: '0 10px 30px rgba(2, 132, 199, 0.5)',
              transition: 'transform 0.15s ease'
            }}
          >
            <TrendingUp size={20} />
            Launch Paper Trading Terminal (Free ₹10L)
            <ArrowRight size={18} />
          </button>

          <button
            onClick={onOpenTradeDiary}
            style={{
              padding: '16px 28px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              color: '#f8fafc',
              fontWeight: '700',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <BookOpen size={18} color="#38bdf8" />
            Open 8-Pillar Trade Diary
          </button>
        </div>

        {/* 3 Value Badges */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          width: '100%',
          maxWidth: '850px'
        }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <ShieldCheck size={20} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#f8fafc' }}>100% Risk Free</div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Virtual capital, zero losses</div>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
              <Cpu size={20} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#f8fafc' }}>Real Exchange Feed</div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Live tick by tick data</div>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc' }}>
              <Sparkles size={20} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#f8fafc' }}>₹0 Architecture</div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Built for Indian retail traders</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Core Platform Hubs Grid (12 Feature Cards) */}
      <section style={{
        padding: '30px 24px 60px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 6px', color: '#f8fafc' }}>
            Comprehensive Trading & Financial Ecosystem
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
            Everything you need: from live paper order execution to primary market analytics, broker feeds & personal wealth
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '20px'
        }}>
          {/* Hub 1: Paper Trading Terminal */}
          <div style={{
            background: 'linear-gradient(145deg, rgba(2, 132, 199, 0.08), rgba(15, 23, 42, 0.4))',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                  <TrendingUp size={22} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '3px 8px', borderRadius: '6px' }}>
                  Hub 1 • Live Terminal
                </span>
              </div>
              <h3 style={{ margin: '14px 0 8px', fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                Paper Trading Terminal
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                Trade Equities, Futures & Options with ₹10,00,000 live virtual capital. Full TradingView charting, real-time depth and bracket orders.
              </p>
            </div>
            <button
              onClick={onOpenPaperTrading}
              style={{
                marginTop: '18px',
                padding: '10px 16px',
                background: '#0284c7',
                border: 'none',
                borderRadius: '8px',
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
              Launch Terminal Now <ArrowRight size={14} />
            </button>
          </div>

          {/* Hub 2: 8-Pillar Trade Diary */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(129, 140, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                  <BookOpen size={22} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#818cf8', background: 'rgba(129, 140, 248, 0.12)', padding: '3px 8px', borderRadius: '6px' }}>
                  Hub 2 • 8 Pillars
                </span>
              </div>
              <h3 style={{ margin: '14px 0 8px', fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                Smart Trade Diary & Journal
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                8 Integrated Pillars: Trading Checklist, Trades, Strategies, Rules, Mistakes, AI Summarizer, Reports & Risk Management.
              </p>
            </div>
            <button
              onClick={onOpenTradeDiary}
              style={{
                marginTop: '18px',
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              Open Trade Diary <ChevronRight size={14} />
            </button>
          </div>

          {/* Hub 3: Primary Markets & Institutional Deals */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <Building2 size={22} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', padding: '3px 8px', borderRadius: '6px' }}>
                  Hub 3 • ₹0 Bhavcopy & IPO
                </span>
              </div>
              <h3 style={{ margin: '14px 0 8px', fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                Bhavcopy Screener & IPO Hub
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                Daily NSE Bhavcopy delivery tracker (&gt;60%), Bulk/Block/Insider deals monitor, and Live Mainboard & SME IPO GMP with 1-click PAN check.
              </p>
            </div>
            <button
              onClick={onOpenPrimaryMarkets}
              style={{
                marginTop: '18px',
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              Explore Primary Markets <ChevronRight size={14} />
            </button>
          </div>

          {/* Hub 4: Financial & Trading Calculators */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                  <Calculator size={22} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)', padding: '3px 8px', borderRadius: '6px' }}>
                  Hub 4 • Math Models
                </span>
              </div>
              <h3 style={{ margin: '14px 0 8px', fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                Financial Calculators Suite
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                SIP Wealth Compounder, Position Sizing & R:R, Brokerage & Taxes (revised Oct 2024 STT), and Options Greeks Black-Scholes.
              </p>
            </div>
            <button
              onClick={() => onOpenCalculators('SIP')}
              style={{
                marginTop: '18px',
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              Open Calculators <ChevronRight size={14} />
            </button>
          </div>

          {/* Hub 5: Multi-Broker Connect */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                  <Link2 size={22} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '3px 8px', borderRadius: '6px' }}>
                  Hub 5 • Multi-Broker Sync
                </span>
              </div>
              <h3 style={{ margin: '14px 0 8px', fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                Fetch Broker & MF Data
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                Connect Zerodha, Fyers, Upstox, INDmoney, and MF Central CAS to fetch consolidated portfolios into a single dashboard.
              </p>
            </div>
            <button
              onClick={onOpenBrokerConnect}
              style={{
                marginTop: '18px',
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              Connect Accounts <ChevronRight size={14} />
            </button>
          </div>

          {/* Hub 6: Mutual Funds & SIP Explorer */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <BarChart2 size={22} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', padding: '3px 8px', borderRadius: '6px' }}>
                  Hub 6 • MF Engine
                </span>
              </div>
              <h3 style={{ margin: '14px 0 8px', fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                Mutual Funds & SIPs
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                Screen top performing direct mutual funds across 44 Indian AMCs. Track alpha, expense ratios, and historical rolling returns.
              </p>
            </div>
            <button
              onClick={onOpenMutualFunds}
              style={{
                marginTop: '18px',
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              Explore Mutual Funds <ChevronRight size={14} />
            </button>
          </div>

          {/* Hub 7: 24/7 Personal AI Wealth Copilot */}
          <div style={{
            background: 'linear-gradient(145deg, rgba(168, 85, 247, 0.08), rgba(15, 23, 42, 0.4))',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc' }}>
                  <Bot size={22} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#c084fc', background: 'rgba(168, 85, 247, 0.12)', padding: '3px 8px', borderRadius: '6px' }}>
                  Hub 7 • AI Copilot
                </span>
              </div>
              <h3 style={{ margin: '14px 0 8px', fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                24/7 AI Wealth Copilot
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                Your private financial advisor. Get instant clarity on Indian tax regimes, asset allocation, goal timelines, and risk mitigation.
              </p>
            </div>
            <button
              onClick={() => onOpenWealthFinance('AI_COPILOT')}
              style={{
                marginTop: '18px',
                padding: '10px 16px',
                background: 'rgba(168, 85, 247, 0.15)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '8px',
                color: '#e9d5ff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              Ask AI Wealth Copilot <ChevronRight size={14} />
            </button>
          </div>

          {/* Hub 8: 50/30/20 Smart Budget & Leak Detector */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
                  <Wallet size={22} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#f87171', background: 'rgba(239, 68, 68, 0.12)', padding: '3px 8px', borderRadius: '6px' }}>
                  Hub 8 • Budget Optimizer
                </span>
              </div>
              <h3 style={{ margin: '14px 0 8px', fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                50/30/20 Leak Detector
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                Categorize your income into Needs (50%), Wants (30%), and Investments (20%). Detect recurring leaks and boost your compounding corpus.
              </p>
            </div>
            <button
              onClick={() => onOpenWealthFinance('BUDGET')}
              style={{
                marginTop: '18px',
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              Analyze Expense Leaks <ChevronRight size={14} />
            </button>
          </div>

          {/* Hub 9: Term Life & Health Insurance Gap (HLV) */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(236, 72, 153, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f472b6' }}>
                  <HeartPulse size={22} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#f472b6', background: 'rgba(236, 72, 153, 0.12)', padding: '3px 8px', borderRadius: '6px' }}>
                  Hub 9 • Protection
                </span>
              </div>
              <h3 style={{ margin: '14px 0 8px', fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                Term Life & Health Gap (HLV)
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                Calculate your Human Life Value coverage shortfall based on income and debts. Discover zero-commission pure term protection strategies.
              </p>
            </div>
            <button
              onClick={() => onOpenWealthFinance('INSURANCE')}
              style={{
                marginTop: '18px',
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              Analyze Insurance Gap <ChevronRight size={14} />
            </button>
          </div>

          {/* Hub 10: Consolidated Net Worth */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                  <PieChart size={22} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '3px 8px', borderRadius: '6px' }}>
                  Hub 10 • Balance Sheet
                </span>
              </div>
              <h3 style={{ margin: '14px 0 8px', fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                Consolidated Net Worth
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                Aggregate all your assets (Stocks, MFs, EPF, Gold, Real Estate) against liabilities to track your true financial solvency.
              </p>
            </div>
            <button
              onClick={() => onOpenWealthFinance('NET_WORTH')}
              style={{
                marginTop: '18px',
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              View Net Worth <ChevronRight size={14} />
            </button>
          </div>

          {/* Hub 11: Tax-Loss Harvesting Simulator */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <Scissors size={22} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', padding: '3px 8px', borderRadius: '6px' }}>
                  Hub 11 • FY25 Tax Saver
                </span>
              </div>
              <h3 style={{ margin: '14px 0 8px', fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                Tax-Loss Harvesting
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                Simulate capital gains tax savings under updated budget rules (STCG @ 20%, LTCG @ 12.5%). Offset gains before March 31.
              </p>
            </div>
            <button
              onClick={() => onOpenWealthFinance('TAX_LOSS')}
              style={{
                marginTop: '18px',
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              Simulate Tax Savings <ChevronRight size={14} />
            </button>
          </div>

          {/* Hub 12: Algo Automation Studio */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(129, 140, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                  <Cpu size={22} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#818cf8', background: 'rgba(129, 140, 248, 0.12)', padding: '3px 8px', borderRadius: '6px' }}>
                  Hub 12 • Automation
                </span>
              </div>
              <h3 style={{ margin: '14px 0 8px', fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                Algo Automation Studio
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                Connect TradingView webhooks, execute strategy automations, and manage systematic bracket order risk parameters.
              </p>
            </div>
            <button
              onClick={onOpenPaperTrading}
              style={{
                marginTop: '18px',
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              Open Strategy Terminal <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* 5. Clean Footer */}
      <footer style={{
        marginTop: 'auto',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(0, 0, 0, 0.4)',
        padding: '30px 24px',
        fontSize: '12px',
        color: '#94a3b8'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontWeight: '700', color: '#f8fafc', fontSize: '14px', marginBottom: '4px' }}>
              SKANDX PRO • Zero-Cost Trading & Wealth Engine
            </div>
            <div>
              Designed for retail traders. Paper trading simulator uses virtual currency for educational purposes.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span style={{ cursor: 'pointer', color: '#cbd5e1' }} onClick={onOpenPaperTrading}>Paper Trading</span>
            <span style={{ cursor: 'pointer', color: '#cbd5e1' }} onClick={onOpenTradeDiary}>Trade Diary</span>
            <span style={{ cursor: 'pointer', color: '#cbd5e1' }} onClick={onOpenPrimaryMarkets}>Bhavcopy & Deals</span>
            <span style={{ cursor: 'pointer', color: '#cbd5e1' }} onClick={() => onOpenCalculators('SIP')}>Calculators</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
