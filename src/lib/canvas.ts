// Observer token: a parent/observer account observing the student (user id from env).
// Key API quirks discovered in session:
//  - /courses/:id/students/submissions → 403 (teacher-only)
//  - /courses/:id/enrollments?user_id[]=<observee-id> → 404 for these observer links
//  - /courses/:id/users/:id?include[]=enrollments → 403
//  - /users/<observee-id>/enrollments (observee's own enrollments, grades embedded) → ✓
//  - /users/<observee-id>/missing_submissions → ✓
//  - /courses/:id/assignments → ✓ (no submission include — times out otherwise)
//  - /courses/:id/pages → ✓

import { BIG_ASSIGNMENT_RE, bigAssignmentTypeLabel } from './assignments'
import { USE_FIXTURES, IS_E2E_TEST, IS_SAMPLE_MODE } from './mode'
export { BIG_ASSIGNMENT_RE, bigAssignmentTypeLabel }

const BASE = process.env.CANVAS_API_URL?.replace(/\/$/, '') ?? ''
const TOKEN = process.env.CANVAS_API_TOKEN ?? ''
// Never expose the real school's Canvas domain in sample mode.
export const CANVAS_WEB_URL = IS_SAMPLE_MODE ? 'https://example.test/canvas' : BASE.replace(/\/api\/v1$/, '')

export const STUDENT_ID = <observee-id>

export interface CourseInfo {
  id: number
  name: string
  short: string
  color: string
}

interface CanvasCourse {
  id: number
  name?: string
  course_code?: string
  workflow_state?: string
}

export const COURSES: Record<number, Omit<CourseInfo, 'id'>> = {
  8688: { name: 'Homeroom - 5th Grade',        short: 'Homeroom',      color: '#6B7280' },
  8958: { name: 'Vick 5th Grade Math',          short: 'Math',          color: '#3B82F6' },
  8526: { name: 'Language Arts - Trevino',      short: 'Language Arts', color: '#8B5CF6' },
  8574: { name: 'Vick 5th Grade Science',       short: 'Science',       color: '#10B981' },
  8961: { name: 'Social Studies - Trevino',     short: 'Social Studies',color: '#F59E0B' },
  8610: { name: '5th Grade Spanish - Irish',    short: 'Spanish',       color: '#EF4444' },
  8635: { name: '5th Grade Art 25/26',          short: 'Art',           color: '#EC4899' },
  8496: { name: '5th Grade Music - Schreiner',  short: 'Music',         color: '#6366F1' },
  8550: { name: 'Fifth Grade Library 25/26',    short: 'Library',       color: '#14B8A6' },
}

// Canvas's "active enrollments" for this observer token include stale enrollments from past
// school years that Canvas never marks concluded. There's no reliable field on the enrollment
// or course to tell those apart from this year's real classes — except *when* the enrollment
// was created. Enrollments cluster tightly by school year (a batch of same-day timestamps each
// August), so the most recent cluster is this year's real classes. This self-updates every
// future year with no manual course-ID list to maintain.
function schoolYearBucket(createdAt: string | undefined): number {
  const d = createdAt ? new Date(createdAt) : new Date()
  const y = d.getFullYear()
  return d.getMonth() >= 5 ? y : y - 1 // Jun-Dec -> this year's school year; Jan-May -> previous
}

function currentCourseIds(enrollments: Enrollment[]): Set<number> {
  const latestBucket = new Map<number, number>()
  for (const e of enrollments) {
    if (!Number.isFinite(e.course_id)) continue
    const bucket = schoolYearBucket(e.created_at)
    const prev = latestBucket.get(e.course_id)
    if (prev === undefined || bucket > prev) latestBucket.set(e.course_id, bucket)
  }
  if (!latestBucket.size) return new Set()
  const entries = Array.from(latestBucket.entries())
  const maxBucket = Math.max(...entries.map(([, b]) => b))
  return new Set(entries.filter(([, b]) => b === maxBucket).map(([id]) => id))
}

const COURSE_ORDER = [8958, 8526, 8574, 8961, 8610, 8635, 8496, 8550, 8688]
const COURSE_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6', '#F97316']

