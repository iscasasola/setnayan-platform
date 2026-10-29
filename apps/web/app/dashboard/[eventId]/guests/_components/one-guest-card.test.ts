/**
 * one-guest-card.test.ts — 🪪 ONE GUEST CARD, EVERYWHERE (owner 2026-10-24, on desktop, with a screenshot: *"the guest card on
 * wedding march is not same with the guest card."*).
 *
 * The Wedding March opened a SECOND card: the same body drawn by the Maker's own hand-drawn kit — no Invite ▾, no "✓ Saved",
 * no Delete, "Photos" for Papic, chevron rows for the approved folds, under a "Guests see this right away" header. The
 * parents on the invitation opened it too. Both were "the shipped card" by every test, because every test read the BODY,
 * and the body was shared — what differed was everything handed to it. So this guard holds the WHOLE card, not the body:
 *
 *   1. ONE component draws a guest's card: `GuestCard` (`guest-card.tsx`) is the only file that renders `GuestCardBody`,
 *      and the only one that imports it for anything but its error sentences.
 *   2. EVERY entry point goes through it — the Guest list's panel (`?inspect=`), the standalone route, the one in-place
 *      action (`openGuestCard`) and the dev labs import `GuestCard`; every Maker surface that opens a guest (the Wedding
 *      March, the parents in Details, Studio › Prints' parents, Details › Parents & hosts) opens `GuestCardSheet`, whose
 *      shipped reader is that one action. A NEW file that draws `GuestCardBody`, or opens a guest's card any other way,
 *      turns this red.
 *   3. The second card is gone, and stays gone: no hand-drawn kit, no way to hand the body another kit, and the two files
 *      that drew the march's card (`march-guest-card.tsx`, `march-card-actions.tsx`) do not come back.
 *
 * NOT CLAIMED: that the sheet looks right at every width — that is the screenshots in the PR
 * (`shots-2026-10-24/one-guest-card/`) and `.sn-inspector-sheet--alone` in globals.css.
 *
 * SABOTAGE (each seen RED, then restored): a `<GuestCardBody` put back in the march lab · `parent-cards.tsx` opening the
 * card without `GuestCardSheet` · `OLD_KIT` restored in the body.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const EVENT = 'app/dashboard/[eventId]';
const CARD = `${EVENT}/guests/_components/guest-card.tsx`;
const SHEET = `${EVENT}/guests/_components/guest-card-sheet.tsx`;

/** Every non-test source file under app/, lib/ and components/. */
function sources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$|\.d\.ts$/.test(e.name)) out.push(p);
    }
  };
  for (const d of ['app', 'lib', 'components']) if (existsSync(join(WEB, d))) walk(d);
  return out;
}
const ALL = sources();
const SRC = new Map(ALL.map((f) => [f, read(f)] as const));

test('the walk reads the tree (anti-vacuity)', () => {
  assert.ok(ALL.length > 2000, `only ${ALL.length} source files — the walk is blind`);
  assert.ok(SRC.get(CARD)?.includes('<GuestCardBody'), 'the one card no longer draws the body — re-anchor this guard');
  assert.equal(relative(WEB, join(HERE, 'guest-card.tsx')), CARD, 'the guard’s root moved');
});

test('1 · ONE component draws a guest’s card: only `GuestCard` renders (or imports) `GuestCardBody`', () => {
  const drawers = ALL.filter((f) => /<GuestCardBody\b/.test(SRC.get(f)!));
  assert.deepEqual(drawers, [CARD], `another file draws the guest card's body — open it through \`GuestCard\` instead:\n  ${drawers.filter((f) => f !== CARD).join('\n  ')}`);
  /* Importing it for its error sentences (`GUEST_CARD_ERROR_COPY`) is not drawing a card. */
  const importers = ALL.filter((f) => /import\s+\{([^}]*)\}\s+from\s+'[^']*guest-card-body'/.test(SRC.get(f)!))
    .filter((f) => {
      const names = [...SRC.get(f)!.matchAll(/import\s+\{([^}]*)\}\s+from\s+'[^']*guest-card-body'/g)].flatMap((m) => m[1]!.split(',').map((n) => n.trim()));
      return names.some((n) => n && !/^type\s/.test(n) && n !== 'GUEST_CARD_ERROR_COPY');
    });
  assert.deepEqual(importers, [CARD], `another file imports the card's body: ${importers.filter((f) => f !== CARD).join(', ')}`);
});

