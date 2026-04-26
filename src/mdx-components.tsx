import type { MDXComponents } from 'mdx/types'

// Minimal pass-through. Prose styling is applied via wrapper classNames
// in the methodology layout — not here — so it stays scoped to that page.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...components }
}
