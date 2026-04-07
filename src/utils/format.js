export function formatMoney(amount) {
  return new Intl.NumberFormat("uz-UZ", {
    maximumFractionDigits: 2
  }).format(Number(amount || 0));
}

export function compactDate(date) {
  return date.format("YYYY-MM-DD");
}

export function compactTime(date) {
  return date.format("HH:mm");
}
