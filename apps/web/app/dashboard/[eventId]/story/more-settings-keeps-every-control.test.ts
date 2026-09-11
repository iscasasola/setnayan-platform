/**
 * "MORE SETTINGS" KEEPS EVERY CONTROL — step 6 of `10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md`, found
 * live 2026-09-11: the Story Maker's "The story" step showed "Make it yours" and then, under it,
 * the whole older editor. The approved prototype shows only "Make it yours". So the older
 * editor's sections are folded — not deleted, renamed or re-ordered — under ONE closed disclosure
 * at the bottom of the step (owner ruling S6, 2026-09-09: nothing the shipped editor can do may
 * be lost).
 *
 * ── WHAT THIS GUARD CLAIMS, EXACTLY ────────────────────────────────────────────────────────────
 *  1. "Make it yours" opens the step; the fold comes after it, and the fold is CLOSED by default.
 *  2. Every one of the older sections is INSIDE the fold, in the order it always had.
 *  3. None escaped it — no section of the older editor still sits loose on the step.
 *  4. The fold is a `<details>`, so its fields stay mounted (a field typed into and then folded
 *     away still saves) and it opens from the keyboard.
 * The sections' own controls are held by `nothing-the-shipped-editor-could-do-is-lost.test.ts`
 * and by the lost-controls lint (`scripts/lint-port-no-lost-controls.mjs`); this file holds WHERE
 * they are. Source is read through the repo's one comment stripper, so a heading that survives
 * only in a comment is MISSING. The count is printed on every run.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const EDITOR = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'story', '_components', 'editorial-editor.tsx');
const src = stripComments(readFileSync(EDITOR, 'utf8'));

/** The older editor's sections, in the order the shipped editor had them. */
const SECTIONS = [
  'What goes in',
  'The words',
  'Your photos',
  'As the day unfolded',
  'Section order',
  'Your own columns',
  'What they said',
  'What shows',
] as const;

/** The story step's panel, from its opening to the theme step's. */
function storyPanel(): string {
  const start = src.indexOf("{...panel('story')}");
  const end = src.indexOf("{...panel('theme')}");
  assert.ok(start > 0 && end > start, 'the story step’s panel is not where it was');
  return src.slice(start, end);
}

/** The fold's own markup — from its `<details` to the `</details>` that closes IT, nesting counted. */
function fold(panel: string): { at: number; body: string; open: string } {
  const at = panel.indexOf('<details className={`group ${card}`} data-more-settings');
  assert.ok(at >= 0, 'the "More settings" fold is gone');
  let depth = 0;
  const re = /<details\b|<\/details>/g;
  re.lastIndex = at;
  for (let m = re.exec(panel); m; m = re.exec(panel)) {
    depth += m[0] === '</details>' ? -1 : 1;
    if (depth === 0) {
      const body = panel.slice(at, m.index);
      return { at, body, open: body.slice(0, body.indexOf('>') + 1) };
    }
  }
  assert.fail('the "More settings" fold is never closed');
}

const heading = (title: string) => new RegExp(`<h2[^>]*>\\s*${title}\\s*</h2>`);

test('"Make it yours" opens the step, and "More settings" is one CLOSED fold after it', () => {
  const panel = storyPanel();
  const f = fold(panel);
  const slot = panel.indexOf('{makeItYours}');
  assert.ok(slot >= 0, 'the "Make it yours" slot is gone from the story step');
  assert.ok(slot < f.at, '"Make it yours" must come first — the fold is at the bottom of the step');
  assert.ok(!/\bopen\b/.test(f.open), `the fold must be closed by default: ${f.open}`);
  assert.match(f.body, /<summary[^>]*className="[^"]*cursor-pointer[^"]*"[\s\S]*?More settings[\s\S]*?<\/summary>/);
});

test('every one of the older sections is INSIDE the fold, in the order it always had', () => {
  const { body } = fold(storyPanel());
  const found: string[] = [];
  const missing: string[] = [];
  let last = -1;
  const outOfOrder: string[] = [];
  for (const title of SECTIONS) {
    const m = heading(title).exec(body);
    if (!m) {
      missing.push(title);
      continue;
    }
    found.push(title);
    if (m.index < last) outOfOrder.push(title);
    last = m.index;
  }
  console.log(`# [more-settings] sections: ${SECTIONS.length}, inside the fold: ${found.length}, missing: ${missing.length}`);
  assert.deepEqual(missing, [], `no longer inside "More settings": ${missing.join(' · ')}`);
  assert.deepEqual(outOfOrder, [], `re-ordered inside "More settings": ${outOfOrder.join(' · ')}`);
});

test('nothing of the older editor sits loose on the step, outside the fold', () => {
  const panel = storyPanel();
  const f = fold(panel);
  const outside = panel.slice(0, f.at) + panel.slice(f.at + f.body.length);
  const loose = SECTIONS.filter((t) => heading(t).test(outside));
  assert.deepEqual(loose, [], `outside "More settings": ${loose.join(' · ')}`);
  assert.equal((outside.match(/<section\b/g) ?? []).length, 0, 'a section of the older editor sits outside the fold');
});
