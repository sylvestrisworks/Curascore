/**
 * Creates nintendo_connections and nintendo_playtime tables.
 */

import { sql } from 'drizzle-orm'
import { db } from '../src/lib/db'

async function main() {
  console.log('Creating nintendo_connections…')
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS nintendo_connections (
      id            SERIAL PRIMARY KEY,
      user_id       TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
      na_id         VARCHAR(50) NOT NULL UNIQUE,
      nickname      VARCHAR(100),
      image_url     TEXT,
      session_token TEXT NOT NULL,
      created_at    TIMESTAMP DEFAULT NOW(),
      last_synced_at TIMESTAMP
    )
  `)

  console.log('Creating nintendo_playtime…')
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS nintendo_playtime (
      id                 SERIAL PRIMARY KEY,
      user_id            TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      na_id              VARCHAR(50) NOT NULL,
      device_id          VARCHAR(100) NOT NULL,
      device_name        VARCHAR(100),
      date               VARCHAR(10) NOT NULL,
      app_id             VARCHAR(100) NOT NULL,
      app_title          VARCHAR(255),
      app_image_url      TEXT,
      play_time_minutes  INTEGER NOT NULL DEFAULT 0,
      created_at         TIMESTAMP DEFAULT NOW(),
      CONSTRAINT nintendo_playtime_unique UNIQUE (na_id, device_id, date, app_id)
    )
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS nintendo_playtime_user_idx ON nintendo_playtime (user_id)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS nintendo_playtime_date_idx ON nintendo_playtime (user_id, date)`)

  console.log('Done.')
}

main().catch(err => { console.error(err); process.exit(1) })
