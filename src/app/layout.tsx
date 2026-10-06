import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import { DISPLAY_NAME } from '@/lib/mode'

export const metadata: Metadata = {
  title: `${DISPLAY_NAME}'s School Dashboard`,
  description: `Grades, assignments, and schedule for ${DISPLAY_NAME}`,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="max-w-5xl mx-auto px-4 py-6 pb-20">{children}</main>
      </body>
    </html>
  )
}
