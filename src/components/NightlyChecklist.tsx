'use client'
import { useState, useEffect, useRef } from 'react'
import { CheckSquare, Square, Plus, X } from 'lucide-react'
import type { ChecklistItem } from '@/lib/db'

// Fixed items every night, always shown last regardless of what's happening in Canvas.
const TRAILING_ITEMS = [
  'Check your school email',
  'Unpack your backpack',
  'Finish homework',
]

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function daysLabel(days: number[]) {
  if (days.length === 7) return 'Every day'
  return days.slice().sort().map(d => DAY_LABELS[d]).join(', ')
}

interface CourseInfo {
  id: number
  short: string
}

interface Entry {
  key: string
  label: string
  custom?: ChecklistItem
}

interface Props {
  courses: CourseInfo[]
}

function todayKey() {
  return `checklist-${new Date().toISOString().slice(0, 10)}`
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

export default function NightlyChecklist({ courses }: Props) {
  const [customItems, setCustomItems] = useState<ChecklistItem[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [mode, setMode] = useState<'today' | 'repeat'>('today')
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set())
  const [savingAdd, setSavingAdd] = useState(false)
  const addingRef = useRef(false)
  const deletingIds = useRef<Set<number>>(new Set())

  async function loadCustomItems() {
    try {
      const data = await fetch(`/api/checklist-items?date=${todayDate()}`).then(r => r.json())
      setCustomItems(Array.isArray(data) ? data : [])
    } catch {
      setCustomItems([])
    }
  }

  useEffect(() => { loadCustomItems() }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(todayKey())
      if (!saved) return
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) setChecked(new Set(parsed.filter(i => typeof i === 'string')))
      else localStorage.removeItem(todayKey())
    } catch {
      localStorage.removeItem(todayKey())
    }
  }, [])

  const allItems: Entry[] = [
    ...courses.map(c => ({ key: `subject-${c.id}`, label: `Check if you brought home any work for ${c.short}` })),
    ...customItems.map(item => ({ key: `custom-${item.id}`, label: item.text, custom: item })),
    ...TRAILING_ITEMS.map(label => ({ key: `trailing-${label}`, label })),
  ]

  function toggle(key: string) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      try {
        localStorage.setItem(todayKey(), JSON.stringify(Array.from(next)))
      } catch {
        // The checklist still works for this session if browser storage is unavailable.
      }
      return next
    })
  }

  function toggleDay(day: number) {
    setSelectedDays(prev => {
      const next = new Set(prev)
      next.has(day) ? next.delete(day) : next.add(day)
      return next
    })
  }

  const canAdd = newText.trim() && (mode === 'today' || selectedDays.size > 0)

  async function handleAdd() {
    if (!canAdd) return
    if (addingRef.current) return
    addingRef.current = true
    setSavingAdd(true)
    try {
      const res = await fetch('/api/checklist-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newText.trim(),
          date: mode === 'today' ? todayDate() : null,
          daysOfWeek: mode === 'repeat' ? Array.from(selectedDays) : null,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setNewText('')
      setMode('today')
      setSelectedDays(new Set())
      setAdding(false)
      await loadCustomItems()
    } catch {
      // Keep the form open so Landis can try again.
    } finally {
      addingRef.current = false
      setSavingAdd(false)
    }
  }

  async function handleDelete(id: number) {
    if (deletingIds.current.has(id)) return
    deletingIds.current.add(id)
    try {
      await fetch('/api/checklist-items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await loadCustomItems()
    } catch {
      // The next reload restores the item if deletion failed.
    } finally {
      deletingIds.current.delete(id)
    }
  }

  const done = allItems.filter(i => checked.has(i.key)).length
  const pct = allItems.length ? Math.round((done / allItems.length) * 100) : 0

  return (
    <div className="card relative z-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-lg">Tonight's Checklist</h2>
        <span className="text-sm text-gray-500 font-medium">{done}/{allItems.length}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="space-y-2">
        {allItems.map(item => {
          const isDone = checked.has(item.key)
          return (
            <li key={item.key} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => toggle(item.key)}
                aria-pressed={isDone}
                aria-label={`${isDone ? 'Mark not done' : 'Mark done'}: ${item.label}`}
                className={`flex-1 min-h-11 flex items-center gap-3 text-left text-sm p-2 rounded-xl transition-colors ${
                  isDone ? 'opacity-50' : 'hover:bg-gray-50'
                }`}
              >
                {isDone
                  ? <CheckSquare size={18} className="text-green-500 shrink-0" />
                  : <Square size={18} className="text-gray-300 shrink-0" />
                }
                <span className={isDone ? 'line-through text-gray-400' : 'text-gray-700'}>
                  {item.label}
                </span>
                {item.custom?.daysOfWeek && (
                  <span className="text-[10px] text-gray-400 shrink-0">{daysLabel(item.custom.daysOfWeek)}</span>
                )}
              </button>
              {item.custom && (
                <button
                  type="button"
                  onClick={() => handleDelete(item.custom!.id)}
                  aria-label={`Delete ${item.label}`}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 shrink-0"
                >
                  <X size={14} />
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {adding ? (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="What do you need to do?"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            autoFocus
          />
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="checklist-mode" checked={mode === 'today'} onChange={() => setMode('today')} />
              Just today
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="checklist-mode" checked={mode === 'repeat'} onChange={() => setMode('repeat')} />
              Repeat
            </label>
          </div>
          {mode === 'repeat' && (
            <div className="flex gap-1.5 flex-wrap">
              {DAY_LABELS.map((label, day) => {
                const selected = selectedDays.has(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    aria-pressed={selected}
                    className={`w-9 h-9 rounded-full text-xs font-semibold transition-colors ${
                      selected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {label[0]}
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} disabled={!canAdd || savingAdd} className="btn-primary disabled:opacity-40">
              {savingAdd ? 'Saving...' : 'Add'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setNewText(''); setMode('today'); setSelectedDays(new Set()) }} className="btn-ghost">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm text-blue-500 font-semibold py-2 rounded-xl hover:bg-blue-50"
        >
          <Plus size={15} /> Add your own
        </button>
      )}

      {pct === 100 && (
        <p className="mt-3 text-center text-green-600 font-bold text-sm">
          All done for tonight!
        </p>
      )}
    </div>
  )
}
