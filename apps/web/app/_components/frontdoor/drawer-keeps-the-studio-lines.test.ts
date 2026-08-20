/**
 * drawer-keeps-the-studio-lines.test.ts — the phone drawer is 280px wide and
 * must show what each Studio product actually does.
 *
 * 🔴 WHAT THIS CAUGHT, LIVE. Every Studio row in the sidebar rendered as a dot
 * and a bare name — "Papic", "Live Studio", "3D Plan" — with the one-line
 * explanation of what each one does sitting in the served HTML, invisible.
 * Owner, looking at it: *"content of each got lost."*
 *
 * The cause is a revert list that forgot two entries. `.fd-toolline` and
 * `.fd-toolplay` are switched off at `max-width: 1279.98px` for the **72px icon
 * strip**, where they genuinely do not fit. The `max-width: 1023.98px` block
 * then turns the rail into a **280px drawer** and restores `.fd-label-text`,
 * `.fd-rlabel`, the sign-in prompt, the notice and the small print — but not
 * these two. So the drawer had room for the text and hid it anyway.
 *
 * 🔑 WHY A STRING GREP WOULD NOT HAVE HELD. The obvious guard — "the file
 * contains `.fd-toolline`" — was already true while the bug was live; the rule
 * hiding it IS that string. What matters is which rule WINS at a given
 * viewport, which is specificity plus source order. So this evaluates the
 * cascade rather than searching for text, and it is why the fix is written
 * `.fd-rail .fd-toolline` and not bare: the strip's `display: none` sits in a
 * LATER block in the same file, so at equal specificity a bare selector would
 * lose and change nothing on screen.
 *
 * 🪤 The first version of this evaluator glued CSS COMMENTS into selectors,
 * which inflated the dot count and corrupted every specificity comparison — it
 * reported the wide rail as hidden, which is false. Comments are stripped
 * before parsing, and that is load-bearing, not tidiness.
 *
 * ⚠ SCOPE: this reasons about the stylesheet, not about a rendered browser.
 * It proves which declaration wins; it cannot prove the pixels. The live
 * symptom is what established the bug in the first place.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `import.meta.url`, not `__dirname` — these run as ESM under tsx, matching
// one-top-bar.test.ts and one-main-per-page.test.ts in this same folder.
const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = join(HERE, 'front-door.css');

type Rule = { sel: string; media: string[]; body: string; order: number };

function parse(raw: string): Rule[] {
  // strip comments FIRST — see the trap note above
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Rule[] = [];
  const stack: string[] = [];
  let i = 0;
  let order = 0;
  let head = '';
  while (i < src.length) {
    const c = src[i];
    if (c === '{') {
      const h = head.trim();
      head = '';
      if (h.startsWith('@')) {
        stack.push(h);
        i += 1;
        continue;
      }
      let depth = 1;
      let j = i + 1;
      while (j < src.length && depth > 0) {
        if (src[j] === '{') depth += 1;
        else if (src[j] === '}') depth -= 1;
        j += 1;
      }
      out.push({ sel: h, media: [...stack], body: src.slice(i + 1, j - 1), order: (order += 1) });
      i = j;
      continue;
    }
    if (c === '}') {
      stack.pop();
      head = '';
      i += 1;
      continue;
    }
    head += c;
    i += 1;
  }
  return out;
}

function applies(media: string[], w: number): boolean {
  return media.every((m) => {
    if (!m.startsWith('@media')) return true;
    const mx = m.match(/max-width:\s*([\d.]+)px/);
    const mn = m.match(/min-width:\s*([\d.]+)px/);
    if (mx && w > parseFloat(mx[1])) return false;
    if (mn && w < parseFloat(mn[1])) return false;
    return true;
  });
}

const specificity = (s: string) => (s.match(/\./g) ?? []).length;

/** the winning `display` for a class at a viewport width, or null for default */
function winningDisplay(rules: Rule[], cls: string, w: number): string | null {
  let best: { sp: number; order: number; disp: string } | null = null;
  for (const r of rules) {
    if (!applies(r.media, w)) continue;
    const branches = r.sel.split(',').map((s) => s.trim()).filter((s) => s.endsWith(cls));
    if (branches.length === 0) continue;
    const disp = r.body.match(/display:\s*([^;}]+)/)?.[1];
    if (!disp) continue;
    const sp = Math.max(...branches.map(specificity));
    if (!best || sp > best.sp || (sp === best.sp && r.order > best.order)) {
      best = { sp, order: r.order, disp: disp.trim() };
    }
  }
  return best ? best.disp : null;
}

const visible = (d: string | null) => d === null || d !== 'none';

test('the 280px drawer shows what each Studio product does', () => {
  const rules = parse(readFileSync(CSS, 'utf8'));
  assert.ok(rules.length > 200, `expected to parse the whole stylesheet, got ${rules.length} rules`);

  const DRAWER = 800; // ≤1023.98px — the rail is a 280px off-canvas drawer

  for (const cls of ['.fd-toolline', '.fd-toolplay']) {
    assert.ok(
      visible(winningDisplay(rules, cls, DRAWER)),
      `${cls} is hidden in the 280px drawer. The rail restores .fd-label-text there but ` +
        `must restore this too, or every Studio row shows a bare name with no explanation. ` +
        `Write it as ".fd-rail ${cls}" — a bare selector loses to the icon strip's ` +
        `display:none, which sits in a later block of the same file.`,
    );
  }
});

test('the 72px icon strip still hides them, and the full rail still shows them', () => {
  const rules = parse(readFileSync(CSS, 'utf8'));

  // 1024–1279.98px: a 72px strip. There is no room; hiding is correct.
  for (const cls of ['.fd-toolline', '.fd-toolplay']) {
    assert.equal(
      winningDisplay(rules, cls, 1100),
      'none',
      `${cls} must stay hidden on the 72px icon strip — restoring it there would ` +
        `reflow the strip, which is what the original rule existed to prevent.`,
    );
  }

  // ≥1280px: the full 240px rail, where these lines have always shown.
  for (const cls of ['.fd-toolline', '.fd-toolplay']) {
    assert.ok(
      visible(winningDisplay(rules, cls, 1440)),
      `${cls} must remain visible on the full rail — this was never broken and a fix ` +
        `for the drawer must not cost it.`,
    );
  }
});
