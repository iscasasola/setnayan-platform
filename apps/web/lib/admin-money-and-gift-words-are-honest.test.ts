/**
 * admin-money-and-gift-words-are-honest.test.ts — the admin money desk and the guest's gift
 * door may not state what they did not measure (2026-09-30).
 *
 * ── The disease (same one as vendor-dashboard/reads-are-honest.test.ts) ─────
 * Supabase RESOLVES with `{ error }` instead of throwing, so a refused read
 * arrives as `data: null`, `?? []` makes it an empty list, and the screen says
 * "you have none":
 *
 *   /admin/payments ......... "Nothing to reconcile." — with money waiting
 *   /admin/payments?q= ...... a refused order lookup fell back to a bank-ref
 *                             search and answered "no match" for a real order
 *   /admin/subscriptions .... "0 pending" — with vendors waiting to activate
 *   payment-methods / settings / compliance forms — FALLBACK blanks seeded the
 *                             inputs, and one Save wrote them over the REAL
 *                             BDO / GCash / business / DPO details
 *
 * And two guest-facing words that assumed a wedding on every event type:
 *
 *   "Bride's side / Groom's side / Both sides" — on a debut guest's page
 *   "The digital money dance" — on a graduation's gift card
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL: each check below pins the RENDER, not
 * just the binding. 🛡 Sabotage-checked: each fix was reverted in turn and the
 * matching test confirmed RED before being trusted.
 */
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { fetchPlatformSettingsMeasured, fetchPlatformSettings } from '@/lib/platform-settings';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';
import { GENERIC_PROFILE, WAKE_PROFILE, WEDDING_PROFILE } from '@/lib/event-type-profile';
import { eventWordsFromProfile, giftIsMoneyDance } from '@/app/[slug]/_lib/event-words';

const WEB = join(import.meta.dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Chainable query-builder stub terminating in `.maybeSingle()`. */
function chainStub(result: { data: unknown; error: unknown }) {
  const self: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return undefined;
        if (prop === 'maybeSingle' || prop === 'single') return async () => result;
        return () => self;
      },
    },
  );
  return { from: () => self } as never;
}

// ── 1 · /admin/payments ─────────────────────────────────────────────────────

