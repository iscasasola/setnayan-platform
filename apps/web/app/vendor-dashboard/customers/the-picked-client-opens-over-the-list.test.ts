/**
 * 🗂 THE PICKED CLIENT OPENS OVER THE STILL-MOUNTED LIST — and closes as the exact reverse
 * (THE ONE BUILD, 8 Nov 2026 · B1 step 5 · spec §0.6 motion · §10 #23 layers).
 *
 *   1. ONE intercepting slot: `customers/layout.tsx` draws the list AND the `client` slot; the slot's default draws
 *      nothing; `@client/(..)clients/[eventId]/page.tsx` only RE-EXPORTS the client page — there is no second body,
 *      so the two addresses can never draw two different clients.
 *   2. The shell is a pop-up layer: portaled onto <body>, its z-index is the `--sn-z-pop` token (never a raw number),
 *      it is a modal dialog, and Esc / ✕ close it.
 *   3. Motion: one helper (`pickedMotion`) gives the open's frames + timing — 520 ms on the shared ease, a 120 ms
 *      fade under reduced motion, nothing on a hard load — and the close plays the SAME frames with
 *      `direction: 'reverse'`, so it is the exact reverse by construction.
 *   4. A page switch costs no request: `history.replaceState(?tab=)`, never a router push.
 *
 * SABOTAGE (done once, 8 Nov): `zIndex: 50` → test 2 RED; close with its own keyframes and no `direction: 'reverse'`
 * → test 3 RED; `router.replace(` for a page switch → test 4 RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../../../lib/strip-comments';
import {
  PICKED_EASE,
  PICKED_FADE_MS,
  PICKED_OPEN_MS,
  PICKED_PAGE_SLIDE_EASE,
  PICKED_PAGE_SLIDE_MS,
} from '../clients/[eventId]/_components/picked-client-motion';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const SHELL = '../clients/[eventId]/_components/picked-client-shell.tsx';
const MOTION = '../clients/[eventId]/_components/picked-client-motion.ts';

test('1 · one intercepting slot over the list, re-exporting the ONE client page', () => {
  const layout = read('layout.tsx');
  assert.match(layout, /\{ children, client \}/, 'the layout must take the `client` slot');
  assert.match(layout, /\{children\}\s*\{client\}/, 'the client is drawn AFTER (over) the list, which stays mounted');
  assert.match(read('@client/default.tsx'), /return null;/, 'no client picked → nothing over the list');
  const intercept = read('@client/(..)clients/[eventId]/page.tsx').trim();
  assert.equal(
    intercept,
    "export { default } from '../../../../clients/[eventId]/page';",
    'the intercept must only re-export the client page — never a second body',
  );
});

test('2 · a pop-up layer: portaled to <body>, the --sn-z-pop token, a modal dialog, Esc closes', () => {
  const shell = read(SHELL);
  assert.match(shell, /createPortal\(screen, host\)/, 'portaled onto <body> so no page stacking context traps it');
  assert.match(shell, /zIndex: 'var\(--sn-z-pop\)'/, 'the pop-up layer is the token (integration: no fallback once foundation defines it)');
  assert.doesNotMatch(shell, /zIndex:\s*\d/, 'a raw z-index number — use the layer tokens (§10 #23)');
  assert.doesNotMatch(shell, /className="[^"]*\bz-\d/, 'a raw z-* class — use the layer tokens (§10 #23)');
  assert.match(shell, /role="dialog"/);
  assert.match(shell, /aria-modal="true"/);
  assert.match(shell, /e\.key === 'Escape'[^\n]*close\(\)/, 'Esc must close');
  assert.match(shell, /data-testid="picked-close"/, 'the ✕ is the one close');
});

test('3 · the close is the open played backwards', () => {
  assert.equal(PICKED_OPEN_MS, 520);
  assert.match(read(MOTION), /PICKED_OPEN_MS = RISE_MS;/, 'the picked client keeps its own copy of the rise again');
  assert.equal(PICKED_FADE_MS, 120);
  assert.equal(PICKED_PAGE_SLIDE_MS, 700, '§10 #26: the page slide is 0.7 s');
  assert.equal(PICKED_PAGE_SLIDE_EASE, 'cubic-bezier(.33,1,.68,1)');
  assert.equal(PICKED_EASE, 'cubic-bezier(.2,.8,.2,1)');
  const motion = read(MOTION);
  assert.match(motion, /export function pickedMotion\(/);
  const shell = read(SHELL);
  assert.equal((shell.match(/pickedMotion\(/g) ?? []).length, 2, 'open and close must both come from pickedMotion');
  assert.match(shell, /if \(m\) el\.animate\(m\.frames, m\.timing\);/, 'the open plays the frames forwards');
  assert.match(
    shell,
    /el\.animate\(m\.frames, \{ \.\.\.m\.timing, direction: 'reverse', fill: 'forwards' \}\)/,
    'the close plays the SAME frames backwards',
  );
  assert.equal((shell.match(/clipPath/g) ?? []).length, 0, 'the shell drew its own frames — they belong to pickedMotion');
});

test('4 · a page switch costs no request', () => {
  const shell = read(SHELL);
  const select = shell.slice(shell.indexOf('const select = useCallback('), shell.indexOf('const close = useCallback('));
  assert.match(select, /window\.history\.replaceState\(/);
  assert.doesNotMatch(select, /router\.(push|replace|refresh)\(/, 'a page switch must not go to the server');
  // §10 #26: the PAGE slides 44 px (never the scroller), the scroller hides x-overflow, and no scrollIntoView anywhere.
  assert.match(select, /querySelector<HTMLElement>\('#picked-page'\)/);
  assert.match(select, /translateX\(44px\)/);
  assert.match(select, /\{ opacity: 1, offset: 0\.45 \}/);
  assert.match(shell, /data-picked-body[^>]*|overflow-x-hidden[^"]*data-picked-body/);
  assert.match(shell, /overflow-x-hidden overscroll-contain \[overscroll-behavior-x:none\]/);
  assert.equal((shell.match(/scrollIntoView\(/g) ?? []).length, 1, 'only the Script fold may scrollIntoView (vertical, on open)');
});
