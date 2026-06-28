import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Search, Filter, ArrowUpRight, TrendingUp } from 'lucide-react';
import MutualFundModal from './MutualFundModal';

export default function MutualFundsView() {
  const { mutualFunds, searchMutualFunds } = useStore();
  const [activeTab, setActiveTab] = useState('All'); // All, Equity, Debt, Hybrid
  const [search, setSearch] = useState('quant'); // default preloaded search
  const [selectedFund, setSelectedFund] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e) => {
      e.preventDefault();
      if (!search || search.length < 3) return;
      setIsSearching(true);
      await searchMutualFunds(search);
      setIsSearching(false);
  };

  const tabs = ['All', 'Equity', 'Debt', 'Hybrid'];

  const filteredFunds = mutualFunds.filter(fund => {
    return activeTab === 'All' || fund.category.includes(activeTab);
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)' }}>
      {/* Sub Navigation */}
      <div style={{ display: 'flex', gap: '24px', padding: '0 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel)' }}>
        {tabs.map(tab => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
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

      <div style={{ padding: '24px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Explore 10,000+ Mutual Funds</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px 12px' }}>
                    <Search size={14} color="var(--text-secondary)" style={{ marginRight: '8px' }} />
                    <input 
                        type="text" 
                        placeholder="Search any fund..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '13px', outline: 'none', width: '200px' }}
                    />
                    <button type="submit" style={{ display: 'none' }}></button>
                </form>
                <button style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                    <Filter size={14} /> Filter
                </button>
            </div>
        </div>

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
                    {filteredFunds.map((fund, idx) => (
                        <tr key={fund.id} style={{ borderBottom: idx < filteredFunds.length - 1 ? '1px solid var(--border-color)' : 'none', transition: 'background 0.2s', ':hover': { background: 'rgba(255,255,255,0.02)' } }}>
                            <td style={{ padding: '16px', fontWeight: '600' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                                        <TrendingUp size={16} />
                                    </div>
                                    <div>
                                        <div style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{fund.name}</div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>{fund.amc} Mutual Fund</div>
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
                            <td style={{ padding: '16px', textAlign: 'right', color: 'var(--color-green-light)', fontWeight: '600' }}>+{fund.return1y}%</td>
                            <td style={{ padding: '16px', textAlign: 'right', color: 'var(--color-green-light)', fontWeight: '600' }}>+{fund.return3y}%</td>
                            <td style={{ padding: '16px', textAlign: 'right', color: 'var(--color-green-light)', fontWeight: '600' }}>+{fund.return5y}%</td>
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
                    ))}
                    {isSearching ? (
                        <tr>
                            <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                Fetching live data...
                            </td>
                        </tr>
                    ) : filteredFunds.length === 0 ? (
                        <tr>
                            <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                No mutual funds found matching your criteria. Try searching for "HDFC" or "SBI".
                            </td>
                        </tr>
                    ) : null}
                </tbody>
            </table>
        </div>
      </div>
      
      {selectedFund && <MutualFundModal fund={selectedFund} onClose={() => setSelectedFund(null)} />}
    </div>
  );
}
