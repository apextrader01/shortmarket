import React, { useState, useEffect, useRef } from 'react';
import { Play, Sparkles, ExternalLink, CheckCircle, Volume2, VolumeX, ShieldCheck, X, Gift } from 'lucide-react';
import { useStore, API } from '../store';

let cachedAdConfig = null;
let fetchingPromise = null;
let adsenseScriptInjected = false;

function injectAdSenseScript(clientId) {
  if (!clientId || adsenseScriptInjected || typeof document === 'undefined') return;
  const cleanId = String(clientId).trim();
  if (!cleanId.startsWith('ca-pub-')) return;
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
        .catch(() => null)
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
  const paidTiers = ['PRO', 'MONTHLY', 'YEARLY', 'LIFETIME', 'HIGHEST', 'FEATURE', 'MASTERCLASS'];
  return paidTiers.includes(String(user.subscription_tier || '').toUpperCase());
}

export function trackAdEvent(event) {
  try {
    fetch(`${API}/api/ads/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event })
    }).catch(() => {});
  } catch (e) {}
}

// ─── 30-Second Rewarded Video Ad Player Modal ────────────────────────────────
export function RewardedAdModal({ isOpen, onClose, onRewardClaimed, customConfig }) {
  const { config: fetchedConfig } = useAdConfig();
  const config = customConfig || fetchedConfig;
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [isPausedByTab, setIsPausedByTab] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimedData, setClaimedData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [muted, setMuted] = useState(true);
  const adsenseRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setSecondsLeft(30);
    setWatchedSeconds(0);
    setClaimedData(null);
    setErrorMsg('');
    trackAdEvent('impression');

    const handleVisibilityChange = () => {
      setIsPausedByTab(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || secondsLeft <= 0 || isPausedByTab || claimedData) return;
    const timer = setInterval(() => {
      setSecondsLeft(prev => Math.max(0, prev - 1));
      setWatchedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, secondsLeft, isPausedByTab, claimedData]);

  useEffect(() => {
    if (isOpen && config?.adsense_client_id && config?.adsense_rewarded_slot && adsenseRef.current) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {}
    }
  }, [isOpen, config]);

  if (!isOpen || !config) return null;

  const rewardAmount = Number(config.reward_amount || 100000);
  const progressPct = Math.min(100, Math.round(((30 - secondsLeft) / 30) * 100));

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
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: 'rgba(245, 158, 11, 0.18)',
              color: '#fbbf24',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              fontSize: '10px',
              fontWeight: '800',
              padding: '3px 8px',
              borderRadius: '6px',
              letterSpacing: '0.5px'
            }}>
              🎬 REWARDED AD
            </span>
            <span style={{ fontSize: '12.5px', color: '#cbd5e1', fontWeight: '600' }}>
              Reward: <strong style={{ color: '#10b981' }}>+₹{rewardAmount.toLocaleString('en-IN')}</strong>
            </span>
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
                ✓ Reward Unlocked!
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (secondsLeft > 0 && !window.confirm('Close before timer finishes? You will not receive the +₹' + rewardAmount.toLocaleString('en-IN') + ' reward.')) {
                  return;
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
              {/* If custom MP4 video is configured, play it */}
              {config.sponsor_video_url ? (
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
              ) : null}

              {/* If Google AdSense Rewarded/Display slot is configured, render AdSense unit */}
              {config.adsense_client_id && config.adsense_rewarded_slot ? (
                <div style={{ minHeight: '180px', marginBottom: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ins
                    ref={adsenseRef}
                    className="adsbygoogle"
                    style={{ display: 'block', width: '100%', minHeight: '180px' }}
                    data-ad-client={config.adsense_client_id}
                    data-ad-slot={config.adsense_rewarded_slot}
                    data-ad-format="auto"
                    data-full-width-responsive="true"
                  />
                </div>
              ) : null}

              {/* Rich Sponsor / Partner Showcase Card */}
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

              {/* Action Button */}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Smart Horizontal Ad Banner Widget (Shown Only to Free BASIC Users) ──────
export default function AdBannerWidget({ onUpgradeClick }) {
  const user = useStore(state => state.user);
  const { config } = useAdConfig();
  const [rewardModalOpen, setRewardModalOpen] = useState(false);
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
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {}
    }
  }, [config, isAdFree]);

  if (!config || !config.enabled || isAdFree) return null;

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
        {/* Left: Google AdSense unit OR Direct Sponsor Banner */}
        {config.adsense_client_id && config.adsense_banner_slot ? (
          <div style={{ flex: 1, minWidth: '240px', overflow: 'hidden' }}>
            <ins
              ref={adsenseBannerRef}
              className="adsbygoogle"
              style={{ display: 'block', width: '100%', maxHeight: '70px' }}
              data-ad-client={config.adsense_client_id}
              data-ad-slot={config.adsense_banner_slot}
              data-ad-format="horizontal"
              data-full-width-responsive="true"
            />
          </div>
        ) : (
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
              {config.sponsor_badge || 'AD'}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {config.sponsor_title}
              </div>
              <div className="hide-on-mobile" style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {config.sponsor_subtitle}
              </div>
            </div>
          </div>
        )}

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
