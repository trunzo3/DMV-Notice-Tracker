# DMV Notice Tracker

A fictional Caltrans demo for ODCAST and district staff to manage DMV notices, driving eligibility, memos, actions, and supporting documents.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/dmv-tracker` — React frontend, root preview.
- `artifacts/api-server/src/routes/demo.ts` — demo-session and district-scoped case endpoints.
- `artifacts/api-server/src/lib/{tracker,seed,files}.ts` — case rules, seed records, private App Storage and PDFs.
- `lib/api-spec/openapi.yaml` — API contract.
- `lib/db/src/schema/tracker.ts` — Drizzle schema; `lib/db/schema.sql` is the initial schema reference, not a startup migration.

## Architecture decisions

- Passwordless user selection is intentional and user-requested: this is NOT production employee authentication. District scopes are enforced on the server even though anyone can select a demo persona.
- Calendar logic uses the server's America/Los_Angeles date because this is a California departmental demo. Business days exclude weekends; holidays are not modeled.
- Seed data is relative to the date of first startup, not reset on restart, so user edits persist. Daily expiration checks and overdue checks continue afterward.

## Product

Four demo users, scoped dashboard, CSV and daily sample imports, employee records, editable memo templates, downloadable PDF memos, private supporting-document uploads, action deadlines, case resolution and activity history.

## User preferences

- All data must remain fictional. Never connect DMV, Caltrans, or email services. Record simulated sends only.
- Every page must show: "DEMO — sample data only, not real DMV or employee records."
- Keep plain government styling: white, dark text, Caltrans blue #005A9C.

## Gotchas

- PDFKit must remain external to the server bundle because it loads font assets from its package.
- `node artifacts/api-server/check-demo.mjs` is a development API verification script for an isolated, unused demo. It restores its test records and unloads today's batch; never run against production or while users are editing.
- Uploaded file bytes live in private App Storage, never PostgreSQL.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