/** Every surface that opens a guest's card, and the one door each goes through. */
const ENTRY_POINTS: Record<string, 'GuestCard' | 'GuestCardSheet'> = {
  [`${EVENT}/guests/page.tsx`]: 'GuestCard', // the Guest list's panel (`?inspect=`) — rail ≥ 1280, sheet below
  [`${EVENT}/guests/[guestId]/page.tsx`]: 'GuestCard', // the standalone route (deep links, a failed save's landing)
  [`${EVENT}/guests/_components/guest-card-in-place.tsx`]: 'GuestCard', // the one in-place read's card (the march, the seats, the parents), drawn in the browser
  [`${EVENT}/launch/_components/details-march.tsx`]: 'GuestCardSheet', // the Wedding March (Guests › March since R4)
  [`${EVENT}/seating/_components/seating-editor.tsx`]: 'GuestCardSheet', // Guests › Seats — a face on the plan or the list (R4)
  [`${EVENT}/launch/_components/parent-cards.tsx`]: 'GuestCardSheet', // the parents under the march / The Invitation
  [`${EVENT}/launch/_components/studio-prints-six.tsx`]: 'GuestCardSheet', // Studio › Prints' parents
  [`${EVENT}/launch/_components/details-people.tsx`]: 'GuestCardSheet', // Details › Parents & hosts
  'app/dev/details-lab/lab-march-cards.tsx': 'GuestCard', // the march lab's stand-in read
  'app/dev/guests-lab/page.tsx': 'GuestCard', // the Guest list lab
};

test('2 · EVERY entry point opens the one card — `GuestCard`, or `GuestCardSheet` whose shipped read draws it', () => {
  for (const [file, door] of Object.entries(ENTRY_POINTS)) {
    const src = SRC.get(file);
    assert.ok(src, `${file} is gone — take it off ENTRY_POINTS (and say where its card opens now)`);
    const from = door === 'GuestCard' ? 'guest-card' : 'guest-card-sheet';
    assert.match(src!, new RegExp(`import \\{[^}]*\\b${door}\\b[^}]*\\} from '[^']*/${from}';`), `${file} does not import ${door}`);
    assert.match(src!, new RegExp(`<${door}\\b`), `${file} imports ${door} but does not open it`);
  }
  /* The sheet's shipped readers ARE the one action, whose answer draws THE card — in the browser (the action answers data:
     `the-settings-sheet-is-in-homes-graph.test.ts`). */
  const sheet = SRC.get(SHEET)!;
  assert.match(sheet, /\(await import\('\.\/guest-card-in-place'\)\)\.openGuestCardInPlace\(eventId, guestId, 'march'\)/);
  assert.match(sheet, /\(await import\('\.\/guest-card-in-place'\)\)\.openGuestCardInPlace\(eventId, guestId, 'invitation'\)/);
  const inPlace = SRC.get(`${EVENT}/guests/_components/guest-card-in-place.tsx`)!;
  assert.match(inPlace, /const r = await openGuestCard\(eventId, guestId, at\);/, 'the in-place card is not read by the one action');
  assert.match(inPlace, /<GuestCard frame="panel"/);
  /* A surface that opens a guest's sheet is an entry point — a new one must be listed (and so read) here. */
  const sheetUsers = ALL.filter((f) => f !== SHEET && /<GuestCardSheet\b/.test(SRC.get(f)!));
  const cardUsers = ALL.filter((f) => f !== CARD && /<GuestCard\b/.test(SRC.get(f)!));
  const unlisted = [...sheetUsers, ...cardUsers].filter((f) => !(f in ENTRY_POINTS));
  assert.deepEqual(unlisted, [], `a surface opens a guest's card without being listed in ENTRY_POINTS: ${unlisted.join(', ')}`);
});

test('3 · the second card is gone and stays gone — one kit, no door for another, no march card of its own', () => {
  const body = SRC.get(`${EVENT}/guests/_components/guest-card-body.tsx`)!;
  assert.match(body, /const K: CardKit = TEMPLATE_KIT;/, 'the card draws its leaves with something other than the templates');
  assert.doesNotMatch(body, /\bOLD_KIT\b|\bkit\?: CardKit\b|\bkit,\n/, 'a second kit (or a way to hand one in) is back');
  for (const gone of [`${EVENT}/launch/_components/march-guest-card.tsx`, `${EVENT}/launch/march-card-actions.tsx`]) {
    assert.equal(existsSync(join(WEB, gone)), false, `${gone} is back — the march opens THE card (guest-card-sheet.tsx)`);
  }
  /* The march's old header — a line the Guest list's card does not carry — is not drawn over a guest's card. */
  assert.doesNotMatch(SRC.get(SHEET)!, /HubSavesImmediately/, 'the guest card’s sheet draws a second header');
  /* No surface keeps a guest's card of its own as a prop (the parents' pre-drawn `card`). */
  for (const f of [`${EVENT}/launch/_components/parent-cards.tsx`, `${EVENT}/launch/_components/studio-prints-six.tsx`, `${EVENT}/launch/_components/maker-details.tsx`, `${EVENT}/launch/_components/details-your-event-parts.tsx`]) {
    assert.doesNotMatch(SRC.get(f)!, /\bcard: ReactNode\b/, `${f} carries a pre-drawn guest card again`);
  }
});
