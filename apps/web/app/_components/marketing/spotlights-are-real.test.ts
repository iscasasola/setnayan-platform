/**
 * EVERY SPOTLIGHT PICTURE EXISTS ON DISK.
 *
 * ── WHY ────────────────────────────────────────────────────────────────────
 * The feature spotlights (`_spotlights.tsx`) promise "one picture of the
 * product" per idea, and the picture is the honesty test: a still of the real
 * demo scene, our own demo celebration's photograph, or the product's own
 * film. A path typed into a page that no file answers is a broken image on a
 * public, indexed page — a fake door, in a picture frame — and nothing in the
 * build catches it: Next serves `public/` verbatim and a missing file is a
 * 404 at request time, invisible until somebody looks.
 *
 * Stills in particular are GENERATED (`scripts/capture-demo-stills.mjs`), so
 * the failure mode is real: a page can reference `<slug>-3.jpg` for a scene
 * that was never captured, or that a later scene edit renumbered.
 *
 * ── HOW ────────────────────────────────────────────────────────────────────
 * Scan the doorway pages and their section files for the three media shapes
 * the renderer accepts, and `stat` each one under `public/`. Comments are
 * stripped first with the repo's one string-aware stripper, so a docblock
 * quoting an old path cannot fail the guard — or pass it.
 *
 * The scan asserts it read something: a guard over zero references protects
 * nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const PUBLIC = join(WEB, 'public');
const SHELLED = join(WEB, 'app', '(shell)');

/** Every .tsx directly under a shelled route folder (page + its `_sections`). */
function sources(): Array<{ path: string; src: string }> {
  const out: Array<{ path: string; src: string }> = [];
  for (const route of readdirSync(SHELLED)) {
    const dir = join(SHELLED, route);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.tsx')) continue;
      out.push({ path: `app/(shell)/${route}/${f}`, src: stripComments(readFileSync(join(dir, f), 'utf8')) });
    }
  }
  return out;
}

const STILL = /['"](\/add-ons\/demo\/stills\/[a-z0-9-]+\.jpg)['"]/g;
const PHOTO = /['"](\/demo\/[a-z0-9/_-]+\.(?:webp|jpg|png|avif))['"]/g;
/** `{ kind: 'film', slug: 'x' }` → both the .mp4 and its poster .jpg must exist. */
const FILM = /kind:\s*['"]film['"]\s*,\s*slug:\s*['"]([a-z0-9-]+)['"]/g;

test('every spotlight still, photo and film named by a doorway is a real file', () => {
  const files = sources();
  const missing: string[] = [];
  let seen = 0;

  for (const { path, src } of files) {
    for (const m of src.matchAll(STILL)) {
      const rel = m[1];
      if (!rel) continue;
      seen++;
      if (!existsSync(join(PUBLIC, rel))) missing.push(`${path} → ${rel}`);
    }
    for (const m of src.matchAll(PHOTO)) {
      const rel = m[1];
      if (!rel) continue;
      seen++;
      if (!existsSync(join(PUBLIC, rel))) missing.push(`${path} → ${rel}`);
    }
    for (const m of src.matchAll(FILM)) {
      const slug = m[1];
      if (!slug) continue;
      seen++;
      for (const ext of ['mp4', 'jpg']) {
        const rel = `/add-ons/demo/${slug}.${ext}`;
        if (!existsSync(join(PUBLIC, rel))) missing.push(`${path} → ${rel}`);
      }
    }
  }

  assert.ok(seen > 0, 'the scan found no media references at all — did the shape of a page change?');
  assert.deepEqual(
    missing,
    [],
    `These pictures are named on a public page and do not exist under public/. ` +
      `A missing picture is a fake door in a frame. Capture the still ` +
      `(pnpm capture:stills <slug>) or fix the path:\n  ${missing.join('\n  ')}`,
  );
});

test('the scan is not vacuous — it read the doorway pages', () => {
  const paths = sources().map((s) => s.path);
  assert.ok(paths.includes('app/(shell)/papic/_papic-sections.tsx'), 'Papic sections were not scanned');
  assert.ok(paths.includes('app/(shell)/setnayan-ai/page.tsx'), '/setnayan-ai was not scanned');
});

/**
 * ── THE FRAMES THAT MAY NOT BE A SPOTLIGHT'S PICTURE ───────────────────────
 *
 * 🔑 A PICTURE IS A CLAIM. Every one of these was chosen once, by reading the
 * scene's CAPTION and never opening the frame — and each one shows something
 * the page it landed on is forbidden to say. Caught on 2026-09-05 by looking
 * at the images, which is the only thing that catches it.
 *
 * Each entry carries WHY, because a banned list whose reasons are lost gets
 * "tidied" back in by the next reader who thinks it looks arbitrary.
 */
const BANNED_STILLS: ReadonlyArray<{ file: string; why: string }> = [
  {
    file: '/add-ons/demo/stills/animated-monogram-1.jpg',
    why:
      'the frame carries a PRICE ("One price for your wedding · …") and an ' +
      '"Upgrade" pill. Every doorway quotes NO price — prices are admin-managed ' +
      'and move, and a screenshot of one is a number nothing watches: the drift ' +
      'checker reads source literals, and a JPEG is not source. ' +
      '⚠ THE REASON IS DELIBERATELY NOT THE FIGURE. It said "₱1,000" for one ' +
      'day and the SKU was repriced to ₱500 the next, which would have left a ' +
      'ban justified by a number that no longer existed. The objection is that ' +
      'a price is there at all.',
  },
  /*
    ⚖ THE FOUR `custom-qr-guest` FRAMES WERE BANNED HERE ON 2026-09-05 AND ARE
    UNBANNED ON 2026-09-06 — because their REASON stopped being true, not
    because anyone decided to tolerate them.

    They were banned for showing the PAID branded QR ("CUSTOM QR PER GUEST"
    over the monogram · "Your branded QR cards are ready" · the branded print
    pack · a "Default — free / Upgrade" tier pill) on a page allowed to claim
    only the free per-guest QR. The owner then ruled: *"keep custom QR per guest
    free"*. `CUSTOM_QR_GUEST` joined `FREE_FOR_ALL_SKUS`, the scene's pill was
    corrected to "Plain / Branded — Free", and every frame was re-captured. The
    branded QR IS the free one now, so a picture of it is a true picture.

    🔑 A BAN WHOSE REASON HAS EXPIRED IS WORSE THAN NO BAN — it teaches the next
    reader something false about the product. Removed deliberately, with the
    history kept here, rather than left standing as folklore.
  */
];

test('no doorway illustrates itself with a banned frame', () => {
  const offences: string[] = [];
  for (const { path, src } of sources()) {
    for (const { file, why } of BANNED_STILLS) {
      if (src.includes(file)) offences.push(`${path} → ${file}\n      because ${why}`);
    }
  }
  assert.deepEqual(
    offences,
    [],
    'These frames may not be a spotlight\'s picture:\n  ' + offences.join('\n  '),
  );
});

test('every banned frame still exists — a rotted ban protects nothing', () => {
  // The sibling of the rule above: if a still is deleted or renumbered, this
  // list silently stops matching anything and the next reader inherits a guard
  // that cannot fire. Fail here instead, so the ban is re-stated against the
  // frame that replaced it.
  for (const { file } of BANNED_STILLS) {
    assert.ok(
      existsSync(join(PUBLIC, file)),
      `${file} is banned from spotlights but no longer exists. Re-point or ` +
        'remove the ban deliberately — do not leave a rule that cannot fire.',
    );
  }
});
