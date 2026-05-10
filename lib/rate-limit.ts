/**
 * In-Memory Rate-Limiter (Layer 2: Rate-Limit Firewall)
 *
 * Token-Bucket pro IP. Edge-Runtime-kompatibel (kein setInterval).
 * Für Multi-Instance / Serverless: Redis oder Upstash benutzen.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000; // hard cap gegen Memory-Erosion

// Inline-Cleanup: alle ~100 Requests einmal alte Buckets durchforsten
let opsSinceCleanup = 0;
function maybeCleanup(now: number) {
  if (++opsSinceCleanup < 100 && buckets.size < MAX_BUCKETS) return;
  opsSinceCleanup = 0;
  for (const [k, v] of buckets.entries()) {
    if (v.resetAt < now) buckets.delete(k);
  }
  // Falls trotzdem voll: ältesten 10% löschen
  if (buckets.size >= MAX_BUCKETS) {
    const toDelete = Math.floor(MAX_BUCKETS / 10);
    let i = 0;
    for (const k of buckets.keys()) {
      if (i++ >= toDelete) break;
      buckets.delete(k);
    }
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
};

export function rateLimit(opts: {
  key: string; // typisch: IP oder IP+route
  limit: number; // max Requests
  windowMs: number; // Zeitfenster in ms
}): RateLimitResult {
  const { key, limit, windowMs } = opts;
  const now = Date.now();
  maybeCleanup(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt, limit };
  }

  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);
  const ok = bucket.count <= limit;
  return { ok, remaining, resetAt: bucket.resetAt, limit };
}

/**
 * Liefert die Client-IP aus den Standard-Headers eines Reverse-Proxies.
 * Reihenfolge: X-Forwarded-For → X-Real-IP → Vercel → fallback.
 */
export function getClientIp(req: Request): string {
  const headers = req.headers;
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const xri = headers.get("x-real-ip");
  if (xri) return xri.trim();
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]!.trim();
  return "anonymous";
}
