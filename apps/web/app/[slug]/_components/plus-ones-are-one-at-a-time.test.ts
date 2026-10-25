/**
 * 🪑 EACH +1 IS ITS OWN SCREEN, AND A NAMED +1 IS CONFIRMED WITH A TICK.
 *
 * Owner, verbatim, 2026-10-25, on the reply's +1 step:
 *   · *"Each plus shouldn't come from a drop down and also allow them to checkbox Accept that they are coming
 *     (required) if name is written down?"*
 *   · on the stacked-rows look: *"one at a time"*
 *   · *"Tick only shows when there is name written. and that is required. If you are not yet sure, delete name"*
 *   · *"Yes, build the +1 screens as shown."* (shots `shots-2026-10-25/plus-rows/after-390-one-*.png`)
 *
 * What this pins, by rendering the real card and running the real rules:
 *   1 · NO SEAT DROPDOWN — the "Filling in for ▾" PickMenu is gone; the only selects on a +1 screen are the shipped
 *       Prefix and Meal;
 *   2 · ONE SCREEN PER +1 — each seat is its own `data-rsvp-step`, holding exactly its own boxes, and the wrapper
 *       around them is not a step (a step in a step is a blank screen);
 *   3 · THE TICK IS DRAWN ONLY WITH A NAME — an empty seat has none; a named seat has one;
 *   4 · A NAME WITHOUT THE TICK BLOCKS NEXT — the drawn tick is `required`, Next checks every box on the screen and
 *       stays on a refusal, and the refusal is the calm line at the box, never the browser's bubble;
 *   5 · NEVER PRE-TICKED — a named seat opens unticked unless that seat is already on record as `attending`;
 *   6 · AN UNTICKED +1 IS NEVER SAVED — the server drops a named seat posted without its tick before anything is
 *       planned, and writes a ticked one as attending (+ who answered, + when);
 *   7 · ONE TICK BOX, NO WHITE SQUARE IN DARK — the +1 tick and the Terms tick are the same piece, filled with the
 *       page's paper.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { BASE, GUEST, doorAction, renderReplyCard } from '@/lib/reply-card.fixture';
import { readSeatNames, splitUnconfirmedSeats } from '@/lib/extra-seats';

const APP = join(__dirname, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));

/** A guest who said Yes with `seats` (the seat list as the loader passes it), one question per screen. */
function yes(count: number, seats: unknown[] = []) {
  return renderReplyCard({
    ...BASE,
    doorAction,
    oneAtATime: true,
    askTagging: true,
    ask: {},
    guest: { ...GUEST, rsvp_status: 'attending', plus_one_allowed: true, plus_one_count: count, plus_one_seats: seats },
  });
}
/** The +1 part of the card, wrapper to the tagging question. */
function plusPart(html: string): string {
  const at = html.indexOf('id="plus-ones"');
  assert.ok(at > -1, 'the +1 part did not render');
  return html.slice(html.lastIndexOf('<div', at), html.indexOf('data-face-tagging-choice', at));
}
/** Each +1 screen's markup, by its `data-plus-one-screen` number. */
function screens(part: string): Map<number, string> {
  const out = new Map<number, string>();
  const marks = [...part.matchAll(/data-plus-one-screen="(\d)"/g)];
  marks.forEach((m, i) => out.set(Number(m[1]), part.slice(m.index!, marks[i + 1]?.index ?? undefined)));
  return out;
}
/** The tag carrying `name="…"`. */
const tagOf = (html: string, name: string) => html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0] ?? '';

const named = (id: string, first: string, last: string, rsvp_status: string | null = null) => ({
  guest_id: id,
  name: `${first} ${last}`,
  first,
  last,
  meal: null,
  dietary: null,
  rsvp_status,
});
const empty = (id: string) => ({ guest_id: id, name: null });

