<script lang="ts">
  import type { Attachment, Field, Note, Thread } from '../lib/comments';
  import { ago } from '../lib/when';
  import AttachBox from './AttachBox.svelte';
  import Attached from './Attached.svelte';

  // One comment or suggestion with its replies, as a card: reply, resolve and reopen, accept or reject with Undo, and
  // edit or delete your own (RV-7). Shared by Review and Write's Comments panel (RV-13).
  let {
    t,
    dir,
    me,
    where,
    gone,
    active,
    recent = false,
    undoResolve = false,
    onActivate,
    onAdd,
    onApply,
    onDecided,
    onGone,
  }: {
    t: Thread;
    dir: FileSystemDirectoryHandle; // files on comments (RV-11) are read from the script's folder
    me: string; // this person's name: Edit and Delete show on what they wrote
    where: string; // "row 3", or "row 3, Dialogue"
    gone: boolean; // its quote is no longer in the row
    active: boolean; // the one being read: its quote is marked darker
    recent?: boolean; // decided or resolved here just now: kept in place with Undo
    undoResolve?: boolean; // Resolve keeps it in place with Undo (Write, RV-13) instead of moving it to Resolved (Review)
    onActivate: () => void;
    onAdd: (note: Omit<Note, 'v' | 'id' | 'when' | 'who'>, files?: File[]) => Promise<boolean>;
    onApply: (row: string, field: Field, from: string, to: string) => boolean;
    onDecided: (id: string) => void; // accepted, rejected (or resolved, with undoResolve)
    onGone: (id: string, deleted: boolean) => void; // deleted (kept in place with Undo) or brought back
  } = $props();

  const suggestion = $derived(t.comment.kind === 'suggestion');
  let replying = $state(false);
  let reply = $state('');
  let replyFiles = $state<File[]>([]);

  // Editing your own (RV-7): one comment, suggestion or reply at a time, in place.
  let editing = $state('');
  let edit = $state('');
  let editKept = $state<Attachment[]>([]); // files the edited one keeps (RV-11)
  let editFiles = $state<File[]>([]); // and new ones
  let editMissing = $state('');
  const mine = (n: Note) => n.who === me && !t.resolved;

  function startEdit(n: Note) {
    editing = n.id;
    edit = (n.kind === 'suggestion' ? n.replace : n.text) ?? '';
    editKept = n.files ?? [];
    editFiles = [];
    editMissing = '';
  }

  async function saveEdit(e: SubmitEvent, n: Note) {
    e.preventDefault();
    const isSuggestion = n.kind === 'suggestion';
    const now = isSuggestion ? edit : edit.trim();
    if (isSuggestion) {
      if (!now.trim()) return void (editMissing = 'Write something first, or Delete it.');
      if (now === n.quote) return void (editMissing = 'Change the text first.');
      if (now === n.replace) return void (editing = '');
      if (await onAdd({ kind: 'edit', about: n.id, replace: now })) editing = '';
      return;
    }
    const filesChanged = editFiles.length > 0 || editKept.length !== (n.files ?? []).length;
    if (!now && !editKept.length && !editFiles.length) return void (editMissing = 'Write something first, or Delete it.');
    if (now === n.text && !filesChanged) return void (editing = '');
    const entry = { kind: 'edit' as const, about: n.id, text: now, ...(filesChanged ? { files: editKept } : {}) };
    if (await onAdd(entry, editFiles)) editing = '';
  }

  async function remove(n: Note) {
    if (await onAdd({ kind: 'delete', about: n.id })) (editing = ''), onGone(n.id, true);
  }

  async function restore(n: Note) {
    if (await onAdd({ kind: 'undelete', about: n.id })) onGone(n.id, false);
  }

  async function decide(accept: boolean) {
    const { row = '', field = 'dialogue', quote = '', replace = '' } = t.comment;
    if (accept && !onApply(row, field, quote, replace)) return;
    if (await onAdd({ kind: accept ? 'accept' : 'reject', about: t.comment.id })) onDecided(t.comment.id);
  }

  async function resolve() {
    if ((await onAdd({ kind: 'resolve', about: t.comment.id })) && undoResolve) onDecided(t.comment.id);
  }

  // Undo an accept puts the old words back; either way it is open again.
  async function undo() {
    const { row = '', field = 'dialogue', quote = '', replace = '' } = t.comment;
    if (t.decision === 'accepted' && !onApply(row, field, replace, quote)) return;
    await onAdd({ kind: 'reopen', about: t.comment.id });
  }

  async function sendReply(e: SubmitEvent) {
    e.preventDefault();
    if (!reply.trim() && !replyFiles.length) return;
    if (await onAdd({ kind: 'reply', about: t.comment.id, text: reply.trim() }, replyFiles)) (replying = false), (reply = ''), (replyFiles = []);
  }

  function startReply() {
    replying = true;
    reply = '';
    replyFiles = [];
  }
