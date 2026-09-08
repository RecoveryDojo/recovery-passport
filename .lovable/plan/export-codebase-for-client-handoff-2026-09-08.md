# Export Codebase for Client Handoff

## Goal
Package the Recovery Passport source code into a clean ZIP file the client can download and email to their development team for self-hosted deployment.

## What the ZIP will include
- All source code under `src/`
- Configuration files: `package.json`, `tsconfig*.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `eslint.config.js`, `components.json`
- Entry files: `index.html`, `src/main.tsx`, `src/App.tsx`
- Supabase edge functions and config: `supabase/functions/`, `supabase/config.toml`
- Public assets: `public/`
- Documentation: `README.md`, `docs/`
- A new `.env.example` file listing every environment variable the client must configure
- A rewritten `README.md` with setup, build, and deployment instructions

## What the ZIP will exclude
- `.env` — contains publishable Supabase keys and project IDs that belong to your Lovable Cloud instance
- `node_modules/` — the client will run `npm install` or `bun install`
- `dist/` and `build/` — generated build artifacts
- `.git/` — version control metadata
- `.lovable/` — internal Lovable metadata
- OS files like `.DS_Store`

## Why exclude `.env`?
The client will deploy on their own server and should point the app at their own Supabase project. Sharing your `.env` would tie their build to your database and could leak your project credentials.

## Steps
1. Generate `.env.example` from the variables used in the app (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID).
2. Rewrite `README.md` with:
   - Project overview
   - Tech stack
   - Install steps
   - How to configure environment variables
   - Build and preview commands
   - Deployment notes for the edge functions
3. Create the ZIP archive at `/mnt/documents/recovery-passport-codebase.zip`.
4. Verify the archive contents and report the final file size.

## Deliverable
A single downloadable ZIP file ready to attach to an email.
