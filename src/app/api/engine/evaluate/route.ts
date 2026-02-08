import { NextResponse } from 'next/server'
import { runActionEngine } from '@/lib/action-engine/engine'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // In production, require auth. For now, allow open access for testing.
  if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runActionEngine()
    return NextResponse.json({ success: true, ...result })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Allow GET for easy browser testing
export async function GET(request: Request) {
  return POST(request)
}
