/**
 * ⚙ THE HUB'S ⚙ EVENT HUB SETTINGS HOLDS THE REST — owner, 30 Oct: *"Stages and the Studio will be on dropdown. move all
 * other details on the settings."* (DECISION_LOG 2026-10-30 "EVENT PRO (look redesign)"; 2026-10-27 "LOOK MOVES TO
 * EVENT HUB SETTINGS" · "INFO SPLITS BY WHAT IT IS ABOUT" · "STUDIO IS LOOK AND WORDS ONLY"; 2026-10-26 "EACH MENU HAS
 * ITS OWN SETTINGS"; prototype `prototypes/build-contracts-2026-10-30/event-hub-pro/` "⚙ Settings").
 *
 *   1 · ONE sheet, grouped by topic in the prototype's order — Look · Your Event Hub · What guests see · E-Gifts — and
 *       one closing line sending the event's own facts (names · date · venues · parents) to Home › Event settings;
 *   2 · LOOK: one row per Look section, each opening the shipped Look editor on THAT section, in the Maker;
 *   3 · YOUR EVENT HUB: the shipped "More for guests" rows, OPEN — built by the one builder Info's fold uses
 *       (`hubSettingsEditor`), handed to the Maker with its late panels; while on its way, or unreadable, it SAYS so;
 *   4 · the work area no longer draws the old navigator's Go live · visibility · version rows or its QR card beside
 *       them (one setting, one place) — only the Event Pro line is its to add;
 *   5 · E-GIFTS: Ways to give opens the shipped E-Gifts page, with the line its Studio card says.
 *
 * Read from SOURCE (the sheet is drawn on <body> only in a browser).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { LOOK_SECTIONS } from './maker-look-sections';
import { MAKER_LATE_UNREAD } from './maker-late';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const HUB = read(`${L}/_components/hub-settings.tsx`);
const SHELL = read(`${L}/_components/maker-shell.tsx`);

test('1 · one sheet in v17’s order — Sharing · On every page · Share and print · History · Event info 🔒 (20 Nov)', () => {
  /* ⚙ "MAKER: EVENT HUB SETTINGS REGROUPED" (owner 20 Nov 2026, (1)): only what changes right away, one row style, in this
     order — Sharing · changes right away (Live for guests · Address · Who can view · Which version guests see) · On every
     page (Event Bar) · Share and print (Event QR · Prints) · History · waiting for ✓ Apply (with Undo) · Event info 🔒.
     The first three are the shipped rows' own groups (`StudioHubSettings bare`); the sheet draws the rest after them. */
  const TOOLS = read(`${L}/_components/studio-tools.tsx`);
  const bare = TOOLS.slice(TOOLS.indexOf('const compactRows = ('), TOOLS.indexOf('if (bare) return compactRows;'));
  assert.deepEqual([...bare.matchAll(/data-hub-settings-group="([a-z-]+)"/g)].map((m) => m[1]), ['sharing', 'every-page', 'share-print']);
  for (const words of ['Sharing · changes right away', 'On every page', 'Share and print']) assert.ok(bare.includes(`>${words}</p>`), `"${words}" is not a group’s title`);
  const groups = [...HUB.matchAll(/data-hub-settings-group="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(groups, ['history', 'event-info'], 'History and Event info are not after the rows that change right away');
  assert.ok(HUB.indexOf('{doors.hub ??') < HUB.indexOf('data="hub-prints"') && HUB.indexOf('data="hub-prints"') < HUB.indexOf('data-hub-settings-group="history"'), 'Prints does not close Share and print');
  assert.match(HUB, /Nothing waiting<\/span>\s*Your changes collect here until ✓ Apply/, 'the empty History does not say the drawing’s words');
  assert.match(HUB, /label="Undo last change"[\s\S]{0,120}disabled=\{!doors\.history\.canUndo\}[\s\S]{0,80}onClick=\{go\(doors\.history\.undo\)\}/, 'History has no "Undo last change"');
  assert.match(HUB, /Your history could not be read just now/, 'an unread history would read as "No changes are waiting"');
  assert.match(HUB, /<MenuSettingsButton menu="hub" open=\{open\} onOpenChange=\{onOpenChange\}>/, 'the sheet is not the house ⚙’s');
  // 🔒 Event info: shown, edited in its one home — names · date · venues · parents in Today › Event settings.
  assert.match(HUB, /Event info · the app runs on these/);
  assert.match(HUB, /name: 'Names, date, venues, parents',\s*line: 'Today › Event settings'/, 'the event’s own facts are not sent to Today');
  assert.match(HUB, /'Guest list, RSVP questions, seats', line: 'In Guests'/);
  assert.match(HUB, /'Mood Board and dress colours', line: 'In Event › Mood Board'/);
  // …and no fact of the event's own is edited here (one fact, one editor — Today's).
  assert.doesNotMatch(HUB, /'names'|'date'|'venues'|'parents'/, 'an event fact is edited in the Hub’s ⚙');
});

