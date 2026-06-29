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
 * Calculates the theoretical Option Price and Greeks using the Black-Scholes formula.
 * @param {string} type - 'CE' for Call, 'PE' for Put
 * @param {number} S - Spot Price (Underlying asset price)
 * @param {number} K - Strike Price
 * @param {number} T - Time to Expiration in Years
 * @param {number} r - Risk-free interest rate (e.g., 0.07 for 7%)
 * @param {number} sigma - Volatility (e.g., 0.20 for 20%)
 * @returns {object} { price, delta, gamma, theta, vega }
 */
export function calculateGreeks(type, S, K, T, r, sigma) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) {
    return { price: 0, delta: 0, gamma: 0, theta: 0, vega: 0 };
  }

  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  let price, delta, theta;
  
  const gamma = N_prime(d1) / (S * sigma * Math.sqrt(T));
  const vega = (S * N_prime(d1) * Math.sqrt(T)) / 100; // Divided by 100 for 1% change

  if (type === 'CE') {
    price = S * N(d1) - K * Math.exp(-r * T) * N(d2);
    delta = N(d1);
    theta = (-(S * N_prime(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * N(d2)) / 365;
  } else {
    price = K * Math.exp(-r * T) * N(-d2) - S * N(-d1);
    delta = N(d1) - 1;
    theta = (-(S * N_prime(d1) * sigma) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * N(-d2)) / 365;
  }

  return { price, delta, gamma, theta, vega };
}

/**
 * Reverse-engineers the Implied Volatility (IV) from the Market Price using Newton-Raphson.
 * @param {string} type - 'CE' for Call, 'PE' for Put
 * @param {number} marketPrice - The Last Traded Price (LTP) of the option
 * @param {number} S - Spot Price
 * @param {number} K - Strike Price
 * @param {number} T - Time to Expiration in Years
 * @param {number} r - Risk-free interest rate (e.g., 0.07 for 7%)
 * @returns {number} Implied Volatility as a decimal (e.g., 0.20 = 20%)
 */
export function calculateIV(type, marketPrice, S, K, T, r) {
  if (marketPrice <= 0 || T <= 0 || S <= 0 || K <= 0) return 0;
  
  // Basic bounds checking for intrinsic value
  if (type === 'CE' && marketPrice < (S - K) * Math.exp(-r*T)) return 0;
  if (type === 'PE' && marketPrice < (K - S) * Math.exp(-r*T)) return 0;

  const MAX_ITER = 100;
  const PRECISION = 0.0001;
  let sigma = 0.3; // Initial guess: 30% volatility

  for (let i = 0; i < MAX_ITER; i++) {
    const greeks = calculateGreeks(type, S, K, T, r, sigma);
    const diff = greeks.price - marketPrice;
    
    if (Math.abs(diff) < PRECISION) {
      return sigma;
    }
    
    // If Vega is essentially zero, we can't accurately divide to find the next step
    if (Math.abs(greeks.vega) < 0.00001) {
      break; 
    }
    
    // Note: vega from calculateGreeks is divided by 100, so we multiply by 100 for the exact derivative
    sigma = sigma - (diff / (greeks.vega * 100));
    
    // Bounds limit to prevent extreme divergence
    if (sigma <= 0.001) sigma = 0.001; 
    if (sigma > 5.0) sigma = 5.0; // 500% cap
  }

  return sigma;
}
