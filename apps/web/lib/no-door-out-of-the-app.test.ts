/**
 * GUARD — a couple, or anyone reading a public page, is never handed a way to
 * reach a shop OUTSIDE the app.
 *
 * Owner, verbatim, 2026-09-10:
 *
 *   "our goal is to let them integrate their event with the vendor they find.
 *    not to let them communicate outside the app"
 *
 * It is a product principle and the business model at once: the booking fee is
 * charged on SOURCED clients — couples who found the shop here. A couple who
 * finds a shop on Setnayan and then emails or phones it books off-platform: no
 * booking fee, no in-app record, no lock, no price freeze, no protection for
 * either side. Measured on `origin/main` the day the principle was set, TWO
 * surfaces printed an exit and three more carried one unprinted:
 *
 *   • the PUBLIC shop page (`/v/[slug]`, also served at the bare `/{slug}`)
 *     printed every bookable shop's email as `mailto:` and its phone as `tel:`,
 *     readable signed out — one scroll above an Inquire section promising the
 *     conversation happens in the Setnayan inbox;
 *   • the supplier card INSIDE the couple's own dashboard offered the same two;
 *   • the workspace's summary printed the booking row's contact, which a package
 *     lock fills with the SHOP's own email and phone;
 *   • the budget card pre-filled that copied address into the Messages page's
 *     "start a thread" box, in plain sight;
 *   • the couple's Vendors page carried every supplier's email and phone in a
 *     client prop — never printed, but in the page payload.
 *
 * ── HOW THE FILE SET IS CHOSEN — DERIVED, NEVER HAND-LISTED ─────────────────
 * A hand-listed guard is a list of the places somebody thought of, and the next
 * exit is always in a place nobody thought of (the fork is usually the
 * signed-out arm nobody loads). So the scanned set is:
 *
 *   every file TRANSITIVELY IMPORTED, at runtime, from every Next.js entry
 *   point (page / layout / template / not-found / error / default / loading)
 *   under `app/` — MINUS the entry points of the trees that are not a couple's
 *   or the public's (STAFF_OR_SHOP_OWN_TREES below, each with its reason).
 *
 * A component shared into a couple page from anywhere — `components/`, `lib/`,
 * even `app/vendor-dashboard/` — is scanned because it is RENDERED there. Only
 * the excluded trees' own ENTRY POINTS are skipped, never their files.
 *
 * ── WHAT FAILS ──────────────────────────────────────────────────────────────
 *   Rule 1 · A DYNAMIC contact scheme — `mailto:${…}`, `tel:${…}`, `sms:${…}`,
 *            `viber://…${…}`, `whatsapp://…`, `https://wa.me/${…}`,
 *            `https://m.me/${…}` — or one built by concatenation
 *            (`'mailto:' + x`). A STATIC `mailto:` to Setnayan's own address is
 *            not a shop's door and is allowed. Zero tolerance: no bill.
 *   Rule 2 · A contact FIELD printed as a JSX expression — `{x.contact_email}`,
 *            `{ev.contact_phone ?? ev.contact_email}`, `value={c.contact_email}`
 *            — outside an exact-match bill (CONTACT_TEXT_BILL), where each line
 *            is a decision with its reason. The bill is exact in BOTH
 *            directions: a new file fails, and a file that stops printing one
 *            fails until its line is deleted, so the bill can only shrink on
 *            purpose.
 *   Rule 3 · A `.from('vendor_profiles')` chain whose select names
 *            `contact_email` / `contact_phone` (a select held in a module
 *            constant is resolved) — outside SHOP_CONTACT_READ_BILL, exact in
 *            both directions. A value a page never FETCHES cannot leak by any
 *            route; the public shop page used to fetch both for every visitor.
 *   Rule 4 · BEHAVIOURAL: the couple's Vendors-page model — a CLIENT prop, so
 *            every field is in the page payload even if nothing prints it —
 *            carries no supplier email or phone.
 *
 * ── WHAT IT DOES NOT COVER, said rather than buried ─────────────────────────
 *   • Serialization in general. Rule 4 pins the one client payload measured to
 *     carry the fields; another server→client prop built from a raw booking
 *     row would not be seen. `.from(<variable>)` is not resolved by Rule 3.
 *   • Contact details INSIDE a chat message or a quote's free text — that is
 *     `lib/chat-contact-filter.ts`'s job, not this guard's.
 *   • The DATABASE. `vendor_profiles.contact_email` is SELECT-granted to `anon`
 *     and `contact_phone` to `authenticated`, under a public-read row policy
 *     for every verified shop — measured in prod 2026-09-10. So the values are
 *     one PostgREST request away with the public key whatever this guard says.
 *     Closing that is a column revoke (a migration) plus moving the app's own
 *     user-session readers of the column; it is its own change.
 *   • The shop's external WEBSITE link, social / Instagram / portfolio
 *     link-outs, and contact details a shop types into its own free text — all
 *     OPEN owner decisions, deliberately untouched here.
 *   • `app/api/**` JSON (not a rendered surface; the public vendor API masks
 *     both fields and is flag-dark behind PUBLIC_API_ENABLED).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { stripComments } from './strip-comments';
import { buildPlanBudgetModel } from './vendors-plan-budget';

const WEB = path.join(import.meta.dirname, '..');

/**
 * Trees whose ENTRY POINTS are not a couple's or the public's. Each line is a
 * reason, not a convenience — adding one removes a whole tree from the guard.
 */
