import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Trophy, Medal, Award, TrendingUp, RefreshCw, Users, ShieldCheck, Flame } from 'lucide-react';

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
        <div className="w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 flex items-center justify-center font-bold text-sm shadow-[0_0_12px_rgba(234,179,8,0.3)]">
          🥇
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-8 h-8 rounded-full bg-slate-300/20 text-slate-300 border border-slate-400/50 flex items-center justify-center font-bold text-sm shadow-[0_0_12px_rgba(203,213,225,0.3)]">
          🥈
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-8 h-8 rounded-full bg-amber-700/20 text-amber-500 border border-amber-600/50 flex items-center justify-center font-bold text-sm shadow-[0_0_12px_rgba(217,119,6,0.3)]">
          🥉
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center justify-center font-semibold text-xs">
        #{rank}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-slate-200">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/20 to-purple-900/40 border border-blue-500/20 p-6 md:p-8 mb-8 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold mb-3">
              <Flame className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
              LIVE INTRADAY RANKINGS
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-400" />
              Trader Leaderboard
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Top performing traders today based on verified closed profit & loss.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={leaderboardLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-blue-400 ${leaderboardLoading ? 'animate-spin' : ''}`} />
              {leaderboardLoading ? 'Updating...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 items-end">
          {/* Rank 2 (Silver) */}
          {top3[1] ? (
            <div className="order-2 md:order-1 bg-[#131722]/90 border border-slate-400/30 rounded-2xl p-6 text-center shadow-lg relative overflow-hidden backdrop-blur hover:border-slate-400/60 transition-all">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-400 to-slate-200" />
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-300/10 border-2 border-slate-400 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(203,213,225,0.2)]">
                🥈
              </div>
              <div className="font-bold text-lg text-white truncate">{top3[1].username}</div>
              <div className="text-xs text-slate-400 mt-0.5">Rank #2</div>
              <div className="text-2xl font-black text-emerald-400 mt-3">
                +₹{top3[1].pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800 flex justify-around text-xs text-slate-400">
                <span>Trades: <strong className="text-slate-200">{top3[1].totalTrades}</strong></span>
                <span>Win Rate: <strong className="text-emerald-400">{top3[1].winRate}%</strong></span>
              </div>
            </div>
          ) : <div className="order-2 md:order-1" />}

          {/* Rank 1 (Gold - Elevated) */}
          {top3[0] && (
            <div className="order-1 md:order-2 bg-gradient-to-b from-[#1c2438] to-[#131722] border-2 border-yellow-500/50 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden backdrop-blur md:-translate-y-4 hover:border-yellow-400 transition-all">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-500 via-amber-300 to-yellow-500 animate-pulse" />
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-[11px] font-bold mb-2">
                👑 DAILY CHAMPION
              </div>
              <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-yellow-500/10 border-2 border-yellow-400 flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(234,179,8,0.35)]">
                🥇
              </div>
              <div className="font-extrabold text-xl text-white truncate">{top3[0].username}</div>
              <div className="text-xs text-yellow-400/80 font-medium mt-0.5">Rank #1 Overall</div>
              <div className="text-3xl font-black text-emerald-400 mt-4">
                +₹{top3[0].pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 flex justify-around text-xs text-slate-400">
                <span>Trades: <strong className="text-slate-200">{top3[0].totalTrades}</strong></span>
                <span>Win Rate: <strong className="text-emerald-400">{top3[0].winRate}%</strong></span>
              </div>
            </div>
          )}

          {/* Rank 3 (Bronze) */}
          {top3[2] ? (
            <div className="order-3 bg-[#131722]/90 border border-amber-600/30 rounded-2xl p-6 text-center shadow-lg relative overflow-hidden backdrop-blur hover:border-amber-600/60 transition-all">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-700 to-amber-500" />
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-600/10 border-2 border-amber-600 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(217,119,6,0.2)]">
                🥉
              </div>
              <div className="font-bold text-lg text-white truncate">{top3[2].username}</div>
              <div className="text-xs text-slate-400 mt-0.5">Rank #3</div>
              <div className="text-2xl font-black text-emerald-400 mt-3">
                +₹{top3[2].pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800 flex justify-around text-xs text-slate-400">
                <span>Trades: <strong className="text-slate-200">{top3[2].totalTrades}</strong></span>
                <span>Win Rate: <strong className="text-emerald-400">{top3[2].winRate}%</strong></span>
              </div>
            </div>
          ) : <div className="order-3" />}
        </div>
      )}

      {/* Leaderboard Table (Ranks 4 - 50) */}
      <div className="bg-[#131722] border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold text-white text-base">All Ranked Traders</h2>
          </div>
          <span className="text-xs text-slate-500">Auto-cached every 60s in Redis</span>
        </div>

        {leaderboard.length === 0 ? (
          <div className="py-16 text-center">
            <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-40" />
            <p className="text-slate-400 text-sm font-medium">No profitable trades recorded yet today.</p>
            <p className="text-slate-500 text-xs mt-1">Be the first to close a profitable trade and climb the ranks!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0b0e14]/60 text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-800/80">
                <tr>
                  <th className="px-6 py-3.5">Rank</th>
                  <th className="px-6 py-3.5">Trader</th>
                  <th className="px-6 py-3.5 text-center">Trades Closed</th>
                  <th className="px-6 py-3.5 text-center">Win Rate</th>
                  <th className="px-6 py-3.5 text-right">Realized Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {leaderboard.map((item) => (
                  <tr key={item.rank} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      {getRankBadge(item.rank)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs uppercase">
                          {item.username.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{item.username}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            Verified Trader
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-slate-300">
                      {item.totalTrades}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {item.winRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-emerald-400 text-base">
                        +₹{item.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
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
