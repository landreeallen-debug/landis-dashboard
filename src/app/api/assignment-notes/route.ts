import { NextRequest, NextResponse } from 'next/server'
import { getAssignmentNotes, saveAssignmentNotes } from '@/lib/db'

export async function GET(req: NextRequest) {
  const url   = new URL(req.url)
  const cid   = Number(url.searchParams.get('courseId'))
  const aid   = Number(url.searchParams.get('assignmentId'))
  if (!cid || !aid) return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  return NextResponse.json(await getAssignmentNotes(cid, aid))
}

export async function POST(req: NextRequest) {
  const { courseId, assignmentId, notes, quizletUrl } = await req.json()
  await saveAssignmentNotes(courseId, assignmentId, notes ?? null, quizletUrl ?? null)
  return NextResponse.json({ ok: true })
}
