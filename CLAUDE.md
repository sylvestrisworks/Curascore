# LumiKin — Claude Code Instructions

## Project overview
LumiKin is a game rating engine for parents. It rates games on developmental benefits
(problem solving, teamwork, creativity, etc.) and design risks (addictive mechanics,
monetization pressure, FOMO, etc.), producing a time recommendation per game.

The project is GAMING POSITIVE. Benefits always come first in the UI. The tone is
informative and empowering, never fear-based.

## Key files
- `docs/RUBRIC.md` — The full scoring rubric. READ THIS FIRST. It defines all scoring
  dimensions, the time recommendation formula, and worked examples.
- `src/lib/scoring/engine.ts` — The scoring engine. This must exactly implement the
  formulas in RUBRIC.md.
- `src/lib/db/schema.ts` — The database schema. All tables.
- `src/components/GameCard.tsx` — The main UI component. This is the product.

## Tech decisions
- Next.js 14+ App Router with TypeScript
- PostgreSQL via Drizzle ORM
- Tailwind CSS for styling
- RAWG API for game metadata (key in .env as RAWG_API_KEY)
- IGDB API via Twitch OAuth for supplementary data (TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET)

## Code style
- Use TypeScript strict mode
- Prefer named exports
- Use Zod for runtime validation of API inputs
- All database queries go through Drizzle — no raw SQL
- Components use Tailwind — no CSS modules or styled-components
- Error handling: use Result types or try/catch with typed errors, never silent fails

## Database
- Run migrations with `npx drizzle-kit push`
- Schema changes go in `src/lib/db/schema.ts`, then generate migration
- Seed data: `npx tsx scripts/seed-reviews.ts`

## Scoring engine rules
- The scoring engine in `src/lib/scoring/` MUST match the formulas in `docs/RUBRIC.md`
- RIS = (R1_norm × 0.45) + (R2_norm × 0.30) + (R3_norm × 0.25)
- BDS = (B1_norm × 0.50) + (B2_norm × 0.30) + (B3_norm × 0.20)
- Time tiers: 0-0.15 → 120min, 0.16-0.30 → 90min, 0.31-0.50 → 60min,
  0.51-0.70 → 30min, 0.71+ → 15min/not recommended
- BDS ≥ 0.60 extends one tier (unless RIS > 0.70)
- BDS < 0.20 AND RIS > 0.30 drops one tier
- Content risk (R4) does NOT feed into time recommendation — separate display

## API design
- Public API: no auth required for reading game data
- Reviewer API: NextAuth session required
- All API routes validate input with Zod
- Return JSON with consistent shape: { data, error, meta }

## Testing
- Use Vitest for unit tests
- Scoring engine must have comprehensive tests (known game scores as fixtures)
- API routes tested with integration tests
