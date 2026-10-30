import { describe, expect, it, vi } from "vitest";
import { describeBackend, runHealthCheck, validateBaseUrl, type HealthCheckResult } from "@/lib/health-client";

const reply = (status: number, body: unknown) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

describe("validateBaseUrl", () => {
  it("normalises valid URLs", () => {
    expect(validateBaseUrl(" http://localhost:8003/ ")).toEqual({ ok: true, baseUrl: "http://localhost:8003" });
    expect(validateBaseUrl("https://lab.example.com/api/")).toEqual({ ok: true, baseUrl: "https://lab.example.com/api" });
  });

  it.each([
    ["", /Enter a backend/],
    ["localhost:8001", /Did you mean http:\/\/localhost:8001/],
    ["ftp://files.example.com", /Unsupported scheme/],
    ["http://", /not a valid URL/],
    ["http://admin:secret@localhost:8001", /username\/password/],
    ["http://localhost:8001/?debug=1", /without \?query/],
  ])("rejects %j", (input, reason) => {
    const result = validateBaseUrl(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(reason);
  });
});

describe("runHealthCheck", () => {
  it.each([
    ["api", "http://localhost:8003/health"],
    ["app", "http://localhost:8003/health/app"],
    ["db", "http://localhost:8003/health/db"],
  ] as const)("requests the %s endpoint directly at %s", async (check, url) => {
    const fetchFn = vi.fn().mockResolvedValue(reply(200, { status: "healthy" }));
    const result = await runHealthCheck("http://localhost:8003", check, { timeoutMs: 1000, fetchFn });
    expect(fetchFn).toHaveBeenCalledWith(url, expect.objectContaining({ method: "GET", cache: "no-store" }));
    expect(result.requestUrl).toBe(url);
  });

  it("marks healthy responses", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(200, { status: "healthy", service: "express-mongodb-api" }));
    const result = await runHealthCheck("http://x", "api", { timeoutMs: 1000, fetchFn });
    expect(result).toMatchObject({ state: "healthy", httpStatus: 200 });
    expect(result.responseTimeMs).toBeTypeOf("number");
    expect(Date.parse(result.checkedAt)).not.toBeNaN();
  });

  it("marks 503 responses unhealthy", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(503, { status: "unhealthy", database: "mongodb" }));
    const result = await runHealthCheck("http://x", "db", { timeoutMs: 1000, fetchFn });
    expect(result).toMatchObject({ state: "unhealthy", httpStatus: 503 });
  });

  it("reports network errors", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await runHealthCheck("http://x", "api", { timeoutMs: 1000, fetchFn });
    expect(result).toMatchObject({ state: "network-error", httpStatus: null });
    expect(result.detail).toMatch(/CORS/);
  });

  it("reports timeouts", async () => {
    const neverAnswers: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
    const result = await runHealthCheck("http://x", "api", { timeoutMs: 40, fetchFn: neverAnswers });
    expect(result.state).toBe("timeout");
    expect(result.detail).toMatch(/40 ms/);
  });

  it("treats a caller abort as a network error, not a timeout", async () => {
    const controller = new AbortController();
    const neverAnswers: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
    const pending = runHealthCheck("http://x", "api", { timeoutMs: 5000, signal: controller.signal, fetchFn: neverAnswers });
    controller.abort();
    expect((await pending).state).toBe("network-error");
  });

  it("rejects invalid URLs without a request", async () => {
    const fetchFn = vi.fn();
    const result = await runHealthCheck("not a url", "api", { timeoutMs: 1000, fetchFn });
    expect(result.state).toBe("invalid-url");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("flags non-JSON and unrecognised responses", async () => {
    const html = await runHealthCheck("http://x", "api", {
      timeoutMs: 1000,
      fetchFn: vi.fn().mockResolvedValue(reply(200, "<!doctype html>")),
    });
    expect(html.state).toBe("unexpected-response");

    const notFound = await runHealthCheck("http://x", "api", {
      timeoutMs: 1000,
      fetchFn: vi.fn().mockResolvedValue(reply(404, { detail: "Not Found" })),
    });
    expect(notFound).toMatchObject({ state: "unexpected-response", httpStatus: 404 });
  });
});

describe("describeBackend", () => {
  const result = (check: HealthCheckResult["check"], json: unknown): HealthCheckResult => ({
    check, json, state: "healthy", requestUrl: "http://x", httpStatus: 200,
    responseTimeMs: 1, detail: "", checkedAt: new Date().toISOString(),
  });

  it("reads single-database backends", () => {
    expect(
      describeBackend({
        api: result("api", { status: "healthy", service: "go-cassandra-api" }),
        db: result("db", { status: "healthy", database: "cassandra", message: "ok" }),
      }),
    ).toEqual({ serviceName: "go-cassandra-api", databaseType: "cassandra", databaseStatus: "healthy", databases: [] });
  });

  it("reads the per-database breakdown of multi-database backends", () => {
    const overview = describeBackend({
      app: result("app", {
        status: "unhealthy",
        service: "python-stdlib-redis-influxdb-api",
        database: {
          status: "unhealthy",
          type: "redis,influxdb",
          redis: { status: "unhealthy", type: "redis" },
          influxdb: { status: "healthy", type: "influxdb" },
        },
      }),
    });
    expect(overview.databaseType).toBe("redis,influxdb");
    expect(overview.databases).toEqual([
      { name: "redis", status: "unhealthy" },
      { name: "influxdb", status: "healthy" },
    ]);
  });
});
