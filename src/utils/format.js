export function formatMoney(amount, currency = "UZS") {
  return new Intl.NumberFormat("uz-UZ", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(Number(amount || 0));
}

export function compactDate(date) {
  return date.format("YYYY-MM-DD");
}

export function compactTime(date) {
  return date.format("HH:mm");
}
