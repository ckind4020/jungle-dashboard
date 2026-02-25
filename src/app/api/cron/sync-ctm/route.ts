import { NextResponse } from 'next/server'
import { syncCtmCalls } from '@/app/api/sync/ctm/route'

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Scan env vars to find all configured CTM locations
  const locationNumbers: string[] = []
  for (const key of Object.keys(process.env)) {
    const match = key.match(/^CTM_(\d+)_ACCOUNT_ID$/)
    if (match) {
      locationNumbers.push(`JUNGLE-${match[1]}`)
    }
  }

  if (locationNumbers.length === 0) {
    return NextResponse.json({ error: 'No CTM locations configured' }, { status: 500 })
  }

  // Sync last 2 days for each location
  const results = []
  for (const loc of locationNumbers) {
    console.log(`[sync-ctm cron] Syncing ${loc}...`)
    const result = await syncCtmCalls(loc, 2)
    console.log(`[sync-ctm cron] ${loc}: synced=${result.synced}, errors=${result.errors}`)
    results.push(result)
  }

  return NextResponse.json({ success: true, locations: results })
}

export async function POST(request: Request) {
  return GET(request)
}
