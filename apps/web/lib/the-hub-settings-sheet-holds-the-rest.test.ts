/**
 * ⚙ THE HUB'S ⚙ EVENT HUB SETTINGS HOLDS THE REST — owner, 30 Oct: *"Stages and the Studio will be on dropdown. move all
 * other details on the settings."* (DECISION_LOG 2026-10-30 "EVENT HUB PRO (look redesign)"; 2026-10-27 "LOOK MOVES TO
 * EVENT HUB SETTINGS" · "INFO SPLITS BY WHAT IT IS ABOUT" · "STUDIO IS LOOK AND WORDS ONLY"; 2026-10-26 "EACH MENU HAS
 * ITS OWN SETTINGS"; prototype `prototypes/build-contracts-2026-10-30/event-hub-pro/` "⚙ Settings").
 *
 *   1 · ONE sheet, grouped by topic in the prototype's order — Look · Your Event Hub · What guests see · E-Gifts — and
 *       one closing line sending the event's own facts (names · date · venues · parents) to Home › Event settings;
 *   2 · LOOK: one row per Look section, each opening the shipped Look editor on THAT section, in the Maker;
 *   3 · YOUR EVENT HUB: the shipped "More for guests" rows, OPEN — built by the one builder Info's fold uses
 *       (`hubSettingsEditor`), handed to the Maker with its late panels; while on its way, or unreadable, it SAYS so;
 *   4 · the work area no longer draws the old navigator's Go live · visibility · version rows or its QR card beside
 *       them (one setting, one place) — only the Event Hub Pro line is its to add;
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

test('1 · one sheet, four groups in the prototype’s order, and the event’s own facts sent to Home', () => {
  const groups = [...HUB.matchAll(/data-hub-settings-group="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(groups, ['look', 'your-event-hub', 'guests-see', 'gifts'], 'the groups are not Look · Your Event Hub · What guests see · E-Gifts');
  assert.match(HUB, /<MenuSettingsButton menu="hub" open=\{open\} onOpenChange=\{onOpenChange\}>/, 'the sheet is not the house ⚙’s');
  assert.match(HUB, /Names, date, venues and parents are in Home › Event settings\./, 'the event’s own facts are not sent to Home');
  // Each group's heading carries its ⓘ — title + one line, the rest in ⓘ.
  for (const label of ['"Look"', '"Your Event Hub"', '{GUESTS_SEE_WORDS.title}', '"E-Gifts"']) {
    assert.match(HUB, new RegExp(`<InfoTip label=${label.replace(/[{}.]/g, (c) => `\\${c}`)} align="start">`), `the ${label} group has no ⓘ`);
  }
  // …and no fact of the event's own is drawn here (one fact, one editor — Home's).
  assert.doesNotMatch(HUB, /'names'|'date'|'venues'|'parents'/, 'an event fact is edited in the Hub’s ⚙');
});

test('2 · Look: one row per section, each opening the shipped Look editor on that section', () => {
  assert.deepEqual([...LOOK_SECTIONS], ['background', 'elements', 'music']);
  assert.match(HUB, /\{LOOK_SECTIONS\.map\(\(k\) => \(\s*<FormRow key=\{k\}[\s\S]{0,300}onClick=\{go\(\(\) => doors\.look\(k\)\)\}/, 'a Look row does not open its section');
  // The shell opens the Look page (Studio's) on the section — the page its Studio card opened.
  const open = SHELL.slice(SHELL.indexOf('const openLook = (section: LookSection) => {'), SHELL.indexOf('const giftsTile ='));
  assert.ok(open.length > 100, 'anti-vacuity: openLook was not found');
  assert.match(open, /setSide\('studio'\);\s*setStudioAt\('look'\);\s*setDetailsItem\(section\);\s*setLookVisit\(\(n\) => n \+ 1\);\s*select\(\{ kind: 'tool', key: 'details' \}\);/);
  assert.match(SHELL, /look: openLook,/);
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

test('4 · the work area draws only the Event Hub Pro line beside it — no second Go live, visibility, version or QR', () => {
  const work = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.doesNotMatch(work, /\bMORE_ROWS\b|\bmoreRows\b/, 'the old navigator’s Your Event Hub rows are drawn again');
  assert.match(work, /createPortal\(\s*<MoreExtras liveHref=\{null\} proUnlockHref=\{proUnlockHref\} proPriceLabel=\{proPriceLabel\} showProCta=\{showProCta\} \/>,\s*moreHost,\s*\)/, 'the work area draws its QR card beside the ⚙’s');
});

test('5 · E-Gifts: Ways to give opens the shipped page, with its Studio card’s line', () => {
  assert.match(SHELL, /gifts: giftsTile \? \{ line: giftsTile\.status, open: \(\) => openStudio\('gifts'\) \} : null,/);
  assert.match(HUB, /<FormRow data="gifts" name="Ways to give" line=\{doors\.gifts\.line\}[\s\S]{0,200}onClick=\{go\(doors\.gifts\.open\)\}/);
});
