'use client'
import { useRef, useState } from 'react'
import { AlertTriangle, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import type { Assignment } from '@/lib/canvas'
import Link from 'next/link'

interface Props {
  tests: Assignment[]
}

export default function TestWarning({ tests }: Props) {
  const [overviews, setOverviews] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState<Record<number, boolean>>({})
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const inFlight = useRef<Set<number>>(new Set())

  if (!tests.length) return null

  async function getOverview(test: Assignment) {
    if (loading[test.id] || inFlight.current.has(test.id)) return
    if (overviews[test.id]) {
      setExpanded(e => ({ ...e, [test.id]: !e[test.id] }))
      return
    }
    inFlight.current.add(test.id)
    setLoading(l => ({ ...l, [test.id]: true }))
    try {
      const res = await fetch(
        `/api/study-guide?courseId=${test.course_id}&assignmentId=${test.id}&type=overview`
      )
      const data = res.ok ? await res.json() : {}
      if (data.overview) {
        setOverviews(o => ({ ...o, [test.id]: data.overview }))
        setExpanded(e => ({ ...e, [test.id]: true }))
      } else {
        setOverviews(o => ({ ...o, [test.id]: 'I could not load that overview. Open the full study guide instead.' }))
        setExpanded(e => ({ ...e, [test.id]: true }))
      }
    } catch {
      setOverviews(o => ({ ...o, [test.id]: 'I could not load that overview. Open the full study guide instead.' }))
      setExpanded(e => ({ ...e, [test.id]: true }))
    } finally {
      inFlight.current.delete(test.id)
      setLoading(l => ({ ...l, [test.id]: false }))
    }
  }

  return (
    <div className="space-y-3">
      {tests.map(test => (
        <div key={test.id} className="rounded-2xl border-2 border-red-400 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={22} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-red-800 text-sm uppercase tracking-wide">
                Test/Quiz Tomorrow!
              </p>
              <p className="font-semibold text-red-900 mt-0.5 truncate">{test.name}</p>
              <p className="text-red-600 text-sm">{test.courseShort}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => getOverview(test)}
                  disabled={loading[test.id]}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  <Sparkles size={14} />
                  {loading[test.id] ? 'Loading…' : 'Quick Overview'}
                  {overviews[test.id] && !loading[test.id] && (
                    expanded[test.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </button>
                <Link
                  href={`/study/${test.course_id}/${test.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-700 text-sm font-semibold hover:bg-red-50 transition-colors"
                >
                  Full Study Guide
                </Link>
              </div>
              {overviews[test.id] && expanded[test.id] && (
                <p className="mt-3 text-sm text-red-900 leading-relaxed bg-white rounded-xl p-3 border border-red-200">
                  {overviews[test.id]}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
