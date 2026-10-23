/**
 * GUARD — the three tabs went, and NOT ONE CONTROL WENT WITH THEM.
 *
 * ── WHAT HAPPENED (2026-08-27) ──────────────────────────────────────────────
 * The couple's Papic page opened by asking a person to choose between three
 * tabs — Photos · Cameras & shots · Set up — a question about our filing, put
 * to them before anything had been said about their own celebration. The owner,
 * shown the finished screen: *"it still has the three tabs"*, alongside three
 * other complaints about the same page.
 *
 * The owner-approved drawing — `prototypes/papic_control_center_2026-08-25.html`
 * — replaces that choice with the thing itself: **four ways into the library**
 * (crew cameras · guest cameras · your uploads · suppliers), each reporting what
 * it has contributed and what it is waiting on. Its own port contract lists the
 * tabs as *"Replaced"* and says the replacement must be **itemised, not
 * silent**. This file is that itemisation, enforced.
 *
 * ── WHY IT IS A DERIVED BILL, NOT A HAND-WRITTEN ONE ────────────────────────
 * 🔑 A HAND-ENUMERATED LIST IS A LIST OF THE CONTROLS SOMEBODY THOUGHT OF. This
 * project has been bitten by that shape repeatedly — most recently a door guard
 * whose hand-listed file set was short by three doors, found only because the
 * owner asked whether the goal had actually been met.
 *
 * So the list below was GENERATED from the three-room page as it stood at
 * `origin/main` on 2026-08-27, by extracting every capitalised JSX tag and
 * subtracting the ones imported from `lucide-react` (an icon is decoration; a
 * dropped icon import is a cleanup, and a guard that fails on cleanups teaches
 * you to skim past the time it is right). What is left is forty CONTROLS AND
 * PANELS a couple could reach before the redesign.
 *
 * ⚠ THIS IS A BILL, NOT A DECISION. Deleting a line here is deciding that a
 * couple can no longer reach that control. Do it deliberately, with the reason
 * written beside it — never to make a red test go green.
 *
 * ⚠ IT CANNOT PROVE REACHABILITY, and does not claim to. It proves the control
 * is still MOUNTED. Whether a person can find it is what the drawing decides and
 * what `the-required-act-is-first.test.ts` holds for the one control that must
 * be found first.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAPIC = dirname(dirname(fileURLToPath(import.meta.url)));
const PAGE = readFileSync(join(PAPIC, 'page.tsx'), 'utf8');

/*
  🗂 THE PAGE SPLIT IN TWO (owner 2026-10-23, PR-B): *"Papic is the camera service. Gallery is the collection of the
  files for that event."* The Papic page is the camera settings (`PapicCameraSettings`, the same component Home's
  widget opens in place); every FILE control moved to the event's Memories tab (its page, its gallery and its ⚙
  sheet). So "still mounted" now means mounted on ONE OF THESE — the bill below follows each control to where it is.
*/
const MEMORIES = join(PAPIC, '..', '..', 'memories');
const read = (...p: string[]) => readFileSync(join(...p), 'utf8');
const SURFACES = {
  'the Papic page': PAGE,
  'the camera settings': read(PAPIC, '_components', 'papic-camera-settings.tsx'),
  'the Memories page': read(MEMORIES, 'page.tsx'),
  'the Memories ⚙ sheet': read(MEMORIES, '_components', 'memories-settings.tsx'),
  'the Memories gallery': read(PAPIC, '..', '..', '..', '..', '_components', 'memories', 'event-memories-gallery.tsx'),
  'the Drive card': read(PAPIC, '_components', 'drive-copy-card.tsx'),
  'the Keep full-res row': read(PAPIC, '_components', 'keep-full-res-row.tsx'),
  'Settings › Event access': read(PAPIC, '..', '..', 'details', 'page.tsx'),
} as const;
const EVERYWHERE = Object.values(SURFACES).join('\n');

/**
 * Every control the THREE-ROOM page mounted, generated from it — see the
 * docblock. Two of the owner's 2026-08-26 deletions (photo quality, "where your
 * photos go") are already absent from this list because they were removed
 * before it was taken; `two-questions-stay-deleted.test.ts` keeps them gone.
 */
const CONTROLS_BEFORE_THE_REDESIGN = [
  'AddToLibrary',
  'CaptureDefaultsSection',
  'CoupleChallengesManager',
  'DriveConnectCTA',
  'DriveConnectedPanel',
  'DriveCopyCard',
  'DriveReconnectBanner',
  'DriveSafetyPanel',
  'DslrBridgeSection',
  'FaceTaggingChoice',
  'GuestContributionsCard',
  'InlineCheckoutDrawer',
  'LifeFlashCard',
  'Link',
  'LiveWallCard',
  'MagazineCard',
  // The first-visit tour: the switched-off MiniTour carousel became the SPOTLIGHT on 2026-10-22 (owner "yes to all",
  // journey_fixes_later Host 4 — `customer_papic_v2`, held by `lib/the-host-page-tours-land.test.ts`). Replaced, not lost.
  'Spotlight',
  'PapicWindowPicker',
  'PoolGalleryCard',
  'RecapCard',
  'SettingRow',
  'ShutterSection',
  'StatusBanners',
  'StudioBuyHero',
  'StylePicker',
  'SubmitButton',
  'UploadsOpenChoice',
  'VendorChallengesApproval',
  'VendorMediaControls',
] as const;

