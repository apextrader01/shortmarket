import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { Search, Filter, ArrowUpRight, TrendingUp, Loader2, ChevronRight, Clock, Lock } from 'lucide-react';
import MutualFundDetailsModal from './MutualFundDetailsModal';

import { API } from '../store';

export default function MutualFundsView() {
  const { mutualFunds, searchMutualFunds, sips, cancelSip, executeSipNow, holdings, positions, mfWatchlist, toggleMfWatchlist, mfWatchlistFunds, fetchMfWatchlistFunds, orders } = useStore(useShallow(state => ({ mutualFunds: state.mutualFunds, searchMutualFunds: state.searchMutualFunds, sips: state.sips, cancelSip: state.cancelSip, executeSipNow: state.executeSipNow, holdings: state.holdings, positions: state.positions, mfWatchlist: state.mfWatchlist, toggleMfWatchlist: state.toggleMfWatchlist, mfWatchlistFunds: state.mfWatchlistFunds, fetchMfWatchlistFunds: state.fetchMfWatchlistFunds, orders: state.orders })));

  const isFavorited = useCallback((fundId) => {
    if (!fundId) return false;
    const idStr = String(fundId).replace('-MF', '');
    return (mfWatchlist || []).some(w => {
      const wStr = String(w).replace('-MF', '');
      return wStr === idStr;
    });
  }, [mfWatchlist]);

  useEffect(() => {
    if (typeof fetchMfWatchlistFunds === 'function') {
      fetchMfWatchlistFunds();
    }
  }, [fetchMfWatchlistFunds, mfWatchlist]);

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
      ...(holdings || []).filter(h => (h.symbol || '').endsWith('-MF')).map(h => h.symbol),
      ...(positions || []).filter(h => (h.symbol || '').endsWith('-MF')).map(h => h.symbol),
      ...(orders || []).filter(o => ((o.symbol || '').endsWith('-MF') || (o.symbol || '').includes('MUTUALFUND'))).map(o => o.symbol),
      ...(mfWatchlist || []).map(w => String(w))
    ];
    const unique = [...new Set(symbols)];
    const needed = unique.filter(s => !mfNames[s] && !mfNames[s.replace('-MF', '')]);
    if (needed.length === 0) return;

    fetch(`${API}/api/mf/names`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: needed })
    })
    .then(r => {
        if (!r.ok) throw new Error('Backend failed');
        return r.json();
    })
    .then(data => {
        setMfNames(prev => ({ ...prev, ...data }));
        
        // For any missing names, fallback to direct mfapi fetch
        needed.forEach(symbol => {
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
  }, [sips, holdings, positions, orders, mfWatchlist]);


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

  const filteredFunds = useMemo(() => {
    return mutualFunds.filter(fund => {
      return activeTab === 'All' || (fund.category && fund.category.toLowerCase().includes(activeTab.toLowerCase()));
    });
  }, [mutualFunds, activeTab]);

  const sortedFunds = useMemo(() => {
    if (!sortConfig.key) return filteredFunds;
    return [...filteredFunds].sort((a, b) => {
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
  }, [filteredFunds, sortConfig]);

  const totalPages = Math.ceil(sortedFunds.length / ITEMS_PER_PAGE);
  const paginatedFunds = useMemo(() => {
    return sortedFunds.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  }, [sortedFunds, page]);

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

  const queuedMfOrders = useMemo(() => {
    return (orders || []).filter(o => 
      ((o.symbol || '').endsWith('-MF') || (o.symbol || '').includes('MUTUALFUND')) &&
      (o.status === 'AMO_PENDING' || o.status === 'PENDING')
    );
  }, [orders]);

  const allWatchlistFunds = useMemo(() => {
    const list = [];
    const seen = new Set();
    const watchlistIds = mfWatchlist || [];

    for (const id of watchlistIds) {
      const idStr = String(id);
      const cleanId = idStr.replace('-MF', '');
      if (seen.has(cleanId)) continue;

      // 1. Check in cached objects from store
      let fundData = mfWatchlistFunds?.[cleanId] || mfWatchlistFunds?.[idStr] || mfWatchlistFunds?.[`${cleanId}-MF`];

      // 2. Check in current mutualFunds
      if (!fundData) {
        fundData = (mutualFunds || []).find(f => String(f.id) === cleanId || String(f.id) === idStr);
      }

      if (fundData && fundData.name) {
        list.push(fundData);
        seen.add(cleanId);
      } else if (mfNames[idStr] || mfNames[cleanId]) {
        list.push({
          id: cleanId,
          name: mfNames[idStr] || mfNames[cleanId],
          amc: (mfNames[idStr] || mfNames[cleanId]).split(' ')[0] || 'Mutual',
          category: 'Equity',
          risk: 'Moderate',
          nav: 0,
          return1y: 0,
          return3y: 0,
          return5y: 0,
          returnAllTime: 0
        });
        seen.add(cleanId);
      }
    }
    return list;
  }, [mfWatchlist, mfWatchlistFunds, mutualFunds, mfNames]);

  const filteredWatchlistFunds = useMemo(() => {
    if (!search || !search.trim()) return allWatchlistFunds;
    const q = search.toLowerCase().trim();
    return allWatchlistFunds.filter(f => 
      (f.name || '').toLowerCase().includes(q) ||
      (f.category || '').toLowerCase().includes(q) ||
      (f.amc || '').toLowerCase().includes(q) ||
      String(f.id).includes(q)
    );
  }, [allWatchlistFunds, search]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)', minHeight: 0, minWidth: 0 }}>
      <style>{mobileStyles}</style>

      {/* Main Navigation (Explore, Dashboard, etc) */}
      <div style={{ padding: isMobile ? '16px' : '24px 24px 0 24px', overflowY: 'auto', flex: 1 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', marginBottom: '16px', gap: '16px' }}>
            <div className="mobile-scroll" style={{ display: 'flex', gap: isMobile ? '20px' : '32px', width: isMobile ? '100%' : 'auto' }}>
                {mainTabs.map(tab => {
                  const isDashboard = tab === 'Dashboard';
                  const isWatchlist = tab === 'Watchlist';
                  const hasQueued = isDashboard && queuedMfOrders.length > 0;
                  const watchlistCount = isWatchlist ? allWatchlistFunds.length : 0;
                  return (
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
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {tab}
                      {hasQueued && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          background: 'rgba(234, 179, 8, 0.15)',
                          color: 'var(--color-yellow)',
                          border: '1px solid rgba(234, 179, 8, 0.3)',
                          padding: '1px 7px',
                          borderRadius: '10px'
                        }}>
                          {queuedMfOrders.length} Queued
                        </span>
                      )}
                      {isWatchlist && watchlistCount > 0 && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: 'var(--color-blue)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          padding: '1px 7px',
                          borderRadius: '10px'
                        }}>
                          {watchlistCount}
                        </span>
                      )}
                    </div>
                  );
                })}
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
                                        onClick={(e) => { e.stopPropagation(); toggleMfWatchlist(fund); }}
                                        style={{ background: 'transparent', color: isFavorited(fund.id) ? 'var(--color-yellow)' : 'var(--text-secondary)', border: 'none', padding: '4px', cursor: 'pointer', fontSize: '20px' }}
                                    >
                                        {isFavorited(fund.id) ? '★' : '☆'}
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
                                            onClick={() => toggleMfWatchlist(fund)}
                                            style={{
                                                background: 'transparent', color: isFavorited(fund.id) ? 'var(--color-yellow)' : 'var(--text-secondary)', border: 'none',
                                                padding: '6px', cursor: 'pointer', fontSize: '18px', marginLeft: '4px'
                                            }}
                                            title={isFavorited(fund.id) ? "Remove from Watchlist" : "Add to Watchlist"}
                                        >
                                            {isFavorited(fund.id) ? '★' : '☆'}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 1. Queued Orders Section (Orders placed after 2:00 PM awaiting next-day NAV) */}
            {queuedMfOrders.length > 0 && (
              <div className={isMobile ? "" : "glass-panel"} style={{ padding: isMobile ? '0' : '20px 24px', border: '1px solid rgba(234, 179, 8, 0.3)', background: 'rgba(234, 179, 8, 0.03)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-yellow)', flexShrink: 0, marginTop: '2px' }}>
                      <Clock size={20} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: isMobile ? '16px' : '17px', fontWeight: '700', color: 'var(--text-primary)' }}>
                          Queued Orders (Next Business Day NAV)
                        </h3>
                        <span style={{ fontSize: '11px', background: 'rgba(234, 179, 8, 0.2)', color: 'var(--color-yellow)', border: '1px solid rgba(234, 179, 8, 0.4)', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                          {queuedMfOrders.length} AWAITING SETTLEMENT
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        These orders were placed after the 2:00 PM cut-off. Funds are debited/blocked, and units will be allocated at the next business day's official NAV during automated settlement (10:30 PM / 09:00 AM IST).
                      </p>
                    </div>
                  </div>
                </div>

                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {queuedMfOrders.map(order => {
                      const fundName = mfNames[order.symbol] || order.symbol.replace('-MF', '');
                      const orderAmt = Number(order.margin || (order.quantity * order.price) || 0);
                      const orderDate = order.created_at ? new Date(order.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'Today';
                      return (
                        <div key={order.id} className="mf-card" style={{ marginBottom: 0, padding: '14px', background: 'var(--bg-panel)', border: '1px solid rgba(234, 179, 8, 0.25)', borderRadius: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', flex: 1, paddingRight: '8px' }}>
                              {fundName}
                            </div>
                            <span style={{ fontSize: '10.5px', background: 'rgba(234, 179, 8, 0.15)', color: 'var(--color-yellow)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                              QUEUED (AMO)
                            </span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px' }}>
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Amount Debited</div>
                              <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>₹{orderAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Order Placed</div>
                              <div style={{ fontWeight: '500', color: 'var(--text-secondary)', fontSize: '12px' }}>{orderDate}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Lock size={12} color="var(--color-yellow)" /> Non-cancellable AMC order
                            </span>
                            <span style={{ color: 'var(--color-yellow)', fontWeight: '600' }}>
                              Settles Next Working Day
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(234, 179, 8, 0.2)', color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'left' }}>
                          <th style={{ padding: '12px 16px', fontWeight: '600' }}>Fund Name</th>
                          <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Investment Amount</th>
                          <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Approx NAV</th>
                          <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'center' }}>Placed Time</th>
                          <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'center' }}>Status</th>
                          <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'center' }}>Settlement Timing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {queuedMfOrders.map(order => {
                          const fundName = mfNames[order.symbol] || order.symbol.replace('-MF', '');
                          const orderAmt = Number(order.margin || (order.quantity * order.price) || 0);
                          const orderDate = order.created_at ? new Date(order.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'Today';
                          return (
                            <tr key={order.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '14px 16px', fontWeight: '600' }}>
                                <div style={{ color: 'var(--text-primary)' }}>{fundName}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Lock size={11} color="var(--color-yellow)" /> Order #{order.id} • Non-cancellable
                                </div>
                              </td>
                              <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700', color: 'var(--text-primary)' }}>
                                ₹{orderAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                                ₹{Number(order.price || 0).toFixed(2)}
                              </td>
                              <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                {orderDate}
                              </td>
                              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(234, 179, 8, 0.15)', color: 'var(--color-yellow)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                                  🌙 AMO PENDING
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                <span style={{ fontSize: '11.5px', color: 'var(--color-yellow)', fontWeight: '600' }}>
                                  Next Working Day NAV (10:30 PM / 09:00 AM IST)
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 2. Settled Holdings Section */}
            <div className={isMobile ? "" : "glass-panel"} style={{ padding: isMobile ? '0' : '24px' }}>
              {!isMobile && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Settled Mutual Fund Holdings</h3>
                  {finalInvestments.length > 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {finalInvestments.length} Active {finalInvestments.length === 1 ? 'Holding' : 'Holdings'}
                    </span>
                  )}
                </div>
              )}

              {finalInvestments.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {queuedMfOrders.length > 0 ? (
                    <div>
                      <Clock size={32} color="var(--color-yellow)" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
                      <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>
                        No settled holdings yet
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto', lineHeight: '1.5' }}>
                        Your queued order(s) above are currently awaiting next business day NAV settlement. Once the automated settlement completes, your units will be credited and appear right here.
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ marginBottom: '12px' }}>You have no mutual fund investments.</div>
                      <button 
                        onClick={() => setMainTab('Explore')}
                        style={{ padding: '8px 18px', background: 'var(--color-blue)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                      >
                        Explore Mutual Funds
                      </button>
                    </div>
                  )}
                </div>
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
          </div>
        ) : mainTab === 'Watchlist' ? (
          <div className={isMobile ? "" : "glass-panel"} style={{ padding: isMobile ? '0' : '24px' }}>
            {!isMobile && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
                  Watchlist {allWatchlistFunds.length > 0 ? `(${allWatchlistFunds.length})` : ''}
                </h3>
                {search && (
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Filtering for "{search}" ({filteredWatchlistFunds.length} matches)
                  </span>
                )}
              </div>
            )}
            {allWatchlistFunds.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>Your watchlist is empty</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Star your favorite mutual funds from the Explore tab to track them here!
                </div>
                <button 
                  onClick={() => setMainTab('Explore')}
                  style={{ padding: '8px 18px', background: 'var(--color-blue)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Explore Mutual Funds
                </button>
              </div>
            ) : filteredWatchlistFunds.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No favorited funds match "{search}".
              </div>
            ) : isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {filteredWatchlistFunds.map(fund => (
                  <div key={fund.id} className="mf-card" onClick={() => setSelectedFund(fund)}>
                    <div className="mf-card-header">
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                          <TrendingUp size={16} color="var(--text-secondary)" />
                        </div>
                        <div>
                          <div className="mf-card-title">{fund.name}</div>
                          <div className="mf-card-subtitle">{fund.category || 'Equity'} • {fund.risk || 'Moderate'}</div>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleMfWatchlist(fund); }}
                        style={{ background: 'transparent', color: isFavorited(fund.id) ? 'var(--color-yellow)' : 'var(--text-secondary)', border: 'none', padding: '4px', cursor: 'pointer', fontSize: '20px' }}
                      >
                        {isFavorited(fund.id) ? '★' : '☆'}
                      </button>
                    </div>
                    <div className="mf-card-stats">
                      <div>
                        <div className="mf-stat-label">Current NAV</div>
                        <div className="mf-stat-value">{Number(fund.nav || 0) > 0 ? `₹${Number(fund.nav).toFixed(2)}` : '—'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="mf-stat-label">3Y Return</div>
                        <div className="mf-stat-value" style={{ color: (fund.return3y || 0) >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                          {fund.return3y ? `${fund.return3y >= 0 ? '+' : ''}${fund.return3y}%` : '—'}
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
                  {filteredWatchlistFunds.map(fund => (
                    <tr key={fund.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '16px', fontWeight: '600' }}>{fund.name}</td>
                      <td style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>{fund.category || 'Equity'}</td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>{Number(fund.nav || 0) > 0 ? `₹${Number(fund.nav).toFixed(2)}` : '—'}</td>
                      <td style={{ padding: '16px', textAlign: 'right', color: (fund.return3y || 0) >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                        {fund.return3y ? `${fund.return3y >= 0 ? '+' : ''}${fund.return3y}%` : '—'}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <button onClick={() => setSelectedFund(fund)} style={{ padding: '6px 12px', background: 'var(--color-blue)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}>Invest</button>
                        <button onClick={() => toggleMfWatchlist(fund)} style={{ padding: '6px 12px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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


