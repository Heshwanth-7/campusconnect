# Security

## Reporting a vulnerability

## Supported versions

## Authentication

- Accounts must verify their email before signing in. The verification email links to the app, and the app must submit the token by POST. Opening the link alone cannot verify an account.
- Passwords are hashed with Argon2id. A login with an unknown email still checks a dummy hash. Five failed attempts lock an account for 15 minutes. A successful login clears the counter.
- Access and refresh credentials are sent in HTTP-only cookies with SameSite=Lax and Secure in production. The access cookie lasts 15 minutes. The refresh cookie lasts seven days and is only sent under `/api/auth`.
- The database stores SHA-256 hashes of verification, password reset, and refresh tokens. Verification and reset links are single-use. Verification links expire after 24 hours and reset links after one hour.
- A refresh replaces the old token. Presenting a revoked token revokes all refresh tokens for that account. Password reset also revokes all refresh tokens. An already issued access token can last until its 15-minute expiry.
- The API checks the current user record on each authenticated request, so a block or role change takes effect immediately. Requests that change data must come from the configured client origin. Auth endpoints also limit requests by IP.
