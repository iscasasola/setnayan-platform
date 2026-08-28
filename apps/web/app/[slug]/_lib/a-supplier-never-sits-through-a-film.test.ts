/**
 * A SUPPLIER NEVER SITS THROUGH A FILM TO GET TO WORK.
 *
 * hub2, 2026-08-28. The desk now has a call sheet that opens months before the
 * day — and months before the day is exactly when the celebration's page is the
 * Save-the-Date film: `fixed inset-0 z-[50]`, with the reveal veil above it at
 * z-[60]. The supplier's strip renders in ordinary document flow underneath
 * both, so a booked photographer signing in to check the address got a wedding
 * film and no visible way to their own call sheet. A fix nobody can reach is no
 * fix — this project has paid for that three times.
 *
 * ── WHY THESE ASSERTIONS ────────────────────────────────────────────────────
 * The failure is invisible at runtime in the worst way: every element renders,
 * nothing errors, and the only symptom is that one person cannot see something.
 * So the two facts that make it impossible are pinned instead:
 *
 *   1. The ribbon's layer is ABOVE the whole Save-the-Date stack — and the
 *      stack's own numbers are READ OUT OF ITS FILES, never re-typed here. A
 *      hardcoded "70" would keep passing on the day somebody raises the film.
 *   2. It gets out of the film through the film's OWN shipped exit event, so
 *      the veil retires with it and the visitor's "Watch our film" return still
 *      works. The film is a paid product; it is lifted, never spent.
 *
 * Run from inside this directory: `npx tsx --test ./a-supplier-never-sits-through-a-film.test.ts`
 * 🪤 With a bracketed path it prints "# tests 0" and exits GREEN — and so does
 * every `--test` invocation that matches nothing. Require a NON-ZERO count.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SLUG_TREE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS = join(SLUG_TREE, '_components');
const read = (p: string) => readFileSync(join(COMPONENTS, p), 'utf8');

/** Comments here quote the stack's own z-indexes at length; prose about the
 *  defect must never be mistaken for the defect. */
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const RIBBON = strip(read('supplier-ribbon.tsx'));
const BODY = strip(read('site-body.tsx'));

/** Every component that can be on screen during the Save-the-Date takeover. */
const STACK = [
  'save-the-date-film.tsx',
  'std-film-handoff.tsx',
  'save-the-date.tsx',
  'reveal/reveal-overlay.tsx',
  'reveal/std-touch-glow.tsx',
  'reveal/veil-reveal.tsx',
];

function layers(src: string): number[] {
  return [...src.matchAll(/z-\[(\d+)\]/g)].map((m) => Number(m[1]));
}

test('the ribbon sits above every layer the Save-the-Date takeover can raise', () => {
  const stackTop = Math.max(
    ...STACK.flatMap((f) => layers(strip(read(f)))),
    // A file with no numeric z at all contributes nothing; the spread above
    // would then be -Infinity, which would make this test vacuously true.
    0,
  );
  assert.ok(stackTop >= 50, `read only ${stackTop} from the takeover stack — this guard is blind`);

  const ribbonLayers = layers(RIBBON);
  assert.equal(ribbonLayers.length, 1, 'the ribbon should declare exactly one layer');
  assert.ok(
    (ribbonLayers[0] ?? 0) > stackTop,
    `the ribbon is at z-[${ribbonLayers[0]}] and the film stack reaches z-[${stackTop}] — a booked ` +
      'supplier would be looking at somebody else’s wedding film with no way to their call sheet',
  );
  assert.match(
    RIBBON,
    /sticky top-0/,
    'sticky, not fixed — the host ribbon beside it made this call already: it stays reachable ' +
      'while the page scrolls without taking the page out of flow',
  );
});

test('it leaves the film the film’s own way, so the veil retires with it', () => {
  assert.match(RIBBON, /STD_FILM_EXIT_EVENT/);
  assert.match(RIBBON, /window\.dispatchEvent\(new CustomEvent\(STD_FILM_EXIT_EVENT\)\)/);
  // reveal-overlay.tsx listens for that same event and retires the veil, and
  // std-film-handoff.tsx listens for it and lifts the film — with a "Watch our
  // film" control to bring both back. Hiding either by hand here would break
  // the return trip and spend a paid product.
  assert.match(strip(read('reveal/reveal-overlay.tsx')), /addEventListener\(STD_FILM_EXIT_EVENT/);
  assert.match(strip(read('std-film-handoff.tsx')), /addEventListener\(STD_FILM_EXIT_EVENT/);
  assert.doesNotMatch(
    RIBBON,
    /display\s*[:=]\s*['"]none|\.remove\(\)|unmount/i,
    'the ribbon must not dismantle the film itself — it asks, and the film answers',
  );
});

test('the ribbon and the strip agree on one anchor, from one constant', () => {
  assert.match(RIBBON, /export const SUPPLIER_DESK_ANCHOR = 'your-desk';/);
  assert.match(RIBBON, /getElementById\(SUPPLIER_DESK_ANCHOR\)/);
  for (const file of ['supplier-desk.tsx', 'vendor-doorway.tsx']) {
    const src = strip(read(file));
    assert.match(
      src,
      /id=\{SUPPLIER_DESK_ANCHOR\}/,
      `${file} must carry the anchor — the ribbon scrolls to it, and a hand-typed second copy of ` +
        'the id is how a button comes to scroll to nothing',
    );
  }
});

test('nobody but a booked supplier gets a ribbon, and only under the film', () => {
  assert.match(
    BODY,
    /\{vendorCapability && plan\.body === 'save_the_date' \? \(\s*\n?\s*<SupplierRibbon/,
    'both conditions — the proved booking, and the one phase where the desk is covered',
  );
  assert.equal(
    (BODY.match(/<SupplierRibbon/g) ?? []).length,
    1,
    'one mount — a second is a second gate to forget',
  );
});

test('the ribbon discloses nothing that needed a second gate', () => {
  // Everything on it is either the capability the server already proved, or a
  // value the desk model resolved under the supplier's own session. A ribbon
  // that read the event itself would be a second, unaudited disclosure path.
  const mount = /<SupplierRibbon[\s\S]*?\/>/.exec(BODY)?.[0] ?? '';
  assert.ok(mount, 'could not find the mount — this guard is blind, fix it');
  const props = [...mount.matchAll(/^\s*(\w+)=/gm)].map((m) => m[1]);
  assert.deepEqual(
    props.sort(),
    ['businessName', 'hasDesk', 'when'],
    'the ribbon gained a prop — check where its value comes from before allowing it',
  );
  assert.doesNotMatch(RIBBON, /supabase|createClient|\.from\(|\.rpc\(/, 'it reads nothing itself');
});
