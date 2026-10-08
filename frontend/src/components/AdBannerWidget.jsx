import React, { useState, useEffect, useRef } from 'react';
import { Play, Sparkles, ExternalLink, CheckCircle, Volume2, VolumeX, ShieldCheck, X, Gift } from 'lucide-react';
import { useStore, API } from '../store';

let cachedAdConfig = null;
let fetchingPromise = null;
let adsenseScriptInjected = false;

let adsenseLayoutGuardAttached = false;

function attachAdSenseLayoutGuard() {
  if (adsenseLayoutGuardAttached || typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  adsenseLayoutGuardAttached = true;

  const stripAdSenseInlineHeight = (el) => {
    if (!el || !el.style) return;
    const isLayoutContainer =
      el.id === 'root' ||
      el.tagName === 'MAIN' ||
      (el.classList && (
        el.classList.contains('app-container') ||
        el.classList.contains('content-wrapper') ||
        el.classList.contains('main-content')
      ));
    if (isLayoutContainer && el.style.getPropertyValue('height') === 'auto') {
      if (el.classList && el.classList.contains('app-container')) {
        el.style.setProperty('height', '100vh');
      } else {
        el.style.removeProperty('height');
      }
    }
  };

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'style') {
        stripAdSenseInlineHeight(m.target);
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });
  }
}

function injectAdSenseScript(clientId) {
  if (!clientId || typeof document === 'undefined') return;
  const cleanId = String(clientId).trim();
  if (!cleanId.startsWith('ca-pub-')) return;
  if (!document.getElementById('skandx-adsense-unfilled-css')) {
    const style = document.createElement('style');
    style.id = 'skandx-adsense-unfilled-css';
    style.textContent = 'ins.adsbygoogle[data-ad-status="unfilled"] { display: none !important; height: 0 !important; min-height: 0 !important; }';
    document.head.appendChild(style);
  }
  attachAdSenseLayoutGuard();
  if (adsenseScriptInjected) return;
  if (document.querySelector(`script[src*="adsbygoogle.js"]`)) {
    adsenseScriptInjected = true;
    return;
  }
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cleanId)}`;
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
  adsenseScriptInjected = true;
}

export function updateCachedAdConfig(newConfig) {
  if (!newConfig) return;
  cachedAdConfig = { ...(cachedAdConfig || {}), ...newConfig };
  if (cachedAdConfig.adsense_client_id) {
    injectAdSenseScript(cachedAdConfig.adsense_client_id);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('skandx-ad-config-updated', { detail: cachedAdConfig }));
  }
}

export function useAdConfig() {
  const [config, setConfig] = useState(cachedAdConfig);

  const refresh = async () => {
    try {
      const res = await fetch(`${API}/api/ads/config`);
      const data = await res.json();
      if (data && data.success && data.config) {
        updateCachedAdConfig(data.config);
        setConfig(data.config);
      }
    } catch (e) {}
  };

  useEffect(() => {
    const handleConfigUpdate = (e) => {
      if (e.detail) setConfig(e.detail);
    };
    window.addEventListener('skandx-ad-config-updated', handleConfigUpdate);

    if (cachedAdConfig) {
      setConfig(cachedAdConfig);
      if (cachedAdConfig.adsense_client_id) {
        injectAdSenseScript(cachedAdConfig.adsense_client_id);
      }
      return () => window.removeEventListener('skandx-ad-config-updated', handleConfigUpdate);
    }
    if (!fetchingPromise) {
      fetchingPromise = fetch(`${API}/api/ads/config`)
        .then(r => r.json())
        .then(data => {
          if (data && data.success && data.config) {
            cachedAdConfig = data.config;
            if (data.config.adsense_client_id) {
              injectAdSenseScript(data.config.adsense_client_id);
            }
          }
          return cachedAdConfig;
        })
        .catch(() => ({ enabled: false, interstitial_enabled: false, reward_enabled: false }))
        .finally(() => { fetchingPromise = null; });
    }
    fetchingPromise.then(cfg => {
      if (cfg) setConfig(cfg);
    });

    return () => window.removeEventListener('skandx-ad-config-updated', handleConfigUpdate);
  }, []);

  return { config, refresh };
}

export function isUserAdFreeTier(user) {
  if (!user) return false;
  if (user.is_admin && (!cachedAdConfig || cachedAdConfig.show_ads_to_admin !== false)) {
    return false;
  }
  const paidTiers = ['PRO', 'MONTHLY', 'YEARLY', 'LIFETIME', 'HIGHEST', 'FEATURE', 'VIP', 'MASTERCLASS'];
  const isPaid = paidTiers.includes(String(user.subscription_tier || '').toUpperCase());
  const isNotExpired = !user.subscription_expires || new Date(user.subscription_expires).getTime() > Date.now();
  return isPaid && isNotExpired;
}

export function trackAdEvent(event) {
  if (cachedAdConfig && !cachedAdConfig.internal_counter_enabled) {
    return Promise.resolve(null);
  }
  try {
    return fetch(`${API}/api/ads/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event })
    }).catch(() => null);
  } catch (e) {
    return Promise.resolve(null);
  }
}

