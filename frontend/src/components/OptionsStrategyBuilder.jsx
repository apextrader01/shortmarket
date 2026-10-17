import React, { useMemo, useState, useCallback } from 'react';
import { 
  ComposedChart, 
  Area, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine 
} from 'recharts';
import { calculateGreeks, calculateIV } from '../utils/blackScholes';
import { getInstantLotsize } from '../utils/lotsizeHelper';
import { useStore } from '../store';
import { 
  Plus, 
  Minus, 
  Trash2, 
  RefreshCw, 
  Sliders, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  HelpCircle,
  X
} from 'lucide-react';

// Standard Normal CDF approximation (Abramowitz and Stegun) for POP
function N(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

export default function OptionsStrategyBuilder({
  legs = [],
  spotPrice = 0,
  expiryDate = '',
  symbol = 'NIFTY',
  strikes = [],
  allStrikes = [],
  chain = {},
  onRemoveLeg,
  onClear,
  onUpdateLeg,
  onAddLeg,
  onClose,
  onExecute
}) {
  const [targetPriceOffset, setTargetPriceOffset] = useState(0); // Offset in Rupees from spot
  const [targetDteOffset, setTargetDteOffset] = useState(0); // Days forward from Today (0 = Today, diffDays = Expiry)
  const [multiplier, setMultiplier] = useState(1); // Multiplier for all lots

  const prices = useStore(state => state.prices);

  // Helper to resolve live LTP from store for any leg or contract
  const resolveStoreLtp = useCallback((legOrContract) => {
    if (!legOrContract) return 0;
    const sym = legOrContract.symbol;
    const token = legOrContract.token ? String(legOrContract.token) : null;
    const raw = sym ? sym.replace(/^[A-Z0-9]+:/, '') : null;
    const pref = sym && !sym.includes(':') ? `${legOrContract.exch_seg || 'NSE'}:${sym}` : sym;
    const key = sym ? (sym.includes('-') ? sym : `${sym}-${legOrContract.exch_seg || 'NSE'}`) : null;

    const match = (sym && prices[sym]) ||
                  (token && prices[token]) ||
                  (raw && prices[raw]) ||
                  (pref && prices[pref]) ||
                  (key && prices[key]);

    if (match?.ltp && Number(match.ltp) > 0) return Number(match.ltp);
    if (legOrContract.livePrice && Number(legOrContract.livePrice) > 0) return Number(legOrContract.livePrice);
    if (legOrContract.price && Number(legOrContract.price) > 0) return Number(legOrContract.price);
    if (legOrContract.ltp && Number(legOrContract.ltp) > 0) return Number(legOrContract.ltp);
    return 0;
  }, [prices]);

  // Effective price prioritizing user custom price over live store LTP
  const resolveEffectivePrice = useCallback((leg) => {
    if (leg.customPrice !== undefined && leg.customPrice !== null && leg.customPrice !== '' && !isNaN(Number(leg.customPrice))) {
      return Number(leg.customPrice);
    }
    const live = resolveStoreLtp(leg);
    if (live > 0) return live;
    if (leg.price && !isNaN(Number(leg.price)) && Number(leg.price) > 0) return Number(leg.price);
    return 0;
  }, [resolveStoreLtp]);

  // Reset all leg prices back to live market LTP
  const handleResetPrices = useCallback(() => {
    legs.forEach((leg, i) => {
      const live = resolveStoreLtp({ ...leg, customPrice: undefined });
      onUpdateLeg?.(i, { ...leg, customPrice: undefined, price: live });
    });
  }, [legs, onUpdateLeg, resolveStoreLtp]);

  // Step strike up or down using available chain strikes
  const handleStepStrike = useCallback((idx, direction) => {
    const leg = legs[idx];
    const strikeList = (allStrikes && allStrikes.length > 0) ? allStrikes : (strikes || []);
    if (strikeList.length === 0) return;
    const currStrike = Number(leg.strike);
    const currIdx = strikeList.indexOf(currStrike);
    const newIdx = currIdx === -1 ? 0 : currIdx + direction;
    if (newIdx < 0 || newIdx >= strikeList.length) return;
    const newStrike = strikeList[newIdx];
    const newContract = chain?.[newStrike]?.[leg.optionType];

    if (newContract) {
      const live = resolveStoreLtp(newContract);
      onUpdateLeg?.(idx, {
        ...leg,
        strike: newStrike,
        symbol: newContract.symbol,
        token: newContract.token,
        lotsize: newContract.lotsize ? parseInt(newContract.lotsize) : (getInstantLotsize(newContract.symbol) || leg.lotsize || 1),
        price: live,
        customPrice: undefined
      });
    } else {
      onUpdateLeg?.(idx, { ...leg, strike: newStrike });
    }
  }, [legs, allStrikes, strikes, chain, onUpdateLeg, resolveStoreLtp]);

  // Toggle option type between CE and PE
  const handleToggleType = useCallback((idx) => {
    const leg = legs[idx];
    const newType = leg.optionType === 'CE' ? 'PE' : 'CE';
    const newContract = chain?.[leg.strike]?.[newType];
    if (newContract) {
      const live = resolveStoreLtp(newContract);
      onUpdateLeg?.(idx, {
        ...leg,
        optionType: newType,
        symbol: newContract.symbol,
        token: newContract.token,
        lotsize: newContract.lotsize ? parseInt(newContract.lotsize) : (getInstantLotsize(newContract.symbol) || leg.lotsize || 1),
        price: live,
        customPrice: undefined
      });
    } else {
      onUpdateLeg?.(idx, { ...leg, optionType: newType });
    }
  }, [legs, chain, onUpdateLeg, resolveStoreLtp]);

  // Primary Financial & Payoff Calculations
  const {
    data, 
    maxProfit, 
    maxLoss, 
    breakevens, 
    netPremium, 
    pop, 
    totalDelta, 
    totalTheta, 
    totalGamma, 
    totalVega, 
    dte,
    targetDaysLeft,
    fundsNeeded,
    intrinsicVal,
    timeVal,
    minPrice,
    maxPrice,
    chartTicks
  } = useMemo(() => {
    if (!legs || legs.length === 0) {
      return { 
        data: [], maxProfit: 0, maxLoss: 0, breakevens: [], netPremium: 0, 
        pop: 0, totalDelta: 0, totalTheta: 0, totalGamma: 0, totalVega: 0, dte: 0,
        targetDaysLeft: 0, fundsNeeded: 0, intrinsicVal: 0, timeVal: 0,
        minPrice: 0, maxPrice: 0, chartTicks: []
      };
    }

    // 1. Calculate DTE targeted to 15:30 IST market close on expiry date
    let exp = new Date();
    if (expiryDate) {
      const match = expiryDate.match(/^(\d{2})([A-Z]{3})(\d{2,4})$/i);
      if (match) {
        const day = parseInt(match[1]);
        const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
        const month = months[match[2].toUpperCase()];
        const year = match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3]);
        if (month !== undefined) exp = new Date(year, month, day);
      } else if (typeof expiryDate === 'string' && expiryDate.includes('-')) {
        const parts = expiryDate.split('-');
        if (parts.length === 3) exp = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        else {
          const parsed = new Date(expiryDate);
          if (!isNaN(parsed)) exp = parsed;
        }
      } else {
        const parsed = new Date(expiryDate);
        if (!isNaN(parsed)) exp = parsed;
      }
    }
    exp.setHours(15, 30, 0, 0);
    const now = new Date();
    const msDiff = exp.getTime() - now.getTime();
    const diffDays = msDiff > 0 ? msDiff / (1000 * 60 * 60 * 24) : 0.005;

    const clampedTargetOffset = Math.min(Math.max(0, targetDteOffset), Math.max(0, diffDays - 0.001));
    const targetDaysLeftVal = Math.max(0.001, diffDays - clampedTargetOffset);
    const T_target = targetDaysLeftVal / 365.0;
    const T_today = Math.max(0.001, diffDays / 365.0);

    // 2. Strike bounds and dynamic X-axis range
    const strikeValues = legs.map(l => Number(l.strike) || 0).filter(s => s > 0);
    const effectiveSpot = Number(spotPrice) > 0 ? Number(spotPrice) : (strikeValues[0] || 22000);
    const minStrike = strikeValues.length > 0 ? Math.min(...strikeValues) : effectiveSpot;
    const maxStrike = strikeValues.length > 0 ? Math.max(...strikeValues) : effectiveSpot;

    const strikeSpan = Math.max(maxStrike - minStrike, effectiveSpot * 0.04);
    const buffer = Math.max(strikeSpan * 1.5, effectiveSpot * 0.06);

    // Calculate nice round bounds aligned to strike increments (e.g. 50 or 100)
    const tickStep = (effectiveSpot > 40000 || symbol.includes('SENSEX') || symbol.includes('BANK')) ? 200 : 100;
    const rawMin = Math.max(100, Math.floor((Math.min(minStrike, effectiveSpot) - buffer) / tickStep) * tickStep);
    const rawMax = Math.ceil((Math.max(maxStrike, effectiveSpot) + buffer) / tickStep) * tickStep;

    const totalSteps = 120;
    const stepSize = Math.max(1, (rawMax - rawMin) / totalSteps);

    const getLegQty = (leg) => {
      const lotCount = (Number(leg.quantity) || 1) * (Number(multiplier) || 1);
      const lotSize = Number(leg.lotsize) || (leg.symbol ? getInstantLotsize(leg.symbol) : 1);
      return lotCount * lotSize;
    };

    let netPrem = 0;
    let tDelta = 0, tTheta = 0, tGamma = 0, tVega = 0;
    let totIntrinsic = 0;

    legs.forEach(leg => {
      const price = resolveEffectivePrice(leg);
      const qty = getLegQty(leg);
      const val = price * qty;
      const sign = leg.side === 'BUY' ? 1 : -1;
      netPrem += (leg.side === 'BUY' ? -val : val);

      // Intrinsic value calculation at current spot
      const strike = Number(leg.strike) || 0;
      const curIntrinsic = leg.optionType === 'CE' 
        ? Math.max(0, effectiveSpot - strike) 
        : Math.max(0, strike - effectiveSpot);
      totIntrinsic += (leg.side === 'BUY' ? curIntrinsic : -curIntrinsic) * qty;

      // Greeks for Today
      let iv = Number(leg.iv) || 0;
      if (iv <= 0 && price > 0) {
        iv = calculateIV(leg.optionType, price, effectiveSpot, strike, T_today, 0.10, false);
      }
      if (!iv || iv <= 0) iv = 0.15;

      const g = calculateGreeks(leg.optionType, effectiveSpot, strike, T_today, 0.10, iv);
      tDelta += g.delta * qty * sign;
      tTheta += g.theta * qty * sign;
      tGamma += g.gamma * qty * sign;
      tVega += g.vega * qty * sign;
    });

    const totTimeVal = Math.max(0, Math.abs(netPrem) - Math.max(0, totIntrinsic));

    // Expiry payoff at a specific underlying price
    const calculateExpiryPayoff = (priceAtExpiry) => {
      let totalPnl = 0;
      legs.forEach(leg => {
        const strike = Number(leg.strike) || 0;
        const price = resolveEffectivePrice(leg);
        const qty = getLegQty(leg);
        const intrinsic = leg.optionType === 'CE' 
          ? Math.max(0, priceAtExpiry - strike) 
          : Math.max(0, strike - priceAtExpiry);
        totalPnl += (leg.side === 'BUY') ? (intrinsic - price) * qty : (price - intrinsic) * qty;
      });
      return totalPnl;
    };

    // Target date payoff at a specific underlying price using Black-Scholes theoretical value
    const calculateTargetPayoff = (targetSpotVal) => {
      let totalPnl = 0;
      legs.forEach(leg => {
        const strike = Number(leg.strike) || 0;
        const price = resolveEffectivePrice(leg);
        const qty = getLegQty(leg);
        let iv = Number(leg.iv) || 0;
        if (iv <= 0 && price > 0) {
          iv = calculateIV(leg.optionType, price, effectiveSpot, strike, T_today, 0.10, false);
        }
        if (!iv || iv <= 0) iv = 0.15;

        let targetVal = 0;
        if (targetDaysLeftVal <= 0.005) {
          targetVal = leg.optionType === 'CE' ? Math.max(0, targetSpotVal - strike) : Math.max(0, strike - targetSpotVal);
        } else {
          const g = calculateGreeks(leg.optionType, targetSpotVal, strike, T_target, 0.10, iv);
          targetVal = g.price;
        }

        totalPnl += (leg.side === 'BUY') ? (targetVal - price) * qty : (price - targetVal) * qty;
      });
      return totalPnl;
    };

    const dataPoints = [];
    let pMax = -Infinity;
    let pMin = Infinity;

    for (let p = rawMin; p <= rawMax; p += stepSize) {
      const pnlExp = calculateExpiryPayoff(p);
      const pnlTgt = calculateTargetPayoff(p);
      dataPoints.push({ price: Math.round(p), pnlExpiry: pnlExp, pnlTarget: pnlTgt });
      if (pnlExp > pMax) pMax = pnlExp;
      if (pnlExp < pMin) pMin = pnlExp;
    }

    // Evaluate boundary at price = 0
    // Stock/Index prices cannot drop below zero.
    // Left tail payoff is strictly bounded at price = 0, which is already evaluated above.
    const pnlAtZero = calculateExpiryPayoff(0);
    if (pnlAtZero > pMax) pMax = pnlAtZero;
    if (pnlAtZero < pMin) pMin = pnlAtZero;

    // Detect exact Breakevens via zero-crossing interpolation
    const beCrossings = [];
    for (let i = 1; i < dataPoints.length; i++) {
      const prev = dataPoints[i - 1];
      const curr = dataPoints[i];
      if ((prev.pnlExpiry < 0 && curr.pnlExpiry >= 0) || (prev.pnlExpiry > 0 && curr.pnlExpiry <= 0)) {
        const denom = Math.abs(prev.pnlExpiry) + Math.abs(curr.pnlExpiry);
        const ratio = denom > 0 ? Math.abs(prev.pnlExpiry) / denom : 0.5;
        const interpolated = prev.price + (curr.price - prev.price) * ratio;
        if (Number.isFinite(interpolated) && interpolated > 0) {
          beCrossings.push(interpolated);
        }
      }
    }
    const finalBE = [...new Set(beCrossings.map(b => Math.round(b)))].sort((a, b) => a - b);

    // Unbounded check on the right tail (price goes to +infinity)
    let isMaxProfitInfinity = false;
    let isMaxLossInfinity = false;
    const testFarPrice = rawMax + 2000;
    const rightSlope = (calculateExpiryPayoff(testFarPrice + 100) - calculateExpiryPayoff(testFarPrice)) / 100;

    if (rightSlope > 0.05) isMaxProfitInfinity = true;
    if (rightSlope < -0.05) isMaxLossInfinity = true;

    // Probability of Profit (POP) using Black-Scholes standard normal CDF
    let popVal = 0;
    const avgIv = legs.reduce((acc, l) => acc + (Number(l.iv) || 0.15), 0) / legs.length;
    const sigmaT = (avgIv > 0 ? avgIv : 0.15) * Math.sqrt(diffDays / 365);

    if (sigmaT > 0 && effectiveSpot > 0) {
      if (finalBE.length === 0) {
        if (pMin >= 0) popVal = 100;
        else if (pMax <= 0) popVal = 0;
        else {
          const curPnl = calculateExpiryPayoff(effectiveSpot);
          popVal = curPnl > 0 ? 80 : 20;
        }
      } else if (finalBE.length === 1) {
        const b = finalBE[0];
        const d2 = (Math.log(effectiveSpot / b) + (0.10 - (avgIv * avgIv) / 2) * (diffDays / 365)) / sigmaT;
        const profitRight = calculateExpiryPayoff(b + 5) > 0;
        popVal = profitRight ? N(d2) * 100 : N(-d2) * 100;
      } else if (finalBE.length >= 2) {
        const b1 = finalBE[0];
        const b2 = finalBE[finalBE.length - 1];
        const d2_1 = (Math.log(effectiveSpot / b1) + (0.10 - (avgIv * avgIv) / 2) * (diffDays / 365)) / sigmaT;
        const d2_2 = (Math.log(effectiveSpot / b2) + (0.10 - (avgIv * avgIv) / 2) * (diffDays / 365)) / sigmaT;
        const probBelowB1 = N(-d2_1);
        const probAboveB2 = N(d2_2);
        const probBetween = Math.max(0, 1 - probBelowB1 - probAboveB2);

        const pMid = calculateExpiryPayoff((b1 + b2) / 2);
        popVal = pMid > 0 ? probBetween * 100 : (probBelowB1 + probAboveB2) * 100;
      }
    }
    popVal = Math.min(100, Math.max(0, popVal));

    // Funds / Margin Needed approximation
    const netDebit = netPrem < 0 ? Math.abs(netPrem) : 0;
    const sellLegCount = legs.filter(l => l.side === 'SELL').length;
    const estMargin = sellLegCount > 0 
      ? Math.max(netDebit, sellLegCount * effectiveSpot * (getLegQty(legs[0]) / Math.max(1, legs[0].quantity || 1)) * 0.12)
      : netDebit;

    // Clean round chart ticks
    const tickInterval = (rawMax - rawMin > 2500) ? 500 : ((rawMax - rawMin > 1200) ? 200 : 100);
    const ticks = [];
    const firstTick = Math.ceil(rawMin / tickInterval) * tickInterval;
    for (let t = firstTick; t <= rawMax; t += tickInterval) {
      ticks.push(t);
    }

    return {
      data: dataPoints,
      maxProfit: isMaxProfitInfinity ? Infinity : pMax,
      maxLoss: isMaxLossInfinity ? -Infinity : pMin,
      breakevens: finalBE,
      netPremium: netPrem,
      pop: popVal,
      totalDelta: tDelta,
      totalTheta: tTheta,
      totalGamma: tGamma,
      totalVega: tVega,
      dte: diffDays,
      targetDaysLeft: targetDaysLeftVal,
      fundsNeeded: estMargin,
      intrinsicVal: totIntrinsic,
      timeVal: totTimeVal,
      minPrice: rawMin,
      maxPrice: rawMax,
      chartTicks: ticks
    };
  }, [legs, spotPrice, expiryDate, symbol, targetDteOffset, multiplier, resolveEffectivePrice]);

  // Gradient offset for soft area fill
  const gradientOffset = useMemo(() => {
    if (!data || data.length === 0) return 0.5;
    const valid = data.map(i => i.pnlExpiry).filter(p => !isNaN(p) && isFinite(p));
    if (valid.length === 0) return 0.5;
    const dataMax = Math.max(...valid);
    const dataMin = Math.min(...valid);
    if (dataMax <= 0) return 0;
    if (dataMin >= 0) return 1;
    const range = dataMax - dataMin;
    return range <= 0 ? 0.5 : Math.max(0, Math.min(1, dataMax / range));
  }, [data]);

  const targetSpotPrice = (spotPrice || 22000) + targetPriceOffset;
  const targetPct = spotPrice > 0 ? ((targetSpotPrice / spotPrice) - 1) * 100 : 0;

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const pTgt = payload.find(p => p.dataKey === 'pnlTarget')?.value || 0;
      const pExp = payload.find(p => p.dataKey === 'pnlExpiry')?.value || 0;
      return (
        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', padding: '12px 16px', borderRadius: '8px', color: '#fff', fontSize: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}>
          <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
            Strike: ₹{Number(label).toLocaleString('en-IN')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '6px' }}>
            <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }}></span>
              Target Date P&L:
            </span>
            <strong style={{ color: pTgt >= 0 ? '#10b981' : '#ef4444' }}>
              {pTgt >= 0 ? '+' : '-'}₹{Math.abs(pTgt).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
              On Expiry P&L:
            </span>
            <strong style={{ color: pExp >= 0 ? '#10b981' : '#ef4444' }}>
              {pExp >= 0 ? '+' : '-'}₹{Math.abs(pExp).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </strong>
          </div>
        </div>
      );
    }
    return null;
  };

  if (!legs || legs.length === 0) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <p style={{ fontSize: '16px', marginBottom: '16px' }}>No legs in Strategy Builder.</p>
        <p style={{ fontSize: '13px' }}>Select a ready-made template above or click <strong>BUY / SELL</strong> on any strike in the Option Chain table.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', color: 'var(--text-primary)' }}>
      
      {/* ⚡ HEADER BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{symbol} Strategy Builder</span>
          </h2>
          <span style={{ padding: '3px 10px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', borderRadius: '20px', fontSize: '11px', fontWeight: '700', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
            {dte.toFixed(0)} DTE ({expiryDate})
          </span>
          {spotPrice > 0 && (
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>
              Spot: <strong style={{ color: 'var(--text-primary)' }}>₹{spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            type="button" 
            onClick={handleResetPrices}
            className="btn-mini"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
            title="Reset legs to real-time live market prices"
          >
            <RefreshCw size={12} /> Reset Prices
          </button>
          <button 
            type="button" 
            onClick={onClear}
            className="btn-mini sell"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
          >
            <Trash2 size={12} /> Clear
          </button>
        </div>
      </div>

      {/* 📊 SENSIBULL-GRADE METRICS BAR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '10px' }}>
        <MetricCard 
          title="Max Profit" 
          value={maxProfit === Infinity ? 'Unlimited' : `₹${maxProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
          color={maxProfit === Infinity || maxProfit > 0 ? '#10b981' : 'var(--text-primary)'}
          badge={maxProfit === Infinity ? 'Uncapped' : null}
        />
        <MetricCard 
          title="Max Loss" 
          value={maxLoss === -Infinity ? 'Unlimited' : (maxLoss >= 0 ? `+₹${maxLoss.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (Credit Lock)` : `-₹${Math.abs(maxLoss).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`)}
          color={maxLoss === -Infinity ? '#ef4444' : (maxLoss >= 0 ? '#10b981' : '#f87171')}
          badge={maxLoss === -Infinity ? 'High Risk' : null}
        />
        <MetricCard 
          title="Reward / Risk" 
          value={maxLoss === -Infinity || maxLoss === 0 || maxProfit === Infinity ? (maxProfit === Infinity ? 'Unlimited' : 'N/A') : `1 : ${(Math.abs(maxProfit) / Math.max(1, Math.abs(maxLoss))).toFixed(1)}`}
        />
        <MetricCard 
          title="POP" 
          value={`${pop.toFixed(1)}%`}
          color={pop >= 50 ? '#10b981' : '#eab308'}
          subtitle="Prob of Profit"
        />
        <MetricCard 
          title="Breakeven" 
          value={breakevens.length === 0 ? 'None' : breakevens.map(b => `₹${b}`).join(', ')}
          subtitle={breakevens.length > 0 && spotPrice > 0 ? `${(((breakevens[0] / spotPrice) - 1) * 100).toFixed(1)}% from spot` : null}
        />
        <MetricCard 
          title="Net Premium" 
          value={netPremium >= 0 ? `Credit +₹${netPremium.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : `Debit -₹${Math.abs(netPremium).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          color={netPremium >= 0 ? '#10b981' : '#60a5fa'}
        />
        <MetricCard 
          title="Funds Needed" 
          value={`₹${Math.round(fundsNeeded).toLocaleString('en-IN')}`}
          subtitle={`Time Val: ₹${Math.round(timeVal).toLocaleString('en-IN')}`}
        />
      </div>

      {/* ⚡ MAIN CONTENT SPLIT: LEGS & GREEKS (LEFT) + PAYOFF CHART (RIGHT) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: '20px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: GREEKS, SLIDERS & LEGS TABLE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Greeks Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '11px', textAlign: 'center' }}>
            <div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Delta</div>
              <div style={{ fontWeight: '700', fontSize: '13px', color: totalDelta >= 0 ? '#10b981' : '#ef4444' }}>
                {totalDelta >= 0 ? '+' : ''}{totalDelta.toFixed(1)}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Theta / day</div>
              <div style={{ fontWeight: '700', fontSize: '13px', color: totalTheta >= 0 ? '#10b981' : '#ef4444' }}>
                ₹{totalTheta.toFixed(0)}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Gamma</div>
              <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>
                {totalGamma.toFixed(4)}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Vega / 1%</div>
              <div style={{ fontWeight: '700', fontSize: '13px', color: totalVega >= 0 ? '#60a5fa' : 'var(--text-primary)' }}>
                ₹{totalVega.toFixed(0)}
              </div>
            </div>
          </div>

          {/* Interactive Sliders: Target Price & Target Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
            
            {/* Target Price Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {symbol} Target Spot: <strong style={{ color: 'var(--text-primary)' }}>₹{targetSpotPrice.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
                  <span style={{ marginLeft: '6px', color: targetPct >= 0 ? '#10b981' : '#ef4444', fontWeight: '700' }}>
                    ({targetPct >= 0 ? '+' : ''}{targetPct.toFixed(2)}%)
                  </span>
                </span>
                {targetPriceOffset !== 0 && (
                  <button 
                    type="button" 
                    onClick={() => setTargetPriceOffset(0)}
                    style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                  >
                    Reset Spot
                  </button>
                )}
              </div>
              <input 
                type="range"
                min={-Math.round(spotPrice * 0.08)}
                max={Math.round(spotPrice * 0.08)}
                step={25}
                value={targetPriceOffset}
                onChange={(e) => setTargetPriceOffset(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-blue, #2563eb)', cursor: 'pointer' }}
              />
            </div>

            {/* Target Date Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Target Date: <strong style={{ color: 'var(--text-primary)' }}>T+{targetDteOffset.toFixed(0)}</strong>
                  <span style={{ marginLeft: '6px', color: '#38bdf8', fontWeight: '700' }}>
                    ({targetDaysLeft.toFixed(0)} Days to Expiry)
                  </span>
                </span>
                {targetDteOffset !== 0 && (
                  <button 
                    type="button" 
                    onClick={() => setTargetDteOffset(0)}
                    style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                  >
                    Reset to Today
                  </button>
                )}
              </div>
              <input 
                type="range"
                min={0}
                max={Math.max(1, Math.round(dte))}
                step={0.5}
                value={targetDteOffset}
                onChange={(e) => setTargetDteOffset(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Legs Table */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '8px 10px' }}>B/S</th>
                  <th style={{ padding: '8px 10px' }}>Strike</th>
                  <th style={{ padding: '8px 10px' }}>Type</th>
                  <th style={{ padding: '8px 10px' }}>Lots</th>
                  <th style={{ padding: '8px 10px' }}>Price (₹)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {legs.map((leg, i) => {
                  const effectivePrice = resolveEffectivePrice(leg);
                  const isBuy = leg.side === 'BUY';
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      
                      {/* B/S Toggle */}
                      <td style={{ padding: '8px 10px' }}>
                        <button
                          type="button"
                          onClick={() => onUpdateLeg?.(i, { ...leg, side: isBuy ? 'SELL' : 'BUY' })}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '800',
                            border: 'none',
                            cursor: 'pointer',
                            background: isBuy ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: isBuy ? '#10b981' : '#ef4444'
                          }}
                        >
                          {leg.side}
                        </button>
                      </td>

                      {/* Strike with [-] and [+] Stepper */}
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => handleStepStrike(i, -1)}
                            style={{ width: '20px', height: '20px', padding: 0, borderRadius: '4px', background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Step down to lower strike"
                          >
                            <Minus size={10} />
                          </button>
                          <span style={{ fontWeight: '700', minWidth: '48px', textAlign: 'center' }}>
                            {leg.strike}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStepStrike(i, 1)}
                            style={{ width: '20px', height: '20px', padding: 0, borderRadius: '4px', background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Step up to higher strike"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </td>

                      {/* Option Type (CE / PE) Toggle */}
                      <td style={{ padding: '8px 10px' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleType(i)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.04)',
                            color: leg.optionType === 'CE' ? '#60a5fa' : '#f59e0b',
                            cursor: 'pointer'
                          }}
                        >
                          {leg.optionType}
                        </button>
                      </td>

                      {/* Lots Stepper */}
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <button
                            type="button"
                            onClick={() => onUpdateLeg?.(i, { ...leg, quantity: Math.max(1, (Number(leg.quantity) || 1) - 1) })}
                            style={{ width: '18px', height: '18px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Minus size={9} />
                          </button>
                          <input 
                            type="number"
                            min="1"
                            value={leg.quantity || 1}
                            onChange={(e) => onUpdateLeg?.(i, { ...leg, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            style={{ width: '36px', textAlign: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '3px', padding: '2px', fontSize: '11px', fontWeight: '700' }}
                          />
                          <button
                            type="button"
                            onClick={() => onUpdateLeg?.(i, { ...leg, quantity: (Number(leg.quantity) || 1) + 1 })}
                            style={{ width: '18px', height: '18px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Plus size={9} />
                          </button>
                        </div>
                      </td>

                      {/* Editable Price Input with Live indicator */}
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input 
                            type="number"
                            step="0.05"
                            value={effectivePrice > 0 ? effectivePrice : ''}
                            placeholder="0.0"
                            onChange={(e) => onUpdateLeg?.(i, { ...leg, customPrice: parseFloat(e.target.value) || 0 })}
                            style={{ width: '64px', background: 'rgba(255,255,255,0.06)', border: leg.customPrice !== undefined ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', padding: '3px 6px', fontSize: '11.5px', fontWeight: '700' }}
                          />
                          {leg.customPrice !== undefined && (
                            <button
                              type="button"
                              onClick={() => onUpdateLeg?.(i, { ...leg, customPrice: undefined })}
                              title="Revert to Live Price"
                              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
                            >
                              <RefreshCw size={10} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Remove Leg */}
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => onRemoveLeg?.(i)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
                          title="Remove leg"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Quick Actions at bottom of legs table */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {onAddLeg && (
                <button
                  type="button"
                  onClick={onAddLeg}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--color-blue, #2563eb)', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer' }}
                >
                  <Plus size={12} /> Add ATM Leg
                </button>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <span>Multiplier:</span>
                {[1, 2, 5, 10].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMultiplier(m)}
                    style={{
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '10px',
                      fontWeight: '700',
                      border: 'none',
                      cursor: 'pointer',
                      background: multiplier === m ? 'var(--color-blue, #2563eb)' : 'rgba(255,255,255,0.06)',
                      color: multiplier === m ? '#fff' : 'var(--text-secondary)'
                    }}
                  >
                    {m}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Primary Action Button: Execute Strategy */}
          <button 
            type="button"
            onClick={onExecute}
            className="btn-primary"
            style={{ width: '100%', padding: '12px', borderRadius: '8px', fontSize: '15px', fontWeight: '800', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: 'var(--color-blue, #2563eb)', cursor: 'pointer', border: 'none', color: '#fff' }}
          >
            <Zap size={16} /> Execute Strategy ({legs.length} Legs)
          </button>
        </div>

        {/* RIGHT COLUMN: INSTITUTIONAL PAYOFF CHART */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          
          {/* Chart Header & Legend */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', fontSize: '12px' }}>
            <span style={{ fontWeight: '700', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Payoff Diagram</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#10b981' }}>
                <span style={{ width: '12px', height: '3px', background: '#10b981', display: 'inline-block' }}></span>
                On Expiry
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#38bdf8' }}>
                <span style={{ width: '12px', height: '2px', borderTop: '2px dashed #38bdf8', display: 'inline-block' }}></span>
                Target Date (T+{targetDteOffset.toFixed(0)})
              </span>
              {spotPrice > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#60a5fa' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }}></span>
                  Spot: ₹{spotPrice.toFixed(0)}
                </span>
              )}
            </div>
          </div>

          {/* Chart Container */}
          <div style={{ width: '100%', height: '420px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 20, right: 24, left: 24, bottom: 20 }}>
                <defs>
                  <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={gradientOffset} stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset={gradientOffset} stopColor="#ef4444" stopOpacity={0.25} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis 
                  dataKey="price" 
                  stroke="rgba(255,255,255,0.4)" 
                  fontSize={11} 
                  tickMargin={8} 
                  domain={[minPrice, maxPrice]} 
                  ticks={chartTicks}
                  type="number" 
                  tickFormatter={(val) => `₹${Number(val).toLocaleString('en-IN')}`}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.4)" 
                  fontSize={11} 
                  tickFormatter={(val) => `${val >= 0 ? '+' : ''}₹${(Number(val) / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} />
                
                {/* Spot Price Reference Line */}
                {spotPrice > 0 && (
                  <ReferenceLine 
                    x={Math.round(spotPrice)} 
                    stroke="#60a5fa" 
                    strokeWidth={1.5}
                    strokeDasharray="3 3" 
                    label={{ position: 'top', value: `Spot ₹${spotPrice.toFixed(0)}`, fill: '#60a5fa', fontSize: 11, fontWeight: '700' }} 
                  />
                )}

                {/* Target Spot Price Reference Line (if offset) */}
                {targetPriceOffset !== 0 && (
                  <ReferenceLine 
                    x={Math.round(targetSpotPrice)} 
                    stroke="#f59e0b" 
                    strokeWidth={1.5}
                    strokeDasharray="2 2" 
                    label={{ position: 'top', value: `Target ₹${targetSpotPrice.toFixed(0)}`, fill: '#f59e0b', fontSize: 11, fontWeight: '700' }} 
                  />
                )}

                {/* Breakeven Reference Lines */}
                {breakevens.map((b, i) => (
                  <ReferenceLine 
                    key={i} 
                    x={b} 
                    stroke="rgba(255,255,255,0.4)" 
                    strokeDasharray="3 3" 
                    label={{ position: 'insideBottomLeft', value: `BE ₹${b}`, fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} 
                  />
                ))}

                {/* Expiry Payoff (Shaded Area + Solid Green Line) */}
                <Area 
                  type="linear" 
                  dataKey="pnlExpiry" 
                  stroke="#10b981" 
                  strokeWidth={2.5} 
                  fill="url(#splitColor)"
                  activeDot={false}
                  name="Expiry P&L"
                  isAnimationActive={false}
                />
                
                {/* Target Date Payoff (Dashed Smooth Curve) */}
                <Line 
                  type="monotone" 
                  dataKey="pnlTarget" 
                  stroke="#38bdf8" 
                  strokeWidth={2.5} 
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={{ r: 5, fill: '#38bdf8' }}
                  name="Target Date P&L"
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, color, subtitle, badge }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '3px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>{title}</span>
        {badge && (
          <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', color: color || 'var(--text-primary)' }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ fontSize: '15px', fontWeight: '800', color: color || 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
