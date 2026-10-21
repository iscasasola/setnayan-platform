/**
 * THE SIX DOORS MOVED CONTROLS; THEY MUST NOT HAVE LOST ANY.
 *
 * G1 ports the hero, the rail and door 1 of the approved drawing
 * (`prototypes/shop_page_2026-09-10.html`, owner 2026-09-14 "doors 1-3 ok")
 * onto `app/vendor-dashboard/shop/page.tsx`. The owner's brief for the whole
 * chain is *"improving what we have"*, and the drawing's own headline is
 * **"Nothing removed, three things moved."**
 *
 * 🔑 SO THE RISK IS NOT THAT THE NEW THING LOOKS WRONG — IT IS THAT AN OLD
 * THING QUIETLY STOPS BEING MOUNTED. A restructure of an 1,876-line page can
 * drop a component and leave a page that renders perfectly and is missing a
 * control a shop owner needs, with nothing red anywhere. This guard exists for
 * that, and it is derived from the drawing's own "every shipped control → its
 * door" table rather than from the page it is checking.
 *
 * ─── WHY THIS IS A SOURCE PIN, AND HOW IT AVOIDS BEING A USELESS ONE ───────
 * `page.tsx` is a server component tree with `server-only` imports, so
 * `tsx --test` cannot render it. Comments are stripped before every negative
 * assertion, so a component named only in a docblock can never satisfy a claim
 * that it is mounted — the docblock above literally names both anchors, which
 * would satisfy a naive grep.
 *
 * ⚠ AND IT COUNTS. `assert count === 1` on every mount, not `includes`: a
 * duplicated `id` is as broken as a missing one (two `#get-verified` sections
 * make the hero pill's deep-link land on whichever the browser sees first), and
 * a bare `includes` cannot tell one from two.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOP = resolve(HERE, '../app/vendor-dashboard/shop');
const read = (p: string) => stripComments(readFileSync(resolve(SHOP, p), 'utf8'));
const PAGE = () => read('page.tsx');

const count = (src: string, needle: string) => src.split(needle).length - 1;

/**
 * Count JSX mounts of a component by NAME, at a real element boundary.
 *
 * 🪤 A PLAIN SUBSTRING COUNT CANNOT TELL `<ManageTiles` FROM `<ManageTilesXX`.
 * The first cut of this file used one, and a sabotage that renamed a component
 * — exactly how a mount gets lost in a restructure — left the guard green. The
 * trailing class is what makes the match a whole tag name.
 */
const mountCount = (src: string, component: string) =>
  (src.match(new RegExp(`<${component}(?![A-Za-z0-9_])`, 'g')) ?? []).length;

/**
 * Every component the shipped page mounted BEFORE G1, with the door the
 * drawing's table assigns it. Transcribed from that table, not from the page —
 * a list copied off the page it checks can only ever agree with it.
 *
 * ⛔ NOTHING IS EVER REMOVED FROM THIS LIST. A control that genuinely retires
 * is retired by an owner ruling, and then this line is deleted in the same
 * commit as the mount, with the ruling cited. Deleting a line to make a red
 * test pass is the exact failure the drawing's "nothing removed" is about.
 */
const SHIPPED_MOUNTS: ReadonlyArray<readonly [string, string]> = [
  ['<HeroCard', 'hero'],
  // ['<ManageTiles', 'door 1 — shop information'] and ['<VerifySection', 'door 1 — your papers'] — MOVED, not
  // retired, by the owner's approval of the simpler supplier dashboard (DECISION_LOG 2026-10-14 "✅ APPROVE: THE
  // SIMPLER …", prototype moments 6–8): the tiles' panels and the papers are now Your details · Your page · Your
  // collections. Every control they held is pinned at its NEW home in `MOVED_MOUNTS` below — exactly once each — so
  // a control lost in the move still turns this red.
  ['<ServicesDisclosure', 'door 3 — what you sell'],
  // ['<EarningsSurface', 'door 5 — earnings'] — RETIRED by owner ruling 2026-10-08 (supplier dashboard round 1,
  // "2. Money": Earnings & payday become Customers › Money; plan § 2 "earnings/surface.tsx … Merge into Customers ›
  // Money"). Deleted with its mount in S-PR4; the year, the fee bills and the legacy payouts are Money's now
  // (`app/vendor-dashboard/customers/_components/money-segment.tsx`).
  ['<FeatureAccordion', 'door 6 — the folds'],
];

