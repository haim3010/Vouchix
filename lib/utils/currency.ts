export function formatCurrency(amount: number, currency = 'ILS'): string {
  if (currency === 'ILS') {
    return `₪${amount.toFixed(2)}`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function discountPercent(original: number, listing: number): number {
  return Math.round(((original - listing) / original) * 100);
}
