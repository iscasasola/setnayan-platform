/**
 * A COUPLE'S CONNECTION KEY IS NEVER STORED IN PLAINTEXT — proved by calling the
 * classifier, and by pinning the write sites a call cannot reach.
 *
 * Setnayan's privacy filings say Drive, YouTube and TikTok connection keys are
 * stored encrypted. Measured against production 2026-09-13 they were not: five
 * live rows held Google access and refresh tokens as plaintext. CP-3 / LAU-6.
 *
 * The classifier is pure, so the decision that actually matters — may this
 * stored value be sent to Google as a bearer token — is EXECUTED here with a
 * fake decryptor, no key and no network. The write sites live in `'use server'`
 * routes that `tsx --test` cannot import, so those are pinned against source
 * with comments stripped: a sentence in a docblock must never satisfy an
 * assertion about code.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import {
  PLAINTEXT_TOKEN_PREFIXES,
  classifyStoredToken,
  looksSealed,
} from './oauth-token-vault-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => stripComments(readFileSync(resolve(HERE, p), 'utf8'));

/** A sealed envelope is base64 of iv(12) + ciphertext + tag(16) — ≥ 29 bytes. */
const SEALED = Buffer.alloc(48, 7).toString('base64');
/** Never opens anything — the "key is missing / value is plaintext" case. */
const OPENS_NOTHING = () => null;
/** Opens only our fixture envelope. */
const OPENS_SEALED = (payload: string) => (payload === SEALED ? 'ya29.the-real-token' : null);

// ─── The classification, executed ───────────────────────────────────────────

test('a sealed value is opened and reported as sealed', () => {
  const out = classifyStoredToken(SEALED, OPENS_SEALED);
  assert.equal(out.status, 'sealed');
  assert.equal(out.status === 'sealed' && out.value, 'ya29.the-real-token');
});

test('a legacy plaintext Google token is usable and flagged for sealing', () => {
  /*
    The five production rows measured on 2026-09-13. These must keep working —
    a couple who is already connected must not be asked to reconnect.
  */
  for (const token of ['ya29.a0AfB_realish-access-token', '1//0eXaMPle-refresh-token']) {
    const out = classifyStoredToken(token, OPENS_NOTHING);
    assert.equal(out.status, 'legacy_plaintext', `${token} was not treated as usable plaintext`);
    assert.equal(out.status === 'legacy_plaintext' && out.value, token);
  }
});

test('🔑 A PLAINTEXT GOOGLE REFRESH TOKEN IS BASE64-SHAPED AND MUST NOT READ AS SEALED', () => {
  /*
    THE TRAP THIS WHOLE MODULE EXISTS FOR. `1//0e…` uses only base64 characters
    and decodes cleanly, so a shape-only rule says SEALED — and the caller then
    refuses a token that was perfectly good, so the couple's connection looks
    broken while nothing is wrong. The provider prefixes are what prevent it.
  */
  const refresh = '1//0eABCDefGHijKLmnOPqrSTuvWXyz0123456789abcdefGHIJKLMNOPqrstuvw';
  assert.equal(refresh.length % 4, 0, 'fixture must be base64-length or it proves nothing');
  assert.ok(/^[A-Za-z0-9+/]+={0,2}$/.test(refresh), 'fixture must be base64-shaped');
  assert.equal(looksSealed(refresh), false, 'a real refresh token was mistaken for ciphertext');
  assert.equal(classifyStoredToken(refresh, OPENS_NOTHING).status, 'legacy_plaintext');
});

test('every provider prefix is honoured — none may be dropped', () => {
  assert.deepEqual(
    [...PLAINTEXT_TOKEN_PREFIXES],
    ['ya29.', '1//', 'act.', 'rft.'],
    'a provider prefix changed — each one stops a real token reading as ciphertext',
  );
  for (const prefix of PLAINTEXT_TOKEN_PREFIXES) {
    const token = `${prefix}${'A'.repeat(64)}`;
    assert.equal(looksSealed(token), false, `${prefix} is no longer recognised as plaintext`);
  }
});

test('🔒 AN ENVELOPE WE CANNOT OPEN IS NEVER USED — it fails closed', () => {
  /*
    The key is missing or has rotated past its fallback. Handing base64
    ciphertext to Google as a bearer token produces a puzzling 401 and prompts a
    reconnect that overwrites a value we might still have recovered.
  */
  const out = classifyStoredToken(SEALED, OPENS_NOTHING);
  assert.equal(out.status, 'unopenable');
  assert.ok(!('value' in out), 'an unopenable envelope handed its ciphertext back to the caller');
});