function courseColor(courseId: number) {
  return COURSES[courseId]?.color ?? COURSE_COLORS[Math.abs(courseId) % COURSE_COLORS.length]
}

function courseShort(courseId: number, name: string, code?: string) {
  if (COURSES[courseId]?.short) return COURSES[courseId].short
  const label = (code || name).replace(/\b(20\d{2}|2[0-9]\/[0-9]{2}|25\/26|26\/27)\b/g, '').trim()
  const words = label.split(/\s+/).filter(Boolean)
  if (words.length <= 2) return label || `Course ${courseId}`
  return words
    .filter(word => !/^(the|and|for|grade|class|course)$/i.test(word))
    .slice(0, 3)
    .join(' ') || words.slice(0, 2).join(' ')
}

function courseInfo(courseId: number, course?: CanvasCourse): CourseInfo {
  const known = COURSES[courseId]
  const name = known?.name ?? course?.name ?? course?.course_code ?? `Course ${courseId}`
  return {
    id: courseId,
    name,
    short: courseShort(courseId, name, course?.course_code),
    color: courseColor(courseId),
  }
}

function courseRank(courseId: number) {
  const rank = COURSE_ORDER.indexOf(courseId)
  return rank === -1 ? COURSE_ORDER.length : rank
}

function compareCourseInfo(a: CourseInfo, b: CourseInfo) {
  const byRank = courseRank(a.id) - courseRank(b.id)
  if (byRank !== 0) return byRank
  return a.short.localeCompare(b.short)
}

function compareEnrollment(a: Enrollment, b: Enrollment) {
  const byRank = courseRank(a.course_id) - courseRank(b.course_id)
  if (byRank !== 0) return byRank
  return (a.courseShort ?? a.courseName ?? String(a.course_id))
    .localeCompare(b.courseShort ?? b.courseName ?? String(b.course_id))
}

// ---------------------------------------------------------------------------

async function canvasFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!BASE || !TOKEN) {
    throw new Error('Canvas API credentials are not configured')
  }
  const url = new URL(`${BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.append(k, v)
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${TOKEN}` },
    next: { revalidate: 900 }, // 15-min Next.js cache
  })
  if (!res.ok) throw new Error(`Canvas ${res.status}: ${path}`)
  return res.json()
}

// /users/{id}/enrollments's include[]=course embed comes back empty for this observer token,
// and /courses/{id} 403s for courses this token isn't fully granted access to yet (e.g. brand
// new courses the school hasn't published to observers). /users/{id}/courses is the one endpoint
// that reliably returns full course details ONLY for courses we're actually confirmed to see —
// so it doubles as the "is this course real and visible" signal, not just a name lookup.
async function fetchAccessibleCourseDetails(): Promise<Map<number, CanvasCourse>> {
  try {
    const rows = await fetchAllPages<CanvasCourse>(`/users/${STUDENT_ID}/courses`, {})
    return new Map(rows.map(c => [c.id, c]))
  } catch {
    return new Map()
  }
}

async function fetchAllPages<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const results: T[] = []
  let page = 1
  while (true) {
    const page_params = { ...params, per_page: '100', page: String(page) }
    const rows = await canvasFetch<T[]>(path, page_params)
    if (!rows.length) break
    results.push(...rows)
    if (rows.length < 100) break
    page++
  }
  return results
}

// ---------------------------------------------------------------------------
// Public API

export interface Enrollment {
  course_id: number
  enrollment_state: string
  created_at?: string
  course?: CanvasCourse
  courseName?: string
  courseShort?: string
  courseColor?: string
  grades?: {
    current_grade: string | null
    current_score: number | null
    final_grade: string | null
    final_score: number | null
  }
}

function testCourses(): CourseInfo[] {
  return [
    courseInfo(8958, { id: 8958, name: 'Vick 5th Grade Math', course_code: 'Math' }),
    courseInfo(8526, { id: 8526, name: 'Language Arts - Trevino', course_code: 'Language Arts' }),
    courseInfo(8574, { id: 8574, name: 'Vick 5th Grade Science', course_code: 'Science' }),
    courseInfo(8961, { id: 8961, name: 'Social Studies - Trevino', course_code: 'Social Studies' }),
    courseInfo(9100, { id: 9100, name: 'Robotics Lab - New Semester', course_code: 'Robotics' }),
  ].sort(compareCourseInfo)
}

