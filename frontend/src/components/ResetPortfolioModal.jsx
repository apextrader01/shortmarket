import React, { useState } from 'react';
import { RotateCcw, X, AlertTriangle, ArrowLeft, Check } from 'lucide-react';
import { useStore } from '../store';

const POPULAR_AMOUNTS = [
  { label: '₹10,00,000', value: 1000000, desc: '10 Lakh' },
  { label: '₹25,00,000', value: 2500000, desc: '25 Lakh' },
  { label: '₹50,00,000', value: 5000000, desc: '50 Lakh' },
  { label: '₹1,00,00,000', value: 10000000, desc: '1 Crore' },
  { label: '₹5,00,00,000', value: 50000000, desc: '5 Crore' },
  { label: '₹10,00,00,000', value: 100000000, desc: '10 Crore (Max)' }
];

export default function ResetPortfolioModal({ isOpen, onClose }) {
  const resetAccount = useStore(state => state.resetAccount);
  const fetchUserData = useStore(state => state.fetchUserData);
  
  const [selectedAmount, setSelectedAmount] = useState(1000000);
  const [customAmount, setCustomAmount] = useState('1000000');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSelectPopular = (val) => {
    setSelectedAmount(val);
    setCustomAmount(String(val));
    setErrorMsg('');
  };

  const handleCustomChange = (e) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '');
    setCustomAmount(rawVal);
    const num = Number(rawVal);
    if (!isNaN(num)) {
      setSelectedAmount(num);
    }
    setErrorMsg('');
  };

  const formatIndianWords = (num) => {
    if (!num || isNaN(num) || num <= 0) return '';
    if (num >= 10000000) {
      const cr = (num / 10000000).toFixed(2).replace(/\.00$/, '');
      return `₹${cr} Crore`;
    }
    if (num >= 100000) {
      const lk = (num / 100000).toFixed(2).replace(/\.00$/, '');
      return `₹${lk} Lakh`;
    }
    if (num >= 1000) {
      const th = (num / 1000).toFixed(1).replace(/\.0$/, '');
      return `₹${th} Thousand`;
    }
    return `₹${num.toLocaleString('en-IN')}`;
  };

  const handleReset = async () => {
    const amountNum = Number(customAmount);
    if (!amountNum || isNaN(amountNum)) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }
    if (amountNum < 10000) {
      setErrorMsg('Minimum reset amount is ₹10,000.');
      return;
    }
    if (amountNum > 100000000) {
      setErrorMsg('Maximum reset amount limit is ₹10 Crore (₹10,00,00,000).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await resetAccount(amountNum);
      if (res && res.success) {
        setSuccessMsg(res.message || `Portfolio successfully reset with ₹${amountNum.toLocaleString('en-IN')} capital!`);
        await fetchUserData().catch(() => {});
        setTimeout(() => {
          setIsSubmitting(false);
          onClose();
        }, 1200);
      } else {
        setErrorMsg(res?.error || 'Failed to reset portfolio. Please try again.');
        setIsSubmitting(false);
      }
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred while resetting.');
      setIsSubmitting(false);
    }
  };

  const activeAmountNum = Number(customAmount) || 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 8, 16, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        background: '#131824',
        border: '1px solid #1e293b',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '440px',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        color: '#f8fafc',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* Top Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px'
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Paper Trading
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 20px' }}>
          
          {/* Header Icon & Title */}
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(37,99,235,0.2) 0%, rgba(30,58,138,0.3) 100%)',
              border: '1px solid rgba(59,130,246,0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
              marginBottom: '12px'
            }}>
              <RotateCcw size={26} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 6px 0', color: '#f8fafc' }}>
              Reset Portfolio
            </h2>
            <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '0 0 4px 0', lineHeight: '1.45' }}>
              This will reset your current portfolio performance and set the capital to the entered portfolio amount.
            </p>
            <div style={{
              display: 'inline-block',
              fontSize: '11.5px',
              fontWeight: '700',
              color: '#38bdf8',
              background: 'rgba(56,189,248,0.1)',
              padding: '3px 12px',
              borderRadius: '12px',
              marginTop: '4px',
              border: '1px solid rgba(56,189,248,0.25)'
            }}>
              Max amount limit is ₹10 Crore
            </div>
          </div>

          {/* Popular Amounts */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#94a3b8', marginBottom: '10px' }}>
              Choose from popular amounts
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px'
            }}>
              {POPULAR_AMOUNTS.map((item) => {
                const isSelected = selectedAmount === item.value && customAmount === String(item.value);
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleSelectPopular(item.value)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: isSelected ? 'rgba(37,99,235,0.16)' : '#1a2234',
                      border: isSelected ? '1.5px solid #3b82f6' : '1px solid #232d42',
                      color: isSelected ? '#ffffff' : '#cbd5e1',
                      fontSize: '13.5px',
                      fontWeight: isSelected ? '800' : '600',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      transition: 'all 0.15s ease',
                      textAlign: 'left'
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ fontSize: '10.5px', color: isSelected ? '#60a5fa' : '#64748b', marginTop: '2px' }}>
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customised Amount */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#94a3b8' }}>
                Or enter a customised amount
              </span>
              {activeAmountNum > 0 && (
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#38bdf8' }}>
                  {formatIndianWords(activeAmountNum)}
                </span>
              )}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#1a2234',
              border: '1px solid #232d42',
              borderRadius: '10px',
              padding: '12px 14px',
              transition: 'border-color 0.15s'
            }}>
              <span style={{ fontSize: '18px', fontWeight: '700', color: '#64748b', marginRight: '6px' }}>
                ₹
              </span>
              <input
                type="text"
                value={customAmount}
                onChange={handleCustomChange}
                placeholder="e.g. 1000000"
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: '700',
                  width: '100%',
                  letterSpacing: '0.4px'
                }}
              />
            </div>
          </div>

          {/* Warning Banner */}
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '8px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px'
          }}>
            <AlertTriangle size={15} color="#f87171" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: '#fca5a5', lineHeight: '1.4' }}>
              All open positions, pending orders, and trading ledger will be permanently reset to this starting capital.
            </span>
          </div>

          {errorMsg && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              marginBottom: '14px',
              textAlign: 'center'
            }}>
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#4ade80',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              marginBottom: '14px',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}>
              <Check size={14} /> {successMsg}
            </div>
          )}

          {/* Action Button */}
          <button
            type="button"
            onClick={handleReset}
            disabled={isSubmitting || !activeAmountNum || activeAmountNum <= 0}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '10px',
              background: isSubmitting ? '#334155' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '800',
              letterSpacing: '0.4px',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
              transition: 'all 0.15s ease'
            }}
          >
            {isSubmitting ? 'Resetting Portfolio...' : `Reset Portfolio (${formatIndianWords(activeAmountNum) || '₹0'})`}
          </button>

        </div>
      </div>
    </div>
  );
}
