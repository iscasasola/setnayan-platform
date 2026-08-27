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
  'ExtraCamerasPicker',
  'FaceTaggingChoice',
  'GalleryPreviewCard',
  'GuestCameraTierPicker',
  'GuestCamerasChoice',
  'GuestContributionsCard',
  'HostPoolMeterCard',
  'InlineCheckoutDrawer',
  'LegendDot',
  'LifeFlashCard',
  'LimitedCard',
  'Link',
  'LiveWallCard',
  'MagazineCard',
  'MiniTour',
  'PapicCamerasCard',
  'PapicGalleryGrid',
  'PapicPoolCard',
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
  // ⚠ RENAMED, NOT REMOVED (2026-08-28). `WhereYouStand` rendered the four facts
  // on white above the page; `PapicStage` renders the SAME four facts fused onto
  // the dark library panel that now opens the page, and the counts behind them
  // moved into one shared reader. The control a person uses is unchanged — this
  // line follows it rather than being deleted, because deleting a line from this
  // bill is how a control goes missing quietly.
  'PapicStage',
] as const;

test('🚨 every control the three rooms held is still mounted on the one page', () => {
  const missing = CONTROLS_BEFORE_THE_REDESIGN.filter(
    (name) => !new RegExp(`<${name}\\b`).test(PAGE),
  );
  assert.deepEqual(
    missing,
    [],
    'these controls existed on the Papic page before the tabs were replaced and are gone now. ' +
      'Losing a control in a redesign is the failure this project pays for most:\n  ' +
      missing.join('\n  '),
  );
});

test('🚨 the tab strip cannot come back', () => {
  assert.ok(!/PAPIC_ROOM_TABS/.test(PAGE), 'the room tab strip is back');
  assert.ok(!/room === '/.test(PAGE), 'a room branch is back');
  assert.ok(
    !/aria-label="Papic sections"/.test(PAGE),
    'the sections switcher is back — this page has one section',
  );
});

test('the four ways in are all four, and they are named the way the drawing names them', () => {
  const waysIn = PAGE.slice(PAGE.indexOf('Four ways into your library'));
  assert.ok(waysIn.length > 0, 'the ways-in section is gone');
  for (const label of ['Crew cameras', 'Guest cameras', 'Your uploads', 'Suppliers']) {
    assert.ok(
      new RegExp(`label="${label}"`).test(waysIn),
      `the "${label}" way in is missing — the four sources ARE the replacement for the tabs`,
    );
  }
  assert.equal(
    (waysIn.match(/<SourceRow\b/g) ?? []).length,
    4,
    'there are no longer exactly four source rows',
  );
});

test('🚨 the supplier row offers no door, because the lane is switched off', () => {
  // The supplier capture lane is built and dark behind the outstanding privacy
  // ruling; today a booked photographer can only hand over a link to their own
  // gallery. A row that opened a sheet would be a control that cannot do the
  // thing it names — the gate-with-no-handle shape, in new clothes.
  // ⚠ SLICE, DON'T PATTERN-MATCH THE WHOLE ELEMENT. A first cut tried to match
  // `<SourceRow …/>` in one regex and failed on the row's OWN icon expression,
  // `icon={<Camera … />}` — the inner `/>` ends the match early. It reported the
  // row missing when it was there, which is a guard crying wolf on its first run.
  const at = PAGE.indexOf('label="Suppliers"');
  assert.ok(at > 0, 'the Suppliers row is gone — the gap it names is still real');
  const start = PAGE.lastIndexOf('<SourceRow', at);
  const row = PAGE.slice(start, PAGE.indexOf('</div>', at));
  assert.ok(
    /state="Not open yet"\s*\/>/.test(row),
    'the Suppliers row grew children or lost its state — today it must be an inert line, ' +
      'because a photographer still cannot put files into the library at all',
  );
  assert.ok(!/href=/.test(row), 'the Suppliers row links somewhere; the lane is not open');
});

test('an offer never outranks the day — the buy tiles come last', () => {
  const waysIn = PAGE.indexOf('Four ways into your library');
  const unlock = PAGE.indexOf('Everything Papic, one price');
  const keep = PAGE.indexOf('Keep your full-res originals');
  assert.ok(waysIn > 0 && unlock > 0 && keep > 0, 'an anchor is missing');
  assert.ok(
    unlock > waysIn && keep > waysIn,
    'a buy tile is back above the library. The unlock bundle used to be the first thing in ' +
      'Cameras & shots; an offer is not what a person came to this page to do.',
  );
});
