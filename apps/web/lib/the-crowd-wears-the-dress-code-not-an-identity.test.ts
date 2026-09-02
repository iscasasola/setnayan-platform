/**
 * THE PRIVACY PIN for the seated-crowd dress code (owner 2026-09-02).
 *
 * The 2026-06-26 venue privacy lock said seated strangers render as NEUTRAL
 * untinted mannequins. The owner superseded half of it: the crowd may now wear
 * the couple's guest dress-code palette. The half that still stands — and that
 * this file exists to hold — is that **a stranger's appearance must never
 * encode who they are.**
 *
 * So the defect being guarded is not "the colour is wrong". It is a future
 * change that quietly keys the tint off a guest id, a role, a side, or an RSVP
 * status, at which point the public walk starts leaking exactly what the lock
 * was written to close, while still looking completely correct.
 *
 * Two properties carry that, and neither is a golden list (a list only pins the
 * cases somebody thought to write down):
 *
 *   1. SEAT-KEYED, NOT PERSON-KEYED — the colour is a pure function of the seat
 *      key alone. Proven by construction: the function takes no guest argument,
 *      and a source guard below pins the ONE call site to a seat-derived key.
 *   2. NO PALETTE → NO CHANGE — an event whose couple never set a guest palette
 *      renders byte-identically to the pre-2026-09-02 white mannequin.
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts") from `apps/web`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { guestAttireColor } from './seating-3d';
import type { RolePalette } from './mood-board';

const DRESS_CODE = ['#8e3b5b', '#3f7d57', '#2c5fa8', '#c8a25a'];
const rp = (guest: string[] | undefined): RolePalette => ({ guest }) as RolePalette;

// ── 2 · THE FALLBACK. The property that keeps every existing wedding unchanged.
test('no guest palette → null, so the render is byte-identical to the old white mannequin', () => {
  for (const empty of [undefined, [], null as unknown as string[]]) {
    assert.equal(guestAttireColor(rp(empty), 'T1:0'), null);
  }
  assert.equal(guestAttireColor(null, 'T1:0'), null);
  assert.equal(guestAttireColor(undefined, 'T1:0'), null);
  // A palette object with OTHER keys filled but no `guest` key must also
  // fall back — the room recolours, the people do not.
  assert.equal(
    guestAttireColor({ reception: ['#111111', '#222222'] } as RolePalette, 'T1:0'),
    null,
  );
});

test('a palette of only INVALID hexes is the same as no palette', () => {
  const junk = ['red', 'rgb(1,2,3)', '', '#12345', 'null', '#GGGGGG'];
  assert.equal(guestAttireColor(rp(junk), 'T1:0'), null);
});

// ── 1 · THE PRIVACY PROPERTY. Same seat → same colour, whoever is in it.
test('the colour depends ONLY on the seat key — it cannot encode a person', () => {
  // The signature admits no guest at all, so identity cannot reach it. Pin the
  // observable consequence: one seat key always yields one colour, forever.
  const first = guestAttireColor(rp(DRESS_CODE), 'T7:3');
  for (let i = 0; i < 200; i++) {
    assert.equal(guestAttireColor(rp(DRESS_CODE), 'T7:3'), first);
  }
  // And a DIFFERENT palette order is a different design decision by the couple,
  // not a different person — so it may legitimately change the colour. What may
  // never change it is anything about the occupant, which the type system
  // already forbids by giving this function nowhere to put one.
});

test('every colour returned was actually approved by the couple', () => {
  const seen = new Set<string>();
  for (let t = 0; t < 40; t++) {
    for (let s = 0; s < 12; s++) {
      const c = guestAttireColor(rp(DRESS_CODE), `T${t}:${s}`);
      assert.ok(c !== null);
      assert.ok(
        DRESS_CODE.includes(c),
        `${c} is not in the couple's dress code — the crowd may only wear approved colours`,
      );
      seen.add(c);
    }
  }
  // It must actually VARY, or this is a very expensive way to paint one colour.
  assert.equal(seen.size, DRESS_CODE.length, 'the whole dress code should appear across a room');
});

test('a one-colour dress code is honoured exactly, not "varied" into something else', () => {
  for (let s = 0; s < 25; s++) {
    assert.equal(guestAttireColor(rp(['#8e3b5b']), `T1:${s}`), '#8e3b5b');
  }
});

// ── THE SOURCE GUARD. Types stop identity reaching the function; only reading
// the call site can stop identity reaching the KEY.
test('the ONE call site keys the colour off the seat, never off a guest', () => {
  const src = readFileSync(
    join(import.meta.dirname, '..', 'app', '[slug]', 'venue', '_components', 'guest-venue-3d.tsx'),
    'utf8',
  );

  const calls = [...src.matchAll(/guestAttireColor\(([^)]*)\)/g)];
  assert.equal(calls.length, 1, 'expected exactly one guestAttireColor call site on the public walk');

  const args = calls[0]![1]!;
  // The key must be built from the table id + chair index. Both are seat
  // coordinates; neither is a person.
  assert.match(
    args,
    /`\$\{t\.id\}:\$\{i\}`/,
    'the crowd tint must be keyed off `${t.id}:${i}` (the SEAT), not off any guest value',
  );
  // Belt and braces: the identity-bearing names the RPC does expose must not
  // appear anywhere in the argument list.
  for (const forbidden of ['guest', 'name', 'photo', 'rsvp', 'side', 'role', 'you']) {
    assert.ok(
      !new RegExp(`\\b${forbidden}`, 'i').test(args.replace(/guestAttireColor|rolePalette/gi, '')),
      `the crowd tint argument must not reference "${forbidden}" — that would re-open the 2026-06-26 lock`,
    );
  }
});
