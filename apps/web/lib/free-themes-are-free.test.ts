/**
 * 🎨 MODERN AND CYBER NEON ARE FREE — owner 2026-09-29, verbatim, after the
 * measured loop weights: *"Okay use modern and cyber FREE"* (DECISION_LOG
 * "MODERN AND CYBER NEON BECOME FREE THEMES (WITH CLASSIC)").
 *
 * `tier` in `lib/invite-themes.ts` is the one place the decision is written.
 * Each block below holds that one consequence of it is REAL, executed rather
 * than read, so a gate that still means "not Classic" when it should mean
 * "Pro" goes red:
 *
 *   1 · the registry: Classic, Modern and Cyber Neon free; Rustic still Pro;
 *   2 · a free couple can PICK them — any celebration, the store shell too —
 *       and the guest page wears them without the unlock;
 *   3 · Apply writes them without asking for Pro; a Pro theme still asks;
 *   4 · a free couple PRINTS them print-ready and unwatermarked (the route's
 *       gate, and what Prints & Tickets draws); Rustic is still a sample;
 *   5 · the couple's own photo is Pro media on EVERY theme — a Pro owner keeps
 *       it on Modern / Cyber Neon (page, door, print); a free or lapsed couple
 *       gets the theme's own loop;
 *   6 · no copy counts or names the Pro themes by hand — the Pro list's count
 *       and its pitch are the registry's, and no typed "N themes" survives.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as React from 'react';
import { stripComments } from './strip-comments';
import { renderSettled } from './render-settled.test-helper';
import {
  FREE_THEMES,
  HUB_THEMES,
  INVITE_THEMES,
  PRO_THEMES,
  pickableInviteThemes,
  resolveInviteTheme,
  suggestedInviteTheme,
  themeNames,
  type InviteThemeId,
} from './invite-themes';
import { tilesShown } from './maker-theme-tiles';
import { eventItemIsPro } from './hub-draft';
import { PRINT_FORMATS, PRINT_SET_KEYS, isProPrint, mayServe, printAccess } from './print-pieces';
import { heroGroundNeedsOwnership, heroMayBePageGround, pageGround } from './page-ground';
import { PRO_THEMES_ITEM, WEBSITE_PRO_ITEMS } from './website-pro-items';
import { hubProPitchFor } from './event-hub-pro';

// The .tsx under test compiles to classic `React.createElement` in this runner.
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const NEWLY_FREE: InviteThemeId[] = ['galeriya', 'cyber'];
const FREE_COUPLE = { ownsPro: false } as const;

/* ══ 1 · THE REGISTRY ══════════════════════════════════════════════════════ */

test('1 · Classic, Modern and Cyber Neon are free; Rustic and the rest are Pro', () => {
  assert.deepEqual(FREE_THEMES.map((t) => t.id), ['house', 'galeriya', 'cyber']);
  assert.deepEqual(FREE_THEMES.map((t) => t.name), ['Classic', 'Modern', 'Cyber Neon']);
  assert.equal(INVITE_THEMES.abaca.tier, 'pro', 'Rustic is still Event Hub Pro');
  assert.ok(PRO_THEMES.some((t) => t.id === 'abaca'));
  assert.equal(FREE_THEMES.length + PRO_THEMES.length, HUB_THEMES.length, 'every shipped theme is free or Pro');
  assert.equal(themeNames(FREE_THEMES), 'Classic, Modern and Cyber Neon');
});

/* ══ 2 · PICK — and the guest page wears it ═════════════════════════════════ */

test('2 · a free couple picks Modern and Cyber Neon, and their guests see them — any celebration', () => {
  {
    const pickable = pickableInviteThemes().map((t) => t.id);
    for (const id of NEWLY_FREE) {
      assert.ok(pickable.includes(id), `${id} is not pickable`);
      // The one theme rule the guest page, the door and the poster all ask.
      assert.equal(resolveInviteTheme({ saved: id, ...FREE_COUPLE }), id, `${id} fell back to Classic`);
    }
    // Rustic without the unlock is still Classic on the page.
    assert.equal(resolveInviteTheme({ saved: 'abaca', ...FREE_COUPLE }), 'house', 'Rustic leaked without Pro');
  }
  // The onboarding feel "modern" now suggests Modern to a couple without Pro.
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'modern', ...FREE_COUPLE }), 'galeriya');
  // The store shell hides the Pro doors — never a free theme.
  const shown = tilesShown(HUB_THEMES, { ownsPro: false, storeShell: true, current: 'house' }).map((t) => t.id);
  for (const id of NEWLY_FREE) assert.ok(shown.includes(id), `${id} hidden in the store shell`);
  assert.ok(!shown.includes('abaca'), 'Rustic shown in the store shell to a couple without Pro');
});

