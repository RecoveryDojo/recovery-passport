# Recovery Passport

A mobile-first Progressive Web App (PWA) for Recovery Epicenter Foundation (REF) in Clearwater, FL. Supports three roles — **participant**, **peer specialist**, and **admin** — with intake, assessments, recovery plans, milestones, check-ins, and passport sharing.

## Tech stack

- **Frontend:** React 18, TypeScript 5, Vite 5, Tailwind CSS v3, shadcn/ui components
- **State & data:** TanStack Query, Supabase client
- **Backend:** Supabase (auth, database, realtime, storage, edge functions)
- **Testing:** Vitest, Playwright
- **PWA:** vite-plugin-pwa with offline caching

## Prerequisites

- Node.js 18+ or Bun 1.0+
- A Supabase project with the Recovery Passport schema, RLS policies, triggers, and seed data already applied
- The Supabase CLI if you plan to deploy or modify edge functions

## Installation

```bash
# 1. Install dependencies
npm install
# or
bun install

# 2. Configure environment variables
cp .env.example .env
# Then edit .env with your own Supabase credentials.

# 3. Start the development server
npm run dev
# or
bun run dev
```

The dev server runs on `http://localhost:8080` by default.

## Environment variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/public key |
| `VITE_SUPABASE_PROJECT_ID` | Your Supabase project reference ID |

> **Important:** This app uses Supabase RLS for authorization. The publishable key alone does not grant admin access; role checks happen server-side.

## Available scripts

| Script | Command | Purpose |
|---|---|---|
| Dev server | `npm run dev` | Start Vite dev server |
| Build | `npm run build` | Production build |
| Preview | `npm run preview` | Preview production build locally |
| Lint | `npm run lint` | Run ESLint |
| Tests | `npm run test` | Run Vitest unit tests |

## Project structure

```text
src/
  components/      # Reusable UI components and layouts
  contexts/        # Auth context and role management
  hooks/           # Custom React hooks
  integrations/    # Supabase client and generated types
  lib/             # Utility functions, event bus, MCP tools
  pages/           # Route-level page components
  test/            # Test setup

supabase/
  functions/       # Edge functions (auth email hook, intake, CRPS, MCP, etc.)
  config.toml      # Supabase CLI configuration

docs/              # Architecture and operational documentation
public/            # Static assets and PWA icons
```

## Key documentation

- `docs/interdependency-map.md` — Cross-role events, notifications, and realtime channels
- `docs/role-surface-matrix.md` — What each role can see and do
- `docs/system-event-map.md` — System events and handlers
- `docs/task-playbook.md` — Operational runbook
- `docs/training-coverage-matrix.md` — Training coverage
- `docs/recovery-capital-ladder.md` — Recovery capital model

## Deployment notes

1. **Frontend:** Build with `npm run build` and deploy the `dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages, etc.).
2. **Supabase project:** The client must provision their own Supabase project and apply the database schema, seed data, RLS policies, and triggers that power this app. The schema is not included in this repository.
3. **Edge functions:** Deploy the functions in `supabase/functions/` using the Supabase CLI:
   ```bash
   supabase functions deploy
   ```
4. **Email domain:** If using the built-in auth email hook, configure and verify the sender domain in your Supabase project.
5. **PWA:** The service worker only registers in production on non-preview hosts. See `src/main.tsx` for the registration logic.

## First admin setup

After the first user signs up, promote them to admin directly in the database:

```sql
UPDATE public.users SET role = 'admin' WHERE email = 'owner@example.com';
```

For multi-role users, assign additional roles through the Admin Users page.

## License

Provided to the client for self-hosted development and deployment. All rights reserved by the project owner unless otherwise agreed.
