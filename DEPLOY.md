# Deploying Technology Lab

This is the `main` branch. It runs the whole lab on one Linux server behind
[Caddy](https://caddyserver.com), with automatic HTTPS and one subdomain per app. For running on
your own machine, use the `local` branch.

## What you get

| URL | Service |
|-----|---------|
| `https://<DOMAIN>` | Redirects to the React app |
| `https://react.<DOMAIN>` · `https://nextjs.<DOMAIN>` · `https://angular.<DOMAIN>` | Frontends |
| `https://django.<DOMAIN>` · `fastapi.` · `express.` · `go.` · `php.` · `python.` | Backend APIs |

Only ports 80 and 443 (Caddy) are open. The databases, the APIs' own ports and the InfluxDB UI
are reachable only inside the Docker network.

The differences from `local` are all in three root-level files:

- [docker-compose.override.yml](docker-compose.override.yml): loaded automatically by
  `docker compose`. It adds Caddy, removes every other published port, builds the frontends with
  the public `https://<backend>.<DOMAIN>` URLs, sets CORS and Django's allowed hosts, and turns on
  `restart: unless-stopped`.
- [deploy/Caddyfile](deploy/Caddyfile): the subdomain routing.
- [.env.example](.env.example): the one deployment setting, `DOMAIN`.

## Server requirements

- Linux on x86-64 or ARM64, Docker Engine with Compose v2.24 or newer
- **At least 4 GB RAM, 6 GB or more recommended** (Cassandra alone uses about 1 GB), 2+ CPUs,
  about 15 GB disk
- A public IP with inbound TCP 80 and 443 open

**Free option:** Oracle Cloud Always Free, VM shape `VM.Standard.A1.Flex` (ARM) with up to
4 OCPUs and 24 GB RAM. Every image in this stack supports ARM. If you get "Out of host capacity",
try another availability domain or region, or retry later.

## 1. Create the server (Oracle Cloud example)

1. Create a compute instance: image **Ubuntu 24.04**, shape **VM.Standard.A1.Flex**
   (for example 4 OCPUs, 24 GB). Add your SSH public key.
2. In the instance's VCN → **Security List**, add ingress rules for TCP **80** and **443** from
   `0.0.0.0/0` (and UDP 443 if you want HTTP/3).
3. Oracle's Ubuntu images also block these ports in the VM's own firewall. SSH in and run:

   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p udp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

4. Install Docker:

   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker "$USER"   # then log out and back in
   ```

## 2. Point a domain at the server

Caddy needs DNS for the base domain **and** every subdomain before it can get certificates.
Choose one:

| Option | `DOMAIN` value | DNS setup |
|--------|----------------|-----------|
| Your own domain | `lab.example.com` | `A` records for `lab` and `*.lab` → server IP |
| [DuckDNS](https://www.duckdns.org) (free) | `myname.duckdns.org` | Create `myname`, set its IP. Subdomains work automatically. |
| No domain, quick test | `203-0-113-10.sslip.io` | Nothing: [sslip.io](https://sslip.io) resolves the IP in the name. Certificates can occasionally hit Let's Encrypt's shared rate limit. |

Check it from your machine: `nslookup react.<DOMAIN>` should return the server IP.

## 3. Deploy

```bash
git clone -b main https://github.com/kdasaradha25/technology-lab.git
cd technology-lab
sh deploy/init-env.sh        # creates every .env with random passwords and secrets
nano .env                    # set DOMAIN=...
docker compose up -d --build # first build takes 10–20 minutes
docker compose ps            # wait until the databases show "(healthy)"; Cassandra takes 1–2 minutes
```

Then open `https://react.<DOMAIN>`. If the repository is private, sign in on the server first
(for example `gh auth login`, or a read-only deploy key).

`init-env.sh` never overwrites an existing `.env`: the databases keep the password they were
created with, so changing it later means deleting that database's volume (`docker compose down -v`
deletes **all** data).

## Updating

Develop on `local`, merge into `main`, push. Then on the server:

```bash
git pull
docker compose up -d --build
```

## Operations

```bash
docker compose ps                  # status
docker compose logs -f caddy       # certificates and routing
docker compose logs -f django      # one service
docker compose restart express     # restart one service
docker compose down                # stop everything (data volumes are kept)
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `required variable DOMAIN is missing a value` | Set `DOMAIN` in the root `.env`. |
| Browser shows a certificate error, or `caddy` logs `challenge failed` | DNS doesn't point at the server yet, or port 80/443 is blocked (check both the cloud security list and the VM firewall). Caddy retries automatically. |
| A frontend loads but every backend shows a network/CORS error | The frontends were built with an older `DOMAIN`. Run `docker compose up -d --build` after changing it. |
| Containers restart with out-of-memory errors | The server needs more RAM; Cassandra is the largest. |
| Django returns `400 Bad Request` | The request's host isn't `django.<DOMAIN>`; check `DOMAIN`. |
