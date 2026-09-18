/**
 * Per-client enquiry rate limiting.
 *
 * Written as a pure function over an injectable store and clock so it can be
 * unit-tested without timers. The MVP store is in-memory and therefore best
 * effort and per instance: on Vercel each serverless instance keeps its own
 * counts. For production, move this behind a Vercel WAF rate-limit rule or a
 * shared store such as Upstash Redis — see docs/security-review.md.
 */

export interface RateLimitConfig {
  perTenMinutes: number;
  perDay: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds the client should wait before retrying, when blocked. */
  retryAfter: number;
}

interface Bucket {
  /** Epoch-millisecond timestamps of recent requests, oldest first. */
  hits: number[];
}

const TEN_MINUTES = 10 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

export type RateLimitStore = Map<string, Bucket>;

export function createStore(): RateLimitStore {
  return new Map();
}

/**
 * Records a request for `key` and says whether it may proceed.
 * Pass `now` explicitly in tests; production passes `Date.now()`.
 */
export function checkRateLimit(
  store: RateLimitStore,
  key: string,
  config: RateLimitConfig,
  now: number,
): RateLimitDecision {
  const bucket = store.get(key) ?? { hits: [] };

  // Drop anything outside the longest window, which also bounds memory use.
  const hits = bucket.hits.filter((time) => now - time < ONE_DAY);

  const inTenMinutes = hits.filter((time) => now - time < TEN_MINUTES);

  if (inTenMinutes.length >= config.perTenMinutes) {
    const oldest = inTenMinutes[0]!;
    store.set(key, { hits });
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((oldest + TEN_MINUTES - now) / 1000)) };
  }

  if (hits.length >= config.perDay) {
    const oldest = hits[0]!;
    store.set(key, { hits });
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((oldest + ONE_DAY - now) / 1000)) };
  }

  hits.push(now);
  store.set(key, { hits });
  return { allowed: true, retryAfter: 0 };
}

/** Removes buckets with no recent activity, so a long-lived instance stays small. */
export function pruneStore(store: RateLimitStore, now: number): void {
  for (const [key, bucket] of store) {
    if (bucket.hits.every((time) => now - time >= ONE_DAY)) store.delete(key);
  }
}

/** Process-wide store for the running instance. */
export const defaultStore: RateLimitStore = createStore();
