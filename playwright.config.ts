import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // The example's guided tour (AP-34) covers the page, so tests start with it skipped; tour.spec.ts turns it back on.
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'off',
    storageState: { cookies: [], origins: [{ origin: 'http://localhost:4173', localStorage: [{ name: 'tour-skipped', value: 'yes' }] }] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npm run build && npm run preview -- --port 4173 --strictPort', port: 4173, reuseExistingServer: false },
});
