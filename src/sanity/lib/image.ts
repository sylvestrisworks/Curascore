import createImageUrlBuilder from '@sanity/image-url'
import { sanityClient } from './client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SanityImageSource = any

const builder = sanityClient ? createImageUrlBuilder(sanityClient) : null

export function urlFor(source: SanityImageSource) {
  return builder?.image(source)
}
