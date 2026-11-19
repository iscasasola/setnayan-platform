/**
 * a-refused-read-is-said-not-drawn-empty.test.ts — the MEDIUM findings of the supplier dashboard audit (2026-11-17,
 * closed PR #7934) that were still open on main on 2026-11-19, each pinned so it cannot come back.
 *
 * Same disease as `reads-are-honest.test.ts`: a refused read arrives as `[]` / `null` / `0` and the screen states an
 * absence it never measured — "Nobody waiting.", "Set how many events you take a day", "No challenges yet — write your
 * first one", auto-reply switches drawn OFF (a re-save turns them off for real), the Prints switches OFF while the facts
 * load. Plus three stuck or silent writes: "Removing…" forever, a pax decline audited when the update failed, a pick
 * past the waitlist cap on a refused count. Each block names its finding; each was sabotage-checked (origin/main's
 * source turns it red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const code = stripComments;
const dash = (rel: string) => code(readFileSync(join(HERE, rel), 'utf8'));
const web = (rel: string) => code(readFileSync(join(WEB, rel), 'utf8'));

test('D-4 · a refused waitlist read never says "Nobody waiting."', () => {
  const lib = web('lib/vendor-waitlist.ts');
  assert.match(lib, /export async function fetchVendorWaitlistRead\(/);
  assert.match(lib, /return \{ groups: \[\], ok: !error \};/, 'a refused read must come back ok: false');
  assert.match(dash('customers/page.tsx'), /datesMeasured: upcomingWaitlistRead\.ok,/);
  const folds = dash('customers/_components/dates-folds.tsx');
  assert.match(folds, /waitlist\.dates\.length === 0 && waitlist\.datesMeasured === false \? \([\s\S]{0,300}\) : waitlist\.dates\.length === 0 \? \(/);
});

test('D-5 · a refused pools read never says "Set how many events you take a day"', () => {
  const page = dash('customers/page.tsx');
  assert.match(page, /fetchVendorPoolsOrNull\(supabase, vendorProfileId\),/, 'the list must read the honest (nullable) pools');
  assert.match(page, /const poolsUnread = poolsRead === null;/);
  assert.match(page, /\{poolsUnread \? \([\s\S]{0,300}\) : pools\.length === 0 \? \(/);
});

test('D-6 · a refused waitlist count or next-couple read fails closed', () => {
  const act = dash('calendar/actions.ts');
  assert.match(act, /if \(countErr \|\| count == null\) backToCalendar\(formData, 'save_failed'\);/, '`count ?? 0` let a pick past the cap');
  assert.match(act, /if \(nextErr\) backToCalendar\(formData, 'save_failed'\);\s*if \(!next\) backToCalendar\(formData, 'waitlist_none'\);/);
});

test('D-8 · a thrown month read is "unread", never the error boundary', () => {
  assert.match(dash('customers/_components/customers-calendar.tsx'), /const res = await fetchMonth\(next\)\.catch\(\(\) => null\);/);
});

test('C-3 · a refused plan read never puts a Pro lock on a paying shop’s forms', () => {
  for (const rel of ['shop/_components/shop-forms-body.tsx', 'clients/[eventId]/_pages/forms.tsx']) {
    const src = dash(rel);
    assert.match(src, /const tierUnread = Boolean\(tierRes\.error\);/, `${rel}: the plan read's error must be read`);
    assert.match(src, /if \(has \|\| tierUnread\) return null;/, `${rel}: an unread plan must draw no lock`);
  }
});

test('F-1 · no library read never says "No suggested forms for this service yet"', () => {
  assert.match(dash('shop/_components/shop-forms-body.tsx'), /lib \? await readFormSuggestions\([\s\S]{0,80}\) : \(\{ status: 'unread' \} as const\)/);
  assert.match(dash('clients/[eventId]/_pages/forms.tsx'), /lib \? readFormSuggestions\(supabase, ownCategories\) : Promise\.resolve\(\{ status: 'unread' as const \}\)/);
});

test('C-4 · a refused challenges / photos read never says "No challenges yet" or "No shared photos yet"', () => {
  const lib = web('lib/papic-games.ts');
  assert.match(lib, /papic_vendor_challenges', error\);\s*return null;/);
  assert.match(lib, /papic_vendor_challenge_photos', error\);\s*return null;/);
  assert.match(dash('clients/[eventId]/_components/vendor-challenge-section.tsx'), /\{challengesRead === null \? \([\s\S]{0,300}\) : challenges\.length > 0 \? \(/);
  assert.match(dash('clients/[eventId]/challenge-photos/page.tsx'), /\{photosRead === null \? \([\s\S]{0,300}\) : total === 0 \? \(/);
});

test('C-5 · a refused own-submissions read never shows the full allowance', () => {
  assert.match(dash('clients/[eventId]/editorial-media/page.tsx'), /const \{ data: rows, error: rowsErr \} = await admin/);
  const studio = dash('clients/[eventId]/editorial-media/_components/editorial-media-studio.tsx');
  assert.match(studio, /const photoRoom = existingUnread \? 0 :/);
  assert.match(studio, /const clipRoom = existingUnread \? 0 :/);
});

test('C-7 · "Removing…" never spins forever, and a refused remove is said', () => {
  const studio = dash('clients/[eventId]/editorial-media/_components/editorial-media-studio.tsx');
  assert.match(studio, /setBusy\('Removing…'\);[\s\S]{0,120}try \{[\s\S]{0,300}\} finally \{\s*setBusy\(null\);\s*\}/);
  assert.match(studio, /if \(r && r\.ok === false\) setError\(/);
});

test('C-6 · a refused sign-off read is said, never "nothing to answer"', () => {
  assert.match(dash('clients/[eventId]/mood-board/page.tsx'), /unread=\{Boolean\(signoffError\)\}/);
  assert.match(dash('clients/[eventId]/_components/vendor-part-signoff.tsx'), /if \(unread && rows\.length === 0\) \{[\s\S]{0,200}Couldn&rsquo;t load/);
});

test('S-6 · a refused auto-reply read never draws switches a re-save would turn off', () => {
  const src = dash('shop/_components/autoreply-section.tsx');
  assert.ok((src.match(/unread = true;/g) ?? []).length >= 2, 'both the refused and the thrown read must mark it unread');
  assert.match(src, /\{unread \? \([\s\S]{0,200}CouldNotLoad[\s\S]{0,120}\) : \(\s*<AutoReplyCard/);
});

test('V-4 · a refused inclusions / discounts read is said over the cards', () => {
  const lib = web('lib/vendor-services.ts');
  assert.match(lib, /vendor_service_discounts', error\);\s*return \{ byService: out, ok: false \};/);
  assert.match(lib, /vendor_service_inclusions\.select', error\);\s*return \{ byService: out, ok: false \};/);
  const sm = dash('services/_components/services-manager.tsx');
  assert.match(sm, /const cardExtrasUnread = !discountsRead\.ok \|\| !inclusionsRead\.ok;/);
  assert.match(sm, /\{cardExtrasUnread \? \(/);
});

test('V-5 · a refused stay-on read keeps the #stay-on anchor the held cards point at', () => {
  assert.match(dash('services/_components/stay-on-section.tsx'), /if \(read\.status !== 'ok'\) \{\s*return \(\s*<section id="stay-on"/);
});

test('V-6 · a refused halls read never makes the venue’s "Uses" row vanish silently', () => {
  const page = dash('services/[serviceId]/page.tsx');
  assert.doesNotMatch(page, /\(\) => \(\{ data: null \}\),/, 'the thrown arm drops its error again');
  assert.match(page, /const hallsUnread = Boolean\(/);
  assert.match(page, /\{hallsUnread \? \(/);
});

test('V-7 · a refused taxonomy or plan read is never "not one couples search by"', () => {
  const act = dash('services/coverage-actions.ts');
  assert.doesNotMatch(act, /getCoverageTaxonomy\(\)\.catch\(\(\) => \[\]\)/);
  assert.match(act, /if \(tree === null\) \{\s*return \{ status: 'error'/);
  assert.match(act, /if \(tierErr\) \{\s*return \{ status: 'error'/);
});

test('V-8 · V-9 · the coverage panel points at a real page, and its ✕ and crumbs are honest', () => {
  const panel = dash('services/_components/coverage-panel.tsx');
  assert.doesNotMatch(panel, /under Tools/, '"under Tools" points at a view that was removed');
  assert.match(panel, /href=\{SERVICE_REQUEST_NEW_HREF\}/);
  assert.match(panel, /relative inline-flex h-4 w-4 items-center justify-center rounded-full after:absolute after:-inset-3\.5/, 'the destructive ✕ needs a 44 px press');
  assert.doesNotMatch(panel, /onClick=\{\(\) => \{\}\}/, 'a crumb that is a button doing nothing');
});

test('H-3 · a refused pax decline is never audited', () => {
  const act = dash('messages/[threadId]/pax-actions.ts');
  const decline = act.slice(act.indexOf('export async function declinePaxSurcharge'));
  assert.match(decline, /const \{ error \} = await r\.admin[\s\S]{0,200}if \(error\) \{[\s\S]{0,200}return;\s*\}\s*await writeAudit\(r, 'decline'/);
});

test('H-4 · H-5 · a refused suppliers or event read is never "None yet" / "No date yet"', () => {
  const page = dash('messages/[threadId]/page.tsx');
  assert.match(page, /if \(vendors\.error\) \{[\s\S]{0,300}locked: null, total: null/);
  assert.match(page, /const \[\{ data: ev, error: evErr \}, stage\] = await Promise\.all\(\[eventRead, railStageRead\]\);[\s\S]{0,300}if \(evErr\) \{[\s\S]{0,200}return null;/);
});

test('P-1 · P-2 · the Prints facts are never drawn OFF while unread, and Save presses reach 44 px', () => {
  const src = dash('shop/promote/_components/shop-prints-section.tsx');
  assert.doesNotMatch(src, /on=\{badgeRead\.k === 'ok' &&/, 'a switch drawn off while the facts load or failed');
  assert.equal((src.match(/<FactPending k=\{badgeRead\.k\} \/>/g) ?? []).length, 3, 'Verified · Rating · Badges each say Checking / Couldn’t load');
  assert.equal((src.match(/after:absolute after:inset-x-0 after:-inset-y-\[5px\]/g) ?? []).length, 2, 'both 34 px Save links need a 44 px press');
  assert.match(src, /h-9 flex-none[^"]*after:-inset-y-1 /, 'the 36 px Save all needs a 44 px press');
});

test('L-4 · a refused scheduled-change / credit read never prices "Today"', () => {
  const screen = dash('subscription/_components/plan-screen.tsx');
  assert.match(screen, /const planChangeUnread = Boolean\(planChangeErr\);/);
  assert.match(screen, /today: planChangeUnread \? \{\} : Object\.fromEntries\(/);
  assert.match(screen, /\{planChangeUnread \? \(\s*<ShopNotice/);
});

test('L-6 · L-7 · the stop-paying row is a statement, and it leads with the date', () => {
  const rows = dash('subscription/_components/plan-rows.tsx');
  assert.doesNotMatch(rows, /title="Cancel the plan"/, 'a row worded as a door with nowhere to go');
  assert.match(rows, /`Free after \$\{expiresOn\} if you skip the next payment`/);
  assert.doesNotMatch(rows, /you are on Free after \$\{expiresOn\}/, 'the date sat at the end of an 85-character line and was cut off');
});
