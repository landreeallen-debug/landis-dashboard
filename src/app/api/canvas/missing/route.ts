import { NextResponse } from 'next/server'
import { getMissingSubmissions } from '@/lib/canvas'

export const dynamic = 'force-dynamic'

export async function GET() {
  const missing = await getMissingSubmissions()
  const annotated = missing.map(m => ({
    ...m,
    courseShort: m.courseShort ?? String(m.course_id),
    courseColor: m.courseColor ?? '#6B7280',
  }))
  return NextResponse.json(annotated)
}
