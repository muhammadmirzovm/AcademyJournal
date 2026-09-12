# AcademyJournal frontend

React application built with Vite. Use Node.js 22.12+ (CI uses Node 22).

## Local development

From this directory:

```sh
npm ci
VITE_API_URL=/api npm run dev
```

Open the URL printed by Vite (normally http://localhost:5173). Start the
Django backend separately on port 8000. Vite proxies `/api` and `/media`
to that backend. Local and deployed databases/accounts are separate.

## Checks

```sh
npm run lint -- --max-warnings=0
npm test
npm run build
```

The tests use Node's built-in test runner and mocked Axios adapters; they do
not contact a real API. They cover refresh-token rotation, concurrent and
late unauthorized responses, refresh failure, and account changes while a
refresh is pending.

CI runs these checks on pull requests to `main` and on pushes to `main`.
Deployment waits for both the frontend checks and backend tests to pass.

## React effects

Keep hooks unconditional and include reactive inputs in dependency arrays.
Context hooks live in separate modules so provider files support Fast Refresh.
Editable drafts reset when their source record changes, before rendering the
new record. Route components are loaded on demand.

There are narrow, commented exceptions to `react-hooks/set-state-in-effect`
where an API reload intentionally sets its loading indicator immediately,
or an effect coordinates a timer/URL action. The rule remains enabled for
the rest of the codebase. Do not disable hook rules globally to silence errors.
