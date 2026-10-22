# AHEAD ERP — Backend API

See the [root README](../README.md) for setup, structure and how tenant isolation works, and [TASKS.md](../TASKS.md) for the build plan.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | API + in-process worker with reload (tsx + nodemon) |
| `npm run build` / `npm start` | Compile to `dist/` and run |
| `npm run typecheck` | TypeScript check |
| `npm run db:migrate` | Apply Prisma migrations (schema, RLS, grants) |
| `npm run db:seed` | Sync modules, plans, prices, permissions, roles, templates from `src/contracts` |
| `npm test` | Vitest suite |

## Adding a business module

1. Add tables to `prisma/schema.prisma` with `tenant_id`, then a migration that enables + forces RLS, adds the `tenant_isolation` policy and grants to `app_user` (the RLS test fails otherwise).
2. Add permission keys to `src/contracts/permissions.ts` and grant them in `src/contracts/roles.ts`; run `npm run db:seed`.
3. Routes: `router.post('/things', requirePermission('module.thing.create'), validate(Schema), tx(handler))`. Inside handlers use `db()` only.
4. Validate `custom` JSONB with `validateCustom(tenantId, entity, input)` from `modules/config/service.ts`.
