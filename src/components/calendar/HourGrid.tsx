'use client'
import { format, isToday } from 'date-fns'
import type { ScheduleEvent } from '@/lib/db'

export interface GridItem {
  id: string
  date: string // yyyy-MM-dd
  title: string
  startMinutes: number | null // null = no time set, shown in the "any time" row
  endMinutes: number | null
  color: string
  raw?: ScheduleEvent // present only for editable (custom) events
}

interface Props {
  days: Date[]
  items: GridItem[]
  selectedKey?: string
  onSlot: (dateKey: string, hour: number) => void
  onItem: (item: GridItem) => void
  onSelectDay?: (d: Date) => void
  hourHeight?: number
  startHour?: number
  endHour?: number
}

function dateKey(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

function minutesToLabel(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return format(d, 'h a')
}

// days=[one] -> day view; days=[several] -> week view, matching LifeHub's calendar structure.
export default function HourGrid({
  days, items, selectedKey, onSlot, onItem, onSelectDay,
  hourHeight = 52, startHour = 6, endHour = 22,
}: Props) {
  const multi = days.length > 1
  const hours: number[] = []
  for (let h = startHour; h < endHour; h++) hours.push(h)
  const minM = startHour * 60
  const maxM = endHour * 60
  const totalH = (endHour - startHour) * hourHeight

  const anytime = items.filter(i => i.startMinutes === null)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {multi && (
        <div className="flex border-b border-gray-200">
          <div className="w-12 shrink-0" />
          {days.map(d => {
            const key = dateKey(d)
            const active = key === selectedKey
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDay?.(d)}
                className={`flex-1 border-l border-gray-100 py-2 text-center transition-colors ${active ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <div className="text-[10px] uppercase text-gray-400">{format(d, 'EEE')}</div>
                <div className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${
                  isToday(d) ? 'bg-blue-500 text-white' : active ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
                }`}>
                  {format(d, 'd')}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {anytime.length > 0 && (
        <div className="flex border-b border-gray-200 bg-gray-50">
          <div className="w-12 shrink-0 flex items-center justify-end pr-1 text-[9px] uppercase text-gray-400">any time</div>
          {days.map(d => {
            const key = dateKey(d)
            const dayItems = anytime.filter(i => i.date === key)
            return (
              <div key={key} className="flex-1 border-l border-gray-100 p-1 space-y-0.5">
                {dayItems.map(i => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => onItem(i)}
                    className="block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-semibold text-white"
                    style={{ backgroundColor: i.color }}
                  >
                    {i.title}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}

      <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
        <div className="flex" style={{ height: totalH }}>
          {/* Time gutter */}
          <div className="w-12 shrink-0">
            {hours.map(h => (
              <div key={h} className="relative" style={{ height: hourHeight }}>
                <span className="absolute right-1.5 -top-1.5 text-[10px] text-gray-400">
                  {h === startHour ? '' : minutesToLabel(h * 60)}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map(d => {
            const key = dateKey(d)
            const timed = items
              .filter(i => i.date === key && i.startMinutes !== null && i.endMinutes! > minM && i.startMinutes! < maxM)
              .sort((a, b) => a.startMinutes! - b.startMinutes!)
            return (
              <div key={key} className="relative flex-1 border-l border-gray-100">
                {hours.map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => onSlot(key, h)}
                    className="block w-full border-t border-gray-100 transition-colors hover:bg-blue-50"
                    style={{ height: hourHeight }}
                    aria-label={`Add event at ${minutesToLabel(h * 60)} on ${format(d, 'MMMM d')}`}
                  />
                ))}
                {timed.map(i => {
                  const top = ((Math.max(i.startMinutes!, minM) - minM) / 60) * hourHeight
                  const bottom = ((Math.min(i.endMinutes!, maxM) - minM) / 60) * hourHeight
                  const height = Math.max(bottom - top, 16)
                  return (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => onItem(i)}
                      className="absolute left-1 right-1 overflow-hidden rounded-lg px-1.5 py-0.5 text-left text-white shadow-sm"
                      style={{ backgroundColor: i.color, top: top + 1, height: height - 2 }}
                    >
                      <div className="truncate text-[11px] font-semibold leading-tight">{i.title}</div>
                      {!multi && height > 30 && (
                        <div className="text-[10px] opacity-80">
                          {minutesToLabel(i.startMinutes!)} – {minutesToLabel(i.endMinutes!)}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