test('2 · Look left the ⚙ — it has its own button (🎨 Look on the resting bar, and the top row of Pages)', () => {
  /* "EVENT HUB SETTINGS REGROUPED" (1): *"The Look row leaves ⚙, since Look has its own button."* The shell still opens the
     shipped Look editor on a section (`openLook`) for the doors that name one. */
  assert.deepEqual([...LOOK_SECTIONS], ['background', 'elements', 'music']);
  assert.doesNotMatch(HUB, /LOOK_SECTIONS\.map|data-hub-settings-group="look"|doors\.look\(/, 'a Look row is back in the ⚙');
  const open = SHELL.slice(SHELL.indexOf('const openLook = (section: LookSection) => {'), SHELL.indexOf('const giftsTile ='));
  assert.ok(open.length > 100, 'anti-vacuity: openLook was not found');
  assert.match(open, /setSide\('studio'\);\s*setStudioAt\('look'\);\s*setDetailsItem\(section\);\s*setLookVisit\(\(n\) => n \+ 1\);\s*select\(\{ kind: 'tool', key: 'details' \}\);/);
  // A row closes the sheet first: the page is what the couple sees next.
  assert.match(HUB, /const go = \(act: \(\) => void\) => \(\) => \{\s*onOpenChange\(false\);\s*act\(\);\s*\};/);
});

test('3 · Your Event Hub: the shipped rows, open — one builder, handed over late — and said while waiting or unread', () => {
  const page = read(`${L}/page.tsx`);
  assert.match(page, /hubSettings = hubSettingsEditor\(\s*\{ eventId, slug: printEvent\.slug, slugAction, address: addressPart, qr: qrPart, qrStyleAction, studio: studioDetails \},\s*\{ bare: true \},\s*\);/, 'the ⚙’s copy is not the one builder’s, open');
  // Details is handed the very same address part, QR and actions (one read each).
  assert.match(page, /slugAction=\{slugAction\}[\s\S]{0,400}address=\{addressPart\}[\s\S]{0,300}qr=\{qrPart\}\s*qrStyleAction=\{qrStyleAction\}/);
  assert.match(page, /\bstudio,\s*hubSettings,/, 'the late panels do not carry it');
  assert.equal(MAKER_LATE_UNREAD.hubSettings, null, 'an unread late says nothing is there — never a guessed form');
  assert.match(SHELL, /const hubSettings = lateValue \? lateValue\.hubSettings : hubSettingsGiven;/);
  assert.match(SHELL, /hub: hubSettings,\s*pending: latePending,/);
  assert.match(HUB, /\{doors\.hub \?\? \(/);
  assert.match(HUB, /data-hub-settings-hub=\{doors\.pending \? 'pending' : 'unread'\}/, 'a wait or a failed read is not said');
  // The builder is Info's fold's own: open there, folded in Info.
  const details = read(`${L}/_components/maker-details.tsx`);
  assert.match(details, /editors\.address = hubSettingsEditor\(props, \{ bare: false \}\);/);
  assert.match(details, /bare=\{bare\}\s*\/>/);
});

test('4 · the work area draws only the Event Pro line beside it — no second Go live, visibility, version or QR', () => {
  const work = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.doesNotMatch(work, /\bMORE_ROWS\b|\bmoreRows\b/, 'the old navigator’s Your Event Hub rows are drawn again');
  assert.match(work, /createPortal\(\s*<MoreExtras liveHref=\{null\} proUnlockHref=\{proUnlockHref\} proPriceLabel=\{proPriceLabel\} showProCta=\{showProCta\} \/>,\s*moreHost,\s*\)/, 'the work area draws its QR card beside the ⚙’s');
});

test('5 · E-Gifts left the ⚙ — it is a part on the page (v17 "What this removes" 6)', () => {
  assert.doesNotMatch(HUB, /data-hub-settings-group="gifts"|name="Ways to give"/, '⚙ › E-Gifts is back');
});
