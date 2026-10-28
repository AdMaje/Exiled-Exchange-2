/**
 * MT: serialized, polite request queue for the economy provider.
 *
 * Separate from (and never touching) the upstream trade `RateLimiter`:
 * at most one in-flight request, at least `minSpacingMs` between request
 * starts, exponential backoff on 429/5xx, `Retry-After` honored. Every
 * dependency (clock, sleep, fetch) is injectable so tests use fake timers.
 */

export interface HttpResponseLike {
  readonly status: number;
  readonly headers: {
    get(name: string): string | null;
  };
  json(): Promise<unknown>;
}

export interface FetchInitLike {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export type FetchLike = (
  url: string,
  init?: FetchInitLike,
) => Promise<HttpResponseLike>;

export interface RequestQueueOptions {
  minSpacingMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  /** Longer `Retry-After` values abort instead of freezing the UI. */
  maxRetryAfterMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class RequestQueueError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly attempts: number,
  ) {
    super(message);
    this.name = "RequestQueueError";
  }
}

const DEFAULTS = {
  minSpacingMs: 1000,
  maxRetries: 3,
  baseBackoffMs: 2000,
  maxRetryAfterMs: 60_000,
};

/** Parse `Retry-After` (delta seconds or HTTP date) into milliseconds. */
export function parseRetryAfter(
  value: string | null,
  now: number,
): number | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : null;
  }

  const date = Date.parse(trimmed);
  if (!Number.isFinite(date)) return null;
  return Math.max(0, date - now);
}

export class RequestQueue {
  private tail: Promise<void> = Promise.resolve();
  private lastStart = Number.NEGATIVE_INFINITY;

  private readonly minSpacingMs: number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly maxRetryAfterMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly fetchImpl: FetchLike,
    options: RequestQueueOptions = {},
  ) {
    this.minSpacingMs = options.minSpacingMs ?? DEFAULTS.minSpacingMs;
    this.maxRetries = options.maxRetries ?? DEFAULTS.maxRetries;
    this.baseBackoffMs = options.baseBackoffMs ?? DEFAULTS.baseBackoffMs;
    this.maxRetryAfterMs = options.maxRetryAfterMs ?? DEFAULTS.maxRetryAfterMs;
    this.now = options.now ?? Date.now;
    this.sleep =
      options.sleep ??
      ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  }

  /** Serialize one request (with retries) behind every earlier request. */
  async fetch(
    url: string,
    init: FetchInitLike = {},
    maxRetries = this.maxRetries,
  ): Promise<HttpResponseLike> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await this.execute(url, init, maxRetries);
    } finally {
      release();
    }
  }

  private async execute(
    url: string,
    init: FetchInitLike,
    maxRetries: number,
  ): Promise<HttpResponseLike> {
    let attempt = 0;

    for (;;) {
      await this.waitForSlot();

      let response: HttpResponseLike;
      try {
        response = await this.fetchImpl(url, init);
      } catch (error) {
        throw new RequestQueueError(
          error instanceof Error ? error.message : "network error",
          null,
          attempt + 1,
        );
      }

      if (response.status !== 429 && response.status < 500) {
        if (response.status >= 400 && response.status !== 304) {
          throw new RequestQueueError(
            `request failed with ${response.status}`,
            response.status,
            attempt + 1,
          );
        }
        return response;
      }

      const retryAfter = parseRetryAfter(
        response.headers.get("retry-after"),
        this.now(),
      );
      if (retryAfter !== null && retryAfter > this.maxRetryAfterMs) {
        throw new RequestQueueError(
          `retry-after too long (${Math.round(retryAfter / 1000)}s)`,
          response.status,
          attempt + 1,
        );
      }

      if (attempt >= maxRetries) {
        throw new RequestQueueError(
          `request failed with ${response.status} after ${attempt + 1} attempts`,
          response.status,
          attempt + 1,
        );
      }

      const backoff = this.baseBackoffMs * 2 ** attempt;
      attempt += 1;
      await this.sleep(retryAfter ?? backoff);
    }
  }

  private async waitForSlot(): Promise<void> {
    const waitMs = this.lastStart + this.minSpacingMs - this.now();
    if (Number.isFinite(waitMs) && waitMs > 0) {
      await this.sleep(waitMs);
    }
    this.lastStart = this.now();
  }
}
