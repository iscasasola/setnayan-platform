/**
 * the-journey-words-say-what-happens.test.ts — four words a host or a new supplier reads that described something
 * other than what happens (owner 2026-10-22, "yes to all" on `prototypes/journey_fixes_later_2026-10-22.html`:
 * Sign-up copy A · Supplier 4a A · Supplier 4b · the "Para kanino?" leftover).
 *
 * ── THE DEFECTS ─────────────────────────────────────────────────────────────
 *   1. The sign-up card said "User account" — our word for "not a shop account" (`users.account_type`). The person
 *      never sees the other kind, and the same card serves `?as=vendor`. Its email example was an address on OUR
 *      domain, which only we could own; the sign-in card already used a neutral one, so the two doors disagreed.
 *   2. Supplier Settings › Email promised mail "when a couple writes … and when a fee is due". A couple's first
 *      message is app + phone only, and no supplier "fee is due" notification exists at all. It also truncated.
 *   3. The welcome email sent a new shop to Shop; the app lands them on Today, where the next step is.
 *   4. The create-event picker still labelled a gated life type's sub-field in Tagalog beside an English sibling.
 *
 * ── THE PROPERTIES (none of them is a phrase) ───────────────────────────────
 *   1. Every door that takes an email to make or recover an account shows ONE example, and it is not on a domain
 *      we own. The sign-up card names no account tier.
 *   2. Every " · " part of the Email line (Shop ⚙ › Notifications) maps to notification types that ARE on the email allowlist
 *      (`EMAIL_ENABLED_TYPES`, read from source) — a part that maps to nothing fails, so a new promise must say
 *      which email it means. The line fits a 375 px row (it renders in a `truncate` span).
 *   3. The welcome email's "What's next" link is the route `becomeVendor` actually lands a new shop on.
 *   4. No label the picker draws asks in Tagalog (the 2026-10-07 English ruling for interface words).
 *
 * Comments stripped before matching (`lib/strip-comments.ts`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

// ── 1 · the account doors ─────────────────────────────────────────────────
const DOORS = ['app/signup/page.tsx', 'app/login/_components/sign-in-card.tsx', 'app/forgot-password/page.tsx'];

/** The `placeholder` of every `type="email"` input in a file (attribute order free inside one tag). */
function emailExamples(src: string): string[] {
  const out: string[] = [];
  for (const tag of src.match(/<input\b[^>]*>/g) ?? []) {
    if (!/type="email"/.test(tag)) continue;
    const ph = tag.match(/placeholder="([^"]*)"/);
    if (ph) out.push(ph[1]!);
  }
  return out;
}

test('every account door shows one email example, and it is not an address we own', () => {
  const examples = DOORS.flatMap((d) => emailExamples(read(d)).map((e) => ({ door: d, e })));
  assert.ok(examples.length >= DOORS.length, `expected an email example on each of ${DOORS.length} doors, found ${examples.length}`);
  const distinct = [...new Set(examples.map((x) => x.e))];
  assert.equal(distinct.length, 1, `the doors disagree on the example: ${JSON.stringify(examples)}`);
  assert.doesNotMatch(distinct[0]!, /@[^@]*setnayan/i, `the example "${distinct[0]}" is on our own domain`);
});

test('the sign-up card names no account tier (it serves a host and a shop owner alike)', () => {
  const signup = read('app/signup/page.tsx');
  const tier = signup.match(/\b(user|customer|host|vendor|supplier|shop|admin)\s+account\b/i);
  assert.equal(tier, null, `the sign-up card says "${tier?.[0]}" — a tier the person never chose`);
});

// ── 2 · the Email line (Shop ⚙ › Notifications) ───────────────────────────────────────────
/** What each part of the line promises, as the notification types that carry it. A new part must be added here. */
const PART_TYPES: Record<string, readonly string[]> = {
  Bookings: ['lock_request_received', 'lock_request_nudge', 'lock_request_expired', 'booking_confirmed'],
  payments: ['payment_confirmed', 'payment_cleared', 'payment_matched'],
  'messages after your yes': ['chat_message'],
};

