import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'

type StoredItem = { id: number; title?: string; name?: string }

function collectBrowserErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (text.includes('favicon.ico')) return
    if (text === 'Failed to load resource: the server responded with a status of 404 (Not Found)') return
    errors.push(text)
  })
  return errors
}

async function spamClick(locator: Locator, count = 20) {
  await locator.evaluate((element, clickCount) => {
    for (let i = 0; i < clickCount; i++) {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    }
  }, count)
}

async function clearCollection(request: APIRequestContext, endpoint: string) {
  const response = await request.get(endpoint)
  if (!response.ok()) return
  const items = await response.json() as StoredItem[]
  await Promise.all(
    items.map(item => request.delete(endpoint, { data: { id: item.id } }))
  )
}

test.beforeEach(async ({ request }) => {
  await clearCollection(request, '/api/schedule-events')
  await clearCollection(request, '/api/extracurriculars')
})

test('new Canvas classes feed grades, work, and schedule automatically', async ({ page }) => {
  const errors = collectBrowserErrors(page)

  await page.goto('/grades')
  await expect(page.getByText('Robotics Lab - New Semester')).toBeVisible()
  await expect(page.getByRole('link', { name: 'View assignments' }).last()).toBeVisible()

  await page.goto('/assignments')
  await page.getByLabel('Assignments view').selectOption('week')
  await expect(page.getByRole('link', { name: 'Robotics' })).toBeVisible()
  await expect(page.getByText('Build a bridge sketch')).toBeVisible()
  await expect(page.getByText('Read simple machines page')).toBeVisible()

  await page.getByRole('link', { name: 'Robotics' }).click()
  await expect(page.getByRole('heading', { name: 'Robotics Assignments' })).toBeVisible()
  await expect(page.getByText('Build a bridge sketch')).toBeVisible()
  await expect(page.getByText('Read simple machines page')).toBeVisible()

  await page.goto('/schedule')
  await page.getByRole('button', { name: /Week/i }).click()
  await expect(page.getByText('Build a bridge sketch')).toBeVisible()
  await expect(page.getByText('Read simple machines page')).toBeVisible()

  expect(errors).toEqual([])
})

test('home checklist and study warning survive bad storage and rapid taps', async ({ page }) => {
  const errors = collectBrowserErrors(page)

  await page.addInitScript(() => {
    localStorage.setItem(`checklist-${new Date().toISOString().slice(0, 10)}`, '{not-json')
    localStorage.removeItem('warn-ack-canvas-1001')
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Hi Landis!' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'BIG DAY TOMORROW!' })).toBeVisible()

  await spamClick(page.getByRole('button', { name: /I will study tonight for Fractions Quiz/i }), 25)

  await expect(page.getByRole('heading', { name: 'BIG DAY TOMORROW!' })).toBeHidden()
  await expect(page.getByText('Fractions Quiz').last()).toBeVisible()

  const checklistItem = page.getByRole('button', { name: /Mark done: Check your school email/i })
  await expect(checklistItem).toBeVisible()
  await spamClick(checklistItem, 25)

  await expect(page.getByText("Tonight's Checklist")).toBeVisible()
  expect(errors).toEqual([])
})

test('schedule add flow stays single and usable under repeated clicks', async ({ page, request }) => {
  const errors = collectBrowserErrors(page)

  await page.goto('/schedule')

  await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
  await spamClick(page.getByRole('button', { name: /Add event/i }), 12)
  await expect(page.getByPlaceholder('What is it? *')).toHaveCount(1)

  await page.getByPlaceholder('What is it? *').fill('Pack backpack')
  await spamClick(page.getByRole('button', { name: 'Save' }).first(), 25)

  await expect(page.getByText('Pack backpack')).toBeVisible()
  const events = await (await request.get('/api/schedule-events')).json() as StoredItem[]
  expect(events.filter(event => event.title === 'Pack backpack')).toHaveLength(1)

  await page.getByRole('button', { name: /Week/i }).click()
  await page.getByRole('button', { name: /Month/i }).click()
  await spamClick(page.getByRole('button', { name: 'Next month' }), 8)
  await spamClick(page.getByRole('button', { name: 'Previous month' }), 8)

  expect(errors).toEqual([])
})

test('activities can be added and deleted once even when buttons are hammered', async ({ page, request }) => {
  const errors = collectBrowserErrors(page)

  await page.goto('/extracurriculars')

  await expect(page.getByRole('heading', { name: 'Activities' })).toBeVisible()
  await spamClick(page.getByRole('button', { name: /Add activity/i }), 15)
  await expect(page.getByPlaceholder('Activity name *')).toHaveCount(1)

  await page.getByPlaceholder('Activity name *').fill('Chess club')
  await spamClick(page.getByRole('button', { name: 'Save' }), 25)

  await expect(page.getByText('Chess club')).toBeVisible()
  const savedItems = await (await request.get('/api/extracurriculars')).json() as StoredItem[]
  expect(savedItems.filter(item => item.name === 'Chess club')).toHaveLength(1)

  await spamClick(page.getByRole('button', { name: 'Delete Chess club' }), 15)
  await expect(page.getByText('Chess club')).toBeHidden()

  const remainingItems = await (await request.get('/api/extracurriculars')).json() as StoredItem[]
  expect(remainingItems.filter(item => item.name === 'Chess club')).toHaveLength(0)
  expect(errors).toEqual([])
})

test('study guide generation and note saves collapse rapid submit clicks', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  let guidePosts = 0
  let notePosts = 0

  await page.route('**/api/study-guide**', async route => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    guidePosts += 1
    await new Promise(resolve => setTimeout(resolve, 75))
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        content: '# Practice\n- Equivalent fractions\n- Common denominators',
        cached: false,
      }),
    })
  })

  await page.route('**/api/assignment-notes**', async route => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ notes: null, quizlet_url: null }),
      })
      return
    }
    notePosts += 1
    await new Promise(resolve => setTimeout(resolve, 75))
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.goto('/study/8958/1001')

  await expect(page.getByRole('heading', { name: 'Fractions Quiz' })).toBeVisible()
  await spamClick(page.getByRole('button', { name: /Generate study guide/i }), 30)
  await expect(page.getByRole('heading', { name: 'Practice' })).toBeVisible()
  expect(guidePosts).toBe(1)

  await page.getByPlaceholder(/Write your own notes/i).fill('Review fractions before dinner.')
  await spamClick(page.getByRole('button', { name: /Save notes/i }), 30)
  await expect(page.getByRole('button', { name: 'Saved!' })).toBeVisible()
  expect(notePosts).toBe(1)

  expect(errors).toEqual([])
})
