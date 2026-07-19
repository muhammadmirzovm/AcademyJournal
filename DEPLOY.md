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

* **Frontend** talks to the API on the **same origin** (`/api`), so there is no
  CORS to configure and nothing to rebuild when the domain is added.
* **Media** is served directly by nginx from the shared `media` volume.
* **Static** (Django admin / DRF) is collected at image build and served by
  whitenoise via the backend.
* Only **port 8080** is published. PostgreSQL is reachable only inside the
  Docker network.

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

## Adding the domain later (HTTPS)

1. Point the domain's A record to `173.249.29.176`.
2. Add a server block in the **host** nginx (the one already on 80/443) that
   proxies the domain to `http://127.0.0.1:8080` and issue a Let's Encrypt cert
   (certbot). No container changes are needed.
3. Append the domain to `ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS` in `.env`,
   then `docker compose up -d`.
4. Telegram bot + Web Push become usable once HTTPS is live: set
   `TELEGRAM_BOT_TOKEN`, generate VAPID keys, then
   `python manage.py set_telegram_webhook`.