test('1 · no seat dropdown — no "Filling in for", no PickMenu; the only selects are Prefix and Meal', async () => {
  const src = read('[slug]/_components/rsvp-plus-ones.tsx');
  assert.doesNotMatch(src, /<PickMenu\b|PickMenu'|Filling in for|data-plus-one-switcher|seatOptions/, 'a seat switcher came back on the +1 step');
  const part = plusPart(await yes(3));
  const selects = [...part.matchAll(/<select[^>]*name="([^"]+)"/g)].map((m) => m[1]!);
  assert.ok(selects.length > 0, 'the guard saw no selects — it would pass vacuously');
  for (const name of selects) assert.match(name, /^plus_one_(name_prefix|meal)_[1-3]$/, `a dropdown on the +1 step that is not Prefix or Meal: ${name}`);
  assert.doesNotMatch(part, /aria-haspopup="listbox"|role="listbox"/, 'a listbox picker is on the +1 step');
});

test('2 · one screen per +1 — each seat its own step with only its own boxes; the wrapper is not a step', async () => {
  for (const n of [1, 2, 3, 4]) {
    const part = plusPart(await yes(n));
    const wrapper = part.slice(0, part.indexOf('>') + 1);
    assert.doesNotMatch(wrapper, /data-rsvp-step/, `+${n}: the wrapper is a step — a step in a step is a blank screen`);
    const each = screens(part);
    assert.deepEqual([...each.keys()], Array.from({ length: n }, (_, i) => i + 1), `+${n}: screens ${[...each.keys()].join(',')}`);
    for (const [k, body] of each) {
      assert.match(part, new RegExp(`<div data-rsvp-step="[^"]*" data-plus-one-screen="${k}"`), `+${n}: seat ${k} is not its own step`);
      const firsts = [...body.matchAll(/name="plus_one_first_name_(\d)"/g)].map((m) => Number(m[1]));
      assert.deepEqual(firsts, [k], `+${n}: screen ${k} holds seats ${firsts.join(',')}`);
      assert.ok(body.includes(`+${k} · Not sure yet? Leave the name empty.`), `+${n}: screen ${k} does not name its seat`);
    }
  }
});

test('3 · the tick is drawn only with a name — an empty seat has none, a named seat has one', async () => {
  const part = plusPart(await yes(2, [named('a', 'Ben', 'Reyes'), empty('b')]));
  const each = screens(part);
  assert.match(each.get(1)!, /name="plus_one_coming_1"/, 'a named seat has no "They’re coming" tick');
  assert.ok(each.get(1)!.includes('They’re coming'), 'the tick lost its words');
  assert.doesNotMatch(each.get(2)!, /plus_one_coming_/, 'an empty seat shows a tick — the owner: "Tick only shows when there is name written"');
  // …and it is the client's own rule, not only a server render: drawn under `named`, dropped with a cleared name.
  const src = read('[slug]/_components/rsvp-plus-ones.tsx');
  assert.match(src, /\{named \? \(\s*<div data-needed-at="" data-plus-one-coming-row="">/, 'the tick is no longer drawn only while a name is written');
  assert.match(src, /if \(!full\) setComing\(false\);/, 'clearing the name keeps the tick ticked');
});

test('4 · a name without the tick blocks Next — required, every box checked, the calm line, focus at the box', async () => {
  const part = plusPart(await yes(1, [named('a', 'Ben', 'Reyes')]));
  const tick = tagOf(part, 'plus_one_coming_1');
  assert.match(tick, /required=""/, 'the drawn tick is not required — a named +1 would pass unconfirmed');
  assert.match(tick, /data-needed-words="Tick to confirm they’re coming"/, 'the refusal lost its words');
  const walker = read('[slug]/_components/rsvp-one-at-a-time.tsx');
  const go = walker.slice(walker.indexOf('const go = useCallback('), walker.indexOf('// A radio tap is the answer'));
  assert.match(go, /const failing = boxes\.filter\(\(input\) => !input\.checkValidity\(\)\);\s*if \(failing\.length > 0\) \{[\s\S]*?return;\s*\}/, 'Next no longer stops on a box that is not answered');
  assert.ok(go.indexOf('return;') < go.indexOf('show(form, index + delta)'), 'Next moves on before it checks');
  assert.doesNotMatch(go, /reportValidity/, 'Next shows the browser’s bubble again instead of the calm line');
  assert.match(walker, /form\.addEventListener\('invalid', onInvalid, true\)/, 'nothing turns a refusal into the line at the box');
  assert.match(walker, /e\.preventDefault\(\);\s*markNeeded\(e\.target as HTMLInputElement\);/);
  assert.match(walker, /export const RSVP_NEEDED_WORDS = 'Needed to continue';/);
});

test('5 · never pre-ticked — a named seat opens unticked unless it is already on record as attending', async () => {
  for (const status of [null, 'pending', 'declined', 'maybe']) {
    const part = plusPart(await yes(1, [named('a', 'Ben', 'Reyes', status)]));
    assert.doesNotMatch(tagOf(part, 'plus_one_coming_1'), /checked=""/, `a seat at ${status} opened ticked`);
  }
  const back = plusPart(await yes(1, [named('a', 'Ben', 'Reyes', 'attending')]));
  assert.match(tagOf(back, 'plus_one_coming_1'), /checked=""/, 'the guest’s own earlier tick is not read back');
  const box = read('[slug]/_components/tick-box.tsx');
  assert.doesNotMatch(box, /defaultChecked|checked=\{true\}|checked\s*$/m, 'the shared tick box ticks itself');
  // The seat's own reply reaches the card from both loaders.
  assert.match(read('[slug]/_lib/loaders.ts'), /rsvp_status: \(r\.rsvp_status as string \| null\) \?\? null,/);
  assert.match(read('[slug]/invite/reply/page.tsx'), /rsvp_status: s\.rsvpStatus,/);
});

test('6 · an unticked +1 is never saved — dropped before the plan; a ticked one is written as attending', () => {
  const form = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k]! : null) });
  const posted = readSeatNames(
    form({
      plus_one_first_name_1: 'Ben', plus_one_last_name_1: 'Reyes', plus_one_coming_1: '1',
      plus_one_first_name_2: 'Ana', plus_one_last_name_2: 'Cruz',
      plus_one_seat_id_3: 's3', plus_one_first_name_3: '', plus_one_meal_3: 'fish',
    }),
  );
  const { kept, refused } = splitUnconfirmedSeats(posted);
  assert.equal(refused, 1, 'the unticked name was not refused');
  assert.deepEqual(kept.map((n) => n.first || `(details ${n.seatId})`), ['Ben', '(details s3)'], 'an unticked name survived, or a details-only seat was refused');
  assert.equal(kept[0]!.coming, true);
  // A crafted "coming" value other than the box's own is not a tick.
  assert.equal(splitUnconfirmedSeats(readSeatNames(form({ plus_one_first_name_1: 'X', plus_one_coming_1: 'on' }))).refused, 1);

  const actions = read('[slug]/actions.ts');
  const seat = actions.slice(actions.indexOf('async function nameTheSeats('));
  assert.match(seat, /const \{ kept: seatNames, refused: unticked \} = splitUnconfirmedSeats\(readSeatNames\(formData\)\);/, 'the seat write reads names without asking for their tick');
  assert.ok(seat.indexOf('splitUnconfirmedSeats(') < seat.indexOf('planSeatNames('), 'the plan is made before unticked names are dropped');
  assert.match(seat, /const coming = \{ rsvp_status: 'attending' as const, rsvp_set_by: 'guest' as const, rsvp_responded_at: stamp \};/);
  const nameWrite = seat.slice(seat.indexOf("if (op.kind === 'name')"), seat.indexOf('} else {', seat.indexOf("if (op.kind === 'name')")));
  assert.match(nameWrite, /\.\.\.coming,/, 'a ticked seat that already had a row is not written as attending');
  assert.match(seat, /mintStatus === 'ok'\) \{[\s\S]{0,1200}?\.update\(\{ \.\.\.coming, updated_at: stamp \}\)[\s\S]{0,300}?\.eq\('plus_one_of_guest_id', guestId\)/, 'a newly minted seat is not written as attending, or not scoped to this bringer');
  assert.match(seat, /unticked > 0 \? \{ ok: false, error: SEAT_NAME_NOT_TICKED \}/, 'a refused name is not said');
});

test('7 · one tick box for the +1 and the Terms line — filled with the page’s paper, never a white square', () => {
  const box = read('[slug]/_components/tick-box.tsx');
  assert.match(box, /export const TICK_BOX_FILL = 'bg-cream';/, 'the tick box fill is no longer the page’s paper');
  assert.match(box, /aria-hidden="true"\s+className=\{`[^`]*\$\{TICK_BOX_FILL\}/, 'the painted box does not wear the fill');
  assert.doesNotMatch(box, /\bbg-white\b|#fff\b|#ffffff\b/i, 'a white fill — a bright square on a dark Event Hub');
  for (const rel of ['[slug]/_components/terms-tick.tsx', '[slug]/_components/rsvp-plus-ones.tsx']) {
    const src = read(rel);
    assert.match(src, /<TickBox\b/, `${rel} no longer uses the shared tick box`);
    assert.doesNotMatch(src, /type="checkbox"/, `${rel} draws its own checkbox again`);
  }
});
