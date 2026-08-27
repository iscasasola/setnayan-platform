import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WIDGET_CATALOG, WIDGET_CATALOG_BY_TYPE } from './invitation-widgets';

/**
 * FOUR PHOTO FEATURES THAT WERE ONE WORD FROM EACH OTHER.
 *
 * A host configuring their Event Hub met, on the same screens:
 *
 *   · "Photo moments"   — when to lift a camera            → now "Camera cues"
 *   · "Our photos"      — the host's own uploaded gallery  → now "Photos you add"
 *   · "Your photos"     — a card promising each guest the
 *                          photos they are tagged in       → now "Each guest's own photos"
 *   · "Photos of you"   — where a guest actually looks at
 *                          theirs. GUEST-FACING ONLY; the host never configures
 *                          it, so it is deliberately unchanged.
 *
 * And the host's own gallery answered to FIVE different names across four
 * screens: "Our photos" in the sections list, "Photo gallery" in the editor
 * row, "Your photos" on that row's upload field AND on the Galleries hub,
 * "Your own gallery" as the sub-page title, "Gallery photos" on its field.
 * Two of those five were the GUEST widget's name.
 *
 * ⚖ THE GUEST-FACING HEADINGS ARE NOT TOUCHED. On the event page, "Our photos"
 * (the host's voice) beside "Your photos" (the reader's own) is addressed to one
 * person and reads correctly. The collision was only ever in the host's chair.
 *
 * 🔑 RENAMING IS A DELETION TO ANYONE WHO KNEW THE OLD NAME — the old names are
 * written down above, and in the changelog fragment, on purpose.
 */

const WEB = process.cwd();
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

/** Every place the HOST is shown a name for one of the three configurable ones. */
const HOST_SURFACES = [
  'app/dashboard/[eventId]/website/widgets/page.tsx', // the sections manager
  'app/dashboard/[eventId]/website/editor/page.tsx', // the one-page editor
  'app/dashboard/[eventId]/website/editor/_components/media-panels.tsx',
  'app/dashboard/[eventId]/website/our-photos/page.tsx',
  'app/dashboard/[eventId]/galleries/page.tsx',
  'app/dashboard/[eventId]/website/photo-moments/page.tsx',
];

/** The names retired by this change. None may reach a host again. */
const RETIRED_HOST_NAMES = [
  'Photo moments',
  'Our photos',
  'Photo gallery',
  'Your own gallery',
  'Gallery photos',
];

test('the three configurable photo names are pairwise distinct', () => {
  const labels = (['photo_moments', 'our_photos', 'your_photos'] as const).map(
    (t) => WIDGET_CATALOG_BY_TYPE[t]?.label ?? '',
  );
  assert.equal(labels.filter(Boolean).length, 3, 'a photo widget lost its label');
  assert.equal(new Set(labels).size, 3, `two photo widgets share a name: ${labels.join(' · ')}`);

  // Distinct is not enough — they must not be one word apart either. No two of
  // them may share their FIRST word, which is what a host scans down a list.
  const firsts = labels.map((l) => l.split(/\s+/)[0]!.toLowerCase());
  assert.equal(
    new Set(firsts).size,
    3,
    `two photo names still open with the same word: ${labels.join(' · ')}`,
  );
});

test('no photo name collides with any other widget in the catalog', () => {
  const all = WIDGET_CATALOG.map((w) => w.label);
  assert.equal(new Set(all).size, all.length, 'two widgets in the catalog share a label');
});

test('a retired photo name never reaches the host again', () => {
  const offenders: string[] = [];
  for (const file of HOST_SURFACES) {
    const src = read(file);
    for (const name of RETIRED_HOST_NAMES) {
      // Quoted — a label, a title, a field. Comments explaining the rename are
      // stripped first, or this guard fires on the note that documents its own fix.
      const stripped = src
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/.*$/gm, (_m, p1: string) => p1);
      if (new RegExp(`['"\`]${name}['"\`]`).test(stripped)) offenders.push(`${file} :: ${name}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `a retired photo name is still shown to the host:\n${offenders.join('\n')}`,
  );
});

test('the photo names and blurbs work for all 17 event kinds, not just a wedding', () => {
  // The catalog is STATIC — it is not resolved per event — so a wedding-only
  // word in one of these is shown to a birthday, a reunion and a wake.
  const WEDDING = /\b(weddings?|couples?|brides?|grooms?|engagement|prenup|pre-wedding)\b/i;
  const offenders: string[] = [];
  for (const type of ['photo_moments', 'our_photos', 'your_photos'] as const) {
    const w = WIDGET_CATALOG_BY_TYPE[type]!;
    if (WEDDING.test(w.label)) offenders.push(`${type} label: ${w.label}`);
    if (WEDDING.test(w.description)) offenders.push(`${type} description: ${w.description}`);
  }
  assert.deepEqual(offenders, [], `a wedding-only word in a name every kind reads:\n${offenders.join('\n')}`);
});
