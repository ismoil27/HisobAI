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

export function compactDate(date) {
  return date.format("YYYY-MM-DD");
}

export function compactTime(date) {
  return date.format("HH:mm");
}
