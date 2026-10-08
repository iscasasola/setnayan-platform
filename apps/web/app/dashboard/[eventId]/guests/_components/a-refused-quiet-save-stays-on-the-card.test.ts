/**
 * a-refused-quiet-save-stays-on-the-card.test.ts — STEP 4E: A REFUSED AUTOSAVE BEHAVES LIKE A THROWN ONE.
 *
 * Seen on the lab (?part=card&refuse=1, 375 wide): typing "Reyes" into Middle and pausing posted the card; `updateGuest` REFUSED
 * by redirecting to `…?error=…`, so (1) the whole card went blank for ~1.5 s with only the APP-WIDE bottom toast
 * ("Something went wrong — please try again.", `toast-from-params.tsx` fires for any `?error=`), (2) the card came back drawn from the
 * server with "Reyes" LOST and the card's own error line — two messages in two places, and the host had to retype. The autosave's
 * "Couldn’t save · Try again · typed words kept" only covered a THROWN save (4C).
 *
 * THE FIX (the smaller, safer of the two): `updateGuest`, ONLY for a quiet post (the autosave's — nothing else posts `quiet=1`),
 * RETURNS `{ refused }` instead of redirecting. Every refusal in it goes through one local `refuse()`; a non-quiet post redirects
 * exactly as before. A redirect cannot be "noticed" by the caller — Next performs the navigation itself — so the other route (the
 * autosave catching its own redirect) does not exist. The autosave hears the returned refusal the way it hears a throw
 * (`hearSave`); the templated line adds the action's own sentence when the card knows the code or the words are plainly a sentence.
 *
 * Behavioural, not a source scan: the REAL `updateGuest` is called (a missing name is refused before any database read), and the
 * REAL save line is rendered in a failed state.
 *
 * SABOTAGE (each seen RED, then restored): `refuse` redirecting for a quiet post · hearSave ignoring `{ refused }` · hearSave
 * swallowing a redirect · the line printing the database's words · a raw `redirect(`${backTo}?error=`)` back in updateGuest · the
 * lab stand-in redirecting a quiet post.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { stripComments } from '@/lib/strip-comments';

// `server-only` / `client-only` resolve to an empty module, as in a-failed-save-says-so.test.ts.
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const CjsModule = (createRequire(import.meta.url)('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_refused_quiet__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

(globalThis as { React?: unknown }).React = React; // the card's TSX is compiled with the classic runtime under tsx
const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));

type Mods = {
  hearSave: (a: (fd: FormData) => unknown, fd: FormData) => Promise<string | null>;
  OutcomeContext: React.Context<{ outcome: unknown; retry: () => void }>;
  CardSaveState: React.ComponentType<{ copy?: Record<string, string> }>;
  GUEST_CARD_ERROR_COPY: Record<string, string>;
  updateGuest: (eventId: string, guestId: string, fd: FormData) => Promise<unknown>;
};
let M: Mods;
test('loads the real modules', async () => {
  const auto = await import('./guest-card-autosave');
  const rows = await import('./guest-card-rows');
  const body = await import('./guest-card-body');
  const actions = await import('../[guestId]/actions');
  M = {
    hearSave: auto.hearSave,
    OutcomeContext: auto.OutcomeContext as Mods['OutcomeContext'],
    CardSaveState: rows.CardSaveState,
    GUEST_CARD_ERROR_COPY: body.GUEST_CARD_ERROR_COPY,
    updateGuest: actions.updateGuest as Mods['updateGuest'],
  };
});

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

test('the REAL updateGuest: a quiet post is RETURNED its refusal (no navigation); a non-quiet one redirects as it always did', async () => {
  const quiet = await M.updateGuest('E', 'G', fd({ quiet: '1', first_name: '', last_name: 'Reyes', return_to: '/dashboard/E/guests/G' }));
  assert.deepEqual(quiet, { refused: 'missing_name' });
  await assert.rejects(
    () => M.updateGuest('E', 'G', fd({ first_name: '', last_name: 'Reyes', return_to: '/dashboard/E/guests/G' })),
    (e: unknown) => {
      const digest = String((e as { digest?: unknown }).digest ?? '');
      assert.match(digest, /^NEXT_REDIRECT/);
      assert.match(digest, /\/dashboard\/E\/guests\/G\?error=missing_name/);
      return true;
    },
  );
});

test('the autosave hears a returned refusal like a throw — and lets the framework’s own signals through', async () => {
  assert.equal(await M.hearSave(async () => undefined, fd({})), null, 'a save that landed');
  assert.equal(await M.hearSave(() => undefined, fd({})), null, 'a synchronous action that landed');
  assert.equal(await M.hearSave(async () => ({ refused: 'missing_name' }), fd({})), 'missing_name', 'a refused save');
  assert.equal(
    await M.hearSave(async () => {
      throw new Error('network down');
    }, fd({})),
    '',
    'a thrown save',
  );
  for (const digest of ['NEXT_REDIRECT;replace;/x;307;', 'NEXT_NOT_FOUND', 'NEXT_HTTP_ERROR_FALLBACK;404']) {
    await assert.rejects(
      () =>
        M.hearSave(async () => {
          throw Object.assign(new Error('x'), { digest });
        }, fd({})),
      (e: unknown) => (e as { digest?: string }).digest === digest,
      `${digest} was swallowed as a failed save`,
    );
  }
});

const line = (outcome: unknown, copy?: Record<string, string>) =>
  renderToStaticMarkup(createElement(M.OutcomeContext.Provider, { value: { outcome, retry: () => {} } }, createElement(M.CardSaveState, { copy })));

test('the save line after a refusal: ONE message — Couldn’t save + the action’s own sentence + Try again', () => {
  const html = line({ kind: 'failed', why: 'missing_name' }, M.GUEST_CARD_ERROR_COPY);
  assert.equal((html.match(/role="alert"/g) ?? []).length, 1, 'one alert, not two messages');
  assert.match(html, /Couldn’t save\./);
  assert.match(html, /Please enter both first and last name\./);
  assert.match(html, /Try again/);
  assert.doesNotMatch(html, /Saved/, 'a refused save reads as saved');
  /* A plain sentence from the action itself is said as it came (e.g. the extra-seats check). */
  assert.match(line({ kind: 'failed', why: 'Only 2 seats are open at that table.' }, M.GUEST_CARD_ERROR_COPY), /Only 2 seats are open at that table\./);
});

