import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, TimeoutError, catchError, map, of, timeout } from 'rxjs';
import { HEALTH_REQUEST_TIMEOUT_MS } from './backends';
import { CHECKS, CheckKind, CheckResult, HealthResponse } from './health.models';

/** Validates a base URL and returns it without a trailing slash, or an error message. */
export function validateBaseUrl(input: string): { url: string } | { error: string } {
  const value = input.trim();
  if (!value) {
    return { error: 'Enter a backend API URL, for example http://localhost:8001.' };
  }
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
    return { error: `Missing scheme. Did you mean http://${value}?` };
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { error: 'This is not a valid URL.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: 'Only http:// and https:// URLs are supported.' };
  }
  if (parsed.username || parsed.password) {
    return { error: 'Do not include credentials in the URL.' };
  }
  if (parsed.search || parsed.hash) {
    return { error: 'Remove the query string or #fragment.' };
  }
  return { url: parsed.origin + parsed.pathname.replace(/\/+$/, '') };
}

function reportedStatus(body: unknown): unknown {
  return typeof body === 'object' && body !== null ? (body as { status?: unknown }).status : undefined;
}

/** Calls the health endpoints of a lab backend. Every Observable emits exactly one CheckResult and never errors. */
@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);
  private readonly timeoutMs = inject(HEALTH_REQUEST_TIMEOUT_MS);

  check(baseUrl: string, kind: CheckKind): Observable<CheckResult> {
    const validation = validateBaseUrl(baseUrl);
    if ('error' in validation) {
      return of(this.result(kind, 'invalid-url', null, validation.error));
    }

    const url = validation.url + CHECKS.find((c) => c.kind === kind)!.path;
    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);

    return this.http
      .get<HealthResponse>(url, { observe: 'response', headers: { Accept: 'application/json' } })
      .pipe(
        timeout(this.timeoutMs),
        map((response: HttpResponse<HealthResponse>) => this.fromResponse(kind, url, response.status, response.body, elapsed())),
        catchError((error: unknown) => of(this.fromError(kind, url, error, elapsed()))),
      );
  }

  private fromResponse(kind: CheckKind, url: string, status: number, body: unknown, ms: number): CheckResult {
    const reported = reportedStatus(body);
    if (status >= 200 && status < 300 && reported === 'healthy') {
      return this.result(kind, 'healthy', url, `HTTP ${status}: the endpoint reported healthy.`, status, ms, body);
    }
    if (status === 503 || reported === 'unhealthy') {
      return this.result(kind, 'unhealthy', url, `HTTP ${status}: the endpoint reported unhealthy.`, status, ms, body);
    }
    return this.result(kind, 'unexpected-response', url, `HTTP ${status} without a recognised health status.`, status, ms, body);
  }

  private fromError(kind: CheckKind, url: string, error: unknown, ms: number): CheckResult {
    if (error instanceof TimeoutError) {
      return this.result(kind, 'timeout', url, `No response within ${this.timeoutMs / 1000} s.`, null, ms);
    }
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        // Status 0: the request never got a usable response. Browsers report refused connections,
        // DNS failures and CORS rejections identically, so the message names all of them.
        return this.result(
          kind,
          'connection-failed',
          url,
          'Connection failed: the backend is not running, the URL is wrong, or CORS blocked the request.',
          null,
          ms,
        );
      }
      // Non-2xx responses arrive here; 503 with a health body is a normal "unhealthy" answer.
      const body = typeof error.error === 'string' ? this.tryParse(error.error) : error.error;
      if (typeof body === 'string' || body === null) {
        return this.result(kind, 'unexpected-response', url, `HTTP ${error.status}: the response is not JSON.`, error.status, ms, body);
      }
      return this.fromResponse(kind, url, error.status, body, ms);
    }
    // A 2xx response whose body could not be parsed as JSON.
    return this.result(kind, 'unexpected-response', url, 'The response could not be read as JSON.', null, ms);
  }

  private tryParse(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return text.slice(0, 1000);
    }
  }

  private result(
    kind: CheckKind,
    state: CheckResult['state'],
    url: string | null,
    message: string,
    httpStatus: number | null = null,
    responseTimeMs: number | null = null,
    body: unknown = null,
  ): CheckResult {
    return {
      kind,
      state,
      url,
      message,
      httpStatus,
      responseTimeMs,
      body: body as CheckResult['body'],
      checkedAt: new Date(),
    };
  }
}
