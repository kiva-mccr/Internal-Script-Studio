import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { execSync } from 'node:child_process';
import { parseMerge } from './src/lib/version';

// The live version (AP-28): only the deploy build (LIVE_BUILD, set in deploy.yml) reads the merge commit.
function liveVersion() {
  if (!process.env.LIVE_BUILD) return null;
  const [message, at] = execSync('git log -1 --format=%B%x00%cI', { encoding: 'utf8' }).split('\0');
  return parseMerge(message, at.trim());
}

// Served at https://p2p-script-studio.kivamccr.xyz/ (custom domain) and, until that redirects, at
// https://kiva-mccr.github.io/Internal-Script-Studio/. Relative paths work at both.
export default defineConfig({
  base: './',
  plugins: [svelte()],
  define: { __VERSION__: JSON.stringify(liveVersion()) },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