// Wholly fictional course IDs/names/teachers — no relation to any real school,
// student, or teacher. This is the only data set APP_MODE=sample may serve.
function sampleCourses(): CourseInfo[] {
  return [
    courseInfo(9201, { id: 9201, name: "Ms. Rivera's Math", course_code: 'Math' }),
    courseInfo(9202, { id: 9202, name: 'Language Arts - Chen', course_code: 'Language Arts' }),
    courseInfo(9203, { id: 9203, name: "Ms. Rivera's Science", course_code: 'Science' }),
    courseInfo(9204, { id: 9204, name: 'Social Studies - Chen', course_code: 'Social Studies' }),
    courseInfo(9205, { id: 9205, name: 'Robotics Lab - New Semester', course_code: 'Robotics' }),
  ].sort(compareCourseInfo)
}

function fixtureCourses(): CourseInfo[] {
  return IS_E2E_TEST ? testCourses() : sampleCourses()
}

function annotateEnrollment(enrollment: Enrollment): Enrollment {
  const course = courseInfo(enrollment.course_id, enrollment.course)
  return {
    ...enrollment,
    courseName: course.name,
    courseShort: course.short,
    courseColor: course.color,
  }
}

export async function getActiveCourses(): Promise<CourseInfo[]> {
  if (USE_FIXTURES) return fixtureCourses()

  const enrollments = await fetchAllPages<Enrollment>(`/users/${STUDENT_ID}/enrollments`, {
    'state[]': 'active',
    'include[]': 'course',
  })

  const currentIds = currentCourseIds(enrollments)
  const details = await fetchAccessibleCourseDetails()
  const seen = new Set<number>()
  return enrollments.flatMap(e => {
    if (!currentIds.has(e.course_id) || !details.has(e.course_id) || seen.has(e.course_id)) return []
    seen.add(e.course_id)
    return [courseInfo(e.course_id, details.get(e.course_id))]
  }).sort(compareCourseInfo)
}

async function getCourseInfo(courseId: number): Promise<CourseInfo> {
  if (USE_FIXTURES) return fixtureCourses().find(c => c.id === courseId) ?? courseInfo(courseId)
  return (await getActiveCourses()).find(c => c.id === courseId) ?? courseInfo(courseId)
}

function testGrades(): Enrollment[] {
  return [
    {
      course_id: 8958,
      enrollment_state: 'active',
      course: { id: 8958, name: 'Vick 5th Grade Math', course_code: 'Math' },
      grades: { current_grade: 'A-', current_score: 91, final_grade: 'A-', final_score: 91 },
    },
    {
      course_id: 8526,
      enrollment_state: 'active',
      course: { id: 8526, name: 'Language Arts - Trevino', course_code: 'Language Arts' },
      grades: { current_grade: 'B+', current_score: 88, final_grade: 'B+', final_score: 88 },
    },
    {
      course_id: 8574,
      enrollment_state: 'active',
      course: { id: 8574, name: 'Vick 5th Grade Science', course_code: 'Science' },
      grades: { current_grade: null, current_score: null, final_grade: null, final_score: null },
    },
    {
      course_id: 9100,
      enrollment_state: 'active',
      course: { id: 9100, name: 'Robotics Lab - New Semester', course_code: 'Robotics' },
      grades: { current_grade: 'A', current_score: 97, final_grade: 'A', final_score: 97 },
    },
  ]
}

function sampleGrades(): Enrollment[] {
  return [
    {
      course_id: 9201,
      enrollment_state: 'active',
      course: { id: 9201, name: "Ms. Rivera's Math", course_code: 'Math' },
      grades: { current_grade: 'A-', current_score: 91, final_grade: 'A-', final_score: 91 },
    },
    {
      course_id: 9202,
      enrollment_state: 'active',
      course: { id: 9202, name: 'Language Arts - Chen', course_code: 'Language Arts' },
      grades: { current_grade: 'B+', current_score: 88, final_grade: 'B+', final_score: 88 },
    },
    {
      course_id: 9203,
      enrollment_state: 'active',
      course: { id: 9203, name: "Ms. Rivera's Science", course_code: 'Science' },
      grades: { current_grade: null, current_score: null, final_grade: null, final_score: null },
    },
    {
      course_id: 9205,
      enrollment_state: 'active',
      course: { id: 9205, name: 'Robotics Lab - New Semester', course_code: 'Robotics' },
      grades: { current_grade: 'A', current_score: 97, final_grade: 'A', final_score: 97 },
    },
  ]
}