// ─── Global Ad Interstitial Helpers (Post-Order & Pre-Exit) ──────────────────
export function triggerPostOrderAd({ symbol, side = 'BUY', status = 'EXECUTED' } = {}) {
  if (typeof window === 'undefined') return;
  const user = useStore.getState().user;
  if (isUserAdFreeTier(user)) return;
  if (cachedAdConfig && (cachedAdConfig.enabled === false || cachedAdConfig.interstitial_enabled === false)) return;
  window.dispatchEvent(new CustomEvent('skandx-trigger-ad', {
    detail: {
      mode: 'post_order',
      symbol: symbol || '',
      side: side || 'BUY',
      status: status || 'EXECUTED'
    }
  }));
}

export function triggerPreExitAd(onProceed, { symbol = '', side = 'EXIT' } = {}) {
  if (typeof window === 'undefined') {
    if (typeof onProceed === 'function') onProceed();
    return;
  }
  const user = useStore.getState().user;
  if (isUserAdFreeTier(user) || (cachedAdConfig && (cachedAdConfig.enabled === false || cachedAdConfig.interstitial_enabled === false))) {
    if (typeof onProceed === 'function') onProceed();
    return;
  }
  window.dispatchEvent(new CustomEvent('skandx-trigger-ad', {
    detail: {
      mode: 'pre_exit',
      symbol: symbol || '',
      side: side || 'EXIT',
      onProceed
    }
  }));
}

