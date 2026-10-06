import { expect, test } from '@playwright/test'

test('saved notes and quizlet link survive a page reload', async ({ page }) => {
  const notes = `Reviewed fractions ${Date.now()}`
  const quizletUrl = 'https://quizlet.com/test-set-123'

  await page.goto('/study/8958/1001')
  await expect(page.getByRole('heading', { name: 'Fractions Quiz' })).toBeVisible()

  await page.getByPlaceholder(/Write your own notes/i).fill(notes)
  await page.getByPlaceholder(/quizlet.com/i).fill(quizletUrl)
  await page.getByRole('button', { name: /Save notes/i }).click()
  await expect(page.getByRole('button', { name: 'Saved!' })).toBeVisible()

  await page.reload()

  await expect(page.getByPlaceholder(/Write your own notes/i)).toHaveValue(notes)
  await expect(page.getByPlaceholder(/quizlet.com/i)).toHaveValue(quizletUrl)
})
