import React, { useState } from 'react';
import { useStore } from '../store';
import { Check, Star, Shield, Zap } from 'lucide-react';

export default function PricingView() {
  const { user } = useStore();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = (plan) => {
    if (plan === 'monthly') {
      window.open('https://rzp.io/rzp/rwUOadc', '_blank');
    } else if (plan === 'yearly') {
      window.open('https://rzp.io/rzp/HTOdZnf', '_blank');
    }
  };

  const isPro = user?.subscription_tier === 'PRO';

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', color: 'var(--text-primary)' }}>
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
            >
              Upgrade Monthly
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
            >
              Upgrade Yearly
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
