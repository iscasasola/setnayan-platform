/**
 * THE 3D SEAT PLAN WEARS THE ROLE'S DRESS CODE — AND THE GUEST CARD SAYS IT, NEVER PICKS IT.
 *
 * Owner, verbatim, 2026-10-20, on the guest card's Seat fold ("Attire · 3D seat plan (i) — Neutral / auto", a dropdown):
 * *"the attire depends on the dress code of their role."*
 *
 * The defect was TWO stores for one fact: Studio › Mood Board & Dress Code said a ninong wears a Barong Tagalog; the 3D
 * room dressed him from `guests.attire` (a per-guest Gown / Suit / Neutral nobody else read for clothing), so the same
 * man could be a gown in the room and a barong on his own invitation. Now there is ONE reading, `guestOutfitOf`
 * (lib/guest-outfit.ts) — the one Me › What to wear makes — and the room and the card both go through it.
 *
 * PROPERTIES HELD HERE:
 *   1. the room's garment IS the resolver's outfit for that guest (`seatPlanOutfitOf(guestOutfitOf(…))`), whatever the
 *      stored `guests.attire` says — it only breaks a woman-or-man tie, last (`womanOrManOf`);
 *   2. both 3D surfaces (the couple's lab and the homepage demo) dress from that reading, and wear a said Wear as said;
 *   3. the card's line says the Wear and where it came from — or "Not set yet" with where to set it, in plain words.
 * (The card drawing NO attire picker and posting no `attire` is held where the card's form is held:
 *  `the-card-posts-the-same-form.test.ts`, `the-fable-card-and-rows.test.ts`, `the-card-posts-every-column.test.ts`.)
 *
 * SABOTAGE (each seen RED, then restored — the PR body lists them): `seatPlanOutfitOf` reads `guests.attire` first ·
 * the lab goes back to `resolveGuestAttire(g.role, g.attire, g.gender)` · the lab's figure ignores the said garment ·
 * the demo ignores it · the card's line drops where it came from.
 *
 * Run from `apps/web` (`pnpm test:unit`) — the repo root breaks every `@/…`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { guestOutfitOf, guestOutfitWords, seatGarmentOf, seatPlanOutfitOf, OUTFIT_NOT_SET, OUTFIT_SET_IN, type GuestOutfitPerson } from './guest-outfit';
import type { GuestRole } from './guests';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');
const read = (...p: string[]) => stripComments(readFileSync(join(APP, ...p), 'utf8'));

/** A dress code as the Studio stores it: the FIRST pick (men · boys) in `groups` / `roles`, the women's in `women`. */
const CONFIG = {
  groups: {
    principal_sponsors: { style: 'barong_tagalog' },
    vip_family: { style: 'suit' },
    groomsmen: { style: 'barong_tagalog' },
    bridesmaids: { style: 'long_gown' },
  },
  roles: { guest: { style: 'suit' } },
  women: {
    groups: { principal_sponsors: { style: 'filipiniana' }, vip_family: { style: 'long_gown' } },
    roles: { guest: { style: 'long_gown' } },
  },
};

const who = (gender: 'woman' | 'man' | null, attire: 'gown' | 'suit' | 'neutral' | null = 'neutral', name_prefix: string | null = null): GuestOutfitPerson => ({
  name_prefix,
  display_name: null,
  gender,
  attire,
});

function dress(role: GuestRole, person: GuestOutfitPerson, config: unknown = CONFIG) {
  const outfit = guestOutfitOf({ role, dressCodeConfig: config, palette: {}, roleNames: null, person });
  return { outfit, seat: seatPlanOutfitOf(outfit, role, person), words: guestOutfitWords(outfit) };
}

/* ── 1 · the room's garment is the role's outfit, not the stored attire ─────────────────────────── */

test('a ninong wears his row\'s men\'s Wear — even when the stored attire says "gown"', () => {
  const { seat, words } = dress('principal_sponsor_ninong', who(null, 'gown'));
  assert.deepEqual(seat, { attire: 'suit', said: 'barong' });
  assert.equal(words.wear, 'Barong Tagalog');
  assert.equal(words.from, 'from Principal Sponsors’ dress code');
});

test('a ninang wears the women\'s Filipiniana — even when the stored attire says "suit"', () => {
  assert.deepEqual(dress('principal_sponsor_ninang', who(null, 'suit')).seat, { attire: 'gown', said: 'filipiniana' });
});

test('a parent wears THEIR column, by the "Atty. (Woman)" pick — and the stored attire never outvotes it', () => {
  for (const stored of ['gown', 'suit', 'neutral'] as const) {
    const mother = dress('groom_parents', who('woman', stored, 'Atty.'));
    assert.deepEqual(mother.seat, { attire: 'gown', said: 'gown' }, `stored ${stored}`);
    assert.equal(mother.words.wear, 'Long gown');
    assert.equal(mother.words.from, 'from VIP · Immediate Family’s dress code');
    assert.deepEqual(dress('groom_parents', who('man', stored, 'Atty.')).seat, { attire: 'suit', said: 'suit' }, `stored ${stored}`);
  }
});

test('a parent nobody marked woman or man is assumed neither — unless the stored attire is the only word (the last resort)', () => {
  const unknown = dress('groom_parents', who(null, 'neutral', 'Atty.'));
  assert.deepEqual(unknown.seat, { attire: 'neutral', said: null });
  assert.equal(unknown.words.wear, 'For men: Suit and tie · For women: Long gown');
  assert.deepEqual(dress('groom_parents', who(null, 'gown', 'Atty.')).seat, { attire: 'gown', said: 'gown' });
});

