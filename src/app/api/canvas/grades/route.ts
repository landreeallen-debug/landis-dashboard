import { NextResponse } from 'next/server'
import { getGrades } from '@/lib/canvas'

export const dynamic = 'force-dynamic'

export async function GET() {
  const enrollments = await getGrades()
  const grades = enrollments.map(e => ({
    courseId: e.course_id,
    courseName: e.courseName ?? String(e.course_id),
    courseShort: e.courseShort ?? String(e.course_id),
    courseColor: e.courseColor ?? '#6B7280',
    currentGrade: e.grades?.current_grade ?? null,
    currentScore: e.grades?.current_score ?? null,
    finalGrade: e.grades?.final_grade ?? null,
    finalScore: e.grades?.final_score ?? null,
  }))
  return NextResponse.json(grades)
}
