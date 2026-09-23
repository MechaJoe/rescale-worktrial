import {
  createJobViaForm,
  expect,
  historyEntries,
  jobRow,
  jobStatus,
  test,
  waitForJob,
  waitForList,
} from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await waitForList(page)
})

test('opening a job shows its details and status history', async ({ page, jobName }) => {
  const name = jobName('Thermal Sweep')
  await createJobViaForm(page, name)
  await page.getByLabel(`Change status of ${name}`).selectOption('RUNNING')
  await waitForList(page)

  await page.getByRole('link', { name }).click()
  await waitForJob(page)

  await expect(page).toHaveURL(/\/jobs\/\d+$/)
  await expect(page).toHaveTitle(`${name} · Jobs`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
  await expect(historyEntries(page)).toHaveCount(2)
  await expect(historyEntries(page).nth(0)).toContainText('Running')
  await expect(historyEntries(page).nth(0)).toContainText('Current')
  await expect(historyEntries(page).nth(1)).toContainText('Pending')
})

test('changing status on a job’s page appends to its history', async ({ page, jobName }) => {
  const name = jobName('Acoustic Propagation Model')
  await createJobViaForm(page, name)
  await page.getByRole('link', { name }).click()
  await waitForJob(page)
  await expect(historyEntries(page)).toHaveCount(1)

  await page.getByLabel(`Change status of ${name}`).selectOption('COMPLETED')
  await waitForJob(page)

  await expect(historyEntries(page)).toHaveCount(2)
  await expect(historyEntries(page).nth(0)).toContainText('Completed')
  await expect(page.getByRole('status')).toContainText(`Set “${name}” to Completed.`)
})

test('returning from a job restores the list’s filter and page', async ({
  page,
  createJobsViaApi,
}) => {
  // 26 new Pending jobs: under the Pending filter the newest 25 fill page 1,
  // so the oldest is on page 2 whatever else is in the database.
  const names = await createJobsViaApi(Array.from({ length: 26 }, (_, i) => `Queued job ${i}`))
  const onPageTwo = names[0]

  await page.getByRole('tab', { name: 'Pending' }).click()
  await waitForList(page)
  await expect(page).toHaveURL(/\?status=PENDING$/)
  await page.getByRole('button', { name: 'Next →' }).click()
  await waitForList(page)
  await expect(jobRow(page, onPageTwo)).toHaveCount(1)

  // Via the browser's Back button.
  await page.getByRole('link', { name: onPageTwo }).click()
  await waitForJob(page)
  await page.goBack()
  await waitForList(page)
  await expect(page).toHaveURL(/\?status=PENDING$/)
  await expect(page.getByRole('tab', { name: 'Pending' })).toHaveAttribute('aria-selected', 'true')
  await expect(jobRow(page, onPageTwo)).toHaveCount(1)

  // Via the breadcrumb.
  await page.getByRole('link', { name: onPageTwo }).click()
  await waitForJob(page)
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Jobs' }).click()
  await waitForList(page)
  await expect(page).toHaveURL(/\?status=PENDING$/)
  await expect(jobRow(page, onPageTwo)).toHaveCount(1)
})

test('deleting from a job’s page returns to the list with a confirmation', async ({
  page,
  jobName,
}) => {
  const name = jobName('Combustion Chamber CFD')
  await createJobViaForm(page, name)
  await page.getByRole('link', { name }).click()
  await waitForJob(page)

  await page.getByRole('button', { name: `Delete ${name}` }).click()
  await page.getByRole('button', { name: 'Delete job' }).click()
  await waitForList(page)

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('status')).toContainText(`Deleted “${name}”.`)
  await expect(jobRow(page, name)).toHaveCount(0)

  // The deleted job's page was replaced in history, so Back does not return to it.
  await page.goBack()
  await expect(page).not.toHaveURL(/\/jobs\//)
})

test('a job that does not exist gets a not-found page', async ({ page }) => {
  for (const path of ['/jobs/999999999', '/jobs/not-a-number']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: 'Job not found' })).toBeVisible()
  }

  await page.goto('/no/such/page')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await page.getByRole('link', { name: 'View all jobs' }).click()
  await waitForList(page)
  await expect(page).toHaveURL(/\/$/)
})

test('the status filter is read from and written to the URL', async ({ page, jobName }) => {
  const name = jobName('Battery Thermal Runaway')
  await createJobViaForm(page, name)
  await page.getByLabel(`Change status of ${name}`).selectOption('FAILED')
  await waitForList(page)

  // A shared link opens straight into the filtered view.
  await page.goto('/?status=FAILED')
  await waitForList(page)
  await expect(page.getByRole('tab', { name: 'Failed' })).toHaveAttribute('aria-selected', 'true')
  await expect(jobStatus(page, name)).toHaveText('Failed')

  // An unrecognised value falls back to all jobs, and is removed from the URL.
  await page.goto('/?status=bogus')
  await waitForList(page)
  await expect(page.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/\/$/)
})
