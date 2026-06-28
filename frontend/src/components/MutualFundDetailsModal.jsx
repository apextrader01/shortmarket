import React, { useEffect, useState } from 'react';
import { X, TrendingUp, Info, CheckCircle, XCircle, ChevronRight, Activity, PieChart, Shield, Calculator } from 'lucide-react';
import { useStore } from '../store';
import MutualFundChart from './MutualFundChart';

export default function MutualFundDetailsModal({ fund, onClose }) {
    const { fetchFundDetails, fetchFundHistory } = useStore();
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Calculator state
    const [calcType, setCalcType] = useState('SIP');
    const [investmentAmount, setInvestmentAmount] = useState(5000);
    const [investmentYears, setInvestmentYears] = useState(5);

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

    const calculateReturns = () => {
        const rate = cagr / 100;
        const months = investmentYears * 12;
        let invested = 0;
        let wealth = 0;

        if (calcType === 'SIP') {
            invested = investmentAmount * months;
            const monthlyRate = rate / 12;
            wealth = investmentAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
        } else {
            invested = investmentAmount;
            wealth = investmentAmount * Math.pow(1 + rate, investmentYears);
        }
        return { invested, wealth: Math.round(wealth), gain: Math.round(wealth - invested) };
    };

    const calcResult = calculateReturns();

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <div style={{ width: '95%', maxWidth: '1200px', height: '90vh', background: 'var(--bg-dark)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'var(--bg-panel)' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            {details?.logo_url ? (
                                <img src={details.logo_url} alt="AMC" style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#fff' }} />
                            ) : (
                                <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: 'var(--color-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Activity size={14} color="#fff" />
                                </div>
                            )}
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{fund.amc} Mutual Fund</span>
                            <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '12px' }}>{fund.category}</span>
                            {details?.groww_rating && (
                                <span style={{ fontSize: '12px', background: 'rgba(234, 179, 8, 0.1)', color: 'var(--color-yellow)', padding: '2px 8px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    ★ {details.groww_rating}
                                </span>
                            )}
                        </div>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#fff' }}>{fund.name}</h2>
                        <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>NAV ({details?.nav_date || 'Latest'})</div>
                                <div style={{ fontSize: '16px', fontWeight: '600' }}>₹{details?.nav || fund.nav}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Fund Size (AUM)</div>
                                <div style={{ fontSize: '16px', fontWeight: '600' }}>{formatCurrency(details?.aum)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Expense Ratio</div>
                                <div style={{ fontSize: '16px', fontWeight: '600' }}>{details?.expense_ratio ? `${details.expense_ratio}%` : 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex' }}>
                    
                    {/* Left Column (Main Info) */}
                    <div style={{ flex: '1', padding: '24px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        
                        {/* Chart */}
                        <div>
                            <h3 style={{ fontSize: '16px', margin: '0 0 16px 0', color: '#fff' }}>Performance Chart</h3>
                            <div style={{ height: '300px', background: 'var(--bg-panel)', borderRadius: '8px', overflow: 'hidden' }}>
                                <MutualFundChart schemeCode={fund.id} color="var(--color-blue)" />
                            </div>
                        </div>

                        {loading ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading deep insights...</div>
                        ) : details ? (
                            <>
                                {/* Returns & Rankings */}
                                <div>
                                    <h3 style={{ fontSize: '16px', margin: '0 0 16px 0', color: '#fff' }}>Returns & Category Rankings</h3>
                                    <div style={{ background: 'var(--bg-panel)', borderRadius: '8px', overflow: 'hidden' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                                            <thead>
                                                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                                                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '500' }}>Period</th>
                                                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '500' }}>Fund Return</th>
                                                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '500' }}>Category Avg</th>
                                                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '500' }}>Rank</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {details.return_stats?.filter(r => [1, 3, 5].includes(r.year)).map(r => (
                                                    <tr key={r.year} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <td style={{ padding: '12px 16px' }}>{r.year} Year</td>
                                                        <td style={{ padding: '12px 16px', color: r.fund_return >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: '600' }}>
                                                            {r.fund_return}%
                                                        </td>
                                                        <td style={{ padding: '12px 16px' }}>{r.category_return}%</td>
                                                        <td style={{ padding: '12px 16px' }}>#{r.rank}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Pros & Cons */}
                                {details.analysis && (
                                    <div>
                                        <h3 style={{ fontSize: '16px', margin: '0 0 16px 0', color: '#fff' }}>Pros & Cons</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <div style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.1)', borderRadius: '8px', padding: '16px' }}>
                                                <h4 style={{ margin: '0 0 12px 0', color: 'var(--color-green-light)', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={16} /> Pros</h4>
                                                <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {details.analysis.filter(a => a.sentiment === 'POSITIVE').map((p, i) => <li key={i}>{p.text}</li>)}
                                                </ul>
                                            </div>
                                            <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '8px', padding: '16px' }}>
                                                <h4 style={{ margin: '0 0 12px 0', color: 'var(--color-red-light)', display: 'flex', alignItems: 'center', gap: '8px' }}><XCircle size={16} /> Cons</h4>
                                                <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {details.analysis.filter(a => a.sentiment === 'NEGATIVE').map((c, i) => <li key={i}>{c.text}</li>)}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Portfolio Holdings */}
                                {details.holdings && details.holdings.length > 0 && (
                                    <div>
                                        <h3 style={{ fontSize: '16px', margin: '0 0 16px 0', color: '#fff' }}>Top 10 Holdings</h3>
                                        <div style={{ background: 'var(--bg-panel)', borderRadius: '8px', padding: '16px' }}>
                                            {details.holdings.slice(0, 10).map((h, i) => (
                                                <div key={i} style={{ marginBottom: '12px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                                                        <span style={{ color: '#fff' }}>{h.company_name}</span>
                                                        <span style={{ color: 'var(--text-secondary)' }}>{h.corpus_per}%</span>
                                                    </div>
                                                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${h.corpus_per}%`, height: '100%', background: 'var(--color-blue)', borderRadius: '2px' }} />
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{h.sector_name}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Fund Management & Objective */}
                                <div>
                                    <h3 style={{ fontSize: '16px', margin: '0 0 16px 0', color: '#fff' }}>Fund Details</h3>
                                    <div style={{ background: 'var(--bg-panel)', borderRadius: '8px', padding: '16px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                        <div style={{ marginBottom: '16px' }}>
                                            <strong style={{ color: '#fff' }}>Investment Objective:</strong><br />
                                            {details.description || 'N/A'}
                                        </div>
                                        <div>
                                            <strong style={{ color: '#fff' }}>Fund Managers:</strong><br />
                                            {details.fund_manager_details?.map(fm => fm.name).join(', ') || 'N/A'}
                                        </div>
                                        <div style={{ marginTop: '16px', display: 'flex', gap: '24px' }}>
                                            <div>
                                                <strong style={{ color: '#fff' }}>Exit Load:</strong><br />
                                                {details.exit_load || 'N/A'}
                                            </div>
                                            <div>
                                                <strong style={{ color: '#fff' }}>Lock-in:</strong><br />
                                                {details.lock_in ? `${details.lock_in} Years` : 'No Lock-in'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </div>

                    {/* Right Column (Calculator & Invest) */}
                    <div style={{ width: '380px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--bg-panel)' }}>
                        
                        <div style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
                            <h3 style={{ fontSize: '16px', margin: '0 0 16px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calculator size={18} /> Returns Calculator
                            </h3>
                            
                            <div style={{ display: 'flex', background: 'var(--bg-panel)', padding: '4px', borderRadius: '6px', marginBottom: '16px' }}>
                                {['SIP', 'Lumpsum'].map(t => (
                                    <button 
                                        key={t}
                                        onClick={() => setCalcType(t)}
                                        style={{ flex: 1, padding: '8px', background: calcType === t ? 'var(--color-blue)' : 'transparent', color: calcType === t ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    <span>{calcType === 'SIP' ? 'Monthly Investment' : 'Total Investment'}</span>
                                    <span style={{ color: '#fff', fontWeight: '600' }}>₹{investmentAmount.toLocaleString()}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="500" max="100000" step="500"
                                    value={investmentAmount} 
                                    onChange={(e) => setInvestmentAmount(Number(e.target.value))}
                                    style={{ width: '100%', accentColor: 'var(--color-blue)' }}
                                />
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    <span>Time Period</span>
                                    <span style={{ color: '#fff', fontWeight: '600' }}>{investmentYears} Years</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="1" max="30" step="1"
                                    value={investmentYears} 
                                    onChange={(e) => setInvestmentYears(Number(e.target.value))}
                                    style={{ width: '100%', accentColor: 'var(--color-blue)' }}
                                />
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Total Invested</span>
                                    <span style={{ color: '#fff' }}>₹{calcResult.invested.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Est. Returns ({cagr.toFixed(1)}% p.a)</span>
                                    <span style={{ color: 'var(--color-green-light)' }}>+₹{calcResult.gain.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--border-color)', fontSize: '16px', fontWeight: '600' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Total Value</span>
                                    <span style={{ color: '#fff' }}>₹{calcResult.wealth.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto' }}>
                            <button 
                                style={{ width: '100%', padding: '14px', background: 'var(--color-blue)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
                            >
                                Start Investing
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
