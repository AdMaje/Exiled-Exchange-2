import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RequestQueue,
  RequestQueueError,
  parseRetryAfter,
  type HttpResponseLike,
} from "@/mt/economy/queue";

function response(
  status: number,
  headers: Record<string, string> = {},
  body: unknown = {},
): HttpResponseLike {
  return {
    status,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    json: async () => body,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("parseRetryAfter", () => {
  it("reads delta seconds", () => {
    expect(parseRetryAfter("5", 1_000)).toBe(5_000);
    expect(parseRetryAfter("0", 1_000)).toBe(0);
  });

  it("reads an HTTP date", () => {
    const now = Date.parse("2026-10-28T00:00:00Z");
    expect(parseRetryAfter("Wed, 28 Oct 2026 00:00:10 GMT", now)).toBe(10_000);
  });

  it("ignores missing or malformed values", () => {
    expect(parseRetryAfter(null, 0)).toBeNull();
    expect(parseRetryAfter("", 0)).toBeNull();
    expect(parseRetryAfter("soon", 0)).toBeNull();
  });
});

describe("RequestQueue", () => {
  it("keeps at least one second between request starts", async () => {
    vi.useFakeTimers();
    const starts: number[] = [];
    const queue = new RequestQueue(
      async () => {
        starts.push(Date.now());
        return response(200);
      },
      { minSpacingMs: 1000 },
    );

    const first = queue.fetch("/a");
    const second = queue.fetch("/b");
    await vi.advanceTimersByTimeAsync(0);
    await first;
    expect(starts).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(starts).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    await second;
    expect(starts).toHaveLength(2);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(1000);
  });

  it("never runs two requests at once", async () => {
    vi.useFakeTimers();
    let active = 0;
    let maxActive = 0;
    const resolvers: Array<() => void> = [];

    const queue = new RequestQueue(
      async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise<void>((resolve) => resolvers.push(resolve));
        active -= 1;
        return response(200);
      },
      { minSpacingMs: 0 },
    );

    const first = queue.fetch("/a");
    const second = queue.fetch("/b");
    await vi.advanceTimersByTimeAsync(0);
    expect(active).toBe(1);

    resolvers.shift()?.();
    await first;
    await vi.advanceTimersByTimeAsync(0);
    expect(active).toBe(1);
    expect(maxActive).toBe(1);

    resolvers.shift()?.();
    await second;
    expect(maxActive).toBe(1);
  });

  it("honors Retry-After before retrying", async () => {
    vi.useFakeTimers();
    const starts: number[] = [];
    const impl = vi.fn(async () => {
      starts.push(Date.now());
      return impl.mock.calls.length === 1
        ? response(429, { "retry-after": "5" })
        : response(200);
    });
    const queue = new RequestQueue(impl, {
      minSpacingMs: 0,
      baseBackoffMs: 2000,
    });

    const promise = queue.fetch("/x");
    await vi.advanceTimersByTimeAsync(0);
    expect(impl).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).resolves.toMatchObject({ status: 200 });
    expect(impl).toHaveBeenCalledTimes(2);
    expect(starts[1] - starts[0]).toBe(5000);
  });

  it("backs off exponentially on 5xx", async () => {
    vi.useFakeTimers();
    const starts: number[] = [];
    const statuses = [500, 503, 200];
    const impl = vi.fn(async () => {
      starts.push(Date.now());
      const status = statuses[starts.length - 1];
      return response(status);
    });
    const queue = new RequestQueue(impl, {
      minSpacingMs: 0,
      baseBackoffMs: 2000,
    });

    const promise = queue.fetch("/x");
    await vi.advanceTimersByTimeAsync(6000);
    await expect(promise).resolves.toMatchObject({ status: 200 });
    expect(impl).toHaveBeenCalledTimes(3);
    expect(starts[1] - starts[0]).toBe(2000);
    expect(starts[2] - starts[1]).toBe(4000);
  });

  it("stops after the retry budget and reports the last status", async () => {
    vi.useFakeTimers();
    const impl = vi.fn(async () => response(503));
    const queue = new RequestQueue(impl, {
      minSpacingMs: 0,
      baseBackoffMs: 2000,
      maxRetries: 2,
    });

    const promise = queue.fetch("/x").catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(6000);
    const error = await promise;

    expect(error).toBeInstanceOf(RequestQueueError);
    expect(error).toMatchObject({ status: 503, attempts: 3 });
    expect(impl).toHaveBeenCalledTimes(3);
  });

  it("does not wait for an unreasonable Retry-After", async () => {
    const impl = vi.fn(async () => response(503, { "retry-after": "3600" }));
    const queue = new RequestQueue(impl, { minSpacingMs: 0 });

    await expect(queue.fetch("/x")).rejects.toMatchObject({
      status: 503,
      attempts: 1,
    });
    expect(impl).toHaveBeenCalledTimes(1);
  });

  it("does not retry client errors", async () => {
    const impl = vi.fn(async () => response(404));
    const queue = new RequestQueue(impl, { minSpacingMs: 0 });

    await expect(queue.fetch("/x")).rejects.toMatchObject({
      status: 404,
      attempts: 1,
    });
    expect(impl).toHaveBeenCalledTimes(1);
  });

  it("wraps network failures without retrying", async () => {
    const impl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const queue = new RequestQueue(impl, { minSpacingMs: 0 });

    await expect(queue.fetch("/x")).rejects.toMatchObject({
      name: "RequestQueueError",
      status: null,
      attempts: 1,
    });
  });
});
