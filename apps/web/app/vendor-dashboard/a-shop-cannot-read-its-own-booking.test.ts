/**
 * a-shop-cannot-read-its-own-booking.test.ts — `event_vendors` HAS NO VENDOR
 * SELECT POLICY, and every read of it on a shop's own session is a silent zero.
 *
 * ── THE MEASUREMENT, so nobody has to take this on trust ────────────────────
 * Read out of PRODUCTION on 2026-08-28, as the shop's own `authenticated` role,
 * inside a rolled-back transaction. `event_vendors` carries exactly four
 * policies — `couple_read`, `couple_write`, `moderator_read`, `moderator_write`
 * — and NOT ONE of them admits a vendor. The shop that is genuinely booked on
 * the single marketplace booking in production read **0 rows** of it, while
 * `current_vendor_booked_event_ids()` correctly returned 1.
 *
 * This is deliberate: opening a vendor SELECT policy on that table would hand
 * suppliers the couple's whole booking row, budget figures included. The
 * sanctioned way for a shop to resolve its own booking is the ADMIN client
 * SCOPED BY THE CALLER'S OWN `vendor_profile_id`, resolved from their session
 * — the shape `fetchLockAgreementRequests` already uses on the Answers Desk.
 *
 * ── WHY IT NEEDS A GUARD AND NOT JUST A FIX ────────────────────────────────
 * `maybeSingle()` on an RLS refusal returns `{ data: null }` and `count` comes
 * back `0` — byte-identical to "this shop is not booked here" and to "nobody
 * has picked this service". Nothing throws, nothing logs, and every one of
 * these shipped under a comment asserting the opposite. FOUR were live when
 * this file was written, each found by symptom rather than by search:
 *
 *   · `vendorPostHandover`      — a supplier could never deliver a gallery
 *                                 link, proof or sign-off. FIXED.
 *   · `vendorRaiseChangeOrder`  — a supplier could never propose an add-on. FIXED.
 *   · `deleteVendorService`     — 🔴 the WORST: the count that decides "retire,
 *                                 don't delete" always answered 0, so deleting a
 *                                 service hard-deleted it and SET NULL'd
 *                                 `event_vendors.service_id` on any booking
 *                                 pointing at it. FIXED. (Inert in production —
 *                                 zero of 45 bookings carry a service_id — which
 *                                 is why it was safe to fix rather than urgent.)
 *   · `script-actions.ts`       — the host/MC cue composer: every save answered
 *                                 "You are not booked on this event". FIXED
 *                                 2026-08-29, once its downstream was measured
 *                                 rather than assumed (see below).
 *   · `manpower/surface.tsx`    — the open-gig list: a booked shop was told
 *                                 "hosts are not offering any". FIXED
 *                                 2026-08-29, together with the FOUR other
 *                                 walls behind it (see that PR).
 *
 * 🔑 THE LIST IS DERIVED FROM THE TREE, NEVER TYPED OUT. A hand-written list of
 * offenders is a list of the ones somebody thought of, and all four above were
 * found by grepping the RECEIVER of every `.from('event_vendors')` rather than
 * by remembering paths.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');

/**
 * Sites that still read `event_vendors` on a session client, each with the
 * reason it is not repaired here. A line may only be DELETED (by fixing the
 * site); adding one is a decision a reviewer sees.
 */
const EXEMPT: Record<string, string> = {
  'app/vendor-dashboard/contracts/actions.ts':
    'NOT A DEFECT. The direct query is a documented FALLBACK after ' +
    '`resolve_event_vendor_for_contract`, which is SECURITY DEFINER and VERIFIED ' +
    'PRESENT IN PRODUCTION (pg_proc, 2026-08-28) — so the fallback is not reached, ' +
    'and when it is (a pre-migration environment) it degrades to a null link ' +
    'rather than to a wrong answer.',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Strip comments so a docblock NAMING the defect is not read as the defect. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\n]*?\/\/[^\n]*$/gm, (m) =>
    // keep code that precedes a trailing comment
    m.slice(0, m.indexOf('//')),
  );
}

const FILES = walk(join(WEB, 'app', 'vendor-dashboard'));

/** ANTI-VACUITY: a walker that finds nothing passes every rule below. */
test('the scan actually sees the vendor tree', () => {
  assert.ok(FILES.length > 100, `only ${FILES.length} files walked — the tree moved`);
  const withReads = FILES.filter((f) =>
    /\.from\(\s*'event_vendors'\s*\)/.test(readFileSync(f, 'utf8')),
  );
  assert.ok(
    withReads.length >= 8,
    `only ${withReads.length} files read event_vendors — the matcher stopped matching`,
  );
});