/* ══ 3 · APPLY ═════════════════════════════════════════════════════════════ */

test('3 · Apply writes Modern and Cyber Neon without Pro; Rustic still asks for it', () => {
  for (const id of NEWLY_FREE) {
    assert.equal(eventItemIsPro('invite_theme', id, 'change', 'house'), false, `${id} held for Pro at Apply`);
  }
  assert.equal(eventItemIsPro('invite_theme', 'abaca', 'change', 'house'), true, 'Rustic applied without Pro');
});

/* ══ 4 · PRINT — print-ready, unwatermarked ═════════════════════════════════ */

test('4a · the route serves Modern and Cyber Neon print-ready to a free couple; Rustic only to Pro', () => {
  for (const storeShell of [false, true]) {
    const access = printAccess({ ownsPro: false, storeShell });
    for (const id of NEWLY_FREE) {
      assert.equal(isProPrint(id), false);
      for (const piece of [...PRINT_SET_KEYS, 'passes' as const]) {
        assert.ok(mayServe(piece, 'print', access, id), `${piece} in ${id} refused to a free couple (storeShell=${storeShell})`);
      }
    }
    assert.equal(mayServe('invitation', 'print', access, 'abaca'), false, 'Rustic print-ready served without Pro');
    assert.equal(mayServe('passes', 'print', access, 'abaca'), false, 'Rustic passes served without Pro');
  }
  // The route's on-screen branch: the UNMARKED vector goes to a free theme, the
  // watermarked JPEG only to a Pro theme without Pro. It must ask the tier, not
  // "is it Classic".
  const route = read('app/api/hub-print/[piece]/route.ts');
  assert.match(route, /const freeTheme = !isProPrint\(theme\);/, 'the route no longer asks the tier');
  assert.match(route, /\(mode === 'screen' && \(access\.printReady \|\| freeTheme\)\)/, 'the screen view is not unmarked for a free theme');
  assert.doesNotMatch(route, /Classic prints are free/, 'the refusal types the free list by hand');
});

/* ⚡ The print pieces load lazily (`launch/_components/details-lazy.tsx`).
   `renderSettled` waits on the loads themselves, never a clock — see
   `render-settled.test-helper.ts` for the CI failure that retired the old
   500ms retry loop. */

async function paintPrints(theme: InviteThemeId, ownsPro: boolean): Promise<string> {
  // Prints & Tickets folded into Details (2026-09-28, #6094): the whole-set
  // downloads and each piece's own saves are Details' print items now.
  const { PrintSetDownloads, PrintPieceEditor } = await import('../app/dashboard/[eventId]/launch/_components/maker-prints');
  const { PRINT_SET_KEYS } = await import('./print-pieces');
  const first = (f: string) => Object.values(PRINT_FORMATS).find((x) => x.for === f)!;
  const input = {
    eventId: 'E1',
    slug: 'rosa-ben',
    theme,
    ownsPro,
    storeShell: false,
    formats: { pass: first('pass'), invitation: first('invitation'), card: first('card') } as never,
  };
  return renderSettled(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(PrintSetDownloads, { key: 'set', input }),
      ...PRINT_SET_KEYS.filter((k) => k !== 'menu').map((k) => React.createElement(PrintPieceEditor, { key: k, input, piece: k })),
    ),
  );
}

test('4b · Details\' prints hand a free couple the Modern and Cyber Neon files — no sample, no Go Pro', async () => {
  for (const id of NEWLY_FREE) {
    const html = await paintPrints(id, false);
    const name = INVITE_THEMES[id].name;
    assert.match(html, /data-prints-access="free-theme"/, `${id}: the access line`);
    assert.match(html, /data-prints-print-ready=""/, `${id}: no print-ready set`);
    assert.match(html, /data-prints-passes=""/, `${id}: no print-ready passes`);
    assert.ok(html.includes(`Save · ${name} (PDF)`), `${id}: a piece has no print-ready save`);
    assert.ok(!html.includes(`Sample · ${name} (JPG)`), `${id}: still offered as a watermarked sample`);
    assert.doesNotMatch(html, /data-prints-go-pro/, `${id}: still pitched Pro`);
    assert.match(html, /Classic, Modern and Cyber Neon prints are free and print-ready/);
  }
  // Rustic without Pro: still the sample, still the pitch.
  const rustic = await paintPrints('abaca', false);
  assert.match(rustic, /data-prints-access="sample"/);
  assert.match(rustic, /data-prints-go-pro/);
  assert.ok(rustic.includes('Sample · Rustic (JPG)'));
  assert.doesNotMatch(rustic, /data-prints-print-ready/);
});

