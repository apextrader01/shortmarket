// frontend/src/components/PrimaryMarketsView.jsx
// 🏛️ Hub 03: Primary Markets, Full NSE & BSE Bhavcopy Screener (5,772+ Stocks),
// Rolling 30-Day Bulk/Block/Insider Deals (1,060+ Deals up to Today) & Live 14-Column IPO Subscription & GMP Hub

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  ExternalLink, Search, Filter, ShieldCheck, Sparkles, BarChart2,
  Calendar, Layers, CheckCircle2, ChevronRight, RefreshCw, Award,
  Flame, Snowflake, Zap, AlertTriangle, Copy, Check, SlidersHorizontal,
  DollarSign, PieChart, Info, Table, LayoutGrid, ArrowUpDown
} from 'lucide-react';
import { API } from '../store';
import logoImg from '../assets/logo.png';

const SEED_BHAVCOPY_DATA = [
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', exchange: 'BOTH', bseCode: '500180', ltp: 1682.40, change: 0.90, volume: 15420000, delivQty: 12490200, delivPct: 81.0, surgeMult: 3.1, is52wHigh: false, is52wLow: false, sector: 'Banking & Financials' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', exchange: 'BOTH', bseCode: '532174', ltp: 1248.80, change: 1.80, volume: 11200000, delivQty: 8736000, delivPct: 78.0, surgeMult: 2.6, is52wHigh: true, is52wLow: false, sector: 'Banking & Financials' },
  { symbol: 'SBIN', name: 'State Bank of India', exchange: 'BOTH', bseCode: '500112', ltp: 812.50, change: 0.85, volume: 18450000, delivQty: 12915000, delivPct: 70.0, surgeMult: 1.7, is52wHigh: false, is52wLow: false, sector: 'Banking & Financials' },
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', exchange: 'BOTH', bseCode: '500325', ltp: 2985.40, change: 1.45, volume: 8250000, delivQty: 6435000, delivPct: 78.0, surgeMult: 2.4, is52wHigh: true, is52wLow: false, sector: 'Energy & Power' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'BOTH', bseCode: '532540', ltp: 4210.20, change: -0.35, volume: 2950000, delivQty: 2242000, delivPct: 76.0, surgeMult: 1.8, is52wHigh: false, is52wLow: false, sector: 'Information Tech' },
  { symbol: 'INFY', name: 'Infosys Ltd', exchange: 'BOTH', bseCode: '500209', ltp: 1912.10, change: 0.40, volume: 6420000, delivQty: 4622400, delivPct: 72.0, surgeMult: 1.5, is52wHigh: false, is52wLow: false, sector: 'Information Tech' },
  { symbol: 'BSE', name: 'BSE Limited', exchange: 'BSE', bseCode: '542650', ltp: 4180.00, change: 4.80, volume: 3850000, delivQty: 3080000, delivPct: 80.0, surgeMult: 4.8, is52wHigh: true, is52wLow: false, sector: 'Capital Markets & Exchanges' },
  { symbol: 'CDSL', name: 'Central Depository Services', exchange: 'BOTH', bseCode: '543210', ltp: 1540.00, change: 3.20, volume: 5400000, delivQty: 4212000, delivPct: 78.0, surgeMult: 3.5, is52wHigh: true, is52wLow: false, sector: 'Capital Markets & Exchanges' },
  { symbol: 'MCX', name: 'Multi Commodity Exchange', exchange: 'BOTH', bseCode: '534091', ltp: 5850.00, change: 2.90, volume: 1850000, delivQty: 1424500, delivPct: 77.0, surgeMult: 3.2, is52wHigh: true, is52wLow: false, sector: 'Capital Markets & Exchanges' },
  { symbol: 'HAL', name: 'Hindustan Aeronautics Ltd', exchange: 'BOTH', bseCode: '541154', ltp: 4480.00, change: 3.20, volume: 4800000, delivQty: 3696000, delivPct: 77.0, surgeMult: 3.6, is52wHigh: true, is52wLow: false, sector: 'Defense & PSUs' },
  { symbol: 'BEL', name: 'Bharat Electronics Ltd', exchange: 'BOTH', bseCode: '500049', ltp: 295.40, change: 2.80, volume: 28400000, delivQty: 22152000, delivPct: 78.0, surgeMult: 3.8, is52wHigh: true, is52wLow: false, sector: 'Defense & PSUs' },
  { symbol: 'TRENT', name: 'Trent Ltd', exchange: 'BOTH', bseCode: '500251', ltp: 7680.00, change: 3.80, volume: 2150000, delivQty: 1763000, delivPct: 82.0, surgeMult: 4.5, is52wHigh: true, is52wLow: false, sector: 'FMCG & Consumer' }
];

const SEED_DEALS_DATA = [
  { id: 1, date: new Date().toISOString().slice(0, 10), symbol: 'ZOMATO', company: 'Zomato Ltd', exchange: 'NSE', client: 'Morgan Stanley Asia Singapore', type: 'BUY', qty: 12500000, price: 272.50, valueCr: 340.62, dealType: 'BULK_DEAL' },
  { id: 2, date: new Date().toISOString().slice(0, 10), symbol: 'INFY', company: 'Infosys Ltd', exchange: 'NSE', client: 'LIC of India', type: 'BUY', qty: 2100000, price: 1905.00, valueCr: 400.05, dealType: 'BULK_DEAL' },
  { id: 3, date: new Date().toISOString().slice(0, 10), symbol: 'BSE', company: 'BSE Limited', exchange: 'BSE', client: 'Goldman Sachs India Equity', type: 'BUY', qty: 950000, price: 4150.00, valueCr: 394.25, dealType: 'BULK_DEAL' },
  { id: 4, date: new Date().toISOString().slice(0, 10), symbol: 'HDFCBANK', company: 'HDFC Bank Ltd', exchange: 'NSE', client: 'Government of Singapore (GIC)', type: 'BUY', qty: 4500000, price: 1678.00, valueCr: 755.10, dealType: 'BLOCK_DEAL' },
  { id: 5, date: new Date().toISOString().slice(0, 10), symbol: 'RELIANCE', company: 'Reliance Industries', exchange: 'NSE', client: 'Promoter Group: Reliance Industries', type: 'BUY', qty: 2500000, price: 2980.00, valueCr: 745.00, dealType: 'INSIDER_PROMOTER' }
];

