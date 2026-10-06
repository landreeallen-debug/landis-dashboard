import { NextRequest, NextResponse } from 'next/server'
import { getScheduleEvents, createScheduleEvent, updateScheduleEvent, deleteScheduleEvent } from '@/lib/db'

export async function GET(req: NextRequest) {
  const url  = new URL(req.url)
  const from = url.searchParams.get('from') ?? undefined
  const to   = url.searchParams.get('to')   ?? undefined
  return NextResponse.json(await getScheduleEvents(from, to))
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  await createScheduleEvent(data)
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { id, ...data } = await req.json()
  await updateScheduleEvent(id, data)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await deleteScheduleEvent(id)
  return NextResponse.json({ ok: true })
}
