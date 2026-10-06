import { NextResponse } from 'next/server'
import { getAllUpcomingAssignments } from '@/lib/canvas'

export const dynamic = 'force-dynamic'

export async function GET() {
  const assignments = await getAllUpcomingAssignments()
  return NextResponse.json(assignments)
}