/* ══ 5 · THE COUPLE'S OWN MEDIA IS PRO — ON EVERY THEME ════════════════════
   Owner 2026-09-29, "yes" (DECISION_LOG "A PRO COUPLE KEEPS THEIR OWN
   PHOTO/VIDEO BACKGROUND ON EVERY THEME"): a couple who OWNS Event Hub Pro keeps
   their hero photo/video behind the page, on the door and on prints on a free
   theme too; a free or lapsed couple on a free theme gets the theme's own loop. */

test('5a · on Modern / Cyber Neon: Pro owner → own photo; free couple → theme loop; lapsed → theme loop', () => {
  const owner = { ownsPro: true };
  const free = { ownsPro: false };
  // A lapsed couple is measured exactly like a free one — `ownsPro` is the
  // unlock held RIGHT NOW (`eventCoupleWebsiteProActive`), not ever bought.
  const lapsed = { ownsPro: false };
  for (const id of NEWLY_FREE) {
    assert.equal(heroGroundNeedsOwnership(id), true, `${id}: the ownership read is skipped`);
    assert.equal(heroMayBePageGround(id, owner.ownsPro), true, `${id}: a Pro owner lost their own background`);
    const own = pageGround({ theme: id, ombre: false, heroGround: true, ...owner });
    assert.equal(own.heroOnTop, true, `${id}: Pro owner`);
    assert.equal(own.themeLoop, false, `${id}: the hero replaces the loop`);
    for (const [who, c] of [['free', free], ['lapsed', lapsed]] as const) {
      assert.equal(heroMayBePageGround(id, c.ownsPro), false, `${id}: a ${who} couple shows Pro media`);
      const g = pageGround({ theme: id, ombre: false, heroGround: true, ...c });
      assert.equal(g.heroOnTop, false, `${id}: ${who}`);
      assert.equal(g.themeLoop, true, `${id}: ${who} couple lost the theme's own loop`);
    }
    // Absent ownership fails closed.
    assert.equal(pageGround({ theme: id, ombre: false, heroGround: true }).heroOnTop, false);
  }
  // Classic: never, owner or not. A Pro theme: already ownership-gated upstream.
  assert.equal(heroMayBePageGround('house', true), false, 'Classic wore a photo');
  assert.equal(heroGroundNeedsOwnership('house'), false);
  assert.equal(heroGroundNeedsOwnership('abaca'), false, 'a Pro-theme page pays an ownership read it never needs');
  assert.equal(heroMayBePageGround('abaca', false), true);
});

