import { isCommodityContract, getAssetSubsegment } from './lotsizeHelper';

/**
 * Evaluates the current market session for a given symbol, product type, and market state.
 * Standardizes market open/closed checks across OrderModal, PositionsView, and PortfolioView.
 */
export function getMarketSession({
  symbol = 'NSE:RELIANCE',
  productType = 'DEL',
  isCommodity = null,
  marketStatus = null,
  marketCalendar = []
} = {}) {
  const commFlag = isCommodity !== null ? isCommodity : isCommodityContract(symbol);
  const status = commFlag ? (marketStatus?.commodity || 'AUTO') : (marketStatus?.equity || 'AUTO');
  const hoursText = commFlag ? "09:00 AM - 11:30 PM" : "09:15 AM - 03:30 PM";
  const marketName = commFlag ? "MCX Commodity Market" : "Market";
  const defaultClosedMessage = `${marketName} is closed. Regular orders can only be placed during trading hours (${hoursText}). Please select AMO to place an After Market Order.`;

  // 1. Administrative Manual Overrides
  if (status === 'OPEN') {
    return {
      open: true,
      mode: 'OPEN',
      session: 'OPEN',
      isAmoWindow: false,
      hoursText,
      marketName,
      closedMessage: defaultClosedMessage
    };
  }

  if (status === 'CLOSED') {
    const reason = `${commFlag ? 'MCX Commodity' : 'NSE/BSE Equity'} market is currently marked as CLOSED / Holiday by Administrator.`;
    return {
      open: false,
      mode: 'CLOSED',
      session: 'ADMIN_CLOSED',
      isAmoWindow: false,
      reason,
      hoursText,
      marketName,
      closedMessage: reason
    };
  }

  // 2. Check Date-Specific Calendar Override
  const now = new Date();
  const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const y = istTime.getFullYear();
  const m = String(istTime.getMonth() + 1).padStart(2, '0');
  const d = String(istTime.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  const calRule = (marketCalendar || []).find(r => r.date === todayStr);
  if (calRule) {
    const segStatus = commFlag ? calRule.commodity_status : calRule.equity_status;
    const holidayReason = calRule.reason || (commFlag ? 'MCX Commodity Market Holiday' : 'NSE/BSE Equity Market Holiday');

    if (segStatus === 'CLOSED') {
      const reason = `${commFlag ? 'MCX Commodity' : 'NSE/BSE Equity'} market is CLOSED today (${holidayReason}).`;
      return {
        open: false,
        mode: 'CLOSED',
        session: 'HOLIDAY',
        isAmoWindow: true,
        reason,
        hoursText,
        marketName,
        closedMessage: reason
      };
    }

    if (segStatus === 'OPEN') {
      const startTimeStr = commFlag ? (calRule.commodity_start_time || '09:00') : (calRule.equity_start_time || '09:15');
      const endTimeStr = commFlag ? (calRule.commodity_end_time || '23:30') : (calRule.equity_end_time || '15:30');
      const [sH, sM] = startTimeStr.split(':').map(Number);
      const [eH, eM] = endTimeStr.split(':').map(Number);
      const curMins = istTime.getHours() * 60 + istTime.getMinutes();
      const startMins = sH * 60 + (sM || 0);
      const endMins = eH * 60 + (eM || 0);

      if (curMins < startMins || curMins >= endMins) {
        return {
          open: false,
          mode: 'AUTO',
          session: 'SPECIAL_CLOSED',
          isAmoWindow: true,
          reason: `Today's special session for ${commFlag ? 'MCX' : 'NSE/BSE'} (${holidayReason}) is open only between ${startTimeStr} and ${endTimeStr} IST.`,
          hoursText: `${startTimeStr} - ${endTimeStr}`,
          marketName,
          closedMessage: defaultClosedMessage
        };
      }
      return {
        open: true,
        mode: 'OPEN',
        session: 'SPECIAL_OPEN',
        isAmoWindow: false,
        hoursText,
        marketName,
        closedMessage: defaultClosedMessage
      };
    }
  }

  // 3. AUTO mode: Check weekend & normal hours
  const day = istTime.getDay(); // 0 = Sun, 6 = Sat
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  const curMins = hours * 60 + minutes;

  if (day === 0 || day === 6) {
    return {
      open: false,
      mode: 'AUTO',
      session: 'WEEKEND',
      isAmoWindow: true,
      reason: 'Markets are closed on weekends (Saturday & Sunday). You can place After Market Orders (AMO) for Monday 09:15 AM.',
      hoursText,
      marketName,
      closedMessage: defaultClosedMessage
    };
  }

  const subsegment = getAssetSubsegment(symbol);
  const isIntraday = (productType === 'INT' || productType === 'MIS');
  const isDelivery = (productType === 'DEL' || productType === 'CNC' || !productType);

  // 4. Commodity Segment (MCX)
  if (subsegment === 'COMMODITY' || commFlag) {
    if (hours < 9 || hours > 23 || (hours === 23 && minutes >= 30)) {
      return {
        open: false,
        mode: 'AUTO',
        session: 'AMO',
        isAmoWindow: true,
        reason: 'MCX Commodity Market is closed. Orders placed now will queue as AMO for 09:00 AM market open.',
        hoursText,
        marketName,
        closedMessage: defaultClosedMessage
      };
    }
    if (isIntraday && (hours > 22 || (hours === 22 && minutes >= 50))) {
      return {
        open: false,
        mode: 'AUTO',
        session: 'INTRADAY_CUTOFF',
        isAmoWindow: false,
        reason: 'Intraday (MIS/BO/CO) trading for MCX closes at 10:50 PM IST. Auto square-off executes between 10:50 PM and 11:00 PM.',
        hoursText,
        marketName,
        closedMessage: defaultClosedMessage
      };
    }
    return {
      open: true,
      mode: 'AUTO',
      session: 'NORMAL',
      isAmoWindow: false,
      hoursText,
      marketName,
      closedMessage: defaultClosedMessage
    };
  }

  // 5. Equity & Derivatives Timing Schedule

  // 5A. AMO Window: 3:45 PM (945m) until 8:57 AM (537m)
  if (curMins >= 945 || curMins < 537) {
    return {
      open: false,
      mode: 'AUTO',
      session: 'AMO',
      isAmoWindow: true,
      reason: 'Equity & Derivatives markets are closed. The AMO window is active (03:45 PM - 08:57 AM). Orders will be executed at 09:15 AM market open.',
      hoursText,
      marketName,
      closedMessage: defaultClosedMessage
    };
  }

  // 5B. Buffer between AMO and Pre-Market: 8:57 AM to 9:00 AM (537m - 540m)
  if (curMins >= 537 && curMins < 540) {
    return {
      open: false,
      mode: 'AUTO',
      session: 'PRE_MARKET_BUFFER',
      isAmoWindow: false,
      reason: 'AMO window closed at 08:57 AM. Pre-Market order session opens at 09:00 AM IST.',
      hoursText,
      marketName,
      closedMessage: defaultClosedMessage
    };
  }

  // 5C. Pre-Market Session: 9:00 AM to 9:15 AM (540m - 555m)
  if (curMins >= 540 && curMins < 555) {
    if (subsegment === 'DERIVATIVE') {
      return {
        open: false,
        mode: 'AUTO',
        session: 'BEFORE_OPEN',
        isAmoWindow: false,
        reason: 'Pre-market session is for Cash Equities only. Futures & Options trading begins at 09:15 AM IST.',
        hoursText,
        marketName,
        closedMessage: defaultClosedMessage
      };
    }
    if (curMins < 548) {
      if (isIntraday) {
        return {
          open: false,
          mode: 'AUTO',
          session: 'PRE_MARKET_INTRADAY_BLOCKED',
          isAmoWindow: false,
          reason: 'Intraday (MIS/BO/CO) orders are not allowed during the Pre-Market session (09:00 AM - 09:08 AM). Only Delivery orders are permitted.',
          hoursText,
          marketName,
          closedMessage: defaultClosedMessage
        };
      }
      return {
        open: true,
        mode: 'AUTO',
        session: 'PRE_MARKET',
        isCas: true,
        isAmoWindow: false,
        hoursText,
        marketName,
        closedMessage: defaultClosedMessage
      };
    }
    return {
      open: false,
      mode: 'AUTO',
      session: 'PRE_MARKET_FREEZE',
      isAmoWindow: false,
      reason: 'Pre-Market order collection is closed (09:08 AM - 09:15 AM). Exchange is matching opening orders. Normal continuous trading begins at 09:15 AM.',
      hoursText,
      marketName,
      closedMessage: defaultClosedMessage
    };
  }

  // 5D. Normal Trading & Cutoffs (09:15 AM to 03:30 PM)

  // Segment 1: Equity Cash (F&O Eligible Stocks) e.g., RELIANCE, TCS
  if (subsegment === 'FNO_EQ') {
    if (curMins >= 950 && curMins < 960) {
      if (isDelivery) {
        return { open: true, mode: 'AUTO', session: 'POST_MARKET', isPostMarket: true, hoursText, marketName, closedMessage: defaultClosedMessage };
      }
      return {
        open: false,
        mode: 'AUTO',
        session: 'POST_MARKET',
        isAmoWindow: false,
        reason: 'Only Delivery orders can be placed during Post-Market session (03:50 PM - 04:00 PM).',
        hoursText,
        marketName,
        closedMessage: defaultClosedMessage
      };
    }

    if (curMins >= 915 && curMins < 935) {
      if (curMins >= 920 && curMins <= 930 && isDelivery) {
        return { open: true, mode: 'AUTO', session: 'CLOSING_AUCTION', isCas: true, hoursText, marketName, closedMessage: defaultClosedMessage };
      }
      if (isIntraday) {
        return {
          open: false,
          mode: 'AUTO',
          session: 'CLOSING_AUCTION',
          isAmoWindow: false,
          reason: 'Intraday orders are not allowed during Closing Auction Session (03:15 PM - 03:35 PM). Only Delivery orders are accepted between 03:20 PM and 03:30 PM.',
          hoursText,
          marketName,
          closedMessage: defaultClosedMessage
        };
      }
      return {
        open: false,
        mode: 'AUTO',
        session: 'CLOSING_AUCTION',
        isAmoWindow: false,
        reason: 'F&O cash stocks enter Closing Auction Session (CAS) at 03:15 PM. Order entry into auction pool is open between 03:20 PM and 03:30 PM IST.',
        hoursText,
        marketName,
        closedMessage: defaultClosedMessage
      };
    }

    if (curMins < 915) {
      if (isIntraday && curMins >= 905) {
        return {
          open: false,
          mode: 'AUTO',
          session: 'INTRADAY_CUTOFF',
          isAmoWindow: false,
          reason: 'Intraday auto square-off cutoff for F&O cash stocks is 03:05 PM IST. Auto square-off executes between 03:05 PM and 03:10 PM.',
          hoursText,
          marketName,
          closedMessage: defaultClosedMessage
        };
      }
      return { open: true, mode: 'AUTO', session: 'NORMAL', isAmoWindow: false, hoursText, marketName, closedMessage: defaultClosedMessage };
    }

    return {
      open: false,
      mode: 'AUTO',
      session: 'SETTLEMENT',
      isAmoWindow: false,
      reason: 'Normal trading closed at 03:15 PM (CAS ended at 03:35 PM). Post-Market opens at 03:50 PM and AMO opens at 03:45 PM IST.',
      hoursText,
      marketName,
      closedMessage: defaultClosedMessage
    };
  }

  // Segment 2: Equity Cash (Non-F&O Stocks)
  if (subsegment === 'NON_FNO_EQ') {
    if (curMins >= 950 && curMins < 960) {
      if (isDelivery) {
        return { open: true, mode: 'AUTO', session: 'POST_MARKET', isPostMarket: true, hoursText, marketName, closedMessage: defaultClosedMessage };
      }
      return {
        open: false,
        mode: 'AUTO',
        session: 'POST_MARKET',
        isAmoWindow: false,
        reason: 'Only Delivery orders can be placed during Post-Market session (03:50 PM - 04:00 PM).',
        hoursText,
        marketName,
        closedMessage: defaultClosedMessage
      };
    }

    if (curMins < 930) {
      if (isIntraday && curMins >= 915) {
        return {
          open: false,
          mode: 'AUTO',
          session: 'INTRADAY_CUTOFF',
          isAmoWindow: false,
          reason: 'Intraday auto square-off cutoff for Non-F&O cash stocks is 03:15 PM IST. Auto square-off executes between 03:15 PM and 03:20 PM.',
          hoursText,
          marketName,
          closedMessage: defaultClosedMessage
        };
      }
      return { open: true, mode: 'AUTO', session: 'NORMAL', isAmoWindow: false, hoursText, marketName, closedMessage: defaultClosedMessage };
    }

    return {
      open: false,
      mode: 'AUTO',
      session: 'SETTLEMENT',
      isAmoWindow: false,
      reason: 'Normal trading closed at 03:30 PM IST. Post-Market opens at 03:50 PM and AMO opens at 03:45 PM IST.',
      hoursText,
      marketName,
      closedMessage: defaultClosedMessage
    };
  }

  // Segment 3: Futures & Options (Derivatives)
  if (subsegment === 'DERIVATIVE') {
    if (curMins < 940) {
      if (isIntraday && curMins >= 925) {
        return {
          open: false,
          mode: 'AUTO',
          session: 'INTRADAY_CUTOFF',
          isAmoWindow: false,
          reason: 'Intraday auto square-off cutoff for Futures & Options is 03:25 PM IST. Auto square-off executes between 03:25 PM and 03:30 PM.',
          hoursText,
          marketName,
          closedMessage: defaultClosedMessage
        };
      }
      return { open: true, mode: 'AUTO', session: 'NORMAL', isAmoWindow: false, hoursText, marketName, closedMessage: defaultClosedMessage };
    }
    return {
      open: false,
      mode: 'AUTO',
      session: 'SETTLEMENT',
      isAmoWindow: false,
      reason: 'Futures & Options trading closed at 03:40 PM IST. After Market Orders (AMO) open at 03:45 PM IST.',
      hoursText,
      marketName,
      closedMessage: defaultClosedMessage
    };
  }

  return { open: true, mode: 'AUTO', session: 'NORMAL', isAmoWindow: false, hoursText, marketName, closedMessage: defaultClosedMessage };
}

/**
 * Convenience helper to check if regular trading hours are currently open for cash equities.
 */
export function isEquityTradingHoursOpen(marketStatus, marketCalendar) {
  const session = getMarketSession({
    symbol: 'NSE:RELIANCE',
    productType: 'DEL',
    isCommodity: false,
    marketStatus,
    marketCalendar
  });
  return session.open;
}
