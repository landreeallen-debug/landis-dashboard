import { getGrades, CANVAS_WEB_URL } from '@/lib/canvas'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import PageBackdrop from '@/components/PageBackdrop'

export const revalidate = 900

function gradeLabel(grade: string | null, score: number | null) {
  if (grade) return grade
  if (score !== null) return `${Math.round(score)}%`
  return '—'
}

function scoreBar(score: number | null) {
  if (score === null) return null
  const pct = Math.min(100, Math.max(0, score))
  const color = pct >= 90 ? '#10B981' : pct >= 80 ? '#3B82F6' : pct >= 70 ? '#F59E0B' : '#EF4444'
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
      <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

export default async function GradesPage() {
  const enrollments = await getGrades().catch(() => [])

  const courseList = enrollments.map(e => ({
    id: e.course_id,
    name: e.courseName ?? `Course ${e.course_id}`,
    short: e.courseShort ?? String(e.course_id),
    color: e.courseColor ?? '#6B7280',
    enrollment: e,
  }))

  return (
    <div className="page-theme">
      <PageBackdrop theme="sky" />
      <h1 className="font-bold text-2xl mb-5">My Grades</h1>
      {courseList.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">
          <p className="text-lg font-semibold">No classes yet</p>
          <p className="text-sm mt-1">Landis's classes aren't showing up in Canvas yet this year — check back soon.</p>
        </div>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2">
        {courseList.map(({ id, name, short, color, enrollment }) => {
          const grade = enrollment?.grades?.current_grade ?? null
          const score = enrollment?.grades?.current_score ?? null
          const final = enrollment?.grades?.final_score ?? null

          return (
            <div key={id} className="card" style={{ borderTop: `4px solid ${color}` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{short}</p>
                  <p className="font-semibold text-gray-800 mt-0.5 leading-tight">{name}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-2xl font-bold" style={{ color }}>
                    {gradeLabel(grade, score)}
                  </span>
                  {score !== null && grade && (
                    <p className="text-xs text-gray-400">{Math.round(score)}%</p>
                  )}
                </div>
              </div>

              {scoreBar(score)}

              {final !== null && score !== null && Math.abs(final - score) > 1 && (
                <p className="text-xs text-gray-400 mt-1.5">
                  Final (including ungraded): {Math.round(final)}%
                </p>
              )}

              {score === null && (
                <p className="text-xs text-gray-400 mt-2">No grade posted yet</p>
              )}

              <div className="flex gap-2 mt-3">
                <Link
                  href={`/assignments?course=${id}`}
                  className="btn-ghost text-xs py-1.5 px-3"
                  style={{ color }}
                >
                  View assignments
                </Link>
                <Link
                  href={`${CANVAS_WEB_URL}/courses/${id}/grades`}
                  target="_blank"
                  className="btn-ghost text-xs py-1.5 px-3 gap-1"
                >
                  Canvas <ExternalLink size={11} />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}