test('a plain guest wears the Studio\'s "Guests" row, their own column', () => {
  assert.deepEqual(dress('guest', who('woman', 'suit')).seat, { attire: 'gown', said: 'gown' });
  assert.deepEqual(dress('guest', who('man', 'gown')).seat, { attire: 'suit', said: 'suit' });
  assert.equal(dress('guest', who('woman')).words.from, 'from Guests’ dress code');
});

test('a man standing as a bridesmaid is dressed as a man — no gown assumed for him (owner 2026-10-17)', () => {
  assert.deepEqual(dress('bridesmaid', who('man')).seat, { attire: 'suit', said: null });
  assert.deepEqual(dress('bridesmaid', who('woman')).seat, { attire: 'gown', said: 'gown' });
});

test('nothing picked for the role: the room keeps the role\'s own person, and the card says where to set it', () => {
  const none = dress('groomsman', who(null), {});
  assert.deepEqual(none.seat, { attire: 'suit', said: null });
  assert.deepEqual(none.words, { wear: OUTFIT_NOT_SET, from: OUTFIT_SET_IN, said: false });
  assert.equal(OUTFIT_NOT_SET, 'Not set yet');
  assert.equal(OUTFIT_SET_IN, 'Set it in Studio › Mood Board & Dress Code');
  /* a Nikah wali is a man by his role, so he is not left a blank token */
  assert.deepEqual(dress('wali' as GuestRole, who(null), {}).seat, { attire: 'suit', said: null });
});

test('the matrix: for every role × woman/man/unknown × stored attire, a said one-person Wear is the garment worn', () => {
  const roles: GuestRole[] = ['bride', 'groom', 'principal_sponsor_ninong', 'principal_sponsor_ninang', 'groom_parents', 'bride_parents', 'bridesmaid', 'groomsman', 'guest', 'flower_girl', 'ring_bearer', 'best_man', 'maid_of_honor'] as GuestRole[];
  let said = 0;
  for (const role of roles) {
    for (const gender of ['woman', 'man', null] as const) {
      const byStored = (['gown', 'suit', 'neutral'] as const).map((stored) => dress(role, who(gender, stored)));
      for (const { outfit, seat } of byStored) {
        const one = outfit.picks.length === 1 ? outfit.picks[0]! : null;
        if (one?.style && seat.said) {
          said += 1;
          assert.equal(seat.said, seatGarmentOf(one.who, one.style), `${role} · ${gender}: the room wears ${seat.said}, the resolver says ${one.style}`);
        }
      }
      /* With woman or man known, the stored attire changes NOTHING in the room. */
      if (gender) for (const b of byStored.slice(1)) assert.deepEqual(b.seat, byStored[0]!.seat, `${role} · ${gender}: the stored attire moved the figure`);
    }
  }
  assert.ok(said >= 20, `only ${said} said Wears were checked — the matrix went vacuous`);
});

/* ── 2 · both 3D surfaces dress from the one reading ───────────────────────────────────────────── */

test('the couple\'s 3D lab dresses every guest from guestOutfitOf — guests.attire only as the person\'s last-resort word', () => {
  const page = read('dashboard', '[eventId]', 'seating', 'lab', 'page.tsx');
  assert.doesNotMatch(page, /resolveGuestAttire\(/, 'the lab dresses from guests.attire again');
  assert.match(page, /seatPlanOutfitOf\(\s*guestOutfitOf\(/, 'the lab does not read the role dress code');
  assert.match(page, /dress_code_config/, 'the lab does not read the dress code');
  assert.match(page, /const attire = seatOutfit\.attire;/);
  assert.match(page, /outfit: seatOutfit\.said,/, 'the lab drops the said garment');
  const reads = [...page.matchAll(/\bg\.attire\b/g)];
  assert.equal(reads.length, 1, 'guests.attire is read for more than the person\'s woman-or-man');
  assert.match(page, /const person = \{[^}]*attire: g\.attire \}/);
  const scene = read('dashboard', '[eventId]', 'seating', 'lab', '_components', 'seating-lab-3d.tsx');
  assert.match(scene, /outfit: outfitVariantFor\(g\.attire, g\.id, g\.outfit\)/, 'the figure is not handed the said garment');
  assert.match(scene, /if \(said\) return said;/, 'a said Wear is not worn as said');
});

test('the homepage 3D demo dresses the sample cast the same way', () => {
  const demo = read('_actions', 'plan3d-demo-actions.ts');
  assert.doesNotMatch(demo, /resolveGuestAttire\(/, 'the demo dresses from guests.attire again');
  assert.match(demo, /seatPlanOutfitOf\(guestOutfitOf\(/);
  assert.match(demo, /outfit: dressed\.said,/);
  const scene = read('_components', 'plan3d', 'plan3d-scene.tsx');
  assert.match(scene, /if \(g\.outfit\) return g\.outfit;/, 'the demo ignores the said garment');
  assert.match(read('tour', '_lib', 'sample-event.ts'), /dress_code_config/, 'the sample event\'s dress code is not read');
});

/* ── 3 · the card: said, from where — never a pick, never a link ──────────────────────────────── */

test('the card draws the one reading as a fact, and draws no attire pick', () => {
  const data = read('dashboard', '[eventId]', 'guests', '_components', 'guest-card-data.ts');
  assert.match(data, /guestOutfitWords\(\s*guestOutfitOf\(/, 'the card does not read the role dress code');
  const body = read('dashboard', '[eventId]', 'guests', '_components', 'guest-card-body.tsx');
  assert.doesNotMatch(body, /name="attire"/, 'the card posts an attire again');
  assert.match(body, /<K\.Fact field="attire" label="Attire · 3D seat plan" value=\{outfit\.wear\} where=\{outfit\.from\} \/>/);
  assert.doesNotMatch(OUTFIT_SET_IN, /https?:|\//, 'where to set it became a link');
});
