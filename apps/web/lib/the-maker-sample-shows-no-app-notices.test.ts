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

/* ══ 4 · EVERY PAGE THE MAKER'S CANVAS CAN DRAW ═══════════════════════════════════════════════════════════════════
   Controller, 2026-10-10: "a page drawn inside the Maker's canvas never shows the cookie card, for any stage." The
   Event Hub's canvas carried the rule (2); the two reply pages the RSVP stage draws did not — a host who had never
   answered the cookie card saw it lying over the RSVP stage's canvas. Held as a claim about EVERY guest route that
   answers the canvas door, so a page added later cannot forget it. Sabotage: the rule off the reply page → red. */
test('(4) every guest page that can be the Maker’s canvas hides the app’s notices there — and only there', () => {
  const { readdirSync } = require('node:fs') as typeof import('node:fs');
  const pages: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${dir}/${e.name}`);
      else if (e.name === 'page.tsx') pages.push(`${dir}/${e.name}`);
    }
  };
  walk('app/[slug]');
  const canvases = pages.filter((p) => /\basksForHostCanvas\(/.test(read(p)));
  /* The door is asked by these three today; the list is read off the tree, and must not come back empty. */
  assert.deepEqual([...canvases].sort(), ['app/[slug]/invite/enter/page.tsx', 'app/[slug]/invite/reply/page.tsx', 'app/[slug]/page.tsx']);
  for (const p of canvases) {
    const page = read(p);
    const own = /\{canvas \? <style>\{EDITOR_CANVAS_HIDES_APP_CHROME\}<\/style> : null\}/.test(page);
    /* The Event Hub's page hands its canvas to `SiteBody`, which carries the rule (2). */
    const handed = /<SiteBody\b/.test(page);
    assert.ok(own || handed, `${p} can be the Maker’s canvas and would draw the cookie card over it`);
    if (own) {
      assert.match(page, /import \{ EDITOR_CANVAS_HIDES_APP_CHROME, asksForHostCanvas \} from '\.\.\/\.\.\/_lib\/editor-canvas';/, `${p} wrote a copy of the rule`);
      assert.equal((page.match(/EDITOR_CANVAS_HIDES_APP_CHROME/g) ?? []).length, 2, `${p}: the rule is written somewhere a guest’s page could reach`);
      /* `canvas` is the HOST-VERIFIED door — never the bare `?editor=1` a stranger can type. */
      assert.match(page, /if \(asksForHostCanvas\(search\)\) \{[\s\S]{0,400}?loadHostMembership\([\s\S]{0,200}?canvas = true;/, `${p}: the canvas is not host-verified`);
    }
  }
});