function emailAllowlist(): Set<string> {
  const src = read('lib/notification-emit.ts');
  const m = src.match(/const EMAIL_ENABLED_TYPES\b[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/);
  assert.ok(m, 'EMAIL_ENABLED_TYPES not found in lib/notification-emit.ts');
  return new Set([...m[1]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]!));
}

/**
 * The Email line MOVED with the push switch from the account menu's Settings › Notifications into the Shop ⚙ ›
 * Notifications (owner 2026-10-31, "Yes follow your recommendation" — DECISION_LOG "SHOP ⚙ — WHAT A SUPPLIER SETS
 * ONCE"); the same words, held where they now draw — inside that fold.
 */
function settingsEmailLine(): string {
  const src = read('app/vendor-dashboard/shop/_components/shop-settings-rows.tsx');
  const at = src.indexOf('<Fold anchor="notifications"');
  assert.ok(at >= 0, 'the Shop ⚙ has no Notifications fold');
  const fold = src.slice(at, src.indexOf('</Fold>', at));
  const m = fold.match(/<DatesRow\b[^>]*data="shop-gear-email"[^>]*line="([^"]*)"/);
  assert.ok(m, 'the Shop ⚙ › Notifications Email row (data="shop-gear-email") with a literal line was not found');
  return m[1]!;
}

test('every part of the Shop ⚙ › Notifications Email line is a notification we really email', () => {
  const allow = emailAllowlist();
  assert.ok(allow.size > 10, `parsed only ${allow.size} allowlisted types — the parser is broken`);
  const parts = settingsEmailLine().split(' · ').map((p) => p.trim());
  assert.ok(parts.length > 0);
  for (const part of parts) {
    const types = PART_TYPES[part];
    assert.ok(types, `"${part}" promises an email but names no notification type — add it to PART_TYPES with the types it means`);
    for (const t of types) assert.ok(allow.has(t), `"${part}" promises an email for ${t}, which is not on EMAIL_ENABLED_TYPES`);
  }
});

test('the Shop ⚙ › Notifications Email line fits one 375 px row (it renders in a truncate span)', () => {
  const line = settingsEmailLine();
  // 375 − 2×16 gutter = 343 px of 13 px text ≈ 52 characters; 48 leaves room for a wide glyph run.
  assert.ok(line.length <= 48, `the line is ${line.length} characters and ends in "…" on a phone: "${line}"`);
});

// ── 3 · the welcome email's link ──────────────────────────────────────────
test("the welcome email's next-step link is where a new shop lands", () => {
  const actions = read('app/open-shop/actions.ts');
  const body = actions.slice(actions.indexOf('export async function becomeVendor'));
  const landings = [...body.matchAll(/redirect\('(\/vendor-dashboard[^'?]*)'\)/g)].map((m) => m[1]!);
  assert.ok(landings.length >= 1, 'becomeVendor no longer redirects into the supplier dashboard — re-point this guard');
  const landing = landings[landings.length - 1]!;

  const email = read('lib/open-shop-account.server.ts');
  const next = email.slice(email.indexOf("What's next"));
  const link = next.match(/\$\{appUrl\}(\/[^\s`'"]*)/);
  assert.ok(link, "no ${appUrl} link after \"What's next\" in the welcome email");
  assert.equal(link[1], landing, `the welcome email opens ${link[1]}; a new shop lands on ${landing}`);
});

// ── 4 · the picker asks in English ────────────────────────────────────────
test('no label the create-event picker draws asks in Tagalog', () => {
  const picker = read('app/dashboard/(account)/create-event/_components/event-type-picker.tsx');
  // Every string literal and every run of JSX text.
  const words = [
    ...[...picker.matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)].map((m) => m[1] ?? m[2] ?? ''),
    ...[...picker.matchAll(/>([^<>{}\n]+)</g)].map((m) => m[1]!),
  ];
  const TAGALOG_ASK = /\b(kanino|sino|alin|ilan|ito)\b/i;
  const hits = words.filter((w) => TAGALOG_ASK.test(w));
  assert.deepEqual(hits, [], `Tagalog interface words in the picker: ${JSON.stringify(hits)}`);
});
