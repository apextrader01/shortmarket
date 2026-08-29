import React, { useState } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { Check, Star, Shield, Zap, ChevronLeft, ArrowLeft } from 'lucide-react';

export default function PricingView({ setActiveTab }) {
  const { user } = useStore(useShallow(state => ({ user: state.user })));
  const [loading, setLoading] = useState(false);

  // Initialize Razorpay logic
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
      // 1. Create order
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

      // 2. Open Razorpay Checkout
      const options = {
        key: orderData.key_id || 'rzp_test_placeholder', // Comes from backend
        
        
        name: 'Short Edge',
        description: `Upgrade to PRO (${plan})`,
        image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png', // Placeholder logo
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
            if (verifyRes.ok && verifyData.success) {
              alert('Successfully upgraded to PRO! Please log out and log back in to apply changes.');
              window.location.reload();
            } else {
              alert(verifyData.error || 'Payment verification failed');
            }
          } catch (e) {
            alert('Error verifying payment: ' + e.message);
          }
        },
        prefill: {
          name: user.username,
          email: user.email,
          contact: user.phone || '9999999999'
        },
        theme: {
          color: '#3b82f6'
        }
      };
      
      const rzp1 = new window.Razorpay(options);
      rzp1.on('payment.failed', function (response){
        alert(response.error.description);
      });
      rzp1.open();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isPro = user?.subscription_tier === 'PRO';

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <div 
            onClick={() => setActiveTab('ClientData')} 
            style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <ArrowLeft size={16} />
          </div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '12px' }}>Choose Your Plan</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>Unlock the full potential of your trading with PRO.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        {/* BASIC PLAN */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '32px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Shield style={{ color: 'var(--text-secondary)' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>BASIC</h3>
          </div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px' }}>₹0<span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 'normal' }}> / forever</span></div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', minHeight: '40px' }}>Essential features for beginners to get started.</p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Check size={18} style={{ color: 'var(--color-green)' }}/> Up to 3 Watchlists</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Check size={18} style={{ color: 'var(--color-green)' }}/> Basic Order Placement</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Check size={18} style={{ color: 'var(--color-green)' }}/> Portfolio Tracking</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}><Check size={18} style={{ opacity: 0.2 }}/> Advanced Charts</li>
          </ul>

          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', padding: '12px', opacity: 0.5, cursor: 'not-allowed' }}
            disabled
          >
            Current Plan
          </button>
        </div>

        {/* MONTHLY PRO PLAN */}
        <div style={{ background: 'var(--bg-card)', border: '2px solid var(--color-blue)', borderRadius: '12px', padding: '32px', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 8px 32px rgba(59, 130, 246, 0.15)' }}>
          <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: 'var(--color-blue)', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Zap size={12} /> PRO MONTHLY
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>Monthly</h3>
          </div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--color-blue-light)' }}>
            ₹99 
            <span style={{ fontSize: '18px', color: 'var(--text-secondary)', textDecoration: 'line-through', marginLeft: '8px' }}>₹149</span>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 'normal' }}> / mo</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', minHeight: '40px' }}>Advanced tools for serious traders and investors.</p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Check size={18} style={{ color: 'var(--color-blue)' }}/> Up to 5 Watchlists</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Check size={18} style={{ color: 'var(--color-blue)' }}/> All Basic Features</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Check size={18} style={{ color: 'var(--color-blue)' }}/> Priority Support</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Check size={18} style={{ color: 'var(--color-blue)' }}/> Advanced Analytics (Coming Soon)</li>
          </ul>

          {isPro ? (
            <button 
              className="btn btn-secondary" 
              style={{ width: '100%', padding: '12px', background: 'var(--color-green)', color: 'white', border: 'none' }}
              disabled
            >
              Active Subscription
            </button>
          ) : (
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '12px', fontWeight: 'bold' }}
              onClick={() => handleUpgrade('monthly')}
              disabled={loading}
            >
              {loading === 'monthly' ? 'Processing...' : 'Start 7-Day Free Trial'}
            </button>
          )}
        </div>

        {/* YEARLY PRO PLAN */}
        <div style={{ background: 'var(--bg-card)', border: '2px solid var(--color-yellow)', borderRadius: '12px', padding: '32px', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 8px 32px rgba(234, 179, 8, 0.15)' }}>
          <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: 'var(--color-yellow)', color: 'black', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Star size={12} /> BEST VALUE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>Yearly</h3>
          </div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--color-yellow)' }}>
            ₹499
            <span style={{ fontSize: '18px', color: 'var(--text-secondary)', textDecoration: 'line-through', marginLeft: '8px' }}>₹999</span>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 'normal' }}> / year</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', minHeight: '40px' }}>Massive savings. The ultimate trading experience.</p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Check size={18} style={{ color: 'var(--color-yellow)' }}/> Up to 5 Watchlists</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Check size={18} style={{ color: 'var(--color-yellow)' }}/> All Basic Features</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Check size={18} style={{ color: 'var(--color-yellow)' }}/> Priority Support</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Check size={18} style={{ color: 'var(--color-yellow)' }}/> Advanced Analytics (Coming Soon)</li>
          </ul>

          {isPro ? (
            <button 
              className="btn btn-secondary" 
              style={{ width: '100%', padding: '12px', background: 'var(--color-green)', color: 'white', border: 'none' }}
              disabled
            >
              Active Subscription
            </button>
          ) : (
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '12px', fontWeight: 'bold', background: 'var(--color-yellow)', color: 'black', border: 'none' }}
              onClick={() => handleUpgrade('yearly')}
              disabled={loading}
            >
              {loading === 'yearly' ? 'Processing...' : 'Start 7-Day Free Trial'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}







