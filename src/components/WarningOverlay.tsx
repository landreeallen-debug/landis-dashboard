'use client'
import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, ExternalLink, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { bigAssignmentTypeLabel } from '@/lib/assignments'

// Normalised shape — works for Canvas assignments AND custom schedule events
export interface WarningItem {
  id: string           // 'canvas-123' or 'event-456' — globally unique
  title: string
  dueAt: string | null // ISO datetime or null
  courseLabel: string  // e.g. 'Math' or 'My schedule'
  color: string
  canvasUrl: string | null   // null for custom events
  studyLink: string | null   // null for custom events
}

function ackKey(id: string) { return `warn-ack-${id}` }

function dueTimeLabel(dueAt: string | null) {
  if (!dueAt) return ''
  const parsed = parseISO(dueAt)
  if (Number.isNaN(parsed.getTime())) return ''
  return ` · ${format(parsed, 'h:mm a')}`
}

export default function WarningOverlay({ items, displayName = 'Landis' }: { items: WarningItem[]; displayName?: string }) {
  const [acked,    setAcked]   = useState<Set<string>>(new Set())
  const [shaking,  setShaking] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = new Set<string>()
    for (const item of items) {
      try {
        if (localStorage.getItem(ackKey(item.id))) stored.add(item.id)
      } catch {
        break
      }
    }
    setAcked(stored)
    setHydrated(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hydrated) return
    const unacked = items.filter(i => !acked.has(i.id))
    if (unacked.length > 0) {
      setShaking(true)
      const t = setTimeout(() => setShaking(false), 600)
      return () => clearTimeout(t)
    }
  }, [hydrated]) // eslint-disable-line react-hooks/exhaustive-deps

  function acknowledgeMany(ids: string[]) {
    const stamp = new Date().toISOString()
    for (const id of ids) {
      try {
        localStorage.setItem(ackKey(id), stamp)
      } catch {
        // Keep the overlay usable even if storage is blocked or full.
      }
    }
    setAcked(prev => new Set([...Array.from(prev), ...ids]))
  }

  function acknowledge(id: string) {
    acknowledgeMany([id])
  }

  if (!hydrated) return null

  const unacked   = items.filter(i => !acked.has(i.id))
  const ackedItems = items.filter(i =>  acked.has(i.id))

  return (
    <>
      {/* ── FULL-SCREEN FLASH ─────────────────────────────────────────────── */}
      {unacked.length > 0 && (
        <div
          className={`fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-y-auto bg-red-600 p-6 animate-warning-flash ${shaking ? 'animate-warning-shake' : ''}`}
          style={{ willChange: 'background-color' }}
        >
          <div className="text-center mb-6">
            <AlertTriangle
              size={80}
              className="mx-auto text-white mb-3"
              style={{ filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.5))' }}
            />
            <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-lg">
              {unacked.length === 1 ? 'BIG DAY TOMORROW!' : `${unacked.length} BIG THINGS TOMORROW!`}
            </h1>
            <p className="text-red-100 text-lg mt-2 font-medium">
              You need to study tonight, {displayName}!
            </p>
          </div>

          <div className="w-full max-w-lg space-y-4">
            {unacked.map(item => (
              <div key={item.id} className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="h-2" style={{ backgroundColor: item.color }} />
                <div className="p-4">
                  <span
                    className="text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: item.color }}
                  >
                    {item.courseLabel} · {bigAssignmentTypeLabel(item.title)}
                  </span>
                  <p className="font-black text-gray-900 text-lg mt-2 leading-tight">{item.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Due tomorrow{dueTimeLabel(item.dueAt)}
                  </p>

                  <button
                    type="button"
                    onClick={() => acknowledge(item.id)}
                    aria-label={`I will study tonight for ${item.title}`}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 hover:bg-green-600 active:scale-95 text-white font-black text-base transition-all shadow-lg shadow-green-200"
                  >
                    <CheckCircle size={20} />
                    I will study tonight!
                  </button>

                  <div className="flex gap-2 mt-2">
                    {item.studyLink && (
                      <Link
                        href={item.studyLink}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-purple-50 text-purple-700 font-semibold text-sm hover:bg-purple-100 transition-colors"
                      >
                        <Sparkles size={14} /> Study guide
                      </Link>
                    )}
                    {item.canvasUrl && (
                      <Link
                        href={item.canvasUrl}
                        target="_blank"
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gray-50 text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors"
                      >
                        <ExternalLink size={14} /> Canvas
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {unacked.length > 1 && (
            <button
              type="button"
              onClick={() => acknowledgeMany(unacked.map(i => i.id))}
              className="mt-6 px-6 py-3 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-sm transition-colors border border-white/30"
            >
              I will study all of these →
            </button>
          )}
        </div>
      )}

      {/* ── CORNER BADGES ─────────────────────────────────────────────────── */}
      {ackedItems.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 hidden flex-col gap-2 items-end sm:flex">
          {ackedItems.map(item => {
            const inner = (
              <div className="px-3 py-2 bg-white">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-red-500 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wide text-red-600">Tomorrow!</span>
                </div>
                <p className="text-xs font-bold text-gray-800 mt-0.5 leading-tight truncate">{item.title}</p>
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: item.color }}>
                  {item.courseLabel} · {bigAssignmentTypeLabel(item.title)}
                </p>
              </div>
            )
            return (
              <div
                key={item.id}
                className="animate-corner-pulse rounded-xl shadow-lg overflow-hidden max-w-[200px]"
                style={{ border: `2px solid ${item.color}` }}
              >
                {item.studyLink
                  ? <Link href={item.studyLink}>{inner}</Link>
                  : inner
                }
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
