import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function generateStudyGuide(params: {
  assignmentName: string
  courseShort: string
  description: string | null
  dueAt: string | null
  isTest: boolean
  pagesContent: string
}): Promise<string> {
  const { assignmentName, courseShort, description, dueAt, isTest, pagesContent } = params

  const dueStr = dueAt
    ? new Date(dueAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : 'no due date'

  const prompt = `You are creating a ${isTest ? 'TEST PREP GUIDE' : 'study guide'} for Landis, a 5th grade student.

**${courseShort}** — ${assignmentName}
**Due:** ${dueStr}
${description ? `\n**Assignment description:**\n${description}\n` : ''}
${pagesContent ? `\n**Course materials and context:**\n${pagesContent}\n` : ''}

Write a clear, friendly, ${isTest ? 'thorough test prep guide' : 'helpful study guide'} for a 5th grader. Include:

${isTest ? `1. **What the test covers** — a quick bullet summary of topics
2. **Key vocabulary** — important words and simple definitions
3. **Concepts to know** — the most important ideas explained simply
4. **Practice questions** — 3-5 questions similar to what might be on the test
5. **Study tips** — how to prepare tonight` : `1. **What this assignment is about** — a simple explanation
2. **Key ideas** — important concepts in plain language
3. **Steps to complete it** — if it's a task/project
4. **Tips for success** — what to focus on`}

Keep it encouraging and easy to understand. Use bullet points and short sentences.`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = message.content[0]
  return block.type === 'text' ? block.text : ''
}

export async function rankImportantAssignments(params: {
  courseShort: string
  syllabus: string
  assignments: { id: number; name: string; due_at: string | null; points_possible: number | null; isTest: boolean }[]
}): Promise<number[]> {
  const { courseShort, syllabus, assignments } = params
  if (!assignments.length) return []

  const list = assignments
    .map(a => {
      const due = a.due_at ? new Date(a.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'no due date'
      return `- id ${a.id}: "${a.name}" (${a.points_possible ?? '?'} pts, due ${due}${a.isTest ? ', flagged as test/quiz' : ''})`
    })
    .join('\n')

  const prompt = `You are helping figure out which upcoming ${courseShort} assignments matter most for Landis, a 5th grader, to focus on.

${syllabus ? `Course syllabus:\n${syllabus}\n\n` : ''}Upcoming assignments:
${list}

Pick out the assignments that are the most important to focus on — major tests, quizzes, projects, or anything the syllabus calls out as a big part of the grade. Skip routine daily homework unless the syllabus says otherwise.

Respond with ONLY a JSON array of the "id" numbers you picked, nothing else. Example: [1001, 1004]`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = message.content[0]
  const text = block.type === 'text' ? block.text : '[]'
  try {
    const match = text.match(/\[[\s\S]*\]/)
    const ids = JSON.parse(match ? match[0] : text)
    return Array.isArray(ids) ? ids.filter((n): n is number => typeof n === 'number') : []
  } catch {
    return []
  }
}

export async function generateTestOverview(params: {
  assignmentName: string
  courseShort: string
  description: string | null
  pagesContent: string
}): Promise<string> {
  const { assignmentName, courseShort, description, pagesContent } = params

  const prompt = `A 5th grade student named Landis has a ${courseShort} test/quiz tomorrow: "${assignmentName}".

${description ? `Test description: ${description}\n` : ''}
${pagesContent ? `Course materials: ${pagesContent}\n` : ''}

Give a SHORT (3-4 sentence) friendly overview of what this test is likely about and the single most important thing to review tonight. Be encouraging.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = message.content[0]
  return block.type === 'text' ? block.text : ''
}
