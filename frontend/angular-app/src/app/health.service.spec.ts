import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { HEALTH_REQUEST_TIMEOUT_MS } from './backends';
import { CheckResult } from './health.models';
import { HealthService, validateBaseUrl } from './health.service';

describe('validateBaseUrl', () => {
  it('accepts http(s) URLs and removes trailing slashes', () => {
    expect(validateBaseUrl(' http://localhost:8004/ ')).toEqual({ url: 'http://localhost:8004' });
    expect(validateBaseUrl('https://lab.example.com/api/')).toEqual({ url: 'https://lab.example.com/api' });
  });

  it.each([
    ['', /Enter a backend API URL/],
    ['localhost:8004', /Did you mean http:\/\/localhost:8004/],
    ['ftp://example.com', /Only http/],
    ['http://', /not a valid URL/],
    ['http://u:p@localhost:8004', /credentials/],
    ['http://localhost:8004/#x', /fragment/],
  ])('rejects %j', (input, message) => {
    const result = validateBaseUrl(input);
    expect('error' in result && result.error).toMatch(message);
  });
});

describe('HealthService', () => {
  let service: HealthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: HEALTH_REQUEST_TIMEOUT_MS, useValue: 50 },
      ],
    });
    service = TestBed.inject(HealthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Starts a check and returns the pending request plus the eventual result. */
  function start(kind: 'api' | 'app' | 'db', baseUrl = 'http://localhost:8004') {
    let result: CheckResult | undefined;
    service.check(baseUrl, kind).subscribe((r) => (result = r));
    return { getResult: () => result };
  }

  it.each([
    ['api', 'http://localhost:8004/health'],
    ['app', 'http://localhost:8004/health/app'],
    ['db', 'http://localhost:8004/health/db'],
  ] as const)('calls the %s endpoint at %s', (kind, url) => {
    start(kind);
    const req = http.expectOne(url);
    expect(req.request.method).toBe('GET');
    req.flush({ status: 'healthy' });
  });

  it('reports a healthy response', () => {
    const { getResult } = start('api');
    http.expectOne('http://localhost:8004/health').flush({ status: 'healthy', service: 'go-cassandra-api' });
    expect(getResult()).toMatchObject({
      state: 'healthy',
      httpStatus: 200,
      body: { status: 'healthy', service: 'go-cassandra-api' },
    });
    expect(getResult()!.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('reports a 503 as unhealthy and keeps the JSON body', () => {
    const body = { status: 'unhealthy', database: 'cassandra', message: 'Database connection failed' };
    const { getResult } = start('db');
    http.expectOne('http://localhost:8004/health/db').flush(body, { status: 503, statusText: 'Service Unavailable' });
    expect(getResult()).toMatchObject({ state: 'unhealthy', httpStatus: 503, body });
  });

  it('reports network failures (status 0) as connection failed', () => {
    const { getResult } = start('api');
    http.expectOne('http://localhost:8004/health').error(new ProgressEvent('error'));
    expect(getResult()).toMatchObject({ state: 'connection-failed', httpStatus: null });
    expect(getResult()!.message).toMatch(/CORS/);
  });

  it('reports a timeout when no response arrives', async () => {
    const result = firstValueFrom(service.check('http://localhost:8004', 'api'));
    const req = http.expectOne('http://localhost:8004/health');
    expect((await result).state).toBe('timeout');
    expect(req.cancelled).toBe(true);
  });

  it('reports invalid URLs without sending a request', () => {
    const { getResult } = start('api', 'localhost:8004');
    http.expectNone(() => true);
    expect(getResult()).toMatchObject({ state: 'invalid-url', url: null });
  });

  it('flags non-JSON and unrecognised responses', () => {
    const html = start('api');
    http.expectOne('http://localhost:8004/health').flush('<h1>Not Found</h1>', { status: 404, statusText: 'Not Found' });
    expect(html.getResult()).toMatchObject({ state: 'unexpected-response', httpStatus: 404 });

    const other = start('api');
    http.expectOne('http://localhost:8004/health').flush({ detail: 'Not Found' }, { status: 404, statusText: 'Not Found' });
    expect(other.getResult()).toMatchObject({ state: 'unexpected-response', httpStatus: 404 });
  });
});
