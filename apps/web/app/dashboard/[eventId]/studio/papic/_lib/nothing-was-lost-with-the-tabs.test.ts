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
  // ⛔ REMOVED DELIBERATELY, 2026-10-23 — `ExtraCamerasPicker`, `GuestCameraTierPicker` and `LimitedCard`.
  // ⚖ Owner, over his own page: "why do i have these?" — the crew-camera tier ladder and the guest-camera
  // Limited / Unlimited sheet ("activate 264 guest cameras · ₱6,000"). Both sold a camera of its own; the
  // 2026-09-16 ruling — "we do not have papic seat. we only have papic with credits and shared amongst
  // everybody" — retired that model. Their buy actions now REFUSE (`lib/papic-sells-only-credits.ts`), and
  // `lib/papic-sells-only-credits.test.ts` keeps all three unmounted. Historical orders are untouched.
  'FaceTaggingChoice',
  'GalleryPreviewCard',
  'GuestCamerasChoice',
  'GuestContributionsCard',
  'InlineCheckoutDrawer',
  'LegendDot',
  'LifeFlashCard',
  'Link',
  'LiveWallCard',
  'MagazineCard',
  // The first-visit tour: the switched-off MiniTour carousel became the SPOTLIGHT on 2026-10-22 (owner "yes to all",
  // journey_fixes_later Host 4 — `customer_papic_v2`, held by `lib/the-host-page-tours-land.test.ts`). Replaced, not lost.
  'Spotlight',
  // ⛔ REMOVED DELIBERATELY, 2026-09-23 — and this is what "deleting a line here
  // is a decision" looks like when the decision is the owner's, twice.
  //
  // ⚖ 2026-09-16: *"no dedicated shots individually"*, over his own 2026-08-11
  // ruling that created this card. Re-confirmed 2026-09-22 against a question
  // naming THIS control rather than the category — an earlier asking said
  // "dedicated camera credits", which names two mechanisms at once, and its
  // answer ("should stay") was about the FREE camera grant.
  //
  // 🔑 It was the page's own contradiction: the Crew-cameras sheet says every
  // shot draws from the shared pot while this card handed credits to one QR.
  //
  // The control is gone AND so is its machinery — `papic_dedicate_shots` and
  // `papic_seat_allocations` are dropped (migration 20271243295861), so it
  // cannot be re-added by restoring a file. `no-camera-holds-its-own-credits.test.ts`
  // holds both halves, including that the FREE camera grant survived.
  'PapicGalleryGrid',
  // 🎨 MOVED, NOT REMOVED (owner "approve all", 2026-10-14). `HostPoolMeterCard`
  // (the balance + meter) and `PapicPoolCard` (the − / + stepper and "Continue to
  // payment") are now ONE band first on the page — the same balance, the same
  // meter, the same stepper in the Buy more sheet (`papic-buy-sheet.tsx` →
  // `papic-buy-form.tsx`). This line follows them.
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

test('the ways in are named for the shared-credit model, and none of them sells a camera', () => {
  // 2026-10-23: four ways became three. "Crew cameras" (a QR per seat + a tier ladder) became the ONE
  // shared code; "Your uploads" moved INTO the library (one door — `AddPhotosDoor` on the stage); "Guest
  // cameras" stays as a line saying the guest's invite QR is the camera; "Suppliers" says its true reason.
  const waysIn = PAGE.slice(PAGE.indexOf('label="Ways into your library"'));
  assert.ok(PAGE.includes('label="Ways into your library"'), 'the ways-in section is gone');
  for (const label of ['One code for everyone', 'Guest cameras']) {
    assert.ok(new RegExp(`label="${label}"`).test(waysIn), `the "${label}" way in is missing`);
  }
  assert.ok(/<SupplierWayInRow\b/.test(waysIn), 'the Suppliers way in is missing');
  for (const gone of ['Crew cameras', 'Your uploads']) {
    assert.ok(!new RegExp(`label="${gone}"`).test(PAGE), `the retired "${gone}" row is back`);
  }
});

test('🚨 the supplier row offers no door, and says a reason it READ', () => {
  // Nothing on that row is the couple's to set — hiding a supplier's photos is `VendorMediaControls`. And
  // "Not open yet" was a hard-coded claim, false wherever a supplier is booked (the lane is LIVE behind the
  // `vendor_papic_capture` control): the reason is now read (`lib/papic-supplier-way-in.ts`).
  const row = readFileSync(join(PAPIC, '_components', 'supplier-way-in-row.tsx'), 'utf8');
  const mount = row.slice(row.indexOf('<SourceRow'));
  assert.ok(mount.length > 0, 'the Suppliers row is gone — the gap it names is still real');
  assert.ok(!/href=/.test(mount) && !/sheetTitle=/.test(mount), 'the Suppliers row grew a door');
  assert.ok(/state=\{supplierWayInLabel\(state\)\}/.test(mount), 'the Suppliers row no longer says the reason it read');
  assert.ok(!/Not open yet/i.test(stripComments(PAGE + '\n' + row)), 'the hard-coded "Not open yet" is back');
});

test('an offer never outranks the day — the buy tiles come last', () => {
  // (The "Everything Papic, one price" unlock tile is gone — it sold "Unlimited cameras", 2026-10-23.)
  const waysIn = PAGE.indexOf('label="Ways into your library"');
  const keep = PAGE.indexOf('Keep your full-res originals');
  assert.ok(waysIn > 0 && keep > 0, 'an anchor is missing');
  assert.ok(
    keep > waysIn,
    'a buy tile is back above the library. The unlock bundle used to be the first thing in ' +
      'Cameras & shots; an offer is not what a person came to this page to do.',
  );
});
