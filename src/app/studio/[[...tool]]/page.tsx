export { metadata, viewport } from 'next-sanity/studio'
export const dynamic = 'force-dynamic'

import dynamicImport from 'next/dynamic'

const Studio = dynamicImport(() => import('./studio-component'), { ssr: false })

export default function StudioPage() {
  return <Studio />
}
