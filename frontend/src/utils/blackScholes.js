// Standard Normal PDF
function N_prime(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Standard Normal CDF (Abramowitz and Stegun approximation)
function N(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculates theoretical Option Price and Greeks for Commodity Futures Options using the Black-76 formula.
 * @param {string} type - 'CE' for Call, 'PE' for Put
 * @param {number} F - Forward/Futures Price
 * @param {number} K - Strike Price
 * @param {number} T - Time to Expiration in Years
 * @param {number} r - Risk-free interest rate
 * @param {number} sigma - Volatility
 * @returns {object} { price, delta, gamma, theta, vega }
 */
export function calculateBlack76Greeks(type, F, K, T, r, sigma) {
  const optType = (type || 'CE').toUpperCase();
  if (F <= 0 || K <= 0 || isNaN(F) || isNaN(K)) {
    return { price: 0, delta: 0, gamma: 0, theta: 0, vega: 0 };
  }

  const discount = Math.exp(-r * T);

  if (T <= 0 || isNaN(T)) {
    const price = optType === 'CE' ? Math.max(0, F - K) : Math.max(0, K - F);
    const delta = optType === 'CE' ? (F > K ? 1.0 : (F === K ? 0.5 : 0.0)) : (F < K ? -1.0 : (F === K ? -0.5 : 0.0));
    return { price, delta, gamma: 0, theta: 0, vega: 0 };
  }

  if (sigma <= 0 || isNaN(sigma)) {
    const price = optType === 'CE' ? discount * Math.max(0, F - K) : discount * Math.max(0, K - F);
    const delta = optType === 'CE' ? (F > K ? discount : 0.0) : (F < K ? -discount : 0.0);
    return { price, delta, gamma: 0, theta: 0, vega: 0 };
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(F / K) + (0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const denom = F * sigma * sqrtT;
  const gamma = denom > 1e-7 ? (discount * N_prime(d1)) / denom : 0;
  const vega = (F * discount * N_prime(d1) * sqrtT) / 100; // 1% change

  let price, delta, theta;
  if (optType === 'CE') {
    price = discount * (F * N(d1) - K * N(d2));
    delta = discount * N(d1);
    const thetaDecay = sqrtT > 1e-7 ? -(F * discount * N_prime(d1) * sigma) / (2 * sqrtT) : 0;
    theta = (thetaDecay - r * price) / 252; // 252 trading days
  } else {
    price = discount * (K * N(-d2) - F * N(-d1));
    delta = -discount * N(-d1);
    const thetaDecay = sqrtT > 1e-7 ? -(F * discount * N_prime(d1) * sigma) / (2 * sqrtT) : 0;
    theta = (thetaDecay - r * price) / 252; // 252 trading days
  }

  return {
    price: Number.isFinite(price) ? Math.max(0, price) : 0,
    delta: Number.isFinite(delta) ? delta : 0,
    gamma: Number.isFinite(gamma) ? gamma : 0,
    theta: Number.isFinite(theta) ? Math.min(0, theta) : 0,
    vega: Number.isFinite(vega) ? vega : 0
  };
}

/**
 * Calculates the theoretical Option Price and Greeks using the Black-Scholes (or Black-76 for commodities) formula.
 * @param {string} type - 'CE' for Call, 'PE' for Put
 * @param {number} S - Spot Price (Underlying asset price)
 * @param {number} K - Strike Price
 * @param {number} T - Time to Expiration in Years
 * @param {number} r - Risk-free interest rate (e.g., 0.07 for 7%)
 * @param {number} sigma - Volatility (e.g., 0.20 for 20%)
 * @param {boolean} isCommodity - True if underlying is a futures contract (Black-76)
 * @returns {object} { price, delta, gamma, theta, vega }
 */
export function calculateGreeks(type, S, K, T, r, sigma, isCommodity = false) {
  if (isCommodity) {
    return calculateBlack76Greeks(type, S, K, T, r, sigma);
  }

  const optType = (type || 'CE').toUpperCase();
  
  if (S <= 0 || K <= 0 || isNaN(S) || isNaN(K)) {
    return { price: 0, delta: 0, gamma: 0, theta: 0, vega: 0 };
  }

  // Boundary condition at or past expiration (T <= 0 or DTE = 0)
  if (T <= 0 || isNaN(T)) {
    if (optType === 'CE') {
      const price = Math.max(0, S - K);
      const delta = S > K ? 1.0 : (S === K ? 0.5 : 0.0);
      return { price, delta, gamma: 0, theta: 0, vega: 0 };
    } else {
      const price = Math.max(0, K - S);
      const delta = S < K ? -1.0 : (S === K ? -0.5 : 0.0);
      return { price, delta, gamma: 0, theta: 0, vega: 0 };
    }
  }

  // Zero or negative volatility
  if (sigma <= 0 || isNaN(sigma)) {
    const discount = Math.exp(-r * T);
    if (optType === 'CE') {
      const price = Math.max(0, S - K * discount);
      const delta = S > K ? 1.0 : 0.0;
      return { price, delta, gamma: 0, theta: 0, vega: 0 };
    } else {
      const price = Math.max(0, K * discount - S);
      const delta = S < K ? -1.0 : 0.0;
      return { price, delta, gamma: 0, theta: 0, vega: 0 };
    }
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  let price, delta, theta;
  
  const denom = S * sigma * sqrtT;
  const gamma = denom > 1e-7 ? (N_prime(d1) / denom) : 0;
  const vega = (S * N_prime(d1) * sqrtT) / 100; // Divided by 100 for 1% change

  const thetaTerm1 = sqrtT > 1e-7 ? (-(S * N_prime(d1) * sigma) / (2 * sqrtT)) : 0;

  if (optType === 'CE') {
    price = S * N(d1) - K * Math.exp(-r * T) * N(d2);
    delta = N(d1);
    // Scale by standard 252 trading days per SEBI convention
    theta = (thetaTerm1 - r * K * Math.exp(-r * T) * N(d2)) / 252;
  } else {
    price = K * Math.exp(-r * T) * N(-d2) - S * N(-d1);
    delta = N(d1) - 1;
    // Cap put theta so interest cash-carry doesn't create misleading positive theta on long puts
    const rawPutTheta = (thetaTerm1 + r * K * Math.exp(-r * T) * N(-d2)) / 252;
    theta = Math.min(0, rawPutTheta);
  }

  return {
    price: Number.isFinite(price) ? Math.max(0, price) : 0,
    delta: Number.isFinite(delta) ? delta : 0,
    gamma: Number.isFinite(gamma) ? gamma : 0,
    theta: Number.isFinite(theta) ? theta : 0,
    vega: Number.isFinite(vega) ? vega : 0
  };
}

/**
 * Reverse-engineers the Implied Volatility (IV) from the Market Price using Newton-Raphson with bisection fallback.
 * @param {string} type - 'CE' for Call, 'PE' for Put
 * @param {number} marketPrice - The Last Traded Price (LTP) of the option
 * @param {number} S - Spot Price (or Futures price for commodities)
 * @param {number} K - Strike Price
 * @param {number} T - Time to Expiration in Years
 * @param {number} r - Risk-free interest rate (e.g., 0.07 for 7%)
 * @param {boolean} isCommodity - True if underlying is commodity futures (Black-76)
 * @returns {number} Implied Volatility as a decimal (e.g., 0.20 = 20%)
 */
export function calculateIV(type, marketPrice, S, K, T, r, isCommodity = false) {
  if (marketPrice <= 0 || T <= 0 || S <= 0 || K <= 0 || isNaN(marketPrice)) return 0;
  
  const optType = (type || 'CE').toUpperCase();
  const discount = Math.exp(-r * T);

  // Theoretical bounds check
  const lowerBound = isCommodity
    ? (optType === 'CE' ? discount * Math.max(0, S - K) : discount * Math.max(0, K - S))
    : (optType === 'CE' ? Math.max(0, S - K * discount) : Math.max(0, K * discount - S));

  const upperBound = isCommodity
    ? (optType === 'CE' ? S * discount : K * discount)
    : (optType === 'CE' ? S : K * discount);

  if (marketPrice < lowerBound * 0.95 || marketPrice > upperBound * 1.05) return 0;

  // Newton-Raphson Iteration
  let sigma = 0.25;
  for (let iter = 0; iter < 20; iter++) {
    const greeks = calculateGreeks(optType, S, K, T, r, sigma, isCommodity);
    const diff = greeks.price - marketPrice;
    if (Math.abs(diff) < 0.01 || Math.abs(diff) / Math.max(1, marketPrice) < 0.001) {
      return Number(Math.max(0.01, Math.min(3.0, sigma)).toFixed(4));
    }
    const vegaSlope = greeks.vega * 100; // Unscale vega
    if (vegaSlope < 1e-4) break; // Degenerate vega: fallback to bisection
    const nextSigma = sigma - diff / vegaSlope;
    if (nextSigma <= 0.001 || nextSigma > 3.5 || isNaN(nextSigma)) break;
    sigma = nextSigma;
  }

  // Bisection Fallback
  let low = 0.001;
  let high = 3.0; // Reasonable cap: max 300% IV
  let mid = 0.25;

  for (let i = 0; i < 40; i++) {
    mid = (low + high) / 2;
    const greeks = calculateGreeks(optType, S, K, T, r, mid, isCommodity);
    const diff = greeks.price - marketPrice;
    
    if (Math.abs(diff) < 0.01 || Math.abs(diff) / Math.max(1, marketPrice) < 0.002) {
      return Number(mid.toFixed(4));
    }
    
    if (greeks.price > marketPrice) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return Number(Math.max(0.01, Math.min(3.0, mid)).toFixed(4));
}
