/**
 * THE EVENT HUB HAS NO "ADD TO HOME SCREEN" CARD — owner, 2026-09-30, pointing
 * at the "Keep it with you · Put Indalecio & Claire on your home screen" card on
 * the guest page: "remove this part on the website".
 *
 * The property, executed against every guest-page source under app/[slug]
 * (comments stripped, so the note explaining the removal is not a match):
 *   1. nothing there listens for the browser's install prompt;
 *   2. nothing there tells a guest about a home screen.
 *
 * What stays, deliberately: the per-event manifest and the couple's icon
 * (their-wedding-on-your-home-screen.test.ts). Installing from the browser's own
 * menu still gets the couple's tile — the page just no longer teaches it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const SLUG = join(WEB, 'app', '[slug]');

const INSTALL_PROMPT = /beforeinstallprompt/;
const HOME_SCREEN_COPY = /home[\s-]*screen/i;

function guestSources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) guestSources(full, out);
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

test('the removed card’s own heading is what this guard catches (it can hit)', () => {
  // The exact JSX that shipped, so the pattern is proven against the real defect.
  const removed = '<h3>Put {coupleName} on your home screen</h3>';
  assert.match(removed, HOME_SCREEN_COPY);
  assert.match("window.addEventListener('beforeinstallprompt', onPrompt);", INSTALL_PROMPT);
});

/**
 * ⚖ THE ONE EXCEPTION, BY RULING — DECISION_LOG 2026-10-03 "GUESTS GET ONE QUIET
 * 'SHORTCUT TO THIS EVENT' LINE, ONLY AFTER THEY REPLY": the guest's thank-you
 * screen (`/invite/enter` after a Yes) carries ONE line, steps behind a tap,
 * no popup, no install prompt. Named by FILE so no other guest page can borrow
 * it; `the-shortcut-line-is-on-the-thank-you-only.test.ts` renders that it
 * shows on that screen and nowhere else on it.
 */
const THANK_YOU = new Set([
  join('app', '[slug]', 'invite', 'enter', 'page.tsx'),
  join('app', '[slug]', 'invite', '_components', 'shortcut-line.tsx'),
]);

test('no guest-page source teaches installing to the home screen', () => {
  const files = guestSources(SLUG);
  assert.ok(files.length > 50, `precondition: scanned the guest tree (${files.length} files)`);
  const offenders: string[] = [];
  for (const f of files) {
    if (THANK_YOU.has(f.slice(WEB.length + 1))) {
      // The exception still never PROMPTS an install.
      assert.doesNotMatch(stripComments(readFileSync(f, 'utf8')), INSTALL_PROMPT, 'the thank-you prompts an install');
      continue;
    }
    const src = stripComments(readFileSync(f, 'utf8'));
    if (INSTALL_PROMPT.test(src) || HOME_SCREEN_COPY.test(src)) offenders.push(f.slice(WEB.length + 1));
  }
  assert.deepEqual(offenders, [], `a home-screen card is back on the Event Hub: ${offenders.join(', ')}`);
});

test('the card’s component is gone, not merely unmounted', () => {
  assert.equal(existsSync(join(SLUG, '_components', 'keep-on-home-screen.tsx')), false);
});
