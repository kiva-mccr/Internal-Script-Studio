<script lang="ts">
  // Credits (AP-31, board 50): a window in the page, opened from ⋯ in a script. The script's credits pick from the
  // people kept once for the folder (lib/people.ts) and add a short blurb on what each did on this script. Contact
  // details are the folder's, so a change shows in every script. Changing the credits changes the script's front
  // matter, saved like any edit (onChange).
  import { creditedOn, listPeople, readCredits, savePerson, writeCredits, contactLine, type Credit, type Person } from '../lib/people';
  import { frontList, type Script } from '../lib/script';
  import Contact from './Contact.svelte';

  let { root, script = $bindable(), me, onChange, onClose }: {
    root: FileSystemDirectoryHandle; script: Script; me: string; onChange: () => void; onClose: () => void;
  } = $props();

  let people = $state<Person[]>([]);
  let on = $state<Map<string, unknown[]>>(new Map()); // the scripts that credit each person, for "On 3 scripts"
  let editing = $state(''); // the person whose contact details are open
  let contact = $state<Contact>();
  let adding = $state(false);
  let query = $state('');
  let newName = $state('');
  let error = $state('');
  let done = $state<HTMLButtonElement>();

  const credits = $derived(readCredits(script.front));
  const byId = $derived(new Map(people.map((p) => [p.id, p])));
  // Not credited yet, the script's writers first, then by name; Find matches a name or a usual role.
  const pickable = $derived.by(() => {
    const writers = frontList(script.front, 'authors').map((a) => a.toLowerCase());
    const q = query.trim().toLowerCase();
    return people
      .filter((p) => !credits.some((c) => c.id === p.id))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q))
      .sort((a, b) => Number(writers.includes(b.name.toLowerCase())) - Number(writers.includes(a.name.toLowerCase())));
  });

  $effect(() => {
    load();
    done?.focus();
  });

  async function load() {
    try {
      people = await listPeople(root);
    } catch {
      error = "The people in the folder couldn't be read. If the shared folder is still syncing, wait a moment and try again.";
    }
    creditedOn(root).then((found) => (on = found));
  }

  function scripts(id: string): string {
    // This script counts even before its first save with the new credit.
    const n = Math.max(on.get(id)?.length ?? 0, credits.some((c) => c.id === id) ? 1 : 0);
    return `${n} ${n === 1 ? 'script' : 'scripts'}`;
  }

  function set(next: Credit[]) {
    script.front = writeCredits(script.front, next);
    onChange();
  }

  function blurb(id: string, role: string) {
    set(credits.map((c) => (c.id === id ? { ...c, role } : c)));
  }

  // A blurb typed for someone with no usual role yet becomes it, so it fills in the next script's blurb (board 50, choice 4).
  async function settle(id: string) {
    const person = byId.get(id);
    const role = credits.find((c) => c.id === id)?.role.trim();
    if (!person || person.role || !role) return;
    try {
      const saved = await savePerson(root, { ...person, role }, me);
      people = people.map((p) => (p.id === id ? saved : p));
    } catch {
      // Only a convenience: the blurb itself is saved with the script.
    }
  }

  function add(person: Person) {
    set([...credits, { id: person.id, name: person.name, role: person.role }]);
    adding = false;
    query = '';
  }

  // Someone new joins the folder's list and this script's credits, and their contact details open. A name already in
  // the folder (case-blind) is that person.
  async function addNew(event: SubmitEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const known = people.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (known) {
      if (!credits.some((c) => c.id === known.id)) add(known);
      newName = '';
      adding = false;
      return;
    }
    try {
      const person = await savePerson(root, { name, role: '', email: '', linkedin: '' }, me);
      people = [...people, person].sort((a, b) => a.name.localeCompare(b.name));
      add(person);
      newName = '';
      editing = person.id;
    } catch {
      error = `Couldn't add ${name}. If the shared folder is still syncing, wait a moment and try again.`;
    }
  }

  function remove(id: string) {
    if (editing === id) editing = '';
    set(credits.filter((c) => c.id !== id));
  }

  function saved(person: Person) {
    people = people.map((p) => (p.id === person.id ? person : p));
    editing = '';
  }

  // Open contact details are saved on closing too, so nothing typed is lost.
  async function close() {
    if (contact && !(await contact.done())) return;
    onClose();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && !e.defaultPrevented && close()} />

