/**
 * the-roster-opens-on-who-is-waiting.test.ts — the four rules of the Customers
 * roster, pinned against the SOURCE, because none of them can be reached by a
 * unit test that only imports the pure core.
 *
 * 🔑 WHY A SOURCE SCAN AT ALL. `lib/vendor-customer-pipeline.test.ts` proves the
 * DERIVATION — which lane a customer lands in, and that a masked row carries no
 * name. It cannot prove the PAGE still uses it, still renders it first, or still
 * asks the flag. A pure-core test passing while the screen has stopped calling
 * it is this repo's most-repeated guard failure.
 *
 * ⚠ EVERY RULE IS DERIVED FROM THE FILE, NEVER FROM A REMEMBERED LIST. The two
 * screens are resolved by reading the roster component's own imports rather than
 * being typed out here, so a component added to the roster inherits the checks.
 *
 * ⚠ COMMENTS ARE STRIPPED BEFORE MATCHING. Every rule below is NAMED in a
 * docblock somewhere in these files; a raw-source scan would find the words that
 * describe the defect and report the fix as the defect.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, 'page.tsx');
const ROSTER = join(HERE, '_components', 'customers-roster.tsx');

/** A real comment stripper — a line-prefix filter leaves block-comment bodies. */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let mode: 'code' | 'line' | 'block' | 'str' | 'tpl' = 'code';
  let quote = '';
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (mode === 'code') {
      if (two === '//') { mode = 'line'; i += 2; continue; }
      if (two === '/*') { mode = 'block'; i += 2; continue; }
      if (src[i] === '"' || src[i] === "'") { mode = 'str'; quote = src[i]!; out += src[i]; i++; continue; }
      if (src[i] === '`') { mode = 'tpl'; out += src[i]; i++; continue; }
      out += src[i]; i++; continue;
    }
    if (mode === 'line') { if (src[i] === '\n') { mode = 'code'; out += '\n'; } i++; continue; }
    if (mode === 'block') { if (two === '*/') { mode = 'code'; i += 2; } else i++; continue; }
    if (mode === 'str') {
      if (src[i] === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (src[i] === quote) mode = 'code';
      out += src[i]; i++; continue;
    }
    // tpl
    if (src[i] === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
    if (src[i] === '`') mode = 'code';
    out += src[i]; i++; continue;
  }
  return out;
}

const pageSrc = stripComments(readFileSync(PAGE, 'utf8'));
const rosterSrc = stripComments(readFileSync(ROSTER, 'utf8'));

/** ANTI-VACUITY. A stripper that eats everything makes every rule below pass. */
test('the sources are non-empty after stripping — this guard can actually fail', () => {
  assert.ok(pageSrc.length > 5_000, `page stripped to ${pageSrc.length} chars`);
  assert.ok(rosterSrc.length > 2_000, `roster stripped to ${rosterSrc.length} chars`);
  assert.ok(pageSrc.includes('CustomersPipeline'), 'the page body did not survive stripping');
});

// ── 1 · THE LANES COME FROM THE SHARED DERIVATION ─────────────────────────

