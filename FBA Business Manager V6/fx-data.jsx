// fx-data.jsx — FX rates (USD base). The single source for converting supplier
// costs paid in RMB/EUR into USD for landed cost. Today seeded; when the Wise
// FX integration is connected, fxRate() returns the live mid-market rate.
// Rates are "units of currency per 1 USD".
const FX_RATES = { USD: 1, CNY: 7.18, EUR: 0.92 };

// Units of <ccy> per 1 USD.
function fxRate(ccy) { return FX_RATES[(ccy || "USD").toUpperCase()] || 1; }
// Convert an amount in <ccy> to USD.
function fxToUsd(amount, ccy) { const r = fxRate(ccy); return r ? (Number(amount) || 0) / r : (Number(amount) || 0); }
function fxConnected() { return (typeof intgGet === "function" && intgGet("fx")) ? intgGet("fx").status === "connected" : false; }

Object.assign(window, { FX_RATES, fxRate, fxToUsd, fxConnected });
