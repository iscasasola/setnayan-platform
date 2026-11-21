/**
 * THE LOW AUDIT FINDINGS STAY FIXED — the L rows of the supplier dashboard audit (2026-11-17) and the code rows of the
 * logged-out crawl of www.setnayan.com (2026-11-14), fixed together on 2026-11-19. Each test names its finding; each
 * reads the SOURCE (like `vendor-dashboard/reads-are-honest.test.ts`), so it proves the fault is not handed to the
 * render — not what a browser finally draws.
 *
 * SABOTAGE: put any one fault back (a `min-h-0` "Try again" with no halo, `if (!shop) return []`, a plain "Sent" over a
 * chat line that failed, "· 0" above "couldn't load", a thrown form call with no catch, "Back to Promote" from Prints,
 * `countUnread` on the Settings row, "every cell read from the code", "priced in the live catalogue", `Allow: /supplies`,
 * "Supplier" on a 404, a static /sample title, a document title that ends in "· Setnayan") → RED, and the message
 * names the finding.
 *
 * Crawl #1 / #2 (a "See the sample shop" card that linked to a 404) have no test here: the 20 Nov /for-suppliers and
 * /for-coordinators pages (batch A, #8050 / #8051) no longer draw that card, so there is nothing left to gate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// ── supplier dashboard audit (r7934) ────────────────────────────────────────────────────────────────────────────

test('D-9 · the Dates "Try again" under unread hours presses at 44 (sn-hit) without a new drawing', () => {
  const src = read('app/vendor-dashboard/customers/_components/customers-calendar.tsx');
  assert.match(src, /className="sn-press sn-hit min-h-0 [^"]*"\s*disabled=\{rereading\}/, 'D-9: the hours "Try again" is an 18-px press again');
});

test('C-8 · the picked client\'s "Event brief" back links and the cocktail resize handle press at 44', () => {
  for (const page of ['production-sheet', 'editorial-media', 'cocktail', 'seat-plan']) {
    const src = read(`app/vendor-dashboard/clients/[eventId]/${page}/page.tsx`);
    assert.match(src, /className="sn-hit inline-flex items-center gap-1\.5 [^"]*"\s*>\s*<ArrowLeft aria-hidden className="h-4 w-4" \/> Event brief/, `C-8: ${page} "Event brief" lost its halo`);
  }
  const cocktail = read('app/vendor-dashboard/clients/[eventId]/cocktail/cocktail-editor.tsx');
  assert.match(cocktail, /aria-label="Resize cocktail area"\s*className="sn-hit-2d /, 'C-8: the 20-px resize handle lost its both-ways halo');
});

test('V-11 · an unresolved shop says every photo is unchecked — never [] ("no photo problems")', () => {
  const src = read('app/vendor-dashboard/services/card-check-actions.ts');
  const fn = src.slice(src.indexOf('async function checkCardPhotosAction('), src.indexOf('export type ReportCardPhotoResult'));
  assert.ok(fn.length > 100, 'V-11: checkCardPhotosAction moved — re-anchor this guard');
  assert.doesNotMatch(fn, /if \(!shop\) return \[\];/, 'V-11: an unresolved shop reads as "no photo problems" again');
  assert.match(fn, /if \(!shop\) \{[\s\S]*?verdict: 'unchecked' as const[\s\S]*?verdict: 'unchecked' as const/, 'V-11: the unresolved shop no longer answers each photo "unchecked"');
});

test('H-6 · "Sent" over a chat line that failed says the line is missing', () => {
  const act = read('app/vendor-dashboard/messages/[threadId]/questions-actions.ts');
  assert.match(act, /\| \{ status: 'sent'; count: number; chatLine: boolean \}/, 'H-6: the sent state no longer carries whether the chat line posted');
  assert.match(act, /return \{ status: 'sent', count, chatLine: !msgError \};/, 'H-6: "sent" is returned without the chat line\'s own result');
  const btn = read('app/vendor-dashboard/messages/[threadId]/_components/send-questions-button.tsx');
  assert.match(btn, /state\.status === 'sent' && !state\.chatLine \?[\s\S]*?data-questions-chat-line-missing=""/, 'H-6: the button never says the chat note did not post');
});

test('F-2 · an unread event-forms list draws no "· 0" above "couldn\'t load"', () => {
  const src = read('app/vendor-dashboard/forms/_components/forms-page-body.tsx');
  assert.doesNotMatch(src, /formatCount\(eventForms\?\.length \?\? 0\)/, 'F-2: a refused read is counted as 0 in the heading again');
  assert.match(src, /This event&rsquo;s forms\{eventForms === null \? null : <> · \{formatCount\(eventForms\.length\)\}<\/>\}/, 'F-2: the heading count is not gated on a read list');
});

test('F-3 · a thrown form call says so in place (form maker and form view)', () => {
  const maker = read('app/vendor-dashboard/forms/_components/form-maker.tsx');
  assert.match(maker, /start\(async \(\) => \{\s*try \{[\s\S]*?\} catch \{\s*setState\(\{ status: 'error', message: 'That didn’t go through\. Reload and try again\.' \}\);/, 'F-3: the form maker\'s save/send can throw past setState again');
  const view = read('app/vendor-dashboard/forms/_components/form-view-sheet.tsx');
  assert.match(view, /start\(async \(\) => \{\s*const fd[\s\S]*?try \{[\s\S]*?\} catch \{\s*setSaid\(\{ ok: false, words: 'That didn’t go through\. Reload and try again\.' \}\);/, 'F-3: the form view\'s send/keep can throw past setSaid again');
});

test('P-3 · the prints back press names where it goes, and presses at 44 wide', () => {
  const src = read('app/vendor-dashboard/shop/promote/_components/shop-prints-section.tsx');
  assert.match(src, /aria-label=\{big \|\| backTo === 'Prints' \? 'Back to Prints' : 'Back to Promote'\}\s*className="sn-press sn-hit-2d grid h-9 w-9/, 'P-3: the prints back press says "Back to Promote" from Prints, or lost its halo');
  const body = read('app/vendor-dashboard/shop/promote/_components/promote-body.tsx');
  assert.match(body, /backTo=\{part === 'prints' \? 'Prints' : 'Promote'\}/, 'P-3: Shop › Prints no longer tells the prints sheet it came from Prints');
});

test('G-1 · the Settings Notifications row reads the nullable count and says an unread one', () => {
  const page = read('app/vendor-dashboard/settings/page.tsx');
  assert.match(page, /readUnreadNotificationCount\(supabase, user\.id\)/, 'G-1: Settings reads the count that answers 0 on a refusal again');
  assert.doesNotMatch(page, /countUnread\(/, 'G-1: Settings reads countUnread (0 on error) again');
  const view = read('app/vendor-dashboard/settings/settings-view.tsx');
  assert.match(view, /unread: number \| null;/, 'G-1: the view can no longer be told the count is unknown');
  assert.match(view, /unread === null\s*\?\s*'Couldn’t count what’s new just now/, 'G-1: an unread count is drawn as "nothing new"');
});

// ── logged-out crawl (r7660) ───────────────────────────────────────────────────────────────────────────────────

test('#9 · the features register speaks to visitors, not about the code', () => {
  const src = read('lib/features-page.ts');
  assert.doesNotMatch(src, /read from the code|read from the limits|Every cell (is )?read/, '#9: developer copy ("every cell read from the code") is shown on /features again');
});

test('#11 · the feature-page FAQs never say "priced in the live catalogue"', () => {
  for (const rel of ['lib/feature-pages/invite.ts', 'lib/feature-pages/day-memories.ts', 'lib/feature-pages/plan-b.ts']) {
    const src = read(rel);
    assert.doesNotMatch(src, /live catalogue/, `#11: ${rel} tells a visitor about "the live catalogue" again`);
    assert.doesNotMatch(src, /₱\d/, `#11: ${rel} types a peso figure`);
  }
  assert.match(read('lib/feature-pages/invite.ts'), /The optional ◆ Pro upgrade covers everyone on your event; today’s price is on our Pricing page\./, '#11: the Event Hub FAQ no longer says where the price is');
});

test('#12 · robots allows no unshipped /supplies, and an unknown address is titled as a 404, not "Supplier"', () => {
  const robots = read('app/robots.ts');
  assert.doesNotMatch(robots, /'\/supplies'/, '#12: robots.txt Allows /supplies, a 404, again');
  const shop = read('app/v/[slug]/page.tsx');
  const meta = shop.slice(shop.indexOf('export async function vendorMetadataBySlug('), shop.indexOf('const displayLabel'));
  assert.match(meta, /const vendor = await fetchVendor\(slug\);\s*if \(!vendor\) return \{ title: 'Page not found', robots: \{ index: false, follow: false \} \};/, '#12: a path with no shop behind it is titled "Supplier · Setnayan" again');
});

test('#13 · a closed /sample is titled as the 404 it is', () => {
  const src = read('app/sample/layout.tsx');
  assert.doesNotMatch(src, /export const metadata\b/, '#13: a static title is applied to /sample even when it 404s');
  assert.match(src, /title: \(await sampleOpensHere\(\)\) \? 'Maria and Jose — a sample event' : 'Page not found',/, '#13: the closed sample keeps the sample\'s title');
});

test('#20 · /u and the booth hand the title template no "· Setnayan" of their own', () => {
  const u = read('app/u/[userSlug]/page.tsx');
  assert.doesNotMatch(u, /\n {4}title: `\$\{name\} · Setnayan`,\n {4}\/\/ Aggregation surface/, '#20: /u/<slug> reads "Name · Setnayan · Setnayan" again');
  assert.match(u, /title: name === 'Setnayan' \? \{ absolute: 'Setnayan' \} : name,/, '#20: the /u document title is not the name alone');
  const booth = read('app/v/[slug]/booth/page.tsx');
  assert.match(booth, /title: title\.replace\(\/ · Setnayan\$\/, ''\),/, '#20: the booth reads "Supplier booth · Setnayan · Setnayan" again');
  assert.match(booth, /openGraph: \{ title, description, type: 'website' \}/, '#20: the booth share card lost its brand');
});

test('#14 · the help article foot links press at 44 (sn-hit) without a new drawing', () => {
  const src = read('app/help/[slug]/page.tsx');
  assert.match(src, /className="sn-hit inline-flex items-center text-sm [^"]*"\s*>\s*<ChevronLeft[^>]*\/>\s*All help topics/, '#14: "All help topics" is an 18-px press again');
  assert.match(src, /className="sn-hit inline-flex items-center text-sm [^"]*"\s*>\s*Still stuck\? Contact support →/, '#14: "Still stuck? Contact support" is an 18-px press again');
});
