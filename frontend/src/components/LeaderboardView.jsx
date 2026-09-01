import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Trophy, Medal, Award, TrendingUp, RefreshCw, Users, ShieldCheck, Flame, Zap, Target } from 'lucide-react';

export default function LeaderboardView() {
  const { leaderboard, leaderboardLoading, fetchLeaderboard } = useStore();
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const handleRefresh = async () => {
    await fetchLeaderboard();
    setLastRefreshed(Date.now());
  };

  const top3 = leaderboard.slice(0, 3);
  const remaining = leaderboard.slice(3);

  const getRankBadge = (rank) => {
    if (rank === 1) {
      return (
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #fbbf24, #d97706)',
          color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '800', fontSize: '18px', boxShadow: '0 0 16px rgba(251, 191, 36, 0.4)'
        }}>
          🥇
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #e2e8f0, #94a3b8)',
          color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '800', fontSize: '18px', boxShadow: '0 0 14px rgba(226, 232, 240, 0.3)'
        }}>
          🥈
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #f59e0b, #b45309)',
          color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '800', fontSize: '18px', boxShadow: '0 0 14px rgba(245, 158, 11, 0.3)'
        }}>
          🥉
        </div>
      );
    }
    return (
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
        color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: '700', fontSize: '12px'
      }}>
        #{rank}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px', padding: '16px 8px' }}>
      
      {/* Hero Header Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.35) 0%, rgba(15, 23, 42, 0.8) 50%, rgba(88, 28, 135, 0.25) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '16px',
        padding: '24px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(12px)'
      }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.4)',
            color: '#60a5fa', padding: '4px 12px', borderRadius: '20px', fontSize: '11px',
            fontWeight: '700', letterSpacing: '0.5px', marginBottom: '12px'
          }}>
            <Flame size={14} color="#f97316" />
            LIVE INTRADAY RANKINGS
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#fff' }}>
            <Trophy size={28} color="#eab308" />
            Trader Leaderboard
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Top performing intraday & delivery traders ranked by verified realized profit.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleRefresh}
            disabled={leaderboardLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)',
              color: '#fff', padding: '10px 18px', borderRadius: '10px', fontSize: '13px',
              fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={15} color="#3b82f6" className={leaderboardLoading ? 'animate-spin' : ''} />
            {leaderboardLoading ? 'Refreshing...' : 'Refresh Rankings'}
          </button>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      {top3.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          alignItems: 'end'
        }}>
          {/* Rank 2 (Silver) */}
          {top3[1] && (
            <div style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
              border: '1px solid rgba(203, 213, 225, 0.3)',
              borderRadius: '16px', padding: '24px', textAlign: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #94a3b8, #e2e8f0)' }} />
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🥈</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>{top3[1].username}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Rank #2 Trader</div>
              
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#22c55e', margin: '14px 0 6px 0' }}>
                +₹{Number(top3[1].pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Trades: <strong style={{ color: '#fff' }}>{top3[1].totalTrades}</strong></span>
                <span style={{ color: 'var(--text-secondary)' }}>Win Rate: <strong style={{ color: '#22c55e' }}>{top3[1].winRate}%</strong></span>
              </div>
            </div>
          )}

          {/* Rank 1 (Gold - Elevated Champion) */}
          {top3[0] && (
            <div style={{
              background: 'linear-gradient(180deg, rgba(40, 30, 15, 0.9) 0%, rgba(20, 16, 10, 0.95) 100%)',
              border: '2px solid rgba(234, 179, 8, 0.6)',
              borderRadius: '18px', padding: '28px', textAlign: 'center',
              boxShadow: '0 12px 40px rgba(234, 179, 8, 0.2)', position: 'relative', overflow: 'hidden',
              transform: 'translateY(-6px)'
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #eab308, #fef08a, #eab308)' }} />
              <div style={{
                display: 'inline-block', background: 'rgba(234, 179, 8, 0.2)', border: '1px solid rgba(234, 179, 8, 0.5)',
                color: '#fef08a', padding: '2px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: '800', marginBottom: '8px'
              }}>
                👑 TOP DAILY CHAMPION
              </div>
              <div style={{ fontSize: '42px', marginBottom: '6px' }}>🥇</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff' }}>{top3[0].username}</div>
              <div style={{ fontSize: '12px', color: '#eab308', marginTop: '2px', fontWeight: '600' }}>Rank #1 Overall</div>
              
              <div style={{ fontSize: '30px', fontWeight: '900', color: '#22c55e', margin: '16px 0 8px 0' }}>
                +₹{Number(top3[0].pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '18px', paddingTop: '16px', borderTop: '1px solid rgba(234,179,8,0.2)', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Trades: <strong style={{ color: '#fff' }}>{top3[0].totalTrades}</strong></span>
                <span style={{ color: 'var(--text-secondary)' }}>Win Rate: <strong style={{ color: '#22c55e' }}>{top3[0].winRate}%</strong></span>
              </div>
            </div>
          )}

          {/* Rank 3 (Bronze) */}
          {top3[2] && (
            <div style={{
              background: 'linear-gradient(180deg, rgba(35, 25, 18, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
              border: '1px solid rgba(217, 119, 6, 0.4)',
              borderRadius: '16px', padding: '24px', textAlign: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #b45309, #d97706)' }} />
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🥉</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>{top3[2].username}</div>
              <div style={{ fontSize: '12px', color: '#d97706', marginTop: '2px' }}>Rank #3 Trader</div>
              
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#22c55e', margin: '14px 0 6px 0' }}>
                +₹{Number(top3[2].pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Trades: <strong style={{ color: '#fff' }}>{top3[2].totalTrades}</strong></span>
                <span style={{ color: 'var(--text-secondary)' }}>Win Rate: <strong style={{ color: '#22c55e' }}>{top3[2].winRate}%</strong></span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Leaderboard Table */}
      <div style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
      }}>
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '700', color: '#fff' }}>
            <Users size={18} color="#3b82f6" />
            Ranked Traders (Top 50)
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Auto-cached in Redis memory
          </span>
        </div>

        {leaderboard.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Trophy size={48} color="#475569" style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', margin: '0 0 6px 0' }}>
              No Profitable Trades Recorded Yet Today
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
              Place and close your profitable positions during live market hours to climb the rankings and claim your spot on the podium!
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '16px 20px', fontWeight: '600', width: '80px' }}>Rank</th>
                  <th style={{ padding: '16px 20px', fontWeight: '600' }}>Trader</th>
                  <th style={{ padding: '16px 20px', fontWeight: '600', textAlign: 'center' }}>Trades Closed</th>
                  <th style={{ padding: '16px 20px', fontWeight: '600', textAlign: 'center' }}>Win Rate</th>
                  <th style={{ padding: '16px 20px', fontWeight: '600', textAlign: 'right' }}>Realized Profit</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((item) => (
                  <tr key={item.rank} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s ease' }}>
                    <td style={{ padding: '16px 20px' }}>
                      {getRankBadge(item.rank)}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '34px', height: '34px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '700', fontSize: '12px', textTransform: 'uppercase'
                        }}>
                          {item.username.substring(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', color: '#fff' }}>{item.username}</div>
                          <div style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '1px' }}>
                            <ShieldCheck size={12} /> Verified Trader
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {item.totalTrades}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <span style={{
                        background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700'
                      }}>
                        {item.winRate}%
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: '800', color: '#22c55e', fontSize: '15px' }}>
                      +₹{Number(item.pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
