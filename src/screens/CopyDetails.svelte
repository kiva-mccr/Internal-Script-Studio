<script lang="ts">
  import { hasProblem, problemDetails } from '../lib/problems';

  // The small copy icon after an error message (AP-41). Shows only for messages given to `problem()`.
  let { message }: { message: string } = $props();

  let copied = $state<'' | 'copied' | 'failed'>('');
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    const text = problemDetails(message, { page: location.hash, version: __VERSION__, ua: navigator.userAgent });
    try {
      await navigator.clipboard.writeText(text);
      copied = 'copied';
    } catch {
      copied = 'failed';
    }
    clearTimeout(timer);
    timer = setTimeout(() => (copied = ''), 1500);
  }
</script>

{#if message && hasProblem(message)}
  <button type="button" class="copy-details" onclick={copy} aria-label="Copy details" title={copied === 'failed' ? "Couldn't copy" : copied === 'copied' ? 'Copied' : 'Copy details'}>
    {#if copied === 'copied'}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
    {:else}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
    {/if}
  </button>
  {#if copied === 'failed'}<span class="copy-failed" role="status">Couldn't copy</span>{/if}
{/if}

<style>
  .copy-details {
    display: inline-flex; align-items: center; justify-content: center; vertical-align: middle;
    width: 28px; height: 28px; margin-left: 4px; padding: 0; border: 0; border-radius: 6px;
    background: none; color: inherit; opacity: 0.55; cursor: pointer; flex: none;
  }
  .copy-details:hover, .copy-details:focus-visible { opacity: 1; }
  .copy-failed { font-size: 12px; opacity: 0.8; }
</style>
