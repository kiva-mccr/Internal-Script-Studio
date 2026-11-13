<script lang="ts">
  import { clock, type Preview } from '../lib/preview';

  // One file's preview (AP-19, mock-up 41): a picture (also a TIFF, or a PDF's page 1 with its page count), a small
  // video that plays in place, a slim sound player, or the first lines of a text or Word file. onOpen opens the file;
  // onFail is called when the browser can't play a video or sound after all; a picture
  // that won't draw just hides.
  let { preview, name, onOpen, onFail }: { preview: Preview; name: string; onOpen: () => void; onFail: () => void } =
    $props();

  let media = $state<HTMLMediaElement>();
  let started = $state(false);
  let playing = $state(false);
  let duration = $state(NaN);
  let time = $state(0);

  function play() {
    started = true;
    void media?.play().catch(() => {});
  }

  function seek(event: MouseEvent) {
    if (!media || !Number.isFinite(duration)) return;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    media.currentTime = ((event.clientX - box.left) / box.width) * duration;
  }
</script>

{#if preview.kind === 'image' || preview.kind === 'tif'}
  <button type="button" class="picture" aria-label="Open {name}" onclick={onOpen}>
    <img src={preview.url} alt="" onerror={(e) => ((e.currentTarget as HTMLElement).parentElement!.hidden = true)} />
  </button>
{:else if preview.kind === 'pdf'}
  <button type="button" class="pdf" aria-label="Open {name}" onclick={onOpen}>
    <img src={preview.url} alt="" />
    <span>Page 1 of {preview.pages}</span>
  </button>
{:else if preview.kind === 'video'}
  <div class="video">
    <!-- svelte-ignore a11y_media_has_caption -->
    <!-- #t=0.1 makes Chrome show a frame from the start as the still. -->
    <video bind:this={media} src="{preview.url}#t=0.1" preload="metadata" playsinline controls={started}
      aria-label={name} onloadedmetadata={() => (duration = media!.duration)} onerror={onFail}></video>
    {#if !started}
      <button type="button" class="play-over" aria-label="Play {name} here" onclick={play}>
        <span class="disc"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2 L13 8 L4 14 Z" fill="#fff"></path></svg></span>
      </button>
      {#if Number.isFinite(duration)}<span class="length">{clock(duration)}</span>{/if}
    {/if}
  </div>
{:else if preview.kind === 'audio'}
  <div class="sound">
    <audio bind:this={media} src={preview.url} preload="metadata" onloadedmetadata={() => (duration = media!.duration)}
      ontimeupdate={() => (time = media!.currentTime)} onplay={() => (playing = true)} onpause={() => (playing = false)}
      onended={() => (playing = false)} onerror={onFail}></audio>
    <button type="button" class="round" aria-label="{playing ? 'Pause' : 'Play'} {name}"
      onclick={() => (playing ? media?.pause() : play())}>
      {#if playing}
        <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="1" width="3.5" height="12" fill="#fff"></rect><rect x="8.5" y="1" width="3.5" height="12" fill="#fff"></rect></svg>
      {:else}
        <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2 L13 8 L4 14 Z" fill="#fff"></path></svg>
      {/if}
    </button>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <span class="bar" onclick={seek}><span style:width="{Number.isFinite(duration) && duration ? (time / duration) * 100 : 0}%"></span></span>
    <span class="time">{started ? `${clock(time)} / ${clock(duration)}` : clock(duration)}</span>
  </div>
{:else if preview.kind === 'text' || preview.kind === 'word'}
  <button type="button" class="lines" class:mono={preview.kind === 'text'} aria-label="Open {name}" onclick={onOpen}>
    <span class="label">{preview.label}</span>
    {#each preview.lines as line, i (i)}<span class="line">{line}</span>{/each}
    {#if preview.more}<span class="line more">…</span>{/if}
  </button>
{/if}

<style>
  button { font: inherit; cursor: pointer; }
  .picture { display: block; max-width: 100%; padding: 0; border: 1px solid var(--line); border-radius: 6px; background: #fafafa; overflow: hidden; }
  .picture:hover, .lines:hover, .pdf:hover img { border-color: var(--accent); }
  .picture img { display: block; max-width: 100%; max-height: 120px; object-fit: contain; }
  .pdf { display: flex; align-items: flex-end; gap: 8px; padding: 0; border: 0; background: none; color: var(--muted); font-size: 12px; text-align: left; }
  .pdf img { display: block; height: 112px; border: 1px solid var(--line-strong); border-radius: 3px; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
  .video { position: relative; max-width: 100%; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; background: #000; line-height: 0; }
  .video video { display: block; max-width: 100%; width: 213px; max-height: 120px; }
  .play-over { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; border: 0; background: none; }
  .disc, .length { background: rgba(20, 20, 20, 0.72); color: #fff; }
  .disc { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; }
  .play-over:hover .disc { background: rgba(20, 20, 20, 0.9); }
  .length { position: absolute; right: 6px; bottom: 6px; padding: 2px 6px; border-radius: 4px; font-size: 12px; line-height: 1.4; }
  .sound { display: flex; align-items: center; gap: 8px; width: 220px; max-width: 100%; box-sizing: border-box; padding: 4px 10px 4px 4px;
    border: 1px solid var(--line); border-radius: 22px; background: #fafafa; font-size: 12px; color: #3d3d3d; }
  .round { flex: none; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 50%; background: var(--accent); }
  .bar { flex: 1; height: 4px; border-radius: 2px; background: #dadada; cursor: pointer; }
  .bar span { display: block; height: 4px; border-radius: 2px; background: var(--accent); }
  .time { flex: none; font-variant-numeric: tabular-nums; }
  .lines { display: flex; flex-direction: column; width: 100%; max-width: 260px; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--line);
    border-radius: 6px; background: #fff; text-align: left; font-size: 12px; line-height: 1.5; color: #3d3d3d; }
  .lines.mono .line { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
  .label { margin-bottom: 2px; font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .line { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .more { color: var(--muted); }
</style>
