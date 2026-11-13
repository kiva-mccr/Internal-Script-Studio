import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // The example's guided tour (AP-34) covers the page, so tests start with it skipped; tour.spec.ts turns it back on.
  // Typing is saved 1.5 s after it starts instead of 30 s (FX-2), so tests don't wait.
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'off',
    storageState: { cookies: [], origins: [{ origin: 'http://localhost:4173', localStorage: [{ name: 'tour-skipped', value: 'yes' }, { name: 'save-every', value: '1500' }] }] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npm run build && npm run preview -- --port 4173 --strictPort', port: 4173, reuseExistingServer: false },
});