test('the page derives lanes with customerLaneOf — it does not re-decide them', () => {
  assert.ok(
    /\bcustomerLaneOf\s*\(/.test(pageSrc),
    'the roster stopped calling customerLaneOf — a second derivation of "who is booked" has been written',
  );
  assert.ok(/\bgroupByLane\s*\(/.test(pageSrc), 'groupByLane is no longer used');
});

test('the page still passes the pool-reservation floor', () => {
  // 🔴 THE ANTI-REGRESSION, AND IT WAS UNGUARDED UNTIL A MUTATION SAID SO.
  // Deleting this one line from the page left the whole suite GREEN while a
  // customer with a live hold and no `event_vendors` row silently left the
  // roster — exactly the disappearance the floor exists to prevent, and
  // invisible because the pure core's own tests cannot see the call site.
  assert.ok(
    /\bpoolBooked\s*:/.test(pageSrc),
    'the page stopped passing poolBooked — a held date with no event_vendors row now vanishes from the roster',
  );
  assert.ok(
    /poolBooked:\s*bookedByEvent\.has\(/.test(pageSrc),
    'poolBooked is no longer derived from the live pool reservations',
  );
});

test('the page ASKS the handshake flag rather than assuming an answer', () => {
  // With the flag off, `lockRequestStateOf` can only answer locked/none, so the
  // "waiting on your yes" kind must be unreachable BY THE SAME ANSWER the
  // couple's screens get. A hardcoded boolean here is the §5.3 scenario.
  assert.ok(
    /isLockHandshakeEnabled\s*\(\s*\)/.test(pageSrc),
    'the customers page no longer consults isLockHandshakeEnabled',
  );
  assert.ok(
    !/const\s+handshakeEnabled\s*=\s*(true|false)\b/.test(pageSrc),
    'the handshake flag was hardcoded to a literal',
  );
});

// ── 2 · IT OPENS ON WHO IS WAITING ────────────────────────────────────────

test('the roster is rendered BEFORE the month calendar', () => {
  const roster = pageSrc.indexOf('<CustomersRoster');
  const calendar = pageSrc.indexOf('<CustomersCalendar');
  assert.ok(roster > 0, 'the roster is not rendered at all');
  assert.ok(calendar > 0, 'the calendar stopped rendering — nothing was meant to be removed');
  assert.ok(
    roster < calendar,
    'the calendar is back above the roster; "Customers opens on who is waiting" is the whole brief',
  );
});

test("'waiting' is the first lane in the shared order", async () => {
  const { CUSTOMER_LANES } = await import('@/lib/vendor-customer-pipeline');
  assert.equal(
    CUSTOMER_LANES[0],
    'waiting',
    'the lane order changed — the roster renders lanes in this order, so this IS the page order',
  );
});

// ── 3 · A WAITING ROW CARRIES NO IDENTITY ─────────────────────────────────

test('the roster never reaches for a name except behind identityRevealed', () => {
  // The derivation already nulls the name; this catches the OTHER direction —
  // a renderer that goes back to the raw event for a label.
  assert.ok(
    !/\beventName\b/.test(rosterSrc),
    'the roster component reads an event name directly, going around the mask',
  );
  assert.ok(
    /identityRevealed\s*\?/.test(rosterSrc),
    'the initials no longer branch on identityRevealed — every masked row would print initials of the placeholder',
  );
});

test('the page builds the placeholder from the SHIPPED mask, not a local one', () => {
  // ⚠ `\b` IS LOAD-BEARING. Without it this rule was DECORATION, measured:
  // renaming the call to `DISABLED_fetchInquiryMaskMeta(` left the original as a
  // SUBSTRING and the guard stayed green while the mask was gone. Same prefix
  // trap as `f.event_dateX`, and the reason every sabotage here is counted
  // rather than assumed to have landed.
  assert.ok(
    /\bfetchInquiryMaskMeta\s*\(/.test(pageSrc),
    'the roster stopped using fetchInquiryMaskMeta — a second anonymisation path has been written',
  );
  assert.ok(
    /\binquiryPlaceholderLabel\s*\(\s*\{/.test(pageSrc),
    'the placeholder call lost its explicit fields — inquiry-mask-every-host cannot see a spread',
  );
});

// ── 3b · THE HOLDING EXPOSURE ─────────────────────────────────────────────

test('the date-clash count is computed over EVERY customer, not the filtered list', () => {
  // 🔴 THE ONE WAY THIS FEATURE GOES QUIETLY WRONG. `rosterRows` is already
  // narrowed by the `?lane=` chip; counting clashes from it would make the
  // warning vanish the moment a shop pressed "Booked" — a warning that
  // disappears when you look away is worse than no warning.
  assert.ok(
    /holdingByDate\(derived\)/.test(pageSrc),
    'holdingByDate is no longer computed over the full derived set',
  );
  assert.ok(
    !/holdingByDate\(rosterRows\)/.test(pageSrc),
    'the clash count is computed from the FILTERED rows — it would vanish under a chip',
  );
});

test('the roster is handed the clash map and one shared "now"', () => {
  assert.ok(/holdingPerDate=\{holdingPerDate\}/.test(pageSrc), 'the clash map is not passed');
  // One clock for the derivation AND the render, so a customer cannot sit one
  // side of the quiet boundary in the lane count and the other on the row.
  assert.ok(/nowMs=\{rosterNowMs\}/.test(pageSrc), 'the render uses a second clock');
  assert.ok(
    !/customerLaneOf\([\s\S]{0,400}?Date\.now\(\)/.test(pageSrc),
    'the derivation reads the clock itself instead of the shared instant',
  );
});

test('the quiet signal is the thread’s LAST activity, not its first reply', () => {
  // `vendor_first_reply_at` is the FIRST reply, so a thread alive for weeks
  // would read as quiet for weeks. Measured and rejected before the build.
  assert.ok(
    /lastActivityAt:\s*t\.updated_at/.test(pageSrc),
    'the holding lane is no longer fed by the thread’s last activity',
  );
  assert.ok(
    !/lastActivityAt:\s*t\.vendor_first_reply_at/.test(pageSrc),
    'the quiet signal was switched to the FIRST reply — a live thread would read as cold',
  );
});

// ── 4 · WHAT MUST NOT COME BACK ───────────────────────────────────────────

test('no waitlist lane, and no unreachable status pill map', () => {
  // Three of the old STATUS_PILL's five entries could never be produced. A
  // waitlist chip is worse than unreachable: picking somebody off the waitlist
  // does nothing today and still reports success.
  assert.ok(
    !/const\s+STATUS_PILL\s*[:=]/.test(pageSrc),
    'STATUS_PILL is back — its locked/whitelist/waitlist entries were unreachable by construction',
  );
  assert.ok(
    !/'waitlist'/.test(rosterSrc),
    'a waitlist lane appeared on the roster; its only action is a no-op that reports success',
  );
});

test('the money note stays off a masked row', () => {
  // A balance beside "A couple planning a wedding in Metro Manila" narrows an
  // anonymous row to a person by the figure attached to it.
  assert.ok(
    /r\.lane\s*===\s*'waiting'\s*\)\s*return null/.test(pageSrc.replace(/\s+/g, ' ')) ||
      /if\s*\(\s*r\.lane\s*===\s*'waiting'\s*\)\s*return\s+null/.test(pageSrc),
    'moneyNote no longer returns null for a waiting row',
  );
});

test('"Book of business" is still reachable from this page', () => {
  // It lived in the header of the block this redesign replaced. A redesign is
  // exactly when a control goes missing.
  assert.ok(
    /\?open=clients/.test(pageSrc),
    'the Book of business link was lost in the redesign',
  );
});