/**
 * The window of source immediately before a `.from('event_vendors')`, which is
 * where the client that will serve it is named.
 *
 * 🔑 IT IS A WINDOW, NOT A CAPTURED IDENTIFIER, AND THAT IS THE WHOLE POINT.
 * The first cut of this guard captured `([A-Za-z_$][\w$]*)` before `.from(` —
 * which matches `admin.from(…)` and `supabase.from(…)` and NOTHING ELSE.
 * Measured by mutation: rewriting a repaired site as
 * `(await createClient()).from('event_vendors')` put the defect straight back
 * and the guard stayed GREEN, because the character before `.from` was `)` and
 * the regex simply did not fire. A guard that cannot see an offender reports a
 * clean sweep.
 */
const CLIENT_WINDOW = 80;

function clientWindowsFor(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/\.from\(\s*'event_vendors'\s*\)/g)) {
    out.push(src.slice(Math.max(0, m.index! - CLIENT_WINDOW), m.index!).replace(/\s+/g, ' ').trim());
  }
  return out;
}

test('no NEW session-client read of event_vendors in the shop tree', () => {
  const offenders: string[] = [];
  for (const file of FILES) {
    const src = stripComments(readFileSync(file, 'utf8'));
    const rel = relative(WEB, file);
    for (const win of clientWindowsFor(src)) {
      // The sanctioned reader is an admin client — however it is named locally,
      // and however it is constructed — scoped by the caller's own
      // vendor_profile_id, which the very next lines assert.
      if (/admin/i.test(win)) continue;
      if (rel in EXEMPT) continue;
      offenders.push(`${rel}  (…${win.slice(-48)})`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'These read event_vendors on a session client. `event_vendors` has NO vendor ' +
      'SELECT policy in production, so each returns ZERO ROWS and NOTHING THROWS. ' +
      'Resolve the booking with the admin client scoped by the caller’s own ' +
      'vendor_profile_id, or add a reasoned line to EXEMPT:\n  ' +
      offenders.join('\n  '),
  );
});

test('every exemption still names a file that exists and still has the read', () => {
  // A bill nobody can pay is not a bill. If a site is fixed, its line must go —
  // otherwise the list slowly becomes fiction and stops meaning anything.
  for (const rel of Object.keys(EXEMPT)) {
    const src = readFileSync(join(WEB, rel), 'utf8');
    assert.ok(
      /\.from\(\s*'event_vendors'\s*\)/.test(src),
      `${rel} no longer reads event_vendors — delete its EXEMPT line`,
    );
    assert.ok(EXEMPT[rel]!.length > 80, `${rel} needs a real reason, not a placeholder`);
  }
});

test('the three repaired sites stay repaired', () => {
  // Named individually so a regression says WHICH one, rather than "an offender
  // appeared". These are the three that were live and are now fixed.
  const repaired = [
    'app/vendor-dashboard/clients/[eventId]/actions.ts',
    // The services delete's booking read moved into a pure module (2026-11-11, PR #7464: no delete or turn-off while a
    // booking is open). Every caller passes `createAdminClient()` — services/actions.ts, the services manager and the
    // Card Maker page.
    'lib/service-open-bookings.ts',
    // Added 2026-08-29 when the host/MC cue composer was repaired. Its downstream
    // was the reason it waited: `event_schedule_blocks` carries a booked-vendor
    // read, and `vendor_block_scripts` / `vendor_lines` are FOR ALL on
    // `current_vendor_ids()`, which every real shop satisfies because
    // `/open-shop` seeds a founding admin seat. Proved end to end against
    // production in a rolled-back transaction before the gate was touched.
    'app/vendor-dashboard/clients/[eventId]/script-actions.ts',
    // The manpower read moved into a pure, testable module (2026-09-20, paged
    // past the 1,000-row cap). The surface's call passes `createAdminClient()`,
    // pinned by `lib/the-four-small-lists-read-to-the-end.test.ts`.
    'lib/vendor-manpower-reads.ts',
  ];
  for (const rel of repaired) {
    const src = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    const windows = clientWindowsFor(src);
    assert.ok(windows.length > 0, `${rel} stopped reading event_vendors entirely`);
    for (const win of windows) {
      assert.ok(
        /admin/i.test(win),
        `${rel} went back to reading event_vendors on a session client — a silent zero (…${win.slice(-48)})`,
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// THE SAME TRAP ONE FOLDER OVER — `lib/vendor-*` and `lib/supplier-*`.
//
// Audit 2026-11-10 (corpus `plans/audit_supplier_admin_events_2026-11-10`, C2):
// the walk above covers `app/vendor-dashboard` only, so a shared reader in `lib/`
// that takes its client AS AN ARGUMENT escaped it. The file reads
// `client.from('event_vendors')`, the window says `client`, and nothing in the
// file can tell whether the caller handed in a session or an admin client — the
// answer lives at the CALL SITE. Three families were live when this was written:
//
//   · the My Performance funnel (`fetchVendorFunnelTotals*`, `fetchBookedBySource`,
//     `fetchServiceBookedCount`, `fetchNullServiceBookedCount`) — the "Booked"
//     stage, booked-by-source and per-service booked read 0 for EVERY shop, drawn
//     as a real number;
//   · `fetchVendorCommittedBookingCount` — its docblock says "fails CLOSED", but
//     RLS answers `count: 0` with no error, so the first-booking window never
//     closed and the two add-ons it prices were granted at ₱0 forever (money,
//     whenever `NEXT_PUBLIC_VENDOR_ADDON_FIRST5_FREE` is on);
//   · `countVendorCustomers` — the getting-started step "bring in the customers
//     you already have" could never read as done.
//
// So the lib walk has two halves. Every read whose receiver is not an admin
// client is a READER THAT TRUSTS ITS CALLER, and must be billed below with the
// side it serves. Then every call site is checked: a SHOP reader must be handed
// an admin client everywhere, and ANY reader called from the shop tree must be.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Readers in `lib/vendor-*` / `lib/supplier-*` that read `event_vendors` on a
 * client their caller hands in. Key: `<file>#<enclosing function>`.
 *
 * `couple` — reads the couple's own booking rows, which `couple_read` admits on a
 *            couple session. Still must be handed an admin client if the SHOP tree
 *            ever calls it.
 * `shop`   — answers a question about a SHOP's bookings. Every caller, anywhere,
 *            must hand it an admin client scoped by a `vendor_profile_id` it
 *            resolved from the caller's own session (or an admin surface).
 *
 * A new reader fails until it is classified here; that is the point.
 */
const LIB_READERS: Record<string, { side: 'couple' | 'shop'; why: string }> = {
  'lib/vendor-funnel.ts#fetchVendorFunnelTotalsResult': {
    side: 'shop',
    why: 'The Booked stage of a shop funnel. My Performance and Admin › App performance.',
  },
  'lib/vendor-funnel.ts#fetchBookedBySource': {
    side: 'shop',
    why: 'Booked rows sliced by source on My Performance.',
  },
  'lib/vendor-addon-first5-free.ts#fetchVendorCommittedBookingCount': {
    side: 'shop',
    why: 'MONEY: decides whether an add-on is granted at ₱0. A silent 0 grants it free.',
  },
};

/**
 * The couple-side half: these read `event_vendors` on a couple session (handed in, or made in the function),
 * which `couple_read` admits. Billed so a NEW reader cannot slip in unclassified, and so the shop tree is
 * stopped if it ever calls one on its own session (third test below).
 */
const LIB_COUPLE_READERS: Record<string, { side: 'couple' | 'shop'; why: string }> = {
  'lib/supplier-find-read.ts#readFindList': { side: 'couple', why: 'Find on the couple Suppliers page.' },
  'lib/supplier-part-notify.server.ts#readShopNames': {
    side: 'couple',
    why: 'Host schedule actions (couple session): the booked shops’ names on a chapter, so only "<shop> arrives / is done" stays when it moves.',
  },
  'lib/supplier-part-lock.server.ts#readPartLocks': {
    side: 'couple',
    why: 'Host schedule actions (couple session); the crew join page passes admin.',
  },
  'lib/supplier-share.server.ts#readSupplierShareFacts': { side: 'couple', why: 'The couple shares a supplier invite.' },
  'lib/suppliers-settings.server.ts#loadSuppliersSettings': { side: 'couple', why: 'Couple Suppliers page settings.' },
  'lib/vendor-availability.ts#getCommonAvailableDays': { side: 'couple', why: 'Common free days across a couple’s booked suppliers.' },
  'lib/vendor-availability.ts#getEventCommonAvailability': { side: 'couple', why: 'Explore date strip for a couple’s event.' },
  'lib/vendor-invite-actions.ts#connectExistingVendorProfile': { side: 'couple', why: 'Couple links a row to a shop (own session).' },
  'lib/vendor-invite-actions.ts#sendVendorInvite': { side: 'couple', why: 'Couple invites a supplier (own session).' },
  'lib/vendor-payment-methods.server.ts#readPublishedMethodsForCouple': { side: 'couple', why: 'Pay sheet on the couple side.' },
  'lib/vendor-service-payment-schedules.server.ts#fetchScheduleForCouple': { side: 'couple', why: 'Couple-side payment schedule.' },
  'lib/vendor-services.ts#fetchBoothCardItems': { side: 'couple', why: 'Couple 3D seating booths; the demo passes admin.' },
  'lib/vendor-time-slots.ts#fetchSlotsForCoupleBooking': { side: 'couple', why: 'Couple picks a supplier time slot.' },
  'lib/vendors.ts#fetchBookedVendorsForBooths': { side: 'couple', why: 'Couple seating page booths.' },
  'lib/vendors.ts#fetchEventVendors': { side: 'couple', why: 'The couple’s own supplier rows, read across the event dashboard.' },
};

const LIB_FILES = readdirSync(join(WEB, 'lib'))
  .filter((n) => /^(vendor|supplier)[\w.-]*\.tsx?$/.test(n) && !/\.(test|spec)\.tsx?$/.test(n))
  .map((n) => join(WEB, 'lib', n));

const CALLER_FILES = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib')), ...walk(join(WEB, 'components'))];

/** The nearest named function that opens before `idx`, and where it opens. */
function enclosingFunction(src: string, idx: number): { name: string; start: number } | null {
  let best: { name: string; start: number } | null = null;
  const pats = [
    /(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*[<(]/g,
    // An arrow only when `=>` follows its parameters — `const x = (a ?? b)` is not a function.
    /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=>/g,
  ];
  for (const re of pats) {
    for (const m of src.matchAll(re)) {
      if (m.index! >= idx) break;
      if (!best || m.index! > best.start) best = { name: m[1]!, start: m.index! };
    }
  }
  return best;
}

/** `{file#fn}` for every lib read of event_vendors whose receiver is NOT an admin client (handed in, or a session). */
function libReadersTrustingTheirCaller(): string[] {
  const out = new Set<string>();
  for (const file of LIB_FILES) {
    const src = stripComments(readFileSync(file, 'utf8'));
    const rel = relative(WEB, file);
    for (const m of src.matchAll(/\.from\(\s*'event_vendors'\s*\)/g)) {
      const win = src.slice(Math.max(0, m.index! - CLIENT_WINDOW), m.index!).trimEnd();
      if (/admin/i.test(win)) continue;
      const fn = enclosingFunction(src, m.index!);
      const ident = /([A-Za-z_$][\w$]*)$/.exec(win)?.[1];
      if (fn && ident) {
        // A local bound to an admin client under a plain name (`const supabase = createAdminClient()`).
        const body = src.slice(fn.start, m.index!);
        const bound = new RegExp(
          `\\b(?:const|let)\\s+${ident}\\s*=\\s*(?:await\\s+)?create(?:Admin|MoneyWriter)Client\\(`,
        );
        if (bound.test(body)) continue;
      }
      out.add(`${rel}#${fn?.name ?? '<top level>'}`);
    }
  }
  return [...out].sort();
}

/** The first argument at every call of `fn` outside its own definition. */
function firstArgsAtCalls(fn: string): { file: string; arg: string }[] {
  const out: { file: string; arg: string }[] = [];
  const re = new RegExp(`(?<![\\w$.])${fn}\\s*\\(`, 'g');
  for (const file of CALLER_FILES) {
    const raw = readFileSync(file, 'utf8');
    if (!raw.includes(fn)) continue;
    const src = stripComments(raw);
    for (const m of src.matchAll(re)) {
      const before = src.slice(Math.max(0, m.index! - 20), m.index!);
      if (/function\s*\*?\s*$/.test(before)) continue; // the definition itself
      let i = m.index! + m[0].length;
      let depth = 0;
      let arg = '';
      for (; i < src.length; i++) {
        const c = src[i]!;
        if ('([{'.includes(c)) depth++;
        if (')]}'.includes(c)) {
          if (depth === 0) break;
          depth--;
        }
        if (c === ',' && depth === 0) break;
        arg += c;
      }
      out.push({ file: relative(WEB, file), arg: arg.replace(/\s+/g, ' ').trim() });
    }
  }
  return out;
}

test('lib: the scan actually sees the lib readers', () => {
  assert.ok(LIB_FILES.length > 100, `only ${LIB_FILES.length} lib/vendor-*|supplier-* files — the filter moved`);
  const withReads = LIB_FILES.filter((f) => /\.from\(\s*'event_vendors'\s*\)/.test(readFileSync(f, 'utf8')));
  assert.ok(withReads.length >= 20, `only ${withReads.length} lib files read event_vendors — the matcher stopped matching`);
});

test('lib: every reader that trusts its caller is billed with the side it serves', () => {
  const found = libReadersTrustingTheirCaller();
  const unbilled = found.filter((k) => !(k in LIB_READERS) && !(k in LIB_COUPLE_READERS));
  assert.deepEqual(
    unbilled,
    [],
    'These lib functions read event_vendors on a client their caller hands in. A SHOP session ' +
      'reads ZERO rows there and nothing throws. Read through createAdminClient() scoped by the ' +
      'caller’s own vendor_profile_id, or bill the function in LIB_READERS / LIB_COUPLE_READERS:\n  ' +
      unbilled.join('\n  '),
  );
  // A bill nobody can pay is not a bill: a billed reader that no longer reads is fiction.
  const stale = [...Object.keys(LIB_READERS), ...Object.keys(LIB_COUPLE_READERS)].filter((k) => !found.includes(k));
  assert.deepEqual(stale, [], `billed readers that no longer read event_vendors on a handed-in client — delete their lines:\n  ${stale.join('\n  ')}`);
});

test('lib: a SHOP reader is handed an admin client at every call, and the shop tree hands every reader one', () => {
  const offenders: string[] = [];
  const all = { ...LIB_COUPLE_READERS, ...LIB_READERS };
  for (const [key, { side }] of Object.entries(all)) {
    const fn = key.split('#')[1]!;
    const calls = firstArgsAtCalls(fn);
    if (side === 'shop') assert.ok(calls.length > 0, `${key} has no callers left — delete its line`);
    for (const { file, arg } of calls) {
      const mustBeAdmin = side === 'shop' || file.startsWith('app/vendor-dashboard/');
      if (mustBeAdmin && !/admin/i.test(arg)) offenders.push(`${file}: ${fn}(${arg.slice(0, 48)}, …)  [${side}]`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'These calls hand a session client to a reader of event_vendors on a shop’s behalf. ' +
      '`event_vendors` has NO vendor SELECT policy, so each answers ZERO and nothing throws. ' +
      'Pass createAdminClient() (scoped by the caller’s own vendor_profile_id):\n  ' +
      offenders.join('\n  '),
  );
});

test('lib: the three audit C2 families stay repaired', () => {
  // Named so a regression says WHICH one.
  const committed = firstArgsAtCalls('fetchVendorCommittedBookingCount');
  assert.ok(committed.length >= 3, 'the first-booking-free count lost its callers — re-check the add-on pricing');
  for (const { file, arg } of committed) {
    assert.match(arg, /admin/i, `${file} prices an add-on off a session read of event_vendors — a silent 0 grants it at ₱0`);
  }
  for (const fn of ['fetchVendorFunnelTotalsResult', 'fetchBookedBySource']) {
    const calls = firstArgsAtCalls(fn).filter((c) => c.file.startsWith('app/vendor-dashboard/'));
    assert.ok(calls.length > 0, `${fn} is no longer called from the shop tree — re-check My Performance`);
    for (const { file, arg } of calls) assert.match(arg, /admin/i, `${file}: ${fn} on a session client reads Booked = 0`);
  }
  const firstSteps = stripComments(readFileSync(join(WEB, 'lib', 'vendor-first-steps.server.ts'), 'utf8'));
  assert.ok(
    !libReadersTrustingTheirCaller().some((k) => k.startsWith('lib/vendor-first-steps.server.ts#')),
    'vendor-first-steps.server.ts reads event_vendors on a handed-in client again — the customers step can never read done',
  );
  assert.match(firstSteps, /\.from\(\s*'event_vendors'\s*\)/, 'the customers step stopped counting event_vendors');
});
