'use client'
import { useState, useEffect, useRef } from 'react'
import {
  format, parseISO, isToday, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
  startOfWeek, endOfWeek,
} from 'date-fns'
import type { Assignment } from '@/lib/canvas'
import type { Extracurricular, ScheduleEvent } from '@/lib/db'
import { ChevronLeft, ChevronRight, Plus, Trash2, Edit2, Check, X } from 'lucide-react'
import HourGrid, { type GridItem } from '@/components/calendar/HourGrid'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6', '#F97316']

function blankEvent(date: string, hour?: number): Omit<ScheduleEvent, 'id' | 'created_at'> {
  const start_time = hour !== undefined ? `${String(hour).padStart(2, '0')}:00` : null
  return { title: '', date, start_time, end_time: null, notes: null, color: '#3B82F6' }
}

function timeStrToMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + (m || 0)
}

// ── Add / Edit form ──────────────────────────────────────────────────────────
function EventForm({
  initial,
  onSave,
  onCancel,
  saving = false,
}: {
  initial: Omit<ScheduleEvent, 'id' | 'created_at'>
  onSave: (data: Omit<ScheduleEvent, 'id' | 'created_at'>) => void
  onCancel: () => void
  saving?: boolean
}) {
  const [form, setForm] = useState(initial)
  return (
    <div className="card space-y-3 border-2 border-blue-200">
      <h3 className="font-bold text-sm text-gray-700">Add to schedule</h3>
      <input
        autoFocus
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        placeholder="What is it? *"
        value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Date</label>
          <input
            type="date"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Start time</label>
          <input
            type="time"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            value={form.start_time ?? ''}
            onChange={e => setForm(f => ({ ...f, start_time: e.target.value || null }))}
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Notes (optional)</label>
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
          placeholder="Any details…"
          value={form.notes ?? ''}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Color</label>
        <div className="flex gap-1.5 flex-wrap">
          {COLORS.map(c => (
            <button
              type="button"
              key={c}
              onClick={() => setForm(f => ({ ...f, color: c }))}
              aria-label={`Use color ${c}`}
              className={`w-6 h-6 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => form.title.trim() && !saving && onSave(form)}
          disabled={!form.title.trim() || saving}
          className="btn-primary text-sm py-2 flex-1 disabled:opacity-40"
        >
          <Check size={14} /> {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost text-sm py-2">
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
type ViewTab = 'today' | 'week' | 'month'
const VIEW_ORDER: ViewTab[] = ['today', 'week', 'month']

export default function SchedulePage() {
  // Up to 2 views can be active at once, shown side by side — like LifeHub's calendar.
  const [views,       setViews]       = useState<ViewTab[]>(['today'])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [activities,  setActivities]  = useState<Extracurricular[]>([])
  const [events,      setEvents]      = useState<ScheduleEvent[]>([])
  const [month,       setMonth]       = useState(new Date())

  // Form state: null = hidden, otherwise pre-filled date (and optional hour, from tapping a grid slot)
  const [addingSlot, setAddingSlot] = useState<{ date: string; hour?: number } | null>(null)
  const [editingEv,  setEditingEv]  = useState<ScheduleEvent | null>(null)
  const [savingEvent, setSavingEvent] = useState(false)
  const savingEventRef = useRef(false)
  const deletingEventIds = useRef<Set<number>>(new Set())

  async function loadEvents() {
    try {
      const data = await fetch('/api/schedule-events').then(r => r.json())
      setEvents(Array.isArray(data) ? data : [])
    } catch {
      setEvents([])
    }
  }

  useEffect(() => {
    fetch('/api/canvas/assignments').then(r => r.json()).then(data => setAssignments(Array.isArray(data) ? data : [])).catch(() => {})
    fetch('/api/extracurriculars').then(r => r.json()).then(data => setActivities(Array.isArray(data) ? data : [])).catch(() => {})
    loadEvents()
  }, [])

  async function saveNew(data: Omit<ScheduleEvent, 'id' | 'created_at'>) {
    if (savingEventRef.current) return
    savingEventRef.current = true
    setSavingEvent(true)
    try {
      const res = await fetch('/api/schedule-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Save failed')
      setAddingSlot(null)
      await loadEvents()
    } catch {
      // Keep the form open so the child can try again.
    } finally {
      savingEventRef.current = false
      setSavingEvent(false)
    }
  }

  async function saveEdit(data: Omit<ScheduleEvent, 'id' | 'created_at'>) {
    if (!editingEv) return
    if (savingEventRef.current) return
    savingEventRef.current = true
    setSavingEvent(true)
    try {
      const res = await fetch('/api/schedule-events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingEv.id, ...data }),
      })
      if (!res.ok) throw new Error('Save failed')
      setEditingEv(null)
      await loadEvents()
    } catch {
      // Keep the form open so the child can try again.
    } finally {
      savingEventRef.current = false
      setSavingEvent(false)
    }
  }

  async function deleteEv(id: number) {
    if (deletingEventIds.current.has(id)) return
    deletingEventIds.current.add(id)
    try {
      await fetch('/api/schedule-events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await loadEvents()
    } catch {
      // The next reload will restore the item if deletion failed.
    } finally {
      deletingEventIds.current.delete(id)
    }
  }

  // Helpers
  function assignmentsForDay(date: Date) {
    return assignments.filter(a => a.due_at && isSameDay(parseISO(a.due_at), date))
  }
  function activitiesForDow(dow: number) {
    return activities.filter(a => a.day_of_week === dow)
  }
  function eventsForDay(date: Date) {
    const key = format(date, 'yyyy-MM-dd')
    return events.filter(e => e.date === key)
  }
  function buildGridItems(days: Date[]): GridItem[] {
    const items: GridItem[] = []
    for (const day of days) {
      const key = format(day, 'yyyy-MM-dd')
      for (const ev of eventsForDay(day)) {
        const start = ev.start_time ? timeStrToMinutes(ev.start_time) : null
        const end = start !== null ? (ev.end_time ? timeStrToMinutes(ev.end_time) : start + 60) : null
        items.push({ id: `event-${ev.id}`, date: key, title: ev.title, startMinutes: start, endMinutes: end, color: ev.color, raw: ev })
      }
      for (const a of activitiesForDow(day.getDay())) {
        const start = a.start_time ? timeStrToMinutes(a.start_time) : null
        const end = start !== null ? (a.end_time ? timeStrToMinutes(a.end_time) : start + 60) : null
        items.push({ id: `activity-${a.id}`, date: key, title: a.name, startMinutes: start, endMinutes: end, color: a.color })
      }
      for (const a of assignmentsForDay(day)) {
        const start = a.due_at ? timeStrToMinutes(format(parseISO(a.due_at), 'HH:mm')) : null
        const end = start !== null ? start + 30 : null
        items.push({
          id: `assignment-${a.id}`,
          date: key,
          title: `${a.isTest ? '★ ' : ''}${a.name}`,
          startMinutes: start,
          endMinutes: end,
          color: a.courseColor ?? '#6B7280',
        })
      }
    }
    return items
  }

  const todayStr   = format(new Date(), 'yyyy-MM-dd')
  const todayDow   = new Date().getDay()
  const monthStart = startOfMonth(month)
  const monthEnd   = endOfMonth(month)
  const calDays    = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) })

  const weekDays = eachDayOfInterval({
    start: startOfWeek(new Date(), { weekStartsOn: 1 }),
    end:   endOfWeek(new Date(),   { weekStartsOn: 1 }),
  }).slice(0, 5) // Mon–Fri

  const weekGridItems  = buildGridItems(weekDays)

  function toggleView(v: ViewTab) {
    setViews(prev => {
      if (prev.includes(v)) return prev.length === 1 ? prev : prev.filter(x => x !== v)
      const next = [...prev, v]
      return next.length > 2 ? next.slice(next.length - 2) : next
    })
  }
  const active = VIEW_ORDER.filter(v => views.includes(v))

  // Global + button date: today for Today view, start of week for Week, first of month for Month
  function defaultAddDate() {
    const primary = active[0] ?? 'today'
    if (primary === 'today') return todayStr
    if (primary === 'week')  return format(weekDays[0], 'yyyy-MM-dd')
    return format(monthStart, 'yyyy-MM-dd')
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-bold text-2xl">Schedule</h1>
        <button
          type="button"
          onClick={() => { setEditingEv(null); setAddingSlot({ date: defaultAddDate() }) }}
          className="btn-primary text-sm py-2"
        >
          <Plus size={16} /> Add event
        </button>
      </div>

      {/* View toggle bar — tap a second view to show it side by side (max 2) */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5">
        {VIEW_ORDER.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => toggleView(t)}
            aria-pressed={views.includes(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
              views.includes(t) ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Global add/edit form (shown when triggered from header button) */}
      {addingSlot !== null && (
        <div className="mb-4">
          <EventForm
            initial={blankEvent(addingSlot.date, addingSlot.hour)}
            onSave={saveNew}
            onCancel={() => setAddingSlot(null)}
            saving={savingEvent}
          />
        </div>
      )}
      {editingEv && (
        <div className="mb-4">
          <EventForm
            initial={{ title: editingEv.title, date: editingEv.date, start_time: editingEv.start_time, end_time: editingEv.end_time, notes: editingEv.notes, color: editingEv.color }}
            onSave={saveEdit}
            onCancel={() => setEditingEv(null)}
            saving={savingEvent}
          />
        </div>
      )}

      {/* Active views, side by side when 2 are selected */}
      <div className={`grid gap-4 ${active.length > 1 ? 'lg:grid-cols-2' : ''}`}>
      {/* ── TODAY ── */}
      {active.includes('today') && (
        <div className="space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">{format(new Date(), 'EEEE, MMMM d')}</h2>
            <button
              type="button"
              onClick={() => { setEditingEv(null); setAddingSlot({ date: todayStr }) }}
              className="text-xs text-blue-500 font-semibold hover:underline flex items-center gap-1"
            >
              <Plus size={13} /> Add to today
            </button>
          </div>

          {/* Activities */}
          {activities.filter(a => a.day_of_week === todayDow).length > 0 && (
            <section>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Activities</h3>
              {activities.filter(a => a.day_of_week === todayDow).map(a => (
                <div key={a.id} className="card p-3 flex items-center gap-3 mb-2" style={{ borderLeft: `4px solid ${a.color}` }}>
                  <div>
                    <p className="font-semibold text-sm">{a.name}</p>
                    {(a.start_time || a.location) && (
                      <p className="text-xs text-gray-400">{a.start_time}{a.end_time ? `–${a.end_time}` : ''}{a.location ? ` · ${a.location}` : ''}</p>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Custom events */}
          {eventsForDay(new Date()).length > 0 && (
            <section>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">My events</h3>
              {eventsForDay(new Date()).map(ev => (
                editingEv?.id === ev.id ? null :
                <div key={ev.id} className="card p-3 flex items-center gap-3 mb-2" style={{ borderLeft: `4px solid ${ev.color}` }}>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{ev.title}</p>
                    {(ev.start_time || ev.notes) && (
                      <p className="text-xs text-gray-400">{ev.start_time ?? ''}{ev.notes ? ` · ${ev.notes}` : ''}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => { setAddingSlot(null); setEditingEv(ev) }} aria-label={`Edit ${ev.title}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Edit2 size={14} /></button>
                    <button type="button" onClick={() => deleteEv(ev.id)} aria-label={`Delete ${ev.title}`} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Canvas assignments */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Due today</h3>
            {assignmentsForDay(new Date()).length === 0
              ? <p className="text-gray-400 text-sm">Nothing due!</p>
              : assignmentsForDay(new Date()).map(a => (
                  <div key={a.id} className="card p-3 mb-2" style={{ borderLeft: `4px solid ${a.courseColor}` }}>
                    <span className="text-xs font-semibold" style={{ color: a.courseColor }}>{a.courseShort}</span>
                    <p className="text-sm font-semibold">{a.name}</p>
                    {a.due_at && <p className="text-xs text-gray-400">{format(parseISO(a.due_at), 'h:mm a')}</p>}
                  </div>
                ))
            }
          </section>
        </div>
      )}

      {/* ── WEEK ── */}
      {active.includes('week') && (
        <div className="space-y-4 min-w-0">
          <HourGrid
            days={weekDays}
            items={weekGridItems}
            onSlot={(dateKey, hour) => { setEditingEv(null); setAddingSlot({ date: dateKey, hour }) }}
            onItem={item => { if (item.raw) { setAddingSlot(null); setEditingEv(item.raw) } }}
          />
          <p className="text-xs text-gray-400 text-center">★ = test or quiz · tap an empty slot to add an event</p>
        </div>
      )}

      {/* ── MONTH ── */}
      {active.includes('month') && (
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={() => setMonth(m => subMonths(m, 1))} className="btn-ghost p-2" aria-label="Previous month"><ChevronLeft size={18} /></button>
            <h2 className="font-bold text-lg">{format(month, 'MMMM yyyy')}</h2>
            <button type="button" onClick={() => setMonth(m => addMonths(m, 1))} className="btn-ghost p-2" aria-label="Next month"><ChevronRight size={18} /></button>
          </div>

          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden">
            {DAY_NAMES.map(d => (
              <div key={d} className="bg-gray-50 text-center text-xs font-semibold text-gray-500 py-2">{d}</div>
            ))}
            {calDays.map(day => {
              const inMonth  = isSameMonth(day, month)
              const today    = isToday(day)
              const dayItems = assignmentsForDay(day)
              const dayEvs   = eventsForDay(day)
              const acts     = activitiesForDow(day.getDay())
              const hasTest  = dayItems.some(a => a.isTest)
              const dateKey  = format(day, 'yyyy-MM-dd')

              return (
                <div
                  key={day.toISOString()}
                  className={`bg-white min-h-[64px] p-1 ${!inMonth ? 'opacity-30' : ''} ${today ? 'ring-2 ring-inset ring-blue-400' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-semibold ${today ? 'text-blue-600' : 'text-gray-700'}`}>
                      {format(day, 'd')}
                    </p>
                    {inMonth && (
                      <button
                        type="button"
                        onClick={() => { setEditingEv(null); setAddingSlot({ date: dateKey }) }}
                        className="text-gray-300 hover:text-blue-400 transition-colors"
                        aria-label={`Add event on ${format(day, 'MMMM d')}`}
                        title="Add event"
                      >
                        <Plus size={10} />
                      </button>
                    )}
                  </div>
                  {/* Custom events first (blue/colored dots) */}
                  {dayEvs.slice(0, 1).map(ev => (
                    <div key={ev.id} className="text-[9px] truncate rounded px-1 mb-0.5 text-white" style={{ backgroundColor: ev.color }}>
                      {ev.title}
                    </div>
                  ))}
                  {acts.slice(0, 1).map(a => (
                    <div key={a.id} className="text-[9px] truncate rounded px-1 mb-0.5 text-white" style={{ backgroundColor: a.color }}>
                      {a.name}
                    </div>
                  ))}
                  {dayItems.slice(0, 2).map(a => (
                    <div
                      key={a.id}
                      className={`text-[9px] truncate rounded px-1 mb-0.5 text-white ${hasTest ? 'font-bold' : ''}`}
                      style={{ backgroundColor: a.courseColor }}
                    >
                      {a.isTest ? '★ ' : ''}{a.courseShort}
                    </div>
                  ))}
                  {(dayItems.length + dayEvs.length) > 3 && (
                    <p className="text-[9px] text-gray-400">+{dayItems.length + dayEvs.length - 3}</p>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">★ = test or quiz · tap + on any day to add an event</p>
        </div>
      )}
      </div>
    </div>
  )
}
