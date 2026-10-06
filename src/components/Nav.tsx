'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, BarChart2, Calendar, Star } from 'lucide-react'

const links = [
  { href: '/',                label: 'Home',         Icon: Home        },
  { href: '/assignments',     label: 'Work',         Icon: BookOpen    },
  { href: '/grades',          label: 'Grades',       Icon: BarChart2   },
  { href: '/schedule',        label: 'Schedule',     Icon: Calendar    },
  { href: '/extracurriculars',label: 'Activities',   Icon: Star        },
]

export default function Nav() {
  const path = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex justify-around items-center h-16 shadow-lg md:static md:border-t-0 md:border-b md:shadow-none md:h-14 md:px-4">
      {links.map(({ href, label, Icon }) => {
        const active = href === '/' ? path === '/' : path.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
              active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
            <span className="text-[10px] font-semibold">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