</script>

{#if t.deleted}
  <p class="card deleted" data-id={t.comment.id}>{suggestion ? 'Suggestion' : 'Comment'} deleted. <button class="link inline" onclick={() => restore(t.comment)}>Undo</button></p>
{:else}
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article class="card" data-id={t.comment.id} class:active class:done={t.resolved} aria-label="{suggestion ? 'Suggestion' : 'Comment'} by {t.comment.who}"
  onclick={onActivate}>
  <div class="who"><span><strong>{t.comment.who}</strong> {suggestion ? 'suggested' : 'commented'} · {where}</span><span>{@render time(t.comment)}</span></div>
  {#if gone && !t.decision}<p class="quiet">On text that has since changed: “{t.comment.quote}”</p>{/if}
  {#if editing === t.comment.id}
    {#if t.comment.quote}<blockquote>{t.comment.quote}</blockquote>{/if}
    {@render editor(t.comment, suggestion ? 'Replace with' : 'Edit comment')}
  {:else if suggestion}
    <p class="text">Replace “<span class="old">{t.comment.quote}</span>” with “<span class="new">{t.comment.replace}</span>”.</p>
  {:else}
    {#if t.comment.text}<p class="text">{t.comment.text}</p>{/if}
    {#if t.comment.files?.length}<Attached {dir} files={t.comment.files} />{/if}
  {/if}
  {#each t.replies as r (r.id)}
    {#if r.deleted}
      <p class="reply quiet">Reply deleted. <button class="link inline" onclick={() => restore(r)}>Undo</button></p>
    {:else}
      <div class="reply">
        <div class="who"><strong>{r.who}</strong><span class="when">{@render time(r)}{#if mine(r) && editing !== r.id}<button class="link inline" onclick={() => startEdit(r)}>Edit</button><button class="link inline" onclick={() => remove(r)}>Delete</button>{/if}</span></div>
        {#if editing === r.id}{@render editor(r, 'Edit reply')}{:else}{#if r.text}<p class="text">{r.text}</p>{/if}{#if r.files?.length}<Attached {dir} files={r.files} />{/if}{/if}
      </div>
    {/if}
  {/each}
  {#if editing === t.comment.id}
    <!-- Its own edit box is open above: no other actions until Save or Cancel. -->
  {:else if replying}
    <form class="reply-form" onsubmit={sendReply}>
      {#snippet buttons()}
        <button class="primary small" type="submit">Reply</button>
        <button class="link" type="button" onclick={() => (replying = false)}>Cancel</button>
      {/snippet}
      <AttachBox {dir} bind:files={replyFiles} actions={buttons}><textarea bind:value={reply} aria-label="Reply" rows="2"></textarea></AttachBox>
    </form>
  {:else}
    <div class="actions">
      {#if suggestion && t.decision}
        <span class="decided">{t.decision === 'accepted' ? 'Accepted. The script is updated.' : 'Rejected. The original stays.'}</span>
        <button class="link" onclick={undo}>Undo</button>
      {:else if suggestion}
        <button class="primary small" onclick={() => decide(true)}>Accept</button>
        <button class="outline" onclick={() => decide(false)}>Reject</button>
        <button class="link" onclick={startReply}>Reply</button>
        {@render own()}
      {:else if !t.resolved}
        <button class="outline" onclick={startReply}>Reply</button>
        <button class="link" onclick={resolve}>Resolve</button>
        {@render own()}
      {:else if recent && undoResolve}
        <span class="decided">Resolved.</span>
        <button class="link" onclick={() => onAdd({ kind: 'reopen', about: t.comment.id })}>Undo</button>
      {:else}
        <button class="link" onclick={() => onAdd({ kind: 'reopen', about: t.comment.id })}>Reopen</button>
      {/if}
    </div>
  {/if}
</article>
{/if}

{#snippet own()}
  {#if mine(t.comment) && editing !== t.comment.id}
    <span class="own">
      <button class="link compact" onclick={() => startEdit(t.comment)}>Edit</button>
      <button class="link compact" onclick={() => remove(t.comment)}>Delete</button>
    </span>
  {/if}
{/snippet}

{#snippet time(n: Note)}
  {ago(Date.parse(n.when))}{#if n.edited}<span title="Edited {ago(Date.parse(n.edited))}"> · edited</span>{/if}
{/snippet}

<!-- The edit box (RV-7): in place, Save and Cancel; Esc cancels. -->
{#snippet editor(n: Note, name: string)}
  <form class="reply-form" novalidate onsubmit={(e) => saveEdit(e, n)}>
    {#snippet typing()}
      <!-- svelte-ignore a11y_autofocus -->
      <textarea bind:value={edit} oninput={() => (editMissing = '')} onkeydown={(e) => e.key === 'Escape' && (editing = '')}
        aria-label={name} rows={n.kind === 'reply' ? 2 : 3} autofocus></textarea>
      {#if editMissing}<p class="missing" role="alert">{editMissing}</p>{/if}
    {/snippet}
    {#snippet buttons()}
      <button class="primary small" type="submit">Save</button>
      <button class="link" type="button" onclick={() => (editing = '')}>Cancel</button>
    {/snippet}
    {#if n.kind === 'suggestion'}
      {@render typing()}
      <div class="actions">{@render buttons()}</div>
    {:else}
      <!-- Editing can take files off or add new ones (RV-11, with RV-7). -->
      <AttachBox {dir} bind:files={editFiles} bind:kept={editKept} actions={buttons}>{@render typing()}</AttachBox>
    {/if}
  </form>
{/snippet}

<style>
  .card { display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
  .card.active { border-color: #b9c7ee; }
  .card.done { background: #fafafa; }
  .who { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; color: var(--muted); }
  .who strong { color: var(--ink); font-weight: 600; }
  .text { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
  .old { color: #8a2b2b; text-decoration: line-through; }
  .new { color: var(--accent); }
  .decided { display: inline-flex; align-items: center; flex: 1; font-size: 14px; color: #3d3d3d; }
  .reply { display: flex; flex-direction: column; gap: 4px; padding-left: 12px; border-left: 2px solid var(--line); }
  blockquote { margin: 0; padding-left: 10px; border-left: 3px solid #e0b100; font-size: 14px; color: #3d3d3d; }
  textarea { font: inherit; font-size: 14px; padding: 8px 10px; border: 1px solid var(--line-strong); border-radius: 8px; resize: vertical; }
  .reply-form { display: flex; flex-direction: column; gap: 8px; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .own { display: flex; margin-left: auto; }
  .compact { padding: 0 6px; }
  .when { display: inline-flex; align-items: center; gap: 2px; }
  .inline { min-height: 28px; padding: 0 6px; font-size: 13px; }
  .deleted { flex-direction: row; align-items: center; margin: 0; padding: 10px 16px; border-style: dashed; font-size: 13px; color: var(--muted); }
  .small { min-height: 40px; padding: 0 16px; font-size: 14px; }
  .missing { margin: 0; font-size: 13px; color: var(--danger); }
  .quiet { margin: 0; font-size: 13px; color: var(--muted); }
</style>
