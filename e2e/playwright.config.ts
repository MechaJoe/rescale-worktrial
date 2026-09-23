import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',

  // The tests share one live database, and the list under test is ordered by
  // creation time. Parallel workers creating jobs at once could interleave in
  // ways that make a correct test fail, so the suite runs serially — it is
  // small enough that determinism costs only seconds.
  fullyParallel: false,
  workers: 1,

  // A flaky test should fail loudly, not pass on its second attempt.
  retries: 0,

  // Nothing is written to the host: failures are reported on stdout, which is
  // all `make test` shows, and a report directory on a bind mount would be
  // created as root on a Linux host.
  reporter: 'list',

  use: {
    // `frontend` is the nginx service as seen from inside the compose network.
    baseURL: process.env.BASE_URL ?? 'http://frontend',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