/**
 * DOOR 1'S CONTROLS AT THEIR NEW HOMES (step 5, 2026-10-14). Transcribed from what the door's panels mounted on
 * 2026-10-13 — the Profile tile's cards, the papers, the Branch tile, the Website tile's media and curation, the
 * payment fold, the auto-reply card — with the file that mounts each now and how many times.
 * ⛔ The same rule as the list above: a line leaves only with an owner ruling cited beside it.
 */
const MOVED_MOUNTS: ReadonlyArray<readonly [string, string, number]> = [
  // Your details — one ProfileChecklistEditor per fold (name · what · where · contact), each handed its own rows.
  ['ProfileChecklistEditor', '../app/vendor-dashboard/profile/_components/details-screen.tsx', 4],
  ['VerifySection', '../app/vendor-dashboard/profile/_components/details-screen.tsx', 1],
  ['VenueMatchCard', '../app/vendor-dashboard/profile/_components/details-screen.tsx', 1],
  ['VenueTypeCard', '../app/vendor-dashboard/profile/_components/details-screen.tsx', 1],
  ['PublicLineCard', '../app/vendor-dashboard/profile/_components/details-screen.tsx', 1],
  ['SuggestedCoverageCard', '../app/vendor-dashboard/profile/_components/details-screen.tsx', 1],
  ['VisibilityCard', '../app/vendor-dashboard/profile/_components/details-screen.tsx', 1],
  ['RequestCorrectionCard', '../app/vendor-dashboard/profile/_components/details-screen.tsx', 1],
  ['BranchPanel', '../app/vendor-dashboard/profile/page.tsx', 1],
  ['PaymentOptionsSurface', '../app/vendor-dashboard/profile/page.tsx', 1],
  // Your page — the website editor's controls are its parts; the domain manager and the auto-reply card are mounted.
  ['PageParts', '../app/vendor-dashboard/website/page.tsx', 1],
  ['DomainManager', '../app/vendor-dashboard/website/page.tsx', 1],
  ['AutoReplySection', '../app/vendor-dashboard/website/page.tsx', 1],
  // Your collections — the gallery editors (portfolio photos · featured videos · Instagram).
  ['GalleryMedia', '../app/vendor-dashboard/collections/page.tsx', 1],
];

test('🔑 EVERY CONTROL DOOR 1 HELD IS MOUNTED AT ITS NEW HOME, THE RIGHT NUMBER OF TIMES', () => {
  for (const [name, file, times] of MOVED_MOUNTS) {
    const at = stripComments(readFileSync(resolve(HERE, file), 'utf8'));
    assert.equal(mountCount(at, name), times, `<${name} is mounted ${mountCount(at, name)}× in ${file}, expected ${times}`);
  }
});

test('the Your-page parts keep every curation control the website editor had', () => {
  const parts = stripComments(
    readFileSync(resolve(HERE, '../app/vendor-dashboard/website/_components/page-parts.tsx'), 'utf8'),
  );
  // About · featured services · sections (portfolio · trusted by · stories) · cover · accent · pinned review · stories.
  for (const part of ['about', 'services', 'portfolio', 'trusted_by', 'editorials', 'hero', 'accent', 'pin', 'stories']) {
    assert.ok(
      new RegExp(`change\\(\\{[^}]*\\b${part}\\b`).test(parts) || new RegExp(`\\b${part}:\\s*!shown\\.sections\\.${part}`).test(parts),
      `Your page no longer changes "${part}" — a website-editor control was lost in the move`,
    );
  }
});

test('every control the page shipped before G1 is still mounted, exactly once', () => {
  const src = PAGE();
  for (const [mount, where] of SHIPPED_MOUNTS) {
    const name = mount.slice(1);
    assert.equal(
      mountCount(src, name),
      1,
      `<${name} (${where}) is mounted ${mountCount(src, name)}× — the drawing says nothing is removed`,
    );
  }
});

