import { expect, test } from '@playwright/test'

test('assignments page defaults to important assignments, supports the week view, and filters by course', async ({ page }) => {
  await page.goto('/assignments')

  // Default "All Assignments" mode only surfaces tests/quizzes/projects, not routine work
  const modeSelect = page.getByLabel('Assignments view')
  await expect(modeSelect).toHaveValue('important')
  await expect(page.getByText('Fractions Quiz')).toBeVisible()
  await expect(page.getByText('Explorer poster project')).toBeVisible()
  await expect(page.getByText('Read chapter 4')).toBeHidden()
  await expect(page.getByText('Build a bridge sketch')).toBeHidden()

  // Switching to "Due This Week" brings routine items back
  await modeSelect.selectOption('week')
  await expect(page).toHaveURL(/mode=week/)
  await expect(page.getByText('Read chapter 4')).toBeVisible()

  // Filter to just Math via the course chip — course filters ignore the mode entirely
  await page.getByRole('link', { name: 'Math', exact: true }).click()

  await expect(page).toHaveURL(/course=8958/)
  await expect(page.getByRole('heading', { name: 'Math Assignments' })).toBeVisible()
  await expect(page.getByText('Fractions Quiz')).toBeVisible()
  await expect(page.getByText('Read chapter 4')).toBeHidden()
  await expect(page.getByText('Build a bridge sketch')).toBeHidden()

  // Test/quiz badge and the study-guide shortcut both show up for the test assignment
  await expect(page.getByText('Test/Quiz')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open study guide for Fractions Quiz' })).toHaveAttribute(
    'href', '/study/8958/1001'
  )

  await page.getByRole('link', { name: 'Show all' }).click()
  await expect(page).toHaveURL(/\/assignments$/)
  await expect(page.getByLabel('Assignments view')).toHaveValue('important')
  await expect(page.getByText('Explorer poster project')).toBeVisible()
})

test('calendar-sourced items skip the study/notes shortcut', async ({ page }) => {
  await page.goto('/assignments?course=9100') // Robotics: one real assignment + one calendar event

  await expect(page.getByRole('heading', { name: 'Robotics Assignments' })).toBeVisible()

  const bridgeSketch = page.locator('.card', { hasText: 'Build a bridge sketch' })
  await expect(bridgeSketch.getByRole('link', { name: /Open study guide|Open notes/ })).toHaveCount(1)

  const calendarItem = page.locator('.card', { hasText: 'Read simple machines page' })
  await expect(calendarItem.getByRole('link', { name: /Open study guide|Open notes/ })).toHaveCount(0)
  await expect(calendarItem.getByRole('link', { name: /Open .* in Canvas/ })).toHaveCount(1)
})

test('assignments page shows an empty state for a course with nothing upcoming', async ({ page }) => {
  await page.goto('/assignments?course=8574') // Science has no fixture assignments

  await expect(page.getByRole('heading', { name: 'Science Assignments' })).toBeVisible()
  await expect(page.getByText('Nothing upcoming!')).toBeVisible()
})
