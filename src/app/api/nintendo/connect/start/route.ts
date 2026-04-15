import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { buildAuthUrl, generateVerifier } from '@/lib/nintendo/api'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const verifier = generateVerifier()
  const authUrl  = buildAuthUrl(verifier)

  // Return verifier to client — stored in sessionStorage, sent back with the pasted URL
  return NextResponse.json({ authUrl, verifier })
}
