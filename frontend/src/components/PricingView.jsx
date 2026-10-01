import React, { useState, useEffect } from 'react';
import { useStore, API } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { Check, Star, Shield, Zap, ArrowLeft, X, Crown, Award, Bell, RefreshCw, BarChart2, Layers, Cpu, CheckCircle2, Minus } from 'lucide-react';

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

  const comparisonRows = [
    { category: 'Watchlists & Marketwatch', items: [
      { name: 'Max Custom Watchlists', normal: '2 Watchlists', monthly: '3 Watchlists', yearly: '4 Watchlists', highest: '5 Watchlists (Max)' },
      { name: 'Symbols per Watchlist', normal: '30 symbols', monthly: '50 symbols', yearly: '75 symbols', highest: '100 symbols' },
      { name: 'Real-time WebSocket Data', normal: 'Standard (~1s)', monthly: 'High-speed (500ms)', yearly: 'Ultra-fast (200ms)', highest: 'Direct Tick Feed (<50ms)' }
    ]},
    { category: 'Order Execution & Risk Control', items: [
      { name: 'Daily Order Limits', normal: '20 Orders/day', monthly: '100 Orders/day', yearly: '500 Orders/day', highest: 'Unlimited Orders' },
      { name: 'Market Depth (Order Book)', normal: '5-Depth (Level 1)', monthly: '5-Depth (Level 1)', yearly: '20-Depth (Level 2)', highest: '20-Depth + DOM Ladder' },
      { name: 'Basket Orders (Multi-Leg)', normal: '—', monthly: 'Up to 5 legs', yearly: 'Up to 15 legs', highest: 'Unlimited legs + Batch execution' },
      { name: 'Portfolio Balance Resets', normal: '1 every 30 days', monthly: '3 resets / month', yearly: '10 resets / month', highest: 'Unlimited instant resets' }
    ]},
    { category: 'Derivatives & Options Suite', items: [
      { name: 'Option Chain Greeks (Δ, θ, γ, ν)', normal: '—', monthly: '✓ Included', yearly: '✓ Included', highest: '✓ Included' },
      { name: 'Multi-Strike OI & PCR Tracker', normal: '—', monthly: '—', yearly: '✓ Included', highest: '✓ Included' },
      { name: 'Options Strategy Builder & Payoff', normal: '—', monthly: '—', yearly: '—', highest: '✓ Full Interactive Suite' }
    ]},
    { category: 'Alerts & Intelligence', items: [
      { name: 'Active Price Alerts', normal: '3 Alerts', monthly: '10 Alerts', yearly: '25 Alerts', highest: 'Unlimited Alerts' },
      { name: 'Instant Push & Telegram Alerts', normal: '—', monthly: 'Web Push', yearly: 'Web Push + SMS', highest: 'Instant Push + Telegram VIP' },
      { name: 'Trading Journal & Audit', normal: 'Basic Ledger', monthly: 'Journal with Notes & Tags', yearly: 'Win-rate Heatmaps & Sharpe', highest: 'AI Trade Strategy Audit & Tax PDF' }
    ]},
    { category: 'Tournaments & Prestige', items: [
      { name: 'Tournament Eligibility', normal: 'Open Tournaments', monthly: 'Monthly+ & Open', yearly: 'Yearly+, Monthly+ & Open', highest: '👑 VIP Exclusives + All' },
      { name: 'Leaderboard Badge', normal: 'Starter', monthly: '⚡ PRO', yearly: '⭐ YEARLY', highest: '👑 VIP Gold Crown' },
      { name: 'Customer Support', normal: 'Community FAQ', monthly: 'Email Support', yearly: '24/7 Priority Support', highest: 'VIP Dedicated Concierge' }
    ]}
  ];

  return (
    <div style={{ padding: isMobile ? '12px 6px 60px 6px' : '24px 40px', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-primary)' }}>
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
      
      <div style={{ textAlign: 'center', marginBottom: isMobile ? '24px' : '36px' }}>
        <h1 style={{ fontSize: isMobile ? '24px' : '40px', fontWeight: '900', marginBottom: '8px', background: 'linear-gradient(to right, #60A5FA, #A78BFA, #FBBF24)', WebkitBackgroundClip: 'text', color: 'transparent', letterSpacing: '-0.5px' }}>
          Choose Your Trading Edge
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '13px' : '15px', maxWidth: '720px', margin: '0 auto', lineHeight: '1.5' }}>
          Compare our clear tier benefits. Gain higher order limits, deeper market visibility, advanced derivative toolsets, and VIP tournament prestige.
        </p>
      </div>

      {/* 4 Pricing Cards Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: isMobile ? '20px' : '22px', 
        alignItems: 'stretch',
        marginBottom: isMobile ? '40px' : '60px'
      }}>
        
        {/* 1. NORMAL / STARTER PLAN */}
        <div style={{ 
          background: 'linear-gradient(145deg, var(--bg-panel) 0%, rgba(255,255,255,0.02) 100%)', 
          border: isNormal ? '2px solid var(--border-color)' : '1px solid var(--border-color)', 
          borderRadius: isMobile ? '16px' : '22px', 
          padding: isMobile ? '24px 18px' : '32px 24px', 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%', 
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '10px' }}>
              <Shield size={20} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <h3 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800' }}>Normal</h3>
          </div>
          <div style={{ fontSize: isMobile ? '34px' : '40px', fontWeight: '900', marginBottom: '6px', display: 'flex', alignItems: 'baseline' }}>
            ₹0<span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>/forever</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '13px', lineHeight: '1.4' }}>
            Essential paper trading tools for market beginners and hobbyists.
          </p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '11px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#10B981', flexShrink: 0 }}/> <strong>2 Watchlists</strong> (30 symbols/list)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#10B981', flexShrink: 0 }}/> 20 Orders / day limit</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#10B981', flexShrink: 0 }}/> Standard 5-Depth Market Depth</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#10B981', flexShrink: 0 }}/> 3 Active Price Alerts</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#10B981', flexShrink: 0 }}/> 1 Portfolio Reset / month</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#10B981', flexShrink: 0 }}/> Open / Free Tournaments</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}><X size={16} style={{ opacity: 0.3, flexShrink: 0 }}/> <s style={{ opacity: 0.6 }}>Option Greeks & Multi-Strike OI</s></li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}><X size={16} style={{ opacity: 0.3, flexShrink: 0 }}/> <s style={{ opacity: 0.6 }}>Basket Orders & DOM Ladder</s></li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}><X size={16} style={{ opacity: 0.3, flexShrink: 0 }}/> <s style={{ opacity: 0.6 }}>VIP Exclusive Tournaments</s></li>
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
          padding: isMobile ? '24px 18px' : '32px 24px', 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%', 
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '8px', borderRadius: '10px' }}>
              <Zap size={20} style={{ color: '#3B82F6' }} />
            </div>
            <h3 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800' }}>Monthly</h3>
          </div>
          
          <div style={{ fontSize: isMobile ? '34px' : '40px', fontWeight: '900', marginBottom: '6px', color: '#60A5FA', display: 'flex', alignItems: 'baseline' }}>
            ₹199
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>/mo</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '13px', lineHeight: '1.4' }}>
            Active traders wanting monthly flexibility, Greeks, and tournament entries.
          </p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '11px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#3B82F6', flexShrink: 0 }}/> <strong>3 Watchlists</strong> (50 symbols/list)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#3B82F6', flexShrink: 0 }}/> 100 Orders / day limit</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#3B82F6', flexShrink: 0 }}/> Advanced Option Chain & Greeks</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#3B82F6', flexShrink: 0 }}/> 5-Leg Basket Orders</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#3B82F6', flexShrink: 0 }}/> 10 Active Price Alerts</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#3B82F6', flexShrink: 0 }}/> 3 Portfolio Resets / month</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#3B82F6', flexShrink: 0 }}/> Monthly+ & Open Tournaments</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#3B82F6', flexShrink: 0 }}/> Trading Journal with tags & notes</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#3B82F6', flexShrink: 0 }}/> Real-time 500ms Streaming</li>
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
          padding: isMobile ? '26px 18px' : '34px 24px', 
          display: 'flex', 
          flexDirection: 'column', 
          position: 'relative', 
          boxShadow: '0 12px 32px rgba(245, 158, 11, 0.15)' 
        }}>
          <div style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg, #F59E0B, #FCD34D)', color: '#000', padding: '3px 14px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            <Star size={11} fill="#000" /> BEST VALUE - SAVE 16%
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '8px', borderRadius: '10px' }}>
              <Star size={20} style={{ color: '#F59E0B' }} fill="#F59E0B" />
            </div>
            <h3 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800' }}>Yearly Elite</h3>
          </div>
          
          <div style={{ fontSize: isMobile ? '34px' : '40px', fontWeight: '900', marginBottom: '6px', color: '#FCD34D', display: 'flex', alignItems: 'baseline' }}>
            ₹1,999
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>/yr (~₹166/mo)</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '13px', lineHeight: '1.4' }}>
            Full annual pass for serious traders wanting deep order books and analytics.
          </p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '11px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> <strong>4 Watchlists</strong> (75 symbols/list)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> 500 Orders / day limit</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> Full 20-Depth Market Depth (Level 2)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> 15-Leg Basket Orders</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> 25 Active Price Alerts</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> 10 Portfolio Resets / month</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> Multi-Strike OI & PCR Tracker</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> Win-rate Heatmaps & Risk Metrics</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> Yearly+ & Monthly+ Tournaments</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> 24/7 Priority Support (&lt;200ms route)</li>
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
          padding: isMobile ? '26px 18px' : '34px 24px', 
          display: 'flex', 
          flexDirection: 'column', 
          position: 'relative', 
          boxShadow: '0 16px 40px rgba(168, 85, 247, 0.18)' 
        }}>
          <div style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg, #A855F7, #EC4899)', color: '#fff', padding: '3px 14px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 4px 12px rgba(168, 85, 247, 0.4)', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            <Crown size={12} fill="#fff" /> HIGHEST TIER - VIP
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ background: 'rgba(168, 85, 247, 0.18)', padding: '8px', borderRadius: '10px' }}>
              <Crown size={20} style={{ color: '#C084FC' }} />
            </div>
            <h3 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800' }}>Feature Plan</h3>
          </div>
          
          <div style={{ fontSize: isMobile ? '34px' : '40px', fontWeight: '900', marginBottom: '6px', color: '#C084FC', display: 'flex', alignItems: 'baseline' }}>
            ₹2,999
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>/yr (VIP Tier)</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '13px', lineHeight: '1.4' }}>
            The pinnacle platform experience. Everything unlocked + exclusive VIP leagues.
          </p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '11px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#E9D5FF' }}><Crown size={16} style={{ color: '#C084FC', flexShrink: 0 }}/> <strong>5 Watchlists</strong> (100 symbols/list - Max)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#E9D5FF' }}><Check size={16} style={{ color: '#C084FC', flexShrink: 0 }}/> Unlimited Orders / day (No limit)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#E9D5FF' }}><Check size={16} style={{ color: '#C084FC', flexShrink: 0 }}/> 20-Depth + Interactive DOM Ladder</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#E9D5FF' }}><Check size={16} style={{ color: '#C084FC', flexShrink: 0 }}/> Unlimited Multi-Leg Basket Orders</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#E9D5FF' }}><Check size={16} style={{ color: '#C084FC', flexShrink: 0 }}/> Unlimited Alerts + Instant Telegram VIP</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#E9D5FF' }}><Check size={16} style={{ color: '#C084FC', flexShrink: 0 }}/> Unlimited Instant Portfolio Resets</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#E9D5FF' }}><Check size={16} style={{ color: '#C084FC', flexShrink: 0 }}/> Options Strategy Builder & Payoff</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#E9D5FF' }}><Check size={16} style={{ color: '#C084FC', flexShrink: 0 }}/> AI Strategy Audit & Tax Statement PDF</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#E9D5FF' }}><Award size={16} style={{ color: '#C084FC', flexShrink: 0 }}/> 👑 VIP Tournaments Exclusive Entry</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#E9D5FF' }}><Check size={16} style={{ color: '#C084FC', flexShrink: 0 }}/> Dedicated VIP Support (&lt;50ms route)</li>
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

      {/* Feature Comparison Matrix Table */}
      <div style={{ 
        background: 'var(--bg-panel)', 
        border: '1px solid var(--border-color)', 
        borderRadius: isMobile ? '16px' : '22px', 
        padding: isMobile ? '20px 14px' : '36px 32px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.2)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h2 style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: '800', marginBottom: '6px' }}>
            Comprehensive Plan Comparison
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '12px' : '14px' }}>
            Transparent breakdown of features, limits, and capabilities across all 4 tiers.
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '700', width: '30%' }}>Features & Tools</th>
                <th style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '700', textAlign: 'center', width: '17%' }}>Normal (₹0)</th>
                <th style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '700', textAlign: 'center', width: '17%', color: '#60A5FA' }}>Monthly (₹199)</th>
                <th style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '700', textAlign: 'center', width: '18%', color: '#FCD34D' }}>Yearly (₹1,999)</th>
                <th style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '700', textAlign: 'center', width: '18%', color: '#C084FC' }}>Feature Plan (₹2,999)</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((cat, cIdx) => (
                <React.Fragment key={cIdx}>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <td colSpan={5} style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
                      {cat.category}
                    </td>
                  </tr>
                  {cat.items.map((item, iIdx) => (
                    <tr key={iIdx} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} className="hoverable">
                      <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600' }}>
                        {item.name}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '12.5px', textAlign: 'center', color: item.normal === '—' ? 'var(--text-secondary)' : undefined }}>
                        {item.normal}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '12.5px', textAlign: 'center', color: item.monthly === '—' ? 'var(--text-secondary)' : '#93C5FD' }}>
                        {item.monthly}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '12.5px', textAlign: 'center', fontWeight: '600', color: '#FDE047' }}>
                        {item.yearly}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '12.5px', textAlign: 'center', fontWeight: '700', color: '#E9D5FF' }}>
                        {item.highest}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
