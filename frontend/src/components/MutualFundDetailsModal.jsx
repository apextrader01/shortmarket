import React, { useEffect, useState, useMemo } from 'react';
import { X, TrendingUp, CheckCircle, XCircle, ChevronRight, Activity, PieChart, Shield, Calculator, Wallet, ArrowDownRight, ArrowUpRight, Check } from 'lucide-react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import MutualFundChart from './MutualFundChart';

export default function MutualFundDetailsModal({ fund, onClose }) {
    const { fetchFundDetails, placeOrder, setupSip, holdings, user } = useStore(useShallow(state => ({ 
        fetchFundDetails: state.fetchFundDetails, 
        placeOrder: state.placeOrder, 
        setupSip: state.setupSip,
        holdings: state.holdings,
        user: state.user
    })));
    
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isInvesting, setIsInvesting] = useState(false);
    const [orderStatus, setOrderStatus] = useState(null); // null, 'success', 'error'
    const [statusMsg, setStatusMsg] = useState('');

    // Right Column States
    const [actionMode, setActionMode] = useState('INVEST'); // 'INVEST' | 'REDEEM'
    const [investType, setInvestType] = useState('MONTHLY_SIP'); // 'MONTHLY_SIP' | 'WEEKLY_SIP' | 'DAILY_SIP' | 'LUMPSUM'
    
    // Inputs
    const [amount, setAmount] = useState('5000');
    const [redeemType, setRedeemType] = useState('ALL'); // 'ALL' | 'CUSTOM'
    
    // Calculator
    const [investmentYears, setInvestmentYears] = useState(5);

    // Identify Fund Symbol (support legacy symbol format and new format)
    const legacySymbol = `${fund.amc?.substring(0,4).toUpperCase()}-MF`;
    const fundSymbol = `${fund.id || fund.schemeCode}-MF`;
    
    const userHolding = holdings.find(h => h.symbol === legacySymbol || h.symbol === fundSymbol);
    const actualSymbolToUse = userHolding ? userHolding.symbol : fundSymbol; // Use legacy if they already own it

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            const data = await fetchFundDetails(fund.name);
            if (mounted) {
                setDetails(data);
                setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [fund.name, fetchFundDetails]);

    const formatCurrency = (val) => {
        if (!val) return '₹0';
        if (val >= 10000000) return `₹${(val/10000000).toFixed(2)} Cr`;
        if (val >= 100000) return `₹${(val/100000).toFixed(2)} L`;
        return `₹${val.toLocaleString()}`;
    };

    const cagr = details?.return_stats?.find(r => r.year === 3)?.fund_return || fund.return3y || 12;

    const calcResult = useMemo(() => {
        const rate = cagr / 100;
        const months = investmentYears * 12;
        const amt = Number(amount) || 0;
        let invested = 0;
        let wealth = 0;

        
        if (investType === 'MONTHLY_SIP' || investType === 'WEEKLY_SIP' || investType === 'DAILY_SIP') {
            let periodsPerYear = 12;
            if (investType === 'WEEKLY_SIP') periodsPerYear = 52;
            if (investType === 'DAILY_SIP') periodsPerYear = 250; // standard approx trading days

            const n = investmentYears * periodsPerYear;
            const i = rate / periodsPerYear;

            invested = amt * n;
            wealth = amt * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
        } else {

            invested = amt;
            wealth = amt * Math.pow(1 + rate, investmentYears);
        }
        return { invested, wealth: Math.round(wealth), gain: Math.round(wealth - invested) };
    }, [cagr, investmentYears, amount, investType]);

    const handleAction = async () => {
        if (isInvesting) return;
        setIsInvesting(true);
        setOrderStatus(null);

        const currentNav = details?.nav || fund.nav || 1;
        const numAmount = Number(amount) || 0;
        let res;

        try {
            if (actionMode === 'INVEST') {
                if (numAmount < 100) throw new Error("Minimum investment is ₹100");
                
                const qty = numAmount / currentNav;
                
                if (investType === 'MONTHLY_SIP' || investType === 'WEEKLY_SIP' || investType === 'DAILY_SIP') {
                    res = await setupSip({
                        symbol: actualSymbolToUse,
                        amount: numAmount,
                        frequency: investType === 'DAILY_SIP' ? 'DAILY' : (investType === 'WEEKLY_SIP' ? 'WEEKLY' : 'MONTHLY'),
                        price: currentNav
                    });
                } else {
                    res = await placeOrder({
                        symbol: actualSymbolToUse,
                        type: 'MARKET',
                        side: 'BUY',
                        quantity: parseFloat(qty.toFixed(4)),
                        price: currentNav,
                        margin: numAmount,
                        product_type: 'DEL'
                    });
                }
            } else if (actionMode === 'REDEEM') {
                if (!userHolding) throw new Error("No holdings to redeem.");
                
                let qtyToSell = Number(userHolding.quantity || 0);
                if (redeemType === 'CUSTOM') {
                    qtyToSell = numAmount / currentNav;
                    if (qtyToSell > Number(userHolding.quantity || 0)) throw new Error("Insufficient units to redeem.");
                }

                res = await placeOrder({
                    symbol: actualSymbolToUse,
                    type: 'MARKET',
                    side: 'SELL',
                    quantity: parseFloat(qtyToSell.toFixed(4)),
                    price: currentNav,
                    product_type: 'CNC' // Mutual fund delivery sell
                });
            }

            if (res && res.success) {
                setOrderStatus('success');
                setStatusMsg(`Successfully ${actionMode === 'INVEST' ? (investType.includes('SIP') ? 'set up SIP' : 'invested') : 'redeemed'}!`);
                setTimeout(() => onClose(), 2000);
            } else {
                setOrderStatus('error');
                setStatusMsg(res?.error || "Transaction failed. Please try again.");
                setTimeout(() => setOrderStatus(null), 3000);
            }
        } catch (err) {
            setOrderStatus('error');
            setStatusMsg(err.message);
            setTimeout(() => setOrderStatus(null), 3000);
        } finally {
            setIsInvesting(false);
        }
    };

    const holdingCurrentValue = userHolding ? (userHolding.quantity * (details?.nav || fund.nav || userHolding.ltp)) : 0;
    const holdingInvested = userHolding ? parseFloat(userHolding.average_price || 0) * Number(userHolding.quantity || 0) : 0;
    const holdingPnL = holdingCurrentValue - holdingInvested;
    const holdingPnLPct = holdingInvested > 0 ? (holdingPnL / holdingInvested) * 100 : 0;

    return (
        <>
    <style>{`
        @media (max-width: 768px) {
            .mf-modal-container {
                width: 100% !important;
                height: 100% !important;
                max-width: 100vw !important;
                max-height: 100vh !important;
                border-radius: 0 !important;
            }
            .mf-modal-content {
                flex-direction: column !important;
                overflow-y: auto !important;
            }
            .mf-modal-left {
                width: 100% !important;
                padding: 16px !important;
                flex: none !important;
            }
            .mf-modal-right {
                width: 100% !important;
                border-left: none !important;
                border-top: 1px solid var(--border-color) !important;
            }
            .mf-metrics-grid {
                flex-direction: column !important;
                gap: 16px !important;
            }
            .mf-info-grid {
                grid-template-columns: 1fr !important;
            }
            .mf-nav-big {
                font-size: 24px !important;
            }
            .mf-header {
                padding: 16px !important;
            }
        }
    `}</style>

        <div className="modal-backdrop" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="mf-modal-container" style={{
                width: '1100px', maxWidth: '95vw', height: '85vh',
                background: 'var(--bg-dark)', borderRadius: '16px',
                border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
                {/* Header */}
                <div className="mf-header" style={{ padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel)' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        {details?.logo_url ? (
                            <img src={details.logo_url} alt="AMC" style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#fff', padding: '4px' }} />
                        ) : (
                            <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: 'var(--color-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                <TrendingUp size={24} />
                            </div>
                        )}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{fund.amc} Mutual Fund</div>
                                <div style={{ fontSize: '11px', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: '12px', color: 'var(--text-secondary)' }}>{fund.category}</div>
                                {details?.groww_rating && (
                                    <span style={{ fontSize: '12px', background: 'rgba(234, 179, 8, 0.1)', color: 'var(--color-yellow)', padding: '2px 8px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        ★ {details.groww_rating}
                                    </span>
                                )}
                            </div>
                            <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>{fund.name}</h2>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="mf-modal-content" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    
                    {/* Left Column (Details & Chart) */}
                    <div className="mf-modal-left" style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
                        {/* NAV & Key Metrics */}
                        <div className="mf-metrics-grid" style={{ display: 'flex', gap: '48px', marginBottom: '32px' }}>
                            <div>
                                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Current NAV</div>
                                <div className="mf-nav-big" style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    ₹{details?.nav || fund.nav}
                                    {fund.dayChange !== undefined && (
                                        <span style={{ fontSize: '16px', fontWeight: '600', color: fund.dayChange >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)', display: 'flex', alignItems: 'center' }}>
                                            {fund.dayChange >= 0 ? <TrendingUp size={16} style={{marginRight: '4px'}}/> : <TrendingUp size={16} style={{marginRight: '4px', transform: 'rotate(180deg)'}}/>}
                                            {fund.dayChange >= 0 ? '+' : ''}{fund.dayChange}%
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Min SIP Amount</div>
                                <div style={{ fontSize: '18px', fontWeight: '600' }}>₹{details?.min_sip_investment || 500}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Fund Size (AUM)</div>
                                <div style={{ fontSize: '18px', fontWeight: '600' }}>{formatCurrency(details?.aum)}</div>
                            </div>
                        </div>

                        {/* Chart */}
                        <div style={{ height: '300px', marginBottom: '32px' }}>
                            <MutualFundChart schemeCode={fund.id || fund.schemeCode} />
                        </div>

                        {/* Details Grid */}
                        {loading ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                <Activity size={24} className="spin" style={{ marginBottom: '12px' }} />
                                <div>Loading fund details...</div>
                            </div>
                        ) : details ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                
                                {/* Returns Table */}
                                <div>
                                    <h3 style={{ fontSize: '18px', margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Historical Returns</h3>
                                    <div style={{ background: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>
                                                    <th style={{ textAlign: 'left', padding: '16px', color: 'var(--text-secondary)', fontWeight: '600' }}>Time Period</th>
                                                    <th style={{ textAlign: 'right', padding: '16px', color: 'var(--text-secondary)', fontWeight: '600' }}>Fund Return</th>
                                                    <th style={{ textAlign: 'right', padding: '16px', color: 'var(--text-secondary)', fontWeight: '600' }}>Category Avg</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {details.return_stats && details.return_stats.length > 0 && [
                                                    { label: '1 Year', fKey: 'return1y', cKey: 'cat_return1y' },
                                                    { label: '3 Year', fKey: 'return3y', cKey: 'cat_return3y' },
                                                    { label: '5 Year', fKey: 'return5y', cKey: 'cat_return5y' },
                                                    { label: 'All Time', fKey: 'return_since_created', cKey: 'cat_return_since_launch' },
                                                ].map(period => {
                                                    const stat = details.return_stats[0];
                                                    const fundReturn = stat[period.fKey];
                                                    const catReturn = stat[period.cKey];
                                                    if (!fundReturn) return null;
                                                    
                                                    return (
                                                        <tr key={period.label} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                            <td style={{ padding: '16px', color: 'var(--text-primary)', fontWeight: '500' }}>{period.label}</td>
                                                            <td style={{ textAlign: 'right', padding: '16px', color: 'var(--color-green-light)', fontWeight: '600' }}>{fundReturn.toFixed(1)}%</td>
                                                            <td style={{ textAlign: 'right', padding: '16px', color: 'var(--text-secondary)' }}>{catReturn ? catReturn.toFixed(1) + '%' : '-'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* About / Grid */}
                                <div className="mf-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                    <div style={{ background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                        <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}><Shield size={16} /> Fund Information</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Expense Ratio</span><span>{details.expense_ratio ? `${details.expense_ratio}%` : 'N/A'}</span></div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Exit Load</span><span style={{ textAlign: 'right', maxWidth: '200px' }}>{details.exit_load || 'N/A'}</span></div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Lock-in Period</span><span>{details.lock_in ? `${details.lock_in} Years` : 'No Lock-in'}</span></div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Fund Manager</span><span style={{ textAlign: 'right' }}>{details.fund_manager || 'N/A'}</span></div>
                                        </div>
                                    </div>

                                    {details.holdings && details.holdings.length > 0 && (
                                        <div style={{ background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                            <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}><PieChart size={16} /> Top Holdings</h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                                                {details.holdings.slice(0, 4).map((h, i) => (
                                                    <div key={i}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                            <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{h.company_name}</span>
                                                            <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>{h.corpus_per.toFixed(1)}%</span>
                                                        </div>
                                                        <div style={{ width: '100%', height: '4px', background: 'var(--bg-hover)', borderRadius: '2px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${h.corpus_per}%`, height: '100%', background: 'var(--color-blue)', borderRadius: '2px' }} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* Right Column (Action Panel) */}
                    <div className="mf-modal-right" style={{ width: '420px', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)' }}>
                        
                        {/* Portfolio Status */}
                        {userHolding && (
                            <div style={{ padding: '24px 24px 0 24px' }}>
                                <div style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><Wallet size={14}/> Your Investment</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                        <div>
                                            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>₹{holdingCurrentValue.toLocaleString(undefined, {maximumFractionDigits:2})}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{Number(userHolding.quantity || 0).toFixed(4)} Units</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '15px', fontWeight: '600', color: holdingPnL >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                                {holdingPnL >= 0 ? <ArrowUpRight size={16}/> : <ArrowDownRight size={16}/>}
                                                ₹{Math.abs(holdingPnL).toLocaleString(undefined, {maximumFractionDigits:2})}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{holdingPnLPct.toFixed(2)}% Return</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                            {/* Action Tabs */}
                            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--border-color)' }}>
                                <button onClick={() => setActionMode('INVEST')} style={{ flex: 1, padding: '10px', background: actionMode === 'INVEST' ? 'var(--color-blue)' : 'transparent', color: actionMode === 'INVEST' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>Invest</button>
                                <button onClick={() => setActionMode('REDEEM')} style={{ flex: 1, padding: '10px', background: actionMode === 'REDEEM' ? 'var(--color-red)' : 'transparent', color: actionMode === 'REDEEM' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>Redeem</button>
                            </div>

                            {actionMode === 'INVEST' ? (
                                <>
                                    {/* Sub Tabs */}
                                    <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: investType === 'MONTHLY_SIP' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                        <input type="radio" checked={investType === 'MONTHLY_SIP'} onChange={() => setInvestType('MONTHLY_SIP')} style={{ accentColor: 'var(--color-blue)' }} /> Monthly SIP
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: investType === 'WEEKLY_SIP' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                        <input type="radio" checked={investType === 'WEEKLY_SIP'} onChange={() => setInvestType('WEEKLY_SIP')} style={{ accentColor: 'var(--color-blue)' }} /> Weekly SIP
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: investType === 'DAILY_SIP' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                        <input type="radio" checked={investType === 'DAILY_SIP'} onChange={() => setInvestType('DAILY_SIP')} style={{ accentColor: 'var(--color-blue)' }} /> Daily SIP
                                    </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: investType === 'LUMPSUM' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                            <input type="radio" checked={investType === 'LUMPSUM'} onChange={() => setInvestType('LUMPSUM')} style={{ accentColor: 'var(--color-blue)' }} /> One-time
                                        </label>
                                    </div>

                                    {/* Input Amount */}
                                    <div style={{ marginBottom: '32px' }}>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{investType.includes('SIP') ? 'Installment Amount' : 'Investment Amount'}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px 20px', transition: 'border-color 0.2s' }}>
                                            <span style={{ fontSize: '24px', color: 'var(--text-secondary)', marginRight: '8px' }}>₹</span>
                                            <input 
                                                type="number" 
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '28px', fontWeight: '700', width: '100%', outline: 'none' }}
                                                placeholder="5000"
                                            />
                                        </div>
                                        {user && (Number(amount) > user.balance) && (
                                            <div style={{ color: 'var(--color-red-light)', fontSize: '12px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <XCircle size={12}/> Insufficient Balance (Available: ₹{user.balance?.toLocaleString()})
                                            </div>
                                        )}
                                    </div>

                                    {/* Quick Calculator */}
                                    <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '16px', borderRadius: '12px', marginBottom: 'auto' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}><Calculator size={14}/> Returns Estimator</div>
                                            <select value={investmentYears} onChange={(e) => setInvestmentYears(Number(e.target.value))} style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', outline: 'none' }}>
                                                <option value={1}>1 Year</option>
                                                <option value={3}>3 Years</option>
                                                <option value={5}>5 Years</option>
                                                <option value={10}>10 Years</option>
                                            </select>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>Invested Amount</span>
                                            <span style={{ color: 'var(--text-primary)' }}>₹{calcResult.invested.toLocaleString()}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '600' }}>
                                            <span style={{ color: 'var(--text-primary)' }}>Expected Value</span>
                                            <span style={{ color: 'var(--color-green-light)' }}>₹{calcResult.wealth.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {!userHolding ? (
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            <div style={{ width: '64px', height: '64px', background: 'var(--bg-hover)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                                                <Shield size={32} />
                                            </div>
                                            <div style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '8px' }}>No Active Investments</div>
                                            <div style={{ fontSize: '14px', lineHeight: '1.5', maxWidth: '250px' }}>You don't have any units of this mutual fund to redeem.</div>
                                        </div>
                                    ) : (
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: redeemType === 'ALL' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                                    <input type="radio" checked={redeemType === 'ALL'} onChange={() => { setRedeemType('ALL'); setAmount(holdingCurrentValue.toFixed(0)); }} style={{ accentColor: 'var(--color-red)' }} /> Redeem All
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: redeemType === 'CUSTOM' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                                    <input type="radio" checked={redeemType === 'CUSTOM'} onChange={() => setRedeemType('CUSTOM')} style={{ accentColor: 'var(--color-red)' }} /> Custom Amount
                                                </label>
                                            </div>

                                            <div style={{ marginBottom: '32px' }}>
                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Amount to Redeem</div>
                                                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px 20px', transition: 'border-color 0.2s', opacity: redeemType === 'ALL' ? 0.6 : 1 }}>
                                                    <span style={{ fontSize: '24px', color: 'var(--text-secondary)', marginRight: '8px' }}>₹</span>
                                                    <input 
                                                        type="number" 
                                                        value={redeemType === 'ALL' ? holdingCurrentValue.toFixed(0) : amount}
                                                        onChange={(e) => setAmount(e.target.value)}
                                                        disabled={redeemType === 'ALL'}
                                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '28px', fontWeight: '700', width: '100%', outline: 'none' }}
                                                    />
                                                </div>
                                                {redeemType === 'CUSTOM' && (Number(amount) > holdingCurrentValue) && (
                                                    <div style={{ color: 'var(--color-red-light)', fontSize: '12px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <XCircle size={12}/> Exceeds total invested value
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                    <span>Applicable NAV Date</span>
                                                    <span style={{ color: 'var(--text-primary)' }}>Today (EOD)</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>Est. Exit Load</span>
                                                    <span style={{ color: 'var(--text-primary)' }}>{details?.exit_load ? 'May apply' : 'Nil'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Action Button */}
                            {(actionMode === 'INVEST' || (actionMode === 'REDEEM' && userHolding)) && (
                                <div style={{ marginTop: '24px' }}>
                                    {orderStatus === 'success' ? (
                                        <div style={{ width: '100%', padding: '16px', background: 'var(--color-green)', color: '#fff', borderRadius: '12px', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            <Check size={20} /> {statusMsg}
                                        </div>
                                    ) : orderStatus === 'error' ? (
                                        <div style={{ width: '100%', padding: '16px', background: 'var(--color-red)', color: '#fff', borderRadius: '12px', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textAlign: 'center' }}>
                                            <XCircle size={20} style={{ flexShrink: 0 }} /> <span>{statusMsg}</span>
                                        </div>
                                    ) : (
                                        <button 
                                            disabled={isInvesting || (actionMode === 'INVEST' && Number(amount) < 100) || (actionMode === 'REDEEM' && redeemType === 'CUSTOM' && Number(amount) > holdingCurrentValue)}
                                            onClick={handleAction}
                                            style={{ 
                                                width: '100%', padding: '16px', 
                                                background: actionMode === 'INVEST' ? 'var(--color-blue)' : 'var(--color-red)', 
                                                color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', 
                                                cursor: (isInvesting || (actionMode === 'INVEST' && Number(amount) < 100)) ? 'not-allowed' : 'pointer', 
                                                opacity: (isInvesting || (actionMode === 'INVEST' && Number(amount) < 100)) ? 0.7 : 1,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                            }}
                                        >
                                            {isInvesting ? <Activity size={20} className="spin" /> : null}
                                            {isInvesting ? 'Processing...' : actionMode === 'INVEST' ? (investType.includes('SIP') ? 'Start SIP' : 'Pay Now') : 'Confirm Redeem'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
}


