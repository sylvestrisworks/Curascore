export type MethodologyVersion = {
  version: string
  publishedDate: string  // ISO date
  changelogSummary: string
  isCurrent: boolean
}

export const METHODOLOGY_REGISTRY: MethodologyVersion[] = [
  {
    version:          '1.0',
    publishedDate:    '2026-04-15',
    changelogSummary: 'Initial methodology.',
    isCurrent:        true,
  },
]

export const CURRENT_METHODOLOGY_VERSION =
  METHODOLOGY_REGISTRY.find(m => m.isCurrent)!.version
