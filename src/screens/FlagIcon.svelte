<script lang="ts">
  // A flag (AP-9): filled when the row is flagged, an outline when not. Takes the text's colour.
  let { filled = true, size = 14 }: { filled?: boolean; size?: number } = $props();
</script>

<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill={filled ? 'currentColor' : 'none'}
  stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 21V4h11l-2 4 2 4H5" /></svg>
