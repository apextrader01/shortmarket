// frontend/src/components/FeatureTourModal.jsx
// 🌟 Interactive Guided Feature Tour & Product Introduction Walkthrough
// Introduces all key platform hubs step-by-step with Next, Back, and Skip controls.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp, BookOpen, Cpu, Calculator,
  PieChart, Building2, Sparkles, ShieldCheck,
  Zap, Layers, Activity, CheckCircle2,
  Target, Sliders, Users, ChevronRight,
  ChevronLeft, X, ArrowRight
} from 'lucide-react';

const TOUR_STEPS = [
  {
    id: 'terminal',
    hubNumber: '01',
    category: 'TRADING & SANDBOX',
    title: 'Multi-Market Live Trading Terminal',
    tagline: 'Trade Indian Equities, F&O Option Chains, Crypto & US Stocks with 100% zero capital risk.',
    badge: '100% Risk-Free Simulation',
    badgeColor: '#10b981',
    icon: TrendingUp,
    accentColor: '#38bdf8',
    bgGradient: 'radial-gradient(circle at 50% 15%, rgba(56, 189, 248, 0.18) 0%, rgba(6, 9, 17, 0) 75%)',
    highlights: [
      {
        icon: Zap,
        title: 'Ultra-Fast Live Market Feeds',
        desc: 'Sub-millisecond real-time tick streaming for NSE, BSE, NIFTY 50, BANK NIFTY, and F&O.'
      },
      {
        icon: ShieldCheck,
        title: '₹10 Lakh to ₹10 Crore Virtual Margin',
        desc: 'Practice scalping, price action, and options strategies safely before deploying real capital.'
      },
      {
        icon: Layers,
        title: 'Advanced Bracket & Stop-Loss Orders',
        desc: 'TradingView interactive charts, Level-2 Market Depth, trailing stops, and hard risk limits.'
      }
    ],
    preview: {
      type: 'terminal',
      tickers: [
        { name: 'NIFTY 50', val: '25,014.60', ch: '+104.20 (+0.42%)', up: true },
        { name: 'BANK NIFTY', val: '51,462.10', ch: '+318.50 (+0.62%)', up: true },
        { name: 'RELIANCE', val: '1,294.50', ch: '+14.80 (+1.16%)', up: true }
      ],
      wallet: '₹10,00,000.00 Demo Margin'
    },
    hubKey: 'Markets'
  },
  {
    id: 'diary',
    hubNumber: '02',
    category: 'COGNITIVE PERFORMANCE',
    title: 'Automated Trade Diary & AI-Optimized Coach',
    tagline: 'Eliminate emotional trading leaks, track trade psychology, and upload chart proofs under 50 KB.',
    badge: 'AI Cognitive Audits',
    badgeColor: '#a855f7',
    icon: BookOpen,
    accentColor: '#a855f7',
    bgGradient: 'radial-gradient(circle at 50% 15%, rgba(168, 85, 247, 0.18) 0%, rgba(6, 9, 17, 0) 75%)',
    highlights: [
      {
        icon: Sparkles,
        title: 'AI-Optimized Psychological Audit',
        desc: 'Detect revenge trading, FOMO bias, and over-leveraging with instant personalized AI feedback.'
      },
      {
        icon: CheckCircle2,
        title: 'Smart < 50 KB Screenshot Compression',
        desc: 'Attach 1–2 trade chart proofs with adaptive WebP compression and 1.5x zoom lightbox review.'
      },
      {
        icon: Activity,
        title: 'Institutional Trade Analytics',
        desc: 'Automated win-rate tracking, risk-to-reward ratio, profit factor, and discipline scoring.'
      }
    ],
    preview: {
      type: 'diary',
      aiScore: '94/100',
      aiVerdict: 'Disciplined Risk Profile · Zero FOMO Detected',
      proofSize: '38.2 KB (Adaptive WebP)'
    },
    hubKey: 'TradeDiary'
  },
  {
    id: 'algo',
    hubNumber: '03',
    category: 'AUTOMATION & BROKERS',
    title: 'SkandX Algo & Multi-Broker Bridge',
    tagline: 'Connect your real Demat accounts and execute automated TradingView webhooks with zero latency.',
    badge: 'AES-256 Demat Security',
    badgeColor: '#f59e0b',
    icon: Cpu,
    accentColor: '#f59e0b',
    bgGradient: 'radial-gradient(circle at 50% 15%, rgba(245, 158, 11, 0.18) 0%, rgba(6, 9, 17, 0) 75%)',
    highlights: [
      {
        icon: Zap,
        title: 'Multi-Broker Demat Integration',
        desc: 'Connect your preferred Demat accounts and API bridges with one-click token authorization.'
      },
      {
        icon: Cpu,
        title: 'Instant Webhook Order Execution',
        desc: 'Route Pine Script and Python alerts straight into market orders with sub-second execution.'
      },
      {
        icon: ShieldCheck,
        title: 'Military-Grade Encryption',
        desc: 'All API keys and credentials are encrypted at rest with enterprise AES-256 security.'
      }
    ],
    preview: {
      type: 'algo',
      brokers: ['TradingView Webhooks', 'API Bridge', 'Multi-Demat Sync', 'Strategy Engine'],
      status: 'Ready for Webhook Routing · 0.08ms Execution'
    },
    hubKey: 'Algo'
  },
  {
    id: 'calculators',
    hubNumber: '04',
    category: 'PRECISION MATH',
    title: '15+ Institutional Financial Engines',
    tagline: 'Run Wall Street-grade math for options payoffs, position sizing, brokerage & compounding.',
    badge: 'Wall Street Precision',
    badgeColor: '#34d399',
    icon: Calculator,
    accentColor: '#34d399',
    bgGradient: 'radial-gradient(circle at 50% 15%, rgba(52, 211, 153, 0.18) 0%, rgba(6, 9, 17, 0) 75%)',
    highlights: [
      {
        icon: Target,
        title: 'Dynamic Position Size Calculator',
        desc: 'Know your exact quantity based on portfolio risk tolerance and stop-loss points.'
      },
      {
        icon: TrendingUp,
        title: 'SIP, Step-Up & Compounding Suite',
        desc: 'Project 10 to 30 year wealth horizons with step-up inflation and CAGR modeling.'
      },
      {
        icon: Sliders,
        title: 'Exchange STT & Charges Estimator',
        desc: 'Verify exact exchange turnover charges, SEBI turnover fees, and GST before placing orders.'
      }
    ],
    preview: {
      type: 'calc',
      sipResult: '₹1.85 Cr projected wealth at 15% CAGR with 10% Step-Up',
      riskResult: 'Max Risk: ₹3,750 · Safe Size: 150 Qty'
    },
    hubKey: 'Calculators'
  },
  {
    id: 'wealth',
    hubNumber: '05',
    category: 'PERSONAL FINANCE',
    title: 'Wealth OS & Union Budget 2025 Tax Hub',
    tagline: '50/30/20 personal finance framework with official Union Budget FY 2025-26 tax regime analytics.',
    badge: 'Union Budget FY 25-26',
    badgeColor: '#06b6d4',
    icon: PieChart,
    accentColor: '#06b6d4',
    bgGradient: 'radial-gradient(circle at 50% 15%, rgba(6, 182, 212, 0.18) 0%, rgba(6, 9, 17, 0) 75%)',
    highlights: [
      {
        icon: Building2,
        title: 'Official Budget 2025 Tax Slabs',
        desc: 'Instantly calculate taxable income under New vs Old Tax Regimes with Section 87A rebate.'
      },
      {
        icon: PieChart,
        title: '50/30/20 Cashflow Allocation',
        desc: 'Automate budget allocations into Essential Needs (50%), Lifestyle Wants (30%), and Investments (20%).'
      },
      {
        icon: Sparkles,
        title: '24/7 AI Wealth Copilot',
        desc: 'Interactive financial insights on debt reduction, emergency fund runways, and early retirement.'
      }
    ],
    preview: {
      type: 'wealth',
      taxSavings: 'New Regime Saves ₹48,200/yr on ₹15L Income',
      budgetSplit: '50% Needs · 30% Wants · 20% Compounding'
    },
    hubKey: 'WealthOS'
  },
  {
    id: 'primary',
    hubNumber: '06',
    category: 'CAPITAL MARKETS & COMMUNITY',
    title: 'Primary Markets, IPOs & Trader Clubs',
    tagline: 'Track real-time exchange bulk deals, insider filings, IPO Grey Market Premium (GMP) & verified clubs.',
    badge: 'Exchange Deal Tracker',
    badgeColor: '#f43f5e',
    icon: Building2,
    accentColor: '#f43f5e',
    bgGradient: 'radial-gradient(circle at 50% 15%, rgba(244, 63, 94, 0.18) 0%, rgba(6, 9, 17, 0) 75%)',
    highlights: [
      {
        icon: Building2,
        title: 'Mainboard & SME IPO Intelligence',
        desc: 'Live Grey Market Premium (GMP), subscription multiples, allotment dates, and institutional bids.'
      },
      {
        icon: Activity,
        title: 'Bulk Deals & Insider Filings',
        desc: 'Spot whale money flows with real-time FII/DII block purchases and promoter transaction filings.'
      },
      {
        icon: Users,
        title: 'Trader Community & Verified P&L',
        desc: 'Join trading clubs, share verified performance badges, and follow institutional strategies.'
      }
    ],
    preview: {
      type: 'primary',
      ipoDeal: 'Live IPO: 42.5% GMP · 28.4x QIB Subscription',
      insiderDeal: 'Bulk Deal: +₹240 Cr Institutional Inflow'
    },
    hubKey: 'PrimaryMarkets'
  }
];

