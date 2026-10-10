/**
 * couple-supplier-notices-reach-email.test.ts — A NOTICE THAT OPENS OR MOVES A
 * BOOKING REACHES THE OTHER PARTY AWAY FROM THE APP.
 *
 * 🔴 WHY (2026-10-10). The supplier's first inquiry, "a payment is waiting for
 * you to confirm", "your supplier asked for a payment", the cancelled booking,
 * the declined inquiry, the delivery confirmation and the claim notice were all
 * emitted and none was on the email allowlist — so a supplier who was not
 * looking at the app heard nothing. A comment beside one of them said it
 * emailed. 🔑 THE NOTIFICATION AND THE ALLOWLIST ARE TWO HALVES OF ONE
 * MECHANISM; having one is indistinguishable from having neither.
 *
 * WHAT IS HELD — the property, never a phrasing:
 *
 *   1 · BOTH HALVES. Every type `lib/couple-supplier-notices.ts` declares as
 *       emailed is on the allowlist, is NOT marketing-gated, and has its own
 *       reason line (the three parts the one shared layout needs from a type).
 *       Every type declared app-only is NOT emailed — so the declaration cannot
 *       go stale in the other direction either.
 *   2 · NOBODY ADDS A ROUND TRIP WITHOUT DECIDING. Every notice type emitted
 *       from a couple ↔ supplier file is declared one way or the other.
 *   3 · THE BUTTON LANDS SOMEWHERE REAL, ON THE READER'S SIDE. The link is read
 *       OUT OF EACH EMIT SITE (never typed here), must resolve to a page that
 *       exists, and must be on the recipient's side of the app.
 *   4 · THE EMAIL SAYS WHICH EVENT AND WHEN. Rendered through the real template
 *       with fixture data: the event's name and date are in both halves, a first
 *       inquiry carries the date and NEVER the name, and there is one button
 *       whose link is the emit site's own.
 *   5 · AN UNSENT EMAIL IS WRITTEN DOWN. The emitter no longer skips the whole
 *       block when Resend is not configured, and every exit without a send
 *       records why.
 *
 * SABOTAGE (2026-10-10 — each run alone, seen red in the test named, restored
 * from an in-memory copy keyed on the full path, restore hash-checked):
 *   · take 'payment_logged' off the allowlist                     → test 1
 *   · delete payment_logged's line in notification-email-reason   → test 1
 *   · put 'vendor_inquiry_received' in the marketing-gated set    → test 1
 *   · add 'schedule_suggestion' (app-only) to the allowlist       → test 1b
 *   · emit an undeclared type from a supplier file                → test 2
 *   · remove `eventId` from the payment_logged emit in Budget     → test 3
 *   · point the cancelled-booking fallback link at a made-up page → test 3
 *   · point a supplier's payment notice at the couple's side      → test 3
 *   · make the first inquiry 'name_and_date'                      → test 4b
 *   · put `(await isEmailConfigured()) &&` back on the gate       → test 5
 *   · delete the record in the catch around the send              → test 5
 *
 * Run from apps/web:  ../../node_modules/.bin/tsx --test lib/couple-supplier-notices-reach-email.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { stripComments } from './strip-comments';
import { renderBrandedEmail } from './email-template';
import {
  NOTIFICATION_EMAIL_FALLBACK_REASON,
  NOTIFICATION_EMAIL_REASONS,
  notificationEmailReason,
} from './notification-email-reason';
import {
  COUPLE_SUPPLIER_NOTICES,
  NOTICE_DATE_NOT_SET,
  coupleSupplierEventSections,
  type CoupleSupplierNotice,
} from './couple-supplier-notices';
import type { NotificationType } from './notifications';

const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const NOTICES = COUPLE_SUPPLIER_NOTICES as Record<string, CoupleSupplierNotice>;
const EMAILED = Object.entries(NOTICES).filter(([, n]) => n.reach === 'email');
const APP_ONLY = Object.entries(NOTICES).filter(([, n]) => n.reach === 'app_only');

/* ═══ Reading the emitter ═══════════════════════════════════════════════════ */

const EMIT = code('lib/notification-emit.ts');

