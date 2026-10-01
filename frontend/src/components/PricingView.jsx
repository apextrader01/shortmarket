import React, { useState, useEffect } from 'react';
import { useStore, API } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { Check, Star, Shield, Zap, ArrowLeft, X, Crown, Award } from 'lucide-react';

export default function PricingView({ setActiveTab }) {
  const { user } = useStore(useShallow(state => ({ user: state.user })));
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleUpgrade = async (plan) => {
    setLoading(plan);
    try {
      const res = await loadRazorpay();
      if (!res) {
        alert('Razorpay SDK failed to load. Are you online?');
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      const orderRes = await fetch(`${API}/api/payment/create-subscription`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create subscription');

      const planTitle = plan === 'highest' ? 'Feature Plan VIP' : plan === 'yearly' ? 'Yearly Elite' : 'Pro Monthly';

      const options = {
        key: orderData.key_id || 'rzp_test_placeholder',
        name: 'SkandX',
        description: `7-Day Free Trial (${planTitle})`,
        image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        subscription_id: orderData.subscription_id,
        handler: async function (response) {
          try {
            const verifyRes = await fetch(`${API}/api/payment/verify`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id || response.razorpay_subscription_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature,
                plan: plan
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              alert(`Upgraded to ${planTitle} successfully! Please log out and log back in to see changes.`);
              setActiveTab('ClientData');
            } else {
              alert('Payment verification failed. Please contact support.');
            }
          } catch (err) {
            alert('Error verifying payment: ' + err.message);
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || ''
        },
        theme: { color: plan === 'highest' ? '#8B5CF6' : '#3B82F6' }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        alert(response.error.description);
      });
      rzp.open();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const userTier = (user?.subscription_tier || 'BASIC').toUpperCase();
  const isExpired = user?.subscription_expires && new Date(user.subscription_expires).getTime() <= Date.now();
  const activeTier = isExpired ? 'BASIC' : userTier;

  const isHighest = ['HIGHEST', 'FEATURE', 'ELITE', 'VIP'].includes(activeTier);
  const isYearly = activeTier === 'YEARLY';
  const isMonthly = activeTier === 'MONTHLY' || activeTier === 'PRO';
  const isNormal = !isHighest && !isYearly && !isMonthly;

  return (
    <div style={{ padding: isMobile ? '12px 6px 60px 6px' : '20px 40px', maxWidth: '1360px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Back Button & Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: isMobile ? '12px' : '20px' }}>
        <div 
          onClick={() => setActiveTab('ClientData')} 
          style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.2s', border: '1px solid var(--border-color)' }}
          className="hoverable"
        >
          <ArrowLeft size={18} />
        </div>
      </div>
      
      <div style={{ textAlign: 'center', marginBottom: isMobile ? '24px' : '40px' }}>
        <h1 style={{ fontSize: isMobile ? '24px' : '40px', fontWeight: '900', marginBottom: '8px', background: 'linear-gradient(to right, #60A5FA, #A78BFA, #FBBF24)', WebkitBackgroundClip: 'text', color: 'transparent', letterSpacing: '-0.5px' }}>
          Choose Your Trading Edge
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '13px' : '16px', maxWidth: '640px', margin: '0 auto', lineHeight: '1.5' }}>
          Select the plan that matches your ambition. Unlock deeper analytics, expanded watchlists, and entry into exclusive platform trading tournaments.
        </p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))', 
        gap: isMobile ? '20px' : '24px', 
        alignItems: 'stretch' 
      }}>
        
        {/* 1. NORMAL / STARTER PLAN */}
        <div style={{ 
          background: 'linear-gradient(145deg, var(--bg-panel) 0%, rgba(255,255,255,0.02) 100%)', 
          border: isNormal ? '2px solid var(--border-color)' : '1px solid var(--border-color)', 
          borderRadius: isMobile ? '16px' : '22px', 
          padding: isMobile ? '24px 20px' : '36px 28px', 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%', 
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '10px' }}>
              <Shield size={20} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <h3 style={{ fontSize: isMobile ? '18px' : '21px', fontWeight: '800' }}>Normal</h3>
          </div>
          <div style={{ fontSize: isMobile ? '36px' : '44px', fontWeight: '900', marginBottom: '6px', display: 'flex', alignItems: 'baseline' }}>
            ₹0<span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>/forever</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px', lineHeight: '1.4' }}>
            Essential paper trading tools for market beginners.
          </p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0', display: 'flex', flexDirection: 'column', gap: '13px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}><Check size={17} style={{ color: '#10B981' }}/> 3 Watchlists (50 stocks/list)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}><Check size={17} style={{ color: '#10B981' }}/> Standard Order Types</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}><Check size={17} style={{ color: '#10B981' }}/> Portfolio & Ledger Tracking</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}><Check size={17} style={{ color: '#10B981' }}/> Open / Free Tournaments</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'var(--text-secondary)' }}><X size={17} style={{ opacity: 0.3 }}/> <s style={{ opacity: 0.6 }}>Advanced Option Chain</s></li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'var(--text-secondary)' }}><X size={17} style={{ opacity: 0.3 }}/> <s style={{ opacity: 0.6 }}>Pro Tournaments Entry</s></li>
          </ul>

          <button className="btn btn-secondary" style={{ width: '100%', padding: '12px', borderRadius: '8px', opacity: isNormal ? 1 : 0.6, cursor: 'default', fontWeight: '700', fontSize: '13px', border: isNormal ? '1px solid #10B981' : undefined, color: isNormal ? '#10B981' : undefined }} disabled>
            {isNormal ? '✓ Current Plan' : 'Free Tier'}
          </button>
        </div>

        {/* 2. PRO MONTHLY PLAN */}
        <div style={{ 
          background: 'linear-gradient(145deg, var(--bg-panel) 0%, rgba(59, 130, 246, 0.05) 100%)', 
          border: isMonthly ? '2px solid #3B82F6' : '1px solid rgba(59, 130, 246, 0.35)', 
          borderRadius: isMobile ? '16px' : '22px', 
          padding: isMobile ? '24px 20px' : '36px 28px', 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%', 
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '8px', borderRadius: '10px' }}>
              <Zap size={20} style={{ color: '#3B82F6' }} />
            </div>
            <h3 style={{ fontSize: isMobile ? '18px' : '21px', fontWeight: '800' }}>Monthly</h3>
          </div>
          
          <div style={{ fontSize: isMobile ? '36px' : '44px', fontWeight: '900', marginBottom: '6px', color: '#60A5FA', display: 'flex', alignItems: 'baseline' }}>
            ₹99
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>/mo</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px', lineHeight: '1.4' }}>
            Full Pro access with monthly flexibility and tournament eligibility.
          </p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0', display: 'flex', flexDirection: 'column', gap: '13px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}><Check size={17} style={{ color: '#3B82F6' }}/> 5 Watchlists</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}><Check size={17} style={{ color: '#3B82F6' }}/> Advanced Option Chain & Greeks</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}><Check size={17} style={{ color: '#3B82F6' }}/> Monthly+ Tournaments Eligible</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}><Check size={17} style={{ color: '#3B82F6' }}/> Real-time Depth & Heatmaps</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}><Check size={17} style={{ color: '#3B82F6' }}/> Standard Email Support</li>
          </ul>

          {isMonthly ? (
            <button className="btn" style={{ width: '100%', padding: '13px', background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '13px' }} disabled>
              ✓ Active Subscription
            </button>
          ) : (
            <button 
              className="btn hoverable" 
              style={{ width: '100%', padding: '13px', background: 'var(--color-blue)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
              onClick={() => handleUpgrade('monthly')}
              disabled={loading}
            >
              {loading === 'monthly' ? 'Processing...' : 'Upgrade Monthly'}
            </button>
          )}
        </div>

        {/* 3. YEARLY PRO PLAN (POPULAR) */}
        <div style={{ 
          background: 'linear-gradient(180deg, rgba(234, 179, 8, 0.08) 0%, var(--bg-card) 100%)', 
          border: isYearly ? '2px solid #10B981' : '2px solid #F59E0B', 
          borderRadius: isMobile ? '16px' : '22px', 
          padding: isMobile ? '28px 20px' : '38px 28px', 
          display: 'flex', 
          flexDirection: 'column', 
          position: 'relative', 
          boxShadow: '0 12px 32px rgba(245, 158, 11, 0.15)' 
        }}>
          <div style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg, #F59E0B, #FCD34D)', color: '#000', padding: '3px 14px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            <Star size={11} fill="#000" /> BEST VALUE - SAVE 58%
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '8px', borderRadius: '10px' }}>
              <Star size={20} style={{ color: '#F59E0B' }} fill="#F59E0B" />
            </div>
            <h3 style={{ fontSize: isMobile ? '18px' : '21px', fontWeight: '800' }}>Yearly</h3>
          </div>
          
          <div style={{ fontSize: isMobile ? '36px' : '44px', fontWeight: '900', marginBottom: '6px', color: '#FCD34D', display: 'flex', alignItems: 'baseline' }}>
            ₹499
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>/yr</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px', lineHeight: '1.4' }}>
            Our most popular tier. Full yearly access to standard & premium tournaments.
          </p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0', display: 'flex', flexDirection: 'column', gap: '13px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: '500' }}><Check size={17} style={{ color: '#F59E0B' }}/> 5 Watchlists</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: '500' }}><Check size={17} style={{ color: '#F59E0B' }}/> Advanced Option Chain & Greeks</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: '500' }}><Check size={17} style={{ color: '#F59E0B' }}/> Yearly+ & Monthly+ Tournaments</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: '500' }}><Check size={17} style={{ color: '#F59E0B' }}/> 24/7 Priority Support</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: '500' }}><Check size={17} style={{ color: '#F59E0B' }}/> Early Access to New Features</li>
          </ul>

          {isYearly ? (
            <button className="btn" style={{ width: '100%', padding: '13px', background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '13px' }} disabled>
              ✓ Active Subscription
            </button>
          ) : (
            <button 
              className="btn btn-primary hoverable" 
              style={{ width: '100%', padding: '13px', fontWeight: '800', background: 'linear-gradient(90deg, #F59E0B, #FCD34D)', color: 'black', border: 'none', borderRadius: '8px', fontSize: '13.5px', letterSpacing: '0.5px', boxShadow: '0 8px 20px rgba(245, 158, 11, 0.3)', cursor: 'pointer' }}
              onClick={() => handleUpgrade('yearly')}
              disabled={loading}
            >
              {loading === 'yearly' ? 'Processing...' : 'Start 7-Day Free Trial'}
            </button>
          )}
        </div>

        {/* 4. FEATURE PLAN / HIGHEST TIER (VIP EXCLUSIVE) */}
        <div style={{ 
          background: 'linear-gradient(180deg, rgba(168, 85, 247, 0.12) 0%, var(--bg-card) 100%)', 
          border: isHighest ? '2px solid #10B981' : '2px solid #A855F7', 
          borderRadius: isMobile ? '16px' : '22px', 
          padding: isMobile ? '28px 20px' : '38px 28px', 
          display: 'flex', 
          flexDirection: 'column', 
          position: 'relative', 
          boxShadow: '0 16px 40px rgba(168, 85, 247, 0.18)' 
        }}>
          <div style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg, #A855F7, #EC4899)', color: '#fff', padding: '3px 14px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 4px 12px rgba(168, 85, 247, 0.4)', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            <Crown size={12} fill="#fff" /> HIGHEST TIER - VIP
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(168, 85, 247, 0.18)', padding: '8px', borderRadius: '10px' }}>
              <Crown size={20} style={{ color: '#C084FC' }} />
            </div>
            <h3 style={{ fontSize: isMobile ? '18px' : '21px', fontWeight: '800' }}>Feature Plan</h3>
          </div>
          
          <div style={{ fontSize: isMobile ? '36px' : '44px', fontWeight: '900', marginBottom: '6px', color: '#C084FC', display: 'flex', alignItems: 'baseline' }}>
            ₹999
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>/yr</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px', lineHeight: '1.4' }}>
            The pinnacle platform experience. Everything unlocked + exclusive VIP leagues.
          </p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0', display: 'flex', flexDirection: 'column', gap: '13px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: '600', color: '#E9D5FF' }}><Award size={17} style={{ color: '#C084FC' }}/> 10 Watchlists (Max Capacity)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: '600', color: '#E9D5FF' }}><Crown size={17} style={{ color: '#C084FC' }}/> Feature Plan VIP Tournaments Exclusive</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: '600', color: '#E9D5FF' }}><Check size={17} style={{ color: '#C084FC' }}/> All Yearly & Monthly Tournaments Included</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: '600', color: '#E9D5FF' }}><Check size={17} style={{ color: '#C084FC' }}/> Algorithmic Signals & Indicator Alarms</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: '600', color: '#E9D5FF' }}><Check size={17} style={{ color: '#C084FC' }}/> Dedicated VIP Concierge & Support</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: '600', color: '#E9D5FF' }}><Check size={17} style={{ color: '#C084FC' }}/> Institutional Alpha Access</li>
          </ul>

          {isHighest ? (
            <button className="btn" style={{ width: '100%', padding: '13px', background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '13px' }} disabled>
              ✓ Active VIP Subscription
            </button>
          ) : (
            <button 
              className="btn btn-primary hoverable" 
              style={{ width: '100%', padding: '13px', fontWeight: '800', background: 'linear-gradient(90deg, #9333EA, #C084FC)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13.5px', letterSpacing: '0.5px', boxShadow: '0 8px 20px rgba(168, 85, 247, 0.35)', cursor: 'pointer' }}
              onClick={() => handleUpgrade('highest')}
              disabled={loading}
            >
              {loading === 'highest' ? 'Processing...' : 'Upgrade to Feature Plan'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
