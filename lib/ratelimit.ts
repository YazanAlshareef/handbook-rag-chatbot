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

// One counter for everyone, so a caller who rotates x-forwarded-for still hits a ceiling.
// shortcut: per server instance and reset on restart; use a shared store for a hard daily cap.
const DAY_MS = 86_400_000;
let day = { start: 0, count: 0 };

export function dailyCap(limit: number, now = Date.now()): boolean {
  if (now - day.start >= DAY_MS) day = { start: now, count: 0 };
  if (day.count >= limit) return false;
  day.count++;
  return true;
}

export function clientKey(req: Request): string {
  // Caveat: x-forwarded-for is client-supplied unless a proxy overwrites it (Vercel does). Without
  // one, anyone can send a new value per request and dodge the per-IP limit; dailyCap still applies.
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || req.headers.get("x-real-ip") || "unknown";
}