/** The members of one Set literal in notification-emit.ts, comments stripped. */
function setMembers(name: string): Set<string> {
  const start = EMIT.indexOf(`const ${name}`);
  assert.ok(start > -1, `${name} moved — this guard is blind`);
  const open = EMIT.indexOf('new Set([', start);
  const close = EMIT.indexOf(']);', open);
  assert.ok(open > start && close > open, `could not bound ${name}`);
  return new Set([...EMIT.slice(open, close).matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1]!));
}

/* ═══ Reading the emit sites ════════════════════════════════════════════════ */

/**
 * WHERE A COUPLE ↔ SUPPLIER NOTICE IS WRITTEN. Two whole trees (everything a
 * supplier does to a customer, everything a couple does to a supplier) plus the
 * shared files both sides call. A new file in either tree is covered the day it
 * is created; a new shared file has to be added here.
 */
const SCOPE_TREES = ['app/vendor-dashboard', 'app/dashboard/[eventId]/vendors'];
const SCOPE_FILES = [
  'lib/chat-actions.ts',
  'lib/offer-service-core.ts',
  'lib/reusable-bookings.server.ts',
  'lib/ghosting.ts',
  'lib/lock-request-expiry.ts',
  'lib/lock-request-notices.server.ts',
  'lib/booking-payment-plan.server.ts',
  'lib/date-change.server.ts',
  'lib/schedule-request-notify.server.ts',
  'lib/vendor-invite-actions.ts',
  'app/_components/negotiation-actions.ts',
  'app/dashboard/[eventId]/budget/actions.ts',
  'app/dashboard/[eventId]/schedule/actions.ts',
  'app/dashboard/[eventId]/delete-actions.ts',
  'lib/deletion-request-nudge.ts',
  'app/dashboard/[eventId]/studio/mood-board/finalization-actions.ts',
];

/**
 * Emitted from inside the two trees, and NOT a notice between a couple and a
 * supplier. One line of reason each — this is the only way out of test 2.
 */
const NOT_BETWEEN_A_COUPLE_AND_A_SUPPLIER: Record<string, string> = {
  creator_offer_received: 'a supplier to a CREATOR (the creators desk) — no couple is involved',
  order_cancelled: 'the buyer’s own Setnayan order, cancelled with the event it belonged to — no supplier is involved',
  force_majeure_filed: 'to Setnayan’s admins: a money case opened by a released booking (lib/date-change.server.ts)',
};

/**
 * An emit whose `type:` is a variable, and the types that variable can hold
 * (read off the function's own parameter type). A non-literal type anywhere
 * else fails test 2, because a type this file cannot read is a type it cannot
 * hold to anything.
 */
const VARIABLE_TYPE_SITES: Record<string, Record<string, string[]>> = {
  'lib/chat-actions.ts': { 'args.type': ['inquiry_accepted', 'inquiry_declined'] },
  'app/vendor-dashboard/clients/[eventId]/finalization-actions.ts': {
    'note.type': ['part_finalization_agreed', 'part_finalization_declined', 'part_reopen_answered'],
  },
  'app/dashboard/[eventId]/studio/mood-board/finalization-actions.ts': {
    'args.type': ['part_finalization_requested', 'part_reopen_requested'],
  },
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) out.push(...walk(abs));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(abs);
  }
  return out;
}

/** End index (exclusive) of the `{ … }` that opens at `open`, string- and template-aware. */
function matchBrace(src: string, open: number): number {
  let depth = 0;
  const stack: string[] = []; // '`' = inside a template's text · '${' = inside its expression
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i]!;
    const top = stack[stack.length - 1];
    if (top === '`') {
      if (ch === '\\') i += 1;
      else if (ch === '`') stack.pop();
      else if (ch === '$' && src[i + 1] === '{') {
        stack.push('${');
        i += 1;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      for (i += 1; i < src.length && src[i] !== ch; i += 1) if (src[i] === '\\') i += 1;
      continue;
    }
    if (ch === '`') stack.push('`');
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      if (top === '${') stack.pop();
      else {
        depth -= 1;
        if (depth === 0) return i + 1;
      }
    }
  }
  throw new Error('unbalanced emitNotification({ … })');
}

