import { test as base, expect } from '@playwright/test'
import type { APIRequestContext, Locator, Page } from '@playwright/test'

interface JobSummary {
  id: number
  name: string
}

interface JobPage {
  next: string | null
  results: JobSummary[]
}

/** Every job whose name contains `token`, following cursors across all pages. */
async function findJobs(request: APIRequestContext, token: string): Promise<JobSummary[]> {
  const found: JobSummary[] = []
  let url: string | null = '/api/jobs/?page_size=100'
  while (url) {
    const response = await request.get(url)
    expect(response.ok()).toBe(true)
    const page = (await response.json()) as JobPage
    found.push(...page.results.filter((job) => job.name.includes(token)))
    url = page.next
  }
  return found
}

interface JobFixtures {
  /**
   * Names jobs for this test. Each name carries a token unique to the test, so
   * assertions can find exactly the rows this test made in a database that may
   * hold anything else, and teardown can delete them all afterwards.
   */
  jobName: (label: string) => string
  /** Create jobs directly through the API, for setup that is not under test. */
  createJobsViaApi: (labels: string[]) => Promise<string[]>
}

export const test = base.extend<JobFixtures>({
  jobName: async ({ request }, use, testInfo) => {
    const token = `e2e-${testInfo.testId.slice(0, 8)}-${Date.now().toString(36)}`
    await use((label) => `${label} [${token}]`)

    // Runs even when the test fails, so a failure never leaves jobs behind to
    // skew the next run or clutter a developer's dashboard.
    for (const job of await findJobs(request, token)) {
      await request.delete(`/api/jobs/${job.id}/`)
    }
  },

  createJobsViaApi: async ({ request, jobName }, use) => {
    await use(async (labels) => {
      const names = labels.map(jobName)
      for (const name of names) {
        const response = await request.post('/api/jobs/', { data: { name } })
        expect(response.status()).toBe(201)
      }
      return names
    })
  },
})

export { expect }

/**
 * Wait for the job list to finish loading.
 *
 * The table keeps the previous rows visible, dimmed, while a new page loads,
 * so asserting right after an action could observe the rows it replaced.
 * Every action that reloads the list is followed by this. It waits on the
 * region rather than the table, which does not exist while the list is empty.
 */
export async function waitForList(page: Page): Promise<void> {
  await expect(page.getByRole('region', { name: 'Jobs', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  )
}

/** The table row for the job with exactly this name. */
export function jobRow(page: Page, name: string): Locator {
  return page.getByRole('row').filter({
    has: page.getByRole('cell', { name, exact: true }),
  })
}

/**
 * The status cell for the job with this name.
 *
 * Assert on this, never on the row's text: the row also holds the status menu,
 * whose options name every status, so a row "contains" Pending whatever state
 * the job is in.
 */
export function jobStatus(page: Page, name: string): Locator {
  return jobRow(page, name).getByRole('cell').nth(2)
}

/** Create a job through the form, as a user would. */
export async function createJobViaForm(page: Page, name: string): Promise<void> {
  await page.getByLabel('New job').fill(name)
  await page.getByRole('button', { name: 'Create job' }).click()
  await waitForList(page)
}
