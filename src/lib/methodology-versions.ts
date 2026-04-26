import type { ComponentType } from 'react'
import V10 from '../../content/methodology/v1.0.mdx'

// Add new versions here as they're published:
// import V11 from '../../content/methodology/v1.1.mdx'

export const VERSION_COMPONENTS: Record<string, ComponentType> = {
  '1.0': V10,
}
