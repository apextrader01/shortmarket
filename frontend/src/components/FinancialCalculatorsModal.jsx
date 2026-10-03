// frontend/src/components/FinancialCalculatorsModal.jsx
// 🧮 Comprehensive Financial & Trading Calculators Suite

import React, { useState, useMemo } from 'react';
import { 
  X, Calculator, TrendingUp, ShieldAlert, Receipt, LineChart, 
  ArrowRight, Info, CheckCircle2, RefreshCw, DollarSign, Percent
} from 'lucide-react';

export default function FinancialCalculatorsModal({ isOpen, onClose, initialTab = 'SIP' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  if (!isOpen) return null;

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
        maxWidth: '900px',
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
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(99, 102, 241, 0.2))',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}>
              <Calculator size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>
                Financial & Trading Calculators
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                Institutional mathematical models for compounding, risk management & post-tax returns
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

        {/* Tab Selector */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
          background: 'rgba(0, 0, 0, 0.2)',
          overflowX: 'auto'
        }}>
          {[
            { id: 'SIP', label: 'SIP & Lumpsum Compounder', icon: TrendingUp },
            { id: 'POSITION', label: 'Position Sizing & Risk/Reward', icon: ShieldAlert },
            { id: 'BROKERAGE', label: 'Brokerage & Tax (STT Oct 2024)', icon: Receipt },
            { id: 'GREEKS', label: 'Options Greeks & Black-Scholes', icon: LineChart }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '12px 18px',
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

        {/* Calculator Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {activeTab === 'SIP' && <SipCalculatorView />}
          {activeTab === 'POSITION' && <PositionSizerView />}
          {activeTab === 'BROKERAGE' && <BrokerageTaxView />}
          {activeTab === 'GREEKS' && <OptionGreeksView />}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 1. SIP & Lumpsum Wealth Compounder
// --------------------------------------------------------------------------
function SipCalculatorView() {
  const [mode, setMode] = useState('SIP'); // 'SIP' | 'LUMPSUM'
  const [monthlyInvestment, setMonthlyInvestment] = useState(15000);
  const [lumpsumAmount, setLumpsumAmount] = useState(200000);
  const [expectedReturn, setExpectedReturn] = useState(14);
  const [years, setYears] = useState(15);
  const [stepUpPct, setStepUpPct] = useState(10); // annual step-up %

  const results = useMemo(() => {
    const rateMonthly = expectedReturn / 12 / 100;
    const totalMonths = years * 12;

    if (mode === 'LUMPSUM') {
      const invested = lumpsumAmount;
      const futureVal = invested * Math.pow(1 + expectedReturn / 100, years);
      const returns = futureVal - invested;
      return { invested, returns, total: futureVal };
    }

    // Step-up SIP or Regular SIP
    let totalInvested = 0;
    let currentMonthly = monthlyInvestment;
    let futureVal = 0;

    for (let yr = 1; yr <= years; yr++) {
      for (let m = 1; m <= 12; m++) {
        totalInvested += currentMonthly;
        // Remaining months compounded
        const remainingMonths = totalMonths - ((yr - 1) * 12 + m) + 1;
        futureVal += currentMonthly * Math.pow(1 + rateMonthly, remainingMonths);
      }
      if (stepUpPct > 0) {
        currentMonthly = currentMonthly * (1 + stepUpPct / 100);
      }
    }

    return {
      invested: totalInvested,
      returns: futureVal - totalInvested,
      total: futureVal
    };
  }, [mode, monthlyInvestment, lumpsumAmount, expectedReturn, years, stepUpPct]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '8px' }}>
          <button
            onClick={() => setMode('SIP')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              background: mode === 'SIP' ? '#0284c7' : 'transparent',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Monthly SIP (with Step-Up)
          </button>
          <button
            onClick={() => setMode('LUMPSUM')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              background: mode === 'LUMPSUM' ? '#0284c7' : 'transparent',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            One-Time Lumpsum
          </button>
        </div>

        {mode === 'SIP' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', color: '#cbd5e1' }}>Monthly Investment</label>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#38bdf8' }}>₹{monthlyInvestment.toLocaleString('en-IN')}</span>
            </div>
            <input 
              type="range" min="500" max="200000" step="500"
              value={monthlyInvestment} 
              onChange={e => setMonthlyInvestment(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#38bdf8' }}
            />
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', color: '#cbd5e1' }}>Lumpsum Amount</label>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#38bdf8' }}>₹{lumpsumAmount.toLocaleString('en-IN')}</span>
            </div>
            <input 
              type="range" min="10000" max="5000000" step="10000"
              value={lumpsumAmount} 
              onChange={e => setLumpsumAmount(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#38bdf8' }}
            />
          </div>
        )}

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '13px', color: '#cbd5e1' }}>Expected Return Rate (p.a.)</label>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#10b981' }}>{expectedReturn}%</span>
          </div>
          <input 
            type="range" min="5" max="30" step="0.5"
            value={expectedReturn} 
            onChange={e => setExpectedReturn(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#10b981' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '13px', color: '#cbd5e1' }}>Time Horizon</label>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#f59e0b' }}>{years} Years</span>
          </div>
          <input 
            type="range" min="1" max="40" step="1"
            value={years} 
            onChange={e => setYears(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#f59e0b' }}
          />
        </div>

        {mode === 'SIP' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', color: '#cbd5e1' }}>Annual Step-Up (% increase every year)</label>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#a855f7' }}>{stepUpPct}%</span>
            </div>
            <input 
              type="range" min="0" max="25" step="1"
              value={stepUpPct} 
              onChange={e => setStepUpPct(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#a855f7' }}
            />
          </div>
        )}
      </div>

      {/* Output Summary */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Maturity Wealth</span>
            <h3 style={{ fontSize: '28px', fontWeight: '800', color: '#38bdf8', margin: '4px 0 0' }}>
              ₹{Math.round(results.total).toLocaleString('en-IN')}
            </h3>
            <span style={{ fontSize: '12px', color: '#10b981' }}>
              {(results.total / (results.invested || 1)).toFixed(1)}x Wealth Multiplier
            </span>
          </div>

          <div style={{ height: '10px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${(results.invested / results.total) * 100}%`, background: '#64748b' }} title="Invested Amount" />
            <div style={{ width: `${(results.returns / results.total) * 100}%`, background: '#10b981' }} title="Compounded Gains" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '8px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Invested Amount</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#e2e8f0', marginTop: '2px' }}>
                ₹{Math.round(results.invested).toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#10b981' }}>Est. Wealth Gains</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#34d399', marginTop: '2px' }}>
                +₹{Math.round(results.returns).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(56, 189, 248, 0.05)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
          <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5' }}>
            💡 <strong>Pro Tip:</strong> An annual {stepUpPct}% step-up increases your maturity corpus by over <strong>40%</strong> compared to a flat SIP by capturing natural salary increments.
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 2. Position Sizing & Risk/Reward Calculator
// --------------------------------------------------------------------------
function PositionSizerView() {
  const [capital, setCapital] = useState(500000);
  const [riskPct, setRiskPct] = useState(1.5);
  const [entryPrice, setEntryPrice] = useState(1250);
  const [stopLoss, setStopLoss] = useState(1220);
  const [targetPrice, setTargetPrice] = useState(1325);

  const calc = useMemo(() => {
    const maxRiskRupees = (capital * riskPct) / 100;
    const riskPerShare = Math.abs(entryPrice - stopLoss);
    const rewardPerShare = Math.abs(targetPrice - entryPrice);

    const qty = riskPerShare > 0 ? Math.floor(maxRiskRupees / riskPerShare) : 0;
    const totalExposure = qty * entryPrice;
    const totalPotentialProfit = qty * rewardPerShare;
    const actualRisk = qty * riskPerShare;
    const rrRatio = riskPerShare > 0 ? (rewardPerShare / riskPerShare).toFixed(2) : 0;

    return {
      maxRiskRupees,
      riskPerShare,
      rewardPerShare,
      qty,
      totalExposure,
      actualRisk,
      totalPotentialProfit,
      rrRatio
    };
  }, [capital, riskPct, entryPrice, stopLoss, targetPrice]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Account Trading Capital (₹)</label>
          <input 
            type="number" 
            value={capital} 
            onChange={e => setCapital(Number(e.target.value))}
            style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '14px', marginTop: '4px' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>Max Risk per Trade (%)</label>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#ef4444' }}>{riskPct}% (₹{Math.round((capital * riskPct) / 100).toLocaleString('en-IN')})</span>
          </div>
          <input 
            type="range" min="0.25" max="5" step="0.25"
            value={riskPct} 
            onChange={e => setRiskPct(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#ef4444', marginTop: '4px' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#94a3b8' }}>Entry Price (₹)</label>
            <input 
              type="number" 
              value={entryPrice} 
              onChange={e => setEntryPrice(Number(e.target.value))}
              style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '4px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#ef4444' }}>Stop Loss (₹)</label>
            <input 
              type="number" 
              value={stopLoss} 
              onChange={e => setStopLoss(Number(e.target.value))}
              style={{ width: '100%', padding: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#fca5a5', fontSize: '13px', marginTop: '4px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#10b981' }}>Target Price (₹)</label>
            <input 
              type="number" 
              value={targetPrice} 
              onChange={e => setTargetPrice(Number(e.target.value))}
              style={{ width: '100%', padding: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', color: '#6ee7b7', fontSize: '13px', marginTop: '4px' }}
            />
          </div>
        </div>
      </div>

      {/* Execution Advice Card */}
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
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Recommended Position Sizing</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <h3 style={{ fontSize: '32px', fontWeight: '800', color: '#38bdf8', margin: 0 }}>
              {calc.qty.toLocaleString()}
            </h3>
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>Shares</span>
          </div>
          <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '2px' }}>
            Total Capital Required: <strong>₹{Math.round(calc.totalExposure).toLocaleString('en-IN')}</strong>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#ef4444' }}>Max Risk on SL Hit</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#f87171', marginTop: '2px' }}>
                -₹{Math.round(calc.actualRisk).toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#10b981' }}>Profit on Target Hit</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#34d399', marginTop: '2px' }}>
                +₹{Math.round(calc.totalPotentialProfit).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>

        <div style={{
          marginTop: '16px',
          padding: '12px',
          borderRadius: '8px',
          background: Number(calc.rrRatio) >= 2 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
          border: `1px solid ${Number(calc.rrRatio) >= 2 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Risk : Reward Ratio</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: Number(calc.rrRatio) >= 2 ? '#10b981' : '#f59e0b' }}>
              1 : {calc.rrRatio}
            </div>
          </div>
          <span style={{ fontSize: '12px', fontWeight: '600', color: Number(calc.rrRatio) >= 2 ? '#34d399' : '#fbbf24' }}>
            {Number(calc.rrRatio) >= 2 ? '✓ High Quality Setup' : '⚠️ Low R:R (< 1:2)'}
          </span>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 3. Brokerage & Tax Calculator (STT revised Oct 2024 rates)
// --------------------------------------------------------------------------
function BrokerageTaxView() {
  const [segment, setSegment] = useState('EQUITY_INTRADAY'); // 'EQUITY_INTRADAY' | 'EQUITY_DELIVERY' | 'FUTURES' | 'OPTIONS'
  const [buyPrice, setBuyPrice] = useState(1500);
  const [sellPrice, setSellPrice] = useState(1525);
  const [quantity, setQuantity] = useState(200);

  const breakdown = useMemo(() => {
    const buyVal = buyPrice * quantity;
    const sellVal = sellPrice * quantity;
    const turnover = buyVal + sellVal;
    const grossPnl = sellVal - buyVal;

    let brokerage = 0;
    let stt = 0;
    let exchTxn = 0;
    let sebiTurnover = 0;
    let gst = 0;
    let stampDuty = 0;

    if (segment === 'EQUITY_INTRADAY') {
      brokerage = Math.min(20, buyVal * 0.0003) + Math.min(20, sellVal * 0.0003);
      stt = sellVal * 0.00025; // 0.025% on sell side
      exchTxn = turnover * 0.0000297; // NSE 0.00297%
      stampDuty = buyVal * 0.00003; // 0.003% on buy
    } else if (segment === 'EQUITY_DELIVERY') {
      brokerage = 0; // Discount brokers ₹0 delivery
      stt = turnover * 0.001; // 0.1% on buy & sell
      exchTxn = turnover * 0.0000297;
      stampDuty = buyVal * 0.00015; // 0.015% on buy
    } else if (segment === 'FUTURES') {
      brokerage = 20 + 20; // flat ₹20 per executed order
      stt = sellVal * 0.0002; // Revised to 0.02% from Oct 2024
      exchTxn = turnover * 0.0000173;
      stampDuty = buyVal * 0.00002;
    } else if (segment === 'OPTIONS') {
      brokerage = 20 + 20;
      stt = sellVal * 0.001; // Revised to 0.1% on sell option premium from Oct 2024
      exchTxn = turnover * 0.0003503;
      stampDuty = buyVal * 0.00003;
    }

    sebiTurnover = (turnover / 10000000) * 10; // ₹10 per crore
    gst = (brokerage + exchTxn + sebiTurnover) * 0.18; // 18% GST

    const totalCharges = brokerage + stt + exchTxn + sebiTurnover + gst + stampDuty;
    const netPnl = grossPnl - totalCharges;
    const breakevenPoints = quantity > 0 ? (totalCharges / quantity) : 0;

    return {
      buyVal,
      sellVal,
      turnover,
      grossPnl,
      brokerage,
      stt,
      exchTxn,
      sebiTurnover,
      gst,
      stampDuty,
      totalCharges,
      netPnl,
      breakevenPoints
    };
  }, [segment, buyPrice, sellPrice, quantity]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          {[
            { id: 'EQUITY_INTRADAY', label: 'Equity Intraday' },
            { id: 'EQUITY_DELIVERY', label: 'Equity Delivery' },
            { id: 'FUTURES', label: 'F&O Futures' },
            { id: 'OPTIONS', label: 'F&O Options' }
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setSegment(s.id)}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: 'none',
                background: segment === s.id ? '#0284c7' : 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>Buy Price (₹)</label>
            <input 
              type="number" 
              value={buyPrice} 
              onChange={e => setBuyPrice(Number(e.target.value))}
              style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '14px', marginTop: '4px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>Sell Price (₹)</label>
            <input 
              type="number" 
              value={sellPrice} 
              onChange={e => setSellPrice(Number(e.target.value))}
              style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '14px', marginTop: '4px' }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>Quantity / Lots</label>
          <input 
            type="number" 
            value={quantity} 
            onChange={e => setQuantity(Number(e.target.value))}
            style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '14px', marginTop: '4px' }}
          />
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Turnover Summary</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#cbd5e1' }}>
            <span>Total Turnover:</span>
            <strong>₹{Math.round(breakdown.turnover).toLocaleString('en-IN')}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#cbd5e1', marginTop: '4px' }}>
            <span>Breakeven Pts:</span>
            <strong style={{ color: '#f59e0b' }}>+₹{breakdown.breakevenPoints.toFixed(2)} / share</strong>
          </div>
        </div>
      </div>

      {/* Tax & Charges Table */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#e2e8f0' }}>Government & Exchange Charges</span>
            <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px' }}>Budget 2024 Rates</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
              <span>Brokerage:</span>
              <span style={{ color: '#f8fafc' }}>₹{breakdown.brokerage.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
              <span>STT / CTT:</span>
              <span style={{ color: '#f8fafc' }}>₹{breakdown.stt.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
              <span>Exchange Txn Charges:</span>
              <span style={{ color: '#f8fafc' }}>₹{breakdown.exchTxn.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
              <span>GST (18% on Brokerage & Txn):</span>
              <span style={{ color: '#f8fafc' }}>₹{breakdown.gst.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
              <span>SEBI Charges & Stamp Duty:</span>
              <span style={{ color: '#f8fafc' }}>₹{(breakdown.sebiTurnover + breakdown.stampDuty).toFixed(2)}</span>
            </div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: '#ef4444' }}>
              <span>Total Statutory Charges:</span>
              <span>-₹{breakdown.totalCharges.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style={{
          marginTop: '16px',
          padding: '14px',
          borderRadius: '10px',
          background: breakdown.netPnl >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${breakdown.netPnl >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
        }}>
          <div style={{ fontSize: '11px', color: breakdown.netPnl >= 0 ? '#10b981' : '#ef4444', textTransform: 'uppercase' }}>
            Net Realized Profit / Loss
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: breakdown.netPnl >= 0 ? '#34d399' : '#f87171', marginTop: '2px' }}>
            {breakdown.netPnl >= 0 ? '+' : ''}₹{breakdown.netPnl.toFixed(2)}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            Gross P&L: ₹{breakdown.grossPnl.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 4. Options Greeks & Black-Scholes Calculator
// --------------------------------------------------------------------------
function OptionGreeksView() {
  const [spotPrice, setSpotPrice] = useState(24500);
  const [strikePrice, setStrikePrice] = useState(24500);
  const [daysToExpiry, setDaysToExpiry] = useState(7);
  const [ivPct, setIvPct] = useState(14);
  const [optionType, setOptionType] = useState('CE'); // 'CE' | 'PE'

  // Standard normal cumulative distribution approximation
  const normalCdf = (x) => {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x) / Math.sqrt(2.0);
    const t = 1.0 / (1.0 + p * absX);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    return 0.5 * (1.0 + sign * y);
  };

  const normalPdf = (x) => {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  };

  const greeks = useMemo(() => {
    const S = spotPrice;
    const K = strikePrice;
    const T = Math.max(daysToExpiry / 365, 0.0001);
    const v = ivPct / 100;
    const r = 0.07; // 7% risk-free Indian rate

    const d1 = (Math.log(S / K) + (r + 0.5 * v * v) * T) / (v * Math.sqrt(T));
    const d2 = d1 - v * Math.sqrt(T);

    const callPrice = S * normalCdf(d1) - K * Math.exp(-r * T) * normalCdf(d2);
    const putPrice = K * Math.exp(-r * T) * normalCdf(-d2) - S * normalCdf(-d1);

    const delta = optionType === 'CE' ? normalCdf(d1) : normalCdf(d1) - 1;
    const gamma = normalPdf(d1) / (S * v * Math.sqrt(T));
    
    // Theta per day
    const thetaCall = (- (S * normalPdf(d1) * v) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normalCdf(d2)) / 365;
    const thetaPut = (- (S * normalPdf(d1) * v) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * normalCdf(-d2)) / 365;
    const theta = optionType === 'CE' ? thetaCall : thetaPut;

    // Vega per 1% change in IV
    const vega = (S * normalPdf(d1) * Math.sqrt(T)) / 100;

    return {
      premium: optionType === 'CE' ? callPrice : putPrice,
      delta,
      gamma,
      theta,
      vega,
      moneyness: Math.abs(S - K) < (S * 0.002) ? 'ATM (At The Money)' : (optionType === 'CE' ? (S > K ? 'ITM (In The Money)' : 'OTM (Out The Money)') : (S < K ? 'ITM' : 'OTM'))
    };
  }, [spotPrice, strikePrice, daysToExpiry, ivPct, optionType]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setOptionType('CE')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              background: optionType === 'CE' ? '#10b981' : 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Call Option (CE)
          </button>
          <button
            onClick={() => setOptionType('PE')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              background: optionType === 'PE' ? '#ef4444' : 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Put Option (PE)
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>Underlying Spot (₹)</label>
            <input 
              type="number" 
              value={spotPrice} 
              onChange={e => setSpotPrice(Number(e.target.value))}
              style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '4px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>Strike Price (₹)</label>
            <input 
              type="number" 
              value={strikePrice} 
              onChange={e => setStrikePrice(Number(e.target.value))}
              style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '4px' }}
            />
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>Days to Expiry (DTE)</label>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#f59e0b' }}>{daysToExpiry} Days</span>
          </div>
          <input 
            type="range" min="1" max="90" step="1"
            value={daysToExpiry} 
            onChange={e => setDaysToExpiry(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#f59e0b', marginTop: '4px' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>Implied Volatility (IV %)</label>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#a855f7' }}>{ivPct}%</span>
          </div>
          <input 
            type="range" min="5" max="80" step="0.5"
            value={ivPct} 
            onChange={e => setIvPct(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#a855f7', marginTop: '4px' }}
          />
        </div>
      </div>

      {/* Greek Output Metrics */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Fair Option Premium</span>
            <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px' }}>{greeks.moneyness}</span>
          </div>
          <h3 style={{ fontSize: '32px', fontWeight: '800', color: '#38bdf8', margin: '4px 0 0' }}>
            ₹{Math.max(0, greeks.premium).toFixed(2)}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Δ Delta (Spot Sensitivity)</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#f8fafc', marginTop: '2px' }}>
                {greeks.delta.toFixed(3)}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Γ Gamma (Delta Acceleration)</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#f8fafc', marginTop: '2px' }}>
                {greeks.gamma.toFixed(5)}
              </div>
            </div>
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ fontSize: '11px', color: '#ef4444' }}>Θ Theta (Daily Time Decay)</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#fca5a5', marginTop: '2px' }}>
                {greeks.theta.toFixed(2)} / day
              </div>
            </div>
            <div style={{ background: 'rgba(168, 85, 247, 0.08)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
              <div style={{ fontSize: '11px', color: '#c084fc' }}>V Vega (1% IV Change)</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#d8b4fe', marginTop: '2px' }}>
                ₹{greeks.vega.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '16px', fontSize: '11px', color: '#94a3b8', lineHeight: '1.4' }}>
          * Calculated via standard Black-Scholes-Merton continuous compounding model with risk-free rate r = 7.0%.
        </div>
      </div>
    </div>
  );
}
