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
 *     "compressed clip copies (**720p-class**)"  ← the FLOOR, since raised.
 *   · `Papic_Pricing_Plan_of_Action_2026-07-20.md` — "compressed gallery
 *     (**AVIF long-edge 1280**)"  ← the FLOOR, since raised.
 *
 * 🗣 A RAISE TO 1920 WAS PROPOSED AND DECLINED, 2026-08-07. The owner named the
 * screen — *"how about on flat screen TV?… like 42 inch led tv"* — and a 42" set
 * is 1920×1080 native, so 1280 IS upscaled ~1.5× there. I argued for 1920/1080p
 * on that basis; the owner answered *"no. let's stay with 720p."* The plan
 * figures above are therefore the CURRENT numbers, not just historical floors.
 *
 * ⛔ Recorded rather than silently reverted, because the argument is a good one
 * and a future session will re-derive it. It was made in full and declined.
 * Raising these is an OWNER decision, not an engineering one.
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
 * 🔑 THESE ASSERTIONS ARE FLOORS, NOT EQUALITIES. Going HIGHER is a cost
 * decision, not a defect — the guard must never block someone improving quality.
 * It only catches the direction that silently takes something away.
 *
 * 🚨 AND THE REASON THE NUMBERS MATTER AT ALL: this is the ONLY copy the gallery
 * ever shows or plays. `clipPlaybackRef()` prefers `clip_web_r2_key` from day
 * one and the corpus is explicit that "full-res is a download, never streamed" —
 * so these are not fallback sizes for after the retention window. They are the
 * product's picture quality, on every screen, permanently.
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
    `the kept photo copy is ${longEdge}px on its long edge; the plan is 1280 ` +
      `(owner-reaffirmed 2026-08-07). This is the ONLY copy the gallery ever ` +
      `shows — the original is a download, never displayed — so going BELOW this ` +
      `takes picture quality away permanently.`,
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

test('🪤 the CLIP copy may never be weaker than the PHOTO copy', () => {
  // The invariant that actually encodes the failure. Video is the half nobody
  // spot-checks: photos were correct at 1280 while clips sat at 480, and the
  // right-looking half is what let the wrong half survive. So rather than
  // demanding one shared number, pin the DIRECTION — clips must be at least as
  // generous as photos. Motion is watched full-screen more often than a still
  // is, so video being the weaker copy is never the intended outcome.
  const src = readFileSync(join(WEB, 'lib/papic-derivatives.ts'), 'utf8');
  const photo = Number(src.match(/const DISPLAY_LONG_EDGE\s*=\s*(\d+)/)![1]);
  assert.ok(
    WEB_LONG_EDGE >= photo,
    `the clip copy (${WEB_LONG_EDGE}px long edge) is smaller than the photo copy ` +
      `(${photo}px). That is the exact shape of the 480p-vs-1280 drift: the video ` +
      `half quietly falling behind the half that gets checked.`,
  );
});

test('🗣 720p is an OWNER decision — a future session must not quietly raise it', () => {
  // The 1080p case is genuinely arguable and WILL be re-derived: this copy is
  // what plays from day one (clipPlaybackRef prefers clip_web_r2_key; full-res is
  // a download, never streamed), and a LANDSCAPE clip at 720p is upscaled 1.5x on
  // a 1080p TV. It was argued in full on 2026-08-07 and the owner answered "no.
  // let's stay with 720p."
  //
  // So this asserts the REASONING IS STILL ON FILE, not the number — the number
  // is already pinned by the floor above. If someone raises it deliberately with
  // the owner, they change the note and this passes. If someone raises it by
  // accident, they hit a test that tells them whose call it is.
  const src = readFileSync(join(WEB, 'lib/video-compress.ts'), 'utf8');
  assert.match(
    src,
    /720p IS THE OWNER'S DECISION/,
    'the note recording that 720p is an owner decision (not an engineering one) ' +
      'has been removed from video-compress.ts. Put it back, or the next reader ' +
      'will re-make the 1080p argument from scratch and think it is new.',
  );
});
