/**
 * THE COPY MAY NOT PROMISE A STEP THE CODE DOES NOT PERFORM.
 *
 * Explore's ⓘ panel explains what pressing Lock does. For months it read
 * "you request the lock, the vendor agrees, …" — the §7 handshake — while
 * `finalizeVendor` wrote `status='contracted'` outright and the vendor was TOLD
 * afterwards ("You have a new confirmed booking"). Steps 1, 3, 4 and 5 of that
 * handshake ship; step 2 has never existed. So the one screen that exists to
 * explain the mechanism described a veto no vendor was ever offered.
 *
 * 🔑 WHY THIS GUARD IS DERIVED, NOT A PINNED STRING. Pinning the literal would
 * fail on every legitimate reword and pass the moment someone reworded the
 * promise back in. This test instead asks the CODE whether step 2 is wired, and
 * only then permits the sentence to claim it:
 *
 *   the app calls `vendor_agree_to_lock`  ⇒  the copy MAY promise the agreement
 *   nothing calls it                      ⇒  the copy MUST NOT
 *
 * The data layer for step 2 (migration 20271107090000) is applied in production
 * with nine columns, three RPCs and a forgery trigger — and ZERO app callers.
 * A shipped table is not a shipped feature; only a caller is. When PR-H wires
 * one, this guard releases on its own and the promise becomes legal again.
 *
 * MUTATION (verify by occurrence count, before → after):
 *   restore the old sentence to `EXPLORE_INFO_HANDSHAKE` ⇒ test 1 RED.
 *   add a `vendor_agree_to_lock` call under app/ or lib/ ⇒ test 1 goes green by
 *   itself, which is the whole point, and test 2 then guards the other side.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXPLORE_INFO_HANDSHAKE } from './explore-info-copy';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

/** Strip comments so a docblock naming the RPC never counts as calling it. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Files that would CALL the agree RPC — tests excluded, they prove nothing about prod. */
const SOURCES = ['app', 'lib']
  .flatMap((r) => walk(resolve(WEB, r)))
  .filter((f) => !/\.test\.tsx?$/.test(relative(WEB, f)));

const agreeCallers = SOURCES.filter((f) => /vendor_agree_to_lock/.test(code(readFileSync(f, 'utf8'))));

/**
 * The words that assert a veto. Each is a distinct way to claim the vendor gets
 * to answer BEFORE the booking exists — the specific falsehood, not the topic.
 * "handshake" alone is fine: the later steps genuinely are one.
 */
const PROMISE_PATTERNS: ReadonlyArray<{ re: RegExp; why: string }> = [
  { re: /vendor agrees/i, why: 'claims the vendor agrees' },
  { re: /you request the lock/i, why: 'claims locking is only a request' },
  { re: /request the lock/i, why: 'claims locking is only a request' },
  { re: /once (?:they|the vendor) (?:agree|accept)s? the lock/i, why: 'claims the lock waits on the vendor' },
  { re: /waiting for the vendor to agree/i, why: 'claims the couple is waiting on an agreement' },
];

test('the Explore copy may not promise the vendor agrees while nothing calls vendor_agree_to_lock', () => {
  if (agreeCallers.length > 0) return; // step 2 is wired — the promise is legal now.

  const broken = PROMISE_PATTERNS.filter((p) => p.re.test(EXPLORE_INFO_HANDSHAKE));
  assert.deepEqual(
    broken.map((b) => b.why),
    [],
    `EXPLORE_INFO_HANDSHAKE ${broken.map((b) => b.why).join(' + ')}, but no file under app/ or lib/ ` +
      `calls vendor_agree_to_lock, so no vendor can agree to anything. Wire step 2 first, or describe ` +
      `what locking actually does today.\n  copy: ${EXPLORE_INFO_HANDSHAKE}`,
  );
});

test('the Explore copy still describes what locking does — it is not empty or a placeholder', () => {
  // Guards the lazy fix: deleting the sentence also removes the falsehood.
  assert.ok(
    EXPLORE_INFO_HANDSHAKE.trim().length > 60,
    'the lock line must still explain what pressing Lock does — deleting it is not the fix',
  );
  assert.match(
    EXPLORE_INFO_HANDSHAKE,
    /lock/i,
    'the lock line must still be about locking',
  );
});
