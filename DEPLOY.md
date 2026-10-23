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
                      │  backend (Django + Uvicorn :8000)       │
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
| `docker-compose.yml` | the 4-service stack (db / backend / scheduler / web) |
| `deploy/backend.Dockerfile` | Django image (collectstatic at build, migrate on start) |
| `deploy/web.Dockerfile` | Vite build → nginx image |
| `deploy/nginx.conf` | reverse proxy + SPA + media |
| `deploy/entrypoint.sh` | wait-for-db, migrate, run uvicorn |
| `deploy/deploy.sh` | server-side deploy (git reset + rebuild), used by CI |
| `.env` | **secrets, not committed** — lives only on the server |
| `.env.example` | template for `.env` |
| `.github/workflows/deploy.yml` | checks on push/PR; manual deployment over SSH |

## Manual operations (on the server)

```bash
cd /home/academy/AcademyJournal
docker compose up -d --build      # build & start
docker compose ps                 # status
docker compose logs -f backend    # logs
docker compose exec backend python manage.py createsuperuser
bash deploy/deploy.sh <full-tested-commit-SHA>  # maintenance + backup + migration + deploy
```

## CI/CD (GitHub Actions)

Pushes and pull requests run checks only. To deploy, open Actions → CI/CD →
Run workflow, select `main` and enable the `deploy` checkbox. The same run must
pass all checks before SSH deployment; it deploys that exact commit SHA. Merely
pushing code does not deploy. Required repository **secrets**
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

## Safe upgrade procedure

The first installation is separate from an upgrade: provision `.env`, the database
and media volume before using the upgrade script. Never use `docker compose down -v`
on a server with data.

For upgrades, `deploy/deploy.sh` validates Compose, builds images and runs Django's
production configuration checks before stopping traffic. It then stops web, backend
and scheduler together for a consistent snapshot. Expect brief downtime while the
backup, restore verification, migrations and ownership audit run; a large database
will take longer. The script has a host lock, and CI deploy jobs are serialized.

`deploy/backup.sh` saves a custom-format PostgreSQL dump, media archive, private
runtime `.env`, previous Git revision and SHA-256 checksums under `backups/` (or
`BACKUP_DIR`). It restores the dump into a newly generated temporary database and
drops that test database before marking the backup complete. A failure retains a
`.partial` directory and blocks migrations. Keep a protected off-server copy of
completed backups; the local backup alone cannot protect against disk loss.

After migrations, `audit_tenant_data --strict` must pass before the application
starts. Findings require a human review of historical academy ownership; do not
assign old records to guessed academies. If this step fails, the database has been
migrated and the application stays stopped. Fix the data through a reviewed plan
or restore the complete pre-upgrade state; do not simply restart older code.

Backend readiness checks database access. Deployment also checks scheduler and
web stability, the frontend response and the nginx-to-backend health route before
reporting success. Real sign-in, attendance, purchase and Telegram delivery still
need a smoke test after deployment.

## Recovery rehearsal and rollback

A completed backup can be verified again without touching the live database:

```sh
bash deploy/restore-check.sh /absolute/path/to/backups/<completed-backup>
```

For an actual rollback, first stop web, scheduler and backend. Preserve the failed
state for diagnosis. Verify the chosen backup's `SHA256SUMS`, restore its database
into a fresh database, and restore its media into a fresh volume. Restore the
private environment settings and use the revision in `revision.txt` to rebuild the
matching images. Point the stack at the restored database/volume, then run readiness
and application checks before opening traffic. Database restoration and version
rollback must be coordinated: changing the Git revision alone does not undo a
migration. Never delete the original volumes until the recovered state is verified.
