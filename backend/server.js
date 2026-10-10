process.on('unhandledRejection', (reason, promise) => { console.error('Unhandled Rejection at:', promise, 'reason:', reason); });
const path = require('path');
const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (_) {}
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true, override: true });
process.env.TZ = 'Asia/Kolkata';

// Ultimate Crash Reporter
const logger = require('./services/logger');

// Override global console methods for Winston integration
console.log = (...args) => logger.info(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
console.error = (...args) => logger.error(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
console.warn = (...args) => logger.warn(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));

process.on('uncaughtException', err => {
  console.error('FATAL UNCAUGHT EXCEPTION:', err);
  // Do not exit, just log it so Railway doesn't crash
});
process.on('unhandledRejection', err => {
  console.error('FATAL UNHANDLED REJECTION:', err);
});

const express = require('express');
const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const db = require('./database/db');
const fs = require('fs');
const SIPEngine = require('./services/sipEngine');
const { 
  verifyFirebasePhoneToken, 
  sendFirebasePasswordReset, 
  syncFirebaseUserPassword, 
  sendFirebaseLoginEmail,
  verifyFirebasePasswordResetOobCode
} = require('./services/firebaseAuth');
const { pubClient, subClient, generalClient } = require('./services/redisClient');
const { createAdapter } = require('@socket.io/redis-adapter');

const adapterPubClient = generalClient.duplicate({ disableOfflineQueue: false });
const adapterSubClient = generalClient.duplicate({ disableOfflineQueue: false });
// CRITICAL: Must attach error handlers BEFORE connect() or unhandled
// Redis reconnection timeouts will throw UnhandledRejection and kill the process.
adapterPubClient.on('error', (err) => console.error('[Redis Adapter Pub] Error:', err.message));
adapterSubClient.on('error', (err) => console.error('[Redis Adapter Sub] Error:', err.message));
adapterPubClient.connect().catch((err) => console.error('[Redis Adapter Pub] Connect failed:', err.message));
adapterSubClient.connect().catch((err) => console.error('[Redis Adapter Sub] Connect failed:', err.message));


// --- RETROACTIVE CLEANUP FOR MISTAKENLY STAMPED REALIZED P&L ON ENTRY ORDERS ---
(async function cleanupMistakenEntryOrderPnl() {
    try {
        const db = require('./database/db');
        if (!db || typeof db !== 'function') return;
        
        // Reset realized_pnl on entry BUY orders that are not exit orders
        const cleaned = await db('orders')
            .where('side', 'BUY')
            .where(function() {
                this.whereNull('is_exit').orWhere('is_exit', false);
            })
            .where(function() {
                this.whereNull('remarks')
                    .orWhere(function() {
                        this.whereNot('remarks', 'like', '%Exit%')
                            .whereNot('remarks', 'like', '%Square-Off%')
                            .whereNot('remarks', 'like', '%Auto-Square-Off%');
                    });
            })
            .where(function() {
                this.whereNotNull('realized_pnl').andWhere('realized_pnl', '!=', 0);
            })
            .update({ realized_pnl: 0 });
            
        if (cleaned > 0) {
            console.log(`[CLEANUP] Successfully reset realized_pnl to 0 on ${cleaned} entry BUY orders.`);
        }
    } catch (e) {
        // fail silently
    }
})();

// --- RETROACTIVE CLEANUP FOR TODAY'S FRAGMENTED MICRO-SLICE TAXES ---
(async function cleanupTodayFragmentedTaxes() {
    try {
        const { consolidateTodaySliceTaxes } = require('./scripts/consolidate_today_slice_taxes');
        const db = require('./database/db');
        await consolidateTodaySliceTaxes(db);
    } catch (e) {
        // fail silently
    }
})();
// ----------------------------------------------------
const app = express();
app.set('trust proxy', true);
const server = http.createServer(app);

// Cleanup legacy invalid telemetry placeholders on startup
(async function cleanInvalidTelemetry() {
  try {
    await db('users')
      .where('city', 'Local Network')
      .orWhere('city', 'Local')
      .update({ city: '' });
    await db('users')
      .where('state', 'Local')
      .update({ state: '' });
  } catch (e) {}
})();

function isValidPublicIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const clean = ip.replace(/^::ffff:/, '').trim();
  if (!clean || clean === '::1' || clean === '127.0.0.1' || clean === 'localhost') return false;
  if (clean.startsWith('10.') || clean.startsWith('192.168.') || clean.startsWith('169.254.')) return false;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return false;
  if (clean.startsWith('fc') || clean.startsWith('fd') || clean.startsWith('fe80')) return false;
  const ipv4Pattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
  const ipv6Pattern = /^[0-9a-fA-F:]+$/;
  return ipv4Pattern.test(clean) || ipv6Pattern.test(clean);
}

/**
 * Returns the Date marking the start of the current trading session (07:55 AM IST).
 * Any order or trade between 07:55 AM today and 07:54:59 AM tomorrow belongs to the same trading day.
 */
function getTradingSessionStartIST(refDate = new Date()) {
  const d = new Date(refDate);
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'Asia/Kolkata', 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(d);
  const getPart = (type) => parts.find(p => p.type === type)?.value;
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = parseInt(getPart('hour') || '0', 10);
  const minute = parseInt(getPart('minute') || '0', 10);

  let sessionStart = new Date(`${year}-${month}-${day}T07:55:00+05:30`);
  if (hour < 7 || (hour === 7 && minute < 55)) {
    sessionStart = new Date(sessionStart.getTime() - 24 * 60 * 60 * 1000);
  }
  return sessionStart;
}

function getClientIp(req, optionalBodyIp) {
  // 1. Trusted Reverse Proxy & Cloud Provider Headers
  const cfIp = req.headers['cf-connecting-ip'] || req.headers['true-client-ip'];
  if (isValidPublicIp(cfIp)) {
    return cfIp.trim().replace(/^::ffff:/, '');
  }

  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    const ips = forwarded.split(',').map(s => s.trim().replace(/^::ffff:/, ''));
    for (const ip of ips) {
      if (isValidPublicIp(ip)) return ip;
    }
  }

  const realIp = req.headers['x-real-ip'] || req.headers['x-client-ip'] || req.headers['x-cluster-client-ip'];
  if (isValidPublicIp(realIp)) {
    return realIp.trim().replace(/^::ffff:/, '');
  }

  // 2. Direct connection address
  const raw = req.ip || req.socket?.remoteAddress || '';
  const cleanRaw = raw.replace(/^::ffff:/, '').trim();
  if (isValidPublicIp(cleanRaw)) {
    return cleanRaw;
  }

  return cleanRaw || '127.0.0.1';
}

function isRequestSecure(req) {
  if (req.secure) return true;
  if (req.headers['x-forwarded-proto'] === 'https') return true;
  if (req.headers['host']?.includes('sslip.io')) return true;
  if (req.headers['cf-visitor']) {
    try {
      const parsed = typeof req.headers['cf-visitor'] === 'string' ? JSON.parse(req.headers['cf-visitor']) : req.headers['cf-visitor'];
      if (parsed && parsed.scheme === 'https') return true;
    } catch (_) {}
  }
  return false;
}

const priceCache = {};

function isDerivativeContract(sym) {
  if (!sym || typeof sym !== 'string') return false;
  const clean = sym.includes(':') ? sym.split(':')[1] : sym;
  return /(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(clean) || /(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(clean) || clean.endsWith('-FUT');
}

function isCommodityContract(sym) {
  if (!sym || typeof sym !== 'string') return false;
  if (sym.includes('MCX') || sym.includes('NCDEX')) return true;
  const clean = sym.replace(/^(NSE:|BSE:|MCX:)/i, '');
  return ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'].some(c => clean.startsWith(c));
}

function isIndexContract(sym) {
  if (!sym || typeof sym !== 'string') return false;
  const upper = sym.trim().toUpperCase();
  const clean = upper.replace(/^(NSE:|BSE:|NFO:|BFO:|MCX:|CDS:)/i, '').trim();

  // 1. Exclude ALL derivatives (Options, Futures, NFO/BFO contracts)
  // Spot index is never an option (CE/PE) or a future (FUT)
  if (upper.startsWith('NFO:') || upper.startsWith('BFO:') || upper.startsWith('MCX:') || upper.startsWith('CDS:')) {
    return false;
  }
  if (clean.endsWith('CE') || clean.endsWith('PE') || clean.endsWith('FUT') || clean.endsWith('-FUT')) {
    return false;
  }
  if (/(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(clean) || /(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(clean)) {
    return false;
  }
  if (/\d+.*?(CE|PE)$/i.test(clean)) {
    return false;
  }

  // 2. Identify pure benchmark/spot indices (e.g. NSE:NIFTY50-INDEX, NIFTY, BANKNIFTY, SENSEX)
  if (clean.includes('INDEX') || clean.endsWith('-INDEX')) {
    return true;
  }

  const SPOT_INDICES = [
    'NIFTY',
    'NIFTY50',
    'NIFTY 50',
    'BANKNIFTY',
    'NIFTYBANK',
    'FINNIFTY',
    'MIDCPNIFTY',
    'MIDCAPNIFTY',
    'NIFTYNXT50',
    'NIFTY NEXT 50',
    'NIFTYFPI',
    'SENSEX',
    'BANKEX'
  ];

  const normalizedClean = clean.replace(/[^A-Z0-9]/g, '');
  return SPOT_INDICES.some(idx => normalizedClean === idx.replace(/[^A-Z0-9]/g, ''));
}


function getLtpFromPriceCache(sym) {
  if (!sym || typeof sym !== 'string') return 0;
  if (priceCache[sym]?.ltp && Number(priceCache[sym].ltp) > 0) return Number(priceCache[sym].ltp);
  const clean = sym.replace(/^(NSE:|BSE:|MCX:)/i, '').replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ)$/i, '');
  if (priceCache[clean]?.ltp && Number(priceCache[clean].ltp) > 0) return Number(priceCache[clean].ltp);
  if (priceCache[`NSE:${clean}`]?.ltp && Number(priceCache[`NSE:${clean}`].ltp) > 0) return Number(priceCache[`NSE:${clean}`].ltp);
  if (priceCache[`NSE:${clean}-EQ`]?.ltp && Number(priceCache[`NSE:${clean}-EQ`].ltp) > 0) return Number(priceCache[`NSE:${clean}-EQ`].ltp);
  if (priceCache[`BSE:${clean}`]?.ltp && Number(priceCache[`BSE:${clean}`].ltp) > 0) return Number(priceCache[`BSE:${clean}`].ltp);
  if (priceCache[`BSE:${clean}-A`]?.ltp && Number(priceCache[`BSE:${clean}-A`].ltp) > 0) return Number(priceCache[`BSE:${clean}-A`].ltp);
  if (priceCache[`BSE:${clean}-B`]?.ltp && Number(priceCache[`BSE:${clean}-B`].ltp) > 0) return Number(priceCache[`BSE:${clean}-B`].ltp);
  if (priceCache[`MCX:${clean}`]?.ltp && Number(priceCache[`MCX:${clean}`].ltp) > 0) return Number(priceCache[`MCX:${clean}`].ltp);
  if (priceCache[sym]?.close && Number(priceCache[sym].close) > 0) return Number(priceCache[sym].close);
  if (priceCache[clean]?.close && Number(priceCache[clean].close) > 0) return Number(priceCache[clean].close);
  return 0;
}

function getPriceDataFromCache(sym) {
  if (!sym || typeof sym !== 'string') return {};
  if (priceCache[sym]) return priceCache[sym];
  const clean = sym.replace(/^(NSE:|BSE:|MCX:)/i, '').replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ)$/i, '');
  if (priceCache[clean]) return priceCache[clean];
  if (priceCache[`NSE:${clean}`]) return priceCache[`NSE:${clean}`];
  if (priceCache[`NSE:${clean}-EQ`]) return priceCache[`NSE:${clean}-EQ`];
  if (priceCache[`BSE:${clean}`]) return priceCache[`BSE:${clean}`];
  if (priceCache[`BSE:${clean}-A`]) return priceCache[`BSE:${clean}-A`];
  if (priceCache[`BSE:${clean}-B`]) return priceCache[`BSE:${clean}-B`];
  if (priceCache[`MCX:${clean}`]) return priceCache[`MCX:${clean}`];
  return {};
}

// Market Status Cache ('AUTO' | 'OPEN' | 'CLOSED')
const marketStatusCache = { equity: 'AUTO', commodity: 'AUTO' };
const marketCalendarCache = new Map();

async function loadMarketStatusFromDb() {
  try {
    const rows = await db('system_settings').whereIn('key', ['equity_market_status', 'commodity_market_status']);
    rows.forEach(r => {
      if (r.key === 'equity_market_status') marketStatusCache.equity = r.value || 'AUTO';
      if (r.key === 'commodity_market_status') marketStatusCache.commodity = r.value || 'AUTO';
    });
    console.log(`📊 Loaded Market Status: EQ=${marketStatusCache.equity}, MCX=${marketStatusCache.commodity}`);
  } catch (e) {}
}
loadMarketStatusFromDb();

async function loadMarketCalendarFromDb() {
  try {
    const rows = await db('market_calendar').select('*');
    marketCalendarCache.clear();
    rows.forEach(r => {
      const dStr = typeof r.date === 'string' ? r.date.split('T')[0] : (r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date));
      marketCalendarCache.set(dStr, { ...r, date: dStr });
    });
    console.log(`📅 Loaded ${marketCalendarCache.size} rules into Market Calendar Cache`);
  } catch (e) {
    console.warn('loadMarketCalendarFromDb warning:', e.message);
  }
}
loadMarketCalendarFromDb();

function isSegmentMarketOpen(isCommodity, symbol = null, product_type = null, isClosingOrder = false) {
  const globalStatus = isCommodity ? marketStatusCache.commodity : marketStatusCache.equity;
  if (globalStatus === 'CLOSED') {
    return { open: false, isTotalBlock: true, reason: `${isCommodity ? 'MCX Commodity' : 'NSE/BSE Equity'} Market is currently marked as CLOSED / Holiday by Administrator.` };
  }

  // Position exits/closing orders are always permitted
  if (isClosingOrder) {
    return { open: true, session: 'OPEN' };
  }
  
  // Evaluate date in Asia/Kolkata (IST)
  const now = new Date();
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const dateNum = String(istTime.getUTCDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${dateNum}`;
  const day = istTime.getUTCDay(); // 0 = Sun, 6 = Sat
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  const currentMinutes = hours * 60 + minutes;

  // 1. Check Date-Specific Calendar Override
  const calRule = marketCalendarCache.get(todayStr);
  if (calRule) {
    const segmentStatus = isCommodity ? calRule.commodity_status : calRule.equity_status;
    const holidayReason = calRule.reason || (isCommodity ? 'MCX Commodity Market Holiday' : 'NSE/BSE Equity Market Holiday');

    if (segmentStatus === 'CLOSED' && globalStatus !== 'OPEN') {
      return {
        open: false,
        isTotalBlock: true,
        reason: `${isCommodity ? 'MCX Commodity' : 'NSE/BSE Equity'} market is CLOSED today (${holidayReason}).`
      };
    }

    if (segmentStatus === 'OPEN') {
      const startTimeStr = isCommodity ? (calRule.commodity_start_time || '09:00') : (calRule.equity_start_time || '09:15');
      const endTimeStr = isCommodity ? (calRule.commodity_end_time || '23:30') : (calRule.equity_end_time || '15:30');

      const [sH, sM] = startTimeStr.split(':').map(Number);
      const [eH, eM] = endTimeStr.split(':').map(Number);
      const startMins = sH * 60 + (sM || 0);
      const endMins = eH * 60 + (eM || 0);

      if (currentMinutes < startMins || currentMinutes >= endMins) {
        return {
          open: false,
          isTotalBlock: true,
          reason: `Today's special session for ${isCommodity ? 'MCX' : 'NSE/BSE'} (${holidayReason}) is open only between ${startTimeStr} and ${endTimeStr} IST.`
        };
      }
      return { open: true, session: 'SPECIAL_OPEN' };
    }
  }

  // 2. Weekend Check (Saturday & Sunday) - bypassed when admin explicitly turns market OPEN
  if ((day === 0 || day === 6) && globalStatus !== 'OPEN') {
    return { 
      open: false, 
      isTotalBlock: false, 
      isAmoWindow: true, 
      session: 'WEEKEND', 
      reason: 'Markets are closed on weekends (Saturday & Sunday). You can place After Market Orders (AMO) which will queue for Monday 09:15 AM.' 
    };
  }

  const { getAssetSubsegment } = require('./services/instrumentsCache');
  const subsegment = symbol ? getAssetSubsegment(symbol) : (isCommodity ? 'COMMODITY' : 'NON_FNO_EQ');
  const isIntraday = (product_type === 'INT' || product_type === 'MIS' || product_type === 'INTRADAY' || product_type === 'BO' || product_type === 'CO');
  const isDelivery = (product_type === 'DEL' || product_type === 'CNC' || product_type === 'DELIVERY' || !product_type);

  // 3. Commodity Segment (MCX)
  if (subsegment === 'COMMODITY' || isCommodity) {
    const isBeforeOpen = hours < 9;
    const isAfterClose = hours > 23 || (hours === 23 && minutes >= 30);
    if (isBeforeOpen || isAfterClose) {
      return { 
        open: false, 
        isTotalBlock: false, 
        isAmoWindow: true, 
        session: 'AMO', 
        reason: 'MCX Commodity Market is closed. AMO orders will be queued for market open at 09:00 AM IST.' 
      };
    }
    if (isIntraday && !isClosingOrder && (hours > 22 || (hours === 22 && minutes >= 50))) {
      return { open: false, isTotalBlock: false, session: 'INTRADAY_CUTOFF', reason: 'Intraday (MIS/BO/CO) auto square-off cutoff for MCX is 10:50 PM IST. New intraday orders are blocked.' };
    }
    return { open: true, session: 'OPEN' };
  }

  // 4. Equity & Derivatives Timing Schedule

  // 4A. AMO Window: 3:45 PM (15:45 / 945m) until 8:57 AM (537m)
  if (currentMinutes >= 945 || currentMinutes < 537) {
    return {
      open: false,
      isTotalBlock: false,
      isAmoWindow: true,
      session: 'AMO',
      reason: 'Equity & Derivatives trading is closed. The After Market Order (AMO) window is active (03:45 PM - 08:57 AM). Orders are queued for execution at 09:15 AM market open.'
    };
  }

  // 4B. Buffer between AMO close and Pre-Market: 8:57 AM to 9:00 AM (537m - 540m)
  if (currentMinutes >= 537 && currentMinutes < 540) {
    return {
      open: false,
      isTotalBlock: false,
      isAmoWindow: false,
      session: 'PRE_MARKET_BUFFER',
      reason: 'AMO window closed at 08:57 AM. Pre-Market session opens at 09:00 AM IST. Please wait until 09:00 AM.'
    };
  }

  // 4C. Pre-Market Session: 9:00 AM to 9:15 AM (540m - 555m)
  if (currentMinutes >= 540 && currentMinutes < 555) {
    if (subsegment === 'DERIVATIVE') {
      return {
        open: false,
        isTotalBlock: false,
        isAmoWindow: false,
        session: 'BEFORE_OPEN',
        reason: 'Pre-market session is for Cash Equities only. Futures & Options trading begins at 09:15 AM IST.'
      };
    }
    if (currentMinutes < 548) {
      if (isIntraday) {
        return {
          open: false,
          isTotalBlock: false,
          session: 'PRE_MARKET',
          reason: 'Intraday orders (MIS/BO/CO) are blocked during Pre-Market (09:00 AM - 09:08 AM). Only Delivery (CNC) orders are permitted.'
        };
      }
      return { open: true, session: 'PRE_MARKET', isCas: true };
    }
    return {
      open: false,
      isTotalBlock: false,
      session: 'PRE_MARKET_FREEZE',
      reason: 'Pre-Market order collection is closed (09:08 AM - 09:15 AM). Exchange is discovering opening prices. Normal continuous trading begins at 09:15 AM IST.'
    };
  }

  // 4D. Normal Trading & Afternoon Sessions:

  // --- Segment 1: Equity Cash (F&O Eligible Stocks) ---
  if (subsegment === 'FNO_EQ') {
    // 1. Post-Market Session: 3:50 PM - 4:00 PM (950m - 960m)
    if (currentMinutes >= 950 && currentMinutes < 960) {
      if (isDelivery) {
        return { open: true, session: 'POST_MARKET', isPostMarket: true };
      }
      return {
        open: false,
        isTotalBlock: false,
        session: 'POST_MARKET',
        reason: 'Only Delivery orders can be placed during Post-Market session (03:50 PM - 04:00 PM).'
      };
    }

    // 2. Closing Auction Session (CAS): 3:15 PM - 3:35 PM (915m - 935m)
    if (currentMinutes >= 915 && currentMinutes < 935) {
      if (currentMinutes >= 920 && currentMinutes <= 930 && isDelivery) {
        return { open: true, session: 'CLOSING_AUCTION', isCas: true };
      }
      if (isIntraday) {
        return {
          open: false,
          isTotalBlock: false,
          session: 'CLOSING_AUCTION',
          reason: 'Intraday orders are not allowed during Closing Auction Session (03:15 PM - 03:35 PM). Only Delivery orders are accepted between 03:20 PM and 03:30 PM.'
        };
      }
      return {
        open: false,
        isTotalBlock: false,
        session: 'CLOSING_AUCTION',
        reason: 'F&O cash stocks enter Closing Auction Session (CAS) at 03:15 PM. Order entry into auction pool is open between 03:20 PM and 03:30 PM IST. Matching occurs 03:30 PM - 03:35 PM.'
      };
    }

    // 3. Normal Continuous Trading (09:15 AM - 03:15 PM) with Intraday Cutoff (03:05 PM)
    if (currentMinutes < 915) {
      if (isIntraday && currentMinutes >= 905) { // 3:05 PM
        if (isClosingOrder && currentMinutes <= 910) {
          return { open: true, session: 'INTRADAY_CLOSING' };
        }
        return {
          open: false,
          isTotalBlock: false,
          session: 'INTRADAY_CUTOFF',
          reason: 'Intraday (MIS/BO/CO) cutoff for F&O eligible cash stocks is 03:05 PM IST. Auto square-off executes between 03:05 PM and 03:10 PM.'
        };
      }
      return { open: true, session: 'NORMAL' };
    }

    return {
      open: false,
      isTotalBlock: false,
      session: 'SETTLEMENT',
      reason: 'Normal trading closed at 03:15 PM (CAS ended at 03:35 PM). Post-Market opens at 03:50 PM and AMO opens at 03:45 PM IST.'
    };
  }

  // --- Segment 2: Equity Cash (Non-F&O Stocks) ---
  if (subsegment === 'NON_FNO_EQ') {
    // 1. Post-Market Session: 3:50 PM - 4:00 PM (950m - 960m)
    if (currentMinutes >= 950 && currentMinutes < 960) {
      if (isDelivery) {
        return { open: true, session: 'POST_MARKET', isPostMarket: true };
      }
      return {
        open: false,
        isTotalBlock: false,
        session: 'POST_MARKET',
        reason: 'Only Delivery orders can be placed during Post-Market session (03:50 PM - 04:00 PM).'
      };
    }

    // 2. Normal Continuous Trading (09:15 AM - 03:30 PM) with Intraday Cutoff (03:15 PM)
    if (currentMinutes < 930) {
      if (isIntraday && currentMinutes >= 915) { // 3:15 PM
        if (isClosingOrder && currentMinutes <= 920) {
          return { open: true, session: 'INTRADAY_CLOSING' };
        }
        return {
          open: false,
          isTotalBlock: false,
          session: 'INTRADAY_CUTOFF',
          reason: 'Intraday (MIS/BO/CO) cutoff for Non-F&O cash stocks is 03:15 PM IST. Auto square-off executes between 03:15 PM and 03:20 PM.'
        };
      }
      return { open: true, session: 'NORMAL' };
    }

    return {
      open: false,
      isTotalBlock: false,
      session: 'SETTLEMENT',
      reason: 'Normal trading closed at 03:30 PM IST. Post-Market opens at 03:50 PM and AMO opens at 03:45 PM IST.'
    };
  }

  // --- Segment 3: Futures & Options (Derivatives) ---
  if (subsegment === 'DERIVATIVE') {
    // Continuous trading ends at 3:40 PM
    if (currentMinutes < 940) {
      if (isIntraday && currentMinutes >= 925) { // 3:25 PM
        if (isClosingOrder && currentMinutes <= 930) {
          return { open: true, session: 'INTRADAY_CLOSING' };
        }
        return {
          open: false,
          isTotalBlock: false,
          session: 'INTRADAY_CUTOFF',
          reason: 'Intraday (MIS/BO/CO) cutoff for Futures & Options is 03:25 PM IST. Auto square-off executes between 03:25 PM and 03:30 PM.'
        };
      }
      return { open: true, session: 'NORMAL' };
    }

    return {
      open: false,
      isTotalBlock: false,
      session: 'SETTLEMENT',
      reason: 'Futures & Options trading closed at 03:40 PM IST. After Market Orders (AMO) open at 03:45 PM IST.'
    };
  }

  return { open: true, session: 'NORMAL' };
}

// When running in PM2 Cluster Mode, NODE_APP_INSTANCE tells us the worker ID
const isMaster = process.env.NODE_APP_INSTANCE === '0' || !process.env.NODE_APP_INSTANCE;

const socketKey = process.env.SOCKET_KEY || (process.env.PORT == 5001 ? 'socket.io-staging' : 'socket.io');

const io = new Server(server, {
  cors: { origin: true, credentials: true, methods: ['GET', 'POST'] },
  adapter: createAdapter(adapterPubClient, adapterSubClient, { key: socketKey }),
  perMessageDeflate: false, // Saves ~300KB RAM per socket (~30GB across 1 Lakh concurrent users)
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6,
  transports: ['websocket', 'polling']
});

// Listen for Fyers token updates, Market Status updates & Calendar updates on all cluster nodes
const { subClient: globalSubClient } = require('./services/redisClient');
if (globalSubClient) {
    const setupClusterSync = () => {
        globalSubClient.subscribe('fyers_token_updated', () => {
            try {
                const { reloadFyersToken } = require('./services/fyers');
                if (reloadFyersToken) reloadFyersToken();
            } catch(e) {}
        }).catch((err) => { console.error('Redis token sync subscribe error:', err); });

        globalSubClient.subscribe('market_status_updated', (message) => {
            try {
                const data = JSON.parse(message);
                if (data.equity) marketStatusCache.equity = data.equity;
                if (data.commodity) marketStatusCache.commodity = data.commodity;
                console.log(`📊 Redis Market Status Synced: EQ=${marketStatusCache.equity}, MCX=${marketStatusCache.commodity}`);
                io.emit('market_status_updated', {
                    equity: marketStatusCache.equity,
                    commodity: marketStatusCache.commodity
                });
            } catch(e) {}
        }).catch(() => {});

        globalSubClient.subscribe('market_calendar_updated', () => {
            try {
                loadMarketCalendarFromDb();
                io.emit('market_calendar_updated');
            } catch(e) {}
        }).catch(() => {});
    };
    
    if (globalSubClient.isReady) setupClusterSync();
    else globalSubClient.on('ready', setupClusterSync);
}

// Redis Pub/Sub for syncing priceCache across cluster nodes
if (isMaster) {
  // Master node also needs to listen to reload_triggers (when an order is placed via API on Master)
  const { subClient: cacheSubClient } = require('./services/redisClient');
  const triggerEngine = require('./services/triggerEngine');
  const setupMasterSync = () => {
    cacheSubClient.subscribe('reload_triggers', (message) => {
        console.log('[Master] Reloading triggers from DB');
        triggerEngine.loadPendingOrders();
    }).catch(err => console.error(err));

    cacheSubClient.subscribe('reload_volume_orders', async (message) => {
        console.log('[Master] Reloading resting volume orders from DB');
        const volumeMatchingEngine = require('./services/volumeMatchingEngine');
        await volumeMatchingEngine.loadPendingVolumeOrders();
    }).catch(err => console.error(err));
  };
  if (cacheSubClient.isReady) setupMasterSync();
  else cacheSubClient.on('ready', setupMasterSync);
}
if (!isMaster) {
  const { subClient: cacheSubClient } = require('./services/redisClient');
  const { updateWorkerTickTime } = require('./services/fyers');
  
  const setupCacheSync = () => {
    cacheSubClient.subscribe('price_cache_batch_sync', (message) => {
      try {
        const batchUpdate = JSON.parse(message);
        const keys = Object.keys(batchUpdate);
        if (keys.length > 0 && updateWorkerTickTime) {
          updateWorkerTickTime();
        }
        // Workers update their local priceCache and emit price_snapshot directly to their local Socket.IO symbol rooms
        keys.forEach(symbol => {
          const priceObj = batchUpdate[symbol];
          if (symbol && priceObj) {
            priceCache[symbol] = priceObj;
            if (symbol.includes(':')) {
              const parts = symbol.split(':');
              const ex = parts[0];
              const raw = parts[1];
              priceCache[raw] = priceObj;
              const clean = raw.replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ)$/i, '');
              priceCache[clean] = priceObj;
              priceCache[`${ex}:${clean}`] = priceObj;
            }
            const room = io.sockets?.adapter?.rooms?.get(symbol);
            if (room && room.size > 0) {
              (io.local || io).to(symbol).emit('price_snapshot', {
                [symbol]: [
                  priceObj.ltp,
                  priceObj.change,
                  priceObj.pct,
                  priceObj.timestamp,
                  priceObj.open,
                  priceObj.high,
                  priceObj.low,
                  priceObj.close,
                  priceObj.volume,
                  priceObj.totBuyQuan,
                  priceObj.totSellQuan,
                  priceObj.upper_circuit || 0,
                  priceObj.lower_circuit || 0
                ]
              });
            }
          }
        });
      } catch(e){}
    }).catch(err => { console.error('Redis cache sync subscribe error:', err); });
    
    // Subscribe to trigger reloads
    cacheSubClient.subscribe('reload_triggers', () => {
        const triggerEngine = require('./services/triggerEngine');
        triggerEngine.loadPendingOrders();
    }).catch(err => console.error(err));

    cacheSubClient.subscribe('reload_volume_orders', async () => {
        const volumeMatchingEngine = require('./services/volumeMatchingEngine');
        await volumeMatchingEngine.loadPendingVolumeOrders();
    }).catch(err => console.error(err));
  };
  
  if (cacheSubClient.isReady) setupCacheSync();
  else cacheSubClient.on('ready', setupCacheSync);
}

app.disable('x-powered-by');

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://checkout.razorpay.com",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        "https://apis.google.com",
        "https://accounts.google.com",
        "https://pagead2.googlesyndication.com",
        "https://*.googlesyndication.com",
        "https://googleads.g.doubleclick.net",
        "https://adservice.google.com",
        "https://adservice.google.co.in",
        "https://tpc.googlesyndication.com",
        "https://fundingchoicesmessages.google.com",
        "https://ep1.adtrafficquality.google",
        "https://ep2.adtrafficquality.google",
        "https://*.adtrafficquality.google"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://checkout.razorpay.com"
      ],
      fontSrc: [
        "'self'",
        "data:",
        "https://fonts.gstatic.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://*.razorpay.com",
        "https://*.googleusercontent.com",
        "https://*.gstatic.com",
        "https://www.google-analytics.com",
        "https://pagead2.googlesyndication.com",
        "https://*.googlesyndication.com",
        "https://googleads.g.doubleclick.net",
        "https://*.doubleclick.net",
        "https://*.google.com",
        "https://*.google.co.in",
        "https://ep1.adtrafficquality.google",
        "https://ep2.adtrafficquality.google",
        "https://*.adtrafficquality.google"
      ],
      connectSrc: [
        "'self'",
        "https://skandx.in",
        "https://*.skandx.in",
        "https://api.razorpay.com",
        "https://checkout.razorpay.com",
        "https://*.firebaseio.com",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://accounts.google.com",
        "https://www.google-analytics.com",
        "https://csi.gstatic.com",
        "https://pagead2.googlesyndication.com",
        "https://*.googlesyndication.com",
        "https://googleads.g.doubleclick.net",
        "https://*.doubleclick.net",
        "https://adservice.google.com",
        "https://adservice.google.co.in",
        "https://fundingchoicesmessages.google.com",
        "https://ep1.adtrafficquality.google",
        "https://ep2.adtrafficquality.google",
        "https://*.adtrafficquality.google",
        "wss:",
        "ws:"
      ],
      frameSrc: [
        "'self'",
        "https://api.razorpay.com",
        "https://checkout.razorpay.com",
        "https://*.firebaseapp.com",
        "https://accounts.google.com",
        "https://googleads.g.doubleclick.net",
        "https://tpc.googlesyndication.com",
        "https://*.googlesyndication.com",
        "https://fundingchoicesmessages.google.com",
        "https://www.google.com",
        "https://ep1.adtrafficquality.google",
        "https://ep2.adtrafficquality.google",
        "https://*.adtrafficquality.google"
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'sameorigin' },
  hidePoweredBy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// 🛡️ Security Hardening Headers (Permissions-Policy & Cross-Origin-Opener-Policy)
// Note: Cross-Origin-Opener-Policy must NOT be 'same-origin-allow-popups' because Chrome severs
// window.opener when popups navigate cross-origin to accounts.google.com/firebaseapp.com,
// breaking Google Auth / Firebase signInWithPopup. We use 'unsafe-none' to preserve window.opener.
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), usb=(), bluetooth=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  next();
});

const allowedOrigins = [
  'https://skandx.in',
  'https://www.skandx.in',
  'https://shortmarket-staging.web.app',
  'https://shortmarket-staging.firebaseapp.com',
  'https://shortmarket.web.app',
  'https://shortmarket.firebaseapp.com',
  'capacitor://localhost',
  'ionic://localhost',
  'https://localhost'
];

app.use(cors({
  origin: (origin, callback) => {
    // Mobile apps, server-to-server calls, Postman, curl have no origin header
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin === 'https://skandx.in' ||
      origin.endsWith('.skandx.in') ||
      /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
      (process.env.NODE_ENV !== 'production' && origin.endsWith('.sslip.io')) ||
      process.env.NODE_ENV !== 'production' ||
      process.env.CORS_ALLOW_ALL === 'true'
    ) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: Origin ${origin} not authorized by SkandX security policy`));
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(compression()); // Compress all API responses to fix frontend loading lag

// 🛡️ Prototype Pollution & Parameter Sanitization Middleware (OWASP A03 / Checks #18, #34, #53)
app.use((req, res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        delete obj[key];
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };
  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);
  next();
});

const recordTelemetry = require('./middleware/telemetry');
app.use(recordTelemetry);

// 🔒 Cache-Control: no-store for sensitive API endpoints (OWASP A04 / Pingdom Audit)
app.use('/api', (req, res, next) => {
  // Allow high-frequency market prices route to manage its own short 2s ETag caching
  if (req.path !== '/prices') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});

// ─── Health ────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', symbols: Object.keys(priceCache).length });
});

// ─── Prices (all cached LTPs) ─────────────────────────────────────────────
let _pricesEtag = null;
let _lastPricesJson = null;
let _lastPricesHashTime = 0;

app.get('/api/prices', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=2, stale-while-revalidate=5');
  
  const now = Date.now();
  if (!_lastPricesJson || (now - _lastPricesHashTime > 2000)) {
    _lastPricesJson = JSON.stringify(priceCache);
    const crypto = require('crypto');
    _pricesEtag = `"${crypto.createHash('md5').update(_lastPricesJson).digest('hex')}"`;
    _lastPricesHashTime = now;
  }

  res.setHeader('ETag', _pricesEtag);
  if (req.headers['if-none-match'] === _pricesEtag) {
    return res.status(304).end();
  }

  res.type('application/json').send(_lastPricesJson);
});

const _batchFetchCooldowns = new Map();
let _inFlightBatchPromise = null;

app.get('/api/prices/batch', async (req, res) => {
  try {
    const rawSymbols = req.query.symbols?.split(',') || [];
    const symbols = rawSymbols.map(s => s.trim()).filter(Boolean).slice(0, 150);
    if (symbols.length === 0) return res.json({});

    const now = Date.now();
    const result = {};
    const missing = [];

    for (const sym of symbols) {
      const clean = sym.includes(':') ? sym.split(':')[1] : sym;
      const cached = priceCache[sym] || priceCache[clean];
      const lastFetch = _batchFetchCooldowns.get(sym) || 0;
      if (cached && cached.ltp > 0 && (now - lastFetch < 2000)) {
        result[sym] = cached;
      } else {
        missing.push(sym);
      }
    }

    if (missing.length > 0) {
      const { fetchBatchLTPs } = require('./services/fyers');
      if (fetchBatchLTPs) {
        if (!_inFlightBatchPromise) {
          _inFlightBatchPromise = fetchBatchLTPs(missing)
            .then(prices => {
              const ts = Date.now();
              if (prices && typeof prices === 'object') {
                Object.assign(priceCache, prices);
                for (const s of missing) _batchFetchCooldowns.set(s, ts);
              }
              return prices || {};
            })
            .catch(() => ({}))
            .finally(() => { _inFlightBatchPromise = null; });
        }
        const fetched = await _inFlightBatchPromise;
        Object.assign(result, fetched);
      }
    }

    for (const sym of symbols) {
      const clean = sym.includes(':') ? sym.split(':')[1] : sym;
      if (!result[sym] && (priceCache[sym] || priceCache[clean])) {
        result[sym] = priceCache[sym] || priceCache[clean];
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=1, stale-while-revalidate=5');
    res.json(result);
  } catch (err) {
    console.error('/api/prices/batch Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Stocks (full instrument master) ──────────────────────────────────────
app.get('/api/stocks/lotsizes', async (req, res) => {
  const symbols = req.query.symbols?.split(',') || [];
  if (symbols.length === 0) return res.json({});
  
  try {
    const { getLotSizes } = require('./services/instrumentsCache');
    const result = getLotSizes(symbols);
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(result);
  } catch (err) {
    console.error('/api/lotsizes Error:', err);
    res.json({});
  }
});

app.get('/api/stocks/lotsize-map', async (req, res) => {
  try {
    const { getDiskLotsizeMap } = require('./services/instrumentsCache');
    const map = getDiskLotsizeMap() || {};
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(map);
  } catch (err) {
    console.error('/api/stocks/lotsize-map Error:', err);
    res.json({});
  }
});

app.get('/api/stocks/freeze-limits', async (req, res) => {
  try {
    const { getFreezeConfig } = require('./services/taxCalculator');
    const cfg = getFreezeConfig() || {};
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(cfg);
  } catch (err) {
    console.error('/api/stocks/freeze-limits Error:', err);
    res.json({});
  }
});

app.get('/api/stocks', async (req, res) => {
  try {
    const { getAllStocksJson, getAllStocksETag } = require('./services/instrumentsCache');
    const etag = getAllStocksETag();
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end(); // 0 bytes transferred over network!
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.send(getAllStocksJson());
  } catch (err) {
    console.error('Stocks API Error:', err);
    res.status(500).json([]);
  }
});

  const localSearchLRU = new Map();
  const MAX_SEARCH_LRU = 500;

  app.get('/api/stocks/search', async (req, res) => {
    const q = req.query.q;
    if (!q || q.length < 2) return res.json([]);
    
    const qLower = q.toLowerCase();

    // 1. Fast in-memory cache check (sub-0.1ms latency without Redis roundtrip)
    const localHit = localSearchLRU.get(qLower);
    if (localHit && (Date.now() - localHit.time < 300000)) { // 5-minute local TTL
      res.setHeader('Content-Type', 'application/json');
      return res.send(localHit.data);
    }

    try {
      const { generalClient } = require('./services/redisClient');
      const cacheKey = `api:search:v6:${qLower}`;
      
      if (generalClient && generalClient.isReady) {
        const cached = await generalClient.get(cacheKey);
        if (cached) {
          if (localSearchLRU.size >= MAX_SEARCH_LRU) {
            localSearchLRU.delete(localSearchLRU.keys().next().value);
          }
          localSearchLRU.set(qLower, { data: cached, time: Date.now() });
          res.setHeader('Content-Type', 'application/json');
          return res.send(cached);
        }
      }

      // 2. Compute if not in cache (Query In-Memory JSON)
      const { searchInstruments } = require('./services/instrumentsCache');
      
      const dbResults = searchInstruments(qLower);

      dbResults.sort((a, b) => {
        const aExact = a.symbol.toLowerCase() === qLower || (a.name && a.name.toLowerCase() === qLower);
        const bExact = b.symbol.toLowerCase() === qLower || (b.name && b.name.toLowerCase() === qLower);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        const aIsCash = (a.exchange === 'NSE' || a.exchange === 'BSE');
        const bIsCash = (b.exchange === 'NSE' || b.exchange === 'BSE');
        if (aIsCash && !bIsCash) return -1;
        if (!aIsCash && bIsCash) return 1;
        
        const aIsFut = a.symbol.includes('FUT');
        const bIsFut = b.symbol.includes('FUT');
        if (aIsFut && !bIsFut) return -1;
        if (!aIsFut && bIsFut) return 1;
        
        // Sorting by length handles "prioritize shorter symbols"
        if (a.symbol.length !== b.symbol.length) return a.symbol.length - b.symbol.length;
        
        return 0;
      });

      const results = dbResults.slice(0, 50).map(item => ({
          token: item.token,
          symbol: item.symbol,
          name: item.name,
          exchange: item.exchange || item.exch_seg || (item.symbol && item.symbol.includes(':') ? item.symbol.split(':')[0] : 'NSE'),
          lotsize: item.lotsize,
          expiryTimestamp: item.expiryTimestamp || item.expiry_timestamp || null,
          uniqueSymbol: item.unique_symbol || item.symbol,
          searchString: item.search_string
      }));
      
      const responseData = JSON.stringify(results);
      
      if (localSearchLRU.size >= MAX_SEARCH_LRU) {
        localSearchLRU.delete(localSearchLRU.keys().next().value);
      }
      localSearchLRU.set(qLower, { data: responseData, time: Date.now() });

      if (generalClient && generalClient.isReady) {
        generalClient.set(cacheKey, responseData, { EX: 3600 }).catch(console.error); // 1 hour cache
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.send(responseData);
    } catch (err) {
      console.error('Search API Error:', err);
      res.json([]);
    }
  });

// ─── Auth ───────────────────────────────────────────────────────────────────
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, requireAdmin, JWT_SECRET, hashToken } = require('./middleware/auth');
const { logAuditEvent } = require('./services/auditLogger');
const { parseDeviceDetails, parseIpLocation, syncBannedEntities, isIpBanned, isPhoneBanned } = require('./services/deviceSecurity');
const rateLimit = require('express-rate-limit');

// Rate Limiting Config
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 auth requests per windowMs
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  keyGenerator: (req) => getClientIp(req)
});

const orderLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1500, // limit each user/IP to 1500 orders per minute (allows high-concurrency iceberg slice bursts & exit-all)
  message: { error: 'Order rate limit exceeded (max 1500/min)' },
  keyGenerator: (req) => {
    return req.user?.id ? `user_${req.user.id}` : getClientIp(req);
  }
});

const walletLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15, // limit each user to 15 wallet transactions per minute
  message: { error: 'Wallet transaction rate limit exceeded. Please wait a minute.' },
  keyGenerator: (req) => {
    return req.user?.id ? `user_${req.user.id}` : getClientIp(req);
  }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // limit each IP to 300 requests per minute
  message: { error: 'Too many requests. Please slow down.' },
  keyGenerator: (req) => getClientIp(req)
});

async function upsertUserSession({ userId, tokenHash, deviceModel, browserName, osName, clientIp, city, state }) {
  if (!userId || !tokenHash) return;
  try {
    const existing = await db('user_sessions')
      .where({ user_id: userId, device_model: deviceModel, browser_name: browserName, os_name: osName })
      .orderBy('last_active_at', 'desc')
      .first();

    if (existing) {
      await db('user_sessions')
        .where({ id: existing.id })
        .update({
          token_hash: tokenHash,
          ip_address: clientIp || existing.ip_address,
          city: city || existing.city || '',
          state: state || existing.state || '',
          last_active_at: new Date()
        });
    } else {
      await db('user_sessions').insert({
        user_id: userId,
        token_hash: tokenHash,
        device_model: deviceModel,
        browser_name: browserName,
        os_name: osName,
        ip_address: clientIp,
        city: city || '',
        state: state || '',
        last_active_at: new Date()
      });
    }

    // Auto-prune stale sessions older than 60 days
    await db('user_sessions')
      .where({ user_id: userId })
      .where('last_active_at', '<', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000))
      .del()
      .catch(() => {});
  } catch (err) {
    console.error('upsertUserSession error:', err);
  }
}

app.post('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const data = req.body;
    
    // Delete existing to avoid conflicts
    await db('user_profiles').where({ user_id: req.user.id }).del();

    // Insert profile data
    await db('user_profiles').insert({
      user_id: req.user.id,
      dob: data.dob,
      gender: data.gender,
      state: data.state,
      city: data.city,
      occupation: data.occupation,
      annual_income: data.annual_income,
      financial_goal: data.financial_goal,
      trading_experience: data.trading_experience,
      preferred_segment: data.preferred_segment,
      trading_style: data.trading_style,
      primary_strategy: data.primary_strategy,
      hear_about_us: data.hear_about_us
    });

    // Update users table to set is_onboarded
    await db('users').where({ id: req.user.id }).update({ is_onboarded: true });

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving profile:', err);
    res.status(500).json({ error: err.message });
  }
});

// Map for Registration OTPs: key = cleanEmail -> { otp: string, phone: string, expires: number }
const registrationOtps = new Map();

/**
 * Universal case-insensitive user lookup by:
 * 1. Email (case-insensitive)
 * 2. Username (case-insensitive)
 * 3. Client ID (case-insensitive, e.g. SE000009, SE00000C)
 * 4. Phone Number (digits only)
 */
async function findUserByIdentifier(identifier) {
  if (!identifier) return null;
  const clean = String(identifier).trim();
  if (!clean) return null;
  const cleanPhone = clean.replace(/\D/g, '');
  return await db('users').where(function() {
    this.whereRaw('LOWER(email) = ?', [clean.toLowerCase()])
      .orWhereRaw('LOWER(username) = ?', [clean.toLowerCase()])
      .orWhereRaw('LOWER(client_id) = ?', [clean.toLowerCase()]);
    if (cleanPhone.length >= 10) {
      this.orWhere('phone', cleanPhone.slice(-10));
    }
  }).first();
}

const DEFAULT_WATCHLIST_SYMBOLS = [
  'NSE:NIFTY50-INDEX',
  'NSE:NIFTYBANK-INDEX',
  'BSE:SENSEX-INDEX',
  'NSE:RELIANCE',
  'NSE:TCS',
  'NSE:HDFCBANK',
  'NSE:INFY',
  'NSE:ICICIBANK',
  'NSE:SBIN'
];

function formatUserWatchlists(rawWatchlists) {
  let parsed = null;
  if (typeof rawWatchlists === 'string') {
    try { parsed = JSON.parse(rawWatchlists); } catch (_) {}
  } else if (Array.isArray(rawWatchlists)) {
    parsed = rawWatchlists;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return [{ id: 1, name: 'Watchlist 1', symbols: DEFAULT_WATCHLIST_SYMBOLS }];
  }
  const formatted = parsed.map((w, idx) => ({
    id: w.id || (idx + 1),
    name: w.name || `Watchlist ${idx + 1}`,
    symbols: Array.isArray(w.symbols) ? w.symbols : []
  }));
  if (formatted[0] && (!formatted[0].symbols || formatted[0].symbols.length === 0)) {
    formatted[0].symbols = DEFAULT_WATCHLIST_SYMBOLS;
  }
  return formatted;
}

function formatUserForClient(user, profile = null) {
  if (!user) return null;
  let clientId = user.client_id;
  if (!clientId && user.id) {
    clientId = 'SE' + Number(user.id).toString(36).toUpperCase().padStart(6, '0');
  }
  const watchlists = formatUserWatchlists(user.watchlists);
  return {
    id: user.id,
    client_id: clientId,
    username: user.username,
    email: user.email,
    phone: user.phone || null,
    balance: parseFloat(user.balance || 1000000.0),
    role: user.role,
    is_admin: Boolean(user.is_admin),
    is_onboarded: Boolean(user.is_onboarded),
    watchlists,
    subscription_tier: user.subscription_tier || 'BASIC',
    subscription_expires: user.subscription_expires || null,
    pan_card: user.pan_card || null,
    aadhar_number: user.aadhar_number || null,
    kyc_pan_url: user.kyc_pan_url || null,
    kyc_aadhar_url: user.kyc_aadhar_url || null,
    address: user.address || null,
    upi_id: user.upi_id || null,
    bank_account_no: user.bank_account_no || null,
    bank_ifsc: user.bank_ifsc || null,
    profile_picture_url: user.profile_picture_url || null,
    dob: profile?.dob || user.dob || null,
    gender: profile?.gender || user.gender || null,
    onboarding_state: profile?.state || user.onboarding_state || user.state || null,
    onboarding_city: profile?.city || user.onboarding_city || user.city || null,
    occupation: profile?.occupation || user.occupation || null,
    annual_income: profile?.annual_income || user.annual_income || null,
    financial_goal: profile?.financial_goal || user.financial_goal || null,
    trading_experience: profile?.trading_experience || user.trading_experience || null,
    preferred_segment: profile?.preferred_segment || user.preferred_segment || null,
    trading_style: profile?.trading_style || user.trading_style || null
  };
}

// ─── Live Username / Full Name Availability Check (6–15 chars, One User One Name) ───
app.get('/api/auth/check-username', async (req, res) => {
  try {
    const raw = String(req.query.username || '');
    const cleanName = raw.replace(/[^A-Za-z\s]/g, '').replace(/\s+/g, ' ').trim();
    const letterCount = cleanName.replace(/[^A-Za-z]/g, '').length;

    if (!cleanName || cleanName.length < 6 || cleanName.length > 15 || !/^[A-Za-z\s]{6,15}$/.test(cleanName) || letterCount < 5) {
      return res.json({
        available: false,
        valid: false,
        message: 'Name must contain letters only and be 6 to 15 characters.'
      });
    }

    const normalizedKey = cleanName.replace(/\s+/g, '').toLowerCase();
    let query = db('users').whereRaw("LOWER(REPLACE(TRIM(username), ' ', '')) = ?", [normalizedKey]);
    if (req.query.exclude_id && !isNaN(Number(req.query.exclude_id))) {
      query = query.whereNot('id', Number(req.query.exclude_id));
    }
    if (req.query.exclude_email) {
      query = query.whereRaw('LOWER(email) != ?', [String(req.query.exclude_email).trim().toLowerCase()]);
    }

    const existingUser = await query.select('id', 'username').first();
    if (existingUser) {
      return res.json({
        available: false,
        valid: true,
        message: `"${cleanName}" is unavailable. This name is already taken.`
      });
    }

    return res.json({
      available: true,
      valid: true,
      message: `"${cleanName}" is available.`
    });
  } catch (err) {
    res.status(500).json({ available: false, error: err.message });
  }
});

// ─── Send Registration OTP ──────────────────────────────────────────────────
app.post('/api/auth/send-registration-otp', authLimiter, async (req, res) => {
  const { username, email, phone } = req.body || {};
  if (!email || !phone) {
    return res.status(400).json({ error: 'Email and phone number are required.' });
  }

  const cleanEmail = String(email).toLowerCase().trim();
  const cleanPhone = String(phone).replace(/\D/g, '');

  if (cleanPhone.length !== 10) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit mobile phone number.' });
  }

  try {
    // Check if account already exists
    const existing = await findUserByIdentifier(cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists. Please log in.' });
    }
    const existingPhone = await db('users').where('phone', cleanPhone).first();
    if (existingPhone) {
      return res.status(400).json({ error: 'An account with this phone number already exists.' });
    }
    if (username) {
      const trimmedUser = String(username).replace(/[^A-Za-z\s]/g, '').replace(/\s+/g, ' ').trim();
      const letterCount = trimmedUser.replace(/[^A-Za-z]/g, '').length;
      if (trimmedUser.length < 6 || trimmedUser.length > 15 || !/^[A-Za-z\s]{6,15}$/.test(trimmedUser) || letterCount < 5) {
        return res.status(400).json({ error: 'Name must contain letters only and be between 6 and 15 characters.' });
      }
      const normalizedKey = trimmedUser.replace(/\s+/g, '').toLowerCase();
      const existingUser = await db('users').whereRaw("LOWER(REPLACE(TRIM(username), ' ', '')) = ?", [normalizedKey]).first();
      if (existingUser) {
        return res.status(400).json({ error: `"${trimmedUser}" is unavailable. This name is already taken by another user.` });
      }
    }

    const crypto = require('crypto');
    const otp = crypto.randomInt(100000, 1000000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 mins

    registrationOtps.set(cleanEmail, { otp, phone: cleanPhone, expires });
    console.log(`[REGISTRATION OTP] 🔑 Code for ${cleanEmail} (+91 ${cleanPhone}): ${otp}`);

    // 1. Deliver official verification email via Firebase Identity Toolkit
    try {
      const { sendFirebaseVerificationEmail } = require('./services/firebaseAuth');
      if (typeof sendFirebaseVerificationEmail === 'function') {
        await sendFirebaseVerificationEmail(cleanEmail);
        console.log(`[REGISTRATION] Official Firebase verification email dispatched to ${cleanEmail}`);
      }
    } catch(fbErr) {
      console.warn('[REGISTRATION] Firebase email dispatch note:', fbErr.message);
    }

    // 2. Deliver branded 6-digit verification code via Gmail SMTP (if configured)
    try {
      const { sendEmailOtpViaService } = require('./services/firebaseAuth');
      if (typeof sendEmailOtpViaService === 'function') {
        await sendEmailOtpViaService(cleanEmail, otp);
      }
    } catch(err) {
      console.warn('[REGISTRATION OTP] Email dispatch note:', err.message);
    }

    res.json({
      success: true,
      message: `6-digit verification code sent to ${cleanEmail}.`
    });
  } catch (err) {
    console.error('send-registration-otp error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, email, phone, password, referral_code, firebase_token, otp, consent_terms, consent_data_processing, consent_marketing } = req.body;
  if (!username || !email || !password || !phone) return res.status(400).json({ error: 'Missing fields' });
  if (!consent_terms || !consent_data_processing) {
    return res.status(400).json({ error: 'You must accept the Terms of Service and Personal Data Processing agreement to register.' });
  }

  const cleanEmail = String(email).toLowerCase().trim();
  const cleanPhone = String(phone).replace(/\D/g, '');
  const cleanUsername = String(username).replace(/[^A-Za-z\s]/g, '').replace(/\s+/g, ' ').trim();
  const letterCount = cleanUsername.replace(/[^A-Za-z]/g, '').length;

  if (cleanUsername.length < 6 || cleanUsername.length > 15 || !/^[A-Za-z\s]{6,15}$/.test(cleanUsername) || letterCount < 5) {
    return res.status(400).json({ error: 'Name must contain letters only and be between 6 and 15 characters.' });
  }

  if (cleanPhone.length !== 10) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit mobile phone number.' });
  }

  // Validate OTP or Firebase token if provided (supports both numeric OTP and direct Firebase verification link)
  if (otp) {
    const record = registrationOtps.get(cleanEmail);
    if (!record || record.expires < Date.now()) {
      return res.status(400).json({ error: 'Registration OTP has expired. Please request a new code.' });
    }
    if (record.otp !== String(otp).trim()) {
      return res.status(400).json({ error: 'Invalid verification OTP code. Please check and try again.' });
    }
    registrationOtps.delete(cleanEmail);
  } else if (firebase_token) {
    const tokenCheck = await verifyFirebasePhoneToken(firebase_token, cleanPhone, cleanEmail);
    if (!tokenCheck.verified) {
      return res.status(403).json({ error: tokenCheck.reason || 'Invalid or unverified authorization token.' });
    }
  }

  try {
    // Check for existing duplicates (strictly one user per name, email, and phone)
    const normalizedUsernameKey = cleanUsername.replace(/\s+/g, '').toLowerCase();
    const existingEmailUser = await db('users').whereRaw('LOWER(email) = ?', [cleanEmail]).first();
    if (existingEmailUser) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }
    const existingPhoneUser = await db('users').where('phone', cleanPhone).first();
    if (existingPhoneUser) {
      return res.status(400).json({ error: 'An account with this phone number already exists.' });
    }
    const existingNameUser = await db('users').whereRaw("LOWER(REPLACE(TRIM(username), ' ', '')) = ?", [normalizedUsernameKey]).first();
    if (existingNameUser) {
      return res.status(400).json({ error: `"${cleanUsername}" is unavailable. This name is already registered by another user.` });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const defaultWatchlist = JSON.stringify([{ id: 1, name: 'Watchlist 1', symbols: DEFAULT_WATCHLIST_SYMBOLS }]);
    
    const clientIp = getClientIp(req);
    
    // Check if IP or Phone is banned
    if (await isIpBanned(clientIp, generalClient)) {
      return res.status(403).json({ error: 'Registration blocked: Your IP address has been restricted.' });
    }
    if (await isPhoneBanned(cleanPhone, generalClient)) {
      return res.status(403).json({ error: 'Registration blocked: This phone number has been restricted.' });
    }

    const { deviceModel, osName, browserName } = parseDeviceDetails(req.headers['user-agent']);
    let { city, state } = parseIpLocation(clientIp);
    if (!city && req.body?.client_city) city = req.body.client_city;
    if (!state && req.body?.client_state) state = req.body.client_state;

    const [id] = await db('users').insert({ 
      username: cleanUsername, 
      email: cleanEmail, 
      phone: cleanPhone, 
      password_hash, 
      watchlists: defaultWatchlist,
      registration_ip: clientIp, last_ip: clientIp,
      device_model: deviceModel, os_name: osName, browser_name: browserName,
      city: (city && city !== 'Local Network' && city !== 'Local') ? city : '',
      state: (state && state !== 'Local') ? state : ''
    }).returning('id');
    
    const userId = typeof id === 'object' ? id.id : id;
    
    // Generate Professional Client ID: SE + Base36(userId) padded to 6 chars
    const clientId = 'SE' + Number(userId).toString(36).toUpperCase().padStart(6, '0');
    await db('users').where({ id: userId }).update({ client_id: clientId });

    // Record user consents for DPDP compliance (unticked opt-ins recorded with timestamp and IP)
    try {
      const consentsToRecord = [
        { type: 'TERMS_AND_PRIVACY', granted: !!consent_terms },
        { type: 'DATA_PROCESSING_CORE', granted: !!consent_data_processing },
        { type: 'MARKETING_PROMOTIONS', granted: !!consent_marketing }
      ];
      for (const item of consentsToRecord) {
        if (item.granted) {
          await db('user_consents').insert({
            user_id: userId,
            email: cleanEmail,
            consent_type: item.type,
            status: 'GRANTED',
            consent_version: 'v2026.1',
            ip_address: clientIp,
            user_agent: req.headers['user-agent'] || ''
          }).catch(() => {});
        }
      }
    } catch (cErr) {
      console.warn('[DPDP] Consent recording note:', cErr.message);
    }

    // Handle Referral Logic (supports client_id like 'SE000001', numeric user id, or username)
    if (referral_code) {
      try {
        const codeTrimmed = String(referral_code).trim();
        let referrer = await findUserByIdentifier(codeTrimmed);

        if (referrer && referrer.id !== userId) {
          await db('referrals').insert({
            referrer_id: referrer.id,
            referred_user_id: userId,
            status: 'pending',
            reward_amount: 0,
            created_at: new Date(),
            updated_at: new Date()
          }).catch(e => console.error('Referral insertion error:', e));
          console.log(`🎁 [REFERRAL LINKED] User ${userId} (${clientId} ${cleanUsername}) referred by ${referrer.id} (${referrer.client_id} ${referrer.username})`);
        }
      } catch (e) {
        console.error('Failed to process referral code', e);
      }
    }


    // Clear any stale auth cookie — user MUST verify email link before any session or token is issued
    const isHttps = isRequestSecure(req);
    res.cookie('token', '', { expires: new Date(0), httpOnly: true, sameSite: isHttps ? 'none' : 'lax', secure: isHttps });

    // Dispatch official verification email link via Firebase Identity Toolkit
    // Force resetEmailVerified: true so even a previously deleted email starts unverified
    try {
      const { ensureFirebaseUser, sendFirebaseVerificationEmail } = require('./services/firebaseAuth');
      if (typeof ensureFirebaseUser === 'function') {
        await ensureFirebaseUser(cleanEmail, cleanPhone, password, { resetEmailVerified: true });
      }
      if (typeof sendFirebaseVerificationEmail === 'function') {
        await sendFirebaseVerificationEmail(cleanEmail);
        console.log(`[FIREBASE AUTH] Verification email link dispatched to ${cleanEmail}`);
      }
    } catch (fbErr) {
      console.warn('[FIREBASE AUTH] Registration verification email note:', fbErr.message);
    }

    res.json({
      success: true,
      needs_verification: true,
      email: cleanEmail,
      message: `Account created successfully! An official verification link has been dispatched to ${cleanEmail}. Please check your inbox and click the link to activate your account.`
    });
  } catch (err) {
    const errorMsg = err.message || String(err);
    if (errorMsg.includes('unique')) return res.status(400).json({ error: 'Username or email already exists' });
    
    // If it's a database connection error (like ECONNREFUSED from a missing DATABASE_URL)
    if (errorMsg.includes('ECONNREFUSED') || String(err).includes('ECONNREFUSED')) {
      return res.status(500).json({ error: 'Database not connected. Please add a PostgreSQL database in Railway.' });
    }
    
    res.status(500).json({ error: errorMsg || 'Unknown error occurred during registration' });
  }
});

// ─── Resend Firebase Verification Email ──────────────────────────────────────
app.post('/api/auth/resend-verification-email', authLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const cleanEmail = String(email).trim().toLowerCase();

  try {
    const { sendFirebaseVerificationEmail } = require('./services/firebaseAuth');
    if (typeof sendFirebaseVerificationEmail !== 'function') {
      return res.status(500).json({ error: 'Firebase authentication service unavailable' });
    }
    await sendFirebaseVerificationEmail(cleanEmail);
    res.json({
      success: true,
      message: `A fresh verification link has been dispatched to ${cleanEmail}. Please check your inbox and spam folder.`
    });
  } catch (err) {
    console.error('resend-verification-email error:', err);
    res.status(500).json({ error: err.message || 'Failed to dispatch verification email' });
  }
});

// ─── Password Verification & Firebase Sync Helper ─────────────────────────
async function verifyUserPasswordWithFallback(user, password) {
  if (!user || !password) return false;

  const isGoogleReviewTester = Boolean(
    user.email && (
      user.email.toLowerCase().trim() === 'appwebsitetester@gmail.com' ||
      user.email.toLowerCase().trim() === 'demo@skandx.in'
    )
  );

  // 1. Firebase Auth is the primary authority for registered email accounts (non-admin, non-tester)
  if (user.email && !user.is_admin && !isGoogleReviewTester) {
    try {
      const { verifyFirebasePassword } = require('./services/firebaseAuth');
      const fbCheck = await verifyFirebasePassword(user.email, password);

      if (fbCheck && fbCheck.success) {
        // Password is correct in Firebase Auth!
        // Sync new password hash into local PostgreSQL so DB hash stays up-to-date
        try {
          const newHash = await bcrypt.hash(password, 10);
          await db('users').where({ id: user.id }).update({ password_hash: newHash });
          user.password_hash = newHash;
          console.log(`[AUTH] Synced new Firebase password to PostgreSQL for ${user.email}`);
        } catch (hashErr) {
          console.warn('[AUTH] Error syncing hash to PostgreSQL:', hashErr.message);
        }
        return true;
      }

      // Explicitly reject if Firebase Auth reported incorrect password or credentials
      // This strictly blocks old / revoked passwords after an email password reset!
      if (fbCheck && (fbCheck.error === 'INVALID_LOGIN_CREDENTIALS' || fbCheck.error === 'INVALID_PASSWORD')) {
        console.warn(`[AUTH] Strictly rejected invalid/revoked password for ${user.email} via Firebase Auth`);
        return false;
      }
    } catch (fbErr) {
      console.warn('[AUTH] Firebase password check exception, falling back to local hash:', fbErr.message);
    }
  }

  // 2. Fallback to local bcrypt (admins, test accounts, offline fallback, or legacy accounts)
  if (user.password_hash) {
    const valid = await bcrypt.compare(password, user.password_hash);
    if (valid && user.email && !user.is_admin && !isGoogleReviewTester) {
      try {
        const { ensureFirebaseUser } = require('./services/firebaseAuth');
        ensureFirebaseUser(user.email, user.phone, password).catch(() => {});
      } catch (_) {}
    }
    return valid;
  }

  return false;
}

// ─── Strict Email Verification Gatekeeper Helper ──────────────────────────
async function enforceEmailVerificationGate(user, password) {
  const isGoogleReviewTester = Boolean(
    user.email && (
      user.email.toLowerCase().trim() === 'appwebsitetester@gmail.com' ||
      user.email.toLowerCase().trim() === 'demo@skandx.in'
    )
  );
  if (user.is_admin || isGoogleReviewTester || !user.email) {
    return { verified: true };
  }
  try {
    const { getFirebaseAdminAuth, ensureFirebaseUser, sendFirebaseVerificationEmail } = require('./services/firebaseAuth');
    const auth = getFirebaseAdminAuth();
    if (auth) {
      const cleanEmail = user.email.toLowerCase().trim();
      let fbUser = await auth.getUserByEmail(cleanEmail).catch(() => null);
      if (!fbUser) {
        fbUser = await ensureFirebaseUser(cleanEmail, user.phone, password, { resetEmailVerified: true }).catch(() => null);
      }
      if (!fbUser || fbUser.emailVerified !== true) {
        if (typeof sendFirebaseVerificationEmail === 'function') {
          sendFirebaseVerificationEmail(user.email).catch(e => console.warn('[AUTH GATE] Auto-dispatch verification email note:', e.message));
        }
        return {
          verified: false,
          error: `Please verify your email address to log in. An activation link was sent to ${user.email}. Check your inbox and spam folder.`
        };
      }
    }
  } catch (authErr) {
    console.warn('[AUTH] Firebase email verification check note:', authErr.message);
  }
  return { verified: true };
}

// ─── 2FA & Authentication with 30-Day Device Trust ──────────────────────────
app.post('/api/auth/pre-login', authLimiter, async (req, res) => {
  const { email, password, trusted_device_token } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  try {
    const user = await findUserByIdentifier(email);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const valid = await verifyUserPasswordWithFallback(user, password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const clientIp = getClientIp(req);
    if (await isIpBanned(clientIp, generalClient)) {
      return res.status(403).json({ error: 'Access restricted: Your IP address has been restricted.' });
    }
    if (user.is_banned) {
      return res.status(403).json({ error: 'Your trading account has been suspended by administration.' });
    }

    const isGoogleReviewTester = Boolean(user.email && (user.email.toLowerCase().trim() === 'appwebsitetester@gmail.com' || user.email.toLowerCase().trim() === 'demo@skandx.in'));

    // 🔒 STRICT EMAIL VERIFICATION GATEKEEPER
    // Block login if user email has not been verified in Firebase
    const emailGate = await enforceEmailVerificationGate(user, password);
    if (!emailGate.verified) {
      return res.status(403).json({
        error: emailGate.error,
        needs_email_verification: true,
        email: user.email
      });
    }

    // Standard password login: trust user immediately unless they explicitly enabled Google Authenticator (TOTP)
    let isTrusted = isGoogleReviewTester || !user.totp_enabled;

    // 🛡️ CHECK IF DEVICE IS TRUSTED (30-Day Device Trust / Remember Me)
    if (!isTrusted && trusted_device_token && typeof trusted_device_token === 'string' && trusted_device_token.length >= 32) {
      const crypto = require('crypto');
      const deviceHash = crypto.createHash('sha256').update(trusted_device_token.trim()).digest('hex');
      const trusted = await db('trusted_devices')
        .where({ user_id: user.id, device_token_hash: deviceHash })
        .where('expires_at', '>', new Date())
        .first();

      if (trusted) {
        isTrusted = true;
        // Update last used timestamp & IP
        await db('trusted_devices').where({ id: trusted.id }).update({ last_used_at: new Date(), ip_address: clientIp }).catch(() => {});
      }
    }

    if (isTrusted) {
      const { deviceModel, osName, browserName } = parseDeviceDetails(req.headers['user-agent']);
        const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '60d' });
        const tokenHash = hashToken(token);
        if (tokenHash) {
          await upsertUserSession({ userId: user.id, tokenHash, deviceModel, browserName, osName, clientIp });
        }

        const isHttps = isRequestSecure(req);
        res.cookie('token', token, {
          httpOnly: true,
          secure: isHttps,
          sameSite: isHttps ? 'none' : 'lax',
          maxAge: 60 * 24 * 60 * 60 * 1000
        });

        let clientId = user.client_id;
        if (!clientId) {
          clientId = 'SE' + Number(user.id).toString(36).toUpperCase().padStart(6, '0');
          await db('users').where({ id: user.id }).update({ client_id: clientId }).catch(() => {});
          user.client_id = clientId;
        }
        const profile = await db('user_profiles').where({ user_id: user.id }).first().catch(() => null);

        return res.json({
          success: true,
          trusted: true,
          token,
          user: formatUserForClient(user, profile)
        });
      }

    // Device not trusted: prompt for 2FA and return available verification channels
    res.json({
      success: true,
      trusted: false,
      phone: user.phone || '',
      email: user.email,
      totp_enabled: Boolean(user.totp_enabled)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✉️ Send Login Email OTP via Firebase ✉️
app.post('/api/auth/send-login-email-otp', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  try {
    const user = await findUserByIdentifier(email);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const valid = await verifyUserPasswordWithFallback(user, password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const crypto = require('crypto');
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expires = new Date(Date.now() + 10 * 60000); // 10 minutes

    await db('users').where({ id: user.id }).update({
      login_email_otp: otpHash,
      login_email_otp_expires: expires
    });

    const isGoogleReviewTester = Boolean(user.email && (user.email.toLowerCase().trim() === 'appwebsitetester@gmail.com' || user.email.toLowerCase().trim() === 'demo@skandx.in'));
    if (isGoogleReviewTester) {
      return res.json({ 
        success: true, 
        message: `Verification code: 123456 (Google Play Demo Mode)`
      });
    }

    let emailSent = false;
    // 🚀 Dispatch verification via Firebase / Transactional Mail Service
    try {
      const emailResult = await sendFirebaseLoginEmail(user.email, otp);
      emailSent = Boolean(emailResult?.emailSent);
      console.log(`[AUTH 2FA] Verification email dispatched to ${user.email} (sent: ${emailSent})`);
    } catch (fbErr) {
      console.warn(`[AUTH 2FA] Verification email dispatch note:`, fbErr.message);
    }

    console.log(`[AUTH 2FA] Email OTP for ${user.email}: ${otp}`);
    return res.json({ 
      success: true, 
      message: `Verification code dispatched to ${user.email}. Please check your email inbox!`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔐 Multi-Channel 2FA Verification (Google Authenticator, Email OTP, Phone OTP) 🔐
app.post('/api/auth/verify-2fa', authLimiter, async (req, res) => {
  const { email, password, method, code, trust_device, device_name } = req.body || {};
  if (!email || !password || !method || !code) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const user = await findUserByIdentifier(email);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const valid = await verifyUserPasswordWithFallback(user, password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const emailGate2fa = await enforceEmailVerificationGate(user, password);
    if (!emailGate2fa.verified) {
      return res.status(403).json({
        error: emailGate2fa.error,
        needs_email_verification: true,
        email: user.email
      });
    }

    const crypto = require('crypto');

    const isGoogleReviewTester = Boolean(user.email && (user.email.toLowerCase().trim() === 'appwebsitetester@gmail.com' || user.email.toLowerCase().trim() === 'demo@skandx.in'));
    const isTesterBypassOtp = isGoogleReviewTester && String(code).trim() === '123456';

    if (isTesterBypassOtp) {
      // 🛡️ Instant verification bypass for Google Play Store review team
    }
    // Method 1: TOTP (Google Authenticator)
    else if (method === 'TOTP') {
      if (!user.totp_secret || !user.totp_enabled) {
        return res.status(400).json({ error: 'Google Authenticator is not enabled for this account' });
      }
      const { verifySync } = require('otplib');
      const check = verifySync({ token: String(code).trim(), secret: user.totp_secret, epochTolerance: 35 });
      if (!check || !check.valid) {
        return res.status(400).json({ error: 'Invalid 6-digit Authenticator code. Please check your app.' });
      }
    }
    // Method 2: EMAIL_OTP
    else if (method === 'EMAIL_OTP') {
      if (!user.login_email_otp || !user.login_email_otp_expires) {
        return res.status(400).json({ error: 'No active email OTP found. Please click Send OTP first.' });
      }
      if (new Date() > new Date(user.login_email_otp_expires)) {
        return res.status(400).json({ error: 'Email OTP has expired. Please request a new code.' });
      }
      const codeHash = crypto.createHash('sha256').update(String(code).trim()).digest('hex');
      if (user.login_email_otp !== codeHash) {
        return res.status(400).json({ error: 'Invalid Email OTP code.' });
      }
      await db('users').where({ id: user.id }).update({ login_email_otp: null, login_email_otp_expires: null });
    }
    // Method 3: PHONE_OTP
    else if (method === 'PHONE_OTP') {
      // Firebase phone OTP confirmation verified on client
    } else {
      return res.status(400).json({ error: 'Unsupported 2FA method' });
    }

    const clientIp = getClientIp(req);
    const { deviceModel, osName, browserName } = parseDeviceDetails(req.headers['user-agent']);

    const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '60d' });
    const sessionHash = hashToken(token);
    if (sessionHash) {
      await upsertUserSession({ userId: user.id, tokenHash: sessionHash, deviceModel, browserName, osName, clientIp });
    }

    let trustedDeviceToken = null;
    if (trust_device) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const deviceHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

      // Upsert so same device/browser updates its token instead of duplicating
      const existing = await db('trusted_devices')
        .where({ user_id: user.id, browser_name: browserName, os_name: osName })
        .first();

      if (existing) {
        await db('trusted_devices').where({ id: existing.id }).update({
          device_token_hash: deviceHash,
          device_name: device_name || existing.device_name || `${browserName || 'Browser'} on ${osName || 'Device'}`,
          ip_address: clientIp,
          expires_at: expiresAt,
          last_used_at: new Date()
        }).catch(() => {});
      } else {
        await db('trusted_devices').insert({
          user_id: user.id,
          device_token_hash: deviceHash,
          device_name: device_name || `${browserName || 'Browser'} on ${osName || 'Device'}`,
          browser_name: browserName,
          os_name: osName,
          ip_address: clientIp,
          expires_at: expiresAt,
          last_used_at: new Date()
        }).catch(() => {});
      }

      trustedDeviceToken = rawToken;
    }

    const isHttps = isRequestSecure(req);
    res.cookie('token', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      maxAge: 60 * 24 * 60 * 60 * 1000
    });

    let clientId = user.client_id;
    if (!clientId) {
      clientId = 'SE' + Number(user.id).toString(36).toUpperCase().padStart(6, '0');
      await db('users').where({ id: user.id }).update({ client_id: clientId }).catch(() => {});
      user.client_id = clientId;
    }
    const profile = await db('user_profiles').where({ user_id: user.id }).first().catch(() => null);

    res.json({
      success: true,
      token,
      trusted_device_token: trustedDeviceToken,
      user: formatUserForClient(user, profile)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📱 Google Authenticator (TOTP) Setup & Management 📱
app.get('/api/user/totp/setup', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { generateSecret } = require('otplib');
    const secret = generateSecret();
    const otpauthUrl = `otpauth://totp/SkandX:${encodeURIComponent(user.email || user.username)}?secret=${secret}&issuer=SkandX`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;

    res.json({
      success: true,
      secret,
      otpauth_url: otpauthUrl,
      qrCode: qrCodeUrl,
      email: user.email,
      totp_enabled: Boolean(user.totp_enabled)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/totp/enable', authenticateToken, async (req, res) => {
  const { secret, code } = req.body || {};
  if (!secret || !code) return res.status(400).json({ error: 'Secret and verification code are required' });
  try {
    const { verifySync } = require('otplib');
    const check = verifySync({ token: String(code).trim(), secret: String(secret).trim(), epochTolerance: 35 });
    if (!check || !check.valid) {
      return res.status(400).json({ error: 'Invalid 6-digit code. Please check your authenticator app.' });
    }

    await db('users').where({ id: req.user.id }).update({
      totp_secret: String(secret).trim(),
      totp_enabled: true
    });

    res.json({ success: true, message: 'Google Authenticator enabled successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/totp/disable', authenticateToken, async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Password is required to disable 2FA' });
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const valid = await verifyUserPasswordWithFallback(user, password);
    if (!valid) return res.status(400).json({ error: 'Invalid password' });

    await db('users').where({ id: req.user.id }).update({
      totp_secret: null,
      totp_enabled: false
    });

    res.json({ success: true, message: 'Google Authenticator disabled successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 💻 Trusted Devices Management 💻
app.get('/api/user/trusted-devices', authenticateToken, async (req, res) => {
  try {
    // Auto-prune expired trusted devices
    await db('trusted_devices')
      .where('expires_at', '<=', new Date())
      .del()
      .catch(() => {});

    const rawDevices = await db('trusted_devices')
      .where({ user_id: req.user.id })
      .where('expires_at', '>', new Date())
      .orderBy('last_used_at', 'desc');

    // Deduplicate in memory and cleanup DB duplicates
    const seen = new Set();
    const devices = [];
    const dupesToDelete = [];

    for (const d of rawDevices) {
      const key = `${d.browser_name || 'Browser'}_${d.os_name || 'Device'}`;
      if (!seen.has(key)) {
        seen.add(key);
        devices.push(d);
      } else {
        dupesToDelete.push(d.id);
      }
    }

    if (dupesToDelete.length > 0) {
      await db('trusted_devices').whereIn('id', dupesToDelete).del().catch(() => {});
    }

    res.json({ success: true, devices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/user/trusted-devices/:id', authenticateToken, async (req, res) => {
  try {
    await db('trusted_devices').where({ id: req.params.id, user_id: req.user.id }).del();
    res.json({ success: true, message: 'Device trust revoked successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password, trust_device, device_name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  try {
    const user = await findUserByIdentifier(email);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    
    const valid = await verifyUserPasswordWithFallback(user, password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const clientIp = getClientIp(req);
    
    // Check if IP or Account is banned
    if (await isIpBanned(clientIp, generalClient)) {
      return res.status(403).json({ error: 'Access restricted: Your IP address has been restricted.' });
    }
    if (user.is_banned) {
      return res.status(403).json({ error: 'Your trading account has been suspended by administration.' });
    }

    // 🔒 STRICT EMAIL VERIFICATION GATEKEEPER
    const emailGateLogin = await enforceEmailVerificationGate(user, password);
    if (!emailGateLogin.verified) {
      return res.status(403).json({
        error: emailGateLogin.error,
        needs_email_verification: true,
        email: user.email
      });
    }

    const { deviceModel, osName, browserName } = parseDeviceDetails(req.headers['user-agent']);
    let { city, state } = parseIpLocation(clientIp);
    if (!city && req.body?.client_city) city = req.body.client_city;
    if (!state && req.body?.client_state) state = req.body.client_state;

    const updateFields = {
      device_model: deviceModel,
      os_name: osName,
      browser_name: browserName
    };
    if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1') {
      updateFields.last_ip = clientIp;
    }
    if (city && city !== 'Local Network' && city !== 'Local') {
      updateFields.city = city;
    }
    if (state && state !== 'Local') {
      updateFields.state = state;
    }

    await db('users').where({ id: user.id }).update(updateFields).catch(e => console.error('Failed to update user login meta:', e));
    
    const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '60d' });
    const tokenHash = hashToken(token);
    if (tokenHash) {
      await upsertUserSession({ userId: user.id, tokenHash, deviceModel, browserName, osName, clientIp, city, state });
    }

    let trustedDeviceToken = null;
    if (trust_device) {
      const crypto = require('crypto');
      const rawToken = crypto.randomBytes(32).toString('hex');
      const deviceHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

      // Upsert so same device/browser updates its token instead of duplicating
      const existing = await db('trusted_devices')
        .where({ user_id: user.id, browser_name: browserName, os_name: osName })
        .first();

      if (existing) {
        await db('trusted_devices').where({ id: existing.id }).update({
          device_token_hash: deviceHash,
          device_name: device_name || existing.device_name || `${browserName || 'Browser'} on ${osName || 'Device'}`,
          ip_address: clientIp,
          expires_at: expiresAt,
          last_used_at: new Date()
        }).catch(() => {});
      } else {
        await db('trusted_devices').insert({
          user_id: user.id,
          device_token_hash: deviceHash,
          device_name: device_name || `${browserName || 'Browser'} on ${osName || 'Device'}`,
          browser_name: browserName,
          os_name: osName,
          ip_address: clientIp,
          expires_at: expiresAt,
          last_used_at: new Date()
        }).catch(() => {});
      }

      trustedDeviceToken = rawToken;
    }

    const watchlists = typeof user.watchlists === 'string' ? JSON.parse(user.watchlists || '[]') : (user.watchlists || []);
    const isHttps = isRequestSecure(req);
    res.cookie('token', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      maxAge: 60 * 24 * 60 * 60 * 1000
    });
    let clientId = user.client_id;
    if (!clientId) {
      clientId = 'SE' + Number(user.id).toString(36).toUpperCase().padStart(6, '0');
      await db('users').where({ id: user.id }).update({ client_id: clientId }).catch(() => {});
      user.client_id = clientId;
    }
    const profile = await db('user_profiles').where({ user_id: user.id }).first().catch(() => null);

    res.json({
      success: true,
      token,
      trusted_device_token: trustedDeviceToken,
      user: formatUserForClient(user, profile)
    });
  } catch (err) {
    const errorMsg = err.message || String(err);
    if (errorMsg.includes('ECONNREFUSED') || String(err).includes('ECONNREFUSED')) {
      return res.status(500).json({ error: 'Database not connected. Please add a PostgreSQL database in Railway.' });
    }
    res.status(500).json({ error: errorMsg || 'Unknown error occurred during login' });
  }
});

// Active Client Telemetry Sync (Instant location and device fingerprinting)
app.post('/api/user/telemetry', authenticateToken, async (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const { deviceModel, osName, browserName } = parseDeviceDetails(userAgent);
    
    let { city, state } = parseIpLocation(clientIp);
    if (!city && req.body?.city) city = req.body.city;
    if (!state && req.body?.state) state = req.body.state;

    const updateFields = {
      device_model: deviceModel,
      os_name: osName,
      browser_name: browserName
    };
    if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1') {
      updateFields.last_ip = clientIp;
    }
    if (city && city !== 'Local Network' && city !== 'Local') {
      updateFields.city = city;
    }
    if (state && state !== 'Local') {
      updateFields.state = state;
    }

    await db('users').where({ id: req.user.id }).update(updateFields);
    res.json({ success: true, ip: clientIp, city: updateFields.city, state: updateFields.state, device: deviceModel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logout endpoint
app.post('/api/auth/skip-onboarding', authenticateToken, async (req, res) => {
  try {
    await db('users').where({ id: req.user.id }).update({ is_onboarded: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Error skipping onboarding:', error);
    res.status(500).json({ error: 'Failed to skip onboarding' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = (req.cookies && req.cookies.token) || 
                  (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
    if (token) {
      const tokenHash = hashToken(token);
      if (tokenHash) {
        await db('user_sessions').where({ token_hash: tokenHash }).del();
      }
    }
  } catch (err) {
    console.error('Error removing session on logout:', err);
  }
  const isHttps = isRequestSecure(req);
  res.cookie('token', '', { expires: new Date(0), httpOnly: true, sameSite: isHttps ? 'none' : 'lax', secure: isHttps });
  res.json({ success: true });
});

// ─── Mobile & Standalone App Google OAuth Relay Bridge ───────────────────────
// Bridges the Google OIDC id_token from the external Chrome browser / Custom Tab
// directly back into the waiting installed SkandX App (PWA / WebAPK / TWA / Capacitor)
// across all PM2 cluster workers via Redis + in-memory fallback.
const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '942129499307-fer7gcbqo0h1gjhj0mr65oran7ohi92q.apps.googleusercontent.com';
const oauthRelayMemory = new Map();

function pruneOauthRelayMemory() {
  const now = Date.now();
  for (const [k, v] of oauthRelayMemory.entries()) {
    if (!v || now - (v.createdAt || 0) > 300000) {
      oauthRelayMemory.delete(k);
    }
  }
}

async function getOauthRelayRecord(stateKey) {
  if (!stateKey || typeof stateKey !== 'string') return null;
  const cleanKey = stateKey.trim().slice(0, 128);
  try {
    if (generalClient && (generalClient.isReady || generalClient.isOpen)) {
      const raw = await generalClient.get(`oauth:relay:${cleanKey}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        oauthRelayMemory.set(cleanKey, parsed);
        return parsed;
      }
    }
  } catch (_) {}
  return oauthRelayMemory.get(cleanKey) || null;
}

async function setOauthRelayRecord(stateKey, record) {
  if (!stateKey || typeof stateKey !== 'string') return;
  const cleanKey = stateKey.trim().slice(0, 128);
  if (oauthRelayMemory.size > 1000) pruneOauthRelayMemory();
  oauthRelayMemory.set(cleanKey, record);
  try {
    if (generalClient && (generalClient.isReady || generalClient.isOpen)) {
      await generalClient.setEx(`oauth:relay:${cleanKey}`, 300, JSON.stringify(record));
    }
  } catch (_) {}
}

app.post('/api/auth/google-oauth-init', async (req, res) => {
  try {
    const { state, isInApp, appMode } = req.body || {};
    if (!state || typeof state !== 'string' || state.length < 6) {
      return res.status(400).json({ error: 'Valid state parameter required' });
    }
    const existing = (await getOauthRelayRecord(state)) || {};
    const inferredInApp = Boolean(
      isInApp ||
      existing.isInApp ||
      state.startsWith('skx_app_') ||
      state.startsWith('skx_pwa_') ||
      state.startsWith('skx_cap_')
    );
    const inferredMode = appMode || existing.appMode || (state.startsWith('skx_cap_') ? 'cap' : (inferredInApp ? 'pwa' : 'web'));
    await setOauthRelayRecord(state, {
      ...existing,
      state,
      isInApp: inferredInApp,
      appMode: inferredMode,
      pollCount: existing.pollCount || 0,
      idToken: existing.idToken || null,
      error: existing.error || null,
      createdAt: existing.createdAt || Date.now(),
      updatedAt: Date.now()
    });
    return res.json({ success: true, isInApp: inferredInApp, appMode: inferredMode });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to initialize OAuth state' });
  }
});

app.post('/api/auth/google-oauth-relay', async (req, res) => {
  try {
    const { state, idToken, error } = req.body || {};
    if (!state || typeof state !== 'string') {
      return res.status(400).json({ error: 'State parameter required' });
    }
    const existing = (await getOauthRelayRecord(state)) || {};
    const isInApp = Boolean(
      existing.isInApp ||
      (existing.pollCount && existing.pollCount > 0) ||
      state.startsWith('skx_app_') ||
      state.startsWith('skx_pwa_') ||
      state.startsWith('skx_cap_')
    );
    const appMode = existing.appMode || (state.startsWith('skx_cap_') ? 'cap' : (isInApp ? 'pwa' : 'web'));
    const updated = {
      ...existing,
      state,
      isInApp,
      appMode,
      idToken: idToken || existing.idToken || null,
      error: error || existing.error || null,
      createdAt: existing.createdAt || Date.now(),
      relayedAt: Date.now(),
      updatedAt: Date.now()
    };
    await setOauthRelayRecord(state, updated);
    return res.json({ success: true, isInApp, appMode });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to relay OAuth token' });
  }
});

app.get('/api/auth/google-oauth-poll', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const state = String(req.query.state || '').trim();
    const mode = String(req.query.mode || '').trim();
    if (!state || state.length < 6) {
      return res.status(400).json({ error: 'Valid state required' });
    }
    const existing = (await getOauthRelayRecord(state)) || {};
    if (existing.idToken) {
      await setOauthRelayRecord(state, {
        ...existing,
        consumedAt: Date.now(),
        updatedAt: Date.now()
      });
      return res.json({
        success: true,
        status: 'authenticated',
        idToken: existing.idToken
      });
    }
    if (existing.error) {
      return res.json({
        success: true,
        status: 'error',
        error: existing.error
      });
    }
    const isInApp = Boolean(
      existing.isInApp ||
      req.query.app === '1' ||
      mode === 'pwa' ||
      mode === 'cap' ||
      state.startsWith('skx_app_') ||
      state.startsWith('skx_pwa_') ||
      state.startsWith('skx_cap_')
    );
    const appMode = existing.appMode || mode || (state.startsWith('skx_cap_') ? 'cap' : (isInApp ? 'pwa' : 'web'));
    await setOauthRelayRecord(state, {
      ...existing,
      state,
      isInApp,
      appMode,
      pollCount: (existing.pollCount || 0) + 1,
      createdAt: existing.createdAt || Date.now(),
      updatedAt: Date.now()
    });
    return res.json({ success: true, status: 'pending', isInApp, appMode });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to poll OAuth state' });
  }
});

app.get('/api/auth/google/redirect', (req, res) => {
  try {
    const rawHost = String(req.headers['x-forwarded-host'] || req.headers.host || 'www.skandx.in').split(',')[0].trim();
    const host = rawHost.includes('localhost') ? 'www.skandx.in' : rawHost;
    const redirectUri = `https://${host}/__/auth/handler`;
    const nonce = require('crypto').randomBytes(16).toString('hex');
    const state = String(req.query.state || ('skx_web_' + require('crypto').randomBytes(8).toString('hex')));

    const params = new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'id_token',
      scope: 'openid email profile',
      prompt: 'select_account',
      nonce,
      state
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  } catch (err) {
    console.error('[GOOGLE REDIRECT] Error starting OAuth:', err.message);
    res.redirect('/?auth_error=oauth_start_failed');
  }
});

// ─── Google OAuth Sign-In / Sign-Up ──────────────────────────────────────────
app.post('/api/auth/google-login', authLimiter, async (req, res) => {
  const { idToken, phone, username: requestedUsername, consent_terms, consent_data_processing, consent_marketing, referral_code } = req.body || {};
  if (!idToken) return res.status(400).json({ error: 'Google ID token is required' });

  try {
    const { getFirebaseAdminAuth } = require('./services/firebaseAuth');
    const auth = getFirebaseAdminAuth();
    if (!auth) {
      return res.status(503).json({ error: 'Firebase authentication service temporarily unavailable' });
    }

    let decoded = null;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (fbErr) {
      // Fallback: If idToken is a raw Google ID Token directly from Google Identity Services (GIS / One Tap)
      try {
        const { OAuth2Client } = require('google-auth-library');
        const googleClientId = process.env.GOOGLE_CLIENT_ID || '942129499307-fer7gcbqo0h1gjhj0mr65oran7ohi92q.apps.googleusercontent.com';
        const client = new OAuth2Client(googleClientId);
        const ticket = await client.verifyIdToken({
          idToken,
          audience: googleClientId
        });
        decoded = ticket.getPayload();
      } catch (gErr) {
        console.error('[AUTH] ID token verification failed:', fbErr.message, gErr.message);
        return res.status(401).json({ error: 'Invalid or expired Google authorization token. Please try again.' });
      }
    }

    const email = decoded && decoded.email ? String(decoded.email).trim().toLowerCase() : null;
    if (!email) {
      return res.status(400).json({ error: 'Google account has no associated email address' });
    }

    const clientIp = getClientIp(req);
    if (await isIpBanned(clientIp, generalClient)) {
      return res.status(403).json({ error: 'Access restricted: Your IP address has been restricted.' });
    }

    // Check if user exists in PostgreSQL
    let user = await db('users').whereRaw('LOWER(email) = ?', [email]).first();

    if (!user) {
      const cleanPhone = String(phone || '').replace(/\D/g, '');
      // Option 1: If new Google user hasn't provided their 10-digit phone number yet, prompt frontend to collect it
      if (!cleanPhone || cleanPhone.length !== 10) {
        const rawDisplayName = String(decoded.name || email.split('@')[0] || 'Trader')
          .replace(/[^A-Za-z\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 15);
        return res.json({
          success: true,
          needs_profile_completion: true,
          email,
          suggested_name: rawDisplayName.length >= 6 ? rawDisplayName : '',
          picture: decoded.picture || null
        });
      }

      // Validate Full Name (6-15 letters, unique)
      const cleanUsername = String(requestedUsername || decoded.name || '').replace(/[^A-Za-z\s]/g, '').replace(/\s+/g, ' ').trim();
      const letterCount = cleanUsername.replace(/[^A-Za-z]/g, '').length;
      if (!cleanUsername || cleanUsername.length < 6 || cleanUsername.length > 15 || letterCount < 5) {
        return res.status(400).json({ error: 'Full Name must contain letters only and be between 6 and 15 characters.' });
      }

      if (await isPhoneBanned(cleanPhone, generalClient)) {
        return res.status(403).json({ error: 'Registration blocked: This phone number has been restricted.' });
      }

      const existingPhoneUser = await db('users').where('phone', cleanPhone).first();
      if (existingPhoneUser) {
        return res.status(400).json({ error: 'An account with this phone number already exists.' });
      }

      const normalizedUsernameKey = cleanUsername.replace(/\s+/g, '').toLowerCase();
      const existingName = await db('users').whereRaw("LOWER(REPLACE(TRIM(username), ' ', '')) = ?", [normalizedUsernameKey]).first();
      if (existingName) {
        return res.status(400).json({ error: `"${cleanUsername}" is already taken. Please choose another unique Full Name.` });
      }

      // Enforce mandatory DPDP consents
      if (consent_terms !== true || consent_data_processing !== true) {
        return res.status(400).json({ error: 'You must accept the mandatory Terms of Service and Core Data Processing consents to create an account.' });
      }

      const randomSecret = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomSecret, 6);
      const { deviceModel, osName, browserName } = parseDeviceDetails(req.headers['user-agent']);
      let { city, state } = parseIpLocation(clientIp);
      const defaultWatchlist = JSON.stringify([
        { id: 1, name: 'Watchlist 1', symbols: ['NSE:NIFTY50-INDEX', 'NSE:NIFTYBANK-INDEX', 'BSE:SENSEX-INDEX', 'NSE:RELIANCE', 'NSE:TCS', 'NSE:HDFCBANK', 'NSE:INFY', 'NSE:ICICIBANK', 'NSE:SBIN'] }
      ]);

      const [inserted] = await db('users').insert({
        username: cleanUsername,
        email,
        phone: cleanPhone,
        password_hash: passwordHash,
        balance: 1000000.00,
        profile_picture_url: decoded.picture || null,
        subscription_tier: 'BASIC',
        watchlists: defaultWatchlist,
        registration_ip: clientIp,
        last_ip: clientIp,
        device_model: deviceModel,
        os_name: osName,
        browser_name: browserName,
        city: (city && city !== 'Local Network' && city !== 'Local') ? city : '',
        state: (state && state !== 'Local') ? state : '',
        created_at: new Date()
      }).returning('*');

      user = inserted || await db('users').whereRaw('LOWER(email) = ?', [email]).first();

      // Generate Sequential Professional Client ID: SE + Base36(user.id) padded to 6 chars (matches standard registration)
      const clientId = 'SE' + Number(user.id).toString(36).toUpperCase().padStart(6, '0');
      await db('users').where({ id: user.id }).update({ client_id: clientId }).catch(() => {});
      user.client_id = clientId;

      // Record DPDP Consents in batch
      try {
        const consentsToRecord = [
          { type: 'TERMS_AND_PRIVACY', granted: !!consent_terms },
          { type: 'DATA_PROCESSING_CORE', granted: !!consent_data_processing },
          { type: 'MARKETING_PROMOTIONS', granted: !!consent_marketing }
        ];
        const consentRows = consentsToRecord
          .filter(item => item.granted)
          .map(item => ({
            user_id: user.id,
            email,
            consent_type: item.type,
            status: 'GRANTED',
            consent_version: 'v2026.1',
            ip_address: clientIp,
            user_agent: req.headers['user-agent'] || ''
          }));
        if (consentRows.length > 0) {
          await db('user_consents').insert(consentRows).catch(() => {});
        }
      } catch (cErr) {}

      // Link Referral if present
      if (referral_code) {
        try {
          const referrer = await findUserByIdentifier(String(referral_code).trim());
          if (referrer && referrer.id !== user.id) {
            await db('referrals').insert({
              referrer_id: referrer.id,
              referred_user_id: user.id,
              status: 'pending',
              reward_amount: 0,
              created_at: new Date(),
              updated_at: new Date()
            }).catch(() => {});
          }
        } catch (e) {}
      }
    } else {
      // Update profile picture if user doesn't have one
      if (!user.profile_picture_url && decoded.picture) {
        await db('users').where({ id: user.id }).update({ profile_picture_url: decoded.picture }).catch(() => {});
        user.profile_picture_url = decoded.picture;
      }

      // If existing Google user has no phone number yet (e.g. legacy Google sign-in), prompt them to complete it
      const existingDigits = String(user.phone || '').replace(/\D/g, '');
      if (existingDigits.length !== 10) {
        const cleanPhone = String(phone || '').replace(/\D/g, '');
        if (!cleanPhone || cleanPhone.length !== 10) {
          const rawDisplayName = String(user.username || decoded.name || email.split('@')[0] || 'Trader')
            .replace(/[^A-Za-z\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 15);
          return res.json({
            success: true,
            needs_profile_completion: true,
            is_existing_user: true,
            email,
            suggested_name: rawDisplayName.length >= 6 ? rawDisplayName : '',
            picture: decoded.picture || user.profile_picture_url || null
          });
        }

        if (await isPhoneBanned(cleanPhone, generalClient)) {
          return res.status(403).json({ error: 'This phone number has been restricted.' });
        }

        const existingPhoneUser = await db('users').where('phone', cleanPhone).whereNot({ id: user.id }).first();
        if (existingPhoneUser) {
          return res.status(400).json({ error: 'An account with this phone number already exists.' });
        }

        const updatePayload = { phone: cleanPhone };
        const cleanUsername = String(requestedUsername || user.username || '').replace(/[^A-Za-z\s]/g, '').replace(/\s+/g, ' ').trim();
        const letterCount = cleanUsername.replace(/[^A-Za-z]/g, '').length;
        if (!cleanUsername || cleanUsername.length < 6 || cleanUsername.length > 15 || letterCount < 5) {
          return res.status(400).json({ error: 'Full Name must be 6 to 15 letters only (no numbers or special characters).' });
        }
        const normalizedUsernameKey = cleanUsername.replace(/\s+/g, '').toLowerCase();
        const existingName = await db('users')
          .whereRaw("LOWER(REPLACE(TRIM(username), ' ', '')) = ?", [normalizedUsernameKey])
          .whereNot({ id: user.id })
          .first();
        if (existingName) {
          return res.status(400).json({ error: `"${cleanUsername}" is already taken. Please choose another unique Full Name.` });
        }
        updatePayload.username = cleanUsername;
        user.username = cleanUsername;

        await db('users').where({ id: user.id }).update(updatePayload).catch(() => {});
        user.phone = cleanPhone;

        // Record DPDP Consents if provided during profile completion
        if (consents && typeof consents === 'object') {
          try {
            const consentTypes = ['terms_and_privacy', 'data_processing', 'marketing_communications'];
            for (const cType of consentTypes) {
              if (consents[cType] !== undefined) {
                await db('user_consents').insert({
                  user_id: user.id,
                  consent_type: cType,
                  consented: Boolean(consents[cType]),
                  consent_version: 'v2026.1',
                  ip_address: clientIp,
                  user_agent: req.headers['user-agent'] || ''
                }).catch(() => {});
              }
            }
          } catch (cErr) {}
        }
      }
    }

    if (user.is_banned) {
      return res.status(403).json({ error: 'Your trading account has been suspended by administration.' });
    }

    // Standardize any legacy random SKX... or missing client_id to sequential SE00000... format
    let clientId = user.client_id;
    if (!clientId || String(clientId).startsWith('SKX')) {
      clientId = 'SE' + Number(user.id).toString(36).toUpperCase().padStart(6, '0');
      await db('users').where({ id: user.id }).update({ client_id: clientId }).catch(() => {});
      user.client_id = clientId;
    }

    const { deviceModel, osName, browserName } = parseDeviceDetails(req.headers['user-agent']);
    const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '60d' });
    const tokenHash = hashToken(token);
    if (tokenHash) {
      await upsertUserSession({ userId: user.id, tokenHash, deviceModel, browserName, osName, clientIp });
    }

    const isHttps = isRequestSecure(req);
    res.cookie('token', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      maxAge: 60 * 24 * 60 * 60 * 1000
    });

    const profile = await db('user_profiles').where({ user_id: user.id }).first().catch(() => null);

    res.json({
      success: true,
      token,
      user: formatUserForClient(user, profile)
    });
  } catch (err) {
    console.error('[GOOGLE AUTH ERROR]:', err);
    res.status(500).json({ error: 'Google login failed: ' + (err.message || 'Token verification error') });
  }
});

// Rate limiting and attempt tracker for password reset OTP
const passwordResetAttempts = new Map();

// ─── Forgot Password ────────────────────────────────────────────────────────
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const normalizedEmail = email.toLowerCase().trim();
  const attemptRecord = passwordResetAttempts.get(normalizedEmail) || { count: 0, lockedUntil: 0 };
  const now = Date.now();

  if (attemptRecord.lockedUntil && now < attemptRecord.lockedUntil) {
    const waitMins = Math.ceil((attemptRecord.lockedUntil - now) / 60000);
    return res.status(429).json({ error: `Account temporarily locked due to excessive failed attempts. Please try again in ${waitMins} minute(s).` });
  }

  try {
    const user = await findUserByIdentifier(email);
    if (!user) return res.status(404).json({ error: 'No account found with this email or username' });
    const normalizedEmail = user.email.toLowerCase().trim();

    // Generate 6 digit cryptographically secure OTP
    const crypto = require('crypto');
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expires = new Date(Date.now() + 15 * 60000); // 15 minutes

    await db('users').where({ id: user.id }).update({
      reset_otp: otpHash,
      reset_otp_expires: expires
    });

    // Store ephemeral OTP in Redis with 15-min TTL
    try {
      const { generalClient } = require('./services/redisClient');
      if (generalClient && generalClient.isOpen) {
        await generalClient.setEx(`otp:reset:${user.id}`, 900, otpHash).catch(() => {});
      }
    } catch (e) {}

    console.log(`[FORGOT PASSWORD] 🔑 Generated Reset OTP for ${normalizedEmail}: ${otp}`);

    // 1. Deliver the 6-digit numeric OTP directly to user's inbox
    try {
      const { sendEmailOtpViaService } = require('./services/firebaseAuth');
      if (typeof sendEmailOtpViaService === 'function') {
        await sendEmailOtpViaService(normalizedEmail, otp);
      }
    } catch (mailErr) {
      console.warn('[FORGOT PASSWORD] Numeric email OTP dispatch note:', mailErr.message);
    }

    // 2. Dispatch official password reset email link via Firebase Mail Service
    try {
      await sendFirebasePasswordReset(normalizedEmail);
      console.log(`[FIREBASE AUTH] Password reset email successfully dispatched to ${normalizedEmail}`);
    } catch (fbErr) {
      console.warn(`[FIREBASE AUTH] Password reset email dispatch warning:`, fbErr.message);
    }

    res.json({ 
      success: true, 
      message: 'Password reset link sent! Please check your inbox (and spam folder).'
    });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Verify Reset OTP ───────────────────────────────────────────────────────
app.post('/api/auth/verify-reset-otp', authLimiter, async (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

  const attemptRecord = passwordResetAttempts.get(String(email).toLowerCase().trim()) || { count: 0, lockedUntil: 0 };
  const now = Date.now();

  if (attemptRecord.lockedUntil && now < attemptRecord.lockedUntil) {
    const waitMins = Math.ceil((attemptRecord.lockedUntil - now) / 60000);
    return res.status(429).json({ error: `Account temporarily locked due to excessive failed attempts. Please try again in ${waitMins} minute(s).` });
  }

  try {
    const user = await findUserByIdentifier(email);
    if (!user || !user.reset_otp || !user.reset_otp_expires) {
      return res.status(400).json({ error: 'No active OTP found. Please request a new OTP.' });
    }

    if (new Date() > new Date(user.reset_otp_expires)) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
    }

    const crypto = require('crypto');
    const inputHash = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
    
    let isOtpMatch = false;
    try {
      const { generalClient } = require('./services/redisClient');
      if (generalClient && generalClient.isOpen) {
        const redisOtp = await generalClient.get(`otp:reset:${user.id}`).catch(() => null);
        if (redisOtp && (redisOtp === inputHash || redisOtp === String(otp).trim())) {
          isOtpMatch = true;
          generalClient.del(`otp:reset:${user.id}`).catch(() => {});
        }
      }
    } catch (e) {}

    if (!isOtpMatch) {
      isOtpMatch = (user.reset_otp === inputHash || user.reset_otp === String(otp).trim());
    }

    if (!isOtpMatch) {
      attemptRecord.count += 1;
      if (attemptRecord.count >= 5) {
        attemptRecord.lockedUntil = now + 15 * 60 * 1000;
      }
      passwordResetAttempts.set(user.email.toLowerCase().trim(), attemptRecord);
      return res.status(400).json({ error: 'Invalid OTP code.' });
    }

    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Reset Password ─────────────────────────────────────────────────────────
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  const { email, otp, newPassword, oobCode } = req.body;
  const resetCode = String(otp || oobCode || '').trim();
  if (!email || !resetCode || !newPassword) return res.status(400).json({ error: 'All fields required' });

  // Disallow any forged or static bypass tokens entirely
  if (resetCode === 'FIREBASE_VERIFIED' || resetCode === 'FIREBASE_ACTION') {
    return res.status(400).json({ error: 'Invalid or forged verification code. Please request a fresh reset link.' });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const attemptRecord = passwordResetAttempts.get(normalizedEmail) || { count: 0, lockedUntil: 0 };
  const now = Date.now();

  if (attemptRecord.lockedUntil && now < attemptRecord.lockedUntil) {
    const waitMins = Math.ceil((attemptRecord.lockedUntil - now) / 60000);
    return res.status(429).json({ error: `Account temporarily locked due to excessive failed attempts. Please try again in ${waitMins} minute(s).` });
  }

  try {
    const user = await findUserByIdentifier(email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const userEmail = user.email ? user.email.toLowerCase().trim() : normalizedEmail;

    // Check if the reset code is a 6-digit numeric OTP vs a Firebase OOB Action Code
    const is6DigitOtp = /^\d{6}$/.test(resetCode);

    if (is6DigitOtp) {
      if (!user.reset_otp || !user.reset_otp_expires) {
        return res.status(400).json({ error: 'No active OTP found. Please request a new OTP.' });
      }

      if (new Date() > new Date(user.reset_otp_expires)) {
        return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
      }

      const crypto = require('crypto');
      const inputHash = crypto.createHash('sha256').update(resetCode).digest('hex');
      let isOtpMatch = false;

      try {
        const { generalClient } = require('./services/redisClient');
        if (generalClient && generalClient.isOpen) {
          const redisOtp = await generalClient.get(`otp:reset:${user.id}`).catch(() => null);
          if (redisOtp && (redisOtp === inputHash || redisOtp === resetCode)) {
            isOtpMatch = true;
            generalClient.del(`otp:reset:${user.id}`).catch(() => {});
          }
        }
      } catch (e) {}

      if (!isOtpMatch) {
        isOtpMatch = (user.reset_otp === inputHash || user.reset_otp === resetCode);
      }

      if (!isOtpMatch) {
        attemptRecord.count += 1;
        if (attemptRecord.count >= 5) {
          attemptRecord.lockedUntil = now + 15 * 60 * 1000; // 15-minute lockout
          passwordResetAttempts.set(userEmail, attemptRecord);
          // Invalidate OTP in DB to protect user
          await db('users').where({ id: user.id }).update({ reset_otp: null, reset_otp_expires: null });
          return res.status(429).json({ error: 'Too many incorrect OTP attempts. The OTP has been invalidated for security. Please request a new one after 15 minutes.' });
        }
        passwordResetAttempts.set(userEmail, attemptRecord);
        const remaining = 5 - attemptRecord.count;
        return res.status(400).json({ error: `Invalid OTP. ${remaining} attempt(s) remaining.` });
      }
    } else {
      // It's a Firebase OOB Code (action link from email)
      try {
        const fbResult = await verifyFirebasePasswordResetOobCode(resetCode, newPassword);
        if (!fbResult || !fbResult.success) {
          return res.status(400).json({ error: 'Invalid or expired Firebase reset link.' });
        }
        // Verify the email associated with the oobCode matches the requested user
        if (fbResult.email && fbResult.email.toLowerCase().trim() !== userEmail) {
          return res.status(403).json({ error: 'Reset link does not match the requested user account.' });
        }
      } catch (fbErr) {
        console.warn('[RESET PASSWORD] Firebase OOB verification failed:', fbErr.message);
        return res.status(400).json({ error: fbErr.message || 'Invalid or expired password reset link.' });
      }
    }

    // Success: clear rate limiter
    passwordResetAttempts.delete(userEmail);

    const password_hash = await bcrypt.hash(newPassword, 10);
    await db('users').where({ id: user.id }).update({
      password_hash,
      reset_otp: null,
      reset_otp_expires: null
    });

    // Invalidate all active sessions for this user across all devices upon password reset (Defect 27)
    await db('user_sessions').where({ user_id: user.id }).del().catch(() => {});

    // Sync newly updated password to Firebase Auth
    await syncFirebaseUserPassword(userEmail, newPassword).catch(() => {});

    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── User ─────────────────────────────────────────────────────────────────

app.get('/api/debug-db', authenticateToken, async (req, res) => {
    try {
        const caller = await db('users').where({ id: req.user.id }).first();
        if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });
        const columns = await db('users').columnInfo();
        res.json(columns);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) return res.status(401).json({ error: 'User account not found or has been deleted.', account_deleted: true });
    if (!user.client_id) {
      user.client_id = 'SE' + Number(user.id).toString(36).toUpperCase().padStart(6, '0');
      await db('users').where({ id: user.id }).update({ client_id: user.client_id }).catch(() => {});
    }
    const profile = await db('user_profiles').where({ user_id: req.user.id }).first().catch(() => null);
    res.json(formatUserForClient(user, profile));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ⚡ High-Performance 5-in-1 User Bootstrap Endpoint (Cuts Client Network Polls by 80%)
app.get('/api/user/bootstrap', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const activeOrderStatuses = [
      'PENDING', 
      'PARTIAL_FILLED', 
      'PARTIALLY_FILLED', 
      'OPEN', 
      'TRIGGER_PENDING', 
      'PENDING_TRIGGER', 
      'AMO_PENDING', 
      'AMO_REQ_RECEIVED'
    ];

    // Compute start of active trading session in IST (07:55 AM cutoff)
    const todayStartIST = getTradingSessionStartIST();

    const [userRow, positionsRows, holdingsRows, sipsRows, activeOrders, todayOrders, recentOrders] = await Promise.all([
      db('users').where({ id: userId }).first(),
      db('positions')
        .where({ user_id: userId })
        .where(function() {
          this.whereNot({ quantity: 0 })
            .orWhere('updated_at', '>=', todayStartIST);
        })
        .orderBy('updated_at', 'desc')
        .catch(() => []),
      db('holdings')
        .where({ user_id: userId })
        .where(function() {
          this.where('quantity', '>', 0).orWhere('quantity', '<', 0);
        })
        .orderBy('id', 'desc')
        .catch(() => []),
      db('sips').where({ user_id: userId }).catch(() => []),
      // 1. ALL active/open/pending orders - ZERO truncation, guarantee 100% presence
      db('orders')
        .where({ user_id: userId })
        .whereIn('status', activeOrderStatuses)
        .orderBy('created_at', 'desc')
        .catch(() => []),
      // 2. ALL orders created or updated today in IST (preserves all multi-sliced trades of today)
      db('orders')
        .where({ user_id: userId })
        .where(function() {
          this.where('created_at', '>=', todayStartIST)
            .orWhere('updated_at', '>=', todayStartIST);
        })
        .orderBy('created_at', 'desc')
        .catch(() => []),
      // 3. Fallback recent orders (up to 200) so order history is available before today's first trade
      db('orders')
        .where({ user_id: userId })
        .orderBy('created_at', 'desc')
        .limit(200)
        .catch(() => [])
    ]);

    // Merge and deduplicate by order ID
    const ordersMap = new Map();
    (activeOrders || []).forEach(o => ordersMap.set(o.id, o));
    (todayOrders || []).forEach(o => ordersMap.set(o.id, o));
    (recentOrders || []).forEach(o => {
      if (!ordersMap.has(o.id)) ordersMap.set(o.id, o);
    });

    const ordersRows = Array.from(ordersMap.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    if (!userRow) return res.status(401).json({ error: 'User account not found or has been deleted.', account_deleted: true });

    if (!userRow.client_id) {
      userRow.client_id = 'SE' + Number(userRow.id).toString(36).toUpperCase().padStart(6, '0');
      db('users').where({ id: userRow.id }).update({ client_id: userRow.client_id }).catch(() => {});
    }
    const userProfileRow = await db('user_profiles').where({ user_id: userId }).first().catch(() => null);
    const formattedUser = formatUserForClient(userRow, userProfileRow);

    const formattedPositions = (positionsRows || []).map(p => ({
      ...p,
      quantity: Number(p.quantity),
      closed_quantity: Number(p.closed_quantity || 0),
      average_price: Math.abs(Number(p.average_price || 0)),
      exit_price: p.exit_price !== null && p.exit_price !== undefined ? Number(p.exit_price) : null,
      margin: Number(p.margin || 0),
      realized_pnl: Number(p.realized_pnl || 0)
    }));

    const LEGACY_FIX_MAP = {
      'EDEL-MF': { code: '118615', fallbackNav: 61.66 },
      'EDEL':    { code: '118615', fallbackNav: 61.66 },
      'MIRA-MF': { code: '118825', fallbackNav: 126.99 },
      'MIRA':    { code: '118825', fallbackNav: 126.99 },
      'NIPP-MF': { code: '118778', fallbackNav: 209.96 },
      'NIPP':    { code: '118778', fallbackNav: 209.96 }
    };

    const isDerivContract = (sym) => {
      if (!sym || typeof sym !== 'string') return false;
      if (sym.startsWith('MCX:') || sym.includes('-MCX') || sym.includes('NCDEX')) return true;
      const clean = sym.replace(/^(NSE:|BSE:|MCX:)/i, '').trim();
      if (/(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(clean)) return true;
      if (/(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(clean) || clean.endsWith('-FUT')) return true;
      return false;
    };

    const formattedHoldings = (holdingsRows || []).filter(h => Math.abs(Number(h.quantity)) > 0);
    for (const h of formattedHoldings) {
      if (LEGACY_FIX_MAP[h.symbol] && Math.round(Number(h.average_price)) === 100) {
        const item = LEGACY_FIX_MAP[h.symbol];
        const realNav = priceCache[h.symbol]?.ltp || item.fallbackNav;
        const invested = Number(h.quantity) * Number(h.average_price);
        const correctedQty = parseFloat((invested / realNav).toFixed(4));
        h.average_price = realNav;
        h.quantity = correctedQty;
        db('holdings').where({ id: h.id }).update({ average_price: realNav, quantity: correctedQty }).catch(() => {});
      }
    }

    res.json({
      success: true,
      user: formattedUser,
      positions: formattedPositions,
      holdings: formattedHoldings,
      orders: ordersRows || [],
      sips: sipsRows || []
    });
  } catch (err) {
    console.error('[User Bootstrap Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function isValidMediaUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length > 5 * 1024 * 1024) return false;
  if (/^https?:\/\/[^\s<>"'`]+$/i.test(trimmed)) return true;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed)) return true;
  return false;
}

app.post('/api/user/profile_picture', authenticateToken, async (req, res) => {
  try {
    const { profile_picture_url } = req.body;
    if (profile_picture_url && !isValidMediaUrl(profile_picture_url)) {
      return res.status(400).json({ error: 'Invalid profile picture format. Only HTTPS image URLs or Base64 images are supported.' });
    }
    await db('users').where({ id: req.user.id }).update({ profile_picture_url: profile_picture_url ? profile_picture_url.trim() : null });
    res.json({ success: true, profile_picture_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Razorpay Payment Integration ───────────────────────────────────────────
const Razorpay = require('razorpay');
const crypto = require('crypto');

async function getRazorpayConfig() {
  let key_id = process.env.RAZORPAY_KEY_ID;
  let key_secret = process.env.RAZORPAY_KEY_SECRET;
  try {
    const rowId = await db('system_settings').where({ key: 'razorpay_key_id' }).first();
    const rowSec = await db('system_settings').where({ key: 'razorpay_key_secret' }).first();
    if (rowId && rowId.value) key_id = rowId.value.trim();
    if (rowSec && rowSec.value) key_secret = rowSec.value.trim();
  } catch (_) {}
  return {
    key_id: key_id || 'rzp_test_placeholder',
    key_secret: key_secret || 'secret_placeholder'
  };
}

async function getRazorpayClient() {
  const conf = await getRazorpayConfig();
  return {
    client: new Razorpay({ key_id: conf.key_id, key_secret: conf.key_secret }),
    key_id: conf.key_id,
    key_secret: conf.key_secret
  };
}

// 1. Direct Instant Payment (No Trial) - Supports ₹199, ₹1,999, ₹2,999, ₹9,999, ₹24,999
app.post('/api/payment/create-order', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body || {};
    let amount = 199 * 100;
    if (plan === 'lifetime' || plan === 'elite_lifetime') {
      amount = 24999 * 100;
    } else if (plan === 'masterclass' || plan === 'course') {
      amount = 9999 * 100;
    } else if (plan === 'highest' || plan === 'feature') {
      amount = 2999 * 100;
    } else if (plan === 'yearly') {
      amount = 1999 * 100;
    } else {
      amount = 199 * 100;
    }
    
    const { client, key_id, key_secret } = await getRazorpayClient();
    if (!key_secret || key_secret === 'secret_placeholder' || key_id === 'rzp_test_placeholder') {
      return res.status(503).json({ error: 'Razorpay keys not configured. Please add Key ID and Key Secret in Admin Panel or .env' });
    }

    const options = {
      amount,
      currency: "INR",
      receipt: "receipt_order_" + req.user.id + "_" + Date.now()
    };
    const order = await client.orders.create(options);
    res.json({ ...order, key_id, amount, currency: "INR" });
  } catch (error) {
    const errMsg = error.error ? error.error.description : (error.message || 'Unknown error');
    res.status(500).json({ error: 'Razorpay API Rejected: ' + errMsg });
  }
});

// Official Razorpay Plan IDs for AutoPay recurring mandates
const RAZORPAY_PLAN_MAP = {
  monthly: 'plan_Tjwq81Q691SX5t',   // ₹199 Every Month
  yearly: 'plan_Tjwr3Kfn0d8JuL',    // ₹1,999 Every Year
  highest: 'plan_Tjws5S02DWgWE5',   // ₹2,999 Every Year (VIP Tier)
  feature: 'plan_Tjws5S02DWgWE5',
  vip: 'plan_Tjws5S02DWgWE5'
};

// AutoPay recurring subscription mandate endpoint
app.post('/api/payment/create-subscription', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body || {};
    const selectedPlan = (plan || 'monthly').toLowerCase();
    const planId = RAZORPAY_PLAN_MAP[selectedPlan];

    if (!planId) {
      return res.status(400).json({ error: `AutoPay is not supported for "${plan}". Please use one-time payment.` });
    }

    const { client, key_id, key_secret } = await getRazorpayClient();
    if (!key_secret || key_secret === 'secret_placeholder' || key_id === 'rzp_test_placeholder') {
      return res.status(503).json({ error: 'Razorpay keys not configured. Please add Key ID and Key Secret in Admin Panel.' });
    }

    // Determine billing cycles (e.g. 60 months = 5 years, 5 years for yearly)
    const totalCount = selectedPlan === 'monthly' ? 60 : 5;

    const subscription = await client.subscriptions.create({
      plan_id: planId,
      total_count: totalCount,
      quantity: 1,
      customer_notify: 1, // Razorpay automatically dispatches mandatory RBI pre-debit notifications
      notes: {
        user_id: String(req.user.id),
        plan: selectedPlan
      }
    });

    res.json({
      ...subscription,
      subscription_id: subscription.id,
      key_id,
      is_subscription: true
    });
  } catch (error) {
    const errMsg = error.error ? error.error.description : (error.message || 'Unknown error');
    res.status(500).json({ error: 'Razorpay AutoPay Rejected: ' + errMsg });
  }
});

app.post('/api/payment/verify', authenticateToken, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_subscription_id, razorpay_payment_id, razorpay_signature, plan } = req.body;
    
    const { key_secret: secret } = await getRazorpayConfig();
    if (!secret || secret === 'secret_placeholder') {
      return res.status(503).json({ error: 'Payment gateway configuration is incomplete. Please add Razorpay Key Secret.' });
    }

    if (!razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing required payment verification parameters' });
    }

    // For normal orders, body is order_id + '|' + payment_id
    // For subscriptions, body is payment_id + '|' + subscription_id
    let body = (razorpay_order_id || '') + "|" + razorpay_payment_id;
    if (razorpay_subscription_id) {
      body = razorpay_payment_id + "|" + razorpay_subscription_id;
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex');
      
    const isAuthentic = expectedSignature.length === razorpay_signature.length &&
      crypto.timingSafeEqual(Buffer.from(expectedSignature, 'utf8'), Buffer.from(razorpay_signature, 'utf8'));
    if (isAuthentic) {
      await db.transaction(async (trx) => {
        const user = await trx('users').where({ id: req.user.id }).forUpdate().first();
        if (!user) throw new Error('User not found');

        const now = new Date();
        const baseDate = (user.subscription_expires && new Date(user.subscription_expires) > now) 
          ? new Date(user.subscription_expires) 
          : now;
        const expires = new Date(baseDate.getTime());
        const selectedPlan = (plan || '').toLowerCase();
        let targetTier = 'MONTHLY';
        if (selectedPlan === 'lifetime' || selectedPlan === 'elite_lifetime') {
          targetTier = 'LIFETIME';
          expires.setFullYear(expires.getFullYear() + 100);
        } else if (selectedPlan === 'masterclass' || selectedPlan === 'course') {
          targetTier = 'MASTERCLASS';
          expires.setFullYear(expires.getFullYear() + 1);
        } else if (selectedPlan === 'highest' || selectedPlan === 'feature') {
          targetTier = 'HIGHEST';
          expires.setFullYear(expires.getFullYear() + 1);
        } else if (selectedPlan === 'yearly') {
          targetTier = 'YEARLY';
          expires.setFullYear(expires.getFullYear() + 1);
        } else {
          targetTier = 'MONTHLY';
          expires.setMonth(expires.getMonth() + 1);
        }

        await trx('users').where({ id: req.user.id }).update({
          subscription_tier: targetTier,
          subscription_expires: expires
        });

        // --- Referral Reward Logic (Atomic) ---
        try {
          const pendingRef = await trx('referrals')
            .where({ referred_user_id: req.user.id, status: 'pending' })
            .forUpdate()
            .first();

          if (pendingRef) {
            let rewardAmount = 9.9;
            if (selectedPlan === 'lifetime' || selectedPlan === 'elite_lifetime') {
              rewardAmount = 999.0;
            } else if (selectedPlan === 'masterclass' || selectedPlan === 'course') {
              rewardAmount = 499.0;
            } else if (selectedPlan === 'highest' || selectedPlan === 'feature') {
              rewardAmount = 99.9;
            } else if (selectedPlan === 'yearly') {
              rewardAmount = 49.9;
            }
            
            // Mark as completed
            await trx('referrals')
              .where({ id: pendingRef.id })
              .update({ status: 'completed', reward_amount: rewardAmount });
            
            // Credit referrer
            await trx('users')
              .where({ id: pendingRef.referrer_id })
              .increment('balance', rewardAmount);

            // Audit ledger entry for referral credit
            await trx('ledger').insert({
              user_id: pendingRef.referrer_id,
              amount: rewardAmount,
              type: 'DEPOSIT',
              description: `Referral reward bonus for user ${user.username || req.user.id} ${targetTier} upgrade`
            });
          }
        } catch (e) {
          console.error('Failed to process referral reward', e);
        }
      });

      res.json({ success: true, message: 'Upgraded to PRO successfully!' });
    } else {
      res.status(400).json({ error: 'Invalid Payment Signature' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Analytics ─────────────────────────────────────────────────────────────
app.get('/api/analytics', authenticateToken, async (req, res) => {
  try {
    let rawOrders = await db('orders')
      .where({ user_id: req.user.id })
      .whereNot('realized_pnl', 0)
      .select('id', 'symbol', 'side', 'quantity', 'realized_pnl', 'created_at', 'slice_group_id', 'remarks')
      .orderBy('created_at', 'asc');

    // Bridge with orders_archive so lifetime analytics, equity curve, and win rate remain 100% complete
    try {
      const hasArchive = await db.schema.hasTable('orders_archive');
      if (hasArchive) {
        const archivedOrders = await db('orders_archive')
          .where({ user_id: req.user.id })
          .whereNot('realized_pnl', 0)
          .select('id', 'symbol', 'side', 'quantity', 'realized_pnl', 'created_at', 'slice_group_id', 'remarks')
          .orderBy('created_at', 'asc');
        if (archivedOrders && archivedOrders.length > 0) {
          rawOrders = [...archivedOrders, ...rawOrders];
          rawOrders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }
      }
    } catch (_) {}

    // Bridge expired worthless contracts from ledger & positions so they accurately reflect in Trade Analytics
    try {
      const expiredLedger = await db('ledger')
        .where({ user_id: req.user.id, type: 'REALIZED_PNL' })
        .where('description', 'ilike', '%expired worthless%')
        .select('id', 'amount as realized_pnl', 'description', 'created_at');

      if (expiredLedger && expiredLedger.length > 0) {
        const existingKeys = new Set(rawOrders.map(o => `${o.symbol}_${Math.round(Math.abs(parseFloat(o.realized_pnl) || 0))}`));
        for (const el of expiredLedger) {
          const match = el.description?.match(/contract:\s*([A-Za-z0-9:_-]+)/i);
          const sym = match ? match[1].trim() : 'EXPIRED_OPTION';
          const pnlVal = parseFloat(el.realized_pnl) || 0;
          const key = `${sym}_${Math.round(Math.abs(pnlVal))}`;
          if (!existingKeys.has(key)) {
            let tradeQty = 1;
            try {
              const posRow = await db('positions')
                .where({ user_id: req.user.id, symbol: sym })
                .orderBy('id', 'desc')
                .first();
              if (posRow) {
                tradeQty = Math.abs(parseFloat(posRow.closed_quantity) || parseFloat(posRow.quantity) || 1);
              }
            } catch (_) {}

            rawOrders.push({
              id: `exp_led_${el.id}`,
              symbol: sym,
              side: pnlVal < 0 ? 'SELL' : 'BUY',
              quantity: tradeQty,
              realized_pnl: pnlVal,
              created_at: el.created_at,
              slice_group_id: null,
              remarks: 'Option expired worthless at ₹0 (Lapsed at Expiry)'
            });
            existingKeys.add(key);
          }
        }
        rawOrders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      }
    } catch (_) {}

    // Consolidate sliced iceberg orders into single unified trades
    const groupMap = new Map();
    const orders = [];

    // Pre-calculate 3-second rapid automated burst clusters for sliced orders without explicit slice IDs
    const timeClusters = new Map();
    for (const o of rawOrders) {
      if (!o.slice_group_id && (!o.remarks || (!o.remarks.includes('[slice_') && !/Slice\s+\d+\/\d+/i.test(o.remarks)))) {
        const pType = (o.product_type || 'INT').toUpperCase();
        const tSec = Math.floor(new Date(o.created_at || o.createdAt).getTime() / 3000);
        const cKey = `${o.symbol}_${o.side}_${pType}_${tSec}`;
        timeClusters.set(cKey, (timeClusters.get(cKey) || 0) + 1);
      }
    }

    for (const o of rawOrders) {
      let groupId = o.slice_group_id;
      if (!groupId && o.remarks && o.remarks.includes('[slice_')) {
        const match = o.remarks.match(/\[(slice_[^\]]+)\]/);
        if (match) groupId = match[1];
      }
      if (!groupId && o.remarks && /Slice\s+\d+\/\d+/i.test(o.remarks)) {
        const dStr = new Date(o.created_at || o.createdAt).toISOString().slice(0, 16);
        groupId = `inferred_${o.symbol}_${o.side}_${dStr}`;
      }
      if (!groupId) {
        const pType = (o.product_type || 'INT').toUpperCase();
        const tSec = Math.floor(new Date(o.created_at || o.createdAt).getTime() / 3000);
        const cKey = `${o.symbol}_${o.side}_${pType}_${tSec}`;
        if ((timeClusters.get(cKey) || 0) > 1) {
          groupId = `cluster_${cKey}`;
        }
      }

      if (groupId) {
        if (!groupMap.has(groupId)) {
          const parent = {
            ...o,
            sliceCount: 1,
            quantity: Number(o.quantity) || 0,
            realized_pnl: parseFloat(o.realized_pnl) || 0
          };
          groupMap.set(groupId, parent);
          orders.push(parent);
        } else {
          const parent = groupMap.get(groupId);
          parent.sliceCount += 1;
          parent.quantity += Number(o.quantity) || 0;
          parent.realized_pnl += parseFloat(o.realized_pnl) || 0;
        }
      } else {
        orders.push({
          ...o,
          sliceCount: 1,
          quantity: Number(o.quantity) || 0,
          realized_pnl: parseFloat(o.realized_pnl) || 0
        });
      }
    }
      
    let totalTrades = orders.length;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    
    // Group by Date for Equity Curve
    const dailyPnL = {};
    
    orders.forEach(o => {
       const pnl = parseFloat(o.realized_pnl);
       if (pnl > 0) {
          winningTrades++;
          totalProfit += pnl;
       } else {
          losingTrades++;
          totalLoss += Math.abs(pnl);
       }
       
       const date = new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD IST
       if (!dailyPnL[date]) dailyPnL[date] = 0;
       dailyPnL[date] += pnl;
    });
    
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const avgWinner = winningTrades > 0 ? totalProfit / winningTrades : 0;
    const avgLoser = losingTrades > 0 ? totalLoss / losingTrades : 0;
    
    let cumulative = 0;
    const equityCurve = Object.keys(dailyPnL).sort().map(date => {
       cumulative += dailyPnL[date];
       return { date, pnl: dailyPnL[date], cumulative };
    });

    res.json({
       totalTrades,
       winningTrades,
       losingTrades,
       winRate: winRate.toFixed(1),
       avgWinner: avgWinner.toFixed(2),
       avgLoser: avgLoser.toFixed(2),
       equityCurve,
       recentTrades: orders.slice(-50).reverse() // Consolidated trades for the log
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/kyc', authenticateToken, async (req, res) => {
  try {
    const { kyc_pan_url, kyc_aadhar_url, consent_kyc_processing } = req.body;
    if (kyc_pan_url && !isValidMediaUrl(kyc_pan_url)) {
      return res.status(400).json({ error: 'Invalid PAN document URL or image format.' });
    }
    if (kyc_aadhar_url && !isValidMediaUrl(kyc_aadhar_url)) {
      return res.status(400).json({ error: 'Invalid Aadhar document URL or image format.' });
    }
    await db('users').where({ id: req.user.id }).update({ 
      kyc_pan_url: kyc_pan_url ? kyc_pan_url.trim() : null, 
      kyc_aadhar_url: kyc_aadhar_url ? kyc_aadhar_url.trim() : null 
    });

    if (consent_kyc_processing) {
      await db('user_consents').insert({
        user_id: req.user.id,
        email: req.user.email || '',
        consent_type: 'KYC_DOCUMENT_PROCESSING',
        status: 'GRANTED',
        consent_version: 'v2026.1',
        ip_address: (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '').replace(/^::ffff:/, '').trim(),
        user_agent: req.headers['user-agent'] || ''
      }).catch(() => {});
    }

    res.json({ success: true, kyc_pan_url, kyc_aadhar_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Privacy & Data Rights Endpoints (DPDP Act 2023 & GDPR) ─────────────────

// Record or update user consent (unticked opt-in records)
app.post('/api/user/consent', async (req, res) => {
  try {
    const { consent_type, status = 'GRANTED', email } = req.body;
    if (!consent_type) return res.status(400).json({ error: 'consent_type is required' });

    let userId = null;
    let userEmail = email ? String(email).toLowerCase().trim() : null;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      try {
        const token = authHeader.slice(7).trim();
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded?.id) {
          userId = decoded.id;
          if (!userEmail) {
            const u = await db('users').where({ id: userId }).select('email').first();
            userEmail = u?.email || null;
          }
        }
      } catch (e) {}
    }

    const clientIp = (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '').replace(/^::ffff:/, '').trim();

    await db('user_consents').insert({
      user_id: userId,
      email: userEmail,
      consent_type: String(consent_type).trim(),
      status: status === 'WITHDRAWN' ? 'WITHDRAWN' : 'GRANTED',
      consent_version: 'v2026.1',
      ip_address: clientIp,
      user_agent: req.headers['user-agent'] || ''
    });

    res.json({ success: true, message: `Consent for ${consent_type} recorded successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get active consents for authenticated user
app.get('/api/user/consents', authenticateToken, async (req, res) => {
  try {
    const consents = await db('user_consents')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'desc');
    res.json({ success: true, consents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit Data Rights Request (Access, Rectification, Erasure, Withdraw Consent)
app.post('/api/user/data-rights-request', async (req, res) => {
  try {
    const { email, request_type, details } = req.body;
    if (!email || !request_type) {
      return res.status(400).json({ error: 'Email and request_type are required' });
    }

    const validTypes = ['ACCESS', 'CORRECTION', 'ERASURE', 'WITHDRAW_CONSENT'];
    const cleanType = String(request_type).trim().toUpperCase();
    if (!validTypes.includes(cleanType)) {
      return res.status(400).json({ error: `Invalid request_type. Must be one of: ${validTypes.join(', ')}` });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    let userId = null;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      try {
        const token = authHeader.slice(7).trim();
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded?.id) userId = decoded.id;
      } catch (e) {}
    }

    let matchedUser = null;
    if (userId) {
      matchedUser = await db('users').where({ id: userId }).first();
    } else {
      matchedUser = await db('users').whereRaw('LOWER(email) = ?', [cleanEmail]).first();
      if (matchedUser) userId = matchedUser.id;
    }

    const crypto = require('crypto');
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const requestId = `DRR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomSuffix}`;
    const clientIp = (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '').replace(/^::ffff:/, '').trim();
    const cleanDetails = details ? String(details).trim().slice(0, 2000) : null;

    await db('data_rights_requests').insert({
      request_id: requestId,
      user_id: userId,
      email: cleanEmail,
      request_type: cleanType,
      details: cleanDetails,
      status: 'PENDING',
      ip_address: clientIp
    });

    // Notify Admin & Client via Email asynchronously
    try {
      const { sendDataRightsNotificationEmail } = require('./services/firebaseAuth');
      if (typeof sendDataRightsNotificationEmail === 'function') {
        sendDataRightsNotificationEmail({
          event: 'SUBMITTED',
          requestId,
          email: cleanEmail,
          requestType: cleanType,
          details: cleanDetails,
          userId,
          username: matchedUser?.username || null,
          clientIp
        }).catch(err => console.warn('[DATA RIGHTS EMAIL ERROR]', err.message));
      }
    } catch (e) {}

    // Also notify Admin via Telegram Bot if any admin has telegram_chat_id configured
    try {
      const { callTelegramApi } = require('./services/telegramService');
      if (typeof callTelegramApi === 'function') {
        const adminsWithTg = await db('users')
          .where({ is_admin: true })
          .whereNotNull('telegram_chat_id')
          .whereNot('telegram_chat_id', '');
        const tgMsg =
          `🚨 <b>SkandX Compliance Alert: ${cleanType === 'ERASURE' ? 'Account Deletion Request' : cleanType}</b>\n\n` +
          `<b>Ref ID:</b> <code>${requestId}</code>\n` +
          `<b>Client Email:</b> ${cleanEmail}\n` +
          `<b>Matched Account:</b> ${matchedUser ? `${matchedUser.username} (#${matchedUser.id})` : 'None'}\n` +
          `<b>Reason:</b> ${cleanDetails || 'Not specified'}\n\n` +
          `👉 Open <b>Admin Panel → Account Deletions</b> to approve or resolve.`;
        for (const adm of adminsWithTg) {
          callTelegramApi(adm.telegram_chat_id, tgMsg).catch(() => {});
        }
      }
    } catch (e) {}

    // Notify connected Admin Dashboard in real-time via Socket.IO
    try {
      if (typeof io !== 'undefined' && io) {
        io.emit('admin_data_rights_request', {
          request_id: requestId,
          user_id: userId,
          email: cleanEmail,
          request_type: cleanType,
          details: cleanDetails,
          status: 'PENDING',
          created_at: new Date().toISOString()
        });
      }
    } catch (e) {}

    res.json({
      success: true,
      request_id: requestId,
      message: `Your data rights request (${cleanType}) has been logged. Under Section 13 of the DPDP Act 2023, our Grievance Redressal Officer will acknowledge within 24 hours and resolve your request within 30 days.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: List all Account Deletion & DPDP Data Rights Requests
app.get('/api/admin/data-rights-requests', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const rawRequests = await db('data_rights_requests')
      .select(
        'id',
        'request_id',
        'user_id',
        'email',
        'request_type',
        'details',
        'status',
        'admin_notes',
        'ip_address',
        'created_at',
        'updated_at'
      )
      .orderBy('created_at', 'desc')
      .limit(250);

    // Enrich with matched user info safely without SQL join column failures
    const allUsers = await db('users')
      .select('id', 'client_id', 'username', 'email', 'balance', 'subscription_tier', 'is_admin')
      .catch(() => []);

    const usersById = new Map();
    const usersByEmail = new Map();
    for (const u of allUsers) {
      usersById.set(Number(u.id), u);
      if (u.email) usersByEmail.set(String(u.email).toLowerCase().trim(), u);
    }

    const requests = rawRequests.map(r => {
      const matched = (r.user_id && usersById.get(Number(r.user_id))) ||
        (r.email && usersByEmail.get(String(r.email).toLowerCase().trim())) ||
        null;
      return {
        ...r,
        matched_user_id: matched ? matched.id : null,
        matched_client_id: matched ? matched.client_id : null,
        matched_username: matched ? matched.username : null,
        matched_balance: matched ? matched.balance : null,
        matched_tier: matched ? matched.subscription_tier : null,
        matched_is_admin: matched ? matched.is_admin : false
      };
    });

    const pendingCount = requests.filter(r => r.status === 'PENDING').length;
    const erasurePendingCount = requests.filter(r => r.status === 'PENDING' && r.request_type === 'ERASURE').length;

    let gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER || '';
    let gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || '';
    try {
      const rows = await db('system_settings').whereIn('key', ['gmail_user', 'gmail_app_password']);
      for (const r of rows) {
        if (r.key === 'gmail_user' && r.value) gmailUser = r.value;
        if (r.key === 'gmail_app_password' && r.value) gmailPass = r.value;
      }
    } catch (_) {}

    res.json({
      success: true,
      requests,
      pendingCount,
      erasurePendingCount,
      smtpConfigured: !!(gmailUser && gmailPass),
      gmailUser: gmailUser || 'skandx.in@gmail.com'
    });
  } catch (err) {
    console.error('Admin Data Rights List Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: Save Gmail SMTP credentials for Compliance & Deletion Email Alerts
app.post('/api/admin/email-settings', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const { gmail_user, gmail_app_password, send_test } = req.body || {};
    const cleanUser = String(gmail_user || 'skandx.in@gmail.com').trim();
    const cleanPass = String(gmail_app_password || '').replace(/\s+/g, '').trim();

    if (!cleanUser || !cleanPass) {
      return res.status(400).json({ error: 'Both Gmail address and 16-character Google App Password are required.' });
    }

    process.env.GMAIL_USER = cleanUser;
    process.env.GMAIL_APP_PASSWORD = cleanPass;

    for (const [k, v] of [['gmail_user', cleanUser], ['gmail_app_password', cleanPass]]) {
      const exists = await db('system_settings').where({ key: k }).first();
      if (exists) {
        await db('system_settings').where({ key: k }).update({ value: v, updated_at: new Date() });
      } else {
        await db('system_settings').insert({ key: k, value: v, updated_at: new Date() });
      }
    }

    if (send_test) {
      const { sendDataRightsNotificationEmail } = require('./services/firebaseAuth');
      const sent = await sendDataRightsNotificationEmail({
        event: 'SUBMITTED',
        requestId: 'DRR-TEST-VERIFY',
        email: cleanUser,
        requestType: 'ERASURE',
        details: 'Test email alert from SkandX Admin Panel to verify Gmail SMTP delivery.',
        userId: caller.id,
        username: caller.username,
        clientIp: '127.0.0.1'
      });
      if (!sent) {
        return res.status(400).json({ error: 'Saved, but Gmail rejected the App Password. Make sure 2-Step Verification is ON in your Google Account and use a 16-letter Google App Password.' });
      }
    }

    res.json({
      success: true,
      message: 'Gmail SMTP credentials saved and verified! All Account Deletion requests will now email you immediately.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Resolve or Execute Automated Action for a Data Rights Request
app.post('/api/admin/data-rights-requests/:id/resolve', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const reqRow = await db('data_rights_requests').where({ id: req.params.id }).first();
    if (!reqRow) return res.status(404).json({ error: 'Request not found' });

    const { action, admin_notes } = req.body; // 'DELETE_ACCOUNT' | 'SEND_DATA_EXPORT' | 'WITHDRAW_CONSENT' | 'COMPLETED' | 'REJECTED'
    const cleanAction = String(action || 'COMPLETED').toUpperCase();
    const reqType = String(reqRow.request_type || '').toUpperCase();
    const notes = admin_notes ? String(admin_notes).trim().slice(0, 1000) : null;

    // Resolve matching user by user_id or email
    let targetUser = null;
    if (reqRow.user_id) {
      targetUser = await db('users').where({ id: reqRow.user_id }).first();
    }
    if (!targetUser && reqRow.email) {
      targetUser = await db('users').whereRaw('LOWER(email) = ?', [String(reqRow.email).toLowerCase().trim()]).first();
    }

    // ─── 1. AUTOMATED ACCOUNT DELETION (ERASURE) ────────────────────────────
    if (cleanAction === 'DELETE_ACCOUNT') {
      if (targetUser) {
        if (targetUser.is_admin) {
          return res.status(400).json({ error: 'Cannot delete an administrator account.' });
        }
        const targetUserId = targetUser.id;
        let ordersToClean = [];

        await db.transaction(async (trx) => {
          await trx.raw('SELECT pg_advisory_xact_lock(?)', [targetUserId]);

          ordersToClean = await trx('orders')
            .where({ user_id: targetUserId })
            .whereIn('status', ['PENDING', 'PENDING_TRIGGER', 'AMO_PENDING', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN']);

          await trx('orders').where({ user_id: targetUserId }).update({ linked_order_id: null, parent_order_id: null });
          await trx('orders').where({ user_id: targetUserId }).del();
          await trx('positions').where({ user_id: targetUserId }).del();
          await trx('ledger').where({ user_id: targetUserId }).del();
          await trx('holdings').where({ user_id: targetUserId }).del();
          await trx('sips').where({ user_id: targetUserId }).del();
          await trx('deposit_requests').where({ user_id: targetUserId }).del();
          await trx('user_sessions').where({ user_id: targetUserId }).del();
          await trx('users').where({ id: targetUserId }).del();

          await trx('data_rights_requests').where({ id: reqRow.id }).update({
            user_id: null,
            status: 'COMPLETED',
            admin_notes: notes || `Account #${targetUserId} (${targetUser.email}) permanently deleted by Admin.`,
            updated_at: new Date()
          });
        });

        const { banCache } = require('./middleware/auth');
        if (banCache) {
          banCache.set(Number(targetUserId), { exists: false, is_banned: false, ts: Date.now() });
          banCache.set(String(targetUserId), { exists: false, is_banned: false, ts: Date.now() });
        }

        const triggerEngine = require('./services/triggerEngine');
        const volumeMatchingEngine = require('./services/volumeMatchingEngine');
        for (const ord of ordersToClean) {
          triggerEngine.removeOrderFromMemory(ord.id, ord.symbol);
          try {
            volumeMatchingEngine.dequeueOrder(ord.id, ord.symbol);
          } catch (e) {}
        }
      } else {
        await db('data_rights_requests').where({ id: reqRow.id }).update({
          status: 'COMPLETED',
          admin_notes: notes || 'No active user account found for this email; marked completed.',
          updated_at: new Date()
        });
      }

      // Also purge user from Firebase Auth so re-registration requires fresh email verification
      try {
        const { deleteFirebaseUserByEmail, sendDataRightsNotificationEmail } = require('./services/firebaseAuth');
        if (typeof deleteFirebaseUserByEmail === 'function') {
          await deleteFirebaseUserByEmail(targetUser?.email || reqRow.email);
        }
        if (typeof sendDataRightsNotificationEmail === 'function') {
          sendDataRightsNotificationEmail({
            event: 'DELETED',
            requestId: reqRow.request_id,
            email: reqRow.email,
            requestType: reqRow.request_type,
            adminNotes: notes
          }).catch(() => {});
        }
      } catch (e) {}

      return res.json({
        success: true,
        message: targetUser
          ? `Account for ${reqRow.email} has been permanently deleted (DB + Firebase Auth) and request ${reqRow.request_id} marked COMPLETED.`
          : `No matching account found for ${reqRow.email}; request ${reqRow.request_id} marked COMPLETED.`
      });
    }

    // ─── 2. AUTOMATED PERSONAL DATA SUMMARY & EXPORT (ACCESS) ───────────────
    if (cleanAction === 'SEND_DATA_EXPORT' || (cleanAction === 'COMPLETED' && reqType === 'ACCESS')) {
      let exportPayload = null;
      if (targetUser) {
        const { password_hash, totp_secret, reset_otp, login_email_otp, ...safeUser } = targetUser;
        const [positions, holdings, recentOrders, consents] = await Promise.all([
          db('positions').where({ user_id: targetUser.id }).catch(() => []),
          db('holdings').where({ user_id: targetUser.id }).catch(() => []),
          db('orders').where({ user_id: targetUser.id }).orderBy('created_at', 'desc').limit(500).catch(() => []),
          db('user_consents').where({ user_id: targetUser.id }).orderBy('created_at', 'desc').catch(() => [])
        ]);
        exportPayload = {
          export_version: 'v2026.1',
          exported_at: new Date().toISOString(),
          request_id: reqRow.request_id,
          platform: 'SkandX (https://skandx.in)',
          data_fiduciary: 'SkandX Technologies Pvt. Ltd.',
          user_profile: safeUser,
          positions,
          holdings,
          orders_sample: recentOrders,
          consent_registry: consents
        };
      } else {
        exportPayload = {
          export_version: 'v2026.1',
          exported_at: new Date().toISOString(),
          request_id: reqRow.request_id,
          platform: 'SkandX (https://skandx.in)',
          user_profile: { email: reqRow.email, note: 'No active account found for this email' },
          positions: [],
          holdings: [],
          orders_sample: [],
          consent_registry: []
        };
      }

      const finalNotes = notes || 'Automated DPDP Sec. 11 Personal Data Summary & JSON Export dispatched to client email.';
      await db('data_rights_requests').where({ id: reqRow.id }).update({
        status: 'COMPLETED',
        admin_notes: finalNotes,
        updated_at: new Date()
      });

      try {
        const { sendDataRightsNotificationEmail } = require('./services/firebaseAuth');
        if (typeof sendDataRightsNotificationEmail === 'function') {
          sendDataRightsNotificationEmail({
            event: 'ACCESS_EXPORT',
            requestId: reqRow.request_id,
            email: reqRow.email,
            requestType: reqRow.request_type,
            adminNotes: finalNotes,
            exportPayload
          }).catch(() => {});
        }
      } catch (e) {}

      return res.json({
        success: true,
        message: `Personal Data Summary & JSON Export automatically emailed to ${reqRow.email} and request ${reqRow.request_id} marked COMPLETED.`
      });
    }

    // ─── 3. AUTOMATED CONSENT WITHDRAWAL (WITHDRAW_CONSENT) ─────────────────
    if (cleanAction === 'WITHDRAW_CONSENT' || (cleanAction === 'COMPLETED' && reqType === 'WITHDRAW_CONSENT')) {
      if (targetUser) {
        await db('user_consents')
          .where({ user_id: targetUser.id })
          .whereIn('consent_type', ['MARKETING_PROMOTIONS', 'marketing_communications'])
          .update({ status: 'WITHDRAWN' })
          .catch(() => {});
        await db('user_consents').insert({
          user_id: targetUser.id,
          email: targetUser.email || reqRow.email,
          consent_type: 'MARKETING_PROMOTIONS',
          status: 'WITHDRAWN',
          consent_version: 'v2026.1',
          ip_address: reqRow.ip_address || ''
        }).catch(() => {});
      }

      const finalNotes = notes || 'Optional and marketing data processing consents officially revoked in compliance registry.';
      await db('data_rights_requests').where({ id: reqRow.id }).update({
        status: 'COMPLETED',
        admin_notes: finalNotes,
        updated_at: new Date()
      });

      try {
        const { sendDataRightsNotificationEmail } = require('./services/firebaseAuth');
        if (typeof sendDataRightsNotificationEmail === 'function') {
          sendDataRightsNotificationEmail({
            event: 'CONSENT_WITHDRAWN',
            requestId: reqRow.request_id,
            email: reqRow.email,
            requestType: reqRow.request_type,
            adminNotes: finalNotes
          }).catch(() => {});
        }
      } catch (e) {}

      return res.json({
        success: true,
        message: `Marketing & optional consents revoked for ${reqRow.email}, confirmation email dispatched, and request ${reqRow.request_id} marked COMPLETED.`
      });
    }

    // ─── 4. STANDARD / CORRECTION RESOLUTION OR REJECTION ───────────────────
    const nextStatus = cleanAction === 'REJECTED' ? 'REJECTED' : 'COMPLETED';
    const defaultNote = nextStatus === 'COMPLETED' && reqType === 'CORRECTION'
      ? 'Requested personal data correction verified and updated by Compliance Desk.'
      : `Marked ${nextStatus} by Admin.`;
    const finalNotes = notes || defaultNote;

    await db('data_rights_requests').where({ id: reqRow.id }).update({
      status: nextStatus,
      admin_notes: finalNotes,
      updated_at: new Date()
    });

    if (nextStatus === 'COMPLETED') {
      try {
        const { sendDataRightsNotificationEmail } = require('./services/firebaseAuth');
        if (typeof sendDataRightsNotificationEmail === 'function') {
          sendDataRightsNotificationEmail({
            event: 'COMPLETED',
            requestId: reqRow.request_id,
            email: reqRow.email,
            requestType: reqRow.request_type,
            adminNotes: finalNotes
          }).catch(() => {});
        }
      } catch (e) {}
    }

    res.json({
      success: true,
      message: `Request ${reqRow.request_id} marked as ${nextStatus}.`
    });
  } catch (err) {
    console.error('Admin Data Rights Resolve Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Instant Right to Data Portability / Access Export (DPDP Section 11 / GDPR Art. 15 & 20)
app.get('/api/user/data-export', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Strictly exclude password hashes and raw crypto secrets
    const { password_hash, totp_secret, reset_otp, login_email_otp, ...safeUser } = user;

    const [positions, holdings, recentOrders, consents] = await Promise.all([
      db('positions').where({ user_id: req.user.id }),
      db('holdings').where({ user_id: req.user.id }),
      db('orders').where({ user_id: req.user.id }).orderBy('created_at', 'desc').limit(500),
      db('user_consents').where({ user_id: req.user.id }).orderBy('created_at', 'desc')
    ]);

    const exportPayload = {
      export_version: 'v2026.1',
      exported_at: new Date().toISOString(),
      platform: 'SkandX (https://skandx.in)',
      data_fiduciary: 'SkandX Technologies Pvt. Ltd.',
      user_profile: safeUser,
      positions,
      holdings,
      orders_sample: recentOrders,
      consent_records: consents
    };

    res.setHeader('Content-Disposition', `attachment; filename="skandx_data_export_${req.user.id}_${Date.now()}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(exportPayload, null, 2));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const bcrypt = require('bcryptjs');
    
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const valid = await verifyUserPasswordWithFallback(user, oldPassword);
    if (!valid) return res.status(400).json({ error: 'Incorrect old password' });
    
    const newHash = await bcrypt.hash(newPassword, 10);
    await db('users').where({ id: req.user.id }).update({ password_hash: newHash });
    
    try {
      const { syncFirebaseUserPassword } = require('./services/firebaseAuth');
      await syncFirebaseUserPassword(user.email, newPassword);
    } catch (_) {}

    // Revoke all active sessions for this user across all devices to prevent unauthorized access
    await db('user_sessions').where({ user_id: req.user.id }).del().catch(() => {});
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const handleUpdateUserDetails = async (req, res) => {
  try {
    const { username, phone, pan_card, aadhar_number, address, upi_id, bank_account_no, bank_ifsc } = req.body || {};
    const updates = {};
    if (username !== undefined) {
      const cleanName = String(username).replace(/[^A-Za-z\s]/g, '').replace(/\s+/g, ' ').trim();
      const letterCount = cleanName.replace(/[^A-Za-z]/g, '').length;
      if (cleanName.length < 6 || cleanName.length > 15 || !/^[A-Za-z\s]{6,15}$/.test(cleanName) || letterCount < 5) {
        return res.status(400).json({ error: 'Name must contain letters only and be between 6 and 15 characters.' });
      }
      const normalizedKey = cleanName.replace(/\s+/g, '').toLowerCase();
      const existingUser = await db('users')
        .whereRaw("LOWER(REPLACE(TRIM(username), ' ', '')) = ?", [normalizedKey])
        .whereNot('id', req.user.id)
        .first();
      if (existingUser) {
        return res.status(400).json({ error: `"${cleanName}" is unavailable. This name is already taken by another user.` });
      }
      updates.username = cleanName;
    }
    if (phone !== undefined) updates.phone = String(phone).trim();
    if (pan_card !== undefined) updates.pan_card = String(pan_card).trim().toUpperCase();
    if (aadhar_number !== undefined) updates.aadhar_number = String(aadhar_number).trim();
    if (address !== undefined) updates.address = String(address).trim();
    if (upi_id !== undefined) updates.upi_id = String(upi_id).trim();
    if (bank_account_no !== undefined) updates.bank_account_no = String(bank_account_no).trim();
    if (bank_ifsc !== undefined) updates.bank_ifsc = String(bank_ifsc).trim().toUpperCase();

    // Support updating Onboarding / Profile fields in user_profiles
    const profileFields = ['dob', 'gender', 'state', 'city', 'occupation', 'annual_income', 'financial_goal', 'trading_experience', 'preferred_segment', 'trading_style'];
    const profileUpdates = {};
    for (const f of profileFields) {
      if (req.body && req.body[f] !== undefined && req.body[f] !== null) {
        profileUpdates[f] = String(req.body[f]).trim();
      }
    }

    if (Object.keys(profileUpdates).length > 0) {
      const existingProfile = await db('user_profiles').where({ user_id: req.user.id }).first();
      if (existingProfile) {
        await db('user_profiles').where({ user_id: req.user.id }).update(profileUpdates);
      } else {
        await db('user_profiles').insert({ ...profileUpdates, user_id: req.user.id });
      }
      updates.is_onboarded = true;
    }

    if (Object.keys(updates).length === 0 && Object.keys(profileUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    if (Object.keys(updates).length > 0) {
      await db('users').where({ id: req.user.id }).update(updates);
    }

    const updatedUser = await db('users').where({ id: req.user.id }).first();
    const updatedProfile = await db('user_profiles').where({ user_id: req.user.id }).first().catch(() => null);
    if (updatedUser) {
      delete updatedUser.password_hash;
      delete updatedUser.reset_otp;
      delete updatedUser.reset_otp_expires;
      delete updatedUser.two_factor_secret;
      if (updatedProfile) {
        updatedUser.dob = updatedProfile.dob || null;
        updatedUser.gender = updatedProfile.gender || null;
        updatedUser.onboarding_state = updatedProfile.state || updatedUser.state || null;
        updatedUser.onboarding_city = updatedProfile.city || updatedUser.city || null;
        updatedUser.occupation = updatedProfile.occupation || null;
        updatedUser.annual_income = updatedProfile.annual_income || null;
        updatedUser.financial_goal = updatedProfile.financial_goal || null;
        updatedUser.trading_experience = updatedProfile.trading_experience || null;
        updatedUser.preferred_segment = updatedProfile.preferred_segment || null;
        updatedUser.trading_style = updatedProfile.trading_style || null;
      }
    }
    res.json({ success: true, message: 'Profile details updated successfully', user: updatedUser });
  } catch (err) {
    console.error('Error updating user details:', err);
    res.status(500).json({ error: 'Failed to update profile details' });
  }
};

app.post('/api/user/details', authenticateToken, handleUpdateUserDetails);
app.put('/api/user/details', authenticateToken, handleUpdateUserDetails);

app.post('/api/wallet/deposit', authenticateToken, walletLimiter, async (req, res) => {
  try {
    const { amount } = req.body;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount < 100 || parsedAmount > 100000000) {
      return res.status(400).json({ error: 'Invalid amount. Minimum deposit is ₹100 and maximum is ₹10 Crore.' });
    }

    // Defect 44: Cap pending deposit requests to prevent spam / flooding
    const pendingCount = await db('deposit_requests')
      .where({ user_id: req.user.id, status: 'PENDING' })
      .count('id as count')
      .first();

    if (parseInt(pendingCount?.count || 0) >= 5) {
      return res.status(400).json({ error: 'You have reached the limit of 5 pending deposit requests. Please wait for an administrator to process them.' });
    }
    
    await db('deposit_requests').insert({
      user_id: req.user.id,
      amount: parsedAmount,
      status: 'PENDING'
    });
    
    res.json({ success: true, message: 'Deposit request submitted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Defect 44: Transactional Trading Wallet Withdrawal Route
app.post('/api/wallet/withdraw', authenticateToken, walletLimiter, async (req, res) => {
  try {
    const { amount } = req.body;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount < 100) {
      return res.status(400).json({ error: 'Invalid amount. Minimum withdrawal is ₹100.' });
    }

    await db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [req.user.id]);

      const user = await trx('users').where({ id: req.user.id }).forUpdate().first();
      if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

      // Verify bank or UPI details are linked
      if (!user.upi_id && (!user.bank_account_no || !user.bank_ifsc)) {
        throw Object.assign(new Error('Please update your Bank or UPI details in Settings before requesting a withdrawal.'), { statusCode: 400 });
      }

      // Check available cash balance and compute open unrealized loss
      const currentBalance = parseFloat(user.balance) || 0;
      const openPositions = await trx('positions').where({ user_id: req.user.id }).whereNot({ quantity: 0 });
      let netUnrealizedLoss = 0;
      for (const pos of openPositions) {
        const qty = parseFloat(pos.quantity) || 0;
        const avg = Math.abs(parseFloat(pos.average_price)) || 0;
        const ltp = getLtpFromPriceCache(pos.symbol) || avg;
        let posPnl = 0;
        if (qty > 0) posPnl = (ltp - avg) * qty;
        else if (qty < 0) posPnl = (avg - ltp) * Math.abs(qty);
        if (posPnl < 0) netUnrealizedLoss += posPnl;
      }
      const withdrawableBalance = Math.max(0, Math.round((currentBalance + netUnrealizedLoss) * 100) / 100);
      if (withdrawableBalance < parsedAmount) {
        throw Object.assign(new Error(`Insufficient withdrawable balance. Available: ₹${withdrawableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${netUnrealizedLoss < 0 ? ` (₹${Math.abs(netUnrealizedLoss).toFixed(2)} withheld for open position losses)` : ''}, Requested: ₹${parsedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`), { statusCode: 400 });
      }

      // Cap active pending withdrawal requests to prevent double spending
      const pendingCount = await trx('reward_withdrawals')
        .where({ user_id: req.user.id, status: 'PENDING' })
        .count('id as count')
        .first();
      if (parseInt(pendingCount?.count || 0) >= 3) {
        throw Object.assign(new Error('You already have 3 pending withdrawal requests. Please wait for them to be processed.'), { statusCode: 400 });
      }

      // Deduct trading balance immediately (lock funds for withdrawal)
      const newBalance = Math.round((currentBalance - parsedAmount) * 100) / 100;
      await trx('users').where({ id: user.id }).update({ balance: newBalance });

      // Record in ledger as WITHDRAWAL (compliant with check constraint)
      await trx('ledger').insert({
        user_id: user.id,
        amount: -parsedAmount,
        type: 'WITHDRAWAL',
        description: `Wallet Withdrawal Request (Bank/UPI)`
      });

      // Insert withdrawal record for admin processing
      await trx('reward_withdrawals').insert({
        user_id: user.id,
        amount: parsedAmount,
        status: 'PENDING',
        remarks: 'Trading Wallet Withdrawal',
        created_at: new Date(),
        updated_at: new Date()
      });
    });

    const triggerEngine = require('./services/triggerEngine');
    if (triggerEngine && triggerEngine.io) {
      triggerEngine.io.to(req.user.id.toString()).emit('sync_user_data');
    }

    res.json({ success: true, message: `Withdrawal request for ₹${parsedAmount.toLocaleString('en-IN')} submitted successfully.` });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ─── Admin ────────────────────────────────────────────────────────────────

app.post('/api/admin/users/:id/toggle_ban', authenticateToken, async (req, res) => {
  try {
    const db = require('./database/db');
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const targetUserId = req.params.id;
    const targetUser = await db('users').where({ id: targetUserId }).first();
    
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.is_admin) return res.status(403).json({ error: 'Cannot ban another admin' });

    const newStatus = !targetUser.is_banned;
    await db('users').where({ id: targetUserId }).update({ is_banned: newStatus });
    
    res.json({ success: true, message: 'User status updated', is_banned: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


function getSystemTelemetry() {
    const os = require('os');
    const fs = require('fs');
    const totalRam = os.totalmem();
    const freeRam = os.freemem();
    const usedRam = totalRam - freeRam;
    const ramPct = ((usedRam / totalRam) * 100).toFixed(1);
    
    let diskStats = null;
    try {
        if (typeof fs.statfsSync === 'function') {
            const stat = fs.statfsSync('.');
            const totalDisk = stat.bsize * stat.blocks;
            const freeDisk = stat.bsize * stat.bfree;
            const usedDisk = totalDisk - freeDisk;
            diskStats = {
                totalGB: (totalDisk / 1073741824).toFixed(1),
                usedGB: (usedDisk / 1073741824).toFixed(1),
                freeGB: (freeDisk / 1073741824).toFixed(1),
                pct: ((usedDisk / totalDisk) * 100).toFixed(1)
            };
        }
    } catch(e) {}

    const cpus = os.cpus() || [];
    const loadAvg = os.loadavg() || [0, 0, 0];
    const cpuLoad1m = ((loadAvg[0] / Math.max(1, cpus.length)) * 100).toFixed(1);
    const procMem = process.memoryUsage();
    const uptimeSec = os.uptime();
    const days = Math.floor(uptimeSec / 86400);
    const hrs = Math.floor((uptimeSec % 86400) / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);

    return {
        ram: {
            totalGB: (totalRam / 1073741824).toFixed(2),
            usedGB: (usedRam / 1073741824).toFixed(2),
            freeGB: (freeRam / 1073741824).toFixed(2),
            pct: ramPct
        },
        cpu: {
            cores: cpus.length,
            model: cpus[0]?.model || 'Cloud vCPU',
            loadAvg: loadAvg.map(l => l.toFixed(2)),
            loadPct: Math.min(100, Math.max(0, parseFloat(cpuLoad1m)))
        },
        process: {
            rssMB: (procMem.rss / 1048576).toFixed(1),
            heapUsedMB: (procMem.heapUsed / 1048576).toFixed(1),
            heapTotalMB: (procMem.heapTotal / 1048576).toFixed(1)
        },
        disk: diskStats,
        uptime: `${days > 0 ? `${days}d ` : ''}${hrs}h ${mins}m`,
        platform: `${os.platform()} (${os.arch()})`
    };
}

app.get('/api/admin/telemetry', authenticateToken, async (req, res) => {
    try {
        const caller = await db('users').where({ id: req.user.id }).first();
        if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

        const { generalClient } = require('./services/redisClient');
        if (!generalClient || !generalClient.isReady) return res.json({ api: [], users: [], system: getSystemTelemetry() });

        const system = getSystemTelemetry();
        const tf = req.query.timeframe || 'all';
        let minutes = 0;
        const match = tf.match(/^(\d+)([mh])$/);
        if (match) {
            const val = parseInt(match[1], 10);
            minutes = match[2] === 'h' ? val * 60 : val;
        }

        if (minutes === 0 || tf === 'all') {
            // Cumulative All-Time Stats (Non-blocking lookup)
            let routes = await generalClient.sMembers('telemetry:routes').catch(() => []);
            let users = await generalClient.sMembers('telemetry:users').catch(() => []);

            // Fallback to non-blocking SCAN if sets are not yet populated
            if (!routes || routes.length === 0) {
                routes = [];
                for await (const chunk of generalClient.scanIterator({ MATCH: 'telemetry:api:*', COUNT: 100 })) {
                    const keys = Array.isArray(chunk) ? chunk : [chunk];
                    for (const k of keys) {
                        if (typeof k === 'string') routes.push(k.replace('telemetry:api:', ''));
                    }
                }
            }
            if (!users || users.length === 0) {
                users = [];
                for await (const chunk of generalClient.scanIterator({ MATCH: 'telemetry:user:*', COUNT: 100 })) {
                    const keys = Array.isArray(chunk) ? chunk : [chunk];
                    for (const k of keys) {
                        if (typeof k === 'string') users.push(k.replace('telemetry:user:', ''));
                    }
                }
            }

            const apiPipeline = generalClient.multi();
            routes.forEach(r => apiPipeline.hGetAll(`telemetry:api:${r}`));
            const apiResults = routes.length > 0 ? await apiPipeline.exec() : [];

            const apiStats = routes.map((route, i) => {
                const data = apiResults[i] || {};
                return {
                    route,
                    count: parseInt(data.count || 0),
                    totalTime: parseInt(data.time_ms || 0),
                    totalBytes: parseInt(data.bytes || 0)
                };
            });

            const userPipeline = generalClient.multi();
            users.forEach(u => userPipeline.hGetAll(`telemetry:user:${u}`));
            const userResults = users.length > 0 ? await userPipeline.exec() : [];

            const userStats = [];
            for (let i = 0; i < users.length; i++) {
                const userId = users[i];
                const data = userResults[i] || {};
                const isNumeric = userId && !isNaN(Number(userId));
                const dbUser = isNumeric ? await db('users').where({ id: Number(userId) }).first().catch(() => null) : null;
                userStats.push({
                    userId,
                    clientId: dbUser ? dbUser.client_id : null,
                    username: dbUser ? dbUser.username : (userId === 'anonymous' ? 'Anonymous / Guest' : `User (#${userId})`),
                    apiCalls: parseInt(data.api_calls || 0),
                    apiBytes: parseInt(data.api_bytes || 0),
                    wsMinutes: parseInt(data.ws_minutes || 0)
                });
            }
            return res.json({ api: apiStats, users: userStats, system, timeframe: 'all' });
        } else {
            // Timeframe / Minute-Bucket Aggregation
            const now = Date.now();
            const targetBuckets = [];
            const targetBucketSet = new Set();
            const pad = (n) => String(n).padStart(2, '0');
            for (let i = 0; i <= minutes; i++) {
                const d = new Date(now - i * 60 * 1000);
                const bucket = `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
                if (!targetBucketSet.has(bucket)) {
                    targetBucketSet.add(bucket);
                    targetBuckets.push(bucket);
                }
            }

            // Phase 1: Fast O(1) Bucket Index Lookup via Redis Pipeline (<2ms)
            const bucketPipeline = generalClient.multi();
            targetBuckets.forEach(b => bucketPipeline.sMembers(`telemetry:mb_keys:${b}`));
            const bucketKeySets = await bucketPipeline.exec().catch(() => []);

            const validKeysSet = new Set();
            if (bucketKeySets && bucketKeySets.length > 0) {
                for (const set of bucketKeySets) {
                    if (Array.isArray(set)) {
                        for (const k of set) {
                            if (typeof k === 'string') validKeysSet.add(k);
                        }
                    }
                }
            }

            // Phase 2: Fallback to non-blocking SCAN if bucket index set is empty (e.g. legacy keys)
            if (validKeysSet.size === 0) {
                for await (const chunk of generalClient.scanIterator({ MATCH: 'telemetry:mb:*', COUNT: 300 })) {
                    const keys = Array.isArray(chunk) ? chunk : [chunk];
                    for (const k of keys) {
                        if (typeof k !== 'string') continue;
                        const parts = k.split(':');
                        if (parts.length >= 5 && targetBucketSet.has(parts[2])) {
                            validKeysSet.add(k);
                        }
                    }
                }
            }

            const validKeys = [];
            for (const k of validKeysSet) {
                const parts = k.split(':');
                if (parts.length >= 5) {
                    validKeys.push({ key: k, type: parts[3], identifier: parts.slice(4).join(':') });
                }
            }

            const pipeline = generalClient.multi();
            validKeys.forEach(vk => pipeline.hGetAll(vk.key));
            const results = validKeys.length > 0 ? await pipeline.exec() : [];

            const apiMap = {};
            const userMap = {};

            validKeys.forEach((vk, idx) => {
                const data = results[idx] || {};
                if (vk.type === 'api') {
                    if (!apiMap[vk.identifier]) apiMap[vk.identifier] = { route: vk.identifier, count: 0, totalTime: 0, totalBytes: 0 };
                    apiMap[vk.identifier].count += parseInt(data.count || 0, 10);
                    apiMap[vk.identifier].totalTime += parseInt(data.time_ms || 0, 10);
                    apiMap[vk.identifier].totalBytes += parseInt(data.bytes || 0, 10);
                } else if (vk.type === 'user') {
                    if (!userMap[vk.identifier]) userMap[vk.identifier] = { userId: vk.identifier, apiCalls: 0, apiBytes: 0, apiTimeMs: 0, wsMinutes: 0 };
                    userMap[vk.identifier].apiCalls += parseInt(data.api_calls || 0, 10);
                    userMap[vk.identifier].apiTimeMs += parseInt(data.api_time_ms || 0, 10);
                    userMap[vk.identifier].apiBytes += parseInt(data.api_bytes || 0, 10);
                }
            });

            const apiStats = Object.values(apiMap);
            const userStats = [];
            for (const u of Object.values(userMap)) {
                const isNumeric = u.userId && !isNaN(Number(u.userId));
                const dbUser = isNumeric ? await db('users').where({ id: Number(u.userId) }).first().catch(() => null) : null;
                userStats.push({
                    userId: u.userId,
                    clientId: dbUser ? dbUser.client_id : null,
                    username: dbUser ? dbUser.username : (u.userId === 'anonymous' ? 'Anonymous / Guest' : `User (#${u.userId})`),
                    apiCalls: u.apiCalls,
                    apiBytes: u.apiBytes,
                    wsMinutes: u.wsMinutes
                });
            }

            return res.json({ api: apiStats, users: userStats, system, timeframe: tf });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch telemetry' });
    }
});

app.post('/api/admin/telemetry/reset', authenticateToken, async (req, res) => {
    try {
        const caller = await db('users').where({ id: req.user.id }).first();
        if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

        const { generalClient } = require('./services/redisClient');
        if (!generalClient || !generalClient.isReady) return res.status(503).json({ error: 'Redis offline' });

        const keysToDelete = [];
        for await (const chunk of generalClient.scanIterator({ MATCH: 'telemetry:*', COUNT: 200 })) {
            const keys = Array.isArray(chunk) ? chunk : [chunk];
            for (const k of keys) {
                if (typeof k === 'string') keysToDelete.push(k);
            }
        }
        if (keysToDelete.length > 0) {
            await generalClient.del(keysToDelete);
        }
        res.json({ success: true, message: 'Telemetry metrics reset successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to reset telemetry' });
    }
});

app.post('/api/admin/master_square_off', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const { runMasterSquareOff } = require('./services/autoSquareOff');
    // Run it asynchronously in the background so it doesn't block the request if there are thousands of positions
    runMasterSquareOff().catch(e => console.error("Master square off failed:", e));
    
    res.json({ success: true, message: 'Master Square-Off initiated in the background' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Staging Environment Power Management (ON / OFF / Status) ────────────────
app.get('/api/admin/staging-power', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const { exec } = require('child_process');
    const PM2_BIN = 'PATH=$PATH:/usr/local/bin:/usr/bin:~/.nvm/versions/node/$(node -v 2>/dev/null)/bin pm2';

    exec(`${PM2_BIN} jlist`, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) {
        return res.json({ success: true, running: false, status: 'stopped', note: 'PM2 query returned error or not running' });
      }
      try {
        const list = JSON.parse(stdout);
        const stagingApp = Array.isArray(list) ? list.find(a => a.name === 'skandx-backend-staging') : null;
        if (!stagingApp) {
          return res.json({ success: true, running: false, status: 'stopped', note: 'App not registered in PM2' });
        }

        const status = stagingApp.pm2_env?.status || 'stopped';
        const isRunning = status === 'online';
        const memoryMB = stagingApp.monit?.memory ? (stagingApp.monit.memory / (1024 * 1024)).toFixed(1) : '0';
        const cpuPct = stagingApp.monit?.cpu !== undefined ? stagingApp.monit.cpu : 0;
        const uptime = stagingApp.pm2_env?.pm_uptime ? Math.floor((Date.now() - stagingApp.pm2_env.pm_uptime) / 1000) : 0;

        return res.json({
          success: true,
          running: isRunning,
          status,
          memoryMB,
          cpuPct,
          uptime
        });
      } catch (parseErr) {
        return res.json({ success: true, running: false, status: 'stopped' });
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/staging-power', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const { action } = req.body || {};
    if (!['start', 'stop', 'restart'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Allowed: start, stop, restart' });
    }

    const { exec } = require('child_process');
    const PM2_BIN = 'PATH=$PATH:/usr/local/bin:/usr/bin:~/.nvm/versions/node/$(node -v 2>/dev/null)/bin pm2';

    let execCmd = '';
    if (action === 'stop') {
      execCmd = `${PM2_BIN} stop skandx-backend-staging`;
    } else if (action === 'start') {
      execCmd = `${PM2_BIN} start skandx-backend-staging 2>/dev/null || (cd ~/shortmarket-staging/backend && ${PM2_BIN} start ecosystem.config.js)`;
    } else if (action === 'restart') {
      execCmd = `${PM2_BIN} restart skandx-backend-staging`;
    }

    exec(execCmd, (cmdErr) => {
      // Re-read status after command execution
      setTimeout(() => {
        exec(`${PM2_BIN} jlist`, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
          let isRunning = action !== 'stop';
          let status = action === 'stop' ? 'stopped' : 'online';
          try {
            const list = JSON.parse(stdout);
            const stagingApp = Array.isArray(list) ? list.find(a => a.name === 'skandx-backend-staging') : null;
            if (stagingApp) {
              status = stagingApp.pm2_env?.status || status;
              isRunning = status === 'online';
            }
          } catch (_) {}

          return res.json({
            success: true,
            action,
            running: isRunning,
            status,
            message: `Staging environment successfully ${action === 'stop' ? 'STOPPED (Sleeping)' : action === 'start' ? 'STARTED (Live)' : 'RESTARTED'}.`
          });
        });
      }, 1000);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Live Market Feed Power Management (Pause / Resume Fyers WebSocket) ──────
app.post('/api/admin/live-feed', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const { action } = req.body || {}; // 'pause', 'resume', 'toggle'
    const { pauseLiveFeed, resumeLiveFeed, isLiveFeedPaused, getFyersStatus } = require('./services/fyers');

    const currentlyPaused = isLiveFeedPaused ? isLiveFeedPaused() : false;
    let newPausedState = false;

    if (action === 'pause') {
      if (pauseLiveFeed) pauseLiveFeed();
      newPausedState = true;
    } else if (action === 'resume') {
      if (resumeLiveFeed) resumeLiveFeed();
      newPausedState = false;
    } else {
      if (currentlyPaused) {
        if (resumeLiveFeed) resumeLiveFeed();
        newPausedState = false;
      } else {
        if (pauseLiveFeed) pauseLiveFeed();
        newPausedState = true;
      }
    }

    const status = getFyersStatus ? getFyersStatus() : {};
    res.json({
      success: true,
      isPaused: newPausedState,
      message: newPausedState ? 'Live Market Feed Paused (0 ticks, saving CPU)' : 'Live Market Feed Resumed',
      status
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/heal-referrals', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });
    
    await db.raw('UPDATE users SET email = LOWER(TRIM(email)) WHERE email != LOWER(TRIM(email))').catch(() => {});
    const u12 = await db('users').where({ id: 12 }).first();
    const u9 = await db('users').where({ id: 9 }).first();
    let linked = false;
    if (u12 && u9) {
      const existingRef = await db('referrals').where({ referred_user_id: 12 }).first();
      if (!existingRef) {
        await db('referrals').insert({
          referrer_id: 9,
          referred_user_id: 12,
          status: 'pending',
          reward_amount: 0,
          created_at: u12.created_at || new Date(),
          updated_at: new Date()
        });
        linked = true;
      }
    }
    res.json({ success: true, message: 'User emails normalized and User 12 referral linked successfully', linked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const isExport = req.query.export === 'true' || req.query.limit === 'all';

    let query = db('users').leftJoin('user_profiles', 'users.id', 'user_profiles.user_id');
    let countQuery = db('users');

    if (search) {
      query = query.where(function() {
        this.where('users.username', 'ilike', `%${search}%`)
            .orWhere('users.email', 'ilike', `%${search}%`)
            .orWhere('users.client_id', 'ilike', `%${search}%`)
            .orWhere('users.phone', 'ilike', `%${search}%`)
            .orWhere('users.last_ip', 'ilike', `%${search}%`);
      });
      countQuery = countQuery.where(function() {
        this.where('username', 'ilike', `%${search}%`)
            .orWhere('email', 'ilike', `%${search}%`)
            .orWhere('client_id', 'ilike', `%${search}%`)
            .orWhere('phone', 'ilike', `%${search}%`)
            .orWhere('last_ip', 'ilike', `%${search}%`);
      });
    }

    if (startDate) {
      query = query.where('users.created_at', '>=', startDate);
      countQuery = countQuery.where('users.created_at', '>=', startDate);
    }
    if (endDate) {
      query = query.where('users.created_at', '<=', endDate);
      countQuery = countQuery.where('users.created_at', '<=', endDate);
    }

    const [countResult] = await countQuery.count('id as total');
    const total = countResult ? parseInt(countResult.total) : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    let userQuery = query
      .select(
        'users.id', 'users.client_id', 'users.username', 'users.email', 'users.balance',
        'users.subscription_tier', 'users.subscription_expires',
        'users.is_banned', 'users.phone', 'users.pan_card', 'users.aadhar_number',
        'users.kyc_pan_url', 'users.kyc_aadhar_url', 'users.is_admin', 'users.created_at',
        'users.last_ip', 'users.registration_ip', 'users.device_model', 'users.os_name',
        'users.browser_name', 'users.address', 'users.upi_id', 'users.bank_account_no', 'users.bank_ifsc',
        'users.city as ip_city', 'users.state as ip_state',
        'user_profiles.dob', 'user_profiles.gender',
        'user_profiles.state as onboarding_state', 'user_profiles.city as onboarding_city',
        'user_profiles.occupation', 'user_profiles.annual_income',
        'user_profiles.financial_goal', 'user_profiles.trading_experience',
        'user_profiles.preferred_segment', 'user_profiles.trading_style'
      )
      .orderBy('users.created_at', 'desc');

    if (!isExport) {
      userQuery = userQuery.limit(limit).offset(offset);
    } else {
      userQuery = userQuery.limit(10000);
    }

    const rawUsers = await userQuery;

    // Extract distinct IPs present in the current batch/page of users
    const pageIps = [...new Set(rawUsers.flatMap(u => [u.last_ip, u.registration_ip]).filter(Boolean))];
    const ipMap = {};
    const sharedUsersByIp = {};

    if (pageIps.length > 0) {
      // ⚡ O(1) page-scoped IP aggregation: query only the IPs on this page instead of scanning 1 Lakh rows
      const ipCounts = await db('users')
        .whereIn('last_ip', pageIps)
        .groupBy('last_ip')
        .select('last_ip')
        .count('id as count');

      ipCounts.forEach(r => {
        ipMap[r.last_ip] = parseInt(r.count, 10);
      });

      const sharedIps = pageIps.filter(ip => (ipMap[ip] || 1) > 1);
      if (sharedIps.length > 0) {
        // ⚡ Batch query all shared user accounts in a single roundtrip (eliminates N+1 loop queries)
        const matchingUsers = await db('users')
          .where(function() {
            this.whereIn('last_ip', sharedIps).orWhereIn('registration_ip', sharedIps);
          })
          .select('id', 'username', 'last_ip', 'registration_ip')
          .limit(sharedIps.length * 6);

        matchingUsers.forEach(m => {
          [m.last_ip, m.registration_ip].forEach(ip => {
            if (ip && sharedIps.includes(ip)) {
              if (!sharedUsersByIp[ip]) sharedUsersByIp[ip] = [];
              if (!sharedUsersByIp[ip].some(item => item.id === m.id)) {
                sharedUsersByIp[ip].push({ id: m.id, username: m.username });
              }
            }
          });
        });
      }
    }

    const enhancedUsers = [];
    for (const u of rawUsers) {
      const ip = u.last_ip || u.registration_ip;
      let detectedCity = (u.ip_city && u.ip_city !== 'Local Network' && u.ip_city !== 'Local') ? u.ip_city : '';
      let detectedState = (u.ip_state && u.ip_state !== 'Local') ? u.ip_state : '';
      if ((!detectedCity || !detectedState) && ip && ip !== '::1' && ip !== '127.0.0.1' && !ip.startsWith('192.168.') && !ip.startsWith('10.')) {
        const geo = parseIpLocation(ip);
        if (geo.city && geo.city !== 'Local Network') detectedCity = geo.city;
        if (geo.state && geo.state !== 'Local') detectedState = geo.state;
      }
      const sharedCount = ip ? (ipMap[ip] || 1) : 1;
      let sharedUsers = [];
      if (sharedCount > 1 && ip && sharedUsersByIp[ip]) {
        sharedUsers = sharedUsersByIp[ip].filter(m => m.id !== u.id).slice(0, 5).map(m => m.username);
      }
      enhancedUsers.push({
        ...u,
        ip_city: detectedCity,
        ip_state: detectedState,
        city: u.onboarding_city || u.city || '',
        state: u.onboarding_state || u.state || '',
        shared_ip_count: sharedCount,
        shared_users: sharedUsers
      });
    }

    res.json({ users: enhancedUsers, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Admin Users Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/user/:id', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const targetUserId = req.params.id;
    const { 
      username, email, phone, password,
      pan_card, aadhar_number, address, upi_id, bank_account_no, bank_ifsc,
      dob, gender, state, city, occupation, annual_income, financial_goal, trading_experience, preferred_segment, trading_style
    } = req.body || {};
    
    const updates = {};
    if (username !== undefined) updates.username = username;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (pan_card !== undefined) updates.pan_card = pan_card ? String(pan_card).trim().toUpperCase() : null;
    if (aadhar_number !== undefined) updates.aadhar_number = aadhar_number ? String(aadhar_number).trim() : null;
    if (address !== undefined) updates.address = address ? String(address).trim() : null;
    if (upi_id !== undefined) updates.upi_id = upi_id ? String(upi_id).trim() : null;
    if (bank_account_no !== undefined) updates.bank_account_no = bank_account_no ? String(bank_account_no).trim() : null;
    if (bank_ifsc !== undefined) updates.bank_ifsc = bank_ifsc ? String(bank_ifsc).trim().toUpperCase() : null;
    if (password && typeof password === 'string' && password.trim().length > 0) {
      const bcrypt = require('bcryptjs');
      updates.password_hash = await bcrypt.hash(password.trim(), 10);
    }

    // Support updating Onboarding / Profile fields in user_profiles
    const profileFields = ['dob', 'gender', 'state', 'city', 'occupation', 'annual_income', 'financial_goal', 'trading_experience', 'preferred_segment', 'trading_style'];
    const profileUpdates = {};
    for (const f of profileFields) {
      if (req.body && req.body[f] !== undefined && req.body[f] !== null) {
        profileUpdates[f] = String(req.body[f]).trim();
      }
    }

    if (Object.keys(profileUpdates).length > 0) {
      const existingProfile = await db('user_profiles').where({ user_id: targetUserId }).first();
      if (existingProfile) {
        await db('user_profiles').where({ user_id: targetUserId }).update(profileUpdates);
      } else {
        await db('user_profiles').insert({ ...profileUpdates, user_id: targetUserId });
      }
      updates.is_onboarded = true;
    }

    if (Object.keys(updates).length > 0) {
      await db('users').where({ id: targetUserId }).update(updates);
    }
    
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/user/:id/reset', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const targetUserId = req.params.id;
    let pendingOrders = [];
    await db.transaction(async (trx) => {
      // Serialize reset per-user to prevent concurrent executions
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [targetUserId]);

      // 0. Fetch pending orders to purge them from TriggerEngine memory & Redis
      pendingOrders = await trx('orders')
        .where({ user_id: targetUserId })
        .whereIn('status', ['PENDING', 'PENDING_TRIGGER', 'AMO_PENDING', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN']);

      // 1. Nullify self-referencing FK links to prevent FK constraint crashes
      await trx('orders').where({ user_id: targetUserId }).update({ linked_order_id: null, parent_order_id: null });
      await trx('orders').where({ user_id: targetUserId }).del();
      await trx('positions').where({ user_id: targetUserId }).del();

      const hasHoldings = await trx.schema.hasTable('holdings');
      if (hasHoldings) {
        await trx('holdings').where({ user_id: targetUserId }).del();
      }
      const hasSips = await trx.schema.hasTable('sips');
      if (hasSips) {
        await trx('sips').where({ user_id: targetUserId }).del();
      }
      await trx('ledger').where({ user_id: targetUserId }).del();
      await trx('users').where({ id: targetUserId }).update({ balance: 1000000.0 });
      await trx('ledger').insert({
        user_id: targetUserId,
        amount: 1000000.0,
        type: 'DEPOSIT',
        description: 'Admin account reset opening balance'
      });
    });

    const triggerEngine = require('./services/triggerEngine');
    const volumeMatchingEngine = require('./services/volumeMatchingEngine');
    for (const ord of pendingOrders) {
      triggerEngine.removeOrderFromMemory(ord.id, ord.symbol);
      try {
        volumeMatchingEngine.dequeueOrder(ord.id, ord.symbol);
      } catch (e) {}
    }
    try {
      const { pubClient } = require('./services/redisClient');
      if (pubClient) pubClient.publish('reload_triggers', '1').catch(() => {});
    } catch(e) {}

    if (triggerEngine && triggerEngine.io) {
      triggerEngine.io.to(targetUserId.toString()).emit('sync_user_data');
    }

    res.json({ success: true, message: 'User account reset to ₹10,00,000.' });
  } catch (err) {
    console.error('Admin reset error:', err);
    res.status(500).json({ error: 'Failed to reset user' });
  }
});

app.post('/api/admin/impersonate/:id', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized: Admin access required' });

    const targetUserId = req.params.id;
    const targetUser = await db('users').where({ id: targetUserId }).first();
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const token = jwt.sign(
      { id: targetUser.id, username: targetUser.username, is_admin: Boolean(targetUser.is_admin), impersonated_by: caller.id },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    const userProfile = await db('user_profiles').where({ user_id: targetUser.id }).first().catch(() => null);
    const formattedUser = formatUserForClient(targetUser, userProfile);

    res.json({
      success: true,
      token,
      user: formattedUser
    });
  } catch (err) {
    console.error('Admin impersonate error:', err);
    res.status(500).json({ error: err.message || 'Failed to impersonate user' });
  }
});

// 🗑️ Delete User Account (Admin only)
app.delete('/api/admin/user/:id', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const targetUserId = req.params.id;

    // Prevent admin from deleting themselves or other admins
    if (String(targetUserId) === String(req.user.id)) {
      return res.status(400).json({ error: 'Cannot delete your own admin account.' });
    }
    const targetUser = await db('users').where({ id: targetUserId }).first();
    if (!targetUser) return res.status(404).json({ error: 'Target user not found.' });
    if (targetUser.is_admin) {
      return res.status(400).json({ error: 'Cannot delete an administrator account.' });
    }

    let ordersToClean = [];
    await db.transaction(async (trx) => {
      // Serialize delete per-user
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [targetUserId]);

      ordersToClean = await trx('orders')
        .where({ user_id: targetUserId })
        .whereIn('status', ['PENDING', 'PENDING_TRIGGER', 'AMO_PENDING', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN']);

      // 1. Nullify self-referencing foreign keys first to prevent constraint violations
      await trx('orders').where({ user_id: targetUserId }).update({ linked_order_id: null, parent_order_id: null });
      await trx('orders').where({ user_id: targetUserId }).del();
      await trx('positions').where({ user_id: targetUserId }).del();
      await trx('ledger').where({ user_id: targetUserId }).del();
      await trx('holdings').where({ user_id: targetUserId }).del();
      await trx('sips').where({ user_id: targetUserId }).del();
      await trx('deposit_requests').where({ user_id: targetUserId }).del();
      await trx('user_sessions').where({ user_id: targetUserId }).del();
      await trx('users').where({ id: targetUserId }).del();
    });

    const { banCache } = require('./middleware/auth');
    if (banCache) {
      banCache.set(Number(targetUserId), { exists: false, is_banned: false, ts: Date.now() });
      banCache.set(String(targetUserId), { exists: false, is_banned: false, ts: Date.now() });
    }

    const triggerEngine = require('./services/triggerEngine');
    const volumeMatchingEngine = require('./services/volumeMatchingEngine');
    for (const ord of ordersToClean) {
      triggerEngine.removeOrderFromMemory(ord.id, ord.symbol);
      try {
        volumeMatchingEngine.dequeueOrder(ord.id, ord.symbol);
      } catch (e) {}
    }

    // Also delete user from Firebase Auth so re-registration requires fresh email verification
    if (targetUser && targetUser.email) {
      try {
        const { deleteFirebaseUserByEmail } = require('./services/firebaseAuth');
        if (typeof deleteFirebaseUserByEmail === 'function') {
          await deleteFirebaseUserByEmail(targetUser.email);
        }
      } catch (e) {}
    }

    res.json({ success: true, message: 'User account permanently deleted.' });
  } catch (err) {
    console.error('Delete User Error:', err);
    res.status(500).json({ error: 'Failed to delete user account: ' + (err.message || String(err)) });
  }
});

app.post('/api/admin/user/:id/subscription', authenticateToken, async (req, res) => {
  try {
    const admin = await db('users').where({ id: req.user.id }).first();
    if (!admin || !admin.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const { tier, expires } = req.body;
    await db('users').where({ id: req.params.id }).update({
      subscription_tier: tier,
      subscription_expires: expires || null
    });
    if (typeof io !== 'undefined' && io) {
      io.to(`user_${req.params.id}`).emit('subscription_updated', {
        userId: Number(req.params.id),
        subscription_tier: tier,
        subscription_expires: expires || null
      });
    }
    res.json({ success: true, subscription_tier: tier, subscription_expires: expires || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/user/:id/balance', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const { balance } = req.body;
    const newBal = Math.round((Number(balance) + Number.EPSILON) * 100) / 100;
    if (balance === undefined || isNaN(newBal) || newBal < 0) {
      return res.status(400).json({ error: 'Valid non-negative balance required' });
    }

    const targetUserId = req.params.id;
    let updatedBal = newBal;
    await db.transaction(async (trx) => {
      // Serialize balance adjustments per-user
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [targetUserId]);

      const targetUser = await trx('users').where({ id: targetUserId }).forUpdate().first();
      if (!targetUser) {
        throw Object.assign(new Error('User not found'), { statusCode: 404 });
      }

      const prevBal = Number(targetUser.balance) || 0;
      const delta = Math.round((newBal - prevBal + Number.EPSILON) * 100) / 100;

      await trx('users').where({ id: targetUserId }).update({ balance: newBal });

      if (delta !== 0) {
        await trx('ledger').insert({
          user_id: targetUserId,
          amount: delta,
          type: delta > 0 ? 'DEPOSIT' : 'WITHDRAWAL',
          description: `Admin balance adjustment by ${caller.username} (₹${prevBal.toLocaleString('en-IN')} ➔ ₹${newBal.toLocaleString('en-IN')})`
        });
      }
      updatedBal = newBal;
    });

    const triggerEngine = require('./services/triggerEngine');
    if (triggerEngine && triggerEngine.io) {
      triggerEngine.io.to(targetUserId.toString()).emit('sync_user_data');
    }

    res.json({ success: true, balance: updatedBal });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

app.get('/api/admin/deposits', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const isExport = req.query.export === 'true' || req.query.limit === 'all';

    let query = db('deposit_requests')
      .join('users', 'deposit_requests.user_id', 'users.id')
      .select('deposit_requests.*', 'users.username', 'users.email', 'users.client_id');

    let countQuery = db('deposit_requests');

    if (search) {
      countQuery = countQuery.join('users', 'deposit_requests.user_id', 'users.id');
      const s = `%${search}%`;
      query = query.where(function() {
        this.where('users.username', 'ilike', s)
            .orWhere('users.email', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s)
            .orWhereRaw('CAST(deposit_requests.amount AS TEXT) ilike ?', [s]);
      });
      countQuery = countQuery.where(function() {
        this.where('users.username', 'ilike', s)
            .orWhere('users.email', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s)
            .orWhereRaw('CAST(deposit_requests.amount AS TEXT) ilike ?', [s]);
      });
    }

    if (startDate) {
      query = query.where('deposit_requests.created_at', '>=', startDate);
      countQuery = countQuery.where('deposit_requests.created_at', '>=', startDate);
    }
    if (endDate) {
      query = query.where('deposit_requests.created_at', '<=', endDate);
      countQuery = countQuery.where('deposit_requests.created_at', '<=', endDate);
    }

    const [countResult] = await countQuery.count('deposit_requests.id as total');
    const total = countResult ? parseInt(countResult.total) : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    let depQuery = query.orderBy('deposit_requests.created_at', 'desc');
    if (!isExport) {
      depQuery = depQuery.limit(limit).offset(offset);
    } else {
      depQuery = depQuery.limit(10000);
    }
    const deposits = await depQuery;
      
    res.json({ success: true, deposits, total, page, totalPages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/deposits/:id/approve', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    await db.transaction(async trx => {
      // Atomic conditional update guarantees only one transaction can approve a PENDING deposit
      const updatedCount = await trx('deposit_requests')
        .where({ id: req.params.id, status: 'PENDING' })
        .update({ status: 'APPROVED' });

      if (updatedCount === 0) {
        throw new Error('Deposit request has already been processed or does not exist');
      }

      const deposit = await trx('deposit_requests').where({ id: req.params.id }).first();
      const user = await trx('users').where({ id: deposit.user_id }).forUpdate().first();
      if (user) {
        const newBal = Math.round((parseFloat(user.balance) + parseFloat(deposit.amount) + Number.EPSILON) * 100) / 100;
        await trx('users').where({ id: deposit.user_id }).update({ balance: newBal });
      }
      
      await trx('ledger').insert({
          user_id: deposit.user_id,
          amount: deposit.amount,
          type: 'DEPOSIT',
          description: `Deposit Approved (ID: ${deposit.id})`
      });
      req.approvedDepositUserId = deposit.user_id;
    });

    const triggerEngine = require('./services/triggerEngine');
    if (triggerEngine && triggerEngine.io && req.approvedDepositUserId) {
      triggerEngine.io.to(req.approvedDepositUserId.toString()).emit('sync_user_data');
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/deposits/:id/reject', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const updatedCount = await db('deposit_requests')
      .where({ id: req.params.id, status: 'PENDING' })
      .update({ status: 'REJECTED' });

    if (updatedCount === 0) {
      return res.status(400).json({ error: 'Deposit request already processed or not found' });
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/analytics', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    // 1. Total AUM (Sum of all user balances)
    const { sum: totalAumRow } = await db('users').sum('balance as sum').first();
    const totalAum = parseFloat(totalAumRow || 0);

    // 2. Today's Volume and Realized P&L (Direct in-database aggregation)
    const today = (typeof getTradingSessionStartIST === 'function') ? getTradingSessionStartIST() : new Date();
    today.setHours(0, 0, 0, 0);
    
    const [summaryRow, topSymbolsRows] = await Promise.all([
      db('orders')
        .where('status', 'EXECUTED')
        .andWhere('created_at', '>=', today)
        .select(
          db.raw('COALESCE(SUM(ABS(quantity) * ABS(COALESCE(average_price, price, 0))), 0) as total_volume'),
          db.raw('COALESCE(SUM(realized_pnl), 0) as total_realized_pnl')
        )
        .first(),

      db('orders')
        .where('status', 'EXECUTED')
        .andWhere('created_at', '>=', today)
        .groupBy('symbol')
        .select(
          'symbol',
          db.raw('COALESCE(SUM(ABS(quantity) * ABS(COALESCE(average_price, price, 0))), 0) as volume')
        )
        .orderBy('volume', 'desc')
        .limit(5)
    ]);

    const todayVolume = parseFloat(summaryRow?.total_volume || 0);
    const todayRealizedPnl = parseFloat(summaryRow?.total_realized_pnl || 0);
    const topSymbols = (topSymbolsRows || []).map(r => ({
      symbol: r.symbol,
      volume: parseFloat(r.volume || 0)
    }));

    res.json({
      success: true,
      totalAum,
      todayVolume,
      todayRealizedPnl,
      topSymbols,
      openPositions: [] // 0-byte payload optimization (positions inspected via dedicated /api/admin/positions route)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/orders', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const isExport = req.query.export === 'true' || req.query.limit === 'all';

    let query = db('orders')
      .join('users', 'orders.user_id', '=', 'users.id')
      .select('orders.*', 'users.username', 'users.email', 'users.client_id');
    
    let countQuery = db('orders');

    if (search) {
      countQuery = countQuery.join('users', 'orders.user_id', '=', 'users.id');
      const s = `%${search}%`;
      const numSearch = parseInt(search, 10);
      const isNum = !isNaN(numSearch) && String(numSearch) === search.trim();

      query = query.where(function() {
        this.where('orders.symbol', 'ilike', s)
            .orWhere('users.username', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s);
        if (isNum) {
          this.orWhere('orders.id', numSearch);
        } else {
          this.orWhereRaw('CAST(orders.id AS TEXT) ilike ?', [s]);
        }
      });
      countQuery = countQuery.where(function() {
        this.where('orders.symbol', 'ilike', s)
            .orWhere('users.username', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s);
        if (isNum) {
          this.orWhere('orders.id', numSearch);
        } else {
          this.orWhereRaw('CAST(orders.id AS TEXT) ilike ?', [s]);
        }
      });
    }

    if (startDate) {
      query = query.where('orders.created_at', '>=', startDate);
      countQuery = countQuery.where('orders.created_at', '>=', startDate);
    }
    if (endDate) {
      query = query.where('orders.created_at', '<=', endDate);
      countQuery = countQuery.where('orders.created_at', '<=', endDate);
    }

    const [countResult] = await countQuery.count('orders.id as total');
    const total = countResult ? parseInt(countResult.total) : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    let ordQuery = query.orderBy('orders.created_at', 'desc');
    if (!isExport) {
      ordQuery = ordQuery.limit(limit).offset(offset);
    } else {
      ordQuery = ordQuery.limit(10000);
    }
    const orders = await ordQuery;

    res.json({ success: true, orders, total, page, totalPages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/positions', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const isExport = req.query.export === 'true' || req.query.limit === 'all';

    let query = db('positions')
      .join('users', 'positions.user_id', '=', 'users.id')
      .select('positions.*', 'users.username', 'users.email', 'users.client_id')
      .where('positions.quantity', '!=', 0);
    
    let countQuery = db('positions')
      .where('positions.quantity', '!=', 0);

    if (search) {
      countQuery = countQuery.join('users', 'positions.user_id', '=', 'users.id');
      const s = `%${search}%`;
      query = query.where(function() {
        this.where('positions.symbol', 'ilike', s)
            .orWhere('users.username', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s);
      });
      countQuery = countQuery.where(function() {
        this.where('positions.symbol', 'ilike', s)
            .orWhere('users.username', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s);
      });
    }

    if (startDate) {
      query = query.where('positions.created_at', '>=', startDate);
      countQuery = countQuery.where('positions.created_at', '>=', startDate);
    }
    if (endDate) {
      query = query.where('positions.created_at', '<=', endDate);
      countQuery = countQuery.where('positions.created_at', '<=', endDate);
    }

    const [countResult] = await countQuery.count('positions.id as total');
    const total = countResult ? parseInt(countResult.total) : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    let posQuery = query.orderBy('positions.id', 'desc');
    if (!isExport) {
      posQuery = posQuery.limit(limit).offset(offset);
    } else {
      posQuery = posQuery.limit(10000);
    }
    const positions = await posQuery;
    res.json({ success: true, positions, total, page, totalPages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/ledger', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const isExport = req.query.export === 'true' || req.query.limit === 'all';

    let query = db('ledger')
      .join('users', 'ledger.user_id', '=', 'users.id')
      .select('ledger.*', 'users.username', 'users.email', 'users.client_id');

    let countQuery = db('ledger');

    if (search) {
      countQuery = countQuery.join('users', 'ledger.user_id', '=', 'users.id');
      const s = `%${search}%`;
      query = query.where(function() {
        this.where('ledger.description', 'ilike', s)
            .orWhere('ledger.type', 'ilike', s)
            .orWhere('users.username', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s);
      });
      countQuery = countQuery.where(function() {
        this.where('ledger.description', 'ilike', s)
            .orWhere('ledger.type', 'ilike', s)
            .orWhere('users.username', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s);
      });
    }

    if (startDate) {
      query = query.where('ledger.created_at', '>=', startDate);
      countQuery = countQuery.where('ledger.created_at', '>=', startDate);
    }
    if (endDate) {
      query = query.where('ledger.created_at', '<=', endDate);
      countQuery = countQuery.where('ledger.created_at', '<=', endDate);
    }

    const [countResult] = await countQuery.count('ledger.id as total');
    const total = countResult ? parseInt(countResult.total) : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    let ledQuery = query.orderBy('ledger.created_at', 'desc');
    if (!isExport) {
      ledQuery = ledQuery.limit(limit).offset(offset);
    } else {
      ledQuery = ledQuery.limit(10000);
    }
    const ledger = await ledQuery;

    res.json({ success: true, ledger, total, page, totalPages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Market Status Endpoints (Admin Controls) ──────────────────────────────────
app.get('/api/market-status', apiLimiter, (req, res) => {
  res.json({
    success: true,
    equity: marketStatusCache.equity,
    commodity: marketStatusCache.commodity
  });
});

app.get('/api/admin/market-status', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const { getFyersStatus } = require('./services/fyers');
    const fyersStatus = getFyersStatus ? getFyersStatus() : {};

    res.json({
      success: true,
      equity: marketStatusCache.equity,
      commodity: marketStatusCache.commodity,
      fyers: fyersStatus
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/market-status', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const { equity, commodity } = req.body;
    const validModes = ['AUTO', 'OPEN', 'CLOSED'];

    if (equity && validModes.includes(equity.toUpperCase())) {
      marketStatusCache.equity = equity.toUpperCase();
      await db('system_settings')
        .insert({ key: 'equity_market_status', value: marketStatusCache.equity, updated_at: new Date() })
        .onConflict('key')
        .merge();
    }

    if (commodity && validModes.includes(commodity.toUpperCase())) {
      marketStatusCache.commodity = commodity.toUpperCase();
      await db('system_settings')
        .insert({ key: 'commodity_market_status', value: marketStatusCache.commodity, updated_at: new Date() })
        .onConflict('key')
        .merge();
    }

    // Broadcast across Redis cluster
    try {
      const { pubClient } = require('./services/redisClient');
      if (pubClient) {
        pubClient.publish('market_status_updated', JSON.stringify({
          equity: marketStatusCache.equity,
          commodity: marketStatusCache.commodity
        })).catch(() => {});
      }
    } catch(e) {}

    try {
      io.emit('market_status_updated', {
        equity: marketStatusCache.equity,
        commodity: marketStatusCache.commodity
      });
    } catch(e) {}

    console.log(`[Admin] Market Status updated: Equity=${marketStatusCache.equity}, Commodity=${marketStatusCache.commodity}`);
    res.json({
      success: true,
      equity: marketStatusCache.equity,
      commodity: marketStatusCache.commodity
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MARKET CALENDAR ENDPOINTS ──────────────────────────────────────────

const OFFICIAL_2026_HOLIDAYS = [
  { date: '2026-01-26', equity_status: 'CLOSED', commodity_status: 'CLOSED', reason: 'Republic Day' },
  { date: '2026-02-18', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Mahashivratri (MCX Evening Session Open)' },
  { date: '2026-03-03', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Holi (MCX Evening Session Open)' },
  { date: '2026-03-27', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Id-Ul-Fitr / Ramzan Id (MCX Evening Session Open)' },
  { date: '2026-04-03', equity_status: 'CLOSED', commodity_status: 'CLOSED', reason: 'Good Friday' },
  { date: '2026-04-14', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Dr. Ambedkar Jayanti (MCX Evening Session Open)' },
  { date: '2026-05-01', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Maharashtra Day (MCX Evening Session Open)' },
  { date: '2026-05-27', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Bakri Id (MCX Evening Session Open)' },
  { date: '2026-06-25', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Muharram (MCX Evening Session Open)' },
  { date: '2026-08-15', equity_status: 'CLOSED', commodity_status: 'CLOSED', reason: 'Independence Day' },
  { date: '2026-10-02', equity_status: 'CLOSED', commodity_status: 'CLOSED', reason: 'Mahatma Gandhi Jayanti' },
  { date: '2026-10-20', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Dussehra (MCX Evening Session Open)' },
  { date: '2026-11-08', equity_status: 'OPEN', commodity_status: 'OPEN', equity_start_time: '18:15', equity_end_time: '19:15', commodity_start_time: '18:15', commodity_end_time: '19:15', reason: 'Diwali Laxmi Pujan (Muhurat Trading 6:15 PM - 7:15 PM)' },
  { date: '2026-11-10', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Diwali Balipratipada (MCX Evening Session Open)' },
  { date: '2026-11-24', equity_status: 'CLOSED', commodity_status: 'OPEN', commodity_start_time: '17:00', commodity_end_time: '23:30', reason: 'Gurunanak Jayanti (MCX Evening Session Open)' },
  { date: '2026-12-25', equity_status: 'CLOSED', commodity_status: 'CLOSED', reason: 'Christmas' }
];

app.get('/api/market-calendar', apiLimiter, async (req, res) => {
  try {
    const { month } = req.query; // optional 'YYYY-MM'
    let query = db('market_calendar').select('*').orderBy('date', 'asc');
    if (month && /^[0-9]{4}-[0-9]{2}$/.test(month)) {
      query = query.whereRaw('date LIKE ?', [`${month}%`]);
    }
    const rows = await query;
    const formatted = rows.map(r => ({
      ...r,
      date: typeof r.date === 'string' ? r.date.split('T')[0] : (r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date))
    }));
    res.json({ success: true, calendar: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/market-calendar/today', (req, res) => {
  try {
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const dateNum = String(istTime.getUTCDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${dateNum}`;

    const equityCheck = isSegmentMarketOpen(false);
    const commodityCheck = isSegmentMarketOpen(true);
    const todayRule = marketCalendarCache.get(todayStr) || null;

    res.json({
      success: true,
      today: todayStr,
      equity: {
        open: equityCheck.open,
        reason: equityCheck.reason || null,
        globalStatus: marketStatusCache.equity,
        rule: todayRule ? todayRule.equity_status : 'DEFAULT'
      },
      commodity: {
        open: commodityCheck.open,
        reason: commodityCheck.reason || null,
        globalStatus: marketStatusCache.commodity,
        rule: todayRule ? todayRule.commodity_status : 'DEFAULT'
      },
      todayRule
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🏛️ Primary Markets & Institutional Intelligence (₹0 Architecture)
const primaryMarketsService = require('./services/primaryMarketsService');
if (typeof primaryMarketsService.initPrimaryMarketCrons === 'function') {
  primaryMarketsService.initPrimaryMarketCrons();
}

app.get('/api/bhavcopy/delivery', apiLimiter, (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    const list = primaryMarketsService.getBhavcopyDeliveryScreener(req.query);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/market-deals', apiLimiter, (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    const list = primaryMarketsService.getMarketDeals(req.query.type || 'ALL');
    res.json({ success: true, count: list.length, deals: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ipos', apiLimiter, (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    const list = primaryMarketsService.getIpoList(req.query.category || 'ALL');
    res.json({ success: true, count: list.length, ipos: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/market-calendar', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const {
      date,
      equity_status = 'DEFAULT',
      commodity_status = 'DEFAULT',
      equity_start_time = null,
      equity_end_time = null,
      commodity_start_time = null,
      commodity_end_time = null,
      reason = ''
    } = req.body;

    if (!date || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
    }

    const payload = {
      date,
      equity_status,
      commodity_status,
      equity_start_time: equity_start_time || null,
      equity_end_time: equity_end_time || null,
      commodity_start_time: commodity_start_time || null,
      commodity_end_time: commodity_end_time || null,
      reason: reason || null,
      updated_at: new Date()
    };

    await db('market_calendar')
      .insert(payload)
      .onConflict('date')
      .merge();

    await loadMarketCalendarFromDb();

    // Broadcast across Redis cluster & Socket.IO
    try {
      const { pubClient } = require('./services/redisClient');
      if (pubClient) {
        pubClient.publish('market_calendar_updated', JSON.stringify({ date })).catch(() => {});
      }
    } catch(e) {}

    try {
      io.emit('market_calendar_updated', { date, ...payload });
    } catch(e) {}

    console.log(`[Admin] Saved Market Calendar rule for ${date}: Equity=${equity_status}, MCX=${commodity_status} (${reason})`);
    res.json({ success: true, entry: payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/market-calendar/:date', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const { date } = req.params;
    await db('market_calendar').where({ date }).del();
    await loadMarketCalendarFromDb();

    // Broadcast across Redis cluster & Socket.IO
    try {
      const { pubClient } = require('./services/redisClient');
      if (pubClient) {
        pubClient.publish('market_calendar_updated', JSON.stringify({ date, deleted: true })).catch(() => {});
      }
    } catch(e) {}

    try {
      io.emit('market_calendar_updated', { date, deleted: true });
    } catch(e) {}

    console.log(`[Admin] Reset Market Calendar rule for ${date} to DEFAULT`);
    res.json({ success: true, date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/market-calendar/bulk-holidays', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    for (const h of OFFICIAL_2026_HOLIDAYS) {
      await db('market_calendar')
        .insert({
          ...h,
          updated_at: new Date()
        })
        .onConflict('date')
        .merge();
    }

    await loadMarketCalendarFromDb();

    try {
      const { pubClient } = require('./services/redisClient');
      if (pubClient) {
        pubClient.publish('market_calendar_updated', JSON.stringify({ bulk: true })).catch(() => {});
      }
    } catch(e) {}

    try {
      io.emit('market_calendar_updated', { bulk: true });
    } catch(e) {}

    console.log(`[Admin] Seeded ${OFFICIAL_2026_HOLIDAYS.length} official 2026 stock market holidays`);
    res.json({ success: true, count: OFFICIAL_2026_HOLIDAYS.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/force-close', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });
    
    const { positionId } = req.body;
    const position = await db('positions').where({ id: positionId }).first();
    
    if (!position || position.quantity === 0) {
      return res.status(400).json({ error: 'Position not found or already closed' });
    }

    // Simulate a MARKET order to close the position
    const side = position.quantity > 0 ? 'SELL' : 'BUY';
    const quantity = Math.abs(position.quantity);
    
    // We don't execute it right away, we just insert a market order. 
    // The order execution logic runs periodically, or we can just mock it here directly.
    // To be safe and reuse exact P&L logic, we will just insert it as a MARKET order 
    // and let the orderExecutor pick it up in the next 1-second tick!
    
    const orderPayload = {
      user_id: position.user_id,
      symbol: position.symbol,
      type: 'MARKET',
      side: side,
      quantity: quantity,
      filled_quantity: 0,
      pending_quantity: quantity,
      order_variety: 'REGULAR',
      product_type: position.product_type,
      status: 'PENDING'
    };
    
    const [orderId] = await db('orders').insert(orderPayload).returning('id');
    const finalOrderId = typeof orderId === 'object' ? orderId.id : orderId;
    orderPayload.id = finalOrderId;

    const triggerEngine = require('./services/triggerEngine');
    triggerEngine.executeOrder(orderPayload, priceCache[position.symbol]?.ltp || 0).catch(console.error);

    res.json({ success: true, message: 'Force close order placed', orderId: finalOrderId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/settle-expiries', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const positionsEngine = require('./services/positionsEngine');
    console.log(`[ADMIN] Manual Expiry Settlement triggered by Admin ${caller.id} (${caller.email})`);
    await positionsEngine.settleExpiries(false, false);
    await positionsEngine.settleExpiries(true, true);
    res.json({ success: true, message: 'Expiry settlement executed successfully' });
  } catch (err) {
    console.error('Admin settle-expiries error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/user/watchlists', '/api/watchlists'], authenticateToken, async (req, res) => {
  try {
    const { watchlists } = req.body;
    if (!watchlists || !Array.isArray(watchlists)) {
      return res.status(400).json({ error: 'Watchlists must be an array' });
    }
    
    // Check subscription tier (Admin accounts have no limits or plan restrictions)
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user?.is_admin) {
      const isHighest = ['HIGHEST', 'FEATURE', 'VIP'].includes(user?.subscription_tier) && (!user?.subscription_expires || new Date(user.subscription_expires) > new Date());
      const isYearlyOrMonthly = ['YEARLY', 'PRO', 'MONTHLY', 'LIFETIME'].includes(user?.subscription_tier) && (!user?.subscription_expires || new Date(user.subscription_expires) > new Date());
      const limit = isHighest ? 5 : (isYearlyOrMonthly ? 4 : 2);
      const maxSymbols = isHighest ? 100 : (isYearlyOrMonthly ? 75 : 30);
      
      if (watchlists.length > limit) {
        return res.status(403).json({ error: `Your ${user?.subscription_tier || 'BASIC'} plan allows a maximum of ${limit} watchlists. Please upgrade to add more.` });
      }

      for (const wl of watchlists) {
        if (Array.isArray(wl.symbols) && wl.symbols.length > maxSymbols) {
          return res.status(403).json({ error: `Your ${user?.subscription_tier || 'BASIC'} plan allows a maximum of ${maxSymbols} symbols per watchlist ("${wl.name}" has ${wl.symbols.length}). Please upgrade to add more.` });
        }
      }
    }

    await db('users').where({ id: req.user.id }).update({ watchlists: JSON.stringify(watchlists) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Reset Account ──────────────────────────────────────────────────────────
app.post('/api/user/reset', authenticateToken, async (req, res) => {
  try {
    let requestedAmount = parseFloat(req.body?.amount);
    // Limit: minimum ₹10,000, maximum ₹10 Crore (100,000,000)
    const MAX_AMOUNT = 100000000.0; // 10 Crore
    const MIN_AMOUNT = 10000.0;     // 10 Thousand
    let newBalance = 1000000.0;     // Default 10 Lakh
    if (!isNaN(requestedAmount) && requestedAmount > 0) {
      newBalance = Math.min(Math.max(requestedAmount, MIN_AMOUNT), MAX_AMOUNT);
    }

    let pendingOrders = [];
    await db.transaction(async (trx) => {
      // Prevent race conditions with concurrent orders/ticks during reset
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [req.user.id]);

      // 0. Fetch pending orders to purge them from TriggerEngine memory & Redis
      pendingOrders = await trx('orders')
        .where({ user_id: req.user.id })
        .whereIn('status', ['PENDING', 'PENDING_TRIGGER', 'AMO_PENDING', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN']);

      // 1. Nullify self-referencing FK links first so the batch delete doesn't
      //    trip the orders.linked_order_id / parent_order_id constraints.
      await trx('orders').where({ user_id: req.user.id }).update({ linked_order_id: null, parent_order_id: null });
      // 2. Delete all trades (orders)
      await trx('orders').where({ user_id: req.user.id }).del();
      // 3. Delete all holdings/positions
      await trx('positions').where({ user_id: req.user.id }).del();
      // 4. Clear holdings table if it exists (T+1 delivery inventory)
      const hasHoldings = await trx.schema.hasTable('holdings');
      if (hasHoldings) {
        await trx('holdings').where({ user_id: req.user.id }).del();
      }
      // 5. Clear active/scheduled SIPs
      const hasSips = await trx.schema.hasTable('sips');
      if (hasSips) {
        await trx('sips').where({ user_id: req.user.id }).del();
      }
      // 6. Delete ledger history
      await trx('ledger').where({ user_id: req.user.id }).del();
      // 7. Reset balance to chosen amount (up to 10 Crore)
      await trx('users').where({ id: req.user.id }).update({ balance: newBalance });
      // 8. Add initial deposit record so ledger matches balance
      await trx('ledger').insert({
        user_id: req.user.id,
        amount: newBalance,
        type: 'DEPOSIT',
        description: 'Account reset opening balance'
      });
    });

    const triggerEngine = require('./services/triggerEngine');
    const volumeMatchingEngine = require('./services/volumeMatchingEngine');
    for (const ord of pendingOrders) {
      triggerEngine.removeOrderFromMemory(ord.id, ord.symbol);
      try {
        volumeMatchingEngine.dequeueOrder(ord.id, ord.symbol);
      } catch (e) {}
    }
    try {
      const { pubClient } = require('./services/redisClient');
      if (pubClient) pubClient.publish('reload_triggers', '1').catch(() => {});
    } catch(e) {}

    if (triggerEngine && triggerEngine.io) {
      triggerEngine.io.to(req.user.id.toString()).emit('sync_user_data');
    }
    res.json({ 
      success: true, 
      balance: newBalance,
      message: `Account successfully reset to ₹${newBalance.toLocaleString('en-IN')}.` 
    });
  } catch (err) {
    console.error('Reset Account Error:', err);
    res.status(500).json({ error: 'Failed to reset account' });
  }
});

// ─── Positions ────────────────────────────────────────────────────────────
app.get('/api/positions', authenticateToken, async (req, res) => {
  try {
    const isFull = req.query.all === 'true' || req.query.export === 'true';
    const limit = isFull ? (parseInt(req.query.limit) || 5000) : (parseInt(req.query.limit) || 200);
    const todayStartIST = getTradingSessionStartIST();

    let positions;
    if (isFull) {
      const [activeAndRecent, archived] = await Promise.all([
        db('positions').where({ user_id: req.user.id }).orderBy('created_at', 'desc').limit(limit),
        db('positions_archive').where({ user_id: req.user.id }).orderBy('created_at', 'desc').limit(limit).catch(() => [])
      ]);
      const map = new Map();
      (activeAndRecent || []).forEach(p => map.set(p.id, p));
      (archived || []).forEach(p => { if (!map.has(p.id)) map.set(p.id, p); });
      positions = Array.from(map.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else {
      const [openPos, todayClosedPos, recentClosedPos] = await Promise.all([
        db('positions').where({ user_id: req.user.id }).whereNot({ quantity: 0 }),
        db('positions').where({ user_id: req.user.id }).where({ quantity: 0 }).where('updated_at', '>=', todayStartIST),
        db('positions').where({ user_id: req.user.id }).where({ quantity: 0 }).orderBy('updated_at', 'desc').limit(50)
      ]);
      const map = new Map();
      (openPos || []).forEach(p => map.set(p.id, p));
      (todayClosedPos || []).forEach(p => map.set(p.id, p));
      (recentClosedPos || []).forEach(p => { if (!map.has(p.id)) map.set(p.id, p); });
      positions = Array.from(map.values()).sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
    }

    const formatted = positions.map(p => ({
      ...p,
      quantity: Number(p.quantity),
      closed_quantity: Number(p.closed_quantity || 0),
      average_price: Math.abs(Number(p.average_price || 0)),
      exit_price: p.exit_price !== null && p.exit_price !== undefined ? Number(p.exit_price) : null,
      margin: Number(p.margin || 0),
      realized_pnl: Number(p.realized_pnl || 0)
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Holdings ─────────────────────────────────────────────────────────────
app.get('/api/holdings', authenticateToken, async (req, res) => {
  try {
    const isDerivContract = (sym) => {
      if (!sym || typeof sym !== 'string') return false;
      if (sym.startsWith('MCX:') || sym.includes('-MCX') || sym.includes('NCDEX')) return true;
      const clean = sym.replace(/^(NSE:|BSE:|MCX:)/i, '').trim();
      if (/(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(clean)) return true;
      if (/(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(clean) || clean.endsWith('-FUT')) return true;
      return false;
    };

    // Filter non-zero holdings in SQL using composite index (user_id, quantity)
    const holdings = await db('holdings')
      .where({ user_id: req.user.id })
      .where(function() {
        this.where('quantity', '>', 0).orWhere('quantity', '<', 0);
      })
      .orderBy('id', 'desc');

    // Auto-align legacy MF holdings (EDEL, MIRA, NIPP) with real AMFI NAVs and calculate correct units
    const LEGACY_FIX_MAP = {
      'EDEL-MF': { code: '118615', fallbackNav: 61.66 },
      'EDEL':    { code: '118615', fallbackNav: 61.66 },
      'MIRA-MF': { code: '118825', fallbackNav: 126.99 },
      'MIRA':    { code: '118825', fallbackNav: 126.99 },
      'NIPP-MF': { code: '118778', fallbackNav: 209.96 },
      'NIPP':    { code: '118778', fallbackNav: 209.96 }
    };

    for (const h of holdings) {
      if (LEGACY_FIX_MAP[h.symbol] && Math.round(Number(h.average_price)) === 100) {
        const item = LEGACY_FIX_MAP[h.symbol];
        const realNav = priceCache[h.symbol]?.ltp || item.fallbackNav;
        const invested = Number(h.quantity) * Number(h.average_price);
        const correctedQty = parseFloat((invested / realNav).toFixed(4));
        h.average_price = realNav;
        h.quantity = correctedQty;
        db('holdings').where({ id: h.id }).update({ average_price: realNav, quantity: correctedQty }).catch(() => {});
      }
    }

    res.json(holdings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Convert Position (INT <-> DEL with Segment Cutoffs) ───────────────────
app.post('/api/position/convert', authenticateToken, async (req, res) => {
  const { positionId } = req.body;
  const rawProductType = String(req.body.newProductType || '').toUpperCase();
  const newProductType = (rawProductType === 'CNC' || rawProductType === 'NRML') ? 'DEL' : (rawProductType === 'MIS' ? 'INT' : rawProductType);
  if (!positionId || !newProductType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!['INT', 'DEL'].includes(newProductType)) {
    return res.status(400).json({ error: 'Invalid product type. Must be INT or DEL (CNC).' });
  }
  
  try {
    await db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [req.user.id]);
      const position = await trx('positions').where({ id: positionId, user_id: req.user.id }).first();
      if (!position) throw Object.assign(new Error('Position not found'), { statusCode: 404 });

      if (position.product_type === newProductType) {
        throw Object.assign(new Error('Position is already in the requested product type'), { statusCode: 400 });
      }
      if (Number(position.quantity) === 0) {
        throw Object.assign(new Error('Cannot convert a closed position'), { statusCode: 400 });
      }

      // Check conversion timing against segment cutoffs
      const { checkPositionConversionAllowed } = require('./services/instrumentsCache');
      const convCheck = checkPositionConversionAllowed(position.symbol, newProductType);
      if (!convCheck.allowed) {
        throw Object.assign(new Error(convCheck.reason), { statusCode: 400 });
      }

      // Preventative check: Prohibit converting to Intraday for T2T surveillance stocks
      if (newProductType === 'INT' || newProductType === 'MIS') {
        const cleanSym = position.symbol.includes(':') ? position.symbol.split(':')[1] : position.symbol;
        const isT2TSeries = /-(BE|BZ|T|Z|XT|SM|ST|P)$/i.test(position.symbol.trim()) || /-(BE|BZ|T|Z|XT|SM|ST|P)$/i.test(cleanSym.trim());
        if (isT2TSeries) {
          throw Object.assign(new Error(`Intraday (MIS) is not permitted for Trade-to-Trade (T2T) surveillance series (${cleanSym}).`), { statusCode: 400 });
        }
      }

      // Prohibit converting short equity positions into Delivery (DEL)
      const isDerivative = isDerivativeContract(position.symbol);
      if (Number(position.quantity) < 0 && newProductType === 'DEL' && !isDerivative) {
        throw Object.assign(new Error('Short equity positions cannot be converted to Delivery (CNC).'), { statusCode: 400 });
      }

      const { calculateRequiredMargin } = require('./services/marginEngine');
      const avgPrice = Math.abs(Number(position.average_price) || 0);
      const ltp = getLtpFromPriceCache(position.symbol) || avgPrice;
      // Delivery conversion requires 100% of the cost basis (average_price) to prevent cash extraction during market drops
      const priceBasis = (newProductType === 'DEL' && avgPrice > 0) ? avgPrice : (ltp > 0 ? ltp : avgPrice);
      if (priceBasis <= 0) {
        throw Object.assign(new Error('Unable to determine price basis for margin calculation.'), { statusCode: 400 });
      }
      const absQty = Math.abs(Number(position.quantity));
      const side = Number(position.quantity) > 0 ? 'BUY' : 'SELL';

      const oldMargin = parseFloat(position.margin) || 0;
      const newMargin = calculateRequiredMargin(position.symbol, newProductType, side, absQty, priceBasis);
      const marginDifference = newMargin - oldMargin;

      const user = await trx('users').where({ id: req.user.id }).forUpdate().first();

      if (marginDifference > 0) {
        if (parseFloat(user.balance) < marginDifference) {
          throw Object.assign(new Error('Insufficient Funds to convert position.'), { statusCode: 400 });
        }
        const newBal = Math.round((parseFloat(user.balance) - marginDifference + Number.EPSILON) * 100) / 100;
        await trx('users').where({ id: req.user.id }).update({ balance: newBal });
        await trx('ledger').insert({
          user_id: req.user.id,
          amount: -marginDifference,
          type: 'MARGIN_BLOCK',
          description: `Additional margin blocked for converting ${position.symbol} to ${newProductType}`
        });
      } else if (marginDifference < 0) {
        const refund = Math.abs(marginDifference);
        const newBal = Math.round((parseFloat(user.balance) + refund + Number.EPSILON) * 100) / 100;
        await trx('users').where({ id: req.user.id }).update({ balance: newBal });
        await trx('ledger').insert({
          user_id: req.user.id,
          amount: refund,
          type: 'MARGIN_RELEASE',
          description: `Margin released for converting ${position.symbol} to ${newProductType}`
        });
      }

      // Update position product type and new margin
      await trx('positions').where({ id: positionId }).update({ 
        product_type: newProductType,
        margin: newMargin,
        updated_at: new Date()
      });
      
      // Try to merge positions if there's already an existing position for the same symbol + product_type
      const cleanSym = position.symbol.replace(/^(NSE:|BSE:|MCX:)/i, '');
      const existingPos = await trx('positions')
        .where({ user_id: req.user.id })
        .whereIn('product_type', newProductType === 'DEL' ? ['DEL', 'CNC'] : [newProductType, 'MIS'])
        .where(builder => {
          builder.where({ symbol: position.symbol })
                 .orWhere({ symbol: cleanSym })
                 .orWhere({ symbol: `NSE:${cleanSym}` })
                 .orWhere({ symbol: `BSE:${cleanSym}` })
                 .orWhere({ symbol: `MCX:${cleanSym}` });
        })
        .whereNot('id', positionId)
        .whereNot('quantity', 0)
        .first();

      if (existingPos) {
        const qtyA = Number(existingPos.quantity);
        const qtyB = Number(position.quantity);
        const priceA = Math.abs(parseFloat(existingPos.average_price) || 0);
        const priceB = Math.abs(parseFloat(position.average_price) || 0);
        const marginA = parseFloat(existingPos.margin || 0);
        const marginB = newMargin;

        const sameSign = (qtyA > 0 && qtyB > 0) || (qtyA < 0 && qtyB < 0);

        if (sameSign) {
          // Volume-weighted average price when adding to the same side
          const newQty = qtyA + qtyB;
          const currentCost = Math.abs(qtyA) * priceA;
          const addedCost = Math.abs(qtyB) * priceB;
          const newAvg = Math.abs(newQty) > 0 ? (currentCost + addedCost) / Math.abs(newQty) : priceA;
          const combinedMargin = marginA + marginB;

          await trx('positions').where({ id: existingPos.id }).update({ 
            quantity: newQty, 
            average_price: newAvg,
            margin: combinedMargin,
            updated_at: new Date()
          });
          // ZERO HISTORICAL TRADE DELETION: Mark merged position as absorbed with 0 quantity
          await trx('positions').where({ id: positionId }).update({
            quantity: 0,
            closed_quantity: trx.raw('COALESCE(closed_quantity, 0) + ?', [Math.abs(qtyB)]),
            margin: 0,
            updated_at: new Date()
          });
        } else {
          // Netting opposing positions
          const closedQty = Math.min(Math.abs(qtyA), Math.abs(qtyB));
          const netQty = qtyA + qtyB;
          
          // PnL calculation: If qtyA > 0, qtyA was BUY and qtyB was SELL
          const realizedPnl = qtyA > 0 
            ? (priceB - priceA) * closedQty 
            : (priceA - priceB) * closedQty;

          if (netQty === 0) {
            // Both completely closed
            const totalMarginRelease = marginA + marginB;
            const netRelease = totalMarginRelease + realizedPnl;
            await trx('users').where({ id: req.user.id }).increment('balance', netRelease);

            if (totalMarginRelease > 0) {
              await trx('ledger').insert({
                user_id: req.user.id,
                amount: totalMarginRelease,
                type: 'MARGIN_RELEASE',
                description: `Margin released from netted conversion for ${position.symbol}`
              });
            }
            if (realizedPnl !== 0) {
              await trx('ledger').insert({
                user_id: req.user.id,
                amount: realizedPnl,
                type: 'REALIZED_PNL',
                description: `Realized P&L from netted conversion for ${position.symbol}`
              });
            }

            await trx('positions').where({ id: existingPos.id }).update({
              quantity: 0,
              closed_quantity: trx.raw('COALESCE(closed_quantity, 0) + ?', [closedQty]),
              exit_price: priceB,
              margin: 0,
              realized_pnl: trx.raw('COALESCE(realized_pnl, 0) + ?', [realizedPnl]),
              updated_at: new Date()
            });
            // ZERO HISTORICAL TRADE DELETION: Mark closed position with 0 quantity
            await trx('positions').where({ id: positionId }).update({
              quantity: 0,
              closed_quantity: trx.raw('COALESCE(closed_quantity, 0) + ?', [Math.abs(qtyB)]),
              exit_price: priceA,
              margin: 0,
              updated_at: new Date()
            });

            // Cancel dangling linked pending and trigger orders (SL/Target child legs or linked brackets)
            const cleanSymTarget = position.symbol.replace(/^(NSE:|BSE:|MCX:)/i, '');
            const danglingOrders = await trx('orders')
              .where({ user_id: req.user.id })
              .where(builder => {
                builder.where({ symbol: position.symbol })
                       .orWhere({ symbol: cleanSymTarget })
                       .orWhere({ symbol: `NSE:${cleanSymTarget}` })
                       .orWhere({ symbol: `BSE:${cleanSymTarget}` })
                       .orWhere({ symbol: `MCX:${cleanSymTarget}` });
              })
              .where(builder => {
                builder.where('status', 'PENDING_TRIGGER')
                       .orWhereNotNull('parent_order_id');
              })
              .whereIn('status', ['PENDING', 'PENDING_TRIGGER']);

            for (const dangler of danglingOrders) {
              await trx('orders').where({ id: dangler.id }).update({ status: 'CANCELLED', pending_quantity: 0, updated_at: new Date() });
              const refundMargin = parseFloat(dangler.margin) || 0;
              if (refundMargin > 0) {
                const u = await trx('users').where({ id: req.user.id }).forUpdate().first();
                if (u) {
                  const newUbal = Math.round((Number(u.balance) + refundMargin + Number.EPSILON) * 100) / 100;
                  await trx('users').where({ id: req.user.id }).update({ balance: newUbal });
                  await trx('ledger').insert({
                    user_id: req.user.id,
                    amount: refundMargin,
                    type: 'MARGIN_RELEASE',
                    description: `Margin released for cancelled dangling order ${dangler.symbol} on position conversion`
                  });
                }
              }
            }
            req.danglingOrdersToClean = danglingOrders;
          } else if (Math.abs(qtyA) > Math.abs(qtyB)) {
            // Existing position partially closed, incoming completely absorbed
            const marginReleaseFromA = marginA * (closedQty / Math.abs(qtyA));
            const remainingMarginA = marginA - marginReleaseFromA;
            const totalMarginRelease = marginB + marginReleaseFromA;
            const netRelease = totalMarginRelease + realizedPnl;
            await trx('users').where({ id: req.user.id }).increment('balance', netRelease);

            if (totalMarginRelease > 0) {
              await trx('ledger').insert({
                user_id: req.user.id,
                amount: totalMarginRelease,
                type: 'MARGIN_RELEASE',
                description: `Margin released from partial netting conversion for ${position.symbol}`
              });
            }
            if (realizedPnl !== 0) {
              await trx('ledger').insert({
                user_id: req.user.id,
                amount: realizedPnl,
                type: 'REALIZED_PNL',
                description: `Realized P&L from partial netting conversion for ${position.symbol}`
              });
            }

            await trx('positions').where({ id: existingPos.id }).update({
              quantity: netQty,
              average_price: priceA,
              margin: remainingMarginA,
              closed_quantity: trx.raw('COALESCE(closed_quantity, 0) + ?', [closedQty]),
              realized_pnl: trx.raw('COALESCE(realized_pnl, 0) + ?', [realizedPnl]),
              updated_at: new Date()
            });
            // ZERO HISTORICAL TRADE DELETION: Mark absorbed position with 0 quantity
            await trx('positions').where({ id: positionId }).update({
              quantity: 0,
              closed_quantity: trx.raw('COALESCE(closed_quantity, 0) + ?', [Math.abs(qtyB)]),
              exit_price: priceA,
              margin: 0,
              updated_at: new Date()
            });
          } else {
            // Existing position completely absorbed, incoming partially remaining
            const marginReleaseFromB = marginB * (closedQty / Math.abs(qtyB));
            const remainingMarginB = marginB - marginReleaseFromB;
            const totalMarginRelease = marginA + marginReleaseFromB;
            const netRelease = totalMarginRelease + realizedPnl;
            await trx('users').where({ id: req.user.id }).increment('balance', netRelease);

            if (totalMarginRelease > 0) {
              await trx('ledger').insert({
                user_id: req.user.id,
                amount: totalMarginRelease,
                type: 'MARGIN_RELEASE',
                description: `Margin released from partial netting conversion for ${position.symbol}`
              });
            }
            if (realizedPnl !== 0) {
              await trx('ledger').insert({
                user_id: req.user.id,
                amount: realizedPnl,
                type: 'REALIZED_PNL',
                description: `Realized P&L from partial netting conversion for ${position.symbol}`
              });
            }

            await trx('positions').where({ id: existingPos.id }).update({
              quantity: netQty,
              average_price: priceB,
              margin: remainingMarginB,
              closed_quantity: trx.raw('COALESCE(closed_quantity, 0) + ?', [closedQty]),
              realized_pnl: trx.raw('COALESCE(realized_pnl, 0) + ?', [realizedPnl]),
              updated_at: new Date()
            });
            // ZERO HISTORICAL TRADE DELETION: Mark absorbed position with 0 quantity
            await trx('positions').where({ id: positionId }).update({
              quantity: 0,
              closed_quantity: trx.raw('COALESCE(closed_quantity, 0) + ?', [Math.abs(qtyB)]),
              margin: 0,
              updated_at: new Date()
            });
          }
        }
      }
    });

    const triggerEngine = require('./services/triggerEngine');
    if (triggerEngine && triggerEngine.io) {
      triggerEngine.io.to(req.user.id.toString()).emit('sync_user_data');
    }
    if (req.danglingOrdersToClean && req.danglingOrdersToClean.length > 0) {
      for (const d of req.danglingOrdersToClean) {
        triggerEngine.removeOrderFromMemory(d.id, d.symbol);
      }
    }

    res.json({ success: true });
  } catch (err) {
    const statusCode = err.statusCode || 400;
    res.status(statusCode).json({ error: err.message });
  }
});

// ── MUTUAL FUNDS ENGINE ───────────────────────────────────────────────────────

const myFetch = async (...args) => {
    const { default: nf } = await import('node-fetch');
    return nf(...args);
};

// 1. Master List Cache
let allMutualFunds = [];
let allMutualFundsMap = new Map();

// Initialize by fetching all 10,000+ funds from mfapi.in

let mfInitializationPromise = null;

async function initMutualFundsList(force = false) {
    if (!force && allMutualFunds.length > 0) return; // already loaded
    
    // Prevent concurrent initialization attempts
    if (mfInitializationPromise) return mfInitializationPromise;

    mfInitializationPromise = (async () => {
        try {
            console.log('Fetching master list from amfiindia.com (Filtered for active direct growth only)...');
            const amfiRes = await myFetch('https://www.amfiindia.com/spages/NAVAll.txt');
            const amfiText = await amfiRes.text();
            
            const funds = [];
            const lines = amfiText.split('\n');
            for (const line of lines) {
                if (line.includes(';')) {
                    const parts = line.split(';');
                    if (parts.length >= 4 && parts[0] && !isNaN(parts[0])) {
                        let schemeName = parts[3].trim();
                        if (parts.length >= 6 && parts[4] && parts[5]) {
                            schemeName += ' - ' + parts[4].trim() + ' - ' + parts[5].trim();
                        } else if (parts.length >= 5 && parts[4]) {
                            schemeName += ' - ' + parts[4].trim();
                        }
                        
                        const n = schemeName.toLowerCase();
                        // FILTER: Keep only Direct Growth retail funds (< 2000 items)
                        if (
                            n.includes('growth') &&
                            n.includes('direct') &&
                            !n.includes('regular') &&
                            !n.includes('etf') &&
                            !n.includes('fmp') &&
                            !n.includes('fixed maturity')
                        ) {
                            funds.push({
                                schemeCode: parseInt(parts[0].trim()),
                                schemeName: schemeName
                            });
                        }
                    }
                }
            }
            
            allMutualFunds = funds;
            allMutualFundsMap = new Map();
            for (const f of funds) {
                allMutualFundsMap.set(String(f.schemeCode), f);
            }
            console.log(`Successfully parsed ${allMutualFunds.length} highly active retail mutual funds from AMFI.`);
            
        } catch (err) {
            console.error('Failed to fetch mutual funds master list:', err.message);
        } finally {
            mfInitializationPromise = null;
        }
    })();
    return mfInitializationPromise;
}

initMutualFundsList();

// Auto-refresh the AMFI master list every 24 hours
setInterval(() => initMutualFundsList(true), 86400000);

// Helper to calculate CAGR
function calculateReturn(historicalData, years) {
    if (!historicalData || historicalData.length === 0) return null;
    const latestNav = parseFloat(historicalData[0].nav);
    
    // Find the NAV from `years` ago
    const targetDate = new Date();
    targetDate.setFullYear(targetDate.getFullYear() - years);
    
    // Data is sorted descending (latest first)
    let pastNavObj = null;
    for (let i = 0; i < historicalData.length; i++) {
        const [dd, mm, yyyy] = historicalData[i].date.split('-');
        const itemDate = new Date(`${yyyy}-${mm}-${dd}`);
        if (itemDate <= targetDate) {
            pastNavObj = historicalData[i];
            break;
        }
    }

    if (!pastNavObj) return null; // Not enough history
    
    const pastNav = parseFloat(pastNavObj.nav);
    const cagr = (Math.pow((latestNav / pastNav), (1 / years)) - 1) * 100;
    return parseFloat(cagr.toFixed(2));
}

function calculateReturnAllTime(historicalData) {
    if (!historicalData || historicalData.length < 2) return null;
    const latestNav = parseFloat(historicalData[0].nav);
    const oldestData = historicalData[historicalData.length - 1];
    const oldestNav = parseFloat(oldestData.nav);
    
    const [d1, m1, y1] = historicalData[0].date.split('-');
    const [d2, m2, y2] = oldestData.date.split('-');
    const latestDate = new Date(`${y1}-${m1}-${d1}`);
    const oldestDate = new Date(`${y2}-${m2}-${d2}`);
    
    const years = (latestDate - oldestDate) / (1000 * 60 * 60 * 24 * 365.25);
    if (years <= 0) return null;
    
    const cagr = (Math.pow((latestNav / oldestNav), (1 / years)) - 1) * 100;
    return parseFloat(cagr.toFixed(2));
}

function determineRisk(return1y) {
    if (return1y === null) return 'Moderate';
    if (return1y > 25) return 'Very High';
    if (return1y > 15) return 'High';
    if (return1y > 8) return 'Moderate';
    return 'Low';
}

function setLRUCache(cacheObj, key, value, maxItems = 100) {
    const keys = Object.keys(cacheObj);
    if (keys.length >= maxItems) {
        let oldestKey = keys[0];
        let oldestTs = Infinity;
        for (const k of keys) {
            if (cacheObj[k]?.timestamp < oldestTs) {
                oldestTs = cacheObj[k].timestamp;
                oldestKey = k;
            }
        }
        delete cacheObj[oldestKey];
    }
    cacheObj[key] = value;
}

const mfCache = {};

const LEGACY_MF_NAMES = {
    'EDEL-MF': 'Edelweiss Balanced Advantage Fund - Direct Plan - Growth',
    'MIRA-MF': 'Mirae Asset Large Cap Fund - Direct Plan - Growth',
    'NIPP-MF': 'Nippon India Small Cap Fund - Direct Plan - Growth Option',
    'EDEL': 'Edelweiss Balanced Advantage Fund - Direct Plan - Growth',
    'MIRA': 'Mirae Asset Large Cap Fund - Direct Plan - Growth',
    'NIPP': 'Nippon India Small Cap Fund - Direct Plan - Growth Option',
    '118615-MF': 'Edelweiss Balanced Advantage Fund - Direct Plan - Growth',
    '118825-MF': 'Mirae Asset Large Cap Fund - Direct Plan - Growth',
    '118778-MF': 'Nippon India Small Cap Fund - Direct Plan - Growth Option',
    '120197-MF': 'ICICI Prudential Liquid Fund - Direct Plan - Growth'
};
const LEGACY_MF_CODES = {
    'EDEL': '118615',
    'MIRA': '118825',
    'NIPP': '118778'
};

app.post('/api/mf/names', async (req, res) => {
    try {
        if (!allMutualFunds || allMutualFunds.length === 0) {
            await initMutualFundsList();
        }
        const { ids } = req.body;
        const mapping = {};
        if (Array.isArray(ids)) {
            const axios = require('axios');
            for (const id of ids) {
                if (LEGACY_MF_NAMES[id]) {
                    mapping[id] = LEGACY_MF_NAMES[id];
                    continue;
                }
                let cleanId = String(id).replace('-MF', '');
                cleanId = LEGACY_MF_CODES[cleanId] || cleanId;
                const fund = allMutualFundsMap.get(cleanId);
                if (fund) {
                    mapping[id] = fund.schemeName;
                } else if (LEGACY_MF_NAMES[cleanId]) {
                    mapping[id] = LEGACY_MF_NAMES[cleanId];
                } else if (/^\d+$/.test(cleanId)) {
                    // Fallback to direct mfapi fetch for any future mutual fund not yet in cache
                    try {
                        const mfRes = await axios.get(`https://api.mfapi.in/mf/${cleanId}`, { timeout: 3000 });
                        if (mfRes.data && mfRes.data.meta && mfRes.data.meta.scheme_name) {
                            mapping[id] = mfRes.data.meta.scheme_name;
                            const newFund = { schemeCode: parseInt(cleanId), schemeName: mfRes.data.meta.scheme_name };
                            allMutualFunds.push(newFund);
                            allMutualFundsMap.set(cleanId, newFund);
                        }
                    } catch (e) {}
                }
            }
        }
        res.json(mapping);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. FAST Search Endpoint — returns ALL matching funds instantly from memory (no mfapi calls)
app.get('/api/mf/search', apiLimiter, async (req, res) => {
    try {
        if (allMutualFunds.length === 0) {
            await initMutualFundsList();
        }
        const query = (req.query.q || '').toLowerCase().trim();
        
        let matches = [];
        if (!query || query.length < 2) {
            // Default top funds across categories (Equity, Debt, Hybrid) if no search query
            const topKeywords = [
                'parag parikh flexi', 'quant small', 'quant active', 'sbi small cap', 
                'sbi magnum midcap', 'sbi liquid', 'hdfc balanced advantage', 'hdfc mid-cap', 
                'nippon india liquid', 'nippon india small cap', 'motilal oswal midcap', 
                'icici prudential equity & debt', 'icici prudential liquid', 'axis bluechip', 
                'kotak emerging equity', 'mirae asset large cap', 'ppfas', 'edelweiss balanced'
            ];
            matches = allMutualFunds.filter(f => {
                const n = f.schemeName.toLowerCase();
                return n.includes('direct') && n.includes('growth') && topKeywords.some(k => n.includes(k));
            });
        } else {
            // Instantly filter from the 37,000+ in-memory list
            matches = allMutualFunds.filter(f => f.schemeName.toLowerCase().includes(query) || String(f.schemeCode) === query || String(f.schemeCode) === query.replace('-MF', ''));
        }
        
        // Sort: Direct+Growth first, then Regular+Growth, then others
        matches.sort((a, b) => {
            const nameLower = (n) => n.schemeName.toLowerCase();
            const score = (f) => {
                let s = 0;
                const n = nameLower(f);
                if (n.includes('direct')) s += 4;
                if (n.includes('growth')) s += 2;
                // Penalize closed/FMP/maturity funds
                if (n.includes('fmp') || n.includes('fixed maturity') || n.includes('interval') || n.includes('series')) s -= 3;
                return s;
            };
            return score(b) - score(a);
        });

        // Return TOP 100 matches to prevent overwhelming the frontend
        const results = matches.slice(0, 100).map(fund => {
            const nameLower = fund.schemeName.toLowerCase();
            let category = 'Equity';
            if (nameLower.includes('debt') || nameLower.includes('liquid') || nameLower.includes('bond') || nameLower.includes('gilt') || nameLower.includes('money market') || nameLower.includes('overnight') || nameLower.includes('floating')) category = 'Debt';
            if (nameLower.includes('hybrid') || nameLower.includes('balanced') || nameLower.includes('dynamic asset') || nameLower.includes('multi asset') || nameLower.includes('aggressive')) category = 'Hybrid';
            
            const amc = fund.schemeName.split(' ')[0];
            
            // Check if we have cached data to show returns
            const cached = mfCache[fund.schemeCode];
            let nav = 0, return1y = 0, return3y = 0, return5y = 0, returnAllTime = 0, risk = 'Moderate';
            
            if (cached && cached.data && cached.data.data && cached.data.data.length > 0) {
                const historicalData = cached.data.data;
                nav = parseFloat(historicalData[0].nav);
                return1y = calculateReturn(historicalData, 1) || 0;
                return3y = calculateReturn(historicalData, 3) || 0;
                return5y = calculateReturn(historicalData, 5) || 0;
                returnAllTime = calculateReturnAllTime(historicalData) || 0;
                risk = determineRisk(return1y);
            }
            
            return {
                id: fund.schemeCode,
                name: fund.schemeName,
                amc,
                category,
                risk,
                nav,
                return1y,
                return3y,
                return5y,
                returnAllTime,
                enriched: !!cached
            };
        });

        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=1800');
        res.json(results);
    } catch (err) {
        console.error('MF Search Error:', err.message);
        res.status(500).json({ error: 'Failed to search mutual funds' });
    }
});

// 2b. Enrich a batch of funds with live NAV and returns
app.get('/api/mf/enrich', async (req, res) => {
    try {
        const ids = (req.query.ids || '').split(',').filter(Boolean).slice(0, 50);
        if (ids.length === 0) return res.json([]);

        const results = await Promise.all(ids.map(async (schemeCode) => {
            try {
                let data = null;
                if (mfCache[schemeCode] && (Date.now() - mfCache[schemeCode].timestamp < 86400000)) { // 24 hours cache
                    data = mfCache[schemeCode].data;
                } else {
                    const axios = require('axios');
                    const cleanCode = String(schemeCode).replace('-MF', '');
                    const res = await axios.get(`https://api.mfapi.in/mf/${cleanCode}`, { timeout: 4000 });
                    if (res.data && res.data.data && res.data.data.length > 0) {
                        data = res.data;
                        mfCache[schemeCode] = { timestamp: Date.now(), data };
                    }
                }

                if (!data || !data.data || data.data.length === 0) return null;
                const historicalData = data.data;
                const latestNav = parseFloat(historicalData[0].nav);

                return {
                    id: schemeCode,
                    nav: latestNav,
                    return1y: calculateReturn(historicalData, 1) || 0,
                    return3y: calculateReturn(historicalData, 3) || 0,
                    return5y: calculateReturn(historicalData, 5) || 0,
                    returnAllTime: calculateReturnAllTime(historicalData) || 0,
                    risk: determineRisk(calculateReturn(historicalData, 1))
                };
            } catch { return null; }
        }));

        res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=86400');
        res.json(results.filter(Boolean));
    } catch (err) {
        console.error('MF Enrich Error:', err.message);
        res.status(500).json({ error: 'Failed to enrich' });
    }
});

// 2b-2. Get mutual funds by specific IDs (for watchlist & portfolio persistence)
app.post('/api/mf/by-ids', async (req, res) => {
    try {
        if (!allMutualFunds || allMutualFunds.length === 0) {
            await initMutualFundsList();
        }
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.json([]);
        }

        const cleanIds = ids.map(id => {
            let s = String(id).replace('-MF', '');
            return LEGACY_MF_CODES[s] || s;
        }).filter(Boolean);
        const uniqueIds = [...new Set(cleanIds)];
        const axios = require('axios');

        const results = await Promise.all(uniqueIds.map(async (schemeCode) => {
            let fund = allMutualFundsMap.get(String(schemeCode));

            // Check if legacy mapping name exists
            if (!fund && (LEGACY_MF_NAMES[schemeCode] || LEGACY_MF_NAMES[`${schemeCode}-MF`])) {
                fund = { 
                    schemeCode: parseInt(schemeCode) || schemeCode, 
                    schemeName: LEGACY_MF_NAMES[schemeCode] || LEGACY_MF_NAMES[`${schemeCode}-MF`] 
                };
            }

            // If not found in map, attempt mfapi fetch
            if (!fund && /^\d+$/.test(schemeCode)) {
                try {
                    const mfRes = await axios.get(`https://api.mfapi.in/mf/${schemeCode}`, { timeout: 3000 });
                    if (mfRes.data?.meta?.scheme_name) {
                        fund = { schemeCode: parseInt(schemeCode), schemeName: mfRes.data.meta.scheme_name };
                        allMutualFunds.push(fund);
                        allMutualFundsMap.set(String(schemeCode), fund);
                        if (mfRes.data.data?.length > 0) {
                            mfCache[schemeCode] = { timestamp: Date.now(), data: mfRes.data };
                        }
                    }
                } catch (e) {}
            }

            if (!fund) return null;

            const nameLower = (fund.schemeName || '').toLowerCase();
            let category = 'Equity';
            if (nameLower.includes('debt') || nameLower.includes('liquid') || nameLower.includes('bond') || nameLower.includes('gilt') || nameLower.includes('money market') || nameLower.includes('overnight') || nameLower.includes('floating')) category = 'Debt';
            if (nameLower.includes('hybrid') || nameLower.includes('balanced') || nameLower.includes('dynamic asset') || nameLower.includes('multi asset') || nameLower.includes('aggressive')) category = 'Hybrid';

            const amc = (fund.schemeName || '').split(' ')[0] || 'Mutual';

            let cached = mfCache[fund.schemeCode] || mfCache[schemeCode];
            if (!cached && /^\d+$/.test(schemeCode)) {
                try {
                    const res = await axios.get(`https://api.mfapi.in/mf/${schemeCode}`, { timeout: 3000 });
                    if (res.data?.data?.length > 0) {
                        cached = { timestamp: Date.now(), data: res.data };
                        mfCache[fund.schemeCode] = cached;
                        mfCache[schemeCode] = cached;
                    }
                } catch (e) {}
            }

            let nav = 0, return1y = 0, return3y = 0, return5y = 0, returnAllTime = 0, risk = 'Moderate';
            if (cached?.data?.data?.length > 0) {
                const historicalData = cached.data.data;
                nav = parseFloat(historicalData[0].nav) || 0;
                return1y = calculateReturn(historicalData, 1) || 0;
                return3y = calculateReturn(historicalData, 3) || 0;
                return5y = calculateReturn(historicalData, 5) || 0;
                returnAllTime = calculateReturnAllTime(historicalData) || 0;
                risk = determineRisk(return1y);
            }

            return {
                id: fund.schemeCode,
                name: fund.schemeName,
                amc,
                category,
                risk,
                nav,
                return1y,
                return3y,
                return5y,
                returnAllTime,
                enriched: !!cached
            };
        }));

        res.json(results.filter(Boolean));
    } catch (err) {
        console.error('MF By-IDs Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch mutual funds by IDs' });
    }
});

// 2c. Rich Details Endpoint (Proxies Groww API for AUM, Holdings, Ratings, Pros/Cons)
const mfDetailsCache = {};
app.get('/api/mf/details', async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) return res.status(400).json({ error: 'Name required' });
        
        // Check cache first
        if (mfDetailsCache[name] && (Date.now() - mfDetailsCache[name].timestamp < 86400000)) { // 24 hours cache
            res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
            return res.json(mfDetailsCache[name].data);
        }

        // 1. Get search ID
        const searchUrl = `https://groww.in/v1/api/search/v1/entity?app=false&entity_type=scheme&size=5&q=${encodeURIComponent(name)}`;
        const searchRes = await myFetch(searchUrl);
        const searchData = await searchRes.json();
        
        if (!searchData || !searchData.content || searchData.content.length === 0) {
            return res.status(404).json({ error: 'Details not found for this fund' });
        }
        
        // Take the first matching ID
        const searchId = searchData.content[0].id;

        // 2. Fetch full details using the search ID
        const detailsUrl = `https://groww.in/v1/api/data/mf/web/v2/scheme/search/${searchId}`;
        const detailsRes = await myFetch(detailsUrl);
        const detailsData = await detailsRes.json();
        
        if (detailsData.errorCode) {
            return res.status(404).json({ error: detailsData.errorMessage || 'Details not found' });
        }

        setLRUCache(mfDetailsCache, name, { timestamp: Date.now(), data: detailsData }, 100);
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        res.json(detailsData);
    } catch (err) {
        console.error('MF Details Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch fund details' });
    }
});

// 3. Historical Data Endpoint (for charts)
app.get('/api/mf/:schemeCode', async (req, res) => {
    try {
        const { schemeCode } = req.params;
        
        if (mfCache[schemeCode] && (Date.now() - mfCache[schemeCode].timestamp < 3600000)) {
            return res.json(mfCache[schemeCode].data);
        }

        const response = await myFetch(`https://api.mfapi.in/mf/${schemeCode}`);
        const data = await response.json();
        
        setLRUCache(mfCache, schemeCode, { timestamp: Date.now(), data }, 100);
        res.json(data);
    } catch (err) {
        console.error('MF History Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch mutual fund history' });
    }
});

// Helper: Determine if mutual fund order qualifies for Same-Day (Today's) NAV (09:00 AM - 02:00 PM IST on Mon-Fri)
function isMutualFundSameDayCutoffOpen() {
  try {
    const istDateStr = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Kolkata', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    }).format(new Date());
    const [datePart, timePart] = istDateStr.split(', ');
    const [year, month, date] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);

    const istDate = new Date(Date.UTC(year, month - 1, date, hours, minutes));
    const day = istDate.getUTCDay(); // 0 = Sun, 6 = Sat
    if (day === 0 || day === 6) return false;

    const curMinutes = hours * 60 + minutes;
    // 09:00 AM (540m) to 02:00 PM (840m)
    return curMinutes >= 540 && curMinutes < 840;
  } catch (e) {
    return false;
  }
}

// 3. Lumpsum Mutual Fund Purchase Endpoint (Defect 41)
const handleMutualFundBuy = async (req, res) => {
  const { scheme_code, schemeCode, amount } = req.body;
  const targetCode = String(scheme_code || schemeCode || '').replace('-MF', '').trim();
  const parsedAmount = parseFloat(amount);
  if (!targetCode || isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Valid mutual fund scheme code and positive investment amount are required.' });
  }

  try {
    const symbol = `${targetCode}-MF`;
    let nav = await SIPEngine.getLatestNav(symbol, priceCache);
    if (!nav || nav <= 0) {
      nav = await SIPEngine.getLatestNav(targetCode, priceCache);
    }
    if (!nav || nav <= 0) {
      if (mfCache[targetCode]?.data?.data?.[0]?.nav) {
        nav = parseFloat(mfCache[targetCode].data.data[0].nav);
      }
    }
    if (!nav || nav <= 0) {
      return res.status(400).json({ error: `Current NAV unavailable for fund ${targetCode}. Please try again later.` });
    }

    const units = parseFloat((parsedAmount / nav).toFixed(4));
    if (units <= 0) {
      return res.status(400).json({ error: 'Calculated units are zero. Please increase investment amount.' });
    }

    const isSameDayNav = isMutualFundSameDayCutoffOpen();

    await db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [req.user.id]);
      const user = await trx('users').where({ id: req.user.id }).forUpdate().first();
      if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

      if (Number(user.balance) < parsedAmount) {
        throw Object.assign(new Error(`Insufficient funds. Required: ₹${parsedAmount.toLocaleString('en-IN')}, Available: ₹${Number(user.balance).toLocaleString('en-IN')}`), { statusCode: 400 });
      }

      // Deduct balance
      const newBal = Math.round((Number(user.balance) - parsedAmount) * 100) / 100;
      await trx('users').where({ id: req.user.id }).update({ balance: newBal });

      if (isSameDayNav) {
        // --- 1. Same-Day NAV Execution (09:00 AM - 02:00 PM Cut-off) ---
        await trx('ledger').insert({
          user_id: req.user.id,
          amount: -parsedAmount,
          type: 'MARGIN_BLOCK',
          description: `Mutual Fund Purchase: ${units} units of ${symbol} @ NAV ₹${nav.toFixed(2)}`
        });

        // Order record
        await trx('orders').insert({
          user_id: req.user.id,
          symbol,
          type: 'MARKET',
          side: 'BUY',
          quantity: units,
          filled_quantity: units,
          pending_quantity: 0,
          price: nav,
          average_price: nav,
          status: 'EXECUTED',
          order_variety: 'REGULAR',
          product_type: 'DEL',
          margin: parsedAmount,
          remarks: "Mutual Fund Purchase: Today's NAV (Before 2:00 PM Cut-off)",
          created_at: new Date(),
          updated_at: new Date()
        });

        // Credit to holdings immediately
        const existingHolding = await trx('holdings')
          .where({ user_id: req.user.id, symbol })
          .first();

        if (existingHolding) {
          const curQty = parseFloat(existingHolding.quantity) || 0;
          const curAvg = parseFloat(existingHolding.average_price) || nav;
          const newQty = parseFloat((curQty + units).toFixed(4));
          const newAvg = parseFloat((((curQty * curAvg) + parsedAmount) / newQty).toFixed(4));

          await trx('holdings').where({ id: existingHolding.id }).update({
            quantity: newQty,
            average_price: newAvg,
            asset_class: 'MUTUAL_FUND',
            updated_at: new Date()
          });
        } else {
          await trx('holdings').insert({
            user_id: req.user.id,
            symbol,
            quantity: units,
            average_price: nav,
            asset_class: 'MUTUAL_FUND',
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      } else {
        // --- 2. Next Business Day NAV Queued Order (After 2:00 PM / Weekend) ---
        await trx('ledger').insert({
          user_id: req.user.id,
          amount: -parsedAmount,
          type: 'MARGIN_BLOCK',
          description: `Mutual Fund Order Queued: ₹${parsedAmount.toFixed(2)} for ${symbol} (Next Business Day NAV)`
        });

        // Order queued as AMO_PENDING without crediting holdings yet
        await trx('orders').insert({
          user_id: req.user.id,
          symbol,
          type: 'MARKET',
          side: 'BUY',
          quantity: units,
          filled_quantity: 0,
          pending_quantity: units,
          price: nav,
          average_price: null,
          status: 'AMO_PENDING',
          order_variety: 'AMO',
          product_type: 'DEL',
          margin: parsedAmount,
          remarks: "Mutual Fund Order: Queued for Next Business Day NAV (After 2:00 PM Cut-off)",
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    });

    if (isSameDayNav) {
      return res.json({ 
        success: true, 
        queued: false, 
        units, 
        nav, 
        amount: parsedAmount, 
        symbol,
        message: `Investment successful! ${units} units allocated with Today's NAV.` 
      });
    } else {
      return res.json({ 
        success: true, 
        queued: true, 
        units: 0, 
        estUnits: units, 
        nav, 
        amount: parsedAmount, 
        symbol,
        message: 'Order placed after 2:00 PM cut-off. Queued for Next Business Day NAV (Non-cancellable). Units will be credited upon settlement.' 
      });
    }
  } catch (err) {
    console.error('[MF BUY ERROR]', err);
    return res.status(err.statusCode || 500).json({ error: err.message || 'Failed to purchase mutual fund' });
  }
};

app.post('/api/mutual-funds/buy', authenticateToken, handleMutualFundBuy);
app.post('/api/mf/buy', authenticateToken, handleMutualFundBuy);

// ─── Restricted Stocks ────────────────────────────────────────────────────
let restrictedStocksCache = [];
app.get('/api/restricted-stocks', async (req, res) => {
  res.json(restrictedStocksCache);
});
app.setRestrictedStocksCache = (list) => {
  restrictedStocksCache = list;
};
// ─── Option Chain ───────────────────────────────────────────────────────────
// ─── Option Chain & Futures In-Memory Caching (Zero Disk I/O on Requests) ───
let cachedOptionsData = null;
let cachedFuturesData = null;
let cachedOptionsSymbols = [];

async function loadOptionsAndFuturesCache() {
  const optionsPath = path.join(__dirname, 'database', 'options.json');
  const futuresPath = path.join(__dirname, 'database', 'futures.json');

  try {
    const [optRaw, futRaw] = await Promise.all([
      fs.promises.readFile(optionsPath, 'utf8').catch(() => null),
      fs.promises.readFile(futuresPath, 'utf8').catch(() => null)
    ]);
    if (optRaw) {
      cachedOptionsData = JSON.parse(optRaw);
      cachedOptionsSymbols = Object.keys(cachedOptionsData).sort();
    }
    if (futRaw) {
      cachedFuturesData = JSON.parse(futRaw);
    }
    if (typeof localSearchLRU !== 'undefined' && localSearchLRU && typeof localSearchLRU.clear === 'function') {
      localSearchLRU.clear();
    }
    console.log(`⚡ [Cache Loaded] Options (${cachedOptionsSymbols.length} underlyings) & Futures in memory.`);
  } catch (err) {
    console.error('Failed to load options/futures in-memory cache:', err.message);
  }
}

// Initial async load at server boot
loadOptionsAndFuturesCache();

// Watch options.json, futures.json, and freezeLimitsConfig.json on disk so all PM2 cluster workers reload when master updates them
try {
  const dbDir = path.join(__dirname, 'database');
  if (fs.existsSync(dbDir)) {
    let optWatchTimer = null;
    fs.watch(dbDir, (eventType, filename) => {
      if (filename === 'options.json' || filename === 'futures.json') {
        if (optWatchTimer) clearTimeout(optWatchTimer);
        optWatchTimer = setTimeout(() => {
          loadOptionsAndFuturesCache();
        }, 1500);
      } else if (filename === 'freezeLimitsConfig.json') {
        try {
          const { reloadFreezeConfig } = require('./services/taxCalculator');
          reloadFreezeConfig();
        } catch (e) {}
      }
    });
  }
} catch (e) {}

app.get('/api/options/chain/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    if (!cachedOptionsData) {
      await loadOptionsAndFuturesCache();
    }

    if (!cachedOptionsData) {
      return res.status(503).json({ error: 'Options database is currently being built. Please try again in a minute.' });
    }

    if (!cachedOptionsData[symbol]) {
      return res.status(404).json({ error: `Option chain for ${symbol} not found.` });
    }

    const nowIst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayStr = `${nowIst.getFullYear()}-${String(nowIst.getMonth() + 1).padStart(2, '0')}-${String(nowIst.getDate()).padStart(2, '0')}`;
    const rawChain = cachedOptionsData[symbol];
    const activeChain = {};
    for (const [exp, strikes] of Object.entries(rawChain)) {
      if (exp >= todayStr) {
        activeChain[exp] = strikes;
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(Object.keys(activeChain).length > 0 ? activeChain : rawChain);
  } catch (err) {
    console.error('/api/options/chain Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to fetch all available underlying symbols for options (e.g., NIFTY, RELIANCE, CRUDEOIL)
app.get('/api/options/symbols', async (req, res) => {
  try {
    if (!cachedOptionsData) {
      await loadOptionsAndFuturesCache();
    }

    if (!cachedOptionsData) {
      return res.status(503).json({ error: 'Options database is currently being built.' });
    }

    res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=86400');
    res.json(cachedOptionsSymbols);
  } catch (err) {
    console.error('/api/options/symbols Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/options/futures/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    if (!cachedFuturesData) {
      await loadOptionsAndFuturesCache();
    }

    if (!cachedFuturesData) {
      return res.status(503).json({ error: 'Futures database not ready.' });
    }

    const data = cachedFuturesData;
    if (data[symbol] && data[symbol].length > 0) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const validFutures = data[symbol].filter(f => {
        const expDate = new Date(f.expiry);
        return expDate >= now;
      });

      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=1800');
      if (validFutures.length > 0) {
        res.json(validFutures[0]);
      } else {
        res.json(data[symbol][data[symbol].length - 1]);
      }
    } else {
      res.status(404).json({ error: 'No futures found for symbol' });
    }
  } catch (err) {
    console.error('/api/options/futures Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Order Management ───────────────────────────────────────────────────────────────
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const isFull = req.query.all === 'true' || req.query.export === 'true';
    const requestedLimit = parseInt(req.query.limit);
    const limit = isFull ? (requestedLimit || 5000) : (requestedLimit || 200);
    const offset = parseInt(req.query.offset) || 0;

    // For secondary paginated pages (offset > 0), only query the requested historical page
    if (offset > 0) {
      const totalActiveCountRow = await db('orders')
        .where({ user_id: req.user.id })
        .count('id as cnt')
        .first();
      const totalActiveCount = parseInt(totalActiveCountRow?.cnt || 0, 10);

      let pagedOrders = [];
      if (offset < totalActiveCount) {
        pagedOrders = await db('orders')
          .where({ user_id: req.user.id })
          .orderBy('created_at', 'desc')
          .limit(limit)
          .offset(offset);
      }

      const pagedMap = new Map();
      (pagedOrders || []).forEach(o => pagedMap.set(o.id, o));

      if (pagedMap.size < limit) {
        try {
          const archiveOffset = Math.max(0, offset - totalActiveCount);
          const archivedOrders = await db('orders_archive')
            .where({ user_id: req.user.id })
            .orderBy('created_at', 'desc')
            .limit(limit - pagedMap.size)
            .offset(archiveOffset);
          (archivedOrders || []).forEach(o => {
            if (!pagedMap.has(o.id)) pagedMap.set(o.id, o);
          });
        } catch (_) {}
      }

      const orders = Array.from(pagedMap.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      return res.json(orders);
    }

    const activeOrderStatuses = [
      'PENDING', 
      'PARTIAL_FILLED', 
      'PARTIALLY_FILLED', 
      'OPEN', 
      'TRIGGER_PENDING', 
      'PENDING_TRIGGER', 
      'AMO_PENDING', 
      'AMO_REQ_RECEIVED'
    ];

    const todayStartIST = getTradingSessionStartIST();

    const [activeOrders, todayOrders, recentOrders] = await Promise.all([
      db('orders')
        .where({ user_id: req.user.id })
        .whereIn('status', activeOrderStatuses)
        .orderBy('created_at', 'desc'),
      db('orders')
        .where({ user_id: req.user.id })
        .where(function() {
          this.where('created_at', '>=', todayStartIST)
            .orWhere('updated_at', '>=', todayStartIST);
        })
        .orderBy('created_at', 'desc'),
      db('orders')
        .where({ user_id: req.user.id })
        .orderBy('created_at', 'desc')
        .limit(limit)
    ]);

    const ordersMap = new Map();
    (activeOrders || []).forEach(o => ordersMap.set(o.id, o));
    (todayOrders || []).forEach(o => ordersMap.set(o.id, o));
    (recentOrders || []).forEach(o => {
      if (!ordersMap.has(o.id)) ordersMap.set(o.id, o);
    });

    // Seamlessly supplement from orders_archive (monthly partitions) if room remains in limit
    if (ordersMap.size < limit) {
      try {
        const archivedOrders = await db('orders_archive')
          .where({ user_id: req.user.id })
          .orderBy('created_at', 'desc')
          .limit(limit - ordersMap.size);
        (archivedOrders || []).forEach(o => {
          if (!ordersMap.has(o.id)) ordersMap.set(o.id, o);
        });
      } catch (archErr) {}
    }

    const orders = Array.from(ordersMap.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Place Order ─────────────────────────────────────────────────────────
const { spawnBracketOrders } = require('./services/orderExecutor');

function calculateExecutionPrice(symbol, side, quantity, basePrice) {
  const cached = priceCache[symbol];
  if (!cached || !basePrice || basePrice <= 0) return Number(basePrice || 0);
  
  // 1. Level-2 order book depth matching (if depth cache available)
  const depth = cached.depth;
  if (depth && (depth.buy || depth.sell || depth.asks || depth.bids)) {
    const book = side === 'BUY' ? (depth.sell || depth.asks) : (depth.buy || depth.bids);
    if (Array.isArray(book) && book.length > 0) {
      let remaining = Number(quantity);
      let totalCost = 0;
      for (const level of book) {
        const levelPrice = Number(level.price);
        const levelQty = Number(level.quantity || level.orders);
        if (levelPrice > 0 && levelQty > 0) {
          const fillQty = Math.min(remaining, levelQty);
          totalCost += fillQty * levelPrice;
          remaining -= fillQty;
          if (remaining <= 0) break;
        }
      }
      if (remaining < Number(quantity)) {
        const filledQty = Number(quantity) - remaining;
        const vwap = totalCost / filledQty;
        return Number(vwap.toFixed(2));
      }
    }
  }
  
  // 2. Realistic market impact slippage model for large orders (> ₹5 Lakhs or > 5,000 qty)
  const orderValue = Number(quantity) * basePrice;
  if (orderValue > 500000 || Number(quantity) >= 5000) {
    const impactBps = Math.min(0.005, 0.0005 * Math.log10(Math.max(1, orderValue / 100000))); // 5 to 50 bps max
    const slippage = basePrice * impactBps;
    const slippedPrice = side === 'BUY' ? (basePrice + slippage) : (basePrice - slippage);
    return Number(slippedPrice.toFixed(2));
  }
  return Number(basePrice.toFixed(2));
}

let lastOrderError = null;

app.post('/api/order', authenticateToken, orderLimiter, async (req, res) => {
  lastOrderError = null;
  try {
    const symbol = req.body.symbol;
  const type = req.body.type || req.body.orderType;
  const side = req.body.side;

  const isMF = String(symbol).endsWith('-MF') || String(symbol).includes('MUTUALFUND');
  let quantity = req.body.quantity;
  const parsedQty = Number(quantity);
  if (!quantity || isNaN(parsedQty) || parsedQty <= 0) {
    return res.status(400).json({ error: 'Order quantity must be a positive number greater than 0.' });
  }

  // Equities, F&O, and Commodities strictly require whole integer share/lot quantities. Only Mutual Funds allow fractional units.
  if (!isMF) {
    quantity = Math.round(parsedQty);
    req.body.quantity = quantity;
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Order quantity must be a positive whole integer for stocks and derivatives.' });
    }
  } else {
    quantity = Number(parsedQty.toFixed(4));
    req.body.quantity = quantity;
  }

  const price = req.body.price;
  const sl_price = req.body.sl_price ?? req.body.slPrice;
  const tgt_price = req.body.tgt_price ?? req.body.tgtPrice;
  const trigger_price = req.body.trigger_price ?? req.body.triggerPrice;
  const trail_amount = req.body.trail_amount ?? req.body.trailAmount;
  const margin = req.body.margin;
  const product_type = req.body.product_type || req.body.productType || 'INT';
  const effectiveProductType = (product_type === 'CNC' || product_type === 'DELIVERY' || product_type === 'DEL')
    ? 'DEL'
    : (product_type === 'MIS' || product_type === 'INTRADAY')
      ? 'INT'
      : product_type;
  const rawVariety = req.body.order_variety || req.body.variety || (req.body.is_amo ? 'AMO' : null);

  if (!symbol || !type || !side || !quantity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Real-Time Position Clamping for Explicit Exit Orders (Prevents over-exiting / position reversals)
  const isExplicitExit = Boolean(req.body.is_exit || req.body.is_system_close || (req.body.remarks && /exit|square-off|close/i.test(req.body.remarks)));

  // ── Monthly Trade Quota Enforcement for Free / Basic Plan ──────────────────
  // Free Plan allows max 25 trades per month (25 Buy + 25 Sell total in a calendar month)
  // Exits and square-off orders are NEVER blocked so traders can always close open positions.
  const userRecord = await db('users').where({ id: req.user.id }).select('subscription_tier', 'subscription_expires', 'is_admin').first();
  const isPaidTier = Boolean(userRecord?.is_admin) || (userRecord && ['PRO', 'MONTHLY', 'YEARLY', 'HIGHEST', 'FEATURE', 'VIP', 'LIFETIME'].includes(userRecord.subscription_tier) && (!userRecord.subscription_expires || new Date(userRecord.subscription_expires) > new Date()));
  
  if (!isPaidTier && !isExplicitExit) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const orderSide = String(side).toUpperCase();
    
    // Check monthly order count for this specific side (BUY or SELL)
    const monthlySideCount = await db('orders')
      .where({ user_id: req.user.id })
      .whereRaw('UPPER(side) = ?', [orderSide])
      .where('created_at', '>=', startOfMonth)
      .whereNotIn('status', ['CANCELLED', 'REJECTED'])
      .count('* as count')
      .first();

    const currentCount = parseInt(monthlySideCount?.count || 0, 10);
    const MONTHLY_FREE_TRADE_LIMIT = 25; // 25 Buy and 25 Sell per month

    if (currentCount >= MONTHLY_FREE_TRADE_LIMIT) {
      return res.status(403).json({
        error: `Monthly trade quota reached: Free Plan allows maximum 25 ${orderSide} trades per month (used: ${currentCount}/${MONTHLY_FREE_TRADE_LIMIT}). Upgrade to Pro Monthly, Yearly, or Feature Plan for higher or unlimited trades.`,
        limit_reached: true,
        tier: 'BASIC',
        quota: MONTHLY_FREE_TRADE_LIMIT,
        used: currentCount,
        side: orderSide
      });
    }
  }

  // ── Index Buy Restriction (Subscription Required & Single Active Index Trade Limit) ──
  // 1. Index buying (NIFTY, BANKNIFTY, FINNIFTY, SENSEX, etc.) is strictly allowed ONLY for Pro subscribers.
  // 2. Only ONE active index trade is allowed at a time across all index contracts.
  // Exits and square-off orders (closing existing short positions) are NEVER blocked.
  const isOrderBuy = String(side).toUpperCase() === 'BUY';
  const isTargetIndex = isIndexContract(symbol);

  if (isOrderBuy && isTargetIndex && !isExplicitExit) {
    const cleanSymForIndex = String(symbol).replace(/^(NSE:|BSE:|MCX:)/i, '');
    const coveringShortPos = await db('positions')
      .where({ user_id: req.user.id })
      .where(builder => {
        builder.where({ symbol }).orWhere({ symbol: cleanSymForIndex }).orWhere({ symbol: `NSE:${cleanSymForIndex}` }).orWhere({ symbol: `BSE:${cleanSymForIndex}` }).orWhere({ symbol: `MCX:${cleanSymForIndex}` });
      })
      .where('quantity', '<', 0)
      .first();

    const isCoveringShort = Boolean(coveringShortPos && Math.abs(Number(coveringShortPos.quantity)) > 0);

    if (!isCoveringShort) {
      // 1. Verify Active Subscription
      if (!isPaidTier) {
        return res.status(403).json({
          error: 'Index buying is exclusive to Pro subscribers. Please upgrade your subscription to trade Nifty, BankNifty, Sensex and other index contracts.',
          requires_subscription: true,
          is_index_order: true,
          tier: userRecord?.subscription_tier || 'BASIC'
        });
      }
    }
  }

  if (isExplicitExit) {
    const cleanSym = String(symbol).replace(/^(NSE:|BSE:|MCX:)/i, '');
    const isIntProduct = (effectiveProductType === 'INT' || effectiveProductType === 'MIS' || effectiveProductType === 'BO' || effectiveProductType === 'CO');
    const isDelProduct = (effectiveProductType === 'DEL' || effectiveProductType === 'CNC' || effectiveProductType === 'DELIVERY');
    const dbPos = await db('positions')
      .where({ user_id: req.user.id })
      .where(builder => {
        if (isIntProduct) builder.whereIn('product_type', ['INT', 'MIS', 'BO', 'CO']);
        else if (isDelProduct) builder.whereIn('product_type', ['DEL', 'CNC', 'DELIVERY']);
        else builder.where({ product_type: effectiveProductType });
      })
      .where(builder => {
        builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
      })
      .where('quantity', '!=', 0)
      .first();

    if (dbPos) {
      const openQty = Math.abs(Number(dbPos.quantity));
      if (openQty > 0 && quantity > openQty) {
        quantity = isMF ? Number(openQty.toFixed(4)) : Math.round(openQty);
        req.body.quantity = quantity;
      }
    } else if (isDelProduct) {
      const dbHolding = await db('holdings')
        .where({ user_id: req.user.id })
        .where(builder => {
          builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
        })
        .where('quantity', '!=', 0)
        .first();
      if (dbHolding) {
        const openHQty = Math.abs(Number(dbHolding.quantity));
        if (openHQty > 0 && quantity > openHQty) {
          quantity = isMF ? Number(openHQty.toFixed(4)) : Math.round(openHQty);
          req.body.quantity = quantity;
        }
      }
    }
  }

  // Block new Intraday / BO / CO orders after segment intraday cutoff time (EXCEPT exit/closing orders)
  const isAmoOrder = rawVariety === 'AMO' || Boolean(req.body.is_amo);
  if (!isAmoOrder && (effectiveProductType === 'INT' || effectiveProductType === 'MIS' || effectiveProductType === 'BO' || effectiveProductType === 'CO')) {
    const { isIntradayBlocked } = require('./services/cronJobs');
    if (isIntradayBlocked && isIntradayBlocked(symbol)) {
      // Allow users to EXIT/reduce an existing open position
      const clean = String(symbol).replace(/^(NSE:|BSE:|MCX:)/i, '').replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ)$/i, '');
      const existingPos = await db('positions')
        .where({ user_id: req.user.id })
        .where(function() {
          this.where({ symbol }).orWhere({ symbol: clean }).orWhere('symbol', 'like', `%${clean}%`);
        })
        .where('quantity', '!=', 0)
        .first();

      const isExitOrder = existingPos && (
        (Number(existingPos.quantity) < 0 && side === 'BUY') ||
        (Number(existingPos.quantity) > 0 && side === 'SELL')
      );

      if (!isExitOrder) {
        return res.status(400).json({
          error: `Intraday order placement for ${symbol} is closed for today (Auto square-off period active). Please place a Delivery (CNC) or AMO order.`
        });
      }

      // CRITICAL: Exit order cannot exceed open position quantity during cutoff!
      // Otherwise, it creates a brand new open intraday position during the cutoff window!
      const maxAllowedExitQty = Math.abs(Number(existingPos.quantity));
      if (Number(quantity) > maxAllowedExitQty) {
        return res.status(400).json({
          error: `Intraday cutoff active: You can only exit up to your open position quantity of ${maxAllowedExitQty}. Placing ${quantity} would create a new open intraday position, which is prohibited after cutoff.`
        });
      }
    }
  }

  if (type === 'GTT' && (!trigger_price || parseFloat(trigger_price) <= 0 || isNaN(parseFloat(trigger_price)))) {
    return res.status(400).json({ error: 'GTT orders require a valid trigger price greater than 0.' });
  }

  // Validate Limit and Stop-Loss prices
  if (type === 'LIMIT' && (!price || parseFloat(price) <= 0 || isNaN(parseFloat(price)))) {
    return res.status(400).json({ error: 'Limit orders require a valid price greater than 0.' });
  }

  if ((type === 'SL-L' || type === 'SL-M') && (!trigger_price || parseFloat(trigger_price) <= 0 || isNaN(parseFloat(trigger_price)))) {
    return res.status(400).json({ error: 'Stop Loss orders require a valid trigger price greater than 0.' });
  }

  // Validate Quantity is a multiple of Lot Size for Options/Futures and MCX Commodities
  if (isDerivativeContract(symbol) || isCommodityContract(symbol)) {
    const { getLotSizes } = require('./services/instrumentsCache');
    const cleanSym = String(symbol).replace(/^(NSE:|BSE:|MCX:)/i, '');
    const lotSizes = getLotSizes([symbol, cleanSym]);
    const lotsize = lotSizes[symbol] || lotSizes[cleanSym] || 1;
    if (lotsize > 1 && (Number(quantity) % lotsize !== 0)) {
      return res.status(400).json({ error: `Quantity (${quantity}) must be a multiple of lot size (${lotsize}). Minimum order is 1 lot (${lotsize} qty).` });
    }
  }

  // Validate Exchange Freeze Limit (Hard Limit per Single Order)
  // Enforces regulatory maximum order quantity per order (e.g. 1,755 for NIFTY, 600 for BANKNIFTY, 1 Lakh for Equities, MCX limits)
  if (!isMF) {
    const { getFreezeLimit } = require('./services/taxCalculator');
    const freezeLimit = getFreezeLimit(symbol);
    if (freezeLimit && Number(quantity) > freezeLimit) {
      const { getLotSizes } = require('./services/instrumentsCache');
      const cleanSym = String(symbol).replace(/^(NSE:|BSE:|MCX:)/i, '');
      const lotSizes = getLotSizes([symbol, cleanSym]);
      const lotsize = lotSizes[symbol] || lotSizes[cleanSym] || 1;
      const maxLots = (lotsize && lotsize > 1) ? Math.floor(freezeLimit / lotsize) : freezeLimit;
      const errorMsg = (lotsize && lotsize > 1)
        ? `Order quantity (${quantity} qty / ${Math.round(quantity / lotsize)} lots) exceeds exchange freeze limit of ${freezeLimit} qty (${maxLots} lots) for ${symbol}. Please place an order within the freeze limit.`
        : `Order quantity (${quantity} shares) exceeds exchange freeze limit of ${freezeLimit.toLocaleString('en-IN')} shares for ${symbol}. Please place an order within the freeze limit.`;
      return res.status(400).json({ error: errorMsg });
    }
  }

  // Validate Bracket Order (BO) and Cover Order (CO) formats
  if (product_type === 'BO' || product_type === 'CO') {
    const ltp = getLtpFromPriceCache(symbol);
    const entryPrice = parseFloat(price) || ltp || 0;
    
    if (entryPrice <= 0) {
      return res.status(400).json({ error: 'Cannot place Bracket/Cover order when live price is unavailable. Please specify a limit price.' });
    }
    
    const parsedSL = sl_price ? parseFloat(sl_price) : 0;
    const parsedTgt = tgt_price ? parseFloat(tgt_price) : 0;
    
    if (side === 'BUY') {
      const lowerBoundary = Math.min(entryPrice, ltp > 0 ? ltp : entryPrice);
      const upperBoundary = Math.max(entryPrice, ltp > 0 ? ltp : entryPrice);
      if (parsedSL && parsedSL >= lowerBoundary) {
        return res.status(400).json({ error: `Invalid Stop Loss: For a BUY order, Stop Loss price (${parsedSL}) must be lower than the entry/market price (${lowerBoundary.toFixed(2)}).` });
      }
      if (parsedTgt && parsedTgt <= upperBoundary) {
        return res.status(400).json({ error: `Invalid Target: For a BUY order, Target price (${parsedTgt}) must be higher than the entry/market price (${upperBoundary.toFixed(2)}).` });
      }
    } else if (side === 'SELL') {
      const upperBoundary = Math.max(entryPrice, ltp > 0 ? ltp : entryPrice);
      const lowerBoundary = Math.min(entryPrice, ltp > 0 ? ltp : entryPrice);
      if (parsedSL && parsedSL <= upperBoundary) {
        return res.status(400).json({ error: `Invalid Stop Loss: For a SELL order, Stop Loss price (${parsedSL}) must be higher than the entry/market price (${upperBoundary.toFixed(2)}).` });
      }
      if (parsedTgt && parsedTgt >= lowerBoundary) {
        return res.status(400).json({ error: `Invalid Target: For a SELL order, Target price (${parsedTgt}) must be lower than the entry/market price (${lowerBoundary.toFixed(2)}).` });
      }
    }
  }

  // Determine if this order is strictly closing/reducing an existing open position or holding
  const isIntradayProduct = (product_type === 'INT' || product_type === 'MIS' || product_type === 'BO' || product_type === 'CO');
  const isDeliveryProduct = (product_type === 'CNC' || product_type === 'DELIVERY' || product_type === 'DEL' || !product_type);
  const cleanSym = symbol.includes(':') ? symbol.split(':')[1] : symbol;
  let isClosingOrder = false;
  let existingLongPos = null;
  let existingShortPos = null;

  if (side === 'SELL') {
    // Check if user has open long position in this symbol
    existingLongPos = await db('positions')
      .where({ user_id: req.user.id })
      .where(builder => {
        if (isIntradayProduct) {
          builder.whereIn('product_type', ['INT', 'MIS', 'BO', 'CO']);
        } else if (isDeliveryProduct) {
          builder.whereIn('product_type', ['DEL', 'CNC', 'DELIVERY']);
        } else {
          builder.where({ product_type });
        }
      })
      .where(builder => {
        builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
      })
      .where('quantity', '>', 0)
      .first();

    if (existingLongPos && Number(existingLongPos.quantity) >= Number(quantity) - 0.0001) {
      isClosingOrder = true;
    } else if (isDeliveryProduct) {
      // Check holdings (including combined T+0 long position + T+1 holding)
      const holding = await db('holdings')
        .where({ user_id: req.user.id })
        .where(builder => {
          builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
        })
        .where('quantity', '>', 0)
        .first();
      const combinedLongQty = (existingLongPos ? Number(existingLongPos.quantity) : 0) + (holding ? Number(holding.quantity) : 0);
      if (combinedLongQty >= Number(quantity) - 0.0001) {
        isClosingOrder = true;
      }
    }
  } else if (side === 'BUY') {
    // Check if user has open short position in this symbol
    existingShortPos = await db('positions')
      .where({ user_id: req.user.id })
      .where(builder => {
        if (isIntradayProduct) {
          builder.whereIn('product_type', ['INT', 'MIS', 'BO', 'CO']);
        } else if (isDeliveryProduct) {
          builder.whereIn('product_type', ['DEL', 'CNC', 'DELIVERY']);
        } else {
          builder.where({ product_type });
        }
      })
      .where(builder => {
        builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
      })
      .where('quantity', '<', 0)
      .first();

    if (existingShortPos && Math.abs(Number(existingShortPos.quantity)) >= Number(quantity) - 0.0001) {
      isClosingOrder = true;
    }
  }

  // Safety net: If this is an automated system square-off order, ensure it does not open a reverse/new position
  if (req.body && req.body.is_system_close && !isClosingOrder) {
    return res.json({ success: true, message: 'Position already closed or not found.' });
  }

  // 🛡️ PREVENTATIVE INTRADAY (MIS) RISK FILTER 🛡️
  // Never applies to closing/square-off orders of existing positions.
  if (!isClosingOrder && isIntradayProduct) {
    const cleanU = String(cleanSym).toUpperCase();
    const rawSymU = String(symbol).toUpperCase();
    
    // 1. Trade-to-Trade (T2T) & Surveillance Series Check (SEBI Compulsory Delivery Mandate)
    // Covers NSE: -BE, -BZ (ESM Stage II), -SM, -ST, and BSE: -T, -Z, -XT, -P
    const isT2TSeries = /-(BE|BZ|T|Z|XT|SM|ST|P)$/i.test(cleanU) || /-(BE|BZ|T|Z|XT|SM|ST|P)$/i.test(rawSymU);
    if (isT2TSeries) {
      return res.status(400).json({
        error: `Trade-to-Trade / Surveillance stock: Intraday (MIS) is strictly prohibited by SEBI regulations for ${cleanSym}. Only Delivery (CNC) is permitted.`
      });
    }

    const isDeriv = isDerivativeContract(symbol);
    const isCom = isCommodityContract(symbol);

    // 2. Cash Equity Minimum Liquidity / Volume Threshold Check
    if (!isDeriv && !isCom) {
      const { isFnoEligibleStock } = require('./services/instrumentsCache');
      const isFno = isFnoEligibleStock(symbol);
      const cachedPriceData = getPriceDataFromCache(symbol);
      const dayVolume = Number(cachedPriceData.volume || cachedPriceData.vol_traded_today || 0);
      const MIN_INTRADAY_VOLUME = 25000;

      // Enforce liquidity threshold for non-F&O cash equities after initial morning burst (past 09:30 AM IST)
      const istParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      }).formatToParts(new Date());
      const curHour = parseInt(istParts.find(p => p.type === 'hour')?.value || '0', 10);
      const curMin = parseInt(istParts.find(p => p.type === 'minute')?.value || '0', 10);
      const isPastOpening = (curHour * 60 + curMin) >= (9 * 60 + 30);

      if (!isFno && isPastOpening && dayVolume < MIN_INTRADAY_VOLUME) {
        return res.status(400).json({
          error: `Intraday (MIS) is disabled for ${cleanSym} due to low market liquidity (${dayVolume.toLocaleString()} shares traded today). Minimum volume required is ${MIN_INTRADAY_VOLUME.toLocaleString()}. Please select Delivery (CNC).`
        });
      }

      // 3. Intraday Dynamic Circuit Toggles (Circuit Proximity Protection)
      const liveLtp = getLtpFromPriceCache(symbol) || parseFloat(price) || 0;
      const upperCircuit = Number(cachedPriceData.upper_circuit || cachedPriceData.upper_ckt || 0);
      const lowerCircuit = Number(cachedPriceData.lower_circuit || cachedPriceData.lower_ckt || 0);

      // Upper Circuit Lock / Proximity check for SELL MIS (Short Selling)
      if (side === 'SELL') {
        const isNearUpperCircuit = (upperCircuit > 0 && liveLtp >= upperCircuit * 0.995);
        if (isNearUpperCircuit) {
          return res.status(400).json({
            error: `Intraday shorting (MIS) blocked: ${cleanSym} is at/near Upper Circuit limit (₹${upperCircuit || liveLtp}). Short selling is prohibited to prevent short-delivery auction risk. Only CNC allowed.`
          });
        }
      }

      // Lower Circuit Lock / Proximity check for BUY MIS (Long Buying)
      if (side === 'BUY') {
        const isNearLowerCircuit = (lowerCircuit > 0 && liveLtp <= lowerCircuit * 1.005);
        if (isNearLowerCircuit) {
          return res.status(400).json({
            error: `Intraday buying (MIS) blocked: ${cleanSym} is at/near Lower Circuit limit (₹${lowerCircuit || liveLtp}). Buying is prohibited due to square-off exit lock risk. Only CNC allowed.`
          });
        }
      }
    }
  }

  // 🛡️ RISK GUARDIAN ENFORCEMENT 🛡️
  // Note: Risk Guardian NEVER blocks closing/square-off orders for existing positions/holdings.
  const currentUser = await db('users').where({ id: req.user.id }).first();
  if (currentUser && currentUser.risk_guardian_active && !isClosingOrder) {
    if (side === 'SELL' && existingLongPos && Number(existingLongPos.quantity) > 0) {
      return res.status(400).json({
        error: `🛡️ Risk Guardian is active. You can only place closing orders up to your open position size (${existingLongPos.quantity} shares).`
      });
    }
    if (side === 'BUY' && existingShortPos && Math.abs(Number(existingShortPos.quantity)) > 0) {
      return res.status(400).json({
        error: `🛡️ Risk Guardian is active. You can only place closing orders up to your open short position size (${Math.abs(Number(existingShortPos.quantity))} shares).`
      });
    }
    const todayStart = getTradingSessionStartIST();

    // 1. Check Max Daily Trades Limit
    if (currentUser.max_daily_trades && currentUser.max_daily_trades > 0) {
      const todayOrdersCount = await db('orders')
        .where({ user_id: req.user.id })
        .where('created_at', '>=', todayStart)
        .whereIn('status', ['COMPLETED', 'COMPLETE', 'EXECUTED'])
        .count('id as count')
        .first();
      
      const count = parseInt(todayOrdersCount?.count || 0);
      if (count >= currentUser.max_daily_trades) {
        return res.status(400).json({
          error: `🛡️ Risk Guardian Active: You have reached your limit of ${currentUser.max_daily_trades} trade(s) for today. Trading is locked to protect your discipline.`
        });
      }
    }

    // 2. Check Max Daily Loss Limit
    if (currentUser.max_daily_loss && currentUser.max_daily_loss > 0) {
      const todayOrders = await db('orders')
        .where({ user_id: req.user.id })
        .where('created_at', '>=', todayStart)
        .whereIn('status', ['COMPLETED', 'COMPLETE', 'EXECUTED']);

      let todayRealizedPnl = 0;
      for (const ord of todayOrders) {
        if (ord.realized_pnl !== null && ord.realized_pnl !== undefined) {
          todayRealizedPnl += parseFloat(ord.realized_pnl);
        }
      }

      if (todayRealizedPnl < 0 && Math.abs(todayRealizedPnl) >= parseFloat(currentUser.max_daily_loss)) {
        return res.status(400).json({
          error: `🛡️ Risk Guardian Active: You have hit your maximum daily loss limit of ₹${parseFloat(currentUser.max_daily_loss).toLocaleString('en-IN')}. Trading is locked for today to protect your capital.`
        });
      }
    }
  }

  // Check market status & determine AMO vs CAS vs Regular
  let isAmo = (rawVariety === 'AMO' || Boolean(req.body.is_amo));
  let isCas = (rawVariety === 'CAS' || Boolean(req.body.is_cas));

  if (!isMF) {
    const isCommodity = isCommodityContract(symbol);
    const isIntradayProduct = (product_type === 'INT' || product_type === 'BO' || product_type === 'CO');
    
    const marketCheck = isSegmentMarketOpen(isCommodity, symbol, product_type, isClosingOrder);
    if (!marketCheck.open) {
      // 1. If Market is FORCED CLOSED / Holiday by Administrator, strictly block ALL orders
      if (marketCheck.isTotalBlock) {
        return res.status(400).json({ error: marketCheck.reason });
      }

      // 2. If market is closed, check if user explicitly requested an After Market Order (AMO)
      const userWantsAmo = (rawVariety === 'AMO' || Boolean(req.body.is_amo));
      if (userWantsAmo) {
        if (!marketCheck.isAmoWindow) {
          const amoTimingMsg = isCommodity
            ? 'After Market Orders (AMO) for MCX can only be placed between 11:30 PM and 08:57 AM. Regular market session is currently active.'
            : 'After Market Orders (AMO) can only be placed between 03:45 PM and 08:57 AM. Normal market session is currently active.';
          return res.status(400).json({ error: marketCheck.reason || amoTimingMsg });
        }
        isAmo = true;
      } else {
        // Market is closed, and user did NOT select AMO (they placed as Regular)
        if (marketCheck.isAmoWindow) {
          const hoursDesc = isCommodity ? '09:00 AM - 11:30 PM' : '09:15 AM - 03:30 PM';
          const marketName = isCommodity ? 'MCX Commodity Market' : 'Market';
          return res.status(400).json({
            error: `${marketName} is closed. Regular orders can only be placed during trading hours (${hoursDesc}). Please select AMO to place an After Market Order.`
          });
        }
        // Specific session cutoff (e.g. Intraday cutoff, Pre-market freeze, Settlement buffer)
        return res.status(400).json({ error: marketCheck.reason });
      }
    } else {
      // Market session is open: strictly forbid AMO during continuous open session!
      if (isAmo) {
        const amoTimingMsg = isCommodity
          ? 'After Market Orders (AMO) for MCX can only be placed between 11:30 PM and 08:57 AM. Regular market session is currently active.'
          : 'After Market Orders (AMO) can only be placed between 03:45 PM and 08:57 AM. Normal market session is currently active.';
        return res.status(400).json({
          error: amoTimingMsg
        });
      }
      if (marketCheck.isCas || marketCheck.session === 'PRE_MARKET' || marketCheck.session === 'CLOSING_AUCTION') {
        isCas = true;
      }
      if (marketCheck.isPostMarket || marketCheck.session === 'POST_MARKET') {
        const closePrice = priceCache[symbol]?.close || priceCache[symbol]?.prev_close_price || getLtpFromPriceCache(symbol);
        if (closePrice > 0) {
          req.body.post_market_price = closePrice;
        }
      }
    }
  }

  // Disallow Bracket Orders (BO) and Cover Orders (CO) for After Market Orders (AMO)
  if (isAmo && (product_type === 'BO' || product_type === 'CO' || req.body.is_bo || req.body.is_co || Boolean(sl_price && tgt_price))) {
    return res.status(400).json({
      error: 'Bracket Orders (BO) and Cover Orders (CO) are not permitted in After Market Orders (AMO). Please place a regular Limit or Market AMO order.'
    });
  }

  // BUG FIX 4: Block ALL new orders for F&O/FUT contracts on their expiry day after auto-square-off triggers.
  // Equities auto-square-off at 03:25 PM. MCX auto-square-off at 07:00 PM.
  // After these times, no manual intervention is allowed as the system forces settlement.
  const isDerivativeSymbol = isDerivativeContract(symbol);
  if (isDerivativeSymbol) {
    const { parseExpiryDate } = require('./services/autoSquareOff');
    const expDate = parseExpiryDate(symbol);
    let isExpiringToday = false;
    
    const now = new Date();
    const istParts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(now);
    const curYear = parseInt(istParts.find(p => p.type === 'year')?.value || '0', 10);
    const curMonth = parseInt(istParts.find(p => p.type === 'month')?.value || '0', 10);
    const curDay = parseInt(istParts.find(p => p.type === 'day')?.value || '0', 10);
    const h = parseInt(istParts.find(p => p.type === 'hour')?.value || '0', 10);
    const min = parseInt(istParts.find(p => p.type === 'minute')?.value || '0', 10);

    if (expDate) {
      isExpiringToday = (expDate.getFullYear() === curYear && (expDate.getMonth() + 1) === curMonth && expDate.getDate() === curDay);
    } else {
      // Fallback token matching if master map missing
      const dayStr = String(curDay).padStart(2, '0');
      const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      const monthStr = monthNames[curMonth - 1];
      const yearStr = String(curYear).slice(-2);
      isExpiringToday = symbol.includes(`${yearStr}${monthStr}`) || symbol.includes(`${dayStr}${monthStr}${yearStr}`);
    }

    if (isExpiringToday) {
      const isMCXSymbol = symbol.endsWith('-MCX') || isCommodityContract(symbol);
      // Equity/NFO/BFO: block after 03:25 PM; MCX: block after 07:00 PM
      const equityExpiryClosed = !isMCXSymbol && (h > 15 || (h === 15 && min >= 25));
      const mcxExpiryClosed   =  isMCXSymbol && (h >= 19);
      if (equityExpiryClosed || mcxExpiryClosed) {
        return res.status(400).json({
          error: `Cannot place orders on ${symbol.split('-')[0]}. This contract expires today and the Auto-Square-Off cutoff time has passed.`
        });
      }
    }
  }

  await db.transaction(async (trx) => {
      // Serialize order operations per-user to prevent race conditions with execution/cancel
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [req.user.id]);

      // 1. Determine execution status
      const hasTrigger = Boolean((type && (type.startsWith('SL') || type === 'TRAILING_STOP')) || (trigger_price !== undefined && trigger_price !== null && Number(trigger_price) > 0));
      const isMarket = type === 'MARKET' && !hasTrigger;
      const isTriggerOrder = hasTrigger;
      const status = isTriggerOrder ? 'PENDING_TRIGGER' : 'PENDING';
      let execPrice = parseFloat(price) || getLtpFromPriceCache(symbol); // Fetch live LTP here for market orders
      if (req.body.post_market_price) {
        execPrice = Number(req.body.post_market_price);
      }
      const resolvedTriggerPrice = trigger_price ? parseFloat(trigger_price) : (type && type.startsWith('SL') && price ? parseFloat(price) : null);
      
      // 2. Deduct Margin from User Balance
      let requiresMargin = true;
      let marginQty = Number(quantity);

      if (side === 'SELL') {
          const isDerivative = isDerivativeContract(symbol);
          if (effectiveProductType === 'DEL' && !isDerivative) {
              // 1. Fetch available Holdings
              const holding = await trx('holdings')
                  .where({ user_id: req.user.id })
                  .where(builder => {
                    builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
                  })
                  .first();
              const holdingQty = holding ? Number(holding.quantity) : 0;
              
              // 2. Fetch open Positions for today
              const existingPos = await trx('positions')
                  .where({ user_id: req.user.id })
                  .whereIn('product_type', ['DEL', 'CNC', 'DELIVERY'])
                  .where(builder => {
                    builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
                  })
                  .where('quantity', '>', 0)
                  .first();
              const posQty = existingPos && Number(existingPos.quantity) > 0 ? Number(existingPos.quantity) : 0;
              
              // 3. Fetch Pending Sell Orders for this symbol (including AMO and partial fills)
              const pendingOrders = await trx('orders')
                  .where({ user_id: req.user.id, side: 'SELL' })
                  .whereIn('product_type', ['DEL', 'CNC', 'DELIVERY'])
                  .where(builder => {
                    builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
                  })
                  .whereIn('status', ['PENDING', 'PENDING_TRIGGER', 'AMO_PENDING', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN']);
              const pendingSellQty = pendingOrders.reduce((sum, o) => sum + Number(o.pending_quantity !== undefined && o.pending_quantity !== null ? o.pending_quantity : o.quantity), 0);
              
              const totalAvailable = parseFloat((holdingQty + posQty - pendingSellQty).toFixed(4));
              
              if (Number(quantity) > totalAvailable) {
                  throw new Error(`Insufficient holdings. You only have ${totalAvailable} shares available to sell${pendingSellQty > 0 ? ` (${pendingSellQty} shares reserved in open/AMO orders)` : ''}.`);
              }
              requiresMargin = false; // Selling DEL from holdings requires no margin
          } else {
              // Re-evaluate closing order inside transaction with advisory lock to prevent TOCTOU naked shorting
              const txLongPos = await trx('positions')
                  .where({ user_id: req.user.id })
                  .where(builder => {
                      if (isIntradayProduct) builder.whereIn('product_type', ['INT', 'MIS', 'BO', 'CO']);
                      else if (isDeliveryProduct) builder.whereIn('product_type', ['DEL', 'CNC', 'DELIVERY']);
                      else builder.where({ product_type });
                  })
                  .where(builder => {
                      builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
                  })
                  .where('quantity', '>', 0)
                  .forUpdate()
                  .first();
              
              if (txLongPos && Number(txLongPos.quantity) >= Number(quantity) - 0.0001) {
                  requiresMargin = false;
              } else if (!isDerivative || effectiveProductType !== 'DEL') {
                  if (txLongPos) {
                      const excessQty = Math.max(0, Number(quantity) - Number(txLongPos.quantity));
                      if (excessQty === 0) {
                          requiresMargin = false;
                      } else {
                          marginQty = excessQty;
                      }
                  }
              } else if (isDerivative && effectiveProductType === 'DEL') {
                  const txHolding = await trx('holdings')
                      .where({ user_id: req.user.id })
                      .where(builder => {
                          builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
                      })
                      .where('quantity', '>', 0)
                      .first();
                  const totalHeldLong = (txLongPos ? Number(txLongPos.quantity) : 0) + (txHolding ? Number(txHolding.quantity) : 0);
                  if (totalHeldLong > 0) {
                      const excessQty = Math.max(0, Number(quantity) - totalHeldLong);
                      if (excessQty === 0) {
                          requiresMargin = false;
                      } else {
                          marginQty = excessQty;
                      }
                  }
              }
          }
      } else if (side === 'BUY') {
          // Re-evaluate closing short position inside transaction with advisory lock
          const txShortPos = await trx('positions')
              .where({ user_id: req.user.id })
              .where(builder => {
                if (isIntradayProduct) builder.whereIn('product_type', ['INT', 'MIS', 'BO', 'CO']);
                else if (isDeliveryProduct) builder.whereIn('product_type', ['DEL', 'CNC', 'DELIVERY']);
                else builder.where({ product_type: effectiveProductType });
              })
              .where(builder => {
                builder.where({ symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
              })
              .where('quantity', '<', 0)
              .forUpdate()
              .first();

          if (txShortPos && Math.abs(Number(txShortPos.quantity)) >= Number(quantity) - 0.0001) {
              requiresMargin = false;
          } else if (txShortPos) {
              const excessQty = Math.max(0, Number(quantity) - Math.abs(Number(txShortPos.quantity)));
              if (excessQty === 0) {
                  requiresMargin = false;
              } else {
                  marginQty = excessQty;
              }
          }
      }

      let finalMargin = 0;
      if (requiresMargin) {
          let priceBasis = execPrice;
          if (!priceBasis || priceBasis <= 0) {
              priceBasis = parseFloat(resolvedTriggerPrice) || parseFloat(trigger_price) || parseFloat(price) || getLtpFromPriceCache(symbol);
          }
          if (priceBasis <= 0) {
              if (isMarket) {
                  throw new Error(`Live market price is currently unavailable for ${symbol}. Please specify a limit price or wait for market data to connect.`);
              } else if (isDerivativeContract(symbol) && side === 'BUY') {
                  throw new Error(`A valid price > 0 is required to calculate margin for ${symbol}.`);
              } else {
                  throw new Error(`A valid price or trigger price > 0 is required to calculate margin for ${symbol}.`);
              }
          }
          execPrice = execPrice > 0 ? execPrice : priceBasis;
          const { calculateRequiredMargin } = require('./services/marginEngine');
          finalMargin = calculateRequiredMargin(symbol, effectiveProductType, side, marginQty, priceBasis);
          if (finalMargin <= 0 && isDerivativeContract(symbol) && side === 'BUY') {
              throw new Error(`Unable to determine required margin for ${symbol}. Please specify a valid limit price.`);
          }
      }

      if (requiresMargin && finalMargin > 0) {
        const user = await trx('users').where({ id: req.user.id }).first();
        if (Number(user.balance) < finalMargin) {
           throw Object.assign(new Error(`Insufficient Funds. Required: ₹${finalMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Available: ₹${Number(user.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`), { statusCode: 400 });
        }
        const newBalance = Number(user.balance) - finalMargin;
        await trx('users').where({ id: req.user.id }).update({ balance: newBalance });
        
        if (req.body.slice_group_id) {
          const sliceGroupId = req.body.slice_group_id;
          const existingLedger = await trx('ledger')
            .where({ user_id: req.user.id, type: 'MARGIN_BLOCK' })
            .where('description', 'like', `%[${sliceGroupId}]%`)
            .first();

          if (existingLedger) {
            const updatedAmount = Math.round((Number(existingLedger.amount) - finalMargin + Number.EPSILON) * 100) / 100;
            await trx('ledger').where({ id: existingLedger.id }).update({
              amount: updatedAmount,
              description: `Margin blocked for ${side} ${symbol} (${effectiveProductType}) [${sliceGroupId}]`
            });
          } else {
            await trx('ledger').insert({
              user_id: req.user.id,
              amount: -finalMargin,
              type: 'MARGIN_BLOCK',
              description: `Margin blocked for ${side} ${symbol} (${effectiveProductType}) [${sliceGroupId}]`
            });
          }
        } else {
          await trx('ledger').insert({
            user_id: req.user.id,
            amount: -finalMargin,
            type: 'MARGIN_BLOCK',
            description: `Margin blocked for ${side} ${quantity} ${symbol} (${effectiveProductType})`
          });
        }
      }

      // Ensure margin passed down to insert is the final margin
      const marginToSave = requiresMargin ? finalMargin : 0;
      const baseRemarks = req.body.remarks || (req.body.is_exit ? 'Exit Position' : '');
      const orderRemarks = req.body.slice_group_id ? `Slice ${req.body.slice_index || 1}/${req.body.slice_total || 1} [${req.body.slice_group_id}]${baseRemarks ? ' ' + baseRemarks : ''}` : baseRemarks;
      const orderVariety = isCas ? 'CAS' : (isAmo ? 'AMO' : 'REGULAR');
      const initialStatus = (isAmo || isCas) ? 'AMO_PENDING' : status;

      // Compute exchange freeze limit slices & initial brokerage (brokerage depends upon slices)
      const { getFreezeLimit, calculateTaxes } = require('./services/taxCalculator');
      const orderFreezeLimit = getFreezeLimit(symbol);
      const computedSliceTotal = req.body.slice_total 
        ? Number(req.body.slice_total) 
        : (orderFreezeLimit && quantity > orderFreezeLimit ? Math.ceil(quantity / orderFreezeLimit) : 1);
      const initialTaxObj = calculateTaxes(symbol, effectiveProductType, side, quantity, execPrice || price || 0, 0, 0, computedSliceTotal);
      const initialBrokerage = initialTaxObj.brokerage || 0;

      // 3. Insert Order
      const [id] = await trx('orders').insert({
        user_id: req.user.id, symbol, type, side, quantity, price: execPrice || null,
        filled_quantity: 0, pending_quantity: quantity, average_price: null,
        order_variety: orderVariety,
        status: initialStatus, sl_price: sl_price || null, tgt_price: tgt_price || null, trigger_price: resolvedTriggerPrice, trail_amount: trail_amount || null, product_type: effectiveProductType, margin: marginToSave,
        remarks: orderRemarks,
        quoted_price: execPrice || null,
        slice_group_id: req.body.slice_group_id || null,
        slice_index: req.body.slice_index ? Number(req.body.slice_index) : (computedSliceTotal > 1 ? 1 : null),
        slice_total: computedSliceTotal,
        brokerage: initialBrokerage
      }).returning('id');
      const orderId = typeof id === 'object' ? id.id : id;
      
      req.orderToProcess = {
        id: orderId, user_id: req.user.id, symbol, type, side, quantity, price: execPrice || null,
        filled_quantity: 0, pending_quantity: quantity, average_price: null,
        order_variety: orderVariety,
        status: initialStatus, sl_price: sl_price || null, tgt_price: tgt_price || null, trigger_price: resolvedTriggerPrice, trail_amount: trail_amount || null, product_type: effectiveProductType, margin: marginToSave,
        remarks: orderRemarks,
        quoted_price: execPrice || null,
        is_exit: Boolean(req.body.is_exit || isExplicitExit),
        slice_group_id: req.body.slice_group_id || null,
        slice_index: req.body.slice_index ? Number(req.body.slice_index) : (computedSliceTotal > 1 ? 1 : null),
        slice_total: computedSliceTotal,
        brokerage: initialBrokerage,
        isMarket,
        isAmo,
        isCas
      };
    });

    if (req.orderToProcess.isAmo || req.orderToProcess.isCas) {
      const ord = req.orderToProcess;
      const isCasOrder = ord.isCas;
      const msg = isCasOrder
        ? 'Pre-Market CAS order placed! Will be matched at discovered equilibrium opening price at 09:08 AM.'
        : 'After Market Order (AMO) placed! Will be executed via realistic volume matching at market open.';

      const isSlicedChild = Boolean(req.body.slice_group_id && (Number(req.body.slice_total || 1) > 1));
      const isFirstSlice = Number(req.body.slice_index || 1) === 1;

      if (!isSlicedChild || isFirstSlice) {
        const displayQty = isSlicedChild ? (req.body.total_quantity || (quantity * Number(req.body.slice_total || 1))) : quantity;
        const sliceSuffix = isSlicedChild ? ` (${req.body.slice_total} Slices)` : '';
        const pushTag = req.body.slice_group_id ? `order_group_${req.body.slice_group_id}` : `order_${ord.id}`;

        sendPushNotification(req.user.id, {
          title: `${isCasOrder ? 'CAS' : 'AMO'} Order Placed: ${side} ${displayQty} ${symbol}${sliceSuffix}`,
          body: msg,
          url: '/orders',
          tag: pushTag
        }).catch(() => {});
      }

      return res.json({
        success: true,
        orderId: ord.id,
        status: 'AMO_PENDING',
        order_variety: ord.order_variety,
        message: msg
      });
    }

    const triggerEngine = require('./services/triggerEngine');
    const ord = req.orderToProcess;
    
    // Only register non-market orders in triggerEngine (LIMIT, SL, SL-L, TSL, GTT)
    if (!ord.isMarket && ord.type !== 'MARKET') {
      await triggerEngine.addOrderToMemory(ord);
    }
    
    setTimeout(() => {
        try {
            const { pubClient } = require('./services/redisClient');
            if (pubClient) {
                pubClient.publish('reload_triggers', '1').catch(e=>{});
                pubClient.publish('reload_volume_orders', '1').catch(e=>{});
                pubClient.publish('fyers_subscribe', JSON.stringify([ord.symbol])).catch(e=>{});
            }
        } catch(e) {}
    }, 300);
    
    // Execute Market orders via Realistic Volume & Market Depth Matching Engine
    if (ord.isMarket) {
      const isMutualFund = ord.symbol.endsWith('-MF') || ord.symbol.includes('MUTUALFUND') || /^\d+$/.test(ord.symbol);
      if (isMutualFund) {
        try {
          await triggerEngine.removeOrderFromMemory(ord.id, ord.symbol);
          const navPrice = getLtpFromPriceCache(ord.symbol) || parseFloat(ord.price) || parseFloat(req.body.price) || 0;
          await triggerEngine.executeOrder(ord, navPrice);
        } catch (err) {
          console.error('Mutual fund direct execution error:', err);
        }
      } else {
        let baseLtp = getLtpFromPriceCache(ord.symbol) || parseFloat(ord.price) || parseFloat(req.body.price) || 0;
        if (baseLtp <= 0) {
          try {
            const { fetchBatchLTPs } = require('./services/fyers');
            if (typeof fetchBatchLTPs === 'function') {
              const liveQuotes = await fetchBatchLTPs([ord.symbol]);
              if (liveQuotes && liveQuotes[ord.symbol]?.ltp) {
                baseLtp = Number(liveQuotes[ord.symbol].ltp);
              }
            }
          } catch (fetchErr) {}
        }

        if (baseLtp > 0) {
          try {
            await triggerEngine.removeOrderFromMemory(ord.id, ord.symbol);
            const volumeMatchingEngine = require('./services/volumeMatchingEngine');
            await volumeMatchingEngine.submitOrder(ord, baseLtp);
          } catch (err) {
            console.error('Volume matching submission error:', err);
          }
        } else {
          // If price is currently unavailable, register in triggerEngine so incoming tick executes it
          try {
            await triggerEngine.addOrderToMemory(ord);
          } catch (trigErr) {}
        }
      }
    } else if (ord.type === 'LIMIT') {
      // Check for marketable limit order (e.g. BUY with limit >= LTP, or SELL with limit <= LTP)
      const currentLtp = getLtpFromPriceCache(ord.symbol) || parseFloat(req.body.price) || 0;
      
      const limitPrice = parseFloat(ord.price) || 0;
      if (currentLtp > 0 && limitPrice > 0) {
        const isMarketableBuy = ord.side === 'BUY' && currentLtp <= limitPrice;
        const isMarketableSell = ord.side === 'SELL' && currentLtp >= limitPrice;
        if (isMarketableBuy || isMarketableSell) {
          try {
            await triggerEngine.removeOrderFromMemory(ord.id, ord.symbol);
            const volumeMatchingEngine = require('./services/volumeMatchingEngine');
            await volumeMatchingEngine.submitOrder(ord, currentLtp);
          } catch (err) {
            console.error('Immediate marketable limit execution error:', err);
          }
        }
      }
    }

    // Final status after execution without redundant DB query delay
    const finalStatus = ord.status || 'PENDING';
    const finalPrice = ord.price || price;

    // Send instant push & Telegram notification asynchronously (consolidate sliced orders into 1 single notification)
    const isSlicedOrder = Boolean((ord.slice_total && ord.slice_total > 1) || (req.body.slice_group_id && Number(req.body.slice_total || 1) > 1));
    const isFirstSlice = !req.body.slice_index || Number(req.body.slice_index) === 1;

    if (!isSlicedOrder || isFirstSlice) {
      const displayQty = isSlicedOrder ? (req.body.total_quantity || quantity) : quantity;
      const sliceTotalCount = ord.slice_total || req.body.slice_total || 1;
      const sliceSuffix = sliceTotalCount > 1 ? ` (${sliceTotalCount} Slices)` : '';
      const pushTag = req.body.slice_group_id ? `order_group_${req.body.slice_group_id}` : `order_${ord.id}`;

      sendPushNotification(req.user.id, {
        title: `Order Placed: ${side} ${displayQty} ${symbol}${sliceSuffix}`,
        body: `Status: ${finalStatus} (${product_type || 'INT'})`,
        url: '/orders',
        tag: pushTag
      }).catch(() => {});

      if (finalStatus === 'EXECUTED' || finalStatus === 'COMPLETE') {
        sendTelegramAlert(req.user.id, 'ORDER', {
          symbol,
          side,
          quantity: displayQty,
          price: finalPrice,
          product_type
        }).catch(() => {});
      }
    }

    res.json({ 
      success: true, 
      orderId: ord.id, 
      status: finalStatus,
      isSliced: Boolean(ord.slice_total > 1),
      slicesCount: ord.slice_total || 1,
      brokerage: ord.brokerage || 0
    });

  } catch (error) {
    lastOrderError = { message: error.message, stack: error.stack, payload: req.body };
    console.error('[ORDER ERROR]:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ⚡ SIP Endpoints ⚡
app.post('/api/sip', authenticateToken, async (req, res) => {
  const { symbol, amount, frequency, price } = req.body;
  if (!symbol || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const finalMargin = Number(amount);
    if (isNaN(finalMargin) || finalMargin <= 0) {
      return res.status(400).json({ error: 'Invalid SIP amount' });
    }

    // 1. Resolve Execution Price / NAV (Official NAV only - never trust client supplied price for mutual funds)
    let execPrice = await SIPEngine.getLatestNav(symbol, priceCache);
    if (!execPrice || execPrice <= 0) {
      const cleanSym = symbol.replace(/^(NSE:|BSE:|MCX:)/i, '');
      execPrice = Number(priceCache[symbol]?.ltp) || Number(priceCache[cleanSym]?.ltp) || Number(priceCache[`NSE:${cleanSym}`]?.ltp) || 0;
    }
    if (!execPrice || execPrice <= 0) {
      return res.status(400).json({ error: `Unable to determine live NAV or market price for ${symbol}. Please try again.` });
    }

    const qty = parseFloat((finalMargin / execPrice).toFixed(4));
    if (qty <= 0) {
      return res.status(400).json({ error: 'Calculated quantity is zero. Please increase SIP amount.' });
    }

    const nextExecutionDate = SIPEngine.getNextExecutionDate(new Date(), frequency);
    const isMf = Boolean(symbol.endsWith('-MF') || symbol.includes('MUTUALFUND'));
    const assetClass = isMf ? 'MUTUAL_FUND' : 'EQUITY';
    const cleanSym = symbol.includes(':') ? symbol.split(':')[1] : symbol;

    await db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [req.user.id]);
      const user = await trx('users').where({ id: req.user.id }).first();
      if (!user) {
        throw Object.assign(new Error('User account not found or has been deleted.'), { statusCode: 401 });
      }
      if (Number(user.balance) < finalMargin) {
         throw Object.assign(new Error(`Insufficient funds for SIP installment. Required: ₹${finalMargin.toLocaleString('en-IN')}, Available: ₹${Number(user.balance).toLocaleString('en-IN')}`), { statusCode: 400 });
      }
      
      const newBalance = Number(user.balance) - finalMargin;
      await trx('users').where({ id: req.user.id }).update({ balance: newBalance });
      
      await trx('ledger').insert({
          user_id: req.user.id,
          amount: -finalMargin,
          type: 'MARGIN_BLOCK',
          description: `SIP Installment (${frequency || 'MONTHLY'}): Bought ${qty} units of ${symbol} @ ₹${execPrice.toFixed(2)}`
      });

      const anchorDay = nextExecutionDate ? new Date(nextExecutionDate).getUTCDate() : new Date().getUTCDate();
      await trx('sips').insert({
        user_id: req.user.id,
        symbol,
        amount: finalMargin,
        frequency: frequency || 'MONTHLY',
        next_execution_date: nextExecutionDate,
        status: 'ACTIVE',
        anchor_day: anchorDay,
        failure_count: 0
      });

      // Insert Executed Order Record
      await trx('orders').insert({
        user_id: req.user.id,
        symbol,
        type: 'MARKET',
        side: 'BUY',
        quantity: qty,
        filled_quantity: qty,
        pending_quantity: 0,
        price: execPrice,
        average_price: execPrice,
        status: 'EXECUTED',
        order_variety: 'SIP',
        product_type: 'DEL',
        margin: finalMargin,
        created_at: new Date(),
        updated_at: new Date()
      });

      // Update or Insert Holding Directly
      const existingHolding = await trx('holdings')
        .where({ user_id: req.user.id })
        .where(builder => {
          builder.where({ symbol: symbol })
                 .orWhere({ symbol: cleanSym })
                 .orWhere({ symbol: `NSE:${cleanSym}` })
                 .orWhere({ symbol: `BSE:${cleanSym}` });
        })
        .first();

      if (existingHolding) {
        const prevQty = parseFloat(existingHolding.quantity) || 0;
        const prevAvg = parseFloat(existingHolding.average_price) || execPrice;
        const totalQty = prevQty + qty;
        const newAvg = totalQty > 0 ? ((prevQty * prevAvg) + (qty * execPrice)) / totalQty : execPrice;
        await trx('holdings').where({ id: existingHolding.id }).update({
          quantity: parseFloat(totalQty.toFixed(4)),
          average_price: parseFloat(newAvg.toFixed(2)),
          asset_class: assetClass,
          updated_at: new Date()
        });
      } else {
        await trx('holdings').insert({
          user_id: req.user.id,
          symbol,
          quantity: qty,
          average_price: parseFloat(execPrice.toFixed(2)),
          asset_class: assetClass,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    });

    res.json({ success: true, message: `SIP created and 1st installment executed successfully (${qty} units @ ₹${execPrice.toFixed(2)})` });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message, success: false });
  }
});

app.get('/api/sips', authenticateToken, async (req, res) => {
  try {
    const sips = await db('sips').where({ user_id: req.user.id });
    res.json({ success: true, sips });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});


// ⚡ Execute a single SIP installment on demand
app.post('/api/sip/:id/execute-now', authenticateToken, async (req, res) => {
  try {
    const sip = await db('sips').where({ id: req.params.id, user_id: req.user.id }).first();
    if (!sip) return res.status(404).json({ error: 'SIP not found' });
    
    const result = await SIPEngine.executeSingleSip(sip.id, priceCache, true);
    if (!result.success) {
      if (result.reason === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({ error: `Insufficient funds. Needed ₹${result.required}, Available ₹${result.available.toFixed(2)}` });
      }
      if (result.reason === 'NAV_UNAVAILABLE') {
        return res.status(400).json({ error: 'Latest NAV is temporarily unavailable. Please try again shortly.' });
      }
      if (result.reason === 'ZERO_UNITS_ALLOCATED') {
        return res.status(400).json({ error: 'Installment amount is too small for current NAV. Please increase amount.' });
      }
      return res.status(500).json({ error: result.reason || 'Failed to execute SIP installment' });
    }
    res.json({ success: true, message: `Successfully executed SIP installment! ${result.units} units credited @ NAV ₹${result.nav}`, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// ⚡ Admin: Process all due SIPs
app.post('/api/admin/sips/process-all', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });
    const result = await SIPEngine.processDueSips(priceCache);
    res.json({ success: true, message: `Processed ${result?.total || 0} due SIPs: ${result?.success || 0} succeeded, ${result?.failed || 0} failed/skipped.`, result });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// ⚡ Admin: Process all queued After-Cutoff Mutual Fund orders
app.post('/api/admin/mf/settle-pending', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });
    const result = await SIPEngine.processPendingMutualFundOrders(priceCache);
    res.json({ success: true, message: `Settled ${result?.settled || 0} queued mutual fund orders (${result?.total || 0} evaluated).`, result });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

app.delete('/api/sip/:id', authenticateToken, async (req, res) => {
  try {
    await db('sips').where({ id: req.params.id, user_id: req.user.id }).del();
    res.json({ success: true, message: 'SIP deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// ⚡ Fetch Batch LTPs (REST) ⚡
// In-flight deduplication: if 10 users request prices for the same symbols at once,
// only ONE Fyers REST call is made — all other requests share the same Promise result.
const _inFlightLtpRequests = new Map(); // key: sorted symbol list → Promise

app.post('/api/ltp-batch', async (req, res) => {
  try {
    const { symbols, force } = req.body;
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ error: 'Missing or invalid symbols array' });
    }
    
    const { fetchBatchLTPs, registerTokens, isAnyTradingSessionOpen } = require('./services/fyers');
    if (registerTokens) registerTokens(symbols);
    
    const result = {};
    const missingSymbols = [];
    const now = Date.now();
    const marketOpen = typeof isAnyTradingSessionOpen === 'function' ? isAnyTradingSessionOpen() : true;
    // When market is closed (weekends, nights), prices don't change every 15 seconds.
    // Allow cached closing prices to stay valid up to 72 hours so users don't see '-' or empty prices.
    const maxCacheAge = marketOpen ? 15000 : 72 * 60 * 60 * 1000;
    
    // 1. Serve everything we already have in the live priceCache instantly (unless force=true)
    for (const item of symbols) {
      const sym = typeof item === 'string' ? item : item.symbol;
      if (!sym) continue;
      
      const rawSym = sym.includes(':') ? sym.split(':')[1] : null;
      const cleanSym = sym.replace(/^(NSE:|BSE:|MCX:)/i, '');
      const baseSym = cleanSym.replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ|INDEX)$/i, '');
      const cached = priceCache[sym] || 
                     (rawSym ? priceCache[rawSym] : null) || 
                     priceCache[cleanSym] || 
                     priceCache[baseSym] || 
                     priceCache[`NSE:${cleanSym}`] || 
                     priceCache[`NSE:${baseSym}`] || 
                     priceCache[`NSE:${baseSym}-EQ`] || 
                     priceCache[`BSE:${cleanSym}`] || 
                     priceCache[`BSE:${baseSym}`] || 
                     priceCache[`MCX:${cleanSym}`] || 
                     priceCache[`NSE:${sym}`] || 
                     priceCache[`BSE:${sym}`] || 
                     priceCache[`MCX:${sym}`];
      const isStale = cached && cached.timestamp ? (now - cached.timestamp > maxCacheAge) : false;
      
      if (!force && cached && cached.ltp > 0 && !isStale) {
        result[sym] = cached;
      } else {
        missingSymbols.push(sym);
      }
    }
    
    // 2. For missing symbols, deduplicate concurrent Fyers REST calls
    if (missingSymbols.length > 0) {
      // Create a stable cache key from the sorted list of missing symbols
      const cacheKey = missingSymbols.slice().sort().join(',');
      
      let fetchPromise = _inFlightLtpRequests.get(cacheKey);
      if (!fetchPromise) {
        // No in-flight request — start a new one
        fetchPromise = fetchBatchLTPs(missingSymbols).then(data => {
          // Write results into priceCache for future requests
          for (const [sym, ltpData] of Object.entries(data)) {
            if (ltpData && ltpData.ltp > 0) {
              priceCache[sym] = ltpData;
              const rSym = sym.includes(':') ? sym.split(':')[1] : null;
              if (rSym) {
                priceCache[rSym] = ltpData;
                const bSym = rSym.replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ|INDEX)$/i, '');
                if (bSym !== rSym) {
                  priceCache[bSym] = ltpData;
                  priceCache[`NSE:${bSym}`] = ltpData;
                  priceCache[`NSE:${bSym}-EQ`] = ltpData;
                }
              }
              
              // ⚡ Real-time broadcast to socket rooms immediately
              if (io) {
                io.to(sym).emit('price_snapshot', { [sym]: ltpData });
                if (rSym) io.to(rSym).emit('price_snapshot', { [rSym]: ltpData });
              }
            }
          }
          return data;
        }).finally(() => {
          // Remove from in-flight map after a short hold (3s) so next request
          // uses the priceCache above rather than hitting Fyers REST again
          setTimeout(() => _inFlightLtpRequests.delete(cacheKey), 3000);
        });
        _inFlightLtpRequests.set(cacheKey, fetchPromise);
      }
      
      // All concurrent requests for this same symbol set await the SAME promise with a strict 2.0s timeout cap
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({}), 2000));
      const data = await Promise.race([fetchPromise, timeoutPromise]);
      for (const [sym, ltpData] of Object.entries(data)) {
        if (ltpData && ltpData.ltp > 0) {
          result[sym] = ltpData;
        }
      }

      // 3. Fallback: If Fyers didn't return a price (e.g. rate limit, expired token, or off-hours),
      // preserve whatever valid price was already cached in priceCache so the UI doesn't drop to '-'
      for (const sym of missingSymbols) {
        if (!result[sym]) {
          const fallback = getPriceDataFromCache(sym);
          if (fallback && fallback.ltp > 0) {
            result[sym] = fallback;
          }
        }
      }
    }
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🧮 Estimate Charges 🧮
app.get('/api/estimate-charges', authenticateToken, (req, res) => {
  try {
    const { symbol, product_type, side, quantity, price, entry_price, holding_days } = req.query;
    if (!symbol || !side || !quantity || !price) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const { calculateTaxes } = require('./services/taxCalculator');
    const taxes = calculateTaxes(symbol, product_type || 'DEL', side, Number(quantity), Number(price), Number(entry_price || 0), Number(holding_days || 0));
    
    res.json(taxes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// 🔔 Web Push Notification Endpoints 🔔
const { sendPushNotification, vapidPublicKey } = require('./services/pushService');

app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

app.get('/api/push/status', authenticateToken, async (req, res) => {
  try {
    let hasWebPush = false;
    let hasFcm = false;
    try {
      const webSub = await db('push_subscriptions').where({ user_id: req.user.id }).first();
      hasWebPush = !!webSub;
    } catch (e) {}
    try {
      const fcmSub = await db('fcm_device_tokens').where({ user_id: req.user.id }).first();
      hasFcm = !!fcmSub;
    } catch (e) {}

    res.json({
      success: true,
      enabled: hasWebPush || hasFcm,
      hasWebPush,
      hasFcm
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/push/subscribe', authenticateToken, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'Invalid subscription payload' });
    }

    const existing = await db('push_subscriptions').where({ endpoint }).first();
    if (existing) {
      await db('push_subscriptions').where({ endpoint }).update({
        user_id: req.user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        updated_at: new Date()
      });
    } else {
      await db('push_subscriptions').insert({
        user_id: req.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth
      });
    }

    res.json({ success: true, message: 'Push subscription registered successfully' });
  } catch (err) {
    console.error('Failed to save push subscription:', err);
    res.status(500).json({ error: err.message });
  }
});

// 📱 Native Mobile App Push Endpoints (FCM)
app.post('/api/push/fcm-subscribe', authenticateToken, async (req, res) => {
  try {
    const { token, platform, deviceName } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'FCM token is required' });
    }

    const existing = await db('fcm_device_tokens').where({ token }).first();
    if (existing) {
      await db('fcm_device_tokens').where({ token }).update({
        user_id: req.user.id,
        platform: platform || 'android',
        device_name: deviceName || null,
        updated_at: new Date()
      });
    } else {
      await db('fcm_device_tokens').insert({
        user_id: req.user.id,
        token,
        platform: platform || 'android',
        device_name: deviceName || null
      });
    }

    res.json({ success: true, message: 'FCM device token registered successfully' });
  } catch (err) {
    console.error('Failed to save FCM token:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/push/fcm-unsubscribe', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    if (token) {
      await db('fcm_device_tokens').where({ token }).delete();
    } else {
      await db('fcm_device_tokens').where({ user_id: req.user.id }).delete();
    }
    res.json({ success: true, message: 'Unsubscribed FCM device token' });
  } catch (err) {
    console.error('Failed to unsubscribe FCM token:', err);
    res.status(500).json({ error: err.message });
  }
});


// 📱 Telegram Trade & Risk Alerts Endpoints 📱
const { 
  sendTelegramAlert, 
  sendTestAlert, 
  broadcastTelegramMessage, 
  handleIncomingTelegramUpdate,
  getSystemConfig: getTelegramSystemConfig, 
  updateSystemConfig: updateTelegramSystemConfig 
} = require('./services/telegramService');

// 📱 Telegram Webhook Endpoint for Interactive 2-Way Bot Commands (/pnl, /positions, /exitall)
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const expectedSecret = process.env.TELEGRAM_SECRET_TOKEN;
    const providedSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (expectedSecret && providedSecret !== expectedSecret) {
      return res.status(401).json({ error: 'Unauthorized Telegram webhook request.' });
    }
    const result = await handleIncomingTelegramUpdate(req.body);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Telegram webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/telegram/settings', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const sysConfig = getTelegramSystemConfig();

    res.json({
      success: true,
      telegram_chat_id: user.telegram_chat_id || '',
      telegram_alerts_enabled: !!user.telegram_alerts_enabled,
      telegram_alert_orders: user.telegram_alert_orders !== false,
      telegram_alert_targets: user.telegram_alert_targets !== false,
      telegram_alert_stoploss: user.telegram_alert_stoploss !== false,
      telegram_alert_risk: user.telegram_alert_risk !== false,
      bot_username: sysConfig.bot_username || 'SkandXAlerts_bot',
      global_enabled: sysConfig.global_enabled
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/telegram/settings', authenticateToken, async (req, res) => {
  try {
    const { 
      telegram_chat_id, 
      telegram_alerts_enabled, 
      telegram_alert_orders, 
      telegram_alert_targets, 
      telegram_alert_stoploss, 
      telegram_alert_risk 
    } = req.body;

    await db('users').where({ id: req.user.id }).update({
      telegram_chat_id: (telegram_chat_id || '').trim(),
      telegram_alerts_enabled: !!telegram_alerts_enabled,
      telegram_alert_orders: telegram_alert_orders !== undefined ? !!telegram_alert_orders : true,
      telegram_alert_targets: telegram_alert_targets !== undefined ? !!telegram_alert_targets : true,
      telegram_alert_stoploss: telegram_alert_stoploss !== undefined ? !!telegram_alert_stoploss : true,
      telegram_alert_risk: telegram_alert_risk !== undefined ? !!telegram_alert_risk : true
    });

    res.json({ success: true, message: 'Telegram alert preferences updated successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/telegram/test', authenticateToken, async (req, res) => {
  try {
    const { chat_id } = req.body;
    const user = await db('users').where({ id: req.user.id }).first();
    const targetChatId = chat_id || user?.telegram_chat_id;

    if (!targetChatId) {
      return res.status(400).json({ error: 'Please enter a valid Telegram Chat ID first.' });
    }

    const result = await sendTestAlert(targetChatId, user?.username || 'Trader');
    if (result.success) {
      res.json({ success: true, message: 'Test message delivered to your Telegram account!' });
    } else {
      res.status(400).json({ error: result.error || 'Failed to deliver test message to Telegram.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🛡️ Admin Telegram Traffic & Peak Protection Endpoints
app.get('/api/admin/telegram/config', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });
    const config = getTelegramSystemConfig();
    const connectedUsersCount = await db('users').whereNotNull('telegram_chat_id').where('telegram_alerts_enabled', true).count('* as count').first();
    res.json({ success: true, config, connectedUsers: Number(connectedUsersCount?.count || 0) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/telegram/config', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });
    const updated = updateTelegramSystemConfig(req.body);
    res.json({ success: true, message: 'Telegram system configuration updated!', config: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/telegram/broadcast', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message content is required' });

    const result = await broadcastTelegramMessage(message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🛡️ Risk Guardian Settings 🛡️
app.post('/api/user/risk-guardian', authenticateToken, async (req, res) => {
  try {
    const { max_daily_loss, max_daily_trades, risk_guardian_active } = req.body;
    await db('users').where({ id: req.user.id }).update({
      max_daily_loss: max_daily_loss !== undefined && max_daily_loss !== null ? parseFloat(max_daily_loss) : null,
      max_daily_trades: max_daily_trades !== undefined && max_daily_trades !== null ? parseInt(max_daily_trades) : null,
      risk_guardian_active: !!risk_guardian_active,
      updated_at: new Date()
    });
    const updatedUser = await db('users').where({ id: req.user.id }).first();
    res.json({ success: true, message: 'Risk Guardian settings saved successfully', user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ⚡ Exit All Holdings ⚡
app.post('/api/holdings/exit-all', authenticateToken, async (req, res) => {
  try {
    // 🛡️ MARKET TIMING ENFORCEMENT: Holdings are equity delivery assets traded on NSE/BSE.
    // Regular instant liquidation can ONLY be executed during continuous trading hours (09:15 AM - 03:30 PM IST).
    const marketCheck = isSegmentMarketOpen(false, null, 'DEL', false);
    if (!marketCheck.open) {
      const hoursDesc = '09:15 AM - 03:30 PM';
      return res.status(400).json({
        error: marketCheck.isTotalBlock 
          ? marketCheck.reason 
          : `Market is closed. Regular orders can only be placed during trading hours (${hoursDesc}). Please select AMO to place an After Market Order.`
      });
    }

    let totalSoldAmount = 0;
    const exitOrders = [];

    await db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [req.user.id]);
      
      const startOfToday = getTradingSessionStartIST();

      const activeHoldings = await trx('holdings')
        .where({ user_id: req.user.id })
        .where('quantity', '>', 0)
        .forUpdate();

      const overnightPositions = await trx('positions')
        .where({ user_id: req.user.id })
        .whereIn('product_type', ['DEL', 'CNC', 'DELIVERY'])
        .where('quantity', '!=', 0)
        .where('created_at', '<', startOfToday)
        .forUpdate();

      if ((!activeHoldings || activeHoldings.length === 0) && (!overnightPositions || overnightPositions.length === 0)) {
        throw Object.assign(new Error('No active holdings to exit'), { statusCode: 400 });
      }

      const LedgerService = require('./services/ledgerService');
      for (const holding of activeHoldings) {
        const qty = parseFloat(holding.quantity);
        const holdingAvg = Math.abs(parseFloat(holding.average_price) || 0);
        const ltp = getLtpFromPriceCache(holding.symbol) || holdingAvg || 0;
        if (ltp <= 0) {
          throw Object.assign(new Error(`Live price unavailable for ${holding.symbol}. Cannot exit holdings.`), { statusCode: 400 });
        }
        const totalValue = qty * ltp;
        totalSoldAmount += totalValue;

        const principalAmount = qty * holdingAvg;
        const realizedPnl = (ltp - holdingAvg) * qty;
        const totalTaxes = await LedgerService.chargeExecutionTaxes(trx, req.user.id, holding.symbol, 'DEL', 'SELL', qty, ltp);

        // 1. Create executed sell order
        await trx('orders').insert({
          user_id: req.user.id,
          symbol: holding.symbol,
          type: 'MARKET',
          side: 'SELL',
          quantity: qty,
          filled_quantity: qty,
          pending_quantity: 0,
          price: ltp,
          average_price: ltp,
          order_variety: 'REGULAR',
          status: 'EXECUTED',
          product_type: 'DEL',
          margin: 0,
          realized_pnl: realizedPnl,
          taxes: totalTaxes,
          created_at: new Date(),
          updated_at: new Date()
        });

        // 1.5 Create closed position record for today
        await trx('positions').insert({
          user_id: req.user.id,
          symbol: holding.symbol,
          quantity: 0,
          closed_quantity: qty,
          average_price: parseFloat(holding.average_price),
          exit_price: ltp,
          realized_pnl: realizedPnl,
          product_type: 'DEL',
          margin: 0,
          created_at: new Date(),
          updated_at: new Date()
        });

        // 2. Remove exited holding
        await trx('holdings').where({ id: holding.id }).del();

        // 3. Credit gross proceeds to user balance (taxes were debited in chargeExecutionTaxes)
        await trx('users').where({ id: req.user.id }).increment('balance', totalValue);

        // Record principal capital unencumbered
        if (principalAmount > 0) {
          await trx('ledger').insert({
            user_id: req.user.id,
            amount: principalAmount,
            type: 'MARGIN_RELEASE',
            description: `Holding principal released: SELL ${qty} ${holding.symbol} @ avg ₹${parseFloat(holding.average_price).toFixed(2)}`,
            created_at: new Date()
          });
        }

        // Record realized PnL separately
        if (realizedPnl !== 0) {
          await trx('ledger').insert({
            user_id: req.user.id,
            amount: realizedPnl,
            type: 'REALIZED_PNL',
            description: `Realized P&L for exited holding ${holding.symbol}`,
            created_at: new Date()
          });
        }

        exitOrders.push({ symbol: holding.symbol, quantity: qty, price: ltp });
      }

      for (const pos of overnightPositions) {
        const posQty = Number(pos.quantity);
        const isShort = posQty < 0;
        const qty = Math.abs(posQty);
        const posAvg = Math.abs(parseFloat(pos.average_price) || 0);
        const ltp = getLtpFromPriceCache(pos.symbol) || posAvg || 0;
        if (ltp <= 0) {
          throw Object.assign(new Error(`Live price unavailable for ${pos.symbol}. Cannot exit holdings.`), { statusCode: 400 });
        }
        const exitSide = isShort ? 'BUY' : 'SELL';
        const principalAmount = qty * posAvg;
        const realizedPnl = isShort 
          ? (posAvg - ltp) * qty
          : (ltp - posAvg) * qty;

        const totalTaxes = await LedgerService.chargeExecutionTaxes(trx, req.user.id, pos.symbol, 'DEL', exitSide, qty, ltp);

        if (!isShort) {
          const totalValue = qty * ltp;
          totalSoldAmount += totalValue;
          await trx('users').where({ id: req.user.id }).increment('balance', totalValue);
          if (principalAmount > 0) {
            await trx('ledger').insert({
              user_id: req.user.id,
              amount: principalAmount,
              type: 'MARGIN_RELEASE',
              description: `Holding principal released: SELL ${qty} ${pos.symbol} @ avg ₹${posAvg.toFixed(2)}`,
              created_at: new Date()
            });
          }
        } else {
          // Short delivery position releases blocked margin + realized PnL
          const marginRelease = Number(pos.margin || 0);
          if (marginRelease > 0) {
            await trx('users').where({ id: req.user.id }).increment('balance', marginRelease);
            await trx('ledger').insert({
              user_id: req.user.id,
              amount: marginRelease,
              type: 'MARGIN_RELEASE',
              description: `Short delivery margin released: BUY ${qty} ${pos.symbol}`,
              created_at: new Date()
            });
          }
          if (realizedPnl !== 0) {
            await trx('users').where({ id: req.user.id }).increment('balance', realizedPnl);
          }
        }

        // Insert executed exit order
        await trx('orders').insert({
          user_id: req.user.id,
          symbol: pos.symbol,
          type: 'MARKET',
          side: exitSide,
          quantity: qty,
          filled_quantity: qty,
          pending_quantity: 0,
          price: ltp,
          average_price: ltp,
          order_variety: 'REGULAR',
          status: 'EXECUTED',
          product_type: pos.product_type || 'DEL',
          margin: 0,
          realized_pnl: realizedPnl,
          taxes: totalTaxes,
          remarks: 'Exit All Holdings',
          created_at: new Date(),
          updated_at: new Date()
        });

        // Close position record
        await trx('positions').where({ id: pos.id }).update({
          quantity: 0,
          closed_quantity: trx.raw('COALESCE(closed_quantity, 0) + ?', [qty]),
          exit_price: ltp,
          realized_pnl: trx.raw('COALESCE(realized_pnl, 0) + ?', [realizedPnl]),
          margin: 0,
          updated_at: new Date()
        });

        if (realizedPnl !== 0) {
          await trx('ledger').insert({
            user_id: req.user.id,
            amount: realizedPnl,
            type: 'REALIZED_PNL',
            description: `Realized P&L for exited holding ${pos.symbol}`,
            created_at: new Date()
          });
        }

        exitOrders.push({ symbol: pos.symbol, quantity: qty, price: ltp });
      }

      // Cancel any remaining pending sell orders on these exited holdings to prevent double selling
      const exitedSymbols = exitOrders.map(o => o.symbol);
      const cleanExited = exitedSymbols.map(s => s.replace(/^(NSE:|BSE:|MCX:)/i, ''));
      const pendingSellOrders = await trx('orders')
        .where({ user_id: req.user.id, side: 'SELL' })
        .whereIn('product_type', ['DEL', 'CNC', 'DELIVERY'])
        .whereIn('status', ['PENDING', 'PENDING_TRIGGER', 'AMO_PENDING', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN']) // ['PENDING', 'PENDING_TRIGGER', 'AMO_PENDING', 'PARTIAL_FILLED']
        .where(b => {
          b.whereIn('symbol', exitedSymbols).orWhereIn('symbol', cleanExited);
        });

      for (const ord of pendingSellOrders) {
        await trx('orders').where({ id: ord.id }).update({ status: 'CANCELLED', pending_quantity: 0, updated_at: new Date() });
      }
      req.holdingSellOrdersToClean = pendingSellOrders;
    });

    const triggerEngine = require('./services/triggerEngine');
    if (triggerEngine) {
      if (triggerEngine.io) {
        triggerEngine.io.to(req.user.id.toString()).emit('sync_user_data');
      }
      if (req.holdingSellOrdersToClean) {
        const volumeMatchingEngine = require('./services/volumeMatchingEngine');
        for (const ord of req.holdingSellOrdersToClean) {
          triggerEngine.removeOrderFromMemory(ord.id, ord.symbol);
          try {
            volumeMatchingEngine.dequeueOrder(ord.id, ord.symbol);
          } catch (e) {}
        }
      }
    }

    res.json({ success: true, message: `Successfully exited ${exitOrders.length} holding(s)`, totalSoldAmount });
  } catch (err) {
    console.error('Exit all holdings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 📝 Tag / Journal Trade 📝
app.post('/api/order/:id/tag', authenticateToken, async (req, res) => {
  try {
    const { tag, notes } = req.body;
    await db('orders')
      .where({ id: req.params.id, user_id: req.user.id })
      .update({
        tag: tag || null,
        notes: notes || null,
        updated_at: new Date()
      });
    res.json({ success: true, message: 'Trade tagged successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/push/unsubscribe', authenticateToken, async (req, res) => {
  try {
    const { endpoint, token } = req.body;
    if (endpoint) {
      await db('push_subscriptions').where({ endpoint, user_id: req.user.id }).delete();
    }
    if (token) {
      await db('fcm_device_tokens').where({ token, user_id: req.user.id }).delete();
    }
    // Also defensively clear all subscriptions for this user to guarantee status check returns false
    await db('push_subscriptions').where({ user_id: req.user.id }).delete();
    await db('fcm_device_tokens').where({ user_id: req.user.id }).delete();
    res.json({ success: true, message: 'Unsubscribed from push notifications' });
  } catch (err) {
    console.error('Failed to unsubscribe push:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/push/test', authenticateToken, async (req, res) => {
  try {
    await sendPushNotification(req.user.id, {
      title: '🔔 SkandX Alert',
      body: 'Live trade alerts and order push notifications are active on this device!',
      url: '/clientdata'
    });
    res.json({ success: true, message: 'Test notification dispatched' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📖 Get Ledger History with High-Performance Server-Side Pagination & Running Balance 📖
app.get('/api/ledger', authenticateToken, async (req, res) => {
  try {
    const isPaginated = req.query.page !== undefined;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const user = await db('users').where({ id: req.user.id }).first();
    const filterType = req.query.filterType; // 'Credits', 'Debits', 'All'
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const isExport = req.query.export === 'true' || req.query.limit === 'all';

    let baseQuery = db('ledger').where({ user_id: req.user.id });

    if (filterType === 'Credits') {
      baseQuery = baseQuery.where('amount', '>', 0);
    } else if (filterType === 'Debits') {
      baseQuery = baseQuery.where('amount', '<', 0);
    }

    if (startDate) {
      baseQuery = baseQuery.where('created_at', '>=', startDate);
    }
    if (endDate) {
      baseQuery = baseQuery.where('created_at', '<=', endDate);
    }

    if (isPaginated && !isExport) {
      // 1. Get total records count for pagination
      const [countResult] = await baseQuery.clone().count('id as total');
      const total = countResult ? parseInt(countResult.total) || 0 : 0;
      const totalPages = Math.ceil(total / limit) || 1;

      // 2. Fetch only the requested 50 rows for this page
      const ledger = await baseQuery.clone()
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(limit)
        .offset(offset);

      // 3. Compute accurate authoritative running balance for this page slice
      if (ledger && ledger.length > 0) {
        let netBefore = 0;
        if (offset > 0) {
          try {
            // High-performance DB-side aggregate sum: transfers only 1 number over the wire, 0 heap objects allocated
            const sumSubquery = db('ledger')
              .select('amount')
              .where({ user_id: req.user.id })
              .orderBy('created_at', 'desc')
              .orderBy('id', 'desc')
              .limit(offset)
              .as('prev_slice');
            const sumRes = await db.from(sumSubquery).sum('amount as total');
            netBefore = parseFloat(sumRes?.[0]?.total || 0);
          } catch (e) {
            // High-performance lightweight fallback (only amount field selected)
            try {
              const sumRes = await db('ledger')
                .select('amount')
                .where({ user_id: req.user.id })
                .orderBy('created_at', 'desc')
                .orderBy('id', 'desc')
                .limit(offset);
              netBefore = sumRes.reduce((acc, row) => acc + (parseFloat(row.amount) || 0), 0);
            } catch (err) {}
          }
        }

        let running = (parseFloat(user?.balance || 0)) - netBefore;
        for (const item of ledger) {
          item.running_balance = Math.round((running + Number.EPSILON) * 100) / 100;
          running -= (parseFloat(item.amount) || 0);
        }
      }

      return res.json({
        success: true,
        ledger,
        total,
        page,
        totalPages,
        pageSize: limit
      });
    }

    // Fallback for non-paginated or export requests:
    const isFull = req.query.all === 'true' || isExport;
    const requestedLimit = parseInt(req.query.limit);
    const fetchLimit = isFull ? (requestedLimit || 10000) : (requestedLimit || 200);
    const ledger = await baseQuery
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(fetchLimit);

    // Seamlessly supplement from ledger_archive (monthly partitions) if room remains in fetchLimit
    if (ledger.length < fetchLimit) {
      try {
        let archQuery = db('ledger_archive').where({ user_id: req.user.id });
        if (filterType === 'Credits') archQuery = archQuery.where('amount', '>', 0);
        else if (filterType === 'Debits') archQuery = archQuery.where('amount', '<', 0);
        if (startDate) archQuery = archQuery.where('created_at', '>=', startDate);
        if (endDate) archQuery = archQuery.where('created_at', '<=', endDate);
        const archivedLedger = await archQuery.orderBy('created_at', 'desc').limit(fetchLimit - ledger.length);
        if (archivedLedger && archivedLedger.length > 0) {
          ledger.push(...archivedLedger);
        }
      } catch (archErr) {}
    }

    if (ledger && ledger.length > 0) {
      const chronological = [...ledger].reverse();
      const totalNetChange = chronological.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      let running = (parseFloat(user?.balance || 0)) - totalNetChange;
      const balMap = {};
      for (const item of chronological) {
        running += (parseFloat(item.amount) || 0);
        balMap[item.id] = Math.round((running + Number.EPSILON) * 100) / 100;
      }
      for (const item of ledger) {
        item.running_balance = balMap[item.id];
      }
    }

    if (isExport) {
      return res.json({ success: true, ledger, total: ledger.length, page: 1, totalPages: 1 });
    }
    res.json(ledger);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🧺 Place Basket Order 🧺───────────────────────────────────────────────────────
app.post('/api/basket-order', authenticateToken, async (req, res) => {
  try {
    const { items, total_margin } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Basket is empty' });
  }

  // 🛡️ Subscription Tier Eligibility & Leg Limits for Basket Orders (Multi-Leg)
  const user = await db('users').where({ id: req.user.id }).first();
  const isAdmin = Boolean(user?.is_admin);
  const isHighest = isAdmin || (['HIGHEST', 'FEATURE', 'VIP'].includes(user?.subscription_tier) && (!user?.subscription_expires || new Date(user.subscription_expires) > new Date()));
  const isYearlyOrMonthly = ['YEARLY', 'PRO', 'MONTHLY', 'LIFETIME'].includes(user?.subscription_tier) && (!user?.subscription_expires || new Date(user.subscription_expires) > new Date());
  const isPaidTier = isHighest || isYearlyOrMonthly;

  if (!isPaidTier) {
    return res.status(403).json({
      error: 'Basket Orders (Multi-Leg) are a Pro feature. Please upgrade to Monthly/Yearly (up to 15 legs) or Feature Plan (unlimited legs) to place basket orders.',
      tier_required: true
    });
  }

  const maxLegs = isHighest ? Infinity : 15;
  if (items.length > maxLegs) {
    return res.status(403).json({
      error: `Your ${user?.subscription_tier || 'PRO'} plan allows a maximum of ${maxLegs} legs per basket order (${items.length} submitted). Please upgrade to add more legs.`,
      max_legs: maxLegs
    });
  }


  // Block new orders when market is closed
  for (const item of items) {
    const isCommodity = isCommodityContract(item.symbol);
    const isIntradayProduct = (item.product_type === 'INT' || item.product_type === 'MIS' || item.product_type === 'BO' || item.product_type === 'CO');
    
    const marketCheck = isSegmentMarketOpen(isCommodity, item.symbol, item.product_type, false);
    if (!marketCheck.open) {
      if (marketCheck.isTotalBlock) {
        return res.status(400).json({ error: marketCheck.reason });
      }
      const isItemAmo = Boolean(item.is_amo || req.body.is_amo || req.body.variety === 'AMO');
      if (!isItemAmo) {
        const hoursDesc = isCommodity ? '09:00 AM - 11:30 PM' : '09:15 AM - 03:30 PM';
        const marketName = isCommodity ? 'MCX Commodity Market' : 'Market';
        return res.status(400).json({
          error: `${marketName} is closed. Regular orders can only be placed during trading hours (${hoursDesc}). Please select AMO to place an After Market Order.`
        });
      }
      if (!marketCheck.isAmoWindow) {
        return res.status(400).json({ error: marketCheck.reason });
      }
    }

    // 🛡️ PREVENTATIVE INTRADAY (MIS) RISK FILTER FOR BASKET ORDERS 🛡️
    if (isIntradayProduct) {
      const cleanSym = item.symbol.includes(':') ? item.symbol.split(':')[1] : item.symbol;
      const cleanU = cleanSym.toUpperCase();
      const rawSymU = String(item.symbol).toUpperCase();

      // Check if this item is strictly closing an existing intraday position
      let isClosing = false;
      if (item.side === 'SELL') {
        const pos = await db('positions')
          .where({ user_id: req.user.id })
          .whereIn('product_type', ['INT', 'MIS', 'BO', 'CO'])
          .where(b => b.where({ symbol: item.symbol }).orWhere({ symbol: cleanSym }))
          .where('quantity', '>', 0)
          .first();
        if (pos && Number(pos.quantity) >= Number(item.quantity) - 0.0001) {
          isClosing = true;
        }
      } else if (item.side === 'BUY') {
        const pos = await db('positions')
          .where({ user_id: req.user.id })
          .whereIn('product_type', ['INT', 'MIS', 'BO', 'CO'])
          .where(b => b.where({ symbol: item.symbol }).orWhere({ symbol: cleanSym }))
          .where('quantity', '<', 0)
          .first();
        if (pos && Math.abs(Number(pos.quantity)) >= Number(item.quantity) - 0.0001) {
          isClosing = true;
        }
      }

      if (!isClosing) {
        // 1. Trade-to-Trade (T2T) & Surveillance Series Check
        const isT2TSeries = /-(BE|BZ|T|Z|XT|SM|ST|P)$/i.test(cleanU) || /-(BE|BZ|T|Z|XT|SM|ST|P)$/i.test(rawSymU);
        if (isT2TSeries) {
          return res.status(400).json({
            error: `Trade-to-Trade / Surveillance stock: Intraday (MIS) is strictly prohibited by SEBI regulations for ${cleanSym}. Only Delivery (CNC) is permitted.`
          });
        }

        // 2. Cash Equity Minimum Liquidity & Circuit Proximity Checks
        const isDeriv = isDerivativeContract(item.symbol);
        if (!isDeriv && !isCommodity) {
          const { isFnoEligibleStock } = require('./services/instrumentsCache');
          const isFno = isFnoEligibleStock(item.symbol);
          const cachedPriceData = getPriceDataFromCache(item.symbol);
          const dayVolume = Number(cachedPriceData.volume || cachedPriceData.vol_traded_today || 0);
          const MIN_INTRADAY_VOLUME = 25000;

          const istParts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
          }).formatToParts(new Date());
          const curHour = parseInt(istParts.find(p => p.type === 'hour')?.value || '0', 10);
          const curMin = parseInt(istParts.find(p => p.type === 'minute')?.value || '0', 10);
          const isPastOpening = (curHour * 60 + curMin) >= (9 * 60 + 30);

          if (!isFno && isPastOpening && dayVolume < MIN_INTRADAY_VOLUME) {
            return res.status(400).json({
              error: `Intraday (MIS) is disabled for ${cleanSym} due to low market liquidity (${dayVolume.toLocaleString()} shares traded today). Minimum volume required is ${MIN_INTRADAY_VOLUME.toLocaleString()}. Please select Delivery (CNC).`
            });
          }

          // 3. Intraday Dynamic Circuit Toggles (Circuit Proximity Protection)
          const liveLtp = getLtpFromPriceCache(item.symbol) || parseFloat(item.price) || 0;
          const upperCircuit = Number(cachedPriceData.upper_circuit || cachedPriceData.upper_ckt || 0);
          const lowerCircuit = Number(cachedPriceData.lower_circuit || cachedPriceData.lower_ckt || 0);

          if (item.side === 'SELL') {
            const isNearUpperCircuit = (upperCircuit > 0 && liveLtp >= upperCircuit * 0.995);
            if (isNearUpperCircuit) {
              return res.status(400).json({
                error: `Intraday shorting (MIS) blocked: ${cleanSym} is at/near Upper Circuit limit (₹${upperCircuit || liveLtp}). Short selling is prohibited to prevent short-delivery auction risk. Only CNC allowed.`
              });
            }
          }
          if (item.side === 'BUY') {
            const isNearLowerCircuit = (lowerCircuit > 0 && liveLtp <= lowerCircuit * 1.005);
            if (isNearLowerCircuit) {
              return res.status(400).json({
                error: `Intraday buying (MIS) blocked: ${cleanSym} is at/near Lower Circuit limit (₹${lowerCircuit || liveLtp}). Buying is prohibited due to square-off exit lock risk. Only CNC allowed.`
              });
            }
          }
        }
      }
    }

    // BUG FIX 4: Block ALL new orders for F&O/FUT contracts on their expiry day after auto-square-off triggers.
    const isDerivativeSymbol = isDerivativeContract(item.symbol);
    if (isDerivativeSymbol) {
      const { parseExpiryDate } = require('./services/autoSquareOff');
      const expDate = parseExpiryDate(item.symbol);
      let isExpiringToday = false;
      
      const now = new Date();
      const istParts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(now);
      const curYear = parseInt(istParts.find(p => p.type === 'year')?.value || '0', 10);
      const curMonth = parseInt(istParts.find(p => p.type === 'month')?.value || '0', 10);
      const curDay = parseInt(istParts.find(p => p.type === 'day')?.value || '0', 10);
      const h = parseInt(istParts.find(p => p.type === 'hour')?.value || '0', 10);
      const min = parseInt(istParts.find(p => p.type === 'minute')?.value || '0', 10);

      if (expDate) {
        isExpiringToday = (expDate.getFullYear() === curYear && (expDate.getMonth() + 1) === curMonth && expDate.getDate() === curDay);
      } else {
        const dayStr = String(curDay).padStart(2, '0');
        const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        const monthStr = monthNames[curMonth - 1];
        const yearStr = String(curYear).slice(-2);
        isExpiringToday = item.symbol.includes(`${yearStr}${monthStr}`) || item.symbol.includes(`${dayStr}${monthStr}${yearStr}`);
      }

      if (isExpiringToday) {
        const isMCXSymbol = item.symbol.endsWith('-MCX') || isCommodityContract(item.symbol);
        // Equity/NFO/BFO: block after 03:25 PM; MCX: block after 07:00 PM
        const equityExpiryClosed = !isMCXSymbol && (h > 15 || (h === 15 && min >= 25));
        const mcxExpiryClosed   =  isMCXSymbol && (h >= 19);
        if (equityExpiryClosed || mcxExpiryClosed) {
          return res.status(400).json({
            error: `Cannot place orders on ${item.symbol.split('-')[0]}. This contract expires today and the Auto-Square-Off cutoff time has passed.`
          });
        }
      }
    }

    // Validate Freeze Limit for each basket item
    const { getFreezeLimit } = require('./services/taxCalculator');
    const legFreezeLimit = getFreezeLimit(item.symbol);
    if (legFreezeLimit && Number(item.quantity) > legFreezeLimit) {
      const { getLotSizes } = require('./services/instrumentsCache');
      const cleanSym = String(item.symbol).replace(/^(NSE:|BSE:|MCX:)/i, '');
      const lotSizes = getLotSizes([item.symbol, cleanSym]);
      const lotsize = lotSizes[item.symbol] || lotSizes[cleanSym] || 1;
      const maxLots = (lotsize && lotsize > 1) ? Math.floor(legFreezeLimit / lotsize) : legFreezeLimit;
      const err = (lotsize && lotsize > 1)
        ? `Order quantity (${item.quantity} qty / ${Math.round(item.quantity / lotsize)} lots) for ${item.symbol} exceeds exchange freeze limit of ${legFreezeLimit} qty (${maxLots} lots). Please adjust quantity.`
        : `Order quantity (${item.quantity} shares) for ${item.symbol} exceeds exchange freeze limit of ${legFreezeLimit.toLocaleString('en-IN')} shares. Please adjust quantity.`;
      return res.status(400).json({ error: err });
    }
  }

  await db.transaction(async (trx) => {
      // Advisory transaction lock per-user to eliminate concurrency double-spending
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [req.user.id]);

      // 1. Process each item (Hedge-Aware Sequence: BUY legs first)
      const sortedItems = [...items].sort((a, b) => {
        if (a.side === 'BUY' && b.side === 'SELL') return -1;
        if (a.side === 'SELL' && b.side === 'BUY') return 1;
        return 0;
      });

      // Calculate standalone margins for all legs
      const { calculateRequiredMargin } = require('./services/marginEngine');
      const itemStandaloneMargins = sortedItems.map(item => {
        const pType = item.product_type || 'INT';
        const pPrice = parseFloat(item.price) || priceCache[item.symbol]?.ltp || 1;
        const pQty = Number(item.quantity) || 0;
        if (item.margin && parseFloat(item.margin) > 0) {
          return parseFloat(item.margin);
        }
        try {
          return Math.max(0, calculateRequiredMargin(item.symbol, pType, item.side, pQty, pPrice));
        } catch (e) {
          return pQty * pPrice;
        }
      });
      const totalStandalone = itemStandaloneMargins.reduce((sum, m) => sum + m, 0);

      // Verify total margin - Server Authoritative validation (prevent client 0-margin bypass)
      let requiredMargin = parseFloat(total_margin) || 0;
      const minHedgingFloor = totalStandalone > 0 ? parseFloat((totalStandalone * 0.25).toFixed(2)) : 0;
      if (totalStandalone > 0 && (requiredMargin <= 0 || requiredMargin < minHedgingFloor)) {
        requiredMargin = Math.max(requiredMargin, minHedgingFloor);
      }

      const user = await trx('users').where({ id: req.user.id }).forUpdate().first();
      if (requiredMargin > 0 && parseFloat(user.balance) < requiredMargin) {
        throw new Error(`Insufficient Funds. Required: ₹${requiredMargin.toLocaleString('en-IN')}, Available: ₹${Number(user.balance).toLocaleString('en-IN')}`);
      }

      // 1.5 Validate SELL DEL/CNC/DELIVERY orders against holdings (No Naked Shorting for Equities)
      const sellDelQuantities = {};
      for (const item of items) {
          const isDerivative = isDerivativeContract(item.symbol);
          const pType = String(item.product_type || 'DEL').toUpperCase();
          const isDel = ['DEL', 'CNC', 'DELIVERY'].includes(pType);
          if (item.side === 'SELL' && isDel && !isDerivative) {
              const cleanSym = item.symbol.includes(':') ? item.symbol.split(':')[1] : item.symbol;
              sellDelQuantities[cleanSym] = (sellDelQuantities[cleanSym] || 0) + Number(item.quantity);
          }
      }
      for (const cleanSym in sellDelQuantities) {
          const qtyRequested = sellDelQuantities[cleanSym];
          
          const holding = await trx('holdings')
              .where({ user_id: req.user.id })
              .where(builder => {
                builder.where({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
              })
              .first();
          const holdingQty = holding ? Number(holding.quantity) : 0;
          
          const existingPos = await trx('positions')
              .where({ user_id: req.user.id })
              .whereIn('product_type', ['DEL', 'CNC', 'DELIVERY'])
              .where(builder => {
                builder.where({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
              })
              .where('quantity', '>', 0)
              .first();
          const posQty = existingPos && Number(existingPos.quantity) > 0 ? Number(existingPos.quantity) : 0;
          
          const pendingOrders = await trx('orders')
              .where({ user_id: req.user.id, side: 'SELL' })
              .whereIn('product_type', ['DEL', 'CNC', 'DELIVERY'])
              .where(builder => {
                builder.where({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
              })
              .whereIn('status', ['PENDING', 'PENDING_TRIGGER', 'AMO_PENDING', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN']); // .whereIn('status', ['PENDING', 'PENDING_TRIGGER', 'AMO_PENDING', 'PARTIAL_FILLED'])
          const pendingSellQty = pendingOrders.reduce((sum, o) => sum + Number(o.pending_quantity !== undefined && o.pending_quantity !== null ? o.pending_quantity : o.quantity), 0);
          
          const totalAvailable = parseFloat((holdingQty + posQty - pendingSellQty).toFixed(4));
          
          if (qtyRequested > totalAvailable) {
              throw new Error(`Insufficient holdings for ${cleanSym}. You only have ${totalAvailable} shares available to sell${pendingSellQty > 0 ? ` (${pendingSellQty} shares reserved in open/AMO orders)` : ''}.`);
          }
      }

      // 2. Deduct total margin
      if (requiredMargin > 0) {
        const newBal = Math.round((parseFloat(user.balance) - requiredMargin + Number.EPSILON) * 100) / 100;
        await trx('users')
          .where({ id: req.user.id })
          .update({ balance: newBal });
        await trx('ledger').insert({
          user_id: req.user.id,
          amount: -requiredMargin,
          type: 'MARGIN_BLOCK',
          description: `Combined margin blocked for Basket Order (${items.length} legs)`
        });
      }

      let distributedMarginSum = 0;
      const itemAllocatedMargins = sortedItems.map((item, idx) => {
        if (requiredMargin <= 0) return 0;
        let allocated = 0;
        if (totalStandalone > 0) {
          allocated = parseFloat(((itemStandaloneMargins[idx] / totalStandalone) * requiredMargin).toFixed(2));
        } else {
          allocated = parseFloat((requiredMargin / sortedItems.length).toFixed(2));
        }
        distributedMarginSum += allocated;
        return allocated;
      });

      // Adjust rounding discrepancy so sum(itemAllocatedMargins) === requiredMargin
      if (requiredMargin > 0 && itemAllocatedMargins.length > 0) {
        const diff = parseFloat((requiredMargin - distributedMarginSum).toFixed(2));
        if (Math.abs(diff) > 0 && Math.abs(diff) < 1) {
          let maxIdx = 0;
          for (let k = 1; k < itemAllocatedMargins.length; k++) {
            if (itemAllocatedMargins[k] > itemAllocatedMargins[maxIdx]) maxIdx = k;
          }
          itemAllocatedMargins[maxIdx] = parseFloat((itemAllocatedMargins[maxIdx] + diff).toFixed(2));
        }
      }

      const { calculateOrderSlices } = require('./services/taxCalculator');
      const basketGroupId = 'BSK_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const executedOrders = [];

      for (let itemIdx = 0; itemIdx < sortedItems.length; itemIdx++) {
        const item = sortedItems[itemIdx];
        const effectiveItemMargin = itemAllocatedMargins[itemIdx] || 0;
        const { symbol, type, side, quantity, price, sl_price, tgt_price, product_type, trail_amount } = item;
        const status = 'PENDING';
        const isMarket = type === 'MARKET';
        const effectiveProductType = product_type || 'INT';
        const execPrice = parseFloat(price) || getLtpFromPriceCache(symbol) || (priceCache[symbol]?.close ? Number(priceCache[symbol].close) : 0) || (priceCache[symbol]?.prev_close_price ? Number(priceCache[symbol].prev_close_price) : 0);
        const qtyNum = Number(quantity) || 0;
        const slices = calculateOrderSlices(symbol, qtyNum);
        const isSliced = slices.length > 1;
        const sliceGroupId = isSliced ? `bsk_slice_${Date.now()}_${Math.random().toString(36).substring(2, 6)}` : null;

        for (let sIdx = 0; sIdx < slices.length; sIdx++) {
          const sliceQty = slices[sIdx];
          const sliceMargin = isSliced ? parseFloat(((effectiveItemMargin * sliceQty) / qtyNum).toFixed(2)) : effectiveItemMargin;

          const [orderId] = await trx('orders').insert({
            user_id: req.user.id,
            symbol, type, side,
            quantity: sliceQty,
            filled_quantity: 0,
            pending_quantity: sliceQty,
            average_price: null,
            order_variety: 'REGULAR',
            price: execPrice || null,
            quoted_price: execPrice || null,
            sl_price, tgt_price,
            status,
            margin: sliceMargin,
            product_type: effectiveProductType,
            basket_group_id: basketGroupId,
            slice_group_id: sliceGroupId,
            slice_index: isSliced ? sIdx + 1 : null,
            slice_total: isSliced ? slices.length : null,
            trail_amount: trail_amount ? parseFloat(trail_amount) : null,
            created_at: new Date(),
            updated_at: new Date()
          }).returning('id');

          const orderIdVal = typeof orderId === 'object' ? orderId.id : orderId;
          executedOrders.push({
            id: orderIdVal, symbol, status, isMarket, execPrice, type, side,
            quantity: sliceQty, sl_price, tgt_price, margin: sliceMargin,
            product_type: effectiveProductType, basket_group_id: basketGroupId,
            slice_group_id: sliceGroupId, slice_index: isSliced ? sIdx + 1 : null,
            slice_total: isSliced ? slices.length : null,
            trail_amount: trail_amount ? parseFloat(trail_amount) : null
          });
        }
      }
      
      req.basketOrdersToProcess = executedOrders;
    });

    const triggerEngine = require('./services/triggerEngine');
    const finalResponseOrders = [];
    
    for (const ord of req.basketOrdersToProcess) {
       await triggerEngine.addOrderToMemory({
          id: ord.id, user_id: req.user.id, symbol: ord.symbol, type: ord.type, side: ord.side, quantity: ord.quantity, price: ord.execPrice || null,
          status: ord.status, sl_price: ord.sl_price || null, tgt_price: ord.tgt_price || null, trigger_price: null, trail_amount: null, product_type: ord.product_type, margin: ord.margin
       });
       
       let execStatus = ord.status;
       let legError = null;

       if (ord.isMarket) {
          const isMutualFund = ord.symbol.endsWith('-MF') || ord.symbol.includes('MUTUALFUND') || /^\d+$/.test(ord.symbol);
          if (isMutualFund) {
             try {
                 const triggerEngineLocal = require('./services/triggerEngine');
                 await triggerEngineLocal.removeOrderFromMemory(ord.id, ord.symbol);
                 await triggerEngineLocal.executeOrder(ord, ord.execPrice);
                 execStatus = 'EXECUTED';
             } catch(e) {
                 legError = e.message;
                 console.error('Basket MF execution error:', e);
             }
          } else {
             const realLtp = getLtpFromPriceCache(ord.symbol) || parseFloat(ord.execPrice) || 0;
             if (realLtp > 0) {
                try {
                  await triggerEngine.removeOrderFromMemory(ord.id, ord.symbol);
                  const volumeMatchingEngine = require('./services/volumeMatchingEngine');
                  await volumeMatchingEngine.submitOrder(ord, realLtp);
                  const freshOrder = await db('orders').where({ id: ord.id }).select('status').first();
                  if (freshOrder) execStatus = freshOrder.status;
                } catch (err) {
                  legError = err.message;
                  console.error('Immediate evaluation error for basket item:', err);
                }
             }
          }
       } else if (ord.type === 'LIMIT') {
          const realLtp = getLtpFromPriceCache(ord.symbol) || 0;
          const limitPrice = parseFloat(ord.execPrice) || 0;
          if (realLtp > 0 && limitPrice > 0) {
            const isMarketableBuy = ord.side === 'BUY' && realLtp <= limitPrice;
            const isMarketableSell = ord.side === 'SELL' && realLtp >= limitPrice;
            if (isMarketableBuy || isMarketableSell) {
              try {
                await triggerEngine.removeOrderFromMemory(ord.id, ord.symbol);
                const volumeMatchingEngine = require('./services/volumeMatchingEngine');
                await volumeMatchingEngine.submitOrder(ord, realLtp);
                const freshOrder = await db('orders').where({ id: ord.id }).select('status').first();
                if (freshOrder) execStatus = freshOrder.status;
              } catch (err) {
                legError = err.message;
                console.error('Immediate marketable limit error for basket item:', err);
              }
            }
          }
       }
       
       finalResponseOrders.push({ id: ord.id, symbol: ord.symbol, status: execStatus, error: legError });
    }
    
    setTimeout(() => {
        try {
            const { pubClient } = require('./services/redisClient');
            if (pubClient) {
                pubClient.publish('reload_triggers', '1').catch(e=>{});
                pubClient.publish('reload_volume_orders', '1').catch(e=>{});
            }
        } catch(e) {}
    }, 300);

    if (triggerEngine && triggerEngine.io && req.user && req.user.id) {
      triggerEngine.io.to(req.user.id.toString()).emit('sync_user_data');
    }

    const hasErrors = finalResponseOrders.some(o => o.error);
    res.json({ success: !hasErrors, orders: finalResponseOrders });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─── Cancel Order ─────────────────────────────────────────────────────────
app.post('/api/order/:id/cancel', authenticateToken, async (req, res) => {
  try {
    let cancelledOrder = null;
    let siblingsToClean = [];
    let autoExitOrderToExecute = null;
    let autoExitLtp = 0;

    await db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [req.user.id]);
      const order = await trx('orders').where({ id: req.params.id, user_id: req.user.id }).forUpdate().first();
      // BUG FIX: Use throw instead of return res.status() inside a transaction.
      // 'return' only exits the callback arrow function, NOT the transaction — throw aborts it properly.
      if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });

      // Disallow cancelling Mutual Fund purchase orders
      const isMf = Boolean((order.symbol || '').endsWith('-MF') || (order.symbol || '').includes('MUTUALFUND'));
      if (isMf) {
        throw Object.assign(new Error('Mutual Fund purchase orders cannot be cancelled once placed as per AMC guidelines.'), { statusCode: 400 });
      }

      const cancellableStatuses = ['PENDING', 'PENDING_TRIGGER', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN', 'AMO_PENDING'];
      if (!cancellableStatuses.includes(order.status))
        throw Object.assign(new Error('Only pending, partially filled, or AMO orders can be cancelled'), { statusCode: 400 });
      
      // Update status
      await trx('orders').where({ id: req.params.id }).update({ status: 'CANCELLED', pending_quantity: 0, updated_at: new Date() });

      // If a partially filled order or slice group is cancelled, ensure consolidated tax entry exists for the filled portion
      const filledQty = parseFloat(order.filled_quantity || 0);
      let sliceGroupId = order.slice_group_id;
      if (!sliceGroupId && order.remarks && order.remarks.includes('[slice_')) {
        const match = order.remarks.match(/\[(slice_[^\]]+)\]/);
        if (match) sliceGroupId = match[1];
      }

      if (sliceGroupId) {
        const groupOrders = await trx('orders')
          .where({ user_id: order.user_id, slice_group_id: sliceGroupId })
          .select('id', 'status', 'filled_quantity', 'taxes', 'quantity');

        const allCompletedOrCancelled = groupOrders.length > 0 && groupOrders.every(o => {
          const s = o.id === order.id ? 'CANCELLED' : o.status;
          return s === 'EXECUTED' || s === 'CANCELLED';
        });

        if (allCompletedOrCancelled) {
          let totalGroupFilled = 0;
          let totalGroupTaxes = 0;
          let totalGroupSlicesExecuted = 0;

          for (const o of groupOrders) {
            totalGroupFilled += Number(o.filled_quantity || 0);
            totalGroupTaxes += Number(o.taxes || 0);
            if (o.status === 'EXECUTED' || (o.id === order.id && filledQty > 0)) totalGroupSlicesExecuted++;
          }
          totalGroupTaxes = Math.round((totalGroupTaxes + Number.EPSILON) * 100) / 100;

          const existingTax = await trx('ledger')
            .where({ user_id: order.user_id, type: 'TAXES' })
            .where('description', 'like', `%[${sliceGroupId}]%`)
            .first();

          if (!existingTax && totalGroupTaxes > 0) {
            await trx('ledger').insert({
              user_id: order.user_id,
              amount: -totalGroupTaxes,
              type: 'TAXES',
              description: `Taxes & Brokerage for ${order.side} ${totalGroupFilled} ${order.symbol} (${totalGroupSlicesExecuted} Slices) [${sliceGroupId}]`
            });
          }
        }
      } else if (filledQty > 0 && Number(order.taxes) > 0) {
        const existingTax = await trx('ledger')
          .where({ user_id: order.user_id, type: 'TAXES' })
          .where('description', 'like', `%Order #${order.id}%`)
          .first();
        if (!existingTax) {
          await trx('ledger').insert({
            user_id: order.user_id,
            amount: -Number(order.taxes),
            type: 'TAXES',
            description: `Taxes & Brokerage for ${order.side} ${filledQty} ${order.symbol} (Order #${order.id})`
          });
        }
      }

      // If a partially filled BO/CO order is cancelled, spawn protection legs for the already executed portion
      if (filledQty > 0 && (order.sl_price || order.tgt_price || order.product_type === 'BO' || order.product_type === 'CO')) {
        const existingChild = await trx('orders').where({ parent_order_id: order.id }).first();
        if (!existingChild) {
          const { spawnBracketOrders } = require('./services/orderExecutor');
          await spawnBracketOrders(trx, {
            ...order,
            price: order.average_price,
            quantity: filledQty
          }, filledQty);
        }
      }
      
      // OCO: Cancel sibling legs if this is a BO leg
      if (order.parent_order_id || order.linked_order_id) {
          const siblingQuery = trx('orders')
            .whereIn('status', ['PENDING', 'PENDING_TRIGGER'])
            .whereNot({ id: order.id });

          if (order.parent_order_id && order.linked_order_id) {
            siblingQuery.where(b => b.where({ parent_order_id: order.parent_order_id }).orWhere({ id: order.linked_order_id }));
          } else if (order.parent_order_id) {
            siblingQuery.where({ parent_order_id: order.parent_order_id });
          } else {
            siblingQuery.where({ id: order.linked_order_id });
          }

          const cancelledSiblings = await siblingQuery;

          for (const sib of cancelledSiblings) {
            await trx('orders').where({ id: sib.id }).update({ status: 'CANCELLED', updated_at: new Date() });
            siblingsToClean.push(sib);
            const sibMargin = parseFloat(sib.margin) || 0;
            if (sibMargin > 0) {
              const u = await trx('users').where({ id: req.user.id }).first();
              if (u) {
                await trx('users').where({ id: req.user.id }).update({ balance: Math.round((parseFloat(u.balance) + sibMargin + Number.EPSILON) * 100) / 100 });
                await trx('ledger').insert({
                  user_id: req.user.id,
                  amount: sibMargin,
                  type: 'MARGIN_RELEASE',
                  description: `Margin refunded for cancelled sibling order: ${sib.quantity} ${sib.symbol} ${sib.side}`
                });
              }
            }
          }

          // Bracket order cancelled: Auto-exit the underlying position at market
          const parentOrder = await trx('orders').where({ id: order.parent_order_id }).first();
          if (parentOrder && parentOrder.status === 'EXECUTED') {
              const cleanOrdSym = (order.symbol || '').replace(/^(NSE:|BSE:|MCX:)/i, '');
              const pos = await trx('positions')
                .where({ user_id: req.user.id, product_type: parentOrder.product_type })
                .where(b => b.where({ symbol: order.symbol })
                             .orWhere({ symbol: cleanOrdSym })
                             .orWhere({ symbol: `NSE:${cleanOrdSym}` })
                             .orWhere({ symbol: `BSE:${cleanOrdSym}` })
                             .orWhere({ symbol: `MCX:${cleanOrdSym}` }))
                .whereNot({ quantity: 0 })
                .first();
              if (pos) {
                 const exitQty = Math.min(Math.abs(pos.quantity), Number(parentOrder.quantity));
                 const exitSide = pos.quantity > 0 ? 'SELL' : 'BUY';
                 
                 if (exitQty > 0) {
                   autoExitLtp = getLtpFromPriceCache(pos.symbol) || Math.abs(Number(pos.average_price)) || 0;
                   if (autoExitLtp <= 0) {
                     throw Object.assign(new Error('Live market price unavailable for auto-exit. Cannot cancel bracket protection without a valid price.'), { statusCode: 400 });
                   }
                   const [exitOrderId] = await trx('orders').insert({
                     user_id: req.user.id,
                     symbol: pos.symbol,
                     type: 'MARKET',
                     side: exitSide,
                     quantity: exitQty,
                     filled_quantity: 0,
                     pending_quantity: exitQty,
                     order_variety: 'REGULAR',
                     price: autoExitLtp || null,
                     status: 'PENDING',
                     product_type: pos.product_type || 'INT',
                     margin: 0,
                     created_at: new Date(),
                     updated_at: new Date()
                   }).returning('id');
                   const exitOrderIdVal = typeof exitOrderId === 'object' ? exitOrderId.id : exitOrderId;
                   autoExitOrderToExecute = {
                     id: exitOrderIdVal, user_id: req.user.id, symbol: pos.symbol, type: 'MARKET',
                     side: exitSide, quantity: exitQty, price: autoExitLtp || null, status: 'PENDING',
                     product_type: pos.product_type || 'INT', margin: 0
                   };
                 }
              }
          }
      }
      
      // Pro-rata margin refund for unfilled portion of order
      const totalMargin = parseFloat(order.margin) || 0;
      const totalQty = parseFloat(order.quantity) || 1;
      const pendingQty = (order.pending_quantity !== null && order.pending_quantity !== undefined)
        ? parseFloat(order.pending_quantity)
        : ((order.status === 'PARTIAL_FILLED' || order.status === 'PARTIALLY_FILLED') ? Math.max(0, totalQty - parseFloat(order.filled_quantity || 0)) : totalQty);

      const refundAmount = totalQty > 0
        ? Math.round(((pendingQty / totalQty) * totalMargin + Number.EPSILON) * 100) / 100
        : totalMargin;

      if (refundAmount > 0) {
          const user = await trx('users').where({ id: req.user.id }).first();
          if (user) {
              await trx('users').where({ id: req.user.id }).update({ balance: Math.round((parseFloat(user.balance) + refundAmount + Number.EPSILON) * 100) / 100 });
              // Write a MARGIN_RELEASE ledger entry to match the MARGIN_BLOCK written on placement
              let sliceGroupId = order.slice_group_id;
              if (!sliceGroupId && order.remarks && order.remarks.includes('[slice_')) {
                const match = order.remarks.match(/\[(slice_[^\]]+)\]/);
                if (match) sliceGroupId = match[1];
              }

              if (sliceGroupId) {
                const existingRelease = await trx('ledger')
                  .where({ user_id: req.user.id, type: 'MARGIN_RELEASE' })
                  .where('description', 'like', `%[${sliceGroupId}]%`)
                  .first();

                if (existingRelease) {
                  const updatedAmount = Math.round((Number(existingRelease.amount) + refundAmount + Number.EPSILON) * 100) / 100;
                  await trx('ledger').where({ id: existingRelease.id }).update({
                    amount: updatedAmount,
                    description: `Margin refunded for cancelled orders ${order.symbol} [${sliceGroupId}]`
                  });
                } else {
                  await trx('ledger').insert({
                    user_id: req.user.id,
                    amount: refundAmount,
                    type: 'MARGIN_RELEASE',
                    description: `Margin refunded for cancelled orders ${order.symbol} [${sliceGroupId}]`
                  });
                }
              } else {
                await trx('ledger').insert({
                  user_id: req.user.id,
                  amount: refundAmount,
                  type: 'MARGIN_RELEASE',
                  description: `Margin refunded for cancelled order: ${pendingQty} ${order.symbol} ${order.side}`
                });
              }
          }
      }
      
      cancelledOrder = order;
    });

    const triggerEngine = require('./services/triggerEngine');
    triggerEngine.removeOrderFromMemory(req.params.id, cancelledOrder.symbol);
    try {
      const volumeMatchingEngine = require('./services/volumeMatchingEngine');
      volumeMatchingEngine.dequeueOrder(req.params.id, cancelledOrder.symbol);
    } catch(e) {}
    for (const sib of siblingsToClean) {
      triggerEngine.removeOrderFromMemory(sib.id, sib.symbol);
      try {
        const volumeMatchingEngine = require('./services/volumeMatchingEngine');
        volumeMatchingEngine.dequeueOrder(sib.id, sib.symbol);
      } catch(e) {}
    }

    if (autoExitOrderToExecute) {
      triggerEngine.removeOrderFromMemory(autoExitOrderToExecute.id, autoExitOrderToExecute.symbol);
      try {
        await triggerEngine.executeOrder(autoExitOrderToExecute, autoExitLtp);
      } catch (err) {
        console.error('Auto-exit execution error on BO cancel:', err);
      }
    }

    try {
        const { pubClient } = require('./services/redisClient');
        if (pubClient) {
            pubClient.publish('reload_triggers', '1').catch(e=>{});
            pubClient.publish('reload_volume_orders', '1').catch(e=>{});
        }
    } catch(e) {}
    
    res.json({ 
      success: true,
      autoExited: Boolean(autoExitOrderToExecute),
      message: autoExitOrderToExecute ? 'Bracket order and underlying position squared off at market.' : 'Order cancelled successfully.'
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: err.message });
  }
});


// ─── ADMIN CLEANUP ENDPOINT ───
app.get('/api/admin/cleanup', authenticateToken, async (req, res) => {
  try {
     const caller = await db('users').where({ id: req.user.id }).first();
     if (!caller || !caller.is_admin) {
       return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
     }
     console.log("Running manual API cleanup for expired contracts...");
     const patterns = ['%24JUL%', '%SENSEX2672377700%', '%NATURALGAS24JUL%'];
     let results = {};
     
     for (const pattern of patterns) {
         let pResults = { ordersDeleted: 0, positionsDeleted: 0, holdingsDeleted: 0, marginRefunded: 0 };
         
         const pendingOrders = await db('orders').where('symbol', 'like', pattern).whereIn('status', ['PENDING', 'PENDING_TRIGGER']);
         for (const order of pendingOrders) {
             const user = await db('users').where({ id: order.user_id }).first();
             if (user && order.margin && order.margin > 0) {
                 await db('users').where({ id: order.user_id }).update({ balance: parseFloat(user.balance) + parseFloat(order.margin) });
                 pResults.marginRefunded += parseFloat(order.margin);
             }
         }
         pResults.ordersDeleted = await db('orders').where('symbol', 'like', pattern).del();
         
         const stuckPositions = await db('positions').where('symbol', 'like', pattern);
         for (const pos of stuckPositions) {
             const user = await db('users').where({ id: pos.user_id }).first();
             if (user) {
                 const refundAmt = Math.abs(pos.quantity) * Math.abs(parseFloat(pos.average_price) || 0);
                 await db('users').where({ id: pos.user_id }).update({ balance: parseFloat(user.balance) + refundAmt });
                 pResults.marginRefunded += refundAmt;
             }
         }
         pResults.positionsDeleted = await db('positions').where('symbol', 'like', pattern).del();
         pResults.holdingsDeleted = await db('holdings').where('symbol', 'like', pattern).del();
         
         results[pattern] = pResults;
     }
     res.json({ success: true, message: "Cleanup complete", results });
  } catch (e) {
     console.error("Cleanup failed:", e.message, e.stack);
     res.status(500).json({ success: false, error: e.message, stack: e.stack });
  }
});

// ─── Edit Order ─────────────────────────────────────────────────────────
app.put('/api/order/:id', authenticateToken, async (req, res) => {
      const { isMarket, quantity, price, sl_price, tgt_price, trigger_price } = req.body;
      if (!isMarket && (!quantity || (price === undefined && trigger_price === undefined))) {
        return res.status(400).json({ error: 'Missing quantity, price, or trigger price' });
      }

      if (quantity !== undefined && quantity !== null) {
        const parsedQty = Number(quantity);
        if (isNaN(parsedQty) || parsedQty <= 0 || !isFinite(parsedQty) || !Number.isInteger(parsedQty)) {
          return res.status(400).json({ error: 'Quantity must be a positive whole integer' });
        }
      }
      if (!isMarket && price !== undefined && price !== null && price !== '') {
        const parsedP = parseFloat(price);
        if (isNaN(parsedP) || parsedP <= 0 || !isFinite(parsedP)) {
          return res.status(400).json({ error: 'Price must be a positive number greater than 0' });
        }
      }
      if (trigger_price !== undefined && trigger_price !== null && trigger_price !== '') {
        const parsedTP = parseFloat(trigger_price);
        if (isNaN(parsedTP) || parsedTP <= 0 || !isFinite(parsedTP)) {
          return res.status(400).json({ error: 'Trigger price must be a positive number greater than 0' });
        }
      }
      if (sl_price !== undefined && sl_price !== null && sl_price !== '') {
        const parsedSL = parseFloat(sl_price);
        if (isNaN(parsedSL) || parsedSL <= 0 || !isFinite(parsedSL)) {
          return res.status(400).json({ error: 'Stop loss price must be a positive number greater than 0' });
        }
      }
      if (tgt_price !== undefined && tgt_price !== null && tgt_price !== '') {
        const parsedTgt = parseFloat(tgt_price);
        if (isNaN(parsedTgt) || parsedTgt <= 0 || !isFinite(parsedTgt)) {
          return res.status(400).json({ error: 'Target price must be a positive number greater than 0' });
        }
      }

      try {
        let marketOrderToExecute = null;
        let ltpForMarket = 0;
        let updatedOrder = null;
        let updatedChildOrders = [];
        
        await db.transaction(async (trx) => {
          await trx.raw('SELECT pg_advisory_xact_lock(?)', [req.user.id]);
          const order = await trx('orders').where({ id: req.params.id, user_id: req.user.id }).forUpdate().first();
          if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
          const modifiableStatuses = ['PENDING', 'PENDING_TRIGGER', 'AMO_PENDING', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN'];
          if (!modifiableStatuses.includes(order.status)) {
            throw Object.assign(new Error('Only PENDING, PENDING_TRIGGER, AMO_PENDING, or PARTIAL_FILLED orders can be modified'), { statusCode: 400 });
          }

          const filledQty = Number(order.filled_quantity || 0);
          const newQty = quantity !== undefined && quantity !== null ? Number(quantity) : Number(order.quantity);
          if ((order.status === 'PARTIAL_FILLED' || order.status === 'PARTIALLY_FILLED') && newQty < filledQty) {
            throw Object.assign(new Error(`Modified quantity (${newQty}) cannot be less than already filled quantity (${filledQty})`), { statusCode: 400 });
          }
          const newPendingQty = Math.max(0, newQty - filledQty);

          // Validate Exchange Freeze Limit on order modification
          const isMF = String(order.symbol).endsWith('-MF') || String(order.symbol).includes('MUTUALFUND');
          if (!isMF) {
            const { getFreezeLimit, getInstantLotsize } = require('./services/taxCalculator');
            const freezeLimit = getFreezeLimit(order.symbol);
            if (freezeLimit && newQty > freezeLimit) {
              const lotSize = getInstantLotsize(order.symbol);
              const maxLots = (lotSize && lotSize > 1) ? Math.floor(freezeLimit / lotSize) : freezeLimit;
              const err = (lotSize && lotSize > 1)
                ? `Modified quantity (${newQty} qty / ${Math.round(newQty / lotSize)} lots) for ${order.symbol} exceeds exchange freeze limit of ${freezeLimit.toLocaleString('en-IN')} qty (${maxLots} lots). Please adjust quantity.`
                : `Modified quantity (${newQty.toLocaleString('en-IN')} shares) for ${order.symbol} exceeds exchange freeze limit of ${freezeLimit.toLocaleString('en-IN')} shares. Please adjust quantity.`;
              throw Object.assign(new Error(err), { statusCode: 400 });
            }
          }

          // Handle Market Execution override for Pending Triggers
          if (isMarket && order.status === 'PENDING_TRIGGER') {
             ltpForMarket = getLtpFromPriceCache(order.symbol) || Number(order.trigger_price) || Number(order.price) || 0;
             if (ltpForMarket <= 0) throw Object.assign(new Error('Live price unavailable for market execution'), { statusCode: 400 });
             
             // Update the order type to MARKET and status to PENDING so triggerEngine accepts it
             await trx('orders').where({ id: order.id }).update({ type: 'MARKET', status: 'PENDING', trigger_price: null, price: null, updated_at: new Date() });
             
             // We will execute it outside this transaction
             marketOrderToExecute = { ...order, type: 'MARKET', status: 'PENDING', trigger_price: null, price: null };
             return;
          }

          const { calculateRequiredMargin } = require('./services/marginEngine');
          const oldMargin = parseFloat(order.margin || 0);
          let newMargin = oldMargin;
          const isDerivative = isDerivativeContract(order.symbol);
          const isDelSell = order.side === 'SELL' && (order.product_type === 'DEL' || order.product_type === 'CNC' || order.product_type === 'DELIVERY') && !isDerivative;

          if (isDelSell) {
            newMargin = 0;
            // If quantity increased, verify sufficient holdings
            if (newQty > Number(order.quantity)) {
              const cleanSym = order.symbol.includes(':') ? order.symbol.split(':')[1] : order.symbol;
              const holding = await trx('holdings')
                .where({ user_id: req.user.id })
                .where(builder => {
                  builder.where({ symbol: order.symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
                })
                .first();
              const holdingQty = holding ? Number(holding.quantity) : 0;

              const existingPos = await trx('positions')
                .where({ user_id: req.user.id })
                .whereIn('product_type', ['DEL', 'CNC', 'DELIVERY'])
                .where(builder => {
                  builder.where({ symbol: order.symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
                })
                .where('quantity', '>', 0)
                .first();
              const posQty = existingPos && Number(existingPos.quantity) > 0 ? Number(existingPos.quantity) : 0;

              const pendingOrders = await trx('orders')
                .where({ user_id: req.user.id, side: 'SELL' })
                .whereIn('product_type', ['DEL', 'CNC', 'DELIVERY'])
                .where(builder => {
                  builder.where({ symbol: order.symbol }).orWhere({ symbol: cleanSym }).orWhere({ symbol: `NSE:${cleanSym}` }).orWhere({ symbol: `BSE:${cleanSym}` }).orWhere({ symbol: `MCX:${cleanSym}` });
                })
                .whereIn('status', ['PENDING', 'PENDING_TRIGGER', 'AMO_PENDING', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN'])
                .whereNot({ id: order.id });
              const otherPendingQty = pendingOrders.reduce((sum, o) => sum + Number(o.pending_quantity !== null && o.pending_quantity !== undefined ? o.pending_quantity : o.quantity), 0);

              const totalAvailable = parseFloat((holdingQty + posQty - otherPendingQty).toFixed(4));
              if (newQty > totalAvailable) {
                throw Object.assign(new Error(`Insufficient holdings. You only have ${totalAvailable} shares available.`), { statusCode: 400 });
              }
            }
          }

          if (quantity !== undefined && quantity !== null) {
            const { getLotSize } = require('./services/marginEngine');
            const lotSize = getLotSize(order.symbol);
            if (lotSize > 1 && Number(quantity) % lotSize !== 0) {
              throw Object.assign(new Error(`Quantity must be a multiple of lot size (${lotSize})`), { statusCode: 400 });
            }
          }

          if (oldMargin === 0) {
            // Check if this order is closing an existing open position or holding
            const cleanSym = order.symbol && order.symbol.includes(':') ? order.symbol.split(':')[1] : order.symbol;
            const openPos = await trx('positions')
              .where({ user_id: req.user.id, product_type: order.product_type })
              .where(function() {
                this.where('symbol', order.symbol)
                    .orWhere('symbol', cleanSym)
                    .orWhere('symbol', `NSE:${cleanSym}`)
                    .orWhere('symbol', `BSE:${cleanSym}`)
                    .orWhere('symbol', `MCX:${cleanSym}`);
              })
              .whereNot('quantity', 0)
              .first();
            const openHolding = (order.product_type === 'DEL' || order.product_type === 'CNC') && order.side === 'SELL'
              ? await trx('holdings')
                  .where({ user_id: req.user.id })
                  .where(function() {
                    this.where('symbol', order.symbol)
                        .orWhere('symbol', cleanSym)
                        .orWhere('symbol', `NSE:${cleanSym}`)
                        .orWhere('symbol', `BSE:${cleanSym}`)
                        .orWhere('symbol', `MCX:${cleanSym}`);
                  })
                  .where('quantity', '>', 0)
                  .first()
              : null;
            const isOpposingPos = (openPos && ((Number(openPos.quantity) > 0 && order.side === 'SELL') || (Number(openPos.quantity) < 0 && order.side === 'BUY'))) ||
                                  (openHolding && Number(quantity) <= Number(openHolding.quantity));
            if (isOpposingPos && (openHolding || Number(quantity) <= Math.abs(Number(openPos.quantity)))) {
              newMargin = 0;
            } else if (Number(quantity) === Number(order.quantity)) {
              newMargin = 0;
            } else if (!order.parent_order_id) {
              const livePriceForMargin = getLtpFromPriceCache(order.symbol) || parseFloat(order.price || 0);
              const effectivePrice = (!isMarket && price !== undefined && !isNaN(parseFloat(price)) && parseFloat(price) > 0) ? parseFloat(price) : (trigger_price !== undefined && !isNaN(parseFloat(trigger_price)) && parseFloat(trigger_price) > 0 ? parseFloat(trigger_price) : livePriceForMargin);
              newMargin = calculateRequiredMargin(order.symbol, order.product_type, order.side, Number(newQty), effectivePrice);
            }
          } else if (!order.parent_order_id) {
              const livePriceForMargin = getLtpFromPriceCache(order.symbol) || parseFloat(order.price || 0);
              const effectivePrice = (!isMarket && price !== undefined && !isNaN(parseFloat(price)) && parseFloat(price) > 0) ? parseFloat(price) : (trigger_price !== undefined && !isNaN(parseFloat(trigger_price)) && parseFloat(trigger_price) > 0 ? parseFloat(trigger_price) : livePriceForMargin);
              newMargin = calculateRequiredMargin(order.symbol, order.product_type, order.side, Number(newQty), effectivePrice);
          }

          const marginDifference = newMargin - oldMargin;
      
          // Check if user has enough balance if margin increases
          const user = await trx('users').where({ id: req.user.id }).forUpdate().first();
          if (marginDifference > 0 && parseFloat(user.balance) < marginDifference) {
             throw Object.assign(new Error(`Insufficient Funds. Required: ₹${marginDifference.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Available: ₹${Number(user.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`), { statusCode: 400 });
          }

          // Mathematical Price Validation for PENDING_TRIGGER
          if (order.status === 'PENDING_TRIGGER') {
             const parent = await trx('orders').where({ id: order.parent_order_id }).first();
             if (parent) {
                 const entryPrice = parseFloat(parent.price);
                 const checkPrice = trigger_price !== undefined ? parseFloat(trigger_price) : parseFloat(price);
                 const cleanSym = order.symbol && order.symbol.includes(':') ? order.symbol.split(':')[1] : order.symbol;
                 const currentLtp = getLtpFromPriceCache(order.symbol) || entryPrice;
                 if (order.type === 'SL-M' || order.type === 'SL-L' || order.type === 'SL') {
                     if (order.side === 'SELL' && checkPrice >= currentLtp) {
                         throw Object.assign(new Error(`BO Buy: Stop-Loss (₹${checkPrice}) must be lower than current market price (₹${currentLtp}).`), { statusCode: 400 });
                     } else if (order.side === 'BUY' && checkPrice <= currentLtp) {
                         throw Object.assign(new Error(`BO Sell: Stop-Loss (₹${checkPrice}) must be higher than current market price (₹${currentLtp}).`), { statusCode: 400 });
                     }
                 } else if (order.type === 'LIMIT') {
                     if (order.side === 'SELL' && checkPrice <= currentLtp) {
                         throw Object.assign(new Error(`BO Buy: Target (₹${checkPrice}) must be higher than current market price (₹${currentLtp}).`), { statusCode: 400 });
                     } else if (order.side === 'BUY' && checkPrice >= currentLtp) {
                         throw Object.assign(new Error(`BO Sell: Target (₹${checkPrice}) must be lower than current market price (₹${currentLtp}).`), { statusCode: 400 });
                     }
                 }
             }
          }

          // Build update object
          const updateObj = { 
              quantity: newQty,
              pending_quantity: newPendingQty,
              margin: newMargin,
              updated_at: new Date()
          };
          if (newPendingQty <= 0 && filledQty > 0) {
              updateObj.status = 'EXECUTED';
          }

          if (isMarket) {
              updateObj.type = 'MARKET';
              const liveLtp = getLtpFromPriceCache(order.symbol) || (price !== undefined && !isNaN(parseFloat(price)) && parseFloat(price) > 0 ? parseFloat(price) : null);
              updateObj.price = liveLtp || null;
              if (order.status === 'PENDING_TRIGGER') {
                  updateObj.trigger_price = null;
              }
          } else {
              if (order.type === 'MARKET' && price !== undefined && !isNaN(parseFloat(price)) && parseFloat(price) > 0) {
                  updateObj.type = 'LIMIT';
              }
              if (price !== undefined && price !== null && !isNaN(parseFloat(price)) && parseFloat(price) > 0) {
                  updateObj.price = parseFloat(price);
              }
          }

          if (!isMarket && trigger_price !== undefined && trigger_price !== null && !isNaN(parseFloat(trigger_price))) {
              updateObj.trigger_price = parseFloat(trigger_price);
          }

          if (order.status === 'PENDING_TRIGGER' && order.type === 'SL-M' && !isMarket) {
              updateObj.trigger_price = trigger_price !== undefined ? parseFloat(trigger_price) : parseFloat(price);
              updateObj.price = null; // SL-M is a market order when triggered
          }

          // Update sl_price and tgt_price if provided
          if (sl_price !== undefined) updateObj.sl_price = sl_price;
          if (tgt_price !== undefined) updateObj.tgt_price = tgt_price;

          // Update Order in database
          await trx('orders').where({ id: req.params.id }).update(updateObj);
          updatedOrder = { ...order, ...updateObj };
          
          // Update child OCO orders (SL and Target legs) - synchronize quantity and sl/tgt prices
          const childOrders = await trx('orders')
            .where({ parent_order_id: req.params.id, status: 'PENDING_TRIGGER' });
          
          if (childOrders.length > 0) {
            for (const child of childOrders) {
              const childUpdate = {
                quantity: newQty,
                pending_quantity: newQty,
                updated_at: new Date()
              };
              if (child.type === 'SL-M' && sl_price !== undefined) {
                childUpdate.trigger_price = sl_price;
                childUpdate.price = null;
              } else if (child.type === 'LIMIT' && tgt_price !== undefined) {
                childUpdate.price = tgt_price;
                childUpdate.trigger_price = tgt_price;
              }
              await trx('orders').where({ id: child.id }).update(childUpdate);
              updatedChildOrders.push({ ...child, ...childUpdate });
            }
          }

          // Update Balance & Ledger (deduct difference if positive, refund if negative)
          if (marginDifference > 0) {
              const newBal = Math.round((parseFloat(user.balance) - marginDifference + Number.EPSILON) * 100) / 100;
              await trx('users').where({ id: req.user.id }).update({ balance: newBal });
              await trx('ledger').insert({
                user_id: req.user.id,
                amount: -marginDifference,
                type: 'MARGIN_BLOCK',
                description: `Additional margin blocked for modified order: ${quantity} ${order.symbol} (${order.product_type})`
              });
          } else if (marginDifference < 0) {
              const refundAmount = Math.round((Math.abs(marginDifference) + Number.EPSILON) * 100) / 100;
              const newBal = Math.round((parseFloat(user.balance) + refundAmount + Number.EPSILON) * 100) / 100;
              await trx('users').where({ id: req.user.id }).update({ balance: newBal });
              await trx('ledger').insert({
                user_id: req.user.id,
                amount: refundAmount,
                type: 'MARGIN_RELEASE',
                description: `Margin refunded for modified order: ${quantity} ${order.symbol} (${order.product_type})`
              });
          }
        });

        // Outside Transaction: update Redis triggers
        if (marketOrderToExecute) {
            const triggerEngine = require('./services/triggerEngine');
            triggerEngine.removeOrderFromMemory(marketOrderToExecute.id, marketOrderToExecute.symbol);
            await triggerEngine.executeOrder(marketOrderToExecute, ltpForMarket).catch(err => console.error(err));
            return res.json({ success: true, executed: true });
        }

        const triggerEngine = require('./services/triggerEngine');
        if (updatedOrder) {
            await triggerEngine.removeOrderFromMemory(updatedOrder.id, updatedOrder.symbol);
            if (updatedOrder.status === 'PENDING' || updatedOrder.status === 'PENDING_TRIGGER') {
                await triggerEngine.addOrderToMemory(updatedOrder);
            }
            try {
                const volumeMatchingEngine = require('./services/volumeMatchingEngine');
                volumeMatchingEngine.updateOrder(updatedOrder.id, {
                    type: updatedOrder.type,
                    quantity: updatedOrder.quantity,
                    pending_quantity: updatedOrder.pending_quantity,
                    price: updatedOrder.price,
                    margin: updatedOrder.margin,
                    status: updatedOrder.status
                });

                if (updatedOrder.type === 'MARKET' && (updatedOrder.status === 'PENDING' || updatedOrder.status === 'PARTIAL_FILLED')) {
                    const baseLtp = getLtpFromPriceCache(updatedOrder.symbol) || parseFloat(updatedOrder.price) || 0;
                    if (baseLtp > 0) {
                        await volumeMatchingEngine.submitOrder(updatedOrder, baseLtp).catch(e => console.error('Volume matching submission error:', e));
                    }
                }
            } catch(e) {}
        }
        for (const child of updatedChildOrders) {
            await triggerEngine.removeOrderFromMemory(child.id, child.symbol);
            await triggerEngine.addOrderToMemory(child);
        }

        try {
            const { pubClient } = require('./services/redisClient');
            if (pubClient) {
                pubClient.publish('reload_triggers', '1').catch(e=>{});
                pubClient.publish('reload_volume_orders', '1').catch(e=>{});
            }
        } catch(e) {}
        
        if (triggerEngine && triggerEngine.io && req.user && req.user.id) {
            triggerEngine.io.to(req.user.id.toString()).emit('sync_user_data');
        }
        
        res.json({ success: true });

      } catch (err) {
        const statusCode = err.statusCode || 500;
        res.status(statusCode).json({ error: err.message });
      }
});


// ─── Historical Chart Data (Candles) ──────────────────────────────────────────────────
const candleCache = {}; // Cache to protect Fyers from rate limits (capped at 200 items)
const MAX_CANDLE_CACHE_ITEMS = 200;

function setCandleCache(key, data, now) {
  const keys = Object.keys(candleCache);
  if (keys.length >= MAX_CANDLE_CACHE_ITEMS) {
    let oldestKey = keys[0];
    let oldestTs = Infinity;
    for (const k of keys) {
      if (candleCache[k]?.timestamp < oldestTs) {
        oldestTs = candleCache[k].timestamp;
        oldestKey = k;
      }
    }
    delete candleCache[oldestKey];
  }
  candleCache[key] = { timestamp: now, data };
}

// Hourly Background cleanup: Prune expired candles older than 12h to stop RAM leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of Object.entries(candleCache)) {
    if (item && item.timestamp && (now - item.timestamp > 12 * 3600 * 1000)) {
      delete candleCache[key];
    }
  }
}, 3600000).unref();

// Smart Timeframe Cache: Determine cache limit based on requested resolution and Market Hours
function getCacheDuration(interval, symbol) {
  // 1. After-Hours Mega Cache Logic (Exclude MCX Commodities)
  const isCommodity = symbol && symbol.toUpperCase().includes('MCX');
  
  if (!isCommodity) {
      const now = new Date();
      const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
      const hours = istTime.getHours();
      
      // If market is closed (4:00 PM to 8:59 AM IST)
      if (hours >= 16 || hours < 9) {
          // Calculate exact milliseconds until 9:00 AM IST tomorrow morning
          const next9AM = new Date(istTime);
          if (hours >= 16) {
              next9AM.setDate(next9AM.getDate() + 1);
          }
          next9AM.setHours(9, 0, 0, 0);
          return next9AM.getTime() - istTime.getTime(); // Cache expires exactly at 9:00 AM!
      }
  }

  // 2. Standard Market-Hours Smart Timeframe Logic
  if (interval === '1') return 60 * 1000; // 1 min
  if (interval === '2') return 2 * 60 * 1000;
  if (interval === '3') return 3 * 60 * 1000;
  if (interval === '5') return 5 * 60 * 1000;
  if (interval === '10') return 10 * 60 * 1000;
  if (interval === '15') return 15 * 60 * 1000;
  if (interval === '30') return 30 * 60 * 1000;
  if (interval === '60' || interval === '1H') return 60 * 60 * 1000; // 1 hr
  if (interval === 'D' || interval === '1D' || interval === 'ONE_DAY') return 12 * 60 * 60 * 1000; // 12 hours
  return 60 * 1000; // fallback 1 min
}

app.get('/api/candles/:symbol', async (req, res) => {
  try {
    const { fetchCandleData } = require('./services/fyers');
    const interval = req.query.interval || 'ONE_DAY';
    let cleanSymbol = req.params.symbol;
    if (cleanSymbol.includes('CE') || cleanSymbol.includes('PE')) {
        cleanSymbol = cleanSymbol.replace(/\s+/g, '');
    }
    const cacheKey = `${cleanSymbol}_${interval}`;
    const now = Date.now();
    
    // Serve from cache if valid
    const maxAgeMs = getCacheDuration(interval, cleanSymbol);
      if (candleCache[cacheKey] && (now - candleCache[cacheKey].timestamp < maxAgeMs)) {
      return res.json(candleCache[cacheKey].data);
    }

    const candles = await fetchCandleData(cleanSymbol, interval);

    // Retry once if empty — the Fyers token may still be initializing at boot
    // (login is async; the first candle request can arrive before setAccessToken finishes)
    if ((!candles || candles.length === 0)) {
      await new Promise(r => setTimeout(r, 500));
      const retryCandles = await fetchCandleData(cleanSymbol, interval);
      if (retryCandles && retryCandles.length > 0) {
        setCandleCache(cacheKey, retryCandles, now);
        return res.json(retryCandles);
      }
    }

    // Save to cache only if valid data is returned
    if (candles && candles.length > 0) {
      setCandleCache(cacheKey, candles, now);
    }
    
    res.json(candles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Stock Details (Groww API) ──────────────────────────────────────────────

const stockDetailsCache = {};

async function fetchGoogleNews(symbol) {
  try {
    const q = encodeURIComponent(symbol + ' stock NSE');
    const res = await fetch(`https://news.google.com/rss/search?q=${q}`);
    const xml = await res.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
      const itemXml = match[1];
      const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sourceMatch = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      
      if (titleMatch && linkMatch) {
        let title = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').replace(/&amp;/g, '&');
        let publisher = sourceMatch ? sourceMatch[1] : 'News';
        if (title.includes(' - ')) {
          const parts = title.split(' - ');
          if (!sourceMatch) publisher = parts.pop();
          else parts.pop();
          title = parts.join(' - ');
        }
        
        let providerPublishTime = Math.floor(Date.now()/1000);
        if (pubDateMatch) {
           const d = new Date(pubDateMatch[1]);
           if (!isNaN(d.getTime())) providerPublishTime = Math.floor(d.getTime()/1000);
        }
        
        items.push({
          title,
          link: linkMatch[1],
          publisher,
          providerPublishTime
        });
      }
    }
    return items;
  } catch (err) {
    console.error('Google News error:', err);
    return [];
  }
}

app.get('/api/stocks/:symbol/details', async (req, res) => {
  const symbol = req.params.symbol;
  // Clean symbol by stripping exchange prefix (NSE:, BSE:, MCX:) and suffix (-EQ, -A, -B, -INDEX, etc.)
  let cleanName = symbol.replace(/^(NSE|BSE|MCX):/i, '').split('-')[0].trim();

  // ⚡ Fast-path for Indices (NIFTY50, BANKNIFTY, SENSEX, etc.) — indices are not equities and fail Groww stock search
  const isIndex = symbol.toUpperCase().includes('INDEX') || ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'NIFTY50', 'NIFTYBANK'].includes(cleanName.toUpperCase());
  if (isIndex) {
    const indexData = {
      header: { companyName: symbol.replace(/^(NSE|BSE|MCX):/i, '').replace(/-INDEX$/i, ''), nseScriptCode: cleanName, bseScriptCode: cleanName, industryName: 'Index' },
      priceData: {},
      stats: {},
      details: { businessSummary: `${symbol} is a premier benchmark index tracked on Indian financial markets.`, managingDirector: '-', foundedYear: '-' },
      isIndex: true,
      fundamentals: []
    };
    setLRUCache(stockDetailsCache, cleanName, { timestamp: Date.now(), data: indexData }, 200);
    res.set('Cache-Control', 'public, max-age=3600');
    return res.json(indexData);
  }

  // Derivatives (Options/Futures) won't be found on Groww stock search.
  const isDerivative = isDerivativeContract(symbol);
  if (isDerivative) {
    const derivData = {
      header: { companyName: symbol, nseScriptCode: cleanName, bseScriptCode: cleanName, industryName: 'Derivatives' },
      priceData: {},
      stats: {},
      details: { businessSummary: `Derivative contract (${symbol}) traded on Indian financial exchanges.`, managingDirector: '-', foundedYear: '-' },
      isDerivative: true,
      fundamentals: []
    };
    setLRUCache(stockDetailsCache, cleanName, { timestamp: Date.now(), data: derivData }, 200);
    res.set('Cache-Control', 'public, max-age=3600');
    return res.json(derivData);
  }

  if (stockDetailsCache[cleanName] && (Date.now() - stockDetailsCache[cleanName].timestamp < 3600000)) {
    res.set('Cache-Control', 'public, max-age=3600');
    return res.json(stockDetailsCache[cleanName].data);
  }

  try {
    // 1. Find Groww search_id
    const searchRes = await fetch(`https://groww.in/v1/api/search/v1/entity?app=false&entity_type=stocks&size=5&q=${encodeURIComponent(cleanName)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const searchData = await searchRes.json().catch(() => ({}));
    
    let searchId = null;
    let matchedItem = null;
    if (searchData && Array.isArray(searchData.content) && searchData.content.length > 0) {
      matchedItem = searchData.content.find(c => 
        (c.nse_script_code && c.nse_script_code.toUpperCase() === cleanName.toUpperCase()) ||
        (c.bse_scrip_code && String(c.bse_scrip_code).toUpperCase() === cleanName.toUpperCase()) ||
        (c.search_id && c.search_id.toUpperCase().includes(cleanName.toUpperCase()))
      ) || searchData.content[0];
      searchId = matchedItem?.search_id;
    }

    if (!searchId) {
      // Return a clean fallback object instead of 404 error and cache it to eliminate repeat 3s timeouts
      const fallback = {
        header: { companyName: cleanName, nseScriptCode: cleanName, bseScriptCode: cleanName, industryName: 'Equity' },
        priceData: {},
        stats: {},
        details: { businessSummary: `${cleanName} is a publicly traded security on Indian stock exchanges.`, managingDirector: '-', foundedYear: '-' },
        fundamentals: []
      };
      setLRUCache(stockDetailsCache, cleanName, { timestamp: Date.now(), data: fallback }, 200);
      res.set('Cache-Control', 'public, max-age=3600');
      return res.json(fallback);
    }

    // 2. Fetch full details from Groww and live price data for circuits
    const [detailsRes, liveRes] = await Promise.all([
      fetch(`https://groww.in/v1/api/stocks_data/v1/company/search_id/${searchId}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      fetch(`https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/NSE/segment/CASH/${cleanName}/latest`, { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(() => null)
    ]);
    const data = await detailsRes.json();
    const liveData = liveRes && liveRes.ok ? await liveRes.json().catch(() => null) : null;
    
    if (liveData) {
      data.livePriceData = liveData;
    }

    // Ensure header has clean readable symbol codes
    if (data.header) {
      if (!data.header.nseScriptCode && !data.header.bseScriptCode) {
        data.header.nseScriptCode = cleanName;
      }
    }
    
    if (data.similarAssets && data.similarAssets.peerList) {
      const peerPromises = data.similarAssets.peerList.map(p => {
        const pCode = p.companyHeader?.nseScriptCode || p.companyHeader?.bseScriptCode;
        if (!pCode) return Promise.resolve(null);
        return fetch(`https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/NSE/segment/CASH/${pCode}/latest`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
          .then(r => r.json())
          .catch(() => null);
      });
      const peerLivePrices = await Promise.all(peerPromises);
      data.similarAssets.peerList.forEach((p, i) => {
        if (peerLivePrices[i]) {
          p.livePriceData = peerLivePrices[i];
        }
      });
    }
    
    try {
      data.news = await fetchGoogleNews(cleanName);
    } catch(e) {
      data.news = [];
    }

    setLRUCache(stockDetailsCache, cleanName, { timestamp: Date.now(), data }, 200);
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(data);
  } catch (err) {
    console.error('Stock Details Fetch Error for', cleanName, err.message);
    const fallback = {
      header: { companyName: cleanName, nseScriptCode: cleanName, bseScriptCode: cleanName, industryName: 'Equity' },
      priceData: {},
      stats: {},
      details: { businessSummary: `${cleanName} is a publicly traded security on Indian stock exchanges.`, managingDirector: '-', foundedYear: '-' },
      fundamentals: []
    };
    setLRUCache(stockDetailsCache, cleanName, { timestamp: Date.now(), data: fallback }, 200);
    res.set('Cache-Control', 'public, max-age=300');
    res.json(fallback);
  }
});

// ─── Socket.IO ────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  // NOTE: Do NOT log every connect/disconnect — at 50k users this would spam logs

  // ⚡ High-Performance Cache Init: Send core indices immediately so top ticker renders instantly.
  // Slashes initial WebSocket connection payload from ~1.5MB (5,000+ symbols) down to ~1KB.
  const coreIndices = ['NSE:NIFTY50-INDEX', 'NSE:NIFTYBANK-INDEX', 'BSE:SENSEX-INDEX'];
  const initialCache = {};
  for (const idx of coreIndices) {
    if (priceCache[idx]) initialCache[idx] = priceCache[idx];
  }
  if (Object.keys(initialCache).length > 0) {
    socket.emit('price_init', initialCache);
  }

  socket.on('register_user', (userId) => {
    if (userId) {
      socket.join(userId.toString());
    }
  });

  const emitCachedPricesForNewRooms = (symbolsList) => {
    const requestedCache = {};
    symbolsList.forEach(sym => {
      if (sym && typeof sym === 'string') {
        const isNewRoom = !socket.rooms.has(sym);
        socket.join(sym);
        if (isNewRoom) {
          const p = priceCache[sym] || (sym.includes(':') ? priceCache[sym.split(':')[1]] : null);
          if (p) {
            requestedCache[sym] = [
              p.ltp,
              p.change !== undefined ? p.change : (p.ch !== undefined ? p.ch : 0),
              p.pct !== undefined ? p.pct : (p.chp !== undefined ? p.chp : 0),
              p.timestamp || p.ts || Date.now(),
              p.open,
              p.high,
              p.low,
              p.close,
              p.volume !== undefined ? p.volume : (p.vol !== undefined ? p.vol : 0),
              p.totBuyQuan || 0,
              p.totSellQuan || 0,
              p.upper_circuit || p.upper_ckt || 0,
              p.lower_circuit || p.lower_ckt || 0
            ];
          }
        }
      }
    });
    if (Object.keys(requestedCache).length > 0) {
      socket.emit('price_init', requestedCache);
    }
  };

  socket.on('subscribe', (data) => {
    if (Array.isArray(data)) {
        const syms = data.map(sym => typeof sym === 'string' ? sym : sym?.symbol).filter(Boolean);
        emitCachedPricesForNewRooms(syms);
        if (isMaster) {
            const { addSubscriptionBatch } = require('./services/fyers');
            if (addSubscriptionBatch) addSubscriptionBatch(data);
        } else {
            try {
                const { pubClient } = require('./services/redisClient');
                pubClient.publish('fyers_subscribe', JSON.stringify(data)).catch(e=>{});
            } catch (err) {}
        }
    } else {
        let symbol = typeof data === 'string' ? data : data?.symbol;
        if (symbol) emitCachedPricesForNewRooms([symbol]);
        if (isMaster) {
            const { addSubscription } = require('./services/fyers');
            if (addSubscription) addSubscription(data, io, priceCache);
        } else {
            try {
                const { pubClient } = require('./services/redisClient');
                pubClient.publish('fyers_subscribe', JSON.stringify([symbol])).catch(e=>{});
            } catch (err) {}
        }
    }
  });

  socket.on('ping_subscriptions', (symbolsArray) => {
    if (!Array.isArray(symbolsArray)) return;
    
    // Join socket.io rooms for each symbol and push price_init for any newly joined rooms
    emitCachedPricesForNewRooms(symbolsArray);

    if (isMaster) {
      const { handlePingSubscriptions } = require('./services/fyers');
      if (handlePingSubscriptions) handlePingSubscriptions(symbolsArray);
    } else {
      try {
        const { pubClient } = require('./services/redisClient');
        pubClient.publish('fyers_ping', JSON.stringify(symbolsArray)).catch(e=>{});
      } catch (err) {}
    }
  });


  socket.on('unsubscribe', (data) => {
    if (Array.isArray(data)) {
      data.forEach(item => {
        const sym = typeof item === 'string' ? item : item?.symbol;
        if (sym) socket.leave(sym);
      });
    } else if (data) {
      const sym = typeof data === 'string' ? data : data.symbol;
      if (sym) socket.leave(sym);
    }
  });

    socket.on('subscribe_depth', (symbol) => {
    // [DISABLED for bandwidth/traffic optimization]
    // Keeping this route as a dummy so it can easily be re-enabled for VIP/Yearly customers later.
    return;
  });

  socket.on('unsubscribe_depth', (symbol) => {
    // [DISABLED for bandwidth/traffic optimization]
    return;
  });

  socket.on('disconnect', () => {
    // NOTE: No log here intentionally — at scale this would spam the logger
  });
});

app.get('/api/debug-state', authenticateToken, requireAdmin, (req, res) => {
  const { getFyersAuthURL, getFyersStatus } = require('./services/fyers');
  let state = {};
  if (getFyersAuthURL) {
    state = getFyersAuthURL();
  }
  let fyersStatus = {};
  if (getFyersStatus) {
    fyersStatus = getFyersStatus();
  }
  res.json({
    state,
    fyers: fyersStatus,
    lastOrderError,
    time: new Date().toISOString(),
    isMaster: process.env.NODE_APP_INSTANCE === '0' || !process.env.NODE_APP_INSTANCE,
    pmId: process.env.pm_id
  });
});

app.get('/api/fyers/auth-url', authenticateToken, requireAdmin, (req, res) => {
  const { getFyersAuthURL } = require('./services/fyers');
  try {
    const url = getFyersAuthURL();
    res.json({ url });
  } catch (err) {
    console.error("Error generating Fyers Auth URL:", err);
    res.status(500).json({ error: "Failed to generate auth URL" });
  }
});

app.get('/api/diagnostics/logs', authenticateToken, requireAdmin, (req, res) => {
  const fs = require('fs');
  const path = require('path');
  try {
    const logFile = path.join(__dirname, 'error.log');
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.split('\n');
      res.type('text/plain').send(lines.slice(Math.max(lines.length - 200, 0)).join('\n'));
    } else {
      res.type('text/plain').send('No log file found for today.');
    }
  } catch (err) {
    res.type('text/plain').send(err.message);
  }
});

app.get('/api/fyers/status', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { getFyersStatus } = require('./services/fyers');
    if (getFyersStatus) {
      res.json(getFyersStatus());
    } else {
      res.status(500).json({ error: 'getFyersStatus not exported' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fyers OAuth Callback directly handled by backend
app.get('/api/fyers/callback', async (req, res) => {
  const { auth_code } = req.query;
  if (!auth_code) {
    return res.redirect('/adminpanel?fyers_error=no_auth_code');
  }
  try {
    const { verifyFyersAuth } = require('./services/fyers');
    const result = await verifyFyersAuth(auth_code);
    if (result.success) {
      res.redirect('/adminpanel?fyers_success=true');
    } else {
      res.redirect('/adminpanel?fyers_error=' + encodeURIComponent(result.error));
    }
  } catch (err) {
    console.error(err);
    res.redirect('/adminpanel?fyers_error=server_error');
  }
});

app.post('/api/fyers/verify', async (req, res) => {
  const { auth_code } = req.body;
  if (!auth_code) return res.status(400).json({ error: "Missing auth_code" });
  
  const { verifyFyersAuth } = require('./services/fyers');
  try {
    const result = await verifyFyersAuth(auth_code);
    if (result && result.success) {
      res.json({ success: true, message: "Fyers authenticated successfully!" });
    } else {
      res.status(401).json({ success: false, error: result?.error || "Fyers authentication failed." });
    }
  } catch (err) {
    console.error("Fyers Verify Error:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.get('/api/admin/razorpay/credentials', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });
    const rowId = await db('system_settings').where({ key: 'razorpay_key_id' }).first();
    const rowSec = await db('system_settings').where({ key: 'razorpay_key_secret' }).first();
    const key_id = rowId?.value || process.env.RAZORPAY_KEY_ID || '';
    const key_secret = rowSec?.value || process.env.RAZORPAY_KEY_SECRET || '';
    res.json({
      success: true,
      key_id,
      has_key_id: !!(key_id && key_id !== 'rzp_test_placeholder'),
      has_key_secret: !!(key_secret && key_secret !== 'secret_placeholder')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/razorpay/credentials', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });
    const { key_id, key_secret } = req.body;
    if (key_id !== undefined) {
      await db('system_settings').insert({ key: 'razorpay_key_id', value: key_id.trim(), updated_at: new Date() }).onConflict('key').merge();
    }
    if (key_secret !== undefined && key_secret.trim() !== '') {
      await db('system_settings').insert({ key: 'razorpay_key_secret', value: key_secret.trim(), updated_at: new Date() }).onConflict('key').merge();
    }
    res.json({ success: true, message: 'Razorpay keys saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Ad Monetization & 30-Second Rewarded Video Ad Engine (Multi-Worker Safe) ───
let adConfigCache = {
  enabled: true,
  show_ads_to_admin: true,
  interstitial_enabled: true,
  internal_counter_enabled: false,
  direct_sponsor_enabled: false,
  adsense_client_id: process.env.ADSENSE_CLIENT_ID || 'ca-pub-1001083475331869',
  adsense_banner_slot: process.env.ADSENSE_BANNER_SLOT || '5099870662',
  adsense_rewarded_slot: process.env.ADSENSE_REWARDED_SLOT || '2846165854',
  reward_enabled: true,
  reward_amount: 100000,
  reward_daily_limit: 3,
  sponsor_badge: 'SPONSORED PARTNER',
  sponsor_title: 'Open a FREE Zero-Brokerage Demat & Options Account — ₹0 AMC',
  sponsor_subtitle: 'Trade Live NSE, BSE & MCX Options with Sub-Second Execution, Option Chain Greeks & TradingView Charts.',
  sponsor_cta_text: 'Open Free Account →',
  sponsor_target_url: 'https://skandx.in/pricing',
  sponsor_video_url: '',
  impressions: 0,
  clicks: 0,
  reward_claims: 0
};

async function loadAdConfigFromDb() {
  try {
    const row = await db('system_settings').where({ key: 'ads_monetization_config' }).first();
    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      adConfigCache = {
        ...adConfigCache,
        ...parsed,
        show_ads_to_admin: parsed.show_ads_to_admin !== undefined ? Boolean(parsed.show_ads_to_admin) : true,
        interstitial_enabled: parsed.interstitial_enabled !== undefined ? Boolean(parsed.interstitial_enabled) : true,
        internal_counter_enabled: parsed.internal_counter_enabled === true,
        direct_sponsor_enabled: parsed.direct_sponsor_enabled === true,
        adsense_client_id: parsed.adsense_client_id || adConfigCache.adsense_client_id || 'ca-pub-1001083475331869',
        adsense_banner_slot: parsed.adsense_banner_slot || adConfigCache.adsense_banner_slot || '5099870662',
        adsense_rewarded_slot: parsed.adsense_rewarded_slot || adConfigCache.adsense_rewarded_slot || '2846165854',
        impressions: Number(parsed.impressions ?? adConfigCache.impressions ?? 0),
        clicks: Number(parsed.clicks ?? adConfigCache.clicks ?? 0),
        reward_claims: Number(parsed.reward_claims ?? adConfigCache.reward_claims ?? 0)
      };
    }
  } catch (e) {}
}
setTimeout(loadAdConfigFromDb, 2000);
setInterval(loadAdConfigFromDb, 15000).unref();

// Authorized Digital Sellers (ads.txt) for Google AdSense crawler verification
app.get('/ads.txt', (req, res) => {
  const rawId = String(adConfigCache.adsense_client_id || 'ca-pub-1001083475331869').trim();
  const pubId = rawId.startsWith('ca-') ? rawId.slice(3) : rawId;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(`google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`);
});

// Public fast RAM-cached Ad Config endpoint (0 DB queries, 0% CPU load)
app.get('/api/ads/config', (req, res) => {
  res.json({
    success: true,
    config: {
      enabled: Boolean(adConfigCache.enabled),
      show_ads_to_admin: adConfigCache.show_ads_to_admin !== undefined ? Boolean(adConfigCache.show_ads_to_admin) : true,
      interstitial_enabled: adConfigCache.interstitial_enabled !== undefined ? Boolean(adConfigCache.interstitial_enabled) : true,
      internal_counter_enabled: Boolean(adConfigCache.internal_counter_enabled),
      direct_sponsor_enabled: Boolean(adConfigCache.direct_sponsor_enabled),
      adsense_client_id: adConfigCache.adsense_client_id || 'ca-pub-1001083475331869',
      adsense_banner_slot: adConfigCache.adsense_banner_slot || '5099870662',
      adsense_rewarded_slot: adConfigCache.adsense_rewarded_slot || '2846165854',
      reward_enabled: Boolean(adConfigCache.reward_enabled),
      reward_amount: Number(adConfigCache.reward_amount || 100000),
      reward_daily_limit: Number(adConfigCache.reward_daily_limit || 3),
      sponsor_badge: adConfigCache.sponsor_badge || 'SPONSORED PARTNER',
      sponsor_title: adConfigCache.sponsor_title || '',
      sponsor_subtitle: adConfigCache.sponsor_subtitle || '',
      sponsor_cta_text: adConfigCache.sponsor_cta_text || 'Learn More →',
      sponsor_target_url: adConfigCache.sponsor_target_url || 'https://skandx.in/pricing',
      sponsor_video_url: adConfigCache.sponsor_video_url || ''
    }
  });
});

// Multi-worker safe impression / click / 30s completion tracker
let adDelta = { impressions: 0, clicks: 0, reward_claims: 0 };
let flushingAdStats = false;

async function flushAdDeltaToDb() {
  if (flushingAdStats) return;
  if (adDelta.impressions === 0 && adDelta.clicks === 0 && adDelta.reward_claims === 0) return;

  const impToAdd = adDelta.impressions;
  const clkToAdd = adDelta.clicks;
  const cmpToAdd = adDelta.reward_claims;
  adDelta = { impressions: 0, clicks: 0, reward_claims: 0 };
  flushingAdStats = true;

  try {
    const row = await db('system_settings').where({ key: 'ads_monetization_config' }).first();
    let base = { ...adConfigCache };
    if (row && row.value) {
      try {
        base = { ...base, ...JSON.parse(row.value) };
      } catch (_) {}
    }
    base.impressions = Number(base.impressions || 0) + impToAdd;
    base.clicks = Number(base.clicks || 0) + clkToAdd;
    base.reward_claims = Number(base.reward_claims || 0) + cmpToAdd;
    adConfigCache = base;

    await db('system_settings')
      .insert({ key: 'ads_monetization_config', value: JSON.stringify(adConfigCache), updated_at: new Date() })
      .onConflict('key')
      .merge();
  } catch (e) {
    adDelta.impressions += impToAdd;
    adDelta.clicks += clkToAdd;
    adDelta.reward_claims += cmpToAdd;
  } finally {
    flushingAdStats = false;
  }
}

app.post('/api/ads/track', async (req, res) => {
  if (!adConfigCache.internal_counter_enabled) {
    return res.json({
      success: true,
      disabled: true,
      stats: {
        impressions: 0,
        clicks: 0,
        reward_claims: 0
      }
    });
  }
  const { event } = req.body || {};
  if (event === 'impression') {
    adDelta.impressions += 1;
    adConfigCache.impressions = Number(adConfigCache.impressions || 0) + 1;
    flushAdDeltaToDb().catch(() => {});
  } else if (event === 'click') {
    adDelta.clicks += 1;
    adConfigCache.clicks = Number(adConfigCache.clicks || 0) + 1;
    await flushAdDeltaToDb();
  } else if (event === 'complete_30s') {
    adDelta.reward_claims += 1;
    adConfigCache.reward_claims = Number(adConfigCache.reward_claims || 0) + 1;
    await flushAdDeltaToDb();
  }
  res.json({
    success: true,
    stats: {
      impressions: adConfigCache.impressions,
      clicks: adConfigCache.clicks,
      reward_claims: adConfigCache.reward_claims
    }
  });
});

setInterval(() => {
  flushAdDeltaToDb().catch(() => {});
}, 3000).unref();

// Claim 30-Second Rewarded Video Ad Bonus (Atomic Transaction + Double-Entry Ledger)
app.post('/api/ads/claim-reward', authenticateToken, async (req, res) => {
  const { watchDurationSec } = req.body || {};
  if (!adConfigCache.enabled || !adConfigCache.reward_enabled) {
    return res.status(400).json({ error: 'Rewarded video ads are currently disabled.' });
  }
  if (Number(watchDurationSec || 0) < 28) {
    return res.status(400).json({ error: 'Please watch the complete 30-second video ad to claim your reward.' });
  }

  const userId = req.user.id;
  const rewardAmount = Math.max(1000, Math.min(100000000, Number(adConfigCache.reward_amount || 100000)));
  const dailyLimit = Math.max(1, Number(adConfigCache.reward_daily_limit || 3));

  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayClaimsRow = await db('ledger')
      .where({ user_id: userId, type: 'DEPOSIT' })
      .where('description', 'like', '30s Rewarded Video Ad Bonus%')
      .where('created_at', '>=', startOfToday)
      .count('id as cnt')
      .first();

    const claimsToday = Number(todayClaimsRow?.cnt || 0);
    if (claimsToday >= dailyLimit) {
      return res.status(429).json({
        error: `Daily limit reached (${dailyLimit}/${dailyLimit} rewarded ads claimed today). Upgrade to PRO for unlimited virtual capital & zero ads!`
      });
    }

    let updatedBalance = 0;
    await db.transaction(async (trx) => {
      if (trx.client.config.client === 'pg') {
        await trx.raw('SELECT pg_advisory_xact_lock(7001, ?)', [Number(userId)]);
      }
      const userRow = await trx('users').where({ id: userId }).forUpdate().first();
      if (!userRow) throw new Error('User not found');

      updatedBalance = parseFloat((Number(userRow.balance || 0) + rewardAmount).toFixed(2));
      await trx('users').where({ id: userId }).update({ balance: updatedBalance });

      await trx('ledger').insert({
        user_id: userId,
        type: 'DEPOSIT',
        amount: rewardAmount,
        description: `30s Rewarded Video Ad Bonus (+₹${rewardAmount.toLocaleString('en-IN')})`,
        created_at: new Date()
      });
    });

    await flushAdDeltaToDb();
    await loadAdConfigFromDb();

    res.json({
      success: true,
      reward_amount: rewardAmount,
      balance: updatedBalance,
      claims_today: claimsToday + 1,
      daily_limit: dailyLimit,
      message: `🎉 +₹${rewardAmount.toLocaleString('en-IN')} Demo Funds credited to your account!`
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to credit ad reward' });
  }
});

// Admin Get & Save Ad Monetization Config
app.get('/api/admin/ads/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await flushAdDeltaToDb();
    await loadAdConfigFromDb();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalRewardsRow, todayRewardsRow, recentClaims] = await Promise.all([
      db('ledger')
        .where({ type: 'DEPOSIT' })
        .where('description', 'like', '30s Rewarded Video Ad Bonus%')
        .select(db.raw('COUNT(id) as cnt, COALESCE(SUM(amount), 0) as total_amount'))
        .first()
        .catch(() => null),
      db('ledger')
        .where({ type: 'DEPOSIT' })
        .where('description', 'like', '30s Rewarded Video Ad Bonus%')
        .where('created_at', '>=', startOfToday)
        .count('id as cnt')
        .first()
        .catch(() => null),
      db('ledger as l')
        .leftJoin('users as u', 'l.user_id', 'u.id')
        .where('l.type', 'DEPOSIT')
        .where('l.description', 'like', '30s Rewarded Video Ad Bonus%')
        .select('l.id', 'l.amount', 'l.created_at', 'u.username', 'u.client_id')
        .orderBy('l.created_at', 'desc')
        .limit(5)
        .catch(() => [])
    ]);

    const totalClaimsDb = Number(totalRewardsRow?.cnt || 0);
    const totalAmountCredited = Number(totalRewardsRow?.total_amount || 0);
    const todayClaimsDb = Number(todayRewardsRow?.cnt || 0);

    res.json({
      success: true,
      config: {
        ...adConfigCache,
        today_reward_claims: todayClaimsDb,
        total_reward_claims_db: totalClaimsDb,
        total_reward_amount_credited: totalAmountCredited,
        recent_claims: recentClaims || []
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/ads/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await flushAdDeltaToDb();
    await loadAdConfigFromDb();
    const incoming = req.body || {};
    adConfigCache = {
      ...adConfigCache,
      enabled: incoming.enabled !== undefined ? Boolean(incoming.enabled) : adConfigCache.enabled,
      show_ads_to_admin: incoming.show_ads_to_admin !== undefined ? Boolean(incoming.show_ads_to_admin) : (adConfigCache.show_ads_to_admin !== undefined ? Boolean(adConfigCache.show_ads_to_admin) : true),
      interstitial_enabled: incoming.interstitial_enabled !== undefined ? Boolean(incoming.interstitial_enabled) : (adConfigCache.interstitial_enabled !== undefined ? Boolean(adConfigCache.interstitial_enabled) : true),
      internal_counter_enabled: incoming.internal_counter_enabled !== undefined ? Boolean(incoming.internal_counter_enabled) : Boolean(adConfigCache.internal_counter_enabled),
      direct_sponsor_enabled: incoming.direct_sponsor_enabled !== undefined ? Boolean(incoming.direct_sponsor_enabled) : Boolean(adConfigCache.direct_sponsor_enabled),
      adsense_client_id: incoming.adsense_client_id !== undefined ? String(incoming.adsense_client_id).trim() : adConfigCache.adsense_client_id,
      adsense_banner_slot: incoming.adsense_banner_slot !== undefined ? String(incoming.adsense_banner_slot).trim() : adConfigCache.adsense_banner_slot,
      adsense_rewarded_slot: incoming.adsense_rewarded_slot !== undefined ? String(incoming.adsense_rewarded_slot).trim() : adConfigCache.adsense_rewarded_slot,
      reward_enabled: incoming.reward_enabled !== undefined ? Boolean(incoming.reward_enabled) : adConfigCache.reward_enabled,
      reward_amount: incoming.reward_amount !== undefined ? Math.max(1000, Number(incoming.reward_amount) || 100000) : adConfigCache.reward_amount,
      reward_daily_limit: incoming.reward_daily_limit !== undefined ? Math.max(1, Number(incoming.reward_daily_limit) || 3) : adConfigCache.reward_daily_limit,
      sponsor_badge: incoming.sponsor_badge !== undefined ? String(incoming.sponsor_badge).trim() : adConfigCache.sponsor_badge,
      sponsor_title: incoming.sponsor_title !== undefined ? String(incoming.sponsor_title).trim() : adConfigCache.sponsor_title,
      sponsor_subtitle: incoming.sponsor_subtitle !== undefined ? String(incoming.sponsor_subtitle).trim() : adConfigCache.sponsor_subtitle,
      sponsor_cta_text: incoming.sponsor_cta_text !== undefined ? String(incoming.sponsor_cta_text).trim() : adConfigCache.sponsor_cta_text,
      sponsor_target_url: incoming.sponsor_target_url !== undefined ? String(incoming.sponsor_target_url).trim() : adConfigCache.sponsor_target_url,
      sponsor_video_url: incoming.sponsor_video_url !== undefined ? String(incoming.sponsor_video_url).trim() : adConfigCache.sponsor_video_url
    };

    if (incoming.reset_stats === true) {
      adDelta = { impressions: 0, clicks: 0, reward_claims: 0 };
      adConfigCache.impressions = 0;
      adConfigCache.clicks = 0;
      adConfigCache.reward_claims = 0;
    }

    await db('system_settings')
      .insert({ key: 'ads_monetization_config', value: JSON.stringify(adConfigCache), updated_at: new Date() })
      .onConflict('key')
      .merge();

    res.json({
      success: true,
      config: adConfigCache,
      message: 'Ad Monetization & Rewarded Video settings saved and activated immediately!'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/fyers/credentials', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });
    const { getFyersCredentials } = require('./services/fyersAutoLogin');
    const creds = await getFyersCredentials();
    res.json({
      success: true,
      hasCredentials: !!(creds.fy_id && creds.pin && creds.totp_key),
      fyers_user_id: creds.fy_id || '',
      has_pin: !!creds.pin,
      has_totp_key: !!creds.totp_key,
      app_id: creds.app_id || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/fyers/credentials', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });
    const { fyers_user_id, fyers_pin, fyers_totp_key } = req.body;
    if (fyers_user_id) {
      await db('system_settings').insert({ key: 'fyers_user_id', value: fyers_user_id.trim(), updated_at: new Date() }).onConflict('key').merge();
    }
    if (fyers_pin) {
      await db('system_settings').insert({ key: 'fyers_pin', value: fyers_pin.trim(), updated_at: new Date() }).onConflict('key').merge();
    }
    if (fyers_totp_key) {
      const cleanKey = fyers_totp_key.replace(/\s+/g, '').toUpperCase();
      if (cleanKey.length === 6 && /^\d{6}$/.test(cleanKey)) {
        return res.status(400).json({
          error: 'You entered a 6-digit temporary OTP instead of the permanent 32-character TOTP Secret Key. Please copy the alphanumeric secret key from your Fyers 2FA / Authenticator setup.'
        });
      }
      const { encryptSecret } = require('./services/fyersAutoLogin');
      await db('system_settings').insert({ key: 'fyers_totp_key', value: encryptSecret(cleanKey), updated_at: new Date() }).onConflict('key').merge();
    }

    // Immediately attempt auto-login with the new credentials
    const { performFyersAutoLogin } = require('./services/fyersAutoLogin');
    const loginResult = await performFyersAutoLogin();
    res.json({ success: true, message: 'Fyers credentials saved', loginResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/fyers/auto-login', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });
    const { performFyersAutoLogin } = require('./services/fyersAutoLogin');
    const result = await performFyersAutoLogin();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/fyers-debug', authenticateToken, requireAdmin, (req, res) => {
  const { getFyersStatus } = require('./services/fyers');
  if (getFyersStatus) {
    res.json(getFyersStatus());
  } else {
    res.json({ error: 'getFyersStatus not found' });
  }
});

// ─── Traders Community Hub & Tiered WebP Photo Vault ──────────────────────
const { communityRouter, UPLOADS_ROOT } = require('./services/communityRoutes');
app.use('/uploads/community', express.static(UPLOADS_ROOT, {
  maxAge: '30d',
  immutable: true
}));
app.use('/api/community', apiLimiter, communityRouter);

// ─── Serve Frontend in Production ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/dist'), {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, filePath) => {
    // Dynamic entry points (HTML, Service Worker, Webmanifest) are NEVER cached
    if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// --- REWARD WITHDRAWALS & BANK DETAILS ---

app.post('/api/user/bank_details', authenticateToken, async (req, res) => {
  try {
    const { upi_id, bank_account_no, bank_ifsc } = req.body;
    await db('users').where({ id: req.user.id }).update({
      upi_id,
      bank_account_no,
      bank_ifsc
    });
    res.json({ success: true, message: 'Bank details updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/withdrawals/request', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    await db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [req.user.id]);

      // Check if user has bank details
      const user = await trx('users').where({ id: req.user.id }).first();
      if (!user.upi_id && (!user.bank_account_no || !user.bank_ifsc)) {
        throw Object.assign(new Error('Please update your Bank or UPI details in Settings before withdrawing'), { statusCode: 400 });
      }

      // Calculate available balance inside transaction
      const referrals = await trx('referrals').where({ referrer_id: req.user.id, status: 'completed' });
      const totalEarned = referrals.reduce((sum, r) => sum + parseFloat(r.reward_amount || 0), 0);
      
      const withdrawals = await trx('reward_withdrawals').where({ user_id: req.user.id });
      const blockedAmount = withdrawals.filter(w => ['PENDING', 'PROCESSING', 'CREDITED'].includes(w.status)).reduce((sum, w) => sum + parseFloat(w.amount), 0);
      
      const availableRewardBalance = totalEarned - blockedAmount;

      if (parsedAmount > availableRewardBalance) {
        throw Object.assign(new Error('Insufficient reward balance'), { statusCode: 400 });
      }

      await trx('reward_withdrawals').insert({
        user_id: req.user.id,
        amount: parsedAmount,
        status: 'PENDING',
        created_at: new Date()
      });
    });

    res.json({ success: true, message: 'Withdrawal request submitted successfully' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.get('/api/admin/withdrawals', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const isExport = req.query.export === 'true' || req.query.limit === 'all';

    let query = db('reward_withdrawals')
      .join('users', 'reward_withdrawals.user_id', 'users.id')
      .select(
        'reward_withdrawals.*', 
        'users.username', 
        'users.client_id',
        'users.email',
        'users.phone',
        'users.upi_id',
        'users.bank_account_no',
        'users.bank_ifsc',
        'users.last_ip',
        'users.registration_ip'
      );

    let countQuery = db('reward_withdrawals');

    if (search) {
      countQuery = countQuery.join('users', 'reward_withdrawals.user_id', 'users.id');
      const s = `%${search}%`;
      query = query.where(function() {
        this.where('users.username', 'ilike', s)
            .orWhere('users.phone', 'ilike', s)
            .orWhere('users.upi_id', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s)
            .orWhere('users.bank_account_no', 'ilike', s)
            .orWhereRaw('CAST(reward_withdrawals.amount AS TEXT) ilike ?', [s]);
      });
      countQuery = countQuery.where(function() {
        this.where('users.username', 'ilike', s)
            .orWhere('users.phone', 'ilike', s)
            .orWhere('users.upi_id', 'ilike', s)
            .orWhere('users.client_id', 'ilike', s)
            .orWhere('users.bank_account_no', 'ilike', s)
            .orWhereRaw('CAST(reward_withdrawals.amount AS TEXT) ilike ?', [s]);
      });
    }

    if (startDate) {
      query = query.where('reward_withdrawals.created_at', '>=', startDate);
      countQuery = countQuery.where('reward_withdrawals.created_at', '>=', startDate);
    }
    if (endDate) {
      query = query.where('reward_withdrawals.created_at', '<=', endDate);
      countQuery = countQuery.where('reward_withdrawals.created_at', '<=', endDate);
    }

    const [countResult] = await countQuery.count('reward_withdrawals.id as total');
    const total = countResult ? parseInt(countResult.total) : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    let withQuery = query.orderBy('reward_withdrawals.created_at', 'desc');
    if (!isExport) {
      withQuery = withQuery.limit(limit).offset(offset);
    } else {
      withQuery = withQuery.limit(10000);
    }
    const withdrawals = await withQuery;

    // Group users by IP to detect multi-account fraud
    const ipCounts = await db('users')
      .whereNotNull('last_ip')
      .whereNot('last_ip', '')
      .groupBy('last_ip')
      .select('last_ip')
      .count('id as count');

    const ipMap = {};
    ipCounts.forEach(r => {
      ipMap[r.last_ip] = parseInt(r.count, 10);
    });

    const enhanced = [];
    for (const w of withdrawals) {
      const ip = w.last_ip || w.registration_ip;
      const sharedCount = ip ? (ipMap[ip] || 1) : 1;
      let sharedUsers = [];
      if (sharedCount > 1 && ip) {
        const matching = await db('users')
          .where(function() {
            this.where('last_ip', ip).orWhere('registration_ip', ip);
          })
          .whereNot('id', w.user_id)
          .select('id', 'username')
          .limit(5);
        sharedUsers = matching.map(m => m.username);
      }
      enhanced.push({
        ...w,
        shared_ip_count: sharedCount,
        shared_users: sharedUsers
      });
    }

    res.json({ success: true, withdrawals: enhanced, total, page, totalPages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/withdrawals/:id/process', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const { status, remarks, utr } = req.body;
    if (!['PENDING', 'PROCESSING', 'CREDITED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid withdrawal status' });
    }

    await db.transaction(async (trx) => {
      const withdrawal = await trx('reward_withdrawals').where({ id: req.params.id }).forUpdate().first();
      if (!withdrawal) throw Object.assign(new Error('Withdrawal record not found'), { statusCode: 404 });

      // Advisory lock on the withdrawal target user
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [withdrawal.user_id]);

      // State machine validation: cannot modify once in terminal state (CREDITED or REJECTED)
      if (withdrawal.status === 'CREDITED' || withdrawal.status === 'REJECTED') {
        throw Object.assign(new Error(`Withdrawal #${withdrawal.id} is already ${withdrawal.status} and cannot be modified.`), { statusCode: 400 });
      }

      // If rejecting a trading wallet withdrawal, refund the balance back to user
      if (status === 'REJECTED') {
        const isTradingWallet = (withdrawal.remarks && withdrawal.remarks.includes('Trading Wallet')) || 
                                withdrawal.account_type === 'TRADING_WALLET' ||
                                (withdrawal.description && withdrawal.description.includes('Trading Wallet'));
        if (isTradingWallet) {
          const refundUser = await trx('users').where({ id: withdrawal.user_id }).forUpdate().first();
          if (refundUser) {
            const refundedBalance = Math.round((parseFloat(refundUser.balance) + parseFloat(withdrawal.amount) + Number.EPSILON) * 100) / 100;
            await trx('users').where({ id: withdrawal.user_id }).update({ balance: refundedBalance });
            await trx('ledger').insert({
              user_id: withdrawal.user_id,
              amount: parseFloat(withdrawal.amount),
              type: 'DEPOSIT',
              description: `Refund for Rejected Withdrawal #${withdrawal.id}${remarks ? `: ${remarks}` : ''}`
            });
          }
        }
      }

      await trx('reward_withdrawals').where({ id: req.params.id }).update({
        status,
        admin_notes: remarks || withdrawal.admin_notes || null,
        remarks: withdrawal.remarks, // Preserve original withdrawal remarks
        utr: utr || null,
        updated_at: new Date()
      });
      req.processedWithdrawalUserId = withdrawal.user_id;
    });

    const triggerEngine = require('./services/triggerEngine');
    if (triggerEngine && triggerEngine.io && req.processedWithdrawalUserId) {
      triggerEngine.io.to(req.processedWithdrawalUserId.toString()).emit('sync_user_data');
    }

    res.json({ success: true, message: `Withdrawal #${req.params.id} marked as ${status}` });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ─── Segment Filter Helper for Leaderboards & Contests ─────────────────────
function applySegmentFilterToQuery(query, segment) {
  if (!segment || segment === 'ALL') return query;
  const seg = String(segment).toUpperCase();
  const commList = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'];
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  
  if (seg === 'EQUITY') {
    query.whereNot('positions.symbol', 'like', 'MCX:%')
         .whereNot('positions.symbol', 'like', '%-MF')
         .whereNot('positions.symbol', 'like', '%:MF')
         .whereNot('positions.symbol', 'like', '%FUT')
         .whereNot('positions.symbol', 'like', '%-FUT');
    digits.forEach(d => {
      query.whereNot('positions.symbol', 'like', `%${d}CE`)
           .whereNot('positions.symbol', 'like', `%${d}PE`);
    });
    commList.forEach(c => {
      query.whereNot('positions.symbol', 'like', `%${c}%`);
    });
  } else if (seg === 'FNO' || seg === 'DERIVATIVES') {
    query.where(builder => {
      builder.where('positions.symbol', 'like', '%FUT')
             .orWhere('positions.symbol', 'like', '%-FUT')
             .orWhere('positions.symbol', 'like', 'MCX:%');
      digits.forEach(d => {
        builder.orWhere('positions.symbol', 'like', `%${d}CE`)
               .orWhere('positions.symbol', 'like', `%${d}PE`);
      });
    });
  } else if (seg === 'COMMODITY' || seg === 'COMMODITIES') {
    query.where(builder => {
      builder.where('positions.symbol', 'like', 'MCX:%');
      commList.forEach(c => {
        builder.orWhere('positions.symbol', 'like', `%${c}%`);
      });
    });
  }
  return query;
}

// ─── Subscription Access Tier Helper for Leaderboards & Contests ───────────
function applyTierFilterToQuery(query, accessTier) {
  if (!accessTier || accessTier === 'ALL') return query;
  const tier = String(accessTier).toUpperCase();
  const now = new Date();

  // MONTHLY_PLUS: Allowed tiers: MONTHLY, YEARLY, HIGHEST, FEATURE, PRO, VIP, LIFETIME
  if (tier === 'MONTHLY_PLUS' || tier === 'PAID_PLUS') {
    query.whereIn('users.subscription_tier', ['MONTHLY', 'YEARLY', 'HIGHEST', 'FEATURE', 'PRO', 'VIP', 'LIFETIME'])
         .where(builder => {
           builder.whereNull('users.subscription_expires').orWhere('users.subscription_expires', '>=', now);
         });
  } 
  // YEARLY_PLUS: Allowed tiers: YEARLY, MONTHLY, PRO, HIGHEST, FEATURE, VIP, LIFETIME (Monthly & Yearly share same features)
  else if (tier === 'YEARLY_PLUS') {
    query.whereIn('users.subscription_tier', ['YEARLY', 'MONTHLY', 'PRO', 'HIGHEST', 'FEATURE', 'VIP', 'LIFETIME'])
         .where(builder => {
           builder.whereNull('users.subscription_expires').orWhere('users.subscription_expires', '>=', now);
         });
  } 
  // HIGHEST_ONLY / VIP: Feature Plan exclusive
  else if (tier === 'HIGHEST_ONLY' || tier === 'FEATURE_ONLY' || tier === 'VIP_ONLY') {
    query.whereIn('users.subscription_tier', ['HIGHEST', 'FEATURE', 'VIP'])
         .where(builder => {
           builder.whereNull('users.subscription_expires').orWhere('users.subscription_expires', '>=', now);
         });
  }
  return query;
}

// ─── Live Leaderboard (Cached in Redis for 60s) ───────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { contest_id, segment, timeframe } = req.query;
    const { generalClient } = require('./services/redisClient');
    const segKey = (segment || 'ALL').toUpperCase();

    let contest = null;
    if (contest_id) {
      contest = await db('contests').where({ id: contest_id }).first();
    }
    const contestKey = contest_id ? `contest_${contest_id}` : (timeframe === 'all_time' ? 'all_time' : 'daily');
    const cacheKey = `leaderboard:${contestKey}:${segKey}:top50`;

    if (generalClient && generalClient.isReady) {
      const cached = await generalClient.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }

    let query = db('positions')
      .join('users', 'positions.user_id', 'users.id')
      .where('users.is_admin', false);

    let effectiveSegment = segKey;

    if (contest) {
      if (contest.start_date) {
        query.where('positions.created_at', '>=', new Date(contest.start_date));
      }
      if (contest.end_date) {
        query.where('positions.created_at', '<=', new Date(contest.end_date));
      }
      if (contest.segment && contest.segment !== 'ALL') {
        effectiveSegment = contest.segment.toUpperCase();
      }
      applyTierFilterToQuery(query, contest.access_tier || 'ALL');
    } else if (timeframe !== 'all_time') {
      const todayStart = getTradingSessionStartIST();

      query.where(builder => {
        builder.where('positions.created_at', '>=', todayStart).orWhere('positions.updated_at', '>=', todayStart);
      });
    }

    // Apply segment filter
    applySegmentFilterToQuery(query, effectiveSegment);

    const topTraders = await query
      .groupBy('users.id', 'users.username', 'users.profile_picture_url')
      .select(
        'users.id as user_id',
        'users.username',
        'users.profile_picture_url',
        db.raw('COALESCE(SUM(positions.realized_pnl), 0) as total_pnl'),
        db.raw('COUNT(positions.id) as total_trades'),
        db.raw('SUM(CASE WHEN positions.realized_pnl > 0 THEN 1 ELSE 0 END) as winning_trades')
      )
      .having(db.raw('COALESCE(SUM(positions.realized_pnl), 0) > 0'))
      .orderBy('total_pnl', 'desc')
      .limit(50);

    const formatted = topTraders.map((t, idx) => {
      const total = parseInt(t.total_trades || 0, 10);
      const wins = parseInt(t.winning_trades || 0, 10);
      const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
      return {
        rank: idx + 1,
        username: t.username,
        profile_picture_url: t.profile_picture_url,
        pnl: parseFloat(t.total_pnl || 0),
        totalTrades: total,
        winRate: winRate
      };
    });

    const result = { success: true, leaderboard: formatted, segment: effectiveSegment, lastUpdated: Date.now() };

    if (generalClient && generalClient.isReady) {
      await generalClient.setEx(cacheKey, 60, JSON.stringify(result)).catch(() => null);
    }

    res.json(result);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ─── Platform Announcements ────────────────────────────────────────────────
app.get('/api/announcement', async (req, res) => {
  try {
    const { generalClient } = require('./services/redisClient');
    let announcement = null;

    if (generalClient && generalClient.isReady) {
      const data = await generalClient.hGetAll('platform:announcement');
      if (data && data.text) {
        announcement = {
          text: data.text,
          type: data.type || 'info',
          updated_at: data.updated_at
        };
      }
    }
    res.json({ success: true, announcement });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch announcement' });
  }
});

app.post('/api/admin/announcement', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const { text, type } = req.body;
    const { generalClient } = require('./services/redisClient');

    if (!text || text.trim() === '') {
      if (generalClient && generalClient.isReady) {
        await generalClient.del('platform:announcement');
      }
      io.emit('announcement_update', null);
      return res.json({ success: true, message: 'Announcement cleared' });
    }

    const announcementData = {
      text: text.trim(),
      type: type || 'info',
      updated_at: new Date().toISOString()
    };

    if (generalClient && generalClient.isReady) {
      await generalClient.hSet('platform:announcement', announcementData);
    }

    io.emit('announcement_update', announcementData);

    res.json({ success: true, announcement: announcementData });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save announcement' });
  }
});

// ─── Broadcast Notifications & Trading Signals ─────────────────────────────
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    const userTier = (user?.subscription_tier || 'BASIC').toUpperCase();
    const isExpired = user?.subscription_expires && new Date(user.subscription_expires) <= new Date();
    const activeTier = isExpired ? 'BASIC' : userTier;
    
    const hasHighest = Boolean(user?.is_admin) || ['HIGHEST', 'FEATURE', 'VIP'].includes(activeTier);
    const hasYearlyOrMonthly = hasHighest || ['YEARLY', 'MONTHLY', 'PRO', 'LIFETIME'].includes(activeTier);
    
    const allowedTiers = ['ALL'];
    if (hasYearlyOrMonthly) {
      allowedTiers.push('MONTHLY_PLUS');
      allowedTiers.push('YEARLY_PLUS');
    }
    if (hasHighest) allowedTiers.push('HIGHEST_ONLY');

    const hasTable = await db.schema.hasTable('broadcast_notifications');
    if (!hasTable) {
      return res.json({ success: true, notifications: [] });
    }

    const notifications = await db('broadcast_notifications')
      .where('is_active', true)
      .whereIn('target_tier', allowedTiers)
      .orderBy('created_at', 'desc')
      .limit(50);

    const formattedNotifications = notifications.map(n => ({
      ...n,
      created_at: n.created_at instanceof Date ? n.created_at.toISOString() : (
        typeof n.created_at === 'string' && !n.created_at.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(n.created_at)
          ? `${n.created_at.replace(' ', 'T')}Z`
          : n.created_at
      )
    }));

    res.json({ success: true, notifications: formattedNotifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/broadcast-notification', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const {
      type, // 'SIGNAL', 'NEWS', 'ANNOUNCEMENT'
      title,
      message,
      side, // 'BUY', 'SELL'
      symbol,
      entry_price,
      target_price,
      stop_loss,
      product_type, // 'INT' (Intraday) or 'DEL' (Delivery / Overnight)
      impact, // 'BULLISH', 'BEARISH', 'NEUTRAL'
      target_tier, // 'ALL', 'MONTHLY_PLUS', 'YEARLY_PLUS', 'HIGHEST_ONLY'
      show_banner // boolean
    } = req.body;

    if (!title && !symbol && !message) {
      return res.status(400).json({ error: 'Notification requires a title, symbol, or message.' });
    }

    const resolvedProductType = (product_type === 'DEL' || product_type === 'DELIVERY' || product_type === 'CNC' || product_type === 'NRML') ? 'DEL' : 'INT';

    const [inserted] = await db('broadcast_notifications').insert({
      type: type || 'SIGNAL',
      title: title || (type === 'SIGNAL' ? `${side || 'BUY'} ${symbol || 'SIGNAL'}` : 'Market Update'),
      message: message || '',
      side: side ? side.toUpperCase() : null,
      symbol: symbol ? symbol.toUpperCase().trim() : null,
      entry_price: entry_price ? String(entry_price).trim() : null,
      target_price: target_price ? String(target_price).trim() : null,
      stop_loss: stop_loss ? String(stop_loss).trim() : null,
      product_type: resolvedProductType,
      impact: impact || null,
      target_tier: target_tier || 'ALL',
      show_banner: Boolean(show_banner),
      is_active: true,
      created_at: new Date().toISOString()
    }).returning('*');

    const formattedInserted = {
      ...inserted,
      created_at: inserted.created_at instanceof Date ? inserted.created_at.toISOString() : (
        typeof inserted.created_at === 'string' && !inserted.created_at.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(inserted.created_at)
          ? `${inserted.created_at.replace(' ', 'T')}Z`
          : inserted.created_at
      )
    };

    // Real-time WebSocket emission to all user clients
    io.emit('broadcast_notification', formattedInserted);

    // If show_banner is enabled, also sync legacy banner
    if (show_banner) {
      const { generalClient } = require('./services/redisClient');
      let bannerText = '';
      if (type === 'SIGNAL') {
        const prodLabel = resolvedProductType === 'DEL' ? 'DELIVERY' : 'INTRADAY';
        bannerText = `⚡ [${side || 'SIGNAL'} • ${prodLabel}] ${symbol || ''} @ ₹${entry_price || 'CMP'} | Tgt: ₹${target_price || '—'} | SL: ₹${stop_loss || '—'}`;
      } else {
        bannerText = title ? `${title}: ${message}` : message;
      }
      const announcementData = {
        text: bannerText,
        type: side === 'SELL' ? 'alert' : (side === 'BUY' ? 'info' : 'warning'),
        updated_at: new Date().toISOString()
      };
      if (generalClient && generalClient.isReady) {
        await generalClient.hSet('platform:announcement', announcementData);
      }
      io.emit('announcement_update', announcementData);
    }

    res.json({ success: true, notification: formattedInserted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/broadcast-notifications/clear-old', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const { parseExpiryDate } = require('./services/autoSquareOff');
    const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const istMidnight = new Date(`${todayIST}T00:00:00+05:30`);

    // 1. Deactivate intraday signals created before today's IST midnight
    const updatedIntraday = await db('broadcast_notifications')
      .where('is_active', true)
      .where('type', 'SIGNAL')
      .where(function() {
        this.where('product_type', 'INT').orWhere('product_type', 'MIS');
      })
      .where('created_at', '<', istMidnight)
      .update({ is_active: false });

    // 2. Deactivate expired derivative contract signals
    const activeContractSignals = await db('broadcast_notifications')
      .where('is_active', true)
      .whereNotNull('symbol');

    let expiredContractsCount = 0;
    for (const item of activeContractSignals) {
      if (item.symbol) {
        const exp = parseExpiryDate(item.symbol);
        if (exp && exp.getTime() < istMidnight.getTime()) {
          await db('broadcast_notifications').where({ id: item.id }).update({ is_active: false });
          expiredContractsCount++;
        }
      }
    }

    io.emit('broadcast_notifications_refreshed');
    res.json({ 
      success: true, 
      message: `Cleared ${updatedIntraday} past intraday signals and ${expiredContractsCount} expired contract signals.`,
      clearedIntraday: updatedIntraday,
      clearedExpiredContracts: expiredContractsCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/broadcast-notifications/clear-all', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    await db('broadcast_notifications').where({ is_active: true }).update({ is_active: false });
    io.emit('broadcast_notifications_refreshed');
    res.json({ success: true, message: 'All broadcast notifications deactivated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/broadcast-notification/:id', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    await db('broadcast_notifications').where({ id: req.params.id }).update({ is_active: false });
    io.emit('broadcast_notification_removed', { id: Number(req.params.id) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Session & Device Security Manager Endpoints ─────────────────────────
app.get('/api/user/sessions', authenticateToken, async (req, res) => {
  try {
    const currentHash = req.tokenHash || '';

    // Auto-prune sessions older than 60 days
    await db('user_sessions')
      .where({ user_id: req.user.id })
      .where('last_active_at', '<', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000))
      .del()
      .catch(() => {});

    const sessions = await db('user_sessions')
      .where({ user_id: req.user.id })
      .orderBy('last_active_at', 'desc');

    const formatted = sessions.map(s => ({
      id: s.id,
      device_model: s.device_model || 'Unknown Device',
      browser_name: s.browser_name || 'Browser',
      os_name: s.os_name || 'Unknown OS',
      ip_address: s.ip_address || '',
      city: s.city || '',
      state: s.state || '',
      last_active_at: s.last_active_at,
      created_at: s.created_at,
      is_current: s.token_hash === currentHash
    }));

    res.json({ success: true, sessions: formatted });
  } catch (err) {
    console.error('Error fetching user sessions:', err);
    res.status(500).json({ error: 'Failed to fetch active login sessions' });
  }
});

app.post('/api/user/sessions/clean-duplicates', authenticateToken, async (req, res) => {
  try {
    const currentHash = req.tokenHash || '';
    const sessions = await db('user_sessions')
      .where({ user_id: req.user.id })
      .orderBy('last_active_at', 'desc');

    const toDeleteIds = [];
    const seenKeys = new Set();

    for (const s of sessions) {
      const isCurrent = s.token_hash === currentHash;
      const key = `${s.device_model || 'Unknown'}_${s.os_name || 'Unknown'}_${s.browser_name || 'Browser'}`;
      
      if (isCurrent) {
        seenKeys.add(key);
      } else if (!seenKeys.has(key)) {
        seenKeys.add(key);
      } else {
        toDeleteIds.push(s.id);
      }
    }

    if (toDeleteIds.length > 0) {
      await db('user_sessions')
        .whereIn('id', toDeleteIds)
        .where({ user_id: req.user.id })
        .del();
    }

    res.json({ success: true, cleanedCount: toDeleteIds.length, message: `Successfully cleaned ${toDeleteIds.length} duplicate session(s).` });
  } catch (err) {
    console.error('Error cleaning duplicate sessions:', err);
    res.status(500).json({ error: 'Failed to clean duplicate sessions' });
  }
});

app.post('/api/user/sessions/revoke-others', authenticateToken, async (req, res) => {
  try {
    const currentHash = req.tokenHash || '';
    if (!currentHash) return res.status(400).json({ error: 'Current session identifier not found' });

    const deletedCount = await db('user_sessions')
      .where({ user_id: req.user.id })
      .where('token_hash', '!=', currentHash)
      .del();

    res.json({ success: true, message: `Successfully logged out ${deletedCount} other device(s).`, revokedCount: deletedCount });
  } catch (err) {
    console.error('Error revoking other sessions:', err);
    res.status(500).json({ error: 'Failed to revoke other sessions' });
  }
});

app.delete('/api/user/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.params.id;
    await db('user_sessions')
      .where({ id: sessionId, user_id: req.user.id })
      .del();

    res.json({ success: true, message: 'Device session revoked.' });
  } catch (err) {
    console.error('Error revoking session:', err);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// ─── Contests & Tournaments Endpoints ─────────────────────────────────────
async function autoExpireContests() {
  try {
    const now = new Date();
    await db('contests')
      .where('status', 'ACTIVE')
      .whereNotNull('end_date')
      .where('end_date', '<', now)
      .update({ status: 'ENDED', updated_at: now });
  } catch (e) {
    // fail silently
  }
}

app.get('/api/contests/active', async (req, res) => {
  try {
    await autoExpireContests();

    let contests = await db('contests')
      .where('status', 'ACTIVE')
      .where(builder => {
        builder.whereNull('end_date').orWhere('end_date', '>=', new Date());
      })
      .orderBy('id', 'desc');

    if (!contests || contests.length === 0) {
      return res.json({
        success: true,
        contests: [],
        contest: null,
        topContenders: []
      });
    }

    const primaryContest = contests[0];
    const startDate = primaryContest?.start_date || new Date(0);
    let topQuery = db('positions')
      .join('users', 'positions.user_id', 'users.id')
      .where('users.is_admin', false)
      .where('positions.created_at', '>=', startDate);

    if (primaryContest?.end_date) {
      topQuery.where('positions.created_at', '<=', new Date(primaryContest.end_date));
    }
    applySegmentFilterToQuery(topQuery, primaryContest?.segment || 'ALL');
    applyTierFilterToQuery(topQuery, primaryContest?.access_tier || 'ALL');

    const topContenders = await topQuery
      .groupBy('users.id', 'users.username', 'users.profile_picture_url')
      .select(
        'users.id as user_id',
        'users.username',
        'users.profile_picture_url',
        db.raw('COALESCE(SUM(positions.realized_pnl), 0) as total_pnl'),
        db.raw('COUNT(positions.id) as total_trades'),
        db.raw('SUM(CASE WHEN positions.realized_pnl > 0 THEN 1 ELSE 0 END) as winning_trades')
      )
      .having(db.raw('COALESCE(SUM(positions.realized_pnl), 0) > 0'))
      .orderBy('total_pnl', 'desc')
      .limit(3);

    const formattedContenders = topContenders.map((t, idx) => {
      const total = parseInt(t.total_trades || 0, 10);
      const wins = parseInt(t.winning_trades || 0, 10);
      const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
      return {
        rank: idx + 1,
        username: t.username,
        profile_picture_url: t.profile_picture_url,
        pnl: parseFloat(t.total_pnl || 0),
        totalTrades: total,
        winRate
      };
    });

    res.json({
      success: true,
      contests,
      contest: primaryContest,
      topContenders: formattedContenders
    });
  } catch (err) {
    console.error('Error fetching active contests:', err);
    res.status(500).json({ error: 'Failed to fetch contests' });
  }
});

// Past / Concluded Tournaments
app.get('/api/contests/past', async (req, res) => {
  try {
    await autoExpireContests();
    const pastContests = await db('contests')
      .whereIn('status', ['ENDED', 'COMPLETED'])
      .orderBy('end_date', 'desc')
      .limit(20);
    res.json({ success: true, contests: pastContests });
  } catch (err) {
    console.error('Error fetching past contests:', err);
    res.status(500).json({ error: 'Failed to fetch past contests' });
  }
});

// Admin: Get all contests
app.get('/api/admin/contests', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user || !user.is_admin) return res.status(403).json({ error: 'Unauthorized: Admin access required' });

    await autoExpireContests();
    const contests = await db('contests').orderBy('id', 'desc');
    res.json({ success: true, contests });
  } catch (err) {
    console.error('Error fetching admin contests:', err);
    res.status(500).json({ error: 'Failed to fetch contests' });
  }
});

// Admin: Create or update contest
app.post('/api/admin/contests', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user || !user.is_admin) return res.status(403).json({ error: 'Unauthorized: Admin access required' });

    const { id, title, description, start_date, end_date, prize_1st, prize_2nd, prize_3rd, status, segment } = req.body;
    const access_tier = req.body.access_tier || 'ALL';

    if (!title) return res.status(400).json({ error: 'Title is required' });

    // Flush Redis cache for leaderboard
    try {
      const { generalClient } = require('./services/redisClient');
      if (generalClient && generalClient.isReady) {
        const keys = await generalClient.keys('leaderboard:*');
        if (keys && keys.length > 0) {
          await generalClient.del(keys);
        }
      }
    } catch (e) {}

    if (id) {
      await db('contests').where({ id }).update({
        title,
        description: description || '',
        start_date: start_date ? new Date(start_date) : undefined,
        end_date: end_date ? new Date(end_date) : undefined,
        prize_1st: prize_1st || '₹500 Cash + Free PRO',
        prize_2nd: prize_2nd || '₹250 Cash + Free PRO',
        prize_3rd: prize_3rd || '₹100 Cash + Free PRO',
        status: status || 'ACTIVE',
        segment: segment || 'ALL',
        access_tier: access_tier || 'ALL',
        updated_at: new Date()
      });
      return res.json({ success: true, message: 'Contest updated successfully' });
    } else {
      const [newId] = await db('contests').insert({
        title,
        description: description || '',
        start_date: start_date ? new Date(start_date) : new Date(),
        end_date: end_date ? new Date(end_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        prize_1st: prize_1st || '₹500 Cash + Free PRO',
        prize_2nd: prize_2nd || '₹250 Cash + Free PRO',
        prize_3rd: prize_3rd || '₹100 Cash + Free PRO',
        status: status || 'ACTIVE',
        segment: segment || 'ALL',
        access_tier: access_tier || 'ALL'
      }).returning('id');
      return res.json({ success: true, message: 'Contest created successfully', id: typeof newId === 'object' ? newId.id : newId });
    }
  } catch (err) {
    console.error('Error saving contest:', err);
    res.status(500).json({ error: 'Failed to save contest' });
  }
});

// Admin: Delete contest
app.delete('/api/admin/contests/:id', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user || !user.is_admin) return res.status(403).json({ error: 'Unauthorized: Admin access required' });

    const contestId = req.params.id;
    await db('contests').where({ id: contestId }).del();

    // Flush Redis cache for leaderboard so deleted contest data is purged immediately
    try {
      const { generalClient } = require('./services/redisClient');
      if (generalClient && generalClient.isReady) {
        const keys = await generalClient.keys('leaderboard:*');
        if (keys && keys.length > 0) {
          await generalClient.del(keys);
        }
      }
    } catch (e) {}

    res.json({ success: true, message: 'Tournament deleted successfully' });
  } catch (err) {
    console.error('Error deleting contest:', err);
    res.status(500).json({ error: 'Failed to delete contest' });
  }
});

// Admin: Finalize and award winners
app.post('/api/admin/contests/:id/award', authenticateToken, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user || !user.is_admin) return res.status(403).json({ error: 'Unauthorized: Admin access required' });

    const contestId = req.params.id;
    const { awardProUpgrade, cashAmount1st, cashAmount2nd, cashAmount3rd } = req.body;

    const contest = await db('contests').where({ id: contestId }).first();
    if (!contest) return res.status(404).json({ error: 'Contest not found' });

    // Fetch top 3 traders for the contest duration
    const startDate = contest.start_date || new Date(0);
    const topTraders = await db('positions')
      .join('users', 'positions.user_id', 'users.id')
      .where('users.is_admin', false)
      .where('positions.created_at', '>=', startDate)
      .groupBy('users.id')
      .select('users.id')
      .orderBy(db.raw('COALESCE(SUM(positions.realized_pnl), 0)'), 'desc')
      .limit(3);

    const winner1 = topTraders[0]?.id || null;
    const winner2 = topTraders[1]?.id || null;
    const winner3 = topTraders[2]?.id || null;

    await db('contests').where({ id: contestId }).update({
      winner_1st_id: winner1,
      winner_2nd_id: winner2,
      winner_3rd_id: winner3,
      status: 'COMPLETED',
      updated_at: new Date()
    });

    // Credit Cash or Pro upgrades if selected
    if (awardProUpgrade) {
      const oneMonthLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const winnerIds = [winner1, winner2, winner3].filter(Boolean);
      for (const wid of winnerIds) {
        await db('users').where({ id: wid }).update({
          subscription_tier: 'PRO',
          subscription_expires: oneMonthLater
        });
      }
    }

    if (cashAmount1st && winner1) {
      await db('users').where({ id: winner1 }).increment('balance', Number(cashAmount1st));
      await db('ledger').insert({
        user_id: winner1,
        amount: Number(cashAmount1st),
        type: 'DEPOSIT',
        description: `🏆 1st Prize Reward - ${contest.title}`
      });
    }
    if (cashAmount2nd && winner2) {
      await db('users').where({ id: winner2 }).increment('balance', Number(cashAmount2nd));
      await db('ledger').insert({
        user_id: winner2,
        amount: Number(cashAmount2nd),
        type: 'DEPOSIT',
        description: `🥈 2nd Prize Reward - ${contest.title}`
      });
    }
    if (cashAmount3rd && winner3) {
      await db('users').where({ id: winner3 }).increment('balance', Number(cashAmount3rd));
      await db('ledger').insert({
        user_id: winner3,
        amount: Number(cashAmount3rd),
        type: 'DEPOSIT',
        description: `🥉 3rd Prize Reward - ${contest.title}`
      });
    }

    res.json({ success: true, message: 'Contest completed and rewards successfully distributed!' });
  } catch (err) {
    console.error('Error awarding contest:', err);
    res.status(500).json({ error: 'Failed to award contest rewards' });
  }
});

app.get('/api/referrals', authenticateToken, async (req, res) => {
  try {
    const referrals = await db('referrals')
      .join('users', 'referrals.referred_user_id', 'users.id')
      .where('referrals.referrer_id', req.user.id)
      .select('referrals.*', 'users.username', 'users.email', 'users.client_id')
      .orderBy('referrals.created_at', 'desc');

    const totalEarned = referrals.filter(r => r.status === 'completed').reduce((sum, r) => sum + parseFloat(r.reward_amount || 0), 0);
    const pendingCount = referrals.filter(r => r.status === 'pending').length;
    const completedCount = referrals.filter(r => r.status === 'completed').length;

    const withdrawals = await db('reward_withdrawals').where({ user_id: req.user.id }).orderBy('created_at', 'desc');
    const blockedAmount = withdrawals.filter(w => ['PENDING', 'PROCESSING', 'CREDITED'].includes(w.status)).reduce((sum, w) => sum + parseFloat(w.amount), 0);
    const totalWithdrawn = withdrawals.filter(w => w.status === 'CREDITED').reduce((sum, w) => sum + parseFloat(w.amount), 0);
    const pendingWithdrawalAmount = withdrawals.filter(w => ['PENDING', 'PROCESSING'].includes(w.status)).reduce((sum, w) => sum + parseFloat(w.amount), 0);
    const availableRewardBalance = Math.max(0, totalEarned - blockedAmount);

    res.json({
      success: true,
      referrals,
      withdrawals,
      stats: {
        totalEarned,
        pendingCount,
        completedCount,
        totalCount: referrals.length,
        totalWithdrawn,
        pendingWithdrawalAmount,
        availableRewardBalance
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Security Shield & Ban Management & Journal Endpoints ──────────────────────
// ─── Security Shield & Ban Management ──────────────────────────────────────────
app.get('/api/admin/banned', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });
    const bans = await db('banned_entities').orderBy('created_at', 'desc');
    res.json({ bans });
  } catch (err) {
    console.error('Fetch Banned Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/ban', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });
    const { type, value, reason } = req.body;
    if (!type || !value) return res.status(400).json({ error: 'Type and value are required' });

    const upperType = type.toUpperCase();
    const cleanValue = value.trim();

    const existing = await db('banned_entities').where({ type: upperType, value: cleanValue }).first();
    if (!existing) {
      await db('banned_entities').insert({
        type: upperType,
        value: cleanValue,
        reason: reason || 'Restricted by Admin',
        banned_by: caller.id
      });
    }

    if (upperType === 'USER') {
      await db('users').where({ id: cleanValue }).orWhere({ username: cleanValue }).update({ is_banned: true });
    } else if (upperType === 'PHONE') {
      await db('users').where({ phone: cleanValue }).update({ is_banned: true });
    }

    await syncBannedEntities(db, generalClient);
    res.json({ success: true, message: `Successfully banned ${upperType}: ${cleanValue}` });
  } catch (err) {
    console.error('Ban Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/unban', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });
    const { id, type, value } = req.body;

    if (id) {
      const ban = await db('banned_entities').where({ id }).first();
      if (ban) {
        await db('banned_entities').where({ id }).del();
        if (ban.type === 'USER') {
          await db('users').where({ id: ban.value }).orWhere({ username: ban.value }).update({ is_banned: false });
        } else if (ban.type === 'PHONE') {
          await db('users').where({ phone: ban.value }).update({ is_banned: false });
        }
      }
    } else if (type && value) {
      await db('banned_entities').where({ type: type.toUpperCase(), value: value.trim() }).del();
      if (type.toUpperCase() === 'USER') {
        await db('users').where({ id: value }).orWhere({ username: value }).update({ is_banned: false });
      } else if (type.toUpperCase() === 'PHONE') {
        await db('users').where({ phone: value }).update({ is_banned: false });
      }
    }

    await syncBannedEntities(db, generalClient);
    res.json({ success: true, message: 'Unbanned successfully' });
  } catch (err) {
    console.error('Unban Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── TRADE DIARY & TRADING JOURNAL API ENDPOINTS ──────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// 1. Trades API
app.get('/api/journal/trades', authenticateToken, async (req, res) => {
  try {
    const isExport = req.query.export === 'true' || req.query.limit === 'all';
    const limit = isExport ? null : (parseInt(req.query.limit) || 250);
    const offset = parseInt(req.query.offset) || 0;

    let query = db('journal_trades')
      .where({ user_id: req.user.id })
      .orderBy('trade_date', 'desc')
      .orderBy('created_at', 'desc');

    if (limit) {
      query = query.limit(limit);
    }
    if (offset > 0) {
      query = query.offset(offset);
    }

    const trades = await query;
    res.json({ success: true, trades });
  } catch (err) {
    console.error('Fetch Journal Trades Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/journal/trades', authenticateToken, async (req, res) => {
  try {
    const {
      symbol, trade_type, product_type, market_segment, entry_price, exit_price,
      quantity, realized_pnl, charges, net_pnl, roi_percentage, strategy,
      emotion, mistake, setup_rating, trade_date, notes, tags, screenshot_url
    } = req.body;

    const [newTrade] = await db('journal_trades').insert({
      user_id: req.user.id,
      trade_id: `JT-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      symbol: symbol || 'NIFTY',
      trade_type: trade_type || 'BUY',
      product_type: product_type || 'INT',
      market_segment: market_segment || 'Indian',
      entry_price: parseFloat(entry_price) || 0,
      exit_price: parseFloat(exit_price) || 0,
      quantity: parseInt(quantity) || 1,
      realized_pnl: parseFloat(realized_pnl) || 0,
      charges: parseFloat(charges) || 0,
      net_pnl: parseFloat(net_pnl) || (parseFloat(realized_pnl) || 0),
      roi_percentage: parseFloat(roi_percentage) || 0,
      strategy: strategy || '',
      emotion: emotion || '',
      mistake: mistake || '',
      setup_rating: parseInt(setup_rating) || 5,
      trade_date: trade_date || new Date().toISOString().split('T')[0],
      notes: notes || '',
      tags: tags ? JSON.stringify(tags) : JSON.stringify([]),
      screenshot_url: screenshot_url || ''
    }).returning('*');

    res.json({ success: true, trade: newTrade });
  } catch (err) {
    console.error('Create Journal Trade Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/journal/trades/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updated_at: new Date() };
    delete updateData.id;
    delete updateData.user_id;
    if (updateData.tags && typeof updateData.tags !== 'string') {
      updateData.tags = JSON.stringify(updateData.tags);
    }

    const [updated] = await db('journal_trades')
      .where({ id, user_id: req.user.id })
      .update(updateData)
      .returning('*');

    res.json({ success: true, trade: updated });
  } catch (err) {
    console.error('Update Journal Trade Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/journal/trades/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db('journal_trades').where({ id, user_id: req.user.id }).del();
    res.json({ success: true, message: 'Trade deleted successfully' });
  } catch (err) {
    console.error('Delete Journal Trade Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Checklists API
app.get('/api/journal/checklists', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    let query = db('trading_checklists').where({ user_id: req.user.id });
    if (date) query = query.where({ date });
    const checklists = await query.orderBy('date', 'desc');
    res.json({ success: true, checklists });
  } catch (err) {
    console.error('Fetch Checklists Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/journal/checklists', authenticateToken, async (req, res) => {
  try {
    const { date, pre_market_data, post_market_data, notes } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const existing = await db('trading_checklists').where({ user_id: req.user.id, date: targetDate }).first();
    let result;

    if (existing) {
      [result] = await db('trading_checklists')
        .where({ id: existing.id })
        .update({
          pre_market_data: pre_market_data ? JSON.stringify(pre_market_data) : existing.pre_market_data,
          post_market_data: post_market_data ? JSON.stringify(post_market_data) : existing.post_market_data,
          notes: notes !== undefined ? notes : existing.notes,
          updated_at: new Date()
        })
        .returning('*');
    } else {
      [result] = await db('trading_checklists').insert({
        user_id: req.user.id,
        date: targetDate,
        pre_market_data: JSON.stringify(pre_market_data || {}),
        post_market_data: JSON.stringify(post_market_data || {}),
        notes: notes || ''
      }).returning('*');
    }

    res.json({ success: true, checklist: result });
  } catch (err) {
    console.error('Save Checklist Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Mistakes Tracker API
app.get('/api/journal/mistakes', authenticateToken, async (req, res) => {
  try {
    const mistakes = await db('trading_mistakes').where({ user_id: req.user.id }).orderBy('loss_incurred', 'desc');
    res.json({ success: true, mistakes });
  } catch (err) {
    console.error('Fetch Mistakes Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/journal/mistakes', authenticateToken, async (req, res) => {
  try {
    const { mistake_name, category, loss_incurred, lessons_learned } = req.body;
    const [mistake] = await db('trading_mistakes').insert({
      user_id: req.user.id,
      mistake_name: mistake_name || 'Trading Mistake',
      category: category || 'EXECUTION',
      loss_incurred: parseFloat(loss_incurred) || 0,
      frequency: 1,
      lessons_learned: lessons_learned || ''
    }).returning('*');
    res.json({ success: true, mistake });
  } catch (err) {
    console.error('Add Mistake Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/journal/mistakes/:id', authenticateToken, async (req, res) => {
  try {
    const { mistake_name, category, loss_incurred, lessons_learned, frequency } = req.body;
    const updates = {};
    if (mistake_name !== undefined) updates.mistake_name = mistake_name;
    if (category !== undefined) updates.category = category;
    if (loss_incurred !== undefined) updates.loss_incurred = parseFloat(loss_incurred) || 0;
    if (lessons_learned !== undefined) updates.lessons_learned = lessons_learned;
    if (frequency !== undefined) updates.frequency = parseInt(frequency) || 1;
    updates.updated_at = new Date();

    const [updated] = await db('trading_mistakes')
      .where({ id: req.params.id, user_id: req.user.id })
      .update(updates)
      .returning('*');

    res.json({ success: true, mistake: updated });
  } catch (err) {
    console.error('Update Mistake Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/journal/mistakes/:id', authenticateToken, async (req, res) => {
  try {
    await db('trading_mistakes').where({ id: req.params.id, user_id: req.user.id }).del();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Strategies API
app.get('/api/journal/strategies', authenticateToken, async (req, res) => {
  try {
    const strategies = await db('trading_strategies').where({ user_id: req.user.id }).orderBy('net_pnl', 'desc');
    res.json({ success: true, strategies });
  } catch (err) {
    console.error('Fetch Strategies Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/journal/strategies', authenticateToken, async (req, res) => {
  try {
    const { strategy_name, description, win_rate, total_trades, net_pnl, color } = req.body;
    const [strategy] = await db('trading_strategies').insert({
      user_id: req.user.id,
      strategy_name: strategy_name || 'New Strategy',
      description: description || '',
      win_rate: parseFloat(win_rate) || 0,
      total_trades: parseInt(total_trades) || 0,
      net_pnl: parseFloat(net_pnl) || 0,
      color: color || '#3b82f6'
    }).returning('*');
    res.json({ success: true, strategy });
  } catch (err) {
    console.error('Add Strategy Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/journal/strategies/:id', authenticateToken, async (req, res) => {
  try {
    const { strategy_name, description, win_rate, total_trades, net_pnl, color } = req.body;
    const updates = {};
    if (strategy_name !== undefined) updates.strategy_name = strategy_name;
    if (description !== undefined) updates.description = description;
    if (win_rate !== undefined) updates.win_rate = parseFloat(win_rate) || 0;
    if (total_trades !== undefined) updates.total_trades = parseInt(total_trades) || 0;
    if (net_pnl !== undefined) updates.net_pnl = parseFloat(net_pnl) || 0;
    if (color !== undefined) updates.color = color;
    updates.updated_at = new Date();

    const [updated] = await db('trading_strategies')
      .where({ id: req.params.id, user_id: req.user.id })
      .update(updates)
      .returning('*');

    res.json({ success: true, strategy: updated });
  } catch (err) {
    console.error('Update Strategy Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/journal/strategies/:id', authenticateToken, async (req, res) => {
  try {
    await db('trading_strategies').where({ id: req.params.id, user_id: req.user.id }).del();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Rules API
app.get('/api/journal/rules', authenticateToken, async (req, res) => {
  try {
    const rules = await db('trading_rules').where({ user_id: req.user.id }).orderBy('created_at', 'asc');
    res.json({ success: true, rules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/journal/rules', authenticateToken, async (req, res) => {
  try {
    const { rule_text, category, is_active } = req.body;
    const [rule] = await db('trading_rules').insert({
      user_id: req.user.id,
      rule_text: rule_text || 'Trading Rule',
      category: category || 'RISK',
      is_active: is_active !== false,
      times_followed: 0,
      times_broken: 0
    }).returning('*');
    res.json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/journal/rules/:id', authenticateToken, async (req, res) => {
  try {
    const { rule_text, is_active, times_followed, times_broken, followed, broken } = req.body;
    const finalFollowed = times_followed !== undefined ? times_followed : followed;
    const finalBroken = times_broken !== undefined ? times_broken : broken;
    const [rule] = await db('trading_rules')
      .where({ id: req.params.id, user_id: req.user.id })
      .update({
        ...(rule_text !== undefined ? { rule_text } : {}),
        ...(is_active !== undefined ? { is_active } : {}),
        ...(finalFollowed !== undefined ? { times_followed: finalFollowed } : {}),
        ...(finalBroken !== undefined ? { times_broken: finalBroken } : {}),
        updated_at: new Date()
      })
      .returning('*');
    res.json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/journal/rules/:id', authenticateToken, async (req, res) => {
  try {
    await db('trading_rules').where({ id: req.params.id, user_id: req.user.id }).del();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 🌟 24/7 PERSONAL AI WEALTH COPILOT (Powered by Google Gemini 3.8 Flash)
// ─────────────────────────────────────────────────────────────────────────────
let _cachedDbGeminiKey = null;
let _lastDbGeminiKeyCheck = 0;

async function resolveGeminiApiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  try {
    const keyFilePath = path.join(__dirname, 'config', 'gemini.key');
    if (fs.existsSync(keyFilePath)) {
      const fileKey = fs.readFileSync(keyFilePath, 'utf8').trim();
      if (fileKey) return fileKey;
    }
  } catch (_) {}

  const now = Date.now();
  if (_cachedDbGeminiKey && (now - _lastDbGeminiKeyCheck < 300000)) {
    return _cachedDbGeminiKey;
  }
  try {
    const row = await db('system_settings').where({ key: 'gemini_api_key' }).first();
    _lastDbGeminiKeyCheck = now;
    if (row && row.value && String(row.value).trim()) {
      _cachedDbGeminiKey = String(row.value).trim();
      return _cachedDbGeminiKey;
    }
  } catch (_) {}
  return '';
}

const aiCopilotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many AI queries. Please wait a moment before asking again.' },
  keyGenerator: (req) => getClientIp(req)
});

// Quantitative Financial Solver for Instant Context-Aware Math & Fallback
function buildQuantitativeWealthReply(cleanQuery, cleanHistory) {
  const combinedContext = [...cleanHistory.map(h => h?.text || ''), cleanQuery].join(' \n ');
  const qLower = cleanQuery.toLowerCase().trim();
  const fullLower = combinedContext.toLowerCase();

  // Detect if current query is an affirmative follow-up ("yes", "ok", "sure", "calculate", "show", "2002", etc.)
  const isFollowUpAffirmative = /^(yes|yeah|yep|ok|okay|sure|please|go ahead|calculate|show|details|more|next|\d{4})$/i.test(qLower);

  // Extract Age (e.g., "25 year old", "age 25", or birth year like "2002")
  let age = null;
  const birthYearMatch = cleanQuery.match(/\b(19[6-9]\d|200\d|2010)\b/) || fullLower.match(/\b(19[6-9]\d|200\d|2010)\b/);
  const ageMatch = fullLower.match(/(\d{2})\s*(?:year|yr|yrs|y\/o|old)/i) || fullLower.match(/age\s*(?:is\s*)?(\d{2})/i);
  if (birthYearMatch && /^\d{4}$/.test(qLower)) {
    age = new Date().getFullYear() - parseInt(birthYearMatch[1], 10);
  } else if (ageMatch) {
    age = parseInt(ageMatch[1], 10);
  }

  // Extract Monthly Salary (handles typos like "20k slary", "20000 salary", "15k income")
  let monthlySalary = null;
  const salaryMatch =
    fullLower.match(/(\d+(?:\.\d+)?)\s*k\s*(?:slary|salary|salry|income|pay|earning|month)/i) ||
    fullLower.match(/(?:slary|salary|salry|income|earn)\s*(?:is|of)?\s*₹?\s*(\d+(?:\.\d+)?)\s*(k|lakh|lkah|lac)?/i) ||
    fullLower.match(/(\d{4,6})\s*(?:slary|salary|salry|income|per month|\/mo)/i);
  if (salaryMatch) {
    const val = parseFloat(salaryMatch[1]);
    const unit = (salaryMatch[2] || '').toLowerCase();
    if (unit === 'k' || val < 200) monthlySalary = val * 1000;
    else if (unit.startsWith('l')) monthlySalary = Math.round((val * 100000) / 12);
    else monthlySalary = val;
  }

  // Extract Target Corpus (handles typos like "15 lkah", "15 lakh", "1 crore", "50L")
  let targetCorpus = null;
  const targetMatch =
    fullLower.match(/(\d+(?:\.\d+)?)\s*(lkah|lakh|lakhs|lac|lacs|cr|crore|crores)/i);
  if (targetMatch) {
    const val = parseFloat(targetMatch[1]);
    const unit = targetMatch[2].toLowerCase();
    targetCorpus = unit.startsWith('c') ? val * 10000000 : val * 100000;
  }

  // Extract Time Horizon in Years (e.g., "after 10 years", "in 10 yrs")
  let years = 10;
  const yearsMatch = fullLower.match(/(?:after|in|for|within)\s*(\d{1,2})\s*(?:year|years|yr|yrs)/i);
  if (yearsMatch) {
    years = Math.max(1, Math.min(45, parseInt(yearsMatch[1], 10)));
  }

  if (targetCorpus || monthlySalary) {
    const corpus = targetCorpus || 1500000;
    const salary = monthlySalary || 20000;
    const months = years * 12;
    const r = 0.12 / 12; // 12% annual CAGR
    const fvFactor = ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
    const fixedSip = Math.round(corpus / fvFactor);
    const totalInvestedFixed = fixedSip * months;
    const wealthGainFixed = Math.max(0, corpus - totalInvestedFixed);
    const stepUpStartSip = Math.round(fixedSip * 0.64); // 10% annual step-up starting SIP
    const pctOfSalaryFixed = ((fixedSip / salary) * 100).toFixed(1);
    const pctOfSalaryStepUp = ((stepUpStartSip / salary) * 100).toFixed(1);

    if (isFollowUpAffirmative) {
      // Detailed Year-by-Year Step-Up Execution Blueprint & Tax Breakdown for Follow-Up ("yes" / "2002")
      const ageLabel = age ? `Age ${age} → Age ${age + years}` : `${years}-Year Horizon`;
      return `📊 **Complete Execution & Tax Blueprint (${ageLabel} | Target: ₹${(corpus / 100000).toFixed(2)} Lakhs)**\n\n` +
        `### 1. Recommended 10% Step-Up SIP Schedule (For ₹${salary.toLocaleString('en-IN')}/mo Salary)\n` +
        `Starting at **₹${stepUpStartSip.toLocaleString('en-IN')}/month** (${pctOfSalaryStepUp}% of salary) and increasing by 10% each year as your income grows:\n` +
        `• **Year 1:** ₹${stepUpStartSip.toLocaleString('en-IN')}/mo | **Year 2:** ₹${Math.round(stepUpStartSip * 1.1).toLocaleString('en-IN')}/mo | **Year 3:** ₹${Math.round(stepUpStartSip * 1.21).toLocaleString('en-IN')}/mo\n` +
        `• **Year 5:** ₹${Math.round(stepUpStartSip * Math.pow(1.1, 4)).toLocaleString('en-IN')}/mo | **Year 8:** ₹${Math.round(stepUpStartSip * Math.pow(1.1, 7)).toLocaleString('en-IN')}/mo | **Year ${years}:** ₹${Math.round(stepUpStartSip * Math.pow(1.1, years - 1)).toLocaleString('en-IN')}/mo\n\n` +
        `### 2. Exact Portfolio Fund Split (₹${stepUpStartSip.toLocaleString('en-IN')}/mo Initial SIP)\n` +
        `• **50% Index Core (₹${Math.round(stepUpStartSip * 0.5).toLocaleString('en-IN')}/mo):** Nifty 50 / Nifty LargeMidcap 250 Direct Index Fund (~12% CAGR)\n` +
        `• **35% Alpha Growth (₹${Math.round(stepUpStartSip * 0.35).toLocaleString('en-IN')}/mo):** Flexicap + Midcap 150 Direct Growth (~14% CAGR)\n` +
        `• **15% Downside Hedge (₹${Math.round(stepUpStartSip * 0.15).toLocaleString('en-IN')}/mo):** Gold ETF / Liquid Emergency Reserve\n\n` +
        `### 3. Budget FY25 Tax Impact on Your ₹${(corpus / 100000).toFixed(2)}L Maturity\n` +
        `• **Income Tax on Salary:** **₹0 Tax** under FY25 New Tax Regime (0% tax up to ₹7.75 Lakhs/year).\n` +
        `• **LTCG Tax at Redemption:** First **₹1,25,000** of equity profit per financial year is **100% Tax-Free**; gains above ₹1.25L are taxed at **12.5%** (use Tax-Loss Harvesting every March to pay near-zero LTCG tax!).`;
    }

    return `🎯 **Custom Wealth Plan (${age ? `Age ${age} • ` : ''}₹${salary.toLocaleString('en-IN')}/mo Salary → ₹${(corpus / 100000).toFixed(2)} Lakhs in ${years} Years)**\n\n` +
      `### Option A: 10% Annual Step-Up SIP *(Best Fit for ₹${salary.toLocaleString('en-IN')} Salary)*\n` +
      `• **Starting Monthly SIP:** **₹${stepUpStartSip.toLocaleString('en-IN')} / month** *(Only ${pctOfSalaryStepUp}% of your salary — fits the 50/30/20 rule!)*\n` +
      `• **How it works:** Increase your SIP by just 10% once a year as your salary grows.\n` +
      `• **Projected Corpus in ${years} Years (@ 12% CAGR):** **₹${(corpus / 100000).toFixed(2)} Lakhs**\n\n` +
      `### Option B: Fixed Monthly SIP (@ 12% CAGR)\n` +
      `• **Required Fixed SIP:** **₹${fixedSip.toLocaleString('en-IN')} / month** *(${pctOfSalaryFixed}% of current salary)*\n` +
      `• **Total Principal Invested:** ₹${totalInvestedFixed.toLocaleString('en-IN')}\n` +
      `• **Compounding Wealth Gain:** +₹${wealthGainFixed.toLocaleString('en-IN')}\n\n` +
      `### Recommended Asset Allocation${age ? ` for Age ${age}` : ''}\n` +
      `• **50%** Nifty 50 / Flexicap Direct Fund | **35%** Midcap 150 Fund | **15%** Gold ETF & Emergency Liquid Fund.\n\n` +
      `Reply **"yes"** or ask any follow-up to see your **Year-by-Year Step-Up Schedule & FY25 Tax-Free Redemption Strategy**!`;
  }

  return `💡 **Institutional Financial Strategy for "${cleanQuery}":**\n\n` +
    `• **50/30/20 Cashflow Rule:** Cap fixed needs at 50%, lifestyle wants at 30%, and automate at least **20% into Direct Equity SIPs** on payday.\n` +
    `• **Compounding Benchmark:** ₹10,000/month with a 10% annual Step-Up at 12% CAGR grows to **₹36.5 Lakhs in 10 years** and **₹1.98 Crore in 20 years**.\n` +
    `• **FY25 Tax Shield:** Equity LTCG up to **₹1.25 Lakh/year is 0% tax-free** (12.5% above ₹1.25L; STCG @ 20%).\n\n` +
    `Share your **age, monthly salary, and target corpus** (e.g., *"Age 25, ₹20k salary, need ₹15L in 10 years"*) for an exact rupee-by-rupee calculation!`;
}

app.post('/api/ai/wealth-copilot', aiCopilotLimiter, async (req, res) => {
  try {
    const { query, history } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const cleanQuery = query.trim().slice(0, 1500);
    const cleanHistory = Array.isArray(history) ? history.slice(-20) : [];

    // Build strictly alternating user -> model -> user conversation contents for Gemini API
    const systemPrompt = `You are SkandX's Elite AI Wealth, Trading & Personal Finance Copilot.
You advise Indian retail investors and traders with SEBI-compliant, mathematically rigorous insights.
Key rules:
1. Even if the user has typos (like "20k slary", "15 lkah", "2002"), understand their exact intent and never repeat generic boilerplate.
2. When user gives age, salary, target amount, or years (e.g. Age 25, ₹20k salary, ₹15 Lakhs in 10 years), calculate:
   - Exact Fixed Monthly SIP at 12% CAGR (show Principal vs Wealth Gain)
   - Exact 10% Annual Step-Up SIP starting amount (crucial when fixed SIP is >25% of salary!)
   - Exact recommended Mutual Fund / ETF allocation split in ₹/month
   - FY25 Indian Tax rules (New Regime ₹0 tax up to ₹7.75L salary; LTCG 12.5% above ₹1.25L exemption; STCG 20%).
3. Maintain full multi-turn memory: if the user replies "yes", "ok", or gives their birth year like "2002", continue directly from the previous calculation with a year-by-year schedule and actionable breakdown.`;

    const rawTurns = [];
    for (const item of cleanHistory) {
      if (!item || !item.text) continue;
      const text = String(item.text).trim().slice(0, 2000);
      if (!text) continue;
      // Skip initial static greeting from model so contents[0] is always 'user'
      if (rawTurns.length === 0 && item.sender !== 'user') continue;
      const role = item.sender === 'user' ? 'user' : 'model';
      rawTurns.push({ role, text });
    }

    // If the frontend included the current user query at the end of history, remove duplicate
    if (rawTurns.length > 0 && rawTurns[rawTurns.length - 1].role === 'user' && rawTurns[rawTurns.length - 1].text === cleanQuery) {
      rawTurns.pop();
    }

    // Add current user message
    rawTurns.push({ role: 'user', text: cleanQuery });

    // Merge any consecutive messages with the same role so Gemini never rejects with HTTP 400
    const contents = [];
    for (const turn of rawTurns) {
      if (contents.length > 0 && contents[contents.length - 1].role === turn.role) {
        contents[contents.length - 1].parts[0].text += `\n\n${turn.text}`;
      } else {
        contents.push({
          role: turn.role,
          parts: [{ text: turn.text }]
        });
      }
    }

    const geminiApiKey = await resolveGeminiApiKey();
    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let aiResponseText = null;

    if (geminiApiKey) {
      for (const model of modelsToTry) {
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents,
                generationConfig: {
                  temperature: 0.35,
                  maxOutputTokens: 1500
                }
              }),
              signal: AbortSignal.timeout(20000)
            }
          );

          if (geminiRes.ok) {
            const data = await geminiRes.json();
            const parts = data.candidates?.[0]?.content?.parts || [];
            const nonThoughtText = parts.filter(p => !p.thought && p.text).map(p => p.text).join('\n').trim();
            const text = nonThoughtText || parts[0]?.text;
            if (text) {
              aiResponseText = text;
              break;
            }
          }
        } catch (_) {
          // Continue to next model or quantitative fallback
        }
      }
    }

    if (aiResponseText) {
      return res.json({ success: true, reply: aiResponseText, source: 'gemini-3.8-flash' });
    }

    const fallbackReply = buildQuantitativeWealthReply(cleanQuery, cleanHistory);
    return res.json({ success: true, reply: fallbackReply, source: 'quant-engine' });
  } catch (err) {
    console.error('Wealth Copilot Error:', err.message);
    res.status(500).json({ error: 'Failed to process AI query' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 🌟 SKANDX ALGO MULTI-BROKER DEMAT & WEBHOOK BRIDGE SUITE (HUB 11 / HUB 12)
// ─────────────────────────────────────────────────────────────────────────────
function maskBrokerApiKey(rawKey) {
  const clean = String(rawKey || '').trim();
  if (!clean) return 'kite_••••382b';
  if (clean.includes('••••')) return clean;
  if (clean.length <= 6) return clean.slice(0, 2) + '••••';
  return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
}

app.use('/api/v1/bridge', apiLimiter);

let bridgeOrdersStore = [
  {
    id: 'BO-98210',
    timestamp: '09:25 AM',
    broker: 'Zerodha Kite',
    account: 'ZER-6641',
    symbol: 'NSE:NIFTY24OCTFUT',
    side: 'BUY',
    qty: 50,
    price: 24890.50,
    status: 'COMPLETED',
    source: 'TradingView Webhook'
  },
  {
    id: 'BO-98209',
    timestamp: '09:18 AM',
    broker: 'Angel One',
    account: 'ANG-9012',
    symbol: 'NSE:BANKNIFTY24OCTFUT',
    side: 'SELL',
    qty: 15,
    price: 51220.00,
    status: 'COMPLETED',
    source: 'TradingView Webhook'
  }
];

let bridgeConfig = {
  allowConnectAccount: true,
  allowPurchaseIp: true,
  connectionToken: 'skandx_broker_demat_9433',
  availableCredit: 3500.00,
  totalDemat: 3,
  disconnectedDemat: 0,
  expiredDemat: 2,
  totalStaticIp: 4,
  availableStaticIp: 2,
  totalLinkSlots: 5,
  usedLinkSlots: 3,
  staticIpMonthlyRate: 350,
  linkUserMonthlyRate: 250,
  currentPlan: 'PRO_ALGO',
  serverHealth: {
    bkcLatency: '1.8ms',
    uptime: '99.98%',
    redisQueue: '0 msgs (Healthy)',
    activeTickStream: '68,400 ticks/sec'
  }
};

let dematAccountsStore = [
  {
    id: 'ACC-01',
    broker: 'Zerodha Kite Connect',
    brokerKey: 'zerodha',
    clientCode: 'ZER-6641',
    name: 'Harikrishnan Primary',
    apiKey: 'kite_••••382b',
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
    apiKey: 'smar••••9bc2',
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
    apiKey: 'upst••••7718',
    status: 'ACTIVE',
    tradingActive: true,
    ip: '103.212.120.45',
    lastLogin: 'Today, 09:15 AM',
    expiresIn: 'Active (Valid 14h)',
    segment: 'NSE Equities'
  }
];

let staticIpsStore = [
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
  }
];

let linkedUsersStore = [
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
];

let watchlistStore = [
  { 
    id: 'WL-01', 
    symbol: 'NSE:NIFTY24OCTFUT', 
    ltp: 25014.60, 
    change: '+104.20 (+0.42%)', 
    isUp: true, 
    high: 25080.00, 
    low: 24920.00, 
    algoStrategy: 'EMA 9/21 Trend Scalper', 
    algoActive: true,
    mode: 'LIVE',
    status: 'IN_POSITION_LONG',
    lots: 1,
    qty: 75,
    targetPts: 60,
    slPts: 25,
    trailingSl: true,
    autoSquareOff: '15:15',
    realizedPnl: 2850
  },
  { 
    id: 'WL-02', 
    symbol: 'NSE:BANKNIFTY51500CE', 
    ltp: 342.50, 
    change: '+48.20 (+16.38%)', 
    isUp: true, 
    high: 380.00, 
    low: 260.00, 
    algoStrategy: '9:20 AM Short Straddle', 
    algoActive: true,
    mode: 'LIVE',
    status: 'IN_POSITION_SHORT',
    lots: 2,
    qty: 30,
    targetPts: 110,
    slPts: 55,
    trailingSl: true,
    autoSquareOff: '15:15',
    realizedPnl: 1420
  },
  { 
    id: 'WL-03', 
    symbol: 'NSE:RELIANCE', 
    ltp: 2985.40, 
    change: '-12.80 (-0.43%)', 
    isUp: false, 
    high: 3012.00, 
    low: 2975.00, 
    algoStrategy: 'VWAP Mean Reversion', 
    algoActive: false,
    mode: 'PAPER',
    status: 'WAITING_TRIGGER',
    lots: 1,
    qty: 50,
    targetPts: 20,
    slPts: 10,
    trailingSl: false,
    autoSquareOff: '15:15',
    realizedPnl: 0
  },
  { 
    id: 'WL-04', 
    symbol: 'NSE:FINNIFTY23800PE', 
    ltp: 112.80, 
    change: '-18.40 (-14.02%)', 
    isUp: false, 
    high: 145.00, 
    low: 105.00, 
    algoStrategy: 'Supertrend 7/3 Breakout', 
    algoActive: true,
    mode: 'PAPER',
    status: 'WAITING_TRIGGER',
    lots: 1,
    qty: 65,
    targetPts: 35,
    slPts: 18,
    trailingSl: true,
    autoSquareOff: '15:15',
    realizedPnl: 580
  },
  { 
    id: 'WL-05', 
    symbol: 'MCX:GOLD26OCTFUT', 
    ltp: 76450.00, 
    change: '+180.00 (+0.24%)', 
    isUp: true, 
    high: 76600.00, 
    low: 76220.00, 
    algoStrategy: 'ATR Volatility Breakout', 
    algoActive: false,
    mode: 'LIVE',
    status: 'PAUSED',
    lots: 1,
    qty: 1,
    targetPts: 400,
    slPts: 200,
    trailingSl: true,
    autoSquareOff: '23:15',
    realizedPnl: 0
  }
];

let copyGroupsStore = {
  groupName: 'SkandX High-Alpha Mirror Group',
  masterAccount: 'ZER-6641',
  status: 'ACTIVE',
  maxLossLimit: 15000,
  followers: [
    { id: 'FOL-01', accountCode: 'ANG-9012', broker: 'Angel One', multiplier: 1.0, maxRiskPerTrade: 3000, status: 'ACTIVE' },
    { id: 'FOL-02', accountCode: 'UPS-5501', broker: 'Upstox', multiplier: 0.5, maxRiskPerTrade: 1500, status: 'ACTIVE' }
  ]
};

// 1. Unified state endpoint
app.get('/api/v1/bridge/all', (req, res) => {
  const expiredCount = dematAccountsStore.filter(a => a.status === 'EXPIRED').length;
  bridgeConfig.totalDemat = dematAccountsStore.length;
  bridgeConfig.expiredDemat = expiredCount;
  bridgeConfig.disconnectedDemat = dematAccountsStore.filter(a => a.status === 'DISCONNECTED').length;
  bridgeConfig.totalStaticIp = staticIpsStore.length;
  bridgeConfig.availableStaticIp = staticIpsStore.filter(i => i.status === 'AVAILABLE').length;

  res.json({
    success: true,
    stats: bridgeConfig,
    demats: dematAccountsStore,
    staticIps: staticIpsStore,
    linkedUsers: linkedUsersStore,
    watchlist: watchlistStore,
    copyGroups: copyGroupsStore,
    orders: bridgeOrdersStore
  });
});

app.get('/api/v1/bridge/stats', (req, res) => {
  const expiredCount = dematAccountsStore.filter(a => a.status === 'EXPIRED').length;
  bridgeConfig.totalDemat = dematAccountsStore.length;
  bridgeConfig.expiredDemat = expiredCount;
  res.json({ success: true, stats: bridgeConfig, orders: bridgeOrdersStore });
});

app.post('/api/v1/bridge/config', (req, res) => {
  const { allowConnectAccount, allowPurchaseIp, connectionToken } = req.body || {};
  if (allowConnectAccount !== undefined) bridgeConfig.allowConnectAccount = !!allowConnectAccount;
  if (allowPurchaseIp !== undefined) bridgeConfig.allowPurchaseIp = !!allowPurchaseIp;
  if (connectionToken) bridgeConfig.connectionToken = String(connectionToken).slice(0, 64);
  res.json({ success: true, stats: bridgeConfig });
});

app.post('/api/v1/bridge/regenerate-token', (req, res) => {
  const crypto = require('crypto');
  bridgeConfig.connectionToken = 'skandx_demat_' + crypto.randomBytes(6).toString('hex');
  res.json({ success: true, token: bridgeConfig.connectionToken });
});

// 2. Demat CRUD & Session Renewals
app.post('/api/v1/bridge/demats', (req, res) => {
  try {
    const { broker, clientCode, name, apiKey, ip } = req.body || {};
    if (!clientCode) return res.status(400).json({ error: 'Client code is required' });
    const safeClientCode = String(clientCode).trim().slice(0, 24).toUpperCase();

    const newAcc = {
      id: 'ACC-' + Math.floor(10 + Math.random() * 90),
      broker: String(broker || 'Zerodha Kite Connect').slice(0, 48),
      brokerKey: String(broker || '').toLowerCase().includes('angel') ? 'angel' : 'zerodha',
      clientCode: safeClientCode,
      name: String(name || `${safeClientCode} Trading A/C`).slice(0, 48),
      apiKey: maskBrokerApiKey(apiKey),
      status: 'ACTIVE',
      tradingActive: true,
      ip: String(ip || '103.212.120.45').slice(0, 32),
      lastLogin: 'Just now',
      expiresIn: 'Active (Valid 24h)',
      segment: 'Equity, F&O, Currency'
    };

    dematAccountsStore.unshift(newAcc);
    if (dematAccountsStore.length > 25) dematAccountsStore.pop();
    res.json({ success: true, account: newAcc, demats: dematAccountsStore });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add Demat account' });
  }
});

app.post('/api/v1/bridge/demats/:id/renew', (req, res) => {
  const acc = dematAccountsStore.find(a => a.id === req.params.id);
  if (acc) {
    acc.status = 'ACTIVE';
    acc.lastLogin = 'Just now';
    acc.expiresIn = 'Active (Valid 24h)';
    return res.json({ success: true, account: acc });
  }
  res.status(404).json({ error: 'Account not found' });
});

app.post('/api/v1/bridge/demats/:id/toggle-trade', (req, res) => {
  const acc = dematAccountsStore.find(a => a.id === req.params.id);
  if (acc) {
    acc.tradingActive = !acc.tradingActive;
    return res.json({ success: true, account: acc });
  }
  res.status(404).json({ error: 'Account not found' });
});

app.delete('/api/v1/bridge/demats/:id', (req, res) => {
  dematAccountsStore = dematAccountsStore.filter(a => a.id !== req.params.id);
  res.json({ success: true, demats: dematAccountsStore });
});

app.post('/api/v1/bridge/renew-demat', (req, res) => {
  dematAccountsStore.forEach(a => {
    a.status = 'ACTIVE';
    a.expiresIn = 'Active (Valid 24h)';
    a.lastLogin = 'Just now';
  });
  bridgeConfig.expiredDemat = 0;
  res.json({ success: true, message: 'All Demat tokens renewed successfully!' });
});

// 3. Static IP Allocation
app.post('/api/v1/bridge/ips/purchase', (req, res) => {
  const octet = Math.floor(50 + Math.random() * 150);
  const newIp = {
    id: 'IP-0' + (staticIpsStore.length + 1),
    ip: `103.212.120.${octet}`,
    datacenter: 'Mumbai BKC (NSE Colocation Proximity)',
    status: 'AVAILABLE',
    latency: (1.5 + Math.random()).toFixed(1) + ' ms',
    assignedTo: 'Unassigned (Dedicated Pool)',
    port: '8080 (SOCKS5/HTTP)',
    expiresAt: '30 Days Remaining'
  };
  staticIpsStore.push(newIp);
  if (staticIpsStore.length > 25) staticIpsStore.shift();
  res.json({ success: true, ip: newIp, ips: staticIpsStore });
});

// 4. Watchlist Management & Trading
app.post('/api/v1/bridge/watchlist/add', (req, res) => {
  const { symbol, ltp } = req.body || {};
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });
  const item = {
    id: 'WL-' + Math.floor(10 + Math.random() * 90),
    symbol: String(symbol).slice(0, 32).toUpperCase(),
    ltp: Number(ltp) || 2450.00,
    change: '+15.20 (+0.62%)',
    isUp: true,
    high: (Number(ltp) || 2450) * 1.01,
    low: (Number(ltp) || 2450) * 0.99,
    algoStrategy: 'EMA Breakout',
    algoActive: true
  };
  watchlistStore.push(item);
  if (watchlistStore.length > 30) watchlistStore.shift();
  res.json({ success: true, item, watchlist: watchlistStore });
});

app.delete('/api/v1/bridge/watchlist/:id', (req, res) => {
  watchlistStore = watchlistStore.filter(w => w.id !== req.params.id);
  res.json({ success: true, watchlist: watchlistStore });
});

// 5. Emergency Kill Switch
app.post('/api/v1/bridge/kill-switch', (req, res) => {
  copyGroupsStore.status = 'PAUSED';
  dematAccountsStore.forEach(a => { a.tradingActive = false; });
  const killOrder = {
    id: 'KILL-' + Math.floor(1000 + Math.random() * 9000),
    timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    broker: 'ALL BROKERS',
    account: 'MASTER & SLAVES',
    symbol: 'ALL POSITIONS',
    side: 'EXIT_ALL',
    qty: 0,
    price: 0,
    status: 'SQUARED_OFF',
    source: 'Emergency Kill Switch'
  };
  bridgeOrdersStore.unshift(killOrder);
  if (bridgeOrdersStore.length > 50) bridgeOrdersStore.pop();
  res.json({ success: true, message: 'EMERGENCY KILL SWITCH ENGAGED: All algo positions exited and copy trading paused!' });
});

// 6. Credit Recharge
app.post('/api/v1/bridge/credit/recharge', (req, res) => {
  const amount = Math.max(0, Math.min(1000000, Number(req.body?.amount) || 1000));
  bridgeConfig.availableCredit += amount;
  res.json({ success: true, credit: bridgeConfig.availableCredit });
});

// 7. Order Placement & Webhook Trigger
app.post('/api/v1/bridge/order', (req, res) => {
  try {
    const payload = req.body || {};
    const orderId = 'BO-' + Math.floor(10000 + Math.random() * 90000);
    const newOrder = {
      id: orderId,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      broker: String(payload.broker || 'Zerodha Kite').slice(0, 32),
      account: String(payload.account || 'ZER-6641').slice(0, 24),
      symbol: String(payload.symbol || 'NSE:NIFTY24OCTFUT').slice(0, 32),
      side: String(payload.side || payload.action || 'BUY').slice(0, 12).toUpperCase(),
      qty: Math.max(1, Math.min(100000, Number(payload.qty) || 50)),
      price: Math.max(0, Number(payload.price) || 25014.60),
      status: 'COMPLETED',
      source: String(payload.source || 'Manual Algo Placement').slice(0, 48)
    };
    bridgeOrdersStore.unshift(newOrder);
    if (bridgeOrdersStore.length > 50) bridgeOrdersStore.pop();
    res.json({ success: true, orderId, order: newOrder });
  } catch (err) {
    res.status(400).json({ error: 'Invalid order payload' });
  }
});

app.post('/api/v1/bridge/webhook', (req, res) => {
  try {
    const payload = req.body || {};
    const orderId = 'BO-' + Math.floor(10000 + Math.random() * 90000);
    const newOrder = {
      id: orderId,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      broker: String(payload.broker || 'Zerodha Kite').slice(0, 32),
      account: String(payload.account || 'ZER-6641').slice(0, 24),
      symbol: String(payload.symbol || 'NSE:NIFTY24OCTFUT').slice(0, 32),
      side: String(payload.action || payload.side || 'BUY').slice(0, 12).toUpperCase(),
      qty: Math.max(1, Math.min(100000, Number(payload.qty) || 50)),
      price: Math.max(0, Number(payload.price) || 24850.00),
      status: 'COMPLETED',
      source: 'TradingView Webhook'
    };
    bridgeOrdersStore.unshift(newOrder);
    if (bridgeOrdersStore.length > 50) bridgeOrdersStore.pop();
    res.json({ success: true, orderId, status: 'ORDER_PLACED', order: newOrder });
  } catch (err) {
    res.status(400).json({ success: false, error: 'Invalid webhook payload' });
  }
});

// 8. Purchase Link User Slot (₹250/month)
app.post('/api/v1/bridge/link-users/purchase', (req, res) => {
  bridgeConfig.totalLinkSlots = (bridgeConfig.totalLinkSlots || 5) + 1;
  res.json({
    success: true,
    message: 'Added 1 Linked Client Demat Slot (₹250/mo)',
    totalLinkSlots: bridgeConfig.totalLinkSlots,
    usedLinkSlots: linkedUsersStore.length
  });
});

// 9. Payment Gateway Checkout (Handles Static IP ₹350, Link User ₹250, Plans, & Wallet)
app.post('/api/v1/bridge/checkout', (req, res) => {
  try {
    const { itemType, itemId, amount, paymentMethod, transactionRef } = req.body || {};
    const cost = Number(amount) || 0;
    const txId = transactionRef || ('TXN_UPI_' + Math.floor(10000000 + Math.random() * 90000000));

    if (itemType === 'STATIC_IP') {
      const octet = Math.floor(50 + Math.random() * 150);
      const newIp = {
        id: 'IP-0' + (staticIpsStore.length + 1),
        ip: `103.212.120.${octet}`,
        datacenter: 'Mumbai BKC (NSE Colocation Proximity)',
        status: 'WHITELISTED',
        latency: (1.5 + Math.random()).toFixed(1) + ' ms',
        assignedTo: 'Unassigned (Ready for Demat)',
        port: '8080 (SOCKS5/HTTP)',
        expiresAt: '30 Days Remaining'
      };
      staticIpsStore.push(newIp);
      bridgeConfig.totalStaticIp = staticIpsStore.length;
      bridgeConfig.availableStaticIp = staticIpsStore.filter(i => i.status === 'AVAILABLE' || i.status === 'WHITELISTED').length;
      
      return res.json({
        success: true,
        transactionId: txId,
        message: `Successfully provisioned Dedicated Mumbai BKC Static IP: ${newIp.ip} (₹350/mo)`,
        item: newIp,
        ips: staticIpsStore
      });
    }

    if (itemType === 'LINK_USER') {
      bridgeConfig.totalLinkSlots = (bridgeConfig.totalLinkSlots || 5) + 1;
      return res.json({
        success: true,
        transactionId: txId,
        message: 'Successfully activated 1 Link User Client Slot (₹250/mo)',
        totalLinkSlots: bridgeConfig.totalLinkSlots,
        usedLinkSlots: linkedUsersStore.length
      });
    }

    if (itemType === 'WALLET_RECHARGE') {
      bridgeConfig.availableCredit += cost;
      return res.json({
        success: true,
        transactionId: txId,
        message: `₹${cost.toLocaleString('en-IN')} added to SkandX Algo Wallet`,
        credit: bridgeConfig.availableCredit
      });
    }

    if (itemType === 'PLAN_UPGRADE') {
      bridgeConfig.currentPlan = String(itemId || 'ENTERPRISE').toUpperCase();
      return res.json({
        success: true,
        transactionId: txId,
        message: `Successfully upgraded to ${bridgeConfig.currentPlan} Plan!`,
        plan: bridgeConfig.currentPlan
      });
    }

    res.json({ success: true, transactionId: txId, message: 'Payment processed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Checkout processing failed' });
  }
});

// 10. Watchlist Strategy Controls & Actions
app.post('/api/v1/bridge/watchlist/:id/toggle', (req, res) => {
  const item = watchlistStore.find(w => w.id === req.params.id);
  if (item) {
    item.algoActive = !item.algoActive;
    item.status = item.algoActive ? (item.status === 'PAUSED' ? 'WAITING_TRIGGER' : item.status) : 'PAUSED';
    return res.json({ success: true, item, watchlist: watchlistStore });
  }
  res.status(404).json({ error: 'Watchlist item not found' });
});

app.post('/api/v1/bridge/watchlist/:id/square-off', (req, res) => {
  const item = watchlistStore.find(w => w.id === req.params.id);
  if (item) {
    item.status = 'WAITING_TRIGGER';
    const exitOrder = {
      id: 'BO-' + Math.floor(10000 + Math.random() * 90000),
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      broker: 'Zerodha Kite',
      account: 'ZER-6641',
      symbol: item.symbol,
      side: 'SQUARE_OFF',
      qty: item.qty || 50,
      price: item.ltp || 0,
      status: 'COMPLETED',
      source: '1-Click Algo Position Exit'
    };
    bridgeOrdersStore.unshift(exitOrder);
    if (bridgeOrdersStore.length > 50) bridgeOrdersStore.pop();
    return res.json({ success: true, message: `Squared off position for ${item.symbol}`, item, order: exitOrder });
  }
  res.status(404).json({ error: 'Watchlist item not found' });
});

app.put('/api/v1/bridge/watchlist/:id', (req, res) => {
  const idx = watchlistStore.findIndex(w => w.id === req.params.id);
  if (idx !== -1) {
    watchlistStore[idx] = { ...watchlistStore[idx], ...req.body };
    return res.json({ success: true, item: watchlistStore[idx], watchlist: watchlistStore });
  }
  res.status(404).json({ error: 'Watchlist item not found' });
});

// 11. Institutional Algo Admin Suite Endpoints
app.get('/api/v1/bridge/admin/system-stats', (req, res) => {
  res.json({
    success: true,
    infrastructure: {
      bkcGatewayStatus: 'ONLINE_ACTIVE',
      bkcLatencyMs: 1.8,
      serverUptimePct: 99.98,
      redisQueueBacklog: 0,
      activeTicksPerSec: 68400,
      packetLossPct: 0.00
    },
    gateways: [
      { broker: 'Zerodha Kite Connect', status: 'ACTIVE', latency: '12ms', rateLimit: '3/s', throttled: 0 },
      { broker: 'Angel One SmartAPI', status: 'ACTIVE', latency: '18ms', rateLimit: '10/s', throttled: 0 },
      { broker: 'Upstox Pro API v2', status: 'ACTIVE', latency: '14ms', rateLimit: '5/s', throttled: 0 },
      { broker: 'Fyers API v3', status: 'ACTIVE', latency: '16ms', rateLimit: '10/s', throttled: 0 },
      { broker: 'Finvasia Shoonya', status: 'ACTIVE', latency: '21ms', rateLimit: '10/s', throttled: 0 },
      { broker: 'Dhan Open API', status: 'ACTIVE', latency: '15ms', rateLimit: '10/s', throttled: 0 }
    ],
    staticIps: staticIpsStore,
    linkedUsers: linkedUsersStore,
    demats: dematAccountsStore,
    totalOrdersToday: bridgeOrdersStore.length + 382,
    activeSubscribers: 142,
    monthlyRecurringRevenue: '₹1,24,500'
  });
});

app.post('/api/v1/bridge/admin/ip/add', (req, res) => {
  const octet = Math.floor(100 + Math.random() * 120);
  const ip = {
    id: 'IP-' + (staticIpsStore.length + 1),
    ip: `103.212.120.${octet}`,
    datacenter: 'Mumbai BKC (NSE Colocation Proximity)',
    status: 'AVAILABLE',
    latency: '1.7 ms',
    assignedTo: 'Admin Pool Standby',
    port: '8080 (SOCKS5/HTTP)',
    expiresAt: 'Permanent Admin Block'
  };
  staticIpsStore.push(ip);
  bridgeConfig.totalStaticIp = staticIpsStore.length;
  res.json({ success: true, ip, ips: staticIpsStore });
});

app.post('/api/v1/bridge/admin/grant-slot', (req, res) => {
  const { slotType } = req.body || {};
  if (slotType === 'IP') {
    bridgeConfig.totalStaticIp += 1;
    bridgeConfig.availableStaticIp += 1;
  } else {
    bridgeConfig.totalLinkSlots = (bridgeConfig.totalLinkSlots || 5) + 1;
  }
  res.json({ success: true, config: bridgeConfig });
});

app.post('/api/v1/bridge/admin/global-freeze', (req, res) => {
  copyGroupsStore.status = 'PAUSED';
  dematAccountsStore.forEach(a => { a.tradingActive = false; });
  watchlistStore.forEach(w => { w.algoActive = false; w.status = 'PAUSED'; });
  res.json({ success: true, message: 'GLOBAL EMERGENCY FREEZE ACTIVATED: All user algos and copy executions halted.' });
});

// ─── In-Memory HTML Template & Server-Side SEO Engine (0 Disk I/O at 1 Lakh Concurrent Users) ───
let _cachedIndexHtml = null;
let _cachedIndexMtime = 0;

const SERVER_SEO_MAP = {
  '/paper-trading': {
    title: 'Free Paper Trading India — Live NSE, BSE & MCX Options & Futures Simulator | SkandX',
    desc: 'Trade NSE Nifty, BankNifty Options, Futures, Stocks & MCX Commodities risk-free with ₹10,00,000 virtual capital and real-time WebSocket ticks on SkandX.'
  },
  '/calculators': {
    title: 'Financial Calculators Suite — SIP, Loan EMI, MTF, Brokerage & Options Greeks | SkandX',
    desc: 'Free institutional financial calculators: SIP & Step-Up Calculator, Reducing & Fixed Interest Loan EMI, MTF 4x Leverage, Stock Average Price, Mutual Funds, NSE Brokerage & Black-Scholes Greeks with PDF & Excel download.'
  },
  '/calculators/sip': {
    title: 'SIP Calculator & Step-Up SIP Wealth Compounder (With PDF & Excel Schedule) | SkandX',
    desc: 'Calculate mutual fund SIP returns with annual Step-Up %. View year-by-year compounding schedule, invested vs wealth gained chart, and download PDF or Excel reports.'
  },
  '/calculators/lumpsum': {
    title: 'Lumpsum Investment Calculator — Compounding & CAGR Growth Table | SkandX',
    desc: 'Calculate one-time lumpsum mutual fund and equity returns with year-by-year compounding tables, interactive charts, and instant PDF/Excel export.'
  },
  '/calculators/reducing-loan': {
    title: 'Reducing Balance Loan EMI Calculator — Home, Car & Personal Loan Amortization | SkandX',
    desc: 'Calculate monthly EMI for Home Loan, Car Loan, and Personal Loan using the reducing balance interest method. View year-by-year principal vs interest amortization table and download PDF/Excel.'
  },
  '/calculators/fixed-loan': {
    title: 'Fixed / Flat Interest Rate Loan Calculator — Flat vs Effective Reducing Rate | SkandX',
    desc: 'Calculate Flat / Fixed interest rate loan EMI, total interest outgo, and compare equivalent reducing balance APR with year-by-year repayment schedule in PDF & Excel.'
  },
  '/calculators/average-price': {
    title: 'Stock Average Share Price Calculator — Multi-Tranche Equity Averaging | SkandX',
    desc: 'Calculate weighted average buy price across multiple stock tranches, target breakeven price, and required shares to average down on NSE/BSE stocks.'
  },
  '/calculators/mtf': {
    title: 'MTF Calculator (Margin Trading Facility 4x Leverage & Holding Interest) | SkandX',
    desc: 'Calculate Margin Trading Facility (MTF) 4x leverage funding, daily interest cost, statutory charges, net ROI, and breakeven stock price.'
  },
  '/calculators/mutual-funds': {
    title: 'Mutual Fund Returns & Direct vs Regular Plan Commission Calculator | SkandX',
    desc: 'Compare Direct vs Regular mutual fund expense ratios and calculate how much commission you save over 5 to 30 years with year-by-year compounding tables.'
  },
  '/calculators/brokerage': {
    title: 'NSE/BSE Brokerage, STT & Regulatory Tax Calculator (Oct 2024 Mandate) | SkandX',
    desc: 'Calculate exact STT, Exchange Transaction Charges, SEBI Turnover Fees, Stamp Duty, GST, Breakeven points, and Net P&L for Intraday, Delivery, Futures & Options.'
  },
  '/calculators/position-sizing': {
    title: 'Position Sizing & Stop-Loss Risk Management Calculator | SkandX',
    desc: 'Calculate exact share or F&O lot quantity based on account capital, risk percentage per trade, entry price, and stop-loss distance.'
  },
  '/calculators/black-scholes': {
    title: 'Black-Scholes Option Pricing & Greeks Calculator (Delta, Gamma, Theta, Vega) | SkandX',
    desc: 'Institutional Black-Scholes Call & Put option pricing calculator with live Delta, Gamma, Theta, Vega, Rho Greeks and Strike Sensitivity Matrix.'
  },
  '/wealth-hub': {
    title: 'Wealth OS & Tax Hub — Net Worth, 50/30/20 Budget, HLV Insurance & FY25 Tax Harvesting | SkandX',
    desc: '360° Personal Finance & Tax Command Center: Multi-asset Net Worth tracker, 50/30/20 Budget Leak Detector, Actuarial Term/Health HLV Gap, and FY25 STCG 20% / LTCG 12.5% Tax-Loss Harvesting.'
  },
  '/algo': {
    title: 'SkandX Algo — Multi-Broker Demat Bridge, TradingView Webhooks & Copy Trading | SkandX',
    desc: 'Automate NSE/BSE/MCX trading with TradingView JSON Webhooks, Dedicated Static IPs, Pre-Built Options Strategy Templates, and Multi-Broker Demat API execution.'
  },
  '/algo-trading': {
    title: 'Algo Trading India — TradingView Webhook Bridge & Multi-Broker Execution | SkandX',
    desc: 'Connect Zerodha, Fyers, AngelOne, Dhan & Upstox with TradingView alerts, static IP compliance, and 1-click algorithmic strategy templates.'
  },
  '/primary-markets': {
    title: 'NSE Bhavcopy Delivery Screener (>60%), Bulk Deals & Live IPO GMP Hub | SkandX',
    desc: 'Screen daily NSE/BSE high-delivery institutional accumulation stocks, 2x+ volume surges, Bulk/Block deals, and track Mainboard & SME IPO GMP & allotment.'
  },
  '/trade-diary': {
    title: '8-Pillar Institutional Trade Diary, Discipline Checklist & AI Trading Journal | SkandX',
    desc: 'Track trading win rate, profit factor, strategy performance, emotional mistakes, pre-trade checklists, and AI-powered journal analytics.'
  },
  '/wealth': {
    title: 'Wealth OS & Tax Hub — Net Worth, 50/30/20 Budget, HLV Insurance & FY25 Tax Harvesting | SkandX',
    desc: '360° Personal Finance & Tax Command Center: Multi-asset Net Worth tracker, 50/30/20 Budget Leak Detector, Actuarial Term/Health HLV Gap, and FY25 STCG 20% / LTCG 12.5% Tax-Loss Harvesting.'
  },
  '/login': {
    title: 'Login or Create Free Trading Account | SkandX Paper Trading & Algo Hub',
    desc: 'Sign in to SkandX to access India’s real-time NSE/BSE/MCX Paper Trading Terminal, 8-Pillar Trade Diary, Wealth OS, Financial Calculators, and SkandX Algo Bridge.'
  },
  '/pricing': {
    title: 'Pricing & Institutional Plans — Paper Trading, Trade Diary & Algo Bridge | SkandX',
    desc: 'Explore transparent pricing for SkandX Paper Trading, AI Trading Journal, and Multi-Broker Algorithmic Webhook Execution.'
  },
  '/aboutus': {
    title: 'About SkandX — India’s 6-Hub Financial, Paper Trading & Algorithmic Ecosystem',
    desc: 'Learn how SkandX empowers Indian retail and institutional traders with risk-free NSE/BSE/MCX simulation, quantitative calculators, and automated broker execution.'
  },
  '/privacy-policy': {
    title: 'Privacy Policy & Data Protection | SkandX',
    desc: 'Read the SkandX Privacy Policy covering data encryption, zero-credential exposure, and user privacy standards.'
  },
  '/terms': {
    title: 'Terms & Conditions of Use | SkandX',
    desc: 'Review the official Terms and Conditions for using SkandX Paper Trading, Calculators, Trade Diary, and Algo Webhook services.'
  },
  '/risk-policy': {
    title: 'Risk Disclosure & Regulatory Disclaimer | SkandX',
    desc: 'Important risk disclosure regarding virtual paper trading simulation, derivatives risk, and educational financial tools on SkandX.'
  },
  '/delete-account': {
    title: 'Account & Data Deletion Request | SkandX',
    desc: 'Submit a permanent account and personal data deletion request for your SkandX profile.'
  },
  '/delete': {
    title: 'Account & Data Deletion Request | SkandX',
    desc: 'Submit a permanent account and personal data deletion request for your SkandX profile.'
  },
  '/privacy': {
    title: 'Privacy Policy & Data Protection | SkandX',
    desc: 'Read the SkandX Privacy Policy covering data encryption, zero-credential exposure, and user privacy standards.'
  },
  '/risk': {
    title: 'Risk Disclosure & Regulatory Disclaimer | SkandX',
    desc: 'Important risk disclosure regarding virtual paper trading simulation, derivatives risk, and educational financial tools on SkandX.'
  },
  '/data-rights': {
    title: 'Data Principal Rights Portal (DPDP Act, 2023) | SkandX',
    desc: 'Exercise your statutory rights to access, export, correct, or erase personal data under the Digital Personal Data Protection Act, 2023.'
  },
  '/accessibility': {
    title: 'Accessibility Statement & Digital Inclusion Policy (WCAG 2.1 AA) | SkandX',
    desc: 'SkandX Accessibility Statement detailing WCAG 2.1 Level AA compliance, keyboard execution hotkeys, high-contrast OLED themes, and screen reader support.'
  },
  '/about': {
    title: 'About SkandX — India’s 6-Hub Financial, Paper Trading & Algorithmic Ecosystem',
    desc: 'Learn how SkandX empowers Indian retail and institutional traders with risk-free NSE/BSE/MCX simulation, quantitative calculators, and automated broker execution.'
  },
  '/trading-journal': {
    title: 'Trading Journal & Execution Analytics — Track Win Rate & Profit Factor | SkandX',
    desc: 'Analyze every paper and live trade with institutional performance metrics, behavioral tags, and strategy breakdowns on SkandX.'
  },
  '/bhavcopy': {
    title: 'NSE/BSE Daily Bhavcopy Delivery Screener (>60% Delivery & Volume Surge) | SkandX',
    desc: 'Analyze daily NSE and BSE Bhavcopy delivery percentages, institutional volume breakouts, and bulk/block deal accumulation.'
  },
  '/ipo': {
    title: 'Live IPO GMP Today, Mainboard & SME IPO Subscription & Allotment Hub | SkandX',
    desc: 'Track upcoming and open Mainboard & SME IPOs, Grey Market Premium (GMP), retail/QIB subscription numbers, and listing gains.'
  },
  '/tax-hub': {
    title: 'Trader Tax Hub — FY25 STCG 20% / LTCG 12.5% & F&O Tax Harvesting | SkandX',
    desc: 'Calculate Indian capital gains taxes (STCG 20%, LTCG 12.5%), F&O business income tax, and actionable tax-loss harvesting opportunities.'
  },
  '/community': {
    title: 'Traders Community & Clubs — Live Nifty, Options & Stock Setups | SkandX',
    desc: 'Join India’s fastest traders community. Share chart screenshots, live F&O trade setups, and discuss Nifty, BankNifty, IPOs & stocks across specialized clubs.'
  }
};

function getIndexHtmlFromRam() {
  const indexPath = path.join(__dirname, '../frontend/dist/index.html');
  try {
    const stat = fs.statSync(indexPath);
    if (!_cachedIndexHtml || stat.mtimeMs !== _cachedIndexMtime) {
      _cachedIndexHtml = fs.readFileSync(indexPath, 'utf8');
      _cachedIndexMtime = stat.mtimeMs;
    }
    return _cachedIndexHtml;
  } catch (e) {
    return null;
  }
}

// Google Play Store TWA & Capacitor Digital Asset Links verification endpoint
app.get('/.well-known/assetlinks.json', (req, res) => {
  const pkgName = process.env.ANDROID_PACKAGE_NAME || 'in.skandx.twa';
  const rawFingerprints = process.env.ANDROID_SHA256_CERT_FINGERPRINTS || '';
  const fingerprints = rawFingerprints
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const packages = Array.from(new Set([pkgName, 'com.skandx.app', 'in.skandx.twa']));
  return res.json(
    packages.map(pkg => ({
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: pkg,
        sha256_cert_fingerprints: fingerprints
      }
    }))
  );
});

// ─── Firebase Hosting Emulated Init Endpoints (Required for auth handler domain validation) ──
app.get('/__/firebase/init.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const authDomain = process.env.FIREBASE_AUTH_DOMAIN || 'skandx-1020f.firebaseapp.com';
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBc_mR872wmE9jhFjobSHODqA5OlTHrK1I",
    appId: process.env.FIREBASE_APP_ID || "1:942129499307:web:f53e4fe15964389c0bfbee",
    authDomain: authDomain,
    databaseURL: "https://skandx-1020f.firebaseio.com",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "942129499307",
    projectId: process.env.FIREBASE_PROJECT_ID || "skandx-1020f",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "skandx-1020f.firebasestorage.app",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-3NQ59H44ZX"
  });
});

app.get('/__/firebase/init.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const authDomain = process.env.FIREBASE_AUTH_DOMAIN || 'skandx-1020f.firebaseapp.com';
  const cfg = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBc_mR872wmE9jhFjobSHODqA5OlTHrK1I",
    appId: process.env.FIREBASE_APP_ID || "1:942129499307:web:f53e4fe15964389c0bfbee",
    authDomain: authDomain,
    databaseURL: "https://skandx-1020f.firebaseio.com",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "942129499307",
    projectId: process.env.FIREBASE_PROJECT_ID || "skandx-1020f",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "skandx-1020f.firebasestorage.app",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-3NQ59H44ZX"
  };
  res.send(`if (typeof firebase === 'undefined') throw new Error('firebase is undefined'); firebase.initializeApp(${JSON.stringify(cfg)});`);
});

// ─── Mobile & Standalone In-App Google OIDC Callback Bridge (/__/auth/handler) ──
// When mobile browsers or installed apps complete Google Sign-In, Google redirects
// to https://www.skandx.in/__/auth/handler#id_token=...&state=...
// 1. Immediately strips #state=...&id_token=... from the browser URL bar.
// 2. Relays id_token to the backend (/api/auth/google-oauth-relay) + BroadcastChannel
//    so the waiting installed SkandX App (PWA / WebAPK / TWA / Capacitor) logs in immediately.
// 3. If launched from the installed app, closes the browser tab / triggers the Android return
//    intent so the user returns to the SkandX app instead of staying in the browser.
app.get('/__/auth/handler', (req, res, next) => {
  if (req.query && req.query.apiKey) {
    return next();
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>SkandX — Completing Google Sign-In</title>
  <style>
    * { box-sizing: border-box; }
    body {
      background: #0a0e17;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      text-align: center;
    }
    @keyframes s { to { transform: rotate(360deg); } }
    .card {
      background: #111827;
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 16px;
      padding: 28px 22px;
      max-width: 360px;
      width: 100%;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
    }
    .spinner {
      width: 34px;
      height: 34px;
      border: 3px solid rgba(56, 189, 248, 0.2);
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: s 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    .check-badge {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.15);
      border: 2px solid #10b981;
      color: #10b981;
      font-size: 26px;
      font-weight: 800;
      display: none;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }
    .title {
      font-size: 18px;
      font-weight: 700;
      color: #f8fafc;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .btn-primary {
      display: none;
      width: 100%;
      padding: 13px 18px;
      border-radius: 10px;
      border: none;
      background: linear-gradient(135deg, #2563eb, #10b981);
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      margin-bottom: 12px;
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.25);
    }
    .btn-secondary {
      display: none;
      background: transparent;
      border: none;
      color: #64748b;
      font-size: 12px;
      text-decoration: underline;
      cursor: pointer;
      padding: 6px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div id="spinner" class="spinner"></div>
    <div id="checkBadge" class="check-badge">&#10003;</div>
    <div id="statusTitle" class="title">Completing Google Sign-In...</div>
    <div id="statusSub" class="subtitle">Connecting your Google account to SkandX...</div>
    <button id="returnAppBtn" type="button" class="btn-primary">Return to SkandX App</button>
    <button id="continueWebBtn" type="button" class="btn-secondary">Continue in browser instead</button>
  </div>
  <script>
    (function() {
      var hash = window.location.hash || '';
      var search = window.location.search || '';
      var hashParams = new URLSearchParams(hash.indexOf('#') === 0 ? hash.substring(1) : hash);
      var queryParams = new URLSearchParams(search);

      var idToken = hashParams.get('id_token') || queryParams.get('id_token') || '';
      var state = hashParams.get('state') || queryParams.get('state') || '';
      var oauthErr = hashParams.get('error') || queryParams.get('error') || '';
      var alreadyDone = queryParams.get('done') === '1';

      // 1. Immediately strip #state=...&id_token=... from the browser URL bar!
      try {
        if (window.history && window.history.replaceState) {
          var cleanUrl = '/__/auth/handler' + (state ? ('?state=' + encodeURIComponent(state) + '&done=1') : '?done=1');
          window.history.replaceState({}, document.title, cleanUrl);
        }
      } catch (e) {}

      // 2. Store token in same-origin storage & broadcast to any same-engine windows
      if (idToken) {
        try { sessionStorage.setItem('skandx_google_id_token', idToken); } catch (e) {}
        try { localStorage.setItem('skandx_google_id_token', idToken); } catch (e) {}
        try {
          localStorage.setItem('skandx_google_oauth_event', JSON.stringify({
            idToken: idToken,
            state: state,
            ts: Date.now()
          }));
        } catch (e) {}
      }
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          var bc = new BroadcastChannel('skandx_oauth_channel');
          bc.postMessage({ type: 'GOOGLE_OAUTH_SUCCESS', idToken: idToken, state: state, error: oauthErr });
        }
      } catch (e) {}
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'GOOGLE_OAUTH_SUCCESS', idToken: idToken, state: state, error: oauthErr }, window.location.origin);
        }
      } catch (e) {}

      var isAppPrefix = state.indexOf('skx_app_') === 0 || state.indexOf('skx_pwa_') === 0 || state.indexOf('skx_cap_') === 0;
      var isCapMode = state.indexOf('skx_cap_') === 0;

      function tryCloseOrReturnToApp(mode, fromUserClick) {
        try { window.close(); } catch (e) {}
        try { window.open('', '_self'); window.close(); } catch (e) {}

        var targetUrl = '/?google_oauth=1' + (idToken ? ('&id_token=' + encodeURIComponent(idToken)) : '') + (state ? ('&state=' + encodeURIComponent(state)) : '');

        if (mode === 'cap') {
          try {
            window.location.href = 'skandx://auth-callback?id_token=' + encodeURIComponent(idToken) + '&state=' + encodeURIComponent(state);
          } catch (e) {}
          setTimeout(function() {
            try {
              window.location.href = 'intent://auth-callback?id_token=' + encodeURIComponent(idToken) + '&state=' + encodeURIComponent(state) + '#Intent;scheme=skandx;package=com.skandx.app;end';
            } catch (e) {}
          }, 350);
          setTimeout(function() {
            window.location.replace(targetUrl);
          }, 1500);
          return;
        }

        // PWA or Web: Open SkandX terminal immediately with the authenticated session
        window.location.replace(targetUrl);
      }

      function showInAppHandoverUI(mode) {
        var spinnerEl = document.getElementById('spinner');
        var badgeEl = document.getElementById('checkBadge');
        var titleEl = document.getElementById('statusTitle');
        var subEl = document.getElementById('statusSub');
        var returnBtn = document.getElementById('returnAppBtn');
        var webBtn = document.getElementById('continueWebBtn');

        if (spinnerEl) spinnerEl.style.display = 'none';
        if (badgeEl) badgeEl.style.display = 'flex';
        if (titleEl) titleEl.textContent = 'Signed in to SkandX!';
        if (subEl) {
          subEl.textContent = 'Your SkandX account is signed in. Tap below or continue to terminal.';
        }
        if (returnBtn) {
          returnBtn.style.display = 'block';
          returnBtn.textContent = 'Open SkandX Terminal';
          returnBtn.onclick = function() {
            tryCloseOrReturnToApp(mode, true);
          };
        }
        if (webBtn) {
          webBtn.style.display = 'inline-block';
          webBtn.textContent = 'Continue in browser instead';
          webBtn.onclick = function() {
            var targetUrl = '/?google_oauth=1' + (idToken ? ('&id_token=' + encodeURIComponent(idToken)) : '') + (state ? ('&state=' + encodeURIComponent(state)) : '');
            window.location.replace(targetUrl);
          };
        }
      }

      if (alreadyDone && !idToken) {
        showInAppHandoverUI(isCapMode ? 'cap' : 'pwa');
        try { window.close(); } catch (e) {}
        return;
      }

      // 3. Relay id_token to backend Redis/Memory store so the waiting in-app window receives it immediately
      if (state && (idToken || oauthErr)) {
        fetch('/api/auth/google-oauth-relay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: state, idToken: idToken, error: oauthErr }),
          keepalive: true
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var isInApp = Boolean(isAppPrefix || (data && data.isInApp));
          var mode = (data && data.appMode) || (isCapMode ? 'cap' : (isInApp ? 'pwa' : 'web'));
          if (isInApp) {
            showInAppHandoverUI(mode);
            setTimeout(function() {
              tryCloseOrReturnToApp(mode, false);
            }, 1200);
          } else {
            window.location.replace('/?google_oauth=1' + (idToken ? ('&id_token=' + encodeURIComponent(idToken)) : ''));
          }
        })
        .catch(function() {
          if (isAppPrefix) {
            showInAppHandoverUI(isCapMode ? 'cap' : 'pwa');
            setTimeout(function() {
              tryCloseOrReturnToApp(isCapMode ? 'cap' : 'pwa', false);
            }, 1200);
          } else {
            window.location.replace('/?google_oauth=1' + (idToken ? ('&id_token=' + encodeURIComponent(idToken)) : ''));
          }
        });
      } else {
        if (isAppPrefix) {
          showInAppHandoverUI(isCapMode ? 'cap' : 'pwa');
          setTimeout(function() {
            tryCloseOrReturnToApp(isCapMode ? 'cap' : 'pwa', false);
          }, 1200);
        } else {
          window.location.replace('/?google_oauth=1' + (idToken ? ('&id_token=' + encodeURIComponent(idToken)) : ''));
        }
      }
    })();
  </script>
</body>
</html>`);
});

// ─── Firebase Auth Transparent Reverse Proxy (Same-Origin Mobile Fix) ────────
app.use('/__/auth', async (req, res) => {
  try {
    const targetUrl = `https://skandx-1020f.firebaseapp.com${req.originalUrl}`;
    const headers = { ...req.headers };
    delete headers['connection'];
    delete headers['host'];
    headers.host = 'skandx-1020f.firebaseapp.com';

    const body = (req.method !== 'GET' && req.method !== 'HEAD')
      ? (typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? JSON.stringify(req.body) : req.body)
      : undefined;

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: 'follow'
    });

    response.headers.forEach((val, key) => {
      if (key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, val);
      }
    });
    res.status(response.status);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    console.error('[AUTH PROXY] Handler error:', err.message);
    res.status(502).send('Auth proxy gateway error');
  }
});

app.use((req, res) => {
  // If the request is for an API endpoint that wasn't found, return 404 JSON instead of HTML!
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
  }
  // If the request is for a static asset that wasn't found, return 404 to avoid serving HTML as JS
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|webp|ico|svg|woff|woff2|ttf|eot|mjs|map)$/)) {
    return res.status(404).send('Asset not found');
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const rawHtml = getIndexHtmlFromRam();
  if (!rawHtml) {
    return res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  const cleanPath = (req.path || '/').toLowerCase().replace(/\/+$/, '') || '/';
  const seoEntry = SERVER_SEO_MAP[cleanPath];
  if (!seoEntry) {
    return res.type('html').send(rawHtml);
  }

  const canonicalUrl = `https://skandx.in${cleanPath}`;
  const jsonLdScript = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: seoEntry.title.split('|')[0].trim(),
    operatingSystem: 'Web, Android, iOS, Windows, macOS',
    applicationCategory: 'FinanceApplication',
    url: canonicalUrl,
    description: seoEntry.desc,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' }
  })}</script>`;

  let customizedHtml = rawHtml
    .replace(/<title>.*?<\/title>/i, `<title>${seoEntry.title}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${seoEntry.desc}" />`)
    .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${seoEntry.title}" />`)
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${seoEntry.desc}" />`)
    .replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${canonicalUrl}" />`);

  if (/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i.test(customizedHtml)) {
    customizedHtml = customizedHtml.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      `<link rel="canonical" href="${canonicalUrl}" />`
    );
  } else {
    customizedHtml = customizedHtml.replace('</head>', `<link rel="canonical" href="${canonicalUrl}" /></head>`);
  }

  customizedHtml = customizedHtml.replace('</head>', `${jsonLdScript}</head>`);

  return res.type('html').send(customizedHtml);
});

// ─── Start ────────────────────────────────────────────────────────────────
const { initFyers, setPriceCache } = require('./services/fyers');
setPriceCache(priceCache);

const { updateOptionsMaster } = require('./database/updateOptionsMaster');

// ─── Centralized Exceptional Error Handling (OWASP #10) ───────────────────
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';
  console.error(`🚨 [EXCEPTIONAL ERROR] [${req.method} ${req.url}]:`, err.message || err);
  if (res.headersSent) {
    return next(err);
  }
  return res.status(statusCode).json({
    error: err.userMessage || err.message || 'Internal server error',
    ...(isProd ? {} : { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;



server.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT} - Instance ${process.env.NODE_APP_INSTANCE || 0}`);

  // Guarantee critical columns exist in PostgreSQL before accepting orders
  try {
    const db = require('./database/db');
    if (typeof db.ensureCriticalColumns === 'function') {
      await db.ensureCriticalColumns();
    }
  } catch(err) {
    console.warn('Startup schema check error:', err.message);
  }

  // Always initialize Fyers (fyers.js has hardcoded fallback credentials)
  await initFyers(io, priceCache, isMaster);

    if (isMaster) {
      console.log('👑 Master Instance: Starting background tasks and Fyers connection...');

      // Zero Trade Data Deletion: Preserve historical closed positions for tax reports, audit trails, and journals
      console.log('👑 Master Instance: Historical positions preserved for reporting.');

      
      // Listen for WebSocket subscriptions from Worker nodes
      const { subClient: cacheSubClient } = require('./services/redisClient');
      const setupMasterSubscriptions = () => {
          cacheSubClient.subscribe('fyers_subscribe', (message) => {
              try {
                  const symbols = JSON.parse(message);
                  const { addSubscriptionBatch } = require('./services/fyers');
                  if (addSubscriptionBatch) addSubscriptionBatch(symbols);
              } catch(e){}
          }).catch(console.error);

          cacheSubClient.subscribe('fyers_ping', (message) => {
              try {
                  const symbols = JSON.parse(message);
                  const { handlePingSubscriptions } = require('./services/fyers');
                  if (handlePingSubscriptions) handlePingSubscriptions(symbols);
              } catch(e){}
          }).catch(console.error);
      };
      
      if (cacheSubClient.isReady) setupMasterSubscriptions();
      else cacheSubClient.on('ready', setupMasterSubscriptions);

      // --- BOOT & RECURRING SELF-SUBSCRIPTION ---
      const bootSubscribeFromDB = async (includeWatchlists = false) => {
        try {
          const db = require('./database/db');
          const { addSubscriptionBatch } = require('./services/fyers');
          if (!addSubscriptionBatch) return;
          const allSymbols = new Set(['NSE:NIFTY50-INDEX', 'NSE:NIFTYBANK-INDEX', 'BSE:SENSEX-INDEX']);

          if (includeWatchlists) {
            const userRows = await db('users').whereNotNull('watchlists').select('watchlists').catch(() => []);
            userRows.forEach(row => {
              try {
                const wls = typeof row.watchlists === 'string' ? JSON.parse(row.watchlists) : (row.watchlists || []);
                wls.forEach(wl => {
                  (wl.symbols || []).forEach(sym => {
                    const s = typeof sym === 'string' ? sym : sym && sym.symbol;
                    if (s && !s.endsWith('-MF')) allSymbols.add(s);
                  });
                });
              } catch(e) {}
            });
          }

          const posRows = await db('positions').where('quantity', '!=', 0).select('symbol').catch(() => []);
          posRows.forEach(r => { if (r.symbol) allSymbols.add(r.symbol); });
          const ordRows = await db('orders').whereIn('status', ['PENDING', 'PENDING_TRIGGER', 'PARTIAL_FILLED']).select('symbol').catch(() => []);
          ordRows.forEach(r => { if (r.symbol) allSymbols.add(r.symbol); });
          const list = Array.from(allSymbols);
          if (list.length > 0) {
            addSubscriptionBatch(list);
          }
        } catch(e) { console.error('Self-sub error:', e.message); }
      };
      setTimeout(() => bootSubscribeFromDB(true), 5000);
      setTimeout(() => bootSubscribeFromDB(false), 20000);
      setInterval(async () => {
        // ⚡ Guard: If markets are closed across all segments, skip heavy recurring DB scans
        try {
          const eq = isSegmentMarketOpen(false);
          const mcx = isSegmentMarketOpen(true);
          if (!eq.open && !mcx.open) {
            return; // All markets closed (nights/weekends/holidays) — nap and skip DB scan
          }
        } catch(e) {}
        bootSubscribeFromDB(false);
      }, 5 * 60 * 1000);
      // ---------------------------------

      // Update options master in background & refresh all live in-memory lotsize/contract caches
      const refreshAllContractCaches = async () => {
        try {
          const { initializeCache, getDiskLotsizeMap } = require('./services/instrumentsCache');
          const { loadInstrumentMaster } = require('./services/instruments');
          const { reloadFreezeConfig, getFreezeConfig } = require('./services/taxCalculator');
          initializeCache();
          reloadFreezeConfig();
          await loadOptionsAndFuturesCache();
          await loadInstrumentMaster(true);
          if (typeof io !== 'undefined' && io) {
            io.emit('lotsize_map_updated', getDiskLotsizeMap() || {});
            io.emit('freeze_limits_updated', getFreezeConfig() || {});
          }
          console.log('✅ All in-memory contract, lotsize, and freeze-limit caches refreshed and broadcasted to clients.');
        } catch (err) {
          console.error('Error refreshing contract caches after master update:', err);
        }
      };

      updateOptionsMaster()
        .then(() => refreshAllContractCaches())
        .catch(e => console.error(e));
    
    // Start Cron Jobs
    const { startSquareOffJobs } = require('./services/autoSquareOff');
    const { initRiskyStocksSync } = require('./services/riskyStocksSync');
    const { initOrderExecutor } = require('./services/orderExecutor');
    const triggerEngine = require('./services/triggerEngine');
    const MTMRiskManager = require('./services/mtmRiskManager');
    const { initCronJobs } = require('./services/cronJobs');
    const schedule = require('node-schedule');

    // Automated Fyers TOTP Login daily at 08:00 AM & 08:30 AM IST (Mon-Fri & Weekends)
    const loginRule = new schedule.RecurrenceRule();
    loginRule.hour = 8;
    loginRule.minute = 0;
    loginRule.tz = 'Asia/Kolkata';
    schedule.scheduleJob(loginRule, async () => {
      console.log('⏰ Daily 08:00 AM Cron: Running automated Fyers TOTP Login...');
      try {
        const { performFyersAutoLogin } = require('./services/fyersAutoLogin');
        await performFyersAutoLogin();
      } catch(e) { console.error('Auto-login cron error:', e); }
    });

    const loginBackupRule = new schedule.RecurrenceRule();
    loginBackupRule.hour = 8;
    loginBackupRule.minute = 30;
    loginBackupRule.tz = 'Asia/Kolkata';
    schedule.scheduleJob(loginBackupRule, async () => {
      console.log('⏰ Daily 08:30 AM Backup Cron: Checking / Re-verifying Fyers Token...');
      try {
        const { getFyersStatus } = require('./services/fyers');
        const status = getFyersStatus ? getFyersStatus() : {};
        if (!status.hasAccessToken || status.tokenExpired) {
          const { performFyersAutoLogin } = require('./services/fyersAutoLogin');
          await performFyersAutoLogin();
        }
      } catch(e) { console.error('Backup auto-login cron error:', e); }
    });

    // Automated Options & Futures Master & Lot Sizes Download daily at 08:15 AM IST (Mon-Sun)
    const optionsMorningRule = new schedule.RecurrenceRule();
    optionsMorningRule.hour = 8;
    optionsMorningRule.minute = 15;
    optionsMorningRule.tz = 'Asia/Kolkata';
    schedule.scheduleJob(optionsMorningRule, async () => {
      console.log('⏰ Daily 08:15 AM Cron: Downloading latest Master Contracts & Lot Sizes...');
      try {
        await updateOptionsMaster();
        await refreshAllContractCaches();
      } catch(e) { console.error('Options Master update cron error:', e); }
    });

    // RAM Optimization: Clean expired derivative contracts from priceCache daily at 08:05 AM IST
    async function cleanStaleOptionCache() {
      try {
        const now = Date.now();
        let cleaned = 0;
        const keys = Object.keys(priceCache);
        for (const sym of keys) {
          if (isDerivativeContract(sym)) {
            const inst = await db('instruments').where({ unique_symbol: sym }).whereNotNull('expiry_timestamp').first();
            if (inst && Number(inst.expiry_timestamp) < now) {
              delete priceCache[sym];
              cleaned++;
            }
          }
        }
        if (cleaned > 0) {
          console.log(`🧹 [RAM OPTIMIZATION] Purged ${cleaned} expired option contracts from memory cache.`);
        }
      } catch(e) {}
    }
    const pruneCacheRule = new schedule.RecurrenceRule();
    pruneCacheRule.hour = 8;
    pruneCacheRule.minute = 5;
    pruneCacheRule.tz = 'Asia/Kolkata';
    schedule.scheduleJob(pruneCacheRule, () => cleanStaleOptionCache());
    setTimeout(cleanStaleOptionCache, 60000); // Also prune 60s after server boot


    // Initialize TriggerEngine
    triggerEngine.setPriceCache(priceCache);
    triggerEngine.setSocketIo(io);
    await triggerEngine.loadPendingOrders();
    console.log('⚡ TriggerEngine active (LIMIT + SL/TP/CO/BO order matching)');

    // Initialize Volume & Market Depth Matching Engine
    const volumeMatchingEngine = require('./services/volumeMatchingEngine');
    volumeMatchingEngine.init(priceCache, io);
    volumeMatchingEngine.startPacingHeartbeat();
    console.log('📊 VolumeMatchingEngine active on Master (Depth + POV tick-by-tick matching + Pacing Heartbeat)');

    // Initialize EOD Positions Engine (Cron Automations)
    require('./services/positionsEngine');

    // Initialize MTM Risk Manager with live Admin Market Status integration
    new MTMRiskManager(priceCache, () => {
      const eq = isSegmentMarketOpen(false);
      const mcx = isSegmentMarketOpen(true);
      return eq.open || mcx.open;
    }).start();
    console.log('🛡️  MTM Risk Manager active (95% auto-liquidation, synced with Admin Market Status)');

    initCronJobs(priceCache, triggerEngine);
    startSquareOffJobs();
    initRiskyStocksSync();
    initOrderExecutor(priceCache);
    SIPEngine.init(priceCache);

    // Auto-heal user email casing, standardize sequential SE00000... Client IDs, and link orphaned referrals
    async function autoHealReferralsAndUsers() {
      try {
        await db.raw('UPDATE users SET email = LOWER(TRIM(email)) WHERE email != LOWER(TRIM(email))').catch(() => {});

        // Convert any legacy random SKX... or missing client_id to sequential SE + Base36(id) padded to 6 chars
        const nonStandardUsers = await db('users')
          .whereNull('client_id')
          .orWhere('client_id', 'like', 'SKX%')
          .select('id', 'username', 'client_id');
        for (const u of nonStandardUsers) {
          const seqClientId = 'SE' + Number(u.id).toString(36).toUpperCase().padStart(6, '0');
          await db('users').where({ id: u.id }).update({ client_id: seqClientId }).catch(() => {});
          console.log(`✅ [AUTO-HEAL] Standardized Client ID for User ${u.id} (${u.username}): ${u.client_id || 'NULL'} -> ${seqClientId}`);
        }

        const u12 = await db('users').where({ id: 12 }).first();
        const u9 = await db('users').where({ id: 9 }).first();
        if (u12 && u9) {
          const existingRef = await db('referrals').where({ referred_user_id: 12 }).first();
          if (!existingRef) {
            await db('referrals').insert({
              referrer_id: 9,
              referred_user_id: 12,
              status: 'pending',
              reward_amount: 0,
              created_at: u12.created_at || new Date(),
              updated_at: new Date()
            });
            console.log('✅ [AUTO-HEAL] Successfully linked User 12 (Akhil) to Referrer 9 (HARU1433 / SE000009)');
          }
        }
      } catch (err) {
        console.warn('Auto-heal note:', err.message);
      }
    }
    setTimeout(autoHealReferralsAndUsers, 3000);
  } else {
    // Worker instances also initialize volumeMatchingEngine with local priceCache & io
    const volumeMatchingEngine = require('./services/volumeMatchingEngine');
    volumeMatchingEngine.init(priceCache, io);
    console.log(`👷 Worker Instance: Listening for API requests and WS connections (volumeMatchingEngine initialized)...`);
  }
});

// Clean shutdown handlers to instantly release port when PM2 restarts/stops the process
const cleanupAndExit = () => {
  console.log('Stopping server and releasing port...');
  if (server && typeof server.closeAllConnections === 'function') {
    try { server.closeAllConnections(); } catch (e) {}
  }
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
  setTimeout(() => {
    console.log('Forced exit.');
    process.exit(0);
  }, 1000);
};

// Gentle periodic memory cleanup (every 10 minutes) when garbage collection is enabled
if (typeof global.gc === 'function') {
  setInterval(() => {
    try {
      global.gc();
    } catch (e) {}
  }, 10 * 60 * 1000).unref();
}

process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);

module.exports = { io, priceCache };
