import React, { useState, useEffect } from 'react';
import { useStore, API } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { Check, Star, Shield, Zap, ArrowLeft, X, Crown, Award, BookOpen, GraduationCap, FileText, Sparkles, Infinity as InfinityIcon } from 'lucide-react';

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
      const isAutoPayPlan = plan === 'monthly' || plan === 'yearly' || plan === 'highest';
      const endpoint = isAutoPayPlan ? `${API}/api/payment/create-subscription` : `${API}/api/payment/create-order`;

      const orderRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create payment order');

      const planTitles = {
        lifetime: 'Lifetime All-Inclusive Elite (₹24,999)',
        masterclass: 'Stock Market Masterclass: Basic to Advanced (₹9,999)',
        highest: 'Feature Plan VIP (₹2,999/yr AutoPay)',
        yearly: 'Yearly Elite (₹1,999/yr AutoPay)',
        monthly: 'Pro Monthly (₹199/mo AutoPay)'
      };
      const planTitle = planTitles[plan] || 'Pro Plan';

      const themeColors = {
        lifetime: '#E11D48',
        masterclass: '#0D9488',
        highest: '#8B5CF6',
        yearly: '#F59E0B',
        monthly: '#3B82F6'
      };

      let paymentCompleted = false;
      const reportPaymentStatus = async (status, reason, paymentId = null) => {
        try {
          await fetch(`${API}/api/payment/report-failure`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              razorpay_order_id: orderData.id || null,
              razorpay_subscription_id: orderData.subscription_id || null,
              razorpay_payment_id: paymentId,
              plan,
              status,
              failure_reason: reason
            })
          });
        } catch (_) {}
      };

      const options = {
        key: orderData.key_id,
        name: 'SkandX',
        description: `Subscribe to ${planTitle}`,
        image: 'https://skandx.in/skandx-playstore-icon.png',
        handler: async function (response) {
          paymentCompleted = true;
          try {
            const verifyPayload = {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: plan
            };
            if (response.razorpay_subscription_id || orderData.subscription_id) {
              verifyPayload.razorpay_subscription_id = response.razorpay_subscription_id || orderData.subscription_id;
            } else {
              verifyPayload.razorpay_order_id = response.razorpay_order_id || orderData.id;
            }

            const verifyRes = await fetch(`${API}/api/payment/verify`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(verifyPayload)
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              alert(`🎉 Successfully activated ${planTitle}! Your AutoPay subscription is now active.`);
              if (typeof setActiveTab === 'function') setActiveTab('ClientData');
              else window.location.href = '/clientdata';
            } else {
              alert('Payment verification failed: ' + (verifyData.error || 'Please contact support.'));
            }
          } catch (err) {
            alert('Error verifying payment: ' + err.message);
          }
        },
        modal: {
          ondismiss: function () {
            if (!paymentCompleted) {
              reportPaymentStatus('CANCELLED', 'User closed Razorpay checkout window before completing payment');
            }
          }
        },
        prefill: {
          name: user?.name || user?.username || '',
          email: user?.email || '',
          contact: user?.phone || ''
        },
        theme: { color: themeColors[plan] || '#3B82F6' }
      };

      // AutoPay subscriptions pass subscription_id; one-time orders pass order_id + amount
      if (orderData.subscription_id) {
        options.subscription_id = orderData.subscription_id;
      } else {
        options.order_id = orderData.id;
        options.amount = orderData.amount;
        options.currency = orderData.currency || 'INR';
      }

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        const errObj = response?.error || {};
        const reasonParts = [
          errObj.description,
          errObj.reason ? `Reason: ${errObj.reason}` : null,
          errObj.step ? `Step: ${errObj.step}` : null
        ].filter(Boolean);
        const failMsg = reasonParts.join(' | ') || 'Payment failed at gateway';
        reportPaymentStatus('FAILED', failMsg, errObj.metadata?.payment_id || null);
        alert(errObj.description || 'Payment cancelled or failed');
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

  const isLifetime = activeTier === 'LIFETIME';
  const isMasterclass = activeTier === 'MASTERCLASS';
  const isHighest = ['HIGHEST', 'FEATURE', 'ELITE', 'VIP'].includes(activeTier);
  const isYearly = activeTier === 'YEARLY';
  const isMonthly = activeTier === 'MONTHLY' || activeTier === 'PRO';
  const isNormal = !isLifetime && !isMasterclass && !isHighest && !isYearly && !isMonthly;

  const comparisonRows = [
    { category: 'Watchlists & Marketwatch', items: [
      { name: 'Max Custom Watchlists', normal: '2 Watchlists', monthly: '4 Watchlists', yearly: '4 Watchlists', highest: '5 Watchlists (Max)', masterclass: '2 Watchlists (Free Tier)', lifetime: '4 Watchlists (Forever)' },
      { name: 'Symbols per Watchlist', normal: '30 symbols', monthly: '75 symbols', yearly: '75 symbols', highest: '100 symbols (Max)', masterclass: '30 symbols (Free Tier)', lifetime: '75 symbols' },
      { name: 'Real-time WebSocket Streaming', normal: 'Standard (~1s)', monthly: 'High-speed (<200ms)', yearly: 'High-speed (<200ms)', highest: 'Direct Tick Feed (<50ms)', masterclass: 'Standard (~1s)', lifetime: 'High-speed (<200ms)' }
    ]},
    { category: 'Order Execution & Risk Control', items: [
      { name: 'Daily Order Limits', normal: '25 Trades / mo (Cash)', monthly: '500 Orders / day', yearly: '500 Orders / day', highest: 'Unlimited Orders / day', masterclass: '25 Trades / mo (Cash)', lifetime: '500 Orders / day (Forever)' },
      { name: 'Index Buying (Nifty/BankNifty)', normal: '—', monthly: '✓ Allowed', yearly: '✓ Allowed', highest: '✓ Allowed', masterclass: '— (Sub Required)', lifetime: '✓ Allowed (Forever)' },
      { name: 'Market Depth (Order Book)', normal: '5-Depth (Level 1)', monthly: '20-Depth (Level 2)', yearly: '20-Depth (Level 2)', highest: '20-Depth (Level 2)', masterclass: '5-Depth (Level 1)', lifetime: '20-Depth (Level 2)' },
      { name: 'Basket Orders (Multi-Leg)', normal: '—', monthly: 'Up to 15 legs', yearly: 'Up to 15 legs', highest: 'Unlimited legs', masterclass: '—', lifetime: 'Up to 15 legs' },
      { name: 'Portfolio Balance Resets', normal: '1 every 30 days', monthly: '10 resets / month', yearly: '10 resets / month', highest: 'Unlimited instant resets', masterclass: '1 every 30 days', lifetime: '10 resets / month (Forever)' }
    ]},
    { category: 'Mentorship, Education & Research Reports', items: [
      { name: 'Daily Pre-Market Report', normal: '—', monthly: '✓ Daily Morning Outlook', yearly: '✓ Daily Morning Outlook', highest: '✓ Priority Outlook & Levels', masterclass: '—', lifetime: '✓ Daily Morning Outlook (Forever)' },
      { name: 'Live Classes by NISM Mentor', normal: '—', monthly: '—', yearly: '—', highest: 'Webinars (Basics to Adv)', masterclass: '✓ Full Live Batches (NISM Mentor)', lifetime: '✓ Full Live Batches (NISM Mentor)' },
      { name: 'Mentor Guidance & Doubts', normal: '—', monthly: '—', yearly: '—', highest: 'Group Doubts', masterclass: '✓ Direct Q&A with NISM Mentor', lifetime: '✓ Direct Q&A + 1-on-1 Mentor Calls' },
      { name: 'Study Materials & Recording Vault', normal: '—', monthly: '—', yearly: '—', highest: '—', masterclass: '✓ Full Vault & NISM Prep Notes', lifetime: '✓ Full Vault & NISM Prep Notes' }
    ]},
    { category: 'Alerts & Intelligence', items: [
      { name: 'Active Price Alerts', normal: '3 Alerts', monthly: '25 Alerts', yearly: '25 Alerts', highest: 'Unlimited Alerts', masterclass: '3 Alerts', lifetime: '25 Alerts (Forever)' },
      { name: 'Instant Push & Telegram Alerts', normal: '—', monthly: 'Web Push + SMS', yearly: 'Web Push + SMS', highest: 'Instant Push + Telegram VIP', masterclass: '—', lifetime: 'Web Push + SMS' },
      { name: 'Trading Journal & Audit', normal: 'Basic Ledger', monthly: 'Win-rate Heatmaps & Tags', yearly: 'Win-rate Heatmaps & Tags', highest: 'AI Trade Strategy Audit', masterclass: 'Basic Ledger', lifetime: 'Win-rate Heatmaps & Tags' }
    ]},
    { category: 'Validity, Prestige & Support', items: [
      { name: 'Platform Trading Access Duration', normal: 'Free Tier', monthly: '30 Days (AutoPay)', yearly: '365 Days (AutoPay)', highest: '365 Days (AutoPay)', masterclass: 'Standard Free Tier (No Sub)', lifetime: '👑 Permanent Lifetime (Never Expires)' },
      { name: 'Masterclass Coaching Access', normal: '—', monthly: '—', yearly: '—', highest: '—', masterclass: '✓ Full 1-Year Batches & Vault', lifetime: '✓ All Batches & Lifetime Vault' },
      { name: 'Tournament Eligibility', normal: 'Open Tournaments', monthly: 'Yearly+, Monthly+ & Open', yearly: 'Yearly+, Monthly+ & Open', highest: '👑 VIP Exclusives + All', masterclass: 'Open Tournaments', lifetime: '👑 Yearly+, Monthly+ & Open (Forever)' },
      { name: 'Leaderboard Badge', normal: 'Starter', monthly: '⚡ PRO', yearly: '⭐ YEARLY', highest: '👑 VIP Gold Crown', masterclass: '🎓 MASTERCLASS SCHOLAR', lifetime: '👑 LIFETIME ELITE' },
      { name: 'Customer Support', normal: 'Community FAQ', monthly: '24/7 Priority Support', yearly: '24/7 Priority Support', highest: 'VIP Dedicated Concierge', masterclass: 'Mentor Batch Hotline', lifetime: 'Dedicated 1-on-1 VIP Concierge' }
    ]}
  ];

  return (
    <div style={{ padding: isMobile ? '12px 6px 60px 6px' : '24px 40px', maxWidth: '1440px', margin: '0 auto', color: 'var(--text-primary)' }}>
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
        <h1 style={{ fontSize: isMobile ? '24px' : '40px', fontWeight: '900', marginBottom: '8px', background: 'linear-gradient(to right, #60A5FA, #A78BFA, #FBBF24, #FB7185)', WebkitBackgroundClip: 'text', color: 'transparent', letterSpacing: '-0.5px' }}>
          Choose Your Trading Edge
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '13px' : '15px', maxWidth: '780px', margin: '0 auto', lineHeight: '1.5' }}>
          Select the plan that matches your goals. Direct one-time payment with instant activation — zero trial delays, zero recurring mandates.
        </p>
      </div>

      {/* 6 Pricing Cards Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(290px, 1fr))', 
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
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#34D399', fontWeight: '600' }}><Check size={16} style={{ color: '#10B981', flexShrink: 0 }}/> <strong>25 Trades / month</strong> (25 Buy + 25 Sell)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#10B981', flexShrink: 0 }}/> Standard 5-Depth Market Depth</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#10B981', flexShrink: 0 }}/> 3 Active Price Alerts</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#10B981', flexShrink: 0 }}/> 1 Portfolio Reset / month</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#10B981', flexShrink: 0 }}/> Open / Free Tournaments</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}><X size={16} style={{ opacity: 0.3, flexShrink: 0 }}/> <s style={{ opacity: 0.6 }}>Daily Pre-Market Report</s></li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}><X size={16} style={{ opacity: 0.3, flexShrink: 0 }}/> <s style={{ opacity: 0.6 }}>Live Classes by NISM Mentor</s></li>
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
            Full Pro trading terminal access with monthly flexibility — same powerful features as Yearly Elite.
          </p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '11px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#93C5FD' }}><FileText size={16} style={{ color: '#3B82F6', flexShrink: 0 }}/> <strong>Daily Pre-Market Report</strong> (Key Levels)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#3B82F6', flexShrink: 0 }}/> <strong>4 Watchlists</strong> (75 symbols/list)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#3B82F6', flexShrink: 0 }}/> 500 Orders / day limit</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#3B82F6', flexShrink: 0 }}/> Full 20-Depth Market Depth (Level 2)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#3B82F6', flexShrink: 0 }}/> 15-Leg Basket Orders</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#3B82F6', flexShrink: 0 }}/> 25 Active Price Alerts</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#3B82F6', flexShrink: 0 }}/> 10 Portfolio Resets / month</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#3B82F6', flexShrink: 0 }}/> Yearly+ & Monthly+ Tournaments</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#3B82F6', flexShrink: 0 }}/> 24/7 Priority Support (&lt;200ms route)</li>
          </ul>

          {isMonthly ? (
            <button className="btn" style={{ width: '100%', padding: '13px', background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '13px' }} disabled>
              ✓ Active Plan
            </button>
          ) : (
            <button 
              className="btn hoverable" 
              style={{ width: '100%', padding: '13px', background: 'var(--color-blue)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
              onClick={() => handleUpgrade('monthly')}
              disabled={loading}
            >
              {loading === 'monthly' ? 'Processing...' : 'Upgrade Monthly (₹199)'}
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
            <Star size={11} fill="#000" /> BEST VALUE - SAVE 16% (ANNUAL PASS)
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
            Full annual pass with all Pro trading features — same powerful tools as Monthly with discounted annual billing.
          </p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '11px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#FDE047' }}><FileText size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> <strong>Daily Pre-Market Report</strong> (Key Levels)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> <strong>4 Watchlists</strong> (75 symbols/list)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> 500 Orders / day limit</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> Full 20-Depth Market Depth (Level 2)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> 15-Leg Basket Orders</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> 25 Active Price Alerts</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> 10 Portfolio Resets / month</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> Yearly+ & Monthly+ Tournaments</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}><Check size={16} style={{ color: '#F59E0B', flexShrink: 0 }}/> 24/7 Priority Support (&lt;200ms route)</li>
          </ul>

          {isYearly ? (
            <button className="btn" style={{ width: '100%', padding: '13px', background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '13px' }} disabled>
              ✓ Active Plan
            </button>
          ) : (
            <button 
              className="btn btn-primary hoverable" 
              style={{ width: '100%', padding: '13px', fontWeight: '800', background: 'linear-gradient(90deg, #F59E0B, #FCD34D)', color: 'black', border: 'none', borderRadius: '8px', fontSize: '13.5px', letterSpacing: '0.5px', boxShadow: '0 8px 20px rgba(245, 158, 11, 0.3)', cursor: 'pointer' }}
              onClick={() => handleUpgrade('yearly')}
              disabled={loading}
            >
              {loading === 'yearly' ? 'Processing...' : 'Upgrade Yearly (₹1,999)'}
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
            <Crown size={12} fill="#fff" /> VIP PLATFORM - MAXIMUM FEATURES
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ background: 'rgba(168, 85, 247, 0.18)', padding: '8px', borderRadius: '10px' }}>
              <Crown size={20} style={{ color: '#C084FC' }} />
            </div>
            <h3 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800' }}>Feature Plan VIP</h3>
          </div>
          
          <div style={{ fontSize: isMobile ? '34px' : '40px', fontWeight: '900', marginBottom: '6px', color: '#C084FC', display: 'flex', alignItems: 'baseline' }}>
            ₹2,999
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>/yr (VIP Tier)</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '13px', lineHeight: '1.4' }}>
            The pinnacle platform experience with maximum features, priority data, webinars & VIP tournaments.
          </p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '11px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '700', color: '#FDE047' }}><GraduationCap size={16} style={{ color: '#FCD34D', flexShrink: 0 }}/> <strong>Webinar Sessions</strong> (Basics to Adv)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '700', color: '#FDE047' }}><Award size={16} style={{ color: '#FCD34D', flexShrink: 0 }}/> <strong>Doubt Clearing by NISM-Certified Mentor</strong></li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#E9D5FF' }}><FileText size={16} style={{ color: '#C084FC', flexShrink: 0 }}/> <strong>Daily Pre-Market Report</strong> (Priority Levels)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#E9D5FF' }}><Crown size={16} style={{ color: '#C084FC', flexShrink: 0 }}/> <strong>5 Watchlists</strong> (100 symbols/list - Maximum)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#E9D5FF' }}><Check size={16} style={{ color: '#C084FC', flexShrink: 0 }}/> Unlimited Orders / day (No limit)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#E9D5FF' }}><Check size={16} style={{ color: '#C084FC', flexShrink: 0 }}/> Full 20-Depth Market Depth (Level 2)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#E9D5FF' }}><Check size={16} style={{ color: '#C084FC', flexShrink: 0 }}/> Unlimited Multi-Leg Basket Orders</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#E9D5FF' }}><Check size={16} style={{ color: '#C084FC', flexShrink: 0 }}/> Unlimited Alerts + Instant Telegram VIP</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#E9D5FF' }}><Check size={16} style={{ color: '#C084FC', flexShrink: 0 }}/> Unlimited Instant Portfolio Resets</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: '#E9D5FF' }}><Award size={16} style={{ color: '#C084FC', flexShrink: 0 }}/> 👑 VIP Tournaments Exclusive Entry</li>
          </ul>

          {isHighest ? (
            <button className="btn" style={{ width: '100%', padding: '13px', background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '13px' }} disabled>
              ✓ Active VIP Plan
            </button>
          ) : (
            <button 
              className="btn btn-primary hoverable" 
              style={{ width: '100%', padding: '13px', fontWeight: '800', background: 'linear-gradient(90deg, #9333EA, #C084FC)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13.5px', letterSpacing: '0.5px', boxShadow: '0 8px 20px rgba(168, 85, 247, 0.35)', cursor: 'pointer' }}
              onClick={() => handleUpgrade('highest')}
              disabled={loading}
            >
              {loading === 'highest' ? 'Processing...' : 'Upgrade VIP (₹2,999)'}
            </button>
          )}
        </div>

        {/* 5. STOCK MARKET MASTERCLASS (₹9,999) */}
        <div style={{ 
          background: 'linear-gradient(180deg, rgba(13, 148, 136, 0.12) 0%, var(--bg-card) 100%)', 
          border: isMasterclass ? '2px solid #10B981' : '2px solid #0D9488', 
          borderRadius: isMobile ? '16px' : '22px', 
          padding: isMobile ? '26px 18px' : '34px 24px', 
          display: 'flex', 
          flexDirection: 'column', 
          position: 'relative', 
          boxShadow: '0 16px 40px rgba(13, 148, 136, 0.2)' 
        }}>
          <div style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg, #0D9488, #10B981)', color: '#fff', padding: '3px 14px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 4px 12px rgba(13, 148, 136, 0.4)', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            <GraduationCap size={12} fill="#fff" /> LIVE CLASS ORIENTATION - NISM CERTIFIED MENTOR
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ background: 'rgba(13, 148, 136, 0.18)', padding: '8px', borderRadius: '10px' }}>
              <BookOpen size={20} style={{ color: '#2DD4BF' }} />
            </div>
            <h3 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800' }}>Masterclass</h3>
          </div>
          
          <div style={{ fontSize: isMobile ? '34px' : '40px', fontWeight: '900', marginBottom: '6px', color: '#2DD4BF', display: 'flex', alignItems: 'baseline' }}>
            ₹9,999
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>/one-time (Full Batch)</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '13px', lineHeight: '1.4' }}>
            Purely a comprehensive live class orientation & mentorship course conducted by NISM Certified Mentor. Focused entirely on real-market education (No platform trading subscription included — standard free-tier paper trading applies).
          </p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '11px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '700', color: '#5EEAD4' }}><Check size={16} style={{ color: '#2DD4BF', flexShrink: 0 }}/> <strong>Full Course: Basics to Advanced</strong></li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '700', color: '#5EEAD4' }}><Check size={16} style={{ color: '#2DD4BF', flexShrink: 0 }}/> <strong>Live Interactive Batches</strong> by NISM Certified Mentor</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '700', color: '#5EEAD4' }}><Check size={16} style={{ color: '#2DD4BF', flexShrink: 0 }}/> <strong>Live Doubt Clearing Sessions</strong> directly with Mentor</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '700', color: '#5EEAD4' }}><Check size={16} style={{ color: '#2DD4BF', flexShrink: 0 }}/> <strong>Options Hedging & Greek Strategies</strong></li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#2DD4BF', flexShrink: 0 }}/> Technical Analysis & Price Action Mastery</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#2DD4BF', flexShrink: 0 }}/> Risk Management & Trading Psychology</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#2DD4BF', flexShrink: 0 }}/> Lifetime Recording Vault & Study Materials</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#2DD4BF', flexShrink: 0 }}/> NISM Certification Guidance & Exam Prep</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#2DD4BF', flexShrink: 0 }}/> Course Completion Certificate signed by Mentor</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#2DD4BF', flexShrink: 0 }}/> 🎓 Masterclass Scholar Leaderboard Badge</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}><Check size={16} style={{ color: '#94A3B8', flexShrink: 0 }}/> <em>Paper Trading: Free Tier (2 lists, 25 trades/mo)</em></li>
          </ul>

          {isMasterclass ? (
            <button className="btn" style={{ width: '100%', padding: '13px', background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '13px' }} disabled>
              ✓ Active Masterclass
            </button>
          ) : (
            <button 
              className="btn btn-primary hoverable" 
              style={{ width: '100%', padding: '13px', fontWeight: '800', background: 'linear-gradient(90deg, #0D9488, #14B8A6)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13.5px', letterSpacing: '0.5px', boxShadow: '0 8px 20px rgba(13, 148, 136, 0.35)', cursor: 'pointer' }}
              onClick={() => handleUpgrade('masterclass')}
              disabled={loading}
            >
              {loading === 'masterclass' ? 'Processing...' : 'Join Masterclass (₹9,999)'}
            </button>
          )}
        </div>

        {/* 6. LIFETIME ALL-INCLUSIVE ELITE (₹24,999) */}
        <div style={{ 
          background: 'linear-gradient(180deg, rgba(225, 29, 72, 0.12) 0%, var(--bg-card) 100%)', 
          border: isLifetime ? '2px solid #10B981' : '2px solid #E11D48', 
          borderRadius: isMobile ? '16px' : '22px', 
          padding: isMobile ? '26px 18px' : '34px 24px', 
          display: 'flex', 
          flexDirection: 'column', 
          position: 'relative', 
          boxShadow: '0 20px 48px rgba(225, 29, 72, 0.25)' 
        }}>
          <div style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg, #E11D48, #F59E0B)', color: '#fff', padding: '3px 14px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 4px 12px rgba(225, 29, 72, 0.4)', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            <Crown size={12} fill="#fff" /> ALL-INCLUSIVE - LIFETIME ACCESS
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ background: 'rgba(225, 29, 72, 0.18)', padding: '8px', borderRadius: '10px' }}>
              <Sparkles size={20} style={{ color: '#FB7185' }} />
            </div>
            <h3 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800' }}>Lifetime Elite</h3>
          </div>
          
          <div style={{ fontSize: isMobile ? '34px' : '40px', fontWeight: '900', marginBottom: '6px', color: '#FB7185', display: 'flex', alignItems: 'baseline' }}>
            ₹24,999
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>/lifetime (Zero Renewals)</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '13px', lineHeight: '1.4' }}>
            The definitive all-in-one pass. Permanent lifetime access to all Yearly Plan trading features (never expires, zero renewals) PLUS the complete Stock Market Masterclass live coaching included!
          </p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '11px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '800', color: '#FECDD3' }}><Crown size={16} style={{ color: '#FB7185', flexShrink: 0 }}/> <strong>YEARLY PLAN TRADING FEATURES FOR LIFETIME</strong></li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '700', color: '#FECDD3' }}><Check size={16} style={{ color: '#FB7185', flexShrink: 0 }}/> <strong>4 Watchlists & 75 Symbols/list Permanently</strong></li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '700', color: '#FECDD3' }}><Check size={16} style={{ color: '#FB7185', flexShrink: 0 }}/> <strong>500 Orders / day + Index Buying Allowed Forever</strong></li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '700', color: '#FECDD3' }}><Check size={16} style={{ color: '#FB7185', flexShrink: 0 }}/> <strong>Full 20-Depth Market Depth & 15-Leg Basket Orders</strong></li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '700', color: '#FECDD3' }}><Check size={16} style={{ color: '#FB7185', flexShrink: 0 }}/> <strong>FULL STOCK MARKET MASTERCLASS INCLUDED</strong></li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#FB7185', flexShrink: 0 }}/> Live Classes & Doubt Sessions by NISM Mentor</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#FB7185', flexShrink: 0 }}/> Lifetime Recording Vault & Study Notes</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#FB7185', flexShrink: 0 }}/> 1-on-1 Personal Mentorship & Portfolio Reviews</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#FB7185', flexShrink: 0 }}/> Daily Pre-Market Reports & 25 Price Alerts (Lifetime)</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#FB7185', flexShrink: 0 }}/> Yearly+ & Monthly+ Tournaments Forever</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Check size={16} style={{ color: '#FB7185', flexShrink: 0 }}/> Dedicated 24/7 VIP Concierge Support</li>
          </ul>

          {isLifetime ? (
            <button className="btn" style={{ width: '100%', padding: '13px', background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '13px' }} disabled>
              ✓ Active Lifetime Elite
            </button>
          ) : (
            <button 
              className="btn btn-primary hoverable" 
              style={{ width: '100%', padding: '13px', fontWeight: '800', background: 'linear-gradient(90deg, #E11D48, #F59E0B)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13.5px', letterSpacing: '0.5px', boxShadow: '0 8px 24px rgba(225, 29, 72, 0.4)', cursor: 'pointer' }}
              onClick={() => handleUpgrade('lifetime')}
              disabled={loading}
            >
              {loading === 'lifetime' ? 'Processing...' : 'Get Lifetime Access (₹24,999)'}
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
            Transparent breakdown of features, mentorship, research, and limits across all tiers.
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '14px 16px', fontSize: '13.5px', fontWeight: '700', width: '22%' }}>Features & Tools</th>
                <th style={{ padding: '14px 16px', fontSize: '13.5px', fontWeight: '700', textAlign: 'center', width: '13%' }}>Normal (₹0)</th>
                <th style={{ padding: '14px 16px', fontSize: '13.5px', fontWeight: '700', textAlign: 'center', width: '13%', color: '#60A5FA' }}>Monthly (₹199)</th>
                <th style={{ padding: '14px 16px', fontSize: '13.5px', fontWeight: '700', textAlign: 'center', width: '13%', color: '#FCD34D' }}>Yearly (₹1,999)</th>
                <th style={{ padding: '14px 16px', fontSize: '13.5px', fontWeight: '700', textAlign: 'center', width: '13%', color: '#C084FC' }}>VIP (₹2,999)</th>
                <th style={{ padding: '14px 16px', fontSize: '13.5px', fontWeight: '700', textAlign: 'center', width: '13%', color: '#2DD4BF' }}>Masterclass (₹9,999)</th>
                <th style={{ padding: '14px 16px', fontSize: '13.5px', fontWeight: '700', textAlign: 'center', width: '13%', color: '#FB7185' }}>Lifetime (₹24,999)</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((cat, cIdx) => (
                <React.Fragment key={cIdx}>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <td colSpan={7} style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
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
                      <td style={{ padding: '14px 16px', fontSize: '12.5px', textAlign: 'center', fontWeight: '700', color: '#5EEAD4' }}>
                        {item.masterclass}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '12.5px', textAlign: 'center', fontWeight: '800', color: '#FECDD3' }}>
                        {item.lifetime}
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
