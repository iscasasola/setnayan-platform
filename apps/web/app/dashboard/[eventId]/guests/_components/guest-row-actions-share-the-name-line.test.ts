/**
 * guest-row-actions-share-the-name-line.test.ts — A GUEST IS ONE LINE: Edit and Remove END the name's line
 * (owner 2026-10-20, on a Guests › List row whose Edit and Remove sat on a second line under the name: *"edit and
 * remove button can be in a row? on the right side?"*).
 *
 * The PROPERTIES, not the phrasing:
 *   1. PLACEMENT — the row's grid is simulated (CSS grid auto-placement over the row's children in DOM order, with
 *      each child's own `grid-column` from the module CSS): avatar, name and buttons all land in grid ROW 1. A
 *      `grid-column: 2` on the buttons (the old shape), a two-track grid, or the buttons nested inside the name's
 *      button all fail here.
 *   2. THE NAME GIVES WAY — the name's track can shrink to zero (`minmax(0, …)`), the buttons' cannot (`auto`), and
 *      the name is ONE line with an ellipsis; the buttons are never pushed below.
 *   3. PHONE TARGETS — under the tablet/desktop boundary (the same 701 px this module uses for the thumb row) a guest
 *      row's buttons are at least 44 × 44, words hidden, icons shown, and that rule comes AFTER the group-state rules
 *      it must beat at equal weight. Each button is named for its guest (aria-label "Edit Maria Santos"), so forty
 *      icon-only buttons are not forty identical "Edit"s. From 701 nothing hides the word.
 *
 * Seen in a real browser (2026-10-20, the guests lab, Chromium + WebKit at 375 / 820 / 1280): every row's buttons'
 * box sits inside the row's box and its vertical centre is the row's within 1 px; at 375 each button is 44 × 44.
 *
 * SABOTAGE (each seen RED, then restored): `.g .acts { grid-column: 2 }` · the third `auto` track removed · the
 * buttons moved inside the name's button · `.nm` back to `flex-wrap: wrap` · the phone button 40 px · the phone block
 * moved above the icon-state rules · `name=` dropped from Remove · the phone boundary 1023 px.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = stripComments(readFileSync(join(HERE, 'guests-screen.tsx'), 'utf8'));
const CSS_SRC = readFileSync(join(HERE, 'guests-screen.module.css'), 'utf8');
const ROOT = postcss.parse(CSS_SRC);

const norm = (x: string) => x.replace(/\s+/g, ' ').trim();

/** Every rule (outside or inside @media) whose selector list holds exactly `selector`, in source order. */
function rulesFor(selector: string, inMedia?: (params: string) => boolean): postcss.Rule[] {
  const out: postcss.Rule[] = [];
  ROOT.walkRules((r) => {
    if (!r.selectors.some((s) => norm(s) === norm(selector))) return;
    const media = r.parent?.type === 'atrule' && (r.parent as postcss.AtRule).name === 'media' ? (r.parent as postcss.AtRule).params : null;
    if (inMedia ? media !== null && inMedia(media) : media === null) out.push(r);
  });
  return out;
}
function decls(rules: postcss.Rule[]): Record<string, string> {
  const d: Record<string, string> = {};
  for (const r of rules) r.walkDecls((x) => void (d[x.prop] = norm(x.value)));
  return d;
}
/** Split a grid track list at top-level whitespace (a `minmax(0, 1fr)` is one track). */
function tracks(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of list) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

const ROW = (() => {
  const start = SCREEN.indexOf('function GuestRowLine(');
  assert.ok(start > 0, 'GuestRowLine is gone — the guard must follow the row');
  return SCREEN.slice(start);
})();

