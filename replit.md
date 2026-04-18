# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## DocSage — AI-Powered Document Analysis Platform (Polish)

Full-stack app for law firms, accounting offices, enterprises. Users configure prompts, upload documents, process via Claude AI, export results. All UI in Polish.

### Features
- **Authentication**: Clerk (user accounts, Google OAuth, manage users via Auth pane)
- **Prompts / Templates**: CRUD prompt library + default Polish templates
- **Jobs**: Bulk document upload, Claude AI extraction/analysis, SSE progress streaming
- **Export**: CSV/JSON/XML results
- **Landing page**: Polish marketing landing page for unauthenticated users

### Pages
- `/` — Landing page (public)
- `/sign-in` — Clerk sign-in (Polish UI)
- `/sign-up` — Clerk sign-up (Polish UI)
- `/dashboard` — Stats + recent jobs + quick create (protected)
- `/jobs` — Job list (protected)
- `/jobs/:id` — Job detail, drag-drop upload, process, results viewer (protected)
- `/prompts` — Prompt library + default templates (protected)

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Clerk (`@clerk/express` + `@clerk/react`)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