const STAFF_OR_SHOP_OWN_TREES: ReadonlyArray<{ prefix: string; why: string }> = [
  { prefix: 'app/admin/', why: 'Setnayan staff console — staff reach a shop by email on purpose.' },
  { prefix: 'app/vendor-dashboard/', why: "The shop's OWN dashboard — its own contact details belong here." },
  { prefix: 'app/open-shop/', why: 'A shop setting itself up, typing its own contact details.' },
  { prefix: 'app/api/', why: 'Machine endpoints, not rendered pages (see header).' },
  {
    prefix: 'app/vendor/claim/',
    why: 'A shop CLAIMING its own profile — the form is pre-filled with its own email and phone.',
  },
];

/**
 * CONTACT_TEXT_BILL — files allowed to print a contact field as a JSX
 * expression, with the EXACT count. Each is the COUPLE'S OWN typed record or a
 * destination that brings someone INTO the app, never a shop's door out.
 */
const CONTACT_TEXT_BILL: ReadonlyMap<string, { count: number; why: string; gate: RegExp }> =
  new Map([
  [
    'app/dashboard/[eventId]/hosts/page.tsx',
    {
      count: 2,
      why:
        "A BOOKED coordinator's address, shown as the destination of the in-app " +
        'delegate invite that brings them INTO the event (booked-only: the booking ' +
        'already happened on Setnayan).',
      // The reason claims "booked-only" — so the bill proves it.
      gate: /\.eq\('category', 'planner_coordinator'\)\s*\.in\('status', \['contracted', 'deposit_paid', 'delivered', 'complete'\]\)/,
    },
  ],
  [
    'app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx',
    {
      count: 1,
      why:
        'The contact the COUPLE typed for an OFF-platform supplier (no Setnayan ' +
        'profile, so no in-app channel exists). Gated off for a marketplace-linked row.',
      // The reason claims the gate — so the bill proves it. A lock copies the SHOP's
      // email and phone into this row; without the gate the cell prints them.
      gate: /\{isOffPlatformSupplier\(ev\) && \(ev\.contact_email \|\| ev\.contact_phone\) \?/,
    },
  ],
]);

/**
 * SHOP_CONTACT_READ_BILL — Rule 3. Files reachable from a couple/public entry
 * point that READ `vendor_profiles` AND carry a column list naming
 * `contact_email` / `contact_phone`, with the exact number of such lists.
 *
 * 🔑 WHY THIS RULE EXISTS: Rules 1 and 2 look at what is PRINTED. Two of the
 * exits this change closed were never printed at all — the public page fetched
 * the shop's address for every visitor, and the couple's Vendors page carried
 * every supplier's email and phone inside a client prop (the page payload). A
 * value that is never fetched cannot leak by any route, so the read itself is
 * what needs a reason. Each line below is server-side and says why.
 */
const SHOP_CONTACT_READ_BILL: ReadonlyMap<string, { count: number; why: string }> = new Map([
  [
    'app/dashboard/[eventId]/vendors/packages/actions.ts',
    {
      count: 1,
      why:
        'A server action: a package lock copies the shop\'s email/phone into the booking ' +
        'row so the coordinator broadcast can email that supplier. Never returned to the ' +
        'page; every couple-facing reader of that row is gated to off-platform suppliers.',
    },
  ],
  [
    'lib/vendor-activity.ts',
    {
      count: 1,
      why:
        'The stats recompute reads the whole profile to score its completeness (is an ' +
        'email on file?). It returns scores, never the row, so nothing reaches a page.',
    },
  ],
  [
    'lib/vendor-email-triggers.ts',
    {
      count: 1,
      why:
        'Resolves where to send an email TO the shop (a new inquiry, a status change). ' +
        'Setnayan is the sender and no email here is addressed to a couple.',
    },
  ],
  [
    'app/dashboard/[eventId]/vendors/page.tsx',
    {
      count: 1,
      why:
        'Server-side only: matches a legacy row whose email the COUPLE typed to a shop ' +
        'profile id (a Map key). The address it reads is one the couple already wrote.',
    },
  ],
]);

const ENTRY_RE =
  /(^|\/)(page|layout|template|default|not-found|error|global-error|loading)\.(ts|tsx)$/;

function sourceFiles(): string[] {
  const out = execSync(
    "grep -rl --include=*.ts --include=*.tsx '' app lib components || true",
    { cwd: WEB, encoding: 'utf8', shell: '/bin/bash', maxBuffer: 64 * 1024 * 1024 },
  );
  return out.split('\n').filter((f) => f && !f.includes('.test.'));
}

const FILES = sourceFiles();
const ALL = new Set(FILES);

function resolveImport(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.')) {
    const dir = fromFile.split('/').slice(0, -1);
    for (const part of spec.split('/')) {
      if (part === '.' || part === '') continue;
      if (part === '..') dir.pop();
      else dir.push(part);
    }
    base = dir.join('/');
  } else return null; // a node_module — not our graph
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (ALL.has(cand)) return cand;
  }
  return null;
}

