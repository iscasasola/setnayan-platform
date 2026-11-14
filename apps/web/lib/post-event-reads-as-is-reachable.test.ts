/**
 * post-event-reads-as-is-reachable.test.ts — POST EVENT'S "READS AS" IS DRAWN WHERE A COUPLE CAN SEE IT.
 *
 * F-W2-43 (the live phone-width walk after PR #7596): "Reads as · Story/Page" and "Peek now" were drawn as a row of the
 * OLD scenes column (`<nav aria-label="Scenes">` in `editor-shell.tsx`). The new Maker never shows that column: it
 * is `max-lg:hidden` on a phone (its tiles portal into a navigator slot the stage toolbar leaves hidden) and
 * `display:none!important` on a desktop (`maker-desk.tsx`). The controls were in the DOM and unreachable at 390,
 * 1280 and 1600 px — the Story↔Page switch could not be pressed at all. Measured in the dev Maker lab before the fix:
 * the row's nearest hidden ancestor was the lower third's slot (390) and the Scenes nav (1280).
 *
 * The controls are now registered with the Maker (`setPostEventStory`) and drawn by the stage toolbar — the lower
 * third on a phone, the tools column on a desktop — under "Tap a part of the page to edit it." This guard holds:
 *
 *   (1) the work area never draws them inside the Scenes nav again, and registers them instead;
 *   (2) the toolbar draws them in the nothing-picked rows, on Post Event only, and EVERY element from the toolbar's
 *       root down to the slot wears no hidden class or `hidden` attribute (the ancestor chain is read from source);
 *   (3) no rule set in the Maker hides the slot or the rows that hold it.
 *
 * Mutations seen RED (2026-11-13), each restored: the `<PostEventStoryControls` moved back into the Scenes nav → (1);
 * `hidden` added to the slot's class → (2); `max-lg:hidden` on the toolbar's rows (`data-stage-rows`) → (2);
 * `[data-stage-post-event-story]{display:none}` added to the desk rule set → (3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SHELL = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
const TOOLS = read('app/dashboard/[eventId]/launch/_components/stage-tools.tsx');
const DESK = read('app/dashboard/[eventId]/launch/_components/maker-desk.tsx');
const STAGE_DESK = read('app/dashboard/[eventId]/launch/_components/stage-panel/desk.tsx');
const LOWER_THIRD = read('app/dashboard/[eventId]/launch/_components/maker-lower-third.tsx');
const GLOBALS = readFileSync(join(WEB, 'app/globals.css'), 'utf8');

const SLOT = 'data-stage-post-event-story=""';

/** A class list (or class expression) that hides at some width: `hidden`, `max-lg:hidden`, `lg:hidden`, `sr-only`. */
const HIDES = /(?:^|[\s'"`{:])(?:[a-z0-9-]+:)*(?:hidden|sr-only|invisible)(?=[\s'"`}]|$)/;

/**
 * The JSX elements that ENCLOSE `at` in `src`, outermost first — each opening tag's text. A light reader of the
 * source: tags are `<Name …>` / `</Name>` / `<Name … />`, attribute values in braces may hold `>` (arrows), so the
 * reader balances braces inside a tag. Enough for one function's JSX; not a TSX parser.
 */
function enclosingTags(src: string, from: number, at: number): string[] {
  const stack: { name: string; text: string }[] = [];
  let i = from;
  while (i < at) {
    const lt = src.indexOf('<', i);
    if (lt < 0 || lt >= at) break;
    const m = /^<(\/?)([A-Za-z][\w.]*)/.exec(src.slice(lt, lt + 80));
    if (!m) {
      i = lt + 1;
      continue;
    }
    /* Walk to the tag's end, balancing braces and skipping strings. */
    let j = lt + m[0].length;
    let depth = 0;
    let quote: string | null = null;
    for (; j < src.length; j++) {
      const c = src[j]!;
      if (quote) {
        if (c === quote && src[j - 1] !== '\\') quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    const text = src.slice(lt, j + 1);
    if (m[1]) {
      const k = stack.map((s) => s.name).lastIndexOf(m[2]!);
      if (k >= 0) stack.length = k;
    } else if (!text.endsWith('/>')) {
      stack.push({ name: m[2]!, text });
    }
    i = j + 1;
  }
  return stack.map((s) => s.text);
}

test('(1) the work area registers Reads as with the Maker — never inside the Scenes nav no width shows', () => {
  const navAt = SHELL.indexOf('aria-label="Scenes"');
  assert.ok(navAt > 0, 'anti-vacuity: the Scenes nav was not found in editor-shell.tsx');
  const navEnd = SHELL.indexOf('</nav>', navAt);
  assert.ok(navEnd > navAt);
  assert.doesNotMatch(SHELL.slice(navAt, navEnd), /<PostEventStoryControls\b/, 'Reads as is drawn in the Scenes column again — hidden at every width (F-W2-43)');
  assert.match(SHELL, /setPostEventStory\?\.\(\s*storyPostEvent && storyDraftAction \? \(\s*<PostEventStoryControls\b/, 'the work area no longer registers Reads as with the Maker');
});

test('(2) the stage toolbar draws Reads as on Post Event, under the nothing-picked line, with no hidden ancestor', () => {
  const start = TOOLS.indexOf('export function StageTools(');
  const ret = TOOLS.indexOf('\n  return (', start);
  const at = TOOLS.indexOf(SLOT, ret);
  assert.ok(start > 0 && ret > start && at > ret, 'anti-vacuity: the Post Event story slot is not in StageTools’ render');
  const near = TOOLS.slice(at - 200, at + 300);
  assert.match(near, /stage === 'editorial' && !rsvpOpen && maker\?\.postEventStory/, 'the slot is not gated to Post Event');
  assert.match(near, /\{maker\.postEventStory\}/, 'the slot does not draw the registered controls');
  const chain = enclosingTags(TOOLS, ret, at);
  assert.ok(chain.length >= 3, `anti-vacuity: only ${chain.length} enclosing elements were read`);
  assert.ok(chain.some((t) => /data-stage-nothing-picked/.test(t)), 'the slot is not in the nothing-picked rows');
  assert.ok(chain.some((t) => /data-stage-rows/.test(t)), 'the slot is not in the toolbar’s rows');
  const slotTag = TOOLS.slice(TOOLS.lastIndexOf('<', at), TOOLS.indexOf('>', at) + 1);
  for (const tag of [...chain, slotTag]) {
    const cls = /className=(\{`[^`]*`\}|"[^"]*"|\{[^}]*\})/.exec(tag)?.[1] ?? '';
    assert.doesNotMatch(cls, HIDES, `an ancestor of Reads as hides it: ${tag.slice(0, 160)}`);
    assert.doesNotMatch(tag, /\shidden(?:=|\s|>)/, `an ancestor of Reads as carries the hidden attribute: ${tag.slice(0, 160)}`);
  }
});

test('(3) no rule set in the Maker hides the slot or the rows that hold it', () => {
  const markers = ['data-stage-post-event-story', 'data-stage-nothing-picked', 'data-stage-rows', 'data-post-event-story-controls'];
  for (const [name, css] of Object.entries({ 'maker-desk.tsx': DESK, 'stage-panel/desk.tsx': STAGE_DESK, 'maker-lower-third.tsx': LOWER_THIRD, 'globals.css': GLOBALS })) {
    for (const rule of css.split('}')) {
      const [sel, body] = rule.split('{');
      if (!sel || !body) continue;
      if (!markers.some((m) => sel.includes(`[${m}]`))) continue;
      assert.doesNotMatch(body, /display\s*:\s*none|visibility\s*:\s*hidden/, `${name} hides Post Event’s Reads as: ${sel.trim().slice(-160)}`);
    }
  }
});
