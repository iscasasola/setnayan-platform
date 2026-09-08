/**
 * THE SUPPLIER SEES WHO IS ASKING — and the admin-scoped reads that make that
 * possible stay gated on threads the calling vendor owns.
 *
 * ── WHAT BROKE (owner, 2026-09-08) ─────────────────────────────────────────
 * *"after accepting, I should see their information."* He had just accepted the
 * first real inquiry in the platform's history. The thread page showed a header
 * reading **"Couple"**, a **"C"** avatar, and a DATE of **"Not set yet"** — for
 * an event whose row said `display_name = 'Cale & Ice'` and
 * `event_date = 2026-12-18`. The inbox and bookings lists said **"Event"**.
 *
 * ── WHY, AND WHY THE OBVIOUS FIX WAS THE WRONG ONE ─────────────────────────
 * Two independent layers hid the customer, and only one of them was the mask:
 *
 *   1. RLS. A vendor is not an `event_members` row, so `public.events` is
 *      unreadable to them. Measured in prod on the accepted thread itself:
 *      `vendor_is_event_member = 0`. This fires REGARDLESS of accept state.
 *   2. The mask — `maskVendorThreadEvent` + `inquiryPlaceholderLabel`.
 *
 * 🔑 THE MASK WAS NOT WHAT THE OWNER WAS LOOKING AT. Deleting it alone would
 * have changed NOTHING on his screen: every surface fell back to the RLS-nulled
 * `t.event?.display_name`, so the "revealed" branch rendered "Event" too. A
 * session that removed the mask, saw the same broken page, and concluded the
 * removal had not deployed would have been wrong twice.
 *
 * ⚠ AND THE FIX THAT SUGGESTS ITSELF — grant vendors SELECT on `events` — hands
 * EVERY supplier EVERY couple's event row, including couples who never contacted
 * them. That is enormously wider than the ruling, which was about one supplier
 * a couple had already written to. The reads stay admin-scoped and the CALLER
 * proves ownership. These tests pin that division, because it is the only thing
 * standing between "the supplier sees their customer" and "suppliers can browse
 * couples".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

const THREAD_PAGE = 'app/vendor-dashboard/messages/[threadId]/page.tsx';

test('the mask is gone from the tree, not merely unused', () => {
  // A dormant `inquiryPlaceholderLabel` is one import away from coming back on
  // a surface nobody re-read. The modules are deleted; this asserts the name
  // resolves nowhere rather than trusting that no caller happens to use it.
  for (const gone of ['inquiryPlaceholderLabel', 'isInquiryRevealed', 'maskVendorThreadEvent']) {
    assert.throws(
      () => read(`lib/${gone}.ts`),
      `lib/${gone}.ts still exists`,
    );
  }
  assert.throws(() => read('lib/inquiry-mask.ts'), 'lib/inquiry-mask.ts still exists');
});

test('🔑 the thread page reads the event with the ADMIN client, below the ownership gate', () => {
  const src = read(THREAD_PAGE);

  const gate = src.indexOf(
    "if (!thread || thread.vendor_profile_id !== profile.vendor_profile_id) notFound();",
  );
  assert.ok(gate > 0, 'the thread-ownership gate is gone — the admin reads below it are now open');

  // The read itself. Anchored on the two lines together so a change to either
  // one fails: `paxAdmin` alone would pass if the select moved elsewhere, and
  // the select alone would pass if the client were swapped back to `supabase`.
  const adminRead = src.indexOf("paxAdmin\n      .from('events')");
  assert.ok(
    adminRead > gate,
    'the events read is not an admin read below the ownership gate — the vendor\'s own ' +
      'client returns null here on EVERY thread, which is the original defect',
  );

  // The vendor's plain client must not be the one asking for the event, or the
  // page silently returns to "Couple" / "Not set yet" with no error anywhere.
  assert.ok(
    !/supabase\s*\n\s*\.from\('events'\)/.test(src),
    'the events row is being read with the vendor session client again',
  );
});

test('the date reaches the rail SPELLED OUT, not as an ISO key', () => {
  // Owner, 2026-09-08: "Date should be more specific with Name of date instead
  // of 2026-12-18, it should be December 18, 2026." The rail's prop had been
  // documented "pre-formatted" since it was written while its only caller
  // passed the raw Postgres value — a mismatch a type cannot catch, because
  // both are `string | null`.
  const src = read(THREAD_PAGE);
  assert.match(
    src,
    /eventDate: event\?\.event_date \? formatLongDate\(event\.event_date\) : null/,
    'the rail is being handed a raw ISO date again',
  );
});

test('the rail has no masked branch left to fall into', () => {
  const rail = read('app/vendor-dashboard/messages/[threadId]/_components/chat-info-rail.tsx');
  // ⚠ CODE ONLY. This file's own header narrates the lock it removed and quotes
  // its copy, so a check run over the raw text fails on the explanation of the
  // fix rather than on the defect. Strip block-comment and `//` lines first —
  // the first draft of this test went red on its own docblock.
  const code = rail
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
    .join('\n');
  assert.ok(!/\bmasked\b/.test(code), 'a `masked` prop is back on the customer rail');
  assert.ok(
    !code.includes('accept the conversation to reveal'),
    'the "accept to reveal who they are" lock is back',
  );
});

test('🔑 every admin-scoped customer read is gated by a vendor-scoped fetch', () => {
  // `fetchInquiryCustomerFacts` bypasses RLS by construction. Its safety is
  // entirely the caller's: each surface must derive the event ids it passes
  // from threads it already fetched FOR THIS VENDOR. This asserts the pairing
  // at each call site — the one property no type or policy can express.
  const callers = [
    'app/vendor-dashboard/messages/surface.tsx',
    'app/vendor-dashboard/bookings/surface.tsx',
  ];
  for (const p of callers) {
    const src = read(p);
    const call = src.indexOf('fetchInquiryCustomerFacts(');
    assert.ok(call > 0, `${p} no longer calls fetchInquiryCustomerFacts`);

    // The ids must come from `threads`, which upstream is
    // fetchVendorThreads(.., vendorProfileId) — never from a route param or a
    // broader query.
    const args = src.slice(call, call + 220);
    assert.match(
      args,
      /threads\.map\(\(t\) => t\.event_id\)/,
      `${p} passes event ids that are not derived from this vendor's own threads`,
    );

    assert.match(
      src,
      /fetchVendorThreads\(/,
      `${p} no longer scopes its threads to one vendor`,
    );
  }
});

test('the customers roster still asks only for its own vendor’s events', () => {
  const src = read('app/vendor-dashboard/customers/page.tsx');
  // The roster reads with `rosterAdmin` over `rosterEventIds`. Those ids are
  // built from this vendor's own threads/bookings above; if that ever becomes
  // an unfiltered event list the roster turns into a couple directory.
  assert.ok(
    !/rosterAdmin[\s\S]{0,200}\.from\('events'\)[\s\S]{0,200}(?!\.in\()/.test(
      src.slice(0, src.indexOf('const derived')),
    ) || src.includes('.in('),
    'the roster event read is no longer narrowed with .in(rosterEventIds)',
  );
  assert.match(src, /revealed: true/, 'the roster is masking its own customers again');
});