export default function FeatureTourModal({ isOpen = true, onClose, onNavigateToHub }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const totalSteps = TOUR_STEPS.length;
  const currentStep = TOUR_STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Mark completion in storage
  const handleDismiss = useCallback((skipReason = 'completed') => {
    try {
      localStorage.setItem('skandx_feature_tour_completed', 'true');
      localStorage.removeItem('skandx_show_feature_tour');
      localStorage.removeItem('skandx_new_registration');
    } catch (_) {}
    if (onClose) onClose(skipReason);
  }, [onClose]);

  const handleNext = () => {
    if (isLastStep) {
      handleDismiss('finished');
      if (onNavigateToHub) {
        onNavigateToHub('Markets');
      }
    } else {
      setCurrentStepIndex(prev => Math.min(prev + 1, totalSteps - 1));
    }
  };

  const handlePrev = () => {
    setCurrentStepIndex(prev => Math.max(prev - 1, 0));
  };

  const handleJumpToHub = (hubKey) => {
    handleDismiss('jumped');
    if (onNavigateToHub) {
      onNavigateToHub(hubKey);
    }
  };

  // Touch swipe support for native-app mobile gesture experience
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);

  const handleTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null) return;
    const endX = e.changedTouches?.[0]?.clientX;
    const endY = e.changedTouches?.[0]?.clientY;
    if (endX !== undefined && endY !== undefined) {
      const diffX = touchStartXRef.current - endX;
      const diffY = touchStartYRef.current - endY;
      // Dominant horizontal swipe (> 45px distance and 1.3x more horizontal than vertical)
      if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY) * 1.3) {
        if (diffX > 0) {
          // Swiped left -> Next
          if (isLastStep) {
            handleDismiss('finished');
            if (onNavigateToHub) onNavigateToHub('Markets');
          } else {
            setCurrentStepIndex(prev => Math.min(prev + 1, totalSteps - 1));
          }
        } else {
          // Swiped right -> Back
          setCurrentStepIndex(prev => Math.max(prev - 1, 0));
        }
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  // Keyboard navigation listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (isLastStep) {
          handleDismiss('finished');
        } else {
          setCurrentStepIndex(prev => Math.min(prev + 1, totalSteps - 1));
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentStepIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss('skipped');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLastStep, totalSteps, handleDismiss]);

  if (!isOpen) return null;

  const StepIcon = currentStep.icon;

  return (
    <div
      className="feature-tour-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss('backdrop_click');
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(3, 7, 18, 0.82)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'skxTourFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <style>{`
        @keyframes skxTourFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes skxPulseGlow {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.08); }
        }
        @keyframes skxSlideStep {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .skx-step-content {
          animation: skxSlideStep 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .skx-tour-card {
          width: 100%;
          max-width: 660px;
          max-height: min(92vh, 720px);
          border-radius: 20px;
          border: 1px solid rgba(56, 189, 248, 0.28);
          background: #090e1a;
          box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.75), 0 0 35px rgba(56, 189, 248, 0.15);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          color: #f8fafc;
          position: relative;
          contain: layout style;
        }
        .skx-tour-header {
          flex-shrink: 0;
        }
        .skx-tour-body {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          min-height: 0;
        }
        .skx-tour-footer {
          flex-shrink: 0;
        }
        .skx-tour-jump-btn:hover {
          background: rgba(255, 255, 255, 0.12) !important;
          transform: translateY(-1px);
        }
        .skx-tour-preview-strip:hover {
          border-color: rgba(255, 255, 255, 0.3) !important;
          transform: translateY(-1px);
        }
        .skx-tour-step-dot-wrap {
          padding: 6px 3px;
          display: flex;
          align-items: center;
          cursor: pointer;
        }
        @media (max-width: 640px) {
          .skx-tour-card {
            max-height: 94vh !important;
            border-radius: 16px !important;
          }
          .skx-tour-header {
            padding: 14px 16px 12px 16px !important;
          }
          .skx-tour-body {
            padding: 16px 16px 14px 16px !important;
          }
          .skx-tour-footer {
            padding: 12px 16px 16px 16px !important;
          }
        }
        .skx-tour-step-dot {
          height: 6px;
          border-radius: 3px;
          transition: all 0.25s ease;
          cursor: pointer;
        }
        .skx-tour-btn-prev:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          color: #fff !important;
        }
        .skx-tour-btn-next:hover {
          filter: brightness(1.12);
          transform: translateY(-1px);
        }
        .skx-tour-skip-btn:hover {
          color: #fff !important;
          text-decoration: underline;
        }
      `}</style>

      <div
        className="skx-tour-card"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-label="Interactive Guided Feature Tour"
        style={{
          backgroundImage: currentStep.bgGradient,
        }}
      >
        {/* Top Header Deck */}
        <div
          className="skx-tour-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px 14px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
            background: 'rgba(9, 14, 26, 0.7)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.6px',
                textTransform: 'uppercase',
                color: currentStep.accentColor,
                background: `rgba(${currentStep.accentColor === '#38bdf8' ? '56, 189, 248' : '168, 85, 247'}, 0.12)`,
                border: `1px solid ${currentStep.accentColor}33`,
                padding: '3px 10px',
                borderRadius: '20px'
              }}
            >
              HUB {currentStep.hubNumber} · {currentStep.category}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: '#94a3b8',
                fontWeight: '600'
              }}
            >
              Step {currentStepIndex + 1} of {totalSteps}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onNavigateToHub && currentStep.hubKey && (
              <button
                type="button"
                className="skx-tour-jump-btn"
                onClick={() => handleJumpToHub(currentStep.hubKey)}
                title={`Open ${currentStep.title} directly`}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${currentStep.accentColor}44`,
                  borderRadius: '8px',
                  padding: '5px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: currentStep.accentColor,
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.16s ease'
                }}
              >
                <span>Open Hub</span>
                <ArrowRight size={12} />
              </button>
            )}

            <button
              type="button"
              onClick={() => handleDismiss('closed_x')}
              title="Skip Tour"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.18s ease'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Main Content Area */}
        <div className="skx-tour-body" style={{ padding: '22px 24px 20px 24px' }}>
          <div key={currentStep.id} className="skx-step-content">
            {/* Feature Header with Halo Icon */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                background: `linear-gradient(135deg, ${currentStep.accentColor}25, rgba(255,255,255,0.03))`,
                border: `1px solid ${currentStep.accentColor}55`,
                boxShadow: `0 0 20px ${currentStep.accentColor}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: currentStep.accentColor,
                flexShrink: 0
              }}
            >
              <StepIcon size={26} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <h2
                  style={{
                    fontSize: '20px',
                    fontWeight: '800',
                    margin: 0,
                    letterSpacing: '-0.3px',
                    color: '#ffffff'
                  }}
                >
                  {currentStep.title}
                </h2>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: '700',
                    background: `${currentStep.badgeColor}20`,
                    color: currentStep.badgeColor,
                    border: `1px solid ${currentStep.badgeColor}40`,
                    padding: '2px 8px',
                    borderRadius: '12px'
                  }}
                >
                  {currentStep.badge}
                </span>
              </div>
              <p
                style={{
                  fontSize: '13.5px',
                  color: '#94a3b8',
                  lineHeight: '1.5',
                  margin: 0
                }}
              >
                {currentStep.tagline}
              </p>
            </div>
          </div>

          {/* Highlights 3-Pillar List */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginBottom: '18px'
            }}
          >
            {currentStep.highlights.map((h, i) => {
              const HIcon = h.icon;
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      background: `${currentStep.accentColor}18`,
                      color: currentStep.accentColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '1px'
                    }}
                  >
                    <HIcon size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9', marginBottom: '2px' }}>
                      {h.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
                      {h.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Live Snapshot Strip */}
          <div
            className="skx-tour-preview-strip"
            onClick={() => handleJumpToHub(currentStep.hubKey)}
            title={`Open ${currentStep.title} directly`}
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'rgba(6, 10, 20, 0.85)',
              border: `1px solid ${currentStep.accentColor}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              cursor: 'pointer',
              transition: 'all 0.18s ease'
            }}
          >
            {currentStep.preview.type === 'terminal' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {currentStep.preview.tickers.map((t, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '11px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        color: '#e2e8f0',
                        fontWeight: '600'
                      }}
                    >
                      {t.name}: <strong>{t.val}</strong> <span style={{ color: '#34d399' }}>{t.ch}</span>
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: '11.5px', color: '#38bdf8', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ⚡ {currentStep.preview.wallet}
                </div>
              </>
            )}

            {currentStep.preview.type === 'diary' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                  <span style={{ color: '#a855f7', fontWeight: '800' }}>AI Score: {currentStep.preview.aiScore}</span>
                  <span>·</span>
                  <span>{currentStep.preview.aiVerdict}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '6px' }}>
                  📸 {currentStep.preview.proofSize}
                </div>
              </>
            )}

            {currentStep.preview.type === 'algo' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {currentStep.preview.brokers.map((b, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '10.5px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        color: '#fbbf24',
                        padding: '3px 7px',
                        borderRadius: '6px',
                        fontWeight: '700'
                      }}
                    >
                      ✓ {b}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {currentStep.preview.status}
                </div>
              </>
            )}

            {currentStep.preview.type === 'calc' && (
              <>
                <div style={{ fontSize: '12px', color: '#34d399', fontWeight: '700' }}>
                  📈 {currentStep.preview.sipResult}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '6px' }}>
                  🎯 {currentStep.preview.riskResult}
                </div>
              </>
            )}

            {currentStep.preview.type === 'wealth' && (
              <>
                <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: '700' }}>
                  🏛️ {currentStep.preview.taxSavings}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  📊 {currentStep.preview.budgetSplit}
                </div>
              </>
            )}

            {currentStep.preview.type === 'primary' && (
              <>
                <div style={{ fontSize: '12px', color: '#f43f5e', fontWeight: '700' }}>
                  🔥 {currentStep.preview.ipoDeal}
                </div>
                <div style={{ fontSize: '11px', color: '#34d399', fontWeight: '600' }}>
                  🏢 {currentStep.preview.insiderDeal}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

        {/* Bottom Navigation & Progress Footer */}
        <div
          className="skx-tour-footer"
          style={{
            padding: '16px 24px 20px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.07)',
            background: 'rgba(6, 10, 20, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          {/* Left Action: Skip Tour & Back */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="skx-tour-skip-btn"
              onClick={() => handleDismiss('skipped')}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: '6px 8px'
              }}
            >
              Skip Tour
            </button>

            {!isFirstStep && (
              <button
                type="button"
                className="skx-tour-btn-prev"
                onClick={handlePrev}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '9px',
                  color: '#cbd5e1',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  padding: '7px 12px',
                  cursor: 'pointer',
                  transition: 'all 0.16s ease'
                }}
              >
                <ChevronLeft size={15} /> Back
              </button>
            )}
          </div>

          {/* Center: Progress Indicator Pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {TOUR_STEPS.map((step, idx) => {
              const isActive = idx === currentStepIndex;
              return (
                <div
                  key={step.id}
                  className="skx-tour-step-dot-wrap"
                  onClick={() => setCurrentStepIndex(idx)}
                  title={`Jump to ${step.title}`}
                >
                  <div
                    className="skx-tour-step-dot"
                    style={{
                      width: isActive ? '24px' : '8px',
                      background: isActive ? currentStep.accentColor : 'rgba(255, 255, 255, 0.15)',
                      boxShadow: isActive ? `0 0 10px ${currentStep.accentColor}60` : 'none'
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Right Action: Next Feature or Launch Platform */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="skx-tour-btn-next"
              onClick={handleNext}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: isLastStep
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '800',
                padding: '9px 18px',
                cursor: 'pointer',
                boxShadow: isLastStep
                  ? '0 4px 18px rgba(16, 185, 129, 0.4)'
                  : '0 4px 18px rgba(2, 132, 199, 0.4)',
                transition: 'all 0.18s ease'
              }}
            >
              <span>{isLastStep ? 'Explore Platform & Start Trading 🚀' : 'Next Feature'}</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
