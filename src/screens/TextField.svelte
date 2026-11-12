<script lang="ts">
  import { clearMarks, continueList, renderMath, showLists, toggleList, toHtml, toggle, type List, type Mark } from '../lib/format';
  import { paragraphs } from '../lib/script';

  // A Write cell (mock-up 8): while typing you see the marks (**bold**); elsewhere they show as formatting. Selecting
  // text shows a toolbar; Ctrl+B, I, U and K work too.
  let {
    value = $bindable(),
    label,
    placeholder,
    oninput,
    onparagraphs,
    lists = false,
  }: {
    value: string; label: string; placeholder: string; oninput: () => void;
    // Bullets, numbers and tick boxes, with their buttons always shown (the planning panel, AP-24).
    lists?: boolean;
    // Pasting two or more paragraphs hands them over, with the text before and after the selection (AP-13).
    onparagraphs?: (lines: string[], head: string, tail: string) => void;
  } = $props();

  let box = $state<HTMLTextAreaElement>();
  let focused = $state(false);
  let selecting = $state(false);
  const html = $derived(toHtml(lists ? showLists(value) : value));

  const TOOLS: { mark: Mark | 'clear'; text: string; name: string; keys?: string }[] = [
    { mark: 'bold', text: 'B', name: 'Bold', keys: 'Ctrl+B' },
    { mark: 'italic', text: 'I', name: 'Italic', keys: 'Ctrl+I' },
    { mark: 'underline', text: 'U', name: 'Underline', keys: 'Ctrl+U' },
    { mark: 'strike', text: 'S', name: 'Strikethrough' },
    { mark: 'link', text: 'Link', name: 'Link', keys: 'Ctrl+K' },
    { mark: 'equation', text: '∑ x', name: 'Equation (LaTeX)' },
    { mark: 'clear', text: 'Clear', name: 'Clear formatting' },
  ];
  const LISTS: { kind: List; text: string; name: string }[] = [
    { kind: 'bullet', text: '•', name: 'Bulleted list' },
    { kind: 'number', text: '1.', name: 'Numbered list' },
    { kind: 'tick', text: '☐', name: 'Tick box (again to tick it)' },
  ];
  const KEYS: Record<string, Mark> = { b: 'bold', i: 'italic', u: 'underline', k: 'link' };

  function math(node: HTMLElement, _html: string) {
    renderMath(node);
    return { update: () => renderMath(node) };
  }

  function look() {
    selecting = !!box && box.selectionStart !== box.selectionEnd;
  }

  function apply(mark: Mark | 'clear' | List) {
    if (!box) return;
    const [start, end] = [box.selectionStart, box.selectionEnd];
    const next = mark === 'bullet' || mark === 'number' || mark === 'tick'
      ? toggleList(value, start, end, mark)
      : mark === 'clear'
      ? (() => {
          const cleared = clearMarks(value.slice(start, end));
          return { text: value.slice(0, start) + cleared + value.slice(end), start, end: start + cleared.length };
        })()
      : toggle(value, start, end, mark);
    box.focus();
    // Through the browser's own typing, so Ctrl+Z undoes it.
    box.setSelectionRange(0, value.length);
    if (!document.execCommand('insertText', false, next.text)) {
      value = next.text;
      oninput();
    }
    box.setSelectionRange(next.start, next.end);
    look();
  }

  function paste(e: ClipboardEvent) {
    const lines = paragraphs(e.clipboardData?.getData('text/plain') ?? '');
    if (!onparagraphs || !box || lines.length < 2) return;
    e.preventDefault();
    onparagraphs(lines, value.slice(0, box.selectionStart), value.slice(box.selectionEnd));
  }

  function keydown(e: KeyboardEvent) {
    if (lists && box && e.key === 'Enter' && !e.shiftKey && box.selectionStart === box.selectionEnd) {
      const next = continueList(value, box.selectionStart);
      if (next) {
        e.preventDefault();
        box.setSelectionRange(0, value.length);
        if (!document.execCommand('insertText', false, next.text)) {
          value = next.text;
          oninput();
        }
        box.setSelectionRange(next.at, next.at);
        return;
      }
    }
    const mark = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey ? KEYS[e.key.toLowerCase()] : undefined;
    if (!mark) return;
    e.preventDefault();
    apply(mark);
  }
</script>

{#if lists}
  <div class="lists" role="toolbar" aria-label="Lists">
    {#each LISTS as tool (tool.kind)}
      <button class="tool" aria-label={tool.name} title={tool.name} onmousedown={(e) => e.preventDefault()} onclick={() => apply(tool.kind)}>{tool.text}</button>
    {/each}
  </div>
{/if}
<div class="field" class:focused class:empty={!value}>
  {#if focused && selecting}
    <div class="toolbar" role="toolbar" aria-label="Formatting">
      {#each TOOLS as tool (tool.mark)}
        <button class="tool {tool.mark}" aria-label={tool.name} title={tool.keys ? `${tool.name} (${tool.keys})` : tool.name}
          onmousedown={(e) => e.preventDefault()} onclick={() => apply(tool.mark)}>{tool.text}</button>
      {/each}
    </div>
  {/if}
  <textarea bind:this={box} bind:value aria-label={label} {placeholder} {oninput} onkeydown={keydown} onpaste={paste}
    onfocus={() => (focused = true)} onblur={() => ((focused = false), (selecting = false))}
    onmouseup={look} onkeyup={look} onselect={look}></textarea>
  <div class="shown" aria-hidden="true" use:math={html}>{@html html}</div>
</div>

<style>
  .field { position: relative; display: grid; }
  textarea, .shown { grid-area: 1 / 1; min-width: 0; }
  textarea { width: 100%; box-sizing: border-box; margin: 0; padding: 0; border: 0; resize: none; field-sizing: content; min-height: 1.55em;
    font: inherit; line-height: 1.55; color: inherit; background: none; }
  textarea:focus { outline: none; background: #f7f9ff; box-shadow: 0 0 0 6px #f7f9ff; border-radius: 2px; }
  /* Not being typed in: the formatted text shows, over a see-through text box that still takes the click. */
  .shown { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.55; pointer-events: none; }
  .field:not(.focused):not(.empty) textarea { opacity: 0; }
  .focused .shown, .empty .shown { visibility: hidden; }
  .shown :global(a) { color: var(--accent); }
  .shown :global(s) { color: #8a8a8a; }
  .toolbar { position: absolute; z-index: 3; bottom: calc(100% + 10px); left: 0; display: flex; align-items: center; gap: 2px; padding: 4px;
    border: 1px solid var(--line); border-radius: 8px; background: #fff; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1); }
  .tool { min-width: 32px; height: 32px; padding: 0 8px; border: 0; border-radius: 6px; background: none; color: var(--ink); font-size: 14px; }
  .tool:hover { background: #f0f3fc; color: var(--accent); }
  .lists { display: flex; gap: 2px; margin: 0 0 10px -8px; }
  .lists .tool { color: var(--muted); }
  .bold { font-weight: 700; }
  .italic { font-style: italic; font-family: Georgia, serif; }
  .underline { text-decoration: underline; }
  .strike { text-decoration: line-through; }
  .link, .clear { font-size: 13px; }
  .equation { font-style: italic; font-family: Georgia, serif; }
  .clear { color: var(--muted); }
  .equation, .clear { margin-left: 6px; }
</style>
