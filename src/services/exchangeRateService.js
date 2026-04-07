const EXCHANGE_API_BASE = "https://api.frankfurter.dev";
const CACHE_TTL_MS = 10 * 60 * 1000;
const rateCache = new Map();

function cacheKey(fromCurrency, toCurrency) {
  return `${String(fromCurrency || "").toUpperCase()}->${String(toCurrency || "").toUpperCase()}`;
}

async function fetchRate(fromCurrency, toCurrency) {
  const from = String(fromCurrency || "").toUpperCase();
  const to = String(toCurrency || "").toUpperCase();

  if (!from || !to || from === to) {
    return 1;
  }

  const key = cacheKey(from, to);
  const now = Date.now();
  const cached = rateCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.rate;
  }

  const url = `${EXCHANGE_API_BASE}/v2/rates?base=${encodeURIComponent(from)}&quotes=${encodeURIComponent(to)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Exchange API request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const rate = Number(Array.isArray(payload) ? payload[0]?.rate : payload?.rates?.[to]);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Exchange API returned an invalid rate.");
  }

  rateCache.set(key, {
    rate,
    expiresAt: now + CACHE_TTL_MS
  });

  return rate;
}

export async function convertAmount(amount, fromCurrency, toCurrency) {
  const numericAmount = Number(amount || 0);
  if (!Number.isFinite(numericAmount) || numericAmount === 0) {
    return 0;
  }

  const from = String(fromCurrency || "").toUpperCase();
  const to = String(toCurrency || "").toUpperCase();
  if (!from || !to || from === to) {
    return numericAmount;
  }

  const rate = await fetchRate(from, to);
  return numericAmount * rate;
}

export async function convertTransactionsTotal(transactions, targetCurrency, filterFn = () => true) {
  const totalsByCurrency = new Map();

  for (const item of transactions) {
    if (!filterFn(item)) {
      continue;
    }

    const sourceCurrency = String(item.transaction_currency || targetCurrency || "UZS").toUpperCase();
    const current = totalsByCurrency.get(sourceCurrency) || 0;
    totalsByCurrency.set(sourceCurrency, current + Number(item.amount || 0));
  }

  let convertedTotal = 0;
  for (const [sourceCurrency, amount] of totalsByCurrency.entries()) {
    convertedTotal += await convertAmount(amount, sourceCurrency, targetCurrency);
  }

  return convertedTotal;
}
