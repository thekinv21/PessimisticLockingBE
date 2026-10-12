# AGENTS.md

NestJS 11 + Socket.IO + Prisma 7 (PostgreSQL) backend running on **Bun**.
Core feature: pessimistic edit locks for posts with real-time sync.

Read before changing related code: [ARCHITECTURE.md](../ARCHITECTURE.md),
[DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md), [SECURITY.md](./SECURITY.md),
[CODE_STYLE.md](../CODE_STYLE.md).

## Commands

Use Bun, not npm or Node.

```bash
bun run start:dev                    # http://localhost:4200, Swagger at /docs
bun test
bunx tsc --noEmit -p tsconfig.json
bun run lint
bun run format
bun run db:migrate                   # after schema changes
bun run db:seed                      # test users, password: Password123!
```

## Definition of done

1. `bun test`, `bunx tsc --noEmit -p tsconfig.json`, `bun run lint` and
   `bun run format:check` all pass.
2. Behavior changes have tests.
3. API or event contract changes are reflected in [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md).

## Code map

| Path                             | Contents                                                   |
| -------------------------------- | ---------------------------------------------------------- |
| `src/main.ts`                    | helmet, CORS, `/api` prefix, versioning, Swagger           |
| `src/module/AppModule.ts`        | Global filter, interceptors (ordered), pipe, guard         |
| `src/module/lock/LockService.ts` | Lock state, `acquire` / `renew` / `release` / `guardWrite` |
| `src/module/lock/LockGateway.ts` | `/locks` namespace: auth, rate limit, validation           |
| `src/module/post/`               | Post CRUD; writes wrapped in `guardWrite`                  |
| `src/module/auth/`               | JWT, `SessionService`, guards, decorators                  |
| `src/module/user/`, `role/`      | Administration and role hierarchy                          |
| `src/shared/`                    | Constants, `@Endpoint`, DTOs, filter, interceptors         |
| `prisma/schema/`                 | One model per file                                         |

## Do

- Add `@Endpoint({...})` to every route; without it the route is not under
  `/api/v1`.
- Validate request bodies with `z.strictObject`; define responses with
  `createZodDto(Schema, { codec: true })`.
- Import `SessionModule` in any module using `@Auth()`.
- Wrap every write to a lockable resource in `LockService.guardWrite` and
  pass the `X-Lock-Token` header.

## Don't

- Add an `await` inside the "No await below" block of `LockService.acquire`;
  lock atomicity depends on it.
- Put the lock token in any broadcast payload or in `toPublic()`.
- Expose `password` or `tokenVersion` in a response DTO.
- Assume global guards, pipes or interceptors run for gateways.
- Change the `record:changed` → `lock:released` order after a write.
- Add role checks to posts or locks unless asked; their absence is deliberate.
- Edit applied migrations or `prisma/generated`.
- Read, print or commit `.env`.
- Commit or push unless asked.

## Gotchas

- Each login revokes the user's previous tokens. When testing with several
  clients as one user, log in once and share the token.
- Login is limited to 5 requests per minute.
- A lock belongs to a socket (tab), not a user; one user's two tabs block
  each other by design.
- Lock state is in memory; every `start:dev` restart drops all locks.

## Commits

```
<feat|fix|chore|docs|ci|test|refactor>:[<branch>][<developer>]: <description>
```

Example: `fix:[master][Vadim]: release lock after successful update`
