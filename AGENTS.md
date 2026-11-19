# CampusConnect

CampusConnect is a mobile-first, installable web app that helps college students discover campus events, register, and receive QR tickets. Students can also report lost or found items to help reunite belongings with their owners.

## Fixed stack

- Client uses React, Vite, TypeScript, Tailwind CSS, React Router, React Hook Form with Zod, and vite-plugin-pwa.
- Server uses Node.js, Express, TypeScript, PostgreSQL, Prisma ORM, and Zod.
- Tests use Vitest and Supertest. Local PostgreSQL and Mailpit run through Docker Compose.
- Use the latest stable versions and follow the current official setup guides. Check major-version changes, especially for Prisma and Tailwind. Ask before adding any dependency outside the fixed stack.

## Design

| Token | Value |
| --- | --- |
| Primary indigo | `#4F46E5` |
| Primary hover | `#4338CA` |
| Primary tint | `#EEF2FF` |
| Accent amber | `#F59E0B` |
| Background | `#F8FAFC` |
| Surface | `#FFFFFF` |
| Border | `#E2E8F0` |
| Text | `#0F172A` |
| Muted text | `#64748B` |
| Success | `#16A34A` |
| Warning | `#D97706` |
| Danger | `#DC2626` |
| Info | `#0284C7` |

- Use Inter, rounded-xl corners, and subtle shadows.
- Always use dark text on accent amber. Never use white text on that background.
- Show status with an icon and a text label alongside colour.
- Make buttons at least 44px tall. Design mobile-first and check the layout at 375px wide.

## Security

- Never store tokens in localStorage.
- Never log passwords, tokens, or secrets.
- Validate all input with Zod.
- Declare the auth requirement for every route, including public routes.
- Never create or commit real `.env` files.

## Working rules

- Read this file at the start of every task.
- Do only what the task asks. Work in stages, starting with the server, then the client, then tests.
- Never run `git commit` or `git push`. The student handles both.
- Run lint, build, and tests before finishing and report the results.
- Keep code readable and comments light so the student can explain it in a viva.
- End every task with a short summary and a list of anything the student must do by hand.
