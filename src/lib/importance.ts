import crypto from 'crypto'
import { getCoursePages, type Assignment, type CourseInfo } from './canvas'
import { rankImportantAssignments } from './claude'
import { getImportantAssignmentsCache, saveImportantAssignmentsCache } from './db'
import { USE_FIXTURES } from './mode'
import { BIG_ASSIGNMENT_RE } from './assignments'

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function hashInput(syllabus: string, assignments: Assignment[]) {
  const basis = syllabus + '|' + assignments
    .map(a => `${a.id}:${a.name}:${a.points_possible}:${a.due_at}`)
    .sort()
    .join(',')
  return crypto.createHash('sha1').update(basis).digest('hex')
}

function heuristicImportant(list: Assignment[]) {
  return list.filter(a => a.isTest || BIG_ASSIGNMENT_RE.test(a.name)).map(a => a.id)
}

// Cross-references each course's syllabus against its upcoming assignments (via Claude) to
// pick out the ones worth focusing on, instead of every routine daily task. Results are cached
// per course and only recomputed when the syllabus or assignment list actually changes.
export async function getImportantAssignmentIds(
  courses: CourseInfo[],
  all: Assignment[]
): Promise<Set<number>> {
  const important = new Set<number>()
  const byCourse = new Map<number, Assignment[]>()
  for (const a of all) byCourse.set(a.course_id, [...(byCourse.get(a.course_id) ?? []), a])

  await Promise.all(courses.map(async course => {
    const list = byCourse.get(course.id) ?? []
    if (!list.length) return

    // Sample/e2e-test mode never calls Canvas or Claude — use a deterministic heuristic instead.
    if (USE_FIXTURES || !process.env.ANTHROPIC_API_KEY) {
      heuristicImportant(list).forEach(id => important.add(id))
      return
    }

    const pages = await getCoursePages(course.id).catch(() => [])
    const syllabus = stripHtml(pages.find(p => p.title === 'Syllabus')?.body ?? '').slice(0, 3000)
    const inputHash = hashInput(syllabus, list)

    const cached = await getImportantAssignmentsCache(course.id).catch(() => null)
    if (cached && cached.inputHash === inputHash) {
      cached.importantIds.forEach(id => important.add(id))
      return
    }

    const ids = await rankImportantAssignments({
      courseShort: course.short,
      syllabus,
      assignments: list.map(a => ({
        id: a.id, name: a.name, due_at: a.due_at, points_possible: a.points_possible, isTest: a.isTest ?? false,
      })),
    }).catch(() => heuristicImportant(list))

    await saveImportantAssignmentsCache(course.id, inputHash, ids).catch(() => {})
    ids.forEach(id => important.add(id))
  }))

  return important
}
