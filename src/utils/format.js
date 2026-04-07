export function formatMoney(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(Number(amount || 0));
}

export function compactDate(date) {
  return date.format("YYYY-MM-DD");
}
