// frontend/src/components/PrimaryMarketsView.jsx
// 🏛️ Hub 03: Primary Markets, Full NSE & BSE Bhavcopy Screener (5,797+ Stocks, 20 Filters + Per-Column Filters),
// Rolling 30-Day Bulk/Block/Insider Deals (1,140+ Deals, Per-Column Filters) & Live 14-Column IPO Subscription & GMP Hub

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  ExternalLink, Search, Filter, ShieldCheck, Sparkles, BarChart2,
  Calendar, Layers, CheckCircle2, ChevronRight, RefreshCw, Award,
  Flame, Snowflake, Zap, AlertTriangle, Copy, Check, SlidersHorizontal,
  DollarSign, PieChart, Info, Table, LayoutGrid, ArrowUpDown, Trophy, Moon, Sun, Clock,
  Plus, ShoppingCart
} from 'lucide-react';
import { API, useStore } from '../store';
import logoImg from '../assets/logo.webp';
import MarketScreenerTab from './MarketScreenerTab';
import SmartMoneyTab from './SmartMoneyTab';
import CorporateCalendarTab from './CorporateCalendarTab';

// Helper: Compute completed trading session date in IST on client (before 6:55 PM IST -> previous trading day)
function getClientCompletedTradingDate() {
  const now = new Date();
  const istMs = now.getTime() + (5.5 * 60 * 60 * 1000);
  const d = new Date(istMs);
  if (d.getUTCHours() < 18 || (d.getUTCHours() === 18 && d.getUTCMinutes() < 55)) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return {
    iso: `${yyyy}-${mm}-${dd}`,
    display: `${dd}-${months[d.getUTCMonth()]}-${yyyy}`
  };
}

// Helper: Get list of recent completed trading days in IST (skipping weekends)
function getClientRecentTradingDays(count = 7) {
  const days = [];
  const now = new Date();
  const istMs = now.getTime() + (5.5 * 60 * 60 * 1000);
  const d = new Date(istMs);
  if (d.getUTCHours() < 18 || (d.getUTCHours() === 18 && d.getUTCMinutes() < 55)) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 0; i < count; i++) {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const shortLabel = `${parseInt(dd, 10)}-${months[d.getUTCMonth()]}`;
    days.push({
      iso: `${yyyy}-${mm}-${dd}`,
      display: `${dd}-${months[d.getUTCMonth()]}-${yyyy}`,
      shortLabel,
      label: i === 0 ? `Today (${shortLabel})` : i === 1 ? `Yesterday (${shortLabel})` : shortLabel,
      isToday: i === 0,
      isYesterday: i === 1
    });
    d.setUTCDate(d.getUTCDate() - 1);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
      d.setUTCDate(d.getUTCDate() - 1);
    }
  }
  return days;
}

const DEFAULT_TRADING_DATE = getClientCompletedTradingDate();
const DEFAULT_RECENT_TRADING_DAYS = getClientRecentTradingDays(7);

const SEED_BHAVCOPY_DATA = [
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', exchange: 'BOTH', bseCode: '500180', isFnO: true, ltp: 1682.40, vwap: 1676.20, high: 1692.00, low: 1665.00, change: 0.90, volume: 15420000, delivQty: 12490200, delivPct: 81.0, turnoverCr: 259.42, surgeMult: 3.1, is52wHigh: false, is52wLow: false, aboveVwap: true, sector: 'Banking & Financials' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', exchange: 'BOTH', bseCode: '532174', isFnO: true, ltp: 1248.80, vwap: 1241.10, high: 1255.00, low: 1230.00, change: 1.80, volume: 11200000, delivQty: 8736000, delivPct: 78.0, turnoverCr: 139.86, surgeMult: 2.6, is52wHigh: true, is52wLow: false, aboveVwap: true, sector: 'Banking & Financials' },
  { symbol: 'SBIN', name: 'State Bank of India', exchange: 'BOTH', bseCode: '500112', isFnO: true, ltp: 812.50, vwap: 809.40, high: 818.00, low: 804.00, change: 0.85, volume: 18450000, delivQty: 12915000, delivPct: 70.0, turnoverCr: 149.90, surgeMult: 1.7, is52wHigh: false, is52wLow: false, aboveVwap: true, sector: 'Banking & Financials' },
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', exchange: 'BOTH', bseCode: '500325', isFnO: true, ltp: 2985.40, vwap: 2971.00, high: 2998.00, low: 2952.00, change: 1.45, volume: 8250000, delivQty: 6435000, delivPct: 78.0, turnoverCr: 246.29, surgeMult: 2.4, is52wHigh: true, is52wLow: false, aboveVwap: true, sector: 'Energy & Power' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'BOTH', bseCode: '532540', isFnO: true, ltp: 4210.20, vwap: 4218.50, high: 4235.00, low: 4195.00, change: -0.35, volume: 2950000, delivQty: 2242000, delivPct: 76.0, turnoverCr: 124.20, surgeMult: 1.8, is52wHigh: false, is52wLow: false, aboveVwap: false, sector: 'Information Tech' },
  { symbol: 'INFY', name: 'Infosys Ltd', exchange: 'BOTH', bseCode: '500209', isFnO: true, ltp: 1912.10, vwap: 1906.80, high: 1922.00, low: 1898.00, change: 0.40, volume: 6420000, delivQty: 4622400, delivPct: 72.0, turnoverCr: 122.75, surgeMult: 1.5, is52wHigh: false, is52wLow: false, aboveVwap: true, sector: 'Information Tech' },
  { symbol: 'BSE', name: 'BSE Limited', exchange: 'BSE', bseCode: '542650', isFnO: true, ltp: 4180.00, vwap: 4115.00, high: 4210.00, low: 4040.00, change: 4.80, volume: 3850000, delivQty: 3080000, delivPct: 80.0, turnoverCr: 160.93, surgeMult: 4.8, is52wHigh: true, is52wLow: false, aboveVwap: true, sector: 'Capital Markets & Exchanges' }
];

const SEED_DEALS_DATA = [
  { id: 1, date: DEFAULT_TRADING_DATE.iso, symbol: 'ZOMATO', company: 'Zomato Ltd', exchange: 'NSE', client: 'Morgan Stanley Asia Singapore', clientCategory: 'FII', type: 'BUY', qty: 12500000, price: 272.50, valueCr: 340.62, dealType: 'BULK_DEAL', isMultiDeal: true },
  { id: 2, date: DEFAULT_TRADING_DATE.iso, symbol: 'INFY', company: 'Infosys Ltd', exchange: 'NSE', client: 'LIC of India', clientCategory: 'DII', type: 'BUY', qty: 2100000, price: 1905.00, valueCr: 400.05, dealType: 'BULK_DEAL', isMultiDeal: true },
  { id: 3, date: DEFAULT_TRADING_DATE.iso, symbol: 'BSE', company: 'BSE Limited', exchange: 'BSE', client: 'Goldman Sachs India Equity', clientCategory: 'FII', type: 'BUY', qty: 950000, price: 4150.00, valueCr: 394.25, dealType: 'BULK_DEAL', isMultiDeal: false },
  { id: 4, date: DEFAULT_TRADING_DATE.iso, symbol: 'HDFCBANK', company: 'HDFC Bank Ltd', exchange: 'NSE', client: 'Government of Singapore (GIC)', clientCategory: 'FII', type: 'BUY', qty: 4500000, price: 1678.00, valueCr: 755.10, dealType: 'BLOCK_DEAL', isMultiDeal: true },
  { id: 5, date: DEFAULT_TRADING_DATE.iso, symbol: 'BANKBARODA', company: 'Bank of Baroda', exchange: 'NSE', client: 'SBI Mutual Fund - Contra & Bluechip', clientCategory: 'DII', type: 'BUY', qty: 6500000, price: 242.80, valueCr: 157.82, dealType: 'BLOCK_DEAL', isMultiDeal: true }
];

const SEED_IPO_DATA = [
  {
    id: 1,
    name: 'Afcons Infrastructure Ltd.',
    badge: 'MAINBOARD',
    category: 'MAINBOARD',
    status: 'OPEN',
    priceBand: '₹440 – ₹463',
    minPrice: 440,
    maxPrice: 463,
    lotSize: 32,
    issueSizeCr: 5430.00,
    openDate: '25-Oct-2024',
    closeDate: '29-Oct-2024',
    listingDate: '04-Nov-2024',
    gmp: 38,
    gmpPct: 8.21,
    subscription: { qib: 3.79, snii: 3.82, bnii: 5.31, nii: 5.05, retail: 0.94, employee: 1.67, shareholder: null, others: null, total: 2.63 },
    applications: 521400,
    asOn: '29-Oct-2024 17:00',
    registrar: 'Link Intime',
    registrarUrl: 'https://linkintime.co.in/initial_offer/public-issues.html',
    sector: 'Infrastructure & Engineering'
  },
  {
    id: 2,
    name: 'Godavari Biorefineries Ltd.',
    badge: 'MAINBOARD',
    category: 'MAINBOARD',
    status: 'OPEN',
    priceBand: '₹334 – ₹352',
    minPrice: 334,
    maxPrice: 352,
    lotSize: 42,
    issueSizeCr: 554.75,
    openDate: '23-Oct-2024',
    closeDate: '25-Oct-2024',
    listingDate: '30-Oct-2024',
    gmp: 24,
    gmpPct: 6.82,
    subscription: { qib: 2.76, snii: 0.82, bnii: 0.94, nii: 0.90, retail: 1.71, employee: null, shareholder: null, others: null, total: 1.83 },
    applications: 182300,
    asOn: '25-Oct-2024 17:00',
    registrar: 'Link Intime',
    registrarUrl: 'https://linkintime.co.in/initial_offer/public-issues.html',
    sector: 'Bio-based Chemicals & Ethanol'
  },
  {
    id: 9,
    name: 'Hexaware Technologies Ltd.',
    badge: 'MAINBOARD',
    category: 'MAINBOARD',
    status: 'UPCOMING',
    priceBand: '₹750 – ₹800 (Est.)',
    minPrice: 750,
    maxPrice: 800,
    lotSize: 18,
    issueSizeCr: 9950.00,
    openDate: 'Opening Soon',
    closeDate: 'Announced Soon',
    listingDate: 'DRHP Cleared',
    gmp: 125,
    gmpPct: 15.63,
    subscription: { qib: 0, snii: 0, bnii: 0, nii: 0, retail: 0, employee: null, shareholder: null, others: null, total: 0 },
    applications: 0,
    asOn: 'DRHP Cleared',
    registrar: 'KFintech',
    registrarUrl: 'https://kosmic.kfintech.com/ipostatus/',
    sector: 'IT Services & Digital Solutions'
  },
  {
    id: 10,
    name: 'HDB Financial Services Ltd.',
    badge: 'MAINBOARD',
    category: 'MAINBOARD',
    status: 'UPCOMING',
    priceBand: '₹700 – ₹740 (Est.)',
    minPrice: 700,
    maxPrice: 740,
    lotSize: 20,
    issueSizeCr: 12500.00,
    openDate: 'Opening Soon',
    closeDate: 'Announced Soon',
    listingDate: 'DRHP Cleared',
    gmp: 160,
    gmpPct: 21.62,
    subscription: { qib: 0, snii: 0, bnii: 0, nii: 0, retail: 0, employee: null, shareholder: null, others: null, total: 0 },
    applications: 0,
    asOn: 'HDFC Bank Board Approved',
    registrar: 'Link Intime',
    registrarUrl: 'https://linkintime.co.in/initial_offer/public-issues.html',
    sector: 'NBFC & Retail Lending'
  },
  {
    id: 25,
    name: 'Waaree Energies Ltd.',
    badge: 'MAINBOARD',
    category: 'MAINBOARD',
    status: 'LISTED',
    priceBand: '₹1,427 – ₹1,503',
    minPrice: 1427,
    maxPrice: 1503,
    issuePrice: 1503,
    listingPrice: 2550,
    listingGainPct: 69.66,
    lotSize: 9,
    issueSizeCr: 4321.44,
    openDate: '21-Oct-2024',
    closeDate: '23-Oct-2024',
    listingDate: '28-Oct-2024',
    gmp: 1047,
    gmpPct: 69.66,
    subscription: { qib: 208.63, snii: 51.79, bnii: 68.42, nii: 62.48, retail: 10.79, employee: null, shareholder: null, others: null, total: 76.34 },
    applications: 9734520,
    asOn: 'Listed on 28-Oct-2024',
    registrar: 'Link Intime',
    registrarUrl: 'https://linkintime.co.in/initial_offer/public-issues.html',
    sector: 'Solar PV Module Manufacturing'
  },
  {
    id: 26,
    name: 'Hyundai Motor India Ltd.',
    badge: 'MAINBOARD',
    category: 'MAINBOARD',
    status: 'LISTED',
    priceBand: '₹1,865 – ₹1,960',
    minPrice: 1865,
    maxPrice: 1960,
    issuePrice: 1960,
    listingPrice: 1931,
    listingGainPct: -1.48,
    lotSize: 7,
    issueSizeCr: 27870.16,
    openDate: '15-Oct-2024',
    closeDate: '17-Oct-2024',
    listingDate: '22-Oct-2024',
    gmp: -29,
    gmpPct: -1.48,
    subscription: { qib: 6.97, snii: 0.62, bnii: 0.59, nii: 0.60, retail: 0.50, employee: 1.74, shareholder: null, others: null, total: 2.37 },
    applications: 1428910,
    asOn: 'Listed on 22-Oct-2024',
    registrar: 'KFintech',
    registrarUrl: 'https://kosmic.kfintech.com/ipostatus/',
    sector: 'Automobile & Passenger Vehicles'
  },
  {
    id: 27,
    name: 'Vishal Mega Mart Ltd.',
    badge: 'MAINBOARD',
    category: 'MAINBOARD',
    status: 'LISTED',
    priceBand: '₹74 – ₹78',
    minPrice: 74,
    maxPrice: 78,
    issuePrice: 78,
    listingPrice: 105,
    listingGainPct: 34.62,
    lotSize: 190,
    issueSizeCr: 8000.00,
    openDate: '11-Dec-2024',
    closeDate: '13-Dec-2024',
    listingDate: '16-Dec-2024',
    gmp: 27,
    gmpPct: 34.62,
    subscription: { qib: 85.20, snii: 12.40, bnii: 15.60, nii: 14.60, retail: 2.80, employee: 3.20, shareholder: null, others: null, total: 28.40 },
    applications: 3840000,
    asOn: 'Listed on 16-Dec-2024',
    registrar: 'KFintech',
    registrarUrl: 'https://kosmic.kfintech.com/ipostatus/',
    sector: 'Hypermarket & Value Fashion Retail'
  },
  {
    id: 28,
    name: 'Swiggy Ltd.',
    badge: 'MAINBOARD',
    category: 'MAINBOARD',
    status: 'LISTED',
    priceBand: '₹371 – ₹390',
    minPrice: 371,
    maxPrice: 390,
    issuePrice: 390,
    listingPrice: 420,
    listingGainPct: 7.69,
    lotSize: 38,
    issueSizeCr: 11327.43,
    openDate: '06-Nov-2024',
    closeDate: '08-Nov-2024',
    listingDate: '13-Nov-2024',
    gmp: 30,
    gmpPct: 7.69,
    subscription: { qib: 6.02, snii: 0.84, bnii: 1.45, nii: 1.24, retail: 1.14, employee: 1.65, shareholder: null, others: null, total: 3.59 },
    applications: 1980000,
    asOn: 'Listed on 13-Nov-2024',
    registrar: 'Link Intime',
    registrarUrl: 'https://linkintime.co.in/initial_offer/public-issues.html',
    sector: 'Food Delivery & Quick Commerce'
  }
];

const resolvePrimaryMarketTab = (tab) => {
  if (!tab) return 'BHAVCOPY';
  const upper = String(tab).toUpperCase();
  if (upper === 'DEALS' || upper === 'BULK') return 'DEALS';
  if (upper === 'IPO' || upper === 'IPOS' || upper === 'ALLOTMENT') return 'IPOS';
  if (upper === 'SCREENER' || upper === 'SCANNER' || upper === 'BREAKOUT') return 'SCREENER';
  if (upper === 'FII' || upper === 'DII' || upper === 'SMART_MONEY' || upper === 'FII_DII') return 'FII_DII';
  if (upper === 'CALENDAR' || upper === 'EARNINGS' || upper === 'CORPORATE_ACTIONS') return 'CALENDAR';
  return 'BHAVCOPY';
};

function formatDateBadge(isoStr) {
  if (!isoStr) return 'Latest';
  const parts = String(isoStr).split('-');
  if (parts.length !== 3) return isoStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mm = parseInt(parts[1], 10);
  const dd = parseInt(parts[2], 10);
  return `${dd}-${months[mm - 1] || 'Oct'}`;
}

function formatSubVal(val) {
  if (val === null || val === undefined) return '-';
  const num = Number(val);
  if (isNaN(num)) return '-';
  return num.toFixed(2);
}

function parseIpoTimestamp(ipo) {
  if (!ipo) return 0;
  const dStr = ipo.closeDate || ipo.listingDate || ipo.openDate || '';
  if (!dStr) return 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return new Date(dStr).getTime();
  const parts = String(dStr).trim().split(/[- /]/);
  if (parts.length === 3) {
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const day = parseInt(parts[0], 10);
    const m = months[parts[1].toLowerCase().slice(0, 3)];
    let yr = parseInt(parts[2], 10);
    if (yr < 100) yr += 2000;
    if (!isNaN(day) && m !== undefined && !isNaN(yr)) {
      return new Date(Date.UTC(yr, m, day)).getTime();
    }
  }
  const parsed = Date.parse(dStr);
  return isNaN(parsed) ? 0 : parsed;
}

function getSafeListingGain(ipo) {
  let g = ipo.listingGainPct;
  if (g === null || g === undefined || isNaN(g)) {
    if (ipo.listingPrice && (ipo.issuePrice || ipo.maxPrice)) {
      const base = Number(ipo.issuePrice || ipo.maxPrice);
      if (base > 0) {
        g = Number((((ipo.listingPrice - base) / base) * 100).toFixed(2));
      }
    }
  }
  return (g === null || g === undefined || isNaN(g)) ? 0 : Number(g);
}

