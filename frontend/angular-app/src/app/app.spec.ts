import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let http: HttpTestingController;
  let page: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(App);
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  const button = (label: string) =>
    [...page.querySelectorAll('button')].find((b) => b.textContent!.trim() === label) as HTMLButtonElement;
  const card = (title: string) => page.querySelector(`article[aria-label="${title}"]`) as HTMLElement;
  const select = () => page.querySelector('select') as HTMLSelectElement;
  const urlInput = () => page.querySelector('input[type="url"]') as HTMLInputElement;
  const summary = () => page.querySelector('.summary') as HTMLElement;
  const settle = () => fixture.whenStable();

  it('renders the title, six sample backends and no requests on load', () => {
    expect(page.querySelector('h1')!.textContent).toBe('Backend & Database Health Monitor');
    const options = [...select().options].filter((o) => !o.disabled).map((o) => o.textContent!.trim());
    expect(options).toEqual([
      'Django + PostgreSQL',
      'FastAPI + MySQL',
      'Express.js + MongoDB',
      'Go + Cassandra',
      'PHP + SQLite',
      'Python + Redis + InfluxDB',
    ]);
    expect(select().value).toBe('Django + PostgreSQL');
    http.expectNone(() => true);
  });

  it('each button calls its own endpoint', async () => {
    button('Check API Health').click();
    button('Check Application Health').click();
    button('Check Database Health').click();
    await settle();
    for (const path of ['/health', '/health/app', '/health/db']) {
      http.expectOne(`http://localhost:8001${path}`).flush({ status: 'healthy' });
    }
  });

  it('Check All shows a healthy summary and three result cards', async () => {
    button('Check All').click();
    await settle(); // zoneless: the view updates after change detection runs
    expect(card('API Status').getAttribute('data-state')).toBe('loading');

    http.expectOne('http://localhost:8001/health').flush({ status: 'healthy', service: 'django-postgres-api' });
    http.expectOne('http://localhost:8001/health/app').flush({
      status: 'healthy',
      service: 'django-postgres-api',
      database: { status: 'healthy', type: 'postgresql' },
    });
    http.expectOne('http://localhost:8001/health/db').flush({
      status: 'healthy',
      database: 'postgresql',
      message: 'Database connection successful',
    });
    await settle();

    expect(summary().textContent).toContain('django-postgres-api');
    expect(summary().textContent).toContain('postgresql');
    for (const title of ['API Status', 'Application Status', 'Database Status']) {
      expect(card(title).getAttribute('data-state')).toBe('healthy');
      expect(card(title).querySelector('[data-field="http"]')!.textContent).toBe('200');
      expect(card(title).querySelector('[data-field="time"]')!.textContent).toMatch(/\d+ ms/);
      expect(card(title).textContent).toContain('Raw JSON response');
    }
    expect(page.querySelector('.last-checked')!.textContent).toContain('Last checked:');
  });

  it('shows unhealthy results and connection failures', async () => {
    button('Check All').click();
    http.expectOne('http://localhost:8001/health').flush({ status: 'healthy', service: 'django-postgres-api' });
    http
      .expectOne('http://localhost:8001/health/app')
      .flush(
        { status: 'unhealthy', service: 'django-postgres-api', database: { status: 'unhealthy', type: 'postgresql' } },
        { status: 503, statusText: 'Service Unavailable' },
      );
    http.expectOne('http://localhost:8001/health/db').error(new ProgressEvent('error'));
    await settle();

    expect(card('API Status').getAttribute('data-state')).toBe('healthy');
    expect(card('Application Status').getAttribute('data-state')).toBe('unhealthy');
    expect(card('Application Status').querySelector('[data-field="http"]')!.textContent).toBe('503');
    expect(card('Database Status').getAttribute('data-state')).toBe('connection-failed');
    expect(card('Database Status').textContent).toContain('Connection failed');
  });

  it('switching backend clears results; invalid URLs send no request', async () => {
    button('Check API Health').click();
    http.expectOne('http://localhost:8001/health').flush({ status: 'healthy', service: 'django-postgres-api' });
    await settle();
    expect(card('API Status').getAttribute('data-state')).toBe('healthy');

    select().value = 'PHP + SQLite';
    select().dispatchEvent(new Event('change'));
    await settle();
    expect(urlInput().value).toBe('http://localhost:8005');
    expect(card('API Status').getAttribute('data-state')).toBe('idle');

    urlInput().value = 'localhost:8005';
    urlInput().dispatchEvent(new Event('input'));
    await settle();
    expect(select().value).toBe(''); // "Custom URL"
    button('Check API Health').click();
    await settle();
    http.expectNone(() => true);
    expect(card('API Status').getAttribute('data-state')).toBe('invalid-url');
    expect(card('API Status').textContent).toContain('Did you mean http://localhost:8005?');
  });

  it('lists individual databases for the Python + Redis + InfluxDB backend', async () => {
    select().value = 'Python + Redis + InfluxDB';
    select().dispatchEvent(new Event('change'));
    await settle();
    button('Check Database Health').click();
    http.expectOne('http://localhost:8006/health/db').flush(
      {
        status: 'unhealthy',
        database: 'redis,influxdb',
        message: 'Database connection failed',
        databases: {
          redis: { status: 'unhealthy', database: 'redis', message: 'Database connection failed' },
          influxdb: { status: 'healthy', database: 'influxdb', message: 'Database connection successful' },
        },
      },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await settle();

    const items = [...page.querySelectorAll('.databases li')].map((li) => ({
      name: li.querySelector('span')!.textContent,
      state: li.querySelector('.badge')!.getAttribute('data-state'),
    }));
    expect(items).toEqual([
      { name: 'redis', state: 'unhealthy' },
      { name: 'influxdb', state: 'healthy' },
    ]);
  });
});
