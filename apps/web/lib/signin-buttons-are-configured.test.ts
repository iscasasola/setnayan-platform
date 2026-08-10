/**
 * signin-buttons-are-configured.test.ts — a sign-in button must lead somewhere.
 *
 * WHAT IT COST (measured on the live site, 2026-08-10). All three buttons render
 * at https://www.setnayan.com/login. Probed directly against the auth server:
 *
 *   provider=google   → 302  (configured)
 *   provider=apple    → 302  (configured)
 *   provider=facebook → 400  ← a first-time visitor fails at the FIRST screen
 *
 * Nobody had pasted the Meta credentials into Supabase, so the flag was offering
 * a door with no room behind it. The component's own docblock said the flag
 * "ships OFF" — true of the default, false of production, which is why reading
 * the code was not enough to catch it. Owner: *"we will add this but after all
 * is built."*
 *
 * 🔑 A FLAG SAYS "SHOW IT"; IT CANNOT SAY "IT WORKS." Those are two different
 * facts and they need two different switches. The flag carries the owner's
 * intent; `FACEBOOK_PROVIDER_CONFIGURED` carries whether the provider exists.
 * Turning the button on requires both — so an env var set in a hurry can never
 * again put a broken door on the front page.
 *
 * ⚠ This is the same family as everything else this project keeps paying for: a
 * mechanism nobody proved reachable. The difference is that the failure is on
 * the very first screen a stranger sees, where there is no second chance.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Executed code only — the docblocks above explain the trap by name. */
const code = (rel: string) =>
  readFileSync(join(WEB, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

const SURFACES = [
  'app/_components/oauth-button-row.tsx',
  'app/_components/desktop-oauth-buttons.tsx',
] as const;

test('every sign-in surface gates Facebook on the provider, not only the flag', () => {
  for (const rel of SURFACES) {
    const src = code(rel);
    assert.match(
      src,
      /const FACEBOOK_ENABLED\s*=\s*\n?\s*FACEBOOK_PROVIDER_CONFIGURED\s*&&/,
      `${rel} shows the Facebook button on the env flag alone. That flag was ON in ` +
        `production while the provider answered 400, so the first screen a stranger ` +
        `saw offered a button that could only fail.`,
    );
  }
});

test('the provider constant is OFF until somebody configures Meta', () => {
  for (const rel of SURFACES) {
    assert.match(
      code(rel),
      /const FACEBOOK_PROVIDER_CONFIGURED\s*=\s*false\b/,
      `${rel} flipped FACEBOOK_PROVIDER_CONFIGURED to true. That is only correct ` +
        `once …/auth/v1/authorize?provider=facebook answers 302 — check it, do not ` +
        `assume it, and flip both surfaces in the same change.`,
    );
  }
});

test('the two surfaces agree — one cannot be on while the other is off', () => {
  const values = SURFACES.map((rel) => {
    const m = /const FACEBOOK_PROVIDER_CONFIGURED\s*=\s*(true|false)/.exec(code(rel));
    assert.notEqual(m, null, `${rel} lost the constant entirely`);
    return m![1];
  });
  assert.equal(
    new Set(values).size,
    1,
    'the phone row and the desktop row disagree about whether Facebook is ' +
      'configured, so the button would appear on one device and not the other',
  );
});

test('Google and Apple are NOT gated by this — they are configured and must stay', () => {
  // Both answered 302 when probed. Sweeping them into the same hard-off would
  // remove two working sign-in methods to fix a third.
  for (const rel of SURFACES) {
    const src = code(rel);
    for (const name of ['GOOGLE_ENABLED', 'APPLE_ENABLED']) {
      assert.ok(
        !new RegExp(`const ${name}\\s*=\\s*\\n?\\s*FACEBOOK_PROVIDER_CONFIGURED`).test(src),
        `${rel} gated ${name} behind the Facebook constant`,
      );
    }
  }
});
