/**
 * THE ROOM MUST SAY WHAT IT IS NOT SHOWING.
 *
 * Reception-design attributes can be MULTI-select. The couple picks, say,
 * "draped fabric + fairy lights" for a ceiling — and then:
 *
 *   · the mood board, the printable and the concept PDF render BOTH (`selAll`)
 *   · every 3D consumer draws ONE, the primary (`sel`)
 *
 * That asymmetry is intended and is not the defect. The defect is leaving it
 * unsaid: the couple sees both treatments everywhere they look except the room,
 * and reasonably concludes the room is showing their combination. Nothing
 * errors, nothing logs, and the misunderstanding survives until they are
 * standing in a venue that does not match the picture they booked against.
 *
 * ⚠ THE COPY MAKES A FACTUAL CLAIM, SO THE INVARIANT BEHIND IT IS PINNED FIRST.
 * The disclosure names a specific treatment — "The 3D room draws Draped fabric
 * only" — and that sentence is TRUE only while `sel(...)` === `selAll(...)[0]`.
 * If that ever stopped holding, the disclosure would not merely go stale; it
 * would confidently name the wrong treatment, which is worse than saying
 * nothing. So the invariant is a test here, not an assumption quoted from a
 * docblock.
 *
 * Contract: "Mood Board → 3D Plan", rule 04 — say what the room is not showing.
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts") from `apps/web`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { sel, selAll, RECEPTION_PARTS, type ReceptionDesign, type PartId } from './reception-scene';

const EDITOR = join(
  import.meta.dirname, '..', 'app', 'dashboard', '[eventId]', 'seating', 'lab',
  '_components', 'reception-design-editor.tsx',
);

/* ── 1 · THE INVARIANT THE COPY DEPENDS ON ────────────────────────────────── */

test('sel() is always selAll()[0] — the treatment the disclosure names', () => {
  // Swept across every part+attribute the product ships, not one hand-picked
  // pair: the claim is made on every multi-select card, so it must hold for all.
  let multiSeen = 0;
  for (const part of RECEPTION_PARTS) {
    for (const attr of part.attributes) {
      if (attr.multi === true) multiSeen += 1;
      const twoPicked = attr.options.slice(0, 2).map((o) => o.id);
      const design = { [part.id]: { [attr.id]: twoPicked } } as ReceptionDesign;
      assert.equal(
        sel(design, part.id as PartId, attr.id),
        selAll(design, part.id as PartId, attr.id)[0],
        `${part.id}.${attr.id}: the room's primary diverged from selAll[0], so the ` +
          'disclosure would name a treatment the room is not drawing.',
      );
    }
  }
  assert.ok(multiSeen > 0, 'no multi-select attributes ship — the disclosure would be dead code');
});

test('a single pick is not "one of several" — nothing to disclose', () => {
  const part = RECEPTION_PARTS.find((p) => p.attributes.some((a) => a.multi === true))!;
  const attr = part.attributes.find((a) => a.multi === true)!;
  const one = { [part.id]: { [attr.id]: [attr.options[0]!.id] } } as ReceptionDesign;
  assert.equal(selAll(one, part.id as PartId, attr.id).length, 1);
});

/* ── 2 · THE DISCLOSURE REACHES THE RENDER (rule 05) ──────────────────────── */

const src = () => stripComments(readFileSync(EDITOR, 'utf8'));

test('the editor discloses only when more than one treatment is chosen', () => {
  assert.match(
    src(),
    /attr\.multi === true && chosen\.length > 1/,
    'the note must be gated on an ACTUAL multi-pick. A bare /chosen.length > 1/ ' +
      'is not enough: primaryLabel() already contains that exact expression for ' +
      'its "+1" chip summary, so the loose assertion matched a different line ' +
      'entirely and survived deleting this gate.',
  );
});

test('it NAMES the treatment the room draws, not a generic "one of several"', () => {
  const s = src();
  assert.match(
    s,
    /attr\.options\.find\(\(o\) => o\.id === chosen\[0\]\)/,
    'the disclosure must resolve the primary option to its LABEL — telling the ' +
      'couple the room shows "one of several" leaves them guessing which, which ' +
      'is the misunderstanding this exists to end.',
  );
  assert.match(s, /The 3D room draws/, 'the sentence itself must be mounted');
});
