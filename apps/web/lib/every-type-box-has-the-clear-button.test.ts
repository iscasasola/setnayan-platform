/**
 * EVERY TYPE BOX HAS THE CLEAR BUTTON (owner 2026-10-31, live iPhone, Guests › March with "Dela" typed and the keyboard
 * up: *"Why does the x inside the type box not clearing the type box. We want every type box too have the clear
 * button"*). Properties, not phrasings:
 *
 *  1. THE CAUSE STAYS FIXED. The ✕ did nothing on an iPhone because `GlobalHaptics` answers every button press at
 *     finger-DOWN with a programmatic `.click()` on a hidden switch on <body> (`lib/haptics.ts`), and the riding row's
 *     tap-away (`useTapAway`, typing-band.tsx) read that click as a tap outside: the field left during the finger's
 *     hold, the row unfolded, and the lift's click landed where the ✕ no longer was. A click no person made is never a
 *     tap away — the tap-away's click listener returns on `!e.isTrusted` BEFORE it can queue the leave.
 *  2. ONE SHARED ✕. `components/clear-field.tsx` is the only place a box-clearing ✕ is drawn and wired: its press holds
 *     the focus (mousedown default prevented) and never calls `.focus()`; `clearTyped` empties through the native
 *     setter and a bubbling `input` event — exercised here on a stand-in input: the host's listener hears the empty
 *     words. The thumb row draws it; a host whose search waits after the last letter is told at once (`onClear`).
 *  3. EVERY TYPE BOX. `GlobalClearField` is mounted in the app's providers and draws that ✕ inside whichever box that
 *     takes words is being typed into; `isClearableField` is the rule — held below on stand-in elements, every
 *     exclusion with its reason.
 *  4. THE INVENTORY. Every `<input>` in app/ and components/ that takes words is counted: covered by the app-wide ✕,
 *     or excluded by a literal attribute the rule reads, or under `data-no-clear="<why>"` (never an empty reason). A
 *     NEW hand-made "Clear…" button beside a box fails — use `ClearButton`. The ones older than the shared ✕ are named
 *     in `OLDER_OWN_CLEAR` (the app-wide ✕ steps aside for them, so a box never shows two).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stripComments } from '@/lib/strip-comments';

const ROOT = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(ROOT, p), 'utf8'));

/** The "Clear…" buttons drawn by hand beside a box BEFORE the shared ✕ (2026-10-31). Never add to this list. */
const OLDER_OWN_CLEAR = new Set([
  'app/_components/search-box.tsx',
  'app/admin/payments/_components/inbox-matcher.tsx',
  'app/dashboard/(account)/people/_components/find-or-invite.tsx',
  'app/dashboard/[eventId]/studio/patiktok/_components/booth-capture.tsx',
  'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx',
  'app/realstories/_components/gallery.tsx',
  'app/realstories/_components/stories-search.tsx',
  'app/open-shop/_components/service-picker.tsx',
]);

/* ── a stand-in DOM, just enough for the rule and the clear ─────────────────────────────────────────────────────── */
class FakeInput extends EventTarget {
  tagName = 'INPUT';
  readOnly = false;
  disabled = false;
  parentElement: { querySelectorAll: (s: string) => { closest: (s: string) => unknown }[] } | null = null;
  private attrs = new Map<string, string>();
  private v = '';
  noClearAncestor = false;
  get value() {
    return this.v;
  }
  set value(x: string) {
    this.v = x;
  }
  getAttribute(k: string) {
    return this.attrs.get(k) ?? null;
  }
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
  }
  closest(sel: string) {
    return sel === '[data-no-clear]' && this.noClearAncestor ? {} : null;
  }
}
(globalThis as unknown as { HTMLInputElement: unknown }).HTMLInputElement = FakeInput;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { clearTyped, isClearableField } = require('@/components/clear-field') as typeof import('@/components/clear-field');

const box = (attrs: Record<string, string> = {}, extra: Partial<FakeInput> = {}) => {
  const el = new FakeInput();
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  Object.assign(el, extra);
  return el as unknown as HTMLInputElement;
};