export async function getGrades(): Promise<Enrollment[]> {
  if (USE_FIXTURES) {
    return (IS_E2E_TEST ? testGrades() : sampleGrades()).map(annotateEnrollment).sort(compareEnrollment)
  }

  const active = await fetchAllPages<Enrollment>(`/users/${STUDENT_ID}/enrollments`, {
    'state[]': 'active',
    'include[]': 'course',
  })
  const currentIds = currentCourseIds(active)
  const details = await fetchAccessibleCourseDetails()
  return active
    .filter(e => currentIds.has(e.course_id) && details.has(e.course_id))
    .map(e => annotateEnrollment({ ...e, course: details.get(e.course_id) }))
    .sort(compareEnrollment)
}

export interface Assignment {
  id: number
  course_id: number
  name: string
  due_at: string | null
  created_at?: string | null
  updated_at?: string | null
  workflow_state?: string
  source?: 'assignment' | 'calendar'
  points_possible: number | null
  description: string | null
  html_url: string
  submission_types: string[]
  // Populated from discovered Canvas courses
  courseName?: string
  courseShort?: string
  courseColor?: string
  isTest?: boolean
}

function fixtureDate(daysFromToday: number, hour: number) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function withCourse(a: Assignment, course = fixtureCourses().find(c => c.id === a.course_id) ?? courseInfo(a.course_id)): Assignment {
  return {
    ...a,
    courseName: course.name,
    courseShort: course.short,
    courseColor: course.color,
    isTest: BIG_ASSIGNMENT_RE.test(a.name),
  }
}

function testAssignments(): Assignment[] {
  return [
    withCourse({
      id: 1001,
      course_id: 8958,
      name: 'Fractions Quiz',
      due_at: fixtureDate(1, 16),
      points_possible: 20,
      description: '<p>Review equivalent fractions and adding fractions.</p>',
      html_url: 'https://example.test/canvas/math/fractions-quiz',
      submission_types: ['online_quiz'],
      source: 'assignment',
    }),
    withCourse({
      id: 1002,
      course_id: 8526,
      name: 'Read chapter 4',
      due_at: fixtureDate(0, 19),
      points_possible: 10,
      description: '<p>Read the chapter and write one question.</p>',
      html_url: 'https://example.test/canvas/reading/chapter-4',
      submission_types: ['online_text_entry'],
      source: 'assignment',
    }),
    withCourse({
      id: 1003,
      course_id: 8961,
      name: 'Explorer poster project',
      due_at: fixtureDate(3, 15),
      points_possible: 30,
      description: '<p>Bring a draft poster to class.</p>',
      html_url: 'https://example.test/canvas/social-studies/explorer-poster',
      submission_types: ['none'],
      source: 'assignment',
    }),
    withCourse({
      id: 1004,
      course_id: 9100,
      name: 'Build a bridge sketch',
      due_at: fixtureDate(2, 17),
      points_possible: 15,
      description: '<p>Sketch a bridge idea from the robotics lab syllabus.</p>',
      html_url: 'https://example.test/canvas/robotics/bridge-sketch',
      submission_types: ['online_upload'],
      source: 'assignment',
    }),
    withCourse({
      id: -5001,
      course_id: 9100,
      name: 'Read simple machines page',
      due_at: fixtureDate(2, 9),
      points_possible: null,
      description: '<p>Teacher calendar note from Canvas.</p>',
      html_url: 'https://example.test/canvas/robotics/calendar/simple-machines',
      submission_types: ['calendar_event'],
      source: 'calendar',
    }),
  ].sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
}

