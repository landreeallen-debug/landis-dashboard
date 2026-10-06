'use client'
import { useState, useEffect, useRef } from 'react'
import type { Assignment } from '@/lib/canvas'
import { format, parseISO } from 'date-fns'
import { ExternalLink, Sparkles, RefreshCw, Save, BookOpen } from 'lucide-react'
import Link from 'next/link'

// Very simple Markdown → HTML: bold, italic, headers, bullets
function renderMarkdown(md: string) {
  return md
    .split('\n')
    .map(line => {
      if (/^### /.test(line)) return `<h3 class="font-bold text-base mt-4 mb-1 text-gray-800">${line.slice(4)}</h3>`
      if (/^## /.test(line))  return `<h2 class="font-bold text-lg mt-5 mb-2 text-gray-900">${line.slice(3)}</h2>`
      if (/^# /.test(line))   return `<h1 class="font-bold text-xl mt-5 mb-2 text-gray-900">${line.slice(2)}</h1>`
      if (/^\* /.test(line) || /^- /.test(line))
        return `<li class="ml-4 text-sm text-gray-700 mb-0.5 list-disc">${line.slice(2)}</li>`
      if (/^\d+\. /.test(line))
        return `<li class="ml-4 text-sm text-gray-700 mb-0.5 list-decimal">${line.replace(/^\d+\. /, '')}</li>`
      if (line.trim() === '') return '<div class="h-1" />'
      return `<p class="text-sm text-gray-700 mb-1">${line}</p>`
    })
    .join('\n')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
}

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export default function StudyPage({ params }: { params: { courseId: string; assignmentId: string } }) {
  const { courseId, assignmentId } = params
  const cid = Number(courseId)
  const aid = Number(assignmentId)

  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [guide, setGuide]           = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
  const [notes, setNotes]           = useState('')
  const [quizlet, setQuizlet]       = useState('')
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const generatingRef = useRef(false)
  const savingRef = useRef(false)

  useEffect(() => {
    // Load assignment
    fetch(`/api/canvas/assignments`)
      .then(r => r.json())
      .then((all: Assignment[]) => {
        const found = all.find(a => a.id === aid && a.course_id === cid)
        setAssignment(found ?? null)
      })
      .catch(() => setAssignment(null))

    // Load cached guide + notes
    fetch(`/api/study-guide?courseId=${cid}&assignmentId=${aid}`)
      .then(r => r.json())
      .then(data => { if (data.content) setGuide(data.content) })
      .catch(() => {})

    fetch(`/api/assignment-notes?courseId=${cid}&assignmentId=${aid}`)
      .then(r => r.json())
      .then(data => {
        if (data.notes)    setNotes(data.notes)
        if (data.quizlet_url) setQuizlet(data.quizlet_url)
      })
      .catch(() => {})
  }, [cid, aid])

  async function generateGuide(force = false) {
    if (generatingRef.current) return
    generatingRef.current = true
    setLoading(true)
    try {
      const res  = await fetch('/api/study-guide', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ courseId: cid, assignmentId: aid, force }),
      })
      const data = res.ok ? await res.json() : { error: 'Could not generate the study guide right now.' }
      if (data.content) setGuide(data.content)
      else if (data.error) alert(data.error)
    } catch {
      alert('Could not generate the study guide right now.')
    } finally {
      generatingRef.current = false
      setLoading(false)
    }
  }

  async function saveNotes() {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/assignment-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: cid, assignmentId: aid, notes, quizletUrl: quizlet }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      alert('Could not save notes right now.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const courseColor = assignment?.courseColor ?? '#3B82F6'
  const isTest      = assignment?.isTest ?? false
  const quizletHref = quizlet ? safeExternalUrl(quizlet) : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card" style={{ borderTop: `4px solid ${courseColor}` }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: courseColor }}>
              {assignment?.courseShort ?? '…'}
              {isTest && <span className="ml-2 badge bg-red-100 text-red-700">Test/Quiz</span>}
            </p>
            <h1 className="font-bold text-lg leading-snug">{assignment?.name ?? 'Loading…'}</h1>
            {assignment?.due_at && (
              <p className="text-sm text-gray-500 mt-1">
                Due {format(parseISO(assignment.due_at), "EEEE, MMMM d 'at' h:mm a")}
              </p>
            )}
          </div>
          {assignment?.html_url && (
            <Link href={assignment.html_url} target="_blank" className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 shrink-0" aria-label="Open assignment in Canvas">
              <ExternalLink size={18} />
            </Link>
          )}
        </div>

        {assignment?.description && (
          <div
            className="mt-3 text-sm text-gray-700 leading-relaxed border-t border-gray-100 pt-3 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: assignment.description }}
          />
        )}
      </div>

      {/* Quizlet link */}
      <div className="card space-y-3">
        <h2 className="font-bold text-base flex items-center gap-2">
          <BookOpen size={18} className="text-blue-500" /> Study Resources
        </h2>
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Quizlet URL (if you have one)</label>
          <input
            type="url"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="https://quizlet.com/…"
            value={quizlet}
            onChange={e => setQuizlet(e.target.value)}
          />
          {quizletHref && (
            <Link href={quizletHref} target="_blank" className="inline-flex items-center gap-1 mt-1.5 text-blue-500 text-xs font-semibold hover:underline">
              Open Quizlet <ExternalLink size={11} />
            </Link>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">My notes</label>
          <textarea
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            rows={4}
            placeholder="Write your own notes here…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <button
          type="button"
          onClick={saveNotes}
          disabled={saving}
          className="btn-primary text-sm py-2"
        >
          <Save size={14} />
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save notes'}
        </button>
      </div>

      {/* Study guide */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-base flex items-center gap-2">
            <Sparkles size={18} className="text-purple-500" />
            {isTest ? 'Test Prep Guide' : 'Study Guide'}
          </h2>
          <div className="flex gap-2">
            {guide && (
              <button type="button" onClick={() => generateGuide(true)} disabled={loading} className="btn-ghost text-xs py-1.5 px-3">
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                Regenerate
              </button>
            )}
            {!guide && (
              <button type="button" onClick={() => generateGuide(false)} disabled={loading} className="btn-primary text-sm py-2">
                <Sparkles size={14} />
                {loading ? 'Generating…' : 'Generate study guide'}
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="text-center py-8 text-gray-400">
            <div className="inline-block w-6 h-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin mb-2" />
            <p className="text-sm">Claude is making your study guide…</p>
          </div>
        )}

        {!loading && !guide && (
          <div className="text-center py-8 text-gray-400">
            <Sparkles size={32} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm">
              Click "Generate study guide" to have Claude build a{' '}
              {isTest ? 'test prep guide' : 'homework help guide'} based on your Canvas assignment and class materials.
            </p>
          </div>
        )}

        {guide && !loading && (
          <div
            className="leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(guide) }}
          />
        )}
      </div>
    </div>
  )
}
