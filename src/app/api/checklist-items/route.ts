import { NextRequest, NextResponse } from 'next/server'
import { getChecklistItemsForDate, createChecklistItem, deleteChecklistItem } from '@/lib/db'

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? todayDate()
  const items = await getChecklistItemsForDate(date)
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  const item = await createChecklistItem(data)
  return NextResponse.json(item, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await deleteChecklistItem(id)
  return NextResponse.json({ ok: true })
}
