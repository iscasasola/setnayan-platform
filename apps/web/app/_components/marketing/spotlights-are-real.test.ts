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

/**
 * Every .tsx directly under a shelled route folder (page + its `_sections`),
 * PLUS the in-app surfaces that compose the same kit.
 *
 * ⚠ THE SCAN USED TO BE PUBLIC-ONLY, AND THAT WAS A HOLE. The docblock above
 * says "a page can reference a still that was never captured", and it is just
 * as true inside the dashboard — more so, because a couple only reaches the
 * buy page after deciding to spend money, so a broken frame there is seen at
 * the worst possible moment and by the fewest people who would report it. The
 * Setnayan AI buy surface started composing `Spotlights` on 2026-09-07 and
 * would have been invisible to this guard on the day it shipped.
 *
 * Extra roots are FILES, not a directory walk: the dashboard has hundreds of
 * `.tsx` and this guard is about the handful that name a picture. Add a path
 * here when a new in-app surface composes the kit — the vacuity test below
 * fails if one goes missing.
 */
const EXTRA_SOURCES = [
  'app/dashboard/[eventId]/studio/setnayan-ai/_components/setnayan-ai-value-copy.ts',
] as const;

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
  for (const rel of EXTRA_SOURCES) {
    const abs = join(WEB, rel);
    // Fail loudly rather than silently scanning nothing: a renamed file must
    // update this list, not quietly drop out of the guard.
    assert.ok(existsSync(abs), `EXTRA_SOURCES names a file that does not exist: ${rel}`);
    out.push({ path: rel, src: stripComments(readFileSync(abs, 'utf8')) });
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

test('the scan is not vacuous — it read the doorway pages and the in-app surfaces', () => {
  const paths = sources().map((s) => s.path);
  assert.ok(paths.includes('app/(shell)/papic/_papic-sections.tsx'), 'Papic sections were not scanned');
  assert.ok(paths.includes('app/(shell)/setnayan-ai/page.tsx'), '/setnayan-ai was not scanned');
  for (const rel of EXTRA_SOURCES) {
    assert.ok(paths.includes(rel), `in-app spotlight surface was not scanned: ${rel}`);
  }
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

/**
 * ── EVERY DEMO FILE AN ADD-ON PAGE NAMES, NOT ONLY A SPOTLIGHT'S ───────────
 *
 * The test above reads the three SPOTLIGHT shapes. It did not read the other
 * ways a doorway names a demo file — a bare `src="/add-ons/demo/x.mp4"` /
 * `poster=` on a page's own `<video>`, a `<DemoFilm slug="x">`, the `/pa3d`
 * parts list, or the app cards' `RICH_MEDIA` table — and that is exactly how
 * `/panood` shipped a "This is what turning it on looks like." section around a
 * film that was never recorded: an empty gap on a public page and two 404s on
 * every visit, found by the live quality sweep (2026-10-13, item 2), not by CI.
 *
 * Rule: any `/add-ons/demo/...` file named by a shelled page, and both halves
 * (`.mp4` + its `.jpg` poster) of every film slug, must exist under `public/`.
 * A film that is not recorded yet is OMITTED, never referenced and hidden.
 */
const DEMO_LITERAL = /['"`](\/add-ons\/demo\/[a-z0-9/_-]+\.(?:mp4|webm|jpg|jpeg|png|webp|avif))['"`]/g;
const DEMOFILM_SLUG = /<DemoFilm\b[^>]*?\bslug=["']([a-z0-9-]+)["']/g;

function filmHalves(slug: string): string[] {
  return ['mp4', 'jpg'].map((ext) => `/add-ons/demo/${slug}.${ext}`).filter((rel) => !existsSync(join(PUBLIC, rel)));
}

/** Every .ts/.tsx under a shelled route folder, recursively (a page's private
 *  `_components` included) — the spotlight scan above reads one level only. */
function shelledSourcesDeep(): Array<{ path: string; src: string }> {
  const out: Array<{ path: string; src: string }> = [];
  const walk = (abs: string, rel: string) => {
    for (const f of readdirSync(abs)) {
      const a = join(abs, f);
      const r = `${rel}/${f}`;
      if (statSync(a).isDirectory()) walk(a, r);
      else if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)) out.push({ path: r, src: stripComments(readFileSync(a, 'utf8')) });
    }
  };
  walk(SHELLED, 'app/(shell)');
  for (const rel of ['app/_components/marketing/_demo-film.tsx', 'app/_components/app-store/studio-card-demo.tsx']) {
    out.push({ path: rel, src: stripComments(readFileSync(join(WEB, rel), 'utf8')) });
  }
  return out;
}

test('every demo file an add-on page names exists in public/ (no film that was never recorded)', () => {
  const missing: string[] = [];
  let seen = 0;
  for (const { path, src } of shelledSourcesDeep()) {
    for (const m of src.matchAll(DEMO_LITERAL)) {
      seen++;
      if (!existsSync(join(PUBLIC, m[1]!))) missing.push(`${path} → ${m[1]}`);
    }
    for (const m of src.matchAll(DEMOFILM_SLUG)) {
      seen++;
      for (const rel of filmHalves(m[1]!)) missing.push(`${path} → <DemoFilm slug="${m[1]}"> needs ${rel}`);
    }
  }
  // The app cards' looping films — `m('slug')` rows in RICH_MEDIA.
  const cards = stripComments(readFileSync(join(WEB, 'app/_components/app-store/studio-card-demo.tsx'), 'utf8'));
  const table = cards.slice(cards.indexOf('const RICH_MEDIA'));
  const cardSlugs = [...table.slice(0, table.indexOf('};')).matchAll(/\bm\(\s*['"]([a-z0-9-]+)['"]\s*\)/g)].map((m) => m[1]!);
  assert.ok(cardSlugs.length >= 5, `RICH_MEDIA read ${cardSlugs.length} rows — did its shape change?`);
  for (const slug of cardSlugs) for (const rel of filmHalves(slug)) missing.push(`studio-card-demo.tsx RICH_MEDIA → ${rel}`);
  // /pa3d's three parts each play `PartFilm slug={p.slug}` — the slugs live in PARTS.
  const pa3d = stripComments(readFileSync(join(SHELLED, 'pa3d', 'page.tsx'), 'utf8'));
  const partsBlock = pa3d.slice(pa3d.indexOf('const PARTS'));
  const partSlugs = [...partsBlock.slice(0, partsBlock.indexOf('] as const')).matchAll(/\bslug:\s*['"]([a-z0-9-]+)['"]/g)].map((m) => m[1]!);
  assert.ok(partSlugs.length >= 3, `/pa3d PARTS read ${partSlugs.length} film slugs — did its shape change?`);
  for (const slug of partSlugs) for (const rel of filmHalves(slug)) missing.push(`(shell)/pa3d/page.tsx PARTS → ${rel}`);
  seen += cardSlugs.length + partSlugs.length;

  assert.ok(seen > 10, `the scan found only ${seen} demo references — did the pages change shape?`);
  assert.deepEqual(
    missing,
    [],
    'These demo files are named by an add-on page and do not exist under public/. ' +
      'Record and commit the file, or OMIT the section until it exists — never ship a ' +
      'heading over an empty frame:\n  ' + missing.join('\n  '),
  );
});
