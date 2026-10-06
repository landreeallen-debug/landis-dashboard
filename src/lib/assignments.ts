// Pure client-safe helpers — no process.env, no server imports.
// Shared between canvas.ts (server) and WarningOverlay (client).

export const BIG_ASSIGNMENT_RE =
  /\b(test|quiz|exam|assessment|unit check|mid.?term|final|essay|paper|report|writing assignment|project|presentation|diorama|poster|portfolio|science fair|speech|debate|performance task)\b/i

export function bigAssignmentTypeLabel(name: string): string {
  const n = name.toLowerCase()
  if (/\b(essay|paper|report|writing)\b/.test(n)) return 'Essay / Writing'
  if (/\b(project|presentation|diorama|poster|portfolio|science fair)\b/.test(n)) return 'Project'
  if (/\b(quiz)\b/.test(n)) return 'Quiz'
  if (/\b(test|exam|assessment|mid.?term|final)\b/.test(n)) return 'Test'
  return 'Big Assignment'
}
