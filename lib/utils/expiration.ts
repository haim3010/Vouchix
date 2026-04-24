export function daysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function expiryLabel(expiresAt: string | null): string {
  const days = daysUntilExpiry(expiresAt);
  if (days === null) return 'No expiry';
  if (days < 0) return 'Expired';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `${days} days left`;
}

export function expiryUrgency(expiresAt: string | null): 'critical' | 'warning' | 'ok' | 'none' {
  const days = daysUntilExpiry(expiresAt);
  if (days === null) return 'none';
  if (days < 0) return 'critical';
  if (days <= 7) return 'critical';
  if (days <= 14) return 'warning';
  return 'ok';
}
