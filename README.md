# Technology Lab

A technology integration lab: three single-page frontends that can each talk to any of six
backends, each backend using a different database. Every project is independent and has its
own dependencies and README.

## Branches

| Branch | Use |
|--------|-----|
| `local` | Run everything on your own machine (`http://localhost:...`). |
| `main` | Deployment: adds HTTPS, one subdomain per app and closed database ports. See `DEPLOY.md` on that branch. |

Make changes on `local`, then merge `local` into `main`. The two branches differ only in a few
deployment files at the repository root, so merges stay clean.

## Structure

```
technology-lab/
├── frontend/
│   ├── react-app/                       React                  :5173  ✅ built
│   ├── nextjs-app/                      Next.js                :3000  ✅ built
│   └── angular-app/                     Angular                :4200  ✅ built
├── backend/
│   ├── django-postgres/                 Django + PostgreSQL    :8001  ✅ built
│   ├── fastapi-mysql/                   FastAPI + MySQL        :8002  ✅ built
│   ├── express-mongodb/                 Express + MongoDB      :8003  ✅ built
│   ├── go-cassandra/                    Go + Cassandra         :8004  ✅ built
│   ├── php-sqlite/                      PHP + SQLite           :8005  ✅ built
│   └── python-stdlib-redis-influxdb/    Python stdlib + Redis + InfluxDB  :8006  ✅ built
├── prompts/                             Build instructions for each project
└── README.md
```

## Shared API contract

Every backend implements these endpoints:

| Method | Endpoint | Purpose | Codes |
|--------|----------|---------|-------|
| GET | `/health` | API process is running (never depends on the DB) | 200 |
| GET | `/health/app` | App health plus database status | 200 / 503 |
| GET | `/health/db` | Real lightweight database operation | 200 / 503 |

Every backend allows CORS from `http://localhost:5173`, `http://localhost:3000` and
`http://localhost:4200`.

## Database host ports

| Database | Host port | Note |
|----------|-----------|------|
| PostgreSQL (django-postgres) | 5433 | 5432 is often taken by a local PostgreSQL install |
| MySQL (fastapi-mysql) | 3306 | |
| MongoDB (express-mongodb) | 27017 | |
| Cassandra (go-cassandra) | 9042 | First start takes 1–2 minutes |
| SQLite (php-sqlite) | — | Embedded file, no server |
| Redis (python-stdlib-redis-influxdb) | 6379 | |
| InfluxDB (python-stdlib-redis-influxdb) | 8086 | UI at http://localhost:8086 |

> The python-stdlib-redis-influxdb backend checks two databases, so its `database` field also
> includes a `redis` and an `influxdb` breakdown. The top-level `database.status` is still the
> combined status, so frontends can treat it like the other backends.

## Run everything with Docker

The root [docker-compose.yml](docker-compose.yml) includes every project's own compose file, so
one command starts all six backends, their databases and the three frontends:

```bash
docker compose up -d --build     # first build takes a while; Cassandra needs 1–2 minutes
docker compose ps                # wait until the databases show "(healthy)"
docker compose logs -f django    # follow one service
docker compose stop postgres     # stop one service (e.g. to test a DB outage)
docker compose down              # stop everything (data volumes are kept)
```

Service names are unique across the stack and are the same in each project's own compose file:

| Project | Services |
|---------|----------|
| django-postgres | `django`, `postgres` |
| fastapi-mysql | `fastapi`, `mysql` |
| express-mongodb | `express`, `mongo` |
| go-cassandra | `go`, `cassandra` |
| php-sqlite | `php` |
| python-stdlib-redis-influxdb | `python`, `redis`, `influxdb` |
| react-app / nextjs-app / angular-app | `react` / `nextjs` / `angular` |

The global stack and the per-project stacks share the same named volumes (and data), container
names and host ports, so run only one of them at a time: `docker compose down` in one before
`up` in the other. Running everything needs a fair amount of memory (give Docker Desktop at least
4 GB; Cassandra alone uses about 1 GB).

See each project's README for setup and run instructions.
