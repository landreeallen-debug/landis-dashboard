import { createClient } from '@libsql/client'
import path from 'path'
import fs from 'fs'
import { IS_SAMPLE_MODE } from './mode'

// Sample mode never reads or writes the real family database — an in-memory
// db keeps demo visitors from seeing (or persisting into) real schedule/notes data.
const DATA_DIR = process.env.LANDIS_DATA_DIR
  ? path.resolve(process.cwd(), process.env.LANDIS_DATA_DIR)
  : path.join(process.cwd(), '.data')
if (!IS_SAMPLE_MODE && !fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const db = createClient({ url: IS_SAMPLE_MODE ? ':memory:' : `file:${path.join(DATA_DIR, 'landis.db')}` })

// Run DDL once at module load (top-level await works in Next.js server context)
const ready = (async () => {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS extracurriculars (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      day_of_week INTEGER,
      start_time  TEXT,
      end_time    TEXT,
      location    TEXT,
      notes       TEXT,
      color       TEXT DEFAULT '#3B82F6',
      created_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS study_guide_cache (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id     INTEGER NOT NULL,
      assignment_id INTEGER NOT NULL,
      content       TEXT NOT NULL,
      generated_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(course_id, assignment_id)
    );
    CREATE TABLE IF NOT EXISTS assignment_notes (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id     INTEGER NOT NULL,
      assignment_id INTEGER NOT NULL,
      notes         TEXT,
      quizlet_url   TEXT,
      updated_at    TEXT DEFAULT (datetime('now')),
      UNIQUE(course_id, assignment_id)
    );
    CREATE TABLE IF NOT EXISTS schedule_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL,
      date       TEXT NOT NULL,  -- YYYY-MM-DD
      start_time TEXT,           -- HH:MM 24h, optional
      end_time   TEXT,
      notes      TEXT,
      color      TEXT DEFAULT '#3B82F6',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS important_assignments_cache (
      course_id     INTEGER PRIMARY KEY,
      input_hash    TEXT NOT NULL,  -- hash of syllabus + assignment list; cache is stale once this changes
      important_ids TEXT NOT NULL,  -- JSON array of assignment ids
      generated_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS checklist_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      text         TEXT NOT NULL,
      repeats      INTEGER NOT NULL DEFAULT 0,  -- legacy: 1 = every night (rows from before day-picking existed)
      date         TEXT,                        -- YYYY-MM-DD, set for one-day-only items
      days_of_week TEXT,                         -- JSON array of 0-6 (Sun-Sat), set for items that repeat on specific days
      created_at   TEXT DEFAULT (datetime('now'))
    );
  `)
  // Column added after the table first shipped — ALTER fails harmlessly if it's already there.
  try {
    await db.execute('ALTER TABLE checklist_items ADD COLUMN days_of_week TEXT')
  } catch {
    // Column already exists.
  }
})()

async function ensureReady() { await ready }

// ---------------------------------------------------------------------------

export interface Extracurricular {
  id: number
  name: string
  day_of_week: number | null
  start_time: string | null
  end_time: string | null
  location: string | null
  notes: string | null
  color: string
  created_at: string
}

export async function getAllExtracurriculars(): Promise<Extracurricular[]> {
  await ensureReady()
  const { rows } = await db.execute('SELECT * FROM extracurriculars ORDER BY day_of_week, start_time')
  return rows as unknown as Extracurricular[]
}

export async function createExtracurricular(
  data: Omit<Extracurricular, 'id' | 'created_at'>
): Promise<void> {
  await ensureReady()
  await db.execute({
    sql: `INSERT INTO extracurriculars (name, day_of_week, start_time, end_time, location, notes, color)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [data.name, data.day_of_week ?? null, data.start_time ?? null, data.end_time ?? null,
           data.location ?? null, data.notes ?? null, data.color],
  })
}

export async function deleteExtracurricular(id: number): Promise<void> {
  await ensureReady()
  await db.execute({ sql: 'DELETE FROM extracurriculars WHERE id = ?', args: [id] })
}

export async function updateExtracurricular(
  id: number,
  data: Partial<Omit<Extracurricular, 'id' | 'created_at'>>
): Promise<void> {
  await ensureReady()
  const keys = Object.keys(data)
  if (!keys.length) return
  const sets = keys.map(k => `${k} = ?`).join(', ')
  await db.execute({ sql: `UPDATE extracurriculars SET ${sets} WHERE id = ?`, args: [...Object.values(data), id] })
}

// ---------------------------------------------------------------------------

export async function getStudyGuide(courseId: number, assignmentId: number): Promise<string | null> {
  await ensureReady()
  const { rows } = await db.execute({
    sql: 'SELECT content FROM study_guide_cache WHERE course_id = ? AND assignment_id = ?',
    args: [courseId, assignmentId],
  })
  return (rows[0] as unknown as { content: string } | undefined)?.content ?? null
}

export async function saveStudyGuide(courseId: number, assignmentId: number, content: string): Promise<void> {
  await ensureReady()
  await db.execute({
    sql: `INSERT INTO study_guide_cache (course_id, assignment_id, content)
          VALUES (?, ?, ?)
          ON CONFLICT(course_id, assignment_id)
          DO UPDATE SET content = excluded.content, generated_at = datetime('now')`,
    args: [courseId, assignmentId, content],
  })
}

export async function getAssignmentNotes(
  courseId: number, assignmentId: number
): Promise<{ notes: string | null; quizlet_url: string | null }> {
  await ensureReady()
  const { rows } = await db.execute({
    sql: 'SELECT notes, quizlet_url FROM assignment_notes WHERE course_id = ? AND assignment_id = ?',
    args: [courseId, assignmentId],
  })
  return (rows[0] as unknown as { notes: string | null; quizlet_url: string | null } | undefined)
    ?? { notes: null, quizlet_url: null }
}

export async function saveAssignmentNotes(
  courseId: number, assignmentId: number, notes: string | null, quizletUrl: string | null
): Promise<void> {
  await ensureReady()
  await db.execute({
    sql: `INSERT INTO assignment_notes (course_id, assignment_id, notes, quizlet_url)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(course_id, assignment_id)
          DO UPDATE SET notes = excluded.notes, quizlet_url = excluded.quizlet_url, updated_at = datetime('now')`,
    args: [courseId, assignmentId, notes, quizletUrl],
  })
}

// ---------------------------------------------------------------------------

export interface ScheduleEvent {
  id: number
  title: string
  date: string        // YYYY-MM-DD
  start_time: string | null
  end_time: string | null
  notes: string | null
  color: string
  created_at: string
}

export async function getScheduleEvents(from?: string, to?: string): Promise<ScheduleEvent[]> {
  await ensureReady()
  let sql = 'SELECT * FROM schedule_events'
  const args: string[] = []
  if (from && to) {
    sql += ' WHERE date >= ? AND date <= ?'
    args.push(from, to)
  } else if (from) {
    sql += ' WHERE date >= ?'
    args.push(from)
  }
  sql += ' ORDER BY date, start_time'
  const { rows } = await db.execute({ sql, args })
  return rows as unknown as ScheduleEvent[]
}

export async function createScheduleEvent(
  data: Omit<ScheduleEvent, 'id' | 'created_at'>
): Promise<void> {
  await ensureReady()
  await db.execute({
    sql: `INSERT INTO schedule_events (title, date, start_time, end_time, notes, color)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [data.title, data.date, data.start_time ?? null, data.end_time ?? null, data.notes ?? null, data.color],
  })
}

export async function updateScheduleEvent(
  id: number, data: Partial<Omit<ScheduleEvent, 'id' | 'created_at'>>
): Promise<void> {
  await ensureReady()
  const keys = Object.keys(data)
  if (!keys.length) return
  const sets = keys.map(k => `${k} = ?`).join(', ')
  await db.execute({ sql: `UPDATE schedule_events SET ${sets} WHERE id = ?`, args: [...Object.values(data), id] })
}

export async function deleteScheduleEvent(id: number): Promise<void> {
  await ensureReady()
  await db.execute({ sql: 'DELETE FROM schedule_events WHERE id = ?', args: [id] })
}

// ---------------------------------------------------------------------------

export interface ChecklistItem {
  id: number
  text: string
  repeats: boolean
  date: string | null
  daysOfWeek: number[] | null // 0 (Sun) - 6 (Sat)
  created_at: string
}

interface ChecklistItemRow {
  id: number
  text: string
  repeats: number
  date: string | null
  days_of_week: string | null
  created_at: string
}

function weekdayOf(date: string) {
  return new Date(`${date}T00:00:00`).getDay()
}

export async function getChecklistItemsForDate(date: string): Promise<ChecklistItem[]> {
  await ensureReady()
  const { rows } = await db.execute('SELECT * FROM checklist_items ORDER BY created_at')
  const weekday = weekdayOf(date)
  return (rows as unknown as ChecklistItemRow[])
    .map(r => ({
      id: r.id,
      text: r.text,
      repeats: !!r.repeats,
      date: r.date,
      daysOfWeek: r.days_of_week ? JSON.parse(r.days_of_week) : null,
      created_at: r.created_at,
    }))
    .filter(item => {
      if (item.date === date) return true
      if (item.daysOfWeek && item.daysOfWeek.length) return item.daysOfWeek.includes(weekday)
      return item.repeats && !item.daysOfWeek // legacy "every day" rows predating day-picking
    })
}

export async function createChecklistItem(
  data: { text: string; date: string | null; daysOfWeek: number[] | null }
): Promise<ChecklistItem> {
  await ensureReady()
  const { rows } = await db.execute({
    sql: `INSERT INTO checklist_items (text, repeats, date, days_of_week) VALUES (?, ?, ?, ?)
          RETURNING id, text, repeats, date, days_of_week, created_at`,
    args: [
      data.text,
      data.daysOfWeek ? 1 : 0,
      data.daysOfWeek ? null : data.date,
      data.daysOfWeek ? JSON.stringify(data.daysOfWeek) : null,
    ],
  })
  const r = rows[0] as unknown as ChecklistItemRow
  return {
    id: r.id,
    text: r.text,
    repeats: !!r.repeats,
    date: r.date,
    daysOfWeek: r.days_of_week ? JSON.parse(r.days_of_week) : null,
    created_at: r.created_at,
  }
}

export async function deleteChecklistItem(id: number): Promise<void> {
  await ensureReady()
  await db.execute({ sql: 'DELETE FROM checklist_items WHERE id = ?', args: [id] })
}

// ---------------------------------------------------------------------------

export async function getImportantAssignmentsCache(
  courseId: number
): Promise<{ inputHash: string; importantIds: number[] } | null> {
  await ensureReady()
  const { rows } = await db.execute({
    sql: 'SELECT input_hash, important_ids FROM important_assignments_cache WHERE course_id = ?',
    args: [courseId],
  })
  const r = rows[0] as unknown as { input_hash: string; important_ids: string } | undefined
  if (!r) return null
  return { inputHash: r.input_hash, importantIds: JSON.parse(r.important_ids) }
}

export async function saveImportantAssignmentsCache(
  courseId: number, inputHash: string, importantIds: number[]
): Promise<void> {
  await ensureReady()
  await db.execute({
    sql: `INSERT INTO important_assignments_cache (course_id, input_hash, important_ids)
          VALUES (?, ?, ?)
          ON CONFLICT(course_id) DO UPDATE SET
            input_hash = excluded.input_hash, important_ids = excluded.important_ids, generated_at = datetime('now')`,
    args: [courseId, inputHash, JSON.stringify(importantIds)],
  })
}
