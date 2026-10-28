/**
 * 🪪 A NAME ON THE WEDDING MARCH OPENS THEIR OWN GUEST CARD — IN PLACE (owner, verbatim, 2026-10-14: *"on Wedding march. when
 * we click a guest, we can show the guest card on the guest's page so they can rename edit it there and do not need to go
 * back to guests."*).
 *
 * What this holds, each part a way the feature could quietly stop being true:
 *   1 · a TAP (pressed and let go without lifting — under the drag's own 4 px / 8 px) on a walking name OR a "Not walking"
 *       chip opens the card; Enter does it from the keyboard; Space still picks the name up to move it;
 *   2 · the card is THE guest card (`GuestCard`, the Guest list's panel — owner 2026-10-24: *"the guest card on wedding
 *       march is not same with the guest card."*), read by ONE action through the one card reader (`readGuestCard`);
 *   3 · it opens in the Guest list's own sheet (`InspectorSheetAlone`, on <body>, lifted over the Maker), with the card's
 *       own header and "✓ Saved" (never a second "Guests see this right away"), mounts the card's own Undo
 *       (`UndoToastHost`), and closing after a save re-reads the Maker once — no stale name;
 *   4 · no "go back to Guests": nothing on the march or its card's sheet links or navigates to the Guest list;
 *   5 · it stays out of the Maker's first load (the sheet rides only with lazy Details pieces).
 *
 * SABOTAGE (each seen red, then restored — controller-2026-10-12/march-card/sabotage-out.txt).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}
const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const MARCH = read(`${L}/details-march.tsx`);
const G = 'app/dashboard/[eventId]/guests';
const SHEET = read(`${G}/_components/guest-card-sheet.tsx`);
const ACTION = read(`${G}/open-guest-card.tsx`);

test('1 · a tap (let go where it was pressed, never having wandered) on a walking name or a tray chip opens their card; Enter too; Space still moves', () => {
  const up = MARCH.slice(MARCH.indexOf('const onUp = useCallback('), MARCH.indexOf('const onCancel = useCallback('));
  assert.match(up, /const d = drag\.current;\s*const press = pending\.current;\s*stopAll\(\);/, 'the release no longer keeps the press it ends — a tap cannot be told from nothing');
  /* Every release asks the ONE pure answer (`releaseIs`, test 7 drives it), with the press's real facts — lifted, wandered, how far. */
  assert.match(
    up,
    /releaseIs\(\{ kind: press\.source\.kind, touch: press\.touch, lifted: d !== null, wandered: d\?\.wandered \?\? false, moved: Math\.hypot\(e\.clientX - press\.x, e\.clientY - press\.y\) \}\)/,
    'the release does not ask releaseIs with the press’s own facts',
  );
  // setCard in the release happens ONLY behind releaseIs's 'card' — so a drag can never reach it.
  const cards = [...up.matchAll(/setCard\(/g)].length;
  assert.equal(cards, 1, `the release opens the card in ${cards} places — every one must sit behind releaseIs`);
  assert.match(up, /if \(said === 'card' && press[^{]*\{[\s\S]{0,400}setCard\(\{ id: press\.source\.id[^;]*;\s*swallowTapClick\(\);\s*return;/, 'the card opens without releaseIs saying "card"');
  // A held tap (lifted, never wandered) puts the lift back: no ghost left on the page, no dim.
  assert.match(up, /if \(d\) \{[\s\S]{0,200}d\.ghost\.remove\(\);\s*setLifted\(null\);/, 'a held tap leaves its ghost on the page');
  // The drag records wandering against the SAME slop, from the press's own start.
  assert.match(MARCH, /if \(!d\.wandered && Math\.hypot\(e\.clientX - p\.x, e\.clientY - p\.y\) > \(p\.touch \? TAP_SLOP_TOUCH : TAP_SLOP_MOUSE\)\) d\.wandered = true;/, 'a drag no longer remembers it wandered — a drag brought back to its start would open the card');
  // The tap's own click must not reach the sheet's scrim (a finger's pointerup opens the card, then its click closes it).
  assert.match(MARCH, /function swallowTapClick\(\): void \{[\s\S]{0,300}addEventListener\('click', eat, true\)/, 'swallowTapClick no longer catches the next click in the capture phase');
  // The drag's thresholds are the tap's slop, so a press is EITHER a tap or a drag, never both.
  assert.match(MARCH, /if \(moved > TAP_SLOP_TOUCH\) stopAll\(\);/, "a finger’s scroll no longer starts at the tap’s slop");
  assert.match(MARCH, /if \(moved > TAP_SLOP_MOUSE\) lift\(e\.clientX, e\.clientY\);/, "a mouse no longer lifts at the tap’s slop");
  assert.match(MARCH, /if \(e\.key === 'Enter' && !carried\) \{[\s\S]{0,400}setCard\(\{ id: source\.id/, 'Enter does not open the card');
  assert.match(MARCH, /if \(e\.key === ' ' \|\| e\.key === 'Enter'\) \{/, 'Space no longer picks a name up');
});

test('1b · the march draws the card for the tapped person, with the reader it was handed (the lab’s) or the shipped one', async () => {
  assert.match(MARCH, /openCard = openCardShipped,/);
  assert.match(MARCH, /const openCardShipped = SHIPPED_GUEST_CARD\.march;/);
  assert.match(SHEET, /march: async \(eventId: string, guestId: string\): Promise<GuestCardResult> => \(await import\('\.\.\/open-guest-card'\)\)\.openGuestCard\(eventId, guestId, 'march'\)/, 'the card’s read is no longer loaded at the first tap');
  assert.match(MARCH, /<GuestCardSheet eventId=\{eventId\} person=\{card\} open=\{openCard\} onClose=\{\(\) => setCard\(null\)\} onSaved=\{onCardSaved\} \/>/);
  // OUTSIDE the drag's section: a key typed in the card must never reach the drag's handlers.
  assert.match(MARCH, /<\/section>\s*(?:\{\s*\}\s*)?\{card && card\.id \? \(\s*<GuestCardSheet/, 'the card is drawn inside the march’s section — its keys and presses would reach the drag');
  /* The rendered march: every name is a ≥ 44 px pressable that says Enter opens the card. */
  const { MarchMaker } = await import(`../${L}/details-march`);
  const { labMarchSections } = await import('../app/dev/details-lab/march-fixture');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const m = labMarchSections();
  const html = renderToStaticMarkup(React.createElement(MarchMaker as never, { eventId: 'E1', sections: m.sections, printed: m.printed, out: m.out } as never));
  const names = [...html.matchAll(/<div[^>]*data-march-drag="name\|[^"]+"[^>]*>/g)].map((x) => x[0]);
  assert.ok(names.length >= 20, `the march drew ${names.length} names`);
  for (const n of names) {
    assert.match(n, /role="button"/);
    assert.match(n, /min-h-11/, 'a name is under 44 px to the finger');
    assert.match(n, /Enter opens their guest card/, 'a name does not say how to open the card');
  }
});

test('2 · the card is THE guest card — `GuestCard`, the Guest list’s panel — read by the one card reader, once', () => {
  assert.match(ACTION, /^'use server';/);
  assert.match(ACTION, /const read = await readGuestCard\(supabase, eventId, guestId, user\.id\);/, 'the card is not read by the one card reader');
  assert.match(ACTION, /<GuestCard frame="panel" eventId=\{eventId\} \{\.\.\.read\}/, 'the march draws a card other than THE guest card');
  assert.doesNotMatch(ACTION, /GuestCardBody|\bkit=\{|actions=\{/, 'the march’s card is drawn around the one card, or takes other writes');
  assert.match(ACTION, /if \(!isUuid\(eventId\) \|\| !isUuid\(guestId\) \|\| !\(at in RETURN_TO\)\)/);
  // The address a failed save lands on is the server's, never the browser's.
  assert.match(ACTION, /returnTo=\{RETURN_TO\[at\]\(eventId\)\}/);
  // A refusal is a sentence, never the database's words.
  assert.match(ACTION, /catch \{\s*return \{ ok: false, reason: COULD_NOT_OPEN \};/);
  assert.doesNotMatch(ACTION, /\.message\b/, 'a thrown error’s words could reach the couple');
});

test('3 · the Guest list’s sheet, the card’s own header and ✓ Saved, its own Undo — and closing after a save re-reads the Maker once', () => {
  assert.match(SHEET, /<InspectorSheetAlone onClose=\{close\} layer=\{GUEST_CARD_LAYER\}>/, 'the card is not the Guest list’s sheet, in its own layer over the Maker (test 6)');
  assert.doesNotMatch(SHEET, /HubSavesImmediately|Guests see this right away/, 'a second header the Guest list’s card does not carry is back');
  assert.match(SHEET, /<UndoToastHost \/>/, 'the card’s own Undo has no host in the Maker');
  assert.match(SHEET, /onSubmitCapture=\{\(\) => \{\s*saved\.current = true;\s*\}\}/);
  assert.match(SHEET, /onClose\(\);\s*if \(saved\.current\) \(onSaved \?\? requestMakerRefresh\)\(\);/, 'closing a card that saved does not re-read the march — the old name would stay');
  assert.match(SHEET, /if \(closed\.current\) return;\s*closed\.current = true;/, '✕, Escape and the peek could each close (and re-read) again');
  assert.match(SHEET, /Opening their card…/, 'the sheet does not open at the tap');
  assert.match(SHEET, /<StatusLine tone="bad" data="guest-card-sheet" action=\{\{ label: 'Try again'/, 'a card that could not open is not said with a way to try again');
});

test('4 · no "go back to Guests" — nothing on the march or its card links or navigates to the Guest list', () => {
  for (const [name, src] of [['details-march.tsx', MARCH], ['guest-card-sheet.tsx', SHEET]] as const) {
    assert.doesNotMatch(src, /next\/link|<Link\b|href=|router\.push|location\.(?:href|assign)/, `${name} sends the couple somewhere else`);
    assert.doesNotMatch(src.replace(/^import[^;]*;$/gm, ''), /\/guests['`/?]/, `${name} names the Guest list’s address`);
  }
});

test('5 · out of the Maker’s first load: only lazy Details pieces import the sheet, and the Maker’s page reads no card', () => {
  const lazy = read(`${L}/details-lazy.tsx`);
  assert.match(lazy, /export const MarchMaker = dynamic\(\(\) => import\(\s*\/\*[^*]*\*\/\s*'\.\/details-march'\)|export const MarchMaker = dynamic\(\(\) => import\(\s*'\.\/details-march'\)/);
  const importers: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(p);
      } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && /from '[^']*guest-card-sheet'/.test(read(p))) importers.push(p);
    }
  };
  walk('app');
  assert.deepEqual(
    importers.sort(),
    /* 🗂 R4: Guests › Seats' faces open the card too — from the seat plan's own lazy chunk (`seating-lazy.tsx`). */
    [`${L}/details-march.tsx`, `${L}/details-people.tsx`, `${L}/parent-cards.tsx`, `${L}/studio-prints-six.tsx`, 'app/dashboard/[eventId]/seating/_components/seating-editor.tsx'].sort(),
    'the card sheet is imported outside the (lazy) Details pieces that open a guest’s card',
  );
  assert.doesNotMatch(read('app/dashboard/[eventId]/launch/page.tsx'), /guest-card|loadGuestCard|GuestCardBody/, 'the Maker’s page reads or draws a guest card up front');
});

/* ── 2026-10-19 · owner, on live: "tapping the person on the wedding march does not show the guest card as planned". ── */

/** The `z-[N]` / `z-N` of a class string, as a number (null: none). */
const zOf = (cls: string): number | null => {
  const m = cls.match(/(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?=\s|$)/);
  return m ? Number(m[1] ?? m[2]) : null;
};

test('6 · the card is drawn OVER the Maker — its layer sits above the full-screen shell and under the card’s own dropdowns', async () => {
  /* What failed on live: the Sheet (z-50) was portalled bare to <body>, under the Maker's fixed full-screen shell, so a tap
     set the card open (the name wore its ring) and the screen did not change. The NUMBERS are read from each file — a
     shell raised, a layer lowered, or the layer dropped from the portal turns this red. */
  const SHELL = read(`${L}/maker-shell.tsx`);
  const shellCls = SHELL.match(/className="fixed inset-x-0 top-0 (z-\[\d+\]) flex h-\[100dvh\] flex-col bg-cream text-ink"/);
  assert.ok(shellCls, 'the Maker’s full-screen shell is no longer found — re-anchor this test on it');
  const shellZ = zOf(shellCls[1]!)!;
  const { GUEST_CARD_LAYER: MARCH_CARD_LAYER } = await import(`../${G}/_components/guest-card-sheet`);
  const layerZ = zOf(MARCH_CARD_LAYER as string);
  assert.ok(layerZ !== null, 'the card’s layer has no z-index — the sheet falls back under the Maker');
  assert.match(MARCH_CARD_LAYER as string, /(?:^|\s)(?:relative|fixed|absolute)(?:\s|$)/, 'the card’s layer is not positioned — its z-index would do nothing');
  assert.ok(layerZ! > shellZ, `the card’s layer (z ${layerZ}) is not above the Maker (z ${shellZ}) — the card opens behind it`);
  // The sheet is the Guest list's (`.sn-inspector-sheet` / its peek, globals.css) — under the Maker on its own.
  const CSS = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  for (const cls of ['sn-inspector-sheet', 'sn-inspector-peek']) {
    const rule = CSS.match(new RegExp(`\\.${cls} \\{[^}]*z-index: (\\d+);`));
    assert.ok(rule, `.${cls}'s z-index is no longer found — re-anchor this test on it`);
    assert.ok(Number(rule[1]) < shellZ, `.${cls} itself now clears the Maker — this layer may be retired, update this test`);
  }
  // The card's own dropdowns (portalled to <body>) must still draw over the card.
  const PICK = read('app/dashboard/[eventId]/website/editor/_components/pick-menu.tsx');
  const pickZ = zOf(PICK.match(/role="listbox"[\s\S]{0,700}?className="([^"]+)"/)![1]!)!;
  assert.ok(layerZ! < pickZ, `the card’s layer (z ${layerZ}) covers its own dropdowns (z ${pickZ}) — Title / Details would open under the card`);
  // And the layer is what holds the sheet in its portal (not a sibling of it).
  const COLUMN = read('app/_components/inspector/inspector-column.tsx');
  assert.match(COLUMN, /return createPortal\(layer \? <div className=\{layer\}>\{sheet\}<\/div> : sheet, portal\);/, 'the sheet’s layer does not wrap it in its portal');
});

test('6b · a tray chip tapped in the full "Not walking" list: the list steps aside under the card, and is back after', () => {
  const TRAY = read(`${L}/details-march-tray.tsx`);
  const trayZ = zOf(TRAY.match(/data-march-tray-sheet=""\s*className=\{`([^`$]+)/)![1]!.trim())!;
  assert.ok(trayZ > 90, 'the full list no longer sits over the card’s layer — this step-aside may be retired, update this test');
  assert.match(TRAY, /data-march-tray-sheet=""\s*className=\{`fixed inset-0 z-\[\d+\] flex flex-col justify-end \$\{lifted \|\| carded \? 'pointer-events-none invisible' : ''\}`\}/, 'the full list stays drawn over an open card');
  assert.match(MARCH, /<MarchTray[\s\S]{0,300}carded=\{card !== null\}/, 'the march does not tell the tray a card is open');
});

test('7 · releaseIs — a drag NEVER opens the card; a tap (quick or held) on a person always does', async () => {
  const { releaseIs, TAP_SLOP_MOUSE, TAP_SLOP_TOUCH } = await import('./march-drag');
  const kinds = ['name', 'out', 'walk', 'section'] as const;
  let n = 0;
  for (const kind of kinds)
    for (const touch of [true, false])
      for (const lifted of [true, false])
        for (const wandered of [true, false])
          for (const moved of [0, 1, 3, 4, 5, 7, 8, 9, 20, 140]) {
            const r = releaseIs({ kind, touch, lifted, wandered, moved });
            n++;
            const slop = touch ? TAP_SLOP_TOUCH : TAP_SLOP_MOUSE;
            const dragged = wandered || moved > slop;
            if (dragged) assert.notEqual(r, 'card', `a drag opened the card: ${JSON.stringify({ kind, touch, lifted, wandered, moved })}`);
            if (kind === 'walk' || kind === 'section') assert.notEqual(r, 'card', `a ${kind} opened a card`);
            if (!dragged && (kind === 'name' || kind === 'out')) assert.equal(r, 'card', `a tap on a person did not open their card: ${JSON.stringify({ touch, lifted, moved })}`);
            if (r !== 'card') assert.equal(r, lifted ? 'drop' : 'nothing', 'a lifted name that is not a tap must drop; an unlifted one does nothing');
          }
  assert.equal(n, 320);
  // The slop is the drag's own (a mouse lifts past 4 px, a finger's press past 8 px is a scroll).
  assert.equal(TAP_SLOP_MOUSE, 4);
  assert.equal(TAP_SLOP_TOUCH, 8);
});