/** The phone boundary this module already uses: the thumb row's `min-width: 701px`. */
const TABLET_MIN = (() => {
  const hits: number[] = [];
  ROOT.walkAtRules('media', (a) => {
    const m = /^\(min-width:\s*(\d+)px\)$/.exec(norm(a.params));
    if (m && rulesFor('.lower', (p) => p === a.params).length > 0) hits.push(Number(m[1]));
  });
  assert.equal(hits.length, 1, 'the thumb row’s tablet boundary is not in this module');
  return hits[0]!;
})();
const isPhone = (params: string) => {
  const m = /^\(max-width:\s*(\d+)px\)$/.exec(norm(params));
  return m !== null && Number(m[1]) + 1 === TABLET_MIN;
};

test('the boundary is the shipped tablet/desktop one (701)', () => {
  assert.equal(TABLET_MIN, 701);
});

test('PLACEMENT: avatar, name and buttons auto-place into ONE grid row (simulated)', () => {
  // The row's children, in DOM order, as written in GuestRowLine.
  const ava = ROW.indexOf('className={styles.ava}');
  const who = ROW.indexOf('className={styles.who}');
  const acts = ROW.indexOf('className={styles.acts}');
  assert.ok(ava > 0 && who > ava && acts > who, 'the row is no longer avatar → name → buttons');
  // The buttons are a SIBLING of the name's button, not inside it: the name's button closes before they open.
  const whoClose = ROW.indexOf('</button>', who);
  assert.ok(whoClose > who && whoClose < acts, 'the buttons sit inside the name’s button — a new line, and a button in a button');

  const g = decls(rulesFor('.g'));
  assert.equal(g['display'], 'grid');
  const cols = tracks(g['grid-template-columns'] ?? '');
  const colOf = (cls: string): number | null => {
    const d = { ...decls(rulesFor(`.${cls}`)), ...decls(rulesFor(`.g .${cls}`)) };
    assert.equal(d['grid-row'], undefined, `.${cls} pins its own grid row`);
    const v = d['grid-column'];
    return v === undefined ? null : Number(v);
  };
  // Sparse row-major auto-placement (CSS Grid §8.5) for items with at most a column position.
  let row = 1;
  let cursor = 1;
  const placed: Record<string, number> = {};
  for (const cls of ['ava', 'who', 'acts']) {
    const c = colOf(cls);
    if (c !== null) {
      assert.ok(Number.isInteger(c) && c >= 1, `.${cls}: grid-column ${c} is not a line this guard can place`);
      if (c < cursor) row += 1;
      cursor = c;
    } else if (cursor > cols.length) {
      row += 1;
      cursor = 1;
    }
    placed[cls] = row;
    cursor += 1;
  }
  assert.deepEqual(placed, { ava: 1, who: 1, acts: 1 }, `the buttons fall to grid row ${placed['acts']} — under the name, two lines per guest`);
  assert.ok(cursor - 1 <= cols.length, `the buttons are placed past the ${cols.length} declared tracks (an implicit column)`);
  assert.equal(g['align-items'], 'center', 'the buttons are not centred on the row');
  assert.equal(decls(rulesFor('.g .acts'))['margin-top'], undefined, 'the buttons keep a second line’s top margin');
});

test('THE NAME GIVES WAY: its track can shrink to 0, the buttons’ cannot, and the name is one line with an ellipsis', () => {
  const cols = tracks(decls(rulesFor('.g'))['grid-template-columns'] ?? '');
  assert.equal(cols.length, 3, `the row has ${cols.length} tracks — avatar · name · buttons is three`);
  assert.match(cols[1]!, /^minmax\(0, ?[\d.]+fr\)$/, 'the name’s track has a floor — it would push the buttons out instead of truncating');
  assert.equal(cols[2], 'auto', 'the buttons’ track is not sized to the buttons');
  assert.equal(decls(rulesFor('.who'))['min-width'], '0', 'the name’s button cannot shrink below its text');
  const nm = decls(rulesFor('.nm'));
  assert.equal(nm['flex-wrap'], 'nowrap', 'the name line wraps — it grows a second line instead of truncating');
  assert.equal(nm['min-width'], '0');
  const nmt = decls(rulesFor('.nmt'));
  assert.equal(nmt['white-space'], 'nowrap');
  assert.equal(nmt['overflow'], 'hidden');
  assert.equal(nmt['text-overflow'], 'ellipsis');
  assert.equal(nmt['min-width'], '0');
  const nameSpan = ROW.indexOf('className={styles.nmt}');
  assert.ok(nameSpan > 0, 'the name is not inside the truncating span');
  assert.ok(/className=\{styles\.nmt\}[^>]*>\s*\{name\}/.test(ROW), 'the truncating span does not hold the name');
});

