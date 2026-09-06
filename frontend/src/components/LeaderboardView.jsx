import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Trophy, RefreshCw, Users, ShieldCheck, Flame, Gift, Calendar, Award, Sparkles, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

export default function LeaderboardView() {
  const { leaderboard, leaderboardLoading, fetchLeaderboard, activeContest, activeContestLoading, fetchActiveContest } = useStore();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    fetchActiveContest();
  }, []);

  const handleRefresh = async () => {
    await Promise.all([fetchLeaderboard(), fetchActiveContest()]);
  };

  const calculateTimeLeft = (endDateStr) => {
    if (!endDateStr) return null;
    const diff = new Date(endDateStr).getTime() - Date.now();
    if (diff <= 0) return 'Tournament Ended';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    if (days > 0) return `${days}d ${hours}h remaining`;
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    return `${hours}h ${mins}m remaining`;
  };

  const top3 = leaderboard.slice(0, 3);

  const getRankBadge = (rank) => {
    if (rank === 1) {
      return (
        <div style={{
          width: isMobile ? '30px' : '36px', height: isMobile ? '30px' : '36px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #fbbf24, #d97706)',
          color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '800', fontSize: isMobile ? '15px' : '18px', boxShadow: '0 0 16px rgba(251, 191, 36, 0.4)'
        }}>
          🥇
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div style={{
          width: isMobile ? '30px' : '36px', height: isMobile ? '30px' : '36px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #e2e8f0, #94a3b8)',
          color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '800', fontSize: isMobile ? '15px' : '18px', boxShadow: '0 0 14px rgba(226, 232, 240, 0.3)'
        }}>
          🥈
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div style={{
          width: isMobile ? '30px' : '36px', height: isMobile ? '30px' : '36px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #f59e0b, #b45309)',
          color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '800', fontSize: isMobile ? '15px' : '18px', boxShadow: '0 0 14px rgba(245, 158, 11, 0.3)'
        }}>
          🥉
        </div>
      );
    }
    return (
      <div style={{
        width: isMobile ? '26px' : '32px', height: isMobile ? '26px' : '32px', borderRadius: '50%',
        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
        color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: '700', fontSize: isMobile ? '11px' : '12px'
      }}>
        #{rank}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', padding: isMobile ? '12px 6px' : '16px 8px' }}>
      
      {/* Active Tournament & Prize Pool Hero Banner */}
      {activeContest && (
        <div className="glass-panel" style={{
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, var(--bg-panel) 50%, rgba(168, 85, 247, 0.08) 100%)',
          border: '1px solid var(--border-color)',
          borderRadius: isMobile ? '12px' : '16px',
          padding: isMobile ? '16px' : '22px 26px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: 'var(--card-shadow, 0 10px 36px rgba(0, 0, 0, 0.08))',
          backdropFilter: 'blur(14px)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #f59e0b, #eab308, #2563eb, #a855f7)' }} />

          {/* Top Bar: Badges & Live Status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.35)',
                color: '#16a34a', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '800'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 6px rgba(22, 163, 74, 0.4)' }} />
                🟢 LIVE TOURNAMENT
              </span>

              {activeContest.end_date && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.3)',
                  color: '#d97706', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700'
                }}>
                  <Calendar size={12} />
                  {calculateTimeLeft(activeContest.end_date)}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
              <button
                type="button"
                onClick={() => setShowRules(!showRules)}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '8px', fontSize: '11.5px',
                  fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                Rules & Eligibility {showRules ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              <button
                onClick={handleRefresh}
                disabled={leaderboardLoading || activeContestLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'rgba(37, 99, 235, 0.12)', border: '1px solid rgba(37, 99, 235, 0.3)',
                  color: '#2563eb', padding: '6px 14px', borderRadius: '8px', fontSize: '11.5px',
                  fontWeight: '700', cursor: 'pointer', marginLeft: 'auto'
                }}
              >
                <RefreshCw size={12} className={(leaderboardLoading || activeContestLoading) ? 'animate-spin' : ''} />
                {leaderboardLoading ? 'Syncing...' : 'Live Sync'}
              </button>
            </div>
          </div>

          {/* Title & Description */}
          <div>
            <h1 style={{ fontSize: isMobile ? '19px' : '25px', fontWeight: '900', margin: '0 0 6px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {activeContest.title || '🏆 Monthly Trader League'}
            </h1>
            <p style={{ margin: 0, fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {activeContest.description || 'Trade live market instruments, build profitable positions, and top the leaderboard to take home guaranteed cash & PRO membership perks!'}
            </p>
          </div>

          {/* Rules Dropdown Banner */}
          {showRules && (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '12px 16px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: '700' }}>
                <CheckCircle2 size={14} color="#16a34a" /> Tournament Rules & Auto-Payout
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li>All registered traders are automatically enrolled (₹0 entry fee).</li>
                <li>Rankings are determined by total verified realized net P&L on closed positions.</li>
                <li>Prizes are credited to your platform wallet or activated as Free PRO membership immediately upon monthly close.</li>
                <li>Automated fair-play risk & RMS verification ensures transparent competition.</li>
              </ul>
            </div>
          )}

          {/* Guaranteed Monthly Reward Pool Tiles */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: isMobile ? '10px' : '14px',
            marginTop: '4px'
          }}>
            {/* 1st Prize */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.12) 0%, var(--bg-card) 100%)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ fontSize: '24px' }}>🥇</div>
              <div>
                <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  1ST PLACE REWARD
                </div>
                <div style={{ fontSize: isMobile ? '13px' : '14.5px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {activeContest.prize_1st || '₹500 Cash + 1-Month PRO'}
                </div>
              </div>
            </div>

            {/* 2nd Prize */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(148, 163, 184, 0.12) 0%, var(--bg-card) 100%)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ fontSize: '24px' }}>🥈</div>
              <div>
                <div style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  2ND PLACE REWARD
                </div>
                <div style={{ fontSize: isMobile ? '13px' : '14.5px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {activeContest.prize_2nd || '₹250 Cash + 1-Month PRO'}
                </div>
              </div>
            </div>

            {/* 3rd Prize */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.12) 0%, var(--bg-card) 100%)',
              border: '1px solid rgba(217, 119, 6, 0.35)',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ fontSize: '24px' }}>🥉</div>
              <div>
                <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  3RD PLACE REWARD
                </div>
                <div style={{ fontSize: isMobile ? '13px' : '14.5px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {activeContest.prize_3rd || '₹100 Cash + Free PRO'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top 3 Podium Cards */}
      {top3.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: isMobile ? '12px' : '20px',
          alignItems: 'end'
        }}>
          {/* Rank 1 (Gold) */}
          {top3[0] && (
            <div className="glass-panel" style={{
              background: 'linear-gradient(180deg, rgba(234, 179, 8, 0.15) 0%, var(--bg-panel) 100%)',
              border: '2px solid rgba(234, 179, 8, 0.6)',
              borderRadius: '14px', padding: isMobile ? '18px' : '28px', textAlign: 'center',
              boxShadow: '0 12px 40px rgba(234, 179, 8, 0.15)', position: 'relative', overflow: 'hidden',
              order: isMobile ? 1 : 2
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #eab308, #fef08a, #eab308)' }} />
              <div style={{
                display: 'inline-block', background: 'rgba(234, 179, 8, 0.2)', border: '1px solid rgba(234, 179, 8, 0.5)',
                color: '#d97706', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '800', marginBottom: '6px'
              }}>
                👑 TOP CHAMPION
              </div>
              <div style={{ fontSize: isMobile ? '32px' : '42px', marginBottom: '4px' }}>🥇</div>
              <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{top3[0].username}</div>
              
              <div style={{ fontSize: isMobile ? '24px' : '30px', fontWeight: '900', color: '#16a34a', margin: '10px 0 6px 0' }}>
                +₹{Number(top3[0].pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(234,179,8,0.2)', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Trades: <strong style={{ color: 'var(--text-primary)' }}>{top3[0].totalTrades}</strong></span>
                <span style={{ color: 'var(--text-secondary)' }}>Win Rate: <strong style={{ color: '#16a34a' }}>{top3[0].winRate}%</strong></span>
              </div>
            </div>
          )}

          {/* Rank 2 (Silver) */}
          {top3[1] && (
            <div className="glass-panel" style={{
              background: 'linear-gradient(180deg, rgba(148, 163, 184, 0.15) 0%, var(--bg-panel) 100%)',
              border: '1px solid rgba(148, 163, 184, 0.4)',
              borderRadius: '14px', padding: isMobile ? '16px' : '24px', textAlign: 'center',
              boxShadow: 'var(--card-shadow, 0 8px 24px rgba(0,0,0,0.08))', position: 'relative', overflow: 'hidden',
              order: isMobile ? 2 : 1
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #94a3b8, #cbd5e1)' }} />
              <div style={{ fontSize: isMobile ? '26px' : '32px', marginBottom: '4px' }}>🥈</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '700', color: 'var(--text-primary)' }}>{top3[1].username}</div>
              
              <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '800', color: '#16a34a', margin: '10px 0 6px 0' }}>
                +₹{Number(top3[1].pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Trades: <strong style={{ color: 'var(--text-primary)' }}>{top3[1].totalTrades}</strong></span>
                <span style={{ color: 'var(--text-secondary)' }}>Win Rate: <strong style={{ color: '#16a34a' }}>{top3[1].winRate}%</strong></span>
              </div>
            </div>
          )}

          {/* Rank 3 (Bronze) */}
          {top3[2] && (
            <div className="glass-panel" style={{
              background: 'linear-gradient(180deg, rgba(217, 119, 6, 0.15) 0%, var(--bg-panel) 100%)',
              border: '1px solid rgba(217, 119, 6, 0.4)',
              borderRadius: '14px', padding: isMobile ? '16px' : '24px', textAlign: 'center',
              boxShadow: 'var(--card-shadow, 0 8px 24px rgba(0,0,0,0.08))', position: 'relative', overflow: 'hidden',
              order: 3
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #b45309, #d97706)' }} />
              <div style={{ fontSize: isMobile ? '26px' : '32px', marginBottom: '4px' }}>🥉</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '700', color: 'var(--text-primary)' }}>{top3[2].username}</div>
              
              <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '800', color: '#16a34a', margin: '10px 0 6px 0' }}>
                +₹{Number(top3[2].pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Trades: <strong style={{ color: 'var(--text-primary)' }}>{top3[2].totalTrades}</strong></span>
                <span style={{ color: 'var(--text-secondary)' }}>Win Rate: <strong style={{ color: '#16a34a' }}>{top3[2].winRate}%</strong></span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Leaderboard Table / Mobile Cards */}
      <div className="glass-panel" style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: isMobile ? '12px' : '16px',
        overflow: 'hidden',
        boxShadow: 'var(--card-shadow, 0 8px 24px rgba(0,0,0,0.08))'
      }}>
        <div style={{
          padding: isMobile ? '14px 16px' : '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: isMobile ? '14px' : '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
            <Users size={16} color="#2563eb" />
            Ranked Traders (Top 50)
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
            Auto-cached in Redis
          </span>
        </div>

        {leaderboard.length === 0 ? (
          <div style={{ padding: isMobile ? '40px 16px' : '60px 20px', textAlign: 'center' }}>
            <Trophy size={40} color="#94a3b8" style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
              No Profitable Trades Recorded Yet Today
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '350px', margin: '0 auto' }}>
              Place and close your profitable positions during live market hours to climb the rankings and claim your spot on the podium!
            </p>
          </div>
        ) : isMobile ? (
          /* Mobile Card List View */
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {leaderboard.map((item) => (
              <div key={item.rank} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {getRankBadge(item.rank)}
                  <div>
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '14px' }}>{item.username}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span>{item.totalTrades} Trades</span>
                      <span style={{ color: '#16a34a', fontWeight: '600' }}>{item.winRate}% Win</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '800', color: '#16a34a', fontSize: '15px' }}>
                    +₹{Number(item.pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop Table View */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '16px 20px', fontWeight: '600', width: '80px' }}>Rank</th>
                  <th style={{ padding: '16px 20px', fontWeight: '600' }}>Trader</th>
                  <th style={{ padding: '16px 20px', fontWeight: '600', textAlign: 'center' }}>Trades Closed</th>
                  <th style={{ padding: '16px 20px', fontWeight: '600', textAlign: 'center' }}>Win Rate</th>
                  <th style={{ padding: '16px 20px', fontWeight: '600', textAlign: 'right' }}>Realized Profit</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((item) => (
                  <tr key={item.rank} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s ease' }}>
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
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{item.username}</div>
                          <div style={{ fontSize: '11px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '1px' }}>
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
                        background: 'rgba(34, 197, 94, 0.12)', color: '#16a34a',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700'
                      }}>
                        {item.winRate}%
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: '800', color: '#16a34a', fontSize: '15px' }}>
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
