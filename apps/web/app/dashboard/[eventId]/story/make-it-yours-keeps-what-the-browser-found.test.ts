/**
 * "MAKE IT YOURS" KEEPS WHAT THE BROWSER FOUND (`10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md` steps 4 and 6).
 *
 * Each rule below was found by DRIVING the editor in a real browser — the prototype's rounds 1
 * and 3 (`10a_MAKE_IT_YOURS_TEST_PLAN_2026-09-10.md`) and this port's own Playwright drive at 1280
 * mouse and 390 touch — and none of them can be seen by reading a diff. The drive proves the
 * behaviour; it needs a browser, so it is not in CI.
 *
 * ── WHAT THIS GUARD CLAIMS, EXACTLY ────────────────────────────────────────────────────────────
 * That the LINE each behaviour depends on is still in the shipped source — so a tidy-up that
 * deletes one fails here instead of in front of a host. It does not re-prove the behaviour; the
 * pure moves have their own tests (`lib/make-it-yours.test.ts`). Source is read through the repo's
 * one comment stripper, so a rule that survives only as a comment describing it is MISSING.
 *
 * Sabotage-checked: each rule was removed on its own and this file failed naming it; restored,
 * it passes. The count is printed on every run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const tsx = stripComments(readFileSync(join(HERE, '_components', 'make-it-yours.tsx'), 'utf8'));
const css = stripComments(readFileSync(join(HERE, '_components', 'make-it-yours.module.css'), 'utf8'));

const RULES: Array<{ rule: string; holds: boolean }> = [
  {
    // prompt/confirm return nothing in a frame that forbids them; five buttons silently did nothing.
    rule: 'no browser pop-up anywhere (no prompt, confirm or alert)',
    holds: !/\b(?:window\.)?(?:prompt|confirm|alert)\s*\(/.test(tsx),
  },
  {
    // A disabled button swallows the press, so it can never say why it refused.
    rule: 'aria-disabled, never a plain `disabled`',
    holds: !/(?<![\w-])disabled\s*[={]/.test(tsx) && /aria-disabled=\{/.test(tsx),
  },
  {
    // Spread over a neighbour, an invisible tap area on the × took off the wrong photo (round 3).
    rule: 'the × has no invisible halo',
    holds: !/\.x\b[^{]*::(?:after|before)/.test(css),
  },
  {
    // The owner could not find the × on a photo, and a hover-only × vanished on the way to it.
    rule: 'the × on a photo is always showing, and counter-scaled',
    holds: /\.x\s*\{[^}]*display:\s*grid[^}]*transform:\s*scale\(var\(--inv/.test(css),
  },
  {
    // Found by this port's drive at 390: an older save said "Saved" while a drag still waited.
    rule: '"Saved" only when no newer change is waiting',
    holds: /if \(saveTimer\.current\) return;\s*setSaveState\('saved'\)/.test(tsx),
  },
  {
    // An unreadable pool looks exactly like a day with no photos; saving it empties every page.
    rule: 'nothing is saved while a source was unreadable, or after another tab won',
    holds: /const flush = useCallback\(async \(\) => \{[\s\S]{0,200}if \(unreadable \|\| conflictRef\.current\) return;/.test(tsx),
  },
  {
    // A tap whose finger drifts 3px is still a tap (10a DW-08).
    rule: 'a drag starts past 4px, or 10px for a finger',
    holds: /e\.pointerType === 'touch' \? 10 : 4/.test(tsx),
  },
  {
    // A held Delete removed every photo on the page (10a F3); a held Enter added a row (r3 R1).
    rule: 'a held key acts once',
    holds:
      /if \(e\.repeat\) return;/.test(tsx) &&
      /e\.repeat && \(e\.key === 'Enter' \|\| e\.key === ' '\)/.test(tsx),
  },
  {
    // A double tap added the NEXT photo, which slides under the finger (10a G1).
    rule: 'a double tap on the tray adds one photo',
    holds: /if \(performance\.now\(\) < trayQuietUntil\.current\) return;/.test(tsx),
  },
  {
    // The whole editor saves through step 3's one action, never a write of its own.
    rule: 'it saves through step 3’s action and saves what it shows',
    holds: /from '\.\.\/arrangement-actions'/.test(tsx) && /storedFromResolved\(stateRef\.current\)/.test(tsx),
  },

  /* ── STEP 6 — words, the toolbar, moments, sets ───────────────────────────────────────────── */
  {
    // Found by step 6's drive: React 19 re-applies inline HTML whenever its object is new, so a
    // fresh `{ __html }` per render wiped every letter as it was typed.
    rule: 'the words box draws its text ONCE, from one unchanging object',
    holds:
      /useState\(\(\) => \(\{ __html: toHtml\(o\.text\) \}\)\)/.test(tsx) &&
      /dangerouslySetInnerHTML=\{inner\}/.test(tsx) &&
      !/dangerouslySetInnerHTML=\{\{/.test(tsx),
  },
  {
    // Pasted bold, links or pictures showed while typing and vanished on the next read (critic-13).
    rule: 'a paste into words is plain text only',
    holds: /onPaste=\{\(e\) => \{\s*e\.preventDefault\(\);\s*const t = e\.clipboardData\.getData\('text\/plain'\)/.test(tsx),
  },
  {
    // A switch to another app blurs the field too; an emptied caption or a nameless new moment
    // was dropped for it (r3 critic, NOT RUN item).
    rule: 'leaving the window is not leaving the words or the name field',
    holds:
      /!document\.hasFocus\(\)\) return;\s*const el = objEl\(id\)/.test(tsx) &&
      /onBlur=\{\(e\) => \{\s*if \(!document\.hasFocus\(\)\) return;/.test(tsx),
  },
  {
    // On a phone a press on the grip reached the text beside it and became a caret (r3 R6).
    rule: 'a press on the words’ grip is a drag even when it lands on the text',
    holds: /e\.clientX <= grip\.getBoundingClientRect\(\)\.right \+ 4\) inText = false/.test(tsx),
  },
  {
    // Captured on a row, the pointer is lost the moment that row moves (prototype, grip reorder).
    rule: 'the grip reorder captures the pointer on the LIST',
    holds: /list\.setPointerCapture\(e\.pointerId\)/.test(tsx),
  },
  {
    // r3/critic OPEN: a moment row was role=button with a real button inside it.
    rule: 'no row is a button, and rows are list items',
    holds: !/role="button"/.test(tsx) && /role="listitem"/.test(tsx) && /role="list"/.test(tsx),
  },
  {
    // Owner 2026-09-10: nothing on the bar takes the caret out of the words.
    rule: 'the words toolbar never takes the caret',
    holds: /role="toolbar"[\s\S]{0,300}onPointerDown=\{\(e\) => e\.preventDefault\(\)\}/.test(tsx),
  },
  {
    // Found by step 6's drive: the bar above new words sat on the photo row and took a ×'s press.
    rule: 'the toolbar will not sit on another control when the other side is clear',
    holds: /const covers = \(top: number\)/.test(tsx) && /box\.left \+ 4/.test(tsx),
  },
  {
    // DW-17…22 · R7 · R8: something vanished mid-press and the page slid under the finger.
    rule: 'the layout holds still while a press that removed something lifts',
    holds:
      /freezeLayout\(\);\s*if \(selObjRef\.current === id\) selectObj\(null\);/.test(tsx) &&
      /if \(move\.ok\) \{\s*freezeLayout\(\);\s*commit\(\{ \.\.\.move\.state, handTouched/.test(tsx),
  },
  {
    // The prototype's open item: Tab from a still-empty new box lost the keyboard's place.
    rule: 'Tab out of an empty new box goes to the next control outside it',
    holds: /e\.key === 'Tab' && readText\(e\.currentTarget\)\.trim\(\) === ''/.test(tsx) && /function focusBeside\(/.test(tsx),
  },
  {
    // Found by step 6's drive: an Undo brought a cleared caption back at its empty box's size,
    // and Automatic dealt photos under it.
    rule: 'a caption is kept at the size it is drawn',
    holds: /for \(const job of jobs\) job\(\);\s*remeasure\(\);/.test(tsx) && /measureWords\(cur, world, m\.id, sizes\)/.test(tsx),
  },
  {
    // Owner-passed design call 5: on a phone, words get the toolbar instead of handles.
    rule: 'on a phone the handle and the words’ × give way to the toolbar',
    holds: /@media \(pointer: coarse\) \{\s*\.hdl,\s*\.obj\.tx \.x,[\s\S]{0,160}display: none !important;/.test(css),
  },
  {
    // Found in step 6's screenshots: the app's 44px button floor drew the × as a tall oval.
    rule: 'the × is the prototype’s circle, not the app’s 44px floor',
    holds: /\.x\s*\{[^}]*min-height:\s*0;/.test(css),
  },
  {
    // Found by step 8's LIVE drive at 1280×860: a refused tap's "why" was drawn below the screen,
    // because the editor's root (container-type) and the dashboard's `.sn-page-enter` (an identity
    // transform) each turn `position: fixed` into a box inside the page. The stand-in page had
    // neither. The hint is portalled to <body>, in a layer that carries the editor's tokens.
    rule: 'the hint is drawn on the screen, not inside the page (portalled to <body>)',
    holds:
      /createPortal\(\s*<div className=\{s\.layer\}>\s*<div\s+ref=\{hintRef\}\s+className=\{cx\(s\.hint,/.test(tsx) &&
      /\.root,\s*\.layer\s*\{\s*--paper:/.test(css),
  },
  {
    // ⛔ Owner 2026-09-10: no stickers, for now.
    rule: 'no stickers',
    holds: !/sticker/i.test(tsx),
  },
];

test('Make it yours keeps every rule a real browser found', () => {
  const missing = RULES.filter((r) => !r.holds).map((r) => r.rule);
  console.log(`# [make-it-yours] rules: ${RULES.length}, missing: ${missing.length}`);
  assert.deepEqual(missing, [], `missing from make-it-yours: ${missing.join(' · ')}`);
});
