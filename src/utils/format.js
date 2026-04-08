const currencyLocales = {
  UZS: "uz-UZ",
  USD: "en-US",
  KRW: "ko-KR",
  RUB: "ru-RU",
  EUR: "de-DE"
};

const zeroDecimalCurrencies = new Set(["KRW", "UZS"]);

export function formatMoney(amount, currency = "UZS") {
  const normalizedCurrency = String(currency || "UZS").toUpperCase();
  const locale = currencyLocales[normalizedCurrency] || "en-US";
  const fractionDigits = zeroDecimalCurrencies.has(normalizedCurrency) ? 0 : 2;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: normalizedCurrency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(Number(amount || 0));
}

export function formatCompactAmount(amount) {
  const numericAmount = Number(amount || 0);
  const absolute = Math.abs(numericAmount);
  const sign = numericAmount < 0 ? "-" : "";

  if (absolute >= 1_000_000_000) {
    return `${sign}${trimCompactNumber(absolute / 1_000_000_000)}b`;
  }

  if (absolute >= 1_000_000) {
    return `${sign}${trimCompactNumber(absolute / 1_000_000)}m`;
  }

  if (absolute >= 1_000) {
    return `${sign}${trimCompactNumber(absolute / 1_000)}k`;
  }

  return `${sign}${Math.round(absolute)}`;
}

function trimCompactNumber(value) {
  return String(Math.floor(value));
}

export function compactDate(date) {
  return date.format("YYYY-MM-DD");
}

export function compactTime(date) {
  return date.format("HH:mm");
}