test('nothing stored is "absent", distinct from unopenable', () => {
  for (const empty of [null, undefined, '', '   ']) {
    assert.equal(classifyStoredToken(empty, OPENS_SEALED).status, 'absent');
  }
});

test('a short base64 string is not an envelope — it cannot hold iv + tag', () => {
  assert.equal(looksSealed(Buffer.alloc(20, 1).toString('base64')), false);
  assert.equal(looksSealed(Buffer.alloc(29, 1).toString('base64')), true);
});

test('a non-base64 opaque token is plaintext, not an envelope', () => {
  for (const v of ['not a token', 'abc.def.ghi', '{"json":true}', 'has spaces in it']) {
    assert.equal(looksSealed(v), false, `${v} read as ciphertext`);
  }
});

// ─── The write sites, pinned ────────────────────────────────────────────────

const WRITE_SITES: ReadonlyArray<readonly [string, string]> = [
  ['../app/api/oauth/drive/callback/route.ts', 'the couple connects Google Drive'],
  ['../app/api/oauth/photo-delivery/callback/route.ts', 'the couple connects photo delivery'],
  ['../app/api/oauth/youtube/callback/route.ts', 'the couple connects YouTube'],
  ['../app/api/tiktok/auth/callback/route.ts', 'the couple connects TikTok'],
  ['../app/api/cron/oauth-refresh/route.ts', 'the overnight refresh'],
  ['live-studio-channel-grants.ts', 'a Live Studio pool channel'],
  ['drive-copy.ts', 'a Drive access-token refresh'],
  ['photo-delivery-release.ts', 'a photo-delivery access-token refresh'],
  ['panood-broadcast.ts', 'a Panood access-token refresh'],
];

test('EVERY site that stores a token seals it first', () => {
  /*
    🪤 ONE MISSED WRITER IS THE WHOLE DEFECT. A single route still assigning a
    raw token writes plaintext into the same column the others seal, and every
    other test here stays green. So each file is asserted BY NAME, and the
    failure message says which door was left open.
  */
  for (const [file, what] of WRITE_SITES) {
    const src = read(file);
    assert.ok(
      src.includes('sealToken('),
      `${what} (${file}) stores a connection key without sealing it`,
    );
  }
});

test('no write site assigns a RAW provider token to a token column', () => {
  /*
    The positive test above only proves `sealToken` appears somewhere in the
    file. This one proves the raw assignment is GONE — the two together are what
    a half-finished edit fails.
  */
  const RAW = [
    /access_token:\s*token\.access_token\b/,
    /refresh_token:\s*token\.refresh_token\b/,
    /access_token:\s*refreshed\.access_token\b/,
    /refresh_token:\s*grant\.refresh_token\b/,
  ];
  for (const [file, what] of WRITE_SITES) {
    /*
      🪤 ONE RAW USAGE IS CORRECT AND MUST NOT BE FLAGGED: the arguments to
      `upgradeLegacyTokens` are the STORED values, passed in precisely so the
      helper can decide which of them are still plaintext. Stripping that call's
      arguments first is what keeps this assertion about DB WRITES. Without it
      the test fails on the very mechanism that seals legacy rows — and the
      tempting "fix" would be to weaken the regex until it matched nothing.
    */
    const src = read(file).replace(/upgradeLegacyTokens\([\s\S]*?\n\s*\);/g, '');
    for (const re of RAW) {
      assert.ok(
        !re.test(src),
        `${what} (${file}) still writes a raw token: ${re}`,
      );
    }
  }
});

test('the refresh paths OPEN the stored refresh token before spending it', () => {
  /*
    A refresh request built from ciphertext is how Google is persuaded to revoke
    a grant that was perfectly healthy — the token is spent, and the couple has
    to reconnect for a reason that was entirely ours.
  */
  for (const file of ['drive-copy.ts', 'photo-delivery-release.ts', 'panood-broadcast.ts']) {
    const src = read(file);
    assert.match(
      src,
      /const refreshToken = openStoredToken\(grant\.refresh_token as string \| null\);/,
      `${file} spends the stored refresh token without opening it`,
    );
    assert.match(src, /if \(!refreshToken\) return null;/, `${file} does not fail closed`);
  }
});

