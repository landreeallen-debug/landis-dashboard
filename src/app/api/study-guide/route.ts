import { NextRequest, NextResponse } from 'next/server'
import { getAssignmentDetails, getCoursePages } from '@/lib/canvas'
import { generateStudyGuide, generateTestOverview } from '@/lib/claude'
import { getStudyGuide, saveStudyGuide } from '@/lib/db'
import { USE_FIXTURES } from '@/lib/mode'

export async function POST(req: NextRequest) {
  const { courseId, assignmentId, force = false } = await req.json()

  if (!courseId || !assignmentId) {
    return NextResponse.json({ error: 'courseId and assignmentId required' }, { status: 400 })
  }

  if (USE_FIXTURES) {
    return NextResponse.json({
      content: [
        '# Fractions Quiz Study Guide',
        '## What to review',
        '- Equivalent fractions',
        '- Common denominators',
        '- Two word problems',
      ].join('\n'),
      cached: false,
      force,
    })
  }

  // Return cached unless forced regeneration
  if (!force) {
    const cached = await getStudyGuide(courseId, assignmentId)
    if (cached) return NextResponse.json({ content: cached, cached: true })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set — add it to .env.local' }, { status: 503 })
  }

  const [assignment, pages] = await Promise.all([
    getAssignmentDetails(courseId, assignmentId),
    getCoursePages(courseId),
  ])

  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }

  const pagesContent = pages
    .map(p => `## ${p.title}\n${(p.body ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`)
    .join('\n\n')
    .slice(0, 4000) // Stay well within token budget

  const content = await generateStudyGuide({
    assignmentName: assignment.name,
    courseShort: assignment.courseShort ?? '',
    description: assignment.description
      ? assignment.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : null,
    dueAt: assignment.due_at,
    isTest: assignment.isTest ?? false,
    pagesContent,
  })

  await saveStudyGuide(courseId, assignmentId, content)
  return NextResponse.json({ content, cached: false })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const courseId = Number(url.searchParams.get('courseId'))
  const assignmentId = Number(url.searchParams.get('assignmentId'))
  const type = url.searchParams.get('type') // 'overview' for day-before banner

  if (!courseId || !assignmentId) {
    return NextResponse.json({ error: 'courseId and assignmentId required' }, { status: 400 })
  }

  if (USE_FIXTURES) {
    if (type === 'overview') {
      return NextResponse.json({
        overview: 'This quiz is about fractions. Review equivalent fractions and practice one word problem tonight.',
      })
    }
    return NextResponse.json({ content: null, cached: true })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 503 })
  }

  if (type === 'overview') {
    const [assignment, pages] = await Promise.all([
      getAssignmentDetails(courseId, assignmentId),
      getCoursePages(courseId),
    ])
    if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const pagesContent = pages
      .map(p => `${p.title}: ${(p.body ?? '').replace(/<[^>]+>/g, ' ').slice(0, 500)}`)
      .join('\n').slice(0, 2000)
    const overview = await generateTestOverview({
      assignmentName: assignment.name,
      courseShort: assignment.courseShort ?? '',
      description: assignment.description?.replace(/<[^>]+>/g, ' ') ?? null,
      pagesContent,
    })
    return NextResponse.json({ overview })
  }

  const cached = await getStudyGuide(courseId, assignmentId)
  return NextResponse.json({ content: cached, cached: true })
}
