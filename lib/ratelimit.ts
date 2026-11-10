// Sliding-window limiter, in memory.
// shortcut: state lives in one server process, so on serverless each instance counts alone.
// Upgrade to a shared store (Redis/KV) if this ever needs a hard limit.
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_KEYS = 10_000;

export function rateLimit(key: string, limit: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000)) };
  }
  recent.push(now);
  hits.delete(key); // re-insert so the oldest keys are the first to be evicted
  hits.set(key, recent);
  if (hits.size > MAX_KEYS) hits.delete(hits.keys().next().value as string);
  return { ok: true, retryAfterSec: 0 };
}

export function clientKey(req: Request): string {
  // shortcut: x-forwarded-for is only trustworthy behind a proxy that sets it (Vercel does)
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || req.headers.get("x-real-ip") || "unknown";
}
