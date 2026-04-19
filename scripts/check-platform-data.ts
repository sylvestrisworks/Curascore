import { db } from '@/lib/db'
import { platformExperiences, games } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

async function main() {
  const rows = await db
    .select({ slug: games.slug, title: games.title, count: sql<number>`count(${platformExperiences.id})` })
    .from(games)
    .leftJoin(platformExperiences, eq(platformExperiences.platformId, games.id))
    .where(eq(games.isPlatform, true))
    .groupBy(games.id, games.slug, games.title)

  console.log('Platform experience counts:')
  for (const r of rows) console.log(`  ${r.slug}: ${r.count}`)

  // Sample first 5 Fortnite Creative experiences to check platformId
  const [fnPlatform] = await db.select({ id: games.id }).from(games).where(eq(games.slug, 'fortnite-creative')).limit(1)
  const [robloxPlatform] = await db.select({ id: games.id }).from(games).where(eq(games.slug, 'roblox')).limit(1)

  console.log(`\nFortnite Creative platform ID: ${fnPlatform?.id}`)
  console.log(`Roblox platform ID: ${robloxPlatform?.id}`)

  if (robloxPlatform) {
    const robloxExps = await db
      .select({ id: platformExperiences.id, title: platformExperiences.title, platformId: platformExperiences.platformId })
      .from(platformExperiences)
      .where(eq(platformExperiences.platformId, robloxPlatform.id))
      .limit(3)
    console.log('\nSample Roblox experiences:', robloxExps.map(e => e.title))
  }

  if (fnPlatform) {
    const fnExps = await db
      .select({ id: platformExperiences.id, title: platformExperiences.title, platformId: platformExperiences.platformId })
      .from(platformExperiences)
      .where(eq(platformExperiences.platformId, fnPlatform.id))
      .limit(3)
    console.log('Sample Fortnite Creative experiences:', fnExps.map(e => e.title))
  }

  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