test('PHONE: under 701 every guest-row button is a ≥ 44 × 44 icon, and the rule wins over the group states', () => {
  const ab = rulesFor('.g .acts :global(.ab)', isPhone);
  assert.ok(ab.length > 0, 'no phone rule for a guest row’s buttons (under the 701 boundary)');
  const d = decls(ab);
  const px = (v: string | undefined) => (v && /^\d+(\.\d+)?px$/.test(v) ? Number.parseFloat(v) : NaN);
  assert.ok(px(d['width']) >= 44, `phone button width ${d['width']} — a target under 44 px`);
  assert.ok(px(d['height']) >= 44, `phone button height ${d['height']} — a target under 44 px`);
  assert.ok(px(d['min-height']) >= 44, `phone min-height ${d['min-height']} — the icon state’s 0 would win`);
  assert.equal(d['padding'], '0');
  assert.equal(decls(rulesFor('.g .acts :global(.ab .lbl)', isPhone))['display'], 'none', 'the words still show on a phone');
  assert.equal(decls(rulesFor('.g .acts :global(.ab) svg', isPhone))['display'], 'inline-block', 'the word-only state would hide the icons — a blank button');
  // Equal weight (0,3,0 / 0,3,1) → source order decides: the phone rules must come after the group-state rules.
  const last = (sel: string) => Math.max(...rulesFor(sel).map((r) => r.source?.start?.offset ?? -1));
  const phoneAt = Math.min(...ab.map((r) => r.source?.start?.offset ?? Infinity));
  for (const sel of ["[data-row-state='icon'] .acts :global(.ab)", "[data-row-state='text'] .acts :global(.ab) svg", "[data-row-state='icon'] .acts :global(.ab)::after"]) {
    assert.ok(last(sel) >= 0, `${sel} is gone — re-check what the phone rule must beat`);
    assert.ok(phoneAt > last(sel), `the phone rule comes before ${sel} — the group state wins and the button is 40 px / blank`);
  }
});

test('WIDE: from 701 nothing hides a guest row’s words', () => {
  ROOT.walkRules((r) => {
    if (!r.selectors.some((s) => /\.g\b.*\.lbl/.test(s))) return;
    const parent = r.parent as postcss.AtRule | undefined;
    assert.ok(parent?.type === 'atrule' && isPhone(parent.params), `${r.selector} hides a guest row’s words outside the phone width`);
  });
});

test('every row button is named for its guest — an icon-only list is not forty identical “Edit”s', () => {
  const acts = ROW.slice(ROW.indexOf('className={styles.acts}'));
  const buttons = acts.slice(0, acts.indexOf('</span>')).match(/<ActionButton\b[\s\S]*?\/>/g) ?? [];
  assert.ok(buttons.length >= 2, `found ${buttons.length} row buttons — Edit and Remove at least`);
  for (const b of buttons) {
    const label = /label="([^"]+)"/.exec(b)?.[1];
    assert.ok(label, `a row button without a word: ${b}`);
    assert.ok(b.includes(`name={\`${label} \${name}\`}`), `“${label}” is not named for its guest (aria-label "${label} <name>")`);
  }
  assert.ok(buttons.some((b) => b.includes('label="Edit"')) && buttons.some((b) => b.includes('label="Remove"')));
});