/**
 * ⛔ REMOVED DELIBERATELY — each with its reason, because deleting a line from this bill is deciding a couple can no
 * longer reach it. (The 2026-09-23 removal of `PapicCamerasCard` — "no dedicated shots individually" — is recorded
 * in `no-camera-holds-its-own-credits.test.ts`.)
 */
const REPLACED_OR_REMOVED: Record<string, string> = {
  // 🗂 THE LIBRARY IS MEMORIES NOW (owner 2026-10-23): the edge-to-edge grid with Albums ▾ replaces the stage, the
  // preview card, its grid and its legend; the four ways in became the albums (Papic · Your uploads · Suppliers).
  PapicGalleryGrid: 'replaced by EventMemoriesGallery (Memories) — its PapicLightbox is still the viewer',
  GalleryPreviewCard: 'replaced by the Memories page',
  LegendDot: 'went with the preview card (Memories draws no tag legend)',
  PapicStage: 'replaced by the Memories grid; its four facts are the camera settings’ credits and the album counts',
  SourceRow: 'the four ways in became Memories’ albums (`lib/memories-albums.ts`)',
  // 🎨 MOVED: credits left · the meter · Buy more are the camera settings' Credits topic (Add more).
  PapicTopBand: 'replaced by the Credits topic of PapicCameraSettings — the same balance, meter and Buy more sheet',
  // ⚖ CREDITS ONLY (owner 2026-09-16, one pot; rd/papic-sells-only-credits removes the machinery): no camera tier,
  // no guest-camera tier, no extra paid seats are sold — so none is drawn (prototype "Not drawn, on purpose").
  ExtraCamerasPicker: 'extra paid crew seats — not sold (credits only, 2026-09-16)',
  GuestCameraTierPicker: 'Limited/Unlimited guest tiers — not sold (credits only, 2026-09-16)',
  LimitedCard: 'Limited/Unlimited guest tiers — not sold (credits only, 2026-09-16)',
  // ⚖ "When can they shoot" half-duplicates the dates once crew seats are gone (prototype Q1): the From date carries it.
  GuestCamerasChoice: 'the dates carry it (prototype Q1); per-guest camera settings are on the guest card',
};

test('🚨 every control the three rooms held is still mounted — on the Papic page or where it moved', () => {
  const missing = CONTROLS_BEFORE_THE_REDESIGN.filter((name) => !new RegExp(`<${name}\\b`).test(EVERYWHERE));
  assert.deepEqual(
    missing,
    [],
    'these controls existed on the Papic page before the tabs were replaced and are mounted nowhere now. ' +
      'Losing a control in a redesign is the failure this project pays for most:\n  ' +
      missing.join('\n  '),
  );
});

test('a control listed as replaced is really gone — the bill does not hide a second copy', () => {
  for (const name of Object.keys(REPLACED_OR_REMOVED)) {
    assert.ok(!new RegExp(`<${name}\\b`).test(PAGE), `${name} is back on the Papic page — take it off the removed list`);
  }
});

test('🚨 the tab strip cannot come back', () => {
  assert.ok(!/PAPIC_ROOM_TABS/.test(PAGE), 'the room tab strip is back');
  assert.ok(!/room === '/.test(PAGE), 'a room branch is back');
  assert.ok(
    !/aria-label="Papic sections"/.test(PAGE),
    'the sections switcher is back — this page has one section',
  );
});

test('the four ways in are Memories’ albums now — Papic, Your uploads and Suppliers among them', () => {
  const albums = read(PAPIC, '..', '..', '..', '..', '..', 'lib', 'memories-albums.ts');
  for (const label of ['Papic', 'Your uploads', 'Suppliers']) {
    assert.match(albums, new RegExp(`'${label}'`), `the "${label}" album is missing — the sources ARE the albums now`);
  }
  assert.match(SURFACES['the Memories gallery'], /ALBUM_KEYS\.map/, 'the gallery no longer offers the albums');
});

test('🚨 a supplier’s file offers no moderation on its own — the supplier is hidden supplier-wide in Settings', () => {
  const g = SURFACES['the Memories gallery'];
  assert.match(g, /if \(photo\.source === 'vendor'\) return null;/, 'a supplier file grew the photo sheet');
});

test('an offer never outranks the files — Keep full-res comes after the wall and the Drive copy', () => {
  const sheet = SURFACES['the Memories ⚙ sheet'];
  const wall = sheet.indexOf('<LiveWallCard');
  const drive = sheet.indexOf('<DriveCopyForEvent');
  const keep = sheet.indexOf('<KeepFullResRow');
  assert.ok(wall > 0 && drive > 0 && keep > 0, 'an anchor is missing');
  assert.ok(keep > wall && keep > drive, 'the Keep full-res offer is back above what the couple came to set');
});
