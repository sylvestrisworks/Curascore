import type { ComponentType } from 'react'
import V10 from '../../content/methodology/v1.0.mdx'
import V11 from '../../content/methodology/v1.1.mdx'
import { METHODOLOGY_REGISTRY } from './methodology'

export const VERSION_COMPONENTS: Record<string, ComponentType> = {
  '1.0': V10,
  '1.1': V11,
}

// Guard: every registered methodology version MUST have an MDX component.
// If you bump CURRENT_METHODOLOGY_VERSION or add an entry to METHODOLOGY_REGISTRY
// without adding a content/methodology/vX.Y.mdx file and wiring it above,
// this throws at module load — surfacing the missing page instead of silently 404ing.
const missing = METHODOLOGY_REGISTRY
  .map(m => m.version)
  .filter(v => !VERSION_COMPONENTS[v])

if (missing.length > 0) {
  throw new Error(
    `Methodology registry references version(s) without an MDX component: ${missing.join(', ')}. ` +
    `Create content/methodology/v${missing[0]}.mdx and register it in src/lib/methodology-versions.ts.`,
  )
}