// ─── 30-Second Rewarded / Interstitial Video Ad Player Modal ─────────────────
export function RewardedAdModal({ isOpen, onClose, onRewardClaimed, onAdCompleted, customConfig, triggerContext }) {
  const { config: fetchedConfig } = useAdConfig();
  const config = customConfig || fetchedConfig;
  const duration = 30;
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [isPausedByTab, setIsPausedByTab] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimedData, setClaimedData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [muted, setMuted] = useState(true);
  const [modalAdFilled, setModalAdFilled] = useState(false);
  const adsenseRef = useRef(null);
  const completionTrackedRef = useRef(false);
  const autoProceededRef = useRef(false);

  const mode = triggerContext?.mode || 'reward'; // 'reward' | 'post_order' | 'pre_exit'
  const cleanSymbol = (triggerContext?.symbol || '').replace(/^(NSE:|BSE:|MCX:)/i, '');

  const executePreExitProceed = () => {
    if (autoProceededRef.current) return;
    autoProceededRef.current = true;
    if (typeof onClose === 'function') onClose();
    if (typeof triggerContext?.onProceed === 'function') {
      window.__lastPreExitAdTs = Date.now();
      triggerContext.onProceed();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setSecondsLeft(duration);
    setWatchedSeconds(0);
    setClaimedData(null);
    setErrorMsg('');
    setModalAdFilled(false);
    completionTrackedRef.current = false;
    autoProceededRef.current = false;
    trackAdEvent('impression');

    const handleVisibilityChange = () => {
      setIsPausedByTab(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isOpen, triggerContext]);

  useEffect(() => {
    if (!isOpen || secondsLeft <= 0 || isPausedByTab || claimedData) return;
    const timer = setInterval(() => {
      setSecondsLeft(prev => Math.max(0, prev - 1));
      setWatchedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, secondsLeft, isPausedByTab, claimedData]);

  // Track 30s ad completion and auto-open Exit Table when mode === 'pre_exit'
  useEffect(() => {
    if (!isOpen || secondsLeft > 0) return;
    if (!completionTrackedRef.current) {
      completionTrackedRef.current = true;
      trackAdEvent('complete_30s').finally(() => {
        if (typeof onAdCompleted === 'function') {
          onAdCompleted();
        }
      });
    }
    if (mode === 'pre_exit' && !autoProceededRef.current) {
      const timer = setTimeout(() => {
        executePreExitProceed();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen, secondsLeft, mode, onClose, onAdCompleted, triggerContext]);

  useEffect(() => {
    if (!isOpen || !config?.adsense_client_id || !config?.adsense_rewarded_slot || !adsenseRef.current) return;
    const el = adsenseRef.current;
    const checkStatus = () => {
      const status = el.getAttribute('data-ad-status');
      setModalAdFilled(status === 'filled');
    };
    checkStatus();
    const observer = new MutationObserver(checkStatus);
    observer.observe(el, { attributes: true, attributeFilter: ['data-ad-status'] });
    try {
      if (!el.getAttribute('data-adsbygoogle-status')) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (e) {}
    return () => observer.disconnect();
  }, [isOpen, config?.adsense_client_id, config?.adsense_rewarded_slot]);

  if (!isOpen || !config) return null;

  const rewardAmount = Number(config.reward_amount || 100000);
  const progressPct = Math.min(100, Math.round(((duration - secondsLeft) / duration) * 100));

  const handleClaimReward = async () => {
    if (secondsLeft > 0 || claiming) return;
    setClaiming(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/ads/claim-reward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ watchDurationSec: Math.max(30, watchedSeconds) })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Failed to claim reward');
      } else {
        setClaimedData(data);
        // Immediately update balance in Zustand store
        const currentUser = useStore.getState().user;
        if (currentUser && data.balance !== undefined) {
          useStore.setState({ user: { ...currentUser, balance: data.balance } });
        }
        if (typeof onRewardClaimed === 'function') {
          onRewardClaimed(data);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error claiming reward');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(2, 6, 23, 0.92)',
      backdropFilter: 'blur(8px)',
      zIndex: 2500,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: '18px',
        overflow: 'hidden',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75)'
      }}>
        {/* Top Bar with Timer */}
        <div style={{
          padding: '14px 18px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {(() => {
              const sideUpper = String(triggerContext?.side || '').toUpperCase();
              const isDownload = sideUpper.includes('EXPORT') || sideUpper.includes('DOWNLOAD');
              const isModify = sideUpper === 'MODIFY';
              const isConvert = sideUpper === 'CONVERT';
              const isShare = sideUpper.includes('SHARE');

              let badgeLabel = '🎬 REWARDED AD';
              if (mode === 'post_order') {
                badgeLabel = `✅ ORDER ${triggerContext?.status || 'PLACED'} • AD`;
              } else if (mode === 'pre_exit') {
                if (isDownload) badgeLabel = '🎬 SPONSORED AD • REPORT EXPORT';
                else if (isModify) badgeLabel = '🎬 SPONSORED AD • MODIFY ORDER';
                else if (isConvert) badgeLabel = '🎬 SPONSORED AD • CONVERT POSITION';
                else if (isShare) badgeLabel = '🎬 SPONSORED AD • SHARE P&L CARD';
                else badgeLabel = '🎬 SPONSORED AD • BEFORE EXIT';
              }

              return (
                <>
                  <span style={{
                    background: mode === 'post_order'
                      ? 'rgba(16, 185, 129, 0.18)'
                      : mode === 'pre_exit'
                        ? 'rgba(239, 68, 68, 0.18)'
                        : 'rgba(245, 158, 11, 0.18)',
                    color: mode === 'post_order'
                      ? '#34d399'
                      : mode === 'pre_exit'
                        ? '#f87171'
                        : '#fbbf24',
                    border: `1px solid ${mode === 'post_order' ? 'rgba(16, 185, 129, 0.4)' : mode === 'pre_exit' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
                    fontSize: '10px',
                    fontWeight: '800',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    letterSpacing: '0.5px'
                  }}>
                    {badgeLabel}
                  </span>
                  <span style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '600' }}>
                    {mode === 'pre_exit' ? (
                      isDownload ? (
                        <>Download for <strong style={{ color: '#38bdf8' }}>{cleanSymbol || 'Report'}</strong> starts after ad</>
                      ) : isModify ? (
                        <>Modify Order for <strong style={{ color: '#38bdf8' }}>{cleanSymbol || 'Order'}</strong> opens after ad</>
                      ) : isConvert ? (
                        <>Convert Window for <strong style={{ color: '#38bdf8' }}>{cleanSymbol || 'Position'}</strong> opens after ad</>
                      ) : isShare ? (
                        <>P&L Card for <strong style={{ color: '#38bdf8' }}>{cleanSymbol || 'Trade'}</strong> opens after ad</>
                      ) : (
                        <>Exit Table for <strong style={{ color: '#38bdf8' }}>{cleanSymbol || 'Position'}</strong> opens after ad</>
                      )
                    ) : mode === 'post_order' ? (
                      <><strong style={{ color: '#38bdf8' }}>{triggerContext?.side || 'BUY'} {cleanSymbol}</strong> • Sponsored Break</>
                    ) : (
                      <>Reward: <strong style={{ color: '#10b981' }}>+₹{rewardAmount.toLocaleString('en-IN')}</strong></>
                    )}
                  </span>
                </>
              );
            })()}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {secondsLeft > 0 ? (
              <div style={{
                background: 'rgba(56, 189, 248, 0.14)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#38bdf8',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '800',
                fontFamily: 'monospace'
              }}>
                {isPausedByTab ? '⏸ PAUSED (Keep tab open)' : `⏱ ${secondsLeft}s remaining`}
              </div>
            ) : (
              <div style={{
                background: 'rgba(16, 185, 129, 0.18)',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                color: '#34d399',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: '800'
              }}>
                {mode === 'pre_exit' ? '✓ Action Unlocked!' : '✓ Ad Complete!'}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (secondsLeft > 0) {
                  const confirmMsg = mode === 'pre_exit'
                    ? `Please wait ${secondsLeft}s for the ad to finish to continue. Cancel this action?`
                    : mode === 'post_order'
                      ? `Please wait ${secondsLeft}s for the sponsored ad to finish. Close anyway?`
                      : `Close before timer finishes? You will not receive the +₹${rewardAmount.toLocaleString('en-IN')} reward.`;
                  if (!window.confirm(confirmMsg)) {
                    return;
                  }
                  if (mode === 'pre_exit') {
                    onClose();
                    return;
                  }
                }
                onClose();
              }}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                color: '#94a3b8',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Close"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)' }}>
          <div style={{
            width: `${progressPct}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #38bdf8 0%, #10b981 100%)',
            transition: 'width 0.9s linear'
          }} />
        </div>

        {/* Main Video / Ad Showcase Stage */}
        <div style={{ padding: '22px' }}>
          {claimedData ? (
            <div style={{ textAlign: 'center', padding: '20px 10px' }}>
              <div style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <CheckCircle size={36} color="#10b981" />
              </div>
              <h3 style={{ fontSize: '21px', fontWeight: '800', color: '#fff', marginBottom: '8px' }}>
                +₹{rewardAmount.toLocaleString('en-IN')} Credited!
              </h3>
              <p style={{ fontSize: '13.5px', color: '#94a3b8', marginBottom: '20px' }}>
                Your updated trading margin is now <strong style={{ color: '#10b981' }}>₹{Number(claimedData.balance || 0).toLocaleString('en-IN')}</strong>.
                ({claimedData.claims_today}/{claimedData.daily_limit} daily rewarded ads used today)
              </p>
              <button
                type="button"
                onClick={onClose}
                className="premium-btn"
                style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: '800' }}
              >
                CONTINUE TRADING
              </button>
            </div>
          ) : (
            <>
              {/* Direct Sponsor Video or Internal 30s Spotlight ONLY when Direct Sponsor is enabled */}
              {config.direct_sponsor_enabled && (
                config.sponsor_video_url ? (
                  <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px', background: '#000', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <video
                      src={config.sponsor_video_url}
                      autoPlay
                      loop
                      muted={muted}
                      playsInline
                      style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block' }}
                    />
                    <button
                      type="button"
                      onClick={() => setMuted(!muted)}
                      style={{
                        position: 'absolute',
                        bottom: '10px',
                        right: '10px',
                        background: 'rgba(0,0,0,0.65)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                    </button>
                  </div>
                ) : (
                  <div style={{
                    position: 'relative',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    marginBottom: '16px',
                    background: 'radial-gradient(circle at 20% 20%, rgba(16, 185, 129, 0.22) 0%, rgba(56, 189, 248, 0.16) 45%, rgba(2, 6, 23, 0.98) 100%)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    padding: '18px 16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '10px',
                        fontWeight: '800',
                        color: '#10b981',
                        background: 'rgba(16, 185, 129, 0.14)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        padding: '3px 8px',
                        borderRadius: '999px',
                        letterSpacing: '0.5px'
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                        LIVE 30s SPONSOR SPOTLIGHT • SCENE {Math.min(5, Math.floor((duration - secondsLeft) / 6) + 1)} OF 5
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#38bdf8' }}>
                        {Math.round(progressPct)}% Watched
                      </span>
                    </div>

                    {(() => {
                      const sceneIdx = Math.min(4, Math.floor((duration - secondsLeft) / 6));
                      const scenes = [
                        {
                          icon: '⚡',
                          tag: 'INSTANT EXECUTION',
                          headline: 'Sub-Second Options & Futures Order Routing',
                          sub: 'Experience institutional-grade NSE, BSE & MCX paper trading with real-time tick-by-tick Greeks.'
                        },
                        {
                          icon: '📊',
                          tag: 'DEEP ANALYTICS',
                          headline: 'Live Option Chain with IV, Delta, Theta & PCR',
                          sub: 'Spot high-probability setups faster with live Open Interest buildup and Max Pain tracking.'
                        },
                        {
                          icon: '🛡️',
                          tag: 'ZERO BROKERAGE',
                          headline: config.sponsor_title || 'Open a FREE Zero-Brokerage Demat & Options Account — ₹0 AMC',
                          sub: config.sponsor_subtitle || 'Trade Live NSE, BSE & MCX Options with Sub-Second Execution & TradingView Charts.'
                        },
                        {
                          icon: '🤖',
                          tag: 'PRO ALGO & CHARTS',
                          headline: 'Multi-Timeframe Charts + Strategy Payoff Visualizer',
                          sub: 'Test straddles, strangles, and iron condors risk-free before deploying real capital.'
                        },
                        mode === 'reward' ? {
                          icon: '🎁',
                          tag: 'REWARD READY',
                          headline: `Unlock +₹${rewardAmount.toLocaleString('en-IN')} Instant Demo Trading Capital`,
                          sub: secondsLeft > 0
                            ? `Keep watching for ${secondsLeft} more second${secondsLeft === 1 ? '' : 's'} to unlock your green Claim button below!`
                            : '30-second ad complete! Click the green button below to credit your account immediately.'
                        } : {
                          icon: '✅',
                          tag: 'ALMOST READY',
                          headline: 'Thank You for Supporting Free Real-Time Paper Trading',
                          sub: secondsLeft > 0
                            ? `Sponsored break finishes in ${secondsLeft} second${secondsLeft === 1 ? '' : 's'}. Upgrade to PRO anytime for an instant 100% ad-free terminal.`
                            : '30-second sponsored break complete! Click the button below to continue immediately.'
                        }
                      ];
                      const cur = scenes[sceneIdx] || scenes[0];
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '12px',
                            background: 'rgba(56, 189, 248, 0.14)',
                            border: '1px solid rgba(56, 189, 248, 0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '26px',
                            flexShrink: 0
                          }}>
                            {cur.icon}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '10px', fontWeight: '800', color: '#38bdf8', letterSpacing: '0.6px', marginBottom: '2px' }}>
                              {cur.tag}
                            </div>
                            <div style={{ fontSize: '14.5px', fontWeight: '800', color: '#f8fafc', lineHeight: '1.3', marginBottom: '4px' }}>
                              {cur.headline}
                            </div>
                            <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.45' }}>
                              {cur.sub}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
                      {[0, 1, 2, 3, 4].map(idx => {
                        const activeIdx = Math.min(4, Math.floor((duration - secondsLeft) / 6));
                        const passed = idx <= activeIdx;
                        return (
                          <div
                            key={idx}
                            style={{
                              flex: 1,
                              height: '4px',
                              borderRadius: '999px',
                              background: passed ? 'linear-gradient(90deg, #10b981, #38bdf8)' : 'rgba(255,255,255,0.12)',
                              transition: 'background 0.3s ease'
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )
              )}

              {/* Google AdSense Rewarded/Display slot */}
              {config.adsense_client_id && config.adsense_rewarded_slot ? (
                <div style={{
                  marginBottom: '14px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  maxHeight: modalAdFilled ? '340px' : '0px',
                  transition: 'max-height 0.25s ease'
                }}>
                  <ins
                    ref={adsenseRef}
                    className="adsbygoogle"
                    style={{ display: 'block', width: '100%' }}
                    data-ad-client={config.adsense_client_id}
                    data-ad-slot={config.adsense_rewarded_slot}
                    data-ad-format="auto"
                    data-full-width-responsive="true"
                  />
                </div>
              ) : null}

              {/* Clean Google AdSense status box when Direct Sponsor is OFF and AdSense has not filled an ad yet */}
              {!config.direct_sponsor_enabled && !modalAdFilled && (
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8', letterSpacing: '0.5px', marginBottom: '4px' }}>
                    GOOGLE ADSENSE UNIT ({config.adsense_rewarded_slot || 'Active'})
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                    {secondsLeft > 0
                      ? `Sponsored Google AdSense break — continues in ${secondsLeft}s`
                      : 'Ad timer complete — you may proceed below.'}
                  </div>
                </div>
              )}

              {/* Rich Sponsor / Partner Showcase Card (Only shown when Direct Sponsor mode is enabled) */}
              {config.direct_sponsor_enabled && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '14px',
                  padding: '18px',
                  marginBottom: '18px'
                }}>
                  <div style={{
                    display: 'inline-block',
                    fontSize: '10px',
                    fontWeight: '800',
                    color: '#38bdf8',
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    marginBottom: '10px',
                    letterSpacing: '0.6px'
                  }}>
                    {config.sponsor_badge || 'FEATURED PARTNER'}
                  </div>

                  <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#fff', margin: '0 0 8px 0', lineHeight: '1.35' }}>
                    {config.sponsor_title || 'Open a FREE Zero-Brokerage Demat & Options Account — ₹0 AMC'}
                  </h3>

                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 14px 0', lineHeight: '1.5' }}>
                    {config.sponsor_subtitle || 'Trade Live NSE, BSE & MCX Options with Sub-Second Execution, Option Chain Greeks & TradingView Charts.'}
                  </p>

                  <a
                    href={config.sponsor_target_url || '/pricing'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackAdEvent('click')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      color: '#38bdf8',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      textDecoration: 'none'
                    }}
                  >
                    {config.sponsor_cta_text || 'Open Free Account →'} <ExternalLink size={13} />
                  </a>
                </div>
              )}

              {errorMsg && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  marginBottom: '14px'
                }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Action Button(s) */}
              {mode === 'pre_exit' ? (
                (() => {
                  const sideUpper = String(triggerContext?.side || '').toUpperCase();
                  const isDownload = sideUpper.includes('EXPORT') || sideUpper.includes('DOWNLOAD');
                  const isModify = sideUpper === 'MODIFY';
                  const isConvert = sideUpper === 'CONVERT';
                  const isShare = sideUpper.includes('SHARE');

                  let waitText = `⏱ Please Wait ${secondsLeft}s — Opening Exit Table After Ad...`;
                  let readyText = `🚀 OPEN EXIT TABLE FOR ${cleanSymbol || 'POSITION'} NOW →`;
                  if (isDownload) {
                    waitText = `⏱ Please Wait ${secondsLeft}s — Preparing Download After Ad...`;
                    readyText = `🚀 DOWNLOAD ${cleanSymbol || 'REPORT'} NOW →`;
                  } else if (isModify) {
                    waitText = `⏱ Please Wait ${secondsLeft}s — Opening Modify Order After Ad...`;
                    readyText = `🚀 MODIFY ${cleanSymbol || 'ORDER'} NOW →`;
                  } else if (isConvert) {
                    waitText = `⏱ Please Wait ${secondsLeft}s — Opening Convert Window After Ad...`;
                    readyText = `🚀 CONVERT ${cleanSymbol || 'POSITION'} NOW →`;
                  } else if (isShare) {
                    waitText = `⏱ Please Wait ${secondsLeft}s — Opening P&L Card After Ad...`;
                    readyText = `🚀 OPEN P&L CARD FOR ${cleanSymbol || 'TRADE'} NOW →`;
                  }

                  return (
                    <button
                      type="button"
                      disabled={secondsLeft > 0}
                      onClick={() => {
                        if (secondsLeft > 0) return;
                        executePreExitProceed();
                      }}
                      style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '10px',
                        border: 'none',
                        background: secondsLeft > 0
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: secondsLeft > 0 ? '#94a3b8' : '#fff',
                        fontSize: '14px',
                        fontWeight: '800',
                        cursor: secondsLeft > 0 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: secondsLeft > 0 ? 'none' : '0 8px 20px rgba(239, 68, 68, 0.35)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {secondsLeft > 0 ? waitText : readyText}
                    </button>
                  );
                })()
              ) : mode === 'post_order' ? (
                <button
                  type="button"
                  disabled={secondsLeft > 0}
                  onClick={onClose}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '10px',
                    border: 'none',
                    background: secondsLeft > 0
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: secondsLeft > 0 ? '#94a3b8' : '#fff',
                    fontSize: '14px',
                    fontWeight: '800',
                    cursor: secondsLeft > 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: secondsLeft > 0 ? 'none' : '0 8px 20px rgba(16, 185, 129, 0.35)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {secondsLeft > 0
                    ? `⏱ Sponsored Ad Playing (${secondsLeft}s remaining)...`
                    : `✅ CONTINUE TRADING (AD COMPLETE) →`}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={secondsLeft > 0 || claiming}
                  onClick={handleClaimReward}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '10px',
                    border: 'none',
                    background: secondsLeft > 0
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: secondsLeft > 0 ? '#94a3b8' : '#fff',
                    fontSize: '14px',
                    fontWeight: '800',
                    cursor: secondsLeft > 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: secondsLeft > 0 ? 'none' : '0 8px 20px rgba(16, 185, 129, 0.35)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Gift size={17} />
                  {claiming
                    ? 'Crediting Your Account...'
                    : secondsLeft > 0
                      ? `Please Wait ${secondsLeft}s to Claim +₹${rewardAmount.toLocaleString('en-IN')}`
                      : `🎉 CLAIM +₹${rewardAmount.toLocaleString('en-IN')} DEMO FUNDS NOW`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Global Trade & Exit Ad Interstitial Controller (Mounted in App.jsx) ─────
export function GlobalAdInterstitial() {
  const user = useStore(state => state.user);
  const { config } = useAdConfig();
  const [activeTrigger, setActiveTrigger] = useState(null);

  useEffect(() => {
    const handleTriggerAd = (e) => {
      const detail = e.detail || {};
      const currentUser = useStore.getState().user;
      if (isUserAdFreeTier(currentUser)) {
        if (typeof detail.onProceed === 'function') detail.onProceed();
        return;
      }
      if (cachedAdConfig && (cachedAdConfig.enabled === false || cachedAdConfig.interstitial_enabled === false)) {
        if (typeof detail.onProceed === 'function') detail.onProceed();
        return;
      }
      setActiveTrigger(detail);
    };

    window.addEventListener('skandx-trigger-ad', handleTriggerAd);
    return () => window.removeEventListener('skandx-trigger-ad', handleTriggerAd);
  }, []);

  useEffect(() => {
    if (!activeTrigger || !config) return;
    if (!config.enabled || config.interstitial_enabled === false || isUserAdFreeTier(user)) {
      const fn = activeTrigger.onProceed;
      setActiveTrigger(null);
      if (typeof fn === 'function') fn();
    }
  }, [activeTrigger, config, user]);

  if (!activeTrigger || !config || !config.enabled || config.interstitial_enabled === false || isUserAdFreeTier(user)) {
    return null;
  }

  return (
    <RewardedAdModal
      isOpen={Boolean(activeTrigger)}
      triggerContext={activeTrigger}
      onClose={() => setActiveTrigger(null)}
    />
  );
}

// ─── Smart Horizontal Ad Banner Widget (Shown Only to Free BASIC Users) ──────
export default function AdBannerWidget({ onUpgradeClick }) {
  const user = useStore(state => state.user);
  const { config } = useAdConfig();
  const [rewardModalOpen, setRewardModalOpen] = useState(false);
  const [adSenseFilled, setAdSenseFilled] = useState(false);
  const adsenseBannerRef = useRef(null);
  const impressionTracked = useRef(false);

  const isAdFree = isUserAdFreeTier(user);

  useEffect(() => {
    if (!config || !config.enabled || isAdFree) return;
    if (!impressionTracked.current) {
      impressionTracked.current = true;
      trackAdEvent('impression');
    }
    if (config.adsense_client_id && config.adsense_banner_slot && adsenseBannerRef.current) {
      const el = adsenseBannerRef.current;
      const checkStatus = () => {
        const status = el.getAttribute('data-ad-status');
        setAdSenseFilled(status === 'filled');
      };
      checkStatus();
      const observer = new MutationObserver(checkStatus);
      observer.observe(el, { attributes: true, attributeFilter: ['data-ad-status'] });
      try {
        if (!el.getAttribute('data-adsbygoogle-status')) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
      } catch (e) {}
      return () => observer.disconnect();
    }
  }, [config?.enabled, config?.adsense_client_id, config?.adsense_banner_slot, config?.direct_sponsor_enabled, isAdFree]);

  if (!config || !config.enabled || isAdFree) return null;

  // Pure Google AdSense Mode (Direct Sponsor / Internal Ad Card is OFF):
  // Do NOT show the internal SkandX banner wrapper ("GOOGLE ADS | Sponsored Advertisement | Watch 30s Ad").
  // Render only the Google AdSense <ins> unit, and keep it collapsed (0px height) until Google AdSense actually fills an ad.
  if (!config.direct_sponsor_enabled) {
    if (!config.adsense_client_id || !config.adsense_banner_slot) return null;
    return (
      <div
        style={{
          margin: adSenseFilled ? '8px 12px' : '0px',
          padding: adSenseFilled ? '6px 10px' : '0px',
          maxHeight: adSenseFilled ? '100px' : '0px',
          overflow: 'hidden',
          background: adSenseFilled ? 'rgba(15, 23, 42, 0.92)' : 'transparent',
          border: adSenseFilled ? '1px solid rgba(56, 189, 248, 0.18)' : 'none',
          borderRadius: '10px',
          flexShrink: 0,
          transition: 'max-height 0.25s ease'
        }}
      >
        <ins
          ref={adsenseBannerRef}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', height: '90px', maxHeight: '90px' }}
          data-ad-client={config.adsense_client_id}
          data-ad-slot={config.adsense_banner_slot}
          data-ad-format="horizontal"
          data-full-width-responsive="false"
        />
      </div>
    );
  }

  const rewardAmount = Number(config.reward_amount || 100000);

  return (
    <>
      <div style={{
        margin: '8px 12px',
        padding: '10px 14px',
        background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.22)',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        flexShrink: 0
      }}>
        {/* Left: Direct Sponsor Headline + optional Google AdSense unit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '220px' }}>
          <span style={{
            fontSize: '9.5px',
            fontWeight: '800',
            background: 'rgba(56, 189, 248, 0.14)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            padding: '2px 6px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            letterSpacing: '0.4px'
          }}>
            {config.sponsor_badge || 'SPONSORED'}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {config.sponsor_title}
            </div>
            <div className="hide-on-mobile" style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {config.sponsor_subtitle}
            </div>
            {config.adsense_client_id && config.adsense_banner_slot && (
              <div style={{ maxHeight: adSenseFilled ? '100px' : '0px', overflow: 'hidden' }}>
                <ins
                  ref={adsenseBannerRef}
                  className="adsbygoogle"
                  style={{ display: 'block', width: '100%', height: '90px', maxHeight: '90px' }}
                  data-ad-client={config.adsense_client_id}
                  data-ad-slot={config.adsense_banner_slot}
                  data-ad-format="horizontal"
                  data-full-width-responsive="false"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Actions: CTA + Watch 30s Ad for Free Capital + Remove Ads */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {config.sponsor_target_url && (
            <a
              href={config.sponsor_target_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackAdEvent('click')}
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                padding: '5px 11px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '700',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
            >
              {config.sponsor_cta_text || 'Open Account →'}
            </a>
          )}

          {config.reward_enabled && user && (
            <button
              type="button"
              onClick={() => setRewardModalOpen(true)}
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.25) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                color: '#34d399',
                padding: '5px 11px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap'
              }}
              title="Watch a 30-second video ad to instantly credit free demo trading capital"
            >
              <Play size={11} fill="#34d399" />
              Watch 30s Ad (+₹{(rewardAmount / 100000).toFixed(rewardAmount % 100000 === 0 ? 0 : 1)}L Free)
            </button>
          )}

          {onUpgradeClick && (
            <button
              type="button"
              onClick={onUpgradeClick}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#94a3b8',
                padding: '5px 8px',
                borderRadius: '6px',
                fontSize: '10.5px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              title="Upgrade to PRO for an Ad-Free Terminal"
            >
              ✨ Remove Ads
            </button>
          )}
        </div>
      </div>

      <RewardedAdModal
        isOpen={rewardModalOpen}
        onClose={() => setRewardModalOpen(false)}
      />
    </>
  );
}