test('the save line never prints the database’s words, and says just Couldn’t save + Try again for a throw', () => {
  for (const why of ['new row violates row-level security policy for table "guests"', 'invalid input syntax for type uuid: "x"', 'some_unmapped_code', '']) {
    const html = line({ kind: 'failed', why }, M.GUEST_CARD_ERROR_COPY);
    assert.match(html, /Couldn’t save\./);
    assert.match(html, /Try again/);
    assert.doesNotMatch(html, /violates|invalid input|some_unmapped|data-autosave-why/, `printed: ${why}`);
  }
});

test('structure: every refusal in updateGuest goes through refuse(); the card hands the sentences to the templated line only', () => {
  const src = read('..', '[guestId]', 'actions.ts');
  const fn = src.slice(src.indexOf('export async function updateGuest('));
  assert.match(fn, /const refuse = \(error: string\) => \(quiet \? \{ refused: error \} : redirect\(`\$\{backTo\}\?error=\$\{encodeURIComponent\(error\)\}`\)\);/);
  const body = fn.slice(0, fn.indexOf('return redirect(`/dashboard/${eventId}/guests?saved=1`);'));
  const bare = body.match(/redirect\(`\$\{backTo\}\?error=/g) ?? [];
  assert.equal(bare.length, 1, 'a refusal in updateGuest redirects a quiet post again (only refuse() may build the ?error= redirect)');
  assert.ok((body.match(/return refuse\(/g) ?? []).length >= 9, 'a refusal was moved back to a bare redirect');
  const bodySrc = read('guest-card-body.tsx');
  assert.match(bodySrc, /<K\.SaveState copy=\{templated \? GUEST_CARD_ERROR_COPY : undefined\} \/>/);
  const lab = readFileSync(join(HERE, '..', '..', '..', '..', 'dev', 'guests-lab', 'page.tsx'), 'utf8');
  assert.match(lab, /if \(formData\.get\('quiet'\) === '1'\) return \{ refused: labWords \};/, 'the lab stand-in refuses a quiet post differently from the real action');
});
