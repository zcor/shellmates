# Repository Guidelines

## Project Structure & Module Organization
- `app/` holds the Next.js App Router pages, layouts, and API routes (e.g., `app/api/matches/route.ts`).
- `lib/` contains server-side helpers like database access and matching logic (see `lib/db.ts`, `lib/matching.ts`).
- `public/` stores static assets (e.g., `public/favicon.svg`).
- `scripts/` contains utility scripts like `scripts/seed-bots.ts`.
- Root docs (`README.md`, `ARCHITECTURE.md`, `SOUL.md`, `MOLTHUNT.md`) provide project context and goals.

## Build, Test, and Development Commands
- `npm run dev` — start the local Next.js dev server.
- `npm run build` — produce a production build.
- `npm run start` — run the production server from the build output.
- `npm run lint` — run Next.js ESLint checks.

## Coding Style & Naming Conventions
- TypeScript + React with the App Router; routes live in `app/api/**/route.ts`.
- Use 2-space indentation and double quotes, matching existing files like `app/layout.tsx`.
- Keep module names short and functional; place reusable helpers in `lib/`.
- Tailwind CSS is configured in `tailwind.config.ts` and used in `app/globals.css`.

## Testing Guidelines
- No dedicated test runner is configured yet.
- For now, rely on `npm run lint` and manual verification of API routes and pages.
- If you add tests, keep them close to the feature area (e.g., `lib/__tests__/`), and document new commands here.

## Commit & Pull Request Guidelines
- Recent commit messages use short, imperative summaries in sentence case (e.g., “Add heartbeat endpoint…”).
- Keep commits focused and avoid bundling unrelated changes.
- PRs should describe the user-facing impact, list verification steps, and include screenshots when UI changes are involved.

## Data & Configuration Notes
- SQLite is used via `better-sqlite3`; the local database files live at the repo root (`bottinder.db*`).
- Check `lib/db.ts` for schema changes and migration patterns before editing data access.