function sampleAssignments(): Assignment[] {
  return [
    withCourse({
      id: 7001,
      course_id: 9201,
      name: 'Fractions Quiz',
      due_at: fixtureDate(1, 16),
      points_possible: 20,
      description: '<p>Review equivalent fractions and adding fractions.</p>',
      html_url: 'https://example.test/canvas/math/fractions-quiz',
      submission_types: ['online_quiz'],
      source: 'assignment',
    }),
    withCourse({
      id: 7002,
      course_id: 9202,
      name: 'Read chapter 4',
      due_at: fixtureDate(0, 19),
      points_possible: 10,
      description: '<p>Read the chapter and write one question.</p>',
      html_url: 'https://example.test/canvas/reading/chapter-4',
      submission_types: ['online_text_entry'],
      source: 'assignment',
    }),
    withCourse({
      id: 7003,
      course_id: 9204,
      name: 'Explorer poster project',
      due_at: fixtureDate(3, 15),
      points_possible: 30,
      description: '<p>Bring a draft poster to class.</p>',
      html_url: 'https://example.test/canvas/social-studies/explorer-poster',
      submission_types: ['none'],
      source: 'assignment',
    }),
    withCourse({
      id: 7004,
      course_id: 9205,
      name: 'Build a bridge sketch',
      due_at: fixtureDate(2, 17),
      points_possible: 15,
      description: '<p>Sketch a bridge idea from the robotics lab syllabus.</p>',
      html_url: 'https://example.test/canvas/robotics/bridge-sketch',
      submission_types: ['online_upload'],
      source: 'assignment',
    }),
    withCourse({
      id: -6001,
      course_id: 9205,
      name: 'Read simple machines page',
      due_at: fixtureDate(2, 9),
      points_possible: null,
      description: '<p>Teacher calendar note from Canvas.</p>',
      html_url: 'https://example.test/canvas/robotics/calendar/simple-machines',
      submission_types: ['calendar_event'],
      source: 'calendar',
    }),
  ].sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
}

function fixtureAssignments(): Assignment[] {
  return IS_E2E_TEST ? testAssignments() : sampleAssignments()
}

function shouldTrackAssignment(a: Assignment, cutoff: Date, noDueCutoff: Date) {
  if (a.workflow_state === 'deleted') return false
  if (a.due_at) return new Date(a.due_at) >= cutoff
  const touchedAt = a.updated_at ?? a.created_at
  if (!touchedAt) return true
  return new Date(touchedAt) >= noDueCutoff
}

function annotateAssignment(a: Assignment, course: CourseInfo): Assignment {
  return {
    ...a,
    course_id: course.id,
    courseName: course.name,
    courseShort: course.short,
    courseColor: course.color,
    isTest: BIG_ASSIGNMENT_RE.test(a.name),
    source: a.source ?? 'assignment',
  }
}

interface CanvasCalendarEvent {
  id: number
  title: string
  start_at: string | null
  end_at: string | null
  description: string | null
  html_url?: string
}

async function getCalendarEventsForCourse(course: CourseInfo): Promise<Assignment[]> {
  const start = new Date()
  start.setDate(start.getDate() - 14)
  const end = new Date()
  end.setDate(end.getDate() + 120)

  const events = await fetchAllPages<CanvasCalendarEvent>('/calendar_events', {
    'context_codes[]': `course_${course.id}`,
    type: 'event',
    start_date: start.toISOString(),
    end_date: end.toISOString(),
  })

  return events
    .filter(e => e.start_at && e.title)
    .map(e => annotateAssignment({
      id: -Math.abs(e.id),
      course_id: course.id,
      name: e.title,
      due_at: e.start_at,
      points_possible: null,
      description: e.description,
      html_url: e.html_url ?? `${CANVAS_WEB_URL}/courses/${course.id}`,
      submission_types: ['calendar_event'],
      source: 'calendar',
    }, course))
}

export async function getAssignmentsForCourse(courseId: number, knownCourse?: CourseInfo): Promise<Assignment[]> {
  if (USE_FIXTURES) return fixtureAssignments().filter(a => a.course_id === courseId)

  const course = knownCourse ?? await getCourseInfo(courseId)
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - 14) // include recent past-due work; older missing work comes from missing_submissions.
  const noDueCutoff = new Date(now)
  noDueCutoff.setDate(noDueCutoff.getDate() - 60)

  const all = await fetchAllPages<Assignment>(`/courses/${courseId}/assignments`, {
    order_by: 'due_at',
  })

  return all
    .filter(a => shouldTrackAssignment(a, cutoff, noDueCutoff))
    .map(a => annotateAssignment(a, course))
}

