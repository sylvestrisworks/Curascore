'use client'

import { NextStudio } from 'next-sanity/studio'
import config from '../../../../sanity.config'

export default function StudioComponent() {
  return <NextStudio config={config} />
}
