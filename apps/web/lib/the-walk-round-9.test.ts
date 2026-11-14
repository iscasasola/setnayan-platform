/**
 * 🚶 ROUND 9 — W1's first check of the never-fixed supplier findings, live c0c8ff4 (14 Nov 2026).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { launchOfferFeesLine, type LaunchOfferSettings } from './launch-offer';
import { clientFilingDate, onlyCandidateDay } from './vendor-customer-pipeline';

const code = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));

const offer = (o: Partial<LaunchOfferSettings>): LaunchOfferSettings => ({
  enabled: true,
  cap: 2000,
  papicCredits: 50,
  cycleDays: 28,
  startedAt: '2026-10-08T00:00:00.000Z',
  closedAt: null,
  proEndsAt: null,
  used: 3,
  ...o,
});

test('F-W1-30 · the Booking fees page names the launch offer while it runs — from the live settings, never typed', () => {
  const now = Date.parse('2026-11-14T00:00:00.000Z');
  const line = launchOfferFeesLine(offer({}), now);
  assert.match(line ?? '', /^Launch offer · Setnayan's first 2,000 bookings are free — 1,997 still open\./);
  // Closed, switched off, unset or unreadable: nothing about it (never a guess about money).
  assert.equal(launchOfferFeesLine(offer({ enabled: false }), now), null);
  assert.equal(launchOfferFeesLine(offer({ cap: null }), now), null);
  assert.equal(launchOfferFeesLine(offer({ used: 2000 }), now), null);
  assert.equal(launchOfferFeesLine(null, now), null);
  const page = code('app/vendor-dashboard/booking-fees/page.tsx');
  assert.match(page, /launchOfferFeesLine\(await readLaunchOffer\(createAdminClient\(\)\)/);
  assert.match(page, /data-fees-launch-offer=""/);
  assert.doesNotMatch(page, /first 2,?000 bookings/, 'the cap is never typed into the page');
});

test('F-W1-47 · a client with ONE candidate day files under that day, not under "No date yet"', () => {
  assert.equal(onlyCandidateDay(['2027-06-19']), '2027-06-19');
  assert.equal(onlyCandidateDay(['2027-06-19', '2027-06-26']), null, 'several candidates: no single day');
  assert.equal(onlyCandidateDay([]), null);
  assert.equal(onlyCandidateDay(null), null);
  assert.equal(clientFilingDate({ eventDate: null, onlyCandidateDate: '2027-06-19' }), '2027-06-19');
  assert.equal(clientFilingDate({ eventDate: '2027-01-02', onlyCandidateDate: '2027-06-19' }), '2027-01-02', 'a fixed day wins');
  const sort = code('app/vendor-dashboard/customers/clients-show-sort.ts');
  assert.match(sort, /if \(group === 'day'\) return \(r\) => clientFilingDate\(r\) \?\? 'No date yet';/);
  assert.match(sort, /c\.sort === 'date'\) return \(clientFilingDate\(a\)/);
  const page = code('app/vendor-dashboard/customers/page.tsx');
  assert.match(page, /onlyCandidateByEvent\.set\(e\.event_id, onlyCandidateDay\(e\.date_candidates\)\)/);
  assert.match(page, /onlyCandidateDate: onlyCandidateByEvent\.get\(eventId\) \?\? null,/);
});

test('RW-59 · an event dated only by its one picked day: the Hub and the reply page read ONE reply window', async () => {
  const { replyWindow, REPLY_WINDOW_EVENT_COLUMNS } = await import('./reply-window');
  // /w3-barkada-hangout as measured in prod (14 Nov 2026): a get-together, no event_date, one candidate, default ask.
  const raw = {
    event_type: 'simple_event',
    event_date: null,
    event_end_date: null,
    launch_mode: 'auto',
    manual_phase: null,
    std_invitation_launch_date: null,
    guest_list_edit_deadline: null,
    rsvp_ask_config: null,
    date_candidates: ['2026-12-20'],
  };
  const face = { phasesEnabled: true, solemn: false };
  const now = Date.parse('2026-11-14T03:00:00.000Z');
  const { withPickedDate } = await import('./event-anchor');
  // The Hub's loader dates the row (withPickedDate) before asking; the reply page passes the raw row. Same answer.
  const hub = replyWindow(withPickedDate(raw), now, 'Asia/Manila', face);
  const replyPage = replyWindow(raw, now, 'Asia/Manila', face);
  assert.deepEqual(replyPage, hub, 'the reply page and the Hub disagree about the window');
  // Every reader that selects the window's own columns now carries the picked day.
  assert.match(REPLY_WINDOW_EVENT_COLUMNS, /\bdate_candidates\b/);
  for (const f of ['app/[slug]/invite/reply/page.tsx', 'app/[slug]/invite/enter/page.tsx']) {
    assert.match(code(f), /std_invitation_launch_date[^`]*date_candidates`/, f);
  }
});

test('RW-256 / RW-64 · the account switcher’s OTHER accounts never show "Someone —" either', () => {
  const src = code('app/_components/account-switcher/account-switcher.tsx');
  assert.match(src, /<span className=\{NAME\}>\{realNameOrNull\(acct\.name\) \?\? acct\.email\}<\/span>/);
  assert.match(src, /\(realNameOrNull\(acct\.name\) \?\? acct\.email\)\.charAt\(0\)/);
  assert.doesNotMatch(src, /acct\.name\?\.trim\(\) \|\| acct\.email/);
});

test('RW-87 · before the day the run of show is labelled "Starts", and the day carries its year', async () => {
  const { weekdayDateWithYear } = await import('./format-date');
  assert.equal(weekdayDateWithYear('2027-05-15'), 'Sat, May 15, 2027');
  assert.equal(weekdayDateWithYear(null), null);
  const h = code('app/_components/run-of-show-header.tsx');
  assert.equal((h.match(/notStarted && startsOnWords \? 'Starts' : 'Now'/g) ?? []).length, 2);
});

test('RW-263 · the Get-together’s browser tab says Get-together, not "Simple Event"', () => {
  const page = code('app/onboarding/simple/page.tsx');
  assert.match(page, /title: 'Create a Get-together'/);
  assert.doesNotMatch(page, /Simple Event'/);
});

test('RW-262 · a Lights & Sound card is never "Filled for a florist"', async () => {
  const { supplierTypeForKind } = await import('./service-card-maker');
  assert.equal(supplierTypeForKind('lights_sound', 'design'), 'other');
  assert.equal(supplierTypeForKind('led_wall', 'design'), 'other');
  assert.equal(supplierTypeForKind('florist', 'design'), 'florist');
  assert.equal(supplierTypeForKind('stylist_decorator', 'design'), 'florist');
  assert.equal(supplierTypeForKind('mandap_decor', 'design'), 'florist');
});

test('RW-264 · the couple’s Suppliers row reads the shop’s current name, not the one copied at booking', () => {
  const page = code('app/dashboard/[eventId]/vendors/page.tsx');
  assert.match(page, /vendor_id: v\.vendor_id,\s*vendor_name: mk\?\.name \?\? v\.vendor_name,/);
});

test('RW-265 · a verified shop’s logo changes by request — the menu never offers an upload the server refuses', async () => {
  const { ADMIN_SET_UP_ROW_FIELD, identityLockOf, rowAsks } = await import('./vendor-corrections');
  assert.equal(ADMIN_SET_UP_ROW_FIELD.logo, 'logo_url');
  const verified = identityLockOf({ public_visibility: 'verified', created_by_admin_user_id: null, user_id: 'u' });
  // The Details screens' logo row becomes "Ask to change" for a verified shop.
  assert.equal(rowAsks('logo', true, { requestOnly: verified.requestOnly, pending: [] }), 'ask');
  // An unverified shop's logo stays its own to change.
  const open = identityLockOf({ public_visibility: 'hidden', created_by_admin_user_id: null, user_id: 'u' });
  assert.equal(rowAsks('logo', true, { requestOnly: open.requestOnly, pending: [] }), null);
  const menu = code('app/vendor-dashboard/shop/_components/photo-menus.tsx');
  assert.match(menu, /if \(isVerified && logoItem && logoUrl\) \{/);
  assert.match(menu, /<RequestOnlyRow item=\{logoItem\} data=\{logoFields\} field=\{ADMIN_SET_UP_ROW_FIELD\.logo\}/);
});

test('RW-267 · the public shop lists each service once', () => {
  const page = code('app/v/[slug]/page.tsx');
  assert.match(page, /const distinctServiceKeys = distinctShopServices\(\s*vendor\.services,/);
  assert.match(page, /orderFeaturedFirst\(\s*distinctServiceKeys,/);
});

test('RW-268 · the logo "Ask to change" uploads a picture and files its key, not a typed line', () => {
  const row = code('app/vendor-dashboard/shop/_components/editable-row.tsx');
  const ask = row.slice(row.indexOf('export function RequestOnlyRow'), row.indexOf('function StatusChip'));
  assert.match(ask, /const isLogo = field === 'logo_url';/);
  assert.match(ask, /\{isLogo \? \(\s*<div className="space-y-2" data-logo-ask-upload="">\s*<FileUpload\s+bucket="media"\s+pathPrefix=\{`vendors\/\$\{data\.vendorProfileId\}\/logo`\}/);
  assert.match(ask, /onChange=\{\(v\) => setValue\(Array\.isArray\(v\) \? \(v\[0\] \?\? ''\) : \(v \?\? ''\)\)\}/);
  assert.match(ask, /fd\.set\('requested_value', value\);/);
  assert.match(ask, /isLogo \? 'Choose the new logo first\.'/);
});

test('RW-269 · Check a date shows once — the About panel keeps its line, not a second door', () => {
  const panel = code('app/v/[slug]/_components/shop-can-do-panel.tsx');
  assert.doesNotMatch(panel, /<CheckADateLink\b/);
  assert.match(panel, /Check a date against their real calendar/);
  assert.equal((code('app/v/[slug]/page.tsx').match(/<CheckADateLink\b/g) ?? []).length, 1);
});

test('RW-270 · on a phone the calling card’s column is the card’s width, so the map and Directions stay inside', () => {
  const page = code('app/v/[slug]/page.tsx');
  assert.match(page, /<section className=\{SHOP_CARD_SECTION_CLASS\}>\s*<Logo [^>]*\/>[\s{}]*<div className="w-full min-w-0 space-y-2">/);
  assert.match(code('app/v/[slug]/_components/sample-shop-page.tsx'), /<div className="w-full min-w-0 space-y-2">/, 'the sample drew it the same way');
});

test('RW-274 · the group composer grows in its seat — the row seat holding a textarea is not a fixed 44 px pill', () => {
  const css = readFileSync(join(process.cwd(), 'components/thumb-row.module.css'), 'utf8');
  assert.match(css, /\.fieldNode:has\(textarea\) \{ height: auto; min-height: 44px;/);
  assert.match(css, /\.fieldNode:has\(textarea\) > \* \{ height: auto; min-height: 44px; \}/);
  assert.match(css, /\.row:has\(> \.fieldNode textarea\) \{ align-items: flex-end; \}/);
  // Enter sends, Shift+Enter is a new line — the house rule (on a touch keyboard Return is a new line; the arrow sends).
  const composer = code('app/dashboard/(account)/samahan/[communityId]/_components/group-composer.tsx');
  assert.match(composer, /shouldSendOnEnter\(e\.nativeEvent, \{ coarsePointer: isCoarsePointer\(\) \}\)/);
});

test('RW-275 · a stand-in is no name in a group either — "Someone —" never names a member', async () => {
  const { accountPersonName } = await import('./account-person-name');
  assert.equal(accountPersonName({ display_name: 'Someone —' }), null);
  assert.equal(accountPersonName({ display_name: 'Someone —', first_name: 'Ana', last_name: 'Reyes' }), 'Ana Reyes');
  assert.equal(accountPersonName({ display_name: '', first_name: 'Someone', last_name: '—' }), null);
  assert.equal(accountPersonName({ display_name: 'Ana' }), 'Ana');
  assert.match(code('lib/samahan-stories.ts'), /const label = realNameOrNull\(r\.display_name\);/);
});

test('RW-276 · the group chat opens on the newest line and stays there while it settles; the ＋ has a face', () => {
  const room = code('app/dashboard/(account)/samahan/[communityId]/_components/group-chatroom.tsx');
  assert.match(room, /useStickToNewest\(chatRef, items\.length\);/);
  assert.match(room, /new ResizeObserver\(pin\)/);
  assert.match(room, /stuck\.current = el\.scrollHeight - el\.scrollTop - el\.clientHeight < 48;/);
  // A bare svg inside a round's menu button is hidden by the row's CSS — the face is wrapped, as ActionFace is.
  assert.match(room, /trigger=\{\s*<span aria-hidden className="inline-flex" data-group-plus-face="">\s*<Plus /);
  const css = readFileSync(join(process.cwd(), 'components/thumb-row.module.css'), 'utf8');
  assert.match(css, /\.menu :global\(button\[aria-haspopup='listbox'\]\) > svg \{ display: none; \}/, 'the rule the wrapper answers');
});

test('a gmail address folds the password at once on the sign-in card — before the Google door has loaded (live fault 14 Nov)', async () => {
  const lib = code('lib/google-address.ts');
  // Folds hidden AND disabled (Tab cannot land there; a hidden required box cannot block the form)…
  assert.match(lib, /p\.style\.display = fold \? 'none' : '';/);
  assert.match(lib, /for \(const i of inputs\) i\.disabled = fold;/);
  // …only for a name Google owns (no network in the card), and hands over to the door once it is mounted.
  assert.match(lib, /const fold = enabled && isGoogleNamedDomain\(emailDomain\(email\)\);/);
  assert.match(lib, /if \(form\.querySelector\('\[data-google-address-door\]'\)\) return 'door';/);
  const { EARLY_FOLD_GIVE_BACK_MS } = await import('./google-address');
  assert.ok(EARLY_FOLD_GIVE_BACK_MS > 0 && EARLY_FOLD_GIVE_BACK_MS <= 10_000, 'a door that never loads gives the password back');
  const card = code('app/login/_components/sign-in-card.tsx');
  assert.match(card, /onChange=\{\(e\) => \{\s*setTyped\(e\.target\.value\);\s*foldEarly\(e\.target\.value\);\s*\}\}/);
  assert.match(card, /earlyGoogleFold\(formRef\.current, email, Boolean\(showOAuth\) && GOOGLE_DOOR_ON\)/);
  assert.match(card, /<form\s+ref=\{formRef\}/);
  // The door stays the one owner once it loads: /signup and onboarding import it directly (no load window).
  assert.match(code('app/signup/page.tsx'), /import \{ GoogleAddressDoor \} from '@\/app\/_components\/auth\/google-address-door';/);
  assert.match(
    code('app/onboarding/wedding/_components/onboarding-shell.tsx'),
    /import \{ GoogleAddressDoor \} from '@\/app\/_components\/auth\/google-address-door';/,
  );
});
