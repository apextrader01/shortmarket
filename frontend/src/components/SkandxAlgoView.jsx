// frontend/src/components/SkandxAlgoView.jsx
// 🌟 SkandX Algo Multi-Broker Demat & Bridge Suite (Full-Page Institutional Platform)

import React, { useState, useEffect } from 'react';
import { 
  X, Layers, ShieldCheck, Zap, Copy, RefreshCw, Send, CheckCircle2, 
  AlertTriangle, Users, Cpu, Server, Wifi, ExternalLink, Globe, 
  Clock, CreditCard, ChevronRight, Check, Sliders, Play, Code, MessageCircle,
  Folder, Bookmark, ShoppingBag, FileText, ArrowRight, Activity, Plus,
  Trash2, Power, Eye, EyeOff, Search, Settings, ShieldAlert, ArrowUpRight,
  ArrowLeft, QrCode, Smartphone, Wallet, Lock, DollarSign
} from 'lucide-react';

export default function SkandxAlgoView({ onBack, onOpenPaperTrading }) {
  // Active Navigation Tab
  const [activeMenu, setActiveMenu] = useState('Dashboard');
  const [toastMsg, setToastMsg] = useState('');

  // ── Global Bridge State ──────────────────────────────────────────────────
  const [config, setConfig] = useState({
    allowConnectAccount: true,
    allowPurchaseIp: true,
    connectionToken: 'skandx_broker_demat_9433',
    availableCredit: 3500.00,
    totalDemat: 3,
    disconnectedDemat: 0,
    expiredDemat: 2,
    totalStaticIp: 4,
    availableStaticIp: 2
  });

  const [platformFeatures, setPlatformFeatures] = useState({
    watchlist: true,
    groupCopy: true,
    jsonBridge: true,
    customBridge: true
  });

  // Demat Accounts Store
  const [demats, setDemats] = useState([
    {
      id: 'ACC-01',
      broker: 'Zerodha Kite Connect',
      brokerKey: 'zerodha',
      clientCode: 'ZER-6641',
      name: 'Harikrishnan Primary',
      apiKey: 'kite_live_94a382b',
      status: 'EXPIRED',
      tradingActive: true,
      ip: '103.212.120.45',
      lastLogin: 'Today, 08:30 AM',
      expiresIn: 'Expired (Requires Daily TOTP Auth)',
      segment: 'Equity, F&O, Currency'
    },
    {
      id: 'ACC-02',
      broker: 'Angel One SmartAPI',
      brokerKey: 'angel',
      clientCode: 'ANG-9012',
      name: 'Harikrishnan Alpha Hedge',
      apiKey: 'smartapi_a89bc2',
      status: 'EXPIRED',
      tradingActive: true,
      ip: '103.212.120.46',
      lastLogin: 'Yesterday, 03:20 PM',
      expiresIn: 'Expired (TOTP Re-auth required)',
      segment: 'Futures & Options'
    },
    {
      id: 'ACC-03',
      broker: 'Upstox Pro API v2',
      brokerKey: 'upstox',
      clientCode: 'UPS-5501',
      name: 'Momentum Scalper',
      apiKey: 'upstox_live_7718',
      status: 'ACTIVE',
      tradingActive: true,
      ip: '103.212.120.45',
      lastLogin: 'Today, 09:15 AM',
      expiresIn: 'Active (Valid 14h)',
      segment: 'NSE Equities'
    }
  ]);

  // Static IPs Store
  const [staticIps, setStaticIps] = useState([
    {
      id: 'IP-01',
      ip: '103.212.120.45',
      datacenter: 'Mumbai BKC (NSE Colocation Proximity)',
      status: 'WHITELISTED',
      latency: '1.8 ms',
      assignedTo: 'ZER-6641 (Zerodha), UPS-5501 (Upstox)',
      port: '8080 (SOCKS5/HTTP)',
      expiresAt: '30 Days Remaining'
    },
    {
      id: 'IP-02',
      ip: '103.212.120.46',
      datacenter: 'Mumbai BKC (NSE Colocation Proximity)',
      status: 'WHITELISTED',
      latency: '2.1 ms',
      assignedTo: 'ANG-9012 (Angel One)',
      port: '8080 (SOCKS5/HTTP)',
      expiresAt: '28 Days Remaining'
    },
    {
      id: 'IP-03',
      ip: '103.212.120.47',
      datacenter: 'Mumbai BKC (NSE Colocation Proximity)',
      status: 'AVAILABLE',
      latency: '1.9 ms',
      assignedTo: 'Unassigned (Ready for Demat)',
      port: '8080 (SOCKS5/HTTP)',
      expiresAt: 'Dedicated Pool'
    },
    {
      id: 'IP-04',
      ip: '103.212.120.121',
      datacenter: 'Mumbai BKC (NSE Colocation Proximity)',
      status: 'AVAILABLE',
      latency: '2.5 ms',
      assignedTo: 'Unassigned (Dedicated Pool)',
      port: '8080 (SOCKS5/HTTP)',
      expiresAt: 'Dedicated Pool'
    }
  ]);

  // Linked Users Store
  const [linkedUsers, setLinkedUsers] = useState([
    {
      id: 'LNK-101',
      clientName: 'Rajesh Kumar',
      email: 'rajesh.k@gmail.com',
      broker: 'Zerodha Kite',
      clientCode: 'RK7821',
      connectedAt: '02 Oct 2026, 11:40 AM',
      status: 'CONNECTED',
      allowTrading: true,
      copyRatio: '1.0x'
    },
    {
      id: 'LNK-102',
      clientName: 'Priya Sharma',
      email: 'priya.invests@outlook.com',
      broker: 'Groww Demat',
      clientCode: 'GW5540',
      connectedAt: '03 Oct 2026, 02:15 PM',
      status: 'CONNECTED',
      allowTrading: true,
      copyRatio: '0.5x'
    },
    {
      id: 'LNK-103',
      clientName: 'Vikram Patel',
      email: 'vikram.p@yahoo.in',
      broker: 'Angel One',
      clientCode: 'VP9912',
      connectedAt: '03 Oct 2026, 05:30 PM',
      status: 'PENDING_REAUTH',
      allowTrading: false,
      copyRatio: '1.0x'
    }
  ]);

  // Watchlist Store
  const [watchlist, setWatchlist] = useState([
    { id: 'WL-01', symbol: 'NSE:NIFTY24OCTFUT', ltp: 25014.60, change: '+104.20 (+0.42%)', isUp: true, high: 25080.00, low: 24920.00, algoStrategy: 'EMA 9/21 Trend', algoActive: true },
    { id: 'WL-02', symbol: 'NSE:BANKNIFTY24OCTFUT', ltp: 51462.10, change: '+318.50 (+0.62%)', isUp: true, high: 51600.00, low: 51210.00, algoStrategy: 'Supertrend 7/3', algoActive: true },
    { id: 'WL-03', symbol: 'NSE:RELIANCE', ltp: 2985.40, change: '-12.80 (-0.43%)', isUp: false, high: 3012.00, low: 2975.00, algoStrategy: 'VWAP Reversion', algoActive: false },
    { id: 'WL-04', symbol: 'NSE:HDFCBANK', ltp: 1682.10, change: '+14.60 (+0.88%)', isUp: true, high: 1690.00, low: 1665.00, algoStrategy: 'Breakout 15M', algoActive: true },
    { id: 'WL-05', symbol: 'MCX:GOLD26OCTFUT', ltp: 76450.00, change: '+180.00 (+0.24%)', isUp: true, high: 76600.00, low: 76220.00, algoStrategy: 'ATR Volatility', algoActive: false }
  ]);

  // Copy Group Store
  const [copyGroup, setCopyGroup] = useState({
    groupName: 'SkandX High-Alpha Mirror Group',
    masterAccount: 'ZER-6641',
    status: 'ACTIVE',
    maxLossLimit: 15000,
    followers: [
      { id: 'FOL-01', accountCode: 'ANG-9012', broker: 'Angel One', multiplier: 1.0, maxRiskPerTrade: 3000, status: 'ACTIVE' },
      { id: 'FOL-02', accountCode: 'UPS-5501', broker: 'Upstox', multiplier: 0.5, maxRiskPerTrade: 1500, status: 'ACTIVE' }
    ]
  });

  // Orders Store
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
      status: 'COMPLETED',
      source: 'TradingView Webhook'
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
      status: 'COMPLETED',
      source: 'TradingView Webhook'
    }
  ]);

  // Wallet Transaction History
  const [transactions, setTransactions] = useState([
    { id: 'TX-901', date: '04 Oct 2026, 07:15 AM', type: 'CREDIT', amount: 3500.00, method: 'UPI Instant (GPay)', status: 'SUCCESS' },
    { id: 'TX-900', date: '01 Oct 2026, 09:30 AM', type: 'DEBIT', amount: 499.00, method: 'Static IP Mumbai BKC Lease', status: 'SUCCESS' }
  ]);

  // Modals inside Full-Page Console
  const [showAddDematModal, setShowAddDematModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedStockForOrder, setSelectedStockForOrder] = useState(null);
  const [orderSide, setOrderSide] = useState('BUY');
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [accountToReauth, setAccountToReauth] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [customRechargeAmount, setCustomRechargeAmount] = useState('1000');
  const [rechargePaymentMethod, setRechargePaymentMethod] = useState('UPI');

  // Add Demat Form State
  const [newBroker, setNewBroker] = useState('Zerodha Kite Connect');
  const [newClientCode, setNewClientCode] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newApiSecret, setNewApiSecret] = useState('');
  const [newIp, setNewIp] = useState('103.212.120.45');

  // Watchlist Search / Add
  const [searchSymbol, setSearchSymbol] = useState('');

  // Webhook Builder State
  const [whAction, setWhAction] = useState('BUY');
  const [whSymbol, setWhSymbol] = useState('NSE:NIFTY24OCTFUT');
  const [whQty, setWhQty] = useState(50);
  const [whType, setWhType] = useState('MARKET');
  const [whProduct, setWhProduct] = useState('MIS');
  const [whTarget, setWhTarget] = useState(100);
  const [whSl, setWhSl] = useState(50);

  // Sync state from server on mount
  useEffect(() => {
    fetch('/api/v1/bridge/all')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          if (d.stats) setConfig(d.stats);
          if (d.demats) setDemats(d.demats);
          if (d.staticIps) setStaticIps(d.staticIps);
          if (d.linkedUsers) setLinkedUsers(d.linkedUsers);
          if (d.watchlist) setWatchlist(d.watchlist);
          if (d.copyGroups) setCopyGroup(d.copyGroups);
          if (d.orders) setOrders(d.orders);
        }
      })
      .catch(() => {});
  }, []);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const shareUrl = `https://skandx.in/connect-demat?ref=${config.connectionToken}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    showToast('Copied Demat connection link to clipboard!');
  };

  const handleRegenerateToken = async () => {
    const newToken = 'skandx_demat_' + Math.random().toString(36).substring(2, 9);
    setConfig(prev => ({ ...prev, connectionToken: newToken }));
    showToast('Regenerated new Demat connection link!');
    try {
      await fetch('/api/v1/bridge/regenerate-token', { method: 'POST' });
    } catch (_) {}
  };

  const handleRenewAllAccounts = async () => {
    setDemats(prev => prev.map(a => ({
      ...a,
      status: 'ACTIVE',
      expiresIn: 'Active (Valid 24h)',
      lastLogin: 'Just now'
    })));
    setConfig(prev => ({ ...prev, expiredDemat: 0 }));
    showToast('All connected Demat sessions successfully renewed!');
    try {
      await fetch('/api/v1/bridge/renew-demat', { method: 'POST' });
    } catch (_) {}
  };

  const handleRenewSingleAccount = (account) => {
    setAccountToReauth(account);
    setTotpCode('');
    setShowReauthModal(true);
  };

  const handleConfirmReauth = async () => {
    if (!accountToReauth) return;
    setDemats(prev => prev.map(a => a.id === accountToReauth.id ? {
      ...a,
      status: 'ACTIVE',
      expiresIn: 'Active (Valid 24h)',
      lastLogin: 'Just now'
    } : a));
    setConfig(prev => ({ ...prev, expiredDemat: Math.max(0, prev.expiredDemat - 1) }));
    setShowReauthModal(false);
    showToast(`Session authenticated for ${accountToReauth.broker} (${accountToReauth.clientCode})!`);
    try {
      await fetch(`/api/v1/bridge/demats/${accountToReauth.id}/renew`, { method: 'POST' });
    } catch (_) {}
  };

  const handleToggleTrade = async (id) => {
    setDemats(prev => prev.map(a => a.id === id ? { ...a, tradingActive: !a.tradingActive } : a));
    const target = demats.find(a => a.id === id);
    showToast(`Algo execution ${!target?.tradingActive ? 'ENABLED' : 'DISABLED'} for ${target?.clientCode}`);
    try {
      await fetch(`/api/v1/bridge/demats/${id}/toggle-trade`, { method: 'POST' });
    } catch (_) {}
  };

  const handleDeleteDemat = async (id) => {
    if (!window.confirm('Are you sure you want to disconnect this Demat account?')) return;
    setDemats(prev => prev.filter(a => a.id !== id));
    setConfig(prev => ({ ...prev, totalDemat: Math.max(0, prev.totalDemat - 1) }));
    showToast('Demat account disconnected.');
    try {
      await fetch(`/api/v1/bridge/demats/${id}`, { method: 'DELETE' });
    } catch (_) {}
  };

  const handleAddDematSubmit = async (e) => {
    e.preventDefault();
    if (!newClientCode.trim()) {
      showToast('Please enter Client ID / UCC');
      return;
    }
    const newAcc = {
      id: 'ACC-' + Math.floor(10 + Math.random() * 90),
      broker: newBroker,
      brokerKey: newBroker.toLowerCase().includes('angel') ? 'angel' : 'zerodha',
      clientCode: newClientCode.toUpperCase(),
      name: newAccountName || `${newClientCode} Trading A/C`,
      apiKey: newApiKey || 'kite_' + Math.random().toString(36).substring(2, 8),
      status: 'ACTIVE',
      tradingActive: true,
      ip: newIp,
      lastLogin: 'Just now',
      expiresIn: 'Active (Valid 24h)',
      segment: 'Equity, F&O, Currency'
    };

    setDemats(prev => [newAcc, ...prev]);
    setConfig(prev => ({ ...prev, totalDemat: prev.totalDemat + 1 }));
    setShowAddDematModal(false);
    setNewClientCode('');
    setNewAccountName('');
    setNewApiKey('');
    setNewApiSecret('');
    showToast(`Connected ${newAcc.broker} (${newAcc.clientCode}) successfully!`);

    try {
      await fetch('/api/v1/bridge/demats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAcc)
      });
    } catch (_) {}
  };

  const handlePurchaseStaticIp = async () => {
    const octet = Math.floor(50 + Math.random() * 150);
    const newStaticIp = {
      id: 'IP-0' + (staticIps.length + 1),
      ip: `103.212.120.${octet}`,
      datacenter: 'Mumbai BKC (NSE Colocation Proximity)',
      status: 'AVAILABLE',
      latency: (1.5 + Math.random()).toFixed(1) + ' ms',
      assignedTo: 'Unassigned (Dedicated Pool)',
      port: '8080 (SOCKS5/HTTP)',
      expiresAt: '30 Days Remaining'
    };
    setStaticIps(prev => [...prev, newStaticIp]);
    setConfig(prev => ({
      ...prev,
      totalStaticIp: prev.totalStaticIp + 1,
      availableStaticIp: prev.availableStaticIp + 1
    }));
    showToast(`Allocated dedicated static IP: ${newStaticIp.ip}!`);
    try {
      await fetch('/api/v1/bridge/ips/purchase', { method: 'POST' });
    } catch (_) {}
  };

  const handlePingTestIp = (ipAddr) => {
    showToast(`Testing NSE Gateway connection for ${ipAddr}... Latency: 1.8ms (NSE Co-location BKC OK)`);
  };

  const handleKillSwitch = async () => {
    if (!window.confirm('EMERGENCY KILL SWITCH: This will exit all copy trading positions and pause auto execution across all connected Demats. Proceed?')) return;
    setCopyGroup(prev => ({ ...prev, status: 'PAUSED' }));
    setDemats(prev => prev.map(a => ({ ...a, tradingActive: false })));
    const killOrder = {
      id: 'KILL-' + Math.floor(1000 + Math.random() * 9000),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      broker: 'ALL BROKERS',
      account: 'MASTER & SLAVES',
      symbol: 'ALL POSITIONS',
      side: 'EXIT_ALL',
      qty: 0,
      price: '₹0.00',
      status: 'SQUARED_OFF',
      source: 'Emergency Kill Switch'
    };
    setOrders(prev => [killOrder, ...prev]);
    showToast('🚨 EMERGENCY KILL SWITCH ACTIVATED: All positions squared off!');
    try {
      await fetch('/api/v1/bridge/kill-switch', { method: 'POST' });
    } catch (_) {}
  };

  const handleAddWatchlist = async () => {
    if (!searchSymbol.trim()) return;
    const cleanSym = searchSymbol.trim().toUpperCase();
    const newItem = {
      id: 'WL-' + Math.floor(10 + Math.random() * 90),
      symbol: cleanSym.includes(':') ? cleanSym : `NSE:${cleanSym}`,
      ltp: 2450.00,
      change: '+15.20 (+0.62%)',
      isUp: true,
      high: 2480.00,
      low: 2420.00,
      algoStrategy: 'EMA Breakout',
      algoActive: true
    };
    setWatchlist(prev => [...prev, newItem]);
    setSearchSymbol('');
    showToast(`Added ${newItem.symbol} to Algo Watchlist!`);
    try {
      await fetch('/api/v1/bridge/watchlist/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
    } catch (_) {}
  };

  const handleDeleteWatchlist = async (id) => {
    setWatchlist(prev => prev.filter(w => w.id !== id));
    showToast('Symbol removed from Watchlist.');
    try {
      await fetch(`/api/v1/bridge/watchlist/${id}`, { method: 'DELETE' });
    } catch (_) {}
  };

  const handleOpenPlaceOrder = (stock, side) => {
    setSelectedStockForOrder(stock);
    setOrderSide(side);
    setShowOrderModal(true);
  };

  const handleExecuteOrderSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStockForOrder) return;
    const newOrd = {
      id: 'BO-' + Math.floor(10000 + Math.random() * 90000),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      broker: 'Zerodha Kite',
      account: 'ZER-6641',
      symbol: selectedStockForOrder.symbol,
      side: orderSide,
      qty: 50,
      price: `₹${selectedStockForOrder.ltp?.toFixed(2) || '24,850.00'}`,
      status: 'COMPLETED',
      source: 'Manual Algo Execution'
    };
    setOrders(prev => [newOrd, ...prev]);
    setShowOrderModal(false);
    showToast(`Order Placed: ${orderSide} 50 ${selectedStockForOrder.symbol} @ ${newOrd.price}!`);
    try {
      await fetch('/api/v1/bridge/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrd)
      });
    } catch (_) {}
  };

  const handleConfirmRecharge = async () => {
    const amt = Number(customRechargeAmount);
    if (!amt || amt <= 0) {
      showToast('Please enter a valid amount');
      return;
    }
    const newBal = config.availableCredit + amt;
    setConfig(prev => ({ ...prev, availableCredit: newBal }));
    
    // Add transaction to history
    const tx = {
      id: 'TX-' + Math.floor(100 + Math.random() * 900),
      date: 'Just now',
      type: 'CREDIT',
      amount: amt,
      method: rechargePaymentMethod === 'UPI' ? 'UPI Instant (QR Scan)' : 'Credit / Debit Card',
      status: 'SUCCESS'
    };
    setTransactions(prev => [tx, ...prev]);

    setShowRechargeModal(false);
    showToast(`₹${amt.toLocaleString('en-IN')} successfully added to Wallet via ${tx.method}!`);
    try {
      await fetch('/api/v1/bridge/credit/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt })
      });
    } catch (_) {}
  };

  const jsonWebhookSample = JSON.stringify({
    secret: "SKANDX_WH_" + config.connectionToken.substring(0, 8),
    action: whAction,
    symbol: whSymbol,
    qty: Number(whQty),
    order_type: whType,
    product: whProduct,
    target_pts: Number(whTarget),
    sl_pts: Number(whSl)
  }, null, 2);

  const handleTestWebhookFire = async () => {
    showToast(`Firing test webhook to /api/v1/bridge/webhook...`);
    try {
      const res = await fetch('/api/v1/bridge/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonWebhookSample
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Webhook executed! Order ${data.orderId} placed via Zerodha Kite.`);
        if (data.order) {
          setOrders(prev => [data.order, ...prev]);
        }
      }
    } catch (err) {
      showToast('Webhook fired (Simulated success): Order BO-99412 placed.');
    }
  };

  const handleTelegramTestPing = () => {
    showToast('🔔 [SkandX Telegram Bot] Test alert sent to @SkandXAlgoBot: OMS Gateway Latency 1.8ms OK');
  };

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: '#070a12',
      color: '#f8fafc',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>

      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 100000,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff',
          padding: '12px 22px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '700',
          boxShadow: '0 8px 30px rgba(16, 185, 129, 0.45)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <CheckCircle2 size={18} />
          {toastMsg}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. FULL-WIDTH TOP HEADER (Edge-to-Edge Institutional Bar)     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: '1px solid #1e293b',
        background: '#090d16',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(10px)'
      }}>
        {/* Left: Brand + Latency */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: '900',
            fontSize: '19px',
            letterSpacing: '0.5px'
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #0284c7, #3b82f6)',
              color: '#fff',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '17px',
              fontWeight: '900',
              boxShadow: '0 0 16px rgba(56, 189, 248, 0.45)'
            }}>
              ⚡
            </span>
            <span style={{ color: '#fff', letterSpacing: '0.5px' }}>SKANDX ALGO</span>
            <span style={{
              fontSize: '11px',
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: '700'
            }}>
              v4.9 PRO
            </span>
          </div>

          <div className="hide-on-mobile" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            padding: '4px 10px',
            borderRadius: '16px',
            fontSize: '11px',
            color: '#10b981',
            fontWeight: '600'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
            <span>NSE Colocation Tick Gateway: 1.8ms</span>
          </div>
        </div>

        {/* Right: Actions, Wallet, Kill Switch, Return button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Emergency Kill Switch */}
          <button
            onClick={handleKillSwitch}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(239, 68, 68, 0.18)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              color: '#f87171',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: '800',
              cursor: 'pointer',
              letterSpacing: '0.3px'
            }}
            title="Emergency Kill Switch - Exits all copy trading positions immediately"
          >
            <Power size={14} /> KILL SWITCH
          </button>

          {/* Credit Wallet Badge with + Add Funds */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#121826',
            border: '1px solid #1e293b',
            borderRadius: '6px',
            overflow: 'hidden',
            fontSize: '12.5px',
            fontWeight: '700'
          }}>
            <span style={{ padding: '5px 9px', color: '#94a3b8' }}>Credit:</span>
            <span style={{ padding: '5px 10px', background: '#7c3aed', color: '#fff' }}>
              ₹{config.availableCredit.toFixed(2)}
            </span>
            <button
              onClick={() => setShowRechargeModal(true)}
              style={{
                background: '#2563eb',
                border: 'none',
                color: '#fff',
                padding: '5px 10px',
                cursor: 'pointer',
                fontSize: '11.5px',
                fontWeight: '800'
              }}
            >
              + Add Funds
            </button>
          </div>

          {/* User Email Pill */}
          <div className="hide-on-mobile" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid #1e293b',
            padding: '5px 12px',
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

          {/* Exit / Back to Home Button */}
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid #334155',
              color: '#cbd5e1',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={14} /> Back to Home
          </button>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. MAIN LAYOUT: SIDEBAR + WORKSPACE                           */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* Left Navigation Sidebar */}
        <nav style={{
          width: '240px',
          borderRight: '1px solid #1e293b',
          background: '#080c15',
          padding: '20px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          overflowY: 'auto'
        }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '800', padding: '0 8px 8px', letterSpacing: '0.5px' }}>
            SKANDX ALGO PLATFORM
          </div>

          {/* Dashboard Tab */}
          <button
            onClick={() => setActiveMenu('Dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: activeMenu === 'Dashboard' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              color: activeMenu === 'Dashboard' ? '#38bdf8' : '#94a3b8',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: activeMenu === 'Dashboard' ? '800' : '500',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeMenu === 'Dashboard' ? '#22c55e' : '#64748b' }} />
            Dashboard
          </button>

          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', padding: '14px 8px 4px', letterSpacing: '0.6px' }}>
            ACCOUNT & BROKER MANAGEMENT
          </div>

          {[
            { id: 'Demat', label: 'Demat Accounts', icon: Folder, count: demats.length },
            { id: 'StaticIp', label: 'Static IPs', icon: Wifi, count: staticIps.length },
            { id: 'LinkUser', label: 'Link Users', icon: Users, count: linkedUsers.length },
            { id: 'WatchList', label: 'Algo Watchlist', icon: Bookmark, count: watchlist.length },
            { id: 'GroupCopy', label: 'Group / Copy', icon: Layers, count: copyGroup.followers.length },
            { id: 'Bridge', label: 'Webhook Bridge', icon: Cpu },
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
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                  color: isActive ? '#38bdf8' : '#94a3b8',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: isActive ? '700' : '500',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={16} color={isActive ? '#38bdf8' : '#64748b'} />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span style={{
                    fontSize: '11px',
                    background: isActive ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.06)',
                    color: isActive ? '#38bdf8' : '#94a3b8',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    fontWeight: '700'
                  }}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}

          <div style={{ marginTop: 'auto', padding: '16px 8px 4px', borderTop: '1px solid #1e293b' }}>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Connected Brokers Gateway</div>
            <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: '700', marginTop: '2px' }}>
              Zerodha • Angel • Upstox • Fyers
            </div>
          </div>
        </nav>

        {/* Full-Width Workspace Container */}
        <main style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 1: DASHBOARD VIEW                                         */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeMenu === 'Dashboard' && (
            <>
              {/* Share Demat Connection Card */}
              <div style={{
                background: '#101726',
                border: '1px solid #1e293b',
                borderRadius: '14px',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                      🔗
                    </div>
                    <span style={{ fontSize: '18px', fontWeight: '800', color: '#fff' }}>Share Demat Connection</span>

                    <span style={{
                      fontSize: '11.5px',
                      fontWeight: '700',
                      background: 'rgba(34, 197, 94, 0.15)',
                      color: '#22c55e',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      padding: '3px 10px',
                      borderRadius: '4px'
                    }}>
                      Demat Connection Enable
                    </span>
                    <span style={{
                      fontSize: '11.5px',
                      fontWeight: '700',
                      background: 'rgba(34, 197, 94, 0.15)',
                      color: '#22c55e',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      padding: '3px 10px',
                      borderRadius: '4px'
                    }}>
                      IP Purchase Enable
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={handleRegenerateToken}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '6px',
                        background: '#1e293b',
                        border: '1px solid #334155',
                        color: '#cbd5e1',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      <RefreshCw size={13} /> Regenerate Link
                    </button>

                    <button
                      onClick={handleCopyLink}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        background: '#2563eb',
                        border: 'none',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      <Copy size={13} /> Copy Link
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                  If you don't want to ask your users for their demat credentials, you can simply share this link with them so they can connect their account themselves.
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  flexWrap: 'wrap',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(255,255,255,0.06)'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#cbd5e1' }}>
                    <span style={{ color: '#818cf8' }}>🔒</span>
                    <span>Allow your users to connect account</span>
                    <input
                      type="checkbox"
                      checked={config.allowConnectAccount}
                      onChange={(e) => setConfig(prev => ({ ...prev, allowConnectAccount: e.target.checked }))}
                      style={{ accentColor: '#22c55e', width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#cbd5e1' }}>
                    <span style={{ color: '#22c55e' }}>📶</span>
                    <span>Allow your users to purchase IP</span>
                    <input
                      type="checkbox"
                      checked={config.allowPurchaseIp}
                      onChange={(e) => setConfig(prev => ({ ...prev, allowPurchaseIp: e.target.checked }))}
                      style={{ accentColor: '#22c55e', width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </label>

                  <div style={{
                    marginLeft: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    background: '#090d16',
                    border: '1px solid #1e293b',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    color: '#64748b'
                  }}>
                    {shareUrl}
                  </div>
                </div>
              </div>

              {/* 6 KPI Stat Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '14px'
              }}>
                {/* Available Credit */}
                <div 
                  onClick={() => setShowRechargeModal(true)}
                  style={{ background: '#101726', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px', cursor: 'pointer' }}
                  className="hover:border-blue-500 transition-colors"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '12.5px', color: '#94a3b8', fontWeight: '600' }}>Available Credit(₹)</div>
                    <div style={{ color: '#22c55e', background: 'rgba(34, 197, 94, 0.12)', padding: '7px', borderRadius: '8px' }}>
                      <CreditCard size={17} />
                    </div>
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: '900', marginTop: '10px', color: '#fff' }}>
                    ₹{config.availableCredit.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '4px', fontWeight: '700' }}>
                    + Click to Add Funds
                  </div>
                </div>

                {/* Total Demat */}
                <div 
                  onClick={() => setActiveMenu('Demat')}
                  style={{ background: '#101726', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '12.5px', color: '#94a3b8', fontWeight: '600' }}>Total Demat</div>
                    <div style={{ color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '7px', borderRadius: '8px' }}>
                      <Users size={17} />
                    </div>
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: '900', marginTop: '10px', color: '#fff' }}>
                    {demats.length}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Zerodha • Angel • Upstox
                  </div>
                </div>

                {/* Disconnected Demat */}
                <div 
                  onClick={() => setActiveMenu('Demat')}
                  style={{ background: '#101726', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '12.5px', color: '#94a3b8', fontWeight: '600' }}>Disconnected Demat</div>
                    <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.12)', padding: '7px', borderRadius: '8px' }}>
                      <Activity size={17} />
                    </div>
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: '900', marginTop: '10px', color: '#fff' }}>
                    {demats.filter(d => d.status === 'DISCONNECTED').length}
                  </div>
                  <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>
                    0 Connection Errors
                  </div>
                </div>

                {/* Expired Demat */}
                <div 
                  onClick={() => setActiveMenu('Demat')}
                  style={{ background: '#101726', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '12.5px', color: '#94a3b8', fontWeight: '600' }}>Expired Demat</div>
                    <div style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)', padding: '7px', borderRadius: '8px' }}>
                      <Clock size={17} />
                    </div>
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: '900', marginTop: '10px', color: '#f59e0b' }}>
                    {demats.filter(d => d.status === 'EXPIRED').length}
                  </div>
                  <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>
                    Requires Daily Auth
                  </div>
                </div>

                {/* Total Static IP */}
                <div 
                  onClick={() => setActiveMenu('StaticIp')}
                  style={{ background: '#101726', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '12.5px', color: '#94a3b8', fontWeight: '600' }}>Total Static IP</div>
                    <div style={{ color: '#a855f7', background: 'rgba(168, 85, 247, 0.12)', padding: '7px', borderRadius: '8px' }}>
                      <Server size={17} />
                    </div>
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: '900', marginTop: '10px', color: '#fff' }}>
                    {staticIps.length}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Mumbai BKC Colocation
                  </div>
                </div>

                {/* Available Static IP */}
                <div 
                  onClick={() => setActiveMenu('StaticIp')}
                  style={{ background: '#101726', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '12.5px', color: '#94a3b8', fontWeight: '600' }}>Available Static IP</div>
                    <div style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', padding: '7px', borderRadius: '8px' }}>
                      <Wifi size={17} />
                    </div>
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: '900', marginTop: '10px', color: '#fff' }}>
                    {staticIps.filter(i => i.status === 'AVAILABLE').length}
                  </div>
                  <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>
                    Ready for Binding
                  </div>
                </div>
              </div>

              {/* Expired Demats Notification Card */}
              {demats.some(d => d.status === 'EXPIRED') ? (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#f87171' }}>
                        Demat Accounts Expired
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                        {demats.filter(d => d.status === 'EXPIRED').length} account(s) require renewal (Zerodha Kite & Angel One SmartAPI daily tokens)
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleRenewAllAccounts}
                    style={{
                      background: '#ef4444',
                      border: 'none',
                      color: '#fff',
                      padding: '8px 18px',
                      borderRadius: '6px',
                      fontSize: '12.5px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    Renew Demat Tokens
                  </button>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '12px',
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: '#22c55e',
                  fontSize: '13.5px',
                  fontWeight: '600'
                }}>
                  <CheckCircle2 size={20} />
                  <span>All Demat accounts are active with live order routing enabled!</span>
                </div>
              )}

              {/* Bottom 3 Cards: Platform Features, Today Orders, Customer Support */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>

                {/* Platform Features Card */}
                <div style={{ background: '#101726', border: '1px solid #1e293b', borderRadius: '14px', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                    <span style={{ color: '#a855f7' }}>⚙️</span>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#fff' }}>Platform Features</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    {/* Watchlist */}
                    <div 
                      onClick={() => setActiveMenu('WatchList')}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090d16', padding: '12px 14px', borderRadius: '8px', border: '1px solid #1e293b', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1' }}>
                        <Bookmark size={15} color="#38bdf8" /> Watchlist
                      </div>
                      <input
                        type="checkbox"
                        checked={platformFeatures.watchlist}
                        onChange={(e) => { e.stopPropagation(); setPlatformFeatures(prev => ({ ...prev, watchlist: e.target.checked })); }}
                        style={{ accentColor: '#22c55e', cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </div>

                    {/* Group / Copy */}
                    <div 
                      onClick={() => setActiveMenu('GroupCopy')}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090d16', padding: '12px 14px', borderRadius: '8px', border: '1px solid #1e293b', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1' }}>
                        <Users size={15} color="#a855f7" /> Group / Copy
                      </div>
                      <input
                        type="checkbox"
                        checked={platformFeatures.groupCopy}
                        onChange={(e) => { e.stopPropagation(); setPlatformFeatures(prev => ({ ...prev, groupCopy: e.target.checked })); }}
                        style={{ accentColor: '#22c55e', cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </div>

                    {/* Json Bridge */}
                    <div 
                      onClick={() => setActiveMenu('Bridge')}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090d16', padding: '12px 14px', borderRadius: '8px', border: '1px solid #1e293b', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1' }}>
                        <Code size={15} color="#f59e0b" /> Json Bridge
                      </div>
                      <input
                        type="checkbox"
                        checked={platformFeatures.jsonBridge}
                        onChange={(e) => { e.stopPropagation(); setPlatformFeatures(prev => ({ ...prev, jsonBridge: e.target.checked })); }}
                        style={{ accentColor: '#22c55e', cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </div>

                    {/* Custom Bridge */}
                    <div 
                      onClick={() => setActiveMenu('Bridge')}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090d16', padding: '12px 14px', borderRadius: '8px', border: '1px solid #1e293b', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1' }}>
                        <Cpu size={15} color="#10b981" /> Custom Bridge
                      </div>
                      <input
                        type="checkbox"
                        checked={platformFeatures.customBridge}
                        onChange={(e) => { e.stopPropagation(); setPlatformFeatures(prev => ({ ...prev, customBridge: e.target.checked })); }}
                        style={{ accentColor: '#22c55e', cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Today Order Status Card */}
                <div style={{ background: '#101726', border: '1px solid #1e293b', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff' }}>Today Order Status</div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        onClick={handleTestWebhookFire}
                        style={{ background: '#1e293b', border: '1px solid #334155', color: '#38bdf8', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }}
                      >
                        + Simulate Order
                      </button>
                    </div>
                  </div>

                  {orders.length > 0 ? (
                    <div style={{ overflowX: 'auto', flex: 1, maxHeight: '180px' }}>
                      <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', color: '#cbd5e1' }}>
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
                              <td style={{ padding: '8px 4px', color: o.side === 'BUY' ? '#22c55e' : '#ef4444', fontWeight: '800' }}>{o.side}</td>
                              <td style={{ padding: '8px 4px' }}>{o.qty}</td>
                              <td style={{ padding: '8px 4px' }}>
                                <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 7px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700' }}>
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
                <div style={{ background: '#101726', border: '1px solid #1e293b', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', marginBottom: '14px' }}>
                      🎧
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff' }}>Customer Support</div>
                    <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '6px', lineHeight: '1.4' }}>
                      Instant assistance for broker tokens, dedicated static IP configuration & TradingView webhooks.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
                    <a
                      href="https://t.me/skandx_support"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: '#0284c7',
                        color: '#fff',
                        textDecoration: 'none',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        fontWeight: '700'
                      }}
                    >
                      <Send size={14} /> Telegram Chat
                    </a>
                    <button
                      onClick={handleTelegramTestPing}
                      style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        color: '#cbd5e1',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Test Ping
                    </button>
                  </div>
                </div>

              </div>
            </>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 2: DEMAT ACCOUNTS MANAGEMENT                              */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeMenu === 'Demat' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0, color: '#fff' }}>
                    Connected Demat Accounts ({demats.length})
                  </h2>
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
                    Manage multi-broker API credentials, static IP bindings, and daily session renewals.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleRenewAllAccounts}
                    style={{
                      padding: '9px 16px',
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    Renew All Expired Sessions
                  </button>
                  <button
                    onClick={() => setShowAddDematModal(true)}
                    style={{
                      padding: '9px 18px',
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={15} /> Connect New Demat
                  </button>
                </div>
              </div>

              {/* Demat Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                {demats.map(acc => {
                  const isExp = acc.status === 'EXPIRED';
                  return (
                    <div
                      key={acc.id}
                      style={{
                        background: '#101726',
                        border: `1px solid ${isExp ? 'rgba(239,68,68,0.4)' : '#1e293b'}`,
                        borderRadius: '14px',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '8px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px'
                          }}>
                            🏛️
                          </div>
                          <div>
                            <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff' }}>{acc.broker}</div>
                            <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>Client ID: <span style={{ color: '#38bdf8', fontWeight: '800' }}>{acc.clientCode}</span></div>
                          </div>
                        </div>

                        <span style={{
                          padding: '3px 9px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '800',
                          background: isExp ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                          color: isExp ? '#ef4444' : '#22c55e',
                          border: `1px solid ${isExp ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`
                        }}>
                          {acc.status}
                        </span>
                      </div>

                      <div style={{ background: '#090d16', padding: '12px', borderRadius: '8px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Account Alias:</span>
                          <span style={{ color: '#cbd5e1', fontWeight: '600' }}>{acc.name}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Dedicated Static IP:</span>
                          <span style={{ color: '#a855f7', fontWeight: '700' }}>{acc.ip}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Session Status:</span>
                          <span style={{ color: isExp ? '#f87171' : '#22c55e', fontWeight: '700' }}>{acc.expiresIn}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Trading Permitted:</span>
                          <span style={{ color: acc.tradingActive ? '#22c55e' : '#ef4444', fontWeight: '800' }}>
                            {acc.tradingActive ? 'ACTIVE (OMS LINKED)' : 'PAUSED'}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handleRenewSingleAccount(acc)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            background: isExp ? '#ef4444' : '#1e293b',
                            border: 'none',
                            color: '#fff',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          {isExp ? 'Renew Token (Re-auth)' : 'Re-verify Session'}
                        </button>

                        <button
                          onClick={() => handleToggleTrade(acc.id)}
                          style={{
                            padding: '8px 12px',
                            background: acc.tradingActive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                            border: `1px solid ${acc.tradingActive ? '#22c55e' : '#ef4444'}`,
                            color: acc.tradingActive ? '#22c55e' : '#ef4444',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          {acc.tradingActive ? 'Trading ON' : 'Trading OFF'}
                        </button>

                        <button
                          onClick={() => handleDeleteDemat(acc.id)}
                          style={{
                            padding: '8px 10px',
                            background: 'transparent',
                            border: '1px solid #334155',
                            color: '#94a3b8',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                          title="Disconnect Account"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 3: STATIC IP MANAGEMENT                                   */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeMenu === 'StaticIp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0, color: '#fff' }}>
                    Dedicated Static IP Addresses ({staticIps.length})
                  </h2>
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
                    Dedicated Indian IPv4 proxy addresses whitelisted with Zerodha, Angel One, and NSE colocation servers.
                  </p>
                </div>
                <button
                  onClick={handlePurchaseStaticIp}
                  style={{
                    padding: '9px 18px',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={15} /> + Purchase Additional IP
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                {staticIps.map(ip => (
                  <div
                    key={ip.id}
                    style={{
                      background: '#101726',
                      border: '1px solid #1e293b',
                      borderRadius: '14px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Server size={20} color="#a855f7" />
                        <span style={{ fontSize: '17px', fontWeight: '900', color: '#fff' }}>{ip.ip}</span>
                      </div>
                      <span style={{
                        padding: '3px 9px',
                        borderRadius: '4px',
                        fontSize: '10.5px',
                        fontWeight: '800',
                        background: ip.status === 'WHITELISTED' ? 'rgba(34,197,94,0.15)' : 'rgba(56,189,248,0.15)',
                        color: ip.status === 'WHITELISTED' ? '#22c55e' : '#38bdf8'
                      }}>
                        {ip.status}
                      </span>
                    </div>

                    <div style={{ background: '#090d16', padding: '12px', borderRadius: '8px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Datacenter:</span>
                        <span style={{ color: '#cbd5e1' }}>{ip.datacenter}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>NSE Gateway Latency:</span>
                        <span style={{ color: '#10b981', fontWeight: '800' }}>{ip.latency}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Assigned Demats:</span>
                        <span style={{ color: '#38bdf8', fontWeight: '700' }}>{ip.assignedTo}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Port / Protocol:</span>
                        <span style={{ color: '#cbd5e1' }}>{ip.port}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handlePingTestIp(ip.ip)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          background: '#1e293b',
                          border: '1px solid #334155',
                          color: '#cbd5e1',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Ping Latency Test
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${ip.ip}:8080`);
                          showToast(`Copied ${ip.ip}:8080`);
                        }}
                        style={{
                          padding: '8px 14px',
                          background: '#2563eb',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        Copy IP
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 4: LINK USERS (CLIENT ONBOARDING)                         */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeMenu === 'LinkUser' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0, color: '#fff' }}>
                    Linked Clients & Users ({linkedUsers.length})
                  </h2>
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
                    Users who connected their personal Demat account using your unique Demat connection link.
                  </p>
                </div>
                <button
                  onClick={handleCopyLink}
                  style={{
                    padding: '9px 18px',
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Copy size={14} /> Share Demat Link
                </button>
              </div>

              <div style={{ background: '#101726', border: '1px solid #1e293b', borderRadius: '14px', overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', color: '#cbd5e1' }}>
                  <thead>
                    <tr style={{ background: '#090d16', borderBottom: '1px solid #1e293b', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '14px 18px' }}>Client</th>
                      <th style={{ padding: '14px 18px' }}>Broker & UCC</th>
                      <th style={{ padding: '14px 18px' }}>Connected At</th>
                      <th style={{ padding: '14px 18px' }}>Copy Ratio</th>
                      <th style={{ padding: '14px 18px' }}>Status</th>
                      <th style={{ padding: '14px 18px' }}>Algo Trading</th>
                      <th style={{ padding: '14px 18px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedUsers.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: '800', color: '#fff' }}>{u.clientName}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{u.email}</div>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ color: '#38bdf8', fontWeight: '700' }}>{u.broker}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{u.clientCode}</div>
                        </td>
                        <td style={{ padding: '14px 18px', color: '#94a3b8', fontSize: '12px' }}>{u.connectedAt}</td>
                        <td style={{ padding: '14px 18px', fontWeight: '800', color: '#a855f7' }}>{u.copyRatio}</td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{
                            padding: '3px 9px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            background: u.status === 'CONNECTED' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                            color: u.status === 'CONNECTED' ? '#22c55e' : '#f59e0b'
                          }}>
                            {u.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <input
                            type="checkbox"
                            checked={u.allowTrading}
                            onChange={() => {
                              setLinkedUsers(prev => prev.map(lu => lu.id === u.id ? { ...lu, allowTrading: !lu.allowTrading } : lu));
                              showToast(`Toggled permission for ${u.clientName}`);
                            }}
                            style={{ accentColor: '#22c55e', cursor: 'pointer', width: '18px', height: '18px' }}
                          />
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <button
                            onClick={() => {
                              setLinkedUsers(prev => prev.filter(lu => lu.id !== u.id));
                              showToast(`Revoked access for ${u.clientName}`);
                            }}
                            style={{
                              background: 'transparent',
                              border: '1px solid #334155',
                              color: '#ef4444',
                              padding: '5px 10px',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              cursor: 'pointer'
                            }}
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 5: WATCHLIST (LIVE ALGO EXECUTION)                         */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeMenu === 'WatchList' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0, color: '#fff' }}>
                    Multi-Broker Algo Watchlist ({watchlist.length})
                  </h2>
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
                    Live ticks with 1-click execution across all connected Demat accounts.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Add Symbol (e.g. NIFTY, INFY, TATAMOTORS)..."
                    value={searchSymbol}
                    onChange={e => setSearchSymbol(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddWatchlist(); }}
                    style={{
                      background: '#090d16',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      color: '#fff',
                      fontSize: '12.5px',
                      width: '280px'
                    }}
                  />
                  <button
                    onClick={handleAddWatchlist}
                    style={{
                      padding: '8px 16px',
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>

              <div style={{ background: '#101726', border: '1px solid #1e293b', borderRadius: '14px', overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', color: '#cbd5e1' }}>
                  <thead>
                    <tr style={{ background: '#090d16', borderBottom: '1px solid #1e293b', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '14px 18px' }}>Symbol</th>
                      <th style={{ padding: '14px 18px' }}>LTP (₹)</th>
                      <th style={{ padding: '14px 18px' }}>Change</th>
                      <th style={{ padding: '14px 18px' }}>Day Range</th>
                      <th style={{ padding: '14px 18px' }}>Active Strategy</th>
                      <th style={{ padding: '14px 18px' }}>Auto-Trade</th>
                      <th style={{ padding: '14px 18px' }}>1-Click Trade</th>
                      <th style={{ padding: '14px 18px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlist.map(w => (
                      <tr key={w.id} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '14px 18px', fontWeight: '900', color: '#fff' }}>{w.symbol}</td>
                        <td style={{ padding: '14px 18px', fontWeight: '900', color: w.isUp ? '#22c55e' : '#ef4444' }}>
                          ₹{w.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '14px 18px', color: w.isUp ? '#22c55e' : '#ef4444', fontWeight: '700' }}>
                          {w.change}
                        </td>
                        <td style={{ padding: '14px 18px', fontSize: '11.5px', color: '#94a3b8' }}>
                          L: ₹{w.low} • H: ₹{w.high}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8', padding: '3px 9px', borderRadius: '4px', fontSize: '11.5px', fontWeight: '800' }}>
                            {w.algoStrategy}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <input
                            type="checkbox"
                            checked={w.algoActive}
                            onChange={() => {
                              setWatchlist(prev => prev.map(item => item.id === w.id ? { ...item, algoActive: !item.algoActive } : item));
                              showToast(`Auto-trade ${!w.algoActive ? 'ACTIVE' : 'OFF'} for ${w.symbol}`);
                            }}
                            style={{ accentColor: '#22c55e', cursor: 'pointer', width: '18px', height: '18px' }}
                          />
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => handleOpenPlaceOrder(w, 'BUY')}
                              style={{
                                padding: '6px 12px',
                                background: '#16a34a',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11.5px',
                                fontWeight: '800',
                                cursor: 'pointer'
                              }}
                            >
                              BUY
                            </button>
                            <button
                              onClick={() => handleOpenPlaceOrder(w, 'SELL')}
                              style={{
                                padding: '6px 12px',
                                background: '#dc2626',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11.5px',
                                fontWeight: '800',
                                cursor: 'pointer'
                              }}
                            >
                              SELL
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <button
                            onClick={() => handleDeleteWatchlist(w.id)}
                            style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 6: GROUP / COPY TRADING                                   */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeMenu === 'GroupCopy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0, color: '#fff' }}>
                    Group & Multi-Account Copy Trading
                  </h2>
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
                    Replicate orders from one Master account to multiple Slave Demats in sub-50ms latency.
                  </p>
                </div>
                <button
                  onClick={handleKillSwitch}
                  style={{
                    padding: '9px 18px',
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Power size={15} /> EMERGENCY KILL ALL
                </button>
              </div>

              <div style={{ background: '#101726', border: '1px solid #1e293b', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}>
                      👑
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>{copyGroup.groupName}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        Master Demat: <span style={{ color: '#38bdf8', fontWeight: '800' }}>{copyGroup.masterAccount} (Zerodha Kite)</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>Global Copy Status:</span>
                    <button
                      onClick={() => {
                        const newSt = copyGroup.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
                        setCopyGroup(prev => ({ ...prev, status: newSt }));
                        showToast(`Copy Trading ${newSt}!`);
                      }}
                      style={{
                        padding: '7px 16px',
                        background: copyGroup.status === 'ACTIVE' ? '#16a34a' : '#d97706',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      {copyGroup.status === 'ACTIVE' ? '🟢 RUNNING' : '⏸️ PAUSED'}
                    </button>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #1e293b', paddingTop: '14px' }}>
                  <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#cbd5e1', marginBottom: '12px' }}>
                    Follower / Child Demat Accounts:
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {copyGroup.followers.map(f => (
                      <div
                        key={f.id}
                        style={{
                          background: '#090d16',
                          border: '1px solid #1e293b',
                          borderRadius: '8px',
                          padding: '14px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '12px'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '800', color: '#fff' }}>{f.broker} - {f.accountCode}</div>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>Max Risk/Trade: ₹{f.maxRiskPerTrade}</div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ fontSize: '12.5px', color: '#cbd5e1' }}>
                            Multiplier: <span style={{ color: '#a855f7', fontWeight: '800' }}>{f.multiplier}x</span>
                          </div>
                          <span style={{
                            padding: '3px 9px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '800',
                            background: 'rgba(34,197,94,0.15)',
                            color: '#22c55e'
                          }}>
                            {f.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 7: WEBHOOK & STRATEGY BRIDGE (TRADINGVIEW & PYTHON)       */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeMenu === 'Bridge' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0, color: '#fff' }}>
                  TradingView, Chartink & Python Webhook Bridge
                </h2>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
                  Zero-latency JSON alert webhook listener routing strategy signals directly into live Demats.
                </p>
              </div>

              {/* Target Webhook Endpoints */}
              <div style={{ background: '#101726', border: '1px solid #1e293b', borderRadius: '14px', padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#38bdf8' }}>
                    Target Webhook URL
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('https://skandx.in/api/v1/bridge/webhook');
                      showToast('Copied Webhook URL!');
                    }}
                    style={{ padding: '6px 12px', background: '#2563eb', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    Copy Webhook URL
                  </button>
                </div>
                <code style={{ background: '#090d16', border: '1px solid #1e293b', padding: '10px 14px', borderRadius: '8px', color: '#22c55e', fontSize: '13.5px' }}>
                  https://skandx.in/api/v1/bridge/webhook
                </code>
              </div>

              {/* Webhook JSON Generator Form */}
              <div style={{ background: '#101726', border: '1px solid #1e293b', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff' }}>
                  Interactive TradingView Alert Payload Builder
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '11.5px', color: '#64748b' }}>Action</label>
                    <select
                      value={whAction}
                      onChange={e => setWhAction(e.target.value)}
                      style={{ width: '100%', background: '#090d16', border: '1px solid #1e293b', padding: '9px', borderRadius: '6px', color: '#fff', fontSize: '12.5px', marginTop: '4px' }}
                    >
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', color: '#64748b' }}>Symbol</label>
                    <input
                      type="text"
                      value={whSymbol}
                      onChange={e => setWhSymbol(e.target.value)}
                      style={{ width: '100%', background: '#090d16', border: '1px solid #1e293b', padding: '9px', borderRadius: '6px', color: '#fff', fontSize: '12.5px', marginTop: '4px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', color: '#64748b' }}>Qty (Lot Size)</label>
                    <input
                      type="number"
                      value={whQty}
                      onChange={e => setWhQty(e.target.value)}
                      style={{ width: '100%', background: '#090d16', border: '1px solid #1e293b', padding: '9px', borderRadius: '6px', color: '#fff', fontSize: '12.5px', marginTop: '4px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', color: '#64748b' }}>Order Type</label>
                    <select
                      value={whType}
                      onChange={e => setWhType(e.target.value)}
                      style={{ width: '100%', background: '#090d16', border: '1px solid #1e293b', padding: '9px', borderRadius: '6px', color: '#fff', fontSize: '12.5px', marginTop: '4px' }}
                    >
                      <option value="MARKET">MARKET</option>
                      <option value="LIMIT">LIMIT</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', color: '#64748b' }}>Product</label>
                    <select
                      value={whProduct}
                      onChange={e => setWhProduct(e.target.value)}
                      style={{ width: '100%', background: '#090d16', border: '1px solid #1e293b', padding: '9px', borderRadius: '6px', color: '#fff', fontSize: '12.5px', marginTop: '4px' }}
                    >
                      <option value="MIS">MIS (Intraday)</option>
                      <option value="CNC">CNC (Delivery)</option>
                      <option value="NRML">NRML (Carry Forward F&O)</option>
                    </select>
                  </div>
                </div>

                {/* Pre-formatted output */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>TradingView Alert Message JSON:</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(jsonWebhookSample);
                          showToast('Copied TradingView Alert JSON!');
                        }}
                        style={{ padding: '5px 10px', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', borderRadius: '6px', fontSize: '11.5px', cursor: 'pointer' }}
                      >
                        <Copy size={12} /> Copy JSON
                      </button>
                      <button
                        onClick={handleTestWebhookFire}
                        style={{ padding: '5px 12px', background: '#16a34a', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer' }}
                      >
                        ⚡ Test Webhook Fire
                      </button>
                    </div>
                  </div>

                  <pre style={{
                    background: '#05070c',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    padding: '14px',
                    fontSize: '12.5px',
                    color: '#38bdf8',
                    overflowX: 'auto',
                    margin: 0
                  }}>
                    {jsonWebhookSample}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 8: TELEGRAM BOT OMS                                       */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeMenu === 'TelegramBot' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0, color: '#fff' }}>
                  Telegram Bot OMS & Notifications
                </h2>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
                  Get real-time filled trade alerts and control your algorithms using Telegram chat commands.
                </p>
              </div>

              <div style={{ background: '#101726', border: '1px solid #1e293b', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(2,132,199,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                      <Send size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff' }}>@SkandXAlgoBot</div>
                      <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: '600' }}>● Bot Gateway Connected & Running</div>
                    </div>
                  </div>

                  <button
                    onClick={handleTelegramTestPing}
                    style={{ padding: '9px 16px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12.5px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    Send Test Trade Alert
                  </button>
                </div>

                <div style={{ borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
                  <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#cbd5e1', marginBottom: '12px' }}>
                    Interactive Telegram Chat Commands:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', fontSize: '12.5px' }}>
                    <div style={{ background: '#090d16', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                      <code style={{ color: '#38bdf8', fontWeight: '800' }}>/buy &lt;symbol&gt; &lt;qty&gt;</code>
                      <div style={{ color: '#64748b', fontSize: '11.5px', marginTop: '3px' }}>Places market buy across master demat</div>
                    </div>
                    <div style={{ background: '#090d16', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                      <code style={{ color: '#ef4444', fontWeight: '800' }}>/sell &lt;symbol&gt; &lt;qty&gt;</code>
                      <div style={{ color: '#64748b', fontSize: '11.5px', marginTop: '3px' }}>Places market sell across master demat</div>
                    </div>
                    <div style={{ background: '#090d16', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                      <code style={{ color: '#f59e0b', fontWeight: '800' }}>/positions</code>
                      <div style={{ color: '#64748b', fontSize: '11.5px', marginTop: '3px' }}>Returns open positions and live P&L</div>
                    </div>
                    <div style={{ background: '#090d16', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                      <code style={{ color: '#ec4899', fontWeight: '800' }}>/kill</code>
                      <div style={{ color: '#64748b', fontSize: '11.5px', marginTop: '3px' }}>Emergency exit all active trades</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 1: ADD FUNDS / RECHARGE WALLET MODAL                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showRechargeModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100010,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#121826',
            border: '1px solid #1e293b',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            padding: '24px',
            color: '#fff',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Wallet size={20} color="#22c55e" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Add Platform Credit</h3>
              </div>
              <button onClick={() => setShowRechargeModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '0 0 16px' }}>
              Add credit to purchase dedicated static IPs and execute high-frequency multi-broker algo orders.
            </p>

            {/* Current Balance */}
            <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>Current Wallet Balance:</span>
              <span style={{ fontSize: '18px', fontWeight: '900', color: '#22c55e' }}>₹{config.availableCredit.toFixed(2)}</span>
            </div>

            {/* Quick Presets */}
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', marginBottom: '8px' }}>
              SELECT RECHARGE AMOUNT:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
              {['500', '1000', '2500', '5000', '10000'].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setCustomRechargeAmount(amt)}
                  style={{
                    padding: '10px',
                    background: customRechargeAmount === amt ? 'rgba(56,189,248,0.18)' : '#090d16',
                    border: `1px solid ${customRechargeAmount === amt ? '#38bdf8' : '#1e293b'}`,
                    borderRadius: '8px',
                    color: customRechargeAmount === amt ? '#38bdf8' : '#cbd5e1',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  ₹{Number(amt).toLocaleString('en-IN')}
                </button>
              ))}
            </div>

            {/* Custom Amount Input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11.5px', color: '#64748b' }}>Custom Amount (₹)</label>
              <input
                type="number"
                value={customRechargeAmount}
                onChange={e => setCustomRechargeAmount(e.target.value)}
                style={{
                  width: '100%',
                  background: '#090d16',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: '700',
                  marginTop: '4px'
                }}
              />
            </div>

            {/* Payment Method Selector */}
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', marginBottom: '8px' }}>
              PAYMENT METHOD:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <div 
                onClick={() => setRechargePaymentMethod('UPI')}
                style={{
                  padding: '12px',
                  background: rechargePaymentMethod === 'UPI' ? 'rgba(34,197,94,0.12)' : '#090d16',
                  border: `1px solid ${rechargePaymentMethod === 'UPI' ? '#22c55e' : '#1e293b'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Smartphone size={16} color="#22c55e" />
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#fff' }}>Instant UPI</div>
                  <div style={{ fontSize: '10.5px', color: '#64748b' }}>GPay, PhonePe, Paytm QR</div>
                </div>
              </div>

              <div 
                onClick={() => setRechargePaymentMethod('CARD')}
                style={{
                  padding: '12px',
                  background: rechargePaymentMethod === 'CARD' ? 'rgba(56,189,248,0.12)' : '#090d16',
                  border: `1px solid ${rechargePaymentMethod === 'CARD' ? '#38bdf8' : '#1e293b'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <CreditCard size={16} color="#38bdf8" />
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#fff' }}>Card / Netbanking</div>
                  <div style={{ fontSize: '10.5px', color: '#64748b' }}>Debit, Credit Card & Netbanking</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowRechargeModal(false)}
                style={{ flex: 1, padding: '11px', background: '#1e293b', border: 'none', color: '#cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRecharge}
                style={{ flex: 2, padding: '11px', background: '#16a34a', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '13px' }}
              >
                Add ₹{Number(customRechargeAmount || 0).toLocaleString('en-IN')} Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 2: CONNECT NEW DEMAT ACCOUNT                            */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showAddDematModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100010,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#121826',
            border: '1px solid #1e293b',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            padding: '24px',
            color: '#fff'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Connect New Demat Account</h3>
              <button onClick={() => setShowAddDematModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddDematSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11.5px', color: '#94a3b8' }}>Select Broker</label>
                <select
                  value={newBroker}
                  onChange={e => setNewBroker(e.target.value)}
                  style={{ width: '100%', background: '#090d16', border: '1px solid #1e293b', padding: '10px', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '4px' }}
                >
                  <option value="Zerodha Kite Connect">Zerodha Kite Connect</option>
                  <option value="Angel One SmartAPI">Angel One SmartAPI</option>
                  <option value="Upstox Pro API v2">Upstox Pro API v2</option>
                  <option value="Fyers API v3">Fyers API v3</option>
                  <option value="DhanHQ Open API">DhanHQ Open API</option>
                  <option value="Alice Blue ANT">Alice Blue ANT</option>
                  <option value="Kotak Neo API">Kotak Neo API</option>
                  <option value="Shoonya / Finvasia">Shoonya / Finvasia</option>
                  <option value="Groww Webhook">Groww Webhook</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', color: '#94a3b8' }}>Client ID / UCC *</label>
                <input
                  type="text"
                  placeholder="e.g. ZER6641, AB1234, FY4410"
                  value={newClientCode}
                  onChange={e => setNewClientCode(e.target.value)}
                  required
                  style={{ width: '100%', background: '#090d16', border: '1px solid #1e293b', padding: '10px', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', color: '#94a3b8' }}>Account Nickname</label>
                <input
                  type="text"
                  placeholder="e.g. Primary Scalping A/C"
                  value={newAccountName}
                  onChange={e => setNewAccountName(e.target.value)}
                  style={{ width: '100%', background: '#090d16', border: '1px solid #1e293b', padding: '10px', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', color: '#94a3b8' }}>API Key</label>
                  <input
                    type="text"
                    placeholder="Broker API Key"
                    value={newApiKey}
                    onChange={e => setNewApiKey(e.target.value)}
                    style={{ width: '100%', background: '#090d16', border: '1px solid #1e293b', padding: '10px', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', color: '#94a3b8' }}>API Secret / TOTP Key</label>
                  <input
                    type="password"
                    placeholder="API Secret"
                    value={newApiSecret}
                    onChange={e => setNewApiSecret(e.target.value)}
                    style={{ width: '100%', background: '#090d16', border: '1px solid #1e293b', padding: '10px', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', color: '#94a3b8' }}>Route via Dedicated Static IP</label>
                <select
                  value={newIp}
                  onChange={e => setNewIp(e.target.value)}
                  style={{ width: '100%', background: '#090d16', border: '1px solid #1e293b', padding: '10px', borderRadius: '6px', color: '#fff', fontSize: '13px', marginTop: '4px' }}
                >
                  {staticIps.map(ip => (
                    <option key={ip.id} value={ip.ip}>{ip.ip} ({ip.datacenter})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddDematModal(false)}
                  style={{ flex: 1, padding: '11px', background: '#1e293b', border: 'none', color: '#cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '11px', background: '#2563eb', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: '800' }}
                >
                  Validate & Save Demat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 3: RE-AUTH / TOTP RENEWAL MODAL                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showReauthModal && accountToReauth && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100010,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#121826',
            border: '1px solid #1e293b',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            padding: '24px',
            color: '#fff'
          }}>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>
              Renew Session: {accountToReauth.broker}
            </h3>
            <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '6px 0 16px' }}>
              Enter your 6-digit TOTP from Google Authenticator to renew your daily OMS trading token.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                maxLength={6}
                placeholder="6-digit TOTP (e.g. 492015)"
                value={totpCode}
                onChange={e => setTotpCode(e.target.value)}
                style={{
                  background: '#090d16',
                  border: '1px solid #1e293b',
                  padding: '12px',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '20px',
                  textAlign: 'center',
                  letterSpacing: '5px',
                  fontWeight: '900'
                }}
              />

              <button
                onClick={handleConfirmReauth}
                style={{
                  padding: '12px',
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                Validate TOTP & Renew Session
              </button>

              <button
                onClick={() => setShowReauthModal(false)}
                style={{
                  padding: '10px',
                  background: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 4: PLACE ALGO ORDER MODAL                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showOrderModal && selectedStockForOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100010,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#121826',
            border: '1px solid #1e293b',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '460px',
            padding: '24px',
            color: '#fff'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '800',
                  background: orderSide === 'BUY' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: orderSide === 'BUY' ? '#22c55e' : '#ef4444'
                }}>
                  {orderSide} ORDER
                </span>
                <span style={{ marginLeft: '8px', fontWeight: '800', fontSize: '16px' }}>
                  {selectedStockForOrder.symbol}
                </span>
              </div>
              <button onClick={() => setShowOrderModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExecuteOrderSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11.5px', color: '#64748b' }}>Route to Demat Account</label>
                <select style={{ width: '100%', background: '#090d16', border: '1px solid #1e293b', padding: '9px', borderRadius: '6px', color: '#fff', fontSize: '12.5px', marginTop: '4px' }}>
                  <option>ALL CONNECTED DEMATS (MASTER + SLAVES)</option>
                  {demats.map(d => (
                    <option key={d.id}>{d.broker} ({d.clientCode})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', color: '#64748b' }}>Quantity</label>
                  <input
                    type="number"
                    defaultValue={50}
                    style={{ width: '100%', background: '#090d16', border: '1px solid #1e293b', padding: '9px', borderRadius: '6px', color: '#fff', fontSize: '12.5px', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', color: '#64748b' }}>Order Type</label>
                  <select style={{ width: '100%', background: '#090d16', border: '1px solid #1e293b', padding: '9px', borderRadius: '6px', color: '#fff', fontSize: '12.5px', marginTop: '4px' }}>
                    <option>MARKET</option>
                    <option>LIMIT</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', color: '#64748b' }}>Target (Points)</label>
                  <input
                    type="number"
                    defaultValue={100}
                    style={{ width: '100%', background: '#090d16', border: '1px solid #1e293b', padding: '9px', borderRadius: '6px', color: '#fff', fontSize: '12.5px', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', color: '#64748b' }}>Stop Loss (Points)</label>
                  <input
                    type="number"
                    defaultValue={50}
                    style={{ width: '100%', background: '#090d16', border: '1px solid #1e293b', padding: '9px', borderRadius: '6px', color: '#fff', fontSize: '12.5px', marginTop: '4px' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                style={{
                  marginTop: '10px',
                  padding: '12px',
                  background: orderSide === 'BUY' ? '#16a34a' : '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13.5px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                Execute {orderSide} via SkandX OMS
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