const SEED_IPO_DATA = [
  // --- Exact Screenshot 4 Issues + Active Mainboard & SME Catalog ---
  {
    id: 101,
    name: 'Longfian Scitech (India) Ltd.',
    badge: 'SME',
    category: 'SME',
    status: 'OPEN',
    priceBand: '₹128 - ₹135',
    minPrice: 128,
    maxPrice: 135,
    lotSize: 1000,
    issueSizeCr: 23.02,
    openDate: '2026-10-09',
    closeDate: '2026-10-13',
    listingDate: '2026-10-16',
    gmp: 28,
    gmpPct: 20.74,
    subscription: { qib: 14.11, snii: 1.79, bnii: 1.77, nii: 1.77, retail: 3.11, employee: null, shareholder: null, others: null, total: 2.70 },
    applications: 2615,
    asOn: '12-Oct-2026 17:55',
    registrar: 'Bigshare Services',
    registrarUrl: 'https://ipo.bigshareonline.com/IPO_Status.html'
  },
  {
    id: 102,
    name: 'E2E Transportation Infrastructure Ltd.',
    badge: 'LT',
    category: 'MAINBOARD',
    status: 'OPEN',
    priceBand: '₹165 - ₹174',
    minPrice: 165,
    maxPrice: 174,
    lotSize: 85,
    issueSizeCr: 84.22,
    openDate: '2026-10-08',
    closeDate: '2026-10-12',
    listingDate: '2026-10-15',
    gmp: 145,
    gmpPct: 83.33,
    subscription: { qib: 236.30, snii: 670.31, bnii: 883.86, nii: 812.68, retail: 544.28, employee: 54.99, shareholder: null, others: null, total: 526.56 },
    applications: 9734520,
    asOn: '12-Oct-2026 17:55',
    registrar: 'MUFG Intime (Link Intime)',
    registrarUrl: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html'
  },
  {
    id: 103,
    name: 'Apollo Techno Industries Ltd.',
    badge: 'LT',
    category: 'SME',
    status: 'OPEN',
    priceBand: '₹123 - ₹130',
    minPrice: 123,
    maxPrice: 130,
    lotSize: 1000,
    issueSizeCr: 47.96,
    openDate: '2026-10-08',
    closeDate: '2026-10-12',
    listingDate: '2026-10-15',
    gmp: 42,
    gmpPct: 32.31,
    subscription: { qib: 28.60, snii: 85.44, bnii: 104.22, nii: 97.96, retail: 44.52, employee: null, shareholder: null, others: null, total: 50.63 },
    applications: 27747,
    asOn: '12-Oct-2026 17:55',
    registrar: 'Bigshare Services',
    registrarUrl: 'https://ipo.bigshareonline.com/IPO_Status.html'
  },
  {
    id: 104,
    name: 'Bai-Kakaji Polymers Ltd.',
    badge: 'LT',
    category: 'SME',
    status: 'OPEN',
    priceBand: '₹177 - ₹186',
    minPrice: 177,
    maxPrice: 186,
    lotSize: 800,
    issueSizeCr: 105.17,
    openDate: '2026-10-08',
    closeDate: '2026-10-12',
    listingDate: '2026-10-15',
    gmp: 18,
    gmpPct: 9.68,
    subscription: { qib: 7.56, snii: 9.33, bnii: 9.04, nii: 9.13, retail: 4.10, employee: null, shareholder: null, others: null, total: 5.71 },
    applications: 9521,
    asOn: '12-Oct-2026 17:55',
    registrar: 'Bigshare Services',
    registrarUrl: 'https://ipo.bigshareonline.com/IPO_Status.html'
  },
  {
    id: 105,
    name: 'Nanta Tech Ltd.',
    badge: 'LT',
    category: 'SME',
    status: 'OPEN',
    priceBand: '₹209 - ₹220',
    minPrice: 209,
    maxPrice: 220,
    lotSize: 600,
    issueSizeCr: 31.81,
    openDate: '2026-10-08',
    closeDate: '2026-10-12',
    listingDate: '2026-10-15',
    gmp: 25,
    gmpPct: 11.36,
    subscription: { qib: 12.98, snii: 5.95, bnii: 8.65, nii: 7.75, retail: 3.13, employee: null, shareholder: null, others: null, total: 6.43 },
    applications: 14820,
    asOn: '12-Oct-2026 17:55',
    registrar: 'Bigshare Services',
    registrarUrl: 'https://ipo.bigshareonline.com/IPO_Status.html'
  },
  {
    id: 106,
    name: 'Admach Systems Ltd.',
    badge: 'LT',
    category: 'SME',
    status: 'OPEN',
    priceBand: '₹227 - ₹239',
    minPrice: 227,
    maxPrice: 239,
    lotSize: 600,
    issueSizeCr: 42.60,
    openDate: '2026-10-08',
    closeDate: '2026-10-12',
    listingDate: '2026-10-15',
    gmp: 16,
    gmpPct: 6.69,
    subscription: { qib: 1.07, snii: 7.21, bnii: 4.30, nii: 5.36, retail: 4.00, employee: null, shareholder: null, others: null, total: 4.07 },
    applications: 11240,
    asOn: '12-Oct-2026 17:55',
    registrar: 'Skyline Financial',
    registrarUrl: 'https://www.skylinerta.com/ipo.php'
  },
  {
    id: 107,
    name: 'Dhara Rail Projects Ltd.',
    badge: 'LT',
    category: 'SME',
    status: 'OPEN',
    priceBand: '₹120 - ₹126',
    minPrice: 120,
    maxPrice: 126,
    lotSize: 1000,
    issueSizeCr: 50.20,
    openDate: '2026-10-08',
    closeDate: '2026-10-12',
    listingDate: '2026-10-15',
    gmp: 62,
    gmpPct: 49.21,
    subscription: { qib: 70.63, snii: 184.42, bnii: 206.95, nii: 199.41, retail: 92.93, employee: null, shareholder: null, others: null, total: 111.90 },
    applications: 109457,
    asOn: '12-Oct-2026 17:55',
    registrar: 'Bigshare Services',
    registrarUrl: 'https://ipo.bigshareonline.com/IPO_Status.html'
  },
  {
    id: 108,
    name: 'Sundrex Oil Company Ltd.',
    badge: 'LT',
    category: 'SME',
    status: 'CLOSED',
    priceBand: '₹81 - ₹86',
    minPrice: 81,
    maxPrice: 86,
    lotSize: 1600,
    issueSizeCr: 32.09,
    openDate: '2026-10-06',
    closeDate: '2026-10-10',
    listingDate: '2026-10-14',
    gmp: 4,
    gmpPct: 4.65,
    subscription: { qib: 1.54, snii: 2.09, bnii: 5.56, nii: 4.39, retail: 0.59, employee: null, shareholder: null, others: null, total: 1.51 },
    applications: 1325,
    asOn: '10-Oct-2026 17:55',
    registrar: 'Cameo Corporate',
    registrarUrl: 'https://ipo.cameoindia.com/'
  },
  {
    id: 109,
    name: 'Shyam Dhani Industries Ltd.',
    badge: 'LT',
    category: 'SME',
    status: 'CLOSED',
    priceBand: '₹65 - ₹70',
    minPrice: 65,
    maxPrice: 70,
    lotSize: 2000,
    issueSizeCr: 38.49,
    openDate: '2026-10-06',
    closeDate: '2026-10-10',
    listingDate: '2026-10-14',
    gmp: 95,
    gmpPct: 135.71,
    subscription: { qib: 256.24, snii: 1479.85, bnii: 1668.93, nii: 1612.65, retail: 1137.92, employee: null, shareholder: null, others: null, total: 988.29 },
    applications: 622665,
    asOn: '10-Oct-2026 17:55',
    registrar: 'Bigshare Services',
    registrarUrl: 'https://ipo.bigshareonline.com/IPO_Status.html'
  },
  {
    id: 110,
    name: 'Dachepalli Publishers Ltd.',
    badge: 'LT',
    category: 'SME',
    status: 'CLOSED',
    priceBand: '₹100 - ₹102',
    minPrice: 100,
    maxPrice: 102,
    lotSize: 1200,
    issueSizeCr: 40.39,
    openDate: '2026-10-06',
    closeDate: '2026-10-10',
    listingDate: '2026-10-14',
    gmp: 8,
    gmpPct: 7.84,
    subscription: { qib: 1.49, snii: 2.34, bnii: 2.91, nii: 2.72, retail: 1.90, employee: null, shareholder: null, others: null, total: 1.97 },
    applications: 1737,
    asOn: '10-Oct-2026 17:55',
    registrar: 'Bigshare Services',
    registrarUrl: 'https://ipo.bigshareonline.com/IPO_Status.html'
  },
  {
    id: 111,
    name: 'EPW India Ltd.',
    badge: 'LT',
    category: 'SME',
    status: 'CLOSED',
    priceBand: '₹95 - ₹97',
    minPrice: 95,
    maxPrice: 97,
    lotSize: 1200,
    issueSizeCr: 31.81,
    openDate: '2026-10-06',
    closeDate: '2026-10-10',
    listingDate: '2026-10-14',
    gmp: 6,
    gmpPct: 6.19,
    subscription: { qib: 1.11, snii: 1.15, bnii: 2.27, nii: 1.90, retail: 1.24, employee: null, shareholder: null, others: null, total: 1.34 },
    applications: 983,
    asOn: '10-Oct-2026 17:55',
    registrar: 'Bigshare Services',
    registrarUrl: 'https://ipo.bigshareonline.com/IPO_Status.html'
  },
  {
    id: 112,
    name: 'Gujarat Kidney And Super Speciality Ltd.',
    badge: 'LT',
    category: 'MAINBOARD',
    status: 'CLOSED',
    priceBand: '₹108 - ₹114',
    minPrice: 108,
    maxPrice: 114,
    lotSize: 128,
    issueSizeCr: 250.80,
    openDate: '2026-10-06',
    closeDate: '2026-10-10',
    listingDate: '2026-10-14',
    gmp: 18,
    gmpPct: 15.79,
    subscription: { qib: 1.06, snii: 9.21, bnii: 4.49, nii: 5.73, retail: 19.04, employee: null, shareholder: null, others: null, total: 5.21 },
    applications: 189465,
    asOn: '10-Oct-2026 17:55',
    registrar: 'MUFG Intime (Link Intime)',
    registrarUrl: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html'
  },
  {
    id: 1,
    name: 'Hyundai Motor India Ltd.',
    badge: 'MAINBOARD',
    category: 'MAINBOARD',
    status: 'OPEN',
    priceBand: '₹1,865 - ₹1,960',
    minPrice: 1865,
    maxPrice: 1960,
    lotSize: 7,
    issueSizeCr: 27870.16,
    openDate: '2026-10-12',
    closeDate: '2026-10-15',
    listingDate: '2026-10-20',
    gmp: 125,
    gmpPct: 6.38,
    subscription: { qib: 6.97, snii: 0.62, bnii: 0.59, nii: 0.60, retail: 0.50, employee: 1.74, shareholder: null, others: null, total: 2.37 },
    applications: 1428910,
    asOn: '12-Oct-2026 17:55',
    registrar: 'KFintech',
    registrarUrl: 'https://ipostatus.kfintech.com/'
  },
  {
    id: 2,
    name: 'Waaree Energies Ltd.',
    badge: 'LT',
    category: 'MAINBOARD',
    status: 'OPEN',
    priceBand: '₹1,427 - ₹1,503',
    minPrice: 1427,
    maxPrice: 1503,
    lotSize: 9,
    issueSizeCr: 4321.44,
    openDate: '2026-10-12',
    closeDate: '2026-10-15',
    listingDate: '2026-10-19',
    gmp: 1480,
    gmpPct: 98.47,
    subscription: { qib: 208.63, snii: 51.79, bnii: 68.20, nii: 62.49, retail: 10.79, employee: 5.17, shareholder: null, others: null, total: 76.34 },
    applications: 9734520,
    asOn: '12-Oct-2026 17:55',
    registrar: 'MUFG Intime (Link Intime)',
    registrarUrl: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html'
  },
  {
    id: 3,
    name: 'Deepak Builders & Engineers India Ltd.',
    badge: 'LT',
    category: 'MAINBOARD',
    status: 'OPEN',
    priceBand: '₹192 - ₹203',
    minPrice: 192,
    maxPrice: 203,
    lotSize: 73,
    issueSizeCr: 260.04,
    openDate: '2026-10-12',
    closeDate: '2026-10-15',
    listingDate: '2026-10-19',
    gmp: 61,
    gmpPct: 30.05,
    subscription: { qib: 13.91, snii: 78.45, bnii: 84.90, nii: 82.47, retail: 39.79, employee: null, shareholder: null, others: null, total: 41.54 },
    applications: 1648290,
    asOn: '12-Oct-2026 17:55',
    registrar: 'KFintech',
    registrarUrl: 'https://ipostatus.kfintech.com/'
  }
];

