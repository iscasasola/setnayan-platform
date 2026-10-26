import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Owner 2026-10-26: "I opened a user and now im stuck on her account" — People opens /u/<slug> and the page
   drew no way back; inside the installed app there is no browser bar. */
const page = readFileSync(join(process.cwd(), 'app/u/[userSlug]/page.tsx'), 'utf8');
const back = readFileSync(join(process.cwd(), 'app/u/_components/profile-back.tsx'), 'utf8');

test('the person page draws the way back above its header', () => {
  const inner = page.indexOf('<div className="uprof-inner">');
  const head = page.indexOf('<header className="uprof-head">');
  const at = page.indexOf('<ProfileBack />');
  assert.ok(inner > -1 && head > -1, 'the page lost its inner wrapper or header');
  assert.ok(at > inner && at < head, 'ProfileBack must sit inside the page, above the header');
});

test('the way back goes to People, through the one shared back button', () => {
  assert.match(back, /<BackButton\s+href="\/dashboard\/people"/);
  assert.match(back, /from '@\/app\/_components\/back-button'/);
});

test('only a signed-in viewer sees it — a stranger on a shared link does not', () => {
  assert.match(back, /if \(!signedIn\) return null/);
  assert.match(back, /auth\.getSession\(\)/);
});
