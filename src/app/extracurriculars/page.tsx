'use client'
import { useState, useEffect, useRef } from 'react'
import type { Extracurricular } from '@/lib/db'
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6']

const blank = (): Omit<Extracurricular, 'id' | 'created_at'> => ({
  name: '', day_of_week: null, start_time: null, end_time: null,
  location: null, notes: null, color: '#3B82F6',
})

export default function ExtracurricularsPage() {
  const [items, setItems] = useState<Extracurricular[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState(blank())
  const [editing, setEditing] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<Extracurricular>>({})
  const [addingPending, setAddingPending] = useState(false)
  const [savingEdit, setSavingEdit] = useState<number | null>(null)
  const addingRef = useRef(false)
  const savingEditIds = useRef<Set<number>>(new Set())
  const deletingIds = useRef<Set<number>>(new Set())

  async function load() {
    try {
      const data = await fetch('/api/extracurriculars').then(r => r.json())
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    }
  }

  useEffect(() => { load() }, [])

  async function handleAdd() {
    if (!form.name.trim()) return
    if (addingRef.current) return
    addingRef.current = true
    setAddingPending(true)
    try {
      const res = await fetch('/api/extracurriculars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Save failed')
      setForm(blank())
      setAdding(false)
      await load()
    } catch {
      // Keep the form open so the child can try again.
    } finally {
      addingRef.current = false
      setAddingPending(false)
    }
  }

  async function handleDelete(id: number) {
    if (deletingIds.current.has(id)) return
    deletingIds.current.add(id)
    try {
      await fetch('/api/extracurriculars', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await load()
    } catch {
      // The next reload will restore the item if deletion failed.
    } finally {
      deletingIds.current.delete(id)
    }
  }

  async function handleSaveEdit(id: number) {
    if (typeof editForm.name === 'string' && !editForm.name.trim()) return
    if (savingEditIds.current.has(id)) return
    savingEditIds.current.add(id)
    setSavingEdit(id)
    try {
      const res = await fetch('/api/extracurriculars', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editForm }),
      })
      if (!res.ok) throw new Error('Save failed')
      setEditing(null)
      await load()
    } catch {
      // Keep the edit form open so the child can try again.
    } finally {
      savingEditIds.current.delete(id)
      setSavingEdit(null)
    }
  }

  const byDay = DAYS.map((day, dow) => ({
    dow, day,
    items: items.filter(i => i.day_of_week === dow),
  })).filter(g => g.items.length > 0 || g.dow === new Date().getDay())

  const noDay = items.filter(i => i.day_of_week === null)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-bold text-2xl">Activities</h1>
        <button type="button" onClick={() => setAdding(true)} className="btn-primary">
          <Plus size={16} /> Add activity
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="card mb-5 space-y-3">
          <h2 className="font-bold">New Activity</h2>
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Activity name *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
              value={form.day_of_week ?? ''}
              onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value === '' ? null : Number(e.target.value) }))}
            >
              <option value="">Any day</option>
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <input
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
              placeholder="Location"
              value={form.location ?? ''}
              onChange={e => setForm(f => ({ ...f, location: e.target.value || null }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="time" className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
              value={form.start_time ?? ''}
              onChange={e => setForm(f => ({ ...f, start_time: e.target.value || null }))} />
            <input type="time" className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
              value={form.end_time ?? ''}
              onChange={e => setForm(f => ({ ...f, end_time: e.target.value || null }))} />
          </div>
          <textarea
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none"
            placeholder="Notes (optional)"
            rows={2}
            value={form.notes ?? ''}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
          />
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Color</p>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                  aria-label={`Use color ${c}`}
                  className={`w-7 h-7 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} disabled={!form.name.trim() || addingPending} className="btn-primary disabled:opacity-40">
              {addingPending ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setForm(blank()) }} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {items.length === 0 && !adding && (
        <div className="card text-center py-10 text-gray-400">
          <p className="font-semibold">No activities yet</p>
          <p className="text-sm mt-1">Tap "Add activity" to get started</p>
        </div>
      )}

      {/* By day */}
      {byDay.map(({ dow, day, items: dayItems }) => dayItems.length > 0 && (
        <section key={dow} className="mb-5">
          <h2 className="font-bold text-gray-600 text-sm uppercase tracking-wide mb-2">{day}</h2>
          <div className="space-y-2">
            {dayItems.map(item => (
              <ActivityCard key={item.id} item={item}
                editing={editing === item.id} editForm={editForm}
                onEdit={() => { setEditing(item.id); setEditForm(item) }}
                onSave={() => handleSaveEdit(item.id)}
                onCancel={() => setEditing(null)}
                onDelete={() => handleDelete(item.id)}
                onChange={setEditForm}
                saving={savingEdit === item.id}
              />
            ))}
          </div>
        </section>
      ))}

      {noDay.length > 0 && (
        <section className="mb-5">
          <h2 className="font-bold text-gray-600 text-sm uppercase tracking-wide mb-2">General</h2>
          <div className="space-y-2">
            {noDay.map(item => (
              <ActivityCard key={item.id} item={item}
                editing={editing === item.id} editForm={editForm}
                onEdit={() => { setEditing(item.id); setEditForm(item) }}
                onSave={() => handleSaveEdit(item.id)}
                onCancel={() => setEditing(null)}
                onDelete={() => handleDelete(item.id)}
                onChange={setEditForm}
                saving={savingEdit === item.id}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function ActivityCard({ item, editing, editForm, onEdit, onSave, onCancel, onDelete, onChange, saving }: {
  item: Extracurricular
  editing: boolean
  editForm: Partial<Extracurricular>
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
  onChange: (f: Partial<Extracurricular>) => void
  saving: boolean
}) {
  if (editing) {
    return (
      <div className="card space-y-2 p-3">
        <input className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-sm"
          value={editForm.name ?? ''} onChange={e => onChange({ ...editForm, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <input type="time" className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm"
            value={editForm.start_time ?? ''} onChange={e => onChange({ ...editForm, start_time: e.target.value || null })} />
          <input className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm" placeholder="Location"
            value={editForm.location ?? ''} onChange={e => onChange({ ...editForm, location: e.target.value || null })} />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onSave} disabled={!String(editForm.name ?? '').trim() || saving} className="btn-primary text-xs py-1.5 px-3 disabled:opacity-40">
            <Check size={13} /> {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={onCancel} className="btn-ghost text-xs py-1.5 px-3"><X size={13} /> Cancel</button>
        </div>
      </div>
    )
  }
  return (
    <div className="card flex items-center gap-3 p-3" style={{ borderLeft: `4px solid ${item.color}` }}>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{item.name}</p>
        {(item.start_time || item.location) && (
          <p className="text-xs text-gray-400">
            {item.start_time}{item.end_time ? `–${item.end_time}` : ''}
            {item.location ? ` · ${item.location}` : ''}
          </p>
        )}
        {item.notes && <p className="text-xs text-gray-500 mt-0.5">{item.notes}</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        <button type="button" onClick={onEdit} aria-label={`Edit ${item.name}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Edit2 size={14} /></button>
        <button type="button" onClick={onDelete} aria-label={`Delete ${item.name}`} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
      </div>
    </div>
  )
}
