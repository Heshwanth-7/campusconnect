# CampusConnect

CampusConnect is a mobile-first web app for campus events, QR tickets, and lost and found. This scaffold contains a placeholder home page and a public API health check.

## Local setup

Install Docker with Compose and use the Node.js LTS version selected by `.nvmrc`.

```sh
nvm install
nvm use
npm ci
docker compose up -d --wait
npm run dev
```

Open http://localhost:5173. The client proxies `/api` to Express on port 3000. Check it with `curl -fsS http://localhost:5173/api/health`. Mailpit's web UI is at http://localhost:8025.

PostgreSQL starts on port 5432. The mounted SQL creates `campusconnect` and `campusconnect_test` on first startup with a fresh volume. The test database uses a separate login.

## Checks

```sh
npm run lint
npm run build
npm test
```

Lint uses TypeScript's strict and unused-code checks. The test runner loads `server/.env` when present and requires `DATABASE_URL_TEST` before applying Prisma migrations. You can also set the variable in your shell. See `server/.env.example` for the local database settings. The health route itself is a liveness check.

## Setup references

- [Prisma ORM 7 configuration](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference)
- [Tailwind CSS with Vite](https://tailwindcss.com/docs/installation/using-vite)
- [Vite dev proxy](https://vite.dev/config/server-options#server-proxy)
- [Vitest global setup](https://vitest.dev/config/globalsetup)
