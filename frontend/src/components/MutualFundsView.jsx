import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { Search, Filter, ArrowUpRight, TrendingUp, Loader2, ChevronRight } from 'lucide-react';
import MutualFundDetailsModal from './MutualFundDetailsModal';

import { API } from '../store';

export default function MutualFundsView() {
  const { mutualFunds, searchMutualFunds, sips, cancelSip, executeSipNow, holdings, positions, mfWatchlist, toggleMfWatchlist } = useStore(useShallow(state => ({ mutualFunds: state.mutualFunds, searchMutualFunds: state.searchMutualFunds, sips: state.sips, cancelSip: state.cancelSip, executeSipNow: state.executeSipNow, holdings: state.holdings, positions: state.positions, mfWatchlist: state.mfWatchlist, toggleMfWatchlist: state.toggleMfWatchlist })));

  
  const handlePayNow = async (sipId) => {
    if (!window.confirm('Do you want to process this SIP installment right now? Funds will be debited and units credited at latest NAV.')) return;
    const res = await executeSipNow(sipId);
    if (res && res.success) {
      alert(res.message || 'SIP installment executed successfully!');
    } else {
      alert((res && res.error) || 'Failed to execute SIP');
    }
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const mobileStyles = `
    @media (max-width: 768px) {
      .mobile-scroll { overflow-x: auto !important; flex-wrap: nowrap !important; padding-bottom: 8px !important; }
      .mobile-scroll::-webkit-scrollbar { display: none; }
      .mf-card { background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 12px; cursor: pointer; }
      .mf-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
      .mf-card-title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .mf-card-subtitle { font-size: 12px; color: var(--text-secondary); }
      .mf-card-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px; margin-top: 4px; }
      .mf-stat-label { font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; }
      .mf-stat-value { font-size: 14px; font-weight: 600; color: var(--text-primary); }
    }
  `;
  const [mainTab, setMainTab] = useState('Explore');
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedFund, setSelectedFund] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });
  const searchIdRef = useRef(0);

  const [mfNames, setMfNames] = useState({});
  useEffect(() => {
    const symbols = [
      ...(sips || []).map(s => s.symbol),
      ...(holdings || []).filter(h => h.symbol.endsWith('-MF')).map(h => h.symbol),
      ...(positions || []).filter(h => h.symbol.endsWith('-MF')).map(h => h.symbol)
    ];
    const unique = [...new Set(symbols)];
    if (unique.length > 0) {
      fetch(`${API}/api/mf/names`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unique })
      })
      .then(r => {
          if (!r.ok) throw new Error('Backend failed');
          return r.json();
      })
      .then(data => {
          setMfNames(prev => ({ ...prev, ...data }));
          
          // For any missing names, fallback to direct mfapi fetch
          unique.forEach(symbol => {
             if (!data[symbol]) {
                 const cleanId = String(symbol).replace('-MF', '');
                 fetch(`https://api.mfapi.in/mf/${cleanId}`)
                   .then(r => r.json())
                   .then(mfData => {
                       if (mfData && mfData.meta && mfData.meta.scheme_name) {
                           setMfNames(prev => ({ ...prev, [symbol]: mfData.meta.scheme_name }));
                       }
                   }).catch(() => {});
             }
          });
      })
      .catch(err => {
          console.error("Backend fetch failed, falling back to mfapi:", err);
          // Complete fallback if backend endpoint completely fails
          unique.forEach(symbol => {
             const cleanId = String(symbol).replace('-MF', '');
             fetch(`https://api.mfapi.in/mf/${cleanId}`)
               .then(r => r.json())
               .then(mfData => {
                   if (mfData && mfData.meta && mfData.meta.scheme_name) {
                       setMfNames(prev => ({ ...prev, [symbol]: mfData.meta.scheme_name }));
                   }
               }).catch(() => {});
          });
      });
    }
  }, [sips, holdings, positions]);


  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
      setIsSearching(true);
      setPage(1);
      const currentSearchId = ++searchIdRef.current;

      const timer = setTimeout(async () => {
          try {
              await searchMutualFunds(search);
          } finally {
              if (currentSearchId === searchIdRef.current) {
                  setIsSearching(false);
              }
          }
      }, search && search.length >= 2 ? 500 : 0);

      return () => clearTimeout(timer);
  }, [search, searchMutualFunds]);

  const handleSearch = (e) => {
      e.preventDefault();
  };

  const mainTabs = ['Explore', 'Dashboard', 'SIPs', 'Watchlist'];
  const tabs = ['All', 'Equity', 'Debt', 'Hybrid'];

  const filteredFunds = mutualFunds.filter(fund => {
    return activeTab === 'All' || (fund.category && fund.category.toLowerCase().includes(activeTab.toLowerCase()));
  });

  const sortedFunds = [...filteredFunds].sort((a, b) => {
      if (!sortConfig.key) return 0;
      
      const valA = a[sortConfig.key] || -9999;
      const valB = b[sortConfig.key] || -9999;
      
      if (valA < valB) {
          return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (valA > valB) {
          return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
  });

  const totalPages = Math.ceil(sortedFunds.length / ITEMS_PER_PAGE);
  const paginatedFunds = sortedFunds.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleSort = (key) => {
      let direction = 'desc';
      if (sortConfig.key === key && sortConfig.direction === 'desc') {
          direction = 'asc';
      }
      setSortConfig({ key, direction });
  };

  const enrichFundsBatch = useStore(state => state.enrichFundsBatch);

  useEffect(() => {
      if (paginatedFunds.length === 0) return;
      const idsToEnrich = paginatedFunds.filter(f => !f.enriched).map(f => f.id);
      if (idsToEnrich.length > 0) {
          enrichFundsBatch(idsToEnrich);
      }
  }, [paginatedFunds, enrichFundsBatch]);

  const combinedInvestments = [
    ...(holdings || []).filter(h => h.symbol.endsWith('-MF')),
    ...(positions || []).filter(p => p.symbol.endsWith('-MF'))
  ];
  const investmentMap = {};
  for (const inv of combinedInvestments) {
      if (!investmentMap[inv.symbol]) {
          investmentMap[inv.symbol] = { id: inv.id, symbol: inv.symbol, quantity: 0, totalCost: 0 };
      }
      investmentMap[inv.symbol].quantity += Number(inv.quantity);
      investmentMap[inv.symbol].totalCost += Number(inv.quantity) * Number(inv.average_price);
  }
  const finalInvestments = Object.values(investmentMap).map(inv => ({
      ...inv,
      average_price: inv.totalCost / inv.quantity,
  })).filter(inv => inv.quantity > 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)', minHeight: 0, minWidth: 0 }}>
      <style>{mobileStyles}</style>

      {/* Main Navigation (Explore, Dashboard, etc) */}
      <div style={{ padding: isMobile ? '16px' : '24px 24px 0 24px', overflowY: 'auto', flex: 1 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', marginBottom: '16px', gap: '16px' }}>
            <div className="mobile-scroll" style={{ display: 'flex', gap: '32px', width: isMobile ? '100%' : 'auto' }}>
                {mainTabs.map(tab => (
                  <div
                    key={tab}
                    onClick={() => setMainTab(tab)}
                    style={{
                      padding: '0 4px 16px 4px',
                      fontSize: isMobile ? '16px' : '18px',
                      fontWeight: mainTab === tab ? '700' : '600',
                      color: mainTab === tab ? 'var(--color-blue)' : 'var(--text-secondary)',
                      borderBottom: mainTab === tab ? '3px solid var(--color-blue)' : '3px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      top: '1px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {tab}
                  </div>
                ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: isMobile ? '100%' : 'auto', marginBottom: isMobile ? '12px' : 0 }}>
                <form onSubmit={handleSearch} style={{ width: '100%', display: 'flex', alignItems: 'center', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                    <Search size={16} color="var(--text-secondary)" style={{ marginRight: '8px' }} />
                    <input 
                        type="text" 
                        placeholder="Search HDFC, SBI, Quant..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', width: '100%' }}
                    />
                    {isSearching && <Loader2 size={16} color="var(--color-blue)" className="spin" />}
                </form>
            </div>
        </div>

        {mainTab === 'Explore' ? (
          <>
            {/* Sub Navigation */}
            <div className="mobile-scroll" style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              {tabs.map(tab => (
                <div
                  key={tab}
                  onClick={() => { setActiveTab(tab); setPage(1); }}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    background: activeTab === tab ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-panel)',
                    color: activeTab === tab ? 'var(--color-blue)' : 'var(--text-secondary)',
                    border: activeTab === tab ? '1px solid var(--color-blue)' : '1px solid var(--border-color)',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tab}
                </div>
              ))}
            </div>

            {sortedFunds.length > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, sortedFunds.length)} of {sortedFunds.length} funds
                    {activeTab !== 'All' && ` (${activeTab})`}
                </div>
            )}

            {isMobile ? (
                // MOBILE VIEW: Sleek vertical cards
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {isSearching ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <Loader2 size={24} color="var(--color-blue)" className="spin" style={{ margin: '0 auto 12px' }} />
                            Searching...
                        </div>
                    ) : paginatedFunds.length > 0 ? (
                        paginatedFunds.map((fund) => (
                            <div key={fund.id} className="mf-card" onClick={() => setSelectedFund(fund)}>
                                <div className="mf-card-header">
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                                            <TrendingUp size={16} color="var(--text-secondary)" />
                                        </div>
                                        <div>
                                            <div className="mf-card-title">{fund.name}</div>
                                            <div className="mf-card-subtitle">{fund.category} • {fund.risk}</div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); toggleMfWatchlist(fund.id); }}
                                        style={{ background: 'transparent', color: mfWatchlist.includes(fund.id) ? 'var(--color-yellow)' : 'var(--text-secondary)', border: 'none', padding: '4px', cursor: 'pointer', fontSize: '20px' }}
                                    >
                                        {mfWatchlist.includes(fund.id) ? '★' : '☆'}
                                    </button>
                                </div>
                                <div className="mf-card-stats">
                                    <div>
                                        <div className="mf-stat-label">Current NAV</div>
                                        <div className="mf-stat-value">₹{fund.nav.toFixed(2)}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div className="mf-stat-label">1Y Return</div>
                                        <div className="mf-stat-value" style={{ color: fund.return1y >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                                            {fund.return1y >= 0 ? '+' : ''}{fund.return1y}%
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                                    <div style={{ color: 'var(--color-blue)', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        Invest <ArrowUpRight size={14} />
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : search.length >= 2 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No funds found.</div>
                    ) : null}
                </div>
            ) : (
                // DESKTOP VIEW: Traditional Table
                <div className="glass-panel" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Fund Name</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('category')}>
                                    Category {sortConfig.key === 'category' ? (sortConfig.direction === 'desc' ? '↓' : '↑') : '↕'}
                                </th>
                                <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('risk')}>
                                    Risk {sortConfig.key === 'risk' ? (sortConfig.direction === 'desc' ? '↓' : '↑') : '↕'}
                                </th>
                                <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('nav')}>
                                    NAV {sortConfig.key === 'nav' ? (sortConfig.direction === 'desc' ? '↓' : '↑') : '↕'}
                                </th>
                                <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('return1y')}>
                                    1Y Return {sortConfig.key === 'return1y' ? (sortConfig.direction === 'desc' ? '↓' : '↑') : '↕'}
                                </th>
                                <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('return3y')}>
                                    3Y Return {sortConfig.key === 'return3y' ? (sortConfig.direction === 'desc' ? '↓' : '↑') : '↕'}
                                </th>
                                <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('return5y')}>
                                    5Y Return {sortConfig.key === 'return5y' ? (sortConfig.direction === 'desc' ? '↓' : '↑') : '↕'}
                                </th>
                                <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('returnAllTime')}>
                                    All Time {sortConfig.key === 'returnAllTime' ? (sortConfig.direction === 'desc' ? '↓' : '↑') : '↕'}
                                </th>
                                <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isSearching ? (
                                <tr>
                                    <td colSpan="9" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                            <Loader2 size={28} color="var(--color-blue)" className="spin" />
                                            <span>Searching & calculating returns for "{search}"...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedFunds.length > 0 ? (
                                paginatedFunds.map((fund, idx) => (
                                <tr key={fund.id} style={{ borderBottom: idx < paginatedFunds.length - 1 ? '1px solid var(--border-color)' : 'none', transition: 'background 0.2s' }}>
                                    <td style={{ padding: '16px', fontWeight: '600' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                                                <TrendingUp size={16} />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ color: 'var(--text-primary)', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }} title={fund.name}>{fund.name}</div>
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>{fund.amc} Mutual Fund</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{fund.category}</td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        <span style={{ 
                                            background: fund.risk.includes('High') ? 'rgba(239, 68, 68, 0.1)' : (fund.risk === 'Moderate' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(34, 197, 94, 0.1)'),
                                            color: fund.risk.includes('High') ? 'var(--color-red-light)' : (fund.risk === 'Moderate' ? 'var(--color-yellow)' : 'var(--color-green-light)'),
                                            padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600'
                                        }}>
                                            {fund.risk}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-primary)' }}>₹{fund.nav.toFixed(2)}</td>
                                    <td style={{ padding: '16px', textAlign: 'right', color: fund.return1y >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: '600' }}>{fund.return1y >= 0 ? '+' : ''}{fund.return1y}%</td>
                                    <td style={{ padding: '16px', textAlign: 'right', color: fund.return3y >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: '600' }}>{fund.return3y >= 0 ? '+' : ''}{fund.return3y}%</td>
                                    <td style={{ padding: '16px', textAlign: 'right', color: fund.return5y >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: '600' }}>{fund.enriched || fund.return5y ? `${fund.return5y >= 0 ? '+' : ''}${fund.return5y}%` : '-'}</td>
                                    <td style={{ padding: '16px', textAlign: 'right', color: fund.returnAllTime >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: '600' }}>{fund.enriched || fund.returnAllTime ? `${fund.returnAllTime >= 0 ? '+' : ''}${fund.returnAllTime}%` : '-'}</td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        <button 
                                            onClick={() => setSelectedFund(fund)}
                                            style={{ 
                                                background: 'transparent', color: 'var(--color-blue)', border: '1px solid var(--color-blue)', 
                                                padding: '6px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                                                display: 'inline-flex', alignItems: 'center', gap: '4px'
                                            }}
                                        >
                                            Invest <ArrowUpRight size={14} />
                                        </button>
                                        <button
                                            onClick={() => toggleMfWatchlist(fund.id)}
                                            style={{
                                                background: 'transparent', color: mfWatchlist.includes(fund.id) ? 'var(--color-yellow)' : 'var(--text-secondary)', border: 'none',
                                                padding: '6px', cursor: 'pointer', fontSize: '18px', marginLeft: '4px'
                                            }}
                                            title={mfWatchlist.includes(fund.id) ? "Remove from Watchlist" : "Add to Watchlist"}
                                        >
                                            {mfWatchlist.includes(fund.id) ? '★' : '☆'}
                                        </button>
                                    </td>
                                </tr>
                            ))
                            ) : search.length >= 2 ? (
                                <tr>
                                    <td colSpan="9" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        No mutual funds found for "{search}". Try "HDFC", "SBI", "Axis", or "Quant".
                                    </td>
                                </tr>
                            ) : (
                                <tr>
                                    <td colSpan="9" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                            <Search size={32} color="var(--text-secondary)" style={{ opacity: 0.4 }} />
                                            <span>Failed to load default funds. Please try searching.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            
            {/* Pagination controls */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px', paddingBottom: '24px' }}>
                    <button 
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        style={{ padding: '8px 16px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}
                    >
                        Previous
                    </button>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
                    <button 
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                        style={{ padding: '8px 16px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1 }}
                    >
                        Next
                    </button>
                </div>
            )}
          </>
        ) : mainTab === 'SIPs' ? (
          <div className={isMobile ? "" : "glass-panel"} style={{ padding: isMobile ? '0' : '24px' }}>
            {!isMobile && <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Active SIPs</h3>}
            {sips.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No active SIPs found.</div>
            ) : isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {sips.map(sip => (
                        <div key={sip.id} className="mf-card" style={{ marginBottom: '16px', padding: '16px', background: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div style={{ fontWeight: '600', fontSize: '16px', flex: 1, paddingRight: '12px', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                                    {mfNames[sip.symbol] || sip.symbol}
                                </div>
                                <span style={{ color: 'var(--color-green)', fontWeight: '600', fontSize: '12px', background: 'rgba(34,197,94,0.1)', padding: '4px 8px', borderRadius: '6px' }}>{sip.status}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Amount</span>
                                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>₹{sip.amount}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Frequency</span>
                                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{sip.frequency}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '14px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Next Exec</span>
                                <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{new Date(sip.next_execution_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
    <button onClick={() => handlePayNow(sip.id)} style={{ flex: 1, padding: '10px', fontSize: '13px', background: 'rgba(59,130,246,0.15)', color: 'var(--color-blue)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}>⚡ Pay Now</button>
    <button onClick={() => cancelSip(sip.id)} style={{ flex: 1, padding: '10px', fontSize: '13px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Cancel SIP</button>
  </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'left' }}>
                                <th style={{ padding: '16px', fontWeight: '500' }}>Symbol</th>
                                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Amount</th>
                                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'center' }}>Frequency</th>
                                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'center' }}>Next Execution</th>
                                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'center' }}>Status</th>
                                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sips.map(sip => (
                                <tr key={sip.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '16px', fontWeight: '600' }}>{mfNames[sip.symbol] || sip.symbol}</td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>₹{sip.amount}</td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>{sip.frequency}</td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        <span style={{ padding: '4px 8px', background: 'var(--bg-hover)', borderRadius: '4px' }}>
                                            {new Date(sip.next_execution_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        <span style={{ color: 'var(--color-green)', fontWeight: '600', fontSize: '12px' }}>{sip.status}</span>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
    <button onClick={() => handlePayNow(sip.id)} style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(59,130,246,0.15)', color: 'var(--color-blue)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }}>⚡ Pay Now</button>
    <button onClick={() => cancelSip(sip.id)} className="btn-cancel" style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
  </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
          </div>
        ) : mainTab === 'Dashboard' ? (
          <div className={isMobile ? "" : "glass-panel"} style={{ padding: isMobile ? '0' : '24px' }}>
            {!isMobile && <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Your Mutual Fund Investments</h3>}
            {finalInvestments.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>You have no mutual fund investments.</div>
            ) : isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {finalInvestments.map(h => (
                        <div key={h.id} className="mf-card" style={{ marginBottom: '16px', padding: '16px', background: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '12px', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                                {mfNames[h.symbol] || h.symbol.replace('-MF', '')}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Units</span>
                                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{Number(h.quantity || 0).toFixed(4)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Avg NAV</span>
                                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>₹{Number(h.average_price || 0).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Invested</span>
                                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>₹{(Number(h.quantity || 0) * Number(h.average_price || 0)).toFixed(2)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'left' }}>
                                <th style={{ padding: '16px', fontWeight: '500' }}>Fund Symbol</th>
                                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Units</th>
                                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Avg NAV</th>
                                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Invested Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {finalInvestments.map(h => (
                                <tr key={h.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '16px', fontWeight: '600' }}>{mfNames[h.symbol] || h.symbol.replace('-MF', '')}</td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>{Number(h.quantity || 0).toFixed(4)}</td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>₹{Number(h.average_price || 0).toFixed(2)}</td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>₹{(Number(h.quantity || 0) * Number(h.average_price || 0)).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
          </div>
        ) : mainTab === 'Watchlist' ? (
          <div className={isMobile ? "" : "glass-panel"} style={{ padding: isMobile ? '0' : '24px' }}>
            {!isMobile && <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Watchlist</h3>}
            {mutualFunds.filter(f => mfWatchlist.includes(f.id)).length > 0 ? (
                isMobile ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {mutualFunds.filter(f => mfWatchlist.includes(f.id)).map(fund => (
                            <div key={fund.id} className="mf-card" onClick={() => setSelectedFund(fund)}>
                                <div className="mf-card-header">
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                                            <TrendingUp size={16} color="var(--text-secondary)" />
                                        </div>
                                        <div>
                                            <div className="mf-card-title">{fund.name}</div>
                                            <div className="mf-card-subtitle">{fund.category} • {fund.risk}</div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); toggleMfWatchlist(fund.id); }}
                                        style={{ background: 'transparent', color: 'var(--color-yellow)', border: 'none', padding: '4px', cursor: 'pointer', fontSize: '20px' }}
                                    >
                                        ★
                                    </button>
                                </div>
                                <div className="mf-card-stats">
                                    <div>
                                        <div className="mf-stat-label">Current NAV</div>
                                        <div className="mf-stat-value">₹{fund.nav.toFixed(2)}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div className="mf-stat-label">3Y Return</div>
                                        <div className="mf-stat-value" style={{ color: fund.return3y >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                                            {fund.return3y >= 0 ? '+' : ''}{fund.return3y}%
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                                    <div style={{ color: 'var(--color-blue)', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        Invest <ArrowUpRight size={14} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ padding: '16px', textAlign: 'left' }}>Fund Name</th>
                                <th style={{ padding: '16px', textAlign: 'center' }}>Category</th>
                                <th style={{ padding: '16px', textAlign: 'right' }}>NAV</th>
                                <th style={{ padding: '16px', textAlign: 'right' }}>3Y Return</th>
                                <th style={{ padding: '16px', textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {mutualFunds.filter(f => mfWatchlist.includes(f.id)).map(fund => (
                                <tr key={fund.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '16px', fontWeight: '600' }}>{fund.name}</td>
                                    <td style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>{fund.category}</td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>₹{fund.nav.toFixed(2)}</td>
                                    <td style={{ padding: '16px', textAlign: 'right', color: fund.return3y >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>{fund.return3y >= 0 ? '+' : ''}{fund.return3y}%</td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        <button onClick={() => setSelectedFund(fund)} style={{ padding: '6px 12px', background: 'var(--color-blue)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}>Invest</button>
                                        <button onClick={() => toggleMfWatchlist(fund.id)} style={{ padding: '6px 12px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>Remove</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )
            ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Your watchlist is empty. Add funds from the Explore tab!</div>
            )}
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            This section is currently under development. Wait for updates!
          </div>
        )}
      </div>
      
      {selectedFund && <MutualFundDetailsModal fund={selectedFund} onClose={() => setSelectedFund(null)} />}
    </div>
  );
}


