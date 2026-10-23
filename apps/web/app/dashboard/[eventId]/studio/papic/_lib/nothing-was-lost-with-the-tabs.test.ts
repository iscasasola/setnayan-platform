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
import { stripComments } from '@/lib/strip-comments';

const PAPIC = dirname(dirname(fileURLToPath(import.meta.url)));
const PAGE = readFileSync(join(PAPIC, 'page.tsx'), 'utf8');

/*
  🗂 THE PAGE SPLIT IN TWO (owner 2026-10-23, PR-B): *"Papic is the camera service. Gallery is the collection of the
  files for that event."* The Papic page is the camera (`PapicCameraSettings` — the same component Home's Papic card
  opens under itself); every FILE control moved to the event's Memories tab (its page, its grid and its ⚙ sheet), and a
  supplier's whole delivery is hidden from that supplier's row in Settings › Event access. So "still mounted" now means
  mounted on ONE OF THESE — the bill follows each control to where it is.
*/
const MEMORIES = join(PAPIC, '..', '..', 'memories');
const DETAILS = join(PAPIC, '..', '..', 'details');
const read = (...p: string[]) => readFileSync(join(...p), 'utf8');
const SURFACES = {
  'the Papic page': PAGE,
  'the camera settings': read(PAPIC, '_components', 'papic-camera-settings.tsx'),
  'the Memories page': read(MEMORIES, 'page.tsx'),
  'the Memories ⚙ sheet': read(MEMORIES, '_components', 'memories-settings.tsx'),
  'the Memories grid': read(PAPIC, '..', '..', '..', '..', '_components', 'memories', 'event-memories-gallery.tsx'),
  'the Drive card': read(PAPIC, '_components', 'drive-copy-card.tsx'),
  'Settings › Event access': read(DETAILS, '_components', 'people-with-access.tsx'),
} as const;
const EVERYWHERE = Object.values(SURFACES).join('\n');

/**
 * Every control the THREE-ROOM page mounted, generated from it (see the docblock), less the ones itemised below as
 * replaced or removed — each with its reason, because deleting a line from this bill is deciding a couple can no
 * longer reach it.
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
  'GuestCamerasChoice',
  'GuestContributionsCard',
  'InlineCheckoutDrawer',
  'LifeFlashCard',
  'Link',
  'LiveWallCard',
  'MagazineCard',
  // The first-visit tour: the MiniTour carousel became the SPOTLIGHT on 2026-10-22. Replaced, not lost.
  'Spotlight',
  // 🎨 MOVED, NOT REMOVED (2026-10-14): the balance, the meter and Buy more are ONE band first on the page.
  'PapicTopBand',
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
] as const;

/** ⛔ REPLACED OR REMOVED DELIBERATELY — each with its reason. */
const REPLACED_OR_REMOVED: Record<string, string> = {
  // 🗂 THE LIBRARY IS MEMORIES NOW (owner 2026-10-23): the edge-to-edge grid with Albums ▾ replaces the stage, the
  // preview card, its grid and its legend.
  PapicGalleryGrid: 'replaced by the Memories grid (EventMemoriesGallery) — its PapicLightbox is still the viewer',
  GalleryPreviewCard: 'replaced by the Memories page',
  LegendDot: 'went with the preview card',
  PapicStage: 'replaced by the Memories grid; the four facts are the credits band and the album counts',
  // A supplier's whole delivery: the switch is on that supplier's row in Settings › Event access and on a supplier
  // photo's sheet in Memories (`vendor-media-switch.test.ts` holds both mounts).
  VendorMediaControls: 'replaced by the per-supplier switch on Settings › Event access and the photo sheet',
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

test('a control listed as replaced is really gone from the Papic page — the bill hides no second copy', () => {
  for (const name of Object.keys(REPLACED_OR_REMOVED)) {
    assert.ok(!new RegExp(`<${name}\\b`).test(PAGE), `${name} is back on the Papic page — take it off the removed list`);
  }
});

test('🚨 the tab strip cannot come back', () => {
  assert.ok(!/PAPIC_ROOM_TABS/.test(PAGE), 'the room tab strip is back');
  assert.ok(!/room === '/.test(PAGE), 'a room branch is back');
  assert.ok(!/aria-label="Papic sections"/.test(PAGE), 'the sections switcher is back — this page has one section');
});

test('🚨 the camera page sells no camera — credits only (owner 2026-09-16 / 2026-10-23)', () => {
  for (const gone of ['ExtraCamerasPicker', 'GuestCameraTierPicker', 'LimitedCard', 'PAPIC_UNLOCK']) {
    assert.ok(!new RegExp(`<${gone}\\b|serviceKey="${gone}"`).test(EVERYWHERE), `${gone} is back`);
  }
});

test('an offer never outranks the files — Keep full-res comes after the wall and the Drive copy', () => {
  const sheet = SURFACES['the Memories ⚙ sheet'];
  const wall = sheet.indexOf('<LiveWallCard');
  const drive = sheet.indexOf('<DriveCopyCard');
  const keep = sheet.indexOf('serviceKey="HIGH_RES_ARCHIVE"');
  assert.ok(wall > 0 && drive > 0 && keep > 0, 'an anchor is missing');
  assert.ok(keep > wall && keep > drive, 'the Keep full-res offer is back above what the couple came to set');
});
