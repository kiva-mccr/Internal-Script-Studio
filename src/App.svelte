<script lang="ts">
  import { parseRoute } from './lib/route';

  let route = $state(parseRoute(location.hash));
  const onHash = () => (route = parseRoute(location.hash));
</script>

<svelte:window onhashchange={onHash} />

<header>Scripts</header>
<main>
  {#if route.length === 0}
    <h1>Script Studio</h1>
    <p>Being built. See the roadmap.</p>
  {:else}
    <h1>{route.join(' / ')}</h1>
  {/if}
</main>

<style>
  header { padding: 20px 24px; font-size: 15px; font-weight: 600; }
  main { max-width: 880px; margin: 0 auto; padding: 40px 16px; }
  h1 { margin: 0 0 12px; font-size: 28px; font-weight: 600; }
  p { margin: 0; color: var(--muted); }
</style>
