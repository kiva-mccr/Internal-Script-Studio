<script lang="ts">
  // People (AP-31, board 50): everyone in the folder and how to reach them, from the script list's People button, so
  // nobody has to open a script to find someone. A name opens their contact details and the scripts that credit
  // them; someone no script credits can be taken out of the list. People are added from a script's Credits.
  import type { ScriptInfo } from '../lib/folder';
  import { creditedOn, linkedinUrl, listPeople, removePerson, type Person } from '../lib/people';
  import { routeHash } from '../lib/route';
  import Contact from './Contact.svelte';

  let { root, me, onClose }: { root: FileSystemDirectoryHandle; me: string; onClose: () => void } = $props();

  let people = $state<Person[] | null>(null);
  let on = $state<Map<string, ScriptInfo[]>>(new Map());
  let open = $state('');
  let contact = $state<Contact>();
  let error = $state('');
  let done = $state<HTMLButtonElement>();

  $effect(() => {
    load();
    done?.focus();
  });

  async function load() {
    try {
      [people, on] = await Promise.all([listPeople(root), creditedOn(root)]);
    } catch {
      people = [];
      error = "The people in the folder couldn't be read. If the shared folder is still syncing, wait a moment and try again.";
    }
  }

  function count(id: string): string {
    const n = on.get(id)?.length ?? 0;
    return `On ${n} ${n === 1 ? 'script' : 'scripts'}`;
  }

  async function toggle(id: string) {
    if (contact && !(await contact.done())) return;
    open = open === id ? '' : id;
  }

  function saved(person: Person) {
    people = people!.map((p) => (p.id === person.id ? person : p));
    open = '';
  }

  async function remove(person: Person) {
    try {
      await removePerson(root, person, me);
      people = people!.filter((p) => p.id !== person.id);
      open = '';
    } catch {
      error = `Couldn't remove ${person.name}. If the shared folder is still syncing, wait a moment and try again.`;
    }
  }

  async function close() {
    if (contact && !(await contact.done())) return;
    onClose();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && !e.defaultPrevented && close()} />

<div class="backdrop" role="presentation" onpointerdown={(e) => e.target === e.currentTarget && close()}>
  <div class="window" role="dialog" aria-modal="true" aria-labelledby="people-title" tabindex="-1">
    <div class="top">
      <h2 id="people-title">People</h2>
      <span class="count">{people ? `${people.length} in ${root.name}` : ''}</span>
      <button class="close" aria-label="Close" onclick={close}>×</button>
    </div>
    <div class="body">
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      {#if people && !people.length && !error}
        <p class="empty">Nobody yet. People are added from a script: ⋯, then Credits.</p>
      {/if}
      {#each people ?? [] as person (person.id)}
        {@const scripts = on.get(person.id) ?? []}
        <div class="person">
          <button class="name" aria-expanded={open === person.id} onclick={() => toggle(person.id)}>
            <b>{person.name}</b><span class="on">{count(person.id)}</span>
          </button>
          <span class="role">{person.role || 'No usual role'}</span>
          <span class="reach">
            {#if person.email}<a href="mailto:{person.email}">{person.email}</a>{/if}
            {#if person.linkedin}<a href={linkedinUrl(person.linkedin)} target="_blank" rel="noopener">LinkedIn</a>{/if}
            {#if !person.email && !person.linkedin}No contact details yet{/if}
          </span>
          {#if open === person.id}
            <div class="details">
              <Contact bind:this={contact} {root} {person} {me} uses={`${scripts.length} ${scripts.length === 1 ? 'script' : 'scripts'}`} onSaved={saved} />
              {#if scripts.length}
                <p class="credited">Credited on
                  {#each scripts as info, i (info.path.join('/'))}{i ? ', ' : ' '}<a href={routeHash(info.path)}>{info.title}</a>{/each}
                </p>
              {:else}
                <p class="credited">No script credits {person.name}.
                  <button class="link" onclick={() => remove(person)}>Remove from the folder</button></p>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
    <div class="foot">
      <span>Shared by every script in the folder.</span>
      <button class="dark" bind:this={done} onclick={close}>Done</button>
    </div>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 20; display: flex; justify-content: center; align-items: flex-start;
    padding: 64px 16px; background: rgba(20, 20, 20, 0.25); overflow: auto; }
  .window { width: 100%; max-width: 640px; box-sizing: border-box; border-radius: 12px; background: var(--ground);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18); }
  .top { display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 20px; border-bottom: 1px solid #eee; }
  h2 { margin: 0; font-size: 17px; font-weight: 600; }
  .count { flex: 1; font-size: 13px; color: var(--muted); }
  .close { min-width: 44px; min-height: 44px; border: 0; border-radius: 8px; background: none; color: var(--muted); font-size: 20px; }
  .close:hover { background: #f2f2f2; }
  .body { padding: 4px 20px 16px; }
  .person { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
  .name { display: flex; align-items: baseline; gap: 8px; width: 100%; min-height: 32px; padding: 0; border: 0; background: none;
    color: var(--ink); font-size: 14px; text-align: left; }
  .name b { flex: 1; font-weight: 500; }
  .name:hover b { color: var(--accent); }
  .on, .role { font-size: 12px; color: var(--muted); }
  .role, .reach { display: block; }
  .reach { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 2px; font-size: 12px; color: var(--muted); }
  .reach a { color: var(--accent); overflow-wrap: anywhere; }
  .details { margin-top: 10px; }
  .credited { margin: 8px 0 0; font-size: 13px; color: var(--muted); }
  .credited a { color: var(--accent); }
  .empty { margin: 16px 0; font-size: 14px; color: var(--muted); }
  .error { margin: 12px 0 0; font-size: 13px; color: var(--danger); }
  .foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 20px; border-top: 1px solid #eee;
    font-size: 12px; color: var(--muted); }
  .dark { min-height: 44px; padding: 0 18px; border: 0; border-radius: 8px; background: var(--ink); color: #fff; font-size: 14px; font-weight: 500; }
  .dark:hover { background: #333; }
</style>
