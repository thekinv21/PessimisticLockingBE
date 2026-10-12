# Post Locking & Real-Time Sync API

NestJS backend that prevents the same post from being edited by two users or
two tabs at once, and pushes changes to every open screen over WebSockets.

- The first tab to open a post locks it. Everyone else, including the same
  user's other tabs, sees it read-only with "being edited by X".
- `PUT /posts/:id` is accepted only with the lock holder's `X-Lock-Token`.
- After a save the server broadcasts `record:changed`, then releases the lock.

The Next.js frontend lives in a separate repository.

## Stack

Bun · NestJS 11 · Socket.IO · PostgreSQL + Prisma 7 · Zod 4 (`nestjs-zod`) ·
JWT · argon2 · oxlint · Prettier

## Getting started

Requires Bun ≥ 1.3 and a running PostgreSQL.

```bash
bun install
cp .env.example .env   # set DATABASE_URL and the JWT secrets
bun run db:migrate
bun run db:seed        # roles + test users, password: Password123!
bun run start:dev      # http://localhost:4200, Swagger at /docs
```

Seed users: `owner@`, `admin@`, `admin2@`, `manager@`, `user@example.com`.

## Environment

Validated at startup by [EnvSchema.ts](src/config/env/EnvSchema.ts); the app
refuses to start on a missing or invalid value.

| Variable                                           | Description                                          |
| -------------------------------------------------- | ---------------------------------------------------- |
| `NODE_ENV`                                         | `development` \| `production` \| `test`              |
| `PORT`                                             | HTTP and WebSocket port                              |
| `TRUST_PROXY`                                      | Number of reverse proxies in front (`0` = none)      |
| `CORS_ORIGINS`                                     | Comma-separated allowed origins (REST and WebSocket) |
| `DATABASE_URL`                                     | PostgreSQL connection string                         |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`         | At least 32 characters each, must differ             |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | e.g. `15m`, `7d`                                     |

## Scripts

| Command                           | Description                            |
| --------------------------------- | -------------------------------------- |
| `bun run start:dev`               | Run in watch mode                      |
| `bun test`                        | Unit tests                             |
| `bun run lint`                    | oxlint (type-aware)                    |
| `bun run format` / `format:check` | Prettier                               |
| `bun run db:migrate`              | Create and apply a migration           |
| `bun run db:seed`                 | Load test data (refuses in production) |

## API

All routes are under `/api/v1`.

| Resource | Routes                                                                               | Access               |
| -------- | ------------------------------------------------------------------------------------ | -------------------- |
| Auth     | `POST /auth/register`, `/login`, `/refresh-token`, `/logout`                         | Public (logout: any) |
| Posts    | `GET /posts`, `GET /posts/:id`, `POST`, `PUT /:id`, `DELETE /:id`                    | Any signed-in user   |
| Users    | `GET /users/me`                                                                      | Any signed-in user   |
| Users    | `GET /users`, `/all`, `/:id`, `POST`, `PUT /:id`, `PATCH /:id/toggle`, `DELETE /:id` | OWNER, ADMIN         |
| Roles    | `GET /roles`, `/all`, `/:id`, `POST`, `PUT /:id`, `PATCH /:id/toggle`, `DELETE /:id` | OWNER, ADMIN         |
| Health   | `GET /health`                                                                        | Public               |

WebSocket namespace: `/locks`. See [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).

## Documentation

| Document                                  | Contents                                          |
| ----------------------------------------- | ------------------------------------------------- |
| [PRD.md](docs/PRD.md)                     | Requirements and scope                            |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)   | Modules, request pipeline, lock internals, limits |
| [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | REST and WebSocket contract, lock UI states       |
| [SECURITY.md](docs/SECURITY.md)           | Security controls, known risks, reporting         |
| [CODE_STYLE.md](docs/CODE_STYLE.md)       | Coding conventions and commit format              |
| [AGENTS.md](docs/AGENTS.md)               | Guide for AI coding agents                        |
