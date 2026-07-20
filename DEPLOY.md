# AcademyJournal — Deployment (Docker + CI/CD)

Self-hosted deployment on the shared Contabo server (`173.249.29.176`).
The stack is **fully isolated** from the CRM Neo services that run natively on
the same host (system nginx on 80/443, system PostgreSQL 11 on 5432).

## Architecture

```
                      ┌──────────────────────────────────────┐
  Internet  ──:8080── │  web  (nginx:alpine)                  │
                      │   ├─ /            → SPA (Vite build)   │
                      │   ├─ /api, /admin,/static → backend    │
                      │   └─ /media       → media volume       │
                      │                                        │
                      │  backend (Django + Daphne :8000)       │
                      │   └─ migrate on start, single process  │
                      │                                        │
                      │  db  (postgres:16, volume pgdata)      │
                      │   └─ internal only, never published    │
                      └──────────────────────────────────────┘
```

* **Live URLs:** frontend `https://journal.crmneo.com`, backend
  `https://api.journal.crmneo.com`. The **host** nginx (also serving CRM Neo)
  terminates TLS and proxies both to the web container; the web container routes
  by Host header.
* The **SPA** (journal.crmneo.com) calls the API on `api.journal.crmneo.com`
  (baked in at build via `VITE_API_URL`); django-cors-headers allows that origin.
* **Media** is served directly by nginx from the shared `media` volume.
* **Static** (Django admin / DRF) is collected at image build and served by
  whitenoise via the backend.
* Port **8080 is bound to 127.0.0.1 only** (host nginx is the sole entry).
  PostgreSQL is reachable only inside the Docker network.

## Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | the 3-service stack (db / backend / web) |
| `deploy/backend.Dockerfile` | Django image (collectstatic at build, migrate on start) |
| `deploy/web.Dockerfile` | Vite build → nginx image |
| `deploy/nginx.conf` | reverse proxy + SPA + media |
| `deploy/entrypoint.sh` | wait-for-db, migrate, run daphne |
| `deploy/deploy.sh` | server-side deploy (git reset + rebuild), used by CI |
| `.env` | **secrets, not committed** — lives only on the server |
| `.env.example` | template for `.env` |
| `.github/workflows/deploy.yml` | test → deploy-over-SSH |

## Manual operations (on the server)

```bash
cd /home/academy/AcademyJournal
docker compose up -d --build      # build & start
docker compose ps                 # status
docker compose logs -f backend    # logs
docker compose exec backend python manage.py createsuperuser
bash deploy/deploy.sh             # full redeploy (what CI runs)
```

## CI/CD (GitHub Actions)

On every push to `main`: run tests, then SSH into the server and run
`deploy/deploy.sh`. Required repository **secrets**
(Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|-------|
| `SSH_HOST` | `173.249.29.176` |
| `SSH_USER` | `academy` |
| `SSH_KEY`  | the **private** deploy key (whole file, incl. BEGIN/END lines) |

The matching public key is installed in `academy`'s `authorized_keys`, and the
`academy` user is in the `docker` group so it can run compose without root.

## Domains & HTTPS (live)

* DNS: `journal.crmneo.com` and `api.journal.crmneo.com` → `173.249.29.176`.
* Host nginx site: `/etc/nginx/sites-available/academyjournal`
  (reference copy: `deploy/nginx-host/academyjournal.conf`). It terminates TLS
  and proxies both names to `127.0.0.1:8080`.
* TLS: one Let's Encrypt cert covering both names, obtained via webroot
  (`/var/www/certbot`). Auto-renews via the certbot systemd timer; a deploy hook
  (`/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh`) reloads nginx.
  Manual check: `certbot renew --dry-run`.

## Still optional (Telegram bot / Web Push)

Now that HTTPS is live these can be enabled: set `TELEGRAM_BOT_TOKEN` (+ a
`TELEGRAM_WEBHOOK_SECRET`) and generate VAPID keys in `.env`, `docker compose up -d`,
then `docker compose exec backend python manage.py set_telegram_webhook`
(webhook host = `https://api.journal.crmneo.com`).
