# CampusConnect security

## Scope and reporting

This student project maintains the current main branch. Report a suspected issue privately to the project maintainer or course supervisor. Include the affected route, role and expected behavior. Use synthetic records and remove cookies, QR images, email links and connection strings from evidence.

## Accounts and sessions

- **Passwords.** Sign-up and reset validate the password with Zod and hash it with salted Argon2id. New passwords have 8–256 characters including a letter, a number and a special character. A sign-in attempt for an unknown address still verifies a dummy hash. Accounts must verify their email before login. Configured domains restrict new registrations.
- **Email links.** Verification and reset use 32 random bytes. The database stores SHA-256 digests. Verification expires after 24 hours, reset after one hour. Consumption is single-use under a user-row lock. New links carry the secret in a URL fragment, which the browser omits from HTTP requests. The client reads it into memory, removes it from the address bar and submits it in a POST body. Previously issued query links still work until expiry.
- **Cookies.** The access cookie carries an HS256-signed user ID and expiry for 15 minutes at path `/`. The opaque refresh cookie lasts seven days at `/api/auth`. Both are host-only, HttpOnly, SameSite=Lax and Secure in production. The app keeps credentials out of localStorage. Authenticated responses specify no-store.
- **Rotation and reuse.** Refresh locks the user row, checks the stored digest, issues a new pair, and revokes and links the old refresh row in one transaction. Presenting a revoked refresh token revokes every active refresh token for the account. Password reset also revokes all refresh sessions. Logout revokes the presented refresh token and clears both browser cookies.
- **Lockout and rate limit.** Five consecutive bad passwords lock an account for 15 minutes. A correct password during lockout can retrieve the unlock time. Incorrect passwords receive the generic login error. Successful login clears the counter. The auth router has an in-memory limit of 100 requests per IP per 15 minutes, including refresh and account lookups. The integration suite raises the limit.
- **CSRF.** The API checks every non-GET request against the exact origin of `CLIENT_URL` before reading the body. If Origin is absent it checks the origin of Referer. A missing or mismatched source receives 403. Host, scheme and port matter. This protects browser cookie requests from cross-site writes. A client that supplies its own headers still needs valid credentials.

## Data access and uploads

The server reloads the verified user, block status and role on authenticated requests. The admin router checks ADMIN before its handlers. Creating events requires organizer or admin. Event edits and deletion check ownership or admin authority. Registration lists, attendance and scanning require the event's organizer or an admin. A student can retrieve a QR only for their own confirmed registration.

Personal feeds, registrations and notifications are scoped to the authenticated account. Lost/found reports and their photos are visible to verified campus users. Only participants see their match suggestions. Contact details appear after both participants confirm. Non-owners cannot edit others' posts except through authorized admin access.

Uploads accept a single JPEG, PNG or WebP up to 5 MiB. Multer limits multipart size and field counts. The service inspects the byte signature, assigns a random filename and derives its extension from the detected format. Every image read requires authentication and a linked campus post or an event visible to the viewer. Responses use Helmet's nosniff header. The service worker precaches static app files and bypasses API and upload navigations.

## Ticket integrity

The server signs a registration ID, event ID, random nonce and expiry with HMAC-SHA256 using a separate QR key. It compares signatures in constant time. The database trigger issues a fresh nonce on confirmation, including waitlist promotion. Cancellation invalidates it. A scan checks the event, expiry, current nonce and confirmed status. One conditional database update sets the check-in time while it is still empty. Concurrent scans can record only one success. [QR design](docs/QR_SECURITY.md)

## Admin audit log

Moderation decisions, admin event/post deletions, role changes, blocking and unblocking write an audit row in the same transaction as the action. It records time, actor ID, action, target type/ID and selected metadata such as title, reason or previous role. Only admins can read the audit endpoint. Privilege changes are serialized and protect the last active administrator.

## What is not protected

- A copied valid QR works for the first person who presents it. Compare the displayed name with student ID when identity matters. Signed QR contents are readable.
- A stolen access cookie can survive logout or password reset until its 15-minute expiry. A block takes effect when the server checks the account. Same-origin script injection or a compromised browser can still perform actions using a valid session.
- Verified email establishes control of a mailbox. Users can post identifying information themselves. Image signature checks do not strip metadata, scan for malware, enforce aggregate storage quotas or moderate content.
- Registration reports when an address is already registered. Lockout can disrupt a legitimate user. The IP limiter resets on restart and can group users behind a proxy; this deployment does not trust arbitrary forwarded addresses. It does not provide distributed abuse or DDoS protection.
- Audit history covers the listed administrative writes. Database operators can change rows. There is no independent tamper-proof archive, exhaustive access log, application-level encryption of stored contact details, or automatic backup policy here.
- Mail recipients, Mailpit operators and SMTP providers can see message contents. Keep production request-body, Cookie and Set-Cookie logging disabled at proxies and monitoring services. Local example database credentials and demo passwords are public development fixtures.

## Final review and dependency audit

The review inspected the worktree, filenames and 254 unique blobs reachable from all local Git refs (11 commits). Searches covered credential-bearing URLs, key headers, provider-token patterns, credential literals and current local signing-key values without printing them. The tracked credential-like values were sample database logins, demo/test fixtures and example settings. No real committed secret was identified. The scan cannot cover deleted remote refs or credentials outside recognizable patterns.

The review found three exposure paths: authenticated users could load a hidden event poster by its URL, some personalized responses lacked explicit cache controls, and email-link query tokens could reach HTTP access logs. The fixes check image visibility, apply no-store on the auth guard and issue fragment-based links. The old access-key example was a predictable value long enough to satisfy the length check; the server now rejects that example at startup and the setup generates separate random keys. Application log calls reviewed did not print passwords, bearer tokens, cookie contents or SMTP credentials.

Run `npm run test -w server -- src/tests/route-access.test.ts --reporter=verbose` for the mounted method/path inventory. The explicit allow-list covers health and eight auth entry points. Refresh still verifies the refresh cookie; verification and reset still require their one-time credentials. Every other route is checked for the auth middleware and an anonymous 401. Separate tests cover wrong-role and cross-account access, including notification reads, tickets, attendance, posters and match contacts.

As checked on 27 November 2026, npm reported **three advisories affecting seven package entries**. A compatible audit-fix dry run found no update. The production-only audit still reported the Prisma chain (three high entries).

| Severity | Affected chain | Remaining issue |
| --- | --- | --- |
| High | prisma → @prisma/config → effect | Excessive regex work in Effect template schemas. npm proposes downgrading Prisma to 6.12.0. [GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw) |
| Moderate | vite-plugin-pwa → workbox-build → glob | Cancellation can leave a filesystem traversal running. [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) |
| Moderate | Same build chain → glob → minimatch | Pattern processing can consume excessive resources. npm proposes downgrading vite-plugin-pwa to 1.1.0 for the Workbox chain. [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) |

These packages are used in Prisma tooling and PWA builds. No route reviewed takes a user-supplied Prisma configuration, glob pattern or build input. Recheck after upstream releases and validate migrations, client generation and the service worker before accepting a major-version change.
