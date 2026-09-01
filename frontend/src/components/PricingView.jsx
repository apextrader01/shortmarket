import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { Check, Star, Shield, Zap, ArrowLeft, X } from 'lucide-react';

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
      const orderRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/payment/create-subscription`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create subscription');

      const options = {
        key: orderData.key_id || 'rzp_test_placeholder',
        name: 'Short Edge',
        description: `7-Day Free Trial (${plan})`,
        image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        subscription_id: orderData.subscription_id,
        handler: async function (response) {
          try {
            const verifyRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/payment/verify`, {
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
              alert('Upgraded to PRO successfully! Please log out and log back in to see changes.');
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
        theme: { color: '#3B82F6' }
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

  const isPro = user?.subscription_tier === 'PRO';

  return (
    <div style={{ padding: isMobile ? '12px 6px 60px 6px' : '20px 40px', maxWidth: '1200px', margin: '0 auto', color: 'var(--text-primary)' }}>
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
        <h1 style={{ fontSize: isMobile ? '24px' : '42px', fontWeight: '900', marginBottom: '8px', background: 'linear-gradient(to right, #60A5FA, #A78BFA, #F472B6)', WebkitBackgroundClip: 'text', color: 'transparent', letterSpacing: '-0.5px' }}>
          Trade Like a Professional
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '13px' : '16px', maxWidth: '600px', margin: '0 auto', lineHeight: '1.5' }}>
          Unlock advanced analytics, increased watchlists, and premium features. Start with a 7-day risk-free trial today!
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', gap: isMobile ? '20px' : '30px', alignItems: 'center' }}>
        
        {/* BASIC PLAN */}
        <div style={{ background: 'linear-gradient(145deg, var(--bg-panel) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid var(--border-color)', borderRadius: isMobile ? '16px' : '24px', padding: isMobile ? '24px 20px' : '40px 32px', display: 'flex', flexDirection: 'column', height: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '10px' }}>
              <Shield size={20} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <h3 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800' }}>Starter</h3>
          </div>
          <div style={{ fontSize: isMobile ? '36px' : '48px', fontWeight: '900', marginBottom: '6px', display: 'flex', alignItems: 'baseline' }}>
            ₹0<span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>/forever</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px', lineHeight: '1.4' }}>Perfect for beginners exploring the markets.</p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}><Check size={18} style={{ color: '#10B981' }}/> 3 Watchlists</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}><Check size={18} style={{ color: '#10B981' }}/> Basic Order Placement</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}><Check size={18} style={{ color: '#10B981' }}/> Portfolio Tracking</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text-secondary)' }}><X size={18} style={{ opacity: 0.3 }}/> <s style={{ opacity: 0.6 }}>Advanced Charts</s></li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text-secondary)' }}><X size={18} style={{ opacity: 0.3 }}/> <s style={{ opacity: 0.6 }}>Premium Support</s></li>
          </ul>

          <button className="btn btn-secondary" style={{ width: '100%', padding: '12px', borderRadius: '8px', opacity: 0.6, cursor: 'not-allowed', fontWeight: '700', fontSize: '13px' }} disabled>
            Current Plan
          </button>
        </div>

        {/* YEARLY PRO PLAN (CENTER, HIGHLIGHTED) */}
        <div style={{ background: 'linear-gradient(180deg, rgba(234, 179, 8, 0.1) 0%, var(--bg-card) 100%)', border: '2px solid #F59E0B', borderRadius: isMobile ? '16px' : '24px', padding: isMobile ? '28px 20px' : '48px 32px', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 20px 40px rgba(245, 158, 11, 0.15)', transform: isMobile ? 'none' : 'scale(1.05)', zIndex: 10 }}>
          <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg, #F59E0B, #FCD34D)', color: '#000', padding: '4px 16px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            <Star size={12} fill="#000" /> BEST VALUE - SAVE 58%
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '8px', borderRadius: '10px' }}>
              <Star size={20} style={{ color: '#F59E0B' }} fill="#F59E0B" />
            </div>
            <h3 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800' }}>Yearly Elite</h3>
          </div>
          
          <div style={{ fontSize: isMobile ? '40px' : '56px', fontWeight: '900', marginBottom: '6px', color: '#FCD34D', display: 'flex', alignItems: 'baseline' }}>
            ₹499
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>/yr</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px', lineHeight: '1.4' }}>Massive savings. The ultimate trading experience with everything unlocked.</p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '500' }}><Check size={18} style={{ color: '#F59E0B' }}/> Unlimited Watchlists</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '500' }}><Check size={18} style={{ color: '#F59E0B' }}/> Advanced Option Chain</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '500' }}><Check size={18} style={{ color: '#F59E0B' }}/> Advanced Analytics & Heatmaps</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '500' }}><Check size={18} style={{ color: '#F59E0B' }}/> 24/7 Priority Support</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '500' }}><Check size={18} style={{ color: '#F59E0B' }}/> Early Access to New Features</li>
          </ul>

          {isPro ? (
            <button className="btn" style={{ width: '100%', padding: '14px', background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '14px' }} disabled>
              Active Subscription
            </button>
          ) : (
            <button 
              className="btn btn-primary hoverable" 
              style={{ width: '100%', padding: '14px', fontWeight: '800', background: 'linear-gradient(90deg, #F59E0B, #FCD34D)', color: 'black', border: 'none', borderRadius: '8px', fontSize: '14px', letterSpacing: '0.5px', boxShadow: '0 8px 20px rgba(245, 158, 11, 0.3)' }}
              onClick={() => handleUpgrade('yearly')}
              disabled={loading}
            >
              {loading === 'yearly' ? 'Processing...' : 'Start 7-Day Free Trial'}
            </button>
          )}
        </div>

        {/* MONTHLY PRO PLAN */}
        <div style={{ background: 'linear-gradient(145deg, var(--bg-panel) 0%, rgba(59, 130, 246, 0.05) 100%)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: isMobile ? '16px' : '24px', padding: isMobile ? '24px 20px' : '40px 32px', display: 'flex', flexDirection: 'column', height: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '8px', borderRadius: '10px' }}>
              <Zap size={20} style={{ color: '#3B82F6' }} />
            </div>
            <h3 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800' }}>Pro Monthly</h3>
          </div>
          
          <div style={{ fontSize: isMobile ? '36px' : '48px', fontWeight: '900', marginBottom: '6px', color: '#60A5FA', display: 'flex', alignItems: 'baseline' }}>
            ₹99
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600', marginLeft: '4px' }}>/mo</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px', lineHeight: '1.4' }}>Full PRO access billed on a monthly flexible cycle.</p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}><Check size={18} style={{ color: '#3B82F6' }}/> Unlimited Watchlists</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}><Check size={18} style={{ color: '#3B82F6' }}/> Advanced Option Chain</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}><Check size={18} style={{ color: '#3B82F6' }}/> Advanced Analytics</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}><Check size={18} style={{ color: '#3B82F6' }}/> Standard Email Support</li>
          </ul>

          {isPro ? (
            <button className="btn" style={{ width: '100%', padding: '12px', background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '13px' }} disabled>
              Active Subscription
            </button>
          ) : (
            <button 
              className="btn" 
              style={{ width: '100%', padding: '12px', background: 'var(--color-blue)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px' }}
              onClick={() => handleUpgrade('monthly')}
              disabled={loading}
            >
              {loading === 'monthly' ? 'Processing...' : 'Upgrade Monthly'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