/**
 * Every import/re-export edge. Type-only imports are followed too, on purpose:
 * over-inclusion can only make this guard STRICTER, and a file reached only
 * through a type edge that also renders an exit is still worth a red line.
 */
// The clause between the keyword and `from` is only ever identifiers, braces,
// commas, `*`, `$` and whitespace — so it is matched by exactly that class.
// 🪤 A lazy `[\s\S]*?` there scans from EVERY `export function …` to the next
// `from` anywhere in the file: quadratic, and it made this guard take 120s.
const EDGE_RE =
  /(?:import|export)\s+[\w*${},\s]*?\bfrom\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s+['"]([^'"]+)['"]/g;

function reachableFrom(entries: string[]): Set<string> {
  const seen = new Set(entries);
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop()!;
    const src = stripComments(readFileSync(path.join(WEB, file), 'utf8'));
    for (const m of src.matchAll(EDGE_RE)) {
      const target = resolveImport(file, m[1] ?? m[2] ?? m[3] ?? '');
      if (target && !seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  return seen;
}

const ENTRIES = FILES.filter(
  (f) =>
    f.startsWith('app/') &&
    ENTRY_RE.test(f) &&
    !STAFF_OR_SHOP_OWN_TREES.some((t) => f.startsWith(t.prefix)),
);
const SCANNED = [...reachableFrom(ENTRIES)].sort();

/**
 * Rule 1 — a contact scheme whose target is computed, not a fixed literal.
 *
 * Group 1 captures the FIRST interpolated expression. One shape is exempt: a
 * bare SCREAMING_CASE identifier is a module constant — Setnayan's own address
 * (`mailto:${STD_SUPPORT_EMAIL}` in an email's List-Unsubscribe header). A
 * shop's field always arrives off a row (`x.contact_email`, `contact.phone`),
 * which can never be spelled that way.
 */
const DYNAMIC_SCHEME_RES: ReadonlyArray<RegExp> = [
  /\b(?:mailto|tel|sms|smsto|viber|whatsapp|facetime|skype):[^`'"\s]*?\$\{([^}]*)\}/gi,
  /\bhttps?:\/\/(?:wa\.me|api\.whatsapp\.com|m\.me|t\.me|msng\.link)\/[^`'"\s]*?\$\{([^}]*)\}/gi,
  /['"`](?:mailto|tel|sms|smsto|viber|whatsapp):[^'"`]*['"`]\s*\+\s*([\w.?!]+)/gi,
];
const SETNAYAN_CONSTANT_RE = /^[A-Z][A-Z0-9_]*$/;

function dynamicSchemes(src: string): string[] {
  const out: string[] = [];
  for (const re of DYNAMIC_SCHEME_RES) {
    for (const m of src.matchAll(new RegExp(re.source, re.flags))) {
      const expr = (m[1] ?? '').trim();
      if (SETNAYAN_CONSTANT_RE.test(expr)) continue;
      out.push(m[0].slice(0, 60));
    }
  }
  return out;
}

/** Rule 2 — a contact field rendered as a JSX expression. */
const CONTACT_TEXT_RE = /\{\s*[\w?.!]*\bcontact_?(?:email|phone)\b\s*(?:\?\?[^{}]*)?\}/gi;
/**
 * Rule 2, second shape — a contact field interpolated into a template string:
 * a URL (`?prefill_vendor_email=${encodeURIComponent(v.contact_email)}` put the
 * shop's copied address into a visible Messages box), or copy. Counted into the
 * SAME bill: printing it through a template is still printing it.
 */
const CONTACT_TEMPLATE_RE = /\$\{[^}]*\bcontact_?(?:email|phone)\b[^}]*\}/gi;

function count(src: string, re: RegExp): number {
  return [...src.matchAll(new RegExp(re.source, re.flags))].length;
}

const STRIPPED = new Map(
  SCANNED.map((f) => [f, stripComments(readFileSync(path.join(WEB, f), 'utf8'))]),
);

test('the corpus is real and the walk actually walks', () => {
  // An emptied corpus passes forever; so does a walk that resolves nothing.
  assert.ok(FILES.length > 1000, `expected the app+lib+components sources, found ${FILES.length}`);
  assert.ok(ENTRIES.length > 150, `expected many couple/public entry points, found ${ENTRIES.length}`);
  assert.ok(
    SCANNED.length > ENTRIES.length * 2,
    `the walk resolved almost no imports (${SCANNED.length} scanned vs ${ENTRIES.length} entries)`,
  );
});

test('the surfaces that carried the exits are IN the scanned set (derived, not assumed)', () => {
  // If the derivation ever stopped reaching these, every rule below would pass
  // over nothing on exactly the pages the owner's principle was written about.
  for (const f of [
    'app/v/[slug]/page.tsx', // the public shop page
    'app/[slug]/page.tsx', // the bare-root address that renders it too
    'app/dashboard/[eventId]/_components/vendor-marketplace-info.tsx', // the couple's supplier card
    'app/v/[slug]/_components/anon-inquiry-composer.tsx', // the signed-out door
    'app/v/[slug]/_components/service-details-sheet.tsx',
    'app/v/[slug]/booth/page.tsx', // the shop's walk-in booth
    'app/(shell)/explore/page.tsx', // the marketplace
    'app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx', // a supplier's workspace
    'app/dashboard/[eventId]/_components/vendor-itemization-card.tsx', // the budget card
    'app/dashboard/[eventId]/messages/page.tsx', // where a prefill lands, in plain sight
    'app/dashboard/[eventId]/vendors/page.tsx', // the Vendors page (its model is a client prop)
    'lib/tours.ts', // the couple's first-run tour copy
  ]) {
    assert.ok(STRIPPED.has(f), `${f} is no longer reached from a couple/public entry point`);
  }
});

test('Rule 1 — no couple-facing or public surface computes a mailto:/tel:/sms:/chat-app link', () => {
  const hits: string[] = [];
  for (const [f, src] of STRIPPED) {
    for (const h of dynamicSchemes(src)) hits.push(`${f}  →  ${h}`);
  }
  assert.deepEqual(
    hits,
    [],
    'A couple or a public visitor is handed a way to reach someone outside the app. ' +
      'Owner 2026-09-10: "our goal is to let them integrate their event with the vendor ' +
      'they find. not to let them communicate outside the app". Route them to the in-app ' +
      'inquiry / conversation instead.\n  ' +
      hits.join('\n  '),
  );
});

test('Rule 1 matches the shapes it claims to, and exempts only a constant', () => {
  // A regex that cannot match is not a negative result — prove each shape bites.
  const bites = [
    'href={`mailto:${vendor.contact_email}`}',
    'href={`tel:${contact.contact_phone.replace(/\\s/g, "")}`}',
    'href={`sms:${p}?&body=x`}',
    'href={`https://wa.me/${digits}`}',
    "href={'mailto:' + shop.email}",
  ];
  for (const b of bites) assert.equal(dynamicSchemes(b).length, 1, `did not bite: ${b}`);
  assert.equal(dynamicSchemes('`<mailto:${STD_SUPPORT_EMAIL}?subject=unsubscribe>`').length, 0);
  assert.equal(dynamicSchemes('href="mailto:iscasasolaii@gmail.com"').length, 0);
});

test('Rule 2 — a contact field is printed only where the bill says why, at the exact count', () => {
  const actual = new Map<string, number>();
  for (const [f, src] of STRIPPED) {
    const n = count(src, CONTACT_TEXT_RE) + count(src, CONTACT_TEMPLATE_RE);
    if (n > 0) actual.set(f, n);
  }
  const problems: string[] = [];
  for (const [f, n] of actual) {
    const billed = CONTACT_TEXT_BILL.get(f);
    if (!billed) problems.push(`NEW  ${f} prints a contact field ${n}× and is not on the bill`);
    else if (billed.count !== n) problems.push(`MOVED ${f}: bill says ${billed.count}, found ${n}`);
    else if (!billed.gate.test(STRIPPED.get(f) ?? '')) {
      problems.push(`UNGATED ${f}: the bill's reason names a gate the code no longer has`);
    }
  }
  for (const [f, billed] of CONTACT_TEXT_BILL) {
    if (!actual.has(f)) {
      problems.push(`STALE ${f} is on the bill (${billed.count}) but prints none — delete its line`);
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

/**
 * Rule 3 — a `.from('vendor_profiles')` chain whose `.select(…)` names a contact
 * field. The chain runs to the statement's end (`;`), so a sibling query on
 * `event_vendors` in the same file is NOT counted — that row is the couple's
 * own record, governed by Rule 2. A select held in a module constant
 * (`.select(fullSelect)`, the public shop page's own shape) is resolved to the
 * constant's literal, including a `+`-joined one.
 */
const FROM_VENDOR_PROFILES_RE = /\.from\(\s*['"`]vendor_profiles['"`]\s*\)/g;
const SELECT_ARG_RE = /\.select\(\s*(?:(['"`])([\s\S]*?)\1|([A-Za-z_$][\w$]*))/;
const CONTACT_FIELD_RE = /\bcontact_(?:email|phone)\b/;

function constantLiteral(src: string, name: string): string {
  const m = new RegExp(`\\bconst\\s+${name}\\b[^=]*=\\s*([^;]*);`).exec(src);
  return m?.[1] ?? '';
}

function shopContactReads(src: string): number {
  let n = 0;
  for (const m of src.matchAll(new RegExp(FROM_VENDOR_PROFILES_RE.source, 'g'))) {
    const rest = src.slice(m.index + m[0].length);
    const semi = rest.indexOf(';');
    const chain = semi === -1 ? rest : rest.slice(0, semi);
    const sel = SELECT_ARG_RE.exec(chain);
    if (!sel) continue;
    const cols = sel[3] ? constantLiteral(src, sel[3]) : (sel[2] ?? '');
    if (CONTACT_FIELD_RE.test(cols)) n += 1;
  }
  return n;
}

test('Rule 2 matches the shapes it claims to', () => {
  const n = (src: string) => count(src, CONTACT_TEXT_RE) + count(src, CONTACT_TEMPLATE_RE);
  assert.equal(n('<p>{c.contact_email}</p>'), 1);
  assert.equal(n('<dd>{ev.contact_phone ?? ev.contact_email}</dd>'), 1);
  assert.equal(n("<input value={c.contact_email ?? ''} />"), 1);
  assert.equal(n('`/m?prefill_vendor_email=${encodeURIComponent(vendor.contact_email)}`'), 1);
  assert.equal(n('<p>{vendor.website}</p>'), 0);
});

test('Rule 3 — a shop\'s contact is READ from vendor_profiles only where the bill says why', () => {
  const actual = new Map<string, number>();
  for (const [f, src] of STRIPPED) {
    const n = shopContactReads(src);
    if (n > 0) actual.set(f, n);
  }
  const problems: string[] = [];
  for (const [f, n] of actual) {
    const billed = SHOP_CONTACT_READ_BILL.get(f);
    if (!billed) {
      problems.push(
        `NEW  ${f} reads a shop's email/phone off vendor_profiles ${n}× — a couple or public ` +
          'surface should never fetch what it must never show. Drop the column, or bill it with a reason.',
      );
    } else if (billed.count !== n) problems.push(`MOVED ${f}: bill says ${billed.count}, found ${n}`);
  }
  for (const [f, billed] of SHOP_CONTACT_READ_BILL) {
    if (!actual.has(f)) {
      problems.push(`STALE ${f} is on the bill (${billed.count}) but reads none — delete its line`);
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('Rule 3 matches the shapes it claims to', () => {
  // A regex that cannot match is not a negative result — prove each shape bites.
  const vp = "supabase.from('vendor_profiles')";
  assert.equal(shopContactReads(`${vp}.select('website,contact_email,public_visibility').eq('a', b);`), 1);
  assert.equal(shopContactReads(`${vp}\n  .select('contact_phone')\n  .maybeSingle();`), 1);
  assert.equal(
    shopContactReads(`const fullSelect =\n  'a,contact_phone,b';\nawait admin.from('vendor_profiles').select(fullSelect).ilike('s', x);`),
    1,
  );
  // A filter naming the column is not a read; neither is a sibling event_vendors query.
  assert.equal(shopContactReads(`${vp}.select('id').ilike('contact_email', x);`), 0);
  assert.equal(
    shopContactReads(`${vp}.select('id');\nsupabase.from('event_vendors').select('vendor_id, contact_email');`),
    0,
  );
});

test("the couple's Vendors-page model carries no supplier email or phone (it is a CLIENT prop)", () => {
  // BEHAVIOURAL, not source-matching. This model is handed to a 'use client'
  // component, so every field on it is in the page payload whether or not any
  // JSX prints it. A package lock copies a Setnayan shop's own email and phone
  // into the booking row, so a field that merely rides along is still a door out.
  const EMAIL = 'shop-owner-door@example.test';
  const PHONE = '+63 917 555 0199';
  const model = buildPlanBudgetModel({
    vendorRows: [
      {
        vendor_id: 'v-1',
        vendor_name: 'A Setnayan shop',
        category: 'venue',
        status: 'contracted',
        contact_email: EMAIL,
        contact_phone: PHONE,
        marketplace_vendor_id: 'vp-1',
      },
    ],
    estimatedBudgetCentavos: 50_000_000,
    daysUntilWedding: 120,
    ceremonyType: null,
    venueSetting: null,
  });
  const payload = JSON.stringify(model);
  // Anti-vacuity: the row really did make it into the model.
  assert.ok(payload.includes('A Setnayan shop'), 'the fixture row never reached the model — this test proves nothing');
  assert.ok(!payload.includes(EMAIL), "the shop's email rides in the Vendors page payload");
  assert.ok(!payload.includes(PHONE), "the shop's phone rides in the Vendors page payload");
});

test('no couple-facing or public surface still promises the retired sentences', () => {
  // The shop page said "Identity stays masked until you choose to share" one
  // scroll below the shop's printed email and phone, and the tour said to reach
  // a shop "by their contact email". Both are promises the product no longer
  // makes. Comments are stripped, so the notes recording the correction do not count.
  const RETIRED = [/identity stays masked/i, /by their contact email/i, /contact email above/i, /contact email is\s+on their card/i];
  const hits: string[] = [];
  for (const [f, src] of STRIPPED) {
    for (const re of RETIRED) if (re.test(src)) hits.push(`${f}  →  ${re.source}`);
  }
  assert.deepEqual(hits, [], hits.join('\n'));
});

test('the bill and the exclusions carry reasons', () => {
  for (const [f, b] of CONTACT_TEXT_BILL) assert.ok(b.why.length > 40, `${f} has no real reason`);
  for (const [f, b] of SHOP_CONTACT_READ_BILL) assert.ok(b.why.length > 40, `${f} has no real reason`);
  for (const t of STAFF_OR_SHOP_OWN_TREES) assert.ok(t.why.length > 20, `${t.prefix} has no reason`);
});
