# Security

## Reporting a vulnerability

Do not open a public issue. Email **thekinv21@gmail.com** with the affected
endpoint or event, reproduction steps and impact.

## Authentication

- Passwords are hashed with argon2. Login verifies a dummy hash when the
  user does not exist, so response time does not reveal registered emails,
  and always fails with `Invalid email or password.`
- JWTs are HS256 with issuer and audience checks. Access and refresh tokens
  use different secrets (≥ 32 characters, must differ, enforced at startup).
- Tokens carry only `sub` and `tokenVersion`; roles and active status are
  read from the database on each check.
- Incrementing `tokenVersion` revokes all of a user's tokens. Login, refresh,
  logout, user update and user toggle increment it.
- Refresh tokens are single-use (atomic version check and increment).
- Inactive users cannot make requests or connect sockets.
- Registration always assigns USER; the role never comes from the request.

## Authorization

- `@Auth()` applies `JwtAuthGuard` and `RolesGuard`; `@PreAuthorize(...)`
  lists allowed roles.
- User and role management is restricted to OWNER and ADMIN.
- Non-owners can only manage users, and assign roles, ranked below their own
  (`RoleRank`). They cannot change their own roles or deactivate or delete
  themselves.
- OWNER users appear as 404 to non-owners.
- OWNER, ADMIN and USER are protected: only OWNER can deactivate or delete
  them. Role names are immutable.
- Posts and locks have **no role check**: any signed-in, active user may use
  them.

## Lock system

| Control                                            | Prevents                                              |
| -------------------------------------------------- | ----------------------------------------------------- |
| Token check at socket handshake                    | Unauthenticated or revoked sessions connecting        |
| Session re-check on `acquire` and `renew`          | Revoked users taking or keeping a lock                |
| Random lock token, returned only to the holder     | Other tabs or users bypassing the lock over REST      |
| Token **and** user must match                      | Using a leaked token from another account             |
| `PUT` without a lock → 428                         | Writing without ever acquiring                        |
| Id canonicalization                                | Locking one record under several keys (`'01'`, `'1'`) |
| Existence check on acquire                         | Accumulating locks for missing records                |
| In-flight write tracking                           | Opening a form on data about to change                |
| Connected-socket check after async lookups         | Ghost locks from tabs that closed mid-request         |
| 5-minute idle timeout, 10 locks per socket         | Abandoned or hoarded locks                            |
| 30 events per 10 s per socket, strict Zod payloads | Event floods and malformed payloads                   |

## Input, output and transport

- Request bodies are Zod `strictObject`s; unknown fields are rejected.
  Avatars must be `http(s)` URLs. Passwords are 8–72 characters.
- Responses pass through the Zod serializer, which drops fields not in the
  DTO. User queries never select `password` or `tokenVersion`.
- 500 responses return no details; stacks are only logged.
- `helmet()` is enabled and `x-powered-by` is disabled.
- CORS and the WebSocket gateway accept only `CORS_ORIGINS`.
- Behind a reverse proxy, set `TRUST_PROXY` or rate limiting sees every
  client as the proxy.
- Swagger is disabled in production. Seed users and `Password123!` are for
  development only; the seed refuses to run in production.

## Rate limits

| Scope                       | Limit            |
| --------------------------- | ---------------- |
| HTTP default (IP and route) | 100 / minute     |
| `POST /auth/login`          | 5 / minute       |
| `POST /auth/register`       | 3 / minute       |
| `POST /auth/refresh-token`  | 10 / minute      |
| `POST /auth/logout`         | 10 / minute      |
| WebSocket (per socket)      | 30 events / 10 s |

## Known risks

| Issue                                | Risk                                                              |
| ------------------------------------ | ----------------------------------------------------------------- |
| No post ownership                    | Any signed-in user can delete an unlocked post                    |
| Each login revokes other sessions    | Anyone with the password can keep signing the user out            |
| No account lockout                   | Login is limited per IP only; distributed guessing is not blocked |
| In-memory rate limits and locks      | Limits are per instance once scaled out                           |
| Rooms per resource type              | Watchers see the holder names of every locked post                |
| Socket stays open after token expiry | Revocation applies only on the next `acquire` or `renew`          |
