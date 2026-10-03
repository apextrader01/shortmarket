// frontend/src/components/AlgoBridgeDashboardModal.jsx
// 🌟 Hub 12: AlgoDelta Multi-Broker Demat & Bridge Suite (Screenshot 4 Implementation)

import React, { useState, useEffect } from 'react';
import { 
  X, Layers, ShieldCheck, Zap, Copy, RefreshCw, Send, CheckCircle2, 
  AlertTriangle, Users, Cpu, Server, Wifi, ExternalLink, Globe, 
  Clock, CreditCard, ChevronRight, Check, Sliders, Play, Code, MessageCircle,
  Folder, Bookmark, ShoppingBag, FileText, ArrowRight, Activity
} from 'lucide-react';

export default function AlgoBridgeDashboardModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const [activeMenu, setActiveMenu] = useState('Dashboard');
  const [allowConnect, setAllowConnect] = useState(true);
  const [allowPurchaseIp, setAllowPurchaseIp] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [expiredCount, setExpiredCount] = useState(2);
  const [token, setToken] = useState('skandx_broker_demat_9433');
  const [toastMsg, setToastMsg] = useState('');

  // Feature toggles
  const [features, setFeatures] = useState({
    watchlist: true,
    groupCopy: true,
    jsonBridge: true,
    customBridge: true
  });

  const [orders, setOrders] = useState([
    {
      id: 'BO-98210',
      time: '09:25 AM',
      broker: 'Zerodha Kite',
      account: 'ZER-6641',
      symbol: 'NSE:NIFTY24OCTFUT',
      side: 'BUY',
      qty: 50,
      price: '₹24,890.50',
      status: 'COMPLETED'
    },
    {
      id: 'BO-98209',
      time: '09:18 AM',
      broker: 'Angel One',
      account: 'ANG-9012',
      symbol: 'NSE:BANKNIFTY24OCTFUT',
      side: 'SELL',
      qty: 15,
      price: '₹51,220.00',
      status: 'COMPLETED'
    }
  ]);

  const [dematAccounts, setDematAccounts] = useState([
    {
      id: 'ACC-01',
      broker: 'Zerodha Kite',
      clientCode: 'ZER-6641',
      name: 'Harikrishnan M',
      status: 'EXPIRED',
      ip: '103.212.120.45',
      lastLogin: 'Today, 08:30 AM',
      expiresIn: 'Expired (Daily 24h Token)'
    },
    {
      id: 'ACC-02',
      broker: 'Angel One SmartAPI',
      clientCode: 'ANG-9012',
      name: 'Alpha Strategy A/C',
      status: 'EXPIRED',
      ip: '103.212.120.46',
      lastLogin: 'Yesterday, 03:20 PM',
      expiresIn: 'Expired (TOTP Re-auth required)'
    },
    {
      id: 'ACC-03',
      broker: 'Fyers API v3',
      clientCode: 'FY-4410',
      name: 'Scalping Primary',
      status: 'ACTIVE',
      ip: '103.212.120.45',
      lastLogin: 'Today, 09:15 AM',
      expiresIn: 'Active (Valid 14h)'
    }
  ]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleCopyLink = () => {
    const link = `https://skandx.in/connect-demat?ref=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    showToast('Demat connection link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRegenerate = async () => {
    const newToken = 'skandx_demat_' + Math.random().toString(36).substring(2, 9);
    setToken(newToken);
    showToast('New Demat connection link generated!');
    try {
      await fetch('/api/v1/bridge/regenerate-token', { method: 'POST' });
    } catch (_) {}
  };

  const handleRenewAccounts = async () => {
    setExpiredCount(0);
    setDematAccounts(prev => prev.map(a => ({ ...a, status: 'ACTIVE', expiresIn: 'Active (Valid 24h)' })));
    showToast('Demat sessions renewed successfully!');
    try {
      await fetch('/api/v1/bridge/renew-demat', { method: 'POST' });
    } catch (_) {}
  };

  const shareUrl = `https://skandx.in/connect-demat?ref=${token}`;

  const jsonWebhookSample = JSON.stringify({
    secret: "SKANDX_WH_" + token.substring(0, 8),
    action: "BUY",
    symbol: "NSE:NIFTY24OCTFUT",
    qty: 50,
    order_type: "MARKET",
    product: "MIS"
  }, null, 2);

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(5, 7, 15, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 100000,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff',
          padding: '10px 18px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '600',
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          {toastMsg}
        </div>
      )}

      {/* Main Console Container */}
      <div style={{
        width: '100%',
        maxWidth: '1240px',
        height: '92vh',
        background: '#0d131f',
        border: '1px solid #1e293b',
        borderRadius: '16px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(139, 92, 246, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}>

        {/* Top Header Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid #1e293b',
          background: '#0a0e17'
        }}>
          {/* Logo & Version */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '900',
              fontSize: '18px',
              letterSpacing: '1px'
            }}>
              <span style={{
                background: 'linear-gradient(135deg, #ef4444, #f97316)',
                color: '#fff',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
                fontWeight: '900'
              }}>
                ▲
              </span>
              <span style={{ color: '#fff' }}>ALGODELTA</span>
              <span style={{
                fontSize: '10px',
                color: '#94a3b8',
                background: '#1e293b',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: '600'
              }}>
                v4.9.33
              </span>
            </div>
          </div>

          {/* User Credits & Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Credit Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#1e293b',
              borderRadius: '6px',
              overflow: 'hidden',
              fontSize: '12px',
              fontWeight: '700'
            }}>
              <span style={{ padding: '4px 8px', color: '#cbd5e1' }}>Credit:</span>
              <span style={{ padding: '4px 10px', background: '#7c3aed', color: '#fff' }}>0.00</span>
            </div>

            {/* User Pill */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid #1e293b',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '12px'
            }}>
              <span style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#38bdf8',
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: '800'
              }}>
                H
              </span>
              <span style={{ color: '#cbd5e1' }}>h4harikrishnan2015@gmail.com</span>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid #334155',
                color: '#cbd5e1',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Console Body: Left Sidebar + Main Content */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* LEFT SIDEBAR NAVIGATION (Matching Screenshot 4)               */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div style={{
            width: '220px',
            borderRight: '1px solid #1e293b',
            background: '#090d16',
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            overflowY: 'auto'
          }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', padding: '0 8px 6px' }}>
              User [ v4.9.33 ]
            </div>

            {/* Dashboard (Active) */}
            <button
              onClick={() => setActiveMenu('Dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: activeMenu === 'Dashboard' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                color: activeMenu === 'Dashboard' ? '#38bdf8' : '#94a3b8',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                textAlign: 'left'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeMenu === 'Dashboard' ? '#22c55e' : '#64748b' }}></span>
              Dashboard
            </button>

            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', padding: '12px 8px 4px', letterSpacing: '0.5px' }}>
              ACCOUNT MANAGEMENT
            </div>

            {[
              { id: 'Demat', label: 'Demat', icon: Folder },
              { id: 'StaticIp', label: 'Static Ip', icon: Wifi },
              { id: 'LinkUser', label: 'Link User', icon: Users },
              { id: 'WatchList', label: 'Watch List', icon: Bookmark },
              { id: 'GroupCopy', label: 'Group / Copy', icon: Users },
              { id: 'Bridge', label: 'Bridge', icon: Cpu },
              { id: 'TelegramBot', label: 'Telegram Bot', icon: Send }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveMenu(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: isActive ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                    color: isActive ? '#38bdf8' : '#94a3b8',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500',
                    textAlign: 'left'
                  }}
                >
                  <Icon size={15} color={isActive ? '#38bdf8' : '#64748b'} />
                  {item.label}
                </button>
              );
            })}

            <div style={{ marginTop: 'auto', padding: '12px 8px', borderTop: '1px solid #1e293b' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Connected Brokers</div>
              <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: '700' }}>Zerodha • Angel • Fyers</div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* MAIN WORKSPACE CONTENT                                        */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* 1. TOP CARD: SHARE DEMAT CONNECTION (Exact Screenshot 4) */}
            <div style={{
              background: '#121826',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              {/* Header Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#38bdf8'
                    }}>
                      🔗
                    </div>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>Share Demat Connection</span>
                  </div>

                  {/* Green Status Badges */}
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#22c55e',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    padding: '3px 8px',
                    borderRadius: '4px'
                  }}>
                    Demat Connection Enable
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#22c55e',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    padding: '3px 8px',
                    borderRadius: '4px'
                  }}>
                    IP Purchase Enable
                  </span>
                </div>

                {/* Regenerate & Copy Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={handleRegenerate}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 12px',
                      borderRadius: '6px',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      color: '#cbd5e1',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={13} /> Regenerate
                  </button>

                  <button
                    onClick={handleCopyLink}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '6px',
                      background: copiedLink ? '#10b981' : '#2563eb',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                    {copiedLink ? 'Copied' : 'Copy Link'}
                  </button>
                </div>
              </div>

              {/* Subtitle */}
              <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                If you don't want to ask your users for their demat credentials, you can simply share this link with them so they can connect their account themselves.
              </div>

              {/* Permission Toggles & Link Input */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                flexWrap: 'wrap',
                paddingTop: '6px',
                borderTop: '1px solid rgba(255,255,255,0.06)'
              }}>
                {/* Allow users to connect account toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#cbd5e1' }}>
                  <span style={{ color: '#818cf8' }}>🔒</span>
                  <span>Allow your users to connect account</span>
                  <input
                    type="checkbox"
                    checked={allowConnect}
                    onChange={(e) => setAllowConnect(e.target.checked)}
                    style={{
                      accentColor: '#22c55e',
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                </label>

                {/* Allow your users to purchase IP toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#cbd5e1' }}>
                  <span style={{ color: '#22c55e' }}>📶</span>
                  <span>Allow your users to purchase IP</span>
                  <input
                    type="checkbox"
                    checked={allowPurchaseIp}
                    onChange={(e) => setAllowPurchaseIp(e.target.checked)}
                    style={{
                      accentColor: '#22c55e',
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                </label>

                {/* Share URL preview */}
                <div style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  background: '#090d16',
                  border: '1px solid #1e293b',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  color: '#64748b'
                }}>
                  {shareUrl}
                </div>
              </div>
            </div>

            {/* 2. SIX KPI STAT CARDS (Exact Screenshot 4 Grid) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '12px'
            }}>
              {/* Card 1: Available Credit */}
              <div style={{ background: '#121826', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>Available Credit(₹)</div>
                  <div style={{ color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)', padding: '6px', borderRadius: '6px' }}>
                    <CreditCard size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '8px', color: '#fff' }}>0</div>
              </div>

              {/* Card 2: Total Demat */}
              <div style={{ background: '#121826', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>Total Demat</div>
                  <div style={{ color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '6px', borderRadius: '6px' }}>
                    <Users size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '8px', color: '#fff' }}>2</div>
              </div>

              {/* Card 3: Disconnected Demat */}
              <div style={{ background: '#121826', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>Disconnected Demat</div>
                  <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '6px', borderRadius: '6px' }}>
                    <Activity size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '8px', color: '#fff' }}>0</div>
              </div>

              {/* Card 4: Expired Demat */}
              <div style={{ background: '#121826', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>Expired Demat</div>
                  <div style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '6px', borderRadius: '6px' }}>
                    <Clock size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '8px', color: '#f59e0b' }}>{expiredCount}</div>
              </div>

              {/* Card 5: Total Static IP */}
              <div style={{ background: '#121826', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>Total Static IP</div>
                  <div style={{ color: '#a855f7', background: 'rgba(168, 85, 247, 0.1)', padding: '6px', borderRadius: '6px' }}>
                    <Server size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '8px', color: '#fff' }}>2</div>
              </div>

              {/* Card 6: Available Static IP */}
              <div style={{ background: '#121826', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>Available Static IP</div>
                  <div style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '6px', borderRadius: '6px' }}>
                    <Wifi size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '8px', color: '#fff' }}>0</div>
              </div>
            </div>

            {/* 3. ALERT BANNER: DEMAT ACCOUNTS EXPIRED (Exact Screenshot 4) */}
            {expiredCount > 0 ? (
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444'
                  }}>
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#f87171' }}>
                      Demat Accounts Expired
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {expiredCount} account(s) require renew (Zerodha Kite & Angel One SmartAPI daily tokens)
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleRenewAccounts}
                    style={{
                      background: '#ef4444',
                      border: 'none',
                      color: '#fff',
                      padding: '7px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Renew Demat Tokens
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '10px',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#22c55e',
                fontSize: '13px'
              }}>
                <CheckCircle2 size={18} />
                <span>All connected Demat accounts are active with live order routing enabled!</span>
              </div>
            )}

            {/* 4. BOTTOM 3 SECTIONS: PLATFORM FEATURES, TODAY ORDER STATUS, CUSTOMER SUPPORT */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>

              {/* Platform Features Card */}
              <div style={{ background: '#121826', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ color: '#a855f7' }}>⚙️</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>Platform Features</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  {/* Watchlist */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090d16', padding: '10px 12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#cbd5e1' }}>
                      <Bookmark size={13} color="#38bdf8" /> Watchlist
                    </div>
                    <input
                      type="checkbox"
                      checked={features.watchlist}
                      onChange={(e) => setFeatures(prev => ({ ...prev, watchlist: e.target.checked }))}
                      style={{ accentColor: '#22c55e', cursor: 'pointer' }}
                    />
                  </div>

                  {/* Group / Copy */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090d16', padding: '10px 12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#cbd5e1' }}>
                      <Users size={13} color="#a855f7" /> Group / Copy
                    </div>
                    <input
                      type="checkbox"
                      checked={features.groupCopy}
                      onChange={(e) => setFeatures(prev => ({ ...prev, groupCopy: e.target.checked }))}
                      style={{ accentColor: '#22c55e', cursor: 'pointer' }}
                    />
                  </div>

                  {/* Json Bridge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090d16', padding: '10px 12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#cbd5e1' }}>
                      <Code size={13} color="#f59e0b" /> Json Bridge
                    </div>
                    <input
                      type="checkbox"
                      checked={features.jsonBridge}
                      onChange={(e) => setFeatures(prev => ({ ...prev, jsonBridge: e.target.checked }))}
                      style={{ accentColor: '#22c55e', cursor: 'pointer' }}
                    />
                  </div>

                  {/* Custom Bridge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090d16', padding: '10px 12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#cbd5e1' }}>
                      <Cpu size={13} color="#10b981" /> Custom Bridge
                    </div>
                    <input
                      type="checkbox"
                      checked={features.customBridge}
                      onChange={(e) => setFeatures(prev => ({ ...prev, customBridge: e.target.checked }))}
                      style={{ accentColor: '#22c55e', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>

              {/* Today Order Status Card */}
              <div style={{ background: '#121826', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>Today Order Status</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button style={{ background: '#2563eb', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                      Table
                    </button>
                  </div>
                </div>

                {orders.length > 0 ? (
                  <div style={{ overflowX: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse', color: '#cbd5e1' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #1e293b', color: '#64748b', textAlign: 'left' }}>
                          <th style={{ padding: '6px 4px' }}>Broker</th>
                          <th style={{ padding: '6px 4px' }}>Symbol</th>
                          <th style={{ padding: '6px 4px' }}>Side</th>
                          <th style={{ padding: '6px 4px' }}>Qty</th>
                          <th style={{ padding: '6px 4px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map(o => (
                          <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '8px 4px', fontWeight: '600' }}>{o.broker}</td>
                            <td style={{ padding: '8px 4px', color: '#38bdf8' }}>{o.symbol}</td>
                            <td style={{ padding: '8px 4px', color: o.side === 'BUY' ? '#22c55e' : '#ef4444', fontWeight: '700' }}>{o.side}</td>
                            <td style={{ padding: '8px 4px' }}>{o.qty}</td>
                            <td style={{ padding: '8px 4px' }}>
                              <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                                {o.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '13px' }}>
                    No records available
                  </div>
                )}
              </div>

              {/* Customer Support Card */}
              <div style={{ background: '#121826', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(34, 197, 94, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#22c55e',
                    marginBottom: '12px'
                  }}>
                    🎧
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>Customer Support</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    Professional assistance available for broker token renewal and TradingView bridge setups.
                  </div>
                </div>

                <a
                  href="https://t.me/skandx_support"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: '#0284c7',
                    color: '#fff',
                    textDecoration: 'none',
                    padding: '9px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    marginTop: '16px'
                  }}
                >
                  <Send size={14} /> Telegram Chat
                </a>
              </div>

            </div>

            {/* 5. TRADINGVIEW WEBHOOK BRIDGE MODAL CARD (When Json Bridge is inspected) */}
            <div style={{
              background: '#0a0e17',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: '#38bdf8' }}>
                  <Code size={15} /> TradingView Webhook Bridge URL & Alert Template
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(jsonWebhookSample);
                    setCopiedJson(true);
                    showToast('TradingView JSON alert template copied!');
                    setTimeout(() => setCopiedJson(false), 2000);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#cbd5e1',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  {copiedJson ? <Check size={12} /> : <Copy size={12} />}
                  {copiedJson ? 'Copied' : 'Copy JSON Alert'}
                </button>
              </div>

              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Target Webhook URL: <code style={{ color: '#22c55e', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px' }}>https://skandx.in/api/v1/bridge/webhook</code>
              </div>

              <pre style={{
                background: '#05070c',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '11.5px',
                color: '#38bdf8',
                overflowX: 'auto',
                margin: 0
              }}>
                {jsonWebhookSample}
              </pre>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
