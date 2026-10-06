import { getAllUpcomingAssignments, getMissingSubmissions, getGrades, BIG_ASSIGNMENT_RE } from '@/lib/canvas'
import WarningOverlay from '@/components/WarningOverlay'
import type { WarningItem } from '@/components/WarningOverlay'
import NightlyChecklist from '@/components/NightlyChecklist'
import PageBackdrop from '@/components/PageBackdrop'
import Link from 'next/link'
import { format, isToday, isTomorrow, isThisWeek, parseISO, addDays } from 'date-fns'
import { AlertCircle, ExternalLink, BookOpen, Sparkles } from 'lucide-react'
import { getScheduleEvents } from '@/lib/db'
import { DISPLAY_NAME } from '@/lib/mode'

export const revalidate = 900 // Refresh data every 15 min

export default async function Dashboard() {
  const now        = new Date()
  const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd')

  const [assignments, missing, enrollments, tomorrowEvents] = await Promise.all([
    getAllUpcomingAssignments().catch(() => []),
    getMissingSubmissions().catch(() => []),
    getGrades().catch(() => []),
    getScheduleEvents(tomorrowStr, tomorrowStr).catch(() => []),
  ])

  const dueToday    = assignments.filter(a => a.due_at && isToday(parseISO(a.due_at)))
  const dueTomorrow = assignments.filter(a => a.due_at && isTomorrow(parseISO(a.due_at)))
  const dueThisWeek = assignments.filter(a => a.due_at && isThisWeek(parseISO(a.due_at), { weekStartsOn: 1 }) && !isToday(parseISO(a.due_at)) && !isTomorrow(parseISO(a.due_at)))
  const testsToday  = dueToday.filter(a => a.isTest)

  // Normalize Canvas big-assignments for tomorrow
  const canvasWarnings: WarningItem[] = dueTomorrow
    .filter(a => a.isTest)
    .map(a => ({
      id:          `canvas-${a.id}`,
      title:       a.name,
      dueAt:       a.due_at,
      courseLabel: a.courseShort ?? 'Canvas',
      color:       a.courseColor ?? '#EF4444',
      canvasUrl:   a.html_url,
      studyLink:   a.source === 'calendar' ? null : `/study/${a.course_id}/${a.id}`,
    }))

  // Normalize custom schedule events for tomorrow that match the keyword list
  const eventWarnings: WarningItem[] = tomorrowEvents
    .filter(e => BIG_ASSIGNMENT_RE.test(e.title))
    .map(e => ({
      id:          `event-${e.id}`,
      title:       e.title,
      dueAt:       e.start_time ? `${e.date}T${e.start_time}:00` : null,
      courseLabel: 'My schedule',
      color:       e.color,
      canvasUrl:   null,
      studyLink:   null,
    }))

  const allWarnings = [...canvasWarnings, ...eventWarnings]

  // Every subject Landis is currently enrolled in, for the nightly checklist.
  const courses = Array.from(
    new Map(enrollments.map(e => [e.course_id, { id: e.course_id, short: e.courseShort ?? String(e.course_id) }])).values()
  )

  const dayOfWeek = format(now, 'EEEE')
  const dateStr   = format(now, 'MMMM d, yyyy')

  return (
    <div className="page-theme space-y-5">
      <PageBackdrop theme="fire" />
      {/* Header */}
      <div className="card">
        <p className="text-gray-500 text-sm font-medium">{dayOfWeek}, {dateStr}</p>
        <h1 className="text-2xl font-bold mt-0.5">Hi {DISPLAY_NAME}!</h1>
        {dueToday.length === 0
          ? <p className="text-gray-500 text-sm mt-1">Nothing due today — great start!</p>
          : <p className="text-gray-500 text-sm mt-1">{dueToday.length} thing{dueToday.length > 1 ? 's' : ''} due today</p>
        }
      </div>

      {/* Day-before warning overlay (Canvas + custom schedule events) */}
      <WarningOverlay items={allWarnings} displayName={DISPLAY_NAME} />

      {/* Tests due today */}
      {testsToday.length > 0 && (
        <div className="rounded-2xl border-2 border-orange-400 bg-orange-50 p-4">
          <p className="font-bold text-orange-800 text-sm uppercase tracking-wide mb-1">Test/Quiz Today!</p>
          {testsToday.map(t => (
            <div key={t.id} className="flex items-center justify-between">
              <span className="text-orange-900 font-medium">{t.name} <span className="text-orange-600 text-sm">({t.courseShort})</span></span>
              <Link href={t.html_url} target="_blank" aria-label={`Open ${t.name} in Canvas`} className="text-orange-600 hover:text-orange-800"><ExternalLink size={14} /></Link>
            </div>
          ))}
        </div>
      )}

      {/* Missing work alert */}
      {missing.length > 0 && (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={18} className="text-red-500" />
            <p className="font-bold text-red-800 text-sm">{missing.length} Missing Assignment{missing.length > 1 ? 's' : ''}</p>
          </div>
          <ul className="space-y-1">
            {missing.map(m => (
              <li key={m.id} className="flex items-center justify-between text-sm">
                <span className="text-red-800">{m.name} <span className="text-red-500">({m.courseShort ?? m.course_id})</span></span>
              <Link href={m.html_url} target="_blank" aria-label={`Open ${m.name} in Canvas`} className="text-red-500 hover:text-red-700 shrink-0 ml-2"><ExternalLink size={13} /></Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Due Today */}
      {dueToday.length > 0 && (
        <section>
          <h2 className="font-bold text-lg mb-3">Due Today</h2>
          <div className="space-y-2">
            {dueToday.map(a => <AssignmentRow key={a.id} a={a} highlight />)}
          </div>
        </section>
      )}

      {/* Due Tomorrow */}
      {dueTomorrow.length > 0 && (
        <section>
          <h2 className="font-bold text-lg mb-3">Due Tomorrow</h2>
          <div className="space-y-2">
            {dueTomorrow.map(a => <AssignmentRow key={a.id} a={a} />)}
          </div>
        </section>
      )}

      {/* Due This Week */}
      {dueThisWeek.length > 0 && (
        <section>
          <h2 className="font-bold text-lg mb-3">Later This Week</h2>
          <div className="space-y-2">
            {dueThisWeek.map(a => <AssignmentRow key={a.id} a={a} />)}
          </div>
        </section>
      )}

      {/* Nightly checklist */}
      <div className="relative">
        <img
          src="/dino-checklist.png"
          alt=""
          aria-hidden
          className="absolute -top-16 right-2 w-32 sm:w-40 z-0 pointer-events-none select-none drop-shadow-xl"
        />
        <NightlyChecklist courses={courses} />
      </div>
    </div>
  )
}

function AssignmentRow({ a, highlight = false }: { a: Awaited<ReturnType<typeof getAllUpcomingAssignments>>[0]; highlight?: boolean }) {
  const dueTime = a.due_at ? format(parseISO(a.due_at), 'h:mm a') : ''
  return (
    <div className={`card flex items-center gap-3 p-3 ${highlight ? 'border-l-4' : ''}`} style={highlight ? { borderLeftColor: a.courseColor } : {}}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="badge text-white text-[10px]"
            style={{ backgroundColor: a.courseColor }}
          >{a.courseShort}</span>
          {a.isTest && <span className="badge bg-red-100 text-red-700">Test</span>}
        </div>
        <p className="text-sm font-semibold mt-1 truncate">{a.name}</p>
        {dueTime && <p className="text-xs text-gray-400 mt-0.5">Due {dueTime}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {a.isTest && a.source !== 'calendar' && (
          <Link href={`/study/${a.course_id}/${a.id}`} className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-500" title="Study guide" aria-label={`Open study guide for ${a.name}`}>
            <Sparkles size={15} />
          </Link>
        )}
        <Link href={a.html_url} target="_blank" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title="Open in Canvas" aria-label={`Open ${a.name} in Canvas`}>
          <ExternalLink size={15} />
        </Link>
        {a.source !== 'calendar' && (
          <Link href={`/study/${a.course_id}/${a.id}`} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400" title="Notes & study guide" aria-label={`Open notes and study guide for ${a.name}`}>
            <BookOpen size={15} />
          </Link>
        )}
      </div>
    </div>
  )
}
