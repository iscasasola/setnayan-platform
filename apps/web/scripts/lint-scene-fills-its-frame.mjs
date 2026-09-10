#!/usr/bin/env node
/**
 * lint-scene-fills-its-frame — a NEW demo scene may not ship with its content
 * shoved to the top of a frame two and a half times its height.
 *
 * ─── WHY ──────────────────────────────────────────────────────────────────
 * `capture-demo-stills.mjs` photographs each scene into a 460×972 frame, and
 * `_spotlights.tsx` renders that frame at its full 9:19 on eight public product
 * pages and on the Setnayan AI buy page. A scene laid out as
 * `absolute inset-0 flex flex-col` with short content therefore ships a picture
 * whose bottom two thirds are blank. Owner, 2026-09-08, looking at the Setnayan
 * AI spotlights: *"reframe it"*.
 *
 * ⚠ THIS IS NOT THE DEFECT `lint-demo-capture-geometry.mjs` GUARDS, and telling
 * them apart is the point. That one was a viewport SMALLER than the recorded
 * frame, so Playwright composited each frame 1:1 into the top-LEFT corner and
 * padded the right as well — content ended at x=229 of 460. Here the geometry
 * is correct (460×972 in, 460×972 out) and content spans the FULL WIDTH; only
 * the vertical slack is wrong. Two different bugs that produce a similar-looking
 * picture. **Check the width to know which one you have.**
 *
 * ─── WHY A BASELINE ───────────────────────────────────────────────────────
 * 23 scenes across 12 products are already like this. Fixing one is a
 * LOOK-AT-IT job, not a mechanical edit: centring a scene whose content
 * OVERFLOWS clips its first row instead of its last, which is worse, and no
 * source check can tell a short scene from a tall one. So the existing ones are
 * recorded and a NEW one is refused — the same shape as
 * `ugat-concept.baseline.txt`.
 *
 * 🔑 NEVER regenerate the baseline to go green. Adding a line is saying "this
 * picture is half empty on a public page and I am leaving it that way".
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'app', '_components', 'app-store', 'studio-card-demo.tsx');
const BASELINE = join(HERE, '..', 'app', '_components', 'app-store', 'scene-fill.baseline.txt');

/** Every scene's root class list, keyed `BLOCK:index`. */
function scenes() {
  const src = readFileSync(SRC, 'utf8');
  const out = [];
  const blocks = src.matchAll(/const ([A-Z_]+_SCENES): RichFrame\[\] = \[([\s\S]*?)\n\];/g);
  for (const b of blocks) {
    const name = b[1];
    const body = b[2] ?? '';
    let i = 0;
    for (const m of body.matchAll(/<div className="absolute inset-0([^"]*)"/g)) {
      out.push({ id: `${name}:${i}`, cls: m[1] ?? '' });
      i += 1;
    }
  }
  return out;
}

/**
 * A scene "fills" when it centres its own content. `justify-center` on the
 * column, or `items-center` where the layout centres the other way, both count.
 * Anything else lets short content sit at the top and the slack fall below it.
 */
const fills = (cls) => cls.includes('justify-center') || cls.includes('items-center');

const all = scenes();
if (all.length === 0) {
  console.error('✗ read no scenes at all — did studio-card-demo.tsx change shape?');
  process.exit(1);
}

const offenders = all.filter((s) => !fills(s.cls)).map((s) => s.id);

if (process.argv.includes('--write')) {
  const head = readFileSync(BASELINE, 'utf8').split('\n').filter((l) => l.startsWith('#'));
  writeFileSync(BASELINE, `${head.join('\n')}\n${offenders.join('\n')}\n`);
  console.log(`wrote baseline — ${offenders.length} top-aligned scene(s)`);
  process.exit(0);
}

const baseline = new Set(
  readFileSync(BASELINE, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#')),
);

const isNew = offenders.filter((id) => !baseline.has(id));
// A baseline line for a scene that now fills (or no longer exists) is a rule
// that cannot fire — the same rot `spotlights-are-real` guards against.
const stale = [...baseline].filter((id) => !offenders.includes(id));

if (isNew.length === 0 && stale.length === 0) {
  console.log(`✓ scene framing — ${all.length} scenes, ${baseline.size} known top-aligned`);
  process.exit(0);
}

if (isNew.length > 0) {
  console.error('✗ A new demo scene top-aligns its content inside the 460×972 capture frame.');
  console.error('  The still photographed from it will be blank below the content, on a');
  console.error('  public product page. Centre it (`justify-center`) and re-capture:');
  console.error('    pnpm capture:stills <slug>      # needs the dev server up');
  for (const id of isNew) console.error(`    ${id}`);
}
if (stale.length > 0) {
  console.error('✗ The baseline names scenes that no longer top-align (or no longer exist).');
  console.error('  A rule that cannot fire protects nothing — regenerate with --write:');
  for (const id of stale) console.error(`    ${id}`);
}
process.exit(1);
