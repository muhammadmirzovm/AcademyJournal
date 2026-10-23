# AcademyJournal

React/Vite application with a Django REST API for academy administration, teaching journals, quizzes, examinations, Telegram reports and a coin/reward shop.

## Local development

Use Python 3.13 and Node.js 22. From the repository root:

```sh
python3.13 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
cd frontend
npm ci
npm run dev
```

For a separate backend terminal, configure development settings explicitly. Real credentials belong in untracked environment files; do not copy deployment database credentials into a test environment.

```sh
cd backend
export DEBUG=true
export SECRET_KEY='replace-with-a-local-development-key'
export ALLOWED_HOSTS='localhost,127.0.0.1'
export DATABASE_URL='sqlite:///db.sqlite3'
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver
```

The old `backend/venv` directory may reference an interpreter that has been removed. The supported environment is now `backend/.venv`; the old directory is preserved.

## Checks

From the repository root:

```sh
backend/.venv/bin/python -m pytest
cd frontend
npm test
npm run lint -- --max-warnings=0
npm run build
npm audit
npx playwright install chromium
npm run test:e2e
```

Default test settings use an in-memory SQLite database and disable outbound Telegram/push credentials. Set `TEST_DATABASE_URL` to an **isolated test PostgreSQL database** to run concurrency tests as well. Never point it at a production database. CI runs against PostgreSQL 16 and runs the browser tests with installed Chromium.

## Access model

Academy admins manage resources within their own academy; teachers manage their assigned groups and students. Students must be enrolled, and parents must have a linked child. Private enrollment keys and Telegram configuration are restricted to staff. Teacher invitation lists contain only their own invitations.

The Django `/admin/` site is for **platform superusers**. Tenant staff use the normal application, whose API enforces academy and relationship checks. A Django `is_staff` flag or model permission alone does not grant raw model administration.

Groups, announcements, topics and coin transactions retain their academy when a staff member or student leaves. Removing a member revokes their enrollments and parent links; reassign a teacher's groups before removing them. A student's coin balance is scoped to their current academy.

## Deployment changes

1. Push/PR runs CI without deploying. When ready, manually run the CI/CD workflow on main with `deploy` enabled. The upgrade script makes and restores a backup before migrations, then requires a clean ownership audit before accepting traffic. See `DEPLOY.md` for maintenance and recovery details. The Compose entrypoint also applies pending migrations on a direct start; use the upgrade script for existing production data.
2. New migrations backfill academy ownership from the current group teacher, announcement author/group, topic creator and transaction student. Historical ownership already lost through earlier account transfers cannot be reconstructed automatically; reconcile any affected or unassigned records before relying on historical tenant totals.
3. Set `DEBUG=false`, a unique `SECRET_KEY` and explicit `ALLOWED_HOSTS`. Static assets use Django's `STORAGES` configuration. Production environment variables are required at runtime.
4. Run exactly **one** `python manage.py run_scheduler` process. Compose includes a separate `scheduler` service; web workers and management commands no longer start schedulers. For other hosting methods, provision the same separate process and keep it running. Report time changes are picked up within one minute.
5. The backend readiness check now calls `/api/health/`, which verifies database access. Deployment exits with an error if readiness does not succeed.
6. Password changes invalidate prior access and refresh tokens. Enabling password-based token revocation also requires users with older tokens to sign in again after this upgrade.
7. `NUM_PROXIES=2` matches the Compose deployment's two trusted nginx proxies; the Fly configurations use `1`. Set this to the actual trusted proxy count for other hosting. Apply the updated host nginx reference configuration when updating that host: it overwrites incoming forwarded client identities so clients cannot spoof rate-limit buckets.

See `DEPLOY.md` for the existing host/nginx setup. No production deployment is performed by running the local checks above.

## Ownership audit and scheduler lease

Before deploying against existing data, run:

```sh
cd backend
.venv/bin/python manage.py audit_tenant_data --strict
```

This command only reports counts of missing academy ownership and invalid group, parent and invitation links. It does not alter or guess historical data. Review any findings against a database backup before making corrections.

`run_scheduler` now acquires an exclusive PostgreSQL advisory lock on a dedicated connection. A second process exits instead of sending duplicate reports; losing the lease connection stops the scheduler. Local SQLite development uses a file lock. The Compose service should still have one replica.

The production ASGI server is Uvicorn. Updated Docker and startup scripts use it in place of Daphne/Twisted, removing the unused IMAP server dependency from this HTTP application. Reinstall `backend/requirements.txt` when updating an existing environment; obsolete Daphne/Twisted installations can be removed if no other application uses that environment.

CI runs both npm and Python dependency vulnerability audits before deployment. These checks depend on the advisory databases available at the time of each run.