test('the re-seal is AWAITED and its row count is checked', () => {
  /*
    🪤 THE FIX THAT NEEDED ITS OWN GUARD. These callbacks first returned the
    PostgREST builder instead of awaiting it (TS2739). The builder is thenable,
    so the write did run — but nothing looked at WHAT it wrote, and a zero-row
    UPDATE is success-shaped: PostgREST returns no error when the filter matches
    nothing, so a re-seal that touched no row reported a key sealed while it sat
    in plaintext. The compiler's nudge — cast the type — would have kept exactly
    that. Both halves are pinned, because either one alone can be reverted.
  */
  for (const file of [
    'drive-copy.ts',
    'photo-delivery-release.ts',
    'panood-broadcast.ts',
    'live-studio-channel-grants.ts',
  ]) {
    const src = read(file);
    const call = /upgradeLegacyTokens\([\s\S]*?\n\s*\);/.exec(src)?.[0];
    assert.ok(call, `${file} no longer re-seals a legacy token in place`);
    assert.match(call, /await admin/, `${file} does not await its re-seal write`);
    assert.match(call, /\.select\(/, `${file} re-seals without asking which rows it touched`);
    assert.match(call, /rows: data\?\.length \?\? 0/, `${file} does not return a row count`);
  }
});

test('a re-seal that matched NO row is not counted as sealed', () => {
  const src = read('oauth-token-vault.ts');
  assert.match(
    src,
    /if \(rows === 0\) \{/,
    'a zero-row re-seal still reports the key as sealed',
  );
});

test('the revoke path sends Google the OPENED token, not the envelope', () => {
  /*
    Revocation talks to Google. Sending an envelope means Google rejects it and
    the grant stays LIVE on their side while our row says revoked — a
    disconnect that did not disconnect.
  */
  const src = read('live-studio-channel-grants.ts');
  assert.match(src, /const storedRefresh = openStoredToken\(row\.refresh_token\);/);
  assert.match(src, /if \(storedRefresh\) await revokeYoutubeToken\(storedRefresh\);/);
  assert.ok(
    !/await revokeYoutubeToken\(row\.refresh_token\)/.test(src),
    'the revoke call still sends the stored value straight to Google',
  );
});

test('🔑 EVERY SEALED COLUMN JOINS THE KEY-ROTATION SWEEP', () => {
  /*
    The rotation contract is: write the new key, re-seal everything, then drop
    ENCRYPTION_KEY_PREVIOUS. A sealed column the sweep does not know about still
    holds ciphertext under the OLD key — and dropping PREVIOUS makes it
    permanently unopenable. For these columns that means every couple's Drive,
    broadcast and TikTok connection dies at once, each needing a manual
    reconnect. The count is asserted so a seventh column cannot be added to the
    vault and forgotten here.
  */
  const src = read('secrets/reencrypt.ts');
  const required: ReadonlyArray<readonly [string, string]> = [
    ['oauth_grants', 'access_token'],
    ['oauth_grants', 'refresh_token'],
    ['live_studio_channel_grants', 'access_token'],
    ['live_studio_channel_grants', 'refresh_token'],
    ['patiktok_oauth_grants', 'access_token'],
    ['patiktok_oauth_grants', 'refresh_token'],
  ];
  for (const [table, column] of required) {
    const re = new RegExp(`'${table}'[^)]*'${column}'`);
    assert.match(src, re, `${table}.${column} is sealed but never re-sealed on a key rotation`);
  }
  const sweeps = src.match(/sweepColumn\(/g) ?? [];
  assert.equal(
    sweeps.length,
    required.length + 3,
    'a sweepColumn call was added or removed — confirm every sealed column is still covered',
  );
});

test('the vault never logs a token value', () => {
  /*
    A decrypt error can quote its input back. Anything this module prints ends
    up in Vercel's logs and in Sentry, which is precisely where a credential
    must not be.
  */
  const src = read('oauth-token-vault.ts');
  const calls = src.match(/console\.\w+\([\s\S]*?\);/g) ?? [];
  assert.ok(calls.length > 0, 'no log lines found — the pin is checking nothing');
  for (const call of calls) {
    /*
      🪤 THE FIRST VERSION OF THIS PIN WAS INERT. It banned a list of words, so
      `console.warn('[oauth-token-vault] failed', { columns })` — which prints
      the caller's token map — sailed through: no banned word, no `${`. Naming
      the shapes you fear cannot work, because the leak is any VALUE at all.
      So the rule is inverted: a log line here is ONE plain string literal and
      nothing else. Anything with a second argument, an interpolation or a
      concatenation fails, whatever it is called.
    */
    assert.match(
      call,
      /^console\.\w+\('[^'`$]*'\);$/,
      `a log line carries something other than a fixed string: ${call}`,
    );
  }
});
