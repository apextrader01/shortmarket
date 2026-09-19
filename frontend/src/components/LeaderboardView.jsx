import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { 
  Trophy, RefreshCw, Users, ShieldCheck, Calendar, Award, 
  CheckCircle2, ChevronDown, ChevronUp, Layers, TrendingUp, Zap, Clock, History
} from 'lucide-react';

export default function LeaderboardView() {
  const { 
    leaderboard, 
    leaderboardLoading, 
    fetchLeaderboard, 
    activeContest, 
    activeContests,
    pastContests,
    activeContestLoading, 
    fetchActiveContest,
    fetchPastContests,
    selectActiveContest 
  } = useStore(useShallow(state => ({
    leaderboard: state.leaderboard,
    leaderboardLoading: state.leaderboardLoading,
    fetchLeaderboard: state.fetchLeaderboard,
    activeContest: state.activeContest,
    activeContests: state.activeContests,
    pastContests: state.pastContests,
    activeContestLoading: state.activeContestLoading,
    fetchActiveContest: state.fetchActiveContest,
    fetchPastContests: state.fetchPastContests,
    selectActiveContest: state.selectActiveContest
  })));

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showRules, setShowRules] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState('ALL');
  const [scope, setScope] = useState('TOURNAMENT'); // 'TOURNAMENT' | 'TODAY'
  const [activeTab, setActiveTab] = useState('ACTIVE'); // 'ACTIVE' | 'PAST'

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initial load
  useEffect(() => {
    Promise.all([
      fetchActiveContest(),
      fetchPastContests()
    ]).then(([activeData]) => {
      const primary = activeData?.contest || (activeData?.contests && activeData.contests[0]);
      if (primary) {
        fetchLeaderboard({ contest_id: primary.id, segment: selectedSegment });
      } else {
        fetchLeaderboard({ segment: selectedSegment });
      }
    });
  }, []);

  // Whenever active contest, segment, or scope changes, refresh leaderboard
  const reloadLeaderboard = async (contestId = activeContest?.id, seg = selectedSegment, sc = scope) => {
    if (sc === 'TODAY') {
      await fetchLeaderboard({ segment: seg, timeframe: 'today' });
    } else if (contestId) {
      await fetchLeaderboard({ contest_id: contestId, segment: seg });
    } else {
      await fetchLeaderboard({ segment: seg });
    }
  };

  const handleContestSelect = (contest) => {
    selectActiveContest(contest);
    const contestSegment = contest.segment && contest.segment !== 'ALL' ? contest.segment : selectedSegment;
    setSelectedSegment(contestSegment);
    reloadLeaderboard(contest.id, contestSegment, scope);
  };

  const handleSegmentChange = (seg) => {
    setSelectedSegment(seg);
    reloadLeaderboard(activeContest?.id, seg, scope);
  };

  const handleScopeChange = (newScope) => {
    setScope(newScope);
    reloadLeaderboard(activeContest?.id, selectedSegment, newScope);
  };

  const handleRefresh = async () => {
    await Promise.all([
      fetchActiveContest(),
      fetchPastContests(),
      reloadLeaderboard()
    ]);
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

  const isContestEnded = (contest) => {
    if (!contest) return true;
    if (contest.status === 'ENDED' || contest.status === 'COMPLETED') return true;
    if (contest.end_date && new Date(contest.end_date).getTime() <= Date.now()) return true;
    return false;
  };

  const getSegmentBadge = (segment) => {
    const s = (segment || 'ALL').toUpperCase();
    if (s === 'EQUITY') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.35)', color: '#3b82f6', padding: '2px 8px', borderRadius: '12px', fontSize: '10.5px', fontWeight: '800' }}>
          <TrendingUp size={11} /> Equity (Cash)
        </span>
      );
    }
    if (s === 'FNO' || s === 'DERIVATIVES') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.35)', color: '#a855f7', padding: '2px 8px', borderRadius: '12px', fontSize: '10.5px', fontWeight: '800' }}>
          <Zap size={11} /> F&O (Derivatives)
        </span>
      );
    }
    if (s === 'COMMODITY' || s === 'COMMODITIES') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.35)', color: '#eab308', padding: '2px 8px', borderRadius: '12px', fontSize: '10.5px', fontWeight: '800' }}>
          🛢️ Commodities (MCX)
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(148, 163, 184, 0.15)', border: '1px solid rgba(148, 163, 184, 0.35)', color: '#94a3b8', padding: '2px 8px', borderRadius: '12px', fontSize: '10.5px', fontWeight: '800' }}>
        <Layers size={11} /> All Markets
      </span>
    );
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

  const ended = isContestEnded(activeContest);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', padding: isMobile ? '12px 6px' : '16px 8px' }}>
      
      {/* Top Header & View Mode Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              setActiveTab('ACTIVE');
              if (activeContests.length > 0) handleContestSelect(activeContests[0]);
            }}
            style={{
              background: activeTab === 'ACTIVE' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'var(--bg-card)',
              color: activeTab === 'ACTIVE' ? '#000' : 'var(--text-secondary)',
              border: activeTab === 'ACTIVE' ? 'none' : '1px solid var(--border-color)',
              borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: '800', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Trophy size={14} /> Active Tournaments ({activeContests.length})
          </button>

          {pastContests && pastContests.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('PAST');
                handleContestSelect(pastContests[0]);
              }}
              style={{
                background: activeTab === 'PAST' ? 'linear-gradient(135deg, #475569, #334155)' : 'var(--bg-card)',
                color: activeTab === 'PAST' ? '#fff' : 'var(--text-secondary)',
                border: activeTab === 'PAST' ? 'none' : '1px solid var(--border-color)',
                borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <History size={14} /> Past Events ({pastContests.length})
            </button>
          )}
        </div>

        {/* Live Sync button */}
        <button
          onClick={handleRefresh}
          disabled={leaderboardLoading || activeContestLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(37, 99, 235, 0.12)', border: '1px solid rgba(37, 99, 235, 0.3)',
            color: '#2563eb', padding: '6px 14px', borderRadius: '8px', fontSize: '11.5px',
            fontWeight: '700', cursor: 'pointer', marginLeft: isMobile ? '0' : 'auto'
          }}
        >
          <RefreshCw size={12} className={(leaderboardLoading || activeContestLoading) ? 'animate-spin' : ''} />
          {leaderboardLoading ? 'Syncing...' : 'Live Sync'}
        </button>
      </div>

      {/* Multi-Tournament Pill Switcher (If multiple active or past events exist) */}
      {((activeTab === 'ACTIVE' && activeContests.length > 1) || (activeTab === 'PAST' && pastContests.length > 0)) && (
        <div style={{
          display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px',
          scrollbarWidth: 'none', msOverflowStyle: 'none'
        }}>
          {(activeTab === 'ACTIVE' ? activeContests : pastContests).map((c) => {
            const isSelected = activeContest?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleContestSelect(c)}
                style={{
                  background: isSelected 
                    ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.18) 0%, var(--bg-card) 100%)' 
                    : 'var(--bg-card)',
                  border: isSelected ? '1px solid #f59e0b' : '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: isSelected ? '0 0 12px rgba(245, 158, 11, 0.2)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ fontSize: '14px' }}>🏆</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: isSelected ? '800' : '600', color: isSelected ? '#fbbf24' : 'var(--text-primary)' }}>
                    {c.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    {getSegmentBadge(c.segment)}
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      {c.end_date ? new Date(c.end_date).toLocaleDateString('en-IN') : ''}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

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
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #f59e0b, #eab308, #2563eb, #a855f7)' }} />

          {/* Top Bar: Badges & Live Status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {ended ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.4)',
                  color: '#d97706', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '800'
                }}>
                  🏁 TOURNAMENT CONCLUDED
                </span>
              ) : (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.35)',
                  color: '#16a34a', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '800'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 6px rgba(22, 163, 74, 0.4)' }} />
                  🟢 LIVE TOURNAMENT
                </span>
              )}

              {/* Segment Badge */}
              {getSegmentBadge(activeContest.segment)}

              {activeContest.end_date && !ended && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.3)',
                  color: '#d97706', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700'
                }}>
                  <Clock size={12} />
                  {calculateTimeLeft(activeContest.end_date)}
                </span>
              )}

              {activeContest.start_date && activeContest.end_date && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600'
                }}>
                  <Calendar size={12} />
                  {new Date(activeContest.start_date).toLocaleDateString('en-IN')} - {new Date(activeContest.end_date).toLocaleDateString('en-IN')}
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
                <CheckCircle2 size={14} color="#16a34a" /> Tournament Rules & Eligibility
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li>All registered traders are automatically enrolled (₹0 entry fee).</li>
                <li>
                  Eligible Instruments: <strong>{activeContest.segment === 'EQUITY' ? 'Cash Stocks Only' : activeContest.segment === 'FNO' ? 'Futures & Options Only' : activeContest.segment === 'COMMODITY' ? 'MCX Commodities Only' : 'All Traded Instruments'}</strong>.
                </li>
                <li>Rankings are determined by total verified realized net P&L on closed positions during the tournament period.</li>
                <li>Prizes are credited to your platform wallet or activated as Free PRO membership upon tournament finalization.</li>
                <li>Automated fair-play risk & RMS verification ensures transparent competition.</li>
              </ul>
            </div>
          )}

          {/* Guaranteed Reward Pool Tiles */}
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
              border: '1px solid rgba(217, 119, 6, 0.3)',
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

      {/* Filter & Scope Control Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'center',
        flexDirection: isMobile ? 'column' : 'row',
        gap: '12px',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: isMobile ? '10px 12px' : '10px 16px'
      }}>
        {/* Market Segment Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginRight: '4px' }}>
            SEGMENT:
          </span>
          {[
            { id: 'ALL', label: 'All Markets', icon: Layers },
            { id: 'EQUITY', label: 'Equity (Cash)', icon: TrendingUp },
            { id: 'FNO', label: 'F&O Derivatives', icon: Zap },
            { id: 'COMMODITY', label: 'Commodities', icon: Award }
          ].map(f => {
            const isSelected = selectedSegment === f.id;
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => handleSegmentChange(f.id)}
                style={{
                  background: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'var(--bg-card)',
                  border: isSelected ? '1px solid #2563eb' : '1px solid var(--border-color)',
                  color: isSelected ? '#3b82f6' : 'var(--text-secondary)',
                  borderRadius: '20px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: isSelected ? '800' : '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={11} /> {f.label}
              </button>
            );
          })}
        </div>

        {/* Standings Scope Toggle (Tournament Overall vs Today Live) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-card)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={() => handleScopeChange('TOURNAMENT')}
            style={{
              background: scope === 'TOURNAMENT' ? '#2563eb' : 'transparent',
              color: scope === 'TOURNAMENT' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Tournament Standings
          </button>
          <button
            type="button"
            onClick={() => handleScopeChange('TODAY')}
            style={{
              background: scope === 'TODAY' ? '#2563eb' : 'transparent',
              color: scope === 'TODAY' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Today's Session
          </button>
        </div>
      </div>

      {/* Top 3 Podium Highlights */}
      {top3.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: isMobile ? '12px' : '16px',
          alignItems: 'flex-end'
        }}>
          {/* Rank 1 (Gold) */}
          {top3[0] && (
            <div className="glass-panel" style={{
              background: 'linear-gradient(180deg, rgba(234, 179, 8, 0.18) 0%, var(--bg-panel) 100%)',
              border: '1px solid rgba(234, 179, 8, 0.45)',
              borderRadius: '14px', padding: isMobile ? '18px' : '28px 24px', textAlign: 'center',
              boxShadow: '0 0 24px rgba(234, 179, 8, 0.12)', position: 'relative', overflow: 'hidden',
              order: isMobile ? 1 : 2
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #f59e0b, #eab308)' }} />
              <div style={{ fontSize: isMobile ? '32px' : '40px', marginBottom: '6px' }}>👑</div>
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
            {selectedSegment !== 'ALL' && (
              <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '600' }}>
                • {selectedSegment}
              </span>
            )}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
            Auto-cached in Redis
          </span>
        </div>

        {leaderboard.length === 0 ? (
          <div style={{ padding: isMobile ? '40px 16px' : '60px 20px', textAlign: 'center' }}>
            <Trophy size={40} color="#94a3b8" style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
              No Profitable Trades Recorded Yet
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto' }}>
              {selectedSegment !== 'ALL'
                ? `Place and close profitable ${selectedSegment} positions during market hours to rank on the leaderboard!`
                : 'Place and close your profitable positions during live market hours to climb the rankings and claim your spot on the podium!'}
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
