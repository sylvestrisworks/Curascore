# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project snapshot
- Product: PlaySmart/Curascore, a parent-facing game rating system combining developmental benefits with design-risk analysis.
- Framework: Next.js App Router + TypeScript (`strict` mode), Drizzle ORM + PostgreSQL, Tailwind, next-intl, NextAuth v5.
- Core rule source: `docs/RUBRIC.md` defines the scoring model and must stay aligned with implementation in `src/lib/scoring/`.

## Commands used in daily development
- Install dependencies:
  - `npm install`
- Run app locally:
  - `npm run dev`
- Production build + serve:
  - `npm run build`
  - `npm run start`
- Run tests:
  - `npm test`
  - Single test file: `npm test -- src/lib/scoring/__tests__/engine.test.ts`
  - Single test by name: `npm test -- -t "calculateGameScores"`
- Type-check:
  - `npx tsc --noEmit`

## Database and data workflow commands
- Drizzle schema/migration workflow:
  - `npm run db:generate`
  - `npm run db:push`
  - `npm run db:studio`
- Seed and compliance scripts:
  - `npm run db:seed`
  - `npm run db:compliance`
- Postgres extensions required by search queries (`word_similarity`, `unaccent`):
  - `npx tsx scripts/enable-trgm.ts`
  - `npx tsx scripts/enable-unaccent.ts`

## Required environment variables
- Database/Auth: `DATABASE_URL`, `NEXTAUTH_SECRET` (or `AUTH_SECRET`), `NEXTAUTH_URL`
- Metadata providers: `RAWG_API_KEY`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`
- Optional reviewer login path: `REVIEWER_EMAIL`, `REVIEWER_PASSWORD`
- See `.env.example` for baseline values; Drizzle config loads `.env.local` for DB tooling.

## Architecture: how the system fits together
### 1) UI and routing
- App uses locale-prefixed routes under `src/app/[locale]/...`.
- Root shell is in `src/app/layout.tsx`; locale shell/navigation/footer live in `src/app/[locale]/layout.tsx`.
- i18n is configured in `src/i18n/routing.ts` + `src/i18n/request.ts`, and enforced by `src/middleware.ts`.
- Middleware handles i18n only; auth checks are done in pages/routes with server-side `auth()` calls.

### 2) Data model and persistence
- Drizzle schema is centralized in `src/lib/db/schema.ts`.
- Core entities:
  - `games`: canonical game metadata + enrichment flags.
  - `reviews`: reviewer/AI rubric inputs (benefits, risks, practical notes).
  - `game_scores`: computed outputs (BDS/RIS/Curascore/time recommendation).
  - supporting entities for compliance, dark patterns, user libraries, child profiles, tips, and ingest cursor.
- DB client lifecycle is handled by `src/lib/db/index.ts` with a lazy singleton to avoid dev hot-reload connection churn.

### 3) Scoring engine boundary
- Entry point: `src/lib/scoring/engine.ts` (`calculateGameScores`).
- Composition:
  - benefit computation (`benefits.ts`)
  - risk computation (`risks.ts`)
  - time recommendation (`time.ts`)
- `POST /api/review` (`src/app/api/review/route.ts`) is the key write path: validates payload with Zod, upserts `reviews`, runs scoring engine, then upserts `game_scores`.
- Keep formulas and thresholds exactly aligned with `docs/RUBRIC.md`; this is a hard product contract.

### 4) Metadata ingestion and normalization
- RAWG integration lives in `src/lib/rawg/*`:
  - client calls (`client.ts`)
  - API→DB mapping (`mapper.ts`)
  - cache-aware upsert/search/detail API (`index.ts`)
- `metadataLastSynced` implements a 24h cache policy before refetching RAWG details.
- Bulk ingestion/maintenance scripts live in `scripts/` (notably `import-rawg.ts` and related backfill/migration scripts).

### 5) API layer responsibilities
- Public read/search endpoints under `src/app/api/*` provide game/search/feed data.
- Search endpoint (`src/app/api/search/route.ts`) relies on Postgres fuzzy search (`word_similarity`) + accent normalization (`unaccent`) + JSONB genre filtering.
- Authenticated endpoints (reviews, user library, child profiles, Steam import, tips voting) gate behavior with `auth()` from `src/auth.ts`.

### 6) Auth model
- Main auth wiring: `src/auth.ts` using NextAuth + DrizzleAdapter + Google and Credentials providers.
- Auth persistence tables (`user`, `account`, `session`, `verificationToken`) are part of the same Drizzle schema.
- Credentials flow depends on reviewer env vars; JWT callback ensures `session.user.id` is populated for downstream API logic.

## Repo-specific implementation constraints
- Preserve a benefits-first product tone in user-facing content (project-level instruction from `CLAUDE.md`).
- Use Drizzle for DB access (no raw SQL query strings for normal data access paths).
- Use Zod input validation on API write surfaces.
- For scoring or recommendation work, read `docs/RUBRIC.md` first and treat it as canonical.
