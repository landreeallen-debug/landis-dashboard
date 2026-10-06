'use client'
import { useRouter, useSearchParams } from 'next/navigation'

const MODES = [
  { value: 'important', label: 'All Assignments' },
  { value: 'week', label: 'Due This Week' },
]

export default function ModeSelect({ mode }: { mode: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(value: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (value === 'important') next.delete('mode')
    else next.set('mode', value)
    router.push(`/assignments${next.toString() ? `?${next.toString()}` : ''}`)
  }

  return (
    <select
      value={mode}
      onChange={e => handleChange(e.target.value)}
      aria-label="Assignments view"
      className="bg-transparent text-white font-bold text-2xl border-none focus:outline-none cursor-pointer -ml-1"
    >
      {MODES.map(m => (
        <option key={m.value} value={m.value} className="text-gray-900">
          {m.label}
        </option>
      ))}
    </select>
  )
}