/** The source text of one top-level property's value inside an object literal body. */
function propertyValue(block: string, key: string): string | null {
  const at = block.search(new RegExp(`(^|[\\s,{])${key}\\s*:`));
  if (at < 0) return null;
  const from = block.indexOf(':', at) + 1;
  let depth = 0;
  let quote: string | null = null;
  for (let i = from; i < block.length; i += 1) {
    const ch = block[i]!;
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) return block.slice(from, i).trim();
      depth -= 1;
    } else if (ch === ',' && depth === 0) return block.slice(from, i).trim();
  }
  return block.slice(from).trim();
}

/** Path literals returned by an exported route helper in lib/. */
function helperLinks(name: string): string[] {
  for (const abs of walk(join(WEB, 'lib'))) {
    const src = stripComments(readFileSync(abs, 'utf8'));
    const at = src.indexOf(`export function ${name}(`);
    if (at < 0) continue;
    const open = src.indexOf('{', src.indexOf(')', at));
    return pathLiterals(src.slice(open, matchBrace(src, open)));
  }
  return [];
}

type EmitSite = {
  file: string;
  types: string[];
  /** Every path literal the link can be — a ternary has two. */
  links: string[];
  /** TRUE when the call hands the emitter the event explicitly. */
  passesEventId: boolean;
};