<div class="backdrop" role="presentation" onpointerdown={(e) => e.target === e.currentTarget && close()}>
  <div class="window" role="dialog" aria-modal="true" aria-labelledby="credits-title" tabindex="-1">
    <div class="top">
      <h2 id="credits-title">Credits</h2>
      <span class="count">{credits.length === 1 ? '1 person' : `${credits.length} people`} on this script</span>
      <button class="close" aria-label="Close" onclick={close}>×</button>
    </div>
    <div class="body">
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      {#each credits as credit (credit.id)}
        {@const person = byId.get(credit.id)}
        <div class="credit">
          <div class="who">
            <b>{person?.name ?? credit.name}</b>
            <span>{person ? contactLine(person) || 'No contact details yet' : ''}</span>
          </div>
          <label class="blurb">On this script
            <input value={credit.role} placeholder="What they did, or their role" aria-label="What {credit.name} did on this script"
              oninput={(e) => blurb(credit.id, e.currentTarget.value)} onchange={() => settle(credit.id)} />
          </label>
          <div class="buttons">
            {#if person}
              <button class="outline small" aria-expanded={editing === credit.id}
                onclick={() => (editing = editing === credit.id ? '' : credit.id)}>Contact details</button>
            {/if}
            <button class="remove" aria-label="Remove {credit.name}" title="Remove from the credits" onclick={() => remove(credit.id)}>×</button>
          </div>
        </div>
        {#if editing === credit.id && person}
          <div class="details"><Contact bind:this={contact} {root} {person} {me} uses={scripts(person.id)} onSaved={saved} /></div>
        {/if}
      {:else}
        <p class="empty">No credits yet. Add the people who worked on this script.</p>
      {/each}

      {#if adding}
        <div class="picker">
          <div class="find">
            <!-- svelte-ignore a11y_autofocus -->
            <label>Find <input bind:value={query} placeholder="name or role" autofocus /></label>
            <button class="outline small" onclick={() => ((adding = false), (query = ''), (newName = ''))}>Cancel</button>
          </div>
          <ul aria-label="People in the folder">
            {#each pickable as person (person.id)}
              <li><button onclick={() => add(person)}>
                <b>{person.name}</b><span class="role">{person.role}</span><span class="on">On {scripts(person.id)}</span>
              </button></li>
            {:else}
              <li class="none">{query.trim() ? `Nobody in the folder matches "${query.trim()}".` : 'Everyone in the folder is in the credits.'}</li>
            {/each}
          </ul>
          <form class="new" onsubmit={addNew}>
            <label>Someone new<input bind:value={newName} placeholder="Their name" maxlength="80" /></label>
            <button class="primary small" type="submit" disabled={!newName.trim()}>Add to the folder and here</button>
          </form>
        </div>
      {:else}
        <button class="outline add" onclick={() => ((adding = true), (editing = ''))}>+ Add a person</button>
      {/if}
    </div>
    <div class="foot">
      <span>Contact details are shared by every script in the folder.</span>
      <button class="dark" bind:this={done} onclick={close}>Done</button>
    </div>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 20; display: flex; justify-content: center; align-items: flex-start;
    padding: 64px 16px; background: rgba(20, 20, 20, 0.25); overflow: auto; }
  .window { width: 100%; max-width: 760px; box-sizing: border-box; border-radius: 12px; background: var(--ground);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18); }
  .top { display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 20px; border-bottom: 1px solid #eee; }
  h2 { margin: 0; font-size: 17px; font-weight: 600; }
  .count { flex: 1; font-size: 13px; color: var(--muted); }
  .close { min-width: 44px; min-height: 44px; border: 0; border-radius: 8px; background: none; color: var(--muted); font-size: 20px; }
  .close:hover, .remove:hover { background: #f2f2f2; }
  .body { padding: 8px 20px 20px; }
  .credit { display: grid; grid-template-columns: minmax(0, 180px) minmax(0, 1fr) auto; gap: 14px; align-items: end; padding: 12px 0;
    border-bottom: 1px solid #f0f0f0; }
  .who { min-width: 0; align-self: center; }
  .who b { display: block; font-size: 14px; font-weight: 600; }
  .who span { display: block; margin-top: 3px; font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .blurb { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
  .blurb input, .find input, .new input { min-height: 40px; padding: 0 10px; border: 1px solid var(--line-strong); border-radius: 6px;
    font: inherit; font-size: 14px; color: var(--ink); }
  .buttons { display: flex; gap: 4px; }
  .remove { min-width: 40px; min-height: 40px; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 16px; }
  .details { padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
  .empty { margin: 16px 0; font-size: 14px; color: var(--muted); }
  .add { margin-top: 16px; min-height: 44px; }
  .picker { margin-top: 16px; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .find { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid #f0f0f0; background: #fafafa; }
  .find label { flex: 1; display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
  .find input { flex: 1; min-width: 0; }
  ul { max-height: 260px; overflow-y: auto; margin: 0; padding: 0; list-style: none; }
  li button { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 48px; padding: 8px 12px; border: 0; border-bottom: 1px solid #f0f0f0;
    background: var(--ground); color: var(--ink); font-size: 14px; text-align: left; }
  li button:hover { background: #f7f7f7; }
  li b { flex: 0 0 180px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .role { flex: 1; min-width: 0; font-size: 13px; color: var(--muted); }
  .on { font-size: 12px; color: var(--muted); white-space: nowrap; }
  .none { padding: 12px; font-size: 13px; color: var(--muted); }
  .new { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; padding: 12px; background: #fafafa; }
  .new label { flex: 1 1 220px; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
  .new button:disabled { opacity: 0.5; cursor: default; }
  .error { margin: 12px 0 0; font-size: 13px; color: var(--danger); }
  .foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 20px; border-top: 1px solid #eee;
    font-size: 12px; color: var(--muted); }
  .dark { min-height: 44px; padding: 0 18px; border: 0; border-radius: 8px; background: var(--ink); color: #fff; font-size: 14px; font-weight: 500; }
  .dark:hover { background: #333; }
</style>
