import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { WEB_LONG_EDGE } from './video-compress';

/**
 * THE COPY WE KEEP FOREVER MUST STILL BE WORTH WATCHING.
 *
 * 🔒 OWNER, 2026-08-07: *"we already have a plan for the size of the photo and
 * video. it should still be viewable."*
 *
 * The plan is not invented here — it is the corpus:
 *   · `Papic_Good_Better_Best_Pricing_2026-07-17.md` §4 — the kept clip copy is
 *     "compressed clip copies (**720p-class**)".
 *   · `Papic_Pricing_Plan_of_Action_2026-07-20.md` — "compressed gallery
 *     (**AVIF long-edge 1280**)".
 *   · `Papic_Storage_Sustainability_Spec_2026-07-22.md` — the stated goal is
 *     "every Papic memory survives forever, **at viewable resolution**".
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * 🚨 VIDEO SHIPPED AT HALF THE PLANNED RESOLUTION AND NOTHING NOTICED. The web
 * copy capped the long edge at 854 px — a 480 px short side, i.e. 480p — against
 * a documented 720p-class. Photos were correct at 1280 the whole time, which is
 * exactly why it survived: the half anyone checked was right.
 *
 * That matters more than a normal drift because this copy is the one we keep
 * after the original is replaced. A number that is merely "small enough" quietly
 * decides what a couple still has years later.
 *
 * 🔑 THESE ASSERTIONS ARE FLOORS, NOT EQUALITIES. Going HIGHER than the plan is
 * a cost decision, not a defect — the guard must not block someone improving
 * quality. It only catches the direction that silently takes something away.
 */

const WEB = process.cwd();

/** A Papic clip is portrait 9:16 by convention — the phone-native shape. */
const PORTRAIT_SHORT_OVER_LONG = 9 / 16;

test('🔒 the kept CLIP copy is 720p-class, per the owner plan', () => {
  const shortEdge = Math.round(WEB_LONG_EDGE * PORTRAIT_SHORT_OVER_LONG);
  assert.ok(
    shortEdge >= 720,
    `a 9:16 clip web copy lands ${shortEdge}px on its short edge — the plan is ` +
      `720p-class. This copy is what survives after the original is replaced, so ` +
      `dropping below 720 takes real quality away from the couple permanently. ` +
      `(It was 480 until 2026-08-07.)`,
  );
});

test('🔒 the kept PHOTO copy is long-edge 1280, per the owner plan', () => {
  const src = readFileSync(join(WEB, 'lib/papic-derivatives.ts'), 'utf8');
  const m = src.match(/const DISPLAY_LONG_EDGE\s*=\s*(\d+)/);
  assert.ok(m, 'DISPLAY_LONG_EDGE not found — update this guard with the new name');
  const longEdge = Number(m![1]);
  assert.ok(
    longEdge >= 1280,
    `the kept photo copy is ${longEdge}px on its long edge; the plan is 1280.`,
  );
});

test('🪤 the profile NAME must not out-date the size it produces', () => {
  // The profile was called 'web480' while the plan said 720p — the name was the
  // most visible statement of the wrong number, repeated at every call site.
  // Renaming the value (not just documenting it) is the house rule: a comment
  // does not travel with a value into a call site.
  const src = readFileSync(join(WEB, 'lib/video-compress.ts'), 'utf8');
  assert.ok(src.length > 500, 'self-check: video-compress.ts read as near-empty');
  assert.ok(
    !/'web480'/.test(src),
    "the profile is still called 'web480' — it no longer produces 480p",
  );

  const shortEdge = Math.round(WEB_LONG_EDGE * PORTRAIT_SHORT_OVER_LONG);
  const named = src.match(/'web(\d+)'/);
  if (named) {
    assert.equal(
      Number(named[1]),
      shortEdge,
      `the profile is named 'web${named[1]}' but produces a ${shortEdge}px short ` +
        `edge. Rename it, or the next reader trusts the name over the maths.`,
    );
  }
});

test('both kept copies share ONE long edge, so they cannot drift apart', () => {
  const src = readFileSync(join(WEB, 'lib/papic-derivatives.ts'), 'utf8');
  const photo = Number(src.match(/const DISPLAY_LONG_EDGE\s*=\s*(\d+)/)![1]);
  assert.equal(
    WEB_LONG_EDGE,
    photo,
    'photo and clip web copies use different long edges. They are the same ' +
      'promise to the same person on the same screen; one number is easier to ' +
      'defend than two, and two is how the video half fell to 480p unnoticed.',
  );
});