test('5b · the page, the door and the print each measure ownership through the entitlement resolver, as viewed', () => {
  // Page ground (Event Hub body + RSVP page): `websiteProActiveFor` = asViewed(eventCoupleWebsiteProActive).
  const layer = read('app/[slug]/_lib/main-ground-layer.tsx');
  assert.match(layer, /const ownsPro = heroGroundNeedsOwnership\(theme\)\s*\?\s*await websiteProActiveFor\(event\.event_id\)/);
  assert.match(layer, /heroMayBePageGround\(theme, ownsPro\)/);
  // Door photo.
  const look = read('app/[slug]/_lib/hub-look.ts');
  assert.match(look, /const ownsPro = heroGroundNeedsOwnership\(look\.theme\)\s*\?\s*await websiteProActiveFor\(event\.event_id\)/);
  assert.match(look, /if \(!heroMayBePageGround\(look\.theme, ownsPro\)\)/);
  assert.match(look, /websiteProActiveFor = cache\([\s\S]{0,400}asViewed\(eventCoupleWebsiteProActive\(/, 'the page reader stopped honouring "view as free"');
  // Print still: `printOwnsPro` = asViewed(eventCoupleWebsiteProActive).
  const print = read('lib/print-set.server.ts');
  assert.match(print, /heroMayBePageGround\(theme, heroGroundNeedsOwnership\(theme\) \? await printOwnsPro\(eventId\) : false\)\s*\?\s*heroStill\(/);
  assert.match(print, /printOwnsPro[\s\S]{0,200}asViewed\(eventCoupleWebsiteProActive\(/, 'the print reader stopped honouring "view as free"');
});

/* ══ 6 · NO TYPED COUNT, NO TYPED LIST ══════════════════════════════════════ */

test('6a · the Pro list counts the Pro themes from the registry, and its pitch names exactly them', () => {
  assert.equal(PRO_THEMES_ITEM, `${PRO_THEMES.length} Event Hub themes, invite link included`);
  assert.ok((WEBSITE_PRO_ITEMS as readonly string[]).includes(PRO_THEMES_ITEM));
  const blurb = hubProPitchFor(PRO_THEMES_ITEM)!.blurb;
  for (const t of PRO_THEMES) assert.ok(blurb.includes(t.name), `the pitch drops ${t.name}`);
  for (const t of FREE_THEMES) assert.ok(!blurb.includes(t.name), `the pitch sells ${t.name}, which is free`);
  // The source carries no digit and no list — both come from the registry.
  const items = read('lib/website-pro-items.ts');
  assert.doesNotMatch(items, /'\d+ Event Hub themes/, 'a typed count is back in the Pro list');
  assert.doesNotMatch(read('lib/event-hub-pro.ts'), /Rustic, /, 'a typed list of themes is back in the pitch');
});

function* sourceFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'blog-batches') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* sourceFiles(p);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) yield p;
  }
}

test('6b · no code a couple reads counts the themes by hand', () => {
  /*
    Two nets. ANYWHERE: a count qualified as the Event Hub's ("9 Event Hub
    themes", "seven Pro themes", "ten invite themes"). And in any file that
    KNOWS the registry (imports it, or the Pro list built on it), an
    unqualified count too ("the other nine themes"). The profile's dashboard
    skins ("five themes" in lib/help.ts) are a different thing and import
    neither, so they are not this sweep's business.
  */
  const N = '(?:\\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
  const QUALIFIED = new RegExp(`\\b${N}\\s+(?:more\\s+|other\\s+)?(?:Event Hub|Pro|invite)\\s+themes\\b`, 'i');
  const ANY = new RegExp(`\\b${N}\\s+(?:(?:more|other|Event Hub|Pro|invite)\\s+)?themes\\b`, 'i');
  const KNOWS = /from '(?:@\/lib\/|\.\/|\.\.\/)*(?:invite-themes|website-pro-items|event-hub-pro)'/;
  const hits: string[] = [];
  let scanned = 0;
  let knowing = 0;
  for (const root of ['app', 'lib']) {
    for (const file of sourceFiles(join(WEB, root))) {
      scanned += 1;
      const raw = readFileSync(file, 'utf8');
      const src = stripComments(raw);
      const knows = KNOWS.test(raw);
      if (knows) knowing += 1;
      const m = QUALIFIED.exec(src) ?? (knows ? ANY.exec(src) : null);
      if (m) hits.push(`${relative(WEB, file)}: "${m[0]}"`);
    }
  }
  assert.ok(scanned > 500, `scanned only ${scanned} files — the sweep is looking at nothing`);
  assert.ok(knowing > 20, `only ${knowing} files import the registry — the KNOWS net matches nothing`);
  assert.deepEqual(hits, [], 'a typed theme count — derive it from FREE_THEMES / PRO_THEMES');
});

test('6c · the picker and the tours name the free themes from the registry — "Classic is free" is gone', async () => {
  const { TOURS } = await import('./tours');
  const free = themeNames(FREE_THEMES);
  const picker = TOURS.customer_theme_picker_v1.slides.map((s) => `${s.title} ${s.body}`).join(' ');
  assert.ok(picker.includes(`${free} are free`), 'the theme tour does not name the free themes');
  assert.doesNotMatch(picker, /padlock/i, 'the theme tour still promises a padlock (Pro themes are tried free since #6091)');
  const tours = JSON.stringify(TOURS);
  // ✂ The Maker's own tour sells nothing since 2026-10-02 ("SIMPLIFY FIRST, THEN TOUR") —
  // its "Themes beyond …" slide went with it. Any tour that names the free themes again
  // must take them from the registry.
  for (const m of tours.matchAll(/Themes beyond ([^,.]+)/g)) {
    assert.ok(m[1]!.startsWith(free), `a tour types its own free-theme list: "${m[0]}"`);
  }
  const src = read('app/dashboard/[eventId]/launch/_components/maker-theme-picker.tsx');
  assert.match(src, /\{themeNames\(FREE_THEMES\)\} are free; the others come with Event Hub Pro\./);
  // No typed free list survives in anything a couple reads.
  const hits: string[] = [];
  for (const root of ['app', 'lib']) {
    for (const file of sourceFiles(join(WEB, root))) {
      const m = /Classic is free|Themes beyond Classic\b|only Classic is free|other themes come with/i.exec(stripComments(readFileSync(file, 'utf8')));
      if (m) hits.push(`${relative(WEB, file)}: "${m[0]}"`);
    }
  }
  assert.deepEqual(hits, [], 'a typed free-theme list — use themeNames(FREE_THEMES)');
});
