import { NextRequest, NextResponse } from 'next/server'
import {
  getAllExtracurriculars,
  createExtracurricular,
  deleteExtracurricular,
  updateExtracurricular,
} from '@/lib/db'

export async function GET() {
  const items = await getAllExtracurriculars()
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  await createExtracurricular(data)
  const items = await getAllExtracurriculars()
  return NextResponse.json(items[items.length - 1], { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { id, ...data } = await req.json()
  await updateExtracurricular(id, data)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await deleteExtracurricular(id)
  return NextResponse.json({ ok: true })
}
