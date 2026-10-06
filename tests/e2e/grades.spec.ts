import { expect, test } from '@playwright/test'

test('grades page keeps familiar subject order and falls back gracefully when ungraded', async ({ page }) => {
  await page.goto('/grades')

  await expect(page.getByRole('heading', { name: 'My Grades' })).toBeVisible()

  const cards = page.locator('.card')
  await expect(cards).toHaveCount(4) // Math, Language Arts, Science, Robotics

  // Familiar subjects keep the same visual order; newly discovered Canvas courses
  // append after them instead of jumping ahead because of their current score.
  const cardOrder = await cards.evaluateAll(nodes => nodes.map(n => n.textContent ?? ''))
  const idx = (needle: string) => cardOrder.findIndex(t => t.includes(needle))
  expect(idx('Vick 5th Grade Math')).toBeLessThan(idx('Language Arts - Trevino'))
  expect(idx('Language Arts - Trevino')).toBeLessThan(idx('Vick 5th Grade Science'))
  expect(idx('Vick 5th Grade Science')).toBeLessThan(idx('Robotics Lab'))

  const mathCard = page.locator('.card', { hasText: 'Vick 5th Grade Math' })
  await expect(mathCard.getByText('A-', { exact: true })).toBeVisible()
  await expect(mathCard.getByText('91%')).toBeVisible()

  const laCard = page.locator('.card', { hasText: 'Language Arts - Trevino' })
  await expect(laCard.getByText('B+', { exact: true })).toBeVisible()

  // Science has a null grade/score in the fixture -> falls back to the "no grade" state
  const scienceCard = page.locator('.card', { hasText: 'Vick 5th Grade Science' })
  await expect(scienceCard.getByText('No grade posted yet')).toBeVisible()
  await expect(scienceCard.getByText('—', { exact: true })).toBeVisible()

  await expect(mathCard.getByRole('link', { name: 'View assignments' })).toHaveAttribute(
    'href', '/assignments?course=8958'
  )
  // Canvas link is derived from CANVAS_API_URL, not a hardcoded school domain
  // (playwright.config.ts sets it to http://127.0.0.1:9 for tests).
  await expect(mathCard.getByRole('link', { name: /Canvas/ })).toHaveAttribute(
    'href', 'http://127.0.0.1:9/courses/8958/grades'
  )
})
