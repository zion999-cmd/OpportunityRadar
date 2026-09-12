// Small display formatters. Pure functions, no React.

/** "2026-09-12T08:30:00Z" → "2026年9月12日" */
export function formatDateZh(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso.length === 0) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** Relative "x 分钟前 / x 小时前 / x 天前", falling back to the date. */
export function formatRelative(iso: string | null | undefined, now: number = Date.now()): string {
  if (iso === null || iso === undefined || iso.length === 0) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const diffMs = now - t;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return formatDateZh(iso);
}

/** Truncate to n chars with a Chinese ellipsis. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

/** Short one-line situation summary for header / mobile. */
export function situationHeadline(rawText: string): string {
  const line = rawText.split('\n').map((s) => s.trim()).find((s) => s.length > 0);
  return line === undefined ? '正在寻找下一份工作' : clip(line, 22);
}
