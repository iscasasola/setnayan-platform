/**
 * 📋 A LINKED FORM IS SENT FROM THE ONE BOOKING MOMENT (THE ONE BUILD · Forms, B2 §5 guard 6).
 *
 * "Booked" = the deposit is confirmed, and that moment has ONE place every door runs through:
 * `runDepositAcknowledgedEffects` (lib/deposit-acknowledged-effects.server.ts — `deposit-acknowledge-fires-from-every-
 * door.test.ts` proves every door calls it). So `sendLinkedFormsForBooking` is called from there and from NOWHERE else:
 * a second call site is either a door that skips the others' rules or a send at a moment that is not a booking.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME = 'lib/vendor-forms-on-booking.server.ts';
const THE_ONE_PLACE = 'lib/deposit-acknowledged-effects.server.ts';

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

test('sendLinkedFormsForBooking is called only from runDepositAcknowledgedEffects', () => {
  const callers: string[] = [];
  for (const abs of [...walk(path.join(WEB, 'app')), ...walk(path.join(WEB, 'lib'))]) {
    const rel = path.relative(WEB, abs).split(path.sep).join('/');
    if (rel === HOME) continue;
    const src = fs.readFileSync(abs, 'utf8');
    if (/sendLinkedFormsForBooking\s*\(/.test(src)) callers.push(rel);
  }
  assert.deepEqual(callers, [THE_ONE_PLACE], `call sites: ${callers.join(', ') || 'none'}`);
});

test('…and inside it, only once the deposit is acknowledged', () => {
  const src = fs.readFileSync(path.join(WEB, THE_ONE_PLACE), 'utf8');
  const gate = src.indexOf('if (outcome.eventId && outcome.acknowledged)');
  const call = src.indexOf('sendLinkedFormsForBooking(admin');
  assert.ok(gate > 0 && call > gate, 'the send must sit inside the acknowledged branch');
  const end = src.indexOf('} catch (e)', gate);
  assert.ok(call < end, 'the send left the acknowledged branch');
});

test('the on-booking lane is the service role’s — the home never takes a browser session', () => {
  const src = fs.readFileSync(path.join(WEB, HOME), 'utf8');
  assert.match(src, /^import 'server-only';/);
  assert.ok(!/createClient\s*\(\s*\)/.test(src), 'the booking-moment send must not run as the signed-in user');
  assert.match(src, /sent_by: 'on_booking'/);
});
