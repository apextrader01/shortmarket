// frontend/src/components/PrimaryMarketsView.jsx
// 🏛️ Hub 03: Primary Markets, Full NSE & BSE Bhavcopy Screener (5,797+ Stocks, 20 Filters + Per-Column Filters),
// Rolling 30-Day Bulk/Block/Insider Deals (1,140+ Deals, Per-Column Filters) & Live 14-Column IPO Subscription & GMP Hub

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

const DEFAULT_TRADING_DATE = getClientCompletedTradingDate();

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

export default function PrimaryMarketsView({ initialTab, onBack, onOpenPaperTrading }) {
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
    latestDate: DEFAULT_TRADING_DATE.iso
  });
  const [dealsTotalFiltered, setDealsTotalFiltered] = useState(1141);
  const [dealsPage, setDealsPage] = useState(1);
  const [dealsHasMore, setDealsHasMore] = useState(true);

  const [ipoData, setIpoData] = useState(SEED_IPO_DATA);
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

  // Tab 1 Per-Column Filters & Sorting
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
  const [ipoViewMode, setIpoViewMode] = useState('SUBSCRIPTION_TABLE');
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
              <span style={{ fontSize: '9.5px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', padding: '2px 7px', borderRadius: '12px', fontWeight: '700', whiteSpace: 'nowrap' }}>Official EOD Feed ({bhavStats.asOfDate})</span>
              <span style={{ fontSize: '9.5px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '2px 7px', borderRadius: '12px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                {bhavStats.totalStocks.toLocaleString('en-IN')} Stocks • {dealsStats.totalDeals.toLocaleString('en-IN')} Deals • {ipoData.length} IPOs
              </span>
            </div>
            {!isMobile && (
              <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: 'var(--text-secondary, #94a3b8)' }}>
                Full NSE &amp; BSE Bhavcopy delivery screener ({bhavStats.totalStocks.toLocaleString('en-IN')} equities, 20 institutional filters), daily SEBI bulk/block/insider deals (as of {latestDealBadge} EOD), and live 14-column IPO subscription &amp; GMP hub.
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
      {/* TAB 1: FULL NSE & BSE BHAVCOPY SCREENER (20 CHECKBOXES + PER-COLUMN FILTERS)  */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'BHAVCOPY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Quick Stats KPI Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: isMobile ? '8px' : '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px' }}>
              <div style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase' }}>Stocks Screened ({bhavStats.asOfDate})</div>
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
                  20 Institutional Delivery, VWAP &amp; Price Action Filters ({activeFilterCount} Active)
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
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Search Any NSE Symbol / BSE Code</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
                  <input
                    type="text"
                    placeholder="Search across all 5,797 stocks (e.g. RELIANCE, 500325, TATA)..."
                    value={bhavSearch}
                    onChange={e => setBhavSearch(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 32px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#fff', fontSize: '12.5px' }}
                  />
                </div>
              </div>

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
                  <option value="Chemicals, Industrial & Midcaps">Chemicals, Industrial &amp; Midcaps</option>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Min Delivery %</label>
                  <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: '800' }}>≥ {minDelivery}%</span>
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

            {/* 20 Institutional Checkbox Screener Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
              {[
                { state: onlyBreakout, setter: setOnlyBreakout, label: '🔥 52W High Breakouts', color: '#eab308', bg: 'rgba(234,179,8,0.2)', text: '#fef08a' },
                { state: only52wLow, setter: setOnly52wLow, label: '❄️ 52W Low Reversals', color: '#38bdf8', bg: 'rgba(56,189,248,0.2)', text: '#38bdf8' },
                { state: onlySurge, setter: setOnlySurge, label: '⚡ Volume Surge (2x+)', color: '#a855f7', bg: 'rgba(168,85,247,0.2)', text: '#c084fc' },
                { state: onlyMegaSurge, setter: setOnlyMegaSurge, label: '🚀 Mega Surge (3.5x+)', color: '#f43f5e', bg: 'rgba(244,63,94,0.2)', text: '#fb7185' },
                { state: onlyHighDelivery, setter: setOnlyHighDelivery, label: '💎 High Delivery (≥75%)', color: '#22c55e', bg: 'rgba(34,197,94,0.2)', text: '#86efac' },
                { state: onlyUltraDelivery, setter: setOnlyUltraDelivery, label: '🎯 Ultra Delivery (≥85%)', color: '#10b981', bg: 'rgba(16,185,129,0.22)', text: '#6ee7b7' },
                { state: onlySmartAccumulation, setter: setOnlySmartAccumulation, label: '📈 Smart Accumulation', color: '#10b981', bg: 'rgba(16,185,129,0.2)', text: '#6ee7b7' },
                { state: onlyDistribution, setter: setOnlyDistribution, label: '🚨 Distribution', color: '#ef4444', bg: 'rgba(239,68,68,0.2)', text: '#fca5a5' },
                { state: onlyTopGainers, setter: setOnlyTopGainers, label: '🟢 Top Gainers (>2%)', color: '#22c55e', bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
                { state: onlyTopLosers, setter: setOnlyTopLosers, label: '🔴 Top Losers (<-1.5%)', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
                { state: onlyFno, setter: setOnlyFno, label: `🏛️ F&O Liquid Only (${bhavStats.fnoCount || 196})`, color: '#3b82f6', bg: 'rgba(59,130,246,0.22)', text: '#93c5fd' },
                { state: onlyAboveVwap, setter: setOnlyAboveVwap, label: '📊 Price > VWAP', color: '#06b6d4', bg: 'rgba(6,182,212,0.2)', text: '#67e8f9' },
                { state: onlyCloseNearHigh, setter: setOnlyCloseNearHigh, label: '📈 Close Near Day High', color: '#22c55e', bg: 'rgba(34,197,94,0.18)', text: '#86efac' },
                { state: onlyCloseNearLow, setter: setOnlyCloseNearLow, label: '📉 Close Near Day Low', color: '#f97316', bg: 'rgba(249,115,22,0.2)', text: '#fdba74' },
                { state: onlyWideRange, setter: setOnlyWideRange, label: '💥 Wide Range (>4%)', color: '#ec4899', bg: 'rgba(236,72,153,0.2)', text: '#f9a8d4' },
                { state: onlyTightCoil, setter: setOnlyTightCoil, label: '🔒 NR7 / Tight Coil (<1.2%)', color: '#8b5cf6', bg: 'rgba(139,92,246,0.2)', text: '#c4b5fd' },
                { state: onlyHighTurnover, setter: setOnlyHighTurnover, label: '💰 High Turnover (≥₹50 Cr)', color: '#eab308', bg: 'rgba(234,179,8,0.18)', text: '#fde047' },
                { state: onlyMidSmallAccum, setter: setOnlyMidSmallAccum, label: '🪙 Mid/Small Gems (₹50–₹500)', color: '#14b8a6', bg: 'rgba(20,184,166,0.2)', text: '#5eead4' },
                { state: onlyCircuitGainers, setter: setOnlyCircuitGainers, label: '🚀 Momentum Runners (≥+4.5%)', color: '#16a34a', bg: 'rgba(22,163,74,0.22)', text: '#4ade80' },
                { state: onlyCircuitLosers, setter: setOnlyCircuitLosers, label: '🩸 Heavy Sell-Off (≤-4%)', color: '#dc2626', bg: 'rgba(220,38,38,0.22)', text: '#fca5a5' }
              ].map((pill, idx) => (
                <label
                  key={idx}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: pill.state ? pill.bg : 'rgba(255,255,255,0.04)',
                    border: pill.state ? `1px solid ${pill.color}` : '1px solid rgba(255,255,255,0.08)',
                    padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px',
                    color: pill.state ? pill.text : '#cbd5e1', fontWeight: pill.state ? '700' : '500'
                  }}
                >
                  <input type="checkbox" checked={pill.state} onChange={e => pill.setter(e.target.checked)} style={{ accentColor: pill.color }} />
                  <span>{pill.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Delivery Table with Per-Column Sort & Per-Column Filter Inputs */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '940px', borderCollapse: 'collapse', textAlign: 'left', fontSize: isMobile ? '12px' : '12.5px' }}>
              <thead>
                {/* Row 1: Clickable Sort Headers */}
                <tr style={{ background: 'rgba(30,41,59,0.75)', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.08)', textTransform: 'uppercase', fontSize: '11px', fontWeight: '800' }}>
                  <th onClick={() => handleSortBhavCol('symbol')} style={{ padding: '11px 14px', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    Stock / Company &amp; Sector ⇅
                  </th>
                  <th onClick={() => handleSortBhavCol('exchange')} style={{ padding: '11px 10px', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    Exchange ⇅
                  </th>
                  <th onClick={() => handleSortBhavCol('ltp')} style={{ padding: '11px 12px', textAlign: 'right', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    LTP / VWAP (₹) ⇅
                  </th>
                  <th onClick={() => handleSortBhavCol('change')} style={{ padding: '11px 12px', textAlign: 'right', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    Day Change ⇅
                  </th>
                  <th onClick={() => handleSortBhavCol('volume')} style={{ padding: '11px 12px', textAlign: 'right', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    Traded Vol ⇅
                  </th>
                  <th onClick={() => handleSortBhavCol('delivQty')} style={{ padding: '11px 12px', textAlign: 'right', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    Delivery Vol ⇅
                  </th>
                  <th onClick={() => handleSortBhavCol('delivPct')} style={{ padding: '11px 12px', textAlign: 'center', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    Delivery % ⇅
                  </th>
                  <th onClick={() => handleSortBhavCol('turnoverCr')} style={{ padding: '11px 12px', textAlign: 'right', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    Turnover (Cr) ⇅
                  </th>
                  <th onClick={() => handleSortBhavCol('surgeMult')} style={{ padding: '11px 12px', textAlign: 'center', cursor: 'pointer' }}>
                    Signals ⇅
                  </th>
                </tr>

                {/* Row 2: Per-Column Filter Inputs (LTP, Day Change, Traded Vol, Delivery Vol, Delivery %, Turnover, Signals) */}
                <tr style={{ background: 'rgba(15,23,42,0.9)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '6px 10px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <input
                      type="text"
                      placeholder="Filter stock / sector..."
                      value={bhavColFilter.colStock}
                      onChange={e => setBhavColFilter(p => ({ ...p, colStock: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '5px', color: '#fff', fontSize: '11px' }}
                    />
                  </th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <select
                      value={bhavColFilter.colExchange}
                      onChange={e => setBhavColFilter(p => ({ ...p, colExchange: e.target.value }))}
                      style={{ width: '100%', padding: '5px 6px', background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '5px', color: '#fff', fontSize: '11px' }}
                    >
                      <option value="ALL">All Exch</option>
                      <option value="NSE">NSE</option>
                      <option value="BSE">BSE</option>
                      <option value="BOTH">NSE • BSE</option>
                    </select>
                  </th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <input
                      type="text"
                      placeholder="e.g. >200 or 50-500"
                      value={bhavColFilter.colLtp}
                      onChange={e => setBhavColFilter(p => ({ ...p, colLtp: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '5px', color: '#fff', fontSize: '11px', textAlign: 'right' }}
                    />
                  </th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <input
                      type="text"
                      placeholder="e.g. >2 or <-1.5"
                      value={bhavColFilter.colChange}
                      onChange={e => setBhavColFilter(p => ({ ...p, colChange: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '5px', color: '#fff', fontSize: '11px', textAlign: 'right' }}
                    />
                  </th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <input
                      type="text"
                      placeholder="Min L (e.g. >10)"
                      value={bhavColFilter.colVolume}
                      onChange={e => setBhavColFilter(p => ({ ...p, colVolume: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '5px', color: '#fff', fontSize: '11px', textAlign: 'right' }}
                    />
                  </th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <input
                      type="text"
                      placeholder="Min L (e.g. >5)"
                      value={bhavColFilter.colDelivVol}
                      onChange={e => setBhavColFilter(p => ({ ...p, colDelivVol: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '5px', color: '#fff', fontSize: '11px', textAlign: 'right' }}
                    />
                  </th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <input
                      type="text"
                      placeholder="Min % (e.g. 75)"
                      value={bhavColFilter.colDelivPct}
                      onChange={e => setBhavColFilter(p => ({ ...p, colDelivPct: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '5px', color: '#fff', fontSize: '11px', textAlign: 'center' }}
                    />
                  </th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <input
                      type="text"
                      placeholder="Min Cr (e.g. 25)"
                      value={bhavColFilter.colTurnover}
                      onChange={e => setBhavColFilter(p => ({ ...p, colTurnover: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '5px', color: '#fff', fontSize: '11px', textAlign: 'right' }}
                    />
                  </th>
                  <th style={{ padding: '6px 8px' }}>
                    <select
                      value={bhavColFilter.colSignal}
                      onChange={e => setBhavColFilter(p => ({ ...p, colSignal: e.target.value }))}
                      style={{ width: '100%', padding: '5px 6px', background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '5px', color: '#fff', fontSize: '11px' }}
                    >
                      <option value="ALL">All Signals</option>
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
                    <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                      No stocks matched your active filter combination. Click "Reset All Filters" or clear the column filter boxes.
                    </td>
                  </tr>
                ) : (
                  bhavcopyData.map((stock, idx) => (
                    <tr key={`${stock.symbol}_${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '700', color: '#fff' }}>{stock.symbol}</span>
                          {stock.isFnO && (
                            <span style={{ fontSize: '9px', background: 'rgba(59,130,246,0.2)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.35)', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>F&amp;O</span>
                          )}
                          {stock.bseCode && (
                            <span style={{ fontSize: '10px', color: '#64748b' }}>#{stock.bseCode}</span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {stock.name && stock.name !== stock.symbol ? `${stock.name} • ` : ''}<span style={{ color: '#64748b' }}>{stock.sector}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 10px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '10px', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                          {stock.exchange === 'BOTH' ? 'NSE • BSE' : stock.exchange}
                        </span>
                      </td>
                      <td style={{ padding: '11px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '700', color: '#fff' }}>₹{stock.ltp?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        {stock.vwap > 0 && (
                          <div style={{ fontSize: '10px', color: stock.aboveVwap ? '#4ade80' : '#94a3b8' }}>
                            VWAP: ₹{Number(stock.vwap).toFixed(1)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: '700', color: stock.change >= 0 ? '#22c55e' : '#ef4444', whiteSpace: 'nowrap' }}>
                        <div>{stock.change >= 0 ? `+${stock.change}%` : `${stock.change}%`}</div>
                        {stock.dayRangePct > 0 && (
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '500' }}>H-L: {stock.dayRangePct}%</div>
                        )}
                      </td>
                      <td style={{ padding: '11px 12px', textAlign: 'right', color: '#cbd5e1', whiteSpace: 'nowrap' }}>{(stock.volume / 100000).toFixed(2)} L</td>
                      <td style={{ padding: '11px 12px', textAlign: 'right', color: '#cbd5e1', whiteSpace: 'nowrap' }}>{(stock.delivQty / 100000).toFixed(2)} L</td>
                      <td style={{ padding: '11px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: stock.delivPct >= 75 ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)', color: stock.delivPct >= 75 ? '#22c55e' : '#60a5fa', border: `1px solid ${stock.delivPct >= 75 ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.3)'}`, padding: '3px 10px', borderRadius: '12px', fontWeight: '800' }}>
                          {stock.delivPct}%
                        </div>
                      </td>
                      <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: '600', color: '#e2e8f0', whiteSpace: 'nowrap' }}>
                        ₹{Number(stock.turnoverCr || ((stock.volume * stock.ltp) / 10000000)).toFixed(2)} Cr
                      </td>
                      <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          {stock.is52wHigh && <span title="52-Week High Breakout" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' }}>🔥 52W High</span>}
                          {stock.is52wLow && <span title="52-Week Low Bounce" style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' }}>❄️ 52W Low</span>}
                          {stock.surgeMult >= 2.0 && <span title="Volume Surge 2x+" style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' }}>⚡ {stock.surgeMult}x Vol</span>}
                          {stock.aboveVwap && <span title="Price Above VWAP" style={{ background: 'rgba(6,182,212,0.12)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.3)', padding: '2px 5px', borderRadius: '6px', fontSize: '9.5px', fontWeight: '700', whiteSpace: 'nowrap' }}>&gt;VWAP</span>}
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
      {/* TAB 2: BULK, BLOCK & INSIDER DEALS MONITOR (WITH PER-COLUMN FILTERS & SORT)   */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'DEALS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Deals KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: isMobile ? '8px' : '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: isMobile ? '10px 12px' : '12px 14px' }}>
              <div style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase' }}>Total Deals (As of {latestDealBadge} EOD)</div>
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

            {/* Row 1: Deal Type Pills & Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'ALL', label: `All Deals (${(dealsStats.totalDeals || 0).toLocaleString('en-IN')})` },
                  { id: 'BULK_DEAL', label: `Bulk Deals (${(dealsStats.bulkCount || 0).toLocaleString('en-IN')})` },
                  { id: 'BLOCK_DEAL', label: `Block Deals (${(dealsStats.blockCount || 0).toLocaleString('en-IN')})` },
                  { id: 'INSIDER_PROMOTER', label: `Insider & Promoters (${(dealsStats.insiderCount || 0).toLocaleString('en-IN')})` },
                  { id: 'BUY', label: '🟢 Buys Only' },
                  { id: 'SELL', label: '🔴 Sells Only' }
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: isMobile ? '100%' : '260px', flex: '1 1 260px', maxWidth: isMobile ? '100%' : '460px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
                  <input
                    type="text"
                    placeholder={`Search ${(dealsStats.globalTotal || dealsStats.totalDeals || 3000).toLocaleString('en-IN')}+ deals (e.g. Morgan Stanley, LIC, ZOMATO, RELIANCE)...`}
                    value={dealsSearch}
                    onChange={e => setDealsSearch(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 32px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                </div>
                {activeDealsFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={resetAllDealsFilters}
                    style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Reset ({activeDealsFilterCount})
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: Institution Category Pills (FII, DII/MF, HFT, Promoter, Multi-Deal Cluster) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Institution Desk:</span>
              {[
                { id: 'ALL', label: 'All Desks' },
                { id: 'FII', label: `🌍 FII / Foreign Funds (${(dealsStats.fiiCount || 0).toLocaleString('en-IN')})` },
                { id: 'DII', label: `🇮🇳 DII / Mutual Funds & LIC (${(dealsStats.diiCount || 0).toLocaleString('en-IN')})` },
                { id: 'HFT', label: `⚡ HFT & Quant Prop (${(dealsStats.hftCount || 0).toLocaleString('en-IN')})` },
                { id: 'PROMOTER', label: `👔 Promoters (${(dealsStats.insiderCount || 0).toLocaleString('en-IN')})` },
                { id: 'MULTI_DEAL', label: '🔥 Multi-Deal Cluster Stocks' }
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setDealsClientCategory(cat.id)}
                  style={{
                    padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                    background: dealsClientCategory === cat.id ? 'rgba(59,130,246,0.22)' : 'rgba(255,255,255,0.04)',
                    color: dealsClientCategory === cat.id ? '#60a5fa' : '#94a3b8',
                    border: dealsClientCategory === cat.id ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.08)'
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Row 3: Exchange, Date Range, Size & Sort Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>

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

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Date:</span>
                {[
                  { id: 'ALL', label: 'All Dates' },
                  { id: 'TODAY', label: `Latest EOD (${latestDealBadge})` },
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

          {/* Deals Table with Per-Column Sort & Per-Column Filter Inputs */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '880px', borderCollapse: 'collapse', textAlign: 'left', fontSize: isMobile ? '12px' : '12.5px' }}>
              <thead>
                {/* Row 1: Sortable Headers */}
                <tr style={{ background: 'rgba(30,41,59,0.75)', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.08)', textTransform: 'uppercase', fontSize: '11px', fontWeight: '800' }}>
                  <th onClick={() => handleSortDealsCol('DATE')} style={{ padding: '11px 14px', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.05)' }}>Date ⇅</th>
                  <th onClick={() => handleSortDealsCol('SYMBOL')} style={{ padding: '11px 14px', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.05)' }}>Stock ⇅</th>
                  <th style={{ padding: '11px 10px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>Exch</th>
                  <th onClick={() => handleSortDealsCol('CLIENT')} style={{ padding: '11px 14px', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.05)' }}>Client / Institution / Promoter ⇅</th>
                  <th style={{ padding: '11px 10px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>Type</th>
                  <th onClick={() => handleSortDealsCol('QTY')} style={{ padding: '11px 12px', textAlign: 'right', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.05)' }}>Shares Traded ⇅</th>
                  <th onClick={() => handleSortDealsCol('PRICE')} style={{ padding: '11px 12px', textAlign: 'right', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.05)' }}>Price (₹) ⇅</th>
                  <th onClick={() => handleSortDealsCol('VALUECR')} style={{ padding: '11px 12px', textAlign: 'right', cursor: 'pointer' }}>Value (₹ Cr) ⇅</th>
                </tr>

                {/* Row 2: Per-Column Filter Inputs (Date, Stock, Exch, Client, Type, Shares Traded, Price, Value Cr) */}
                <tr style={{ background: 'rgba(15,23,42,0.9)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <input
                      type="text"
                      placeholder="YYYY-MM-DD..."
                      value={dealsColFilter.colDate}
                      onChange={e => setDealsColFilter(p => ({ ...p, colDate: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '5px', color: '#fff', fontSize: '11px' }}
                    />
                  </th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <input
                      type="text"
                      placeholder="Filter stock..."
                      value={dealsColFilter.colStock}
                      onChange={e => setDealsColFilter(p => ({ ...p, colStock: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '5px', color: '#fff', fontSize: '11px' }}
                    />
                  </th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <select
                      value={dealsColFilter.colExch}
                      onChange={e => setDealsColFilter(p => ({ ...p, colExch: e.target.value }))}
                      style={{ width: '100%', padding: '5px 5px', background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '5px', color: '#fff', fontSize: '11px' }}
                    >
                      <option value="ALL">All</option>
                      <option value="NSE">NSE</option>
                      <option value="BSE">BSE</option>
                    </select>
                  </th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <input
                      type="text"
                      placeholder="Filter client / FII / MF / Promoter..."
                      value={dealsColFilter.colClient}
                      onChange={e => setDealsColFilter(p => ({ ...p, colClient: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '5px', color: '#fff', fontSize: '11px' }}
                    />
                  </th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <select
                      value={dealsColFilter.colType}
                      onChange={e => setDealsColFilter(p => ({ ...p, colType: e.target.value }))}
                      style={{ width: '100%', padding: '5px 5px', background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '5px', color: '#fff', fontSize: '11px' }}
                    >
                      <option value="ALL">All</option>
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                      <option value="BULK_DEAL">BULK</option>
                      <option value="BLOCK_DEAL">BLOCK</option>
                      <option value="INSIDER_PROMOTER">INSIDER</option>
                    </select>
                  </th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <input
                      type="text"
                      placeholder="Min shares (e.g. >100000)"
                      value={dealsColFilter.colQty}
                      onChange={e => setDealsColFilter(p => ({ ...p, colQty: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '5px', color: '#fff', fontSize: '11px', textAlign: 'right' }}
                    />
                  </th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <input
                      type="text"
                      placeholder="e.g. >200 or 50-500"
                      value={dealsColFilter.colPrice}
                      onChange={e => setDealsColFilter(p => ({ ...p, colPrice: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '5px', color: '#fff', fontSize: '11px', textAlign: 'right' }}
                    />
                  </th>
                  <th style={{ padding: '6px 8px' }}>
                    <input
                      type="text"
                      placeholder="Min Cr (e.g. >25)"
                      value={dealsColFilter.colValue}
                      onChange={e => setDealsColFilter(p => ({ ...p, colValue: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '5px', color: '#fff', fontSize: '11px', textAlign: 'right' }}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingDeals ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <div style={{ width: '16px', height: '16px', border: '2px solid #a855f7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <span>Loading matching institutional deals...</span>
                      </div>
                    </td>
                  </tr>
                ) : dealsData.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                      No institutional deals match this search or column filter. Try clearing the column filter boxes.
                    </td>
                  </tr>
                ) : (
                  dealsData.map((deal, idx) => (
                    <tr key={deal.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 14px', color: '#94a3b8', whiteSpace: 'nowrap', fontWeight: '600' }}>{deal.date}</td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: '700', color: '#fff' }}>{deal.symbol}</span>
                          {deal.isMultiDeal && (
                            <span title="Multiple Institutional Deals in this Stock" style={{ fontSize: '9px', background: 'rgba(234,179,8,0.18)', color: '#facc15', border: '1px solid rgba(234,179,8,0.35)', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>🔥 CLUSTER</span>
                          )}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#64748b' }}>{deal.company}</div>
                      </td>
                      <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.06)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                          {deal.exchange || 'NSE'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#cbd5e1' }}>
                        <div style={{ fontWeight: '600' }}>{deal.client}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>{deal.dealType?.replace('_', ' ')}</span>
                          {deal.clientCategory && (
                            <span style={{ fontSize: '9.5px', background: 'rgba(168,85,247,0.15)', color: '#c084fc', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                              {deal.clientCategory}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{ background: deal.type === 'BUY' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: deal.type === 'BUY' ? '#22c55e' : '#ef4444', border: `1px solid ${deal.type === 'BUY' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, padding: '2px 8px', borderRadius: '6px', fontWeight: '700', fontSize: '11px' }}>
                          {deal.type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{deal.qty?.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap' }}>₹{deal.price?.toFixed(2)}</td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '700', color: '#f8fafc', whiteSpace: 'nowrap' }}>₹{deal.valueCr?.toFixed(2)} Cr</td>
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

          {/* VIEW MODE 1: 14-COLUMN LIVE SUBSCRIPTION STATUS TABLE */}
          {ipoViewMode === 'SUBSCRIPTION_TABLE' && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: '1480px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
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

                  {/* Row 2: Per-Column Search Inputs */}
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
                    <th style={{ padding: '5px 6px', borderRight: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', fontSize: '10px', color: '#64748b' }}>
                      Price / Lot
                    </th>
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

                          <td style={{ padding: '10px 8px', textAlign: 'center', color: '#cbd5e1', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ fontWeight: '600' }}>{ipo.closeDate}</div>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>Open: {ipo.openDate}</div>
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '700', color: '#f8fafc', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {Number(ipo.issueSizeCr || 0).toFixed(2)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#cbd5e1', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {formatSubVal(sub.qib)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#cbd5e1', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {formatSubVal(sub.snii)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#cbd5e1', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {formatSubVal(sub.bnii)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', color: '#e2e8f0', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {formatSubVal(sub.nii)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', color: '#e2e8f0', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {formatSubVal(sub.retail)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#94a3b8', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {formatSubVal(sub.employee)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#94a3b8', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {formatSubVal(sub.shareholder)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#94a3b8', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {formatSubVal(sub.others)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '800', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)', color: totalSub >= 50 ? '#facc15' : (totalSub >= 10 ? '#4ade80' : '#60a5fa') }}>
                            {formatSubVal(sub.total)}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '700', color: '#e2e8f0', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {ipo.applications ? ipo.applications.toLocaleString('en-IN') : '-'}
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'right', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ fontWeight: '800', color: '#22c55e' }}>+₹{ipo.gmp} ({ipo.gmpPct}%)</div>
                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                              Lot Profit: ₹{((ipo.gmp || 0) * (ipo.lotSize || 1)).toLocaleString('en-IN')}
                            </div>
                          </td>

                          <td style={{ padding: '10px 8px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            {ipo.asOn || '12-Oct-2026 17:55'}
                          </td>

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

          {/* VIEW MODE 2: GMP, EST. LOT PROFIT & ALLOTMENT CARDS VIEW */}
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

                      <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', padding: '10px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Live GMP &amp; Est. Lot Profit</div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: '#22c55e' }}>
                            +₹{ipo.gmp} ({ipo.gmpPct}%) • ₹{lotProfit.toLocaleString('en-IN')}/Lot
                          </div>
                        </div>
                        <Award size={22} color="#22c55e" />
                      </div>

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

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                        <span>📅 {ipo.openDate} → {ipo.closeDate}</span>
                        <span style={{ color: '#facc15', fontWeight: '700' }}>🎯 Retail Odds: {retailOdds}%</span>
                      </div>

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

      {/* 1-CLICK ALLOTMENT STATUS MODAL */}
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
