# CampusConnect

Students discover campus events, reserve seats, show a QR ticket at the door, and report lost or found belongings. **The safest viva demo runs from localhost.** It uses a real PostgreSQL database, works with Mailpit without an email account, and avoids hosting cold starts.

## Features and stack

- Students get a feed based on interests, event search, registration deadlines, a first-in waitlist, tickets and notifications.
- Organizers submit events and posters for review, manage seats, scan tickets and see attendance. Admins moderate content, manage accounts and inspect the audit history.
- Lost & Found compares reports and reveals the other student's contact details after both people confirm a match.
- The mobile client uses React, Vite, TypeScript, Tailwind CSS, React Router, React Hook Form, Zod and vite-plugin-pwa. The API uses Express on Node.js, Prisma 7 with its PostgreSQL driver adapter, and Zod. Vitest and Supertest exercise the API against PostgreSQL. Docker Compose runs PostgreSQL 18 and Mailpit.

## From a clean Mac

1. Install Docker Desktop for your Mac's processor. **Open Docker Desktop first** and wait for its engine to be ready. In Terminal, run `docker info` to check it. [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/)
2. Run `xcode-select --install` if Git and the command-line tools are missing. Install nvm following its macOS instructions, then open a new Terminal and check `command -v nvm`. [nvm installation](https://github.com/nvm-sh/nvm#installing-and-updating)
3. Clone the repository and select the project's Node version.

```sh
git clone https://github.com/Heshwanth-7/campusconnect.git
cd campusconnect
nvm install
nvm use
```

4. On the first setup only, create private local settings outside Git. These commands keep generated keys out of terminal output. Keep this file for subsequent runs so existing signatures stay valid.

```sh
mkdir -p "$HOME/.config/campusconnect"
(umask 077
 set -C
 { cat server/.env.example
   echo "JWT_ACCESS_SECRET=$(openssl rand -hex 32)"
   echo "QR_SECRET=$(openssl rand -hex 32)"
 } > "$HOME/.config/campusconnect/local.sh")
```

5. In each new terminal, from the repo root, load these settings. On an existing installation the server scripts also read an existing private `server/.env`. Keep real credentials outside Git.

```sh
set -a
source "$HOME/.config/campusconnect/local.sh"
set +a
```

6. Install the locked dependencies, start the services, apply the database migrations, seed and start both apps.

```sh
npm ci
docker compose up -d --wait
npm run db:deploy --workspace server
npm run seed
npm run dev
```

Open [CampusConnect](http://localhost:5173) and [Mailpit](http://localhost:8025). Vite proxies `/api` and `/uploads` to Express on loopback port 3000. In another terminal, run `curl -fsS http://localhost:5173/api/health`. A successful response contains `{"status":"ok"}`. Compose initializes separate development and test databases on first startup with a fresh volume. Ctrl-C stops the apps. Use `docker compose stop` to stop the services and retain their data.

## Environment variables

The browser uses relative URLs. All settings below belong to the server or its tools.

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL development or deployment connection. Local defaults are in `server/.env.example`. |
| `DATABASE_URL_TEST` | Separate database named `campusconnect_test`; required by tests and the seat race demo. |
| `CLIENT_URL` | Exact browser origin for email links and write requests. Locally use `http://localhost:5173`. |
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated signup domains. An empty list permits all domains. |
| `JWT_ACCESS_SECRET`, `QR_SECRET` | Independent random signing keys. Generate 32 random bytes for each as above. Refresh tokens are random database-backed credentials. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` | Local Mailpit uses loopback port 1025. For a provider, use its verified sender and TLS settings. |
| `SMTP_USER`, `SMTP_PASS` | Set both for authenticated delivery. Port 465 uses implicit TLS. Authenticated delivery on other ports requires STARTTLS. |
| `MATCH_THRESHOLD` | Integer from 0 to 100. Default suggestion threshold is 60. |
| `DEMO_PASSWORD` | Optional local seed password override. Each reseed applies it to the demo accounts. |
| `NODE_ENV`, `PORT` | Production enables Secure cookies and the public server listener. Port defaults to 3000; hosted services supply their port. |

## Demo accounts and fixture reset

| Role | Email |
| --- | --- |
| Admin | `demo-admin@campusconnect.example` |
| Organizer | `demo-organizer@campusconnect.example` |
| Student 1 | `demo-student@campusconnect.example` |
| Students 2–10 | `demo-student2@campusconnect.example` through `demo-student10@campusconnect.example` |

The shared local password is `CampusDemo123!` unless you set `DEMO_PASSWORD`. The seed prints all twelve login emails. It restores the named fixtures in one transaction on the local development database. Reseeding resets demo passwords, unlocks the accounts, refreshes dates and replaces demo students' registrations on the ten sample events. Previously issued demo QR tickets for those seats become invalid.

On a fresh database, **Courtyard Acoustic Night** has two confirmed students and eight waiting. Student 1 also has a ticket for **Build a Line-Following Robot**. The ten events include pending, rejected, past, full and registration-closed examples. Students 1 and 2 each see a blue-bottle suggestion in **Lost & Found → Possible matches**.

## Checks and tests

Start Docker and load the settings above. From the repository root run

```sh
npm run lint
npm run build
npm test
npm audit
```

Lint checks strict TypeScript and unused code in both workspaces. Build compiles the API and bundles the client and service worker. The tests apply migrations to the isolated test database. To print the method and path of every route in the access-policy test, run `npm run test -w server -- src/tests/route-access.test.ts --reporter=verbose`.

## Folder structure

| Path | Contents |
| --- | --- |
| `client/src/` | Pages, route guards, components, auth context, API clients and styles |
| `client/public/icons/`, `client/vite.config.ts` | Install icons, manifest, proxy and service worker settings |
| `server/src/` | Express entry points, routes, middleware, validation, services, seed and security utilities |
| `server/src/tests/` | Vitest suites, HTTP tests and test database setup |
| `server/prisma/` | Schema and ordered SQL migrations, including the QR nonce trigger |
| `docker/`, `docker-compose.yml` | Database initialization and local services |
| `scripts/`, `docs/` | Development launcher, icon generation and design notes |

For the timed demos and examiner questions, see the [viva cheat sheet](docs/VIVA_CHEAT_SHEET.md). Security boundaries and remaining audit findings are in [SECURITY.md](SECURITY.md).

## Manual auth checklist

Start PostgreSQL and Mailpit with `docker compose up -d --wait`. Apply the auth migration with `npm run db:deploy --workspace server`, then run `npm run dev`. Use the client URL configured in `CLIENT_URL` (normally http://localhost:5173).

- [ ] Go to Sign up and register with an address matching `ALLOWED_EMAIL_DOMAINS`. Use a password with at least 8 characters, including a letter, a number, and a special character like `!` or `@`. Sign-up and password reset both require a special character.
- [ ] Open Mailpit at http://localhost:8025, open the verification email, and click its link. Confirm the app says your email is verified.
- [ ] Log in with the new account and complete interest onboarding. Confirm Home shows the For You feed.
- [ ] Refresh the page and confirm you stay logged in.
- [ ] Log out. Confirm you return to Login and opening Home again redirects to Login.

The service worker is generated by `npm run build`. It caches the app shell. API requests need a connection to the server. To regenerate the placeholder PNG icons locally, run `node scripts/generate-pwa-icons.mjs`.

## Setup references

- [Prisma ORM 7 configuration](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference)
- [Tailwind CSS with Vite](https://tailwindcss.com/docs/installation/using-vite)
- [Vite dev proxy](https://vite.dev/config/server-options#server-proxy)
- [Vitest global setup](https://vitest.dev/config/globalsetup)

## Tickets and check-in

Open **My Registrations → View ticket** for a confirmed seat. The event owner or an admin can open **Scan tickets** or **Attendance** from event details. The scanner can use the camera or the token under **Show token for manual check-in**. Attendance counts confirmed registrations and shows who has checked in.

### Test the camera on a phone

Localhost supports camera access during normal development. For a phone on the same trusted Wi-Fi, use the HTTPS development command. Replace the example IP with your computer's LAN IP.

```sh
CLIENT_URL=https://192.168.1.20:5173 npm run dev:https
```

Open that exact HTTPS address on the phone, accept the local development certificate if prompted, and allow camera access after tapping **Start camera**. The HTTPS command exposes Vite on the LAN and proxies the API to Express on loopback. Setting `CLIENT_URL` to the phone's exact origin also allows authenticated check-in requests through the server's origin check. If the phone blocks the self-signed certificate, trust a local development certificate on the device or use the paste fallback on localhost.

See [QR ticket security](docs/QR_SECURITY.md) for the signing and single-use rules.

## Event posters and registration deadlines

On **Create event** or **Edit event**, choose a JPEG, PNG, or WebP poster up to 5 MB. The form previews it before saving. Event cards crop the poster to a fixed height and the detail page displays the whole image. The category icon fills the poster space when there is no image.

The event owner or an admin can send a multipart `poster` field to `POST /api/events/:id/poster` or remove it with `DELETE /api/events/:id/poster`. Event responses include the nullable `posterImagePath`. Posters use the Lost & Found upload service, which checks the file signature, generates a random filename and serves the image with `X-Content-Type-Options: nosniff`.

Set **Registration deadline** to choose when sign-ups and new waitlist entries close. Leaving it blank uses the event start time. The create and edit APIs accept an ISO datetime with a timezone for `registrationDeadline`. Send `null` on edit to clear it. Once registration closes, the API returns HTTP 409.

## Notifications

The navbar bell opens your inbox. Opening a notification marks it read and takes you to its event or possible matches. The unread badge refreshes every 30 seconds while the tab is visible.

Seat confirmations, waitlist promotions and lost-and-found matches also send email. The running API checks hourly for confirmed registrations with an event starting in the next 24 hours. Email failures leave the in-app notification available. The API retries pending mail every five minutes, up to three delivery attempts including the first.

Apply the migration with `npm run db:deploy --workspace server` and start the API with `npm run dev`. Development email uses the SMTP settings in `server/.env.example`. Open [Mailpit](http://localhost:8025) to inspect the HTML and plain-text versions.

## Optional hosted deployment

For a personal, non-commercial preview, use one stable Vercel Hobby origin, a Render Free Node web service and a Neon Free PostgreSQL database. Check each provider's **current free limits** before relying on them. [Vercel Hobby](https://vercel.com/docs/plans/hobby) · [Render Free](https://render.com/docs/free) · [Neon plans](https://neon.com/docs/introduction/plans)

1. Create the Neon database and copy its direct TLS connection string to the server's private `DATABASE_URL`. The migration role needs permission to create tables, functions and triggers.
2. Create the Render web service at repository root. Use Node 26 from `.nvmrc`. Set its build command to `npm ci --include=dev -w server && npm run build -w server` and start command to `npm run db:deploy -w server && node server/dist/server.js`. Set `NODE_ENV=production`, new independent signing keys, the exact HTTPS Vercel origin for `CLIENT_URL`, your signup domains and production SMTP settings. Render supplies `PORT`. Use `/api/health` as the health path. [Render Node versions](https://render.com/docs/node-version)
3. In Vercel choose the repository root, Vite, install command `npm ci --include=dev -w client`, build command `npm run build -w client` and output `client/dist`. Before deploying, put the following in a root `vercel.json`, replacing the example hostname in both rules. The browser calls its own origin, and the proxy carries the API cookies and protected image requests to Express. Keep the SPA fallback last. [Vercel external rewrites](https://vercel.com/docs/routing/rewrites)

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://YOUR-SERVICE.onrender.com/api/:path*" },
    { "source": "/uploads/:path*", "destination": "https://YOUR-SERVICE.onrender.com/uploads/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

4. Visit `/api/health` through Vercel, register with a real allowed address, verify the email, sign in and reload a deep link. Use a trusted database administrator to assign the first administrator role to your verified account. The seed is local-only. Verify that two separate browsers see only their own registrations and that protected posters load after login.

Free servers sleep. The in-process email retries and hourly reminders do not run while asleep, and a reminder window can be missed. Render's local upload disk is temporary, so a restart, redeploy or sleep can leave a database row pointing to a missing image. Production email needs an SMTP provider; Render Free blocks common SMTP ports 25, 465 and 587. Choose a provider with a supported alternate STARTTLS port and test actual delivery. Camera scanning needs HTTPS on a phone. **Use localhost for the viva.** [Render free service restrictions](https://render.com/docs/free)