test('/admin/payments: every queue read binds its error and a refusal never renders as an empty queue', () => {
  const s = src('app/admin/payments/page.tsx');
  // The three reads the desk states an absence from.
  assert.match(s, /const \{ data, error: quoteError \} = await admin\s*\.from\('orders'\)/, 'orders-needing-a-quote read is unbound');
  assert.match(s, /const \{ data: hits, error: searchError \} = await admin\s*\.from\('orders'\)/, 'the order search read is unbound');
  assert.match(s, /const \{ data, error: queueError \} = await paymentsQuery/, 'the payment queue read is unbound');
  // A refused search must not fall through to the bank-reference fallback.
  assert.match(s, /if \(searchError\) \{[\s\S]{0,160}?readFailed = 'search';/);
  assert.match(s, /if \(readFailed !== 'search'\) \{\s*const \{ data, error: queueError \}/);
  // THE RENDER: both empty states sit behind the notice. Counted, so a third
  // list that forgets it — or one of these losing it — is visible.
  const gates = [...s.matchAll(/if \(readFailed\) return <ReadFailedNotice which=\{readFailed\} \/>;/g)];
  assert.equal(gates.length, 2, 'both lists must render ReadFailedNotice before their empty state');
  const nothing = s.indexOf("'Nothing to reconcile.'");
  const gate = s.lastIndexOf('if (readFailed) return <ReadFailedNotice', nothing);
  assert.ok(nothing > 0 && gate > 0 && nothing - gate < 400, '"Nothing to reconcile." must sit after the read-failed gate');
  // A search with no match says so, naming the term.
  assert.ok(s.includes('`No payment matches “${query}”.`'), 'a no-match search must say "No payment matches <q>"');
});

// ── 2 · /admin/subscriptions ────────────────────────────────────────────────

test('/admin/subscriptions: a refused read says so instead of "0 pending"', () => {
  const s = src('app/admin/subscriptions/page.tsx');
  assert.match(s, /const pendingFailed = Boolean\(pendingRes\.error\);/);
  assert.match(s, /const recentFailed = Boolean\(recentRes\.error\);/);
  assert.match(s, /\{pendingFailed \? 'Pending unknown' : `\$\{pending\.length\} pending`\}/, 'the masthead count must not say "0 pending" on a refusal');
  assert.match(s, /\{pendingFailed \? \([\s\S]{0,400}?Couldn&rsquo;t load this[\s\S]{0,200}?\) : pending\.length === 0 \?/);
  assert.match(s, /\{recentFailed \? \([\s\S]{0,300}?Couldn&rsquo;t load this[\s\S]{0,100}?\) : recent\.length === 0 \?/);
});

// ── 3 · settings forms: a refused read may not arm Save ─────────────────────

test('fetchPlatformSettingsMeasured reports a REFUSED read as readFailed, still with FALLBACK', async () => {
  const restore = mock.method(console, 'error', () => {});
  try {
    const refused = await fetchPlatformSettingsMeasured(
      chainStub({ data: null, error: { code: '42703', message: 'column does not exist' } }),
    );
    assert.equal(refused.readFailed, true);
    assert.equal(refused.settings.bdo_account_number, null, 'FALLBACK is unchanged');
    // A MISSING row is not a failure — there is nothing real to overwrite.
    const missing = await fetchPlatformSettingsMeasured(chainStub({ data: null, error: null }));
    assert.equal(missing.readFailed, false);
    // The old entry point keeps its behaviour for every other caller.
    const legacy = await fetchPlatformSettings(
      chainStub({ data: null, error: { code: '42501', message: 'denied' } }),
    );
    assert.equal(legacy.business_name, 'Setnayan');
  } finally {
    restore.mock.restore();
  }
});

test('the three admin forms seeded from settings cannot Save over the real values after a refused read', () => {
  const pm = src('app/admin/settings/payment-methods/page.tsx');
  assert.match(pm, /await fetchPlatformSettingsMeasured\(admin\)/, 'payment-methods must read the measured settings');
  assert.doesNotMatch(pm, /\bfetchPlatformSettings\(/, 'payment-methods went back to the unmeasured read');
  assert.match(pm, /Save payment details/);
  assert.match(pm, /pendingLabel="Saving…"\s*disabled=\{settingsReadFailed\}\s*>\s*Save payment details/, 'Save payment details must be disabled when the read failed');

  const ss = src('app/admin/settings/_surfaces/settings-surface.tsx');
  assert.match(ss, /await fetchPlatformSettingsMeasured\(admin\)/);
  assert.doesNotMatch(ss, /\bfetchPlatformSettings\(/, 'settings surface went back to the unmeasured read');
  // Business identity AND the digest toggle are both seeded from settings.
  const disabled = [...ss.matchAll(/disabled=\{settingsReadFailed\}/g)];
  assert.equal(disabled.length, 2, 'both settings-seeded Save buttons must be disabled on a refused read');

  const cs = src('app/admin/settings/_surfaces/compliance-surface.tsx');
  assert.match(cs, /const factsReadFailed = Boolean\(factsRes\.error\);/);
  assert.match(cs, /\{factsReadFailed \? \([\s\S]{0,500}?\) : \(\s*<ComplianceForm initial=\{initial\} \/>\s*\)\}/, 'the compliance form must not render on a refused facts read');
});

// ── 4 · no "side" on an event type without sides ────────────────────────────

test('side_labels: a wedding has sides, a generic event and a wake do not', () => {
  assert.equal(resolveWeddingOnlyParts(WEDDING_PROFILE).side_labels, true);
  assert.equal(resolveWeddingOnlyParts(GENERIC_PROFILE).side_labels, false);
  assert.equal(resolveWeddingOnlyParts(WAKE_PROFILE).side_labels, false);
});

test('the guest page renders a side only when the event type has sides', () => {
  const body = src('app/[slug]/_components/site-body.tsx');
  assert.match(body, /const sideLabel: string \| null = !weddingOnly\.side_labels\s*\? null/, 'sideLabel must be null unless side_labels');
  // The "You're joining us as … · <side>." sentence.
  assert.match(body, /\{sideLabel \? \(\s*<>\s*\{' '\}·\{' '\}\s*<span className="text-ink\/80">\{sideLabel\}<\/span>/);
  assert.doesNotMatch(body, /·\{' '\}\s*\n\s*<span className="text-ink\/80">\{sideLabel\}<\/span>\.\s*\n/, 'the side is printed unconditionally again');

  const widget = src('app/[slug]/_components/hideable-widget-render.tsx');
  assert.match(widget, /sideLabel: string \| null;/);
  assert.match(widget, /\{sideLabel \? <Detail label="Side" value=\{sideLabel\} \/> : null\}/);
  assert.equal([...widget.matchAll(/<Detail label="Side"/g)].length, 1);
  assert.match(widget, /sideLabel \? `Side: \$\{sideLabel\}` : null/);
});

// ── 5 · the money dance is a wedding's ──────────────────────────────────────

test('giftIsMoneyDance: only a wedding; never a generic event, never the wake', () => {
  assert.equal(giftIsMoneyDance(eventWordsFromProfile(WEDDING_PROFILE)), true);
  assert.equal(giftIsMoneyDance(eventWordsFromProfile(GENERIC_PROFILE)), false);
  assert.equal(giftIsMoneyDance(eventWordsFromProfile(WAKE_PROFILE)), false);
});

test('every gift surface asks giftIsMoneyDance, and the other arm names E-Gifts', () => {
  // ONE decision (s13-is-finished.test.ts: no guest file compares against a
  // wedding word itself) and ONE product name (the-guest-text-is-honest §9).
  const sites: Array<[string, RegExp]> = [
    [
      'app/[slug]/_components/guest-doorway-strip.tsx',
      /words\.solemn\s*\?\s*`A gift of sympathy[^`]*`\s*:\s*giftIsMoneyDance\(words\)\s*\?\s*`The digital money dance[^`]*`\s*:\s*`Send E-Gifts straight to \$\{words\.theOrganizer\}\.`/,
    ],
    [
      'app/[slug]/hub/page.tsx',
      /words\.solemn\s*\?\s*<>A gift of sympathy[^<]*<\/>\s*:\s*giftIsMoneyDance\(words\)\s*\?\s*<>The digital money dance[^<]*<\/>\s*:\s*<>Send E-Gifts straight to \{words\.theOrganizer\}\.<\/>/,
    ],
    [
      'app/[slug]/pabuya/page.tsx',
      /words\.solemn\s*\?\s*'A gift of sympathy'\s*:\s*giftIsMoneyDance\(words\)\s*\?\s*'The pabuya · digital money dance'\s*:\s*'The pabuya · E-Gifts'/,
    ],
  ];
  for (const [rel, shape] of sites) {
    const s = src(rel);
    assert.match(s, shape, `${rel}: the money-dance line must be wedding-only`);
    assert.doesNotMatch(s, /eventWord === 'wedding'/, `${rel}: decide through giftIsMoneyDance, not a raw comparison`);
  }
  // "Pin your cash" is the dance's own gesture — wedding arm only, exactly once.
  const pab = src('app/[slug]/pabuya/page.tsx');
  assert.match(pab, /\) : giftIsMoneyDance\(words\) \? \(\s*<>\s*Pin your cash on/, 'pabuya: "Pin your cash" must be wedding-only');
  assert.equal([...pab.matchAll(/Pin your cash/g)].length, 1);
});
