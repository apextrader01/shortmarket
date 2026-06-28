import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { Search, Filter, ArrowUpRight, TrendingUp, Loader2 } from 'lucide-react';
import MutualFundDetailsModal from './MutualFundDetailsModal';

export default function MutualFundsView() {
  const { mutualFunds, searchMutualFunds } = useStore();
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedFund, setSelectedFund] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [page, setPage] = useState(1);
  const searchIdRef = useRef(0); // Track latest search to prevent race conditions

  const ITEMS_PER_PAGE = 50;

  // Debounced auto-search: clears old results immediately when user types
  useEffect(() => {
      if (!search || search.length < 2) {
          useStore.setState({ mutualFunds: [] });
          return;
      }

      setIsSearching(true);
      setPage(1);
      const currentSearchId = ++searchIdRef.current;

      const timer = setTimeout(async () => {
          try {
              await searchMutualFunds(search);
          } finally {
              // Only clear loading if this is still the latest search
              if (currentSearchId === searchIdRef.current) {
                  setIsSearching(false);
              }
          }
      }, 500);

      return () => clearTimeout(timer);
  }, [search, searchMutualFunds]);

  const handleSearch = (e) => {
      e.preventDefault();
  };

  const tabs = ['All', 'Equity', 'Debt', 'Hybrid'];

  const filteredFunds = mutualFunds.filter(fund => {
    return activeTab === 'All' || fund.category.includes(activeTab);
  });

  const totalPages = Math.ceil(filteredFunds.length / ITEMS_PER_PAGE);
  const paginatedFunds = filteredFunds.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const enrichFundsBatch = useStore(state => state.enrichFundsBatch);

  useEffect(() => {
      // Whenever the page changes or new funds arrive, enrich any visible funds that don't have return data yet
      if (paginatedFunds.length === 0) return;
      const idsToEnrich = paginatedFunds.filter(f => !f.enriched).map(f => f.id);
      if (idsToEnrich.length > 0) {
          enrichFundsBatch(idsToEnrich);
      }
  }, [paginatedFunds, enrichFundsBatch]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)' }}>
      {/* Sub Navigation */}
      <div style={{ display: 'flex', gap: '24px', padding: '0 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel)' }}>
        {tabs.map(tab => (
          <div
            key={tab}
            onClick={() => { setActiveTab(tab); setPage(1); }}
            style={{
              padding: '16px 4px',
              fontSize: '13px',
              fontWeight: activeTab === tab ? '600' : '500',
              color: activeTab === tab ? 'var(--color-blue)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab ? '2px solid var(--color-blue)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Explore 10,000+ Mutual Funds</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px 12px' }}>
                    <Search size={14} color="var(--text-secondary)" style={{ marginRight: '8px' }} />
                    <input 
                        type="text" 
                        placeholder="Search HDFC, SBI, Quant..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '13px', outline: 'none', width: '220px' }}
                    />
                    {isSearching && <Loader2 size={14} color="var(--color-blue)" className="spin" />}
                </form>
            </div>
        </div>

        {/* Results count */}
        {filteredFunds.length > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filteredFunds.length)} of {filteredFunds.length} funds
                {activeTab !== 'All' && ` (${activeTab})`}
            </div>
        )}

        <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                        <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Fund Name</th>
                        <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Category</th>
                        <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)' }}>Risk</th>
                        <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-secondary)' }}>NAV</th>
                        <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-secondary)' }}>1Y Return</th>
                        <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-secondary)' }}>3Y Return</th>
                        <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-secondary)' }}>5Y Return</th>
                        <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)' }}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {isSearching ? (
                        <tr>
                            <td colSpan="8" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
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
                            <td style={{ padding: '16px', textAlign: 'right', fontWeight: '600' }}>₹{fund.nav.toFixed(2)}</td>
                            <td style={{ padding: '16px', textAlign: 'right', color: fund.return1y >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: '600' }}>{fund.return1y >= 0 ? '+' : ''}{fund.return1y}%</td>
                            <td style={{ padding: '16px', textAlign: 'right', color: fund.return3y >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: '600' }}>{fund.return3y >= 0 ? '+' : ''}{fund.return3y}%</td>
                            <td style={{ padding: '16px', textAlign: 'right', color: fund.return5y >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: '600' }}>{fund.return5y >= 0 ? '+' : ''}{fund.return5y}%</td>
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
                            </td>
                        </tr>
                    ))
                    ) : search.length >= 2 ? (
                        <tr>
                            <td colSpan="8" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                No mutual funds found for "{search}". Try "HDFC", "SBI", "Axis", or "Quant".
                            </td>
                        </tr>
                    ) : (
                        <tr>
                            <td colSpan="8" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <Search size={32} color="var(--text-secondary)" style={{ opacity: 0.4 }} />
                                    <span>Type a fund house name (HDFC, SBI, ICICI, Quant, Axis...) to explore all their funds</span>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && !isSearching && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
                <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))} 
                    disabled={page === 1}
                    style={{ padding: '8px 16px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '4px', color: page === 1 ? 'var(--text-secondary)' : 'var(--text-primary)', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: page === 1 ? 0.5 : 1 }}
                >
                    ← Previous
                </button>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
                <button 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                    disabled={page === totalPages}
                    style={{ padding: '8px 16px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '4px', color: page === totalPages ? 'var(--text-secondary)' : 'var(--text-primary)', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: page === totalPages ? 0.5 : 1 }}
                >
                    Next →
                </button>
            </div>
        )}
      </div>
      
      {selectedFund && <MutualFundDetailsModal fund={selectedFund} onClose={() => setSelectedFund(null)} />}
    </div>
  );
}
