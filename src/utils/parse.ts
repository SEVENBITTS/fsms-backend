export function clampLimit(limit: number, min = 1, max = 200): number {
  if (!Number.isFinite(limit)) return 50;
  return Math.max(min, Math.min(max, Math.trunc(limit)));
}