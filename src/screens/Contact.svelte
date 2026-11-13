<script lang="ts">
  // One person's contact details (AP-31, board 50): email and LinkedIn, kept once for the whole folder. Done saves
  // them (a new file in .studio/people/) when they changed. Used by the Credits window and by People.
  import { savePerson, type Person } from '../lib/people';

  let { root, person, me, uses, onSaved }: {
    root: FileSystemDirectoryHandle; person: Person; me: string; uses: string; onSaved: (person: Person) => void;
  } = $props();

  // svelte-ignore state_referenced_locally (the form starts from the person as they were when it opened)
  let email = $state(person.email);
  // svelte-ignore state_referenced_locally
  let linkedin = $state(person.linkedin);
  let error = $state('');

  // Saves what changed, then hands the person back. Returns false when it couldn't save.
  export async function done(): Promise<boolean> {
    error = '';
    if (email.trim() === person.email && linkedin.trim() === person.linkedin) return (onSaved(person), true);
    try {
      onSaved(await savePerson(root, { ...person, email, linkedin }, me));
      return true;
    } catch {
      error = "Couldn't save the contact details. If OneDrive is still syncing, wait a moment and try again.";
      return false;
    }
  }
</script>

<div class="contact">
  <div class="fields">
    <label>Email<input type="email" bind:value={email} placeholder="name@example.org" /></label>
    <label>LinkedIn<input bind:value={linkedin} placeholder="linkedin.com/in/…" /></label>
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <div class="foot">
    <span>Shared by every script: a change here shows in all {uses}.</span>
    <button class="primary small" onclick={done}>Done</button>
  </div>
</div>

<style>
  .contact { padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: #fafafa; }
  .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
  input { min-height: 40px; padding: 0 10px; border: 1px solid var(--line-strong); border-radius: 6px; font: inherit; font-size: 14px; color: var(--ink); }
  .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 10px; }
  .foot span { flex: 1 1 200px; font-size: 12px; color: var(--muted); }
  .error { margin: 8px 0 0; font-size: 13px; color: var(--danger); }
</style>
