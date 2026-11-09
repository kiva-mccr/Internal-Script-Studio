// "just now", "12 min ago", "3 h ago", "yesterday", "4 days ago", then "Oct 28" (and the year if not this one).
export function ago(time: number, now = Date.now()): string {
  const min = Math.floor((now - time) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} h ago`;
  const days = Math.floor(min / (24 * 60));
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const date = new Date(time);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
}