const resolvePrimaryMarketTab = (tab) => {
  if (!tab) return 'BHAVCOPY';
  const upper = String(tab).toUpperCase();
  if (upper === 'DEALS' || upper === 'BULK') return 'DEALS';
  if (upper === 'IPO' || upper === 'IPOS' || upper === 'ALLOTMENT') return 'IPOS';
  return 'BHAVCOPY';
};

function formatDateBadge(isoStr) {
  if (!isoStr) return 'Today';
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

export default function PrimaryMarketsView({ initialTab, onBack, onOpenPaperTrading }) {
  const [activeTab, setActiveTab] = useState(() => resolvePrimaryMarketTab(initialTab));
  const [bhavcopyData, setBhavcopyData] = useState(SEED_BHAVCOPY_DATA);
  const [bhavStats, setBhavStats] = useState({
    totalStocks: 5772,
    nseCount: 3427,
    bseCount: 5018,
    breakouts52w: 139,
    reversals52w: 92,
    highDelivery75: 1494,
    volumeSurges2x: 4277,
    asOfDate: '13-Oct-2026'
  });
  const [bhavTotalFiltered, setBhavTotalFiltered] = useState(5772);
  const [bhavPage, setBhavPage] = useState(1);
  const [bhavHasMore, setBhavHasMore] = useState(true);

  const [dealsData, setDealsData] = useState(SEED_DEALS_DATA);
  const [dealsStats, setDealsStats] = useState({
    totalDeals: 1063,
    bulkCount: 708,
    blockCount: 221,
    insiderCount: 134,
    totalFlowCr: 211151,
    buyFlowCr: 124571,
    sellFlowCr: 86579,
    latestDate: new Date().toISOString().slice(0, 10)
  });
  const [dealsTotalFiltered, setDealsTotalFiltered] = useState(1063);
  const [dealsPage, setDealsPage] = useState(1);
  const [dealsHasMore, setDealsHasMore] = useState(true);

  const [ipoData, setIpoData] = useState(SEED_IPO_DATA);
  const [loading, setLoading] = useState(false);
  const [loadingMoreBhav, setLoadingMoreBhav] = useState(false);
  const [loadingMoreDeals, setLoadingMoreDeals] = useState(false);

  // --- Bhavcopy Filters ---
  const [exchangeFilter, setExchangeFilter] = useState('ALL');
  const [minDelivery, setMinDelivery] = useState(40);
  const [bhavSearch, setBhavSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [onlySurge, setOnlySurge] = useState(false);
  const [onlyMegaSurge, setOnlyMegaSurge] = useState(false);
  const [onlyBreakout, setOnlyBreakout] = useState(false);
  const [only52wLow, setOnly52wLow] = useState(false);
  const [onlyHighDelivery, setOnlyHighDelivery] = useState(false);
  const [onlySmartAccumulation, setOnlySmartAccumulation] = useState(false);
  const [onlyDistribution, setOnlyDistribution] = useState(false);
  const [onlyTopGainers, setOnlyTopGainers] = useState(false);
  const [onlyTopLosers, setOnlyTopLosers] = useState(false);

  // --- Deals Filters ---
  const [dealTypeFilter, setDealTypeFilter] = useState('ALL');
  const [dealsExchangeFilter, setDealsExchangeFilter] = useState('ALL');
  const [dealsDateRange, setDealsDateRange] = useState('ALL');
  const [dealsMinSize, setDealsMinSize] = useState(0);
  const [dealsSearch, setDealsSearch] = useState('');
  const [dealsSortBy, setDealsSortBy] = useState('DATE_DESC');

  // --- IPO Filters, View Mode & Per-Column Search (Screenshot 4) ---
  const [ipoViewMode, setIpoViewMode] = useState('SUBSCRIPTION_TABLE'); // 'SUBSCRIPTION_TABLE' | 'CARDS'
  const [ipoCategory, setIpoCategory] = useState('ALL');
  const [ipoStatusFilter, setIpoStatusFilter] = useState('ALL');
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
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: '50',
        exchange: exchangeFilter,
        minDelivery: String(bhavSearch.trim() ? 0 : minDelivery),
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
        topLosersOnly: String(onlyTopLosers)
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
    onlyTopGainers, onlyTopLosers
  ]);

  // Build query string for Server-Side Paginated Deals (~4 KB response)
  const fetchDealsPage = useCallback(async (pageNum = 1, append = false) => {
    if (append) setLoadingMoreDeals(true);
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: '50',
        type: dealTypeFilter,
        exchange: dealsExchangeFilter,
        dateRange: dealsDateRange,
        minSize: String(dealsMinSize),
        search: dealsSearch.trim(),
        sortBy: dealsSortBy
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
    }
  }, [dealTypeFilter, dealsExchangeFilter, dealsDateRange, dealsMinSize, dealsSearch, dealsSortBy]);

  const fetchIposList = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/ipos`).then(r => r.ok ? r.json() : null).catch(() => null);
      if (res?.ipos && Array.isArray(res.ipos) && res.ipos.length > 0) {
        setIpoData(res.ipos);
      }
    } catch (e) {
      // Fallback to SEED_IPO_DATA
    }
  }, []);

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

  // Re-fetch Page 1 whenever Bhavcopy filters change
  useEffect(() => {
    const t = setTimeout(() => {
      fetchBhavcopyPage(1, false);
    }, 150);
    return () => clearTimeout(t);
  }, [fetchBhavcopyPage]);

  // Re-fetch Page 1 whenever Deals filters change
  useEffect(() => {
    const t = setTimeout(() => {
      fetchDealsPage(1, false);
    }, 150);
    return () => clearTimeout(t);
  }, [fetchDealsPage]);

  useEffect(() => {
    fetchIposList();
  }, [fetchIposList]);

  // Filtered & Sorted IPOs (including Screenshot 4 per-column search filters & sort headers)
  const filteredIpos = useMemo(() => {
    let list = [...ipoData];
    if (ipoCategory !== 'ALL') {
      list = list.filter(i => i.category === ipoCategory);
    }
    if (ipoStatusFilter !== 'ALL') {
      list = list.filter(i => i.status === ipoStatusFilter);
    }
    if (ipoSearch.trim()) {
      const q = ipoSearch.toLowerCase().trim();
      list = list.filter(i =>
        (i.name && i.name.toLowerCase().includes(q)) ||
        (i.registrar && i.registrar.toLowerCase().includes(q)) ||
        (i.badge && i.badge.toLowerCase().includes(q))
      );
    }

    // Per-column search filters (matching Screenshot 4's column search boxes)
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

    // Column Sorting
    list.sort((a, b) => {
      const dir = ipoSortDir === 'ASC' ? 1 : -1;
      if (ipoSortCol === 'name') return a.name.localeCompare(b.name) * dir;
      if (ipoSortCol === 'closeDate') return String(a.closeDate || '').localeCompare(String(b.closeDate || '')) * dir;
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
    setMinDelivery(40);
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
  };

  const activeFilterCount = [
    onlySurge, onlyMegaSurge, onlyBreakout, only52wLow, onlyHighDelivery,
    onlySmartAccumulation, onlyDistribution, onlyTopGainers, onlyTopLosers,
    sectorFilter !== 'ALL', exchangeFilter !== 'ALL', bhavSearch.trim().length > 0
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
    const headers = ['Symbol', 'Company Name', 'Exchange', 'BSE Code', 'Sector', 'LTP', 'Day Change (%)', 'Volume', 'Delivery Qty', 'Delivery (%)', 'Volume Surge (x)'];
    const rows = bhavcopyData.map(r => [
      r.symbol, `"${(r.name || '').replace(/"/g, '""')}"`, r.exchange, r.bseCode || '', `"${r.sector || ''}"`, r.ltp, r.change, r.volume, r.delivQty, r.delivPct, r.surgeMult
    ]);
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SkandX_Bhavcopy_Screener_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const latestDealBadge = formatDateBadge(dealsStats.latestDate);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      boxSizing: 'border-box',
      minHeight: '100vh',
      background: 'var(--bg-dark, #0b0e14)',
      color: '#fff',
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: isMobile ? 'max(12px, env(safe-area-inset-top, 12px)) 12px 90px' : '16px 20px 100px'
    }}>

      {/* Top Header */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', marginBottom: isMobile ? '14px' : '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: isMobile ? '12px' : '16px', flexWrap: 'wrap', gap: isMobile ? '10px' : '12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? '10px' : '14px' }}>
          <button
            type="button"
            onClick={onBack}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: isMobile ? '6px 10px' : '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: isMobile ? '12px' : '13px', fontWeight: '600', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            ← {isMobile ? 'Back' : 'Back to Hub'}
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <img src={logoImg} alt="SkandX Logo" style={{ width: isMobile ? '26px' : '30px', height: isMobile ? '26px' : '30px', borderRadius: '8px', boxShadow: '0 0 12px rgba(56, 189, 248, 0.4)', border: '1px solid rgba(125, 211, 252, 0.35)', objectFit: 'cover', flexShrink: 0 }} />
              <h1 style={{ margin: 0, fontSize: isMobile ? '16px' : '20px', fontWeight: '800', letterSpacing: '-0.3px', lineHeight: 1.25 }}>Primary Markets &amp; Institutional Intelligence</h1>
              <span style={{ fontSize: '9.5px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', padding: '2px 7px', borderRadius: '12px', fontWeight: '700', whiteSpace: 'nowrap' }}>Official Exchange Feed ({bhavStats.asOfDate})</span>
              <span style={{ fontSize: '9.5px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '2px 7px', borderRadius: '12px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                {bhavStats.totalStocks.toLocaleString('en-IN')} Stocks • {dealsStats.totalDeals.toLocaleString('en-IN')} Deals • {ipoData.length} IPOs
              </span>
            </div>
            {!isMobile && (
              <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: 'var(--text-secondary, #94a3b8)' }}>
                Full NSE &amp; BSE Bhavcopy delivery screener ({bhavStats.totalStocks.toLocaleString('en-IN')} equities), daily SEBI bulk/block/insider deals up to {latestDealBadge}, and live 14-column IPO subscription &amp; GMP hub.
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleExportPrimaryCsv}
            style={{ flex: isMobile ? 1 : 'initial', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: '#34d399', padding: isMobile ? '7px 10px' : '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: isMobile ? '11px' : '12px', fontWeight: '700', whiteSpace: 'nowrap' }}
            title="Export Loaded Bhavcopy Stocks to CSV"
          >
            ⬇ CSV ({bhavcopyData.length})
          </button>
          <button
            type="button"
            onClick={fetchPrimaryMarketData}
            style={{ flex: isMobile ? 1 : 'initial', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', padding: isMobile ? '7px 10px' : '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: isMobile ? '11px' : '12px', fontWeight: '600', whiteSpace: 'nowrap' }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {onOpenPaperTrading && (
            <button
              type="button"
              onClick={onOpenPaperTrading}
              style={{ flex: isMobile ? 1 : 'initial', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '5px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', color: '#fff', padding: isMobile ? '7px 12px' : '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: isMobile ? '11px' : '12px', fontWeight: '700', whiteSpace: 'nowrap' }}
            >
              📈 Trade Live <ArrowUpRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 3 Master Tabs */}
      <div style={{
        display: 'flex',
        flexWrap: isMobile ? 'nowrap' : 'wrap',
        overflowX: isMobile ? 'auto' : 'visible',
        WebkitOverflowScrolling: 'touch',
        gap: isMobile ? '8px' : '12px',
        marginBottom: isMobile ? '16px' : '24px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: isMobile ? '12px' : '16px',
        alignItems: 'center'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('BHAVCOPY')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '8px 14px' : '10px 20px', borderRadius: '12px', minHeight: isMobile ? '38px' : '44px',
            background: activeTab === 'BHAVCOPY' ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.04)',
            border: activeTab === 'BHAVCOPY' ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
            color: activeTab === 'BHAVCOPY' ? '#60a5fa' : '#94a3b8',
            fontSize: isMobile ? '12px' : '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s ease'
          }}
        >
          <BarChart2 size={15} /> {isMobile ? `📈 1. Bhavcopy (${bhavTotalFiltered.toLocaleString('en-IN')})` : `📈 1. NSE & BSE Bhavcopy Screener (${bhavTotalFiltered.toLocaleString('en-IN')} / ${bhavStats.totalStocks.toLocaleString('en-IN')})`}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('DEALS')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '8px 14px' : '10px 20px', borderRadius: '12px', minHeight: isMobile ? '38px' : '44px',
            background: activeTab === 'DEALS' ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.04)',
            border: activeTab === 'DEALS' ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.08)',
            color: activeTab === 'DEALS' ? '#c084fc' : '#94a3b8',
            fontSize: isMobile ? '12px' : '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s ease'
          }}
        >
          <Building2 size={15} /> {isMobile ? `🏛️ 2. Bulk & Block (${dealsTotalFiltered.toLocaleString('en-IN')})` : `🏛️ 2. Bulk, Block & Insider Deals (${dealsTotalFiltered.toLocaleString('en-IN')})`}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('IPOS')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '8px 14px' : '10px 20px', borderRadius: '12px', minHeight: isMobile ? '38px' : '44px',
            background: activeTab === 'IPOS' ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.04)',
            border: activeTab === 'IPOS' ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.08)',
            color: activeTab === 'IPOS' ? '#4ade80' : '#94a3b8',
            fontSize: isMobile ? '12px' : '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s ease'
          }}
        >
          <Sparkles size={15} /> {isMobile ? `🚀 3. IPO & Sub (${filteredIpos.length})` : `🚀 3. IPO & SME Live Subscription & GMP Hub (${filteredIpos.length})`}
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: FULL NSE & BSE BHAVCOPY SCREENER (5,772+ STOCKS, SERVER-SIDE PAGINATED) */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'BHAVCOPY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Quick Stats KPI Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: isMobile ? '8px' : '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px' }}>
              <div style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase' }}>Stocks Screened</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#fff', marginTop: '2px' }}>
                {bhavTotalFiltered.toLocaleString('en-IN')} of {bhavStats.totalStocks.toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px' }}>
              <div style={{ fontSize: '10.5px', color: '#fef08a', textTransform: 'uppercase' }}>🔥 52W High Breakouts</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#eab308', marginTop: '2px' }}>
                {bhavStats.breakouts52w.toLocaleString('en-IN')} Stocks
              </div>
            </div>
            <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px' }}>
              <div style={{ fontSize: '10.5px', color: '#bae6fd', textTransform: 'uppercase' }}>❄️ 52W Low Reversals</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#38bdf8', marginTop: '2px' }}>
                {bhavStats.reversals52w.toLocaleString('en-IN')} Stocks
              </div>
            </div>
            <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px' }}>
              <div style={{ fontSize: '10.5px', color: '#86efac', textTransform: 'uppercase' }}>💎 High Delivery (≥75%)</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#22c55e', marginTop: '2px' }}>
                {bhavStats.highDelivery75.toLocaleString('en-IN')} Stocks
              </div>
            </div>
            <div style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px', gridColumn: isMobile ? 'span 2' : 'auto' }}>
              <div style={{ fontSize: '10.5px', color: '#e9d5ff', textTransform: 'uppercase' }}>⚡ Volume Surges (2x+)</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#c084fc', marginTop: '2px' }}>
                {bhavStats.volumeSurges2x.toLocaleString('en-IN')} Stocks
              </div>
            </div>
          </div>

          {/* Screening & Filter Control Console */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: isMobile ? '12px' : '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SlidersHorizontal size={16} color="#60a5fa" />
                <h3 style={{ margin: 0, fontSize: isMobile ? '13px' : '14px', fontWeight: '800', color: '#f8fafc' }}>
                  Institutional Delivery &amp; Price Action Filters ({activeFilterCount} Active)
                </h3>
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetAllBhavFilters}
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Reset All Filters
                </button>
              )}
            </div>

            {/* Exchange Toggle Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Exchange:</span>
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
                    padding: '5px 12px', borderRadius: '16px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer',
                    background: exchangeFilter === ex.id ? '#3b82f6' : 'rgba(255,255,255,0.06)',
                    color: exchangeFilter === ex.id ? '#fff' : '#cbd5e1',
                    border: 'none', transition: 'all 0.12s'
                  }}
                >
                  {ex.label}
                </button>
              ))}
            </div>

            {/* Inputs: Search, Sector & Delivery Slider */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {/* Search */}
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Search Any NSE Symbol / BSE Code</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
                  <input
                    type="text"
                    placeholder="Search across all 5,772 stocks (e.g. RELIANCE, 500325, TATA)..."
                    value={bhavSearch}
                    onChange={e => setBhavSearch(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 32px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#fff', fontSize: '12.5px' }}
                  />
                </div>
              </div>

              {/* Sector Dropdown */}
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Sector Filter</label>
                <select
                  value={sectorFilter}
                  onChange={e => setSectorFilter(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#fff', fontSize: '12.5px', cursor: 'pointer' }}
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
                  <option value="Chemicals & Fertilizers">Chemicals &amp; Fertilizers</option>
                  <option value="Textiles & Apparel">Textiles &amp; Apparel</option>
                  <option value="Hospitality & Media">Hospitality &amp; Media</option>
                  <option value="Diversified & Midcap">Diversified &amp; Midcap</option>
                </select>
              </div>

              {/* Delivery Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Min Delivery %</label>
                  <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: '800' }}>≥ {minDelivery}%</span>
                </div>
                <input
                  type="range"
                  min="25"
                  max="85"
                  step="5"
                  value={minDelivery}
                  onChange={e => setMinDelivery(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* 9 Checkbox Screener Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', background: onlyBreakout ? 'rgba(234,179,8,0.2)' : 'rgba(255,255,255,0.04)', border: onlyBreakout ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.08)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', color: onlyBreakout ? '#fef08a' : '#cbd5e1' }}>
                <input type="checkbox" checked={onlyBreakout} onChange={e => setOnlyBreakout(e.target.checked)} style={{ accentColor: '#eab308' }} />
                <span>🔥 52W High Breakouts</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', background: only52wLow ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.04)', border: only52wLow ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', color: only52wLow ? '#38bdf8' : '#cbd5e1' }}>
                <input type="checkbox" checked={only52wLow} onChange={e => setOnly52wLow(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                <span>❄️ 52W Low Reversals</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', background: onlySurge ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)', border: onlySurge ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', color: onlySurge ? '#c084fc' : '#cbd5e1' }}>
                <input type="checkbox" checked={onlySurge} onChange={e => setOnlySurge(e.target.checked)} style={{ accentColor: '#a855f7' }} />
                <span>⚡ Volume Surge (2x+)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', background: onlyMegaSurge ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.04)', border: onlyMegaSurge ? '1px solid #f43f5e' : '1px solid rgba(255,255,255,0.08)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', color: onlyMegaSurge ? '#fb7185' : '#cbd5e1' }}>
                <input type="checkbox" checked={onlyMegaSurge} onChange={e => setOnlyMegaSurge(e.target.checked)} style={{ accentColor: '#f43f5e' }} />
                <span>🚀 Mega Surge (3.5x+)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', background: onlyHighDelivery ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.04)', border: onlyHighDelivery ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.08)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', color: onlyHighDelivery ? '#86efac' : '#cbd5e1' }}>
                <input type="checkbox" checked={onlyHighDelivery} onChange={e => setOnlyHighDelivery(e.target.checked)} style={{ accentColor: '#22c55e' }} />
                <span>💎 High Delivery (≥75%)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', background: onlySmartAccumulation ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)', border: onlySmartAccumulation ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', color: onlySmartAccumulation ? '#6ee7b7' : '#cbd5e1' }}>
                <input type="checkbox" checked={onlySmartAccumulation} onChange={e => setOnlySmartAccumulation(e.target.checked)} style={{ accentColor: '#10b981' }} />
                <span>📈 Smart Accumulation</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', background: onlyDistribution ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)', border: onlyDistribution ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', color: onlyDistribution ? '#fca5a5' : '#cbd5e1' }}>
                <input type="checkbox" checked={onlyDistribution} onChange={e => setOnlyDistribution(e.target.checked)} style={{ accentColor: '#ef4444' }} />
                <span>🚨 Distribution</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', background: onlyTopGainers ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)', border: onlyTopGainers ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.08)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', color: onlyTopGainers ? '#4ade80' : '#cbd5e1' }}>
                <input type="checkbox" checked={onlyTopGainers} onChange={e => setOnlyTopGainers(e.target.checked)} style={{ accentColor: '#22c55e' }} />
                <span>🟢 Top Gainers (&gt;2%)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', background: onlyTopLosers ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)', border: onlyTopLosers ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', color: onlyTopLosers ? '#f87171' : '#cbd5e1' }}>
                <input type="checkbox" checked={onlyTopLosers} onChange={e => setOnlyTopLosers(e.target.checked)} style={{ accentColor: '#ef4444' }} />
                <span>🔴 Top Losers (&lt;-1.5%)</span>
              </label>
            </div>
          </div>

          {/* Delivery Table */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', textAlign: 'left', fontSize: isMobile ? '12px' : '12.5px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)', textTransform: 'uppercase', fontSize: '11px' }}>
                  <th style={{ padding: '12px 16px' }}>Stock / Company &amp; Sector</th>
                  <th style={{ padding: '12px 16px' }}>Exchange</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>LTP (₹)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Day Change</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Traded Vol</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Delivery Vol</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Delivery %</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Signals</th>
                </tr>
              </thead>
              <tbody>
                {bhavcopyData.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                      No stocks matched your active filter combination. Click "Reset All Filters" or relax the delivery slider.
                    </td>
                  </tr>
                ) : (
                  bhavcopyData.map((stock, idx) => (
                    <tr key={`${stock.symbol}_${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '700', color: '#fff' }}>{stock.symbol}</span>
                          {stock.bseCode && (
                            <span style={{ fontSize: '10.5px', color: '#64748b' }}>#{stock.bseCode}</span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {stock.name && stock.name !== stock.symbol ? `${stock.name} • ` : ''}<span style={{ color: '#64748b' }}>{stock.sector}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '10px', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                          {stock.exchange === 'BOTH' ? 'NSE • BSE' : stock.exchange}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', whiteSpace: 'nowrap' }}>₹{stock.ltp?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: stock.change >= 0 ? '#22c55e' : '#ef4444', whiteSpace: 'nowrap' }}>
                        {stock.change >= 0 ? `+${stock.change}%` : `${stock.change}%`}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#cbd5e1', whiteSpace: 'nowrap' }}>{(stock.volume / 100000).toFixed(2)} L</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#cbd5e1', whiteSpace: 'nowrap' }}>{(stock.delivQty / 100000).toFixed(2)} L</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: stock.delivPct >= 75 ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)', color: stock.delivPct >= 75 ? '#22c55e' : '#60a5fa', border: `1px solid ${stock.delivPct >= 75 ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.3)'}`, padding: '3px 10px', borderRadius: '12px', fontWeight: '800' }}>
                          {stock.delivPct}%
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          {stock.is52wHigh && <span title="52-Week High Breakout" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' }}>🔥 52W High</span>}
                          {stock.is52wLow && <span title="52-Week Low Bounce" style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' }}>❄️ 52W Low</span>}
                          {stock.surgeMult >= 2.0 && <span title="Volume Surge 2x+" style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' }}>⚡ {stock.surgeMult}x Vol</span>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Server-Side Bhavcopy Pagination / Load More Controls (~4 KB per page) */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Showing {bhavcopyData.length.toLocaleString('en-IN')} of {bhavTotalFiltered.toLocaleString('en-IN')} Matching Stocks (Total Universe: {bhavStats.totalStocks.toLocaleString('en-IN')} NSE &amp; BSE Equities)
            </span>
            {bhavHasMore && (
              <button
                type="button"
                disabled={loadingMoreBhav}
                onClick={() => fetchBhavcopyPage(bhavPage + 1, true)}
                style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', color: '#60a5fa', padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
                {loadingMoreBhav ? 'Loading...' : 'Load More (+50 Stocks)'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: BULK, BLOCK & INSIDER DEALS MONITOR (1,060+ DEALS UP TO TODAY)          */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'DEALS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Deals KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: isMobile ? '8px' : '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px' }}>
              <div style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase' }}>Total Deals (30D Rolling)</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#fff', marginTop: '2px' }}>
                {dealsTotalFiltered.toLocaleString('en-IN')} / {dealsStats.totalDeals.toLocaleString('en-IN')} Deals
              </div>
            </div>
            <div style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px' }}>
              <div style={{ fontSize: '10.5px', color: '#e9d5ff', textTransform: 'uppercase' }}>Total Institutional Flow</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#c084fc', marginTop: '2px' }}>
                ₹{dealsStats.totalFlowCr.toLocaleString('en-IN')} Cr
              </div>
            </div>
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px' }}>
              <div style={{ fontSize: '10.5px', color: '#86efac', textTransform: 'uppercase' }}>Institutional Buying</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#22c55e', marginTop: '2px' }}>
                ₹{dealsStats.buyFlowCr.toLocaleString('en-IN')} Cr
              </div>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px' }}>
              <div style={{ fontSize: '10.5px', color: '#fca5a5', textTransform: 'uppercase' }}>Institutional Selling</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#ef4444', marginTop: '2px' }}>
                ₹{dealsStats.sellFlowCr.toLocaleString('en-IN')} Cr
              </div>
            </div>
          </div>

          {/* Advanced Filter Control Bar */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: isMobile ? '12px' : '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Top row: Deal Category Pills */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'ALL', label: `All Deals (${dealsStats.totalDeals.toLocaleString('en-IN')})` },
                  { id: 'BULK_DEAL', label: `Bulk Deals (${dealsStats.bulkCount.toLocaleString('en-IN')})` },
                  { id: 'BLOCK_DEAL', label: `Block Deals (${dealsStats.blockCount.toLocaleString('en-IN')})` },
                  { id: 'INSIDER_PROMOTER', label: `Insider & Promoters (${dealsStats.insiderCount.toLocaleString('en-IN')})` },
                  { id: 'BUY', label: 'Buys Only' },
                  { id: 'SELL', label: 'Sells Only' }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDealTypeFilter(f.id)}
                    style={{
                      padding: '6px 12px', borderRadius: '20px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer',
                      background: dealTypeFilter === f.id ? '#a855f7' : 'rgba(255,255,255,0.06)',
                      color: dealTypeFilter === f.id ? '#fff' : '#cbd5e1',
                      border: 'none', whiteSpace: 'nowrap'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Search Input for Deals */}
              <div style={{ position: 'relative', minWidth: isMobile ? '100%' : '260px', flex: '1 1 260px', maxWidth: isMobile ? '100%' : '380px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Search 1,060+ deals (e.g. Morgan Stanley, LIC, ZOMATO)..."
                  value={dealsSearch}
                  onChange={e => setDealsSearch(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 32px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
              </div>
            </div>

            {/* Bottom Row: Exchange, Date Range, Size & Sort Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>

              {/* Exchange Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Exchange:</span>
                {['ALL', 'NSE', 'BSE'].map(ex => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setDealsExchangeFilter(ex)}
                    style={{
                      padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                      background: dealsExchangeFilter === ex ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.04)',
                      color: dealsExchangeFilter === ex ? '#60a5fa' : '#94a3b8',
                      border: dealsExchangeFilter === ex ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.08)'
                    }}
                  >
                    {ex === 'ALL' ? 'All' : ex}
                  </button>
                ))}
              </div>

              {/* Date Filter (Dynamically anchored to latest trading date!) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Date:</span>
                {[
                  { id: 'ALL', label: 'All Dates' },
                  { id: 'TODAY', label: `Latest (${latestDealBadge})` },
                  { id: 'WEEK', label: 'Past 7 Days' },
                  { id: 'MONTH', label: 'Past 30 Days' }
                ].map(dt => (
                  <button
                    key={dt.id}
                    type="button"
                    onClick={() => setDealsDateRange(dt.id)}
                    style={{
                      padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                      background: dealsDateRange === dt.id ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.04)',
                      color: dealsDateRange === dt.id ? '#c084fc' : '#94a3b8',
                      border: dealsDateRange === dt.id ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.08)'
                    }}
                  >
                    {dt.label}
                  </button>
                ))}
              </div>

              {/* Size Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Deal Size:</span>
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
                      background: dealsMinSize === sz.id ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.04)',
                      color: dealsMinSize === sz.id ? '#4ade80' : '#94a3b8',
                      border: dealsMinSize === sz.id ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.08)'
                    }}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>

              {/* Sort Order */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Sort:</span>
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
                      background: dealsSortBy === s.id ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.04)',
                      color: dealsSortBy === s.id ? '#38bdf8' : '#94a3b8',
                      border: dealsSortBy === s.id ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(255,255,255,0.08)'
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Deals Table */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', textAlign: 'left', fontSize: isMobile ? '12px' : '12.5px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)', textTransform: 'uppercase', fontSize: '11px' }}>
                  <th style={{ padding: '12px 16px' }}>Date</th>
                  <th style={{ padding: '12px 16px' }}>Stock</th>
                  <th style={{ padding: '12px 16px' }}>Exch</th>
                  <th style={{ padding: '12px 16px' }}>Client / Institution / Promoter</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Type</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Shares Traded</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Price (₹)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Value (₹ Cr)</th>
                </tr>
              </thead>
              <tbody>
                {dealsData.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                      No institutional deals match this search or filter. Try clearing the search query or date range.
                    </td>
                  </tr>
                ) : (
                  dealsData.map((deal, idx) => (
                    <tr key={deal.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 16px', color: '#94a3b8', whiteSpace: 'nowrap', fontWeight: '600' }}>{deal.date}</td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '700', color: '#fff' }}>{deal.symbol}</div>
                        <div style={{ fontSize: '10.5px', color: '#64748b' }}>{deal.company}</div>
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.06)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                          {deal.exchange || 'NSE'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>
                        <div style={{ fontWeight: '600' }}>{deal.client}</div>
                        <div style={{ fontSize: '10.5px', color: '#64748b' }}>{deal.dealType?.replace('_', ' ')}</div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{ background: deal.type === 'BUY' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: deal.type === 'BUY' ? '#22c55e' : '#ef4444', border: `1px solid ${deal.type === 'BUY' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, padding: '2px 8px', borderRadius: '6px', fontWeight: '700', fontSize: '11px' }}>
                          {deal.type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>{deal.qty?.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap' }}>₹{deal.price?.toFixed(2)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#f8fafc', whiteSpace: 'nowrap' }}>₹{deal.valueCr?.toFixed(2)} Cr</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Server-Side Deals Pagination / Load More Controls (~4 KB per page) */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Showing {dealsData.length.toLocaleString('en-IN')} of {dealsTotalFiltered.toLocaleString('en-IN')} Matching Institutional Deals (Total Monitored: {dealsStats.totalDeals.toLocaleString('en-IN')})
            </span>
            {dealsHasMore && (
              <button
                type="button"
                disabled={loadingMoreDeals}
                onClick={() => fetchDealsPage(dealsPage + 1, true)}
                style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.35)', color: '#c084fc', padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
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
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px' }}>
              <div style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase' }}>Total IPOs Tracked</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#fff', marginTop: '2px' }}>
                {filteredIpos.length} of {ipoData.length} Issues
              </div>
            </div>
            <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.28)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px' }}>
              <div style={{ fontSize: '10.5px', color: '#86efac', textTransform: 'uppercase' }}>🟢 Live / Open Issues</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#22c55e', marginTop: '2px' }}>
                {ipoData.filter(i => i.status === 'OPEN').length} Active Now
              </div>
            </div>
            <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.28)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px' }}>
              <div style={{ fontSize: '10.5px', color: '#bae6fd', textTransform: 'uppercase' }}>Total Issue Capital</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#60a5fa', marginTop: '2px' }}>
                ₹{Math.round(filteredIpos.reduce((acc, i) => acc + (i.issueSizeCr || 0), 0)).toLocaleString('en-IN')} Cr
              </div>
            </div>
            <div style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.28)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px' }}>
              <div style={{ fontSize: '10.5px', color: '#e9d5ff', textTransform: 'uppercase' }}>Total Applications</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#c084fc', marginTop: '2px' }}>
                {(filteredIpos.reduce((acc, i) => acc + (i.applications || 0), 0) / 100000).toFixed(2)} Lakh+
              </div>
            </div>
          </div>

          {/* Category Toggle, View Mode Switcher & Search */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: isMobile ? '12px' : '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              {/* Category Pills */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'ALL', label: `All IPOs (${ipoData.length})` },
                  { id: 'MAINBOARD', label: `🏢 Mainboard (${ipoData.filter(i => i.category === 'MAINBOARD').length})` },
                  { id: 'SME', label: `🚀 SME IPOs (${ipoData.filter(i => i.category === 'SME').length})` }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setIpoCategory(cat.id)}
                    style={{
                      padding: '7px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                      background: ipoCategory === cat.id ? '#22c55e' : 'rgba(255,255,255,0.06)',
                      color: ipoCategory === cat.id ? '#0b0e14' : '#cbd5e1',
                      border: 'none', whiteSpace: 'nowrap'
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* View Mode Switcher: Live Subscription Table vs Cards View */}
              <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.35)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                  type="button"
                  onClick={() => setIpoViewMode('SUBSCRIPTION_TABLE')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '7px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', border: 'none',
                    background: ipoViewMode === 'SUBSCRIPTION_TABLE' ? 'rgba(59,130,246,0.25)' : 'transparent',
                    color: ipoViewMode === 'SUBSCRIPTION_TABLE' ? '#60a5fa' : '#94a3b8'
                  }}
                >
                  <Table size={14} /> 📊 Live Subscription Status Table (14 Cols)
                </button>
                <button
                  type="button"
                  onClick={() => setIpoViewMode('CARDS')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '7px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', border: 'none',
                    background: ipoViewMode === 'CARDS' ? 'rgba(34,197,94,0.22)' : 'transparent',
                    color: ipoViewMode === 'CARDS' ? '#4ade80' : '#94a3b8'
                  }}
                >
                  <LayoutGrid size={14} /> 🗂️ GMP &amp; Allotment Cards
                </button>
              </div>
            </div>

            {/* Second Row: Status Filter & Global Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'ALL', label: 'All Status' },
                  { id: 'OPEN', label: '🟢 Open / Active' },
                  { id: 'UPCOMING', label: '⏳ Upcoming' },
                  { id: 'CLOSED', label: '✅ Recent / Listed' }
                ].map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setIpoStatusFilter(st.id)}
                    style={{
                      padding: '5px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                      background: ipoStatusFilter === st.id ? 'rgba(59,130,246,0.2)' : 'transparent',
                      color: ipoStatusFilter === st.id ? '#60a5fa' : '#94a3b8',
                      border: ipoStatusFilter === st.id ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', minWidth: isMobile ? '100%' : '280px', flex: '1 1 260px', maxWidth: isMobile ? '100%' : '380px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Search company, registrar (KFintech, Link Intime, Bigshare)..."
                  value={ipoSearch}
                  onChange={e => setIpoSearch(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 32px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────────────────── */}
          {/* VIEW MODE 1: 14-COLUMN LIVE SUBSCRIPTION STATUS TABLE (MATCHING SCREENSHOT 4) */}
          {/* ─────────────────────────────────────────────────────────────────────────── */}
          {ipoViewMode === 'SUBSCRIPTION_TABLE' && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: '1480px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  {/* Row 1: Sortable Column Headers */}
                  <tr style={{ background: 'rgba(30,41,59,0.75)', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', fontWeight: '800' }}>
                    <th onClick={() => handleSortIpoCol('name')} style={{ padding: '10px 12px', cursor: 'pointer', minWidth: '230px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Company</span>
                        <ArrowUpDown size={11} color="#64748b" />
                      </div>
                    </th>
                    <th onClick={() => handleSortIpoCol('closeDate')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>Closing</div>
                      <div>Date ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('issueSizeCr')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>Issue Amount</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>(Rs.Cr.) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('qib')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>QIB</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>(X) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('snii')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>SNII</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>(X) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('bnii')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>BNII</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>(X) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('nii')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>NII</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>(X) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('retail')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>Retail</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>(X) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('employee')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>Employee</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>(X) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('shareholder')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>Shareholder</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>(X) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('others')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>Others</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>(X) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('total')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.06)', color: '#60a5fa' }}>
                      <div>Total</div>
                      <div style={{ fontSize: '10px', color: '#93c5fd' }}>(X) ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('applications')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>Applications</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>Count ⇅</div>
                    </th>
                    <th onClick={() => handleSortIpoCol('gmpPct')} style={{ padding: '10px 8px', cursor: 'pointer', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.06)', color: '#4ade80' }}>
                      <div>Live GMP</div>
                      <div style={{ fontSize: '10px', color: '#86efac' }}>Est. Gain ⇅</div>
                    </th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>Subscription</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>As On</div>
                    </th>
                    <th style={{ padding: '10px 10px', textAlign: 'center' }}>
                      <div>Allotment</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>Status</div>
                    </th>
                  </tr>

                  {/* Row 2: Per-Column Search Inputs (Matching Screenshot 4!) */}
                  <tr style={{ background: 'rgba(15,23,42,0.85)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
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
                      <th key={col.key} style={{ padding: '5px 6px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                        <input
                          type="text"
                          placeholder={col.placeholder}
                          value={colSearch[col.key]}
                          onChange={e => setColSearch(prev => ({ ...prev, [col.key]: e.target.value }))}
                          style={{
                            width: '100%', boxSizing: 'border-box', padding: '4px 6px',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '4px', color: '#fff', fontSize: '10.5px'
                          }}
                        />
                      </th>
                    ))}
                    {/* GMP column spacer */}
                    <th style={{ padding: '5px 6px', borderRight: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', fontSize: '10px', color: '#64748b' }}>
                      Price / Lot
                    </th>
                    {/* As On search */}
                    <th style={{ padding: '5px 6px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                      <input
                        type="text"
                        placeholder="Search date..."
                        value={colSearch.asOn}
                        onChange={e => setColSearch(prev => ({ ...prev, asOn: e.target.value }))}
                        style={{
                          width: '100%', boxSizing: 'border-box', padding: '4px 6px',
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '4px', color: '#fff', fontSize: '10.5px'
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
                        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '4px', padding: '3px 7px', fontSize: '10px', cursor: 'pointer', fontWeight: '700' }}
                      >
                        Clear
                      </button>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredIpos.length === 0 ? (
                    <tr>
                      <td colSpan="16" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
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
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'rgba(59,130,246,0.03)'
                          }}
                        >
                          {/* 1. Company Name + LT/SME/MAINBOARD Badge */}
                          <td style={{ padding: '10px 12px', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '700', color: '#60a5fa' }}>{ipo.name}</span>
                              <span style={{
                                fontSize: '9.5px',
                                background: ipo.badge === 'SME' || ipo.category === 'SME' ? 'rgba(59,130,246,0.2)' : 'rgba(34,197,94,0.2)',
                                color: ipo.badge === 'SME' || ipo.category === 'SME' ? '#93c5fd' : '#86efac',
                                border: '1px solid rgba(255,255,255,0.15)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontWeight: '800'
                              }}>
                                {ipo.badge || ipo.category}
                              </span>
                              {ipo.status === 'OPEN' && (
                                <span style={{ fontSize: '9px', background: 'rgba(34,197,94,0.2)', color: '#4ade80', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>
                                  LIVE
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                              {ipo.priceBand} • Lot: {ipo.lotSize} • {ipo.registrar}
                            </div>
                          </td>

                          {/* 2. Closing Date */}
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: '#cbd5e1', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ fontWeight: '600' }}>{ipo.closeDate}</div>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>Open: {ipo.openDate}</div>
                          </td>

                          {/* 3. Issue Amount (Rs.Cr.) */}
                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '700', color: '#f8fafc', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {Number(ipo.issueSizeCr || 0).toFixed(2)}
                          </td>

                          {/* 4. QIB (X) */}
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#cbd5e1', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {formatSubVal(sub.qib)}
                          </td>

                          {/* 5. SNII (X) */}
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#cbd5e1', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {formatSubVal(sub.snii)}
                          </td>

                          {/* 6. BNII (X) */}
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#cbd5e1', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {formatSubVal(sub.bnii)}
                          </td>

                          {/* 7. NII (X) */}
                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', color: '#e2e8f0', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {formatSubVal(sub.nii)}
                          </td>

                          {/* 8. Retail (X) */}
                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', color: '#e2e8f0', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {formatSubVal(sub.retail)}
                          </td>

                          {/* 9. Employee (X) */}
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#94a3b8', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {formatSubVal(sub.employee)}
                          </td>

                          {/* 10. Shareholder (X) */}
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#94a3b8', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {formatSubVal(sub.shareholder)}
                          </td>

                          {/* 11. Others (X) */}
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#94a3b8', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {formatSubVal(sub.others)}
                          </td>

                          {/* 12. Total (X) */}
                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '800', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)', color: totalSub >= 50 ? '#facc15' : (totalSub >= 10 ? '#4ade80' : '#60a5fa') }}>
                            {formatSubVal(sub.total)}
                          </td>

                          {/* 13. Applications */}
                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '700', color: '#e2e8f0', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {ipo.applications ? ipo.applications.toLocaleString('en-IN') : '-'}
                          </td>

                          {/* 14. Live GMP & Est. Listing Gain */}
                          <td style={{ padding: '10px 8px', textAlign: 'right', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ fontWeight: '800', color: '#22c55e' }}>+₹{ipo.gmp} ({ipo.gmpPct}%)</div>
                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                              Lot Profit: ₹{((ipo.gmp || 0) * (ipo.lotSize || 1)).toLocaleString('en-IN')}
                            </div>
                          </td>

                          {/* 15. Subscription As On */}
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {ipo.asOn || '12-Oct-2026 17:55'}
                          </td>

                          {/* 16. 1-Click Allotment Check */}
                          <td style={{ padding: '10px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedIpoForCheck(ipo)}
                              style={{ padding: '5px 10px', background: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
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
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────────────── */}
          {/* VIEW MODE 2: GMP, EST. LOT PROFIT & ALLOTMENT CARDS VIEW                     */}
          {/* ─────────────────────────────────────────────────────────────────────────── */}
          {ipoViewMode === 'CARDS' && (
            filteredIpos.length === 0 ? (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '40px', textAlign: 'center', color: '#64748b' }}>
                No IPOs found matching this category or status filter.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: isMobile ? '12px' : '16px' }}>
                {filteredIpos.map((ipo) => {
                  const sub = ipo.subscription || {};
                  const lotProfit = (ipo.gmp || 0) * (ipo.lotSize || 1);
                  const minInv = (ipo.maxPrice || ipo.minPrice || 100) * (ipo.lotSize || 1);
                  const retailOdds = sub.retail > 1 ? Math.max(0.15, (100 / sub.retail)).toFixed(1) : 100;
                  return (
                    <div
                      key={ipo.id}
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}
                    >
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '10.5px', background: ipo.category === 'MAINBOARD' ? 'rgba(59,130,246,0.15)' : 'rgba(234,179,8,0.15)', color: ipo.category === 'MAINBOARD' ? '#60a5fa' : '#eab308', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                              {ipo.category}
                            </span>
                            <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                              via {ipo.registrar}
                            </span>
                          </div>
                          <h3 style={{ margin: '6px 0 0', fontSize: '15px', fontWeight: '700' }}>{ipo.name}</h3>
                        </div>
                        <span style={{ fontSize: '11px', background: ipo.status === 'OPEN' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)', color: ipo.status === 'OPEN' ? '#22c55e' : '#94a3b8', border: `1px solid ${ipo.status === 'OPEN' ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, padding: '3px 8px', borderRadius: '6px', fontWeight: '700' }}>
                          {ipo.status}
                        </span>
                      </div>

                      {/* GMP & Expected Listing Gain Badge */}
                      <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', padding: '10px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Live GMP &amp; Est. Lot Profit</div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: '#22c55e' }}>
                            +₹{ipo.gmp} ({ipo.gmpPct}%) • ₹{lotProfit.toLocaleString('en-IN')}/Lot
                          </div>
                        </div>
                        <Award size={22} color="#22c55e" />
                      </div>

                      {/* Key Metrics */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                        <div>
                          <div style={{ color: '#64748b' }}>Price Band &amp; Lot</div>
                          <div style={{ fontWeight: '700', color: '#fff', marginTop: '2px' }}>{ipo.priceBand} ({ipo.lotSize} sh)</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b' }}>Min Investment</div>
                          <div style={{ fontWeight: '700', color: '#fff', marginTop: '2px' }}>₹{minInv.toLocaleString('en-IN')}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b' }}>Issue Size</div>
                          <div style={{ fontWeight: '700', color: '#fff', marginTop: '2px' }}>₹{ipo.issueSizeCr} Cr</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b' }}>Total Subscription</div>
                          <div style={{ fontWeight: '800', color: '#60a5fa', marginTop: '2px' }}>
                            {sub.total > 0 ? `${sub.total}x (${(ipo.applications || 0).toLocaleString('en-IN')} Apps)` : 'Opens Soon'}
                          </div>
                        </div>
                      </div>

                      {/* Detailed Category Subscription Breakdown (QIB / sNII / bNII / Retail) */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '8px', textAlign: 'center', fontSize: '11px' }}>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '10px' }}>QIB</div>
                          <div style={{ fontWeight: '700', color: '#e2e8f0' }}>{formatSubVal(sub.qib)}x</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '10px' }}>sNII</div>
                          <div style={{ fontWeight: '700', color: '#e2e8f0' }}>{formatSubVal(sub.snii)}x</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '10px' }}>bNII</div>
                          <div style={{ fontWeight: '700', color: '#e2e8f0' }}>{formatSubVal(sub.bnii)}x</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '10px' }}>Retail</div>
                          <div style={{ fontWeight: '700', color: '#4ade80' }}>{formatSubVal(sub.retail)}x</div>
                        </div>
                      </div>

                      {/* Dates & Retail Allotment Probability */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                        <span>📅 {ipo.openDate} → {ipo.closeDate}</span>
                        <span style={{ color: '#facc15', fontWeight: '700' }}>🎯 Retail Odds: {retailOdds}%</span>
                      </div>

                      {/* 1-Click Allotment Status Button */}
                      <button
                        type="button"
                        onClick={() => setSelectedIpoForCheck(ipo)}
                        style={{ width: '100%', padding: '9px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', color: '#60a5fa', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <CheckCircle2 size={14} /> 1-Click Allotment Status Check
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 1-CLICK ALLOTMENT STATUS MODAL (OFFICIAL KFINTECH, LINK INTIME & BIGSHARE)    */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {selectedIpoForCheck && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', maxWidth: '500px', width: '100%', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🔍</span>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>Live IPO Allotment Status</h3>
              </div>
              <button type="button" onClick={() => setSelectedIpoForCheck(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>Company: <strong style={{ color: '#fff' }}>{selectedIpoForCheck.name}</strong></div>
              <div>Official Registrar: <strong style={{ color: '#60a5fa' }}>{selectedIpoForCheck.registrar}</strong></div>
              <div>Total Subscription: <strong style={{ color: '#facc15' }}>{selectedIpoForCheck.subscription?.total || 0}x ({(selectedIpoForCheck.applications || 0).toLocaleString('en-IN')} Applications)</strong></div>
              <div>Listing Date: <strong style={{ color: '#22c55e' }}>{selectedIpoForCheck.listingDate}</strong></div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                Enter Your PAN Number (For 1-Click Copy)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="ABCDE1234F"
                  maxLength="10"
                  value={panNumber}
                  onChange={e => setPanNumber(e.target.value.toUpperCase())}
                  style={{ flex: 1, padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase' }}
                />
                <button
                  type="button"
                  onClick={handleCopyPan}
                  disabled={!panNumber}
                  style={{ padding: '0 14px', background: copiedPan ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)', border: copiedPan ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.15)', color: copiedPan ? '#22c55e' : '#fff', borderRadius: '8px', cursor: panNumber ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
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
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', textAlign: 'center', borderRadius: '10px', fontWeight: '700', fontSize: '13.5px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                Open Official {selectedIpoForCheck.registrar} Portal <ExternalLink size={15} />
              </a>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href="https://www.bseindia.com/investors/appli_check.aspx"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, padding: '9px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', textAlign: 'center', borderRadius: '8px', fontSize: '11.5px', fontWeight: '600', textDecoration: 'none' }}
                >
                  Check on BSE India ↗
                </a>
                <a
                  href="https://www.nseindia.com/invest/check-trades-and-allotment-details"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, padding: '9px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', textAlign: 'center', borderRadius: '8px', fontSize: '11.5px', fontWeight: '600', textDecoration: 'none' }}
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