test('🔑 BOTH DEEP-LINK ANCHORS STILL RESOLVE, AND EXACTLY ONCE EACH', () => {
  /*
    `#manage-shop` and `#get-verified` were the targets of the hero pills,
    Today's first steps and the Subscription page's "Get verified first". The
    code now links straight to Your details (`/vendor-dashboard/profile#docs`),
    but links ALREADY SENT — a notification stored with
    `/vendor-dashboard/shop#get-verified`, a bookmark — still arrive here, so
    door 1 carries both ids on its rows (step 5), once each, and no component
    mounted on this page mints a competing copy.
  */
  const src = PAGE();
  assert.equal(count(src, 'id="manage-shop"'), 1, '#manage-shop no longer resolves on My Shop (or is duplicated)');
  assert.equal(count(src, 'id="get-verified"'), 1, '#get-verified no longer resolves on My Shop (or is duplicated)');
  for (const f of readdirSync(resolve(SHOP, '_components')).filter((x) => x.endsWith('.tsx'))) {
    const body = read(`_components/${f}`);
    // VerifySection keeps its own id for its own screen (Your details); it is not mounted on My Shop.
    if (f === 'verify-section.tsx') continue;
    assert.equal(count(body, 'id="manage-shop"') + count(body, 'id="get-verified"'), 0, `${f} mints a second copy of a door-1 anchor`);
  }
  assert.equal(mountCount(src, 'VerifySection'), 0, 'VerifySection is mounted on My Shop again — two #get-verified');
});

test('door 1 holds BOTH the shop information and the papers', () => {
  /*
    The whole point of door 1: "fix my shop information and verification,
    branches, team" is ONE errand. Since step 5 the room is rows into the screens
    that hold it — Your details, Your page, Your collections, Helpers — plus the
    papers' own row. A door that lost one of them would look completely fine.
  */
  const src = PAGE();
  const open = src.indexOf('<ShopDoorSection');
  assert.ok(open > -1, 'door 1 is not mounted at all');
  const close = src.indexOf('</ShopDoorSection>', open);
  assert.ok(close > open, 'the door shell is never closed');
  const inside = src.slice(open, close);
  for (const href of ['"/vendor-dashboard/profile"', '"/vendor-dashboard/website"', '"/vendor-dashboard/collections"', '"/vendor-dashboard/team"', '{DOCS_HREF}']) {
    assert.ok(inside.includes(`href=${href}`), `door 1 has no row to ${href}`);
  }
  assert.match(inside, /id="get-verified"/, 'the papers row is not inside door 1');
  assert.match(inside, /id="d1"/, 'door 1 does not carry the anchor the rail points at');
});

/*
 * ✂ THE "ON THIS PAGE" RAIL AND THE SIX NUMBER TILES ARE RETIRED — owner "Yes to
 * all", 2026-10-21, item 4 of `shots-2026-10-21/supplier-dash-audit/AUDIT.md`
 * (the approved S-PR6 shape: "ShopRail/ManageTiles removed"). The five tests that
 * held the rail (mounted · six doors in order · no door points nowhere · only
 * door 1 built · no JavaScript) were deleted in the SAME commit as the mount,
 * with this ruling cited, as this file's own rule above requires. The rooms the
 * rail pointed at are NOT retired: their anchors are held below, because links
 * already sent still land on them.
 */
test('✂ the rail and the number tiles stay retired (owner 2026-10-21, item 4)', () => {
  const src = PAGE();
  assert.equal(mountCount(src, 'ShopRail'), 0, 'the "On this page" rail is back on My Shop');
  assert.equal(mountCount(src, 'StatTile'), 0, 'a number tile is back on My Shop — the numbers are Shop › How it is going');
  assert.doesNotMatch(src, /aria-label="On this page"/, 'an "On this page" map is back on My Shop');
});

test('the rooms the retired rail pointed at still carry their anchors', () => {
  const surface = [PAGE(), ...readdirSync(resolve(SHOP, '_components'))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => read(`_components/${f}`))].join('\n');
  for (const id of ['d1', 'manage-shop', 'packages', 'auto-reply', 'getting-paid', 'shop-folds']) {
    assert.ok(count(surface, `id="${id}"`) > 0, `#${id} no longer resolves on My Shop — a sent link lands nowhere`);
  }
});
