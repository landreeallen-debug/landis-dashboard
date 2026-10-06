import { getActiveCourses, getAllUpcomingAssignments } from '@/lib/canvas'
import { getImportantAssignmentIds } from '@/lib/importance'
import Link from 'next/link'
import { format, parseISO, isToday, isTomorrow, isPast, isThisWeek } from 'date-fns'
import { ExternalLink, Sparkles, BookOpen } from 'lucide-react'
import PageBackdrop from '@/components/PageBackdrop'
import ModeSelect from '@/components/ModeSelect'

export const revalidate = 900

function dueLabel(due_at: string | null) {
  if (!due_at) return 'No due date'
  const d = parseISO(due_at)
  if (isToday(d))    return `Today, ${format(d, 'h:mm a')}`
  if (isTomorrow(d)) return `Tomorrow, ${format(d, 'h:mm a')}`
  return format(d, 'EEE, MMM d • h:mm a')
}

function dueLabelColor(due_at: string | null) {
  if (!due_at) return 'text-gray-400'
  const d = parseISO(due_at)
  if (isPast(d))     return 'text-red-500'
  if (isToday(d))    return 'text-orange-500'
  if (isTomorrow(d)) return 'text-yellow-600'
  return 'text-gray-500'
}

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: { course?: string; mode?: string }
}) {
  const [all, courses] = await Promise.all([
    getAllUpcomingAssignments().catch(() => []),
    getActiveCourses().catch(() => []),
  ])
  const filterCourse = searchParams.course ? Number(searchParams.course) : null
  const mode = searchParams.mode === 'week' ? 'week' : 'important'

  const currentCourse = filterCourse ? courses.find(c => c.id === filterCourse) : null

  let filtered = all
  if (filterCourse) {
    filtered = all.filter(a => a.course_id === filterCourse)
  } else if (mode === 'week') {
    filtered = all.filter(a => a.due_at && isThisWeek(parseISO(a.due_at), { weekStartsOn: 1 }))
  } else {
    const importantIds = await getImportantAssignmentIds(courses, all)
    filtered = all.filter(a => importantIds.has(a.id))
  }

  return (
    <div className="page-theme">
      <PageBackdrop theme="underwater" />
      <div className="flex items-center justify-between mb-5">
        {currentCourse
          ? <h1 className="font-bold text-2xl text-white">{currentCourse.short} Assignments</h1>
          : <ModeSelect mode={mode} />
        }
        {filterCourse && (
          <Link href="/assignments" className="text-blue-500 text-sm font-semibold hover:underline">
            Show all
          </Link>
        )}
      </div>

      {/* Course filter chips */}
      <div className="flex gap-2 flex-wrap mb-5">
        <Link
          href="/assignments"
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            !filterCourse ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
          }`}
        >
          All
        </Link>
        {courses.map(c => (
          <Link
            key={c.id}
            href={`/assignments?course=${c.id}`}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filterCourse === c.id
                ? 'text-white border-transparent'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
            style={filterCourse === c.id ? { backgroundColor: c.color, borderColor: c.color } : {}}
          >
            {c.short}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">
          <p className="text-lg font-semibold">
            {!filterCourse && mode === 'important' && all.length > 0 ? 'Nothing big coming up!' : 'Nothing upcoming!'}
          </p>
          <p className="text-sm mt-1">
            {!filterCourse && mode === 'important' && all.length > 0
              ? 'No major tests or projects right now — just routine work.'
              : 'All caught up.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => (
            <div key={a.id} className="card flex items-start gap-3 p-4" style={{ borderLeft: `4px solid ${a.courseColor}` }}>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className="badge text-white text-[10px]" style={{ backgroundColor: a.courseColor }}>
                    {a.courseShort}
                  </span>
                  {a.isTest && <span className="badge bg-red-100 text-red-700">Test/Quiz</span>}
                  {a.points_possible !== null && (
                    <span className="text-[10px] text-gray-400">{a.points_possible} pts</span>
                  )}
                </div>
                <p className="font-semibold text-gray-900 text-sm leading-snug">{a.name}</p>
                <p className={`text-xs mt-1 font-medium ${dueLabelColor(a.due_at)}`}>
                  {dueLabel(a.due_at)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                {a.source !== 'calendar' && (
                  <Link
                    href={`/study/${a.course_id}/${a.id}`}
                    className="p-2 rounded-xl hover:bg-purple-50 text-purple-400 hover:text-purple-600 transition-colors"
                    title={a.isTest ? 'Study guide' : 'Notes'}
                    aria-label={`${a.isTest ? 'Open study guide' : 'Open notes'} for ${a.name}`}
                  >
                    {a.isTest ? <Sparkles size={16} /> : <BookOpen size={16} />}
                  </Link>
                )}
                <Link
                  href={a.html_url}
                  target="_blank"
                  className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Open in Canvas"
                  aria-label={`Open ${a.name} in Canvas`}
                >
                  <ExternalLink size={16} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
