import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// GitHub Pages serves the app from /Internal-Script-Studio/.
export default defineConfig({
  base: '/Internal-Script-Studio/',
  plugins: [svelte()],
  test: { include: ['tests/unit/**/*.test.ts'] },
});
