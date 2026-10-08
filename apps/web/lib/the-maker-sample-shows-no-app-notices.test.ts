/**
 * the-maker-sample-shows-no-app-notices.test.ts — THE GUEST PAGE INSIDE THE MAKER'S SAMPLE FRAME DRAWS NONE OF THE
 * APP'S FLOATING NOTICES (the cookie consent, the stale-tab bar): the host answers them on the Maker's own page, once.
 *
 * Seen on the review copy, 2026-10-09: "We use essential cookies…" lay over the foot of the sample in the Maker lab.
 * The REAL canvas has always hidden it (`app/[slug]/_components/site-body.tsx`: the notices wear `data-app-chrome`
 * and the host's canvas hides that one attribute); the lab's stand-in guest page did not, so the review copy showed
 * what the real Maker never does.
 *
 *   (1) the notice wears the mark, and the rule hides exactly that mark;
 *   (2) the real canvas writes the rule — for the host's canvas only, so a guest's page is unchanged;
 *   (3) the lab's stand-in writes the SAME rule (the constant, never a copy). Sabotage: the line removed → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { EDITOR_CANVAS_HIDES_APP_CHROME } from '../app/[slug]/_lib/editor-canvas';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('(1) the cookie notice wears the one mark the canvas hides', () => {
  assert.equal(EDITOR_CANVAS_HIDES_APP_CHROME, '[data-app-chrome]{display:none!important}');
  const banner = read('app/_components/cookie-consent-banner.tsx');
  const at = banner.indexOf('aria-label="Cookie consent"');
  assert.ok(at > 0, 'the cookie notice was not found');
  assert.match(banner.slice(at - 120, at), /data-app-chrome=""/, 'the cookie notice lost the mark — the canvas would draw it');
});

test('(2) the real canvas hides it — on the host’s canvas only, never on a guest’s page', () => {
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /\{isEditorCanvas \? <style>\{EDITOR_CANVAS_HIDES_APP_CHROME\}<\/style> : null\}/);
  assert.equal((body.match(/EDITOR_CANVAS_HIDES_APP_CHROME/g) ?? []).length, 2, 'the rule is written somewhere a guest’s page could reach');
});

test('(3) the lab’s stand-in for the canvas hides it the same way', () => {
  const lab = read('app/dev/maker-lab/guest/page.tsx');
  assert.match(lab, /import \{ EDITOR_CANVAS_HIDES_APP_CHROME, [^}]*\} from '@\/app\/\[slug\]\/_lib\/editor-canvas';/);
  assert.match(lab, /<style>\{EDITOR_CANVAS_HIDES_APP_CHROME\}<\/style>/, 'the lab’s sample draws the app’s notices — the real Maker’s never does');
  assert.doesNotMatch(lab, /\[data-app-chrome\]\{/, 'the lab wrote a copy of the rule');
});
