import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Served at https://p2p-script-studio.kivamccr.xyz/ (custom domain) and, until that redirects, at
// https://kiva-mccr.github.io/Internal-Script-Studio/. Relative paths work at both.
export default defineConfig({
  base: './',
  plugins: [svelte()],
  test: { include: ['tests/unit/**/*.test.ts'] },
});