export async function getAllUpcomingAssignments(): Promise<Assignment[]> {
  if (USE_FIXTURES) return fixtureAssignments()

  const courses = await getActiveCourses()
  const results = await Promise.allSettled(
    courses.flatMap(course => [
      getAssignmentsForCourse(course.id, course),
      getCalendarEventsForCourse(course),
    ])
  )
  const assignments: Assignment[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') assignments.push(...r.value)
  }
  return assignments.sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
}

export interface MissingSubmission {
  id: number
  course_id: number
  name: string
  due_at: string | null
  points_possible: number | null
  html_url: string
  courseShort?: string
  courseColor?: string
}

export async function getMissingSubmissions(): Promise<MissingSubmission[]> {
  if (USE_FIXTURES) {
    const scienceId = IS_E2E_TEST ? 8574 : 9203
    const course = fixtureCourses().find(c => c.id === scienceId)!
    return [{
      id: 2001,
      course_id: course.id,
      name: 'Science lab reflection',
      due_at: fixtureDate(-1, 16),
      points_possible: 10,
      html_url: 'https://example.test/canvas/science/lab-reflection',
      courseShort: course.short,
      courseColor: course.color,
    }]
  }

  const [missing, courses] = await Promise.all([
    fetchAllPages<MissingSubmission>(`/users/${STUDENT_ID}/missing_submissions`, {
    'include[]': 'course',
    'filter[]': 'submittable',
    }),
    getActiveCourses().catch(() => []),
  ])
  const courseMap = Object.fromEntries(courses.map(c => [c.id, c]))
  return missing
    .filter(m => m.course_id in courseMap)
    .map(m => ({
      ...m,
      courseShort: courseMap[m.course_id]?.short ?? courseInfo(m.course_id).short,
      courseColor: courseMap[m.course_id]?.color ?? courseInfo(m.course_id).color,
    }))
}

export interface CoursePage {
  page_id: number
  title: string
  body: string
  url: string
}

export async function getCoursePages(courseId: number): Promise<CoursePage[]> {
  if (USE_FIXTURES) {
    return [
      {
        page_id: 0,
        title: 'Syllabus',
        body: '<p>Robotics bridge sketch due this week. Assigned reading: simple machines.</p>',
        url: 'syllabus',
      },
      {
        page_id: 3001,
        title: 'Fractions review',
        body: '<p>Equivalent fractions, common denominators, and simple word problems.</p>',
        url: 'fractions-review',
      },
    ]
  }

  try {
    const courseDetails = await canvasFetch<{ syllabus_body?: string | null }>(
      `/courses/${courseId}`,
      { 'include[]': 'syllabus_body' }
    ).catch(() => null)

    const pages = await fetchAllPages<{ page_id: number; title: string; url: string }>(
      `/courses/${courseId}/pages`
    )
    // Fetch body for syllabus / overview pages only (limit to first 5)
    const top = pages.slice(0, 5)
    const withBody = await Promise.allSettled(
      top.map(p =>
        canvasFetch<CoursePage>(`/courses/${courseId}/pages/${p.url}`)
      )
    )
    const coursePages = withBody
      .filter((r): r is PromiseFulfilledResult<CoursePage> => r.status === 'fulfilled')
      .map(r => r.value)
    if (courseDetails?.syllabus_body) {
      coursePages.unshift({
        page_id: 0,
        title: 'Syllabus',
        body: courseDetails.syllabus_body,
        url: 'syllabus',
      })
    }
    return coursePages
  } catch {
    return []
  }
}

export async function getAssignmentDetails(courseId: number, assignmentId: number): Promise<Assignment | null> {
  if (USE_FIXTURES) {
    return fixtureAssignments().find(a => a.course_id === courseId && a.id === assignmentId) ?? null
  }

  try {
    const a = await canvasFetch<Assignment>(`/courses/${courseId}/assignments/${assignmentId}`)
    return annotateAssignment(a, await getCourseInfo(courseId))
  } catch {
    return null
  }
}
