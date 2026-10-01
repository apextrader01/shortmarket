import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cookie, Settings, Check, X } from 'lucide-react';
import { useStore } from '../store';

const STORAGE_KEY = 'skandx_consent_preferences';

export default function ConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const recordUserConsent = useStore(state => state.recordUserConsent);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // Delay slightly for smooth page entry
        const timer = setTimeout(() => setShowBanner(true), 1200);
        return () => clearTimeout(timer);
      } else {
        const parsed = JSON.parse(stored);
        setAnalyticsConsent(!!parsed.analytics);
        setMarketingConsent(!!parsed.marketing);
        // Expose global consent state for third-party scripts
        window.__SKANDX_CONSENT__ = parsed;
      }
    } catch (e) {
      setShowBanner(true);
    }
  }, []);

  const saveConsent = (preferences) => {
    try {
      const fullPref = {
        essential: true, // Always required for platform function
        analytics: !!preferences.analytics,
        marketing: !!preferences.marketing,
        timestamp: new Date().toISOString(),
        version: 'v2026.1'
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fullPref));
      window.__SKANDX_CONSENT__ = fullPref;
      window.dispatchEvent(new CustomEvent('skandx_consent_change', { detail: fullPref }));

      // Record to backend if available
      if (typeof recordUserConsent === 'function') {
        recordUserConsent('COOKIE_ANALYTICS', fullPref.analytics ? 'GRANTED' : 'WITHDRAWN');
        recordUserConsent('COOKIE_MARKETING', fullPref.marketing ? 'GRANTED' : 'WITHDRAWN');
      }
    } catch (e) {}
    setShowBanner(false);
    setShowModal(false);
  };

  const handleAcceptAll = () => {
    saveConsent({ analytics: true, marketing: true });
  };

  const handleRejectNonEssential = () => {
    saveConsent({ analytics: false, marketing: false });
  };

  const handleSaveCustom = () => {
    saveConsent({ analytics: analyticsConsent, marketing: marketingConsent });
  };

  if (!showBanner && !showModal) return null;

  return (
    <>
      {/* Floating Bottom Consent Banner */}
      {showBanner && !showModal && (
        <div style={{
          position: 'fixed',
          bottom: '16px',
          left: '16px',
          right: '16px',
          maxWidth: '960px',
          margin: '0 auto',
          backgroundColor: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '14px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          padding: '18px 24px',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          animation: 'slideUp 0.3s ease-out',
          color: '#f3f4f6',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: '280px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '10px', borderRadius: '10px', color: '#10b981', flexShrink: 0, marginTop: '2px' }}>
                <Cookie size={22} />
              </div>
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Privacy & Cookie Preferences <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>DPDP Act 2023 Compliant</span>
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af', lineHeight: '1.5' }}>
                  SkandX uses essential session cookies for secure trading and live tick streams. Optional telemetry and performance trackers help us optimize sub-millisecond execution speeds. We never sell your personal data. Read our <a href="/privacy" style={{ color: '#10b981', textDecoration: 'underline' }}>Privacy Notice</a>.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', alignSelf: 'center' }}>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                style={{
                  padding: '9px 14px',
                  backgroundColor: 'transparent',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#d1d5db',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Settings size={14} /> Customize
              </button>
              <button
                type="button"
                onClick={handleRejectNonEssential}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Essential Only
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#10b981',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#000',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Granular Preference Customization Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 1000000,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <div style={{
            backgroundColor: '#111827',
            border: '1px solid #1f2937',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            color: '#f3f4f6'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={24} color="#10b981" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#fff' }}>Cookie Preferences</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: '1.6', marginBottom: '20px' }}>
              Manage your cookie and data preferences. Strictly essential cookies are required for trading security and cannot be disabled.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px' }}>
              {/* Essential */}
              <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid #1f2937', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>Strictly Necessary Cookies</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Authentication tokens, session validation, advisory lock state, and CSRF protection.</div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>ALWAYS ACTIVE</span>
              </div>

              {/* Performance & Telemetry */}
              <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid #1f2937', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, paddingRight: '16px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>Performance & Telemetry</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Measures WebSocket latency, API round-trip times, and chart render frame rates.</div>
                </div>
                <input
                  type="checkbox"
                  checked={analyticsConsent}
                  onChange={(e) => setAnalyticsConsent(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                />
              </div>

              {/* Marketing & Announcements */}
              <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid #1f2937', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, paddingRight: '16px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>Marketing & Product Updates</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Allows tailored market research reports, newsletter updates, and product announcements.</div>
                </div>
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={handleRejectNonEssential}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#d1d5db',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Reject Non-Essential
              </button>
              <button
                type="button"
                onClick={handleSaveCustom}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#10b981',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#000',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
