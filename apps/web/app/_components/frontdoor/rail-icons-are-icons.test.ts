import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * THE SIDE MENU DRAWS ICONS, NOT CHARACTERS.
 *
 * The rail's own rows drew typographic codepoints — ⌂ ◎ ⌕ ▦ ✧ ❖ ✎ ▣ ⛨ ▸ ⌃ ⌄ —
 * while the rows that push in below them (an event's sections, a shop's, the
 * admin's) drew Lucide SVGs. `front-door.css` stated it outright: *"The rail's
 * own rows use glyph characters; the app's nav rows use Lucide icons."* One
 * list, two icon systems, and the seam ran through the middle of the account
 * slot.
 *
 * 🔑 A CHARACTER IS A FONT LOOKUP AND THE FONT DECIDES. These sit in
 * Miscellaneous-Technical and Dingbats, not the Latin the UI font ships, so the
 * platform resolves each one: ⌂ U+2302 is absent from the Android system font,
 * ⛨ U+26E8 is absent nearly everywhere, ⌃/⌄ U+2303/U+2304 are macOS
 * modifier-key glyphs, and ✎/✧ sit in ranges a phone may hand to the EMOJI
 * font. Nothing throws on a miss. The row keeps its label and its tap target,
 * so the only symptom is a wrong-looking glyph or an empty square — the same
 * class of silent absence as a phantom column, a blocked iframe or an
 * unresolved `r2://`. An SVG has no font to miss.
 *
 * 🪤 THIS GUARD STRIPS COMMENTS BEFORE IT MATCHES. Every retired glyph is named
 * in the prose that explains why it went, in this file and in the shell — a
 * raw-source check would report the defect it just fixed and could never go
 * green. Measured: raw source carries them, stripped source carries none, and
 * 0 is the true number.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');

/** Comments stripped, so the guard judges what RENDERS, never what explains. */
function code(path: string): string {
  const src = readFileSync(path, 'utf8');
  assert.ok(src.length > 500, `${path} is missing or a stub.`);
  return src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * The four files that render a row into the shared `.fd-gi` slot. Slice 0's own
 * rows plus the three context groups that push in under them — they are ONE
 * list on screen, so they are one list here.
 */
const RAIL_FILES = [
  'app/_components/frontdoor/front-door-shell.tsx',
  'app/dashboard/[eventId]/_components/event-rail-context.tsx',
  'app/vendor-dashboard/_components/vendor-rail-context.tsx',
  'app/admin/_components/admin-rail-context.tsx',
].map((p) => join(WEB, p));

/**
 * The retired set, by codepoint rather than by pasted character — a pasted
 * glyph in a test file is one normalization away from silently matching
 * nothing, which is a guard that can only pass.
 */
const RETIRED = [
  ['⌂', 'HOUSE — was Home'],
  ['◎', 'BULLSEYE — was Stories'],
  ['⌕', 'TELEPHONE RECORDER — was doing duty as a magnifier'],
  ['▦', 'SQUARE WITH FILL — was Your events'],
  ['✧', 'WHITE FOUR POINTED STAR — was Alaala'],
  ['❖', 'BLACK DIAMOND MINUS WHITE X — was People'],
  ['✎', 'LOWER RIGHT PENCIL — was Your Story'],
  ['▣', 'WHITE SQUARE CONTAINING BLACK — was the shop'],
  ['⛨', 'BLACK CROSS ON SHIELD — was Setnayan HQ'],
  ['▸', 'BLACK RIGHT-POINTING SMALL TRIANGLE — was every category row'],
  ['⌃', 'UP ARROWHEAD — was Show fewer'],
  ['⌄', 'DOWN ARROWHEAD — was Show more'],
] as const;

test('no rail row draws a typographic character where an icon belongs', () => {
  for (const file of RAIL_FILES) {
    const src = code(file);
    for (const [glyph, what] of RETIRED) {
      assert.ok(
        !src.includes(glyph),
        `${file} renders U+${glyph.codePointAt(0)!.toString(16).toUpperCase()} ` +
          `(${what}). A codepoint outside Latin is resolved by whatever font ` +
          `the platform has, and a miss renders an empty square with nothing ` +
          `logged. Use a Lucide component through <RailIcon>.`,
      );
    }
  }
});

test('the rail renders its rows at ONE size and ONE stroke', () => {
  for (const file of RAIL_FILES) {
    const src = code(file);
    const wrong = src.match(/className="h-4 w-4"|className="h-5 w-5"/g) ?? [];
    assert.equal(
      wrong.length,
      0,
      `${file} sizes a rail icon with ${wrong[0]}. The event rail drew 16px ` +
        `while the vendor and admin rails drew 18px, in the SAME visual list — ` +
        `too small to report and enough to make the column read as unaligned. ` +
        `Rail icons are h-[18px] w-[18px] at strokeWidth 1.75.`,
    );
    /*
      🪤 THIS WAS `assert.match(src, /strokeWidth=\{1\.75\}/)` AND IT WAS
      DECORATION. Measured: dropping ONE row to Lucide's default left the file's
      other 1.75 in place, the match still found it, and the run stayed green
      (2 -> 1 occurrences, pass=4 fail=0). A file-level match cannot say which
      row still obeys the rule — the same "a file-level count cannot localise"
      fault this repo has already paid for. So the question is inverted: every
      stroke in the file must BE 1.75, and any other value is the failure.
    */
    const strokes = src.match(/strokeWidth=\{[\d.]+\}/g) ?? [];
    assert.ok(
      strokes.length > 0,
      `${file} renders no icon at all. It is a rail file; it draws rows.`,
    );
    const offKey = strokes.filter((s) => s !== 'strokeWidth={1.75}');
    assert.deepEqual(
      offKey,
      [],
      `${file} draws ${offKey.length} icon(s) at ${offKey.join(', ')}. ` +
        `Lucide's default of 2 beside the 1.75 every other rail row uses reads ` +
        `as two weights of icon in one list.`,
    );
  }
});

test('every category row draws its OWN icon, from the map the app already owns', () => {
  const src = code(RAIL_FILES[0]!);
  assert.match(
    src,
    /folderIcon\(f\.slug\)/,
    'The fifteen category rows must draw `folderIcon(f.slug)`. They drew the ' +
      'same arrow fifteen times while `WEDDING_FOLDER_ICON` — exhaustive over ' +
      'the taxonomy and pinned by `taxonomy-icons.test.ts` — was already ' +
      'giving each of them a distinct icon on the Explore strip. A second ' +
      'hand-typed map here is how a rail and a page start disagreeing about ' +
      'what a category looks like.',
  );
});

test('the icon slot is centred for every chrome, not just the app trees', () => {
  const css = readFileSync(
    join(WEB, 'app/_components/frontdoor/front-door.css'),
    'utf8',
  );
  const slot = css.match(/\.fd-gi \{[^}]*\}/)?.[0] ?? '';
  assert.match(
    slot,
    /display: flex/,
    '`.fd-gi` must centre its child itself. Positioning an SVG from a rule ' +
      "scoped to `[data-chrome='app']` left the same rail's icons uncentred on " +
      'the public front door and the eight product doorways, which mount it as ' +
      "chrome=\"front-door\".",
  );
  assert.doesNotMatch(
    css,
    /\[data-chrome='app'\] \.fd-gi > svg/,
    'A chrome-scoped positioning rule for the icon slot is back. That scoping ' +
      'is exactly what let the public doorways drift from the app trees.',
  );
});