export default function PrimaryMarketsView({ initialTab, onBack, onOpenPaperTrading, onOpenLeaderboard }) {
  const [activeTab, setActiveTab] = useState(() => resolvePrimaryMarketTab(initialTab));
  const [bhavcopyData, setBhavcopyData] = useState(SEED_BHAVCOPY_DATA);
  const [bhavStats, setBhavStats] = useState({
    totalStocks: 5797,
    nseCount: 3452,
    bseCount: 5018,
    fnoCount: 196,
    breakouts52w: 214,
    reversals52w: 302,
    highDelivery75: 1353,
    volumeSurges2x: 4873,
    asOfDate: DEFAULT_TRADING_DATE.display
  });
  const [bhavTotalFiltered, setBhavTotalFiltered] = useState(5797);
  const [bhavPage, setBhavPage] = useState(1);
  const [bhavHasMore, setBhavHasMore] = useState(true);

  const [dealsData, setDealsData] = useState(SEED_DEALS_DATA);
  const [dealsStats, setDealsStats] = useState({
    totalDeals: 1141,
    bulkCount: 793,
    blockCount: 218,
    insiderCount: 130,
    fiiCount: 416,
    diiCount: 380,
    hftCount: 215,
    totalFlowCr: 161763,
    buyFlowCr: 92689,
    sellFlowCr: 69074,
    latestDate: DEFAULT_TRADING_DATE.iso,
    yesterdayDate: DEFAULT_RECENT_TRADING_DAYS[1]?.iso || '',
    recentDates: DEFAULT_RECENT_TRADING_DAYS
  });
  const [dealsTotalFiltered, setDealsTotalFiltered] = useState(1141);
  const [dealsPage, setDealsPage] = useState(1);
  const [dealsHasMore, setDealsHasMore] = useState(true);

  const theme = useStore(state => state.theme);
  const toggleTheme = useStore(state => state.toggleTheme);
  const openOrderModal = useStore(state => state.openOrderModal);
  const setSelectedSymbol = useStore(state => state.setSelectedSymbol);
  const addToWatchlist = useStore(state => state.addToWatchlist);
  const showToast = useStore(state => state.showToast);
  const isLight = theme === 'light';
  const [addedSymbols, setAddedSymbols] = useState({});

  const handlePaperTrade = (symbol, side = 'BUY') => {
    if (typeof openOrderModal === 'function') {
      openOrderModal({
        symbol,
        variety: 'REGULAR',
        isAmo: false,
        initialQty: 1,
        initialSide: side,
        initialOrderType: 'MARKET'
      });
    }
    if (typeof onOpenPaperTrading === 'function') {
      onOpenPaperTrading();
    }
  };

  const handleAddToWatchlist = (symbol) => {
    if (typeof addToWatchlist === 'function') {
      addToWatchlist(symbol);
    }
    setAddedSymbols(prev => ({ ...prev, [symbol]: true }));
    if (typeof showToast === 'function') {
      showToast(`${symbol} added to Watchlist!`, 'success', 'Watchlist Updated');
    }
    setTimeout(() => {
      setAddedSymbols(prev => {
        const next = { ...prev };
        delete next[symbol];
        return next;
      });
    }, 2500);
  };

  const handleOpenChart = (symbol) => {
    if (typeof setSelectedSymbol === 'function') {
      setSelectedSymbol(symbol);
    }
    if (typeof onOpenPaperTrading === 'function') {
      onOpenPaperTrading();
    }
  };

  const t = useMemo(() => {
    if (isLight) {
      return {
        isLight: true,
        bg: '#f8fafc',
        text: '#0f172a',
        textSecondary: '#334155',
        textMuted: '#64748b',
        textDim: '#94a3b8',
        cardBg: '#ffffff',
        cardBgSubtle: '#f8fafc',
        cardBorder: '#e2e8f0',
        cardBorderLight: '#cbd5e1',
        cardShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        borderSubtle: '#e2e8f0',
        inputBg: '#ffffff',
        inputBorder: '#cbd5e1',
        tableHeaderBg: '#f1f5f9',
        tableHeaderBorder: '#e2e8f0',
        tableRowBorder: '#f1f5f9',
        tableRowHover: '#f8fafc',
        pillInactiveBg: '#f1f5f9',
        pillInactiveBorder: '#e2e8f0',
        pillInactiveText: '#475569',
        btnBg: '#ffffff',
        btnBorder: '#cbd5e1',
        btnText: '#0f172a',
        refreshBtnBg: '#ffffff',
        refreshBtnBorder: '#cbd5e1',
        refreshBtnText: '#334155'
      };
    }
    return {
      isLight: false,
      bg: '#0b0e14',
      text: '#ffffff',
      textSecondary: '#f8fafc',
      textMuted: '#cbd5e1',
      textDim: '#94a3b8',
      cardBg: 'rgba(255, 255, 255, 0.03)',
      cardBgSubtle: 'rgba(255, 255, 255, 0.02)',
      cardBorder: 'rgba(255, 255, 255, 0.08)',
      cardBorderLight: 'rgba(255, 255, 255, 0.15)',
      cardShadow: 'none',
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      inputBg: 'rgba(0, 0, 0, 0.35)',
      inputBorder: 'rgba(255, 255, 255, 0.12)',
      tableHeaderBg: 'rgba(30, 41, 59, 0.75)',
      tableHeaderBorder: 'rgba(255, 255, 255, 0.1)',
      tableRowBorder: 'rgba(255, 255, 255, 0.05)',
      tableRowHover: 'rgba(255, 255, 255, 0.03)',
      pillInactiveBg: 'rgba(255, 255, 255, 0.04)',
      pillInactiveBorder: 'rgba(255, 255, 255, 0.08)',
      pillInactiveText: '#94a3b8',
      btnBg: 'rgba(255, 255, 255, 0.08)',
      btnBorder: 'rgba(255, 255, 255, 0.12)',
      btnText: '#ffffff',
      refreshBtnBg: 'rgba(255, 255, 255, 0.06)',
      refreshBtnBorder: 'rgba(255, 255, 255, 0.1)',
      refreshBtnText: '#cbd5e1'
    };
  }, [isLight]);

  const [ipoData, setIpoData] = useState(SEED_IPO_DATA);
  const [ipoStats, setIpoStats] = useState(null);
  const [ipoLastUpdated, setIpoLastUpdated] = useState('');
  const [isRefreshingIpo, setIsRefreshingIpo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMoreBhav, setLoadingMoreBhav] = useState(false);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [loadingMoreDeals, setLoadingMoreDeals] = useState(false);

  // --- Tab 1: Bhavcopy Filters (20 Checkboxes + Per-Column Filters + Sort) ---
  const [exchangeFilter, setExchangeFilter] = useState('ALL');
  const [minDelivery, setMinDelivery] = useState(0);
  const [bhavSearch, setBhavSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('ALL');

  // Original 9 Checkboxes
  const [onlySurge, setOnlySurge] = useState(false);
  const [onlyMegaSurge, setOnlyMegaSurge] = useState(false);
  const [onlyBreakout, setOnlyBreakout] = useState(false);
  const [only52wLow, setOnly52wLow] = useState(false);
  const [onlyHighDelivery, setOnlyHighDelivery] = useState(false);
  const [onlySmartAccumulation, setOnlySmartAccumulation] = useState(false);
  const [onlyDistribution, setOnlyDistribution] = useState(false);
  const [onlyTopGainers, setOnlyTopGainers] = useState(false);
  const [onlyTopLosers, setOnlyTopLosers] = useState(false);

  // 11 New Institutional Checkboxes
  const [onlyFno, setOnlyFno] = useState(false);
  const [onlyUltraDelivery, setOnlyUltraDelivery] = useState(false);
  const [onlyCloseNearHigh, setOnlyCloseNearHigh] = useState(false);
  const [onlyCloseNearLow, setOnlyCloseNearLow] = useState(false);
  const [onlyAboveVwap, setOnlyAboveVwap] = useState(false);
  const [onlyWideRange, setOnlyWideRange] = useState(false);
  const [onlyTightCoil, setOnlyTightCoil] = useState(false);
  const [onlyHighTurnover, setOnlyHighTurnover] = useState(false);
  const [onlyMidSmallAccum, setOnlyMidSmallAccum] = useState(false);
  const [onlyCircuitGainers, setOnlyCircuitGainers] = useState(false);
  const [onlyCircuitLosers, setOnlyCircuitLosers] = useState(false);

  // Tab 1 Per-Column Filters, View Mode & Sorting
  const [bhavViewMode, setBhavViewMode] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768 ? 'CARDS' : 'TABLE');
  const [showMobileBhavFilters, setShowMobileBhavFilters] = useState(false);
  const [bhavSortBy, setBhavSortBy] = useState('');
  const [bhavSortDir, setBhavSortDir] = useState('DESC');
  const [bhavColFilter, setBhavColFilter] = useState({
    colStock: '',
    colExchange: 'ALL',
    colLtp: '',
    colChange: '',
    colVolume: '',
    colDelivVol: '',
    colDelivPct: '',
    colTurnover: '',
    colSignal: 'ALL'
  });

  // --- Tab 2: Deals Filters (Client Categories + Per-Column Filters + Sort) ---
  const [dealsViewMode, setDealsViewMode] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768 ? 'CARDS' : 'TABLE');
  const [dealTypeFilter, setDealTypeFilter] = useState('ALL');
  const [dealsClientCategory, setDealsClientCategory] = useState('ALL');
  const [dealsExchangeFilter, setDealsExchangeFilter] = useState('ALL');
  const [dealsDateRange, setDealsDateRange] = useState('ALL');
  const [dealsMinSize, setDealsMinSize] = useState(0);
  const [dealsSearch, setDealsSearch] = useState('');
  const [dealsSortBy, setDealsSortBy] = useState('DATE_DESC');
  const [dealsSortDir, setDealsSortDir] = useState('DESC');
  const [dealsColFilter, setDealsColFilter] = useState({
    colDate: '',
    colStock: '',
    colExch: 'ALL',
    colClient: '',
    colType: 'ALL',
    colQty: '',
    colPrice: '',
    colValue: ''
  });

  // --- Tab 3: IPO Filters, View Mode & Per-Column Search (Screenshot 4) ---
  const [ipoViewMode, setIpoViewMode] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768 ? 'CARDS' : 'SUBSCRIPTION_TABLE');
  const [ipoCategory, setIpoCategory] = useState('ALL');
  const [ipoStatusFilter, setIpoStatusFilter] = useState('ALL');
  const [ipoEraFilter, setIpoEraFilter] = useState('ALL');
  const [ipoSearch, setIpoSearch] = useState('');
  const [ipoSortCol, setIpoSortCol] = useState('closeDate');
  const [ipoSortDir, setIpoSortDir] = useState('DESC');
  const [colSearch, setColSearch] = useState({
    company: '',
    closeDate: '',
    issueSizeCr: '',
    qib: '',
    snii: '',
    bnii: '',
    nii: '',
    retail: '',
    employee: '',
    shareholder: '',
    others: '',
    total: '',
    applications: '',
    asOn: ''
  });

  const [selectedIpoForCheck, setSelectedIpoForCheck] = useState(null);
  const [panNumber, setPanNumber] = useState('');
  const [copiedPan, setCopiedPan] = useState(false);

  // Build query string for Server-Side Paginated Bhavcopy (~4 KB response)
  const fetchBhavcopyPage = useCallback(async (pageNum = 1, append = false) => {
    if (append) setLoadingMoreBhav(true);
    try {
      const hasExplicitSearch = Boolean(bhavSearch.trim() || bhavColFilter.colStock.trim());
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: '50',
        exchange: exchangeFilter,
        minDelivery: String(hasExplicitSearch ? 0 : minDelivery),
        sector: sectorFilter,
        search: bhavSearch.trim(),
        breakoutOnly: String(onlyBreakout),
        lowOnly: String(only52wLow),
        surgeOnly: String(onlySurge),
        megaSurgeOnly: String(onlyMegaSurge),
        highDeliveryOnly: String(onlyHighDelivery),
        smartAccumulationOnly: String(onlySmartAccumulation),
        distributionOnly: String(onlyDistribution),
        topGainersOnly: String(onlyTopGainers),
        topLosersOnly: String(onlyTopLosers),
        fnoOnly: String(onlyFno),
        ultraDeliveryOnly: String(onlyUltraDelivery),
        closeNearHighOnly: String(onlyCloseNearHigh),
        closeNearLowOnly: String(onlyCloseNearLow),
        aboveVwapOnly: String(onlyAboveVwap),
        wideRangeOnly: String(onlyWideRange),
        tightCoilOnly: String(onlyTightCoil),
        highTurnoverOnly: String(onlyHighTurnover),
        midSmallAccumOnly: String(onlyMidSmallAccum),
        circuitGainersOnly: String(onlyCircuitGainers),
        circuitLosersOnly: String(onlyCircuitLosers),
        colStock: bhavColFilter.colStock.trim(),
        colExchange: bhavColFilter.colExchange,
        colLtp: bhavColFilter.colLtp.trim(),
        colChange: bhavColFilter.colChange.trim(),
        colVolume: bhavColFilter.colVolume.trim(),
        colDelivVol: bhavColFilter.colDelivVol.trim(),
        colDelivPct: bhavColFilter.colDelivPct.trim(),
        colTurnover: bhavColFilter.colTurnover.trim(),
        colSignal: bhavColFilter.colSignal,
        sortBy: bhavSortBy,
        sortDir: bhavSortDir
      });
      const res = await fetch(`${API}/api/bhavcopy/delivery?${params.toString()}`).then(r => r.ok ? r.json() : null).catch(() => null);
      if (res?.data && Array.isArray(res.data)) {
        setBhavcopyData(prev => append ? [...prev, ...res.data] : res.data);
        setBhavPage(res.page || pageNum);
        setBhavTotalFiltered(res.totalFiltered ?? res.count ?? res.data.length);
        setBhavHasMore(Boolean(res.hasMore));
        if (res.stats) setBhavStats(res.stats);
      }
    } catch (e) {
      // Keep existing state on error
    } finally {
      if (append) setLoadingMoreBhav(false);
    }
  }, [
    exchangeFilter, minDelivery, bhavSearch, sectorFilter,
    onlyBreakout, only52wLow, onlySurge, onlyMegaSurge,
    onlyHighDelivery, onlySmartAccumulation, onlyDistribution,
    onlyTopGainers, onlyTopLosers, onlyFno, onlyUltraDelivery,
    onlyCloseNearHigh, onlyCloseNearLow, onlyAboveVwap,
    onlyWideRange, onlyTightCoil, onlyHighTurnover,
    onlyMidSmallAccum, onlyCircuitGainers, onlyCircuitLosers,
    bhavColFilter, bhavSortBy, bhavSortDir
  ]);

  // Build query string for Server-Side Paginated Deals (~4 KB response)
  const fetchDealsPage = useCallback(async (pageNum = 1, append = false) => {
    if (append) setLoadingMoreDeals(true);
    else setLoadingDeals(true);
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: '50',
        type: dealTypeFilter,
        clientCategory: dealsClientCategory,
        exchange: dealsExchangeFilter,
        dateRange: dealsDateRange,
        minSize: String(dealsMinSize),
        search: dealsSearch.trim(),
        sortBy: dealsSortBy,
        sortDir: dealsSortDir,
        colDate: dealsColFilter.colDate.trim(),
        colStock: dealsColFilter.colStock.trim(),
        colExch: dealsColFilter.colExch,
        colClient: dealsColFilter.colClient.trim(),
        colType: dealsColFilter.colType,
        colQty: dealsColFilter.colQty.trim(),
        colPrice: dealsColFilter.colPrice.trim(),
        colValue: dealsColFilter.colValue.trim()
      });
      const res = await fetch(`${API}/api/market-deals?${params.toString()}`).then(r => r.ok ? r.json() : null).catch(() => null);
      if (res?.deals && Array.isArray(res.deals)) {
        setDealsData(prev => append ? [...prev, ...res.deals] : res.deals);
        setDealsPage(res.page || pageNum);
        setDealsTotalFiltered(res.totalFiltered ?? res.count ?? res.deals.length);
        setDealsHasMore(Boolean(res.hasMore));
        if (res.stats) setDealsStats(res.stats);
      }
    } catch (e) {
      // Keep existing state on error
    } finally {
      if (append) setLoadingMoreDeals(false);
      else setLoadingDeals(false);
    }
  }, [
    dealTypeFilter, dealsClientCategory, dealsExchangeFilter,
    dealsDateRange, dealsMinSize, dealsSearch,
    dealsSortBy, dealsSortDir, dealsColFilter
  ]);

  const fetchIposList = useCallback(async (manual = false, era = ipoEraFilter) => {
    if (manual) setIsRefreshingIpo(true);
    try {
      const params = new URLSearchParams();
      if (era && era !== 'ALL') params.append('era', era);
      const url = `${API}/api/ipos${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);
      if (res?.ipos && Array.isArray(res.ipos) && res.ipos.length > 0) {
        setIpoData(res.ipos);
        if (res.lastUpdated) setIpoLastUpdated(res.lastUpdated);
      }
      if (res?.stats) {
        setIpoStats(res.stats);
      }
    } catch (e) {
      // Fallback to SEED_IPO_DATA
    } finally {
      if (manual) setTimeout(() => setIsRefreshingIpo(false), 500);
    }
  }, [ipoEraFilter]);

  const fetchPrimaryMarketData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchBhavcopyPage(1, false),
        fetchDealsPage(1, false),
        fetchIposList()
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      fetchBhavcopyPage(1, false);
    }, 150);
    return () => clearTimeout(t);
  }, [fetchBhavcopyPage]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchDealsPage(1, false);
    }, 150);
    return () => clearTimeout(t);
  }, [fetchDealsPage]);

  useEffect(() => {
    fetchIposList();
  }, [fetchIposList]);

  // Sort handler for Tab 1 (Bhavcopy Table)
  const handleSortBhavCol = (col) => {
    if (bhavSortBy === col) {
      setBhavSortDir(prev => prev === 'DESC' ? 'ASC' : 'DESC');
    } else {
      setBhavSortBy(col);
      setBhavSortDir('DESC');
    }
  };

  // Sort handler for Tab 2 (Deals Table)
  const handleSortDealsCol = (col) => {
    if (dealsSortBy === col) {
      setDealsSortDir(prev => prev === 'DESC' ? 'ASC' : 'DESC');
    } else {
      setDealsSortBy(col);
      setDealsSortDir('DESC');
    }
  };

  // Filtered & Sorted IPOs (including Screenshot 4 per-column search filters & sort headers)
  const filteredIpos = useMemo(() => {
    let list = [...ipoData];
    if (ipoCategory !== 'ALL') {
      list = list.filter(i => i.category === ipoCategory);
    }
    if (ipoStatusFilter !== 'ALL') {
      if (ipoStatusFilter === 'LISTED' || ipoStatusFilter === 'CLOSED') {
        list = list.filter(i => i.status === 'LISTED' || i.status === 'CLOSED');
      } else {
        list = list.filter(i => i.status === ipoStatusFilter);
      }
    }
    if (ipoSearch.trim()) {
      const q = ipoSearch.toLowerCase().trim();
      list = list.filter(i =>
        (i.name && i.name.toLowerCase().includes(q)) ||
        (i.registrar && i.registrar.toLowerCase().includes(q)) ||
        (i.badge && i.badge.toLowerCase().includes(q))
      );
    }

    if (colSearch.company.trim()) {
      const q = colSearch.company.toLowerCase().trim();
      list = list.filter(i => i.name.toLowerCase().includes(q) || (i.badge && i.badge.toLowerCase().includes(q)));
    }
    if (colSearch.closeDate.trim()) {
      const q = colSearch.closeDate.toLowerCase().trim();
      list = list.filter(i => (i.closeDate || '').toLowerCase().includes(q) || (i.openDate || '').toLowerCase().includes(q));
    }
    if (colSearch.issueSizeCr.trim()) {
      const minVal = parseFloat(colSearch.issueSizeCr);
      if (!isNaN(minVal)) list = list.filter(i => (i.issueSizeCr || 0) >= minVal);
      else list = list.filter(i => String(i.issueSizeCr || '').includes(colSearch.issueSizeCr.trim()));
    }
    const subKeys = ['qib', 'snii', 'bnii', 'nii', 'retail', 'employee', 'shareholder', 'others', 'total'];
    for (const sk of subKeys) {
      if (colSearch[sk]?.trim()) {
        const minSub = parseFloat(colSearch[sk]);
        if (!isNaN(minSub)) {
          list = list.filter(i => Number(i.subscription?.[sk] || 0) >= minSub);
        }
      }
    }
    if (colSearch.applications.trim()) {
      const minApp = parseFloat(colSearch.applications.replace(/,/g, ''));
      if (!isNaN(minApp)) list = list.filter(i => (i.applications || 0) >= minApp);
    }
    if (colSearch.asOn.trim()) {
      const q = colSearch.asOn.toLowerCase().trim();
      list = list.filter(i => (i.asOn || '').toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      const dir = ipoSortDir === 'ASC' ? 1 : -1;
      if (ipoSortCol === 'name') return a.name.localeCompare(b.name) * dir;
      if (ipoSortCol === 'closeDate' || ipoSortCol === 'date') return (parseIpoTimestamp(a) - parseIpoTimestamp(b)) * dir;
      if (ipoSortCol === 'issueSizeCr') return ((a.issueSizeCr || 0) - (b.issueSizeCr || 0)) * dir;
      if (ipoSortCol === 'applications') return ((a.applications || 0) - (b.applications || 0)) * dir;
      if (ipoSortCol === 'gmpPct') return ((a.gmpPct || 0) - (b.gmpPct || 0)) * dir;
      if (['qib', 'snii', 'bnii', 'nii', 'retail', 'employee', 'shareholder', 'others', 'total'].includes(ipoSortCol)) {
        return (Number(a.subscription?.[ipoSortCol] || 0) - Number(b.subscription?.[ipoSortCol] || 0)) * dir;
      }
      return 0;
    });

    return list;
  }, [ipoData, ipoCategory, ipoStatusFilter, ipoSearch, colSearch, ipoSortCol, ipoSortDir]);

  const handleSortIpoCol = (col) => {
    if (ipoSortCol === col) {
      setIpoSortDir(prev => prev === 'DESC' ? 'ASC' : 'DESC');
    } else {
      setIpoSortCol(col);
      setIpoSortDir('DESC');
    }
  };

  const handleCopyPan = () => {
    if (!panNumber) return;
    navigator.clipboard.writeText(panNumber);
    setCopiedPan(true);
    setTimeout(() => setCopiedPan(false), 2000);
  };

  const resetAllBhavFilters = () => {
    setMinDelivery(0);
    setBhavSearch('');
    setSectorFilter('ALL');
    setExchangeFilter('ALL');
    setOnlySurge(false);
    setOnlyMegaSurge(false);
    setOnlyBreakout(false);
    setOnly52wLow(false);
    setOnlyHighDelivery(false);
    setOnlySmartAccumulation(false);
    setOnlyDistribution(false);
    setOnlyTopGainers(false);
    setOnlyTopLosers(false);
    setOnlyFno(false);
    setOnlyUltraDelivery(false);
    setOnlyCloseNearHigh(false);
    setOnlyCloseNearLow(false);
    setOnlyAboveVwap(false);
    setOnlyWideRange(false);
    setOnlyTightCoil(false);
    setOnlyHighTurnover(false);
    setOnlyMidSmallAccum(false);
    setOnlyCircuitGainers(false);
    setOnlyCircuitLosers(false);
    setBhavSortBy('');
    setBhavColFilter({
      colStock: '',
      colExchange: 'ALL',
      colLtp: '',
      colChange: '',
      colVolume: '',
      colDelivVol: '',
      colDelivPct: '',
      colTurnover: '',
      colSignal: 'ALL'
    });
  };

  const activeFilterCount = [
    minDelivery > 0,
    onlySurge, onlyMegaSurge, onlyBreakout, only52wLow, onlyHighDelivery,
    onlySmartAccumulation, onlyDistribution, onlyTopGainers, onlyTopLosers,
    onlyFno, onlyUltraDelivery, onlyCloseNearHigh, onlyCloseNearLow,
    onlyAboveVwap, onlyWideRange, onlyTightCoil, onlyHighTurnover,
    onlyMidSmallAccum, onlyCircuitGainers, onlyCircuitLosers,
    sectorFilter !== 'ALL', exchangeFilter !== 'ALL', bhavSearch.trim().length > 0,
    bhavColFilter.colStock.trim().length > 0, bhavColFilter.colExchange !== 'ALL',
    bhavColFilter.colLtp.trim().length > 0, bhavColFilter.colChange.trim().length > 0,
    bhavColFilter.colVolume.trim().length > 0, bhavColFilter.colDelivVol.trim().length > 0,
    bhavColFilter.colDelivPct.trim().length > 0, bhavColFilter.colTurnover.trim().length > 0,
    bhavColFilter.colSignal !== 'ALL'
  ].filter(Boolean).length;

  const resetAllDealsFilters = () => {
    setDealTypeFilter('ALL');
    setDealsClientCategory('ALL');
    setDealsExchangeFilter('ALL');
    setDealsDateRange('ALL');
    setDealsMinSize(0);
    setDealsSearch('');
    setDealsSortBy('DATE_DESC');
    setDealsSortDir('DESC');
    setDealsColFilter({
      colDate: '',
      colStock: '',
      colExch: 'ALL',
      colClient: '',
      colType: 'ALL',
      colQty: '',
      colPrice: '',
      colValue: ''
    });
  };

  const activeDealsFilterCount = [
    dealTypeFilter !== 'ALL',
    dealsClientCategory !== 'ALL',
    dealsExchangeFilter !== 'ALL',
    dealsDateRange !== 'ALL',
    dealsMinSize > 0,
    dealsSearch.trim().length > 0,
    dealsColFilter.colDate.trim().length > 0,
    dealsColFilter.colStock.trim().length > 0,
    dealsColFilter.colExch !== 'ALL',
    dealsColFilter.colClient.trim().length > 0,
    dealsColFilter.colType !== 'ALL',
    dealsColFilter.colQty.trim().length > 0,
    dealsColFilter.colPrice.trim().length > 0,
    dealsColFilter.colValue.trim().length > 0
  ].filter(Boolean).length;

  useEffect(() => {
    if (initialTab) {
      setActiveTab(resolvePrimaryMarketTab(initialTab));
    }
  }, [initialTab]);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleExportPrimaryCsv = () => {
    const headers = ['Symbol', 'Company Name', 'Exchange', 'BSE Code', 'Sector', 'LTP', 'VWAP', 'Day Change (%)', 'Volume', 'Delivery Qty', 'Delivery (%)', 'Turnover (Cr)', 'Volume Surge (x)'];
    const rows = bhavcopyData.map(r => [
      r.symbol, `"${(r.name || '').replace(/"/g, '""')}"`, r.exchange, r.bseCode || '', `"${r.sector || ''}"`, r.ltp, r.vwap || r.ltp, r.change, r.volume, r.delivQty, r.delivPct, r.turnoverCr || '', r.surgeMult
    ]);
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SkandX_Bhavcopy_Screener_${bhavStats.asOfDate || DEFAULT_TRADING_DATE.iso}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const latestDealBadge = formatDateBadge(dealsStats.latestDate || DEFAULT_TRADING_DATE.iso);
  const yesterdayDealBadge = formatDateBadge(dealsStats.yesterdayDate || DEFAULT_RECENT_TRADING_DAYS[1]?.iso);
  const recentDaysList = (dealsStats.recentDates && dealsStats.recentDates.length > 0)
    ? dealsStats.recentDates
    : DEFAULT_RECENT_TRADING_DAYS;

  const activeDateHeaderLabel = useMemo(() => {
    if (dealsDateRange === 'ALL') return 'Recent 30 Days';
    if (dealsDateRange === 'TODAY') return `Today (${latestDealBadge} EOD)`;
    if (dealsDateRange === 'YESTERDAY') return `Yesterday (${yesterdayDealBadge} EOD)`;
    if (dealsDateRange === 'WEEK') return 'Past 7 Days';
    if (dealsDateRange === 'MONTH') return 'Past 30 Days';
    if (dealsDateRange === 'YTD') return '2026 Year-to-Date';
    if (dealsDateRange === '1Y') return 'Past 1 Year';
    if (dealsDateRange === '3Y') return 'Past 3 Years';
    if (dealsDateRange === '5Y') return 'Past 5 Years';
    if (dealsDateRange === '10Y') return 'Past 10 Years';
    if (dealsDateRange === 'ALL_TIME') return '22-Year Deals Archive (2004–2026)';
    if (dealsDateRange.startsWith('YEAR_')) return `Year ${dealsDateRange.replace('YEAR_', '')} Archive`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dealsDateRange)) {
      return `${formatDateBadge(dealsDateRange)} EOD`;
    }
    return dealsDateRange;
  }, [dealsDateRange, latestDealBadge, yesterdayDealBadge]);

  return (
    <div
      className="skx-primary-markets-root"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        boxSizing: 'border-box',
        minHeight: '100vh',
        background: t.bg,
        color: t.text,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: isMobile ? 'max(10px, env(safe-area-inset-top, 10px)) 10px 90px' : '16px 20px 100px'
      }}
    >
      {/* Top Header - Mobile Optimized Clean 2-Row Architecture */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '8px' : '12px',
        marginBottom: isMobile ? '12px' : '20px',
        borderBottom: `1px solid ${t.borderSubtle}`,
        paddingBottom: isMobile ? '10px' : '16px'
      }}>
        {/* Row 1: Back + Logo + Title on left, Action buttons on right */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          width: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px', minWidth: 0, flex: 1 }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                background: t.btnBg,
                border: `1px solid ${t.btnBorder}`,
                color: t.btnText,
                padding: isMobile ? '6px 10px' : '8px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: isMobile ? '12px' : '13px',
                fontWeight: '700',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              ← {isMobile ? 'Back' : 'Back to Hub'}
            </button>
            <img
              src={logoImg}
              alt="SkandX Logo"
              style={{
                width: isMobile ? '24px' : '30px',
                height: isMobile ? '24px' : '30px',
                borderRadius: '7px',
                boxShadow: '0 0 10px rgba(56, 189, 248, 0.35)',
                border: '1px solid rgba(125, 211, 252, 0.35)',
                objectFit: 'cover',
                flexShrink: 0
              }}
            />
            <h1 style={{
              margin: 0,
              fontSize: isMobile ? '15px' : '20px',
              fontWeight: '800',
              letterSpacing: '-0.3px',
              lineHeight: 1.2,
              color: t.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {isMobile ? 'Primary Markets' : 'Primary Markets & Institutional Intelligence'}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '5px' : '8px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={fetchPrimaryMarketData}
              title="Refresh Screeners and Quotes"
              style={{
                background: t.refreshBtnBg,
                border: `1px solid ${t.refreshBtnBorder}`,
                color: t.refreshBtnText,
                padding: isMobile ? '6px 9px' : '7px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: isMobile ? '11px' : '12px',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              {!isMobile && 'Refresh'}
            </button>
            <button
              type="button"
              onClick={handleExportPrimaryCsv}
              title="Export Loaded Bhavcopy Stocks to CSV"
              style={{
                background: isLight ? '#ecfdf5' : 'rgba(16,185,129,0.12)',
                border: isLight ? '1px solid #a7f3d0' : '1px solid rgba(16,185,129,0.35)',
                color: isLight ? '#059669' : '#34d399',
                padding: isMobile ? '6px 9px' : '7px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: isMobile ? '11px' : '12px',
                fontWeight: '700',
                whiteSpace: 'nowrap'
              }}
            >
              ⬇ CSV
            </button>

            {/* 1-Click Theme Switcher (Light / Dark Universal Sync) */}
            <button
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
              aria-label="Toggle theme"
              style={{
                background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.06)',
                border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.15)'}`,
                padding: isMobile ? '6px 8px' : '7px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isLight ? '#475569' : '#fbbf24',
                transition: 'all 0.15s ease'
              }}
            >
              {isLight ? <Moon size={14} color="#475569" /> : <Sun size={14} color="#fbbf24" />}
            </button>

            {onOpenPaperTrading && (
              <button
                type="button"
                onClick={onOpenPaperTrading}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  border: 'none',
                  color: '#fff',
                  padding: isMobile ? '6px 10px' : '7px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: isMobile ? '11px' : '12px',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                📈 {!isMobile && 'Trade Live '}↗
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Subtitle badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '10px',
            background: isLight ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.15)',
            color: isLight ? '#15803d' : '#22c55e',
            border: isLight ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(34,197,94,0.3)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: '700',
            whiteSpace: 'nowrap'
          }}>
            Official EOD Feed ({bhavStats.asOfDate})
          </span>
          <span style={{
            fontSize: '10px',
            background: isLight ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.15)',
            color: isLight ? '#1d4ed8' : '#60a5fa',
            border: isLight ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(59,130,246,0.3)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: '700',
            whiteSpace: 'nowrap'
          }}>
            {bhavStats.totalStocks.toLocaleString('en-IN')} Stocks • {dealsStats.totalDeals.toLocaleString('en-IN')} Deals • {ipoData.length} IPOs
          </span>
        </div>
      </div>

      {/* 3 Master Tabs - Clean Horizontal Scroll on Mobile, Full Height Wrap on Desktop */}
      <div style={{
        display: 'flex',
        flexWrap: isMobile ? 'nowrap' : 'wrap',
        overflowX: isMobile ? 'auto' : 'visible',
        overflowY: 'visible',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
        gap: isMobile ? '6px' : '10px',
        marginBottom: isMobile ? '12px' : '20px',
        borderBottom: `1px solid ${t.borderSubtle}`,
        paddingTop: '6px',
        paddingBottom: isMobile ? '10px' : '14px',
        alignItems: 'center'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('BHAVCOPY')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '7px 12px' : '10px 18px', borderRadius: '12px', minHeight: isMobile ? '36px' : '42px',
            background: activeTab === 'BHAVCOPY' ? (isLight ? '#eff6ff' : 'rgba(59,130,246,0.18)') : t.pillInactiveBg,
            border: activeTab === 'BHAVCOPY' ? '1px solid #3b82f6' : `1px solid ${t.pillInactiveBorder}`,
            color: activeTab === 'BHAVCOPY' ? (isLight ? '#1d4ed8' : '#60a5fa') : t.pillInactiveText,
            fontSize: isMobile ? '12px' : '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s ease'
          }}
        >
          <BarChart2 size={14} /> {isMobile ? '📈 1. Delivery' : '📈 1. Delivery Screener'}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SCREENER')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '7px 12px' : '10px 18px', borderRadius: '12px', minHeight: isMobile ? '36px' : '42px',
            background: activeTab === 'SCREENER' ? (isLight ? '#eff6ff' : 'rgba(59,130,246,0.18)') : t.pillInactiveBg,
            border: activeTab === 'SCREENER' ? '1px solid #3b82f6' : `1px solid ${t.pillInactiveBorder}`,
            color: activeTab === 'SCREENER' ? (isLight ? '#1d4ed8' : '#60a5fa') : t.pillInactiveText,
            fontSize: isMobile ? '12px' : '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s ease'
          }}
        >
          <Zap size={14} color="#f59e0b" /> {isMobile ? '⚡ 2. Screener' : '⚡ 2. Market Screener'}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('FII_DII')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '7px 12px' : '10px 18px', borderRadius: '12px', minHeight: isMobile ? '36px' : '42px',
            background: activeTab === 'FII_DII' ? (isLight ? '#f0fdf4' : 'rgba(34,197,94,0.18)') : t.pillInactiveBg,
            border: activeTab === 'FII_DII' ? '1px solid #22c55e' : `1px solid ${t.pillInactiveBorder}`,
            color: activeTab === 'FII_DII' ? (isLight ? '#15803d' : '#4ade80') : t.pillInactiveText,
            fontSize: isMobile ? '12px' : '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s ease'
          }}
        >
          <Building2 size={14} color="#10b981" /> {isMobile ? '🏦 3. Smart Money' : '🏦 3. Smart Money (FII/DII)'}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CALENDAR')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '7px 12px' : '10px 18px', borderRadius: '12px', minHeight: isMobile ? '36px' : '42px',
            background: activeTab === 'CALENDAR' ? (isLight ? '#faf5ff' : 'rgba(168,85,247,0.18)') : t.pillInactiveBg,
            border: activeTab === 'CALENDAR' ? '1px solid #a855f7' : `1px solid ${t.pillInactiveBorder}`,
            color: activeTab === 'CALENDAR' ? (isLight ? '#7e22ce' : '#c084fc') : t.pillInactiveText,
            fontSize: isMobile ? '12px' : '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s ease'
          }}
        >
          <Calendar size={14} color="#8b5cf6" /> {isMobile ? '📅 4. Calendar' : '📅 4. Corporate Calendar'}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('DEALS')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '7px 12px' : '10px 18px', borderRadius: '12px', minHeight: isMobile ? '36px' : '42px',
            background: activeTab === 'DEALS' ? (isLight ? '#faf5ff' : 'rgba(168,85,247,0.18)') : t.pillInactiveBg,
            border: activeTab === 'DEALS' ? '1px solid #a855f7' : `1px solid ${t.pillInactiveBorder}`,
            color: activeTab === 'DEALS' ? (isLight ? '#7e22ce' : '#c084fc') : t.pillInactiveText,
            fontSize: isMobile ? '12px' : '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s ease'
          }}
        >
          <Building2 size={14} /> {isMobile ? '🏛️ 5. Deals' : '🏛️ 5. Bulk & Block Deals'}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('IPOS')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '7px 12px' : '10px 18px', borderRadius: '12px', minHeight: isMobile ? '36px' : '42px',
            background: activeTab === 'IPOS' ? (isLight ? '#f0fdf4' : 'rgba(34,197,94,0.18)') : t.pillInactiveBg,
            border: activeTab === 'IPOS' ? '1px solid #22c55e' : `1px solid ${t.pillInactiveBorder}`,
            color: activeTab === 'IPOS' ? (isLight ? '#15803d' : '#4ade80') : t.pillInactiveText,
            fontSize: isMobile ? '12px' : '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s ease'
          }}
        >
          <Sparkles size={14} /> {isMobile ? '🚀 6. IPO' : '🚀 6. IPO & GMP Hub'}
        </button>

        <button
          type="button"
          onClick={() => {
            if (typeof onOpenLeaderboard === 'function') onOpenLeaderboard();
            else if (typeof onOpenPaperTrading === 'function') onOpenPaperTrading();
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '7px 12px' : '10px 18px', borderRadius: '12px', minHeight: isMobile ? '36px' : '42px',
            background: isLight ? '#fef3c7' : 'rgba(245,158,11,0.15)',
            border: '1px solid rgba(245,158,11,0.4)',
            color: isLight ? '#b45309' : '#f59e0b',
            fontSize: isMobile ? '12px' : '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s ease'
          }}
        >
          <Trophy size={14} /> {isMobile ? '🏆 7. Arena' : '🏆 7. Trader Tournaments'}
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: FULL NSE & BSE BHAVCOPY SCREENER (20 CHECKBOXES + PER-COLUMN FILTERS)  */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'BHAVCOPY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Quick Stats KPI Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: isMobile ? '8px' : '12px' }}>
            <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px', boxShadow: t.cardShadow }}>
              <div style={{ fontSize: '10.5px', color: t.textMuted, textTransform: 'uppercase', fontWeight: '600' }}>Stocks Screened ({bhavStats.asOfDate})</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: t.text, marginTop: '2px' }}>
                {bhavTotalFiltered.toLocaleString('en-IN')} of {bhavStats.totalStocks.toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ background: isLight ? '#fefce8' : 'rgba(234,179,8,0.06)', border: isLight ? '1px solid #fef08a' : '1px solid rgba(234,179,8,0.25)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px', boxShadow: t.cardShadow }}>
              <div style={{ fontSize: '10.5px', color: isLight ? '#a16207' : '#fef08a', textTransform: 'uppercase', fontWeight: '700' }}>🔥 52W High Breakouts</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: isLight ? '#ca8a04' : '#eab308', marginTop: '2px' }}>
                {bhavStats.breakouts52w.toLocaleString('en-IN')} Stocks
              </div>
            </div>
            <div style={{ background: isLight ? '#f0f9ff' : 'rgba(56,189,248,0.06)', border: isLight ? '1px solid #bae6fd' : '1px solid rgba(56,189,248,0.25)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px', boxShadow: t.cardShadow }}>
              <div style={{ fontSize: '10.5px', color: isLight ? '#0284c7' : '#bae6fd', textTransform: 'uppercase', fontWeight: '700' }}>❄️ 52W Low Reversals</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: isLight ? '#0284c7' : '#38bdf8', marginTop: '2px' }}>
                {bhavStats.reversals52w.toLocaleString('en-IN')} Stocks
              </div>
            </div>
            <div style={{ background: isLight ? '#f0fdf4' : 'rgba(34,197,94,0.06)', border: isLight ? '1px solid #bbf7d0' : '1px solid rgba(34,197,94,0.25)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px', boxShadow: t.cardShadow }}>
              <div style={{ fontSize: '10.5px', color: isLight ? '#15803d' : '#86efac', textTransform: 'uppercase', fontWeight: '700' }}>💎 High Delivery (≥75%)</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: isLight ? '#16a34a' : '#22c55e', marginTop: '2px' }}>
                {bhavStats.highDelivery75.toLocaleString('en-IN')} Stocks
              </div>
            </div>
            <div style={{ background: isLight ? '#faf5ff' : 'rgba(168,85,247,0.06)', border: isLight ? '1px solid #e9d5ff' : '1px solid rgba(168,85,247,0.25)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px', gridColumn: isMobile ? 'span 2' : 'auto', boxShadow: t.cardShadow }}>
              <div style={{ fontSize: '10.5px', color: isLight ? '#7e22ce' : '#e9d5ff', textTransform: 'uppercase', fontWeight: '700' }}>⚡ Volume Surges (2x+)</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: isLight ? '#9333ea' : '#c084fc', marginTop: '2px' }}>
                {bhavStats.volumeSurges2x.toLocaleString('en-IN')} Stocks
              </div>
            </div>
          </div>

          {/* Screening & Filter Control Console */}
          <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '14px', padding: isMobile ? '12px' : '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: t.cardShadow }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: isMobile ? '100%' : 'auto', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <SlidersHorizontal size={16} color={isLight ? '#2563eb' : '#60a5fa'} />
                  <h3 style={{ margin: 0, fontSize: isMobile ? '13px' : '14px', fontWeight: '800', color: t.text }}>
                    {isMobile ? `Delivery Screener (${activeFilterCount})` : `20 Institutional Delivery & VWAP Filters (${activeFilterCount} Active)`}
                  </h3>
                </div>

                {/* View Mode Toggle: Cards vs Table */}
                <div style={{ display: 'flex', background: isLight ? '#f1f5f9' : '#0f172a', borderRadius: '8px', padding: '2px', border: `1px solid ${t.cardBorder}`, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setBhavViewMode('CARDS')}
                    style={{
                      padding: '4px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                      background: bhavViewMode === 'CARDS' ? '#3b82f6' : 'transparent',
                      color: bhavViewMode === 'CARDS' ? '#ffffff' : t.textMuted,
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                      boxShadow: bhavViewMode === 'CARDS' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    📊 Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => setBhavViewMode('TABLE')}
                    style={{
                      padding: '4px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                      background: bhavViewMode === 'TABLE' ? '#3b82f6' : 'transparent',
                      color: bhavViewMode === 'TABLE' ? '#ffffff' : t.textMuted,
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                      boxShadow: bhavViewMode === 'TABLE' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    📋 Table
                  </button>
                </div>
              </div>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetAllBhavFilters}
                  style={{ background: isLight ? '#fee2e2' : 'rgba(239,68,68,0.1)', border: isLight ? '1px solid #fca5a5' : '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Reset All Filters
                </button>
              )}
            </div>

            {/* Exchange Toggle Pills (Touch Swipeable) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: isMobile ? 'auto' : 'visible', flexWrap: isMobile ? 'nowrap' : 'wrap', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', width: '100%', paddingBottom: isMobile ? '2px' : '0' }}>
              <span style={{ fontSize: '11px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase', flexShrink: 0 }}>Exchange:</span>
              {[
                { id: 'ALL', label: `All (${bhavStats.totalStocks.toLocaleString('en-IN')})` },
                { id: 'NSE', label: `NSE (${bhavStats.nseCount.toLocaleString('en-IN')})` },
                { id: 'BSE', label: `BSE (${bhavStats.bseCount.toLocaleString('en-IN')})` }
              ].map(ex => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => setExchangeFilter(ex.id)}
                  style={{
                    padding: isMobile ? '4px 10px' : '5px 12px', borderRadius: '16px', fontSize: isMobile ? '11px' : '11.5px', fontWeight: '700', cursor: 'pointer',
                    background: exchangeFilter === ex.id ? '#3b82f6' : t.pillInactiveBg,
                    color: exchangeFilter === ex.id ? '#fff' : t.textSecondary,
                    border: exchangeFilter === ex.id ? '1px solid #2563eb' : `1px solid ${t.cardBorder}`, transition: 'all 0.12s',
                    whiteSpace: 'nowrap', flexShrink: 0
                  }}
                >
                  {ex.label}
                </button>
              ))}
            </div>

            {/* Inputs: Search, Sector & Delivery Slider */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Search Any NSE Symbol / BSE Code</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: t.textMuted }} />
                  <input
                    type="text"
                    placeholder="Search across all 5,797 stocks (e.g. RELIANCE, 500325, TATA)..."
                    value={bhavSearch}
                    onChange={e => setBhavSearch(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 32px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '8px', color: t.text, fontSize: '12.5px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Sector Filter</label>
                <select
                  value={sectorFilter}
                  onChange={e => setSectorFilter(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '8px', color: t.text, fontSize: '12.5px', cursor: 'pointer' }}
                >
                  <option value="ALL">All Sectors ({bhavStats.totalStocks.toLocaleString('en-IN')} Stocks)</option>
                  <option value="Banking & Financials">Banking &amp; Financials</option>
                  <option value="Information Tech">Information Tech</option>
                  <option value="Automobile">Automobile</option>
                  <option value="Energy & Power">Energy &amp; Power</option>
                  <option value="Metals & Mining">Metals &amp; Mining</option>
                  <option value="FMCG & Consumer">FMCG &amp; Consumer</option>
                  <option value="Pharma & Healthcare">Pharma &amp; Healthcare</option>
                  <option value="Defense & PSUs">Defense &amp; PSUs</option>
                  <option value="Infra & Telecom">Infra &amp; Telecom</option>
                  <option value="Capital Markets & Exchanges">Capital Markets &amp; Exchanges</option>
                  <option value="Electronics & Tech">Electronics &amp; Tech</option>
                  <option value="Chemicals, Industrial & Midcaps">Chemicals, Industrial &amp; Midcaps</option>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase' }}>Min Delivery %</label>
                  <span style={{ fontSize: '12px', color: isLight ? '#2563eb' : '#60a5fa', fontWeight: '800' }}>≥ {minDelivery}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="85"
                  step="5"
                  value={minDelivery}
                  onChange={e => setMinDelivery(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* 20 Institutional Checkbox Screener Pills (Collapsible on Mobile) */}
            {isMobile && (
              <button
                type="button"
                onClick={() => setShowMobileBhavFilters(p => !p)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: '8px',
                  background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${t.cardBorder}`, color: t.text,
                  fontSize: '11.5px', fontWeight: '700', cursor: 'pointer',
                  borderTop: `1px solid ${t.borderSubtle}`
                }}
              >
                <span>⚙️ 20 Screening Checkboxes ({activeFilterCount} Active)</span>
                <span>{showMobileBhavFilters ? '▲ Hide' : '▼ Expand Filters'}</span>
              </button>
            )}

            {(!isMobile || showMobileBhavFilters) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', borderTop: isMobile ? 'none' : `1px solid ${t.borderSubtle}`, paddingTop: isMobile ? '0' : '12px' }}>
                {[
                  { state: onlyBreakout, setter: setOnlyBreakout, label: '🔥 52W High Breakouts', color: isLight ? '#ca8a04' : '#eab308', bg: isLight ? '#fef9c3' : 'rgba(234,179,8,0.2)', text: isLight ? '#854d0e' : '#fef08a' },
                  { state: only52wLow, setter: setOnly52wLow, label: '❄️ 52W Low Reversals', color: isLight ? '#0284c7' : '#38bdf8', bg: isLight ? '#e0f2fe' : 'rgba(56,189,248,0.2)', text: isLight ? '#0369a1' : '#38bdf8' },
                  { state: onlySurge, setter: setOnlySurge, label: '⚡ Volume Surge (2x+)', color: isLight ? '#9333ea' : '#a855f7', bg: isLight ? '#f3e8ff' : 'rgba(168,85,247,0.2)', text: isLight ? '#6b21a8' : '#c084fc' },
                  { state: onlyMegaSurge, setter: setOnlyMegaSurge, label: '🚀 Mega Surge (3.5x+)', color: isLight ? '#e11d48' : '#f43f5e', bg: isLight ? '#ffe4e6' : 'rgba(244,63,94,0.2)', text: isLight ? '#9f1239' : '#fb7185' },
                  { state: onlyHighDelivery, setter: setOnlyHighDelivery, label: '💎 High Delivery (≥75%)', color: isLight ? '#16a34a' : '#22c55e', bg: isLight ? '#dcfce7' : 'rgba(34,197,94,0.2)', text: isLight ? '#14532d' : '#86efac' },
                  { state: onlyUltraDelivery, setter: setOnlyUltraDelivery, label: '🎯 Ultra Delivery (≥85%)', color: isLight ? '#059669' : '#10b981', bg: isLight ? '#d1fae5' : 'rgba(16,185,129,0.22)', text: isLight ? '#064e3b' : '#6ee7b7' },
                  { state: onlySmartAccumulation, setter: setOnlySmartAccumulation, label: '📈 Smart Accumulation', color: isLight ? '#059669' : '#10b981', bg: isLight ? '#d1fae5' : 'rgba(16,185,129,0.2)', text: isLight ? '#064e3b' : '#6ee7b7' },
                  { state: onlyDistribution, setter: setOnlyDistribution, label: '🚨 Distribution', color: isLight ? '#dc2626' : '#ef4444', bg: isLight ? '#fee2e2' : 'rgba(239,68,68,0.2)', text: isLight ? '#991b1b' : '#fca5a5' },
                  { state: onlyTopGainers, setter: setOnlyTopGainers, label: '🟢 Top Gainers (>2%)', color: isLight ? '#16a34a' : '#22c55e', bg: isLight ? '#dcfce7' : 'rgba(34,197,94,0.15)', text: isLight ? '#14532d' : '#4ade80' },
                  { state: onlyTopLosers, setter: setOnlyTopLosers, label: '🔴 Top Losers (<-1.5%)', color: isLight ? '#dc2626' : '#ef4444', bg: isLight ? '#fee2e2' : 'rgba(239,68,68,0.15)', text: isLight ? '#991b1b' : '#f87171' },
                  { state: onlyFno, setter: setOnlyFno, label: `🏛️ F&O Liquid Only (${bhavStats.fnoCount || 196})`, color: isLight ? '#2563eb' : '#3b82f6', bg: isLight ? '#dbeafe' : 'rgba(59,130,246,0.22)', text: isLight ? '#1e40af' : '#93c5fd' },
                  { state: onlyAboveVwap, setter: setOnlyAboveVwap, label: '📊 Price > VWAP', color: isLight ? '#0891b2' : '#06b6d4', bg: isLight ? '#cffafe' : 'rgba(6,182,212,0.2)', text: isLight ? '#155e75' : '#67e8f9' },
                  { state: onlyCloseNearHigh, setter: setOnlyCloseNearHigh, label: '📈 Close Near Day High', color: isLight ? '#16a34a' : '#22c55e', bg: isLight ? '#dcfce7' : 'rgba(34,197,94,0.18)', text: isLight ? '#14532d' : '#86efac' },
                  { state: onlyCloseNearLow, setter: setOnlyCloseNearLow, label: '📉 Close Near Day Low', color: isLight ? '#ea580c' : '#f97316', bg: isLight ? '#ffedd5' : 'rgba(249,115,22,0.2)', text: isLight ? '#9a3412' : '#fdba74' },
                  { state: onlyWideRange, setter: setOnlyWideRange, label: '💥 Wide Range (>4%)', color: isLight ? '#db2777' : '#ec4899', bg: isLight ? '#fce7f3' : 'rgba(236,72,153,0.2)', text: isLight ? '#9d174d' : '#f9a8d4' },
                  { state: onlyTightCoil, setter: setOnlyTightCoil, label: '🔒 NR7 / Tight Coil (<1.2%)', color: isLight ? '#7c3aed' : '#8b5cf6', bg: isLight ? '#ede9fe' : 'rgba(139,92,246,0.2)', text: isLight ? '#5b21b6' : '#c4b5fd' },
                  { state: onlyHighTurnover, setter: setOnlyHighTurnover, label: '💰 High Turnover (≥₹50 Cr)', color: isLight ? '#ca8a04' : '#eab308', bg: isLight ? '#fef9c3' : 'rgba(234,179,8,0.18)', text: isLight ? '#854d0e' : '#fde047' },
                  { state: onlyMidSmallAccum, setter: setOnlyMidSmallAccum, label: '🪙 Mid/Small Gems (₹50–₹500)', color: isLight ? '#0d9488' : '#14b8a6', bg: isLight ? '#ccfbf1' : 'rgba(20,184,166,0.2)', text: isLight ? '#115e59' : '#5eead4' },
                  { state: onlyCircuitGainers, setter: setOnlyCircuitGainers, label: '🚀 Momentum Runners (≥+4.5%)', color: isLight ? '#15803d' : '#16a34a', bg: isLight ? '#dcfce7' : 'rgba(22,163,74,0.22)', text: isLight ? '#14532d' : '#4ade80' },
                  { state: onlyCircuitLosers, setter: setOnlyCircuitLosers, label: '🩸 Heavy Sell-Off (≤-4%)', color: isLight ? '#b91c1c' : '#dc2626', bg: isLight ? '#fee2e2' : 'rgba(220,38,38,0.22)', text: isLight ? '#7f1d1d' : '#fca5a5' }
                ].map((pill, idx) => (
                  <label
                    key={idx}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: pill.state ? pill.bg : t.cardBgSubtle,
                      border: pill.state ? `1px solid ${pill.color}` : `1px solid ${t.borderSubtle}`,
                      padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px',
                      color: pill.state ? pill.text : t.textSecondary, fontWeight: pill.state ? '700' : '500',
                      transition: 'all 0.12s ease'
                    }}
                  >
                    <input type="checkbox" checked={pill.state} onChange={e => pill.setter(e.target.checked)} style={{ accentColor: pill.color }} />
                    <span>{pill.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Delivery Presentation: Cards on Mobile vs Table on Desktop */}
          {bhavViewMode === 'CARDS' ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
              {bhavcopyData.length === 0 ? (
                <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '36px', textAlign: 'center', color: t.textMuted, gridColumn: '1 / -1' }}>
                  No stocks matched your active filter combination. Click "Reset All Filters" or clear search keywords.
                </div>
              ) : (
                bhavcopyData.map((stock, idx) => {
                  const isAdded = Boolean(addedSymbols[stock.symbol]);
                  return (
                    <div
                      key={`${stock.symbol}_${idx}`}
                      style={{
                        background: t.cardBg,
                        border: `1px solid ${t.cardBorder}`,
                        borderRadius: '12px',
                        padding: '14px',
                        boxShadow: t.cardShadow,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      {/* Top Row: Symbol, Badges & LTP */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '800', color: t.text, fontSize: '15px' }}>{stock.symbol}</span>
                            {stock.isFnO && (
                              <span style={{ fontSize: '9px', background: isLight ? '#dbeafe' : 'rgba(59,130,246,0.2)', color: isLight ? '#1e40af' : '#93c5fd', border: isLight ? '1px solid #93c5fd' : '1px solid rgba(59,130,246,0.35)', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>F&amp;O</span>
                            )}
                            <span style={{ fontSize: '9.5px', background: isLight ? '#e0f2fe' : 'rgba(56,189,248,0.1)', color: isLight ? '#0284c7' : '#38bdf8', border: isLight ? '1px solid #bae6fd' : '1px solid rgba(56,189,248,0.25)', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                              {stock.exchange === 'BOTH' ? 'NSE • BSE' : stock.exchange}
                            </span>
                            {stock.bseCode && (
                              <span style={{ fontSize: '10px', color: t.textDim }}>#{stock.bseCode}</span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: t.textSecondary, marginTop: '2px' }}>
                            {stock.name && stock.name !== stock.symbol ? `${stock.name} • ` : ''}<span style={{ color: t.textMuted }}>{stock.sector}</span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: '800', color: t.text, fontSize: '15px' }}>
                            ₹{stock.ltp?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: '800', color: stock.change >= 0 ? (isLight ? '#16a34a' : '#22c55e') : '#ef4444', marginTop: '1px' }}>
                            {stock.change >= 0 ? `+${stock.change}%` : `${stock.change}%`}
                          </div>
                        </div>
                      </div>

                      {/* 4-Metric Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', background: isLight ? '#f8fafc' : 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: '8px' }}>
                        <div>
                          <div style={{ fontSize: '9px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase' }}>Delivery %</div>
                          <div style={{ fontSize: '12px', fontWeight: '800', color: stock.delivPct >= 75 ? (isLight ? '#15803d' : '#22c55e') : (isLight ? '#1d4ed8' : '#60a5fa'), marginTop: '2px' }}>
                            {stock.delivPct}%
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase' }}>Delivery Vol</div>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: t.textSecondary, marginTop: '2px' }}>
                            {(stock.delivQty / 100000).toFixed(2)} L
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase' }}>Traded Vol</div>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: t.textSecondary, marginTop: '2px' }}>
                            {(stock.volume / 100000).toFixed(2)} L
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase' }}>Turnover</div>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: t.text, marginTop: '2px' }}>
                            ₹{Number(stock.turnoverCr || ((stock.volume * stock.ltp) / 10000000)).toFixed(1)} Cr
                          </div>
                        </div>
                      </div>

                      {/* Technical Triggers & Badges */}
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {stock.is52wHigh && <span style={{ background: isLight ? '#fef9c3' : 'rgba(234,179,8,0.15)', color: isLight ? '#854d0e' : '#eab308', border: isLight ? '1px solid #fef08a' : '1px solid rgba(234,179,8,0.3)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>🔥 52W High</span>}
                        {stock.is52wLow && <span style={{ background: isLight ? '#e0f2fe' : 'rgba(56,189,248,0.15)', color: isLight ? '#0369a1' : '#38bdf8', border: isLight ? '1px solid #bae6fd' : '1px solid rgba(56,189,248,0.3)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>❄️ 52W Low</span>}
                        {stock.surgeMult >= 2.0 && <span style={{ background: isLight ? '#f3e8ff' : 'rgba(168,85,247,0.15)', color: isLight ? '#6b21a8' : '#c084fc', border: isLight ? '1px solid #e9d5ff' : '1px solid rgba(168,85,247,0.3)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>⚡ {stock.surgeMult}x Vol</span>}
                        {stock.aboveVwap && <span style={{ background: isLight ? '#cffafe' : 'rgba(6,182,212,0.12)', color: isLight ? '#155e75' : '#67e8f9', border: isLight ? '1px solid #a5f3fc' : '1px solid rgba(6,182,212,0.3)', padding: '2px 5px', borderRadius: '4px', fontSize: '9.5px', fontWeight: '700' }}>&gt;VWAP</span>}
                        {stock.vwap > 0 && <span style={{ fontSize: '10px', color: t.textDim, marginLeft: 'auto' }}>VWAP: ₹{Number(stock.vwap).toFixed(1)}</span>}
                      </div>

                      {/* Action Row */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', paddingTop: '6px', borderTop: `1px solid ${t.borderSubtle}` }}>
                        <button
                          type="button"
                          onClick={() => handleAddToWatchlist(stock.symbol)}
                          title="Add to Watchlist"
                          style={{
                            minWidth: '36px', height: '36px', borderRadius: '8px',
                            background: isAdded ? 'rgba(16,185,129,0.15)' : t.btnBg,
                            border: isAdded ? '1px solid #10b981' : `1px solid ${t.btnBorder}`,
                            color: isAdded ? '#10b981' : t.btnText,
                            fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          {isAdded ? <Check size={14} /> : <Plus size={14} />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenChart(stock.symbol)}
                          title="View Chart"
                          style={{
                            minWidth: '36px', height: '36px', borderRadius: '8px',
                            background: t.btnBg, border: `1px solid ${t.btnBorder}`, color: t.btnText,
                            fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          <BarChart2 size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePaperTrade(stock.symbol)}
                          style={{
                            height: '36px', padding: '0 14px', borderRadius: '8px',
                            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                            border: 'none', color: '#ffffff', fontSize: '12px', fontWeight: '700',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                          }}
                        >
                          <ShoppingCart size={13} /> Trade
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Delivery Table with Per-Column Sort & Per-Column Filter Inputs */
            <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', boxShadow: t.cardShadow }}>
              <table style={{ width: '100%', minWidth: '940px', borderCollapse: 'collapse', textAlign: 'left', fontSize: isMobile ? '12px' : '12.5px' }}>
                <thead>
                  {/* Row 1: Clickable Sort Headers */}
                  <tr style={{ background: t.tableHeaderBg, color: t.text, borderBottom: `1px solid ${t.tableHeaderBorder}`, textTransform: 'uppercase', fontSize: '11px', fontWeight: '800' }}>
                    <th onClick={() => handleSortBhavCol('symbol')} style={{ padding: '11px 14px', cursor: 'pointer', borderRight: `1px solid ${t.borderSubtle}` }}>
                      Stock / Company &amp; Sector ⇅
                    </th>
                    <th onClick={() => handleSortBhavCol('exchange')} style={{ padding: '11px 10px', cursor: 'pointer', borderRight: `1px solid ${t.borderSubtle}` }}>
                      Exchange ⇅
                    </th>
                    <th onClick={() => handleSortBhavCol('ltp')} style={{ padding: '11px 12px', textAlign: 'right', cursor: 'pointer', borderRight: `1px solid ${t.borderSubtle}` }}>
                      LTP / VWAP (₹) ⇅
                    </th>
                    <th onClick={() => handleSortBhavCol('change')} style={{ padding: '11px 12px', textAlign: 'right', cursor: 'pointer', borderRight: `1px solid ${t.borderSubtle}` }}>
                      Day Change ⇅
                    </th>
                    <th onClick={() => handleSortBhavCol('volume')} style={{ padding: '11px 12px', textAlign: 'right', cursor: 'pointer', borderRight: `1px solid ${t.borderSubtle}` }}>
                      Traded Vol ⇅
                    </th>
                    <th onClick={() => handleSortBhavCol('delivQty')} style={{ padding: '11px 12px', textAlign: 'right', cursor: 'pointer', borderRight: `1px solid ${t.borderSubtle}` }}>
                      Delivery Vol ⇅
                    </th>
                    <th onClick={() => handleSortBhavCol('delivPct')} style={{ padding: '11px 12px', textAlign: 'center', cursor: 'pointer', borderRight: `1px solid ${t.borderSubtle}` }}>
                      Delivery % ⇅
                    </th>
                    <th onClick={() => handleSortBhavCol('turnoverCr')} style={{ padding: '11px 12px', textAlign: 'right', cursor: 'pointer', borderRight: `1px solid ${t.borderSubtle}` }}>
                      Turnover (Cr) ⇅
                    </th>
                    <th onClick={() => handleSortBhavCol('surgeMult')} style={{ padding: '11px 12px', textAlign: 'center', cursor: 'pointer' }}>
                      Technical Triggers ⇅
                    </th>
                  </tr>

                  {/* Row 2: Per-Column Filter Inputs (LTP, Day Change, Traded Vol, Delivery Vol, Delivery %, Turnover, Technical Triggers) */}
                  <tr style={{ background: isLight ? '#f8fafc' : 'rgba(15,23,42,0.9)', borderBottom: `1px solid ${t.cardBorder}` }}>
                    <th style={{ padding: '6px 10px', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <input
                        type="text"
                        placeholder="Filter stock / sector..."
                        value={bhavColFilter.colStock}
                        onChange={e => setBhavColFilter(p => ({ ...p, colStock: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '5px', color: t.text, fontSize: '11px' }}
                      />
                    </th>
                    <th style={{ padding: '6px 8px', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <select
                        value={bhavColFilter.colExchange}
                        onChange={e => setBhavColFilter(p => ({ ...p, colExchange: e.target.value }))}
                        style={{ width: '100%', padding: '5px 6px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '5px', color: t.text, fontSize: '11px' }}
                      >
                        <option value="ALL">All Exch</option>
                        <option value="NSE">NSE</option>
                        <option value="BSE">BSE</option>
                        <option value="BOTH">NSE • BSE</option>
                      </select>
                    </th>
                    <th style={{ padding: '6px 8px', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <input
                        type="text"
                        placeholder="e.g. >200 or 50-500"
                        value={bhavColFilter.colLtp}
                        onChange={e => setBhavColFilter(p => ({ ...p, colLtp: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '5px', color: t.text, fontSize: '11px', textAlign: 'right' }}
                      />
                    </th>
                    <th style={{ padding: '6px 8px', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <input
                        type="text"
                        placeholder="e.g. >2 or <-1.5"
                        value={bhavColFilter.colChange}
                        onChange={e => setBhavColFilter(p => ({ ...p, colChange: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '5px', color: t.text, fontSize: '11px', textAlign: 'right' }}
                      />
                    </th>
                    <th style={{ padding: '6px 8px', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <input
                        type="text"
                        placeholder="Min L (e.g. >10)"
                        value={bhavColFilter.colVolume}
                        onChange={e => setBhavColFilter(p => ({ ...p, colVolume: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '5px', color: t.text, fontSize: '11px', textAlign: 'right' }}
                      />
                    </th>
                    <th style={{ padding: '6px 8px', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <input
                        type="text"
                        placeholder="Min L (e.g. >5)"
                        value={bhavColFilter.colDelivVol}
                        onChange={e => setBhavColFilter(p => ({ ...p, colDelivVol: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '5px', color: t.text, fontSize: '11px', textAlign: 'right' }}
                      />
                    </th>
                    <th style={{ padding: '6px 8px', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <input
                        type="text"
                        placeholder="Min % (e.g. 75)"
                        value={bhavColFilter.colDelivPct}
                        onChange={e => setBhavColFilter(p => ({ ...p, colDelivPct: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '5px', color: t.text, fontSize: '11px', textAlign: 'center' }}
                      />
                    </th>
                    <th style={{ padding: '6px 8px', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <input
                        type="text"
                        placeholder="Min Cr (e.g. 25)"
                        value={bhavColFilter.colTurnover}
                        onChange={e => setBhavColFilter(p => ({ ...p, colTurnover: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '5px', color: t.text, fontSize: '11px', textAlign: 'right' }}
                      />
                    </th>
                    <th style={{ padding: '6px 8px' }}>
                      <select
                        value={bhavColFilter.colSignal}
                        onChange={e => setBhavColFilter(p => ({ ...p, colSignal: e.target.value }))}
                        style={{ width: '100%', padding: '5px 6px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '5px', color: t.text, fontSize: '11px' }}
                      >
                        <option value="ALL">All Triggers</option>
                        <option value="52W_HIGH">🔥 52W High</option>
                        <option value="52W_LOW">❄️ 52W Low</option>
                        <option value="SURGE_2X">⚡ Surge 2x+</option>
                        <option value="MEGA_3_5X">🚀 Mega 3.5x+</option>
                        <option value="FNO">🏛️ F&amp;O Stock</option>
                        <option value="VWAP_BULL">📊 &gt; VWAP</option>
                      </select>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bhavcopyData.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: t.textMuted }}>
                        No stocks matched your active filter combination. Click "Reset All Filters" or clear the column filter boxes.
                      </td>
                    </tr>
                  ) : (
                    bhavcopyData.map((stock, idx) => (
                      <tr key={`${stock.symbol}_${idx}`} style={{ borderBottom: `1px solid ${t.tableRowBorder}`, transition: 'background 0.15s', background: idx % 2 === 1 ? (isLight ? '#fbfcfe' : 'rgba(255,255,255,0.01)') : 'transparent' }}>
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '700', color: t.text }}>{stock.symbol}</span>
                            {stock.isFnO && (
                              <span style={{ fontSize: '9px', background: isLight ? '#dbeafe' : 'rgba(59,130,246,0.2)', color: isLight ? '#1e40af' : '#93c5fd', border: isLight ? '1px solid #93c5fd' : '1px solid rgba(59,130,246,0.35)', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>F&amp;O</span>
                            )}
                            {stock.bseCode && (
                              <span style={{ fontSize: '10px', color: t.textMuted }}>#{stock.bseCode}</span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: t.textSecondary }}>
                            {stock.name && stock.name !== stock.symbol ? `${stock.name} • ` : ''}<span style={{ color: t.textMuted }}>{stock.sector}</span>
                          </div>
                        </td>
                        <td style={{ padding: '11px 10px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '10px', background: isLight ? '#e0f2fe' : 'rgba(56,189,248,0.1)', color: isLight ? '#0284c7' : '#38bdf8', border: isLight ? '1px solid #bae6fd' : '1px solid rgba(56,189,248,0.25)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                            {stock.exchange === 'BOTH' ? 'NSE • BSE' : stock.exchange}
                          </span>
                        </td>
                        <td style={{ padding: '11px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: '700', color: t.text }}>₹{stock.ltp?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                          {stock.vwap > 0 && (
                            <div style={{ fontSize: '10px', color: stock.aboveVwap ? (isLight ? '#15803d' : '#4ade80') : t.textMuted }}>
                              VWAP: ₹{Number(stock.vwap).toFixed(1)}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: '700', color: stock.change >= 0 ? (isLight ? '#16a34a' : '#22c55e') : '#ef4444', whiteSpace: 'nowrap' }}>
                          <div>{stock.change >= 0 ? `+${stock.change}%` : `${stock.change}%`}</div>
                          {stock.dayRangePct > 0 && (
                            <div style={{ fontSize: '10px', color: t.textMuted, fontWeight: '500' }}>H-L: {stock.dayRangePct}%</div>
                          )}
                        </td>
                        <td style={{ padding: '11px 12px', textAlign: 'right', color: t.textSecondary, whiteSpace: 'nowrap' }}>{(stock.volume / 100000).toFixed(2)} L</td>
                        <td style={{ padding: '11px 12px', textAlign: 'right', color: t.textSecondary, whiteSpace: 'nowrap' }}>{(stock.delivQty / 100000).toFixed(2)} L</td>
                        <td style={{ padding: '11px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: stock.delivPct >= 75 ? (isLight ? '#dcfce7' : 'rgba(34,197,94,0.15)') : (isLight ? '#dbeafe' : 'rgba(59,130,246,0.15)'), color: stock.delivPct >= 75 ? (isLight ? '#15803d' : '#22c55e') : (isLight ? '#1d4ed8' : '#60a5fa'), border: `1px solid ${stock.delivPct >= 75 ? (isLight ? '#86efac' : 'rgba(34,197,94,0.3)') : (isLight ? '#93c5fd' : 'rgba(59,130,246,0.3)')}`, padding: '3px 10px', borderRadius: '12px', fontWeight: '800' }}>
                            {stock.delivPct}%
                          </div>
                        </td>
                        <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: '600', color: t.text, whiteSpace: 'nowrap' }}>
                          ₹{Number(stock.turnoverCr || ((stock.volume * stock.ltp) / 10000000)).toFixed(2)} Cr
                        </td>
                        <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {stock.is52wHigh && <span title="52-Week High Breakout" style={{ background: isLight ? '#fef9c3' : 'rgba(234,179,8,0.15)', color: isLight ? '#854d0e' : '#eab308', border: isLight ? '1px solid #fef08a' : '1px solid rgba(234,179,8,0.3)', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' }}>🔥 52W High</span>}
                            {stock.is52wLow && <span title="52-Week Low Bounce" style={{ background: isLight ? '#e0f2fe' : 'rgba(56,189,248,0.15)', color: isLight ? '#0369a1' : '#38bdf8', border: isLight ? '1px solid #bae6fd' : '1px solid rgba(56,189,248,0.3)', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' }}>❄️ 52W Low</span>}
                            {stock.surgeMult >= 2.0 && <span title="Volume Surge 2x+" style={{ background: isLight ? '#f3e8ff' : 'rgba(168,85,247,0.15)', color: isLight ? '#6b21a8' : '#c084fc', border: isLight ? '1px solid #e9d5ff' : '1px solid rgba(168,85,247,0.3)', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' }}>⚡ {stock.surgeMult}x Vol</span>}
                            {stock.aboveVwap && <span title="Price Above VWAP" style={{ background: isLight ? '#cffafe' : 'rgba(6,182,212,0.12)', color: isLight ? '#155e75' : '#67e8f9', border: isLight ? '1px solid #a5f3fc' : '1px solid rgba(6,182,212,0.3)', padding: '2px 5px', borderRadius: '6px', fontSize: '9.5px', fontWeight: '700', whiteSpace: 'nowrap' }}>&gt;VWAP</span>}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Server-Side Bhavcopy Pagination / Load More Controls (~4 KB per page) */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: t.textMuted }}>
              Showing {bhavcopyData.length.toLocaleString('en-IN')} of {bhavTotalFiltered.toLocaleString('en-IN')} Matching Stocks (Total Universe: {bhavStats.totalStocks.toLocaleString('en-IN')} NSE &amp; BSE Equities)
            </span>
            {bhavHasMore && (
              <button
                type="button"
                disabled={loadingMoreBhav}
                onClick={() => fetchBhavcopyPage(bhavPage + 1, true)}
                style={{ background: isLight ? '#dbeafe' : 'rgba(59,130,246,0.15)', border: isLight ? '1px solid #93c5fd' : '1px solid rgba(59,130,246,0.35)', color: isLight ? '#1d4ed8' : '#60a5fa', padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
                {loadingMoreBhav ? 'Loading...' : 'Load More (+50 Stocks)'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: OPTION A - LIVE TECHNICAL & MULTI-FACTOR MARKET SCREENER               */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'SCREENER' && (
        <MarketScreenerTab onOpenPaperTrading={onOpenPaperTrading} isMobile={isMobile} t={t} isLight={isLight} />
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: OPTION B - SMART MONEY (FII / DII INSTITUTIONAL FLOW PULSE)            */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'FII_DII' && (
        <SmartMoneyTab isMobile={isMobile} t={t} isLight={isLight} />
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: OPTION C - CORPORATE ACTIONS & EARNINGS CALENDAR                       */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'CALENDAR' && (
        <CorporateCalendarTab onOpenPaperTrading={onOpenPaperTrading} isMobile={isMobile} t={t} isLight={isLight} />
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: BULK, BLOCK & INSIDER DEALS MONITOR (WITH PER-COLUMN FILTERS & SORT)   */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'DEALS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Deals KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: isMobile ? '8px' : '12px' }}>
            <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px', boxShadow: t.cardShadow }}>
              <div style={{ fontSize: '10.5px', color: t.textMuted, textTransform: 'uppercase', fontWeight: '600' }}>Total Deals ({activeDateHeaderLabel})</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: t.text, marginTop: '2px' }}>
                {dealsTotalFiltered.toLocaleString('en-IN')} / {dealsStats.totalDeals.toLocaleString('en-IN')} Deals
              </div>
            </div>
            <div style={{ background: isLight ? '#faf5ff' : 'rgba(168,85,247,0.08)', border: isLight ? '1px solid #e9d5ff' : '1px solid rgba(168,85,247,0.3)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px', boxShadow: t.cardShadow }}>
              <div style={{ fontSize: '10.5px', color: isLight ? '#7e22ce' : '#e9d5ff', textTransform: 'uppercase', fontWeight: '700' }}>Total Institutional Flow</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: isLight ? '#9333ea' : '#c084fc', marginTop: '2px' }}>
                ₹{dealsStats.totalFlowCr.toLocaleString('en-IN')} Cr
              </div>
            </div>
            <div style={{ background: isLight ? '#f0fdf4' : 'rgba(34,197,94,0.08)', border: isLight ? '1px solid #bbf7d0' : '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px', boxShadow: t.cardShadow }}>
              <div style={{ fontSize: '10.5px', color: isLight ? '#15803d' : '#86efac', textTransform: 'uppercase', fontWeight: '700' }}>Institutional Buying</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: isLight ? '#16a34a' : '#22c55e', marginTop: '2px' }}>
                ₹{dealsStats.buyFlowCr.toLocaleString('en-IN')} Cr
              </div>
            </div>
            <div style={{ background: isLight ? '#fef2f2' : 'rgba(239,68,68,0.08)', border: isLight ? '1px solid #fecaca' : '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px', boxShadow: t.cardShadow }}>
              <div style={{ fontSize: '10.5px', color: isLight ? '#b91c1c' : '#fca5a5', textTransform: 'uppercase', fontWeight: '700' }}>Institutional Selling</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: isLight ? '#dc2626' : '#ef4444', marginTop: '2px' }}>
                ₹{dealsStats.sellFlowCr.toLocaleString('en-IN')} Cr
              </div>
            </div>
          </div>

          {/* Advanced Filter Control Bar */}
          <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '14px', padding: isMobile ? '12px' : '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: t.cardShadow }}>

            {/* Row 1: Deal Type Pills & Search + View Mode Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: isMobile ? '100%' : 'auto', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '6px', overflowX: isMobile ? 'auto' : 'visible', flexWrap: isMobile ? 'nowrap' : 'wrap', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', width: isMobile ? '100%' : 'auto', paddingBottom: isMobile ? '2px' : '0' }}>
                  {[
                    { id: 'ALL', label: `All (${(dealsStats.totalDeals || 0).toLocaleString('en-IN')})` },
                    { id: 'BULK_DEAL', label: `Bulk (${(dealsStats.bulkCount || 0).toLocaleString('en-IN')})` },
                    { id: 'BLOCK_DEAL', label: `Block (${(dealsStats.blockCount || 0).toLocaleString('en-IN')})` },
                    { id: 'INSIDER_PROMOTER', label: `Insider (${(dealsStats.insiderCount || 0).toLocaleString('en-IN')})` },
                    { id: 'BUY', label: '🟢 Buys' },
                    { id: 'SELL', label: '🔴 Sells' }
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setDealTypeFilter(f.id)}
                      style={{
                        padding: isMobile ? '5px 10px' : '6px 12px', borderRadius: '20px', fontSize: isMobile ? '11px' : '11.5px', fontWeight: '700', cursor: 'pointer',
                        background: dealTypeFilter === f.id ? (isLight ? '#9333ea' : '#a855f7') : t.pillInactiveBg,
                        color: dealTypeFilter === f.id ? '#fff' : t.textSecondary,
                        border: dealTypeFilter === f.id ? '1px solid #7e22ce' : `1px solid ${t.cardBorder}`, whiteSpace: 'nowrap', flexShrink: 0
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* View Mode Toggle: Cards vs Table */}
                <div style={{ display: 'flex', background: isLight ? '#f1f5f9' : '#0f172a', borderRadius: '8px', padding: '2px', border: `1px solid ${t.cardBorder}`, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setDealsViewMode('CARDS')}
                    style={{
                      padding: '4px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                      background: dealsViewMode === 'CARDS' ? '#a855f7' : 'transparent',
                      color: dealsViewMode === 'CARDS' ? '#ffffff' : t.textMuted,
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                      boxShadow: dealsViewMode === 'CARDS' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    📊 Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => setDealsViewMode('TABLE')}
                    style={{
                      padding: '4px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                      background: dealsViewMode === 'TABLE' ? '#a855f7' : 'transparent',
                      color: dealsViewMode === 'TABLE' ? '#ffffff' : t.textMuted,
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                      boxShadow: dealsViewMode === 'TABLE' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    📋 Table
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: isMobile ? '100%' : '260px', flex: '1 1 260px', maxWidth: isMobile ? '100%' : '460px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: t.textMuted }} />
                  <input
                    type="text"
                    placeholder={`Search ${(dealsStats.globalTotal || dealsStats.totalDeals || 3000).toLocaleString('en-IN')}+ deals (e.g. Morgan Stanley, LIC, ZOMATO)...`}
                    value={dealsSearch}
                    onChange={e => setDealsSearch(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 32px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '8px', color: t.text, fontSize: '12px' }}
                  />
                </div>
                {activeDealsFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={resetAllDealsFilters}
                    style={{ background: isLight ? '#fee2e2' : 'rgba(239,68,68,0.12)', border: isLight ? '1px solid #fca5a5' : '1px solid rgba(239,68,68,0.35)', color: isLight ? '#991b1b' : '#ef4444', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Reset ({activeDealsFilterCount})
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: Institution Category Pills (Touch Swipeable) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: isMobile ? 'auto' : 'visible', flexWrap: isMobile ? 'nowrap' : 'wrap', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', width: '100%', borderTop: `1px solid ${t.borderSubtle}`, paddingTop: '10px', paddingBottom: isMobile ? '2px' : '0' }}>
              <span style={{ fontSize: '11px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase', flexShrink: 0 }}>Institution Desk:</span>
              {[
                { id: 'ALL', label: 'All Desks' },
                { id: 'FII', label: `🌍 FII (${(dealsStats.fiiCount || 0).toLocaleString('en-IN')})` },
                { id: 'DII', label: `🇮🇳 DII / MF (${(dealsStats.diiCount || 0).toLocaleString('en-IN')})` },
                { id: 'HFT', label: `⚡ HFT (${(dealsStats.hftCount || 0).toLocaleString('en-IN')})` },
                { id: 'PROMOTER', label: `👔 Promoters (${(dealsStats.insiderCount || 0).toLocaleString('en-IN')})` },
                { id: 'MULTI_DEAL', label: '🔥 Multi-Deal' }
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setDealsClientCategory(cat.id)}
                  style={{
                    padding: isMobile ? '4px 9px' : '4px 10px', borderRadius: '12px', fontSize: isMobile ? '10.5px' : '11px', fontWeight: '700', cursor: 'pointer',
                    background: dealsClientCategory === cat.id ? (isLight ? '#dbeafe' : 'rgba(59,130,246,0.22)') : t.pillInactiveBg,
                    color: dealsClientCategory === cat.id ? (isLight ? '#1d4ed8' : '#60a5fa') : t.textSecondary,
                    border: dealsClientCategory === cat.id ? '1px solid #3b82f6' : `1px solid ${t.cardBorder}`,
                    whiteSpace: 'nowrap', flexShrink: 0
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Row 3: Exchange, Date Range, Size & Sort Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', borderTop: `1px solid ${t.borderSubtle}`, paddingTop: '10px' }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase' }}>Exchange:</span>
                {['ALL', 'NSE', 'BSE'].map(ex => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setDealsExchangeFilter(ex)}
                    style={{
                      padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                      background: dealsExchangeFilter === ex ? (isLight ? '#dbeafe' : 'rgba(59,130,246,0.25)') : t.pillInactiveBg,
                      color: dealsExchangeFilter === ex ? (isLight ? '#1d4ed8' : '#60a5fa') : t.textSecondary,
                      border: dealsExchangeFilter === ex ? '1px solid #3b82f6' : `1px solid ${t.cardBorder}`
                    }}
                  >
                    {ex === 'ALL' ? 'All' : ex}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase' }}>Date:</span>
                {[
                  { id: 'ALL', label: 'Recent (30D)' },
                  { id: 'TODAY', label: `Today (${latestDealBadge})` },
                  { id: 'YESTERDAY', label: `Yesterday (${yesterdayDealBadge})` },
                  { id: 'WEEK', label: 'Past 7D' },
                  { id: 'YTD', label: '2026 YTD' },
                  { id: '1Y', label: '1 Year' },
                  { id: '3Y', label: '3 Years' },
                  { id: '5Y', label: '5 Years' },
                  { id: '10Y', label: '10 Years' },
                  { id: 'ALL_TIME', label: '22Y Archive' }
                ].map(dt => (
                  <button
                    key={dt.id}
                    type="button"
                    onClick={() => setDealsDateRange(dt.id)}
                    style={{
                      padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                      background: dealsDateRange === dt.id ? (isLight ? '#f3e8ff' : 'rgba(168,85,247,0.25)') : t.pillInactiveBg,
                      color: dealsDateRange === dt.id ? (isLight ? '#7e22ce' : '#c084fc') : t.textSecondary,
                      border: dealsDateRange === dt.id ? '1px solid #a855f7' : `1px solid ${t.cardBorder}`
                    }}
                  >
                    {dt.label}
                  </button>
                ))}

                <select
                  value={dealsDateRange.startsWith('YEAR_') ? dealsDateRange.replace('YEAR_', '') : ''}
                  onChange={(e) => {
                    if (e.target.value) setDealsDateRange(`YEAR_${e.target.value}`);
                    else setDealsDateRange('ALL');
                  }}
                  style={{
                    padding: '3px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '600',
                    background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text,
                    cursor: 'pointer', outline: 'none'
                  }}
                >
                  <option value="">Year...</option>
                  {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2012, 2010, 2008, 2005, 2004].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase' }}>Deal Size:</span>
                {[
                  { id: 0, label: 'All' },
                  { id: 10, label: '≥₹10 Cr' },
                  { id: 100, label: '≥₹100 Cr' },
                  { id: 300, label: '≥₹300 Cr' }
                ].map(sz => (
                  <button
                    key={sz.id}
                    type="button"
                    onClick={() => setDealsMinSize(sz.id)}
                    style={{
                      padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                      background: dealsMinSize === sz.id ? (isLight ? '#dcfce7' : 'rgba(34,197,94,0.25)') : t.pillInactiveBg,
                      color: dealsMinSize === sz.id ? (isLight ? '#15803d' : '#4ade80') : t.textSecondary,
                      border: dealsMinSize === sz.id ? '1px solid #22c55e' : `1px solid ${t.cardBorder}`
                    }}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase' }}>Sort:</span>
                {[
                  { id: 'DATE_DESC', label: 'Latest First' },
                  { id: 'VALUE_DESC', label: 'Largest Value' }
                ].map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setDealsSortBy(s.id)}
                    style={{
                      padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                      background: dealsSortBy === s.id ? (isLight ? '#e0f2fe' : 'rgba(56,189,248,0.2)') : t.pillInactiveBg,
                      color: dealsSortBy === s.id ? (isLight ? '#0284c7' : '#38bdf8') : t.textSecondary,
                      border: dealsSortBy === s.id ? '1px solid #0284c7' : `1px solid ${t.cardBorder}`
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 4: Last 7 Trading Days Quick-Select Bar + Small Calendar Picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', borderTop: `1px solid ${t.borderSubtle}`, paddingTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: isLight ? '#7e22ce' : '#c084fc', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                <Calendar size={13} />
                <span>Last 7 Days:</span>
              </div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                {recentDaysList.map((dItem, idx) => {
                  const isSelected = dealsDateRange === dItem.iso ||
                    (idx === 0 && dealsDateRange === 'TODAY') ||
                    (idx === 1 && dealsDateRange === 'YESTERDAY');
                  return (
                    <button
                      key={dItem.iso}
                      type="button"
                      onClick={() => setDealsDateRange(dItem.iso)}
                      style={{
                        padding: '3px 9px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        background: isSelected ? (isLight ? '#f3e8ff' : 'rgba(168,85,247,0.3)') : t.pillInactiveBg,
                        color: isSelected ? (isLight ? '#6b21a8' : '#f3e8ff') : t.textSecondary,
                        border: isSelected ? '1px solid #a855f7' : `1px solid ${t.cardBorder}`,
                        boxShadow: isSelected ? '0 0 10px rgba(168,85,247,0.25)' : 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease'
                      }}
                      title={`Filter deals for ${dItem.display || dItem.iso}`}
                    >
                      {dItem.label}
                    </button>
                  );
                })}
              </div>

              {/* Small Calendar Picker */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 8px',
                  borderRadius: '10px',
                  background: /^\d{4}-\d{2}-\d{2}$/.test(dealsDateRange) ? (isLight ? '#f3e8ff' : 'rgba(168,85,247,0.25)') : t.pillInactiveBg,
                  border: /^\d{4}-\d{2}-\d{2}$/.test(dealsDateRange) ? '1px solid #a855f7' : `1px solid ${t.cardBorder}`,
                  color: /^\d{4}-\d{2}-\d{2}$/.test(dealsDateRange) ? (isLight ? '#7e22ce' : '#c084fc') : t.textSecondary,
                  fontSize: '11px',
                  fontWeight: '600'
                }}
                title="Pick custom date from calendar"
              >
                <Calendar size={13} color={/^\d{4}-\d{2}-\d{2}$/.test(dealsDateRange) ? (isLight ? '#7e22ce' : '#c084fc') : t.textMuted} />
                <span style={{ fontSize: '11px', fontWeight: '700' }}>Calendar:</span>
                <input
                  type="date"
                  aria-label="Pick date from calendar"
                  value={/^\d{4}-\d{2}-\d{2}$/.test(dealsDateRange) ? dealsDateRange : ''}
                  max={dealsStats.latestDate || DEFAULT_TRADING_DATE.iso}
                  onChange={e => {
                    if (e.target.value) {
                      setDealsDateRange(e.target.value);
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: /^\d{4}-\d{2}-\d{2}$/.test(dealsDateRange) ? (isLight ? '#6b21a8' : '#f3e8ff') : t.textSecondary,
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    outline: 'none',
                    colorScheme: isLight ? 'light' : 'dark',
                    fontFamily: 'inherit'
                  }}
                />
                {/^\d{4}-\d{2}-\d{2}$/.test(dealsDateRange) && (
                  <button
                    type="button"
                    title="Clear custom date"
                    onClick={() => setDealsDateRange('ALL')}
                    style={{
                      background: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)',
                      border: 'none',
                      borderRadius: '50%',
                      color: t.text,
                      width: '15px',
                      height: '15px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {dealsDateRange !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setDealsDateRange('ALL')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: isLight ? '#fee2e2' : 'rgba(239,68,68,0.12)',
                    color: '#ef4444',
                    border: isLight ? '1px solid #fca5a5' : '1px solid rgba(239,68,68,0.3)',
                    marginLeft: isMobile ? '0' : 'auto'
                  }}
                >
                  Show All Dates
                </button>
              )}
            </div>
          </div>

          {/* Deals Presentation: Cards on Mobile vs Table on Desktop */}
          {dealsViewMode === 'CARDS' ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
              {loadingDeals ? (
                <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '36px', textAlign: 'center', color: t.textMuted, gridColumn: '1 / -1' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
                  <div>Loading matching institutional deals...</div>
                </div>
              ) : dealsData.length === 0 ? (
                <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '36px', textAlign: 'center', color: t.textMuted, gridColumn: '1 / -1' }}>
                  No institutional deals match this search or filter.
                </div>
              ) : (
                dealsData.map((deal, idx) => {
                  const isBuy = deal.type === 'BUY';
                  const isBlock = deal.dealType === 'BLOCK_DEAL';
                  const isAdded = Boolean(addedSymbols[deal.symbol]);

                  return (
                    <div
                      key={deal.id || idx}
                      style={{
                        background: t.cardBg,
                        border: `1px solid ${t.cardBorder}`,
                        borderRadius: '12px',
                        padding: '14px',
                        boxShadow: t.cardShadow,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      {/* Header Row: Symbol, Exchange & Buy/Sell + Type Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '800', color: t.text, fontSize: '15px' }}>{deal.symbol}</span>
                            <span style={{ fontSize: '9.5px', background: isLight ? '#e0f2fe' : 'rgba(56,189,248,0.1)', color: isLight ? '#0284c7' : '#38bdf8', border: isLight ? '1px solid #bae6fd' : '1px solid rgba(56,189,248,0.25)', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                              {deal.exchange || 'NSE'}
                            </span>
                            {deal.isMultiDeal && (
                              <span style={{ fontSize: '9px', background: isLight ? '#fef9c3' : 'rgba(234,179,8,0.18)', color: isLight ? '#854d0e' : '#facc15', border: isLight ? '1px solid #fef08a' : '1px solid rgba(234,179,8,0.35)', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>
                                🔥 CLUSTER
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px' }}>
                            {deal.company}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '10.5px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px',
                            background: isBuy ? (isLight ? '#dcfce7' : 'rgba(34,197,94,0.15)') : (isLight ? '#fee2e2' : 'rgba(239,68,68,0.15)'),
                            color: isBuy ? (isLight ? '#15803d' : '#22c55e') : '#ef4444',
                            border: `1px solid ${isBuy ? (isLight ? '#86efac' : 'rgba(34,197,94,0.3)') : (isLight ? '#fca5a5' : 'rgba(239,68,68,0.3)')}`
                          }}>
                            {deal.type}
                          </span>
                          <span style={{
                            fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                            background: isBlock ? (isLight ? '#faf5ff' : 'rgba(168,85,247,0.15)') : (isLight ? '#eff6ff' : 'rgba(59,130,246,0.15)'),
                            color: isBlock ? (isLight ? '#7e22ce' : '#c084fc') : (isLight ? '#1d4ed8' : '#60a5fa'),
                            border: `1px solid ${isBlock ? 'rgba(168,85,247,0.3)' : 'rgba(59,130,246,0.3)'}`
                          }}>
                            {isBlock ? 'BLOCK' : 'BULK'}
                          </span>
                        </div>
                      </div>

                      {/* Client & Desk Row */}
                      <div style={{ background: isLight ? '#f8fafc' : 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                          <span style={{ fontSize: '9px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase' }}>Client / Institution</span>
                          {deal.clientCategory && (
                            <span style={{ fontSize: '9.5px', fontWeight: '800', color: isLight ? '#7e22ce' : '#c084fc', background: isLight ? '#faf5ff' : 'rgba(168,85,247,0.15)', padding: '1px 5px', borderRadius: '3px' }}>
                              {deal.clientCategory}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: t.text }}>
                          {deal.client}
                        </div>
                      </div>

                      {/* Financials Row: Value, Price, Shares, Date */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', background: isLight ? '#f8fafc' : 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: '8px' }}>
                        <div>
                          <div style={{ fontSize: '9px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase' }}>Value</div>
                          <div style={{ fontSize: '12.5px', fontWeight: '800', color: isBuy ? (isLight ? '#15803d' : '#22c55e') : '#ef4444', marginTop: '1px' }}>
                            ₹{Number(deal.valueCr).toFixed(1)} Cr
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase' }}>Price</div>
                          <div style={{ fontSize: '11.5px', fontWeight: '700', color: t.text, marginTop: '1px' }}>
                            ₹{Number(deal.price).toFixed(1)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase' }}>Shares</div>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: t.textSecondary, marginTop: '1px' }}>
                            {(deal.qty / 100000).toFixed(2)} L
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase' }}>Date</div>
                          <div style={{ fontSize: '10.5px', fontWeight: '700', color: isLight ? '#7e22ce' : '#c084fc', marginTop: '1px' }}>
                            {deal.date?.slice(5)}
                          </div>
                        </div>
                      </div>

                      {/* Action Row */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', paddingTop: '6px', borderTop: `1px solid ${t.borderSubtle}` }}>
                        <button
                          type="button"
                          onClick={() => handleAddToWatchlist(deal.symbol)}
                          title="Add to Watchlist"
                          style={{
                            minWidth: '36px', height: '36px', borderRadius: '8px',
                            background: isAdded ? 'rgba(16,185,129,0.15)' : t.btnBg,
                            border: isAdded ? '1px solid #10b981' : `1px solid ${t.btnBorder}`,
                            color: isAdded ? '#10b981' : t.btnText,
                            fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          {isAdded ? <Check size={14} /> : <Plus size={14} />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenChart(deal.symbol)}
                          title="View Chart"
                          style={{
                            minWidth: '36px', height: '36px', borderRadius: '8px',
                            background: t.btnBg, border: `1px solid ${t.btnBorder}`, color: t.btnText,
                            fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          <BarChart2 size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePaperTrade(deal.symbol, deal.type)}
                          style={{
                            height: '36px', padding: '0 14px', borderRadius: '8px',
                            background: isBuy ? 'linear-gradient(135deg, #16a34a, #15803d)' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                            border: 'none', color: '#ffffff', fontSize: '12px', fontWeight: '700',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                          }}
                        >
                          <ShoppingCart size={13} /> Trade {deal.symbol}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Deals Table with Per-Column Sort & Per-Column Filter Inputs */
            <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', boxShadow: t.cardShadow }}>
              <table style={{ width: '100%', minWidth: '880px', borderCollapse: 'collapse', textAlign: 'left', fontSize: isMobile ? '12px' : '12.5px' }}>
                <thead>
                  {/* Row 1: Sortable Headers */}
                  <tr style={{ background: t.tableHeaderBg, color: t.text, borderBottom: `1px solid ${t.tableHeaderBorder}`, textTransform: 'uppercase', fontSize: '11px', fontWeight: '800' }}>
                    <th onClick={() => handleSortDealsCol('DATE')} style={{ padding: '11px 14px', cursor: 'pointer', borderRight: `1px solid ${t.borderSubtle}` }}>Date ⇅</th>
                    <th onClick={() => handleSortDealsCol('SYMBOL')} style={{ padding: '11px 14px', cursor: 'pointer', borderRight: `1px solid ${t.borderSubtle}` }}>Stock ⇅</th>
                    <th style={{ padding: '11px 10px', borderRight: `1px solid ${t.borderSubtle}` }}>Exch</th>
                    <th onClick={() => handleSortDealsCol('CLIENT')} style={{ padding: '11px 14px', cursor: 'pointer', borderRight: `1px solid ${t.borderSubtle}` }}>Client / Institution / Promoter ⇅</th>
                    <th style={{ padding: '11px 10px', textAlign: 'center', borderRight: `1px solid ${t.borderSubtle}` }}>Type</th>
                    <th onClick={() => handleSortDealsCol('QTY')} style={{ padding: '11px 12px', textAlign: 'right', cursor: 'pointer', borderRight: `1px solid ${t.borderSubtle}` }}>Shares Traded ⇅</th>
                    <th onClick={() => handleSortDealsCol('PRICE')} style={{ padding: '11px 12px', textAlign: 'right', cursor: 'pointer', borderRight: `1px solid ${t.borderSubtle}` }}>Price (₹) ⇅</th>
                    <th onClick={() => handleSortDealsCol('VALUECR')} style={{ padding: '11px 12px', textAlign: 'right', cursor: 'pointer' }}>Value (₹ Cr) ⇅</th>
                  </tr>

                  {/* Row 2: Per-Column Filter Inputs (Date, Stock, Exch, Client, Type, Shares Traded, Price, Value Cr) */}
                  <tr style={{ background: isLight ? '#f8fafc' : 'rgba(15,23,42,0.9)', borderBottom: `1px solid ${t.cardBorder}` }}>
                    <th style={{ padding: '6px 8px', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <input
                        type="text"
                        placeholder="YYYY-MM-DD..."
                        value={dealsColFilter.colDate}
                        onChange={e => setDealsColFilter(p => ({ ...p, colDate: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '5px', color: t.text, fontSize: '11px' }}
                      />
                    </th>
                    <th style={{ padding: '6px 8px', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <input
                        type="text"
                        placeholder="Filter stock..."
                        value={dealsColFilter.colStock}
                        onChange={e => setDealsColFilter(p => ({ ...p, colStock: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '5px', color: t.text, fontSize: '11px' }}
                      />
                    </th>
                    <th style={{ padding: '6px 8px', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <select
                        value={dealsColFilter.colExch}
                        onChange={e => setDealsColFilter(p => ({ ...p, colExch: e.target.value }))}
                        style={{ width: '100%', padding: '5px 5px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '5px', color: t.text, fontSize: '11px' }}
                      >
                        <option value="ALL">All</option>
                        <option value="NSE">NSE</option>
                        <option value="BSE">BSE</option>
                      </select>
                    </th>
                    <th style={{ padding: '6px 8px', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <input
                        type="text"
                        placeholder="Filter client / FII / MF / Promoter..."
                        value={dealsColFilter.colClient}
                        onChange={e => setDealsColFilter(p => ({ ...p, colClient: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '5px', color: t.text, fontSize: '11px' }}
                      />
                    </th>
                    <th style={{ padding: '6px 8px', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <select
                        value={dealsColFilter.colType}
                        onChange={e => setDealsColFilter(p => ({ ...p, colType: e.target.value }))}
                        style={{ width: '100%', padding: '5px 5px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '5px', color: t.text, fontSize: '11px' }}
                      >
                        <option value="ALL">All</option>
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                        <option value="BULK_DEAL">BULK</option>
                        <option value="BLOCK_DEAL">BLOCK</option>
                        <option value="INSIDER_PROMOTER">INSIDER</option>
                      </select>
                    </th>
                    <th style={{ padding: '6px 8px', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <input
                        type="text"
                        placeholder="Min shares (e.g. >100000)"
                        value={dealsColFilter.colQty}
                        onChange={e => setDealsColFilter(p => ({ ...p, colQty: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '5px', color: t.text, fontSize: '11px', textAlign: 'right' }}
                      />
                    </th>
                    <th style={{ padding: '6px 8px', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <input
                        type="text"
                        placeholder="e.g. >200 or 50-500"
                        value={dealsColFilter.colPrice}
                        onChange={e => setDealsColFilter(p => ({ ...p, colPrice: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '5px', color: t.text, fontSize: '11px', textAlign: 'right' }}
                      />
                    </th>
                    <th style={{ padding: '6px 8px' }}>
                      <input
                        type="text"
                        placeholder="Min Cr (e.g. >25)"
                        value={dealsColFilter.colValue}
                        onChange={e => setDealsColFilter(p => ({ ...p, colValue: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '5px', color: t.text, fontSize: '11px', textAlign: 'right' }}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loadingDeals ? (
                    <tr>
                      <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: t.textMuted }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <div style={{ width: '16px', height: '16px', border: '2px solid #a855f7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                          <span>Loading matching institutional deals...</span>
                        </div>
                      </td>
                    </tr>
                  ) : dealsData.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: t.textMuted }}>
                        No institutional deals match this search or column filter. Try clearing the column filter boxes.
                      </td>
                    </tr>
                  ) : (
                    dealsData.map((deal, idx) => (
                      <tr key={deal.id || idx} style={{ borderBottom: `1px solid ${t.tableRowBorder}`, background: idx % 2 === 1 ? (isLight ? '#fbfcfe' : 'rgba(255,255,255,0.01)') : 'transparent' }}>
                        <td
                          onClick={() => setDealsDateRange(deal.date)}
                          style={{ padding: '12px 14px', color: isLight ? '#7e22ce' : '#c084fc', whiteSpace: 'nowrap', fontWeight: '600', cursor: 'pointer' }}
                          title={`Click to filter deals by ${deal.date}`}
                        >
                          {deal.date}
                        </td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: '700', color: t.text }}>{deal.symbol}</span>
                            {deal.isMultiDeal && (
                              <span title="Multiple Institutional Deals in this Stock" style={{ fontSize: '9px', background: isLight ? '#fef9c3' : 'rgba(234,179,8,0.18)', color: isLight ? '#854d0e' : '#facc15', border: isLight ? '1px solid #fef08a' : '1px solid rgba(234,179,8,0.35)', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>🔥 CLUSTER</span>
                            )}
                          </div>
                          <div style={{ fontSize: '10.5px', color: t.textMuted }}>{deal.company}</div>
                        </td>
                        <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '10px', background: isLight ? '#e0f2fe' : 'rgba(56,189,248,0.1)', color: isLight ? '#0284c7' : '#38bdf8', border: isLight ? '1px solid #bae6fd' : '1px solid rgba(56,189,248,0.25)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                            {deal.exchange || 'NSE'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: t.textSecondary }}>
                          <div style={{ fontWeight: '600', color: t.text }}>{deal.client}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{ fontSize: '10px', color: t.textMuted }}>{deal.dealType?.replace('_', ' ')}</span>
                            {deal.clientCategory && (
                              <span style={{ fontSize: '9.5px', background: isLight ? '#f3e8ff' : 'rgba(168,85,247,0.15)', color: isLight ? '#7e22ce' : '#c084fc', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                                {deal.clientCategory}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{ background: deal.type === 'BUY' ? (isLight ? '#dcfce7' : 'rgba(34,197,94,0.15)') : (isLight ? '#fee2e2' : 'rgba(239,68,68,0.15)'), color: deal.type === 'BUY' ? (isLight ? '#15803d' : '#22c55e') : (isLight ? '#dc2626' : '#ef4444'), border: `1px solid ${deal.type === 'BUY' ? (isLight ? '#86efac' : 'rgba(34,197,94,0.3)') : (isLight ? '#fca5a5' : 'rgba(239,68,68,0.3)')}`, padding: '2px 8px', borderRadius: '6px', fontWeight: '700', fontSize: '11px' }}>
                            {deal.type}
                          </span>
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', whiteSpace: 'nowrap', color: t.textSecondary }}>{deal.qty?.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap', color: t.text }}>₹{deal.price?.toFixed(2)}</td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '700', color: isLight ? '#1e293b' : '#f8fafc', whiteSpace: 'nowrap' }}>₹{deal.valueCr?.toFixed(2)} Cr</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Server-Side Deals Pagination / Load More Controls (~4 KB per page) */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: t.textMuted }}>
              Showing {dealsData.length.toLocaleString('en-IN')} of {dealsTotalFiltered.toLocaleString('en-IN')} Matching Institutional Deals (Total Monitored: {dealsStats.totalDeals.toLocaleString('en-IN')})
            </span>
            {dealsHasMore && (
              <button
                type="button"
                disabled={loadingMoreDeals}
                onClick={() => fetchDealsPage(dealsPage + 1, true)}
                style={{ background: isLight ? '#f3e8ff' : 'rgba(168,85,247,0.15)', border: isLight ? '1px solid #d8b4fe' : '1px solid rgba(168,85,247,0.35)', color: isLight ? '#7e22ce' : '#c084fc', padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
                {loadingMoreDeals ? 'Loading...' : 'Load More (+50 Deals)'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: IPO & SME ALLOTMENT, 14-COLUMN LIVE SUBSCRIPTION TABLE & GMP HUB       */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'IPOS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Top IPO Summary KPI Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(190px, 1fr))', gap: isMobile ? '8px' : '12px' }}>
            <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px', boxShadow: t.cardShadow }}>
              <div style={{ fontSize: '10.5px', color: t.textMuted, textTransform: 'uppercase', fontWeight: '600' }}>
                {ipoCategory === 'MAINBOARD' ? 'Mainboard Issues Tracked' : (ipoCategory === 'SME' ? 'SME Issues Tracked' : 'Total Issues Tracked')}
              </div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: t.text, marginTop: '2px' }}>
                {(() => {
                  const activeUniverseCount = ipoCategory === 'MAINBOARD'
                    ? (ipoStats?.mainboardCount || ipoData.filter(i => i.category === 'MAINBOARD').length)
                    : (ipoCategory === 'SME'
                        ? (ipoStats?.smeCount || ipoData.filter(i => i.category === 'SME').length)
                        : (ipoStats?.totalIssues || ipoData.length));
                  if (ipoSearch.trim() || Object.values(colSearch).some(v => Boolean(v && v.trim()))) {
                    return `${filteredIpos.length.toLocaleString('en-IN')} of ${activeUniverseCount.toLocaleString('en-IN')} Issues`;
                  }
                  return `${activeUniverseCount.toLocaleString('en-IN')} Issues Tracked`;
                })()}
              </div>
            </div>
            <div style={{ background: isLight ? '#f0fdf4' : 'rgba(34,197,94,0.07)', border: isLight ? '1px solid #bbf7d0' : '1px solid rgba(34,197,94,0.28)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px', boxShadow: t.cardShadow }}>
              <div style={{ fontSize: '10.5px', color: isLight ? '#15803d' : '#86efac', textTransform: 'uppercase', fontWeight: '700' }}>🟢 Live / Bidding Open</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: isLight ? '#16a34a' : '#22c55e', marginTop: '2px' }}>
                {ipoData.filter(i => i.status === 'OPEN').length} Active Now
              </div>
            </div>
            <div style={{ background: isLight ? '#eff6ff' : 'rgba(59,130,246,0.07)', border: isLight ? '1px solid #bfdbfe' : '1px solid rgba(59,130,246,0.28)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px', boxShadow: t.cardShadow }}>
              <div style={{ fontSize: '10.5px', color: isLight ? '#1d4ed8' : '#bae6fd', textTransform: 'uppercase', fontWeight: '700' }}>⏳ Confirmed Upcoming</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: isLight ? '#2563eb' : '#60a5fa', marginTop: '2px' }}>
                {ipoData.filter(i => i.status === 'UPCOMING').length} Pipeline
              </div>
            </div>
            <div style={{ background: isLight ? '#faf5ff' : 'rgba(168,85,247,0.07)', border: isLight ? '1px solid #e9d5ff' : '1px solid rgba(168,85,247,0.28)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px', boxShadow: t.cardShadow }}>
              <div style={{ fontSize: '10.5px', color: isLight ? '#7e22ce' : '#e9d5ff', textTransform: 'uppercase', fontWeight: '700' }}>🚀 On Listing &amp; Listed</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: isLight ? '#9333ea' : '#c084fc', marginTop: '2px' }}>
                {(ipoStats?.listedCount || ipoData.filter(i => i.status === 'LISTED' || i.status === 'CLOSED').length).toLocaleString('en-IN')} Completed
              </div>
            </div>
          </div>

          {/* Category Toggle, View Mode Switcher & Search */}
          <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '14px', padding: isMobile ? '12px' : '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: t.cardShadow }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', flexWrap: isMobile ? 'wrap' : 'wrap', gap: '12px' }}>
              {/* Category Pills (Touch Swipeable) */}
              <div style={{ display: 'flex', gap: '8px', overflowX: isMobile ? 'auto' : 'visible', flexWrap: isMobile ? 'nowrap' : 'wrap', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', paddingBottom: isMobile ? '2px' : '0' }}>
                {[
                  { id: 'ALL', label: isMobile ? `All (${(ipoStats?.totalIssues || ipoData.length).toLocaleString('en-IN')})` : `All IPOs (${(ipoStats?.totalIssues || ipoData.length).toLocaleString('en-IN')})` },
                  { id: 'MAINBOARD', label: isMobile ? `🏢 Mainboard (${(ipoStats?.mainboardCount || ipoData.filter(i => i.category === 'MAINBOARD').length).toLocaleString('en-IN')})` : `🏢 Mainboard (${(ipoStats?.mainboardCount || ipoData.filter(i => i.category === 'MAINBOARD').length).toLocaleString('en-IN')})` },
                  { id: 'SME', label: isMobile ? `🚀 SME (${(ipoStats?.smeCount || ipoData.filter(i => i.category === 'SME').length).toLocaleString('en-IN')})` : `🚀 SME IPOs (${(ipoStats?.smeCount || ipoData.filter(i => i.category === 'SME').length).toLocaleString('en-IN')})` }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setIpoCategory(cat.id)}
                    style={{
                      padding: isMobile ? '6px 12px' : '7px 14px', borderRadius: '20px', fontSize: isMobile ? '11.5px' : '12px', fontWeight: '700', cursor: 'pointer',
                      background: ipoCategory === cat.id ? '#22c55e' : t.pillInactiveBg,
                      color: ipoCategory === cat.id ? '#fff' : t.textSecondary,
                      border: ipoCategory === cat.id ? '1px solid #16a34a' : `1px solid ${t.cardBorder}`, whiteSpace: 'nowrap',
                      flexShrink: 0, minHeight: isMobile ? '36px' : 'auto'
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* View Mode Switcher */}
              <div style={{ display: 'flex', gap: '6px', background: isLight ? '#f1f5f9' : 'rgba(0,0,0,0.35)', padding: '4px', borderRadius: '10px', border: `1px solid ${t.borderSubtle}`, alignSelf: isMobile ? 'flex-start' : 'auto' }}>
                <button
                  type="button"
                  onClick={() => setIpoViewMode('CARDS')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '6px 12px' : '6px 12px', borderRadius: '7px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', border: 'none',
                    background: ipoViewMode === 'CARDS' ? (isLight ? '#ffffff' : 'rgba(34,197,94,0.22)') : 'transparent',
                    color: ipoViewMode === 'CARDS' ? (isLight ? '#15803d' : '#4ade80') : t.textMuted,
                    boxShadow: ipoViewMode === 'CARDS' ? (isLight ? '0 1px 3px rgba(0,0,0,0.1)' : 'none') : 'none',
                    minHeight: isMobile ? '34px' : 'auto'
                  }}
                >
                  <LayoutGrid size={14} /> {isMobile ? '🗂️ Cards' : '🗂️ GMP & Allotment Cards'}
                </button>
                <button
                  type="button"
                  onClick={() => setIpoViewMode('SUBSCRIPTION_TABLE')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '6px 12px' : '6px 12px', borderRadius: '7px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', border: 'none',
                    background: ipoViewMode === 'SUBSCRIPTION_TABLE' ? (isLight ? '#ffffff' : 'rgba(59,130,246,0.25)') : 'transparent',
                    color: ipoViewMode === 'SUBSCRIPTION_TABLE' ? (isLight ? '#1d4ed8' : '#60a5fa') : t.textMuted,
                    boxShadow: ipoViewMode === 'SUBSCRIPTION_TABLE' ? (isLight ? '0 1px 3px rgba(0,0,0,0.1)' : 'none') : 'none',
                    minHeight: isMobile ? '34px' : 'auto'
                  }}
                >
                  <Table size={14} /> {isMobile ? '📋 Table' : '📊 Live Subscription Status Table (14 Cols)'}
                </button>
              </div>
            </div>

            {/* 🧭 Era & 30-Year Historical Timeline Selector (Touch Swipeable) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: isMobile ? 'auto' : 'visible', flexWrap: isMobile ? 'nowrap' : 'wrap', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', borderTop: `1px solid ${t.borderSubtle}`, paddingTop: '10px', paddingBottom: isMobile ? '2px' : '0' }}>
              <span style={{ fontSize: '11px', color: t.textMuted, fontWeight: '700', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <Clock size={12} color="#3b82f6" /> Timeline:
              </span>
              {[
                { id: 'ALL', label: 'All Issues' },
                { id: 'ACTIVE', label: '🟢 Live' },
                { id: '2026_YTD', label: '2026 YTD' },
                { id: '2025', label: '2025' },
                { id: '2024', label: '2024' },
                { id: '2023', label: '2023' },
                { id: '3Y', label: '3 Years' },
                { id: '5Y', label: '5 Years' },
                { id: '10Y', label: '10 Years' },
                { id: 'ARCHIVE_30Y', label: '30Y Archive' }
              ].map(era => {
                const isSel = ipoEraFilter === era.id;
                return (
                  <button
                    key={era.id}
                    type="button"
                    onClick={() => {
                      setIpoEraFilter(era.id);
                      if (era.id !== 'ALL' && era.id !== 'ACTIVE' && (ipoStatusFilter === 'OPEN' || ipoStatusFilter === 'UPCOMING')) {
                        setIpoStatusFilter('ALL');
                      }
                    }}
                    style={{
                      padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                      background: isSel ? '#3b82f6' : t.pillInactiveBg,
                      color: isSel ? '#ffffff' : t.textSecondary,
                      border: isSel ? '1px solid #2563eb' : `1px solid ${t.cardBorder}`,
                      boxShadow: isSel ? '0 2px 5px rgba(59,130,246,0.3)' : 'none',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      minHeight: isMobile ? '32px' : 'auto'
                    }}
                  >
                    {era.label}
                  </button>
                );
              })}

              <select
                aria-label="Select IPO era or year"
                value={['2022', '2021', '2016_2020', '2000_2015', '1990S'].includes(ipoEraFilter) ? ipoEraFilter : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setIpoEraFilter(e.target.value);
                    if (ipoStatusFilter === 'OPEN' || ipoStatusFilter === 'UPCOMING') {
                      setIpoStatusFilter('ALL');
                    }
                  } else {
                    setIpoEraFilter('ALL');
                  }
                }}
                style={{
                  padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '700',
                  background: ['2022', '2021', '2016_2020', '2000_2015', '1990S'].includes(ipoEraFilter) ? '#3b82f6' : t.inputBg,
                  border: ['2022', '2021', '2016_2020', '2000_2015', '1990S'].includes(ipoEraFilter) ? '1px solid #2563eb' : `1px solid ${t.inputBorder}`,
                  color: ['2022', '2021', '2016_2020', '2000_2015', '1990S'].includes(ipoEraFilter) ? '#ffffff' : t.text,
                  cursor: 'pointer', outline: 'none', flexShrink: 0, minHeight: isMobile ? '32px' : 'auto'
                }}
              >
                <option value="" style={{ background: t.cardBg, color: t.text }}>More Eras...</option>
                <option value="2022" style={{ background: t.cardBg, color: t.text }}>2022 (78 IPOs)</option>
                <option value="2021" style={{ background: t.cardBg, color: t.text }}>2021 (75 IPOs)</option>
                <option value="2016_2020" style={{ background: t.cardBg, color: t.text }}>2016 – 2020 (30 Landmark)</option>
                <option value="2000_2015" style={{ background: t.cardBg, color: t.text }}>2000 – 2015 (22 Landmark)</option>
                <option value="1990S" style={{ background: t.cardBg, color: t.text }}>1990s Pioneers (10 Issues)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', flexWrap: 'wrap', gap: '10px', borderTop: `1px solid ${t.borderSubtle}`, paddingTop: '10px' }}>
              {/* Status Pills (Touch Swipeable) */}
              <div style={{ display: 'flex', gap: '6px', overflowX: isMobile ? 'auto' : 'visible', flexWrap: isMobile ? 'nowrap' : 'wrap', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', paddingBottom: isMobile ? '2px' : '0', width: isMobile ? '100%' : 'auto' }}>
                {[
                  { id: 'ALL', label: isMobile ? `All (${(ipoStats?.totalIssues || ipoData.length).toLocaleString('en-IN')})` : `All Status (${(ipoStats?.totalIssues || ipoData.length).toLocaleString('en-IN')})` },
                  { id: 'OPEN', label: isMobile ? `🟢 Live (${ipoData.filter(i => i.status === 'OPEN').length})` : `🟢 Live / Bidding Open (${ipoData.filter(i => i.status === 'OPEN').length})` },
                  { id: 'UPCOMING', label: isMobile ? `⏳ Upcoming (${ipoData.filter(i => i.status === 'UPCOMING').length})` : `⏳ Confirmed Upcoming (${ipoData.filter(i => i.status === 'UPCOMING').length})` },
                  { id: 'LISTED', label: isMobile ? `🚀 Listed (${(ipoStats?.listedCount || ipoData.filter(i => i.status === 'LISTED' || i.status === 'CLOSED').length).toLocaleString('en-IN')})` : `🚀 On Listing & Listed (${(ipoStats?.listedCount || ipoData.filter(i => i.status === 'LISTED' || i.status === 'CLOSED').length).toLocaleString('en-IN')})` }
                ].map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setIpoStatusFilter(st.id)}
                    style={{
                      padding: '5px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                      background: ipoStatusFilter === st.id ? (isLight ? '#dbeafe' : 'rgba(59,130,246,0.2)') : t.pillInactiveBg,
                      color: ipoStatusFilter === st.id ? (isLight ? '#1d4ed8' : '#60a5fa') : t.textSecondary,
                      border: ipoStatusFilter === st.id ? '1px solid #3b82f6' : `1px solid ${t.cardBorder}`,
                      whiteSpace: 'nowrap', flexShrink: 0, minHeight: isMobile ? '32px' : 'auto'
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: isMobile ? '100%' : '280px', flex: '1 1 260px', maxWidth: isMobile ? '100%' : '440px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: t.textMuted }} />
                  <input
                    type="text"
                    placeholder={isMobile ? "Search company, registrar..." : "Search company, registrar (KFintech, Link Intime, Bigshare)..."}
                    value={ipoSearch}
                    onChange={e => setIpoSearch(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 32px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '8px', color: t.text, fontSize: '12px' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fetchIposList(true)}
                  disabled={isRefreshingIpo}
                  title="Refresh Live GMP & Subscriptions from Market Feeds"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 11px',
                    borderRadius: '8px', fontSize: '11px', fontWeight: '700',
                    background: isLight ? '#dcfce7' : 'rgba(34,197,94,0.12)', border: isLight ? '1px solid #86efac' : '1px solid rgba(34,197,94,0.35)',
                    color: isLight ? '#15803d' : '#4ade80', cursor: isRefreshingIpo ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap', minHeight: isMobile ? '34px' : 'auto'
                  }}
                >
                  <RefreshCw size={12} className={isRefreshingIpo ? 'spin-icon' : ''} />
                  <span>{isRefreshingIpo ? 'Syncing...' : (ipoLastUpdated ? `⚡ ${ipoLastUpdated}` : 'Live Sync')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* VIEW MODE 1: 14-COLUMN LIVE SUBSCRIPTION STATUS TABLE */}
          {ipoViewMode === 'SUBSCRIPTION_TABLE' && (
            <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', boxShadow: t.cardShadow }}>
              <table style={{ width: '100%', minWidth: '1480px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: t.tableHeaderBg, color: t.text, borderBottom: `1px solid ${t.tableHeaderBorder}`, fontSize: '11px', fontWeight: '800' }}>
                    <th onClick={() => handleSortIpoCol('name')} style={{ padding: '10px 12px', cursor: 'pointer', minWidth: '230px', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Company</span>
                        <ArrowUpDown size={11} color={t.textMuted} />
                      </div>
                    </th>
                    <th onClick={() => handleSortIpoCol('closeDate')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'center', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <div>Closing</div>
                      <div>Date ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('issueSizeCr')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <div>Issue Amount</div>
                      <div style={{ fontSize: '10px', color: t.textMuted }}>(Rs.Cr.) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('qib')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <div>QIB</div>
                      <div style={{ fontSize: '10px', color: t.textMuted }}>(X) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('snii')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <div>SNII</div>
                      <div style={{ fontSize: '10px', color: t.textMuted }}>(X) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('bnii')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <div>BNII</div>
                      <div style={{ fontSize: '10px', color: t.textMuted }}>(X) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('nii')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <div>NII</div>
                      <div style={{ fontSize: '10px', color: t.textMuted }}>(X) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('retail')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <div>Retail</div>
                      <div style={{ fontSize: '10px', color: t.textMuted }}>(X) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('employee')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <div>Employee</div>
                      <div style={{ fontSize: '10px', color: t.textMuted }}>(X) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('shareholder')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <div>Shareholder</div>
                      <div style={{ fontSize: '10px', color: t.textMuted }}>(X) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('others')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <div>Others</div>
                      <div style={{ fontSize: '10px', color: t.textMuted }}>(X) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('total')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: `1px solid ${t.borderSubtle}`, color: isLight ? '#1d4ed8' : '#60a5fa' }}>
                      <div>Total</div>
                      <div style={{ fontSize: '10px', color: isLight ? '#2563eb' : '#93c5fd' }}>(X) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('applications')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <div>Applications</div>
                      <div style={{ fontSize: '10px', color: t.textMuted }}>Count ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('gmpPct')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: `1px solid ${t.borderSubtle}`, color: isLight ? '#15803d' : '#4ade80' }}>
                      <div>Live GMP</div>
                      <div style={{ fontSize: '10px', color: isLight ? '#16a34a' : '#86efac' }}>Est. Gain ⇅</div>
                    </th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <div>Subscription</div>
                      <div style={{ fontSize: '10px', color: t.textMuted }}>As On</div>
                    </th>
                    <th style={{ padding: '10px 10px', textAlign: 'center' }}>
                      <div>Allotment</div>
                      <div style={{ fontSize: '10px', color: t.textMuted }}>Status</div>
                    </th>
                  </tr>

                  {/* Row 2: Per-Column Search Inputs */}
                  <tr style={{ background: isLight ? '#f8fafc' : 'rgba(15,23,42,0.85)', borderBottom: `1px solid ${t.cardBorder}` }}>
                    {[
                      { key: 'company', placeholder: 'Search company...' },
                      { key: 'closeDate', placeholder: 'Search date...' },
                      { key: 'issueSizeCr', placeholder: 'Min Cr...' },
                      { key: 'qib', placeholder: 'Min x...' },
                      { key: 'snii', placeholder: 'Min x...' },
                      { key: 'bnii', placeholder: 'Min x...' },
                      { key: 'nii', placeholder: 'Min x...' },
                      { key: 'retail', placeholder: 'Min x...' },
                      { key: 'employee', placeholder: 'Min x...' },
                      { key: 'shareholder', placeholder: 'Min x...' },
                      { key: 'others', placeholder: 'Min x...' },
                      { key: 'total', placeholder: 'Min x...' },
                      { key: 'applications', placeholder: 'Min apps...' }
                    ].map(col => (
                      <th key={col.key} style={{ padding: '5px 6px', borderRight: `1px solid ${t.borderSubtle}` }}>
                        <input
                          type="text"
                          placeholder={col.placeholder}
                          value={colSearch[col.key]}
                          onChange={e => setColSearch(prev => ({ ...prev, [col.key]: e.target.value }))}
                          style={{
                            width: '100%', boxSizing: 'border-box', padding: '4px 6px',
                            background: t.inputBg, border: `1px solid ${t.inputBorder}`,
                            borderRadius: '4px', color: t.text, fontSize: '10.5px'
                          }}
                        />
                      </th>
                    ))}
                    <th style={{ padding: '5px 6px', borderRight: `1px solid ${t.borderSubtle}`, textAlign: 'center', fontSize: '10px', color: t.textMuted }}>
                      Price / Lot
                    </th>
                    <th style={{ padding: '5px 6px', borderRight: `1px solid ${t.borderSubtle}` }}>
                      <input
                        type="text"
                        placeholder="Search date..."
                        value={colSearch.asOn}
                        onChange={e => setColSearch(prev => ({ ...prev, asOn: e.target.value }))}
                        style={{
                          width: '100%', boxSizing: 'border-box', padding: '4px 6px',
                          background: t.inputBg, border: `1px solid ${t.inputBorder}`,
                          borderRadius: '4px', color: t.text, fontSize: '10.5px'
                        }}
                      />
                    </th>
                    <th style={{ padding: '5px 6px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setColSearch({
                          company: '', closeDate: '', issueSizeCr: '', qib: '', snii: '', bnii: '', nii: '',
                          retail: '', employee: '', shareholder: '', others: '', total: '', applications: '', asOn: ''
                        })}
                        style={{ background: isLight ? '#fee2e2' : 'rgba(239,68,68,0.15)', border: isLight ? '1px solid #fca5a5' : '1px solid rgba(239,68,68,0.3)', color: isLight ? '#991b1b' : '#ef4444', borderRadius: '4px', padding: '3px 7px', fontSize: '10px', cursor: 'pointer', fontWeight: '700' }}
                      >
                        Clear
                      </button>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredIpos.length === 0 ? (
                    <tr>
                      <td colSpan="16" style={{ padding: '40px', textAlign: 'center', color: t.textMuted }}>
                        No IPOs matched your column search filters. Click "Clear" to reset column filters.
                      </td>
                    </tr>
                  ) : (
                    filteredIpos.map((ipo, idx) => {
                      const sub = ipo.subscription || {};
                      const totalSub = Number(sub.total || 0);
                      return (
                        <tr
                          key={ipo.id || idx}
                          style={{
                            borderBottom: `1px solid ${t.tableRowBorder}`,
                            background: idx % 2 === 0 ? 'transparent' : (isLight ? '#f8fafc' : 'rgba(59,130,246,0.03)')
                          }}
                        >
                          <td style={{ padding: '10px 12px', borderRight: `1px solid ${t.borderSubtle}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '700', color: isLight ? '#1d4ed8' : '#60a5fa' }}>{ipo.name}</span>
                              <span style={{
                                fontSize: '9.5px',
                                background: ipo.badge === 'SME' || ipo.category === 'SME' ? (isLight ? '#dbeafe' : 'rgba(59,130,246,0.2)') : (isLight ? '#dcfce7' : 'rgba(34,197,94,0.2)'),
                                color: ipo.badge === 'SME' || ipo.category === 'SME' ? (isLight ? '#1d4ed8' : '#93c5fd') : (isLight ? '#15803d' : '#86efac'),
                                border: `1px solid ${t.borderSubtle}`,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontWeight: '800'
                              }}>
                                {ipo.badge || ipo.category}
                              </span>
                              {ipo.status === 'OPEN' && (
                                <span style={{ fontSize: '9px', background: isLight ? '#dcfce7' : 'rgba(34,197,94,0.2)', color: isLight ? '#15803d' : '#4ade80', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>
                                  LIVE
                                </span>
                              )}
                              {ipo.status === 'UPCOMING' && (
                                <span style={{ fontSize: '9px', background: isLight ? '#dbeafe' : 'rgba(59,130,246,0.2)', color: isLight ? '#1d4ed8' : '#60a5fa', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>
                                  UPCOMING
                                </span>
                              )}
                              {(ipo.status === 'LISTED' || ipo.status === 'CLOSED') && (
                                <span style={{ fontSize: '9px', background: isLight ? '#f3e8ff' : 'rgba(168,85,247,0.2)', color: isLight ? '#7e22ce' : '#c084fc', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>
                                  LISTED
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '10.5px', color: t.textMuted, marginTop: '2px' }}>
                              {ipo.priceBand} • Lot: {ipo.lotSize} • {ipo.registrar}
                            </div>
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'center', color: t.textSecondary, whiteSpace: 'nowrap', borderRight: `1px solid ${t.borderSubtle}` }}>
                            <div style={{ fontWeight: '600' }}>
                              {(ipo.status === 'LISTED' || ipo.status === 'CLOSED') ? `Listed: ${ipo.listingDate}` : ipo.closeDate}
                            </div>
                            <div style={{ fontSize: '10px', color: t.textMuted }}>
                              {(ipo.status === 'LISTED' || ipo.status === 'CLOSED') ? `Issue: ₹${ipo.issuePrice || ipo.maxPrice}` : `Open: ${ipo.openDate}`}
                            </div>
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '700', color: t.text, whiteSpace: 'nowrap', borderRight: `1px solid ${t.borderSubtle}` }}>
                            {Number(ipo.issueSizeCr || 0).toFixed(2)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', color: t.textSecondary, whiteSpace: 'nowrap', borderRight: `1px solid ${t.borderSubtle}` }}>
                            {formatSubVal(sub.qib)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', color: t.textSecondary, whiteSpace: 'nowrap', borderRight: `1px solid ${t.borderSubtle}` }}>
                            {formatSubVal(sub.snii)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', color: t.textSecondary, whiteSpace: 'nowrap', borderRight: `1px solid ${t.borderSubtle}` }}>
                            {formatSubVal(sub.bnii)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', color: t.text, whiteSpace: 'nowrap', borderRight: `1px solid ${t.borderSubtle}` }}>
                            {formatSubVal(sub.nii)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', color: t.text, whiteSpace: 'nowrap', borderRight: `1px solid ${t.borderSubtle}` }}>
                            {formatSubVal(sub.retail)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', color: t.textMuted, whiteSpace: 'nowrap', borderRight: `1px solid ${t.borderSubtle}` }}>
                            {formatSubVal(sub.employee)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', color: t.textMuted, whiteSpace: 'nowrap', borderRight: `1px solid ${t.borderSubtle}` }}>
                            {formatSubVal(sub.shareholder)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', color: t.textMuted, whiteSpace: 'nowrap', borderRight: `1px solid ${t.borderSubtle}` }}>
                            {formatSubVal(sub.others)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '800', whiteSpace: 'nowrap', borderRight: `1px solid ${t.borderSubtle}`, color: totalSub >= 50 ? (isLight ? '#ca8a04' : '#facc15') : (totalSub >= 10 ? (isLight ? '#15803d' : '#4ade80') : (isLight ? '#1d4ed8' : '#60a5fa')) }}>
                            {formatSubVal(sub.total)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '700', color: t.text, whiteSpace: 'nowrap', borderRight: `1px solid ${t.borderSubtle}` }}>
                            {ipo.applications ? ipo.applications.toLocaleString('en-IN') : '-'}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', whiteSpace: 'nowrap', borderRight: `1px solid ${t.borderSubtle}` }}>
                            {(ipo.status === 'LISTED' || ipo.status === 'CLOSED') ? (
                              (() => {
                                const gain = getSafeListingGain(ipo);
                                const isPos = gain >= 0;
                                return (
                                  <>
                                    <div style={{ fontWeight: '800', color: isPos ? (isLight ? '#15803d' : '#22c55e') : '#ef4444' }}>
                                      {gain > 0 ? `+${gain.toFixed(2)}%` : `${gain.toFixed(2)}%`} Gain
                                    </div>
                                    <div style={{ fontSize: '10px', color: t.textMuted }}>
                                      List: ₹{ipo.listingPrice || ipo.estListingPrice || ipo.maxPrice}
                                    </div>
                                  </>
                                );
                              })()
                            ) : (
                              <>
                                <div style={{ fontWeight: '800', color: isLight ? '#15803d' : '#22c55e' }}>+₹{ipo.gmp} ({ipo.gmpPct}%)</div>
                                <div style={{ fontSize: '10px', color: t.textMuted }}>
                                  Lot Profit: ₹{((ipo.gmp || 0) * (ipo.lotSize || 1)).toLocaleString('en-IN')}
                                </div>
                              </>
                            )}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'center', color: t.textMuted, fontSize: '11px', whiteSpace: 'nowrap', borderRight: `1px solid ${t.borderSubtle}` }}>
                            {ipo.asOn || (ipo.status === 'LISTED' || ipo.status === 'CLOSED' ? `${ipo.closeDate || ipo.listingDate} (Final)` : 'Live Synced')}
                          </td>

                          <td style={{ padding: '10px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedIpoForCheck(ipo)}
                              style={{ padding: '5px 10px', background: isLight ? '#dbeafe' : 'rgba(59,130,246,0.18)', border: isLight ? '1px solid #93c5fd' : '1px solid rgba(59,130,246,0.4)', color: isLight ? '#1d4ed8' : '#60a5fa', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                            >
                              Check Status
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <div style={{ padding: '12px 16px', background: isLight ? '#f8fafc' : 'rgba(15,23,42,0.4)', borderTop: `1px solid ${t.borderSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: t.textMuted, flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  Showing <strong style={{ color: t.text }}>{filteredIpos.length.toLocaleString('en-IN')}</strong> Curated Landmark Issues &bull; Total Official SEBI Primary Market Universe: <strong style={{ color: isLight ? '#1d4ed8' : '#60a5fa' }}>{(ipoStats?.totalIssues || ipoData.length).toLocaleString('en-IN')} Issues</strong>{ipoStats?.mobilizedCr ? ` (₹${(ipoStats.mobilizedCr).toLocaleString('en-IN')} Cr Mobilized)` : ''}
                </div>
                <div style={{ fontSize: '11px', color: t.textSecondary }}>
                  Official Primary Market Data: SEBI, BSE &amp; NSE Archives (1996–2026)
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: GMP, EST. LOT PROFIT & ALLOTMENT CARDS VIEW */}
          {ipoViewMode === 'CARDS' && (
            filteredIpos.length === 0 ? (
              <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '14px', padding: '40px', textAlign: 'center', color: t.textMuted, boxShadow: t.cardShadow }}>
                No IPOs found matching this category or status filter.
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: isMobile ? '12px' : '16px' }}>
                {filteredIpos.map((ipo) => {
                  const sub = ipo.subscription || {};
                  const lotProfit = (ipo.gmp || 0) * (ipo.lotSize || 1);
                  const minInv = (ipo.maxPrice || ipo.minPrice || 100) * (ipo.lotSize || 1);
                  const retailOdds = sub.retail > 1 ? Math.max(0.15, (100 / sub.retail)).toFixed(1) : 100;
                  return (
                    <div
                      key={ipo.id}
                      style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: t.cardShadow }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '10.5px', background: ipo.category === 'MAINBOARD' ? (isLight ? '#dbeafe' : 'rgba(59,130,246,0.15)') : (isLight ? '#fef9c3' : 'rgba(234,179,8,0.15)'), color: ipo.category === 'MAINBOARD' ? (isLight ? '#1d4ed8' : '#60a5fa') : (isLight ? '#ca8a04' : '#eab308'), padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                              {ipo.category}
                            </span>
                            <span style={{ fontSize: '10.5px', color: t.textMuted }}>
                              via {ipo.registrar}
                            </span>
                          </div>
                          <h3 style={{ margin: '6px 0 0', fontSize: '15px', fontWeight: '700', color: t.text }}>{ipo.name}</h3>
                        </div>
                        <span style={{
                          fontSize: '11px',
                          background: ipo.status === 'OPEN' ? (isLight ? '#dcfce7' : 'rgba(34,197,94,0.15)') : (ipo.status === 'UPCOMING' ? (isLight ? '#dbeafe' : 'rgba(59,130,246,0.15)') : (isLight ? '#f3e8ff' : 'rgba(168,85,247,0.15)')),
                          color: ipo.status === 'OPEN' ? (isLight ? '#15803d' : '#22c55e') : (ipo.status === 'UPCOMING' ? (isLight ? '#1d4ed8' : '#60a5fa') : (isLight ? '#7e22ce' : '#c084fc')),
                          border: `1px solid ${ipo.status === 'OPEN' ? (isLight ? '#86efac' : 'rgba(34,197,94,0.3)') : (ipo.status === 'UPCOMING' ? (isLight ? '#93c5fd' : 'rgba(59,130,246,0.3)') : (isLight ? '#d8b4fe' : 'rgba(168,85,247,0.3)'))}`,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: '700'
                        }}>
                          {ipo.status === 'OPEN' ? '🟢 LIVE' : (ipo.status === 'UPCOMING' ? '⏳ UPCOMING' : '🚀 LISTED')}
                        </span>
                      </div>

                      {(ipo.status === 'LISTED' || ipo.status === 'CLOSED') ? (
                        (() => {
                          const gain = getSafeListingGain(ipo);
                          const isPos = gain >= 0;
                          return (
                            <div style={{
                              background: isPos ? (isLight ? '#f0fdf4' : 'rgba(34,197,94,0.09)') : (isLight ? '#fef2f2' : 'rgba(239,68,68,0.09)'),
                              border: `1px solid ${isPos ? (isLight ? '#bbf7d0' : 'rgba(34,197,94,0.28)') : (isLight ? '#fecaca' : 'rgba(239,68,68,0.28)')}`,
                              padding: '10px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                              <div>
                                <div style={{ fontSize: '11px', color: t.textMuted }}>Official Listing Gain &amp; Price</div>
                                <div style={{ fontSize: '15px', fontWeight: '800', color: isPos ? (isLight ? '#15803d' : '#22c55e') : '#ef4444' }}>
                                  {gain > 0 ? `+${gain.toFixed(2)}%` : `${gain.toFixed(2)}%`} • Listed at ₹{ipo.listingPrice || ipo.estListingPrice || ipo.maxPrice}
                                </div>
                                <div style={{ fontSize: '10.5px', color: t.textSecondary, marginTop: '2px' }}>
                                  Issue Price: ₹{ipo.issuePrice || ipo.maxPrice} • Lot Gain: ₹{Math.round(((ipo.listingPrice || ipo.maxPrice) - (ipo.issuePrice || ipo.maxPrice)) * (ipo.lotSize || 1)).toLocaleString('en-IN')}
                                </div>
                              </div>
                              <Award size={22} color={isPos ? '#22c55e' : '#ef4444'} />
                            </div>
                          );
                        })()
                      ) : (
                        <div style={{ background: isLight ? '#f0fdf4' : 'rgba(34,197,94,0.08)', border: isLight ? '1px solid #bbf7d0' : '1px solid rgba(34,197,94,0.25)', padding: '10px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: t.textMuted }}>Live GMP &amp; Est. Lot Profit</div>
                            <div style={{ fontSize: '15px', fontWeight: '800', color: isLight ? '#15803d' : '#22c55e' }}>
                              +₹{ipo.gmp} ({ipo.gmpPct}%) • ₹{lotProfit.toLocaleString('en-IN')}/Lot
                            </div>
                          </div>
                          <Award size={22} color="#22c55e" />
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                        <div>
                          <div style={{ color: t.textMuted }}>Price Band &amp; Lot</div>
                          <div style={{ fontWeight: '700', color: t.text, marginTop: '2px' }}>{ipo.priceBand} ({ipo.lotSize} sh)</div>
                        </div>
                        <div>
                          <div style={{ color: t.textMuted }}>Min Investment</div>
                          <div style={{ fontWeight: '700', color: t.text, marginTop: '2px' }}>₹{minInv.toLocaleString('en-IN')}</div>
                        </div>
                        <div>
                          <div style={{ color: t.textMuted }}>Issue Size</div>
                          <div style={{ fontWeight: '700', color: t.text, marginTop: '2px' }}>₹{ipo.issueSizeCr} Cr</div>
                        </div>
                        <div>
                          <div style={{ color: t.textMuted }}>Total Subscription</div>
                          <div style={{ fontWeight: '800', color: isLight ? '#1d4ed8' : '#60a5fa', marginTop: '2px' }}>
                            {sub.total > 0 ? `${sub.total}x (${(ipo.applications || 0).toLocaleString('en-IN')} Apps)` : ((ipo.status === 'LISTED' || ipo.status === 'CLOSED') ? `${sub.total || 1}x` : 'Opens Soon')}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', background: t.cardBgSubtle, border: `1px solid ${t.borderSubtle}`, padding: '8px', borderRadius: '8px', textAlign: 'center', fontSize: '11px' }}>
                        <div>
                          <div style={{ color: t.textMuted, fontSize: '10px' }}>QIB</div>
                          <div style={{ fontWeight: '700', color: t.text }}>{formatSubVal(sub.qib)}x</div>
                        </div>
                        <div>
                          <div style={{ color: t.textMuted, fontSize: '10px' }}>sNII</div>
                          <div style={{ fontWeight: '700', color: t.text }}>{formatSubVal(sub.snii)}x</div>
                        </div>
                        <div>
                          <div style={{ color: t.textMuted, fontSize: '10px' }}>bNII</div>
                          <div style={{ fontWeight: '700', color: t.text }}>{formatSubVal(sub.bnii)}x</div>
                        </div>
                        <div>
                          <div style={{ color: t.textMuted, fontSize: '10px' }}>Retail</div>
                          <div style={{ fontWeight: '700', color: isLight ? '#15803d' : '#4ade80' }}>{formatSubVal(sub.retail)}x</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: t.textMuted, borderTop: `1px solid ${t.borderSubtle}`, paddingTop: '10px' }}>
                        <span>{(ipo.status === 'LISTED' || ipo.status === 'CLOSED') ? `🎉 Listed: ${ipo.listingDate}` : `📅 ${ipo.openDate} → ${ipo.closeDate}`}</span>
                        <span style={{ color: (ipo.status === 'LISTED' || ipo.status === 'CLOSED') ? (isLight ? '#7e22ce' : '#c084fc') : (isLight ? '#ca8a04' : '#facc15'), fontWeight: '700' }}>
                          {(ipo.status === 'LISTED' || ipo.status === 'CLOSED') ? `Total Sub: ${sub.total || 1}x` : `🎯 Retail Odds: ${retailOdds}%`}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedIpoForCheck(ipo)}
                        style={{ width: '100%', minHeight: isMobile ? '40px' : '36px', padding: '9px', background: isLight ? '#dbeafe' : 'rgba(59,130,246,0.15)', border: isLight ? '1px solid #93c5fd' : '1px solid rgba(59,130,246,0.35)', color: isLight ? '#1d4ed8' : '#60a5fa', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <CheckCircle2 size={14} /> 1-Click Allotment Status Check
                      </button>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: '12px', padding: isMobile ? '10px 12px' : '12px 16px', background: isLight ? '#f8fafc' : 'rgba(15,23,42,0.4)', border: `1px solid ${t.borderSubtle}`, borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: t.textMuted, flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  Showing <strong style={{ color: t.text }}>{filteredIpos.length.toLocaleString('en-IN')}</strong> Curated Landmark Issues &bull; Total Universe: <strong style={{ color: isLight ? '#1d4ed8' : '#60a5fa' }}>{(ipoStats?.totalIssues || ipoData.length).toLocaleString('en-IN')} Issues</strong>{ipoStats?.mobilizedCr ? ` (₹${(ipoStats.mobilizedCr).toLocaleString('en-IN')} Cr Mobilized)` : ''}
                </div>
                <div style={{ fontSize: '11px', color: t.textSecondary }}>
                  Official Primary Market Data: SEBI, BSE &amp; NSE Archives
                </div>
              </div>
            </>
          )
          )}
        </div>
      )}

      {/* 1-CLICK ALLOTMENT STATUS MODAL */}
      {selectedIpoForCheck && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: isMobile ? '12px' : '20px' }}>
          <div style={{ background: isLight ? '#ffffff' : '#111827', border: `1px solid ${t.cardBorder}`, borderRadius: '16px', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: isMobile ? '16px' : '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: '16px', color: t.text }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🔍</span>
                <h3 style={{ margin: 0, fontSize: isMobile ? '15px' : '17px', fontWeight: '800', color: t.text }}>Live IPO Allotment Status</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIpoForCheck(null)}
                style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: '20px', cursor: 'pointer', minWidth: '36px', minHeight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: t.cardBgSubtle, border: `1px solid ${t.borderSubtle}`, borderRadius: '10px', padding: '12px', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>Company: <strong style={{ color: t.text }}>{selectedIpoForCheck.name}</strong></div>
              <div>Official Registrar: <strong style={{ color: isLight ? '#1d4ed8' : '#60a5fa' }}>{selectedIpoForCheck.registrar}</strong></div>
              <div>Total Subscription: <strong style={{ color: isLight ? '#ca8a04' : '#facc15' }}>{selectedIpoForCheck.subscription?.total || 0}x ({(selectedIpoForCheck.applications || 0).toLocaleString('en-IN')} Applications)</strong></div>
              <div>Listing Date: <strong style={{ color: isLight ? '#15803d' : '#22c55e' }}>{selectedIpoForCheck.listingDate}</strong></div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: t.textMuted, fontWeight: '700', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                Enter Your PAN Number (For 1-Click Copy)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="ABCDE1234F"
                  maxLength="10"
                  value={panNumber}
                  onChange={e => setPanNumber(e.target.value.toUpperCase())}
                  style={{ flex: 1, padding: '10px 14px', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '8px', color: t.text, fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase', minHeight: '40px' }}
                />
                <button
                  type="button"
                  onClick={handleCopyPan}
                  disabled={!panNumber}
                  style={{ minHeight: '40px', padding: '0 14px', background: copiedPan ? (isLight ? '#dcfce7' : 'rgba(34,197,94,0.2)') : t.pillInactiveBg, border: copiedPan ? '1px solid #22c55e' : `1px solid ${t.cardBorder}`, color: copiedPan ? '#22c55e' : t.text, borderRadius: '8px', cursor: panNumber ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {copiedPan ? <Check size={14} /> : <Copy size={14} />}
                  {copiedPan ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href={selectedIpoForCheck.registrarUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleCopyPan}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: '42px', padding: '12px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', textAlign: 'center', borderRadius: '10px', fontWeight: '700', fontSize: '13.5px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                Open Official {selectedIpoForCheck.registrar} Portal <ExternalLink size={15} />
              </a>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href="https://www.bseindia.com/investors/appli_check.aspx"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', background: t.cardBgSubtle, border: `1px solid ${t.cardBorder}`, color: t.textSecondary, textAlign: 'center', borderRadius: '8px', fontSize: '11.5px', fontWeight: '600', textDecoration: 'none' }}
                >
                  Check on BSE India ↗
                </a>
                <a
                  href="https://www.nseindia.com/invest/check-trades-and-allotment-details"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', background: t.cardBgSubtle, border: `1px solid ${t.cardBorder}`, color: t.textSecondary, textAlign: 'center', borderRadius: '8px', fontSize: '11.5px', fontWeight: '600', textDecoration: 'none' }}
                >
                  Check on NSE India ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
