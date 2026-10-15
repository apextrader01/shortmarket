import React, { useState, useEffect } from 'react';
import {
  X, ShieldCheck, CheckCircle2, CreditCard, Wallet, Lock,
  ArrowRight, AlertCircle, Sparkles, Zap, Building2, Smartphone
} from 'lucide-react';
import { useStore, API } from '../store';
import logoImg from '../assets/logo.png';

const loadCashfreeScript = () => {
  return new Promise((resolve) => {
    if (typeof window.Cashfree === 'function') {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[src="https://sdk.cashfree.com/js/v3/cashfree.js"]');
    if (existing) {
      existing.remove();
    }
    let settled = false;
    const finish = (ok) => {
      if (!settled) {
        settled = true;
        resolve(ok);
      }
    };
    const timeoutId = setTimeout(() => {
      finish(typeof window.Cashfree === 'function');
    }, 8000);
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.onload = () => {
      clearTimeout(timeoutId);
      finish(typeof window.Cashfree === 'function');
    };
    script.onerror = () => {
      clearTimeout(timeoutId);
      script.remove();
      finish(false);
    };
    document.head.appendChild(script);
  });
};

export default function AlgoPaymentGatewayModal({
  isOpen,
  onClose,
  item = {
    type: 'STATIC_IP',
    title: 'Dedicated Mumbai BKC Static IP',
    amount: 350,
    subtitle: '1 Month dedicated IPv4 whitelist'
  },
  walletBalance = 0,
  onPaymentSuccess,
  onSuccess
}) {
  const user = useStore(s => s.user);
  const theme = useStore(s => s.theme);
  const isLight = theme === 'light' || (!theme && typeof document !== 'undefined' && document.documentElement.classList.contains('light-theme'));
  const isWalletRecharge = item?.type === 'WALLET_RECHARGE';

  const [paymentTab, setPaymentTab] = useState('CASHFREE'); // 'CASHFREE' | 'WALLET'
  const [customAmount, setCustomAmount] = useState(Number(item?.amount || 500));
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStepText, setProcessStepText] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [successTxId, setSuccessTxId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setIsProcessing(false);
      setIsSuccess(false);
      setErrorMsg('');
      const itemPrice = Number(item?.amount || 0);
      const canUseWallet = item?.type !== 'WALLET_RECHARGE' && itemPrice > 0 && Number(walletBalance || 0) >= itemPrice;
      setPaymentTab(canUseWallet ? 'WALLET' : 'CASHFREE');
      setCustomAmount(Math.max(250, Number(item?.amount || 500)));
      loadCashfreeScript();
    }
  }, [isOpen, item, walletBalance]);

  if (!isOpen) return null;

  const effectiveAmount = isWalletRecharge
    ? Math.max(0, Math.round(Number(customAmount || 0)))
    : Number(item?.amount || 0);

  const notifyParent = (payload) => {
    if (typeof onPaymentSuccess === 'function') {
      onPaymentSuccess(payload);
    }
    if (typeof onSuccess === 'function' && onSuccess !== onPaymentSuccess) {
      onSuccess(payload);
    }
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  const handleCashfreePayment = async () => {
    setErrorMsg('');
    if (isWalletRecharge && (!effectiveAmount || effectiveAmount < 250)) {
      setErrorMsg('Minimum Algo Wallet top-up is ₹250. Please enter ₹250 or above.');
      return;
    }
    if (!effectiveAmount || effectiveAmount < 1) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setErrorMsg('Please sign in to your SkandX account to complete payment.');
      return;
    }

    setIsProcessing(true);
    setProcessStepText('Loading Cashfree Secure Gateway...');

    const scriptLoaded = await loadCashfreeScript();
    if (!scriptLoaded || !window.Cashfree) {
      setIsProcessing(false);
      setErrorMsg('Unable to load Cashfree Checkout SDK. Please check your internet connection.');
      return;
    }

    try {
      setProcessStepText('Creating encrypted Cashfree order...');
      const orderPayload = {
        plan: item?.type || 'STATIC_IP',
        itemType: item?.type || 'STATIC_IP',
        itemId: item?.id || item?.type || 'STATIC_IP',
        amount: effectiveAmount,
        title: isWalletRecharge ? `SkandX Algo Wallet Recharge (₹${effectiveAmount})` : (item?.title || 'SkandX Algo Service')
      };

      let orderRes = await fetch(`${API}/api/v1/bridge/cashfree/create-order`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(orderPayload)
      });

      if (orderRes.status === 404) {
        orderRes = await fetch(`${API}/api/payment/create-order`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(orderPayload)
        });
      }

      const orderData = await orderRes.json().catch(() => ({}));
      const resolvedOrderId = orderData?.order_id || orderData?.id;
      if (!orderRes.ok || !resolvedOrderId || !orderData?.payment_session_id) {
        throw new Error(orderData?.error || 'Could not initialize Cashfree order.');
      }

      setProcessStepText('Awaiting payment confirmation in Cashfree...');

      const cfMode = String(orderData.environment || 'PRODUCTION').toUpperCase() === 'SANDBOX' ? 'sandbox' : 'production';
      const cashfree = window.Cashfree({ mode: cfMode });

      const result = await cashfree.checkout({
        paymentSessionId: orderData.payment_session_id,
        redirectTarget: '_modal'
      });

      if (result && result.error) {
        setIsProcessing(false);
        setProcessStepText('');
        const failDesc = result.error.message || 'Checkout dismissed by user before completing payment';
        try {
          const failPayload = {
            order_id: resolvedOrderId,
            razorpay_order_id: resolvedOrderId,
            error_description: failDesc,
            error_reason: result.error.code || 'user_cancelled',
            status: 'CANCELLED',
            plan: item?.type || 'STATIC_IP',
            itemType: item?.type || 'STATIC_IP',
            amount: effectiveAmount,
            failure_reason: failDesc,
            title: isWalletRecharge ? `Algo Wallet Recharge (₹${effectiveAmount})` : item?.title
          };
          let failRes = await fetch(`${API}/api/v1/bridge/cashfree/fail`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(failPayload)
          });
          if (failRes.status === 404) {
            failRes = await fetch(`${API}/api/payment/report-failure`, {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify(failPayload)
            });
          }
          const failData = await failRes.json().catch(() => ({}));
          notifyParent({ paymentFailed: true, transactions: failData?.transactions });
        } catch (_) {}
        return;
      }

      // Verify order status directly with Cashfree backend API
      setIsProcessing(true);
      setProcessStepText('Verifying Cashfree payment & provisioning service...');

      const verifyPayload = {
        order_id: resolvedOrderId,
        razorpay_order_id: resolvedOrderId,
        plan: item?.type || 'STATIC_IP',
        itemType: item?.type || 'STATIC_IP',
        itemId: item?.id || item?.type || 'STATIC_IP',
        amount: effectiveAmount,
        title: isWalletRecharge ? `Algo Wallet Recharge (₹${effectiveAmount})` : item?.title
      };

      let verifyRes = await fetch(`${API}/api/v1/bridge/cashfree/verify`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(verifyPayload)
      });

      if (verifyRes.status === 404) {
        verifyRes = await fetch(`${API}/api/payment/verify`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(verifyPayload)
        });
      }

      const verifyData = await verifyRes.json().catch(() => ({}));
      if (verifyData && verifyData.cancelled) {
        setIsProcessing(false);
        setProcessStepText('');
        notifyParent({ paymentFailed: true, transactions: verifyData?.transactions });
        return;
      }
      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(verifyData.error || 'Cashfree payment verification failed or order was not completed.');
      }

      setIsProcessing(false);
      setIsSuccess(true);
      setSuccessTxId(verifyData.transactionId || resolvedOrderId);

      notifyParent({
        ...verifyData,
        transactionId: verifyData.transactionId || resolvedOrderId,
        amount: effectiveAmount,
        item: {
          ...item,
          amount: effectiveAmount
        }
      });
    } catch (err) {
      setIsProcessing(false);
      setErrorMsg(err.message || 'Unable to connect to Cashfree gateway.');
    }
  };

  const handleWalletPayment = async () => {
    setErrorMsg('');
    if (walletBalance < effectiveAmount) {
      setErrorMsg(`Insufficient Algo Wallet credit. Please recharge or pay via Cashfree.`);
      return;
    }

    setIsProcessing(true);
    setProcessStepText('Deducting from SkandX Algo Wallet & provisioning service...');

    try {
      const res = await fetch(`${API}/api/v1/bridge/wallet/pay`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          itemType: item?.type,
          itemId: item?.id || item?.type,
          amount: effectiveAmount,
          title: item?.title
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Wallet payment could not be completed.');
      }

      setIsProcessing(false);
      setIsSuccess(true);
      setSuccessTxId(data.transactionId);

      notifyParent({
        ...data,
        transactionId: data.transactionId,
        amount: effectiveAmount,
        item: {
          ...item,
          amount: effectiveAmount
        }
      });
    } catch (err) {
      setIsProcessing(false);
      setErrorMsg(err.message || 'Wallet payment failed.');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100020,
      background: 'rgba(3, 7, 18, 0.88)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      paddingBottom: 'max(16px, calc(16px + env(safe-area-inset-bottom, 0px)))',
      fontFamily: "'Inter', system-ui, sans-serif"
    }}>
      <div style={{
        background: isLight ? 'var(--bg-panel, #ffffff)' : '#0d1322',
        border: isLight ? '1px solid var(--border-color, #e2e8f0)' : '1px solid rgba(56, 189, 248, 0.28)',
        borderRadius: '18px',
        width: '100%',
        maxWidth: '520px',
        color: isLight ? 'var(--text-primary, #0f172a)' : '#f8fafc',
        boxShadow: isLight ? '0 25px 60px -15px rgba(0, 0, 0, 0.15)' : '0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 40px rgba(56, 189, 248, 0.12)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header Bar */}
        <div style={{
          padding: '16px 20px',
          background: isLight ? 'var(--bg-card, #f8fafc)' : '#111827',
          borderBottom: isLight ? '1px solid var(--border-color, #e2e8f0)' : '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src={logoImg}
              alt="SkandX Logo"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                boxShadow: '0 0 12px rgba(56, 189, 248, 0.35)',
                flexShrink: 0
              }}
            />
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: isLight ? 'var(--text-primary, #0f172a)' : '#fff', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Skand<span style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #34d399 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>X</span> × Cashfree Checkout</span>
                <span style={{ fontSize: '10px', background: isLight ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.15)', color: isLight ? '#059669' : '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>
                  LIVE GATEWAY
                </span>
              </div>
              <div style={{ fontSize: '11px', color: isLight ? '#64748b' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Lock size={10} color="#10b981" /> Official Cashfree 256-Bit PCI-DSS • Instant Activation
              </div>
            </div>
          </div>

          {!isProcessing && (
            <button
              onClick={onClose}
              style={{
                background: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                color: isLight ? '#64748b' : '#94a3b8',
                borderRadius: '6px',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content Body */}
        {isSuccess ? (
          /* ── SUCCESS STATE ── */
          <div style={{ padding: '32px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.15)',
              border: '2px solid #22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#22c55e',
              boxShadow: '0 0 25px rgba(34, 197, 94, 0.35)'
            }}>
              <CheckCircle2 size={38} />
            </div>

            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: '900', color: isLight ? 'var(--text-primary, #0f172a)' : '#fff' }}>
                Payment Verified & Activated!
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: isLight ? '#64748b' : '#94a3b8' }}>
                Your transaction has been verified via Cashfree Payments and provisioned on your account.
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div style={{
              width: '100%',
              background: isLight ? 'var(--bg-input, #f1f5f9)' : '#090d16',
              border: isLight ? '1px solid var(--border-color, #cbd5e1)' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'left',
              fontSize: '12.5px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Service Provisioned:</span>
                <span style={{ color: isLight ? 'var(--text-primary, #0f172a)' : '#f8fafc', fontWeight: '700' }}>{item?.title}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Amount Paid:</span>
                <span style={{ color: '#22c55e', fontWeight: '800' }}>₹{effectiveAmount.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Payment Reference:</span>
                <span style={{ color: isLight ? '#0284c7' : '#38bdf8', fontFamily: 'monospace', fontWeight: '700' }}>{successTxId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Status:</span>
                <span style={{ color: '#10b981', fontWeight: '800' }}>VERIFIED & ACTIVE</span>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '800',
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(34, 197, 94, 0.3)'
              }}
            >
              Done & Return to Algo Hub
            </button>
          </div>
        ) : isProcessing ? (
          /* ── PROCESSING STATE ── */
          <div style={{ padding: '44px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              border: '3px solid rgba(56, 189, 248, 0.2)',
              borderTopColor: '#38bdf8',
              animation: 'spin 0.8s linear infinite'
            }} />
            <div>
              <h4 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '800', color: '#fff' }}>
                Connecting to Cashfree Gateway
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#38bdf8' }}>
                {processStepText}
              </p>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '12px' }}>
                Complete the payment inside the official Cashfree window...
              </div>
            </div>
          </div>
        ) : (
          /* ── ACTIVE CHECKOUT STATE ── */
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Item Order Summary Card */}
            <div style={{
              background: isLight ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.08), rgba(241, 245, 249, 0.9))' : 'linear-gradient(135deg, rgba(2, 132, 199, 0.14), rgba(15, 23, 42, 0.85))',
              border: isLight ? '1px solid var(--border-color, #cbd5e1)' : '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: isLight ? 'var(--text-primary, #0f172a)' : '#fff' }}>
                  {item?.title}
                </div>
                <div style={{ fontSize: '11.5px', color: isLight ? '#64748b' : '#94a3b8', marginTop: '2px' }}>
                  {item?.subtitle || 'SkandX Algo Multi-Broker Suite Service'}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '20px', fontWeight: '900', color: isLight ? '#0284c7' : '#38bdf8' }}>
                  ₹{effectiveAmount.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '10.5px', color: '#64748b' }}>Incl. GST</div>
              </div>
            </div>

            {/* If Wallet Recharge, allow quick amount presets or custom input */}
            {isWalletRecharge && (
              <div style={{
                background: isLight ? 'var(--bg-input, #f8fafc)' : '#090d16',
                border: isLight ? '1px solid var(--border-color, #cbd5e1)' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '14px'
              }}>
                <label style={{ fontSize: '11.5px', color: isLight ? '#475569' : '#94a3b8', fontWeight: '700', display: 'block', marginBottom: '8px' }}>
                  Select or Enter One-Time Top-Up Amount (Min ₹250)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '10px' }}>
                  {[250, 500, 1000, 2500, 5000].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => { setCustomAmount(preset); setErrorMsg(''); }}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '8px',
                        border: Number(customAmount) === preset ? (isLight ? '1px solid #0284c7' : '1px solid #38bdf8') : (isLight ? '1px solid var(--border-color, #cbd5e1)' : '1px solid #1e293b'),
                        background: Number(customAmount) === preset ? (isLight ? 'rgba(2, 132, 199, 0.12)' : 'rgba(56, 189, 248, 0.18)') : (isLight ? '#ffffff' : '#121826'),
                        color: Number(customAmount) === preset ? (isLight ? '#0284c7' : '#38bdf8') : (isLight ? '#475569' : '#cbd5e1'),
                        fontWeight: '800',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      ₹{preset}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="250"
                  max="500000"
                  value={customAmount}
                  onChange={e => { setCustomAmount(e.target.value); setErrorMsg(''); }}
                  placeholder="Enter custom amount in ₹ (Min ₹250)"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: isLight ? '#ffffff' : '#121826',
                    border: Number(customAmount || 0) < 250 ? '1px solid #ef4444' : (isLight ? '1px solid var(--border-color, #cbd5e1)' : '1px solid #1e293b'),
                    borderRadius: '8px',
                    color: isLight ? 'var(--text-primary, #0f172a)' : '#fff',
                    fontSize: '14px',
                    fontWeight: '700',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ fontSize: '10.5px', color: Number(customAmount || 0) < 250 ? '#f87171' : '#64748b', marginTop: '6px' }}>
                  {Number(customAmount || 0) < 250
                    ? '⚠️ Minimum Algo Wallet top-up is ₹250.'
                    : '✓ 100% One-Time Top-Up • No recurring auto-debit'}
                </div>
              </div>
            )}

            {/* Payment Source Selector (Cashfree vs Algo Wallet for non-recharge items) */}
            {!isWalletRecharge && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setPaymentTab('CASHFREE'); setErrorMsg(''); }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: paymentTab === 'CASHFREE' ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.03)',
                    border: paymentTab === 'CASHFREE' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: paymentTab === 'CASHFREE' ? '#38bdf8' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: '800',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  <CreditCard size={16} /> Cashfree Gateway
                </button>
                <button
                  type="button"
                  onClick={() => { setPaymentTab('WALLET'); setErrorMsg(''); }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: paymentTab === 'WALLET' ? 'rgba(34, 197, 94, 0.16)' : 'rgba(255, 255, 255, 0.03)',
                    border: paymentTab === 'WALLET' ? '1px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: paymentTab === 'WALLET' ? '#22c55e' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: '800',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  <Wallet size={16} /> Algo Wallet (₹{Number(walletBalance || 0).toFixed(0)})
                </button>
              </div>
            )}

            {errorMsg && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '10px',
                padding: '10px 12px',
                color: '#f87171',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Payment Details Box */}
            {paymentTab === 'CASHFREE' || isWalletRecharge ? (
              <div style={{
                background: isLight ? 'var(--bg-input, #f8fafc)' : '#090d16',
                border: isLight ? '1px solid var(--border-color, #cbd5e1)' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  <div style={{ background: isLight ? '#ffffff' : '#111827', border: isLight ? '1px solid var(--border-color, #e2e8f0)' : '1px solid #1e293b', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                    <Smartphone size={16} color={isLight ? '#0284c7' : '#38bdf8'} style={{ marginBottom: '4px' }} />
                    <div style={{ fontSize: '11px', fontWeight: '700', color: isLight ? 'var(--text-primary, #0f172a)' : '#e2e8f0' }}>UPI & QR</div>
                    <div style={{ fontSize: '10px', color: isLight ? '#64748b' : '#64748b' }}>GPay, PhonePe, Paytm</div>
                  </div>
                  <div style={{ background: isLight ? '#ffffff' : '#111827', border: isLight ? '1px solid var(--border-color, #e2e8f0)' : '1px solid #1e293b', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                    <CreditCard size={16} color={isLight ? '#6366f1' : '#818cf8'} style={{ marginBottom: '4px' }} />
                    <div style={{ fontSize: '11px', fontWeight: '700', color: isLight ? 'var(--text-primary, #0f172a)' : '#e2e8f0' }}>Cards</div>
                    <div style={{ fontSize: '10px', color: isLight ? '#64748b' : '#64748b' }}>Visa, RuPay, Master</div>
                  </div>
                  <div style={{ background: isLight ? '#ffffff' : '#111827', border: isLight ? '1px solid var(--border-color, #e2e8f0)' : '1px solid #1e293b', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                    <Building2 size={16} color={isLight ? '#059669' : '#10b981'} style={{ marginBottom: '4px' }} />
                    <div style={{ fontSize: '11px', fontWeight: '700', color: isLight ? 'var(--text-primary, #0f172a)' : '#e2e8f0' }}>NetBanking</div>
                    <div style={{ fontSize: '10px', color: isLight ? '#64748b' : '#64748b' }}>HDFC, ICICI, SBI +50</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCashfreePayment}
                  style={{
                    width: '100%',
                    padding: '13px 16px',
                    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 6px 20px rgba(2, 132, 199, 0.35)'
                  }}
                >
                  <Zap size={16} /> Pay ₹{effectiveAmount.toLocaleString('en-IN')} with Cashfree <ArrowRight size={16} />
                </button>

                <div style={{ fontSize: '11px', color: isLight ? '#64748b' : '#64748b', textAlign: 'center' }}>
                  100% One-Time Payment (No Auto-Debit) • Verified by Cashfree PG v3
                </div>
              </div>
            ) : (
              <div style={{
                background: isLight ? 'var(--bg-input, #f8fafc)' : '#090d16',
                border: isLight ? '1px solid var(--border-color, #cbd5e1)' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{
                  background: isLight ? '#ffffff' : '#111827',
                  border: isLight ? '1px solid var(--border-color, #e2e8f0)' : '1px solid #1e293b',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '12.5px', color: isLight ? '#64748b' : '#94a3b8' }}>Available Algo Wallet Credit:</span>
                  <span style={{ fontSize: '16px', fontWeight: '900', color: walletBalance >= effectiveAmount ? '#22c55e' : '#ef4444' }}>
                    ₹{Number(walletBalance || 0).toFixed(2)}
                  </span>
                </div>

                {walletBalance < effectiveAmount ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '12px', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      Wallet balance is short by ₹{(effectiveAmount - walletBalance).toFixed(2)}. Pay directly via Cashfree instead.
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaymentTab('CASHFREE')}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '13.5px',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      Switch to Cashfree Checkout
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleWalletPayment}
                    style={{
                      width: '100%',
                      padding: '13px',
                      background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(34, 197, 94, 0.3)'
                    }}
                  >
                    Deduct ₹{effectiveAmount.toLocaleString('en-IN')} from Wallet & Activate
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
