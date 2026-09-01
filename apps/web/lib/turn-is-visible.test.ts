/**
 * ⭐ THE HOST IS TOLD WHETHER A CAMERA RELAY EXISTS.
 *
 * 2026-09-01, measured on the live platform: every camera failed with "couldn't
 * reach the controller on this network" — with all devices ON THE SAME WI-FI — and
 * there was no way, anywhere in the product, to learn whether a TURN relay was
 * configured. `turnConfigured()` had existed since TURN landed and was called by
 * NOBODY: the answer was one boolean away and no surface asked for it.
 *
 * 🔑 "SAME NETWORK" IS NOT ENOUGH WITHOUT A RELAY. Client/AP isolation (every guest
 * network) and blocked mDNS both defeat host candidates on a single LAN, and STUN
 * cannot rescue either. So the absence of a relay is a rule the host must know
 * BEFORE the day, not a venue-only nicety.
 *
 * And the mint's three silent `return []` paths made a BROKEN relay — rotated key,
 * revoked token, Cloudflare outage — indistinguishable from one never set up.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const repoFile = (p: string) => readFileSync(resolve(HERE, '..', p), 'utf8');

test('⭐ turnConfigured() is no longer a dead read', () => {
  const controller = repoFile('app/panood/control/[eventId]/page.tsx');
  assert.match(controller, /import \{ turnConfigured \}/, 'the controller must ask');
  assert.match(controller, /const relayConfigured = turnConfigured\(\)/, 'and hold the answer');
  assert.match(controller, /!relayConfigured \?/, 'and branch on it in the render');
});

test('⭐ the notice reaches the RENDER, and names the network rule', () => {
  const controller = repoFile('app/panood/control/[eventId]/page.tsx');
  assert.match(controller, /No camera relay is set up\./);
  assert.match(controller, /same Wi-Fi as this controller/, 'it must state the constraint');
  assert.match(
    controller,
    /can&rsquo;t reach the controller/,
    'and connect itself to the message the operator actually sees',
  );
});

test('a missing relay is a NOTICE, never a blocker', () => {
  // Cameras still connect on a network that permits peer traffic. Hiding the grid
  // would take away something that works, which is the opposite of the fix.
  const controller = repoFile('app/panood/control/[eventId]/page.tsx');
  assert.doesNotMatch(
    controller,
    /if \(!relayConfigured\) (return notFound|return null)/,
    'a missing relay must never gate the controller',
  );
});

test('⭐ a BROKEN relay is distinguishable from an unconfigured one', () => {
  const turn = repoFile('lib/turn.ts');
  // Three silent exits used to render a rotated key identical to a missing one.
  assert.match(turn, /Cloudflare refused the credential mint/, 'HTTP failure is named');
  assert.match(turn, /returned no iceServers/, 'an empty OK body is named');
  assert.match(turn, /credential mint threw/, 'a thrown error is named');
});

test('the server-only secrets never leave the server — only the boolean does', () => {
  const controller = repoFile('app/panood/control/[eventId]/page.tsx');
  assert.doesNotMatch(controller, /CLOUDFLARE_TURN_KEY_ID|CLOUDFLARE_TURN_API_TOKEN/);
});
