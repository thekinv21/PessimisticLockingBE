# Code Style

New code should look like the code around it. Prettier handles formatting,
oxlint and `strict` TypeScript handle static checks; the rest is below.

## Layout

```
src/module/<feature>/
  <Feature>Controller.ts
  <Feature>Service.ts
  <Feature>Service.spec.ts
  <Feature>Module.ts
  dto/request/<Action><Feature>Dto.ts
  dto/response/<Feature>Dto.ts
src/shared/<kind>/<Name><Kind>.ts   # e.g. RoleConstant.ts, EndpointDecorator.ts
```

- File names are PascalCase. Each folder has an `index.ts` barrel; import
  through it (`@/shared/constants`).
- One Prisma model per file in `prisma/schema/`.

## Naming

| Item                 | Convention                   | Example                                                                               |
| -------------------- | ---------------------------- | ------------------------------------------------------------------------------------- |
| Type alias           | `T` prefix                   | `TActor`, `TLockAck`                                                                  |
| Zod schema / DTO     | `<Name>Schema` / `<Name>Dto` | `CreatePostSchema`, `CreatePostDto`                                                   |
| Constant             | UPPER_SNAKE, unit suffix     | `LOCK_IDLE_TIMEOUT_MS`                                                                |
| Enum-like object     | PascalCase + `as const`      | `Role`, `LockEvent`                                                                   |
| Socket event         | `resource:verb`              | `lock:acquire`, `record:changed`                                                      |
| CRUD service methods | Fixed names                  | `findAll`, `findByPagination`, `findByUnique`, `create`, `update`, `toggle`, `delete` |
| Throwing check       | `assert…`                    | `assertCanManage`                                                                     |
| Calling user         | `actor`                      | `actor: TActor`                                                                       |

No TypeScript `enum`s:

```ts
export const Role = { ADMIN: 'ADMIN', USER: 'USER' } as const;
export type TRoleName = (typeof Role)[keyof typeof Role];
```

## Imports

- Use the `@/` alias across modules, relative paths within one.
- Prettier enforces the order: `@nestjs/*`, third party, `@/shared`, other
  `@/`, relative.
- Use `import type` for type-only imports.

## Comments

- Explain why, not what. Comments and error messages are in English.
- Public service methods have JSDoc with `@param`, `@returns` and, where
  relevant, `@throws` and `@description`. Leave one blank line between the
  doc block and the declaration:

```ts
  /**
   * @param id Unique identifier of the post
   * @returns This operation will retrieve a single PostDto
   */

  async findByUnique(id: number): Promise<PostDto> {
```

## NestJS patterns

**Controllers** stay thin. Every handler has `@Endpoint({ summary, type?,
isArray?, isPaginated?, status? })`, which sets the route version, status
code, serializer and Swagger docs. Use `@Auth()` (and `@PreAuthorize(...)`)
at class level, `@CurrentUser() actor`, and `IntIdParamDto` / `IdParamDto`
for path ids. Write handlers return `Promise<void>`.

**Services** hold business rules, authorization rules and Prisma access.
Throw Nest exceptions (`NotFoundException('Post not found')`,
`HttpException(..., HttpStatus.LOCKED)`). Fetch lists and counts together
with `prisma.$transaction` and return `PageDto.of(items, total, { offset, limit })`.

**DTOs** are Zod only:

```ts
const CreatePostSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
});

export class CreatePostDto extends createZodDto(CreatePostSchema) {}
```

Request schemas are `strictObject`; update schemas derive from create
schemas. Response DTOs use `createZodDto(Schema, { codec: true })` with
`IsoDateSchema` for dates.

**Gateways** are not covered by global pipes, guards or interceptors. Each
handler runs `allow()` → `parse(Schema, body)` → `refreshSession()` if
needed → service, and returns a `TLockAck` instead of throwing.

## TypeScript

- Prefer `unknown` with narrowing over `any`.
- Await every promise or mark it with `void` (`no-floating-promises`).
- Use exhaustive `switch`es over unions.
- Prefix unused destructured fields with `_`.
- Prefer early returns.

## Tests

`*.spec.ts` next to the source, using `bun:test` and
`Test.createTestingModule` with Prisma mocked via `useValue`. Name tests as
behavior: `it('grants the lock to only one of two concurrent acquires')`.

## Commits

Enforced by the `commit-msg` hook:

```
<feat|fix|chore|docs|ci|test|refactor>:[<branch>][<developer>]: <description>
```

The `pre-commit` hook runs `format:check` and `lint`. Commit schema changes
together with their migration; never edit an applied migration.
