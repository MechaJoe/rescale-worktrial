import { createJobViaForm, expect, jobRow, jobStatus, test, waitForList } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await waitForList(page)
})

// The two critical flows the brief asks the E2E suite to cover (section 3).
test.describe('creating a job and changing its status', () => {
  test('creating a job lists it with the initial Pending status', async ({ page, jobName }) => {
    const name = jobName('Fluid Dynamics Simulation')

    await createJobViaForm(page, name)

    await expect(jobStatus(page, name)).toHaveText('Pending')
    await expect(page.getByRole('status')).toContainText(`Created “${name}”.`)

    // Survives a reload, so it came from the server rather than local state.
    await page.reload()
    await waitForList(page)
    await expect(jobStatus(page, name)).toHaveText('Pending')
  })

  test('changing a job’s status updates it and records a new status entry', async ({
    page,
    request,
    jobName,
  }) => {
    const name = jobName('ML Model Training')
    await createJobViaForm(page, name)

    const menu = page.getByLabel(`Change status of ${name}`)
    await menu.selectOption('RUNNING')
    await waitForList(page)

    await expect(jobStatus(page, name)).toHaveText('Running')
    // The state the job is now in cannot be chosen again.
    await expect(menu.getByRole('option', { name: 'Running (current)' })).toBeDisabled()

    await page.reload()
    await waitForList(page)
    await expect(jobStatus(page, name)).toHaveText('Running')

    // The change was appended to the history, not written over the old status.
    const id = await jobRow(page, name).getByRole('cell').first().innerText()
    const job = await (await request.get(`/api/jobs/${id}/`)).json()
    expect(job.status_history.map((entry: { status_type: string }) => entry.status_type)).toEqual([
      'RUNNING',
      'PENDING',
    ])
  })
})

test('an empty name is rejected before any request is sent', async ({ page }) => {
  const posts: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url())
  })

  for (const value of ['', '   ']) {
    await page.getByLabel('New job').fill(value)
    await page.getByRole('button', { name: 'Create job' }).click()
    await expect(page.getByText('Enter a name for the job.')).toBeVisible()
  }

  await expect(page.getByLabel('New job')).toHaveAttribute('aria-invalid', 'true')
  expect(posts).toEqual([])
})

test('deleting a job asks for confirmation first', async ({ page, jobName }) => {
  const name = jobName('Mesh Generation')
  await createJobViaForm(page, name)
  const dialog = page.getByRole('dialog', { name: 'Delete job?' })

  // Cancelling leaves the job in place.
  await page.getByRole('button', { name: `Delete ${name}` }).click()
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  await expect(jobRow(page, name)).toHaveCount(1)

  // Confirming removes it.
  await page.getByRole('button', { name: `Delete ${name}` }).click()
  await page.getByRole('button', { name: 'Delete job' }).click()
  await waitForList(page)
  await expect(jobRow(page, name)).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText(`Deleted “${name}”.`)
})

test('filtering by status shows only jobs in that status', async ({ page, jobName }) => {
  const failed = jobName('Structural Fatigue Study')
  const pending = jobName('Crash Test Analysis')
  await createJobViaForm(page, failed)
  await createJobViaForm(page, pending)
  await page.getByLabel(`Change status of ${failed}`).selectOption('FAILED')
  await waitForList(page)

  await page.getByRole('tab', { name: 'Failed' }).click()
  await waitForList(page)

  await expect(jobRow(page, failed)).toHaveCount(1)
  await expect(jobRow(page, pending)).toHaveCount(0)
  // Every row shown, not just ours, is Failed: the filter is applied server-side.
  const statuses = await page.locator('tbody tr td:nth-child(3)').allInnerTexts()
  expect(new Set(statuses)).toEqual(new Set(['Failed']))
})

test('pagination moves between pages of 25', async ({ page, createJobsViaApi }) => {
  // 26 jobs, created oldest first: the newest 25 fill page 1, and the oldest
  // sits at the top of page 2 whatever else is in the database.
  const names = await createJobsViaApi(Array.from({ length: 26 }, (_, i) => `Batch job ${i}`))
  const oldest = names[0]
  const newest = names[names.length - 1]
  await page.reload()
  await waitForList(page)

  await expect(page.locator('tbody tr')).toHaveCount(25)
  await expect(jobRow(page, newest)).toHaveCount(1)
  await expect(jobRow(page, oldest)).toHaveCount(0)

  await page.getByRole('button', { name: 'Next →' }).click()
  await waitForList(page)
  await expect(page.locator('tbody tr').first()).toContainText(oldest)

  await page.getByRole('button', { name: '← Previous' }).click()
  await waitForList(page)
  await expect(jobRow(page, newest)).toHaveCount(1)
  await expect(page.getByRole('button', { name: '← Previous' })).toBeDisabled()
})