/* ── the inventory ──────────────────────────────────────────────────────────────────────────────────────────────── */
type Site = { file: string; line: number; tag: string; type: string };
function sites(): Site[] {
  const out: Site[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(join(ROOT, d), { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules') walk(p);
      } else if (p.endsWith('.tsx') && !p.endsWith('.test.tsx')) {
        const s = readFileSync(join(ROOT, p), 'utf8');
        const re = /<input\b/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(s))) {
          let i = m.index + 6;
          let depth = 0;
          let q: string | null = null;
          for (; i < s.length; i++) {
            const c = s[i];
            if (q) {
              if (c === q && s[i - 1] !== '\\') q = null;
              continue;
            }
            if (c === '"' || c === "'" || c === '`') q = c;
            else if (c === '{') depth++;
            else if (c === '}') depth--;
            else if (c === '>' && depth === 0) break;
          }
          const tag = s.slice(m.index, i + 1);
          const t = /\btype=(?:"([^"]+)"|'([^']+)'|\{([^}]+)\})/.exec(tag);
          const type = t ? (t[1] ?? t[2] ?? `{${t[3]}}`) : '';
          out.push({ file: relative(ROOT, join(ROOT, p)), line: s.slice(0, m.index).split('\n').length, tag, type });
        }
      }
    }
  };
  walk('app');
  walk('components');
  return out;
}
const WORDS = new Set(['', 'text', 'search', 'email', 'url', 'tel']);
/** A type expression (`type={…}`) that can be a words type — it gets the ✕ whenever it is one. */
const takesWords = (s: Site) => WORDS.has(s.type) || (s.type.startsWith('{') && /'(text|search|email|url|tel)'/.test(s.type));
/** The literal exclusions the rule reads off the element itself. */
function literalExclusion(tag: string): string | null {
  if (/\breadOnly\b(?!=\{false\})/.test(tag)) return 'readOnly';
  if (/\bdisabled\b(?!=\{)/.test(tag)) return 'disabled';
  if (/inputMode=["'{]+(numeric|decimal)/.test(tag)) return 'number (inputMode)';
  if (/one-time-code/.test(tag)) return 'one-time code';
  if (/data-no-clear=/.test(tag)) return 'data-no-clear';
  return null;
}

describe('every type box has the clear button', () => {
  it('1 · a click no person made is never a tap away (the iOS haptic switch closed the field under the ✕)', () => {
    const BAND = read('app/_components/typing-band.tsx');
    const body = /const onClick = \(e: MouseEvent\) => \{([\s\S]*?)\n {4}\};/.exec(BAND)?.[1] ?? '';
    assert.ok(body, 'useTapAway lost its click listener');
    const trusted = body.search(/if \(!e\.isTrusted\) return;/);
    const leave = body.search(/later\(/);
    assert.ok(trusted >= 0, 'the tap-away reads a programmatic click (the haptic switch on <body>) as a tap outside');
    assert.ok(trusted < leave, 'the trust check must come before the leave is queued');
    // The source of that click is still there — this guard holds the fix, not the absence of haptics.
    assert.match(read('lib/haptics.ts'), /sw\.click\(\)/, 'the haptic switch changed — re-measure the ✕ on an iPhone');
  });

  it('2 · one shared ✕: holds the focus, never focuses, and clears through the input’s own event', () => {
    const SHARED = read('components/clear-field.tsx');
    const btn = SHARED.slice(SHARED.indexOf('<button'), SHARED.indexOf('</button>'));
    assert.match(btn, /type="button"/, 'the ✕ would submit its form');
    assert.match(btn, /onMouseDown=\{holdFocus\}/, 'a press on the ✕ takes the focus (the keyboard drops)');
    assert.match(btn, /data-clear-x=""/, 'the shared ✕ lost its mark (the rule and the app-wide ✕ read it)');
    assert.doesNotMatch(SHARED, /\.focus\(/, 'the ✕ raises the keyboard');

    const el = box();
    el.value = 'Dela';
    const heard: { value: string; bubbles: boolean }[] = [];
    el.addEventListener('input', (e) => heard.push({ value: el.value, bubbles: e.bubbles }));
    clearTyped(el);
    assert.equal(el.value, '', 'the box still has its words');
    assert.deepEqual(heard, [{ value: '', bubbles: true }], 'the host’s onChange/onInput did not hear the empty words');

    const ROW = read('components/thumb-row.tsx');
    assert.match(ROW, /<ClearButton[\s\S]{0,400}clearTyped\(el\);\s*field\.onClear\?\.\(\);/, 'the thumb row’s ✕ is not the shared one, or a waiting host is not told');
    for (const f of ['app/dashboard/[eventId]/launch/_components/details-march.tsx', 'app/dashboard/[eventId]/seating/_components/seating-editor.tsx', 'app/dashboard/[eventId]/guests/_components/guests-screen.tsx']) {
      const src = read(f);
      assert.match(src, /SEARCH_WAIT_MS/, `${f}: no longer waits after the last letter — drop it from this list`);
      assert.match(src, /onClear: \(\) => \{\s*if \(\w+\.current\) clearTimeout\(\w+\.current\);\s*set\w+\(''\);/, `${f}: the ✕ leaves the list filtered for the search's wait`);
    }
  });

  it('3 · the rule: every box that takes words, and each exclusion for its reason', () => {
    for (const type of ['', 'text', 'search', 'email', 'url', 'tel']) {
      assert.equal(isClearableField(box(type ? { type } : {})), true, `type="${type}" takes words — it gets the ✕`);
    }
    const excluded: [string, HTMLInputElement][] = [
      ['password — retyped whole', box({ type: 'password' })],
      ['number — corrected, not emptied', box({ type: 'number' })],
      ['date — a picker', box({ type: 'date' })],
      ['time — a picker', box({ type: 'time' })],
      ['datetime-local — a picker', box({ type: 'datetime-local' })],
      ['checkbox — not words', box({ type: 'checkbox' })],
      ['hidden — not seen', box({ type: 'hidden' })],
      ['an amount in a text box', box({ type: 'text', inputmode: 'decimal' })],
      ['a count or code in a text box', box({ type: 'text', inputmode: 'numeric' })],
      ['a one-time code', box({ type: 'text', autocomplete: 'one-time-code' })],
      ['read-only', box({ type: 'text' }, { readOnly: true })],
      ['disabled', box({ type: 'text' }, { disabled: true })],
      ['under data-no-clear', box({ type: 'text' }, { noClearAncestor: true })],
      ['its own ✕ beside it', box({ type: 'search' }, { parentElement: { querySelectorAll: () => [{ closest: () => null }] } })],
    ];
    for (const [why, el] of excluded) assert.equal(isClearableField(el), false, `${why}: must NOT get the ✕`);
    // The app-wide ✕ beside a box is not "its own" — or the box would lose its ✕ the frame after it appeared.
    assert.equal(isClearableField(box({ type: 'text' }, { parentElement: { querySelectorAll: () => [{ closest: () => ({}) }] } })), true, 'the app-wide ✕ hid itself');
    const TA = { tagName: 'TEXTAREA', getAttribute: () => null } as unknown as Element;
    assert.equal(isClearableField(TA), false, 'a textarea (a long note) must not be one tap from gone');
  });

  it('3 · mounted once, app-wide, drawn inside the box’s own parent (a sheet’s tap-outside never sees it)', () => {
    const P = read('app/providers.tsx');
    assert.match(P, /import \{ GlobalClearField \} from '\.\/_components\/global-clear-field';/, 'the app-wide ✕ is not imported');
    assert.equal((P.match(/<GlobalClearField \/>/g) ?? []).length, 1, 'the app-wide ✕ must be mounted exactly once');
    const G = read('app/_components/global-clear-field.tsx');
    assert.match(G, /isClearableField\(/, 'the app-wide ✕ does not read the one rule');
    assert.match(G, /clearTyped\(el\)/, 'the app-wide ✕ does not clear through the input’s own event');
    assert.match(G, /<ClearButton/, 'the app-wide ✕ is not the shared one');
    assert.match(G, /createPortal\([\s\S]*,\s*spot\.host,?\s*\)/, 'the app-wide ✕ must be drawn inside the box’s parent');
    assert.doesNotMatch(G, /document\.body\)/, 'a ✕ on <body> reads as a tap OUTSIDE every sheet and riding row');
    assert.match(G, /document\.activeElement !== el/, 'the ✕ shows only while the box is typed into');
    assert.match(G, /!el\.value/, 'the ✕ shows only while there are words');
    const CSS = readFileSync(join(ROOT, 'app/globals.css'), 'utf8');
    assert.match(CSS, /input\[data-clearing\]::-webkit-search-cancel-button\s*\{\s*display:\s*none;/, 'the browser’s own search ✕ shows beside ours — two');
    assert.match(CSS, /input\[data-clearing\]\s*\{\s*padding-right:\s*var\(--sn-clear-room\)/, 'the box gives the ✕ no room — it covers the last letters');
  });

  it('4 · the inventory: every box that takes words is covered, or excluded for a written reason', () => {
    const all = sites();
    const words = all.filter(takesWords);
    const out = new Map<string, number>();
    for (const s of words) {
      const why = literalExclusion(s.tag);
      if (why) out.set(why, (out.get(why) ?? 0) + 1);
    }
    const excluded = [...out.values()].reduce((a, b) => a + b, 0);
    const otherTypes = all.length - words.length;
    // The count is printed, never pinned (rule 7: an anchor is a string, never a number).
    console.log(`type boxes: ${all.length} <input> · ${words.length} take words · ${words.length - excluded} get the app-wide ✕ · ${excluded} excluded (${[...out].map(([k, v]) => `${k} ${v}`).join(', ')}) · ${otherTypes} are not words (hidden, checkbox, number, date, file…)`);
    assert.ok(words.length > 100, 'the inventory found almost no type boxes — the scan is broken, not the app');

    for (const f of new Set(all.map((s) => s.file))) {
      const src = readFileSync(join(ROOT, f), 'utf8');
      for (const m of src.matchAll(/data-no-clear=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g)) {
        const why = (m[1] ?? m[2] ?? m[3] ?? '').replace(/['"`]/g, '').trim();
        assert.ok(why.length >= 8, `${f}: data-no-clear needs its reason as its value (got "${why}")`);
      }
      if (f === 'components/clear-field.tsx') continue;
      const hand = /<button\b[^>]*?aria-label=["'{`]+Clear(?! the filters)[^>]*>/s.test(stripComments(src));
      if (hand) assert.ok(OLDER_OWN_CLEAR.has(f), `${f}: a hand-made "Clear…" ✕ beside a box — draw the shared ClearButton (components/clear-field.tsx)`);
    }
  });
});
