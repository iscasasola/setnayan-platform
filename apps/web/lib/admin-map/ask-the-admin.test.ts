/**
 * ask-the-admin.test.ts — the assistant may only CHOOSE, and it may only be
 * reached last.
 *
 * Two properties matter more than any answer it gives:
 *   · it cannot offer an address the admin does not have — not from a model, not
 *     from a row learned months ago before a page moved; and
 *   · a phrase already learned never reaches a model again, which is the whole
 *     reason this gets cheaper with use rather than dearer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

import { buildDestinations } from '@/app/admin/_components/admin-destinations';

import { isKnownAdminHref, normalisePhrase, aiConfigured } from './ask-the-admin';
import { ADMIN_ROUTES } from './admin-routes.generated';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..');

test('an address the admin does not have is refused', () => {
  // A model improvising a URL, and a learned row whose page has since moved, are
  // the same failure with different ages. Both are refused here.
  assert.equal(isKnownAdminHref('/admin/taxonomy'), true);
  assert.equal(isKnownAdminHref('/admin/pricing?tab=pricing'), true);
  assert.equal(isKnownAdminHref('/admin/pricing?tab=pricing#sku-papic-guest'), true);
  assert.equal(isKnownAdminHref('/admin/a-page-that-never-existed'), false);
  assert.equal(isKnownAdminHref('/dashboard/anything'), false);
  assert.equal(isKnownAdminHref('https://example.com/admin'), false);
  // …and a page hidden behind a flag is still a real route, so it is allowed
  // when it is offered explicitly as a choice.
  assert.equal(
    isKnownAdminHref('/admin/live-studio-channels'),
    ADMIN_ROUTES.some((r) => r.path === '/admin/live-studio-channels'),
  );
});

test('the browser\'s list is IGNORED — the server rebuilds the truth itself', () => {
  // 🪤 THE OLD RULE TRUSTED A LIST THE BROWSER SENT, which is exactly what a
  // validator must not do, and the docblock beside it claimed the opposite. The
  // server now rebuilds the destination list with `buildDestinations()` — pure,
  // reading only generated constants — so the argument is inert.
  assert.equal(isKnownAdminHref('/admin/studio?tab=songs', []), true, 'a real tab was refused');
  assert.equal(
    isKnownAdminHref('https://evil.example', ['https://evil.example']),
    false,
    'a supplied list widened where this can send somebody',
  );
  assert.equal(
    isKnownAdminHref('/admin/not-a-page', ['/admin/not-a-page']),
    false,
    'a supplied list conjured an admin page that does not exist',
  );
});

test('the one menu destination outside /admin is reachable', () => {
  // 🪤 "My account" exists because the admin doorway had no other path to
  // changing a password or signing out other devices — and a bare `/admin`
  // prefix check threw it away every time the model picked it.
  const account = buildDestinations().find((d) => !d.href.startsWith('/admin'));
  assert.ok(account, 'no non-/admin destination in the menu — re-pin this test');
  assert.equal(
    isKnownAdminHref(account.href),
    true,
    `${account.label} (${account.href}) can never be offered`,
  );
});

test('the recall counter actually counts', () => {
  // 🪤 TWO BUGS IN ONE LINE. `void <builder>` never sends the request — a
  // PostgREST builder only fires when something calls .then() — and it assigned
  // the literal 1, so even had it run the count could never reach 2.
  const src = stripComments(readFileSync(join(WEB, 'lib/admin-map/ask-the-admin.ts'), 'utf8'));
  assert.ok(!/void admin\s*\n?\s*\.from\(/.test(src), 'the counter went back to a lazy builder');
  assert.match(src, /await admin[\s\S]{0,120}times_used: seen \+ 1/, 'the counter stopped incrementing');
  assert.match(src, /select\('href, label, times_used'\)/, 'the current count is no longer read');
});

test('the same question in different clothes is the same question', () => {
  assert.equal(normalisePhrase('  Where Are The   PRICES?  '), 'where are the prices?');
  assert.equal(normalisePhrase('papic  prices'), normalisePhrase('Papic Prices'));
});

test('remembering comes BEFORE asking — reversing them is a silent bill', () => {
  // 🔑 Both orders return the same answer, so nothing on screen would look
  // wrong; the only difference is that one of them pays a model for something
  // already written down. That is exactly the kind of regression no reviewer
  // catches, so it is pinned here by position.
  const src = stripComments(readFileSync(join(WEB, 'app/admin/_components/ask-actions.ts'), 'utf8'));
  const recall = src.indexOf('recallPhrase(');
  const model = src.indexOf('askTheModel(');
  assert.ok(recall > 0 && model > 0, 'the chain no longer calls both steps');
  assert.ok(recall < model, 'the model is now consulted before the memory — every repeat pays');
  assert.match(src, /if \(remembered\) return/, 'the memory no longer short-circuits');
});

test('the door is admin-gated, and the model is never reached from a browser', () => {
  const action = readFileSync(join(WEB, 'app/admin/_components/ask-actions.ts'), 'utf8');
  assert.match(action, /^'use server';/, 'the ask action stopped being server-side');
  assert.match(action, /await requireAdmin\(\)/, 'the ask action stopped checking for an admin');
  const palette = stripComments(
    readFileSync(join(WEB, 'app/admin/_components/admin-command-palette.tsx'), 'utf8'),
  );
  assert.ok(
    !palette.includes('@anthropic-ai/sdk'),
    'the palette imports the model SDK — that belongs on the server',
  );
});

test('the assistant is offered only when the free path has nothing', () => {
  const palette = stripComments(
    readFileSync(join(WEB, 'app/admin/_components/admin-command-palette.tsx'), 'utf8'),
  );
  const emptyBranch = palette.indexOf('hits.length === 0');
  const askButton = palette.indexOf('Ask Setnayan where this lives');
  assert.ok(emptyBranch > 0 && askButton > emptyBranch, 'the ask button escaped the empty branch');
  // 🪤 REV 1 OF THIS ASSERTION COULD NOT FIRE. It was /useEffect\([^)]*ask\(\)/,
  // which forbids a ')' between the two — and every real effect starts
  // `useEffect(() => {`, so the arrow's own bracket blocked the match. The
  // mutation `useEffect(() => { void ask(); }, [ask])` landed and the guard
  // stayed GREEN. A search that cannot match is not a negative result: scan each
  // effect's body instead of trying to express it in one pattern.
  const effects = palette.split('useEffect(').slice(1);
  const automatic = effects.filter((body) => /\bask\(\)/.test(body.slice(0, 400)));
  assert.deepEqual(
    automatic.map((b) => b.slice(0, 40)),
    [],
    'something calls the assistant automatically — it must be a press',
  );
  assert.ok(effects.length >= 3, `only ${effects.length} effects scanned — the split broke`);
});

test('no key is a supported state, not an error', () => {
  const had = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(aiConfigured(), false);
  process.env.ANTHROPIC_API_KEY = 'test-key';
  assert.equal(aiConfigured(), true);
  if (had === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = had;
});

test('nothing in the chain can perform an admin job', () => {
  // The whole safety claim in one assertion: this module routes, and the only
  // thing it writes is a phrase and a destination.
  const src = stripComments(readFileSync(join(WEB, 'lib/admin-map/ask-the-admin.ts'), 'utf8'));
  const writes = src.match(/\.from\('([a-z_]+)'\)/g) ?? [];
  assert.deepEqual(
    [...new Set(writes)],
    [".from('admin_search_phrases')"],
    'the assistant touches a table other than its own memory',
  );
  for (const word of ['approve', 'refund', 'publish', 'payout']) {
    assert.ok(!src.includes(`${word}(`), `the assistant calls ${word}() — it may only route`);
  }
});