/** Path literals (`'/x'`, `` `/x/${y}` ``) in an expression. */
const pathLiterals = (expr: string): string[] =>
  [...expr.matchAll(/`(\/[^`]*)`|'(\/[^']*)'|"(\/[^"]*)"/g)].map((m) => (m[1] ?? m[2] ?? m[3])!);

function emitSites(): EmitSite[] {
  const files = [
    ...SCOPE_TREES.flatMap((t) => walk(join(WEB, t))),
    ...SCOPE_FILES.map((f) => join(WEB, f)),
  ];
  const sites: EmitSite[] = [];
  for (const abs of files) {
    const file = relative(WEB, abs).split(sep).join('/');
    const src = stripComments(readFileSync(abs, 'utf8'));
    // `deps.emit({` is the same emitter, handed in so a db test can count the
    // notices a money function sends (lib/booking-payment-plan.server.ts).
    const calls = [...src.matchAll(/\b(?:emitNotification|deps\.emit)\(\{/g)].map((m) => m.index!);
    for (const at of calls) {
      const open = src.indexOf('{', at);
      const block = src.slice(open + 1, matchBrace(src, open) - 1);
      const typeExpr = propertyValue(block, 'type');
      assert.ok(typeExpr, `${file}: an emitNotification call with no type`);
      // `'x'` and `cond ? 'x' : 'y'` both name their types in the call itself.
      // A literal being COMPARED (`response === 'accepted' ? … : …`) is the
      // condition, not a notice type — drop comparisons before reading the arms.
      const arms = typeExpr.replace(/[!=]==?\s*'[^']*'/g, '');
      const literals = [...arms.matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1]!);
      const types = literals.length > 0 ? literals : VARIABLE_TYPE_SITES[file]?.[typeExpr];
      assert.ok(
        types,
        `${file}: emitNotification with type \`${typeExpr}\` — this guard cannot read which notice that is. ` +
          'Write the type as a literal, or declare what the variable can hold in VARIABLE_TYPE_SITES.',
      );
      const linkExpr = propertyValue(block, 'relatedUrl') ?? '';
      let links = pathLiterals(linkExpr);
      // A link held in a constant (`relatedUrl: SUPPLIER_DESK`) is read from
      // where the constant is assigned, in the same file.
      const ident = /^[A-Za-z_$][\w$]*$/.exec(linkExpr)?.[0];
      if (links.length === 0 && ident) {
        const decl = new RegExp(`\\bconst ${ident}\\b[^=]*=([\\s\\S]*?);`).exec(src);
        links = decl ? pathLiterals(decl[1]!) : [];
      }
      // A link built by a route helper (`relatedUrl: studioHubHref(eventId)`) is
      // read from the helper's own body in lib/.
      const helper = /^([A-Za-z_$][\w$]*)\(/.exec(linkExpr)?.[1];
      if (links.length === 0 && helper) links = helperLinks(helper);
      // A file-local wrapper that forwards its caller's link
      // (`relatedUrl: args.relatedUrl`): the links are the ones its callers,
      // in the same file, wrote out.
      if (links.length === 0 && /^[A-Za-z_$][\w$]*\.relatedUrl$/.test(linkExpr)) {
        links = [...src.matchAll(/\brelatedUrl\s*:\s*(`[^`]*`|'[^']*')/g)].flatMap((m) => pathLiterals(m[1]!));
      }
      sites.push({
        file,
        types,
        links,
        passesEventId: /(^|[\s,{])eventId\b/.test(block),
      });
    }
  }
  return sites;
}

const SITES = emitSites();
const sitesOf = (type: string) => SITES.filter((s) => s.types.includes(type));

/* ═══ Reading the route tree ════════════════════════════════════════════════ */

function routes(): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) visit(abs);
      else if (entry === 'page.tsx') {
        const segs = relative(join(WEB, 'app'), dir).split(sep).filter((s) => s && !s.startsWith('('));
        out.push('/' + segs.join('/'));
      }
    }
  };
  visit(join(WEB, 'app'));
  return out;
}
const ROUTES = routes();

/** Does `/dashboard/${eventId}/vendors` (a literal off an emit site) name a page that exists? */
function isRealRoute(literal: string): boolean {
  const path = literal.split('#')[0]!.split('?')[0]!.replace(/\$\{[^}]+\}/g, '[*]').replace(/\/$/, '') || '/';
  const want = path.split('/');
  return ROUTES.some((route) => {
    const have = (route === '/' ? '' : route).split('/');
    return (
      have.length === want.length &&
      have.every((seg, i) => (want[i] === '[*]' ? /^\[[^.\]]+\]$/.test(seg) : seg === want[i]))
    );
  });
}

/* ═══ 0 · THE GUARD IS LOOKING AT SOMETHING ═════════════════════════════════ */

test('0 · anchor — real files were read, and the counts are not zero', () => {
  const allow = setMembers('EMAIL_ENABLED_TYPES');
  console.log(
    `# declared: ${EMAILED.length} emailed + ${APP_ONLY.length} app-only · allowlist: ${allow.size} types · ` +
      `emit sites in scope: ${SITES.length} · routes: ${ROUTES.length}`,
  );
  assert.ok(allow.size >= 50, `read only ${allow.size} allowlisted types`);
  assert.ok(EMAILED.length >= 25, `only ${EMAILED.length} emailed notices declared`);
  assert.ok(APP_ONLY.length >= 4, `only ${APP_ONLY.length} app-only notices declared`);
  assert.ok(SITES.length >= 60, `found only ${SITES.length} emit sites — the scan is blind`);
  assert.ok(ROUTES.length >= 300, `found only ${ROUTES.length} pages — the route walk is blind`);
  // The parsers can tell a real route from a made-up one.
  assert.equal(isRealRoute('/vendor-dashboard/messages/${threadId}'), true);
  assert.equal(isRealRoute('/vendor-dashboard/no-such-page-anywhere'), false);
});

/* ═══ 1 · BOTH HALVES ═══════════════════════════════════════════════════════ */

test('1 · every notice the other party must act on has BOTH halves: the allowlist line and its own reason', () => {
  const allow = setMembers('EMAIL_ENABLED_TYPES');
  const gated = setMembers('MARKETING_GATED_EMAIL_TYPES');
  const reasons = NOTIFICATION_EMAIL_REASONS as Record<string, string | undefined>;
  for (const [type, notice] of EMAILED) {
    assert.ok(notice.why.length > 10, `${type} is declared with no reason`);
    assert.ok(
      allow.has(type),
      `${type} is declared as reaching the ${notice.to} by email (${notice.why}) but is NOT on EMAIL_ENABLED_TYPES — it is a tray badge only`,
    );
    assert.ok(
      !gated.has(type),
      `${type} is in MARKETING_GATED_EMAIL_TYPES — suppressed for everyone who has not opted into marketing, which is everyone by default`,
    );
    assert.ok(reasons[type], `${type} is emailed with no reason line of its own in notification-email-reason.ts`);
    assert.notEqual(
      notificationEmailReason(type as NotificationType),
      NOTIFICATION_EMAIL_FALLBACK_REASON,
      `${type} falls back to the generic reason line`,
    );
  }
});

test('1b · a notice declared app-only is NOT emailed — the declaration cannot quietly go stale', () => {
  const allow = setMembers('EMAIL_ENABLED_TYPES');
  for (const [type, notice] of APP_ONLY) {
    assert.ok(notice.why.length > 10, `${type} is declared app-only with no reason`);
    assert.ok(
      !allow.has(type),
      `${type} is on EMAIL_ENABLED_TYPES but lib/couple-supplier-notices.ts says it is app-only ("${notice.why}") — move it to reach: 'email' and give it its event rows`,
    );
  }
});

/* ═══ 2 · NOBODY ADDS A ROUND TRIP WITHOUT DECIDING ═════════════════════════ */

test('2 · every notice emitted from a couple ↔ supplier file is declared, one way or the other', () => {
  const emitted = new Map<string, string>();
  for (const s of SITES) for (const t of s.types) if (!emitted.has(t)) emitted.set(t, s.file);
  console.log(`# distinct types emitted in scope: ${emitted.size}`);
  // Every undeclared type at once — one run names the whole list.
  const undeclared = [...emitted]
    .filter(([type]) => !NOTICES[type] && !NOT_BETWEEN_A_COUPLE_AND_A_SUPPLIER[type])
    .map(([type, file]) => `${type} (${file})`);
  assert.deepEqual(
    undeclared,
    [],
    'Emitted from a couple ↔ supplier file, and lib/couple-supplier-notices.ts does not say whether it must reach the other party by email. ' +
      "Declare each there — reach: 'email' (then add the allowlist line and a reason line) or reach: 'app_only' with the reason.",
  );
  for (const [type, reason] of Object.entries(NOT_BETWEEN_A_COUPLE_AND_A_SUPPLIER)) {
    assert.ok(reason.length > 10, `${type} is excluded with no reason`);
    assert.ok(emitted.has(type), `${type} is excluded but nothing in scope emits it — delete the stale exclusion`);
    assert.ok(!NOTICES[type], `${type} is both declared and excluded`);
  }
  // And the other way: a declaration nobody emits is a list of intentions.
  for (const type of Object.keys(NOTICES)) {
    assert.ok(sitesOf(type).length > 0, `${type} is declared but no file in scope emits it — is its file missing from SCOPE_FILES?`);
  }
});

/* ═══ 3 · THE BUTTON LANDS SOMEWHERE REAL, ON THE READER'S SIDE ═════════════ */

test("3 · each emailed notice's link is a page that exists, on the recipient's side, and the email can name the event", () => {
  let checked = 0;
  for (const [type, notice] of EMAILED) {
    if (notice.reach !== 'email') continue;
    for (const site of sitesOf(type)) {
      assert.ok(site.links.length > 0, `${site.file}: the ${type} notice has no link this guard can read — a button with nowhere to go`);
      for (const link of site.links) {
        assert.ok(isRealRoute(link), `${site.file}: the ${type} email's button goes to ${link}, and no page exists there`);
        // A constant-held or slug link (`/${slug}`) names no side; the rest must match.
        const side = link.startsWith('/vendor-dashboard') ? 'supplier' : link.startsWith('/dashboard') ? 'couple' : null;
        if (notice.to !== 'either' && side) {
          assert.equal(side, notice.to, `${site.file}: ${type} is written to the ${notice.to} but its button opens the ${side}'s side (${link})`);
        }
        checked += 1;
      }
      // The emitter reads the event out of `/dashboard/<event id>/…` and out of
      // nothing else. A supplier-side link carries no event, so the call has to
      // hand it over — or the email goes out with no "Event · Date" rows.
      const derivable = site.links.some((l) => /^\/dashboard\/\$\{[^}]+\}(\/|$|[?#])/.test(l));
      if (notice.event !== 'none' && !derivable) {
        assert.ok(
          site.passesEventId,
          `${site.file}: the ${type} email cannot say which event it is about — its link (${site.links.join(' | ')}) carries no event and the call passes no eventId`,
        );
      }
    }
  }
  console.log(`# links checked: ${checked}`);
  assert.ok(checked >= 40, `only ${checked} links checked`);
});

/* ═══ 4 · THE EMAIL SAYS WHICH EVENT AND WHEN ═══════════════════════════════ */

const APP_URL = 'https://app.example.test';
const FIXTURE = {
  display_name: 'Ana & Ben — Tagaytay',
  event_date: '2027-03-06',
  event_date_precision: 'day',
} as const;
const FIXTURE_DATE = 'Saturday, March 6, 2027';

/** The emit site's own link with fixture ids in its slots. */
const filled = (link: string) => link.replace(/\$\{[^}]+\}/g, '11111111-2222-4333-8444-555555555555');

test('4 · rendered through the real template: the event, the date, and ONE button on the emit site\'s own link', () => {
  let rendered = 0;
  for (const [type, notice] of EMAILED) {
    if (notice.reach !== 'email') continue;
    const sections = coupleSupplierEventSections(type as NotificationType, FIXTURE);
    const rows = sections.flatMap((s) => s.rows);

    if (notice.event === 'none') {
      assert.equal(sections.length, 0, `${type} declares no event rows but got some`);
    } else {
      assert.deepEqual(rows.at(-1), { label: 'Date', value: FIXTURE_DATE }, `${type}: the date row is missing or wrong`);
      const names = rows.filter((r) => r.label === 'Event');
      if (notice.event === 'name_and_date') {
        assert.deepEqual(names, [{ label: 'Event', value: FIXTURE.display_name }], `${type}: the event is not named`);
      } else {
        assert.equal(names.length, 0, `${type} is PRE-accept and must not name the event`);
      }
    }

    for (const site of sitesOf(type)) {
      for (const link of site.links) {
        const href = `${APP_URL}${filled(link)}`;
        const html = renderBrandedEmail({
          heading: 'What happened',
          paragraphs: ['One sentence saying what happened.'],
          sections,
          ctaLabel: 'Open Setnayan',
          ctaHref: href,
          footer: notificationEmailReason(type as NotificationType),
        });
        assert.equal(html.split(`href="${href}"`).length - 1, 1, `${type}: expected exactly one button on ${href}`);
        assert.ok(html.includes(notificationEmailReason(type as NotificationType)), `${type}: the mail does not say why it came`);
        if (notice.event !== 'none') assert.ok(html.includes(FIXTURE_DATE), `${type}: the rendered mail has no date`);
        const namesEvent = html.includes('Ana &amp; Ben');
        assert.equal(namesEvent, notice.event === 'name_and_date', `${type}: the rendered mail ${namesEvent ? 'names' : 'does not name'} the event`);
        rendered += 1;
      }
    }
  }
  console.log(`# emails rendered: ${rendered}`);
  assert.ok(rendered >= 40, `only ${rendered} emails rendered`);
});

test('4b · the rows are honest about what is not known', () => {
  // No date yet: said, never blank and never today's date.
  const undated = coupleSupplierEventSections('payment_logged', { display_name: 'Ana & Ben', event_date: null, event_date_precision: null });
  assert.deepEqual(undated[0]!.rows, [
    { label: 'Event', value: 'Ana & Ben' },
    { label: 'Date', value: NOTICE_DATE_NOT_SET },
  ]);
  // A month-only date is not promoted to a day.
  const month = coupleSupplierEventSections('payment_logged', { display_name: null, event_date: '2027-08-01', event_date_precision: 'month' });
  assert.deepEqual(month[0]!.rows, [{ label: 'Date', value: 'August 2027' }]);
  // A type that is not one of these notices, or is app-only, adds nothing.
  assert.deepEqual(coupleSupplierEventSections('rsvp_received', FIXTURE), []);
  assert.deepEqual(coupleSupplierEventSections('schedule_suggestion', FIXTURE), []);
  // The first inquiry: the date, and never the name.
  assert.deepEqual(coupleSupplierEventSections('vendor_inquiry_received', FIXTURE)[0]!.rows, [{ label: 'Date', value: FIXTURE_DATE }]);
});

/* ═══ 5 · AN UNSENT EMAIL IS WRITTEN DOWN, AND THE MAIL IS BUILT FROM THESE ══ */

test('5 · the emitter builds the mail from the notice\'s own link and event, and records every exit without a send', () => {
  const fn = EMIT.slice(EMIT.indexOf('export async function emitNotification('));
  assert.ok(fn.length > 2000, 'emitNotification not found');

  // The button is the in-app notice's own link — one field, both channels.
  assert.match(fn, /const link = relatedUrl \? `\$\{appUrl\}\$\{relatedUrl\}` : appUrl;/, 'the email link is no longer built from relatedUrl');
  assert.match(fn, /ctaHref: link,/, 'the button no longer opens the notice\'s own link');
  // The event rows come from the declaration, unless the caller built its own.
  assert.match(fn, /args\.email \?\? \(await coupleSupplierEventParts\(admin, type, eventId\)\)/, 'the event rows are not added to the mail');
  assert.match(EMIT, /sections: coupleSupplierEventSections\(type, data\)/, 'the rows are not built by the declared rule');

  // The gate is the TYPE. With the configuration check in front of it, an
  // unconfigured mailer skipped the block and wrote nothing anywhere.
  assert.match(fn, /\n {2}if \(EMAIL_ENABLED_TYPES\.has\(type\)\) \{/, 'the email block is not gated on the allowlist alone');
  assert.doesNotMatch(fn, /isEmailConfigured\(\)/, 'the emitter checks configuration before sendEmail — an unconfigured send is skipped unrecorded again');

  // Three exits without a send, three rows: recipient unreadable, no address, threw.
  const block = fn.slice(fn.indexOf('if (EMAIL_ENABLED_TYPES.has(type)) {'), fn.indexOf('isWebPushConfigured()'));
  const records = block.split('await recordDelivery(').length - 1;
  console.log(`# recordDelivery calls in the email block: ${records}`);
  assert.equal(records, 3, 'an exit from the email block stopped recording why no email went');
  const caught = block.slice(block.lastIndexOf('} catch (e) {'));
  assert.match(caught, /await recordDelivery\(/, 'the catch around the send is silent again');
  // And the one path that DOES send still goes through the logged sender.
  assert.equal(block.split('await sendEmail(').length - 1, 1, 'the email block must send through sendEmail exactly once');

  // sendEmail is what writes `not_configured` — the reason removing the gate is enough.
  const email = code('lib/email.ts');
  assert.match(email, /result\.reason === 'not_configured' \? 'not_configured' : 'send_failed'/, 'sendEmail no longer records an unconfigured send');
});

/* ═══ 6 · A REQUEST THAT LAPSES IS TOLD FROM EVERY DOOR, IN ONE SENTENCE ════ */

/** The body of one exported function, comments stripped. */
function functionBody(rel: string, name: string): string {
  const src = code(rel);
  const at = src.indexOf(`export async function ${name}(`);
  assert.ok(at > -1, `${name} is gone from ${rel} — was it renamed?`);
  const next = src.indexOf('\nexport ', at + 1);
  return src.slice(at, next === -1 ? undefined : next);
}

test('6 · a booking request that lapses tells the couple from all three doors — the sweep, the late yes, the late no', () => {
  // ONE place holds the words. A second emit site is a second sentence, and a
  // second chance to forget a door.
  const emitters = sitesOf('lock_request_expired').map((s) => s.file);
  assert.deepEqual(emitters, ['lib/lock-request-notices.server.ts'], 'the expired notice is written in more than one place');

  const CLIENTS = 'app/vendor-dashboard/clients/[eventId]/actions.ts';
  for (const door of ['vendorAgreeToLock', 'vendorDeclineLock']) {
    const body = functionBody(CLIENTS, door);
    // Told on `expired` — the answer only the call that FLIPS the row gets —
    // and on nothing else: `not_pending` is what every later press answers,
    // and telling on that would repeat the notice on every tap.
    const tells = [...body.matchAll(/if \(([^)]*)\) \{\s*try \{\s*await tellCoupleLockRequestExpired\(/g)].map((m) => m[1]!);
    console.log(`# ${door}: tells the couple when → ${JSON.stringify(tells)}`);
    assert.deepEqual(
      tells,
      ["!error && env.status === 'expired' && eventId"],
      `${door} must tell the couple exactly when the function answers 'expired'`,
    );
  }
  // The sweep still tells, through the same function, once per row it returns.
  const sweep = functionBody('lib/lock-request-expiry.ts', 'runLockRequestExpirySweep');
  assert.equal(sweep.split('await tellCoupleLockRequestExpired(').length - 1, 1, 'the sweep no longer tells the couple');
  assert.ok(
    sweep.indexOf('await tellCoupleLockRequestExpired(') > sweep.indexOf("admin.rpc('expire_stale_lock_requests'"),
    'the sweep must tell only the rows expire_stale_lock_requests returned',
  );
});

/* ═══ 7 · A REQUEST TAKEN AWAY IS TOLD FROM BOTH DOORS ══════════════════════ */

test('7 · a pending booking request that is taken away tells the supplier — Withdraw, and ✕ Remove', () => {
  const emitters = sitesOf('lock_request_withdrawn').map((s) => s.file);
  assert.deepEqual(emitters, ['lib/lock-request-notices.server.ts'], 'the withdrawn notice is written in more than one place');

  const ACTIONS = 'app/dashboard/[eventId]/vendors/actions.ts';
  const withdraw = functionBody(ACTIONS, 'withdrawVendorLockRequest');
  assert.equal(withdraw.split('await tellSupplierLockRequestWithdrawn(').length - 1, 1, 'Withdraw no longer tells the supplier');

  const remove = functionBody(ACTIONS, 'deleteVendor');
  const read = remove.indexOf(".select('category, status, marketplace_vendor_id, lock_request_state')");
  const del = remove.indexOf('.delete()');
  const tell = remove.indexOf('await tellSupplierLockRequestWithdrawn(');
  console.log(`# deleteVendor: read@${read} delete@${del} tell@${tell}`);
  // The request lives ON the row being deleted, so it has to be read first…
  assert.ok(read > -1 && read < del, 'deleteVendor must read the request off the row BEFORE deleting it');
  // …and the supplier is told only once the removal has really happened.
  assert.ok(tell > del, 'deleteVendor must tell the supplier after the row is gone, not before');
  // Told when a request was waiting — by the shared derivation, never the raw column.
  assert.match(
    remove,
    /const tookAnAskAway =\s*lockRequestStateOf\([\s\S]{0,200}?\) === 'requested';/,
    'deleteVendor must decide "a request was waiting" with lockRequestStateOf',
  );
  assert.match(remove, /if \(tookAnAskAway && removed\?\.marketplace_vendor_id\) \{\s*try \{\s*await tellSupplierLockRequestWithdrawn\(/, 'the notice is no longer tied to a waiting request');
});

/* ═══ 8 · A CHANGE IN WHAT IS OWED HAS ITS OWN TYPE, AND THE ROW'S FIGURE ═══ */

test('8 · the four change-order notices left the in-app-only register, and the other six stayed', () => {
  const COUPLE = 'app/dashboard/[eventId]/vendors/actions.ts';
  const SUPPLIER = 'app/vendor-dashboard/clients/[eventId]/actions.ts';
  const doors: Array<[string, string, string]> = [
    [COUPLE, 'raiseChangeOrder', 'change_order_proposed'],
    [COUPLE, 'respondChangeOrder', 'change_order_answered'],
    [SUPPLIER, 'vendorRaiseChangeOrder', 'change_order_proposed'],
    [SUPPLIER, 'vendorRespondChangeOrder', 'change_order_answered'],
  ];
  for (const [file, fn, type] of doors) {
    const body = functionBody(file, fn);
    assert.equal(body.split(`type: '${type}'`).length - 1, 1, `${fn} must emit ${type} exactly once`);
    assert.ok(!body.includes("type: 'schedule_suggestion'"), `${fn} still sends a money change on the in-app-only schedule register`);
    // The figure comes off the row — read back after a raise, selected on an answer.
    assert.match(
      body,
      type === 'change_order_proposed' ? /await readChangeOrderJustRaised\(/ : /\.select\('[a-z_, ]*delta_amount_php'\)/,
      `${fn} no longer reads the figure off vendor_change_orders`,
    );
    // …and never off the form: the typed amount must not reach the notice.
    const notice = body.slice(body.indexOf('changeOrder'));
    assert.doesNotMatch(notice, /\b(delta|magnitude)\b/, `${fn} passes the typed amount into the notice`);
  }
  // The other six are untouched: still six, still the generic type.
  const rest = sitesOf('schedule_suggestion');
  console.log(`# schedule_suggestion sites left: ${rest.length} (${[...new Set(rest.map((s) => s.file))].join(', ')})`);
  assert.equal(rest.length, 6, 'a schedule/meeting/handover notice moved or a new one appeared — schedule_suggestion had six sites after the change orders left');
  assert.equal(sitesOf('change_order_proposed').length + sitesOf('change_order_answered').length, 4);
});
