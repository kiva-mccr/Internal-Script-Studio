import { describe, expect, it } from 'vitest';
import { clearMarks, toHtml, toggle } from '../../src/lib/format';

describe('toHtml', () => {
  it('shows each mark as formatting and escapes the rest', () => {
    expect(toHtml('A **bold** and *italic* <u>line</u> ~~gone~~.')).toBe('A <strong>bold</strong> and <em>italic</em> <u>line</u> <s>gone</s>.');
    expect(toHtml('**bold *and italic***')).toBe('<strong>bold <em>and italic</em></strong>');
    expect(toHtml('[how leaves work](https://example.com/a?b=1&c=2)')).toBe(
      '<a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener">how leaves work</a>');
    expect(toHtml('$E = mc^2$')).toBe('<span class="math" data-tex="E = mc^2">E = mc^2</span>');
    expect(toHtml('<script>alert(1)</script> a < b')).toBe('&lt;script&gt;alert(1)&lt;/script&gt; a &lt; b');
    expect(toHtml('[bad](javascript:alert(1))')).toBe('[bad](javascript:alert(1))');
  });
});

describe('toggle', () => {
  const t = 'It needs three ingredients.';
  const at = t.indexOf('three'), end = at + 'three'.length;
  it('puts a mark on a selection, and takes it off again', () => {
    const on = toggle(t, at, end, 'bold');
    expect(on.text).toBe('It needs **three** ingredients.');
    expect(on.text.slice(on.start, on.end)).toBe('three');
    expect(toggle(on.text, on.start, on.end, 'bold').text).toBe(t);
    expect(toggle(t, at, end, 'underline').text).toBe('It needs <u>three</u> ingredients.');
  });
  it('tells italic from bold', () => {
    const bold = toggle(t, at, end, 'bold');
    const both = toggle(bold.text, bold.start, bold.end, 'italic');
    expect(both.text).toBe('It needs ***three*** ingredients.');
    expect(toggle(both.text, both.start, both.end, 'italic').text).toBe(bold.text);
  });
  it('a link wraps the words and selects the address to type', () => {
    const link = toggle(t, at, end, 'link');
    expect(link.text).toBe('It needs [three](https://) ingredients.');
    expect(link.text.slice(link.start, link.end)).toBe('https://');
  });
});

describe('clearMarks', () => {
  it('takes every mark out; links keep their words', () => {
    expect(clearMarks('**a** *b* <u>c</u> ~~d~~ $e$ [f](https://x.y)')).toBe('a b c d e f');
  });
});
