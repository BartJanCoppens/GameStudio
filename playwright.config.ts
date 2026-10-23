import { defineConfig, devices } from '@playwright/test';

// End-to-end tests against the Supabase project in .env.local / .env.seed. They sign in with
// throwaway accounts that global-setup creates and global-teardown deletes (with their runs),
// so the demo accounts and their leaderboard stay untouched.
const PORT = 5181;

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: { command: `npx vite --port ${PORT} --strictPort`, url: `http://localhost:${PORT}`, reuseExistingServer: true },
});
