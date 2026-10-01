import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { FEATURE_PAGES } from '@/lib/feature-pages';
import { STUDIO_APPS } from '@/lib/studio-apps';

/**
 * `/features` MAY ONLY PROMISE WHAT THE APP DOES.
 *
 * 🔴 THE SWEEP THIS GUARD IS MADE OF (2026-09-06). `/features` is twelve
 * section files of hand-written bilingual copy, and nothing had ever checked it
 * against the code. Three false claims were found in `_PlanningToolkit.tsx` and
 * fixed; the same vocabulary then turned up in two more sections, and both were
 * false there too:
 *
 *   · "a single .ics feed your phone subscribes to · updates push live; you
 *     don't re-import · family members get their own subscribable feed" —
 *     there is no feed. `/api/budget/[eventId]/ics` sends
 *     `Content-Disposition: attachment` behind `supabase.auth.getUser()`, so a
 *     phone cannot subscribe to it (it cannot authenticate) and nothing pushes.
 *     It carries vendor payment due dates and nothing else — no RSVP cutoffs,
 *     no fittings, no tastings, no run-of-show.
 *
 *   · "OCR-scans the signed page, and surfaces the key fields (deposit amount,
 *     balance due date, deliverables list) into the ledger automatically" —
 *     there is no OCR anywhere in the tree, `payment-receipt-read.server.ts`
 *     says refusing it was deliberate, and the AI-analysis SKU that would have
 *     done this (Contract Intelligence, iteration 0032) was RETIRED on
 *     2026-05-18 by `20260518200000_vendor_contracts_dual_esign_retire_0032`.
 *
 *   · "Drop the PDF the vendor sent you" — the couple cannot upload one. Their
 *     own contracts page reads: "Vendors will upload PDFs here once you agree
 *     on terms in chat."
 *
 * 🔑 THE SHAPE OF THE MISTAKE, NOT THE WORDS. Every one of these described a
 * PLAUSIBLE version of a feature that really exists — there IS calendar export,
 * there ARE contracts — enriched with the automation a reader would want. That
 * is what makes marketing copy rot invisibly: it is never nonsense, it is
 * always the next version of the truth, and only somebody holding the code can
 * tell the two apart.
 *
 * ── WHAT THIS GUARD CAN AND CANNOT DO ───────────────────────────────────────
 * It cannot read English. It bans the specific PHRASES that were false, in both
 * languages, so the exact claims cannot come back — and pairs each with the
 * shipped fact that makes it false, so a future session that genuinely builds
 * the feature knows precisely what to change here and why. Ban a phrase only
 * with such a reason attached; a banned word with no reason is a guard nobody
 * can retire honestly.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SECTIONS = join(HERE, '_sections');

/** Each: the phrase, and the shipped fact that makes it a lie today. */
const BANNED: ReadonlyArray<{ phrase: RegExp; why: string }> = [
  {
    phrase: /subscribable feed|feed your phone subscribes to|phone subscribes|Subscribe to the \.ics feed|sina-subscribe ng phone|I-subscribe ang \.ics/i,
    why:
      'There is no subscribable calendar feed. `/api/budget/[eventId]/ics` returns ' +
      '`Content-Disposition: attachment` behind `supabase.auth.getUser()` — a phone ' +
      'calendar cannot authenticate, so it cannot subscribe. Say "download and import", ' +
      'or build a signed unauthenticated feed URL first and then rewrite this.',
  },
  {
    phrase: /updates push live|don’t re-import|don't re-import|hindi mo na kailangang mag-re-import|laging updated/i,
    why:
      'Nothing pushes. The .ics routes render a file per request; a downloaded file is a ' +
      'snapshot and the reader must re-export to see a change. Promising live updates ' +
      'is the one thing a download provably cannot do.',
  },
  {
    phrase: /OCR/,
    why:
      'There is no OCR in this codebase. `lib/payment-receipt-read.server.ts` records that ' +
      'refusing it was a cost decision, and Contract Intelligence (iteration 0032), the SKU ' +
      'that would have read contracts, was retired 2026-05-18 by migration ' +
      '20260518200000_vendor_contracts_dual_esign_retire_0032.',
  },
  {
    phrase: /Drop the PDF the vendor sent you|I-drop ang PDF na pinadala/i,
    why:
      'The couple cannot upload a contract. `app/dashboard/[eventId]/contracts/page.tsx` ' +
      'says so in its own empty state: "Vendors will upload PDFs here once you agree on ' +
      'terms in chat." The vendor uploads; both parties sign in-browser.',
  },
  /* ── ADDED 2026-09-06, the sweep that finished the audit ──────────────────
     The first pass fixed the sections carrying the .ics/OCR vocabulary and
     stopped there. Finishing the remaining eight files found four more, none
     of which shared a single word with the first three — which is the argument
     against ever calling a copy audit done at the first clean grep. */
  {
    phrase: /three aspect ratios|tatlong aspect ratio/i,
    why:
      'The invite renders at ONE size. `app/api/website/qr/guest/[guestId]/route.ts` ' +
      'emits a single 1024x1024 PNG; there is no story/feed/print variant set anywhere ' +
      'in the tree. The print sheet at /dashboard/[eventId]/invitation/print is real and ' +
      'may be claimed — a second and third aspect ratio may not.',
  },
  {
    phrase: /delivery preferences \(per channel, per category\)|Per-event delivery preferences/i,
    why:
      'There is no notification-preference table and no surface that edits one. Which ' +
      'channel a notice takes is a HARDCODED per-notice-type allowlist in ' +
      '`lib/notifications.ts` ("ON the email allowlist" / "NOT on the push allowlist"), ' +
      'chosen by us and not by the couple. Build a preferences table and a UI before ' +
      'this sentence goes back.',
  },
  {
    phrase: /arrives in your gallery the next morning|Dumarating ang compilation sa gallery mo kinabukasan/i,
    why:
      'Nothing runs overnight. `vercel.json` ships `"crons": []`, the render happens in ' +
      "the guest's browser (WebCodecs/MediaRecorder) and is closed out by " +
      '`finalizePatiktokRenderJob` the moment it completes — the stub queue-drainer that ' +
      'would have batched it was DELETED, and `patiktok-render-completion-writer.test.ts` ' +
      'exists to keep it deleted. A morning-after promise implies a schedule we removed ' +
      'on purpose.',
  },
  {
    phrase: /receipts download together|sabay-sabay na nada-download/i,
    why:
      'There is no combined download and no receipts index. `lib/routes.ts` exposes only ' +
      '`receipts.detail(receiptId)`; each receipt is its own printable page at ' +
      '/receipts/[receiptId], reached from its order. "Together" promises a bundle that ' +
      'does not exist.',
  },
];

/**
 * Everything /features says, as files: the hub's sections AND the registry
 * every /features/<slug> page renders from (2026-10-01). The six hand-written
 * catalogue sections this guard was built on were replaced that day by
 * `lib/feature-pages/*.ts`; scanning only `_sections/` after that would have
 * left forty-odd pages of new copy unread.
 */
const WEB = join(HERE, '..', '..');
const REGISTRY = join(WEB, 'lib', 'feature-pages');

function sectionFiles(): string[] {
  return [
    ...readdirSync(SECTIONS)
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => join(SECTIONS, f)),
    ...readdirSync(REGISTRY)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .map((f) => join(REGISTRY, f)),
  ];
}

test('the sections exist — the guard cannot silently scan an empty directory', () => {
  const files = sectionFiles();
  assert.ok(
    files.length >= 10,
    `Only ${files.length} files found under ${SECTIONS} + ${REGISTRY}. A guard pointed at the ` +
      'wrong directory reads nothing and passes forever.',
  );
  // The registry must actually carry the pages — an empty registry scans clean.
  assert.ok(FEATURE_PAGES.length >= 30, `only ${FEATURE_PAGES.length} feature pages in the registry`);
});

test('/features makes no claim the app cannot keep', () => {
  /*
    EVERY VIOLATION IS COLLECTED, NEVER JUST THE FIRST.

    🔴 This test used to assert inside the loop, so the first bad phrase threw
    and the rest of the page went unread. Caught by its own mutation check on
    2026-09-06: four known-false claims were restored and the run reported
    exactly ONE of them — the other three were invisible, in a guard whose whole
    job is finding claims nobody has looked at. A checker that stops at the
    first problem hides the others, which is the same defect this file exists to
    catch in the copy.
  */
  const found: string[] = [];
  for (const file of sectionFiles()) {
    /*
      Comments are stripped FIRST — this file's own docblock quotes every banned
      phrase to explain it, and the sections now carry correction notes that do
      the same. A scan that reads prose finds the thing it bans in the sentence
      saying it is gone.
    */
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const { phrase, why } of BANNED) {
      const hit = phrase.exec(src);
      if (hit) found.push(`${relative(WEB, file)} claims "${hit[0]}" — and the app does not do it.\n    ${why}`);
    }
  }
  assert.deepEqual(
    found,
    [],
    `/features makes ${found.length} claim(s) the app cannot keep:\n\n` +
      found.map((f, i) => `  ${i + 1}. ${f}`).join('\n\n') +
      '\n\nIf you have genuinely SHIPPED one of these, delete its entry from BANNED in ' +
      'this file and say in the same commit what now makes it true. Do not weaken a ' +
      'pattern to get green.',
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   EVERY FEATURE PAGE (2026-10-01) — the structural half of "only what ships".

   Banned phrases catch the claims we already know are false. These catch the
   ones nobody has looked at yet, by tying every page to the code behind it:
   a feature page names its evidence, its links, its price codes and its
   pictures, and each must still be real. Every check COLLECTS violations and
   reports them all — see the note in the test above for why.
   ═══════════════════════════════════════════════════════════════════════════ */

const APP = join(WEB, 'app');
const PUBLIC = join(WEB, 'public');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');

/** A public URL path → does a page file serve it? Route groups `(x)` add no segment. */
function pageExists(path: string): boolean {
  const segs = path.split('/').filter(Boolean);
  const roots = [APP, join(APP, '(shell)')];
  return roots.some((root) => existsSync(join(root, ...segs, 'page.tsx')));
}

test('every feature page names the shipped code behind it, and that code still exists', () => {
  const missing: string[] = [];
  for (const f of FEATURE_PAGES) {
    if (f.evidence.length === 0) missing.push(`${f.slug}: names no evidence at all`);
    for (const rel of f.evidence) {
      if (!existsSync(join(WEB, rel))) missing.push(`${f.slug}: ${rel} does not exist`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    'A feature page is only allowed to describe code that exists. These pages point at ' +
      'files that are gone — the feature was removed or moved, and its page kept selling it:\n  ' +
      missing.join('\n  '),
  );
});

test('every Try it and More link opens a real page', () => {
  const dead: string[] = [];
  for (const f of FEATURE_PAGES) {
    for (const href of [f.tryHref, f.moreHref]) {
      if (href && !pageExists(href)) dead.push(`${f.slug} → ${href}`);
    }
  }
  assert.deepEqual(dead, [], `These links open no page (a fake door):\n  ${dead.join('\n  ')}`);
});

test('every price code was created by a migration — no invented SKUs', () => {
  const sql = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n');
  const unknown: string[] = [];
  for (const f of FEATURE_PAGES) {
    if (f.price.kind === 'free') continue;
    if (f.price.codes.length === 0) unknown.push(`${f.slug}: a paid price with no codes`);
    for (const code of f.price.codes) {
      if (!sql.includes(`'${code}'`)) unknown.push(`${f.slug}: ${code}`);
    }
    if (f.price.inactiveRowsArePrices && f.slug !== 'setnayan-ai') {
      unknown.push(`${f.slug}: only the Setnayan AI ladder may read inactive rows as prices`);
    }
  }
  assert.deepEqual(
    unknown,
    [],
    `These price codes appear in no migration, so no catalogue row can price them:\n  ${unknown.join('\n  ')}`,
  );
});

test('every picture on a feature page is a real file, never a banned frame', () => {
  const bad: string[] = [];
  for (const f of FEATURE_PAGES) {
    for (const s of f.shots) {
      if (!existsSync(join(PUBLIC, s.src))) bad.push(`${f.slug}: ${s.src} is not on disk`);
      if (!s.alt.en.trim() || !s.alt.tl.trim()) bad.push(`${f.slug}: ${s.src} has no alt text`);
      // Shows a price and an "Upgrade" pill — see spotlights-are-real.test.ts.
      if (s.src === '/add-ons/demo/stills/animated-monogram-1.jpg') bad.push(`${f.slug}: ${s.src} is banned`);
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('the copy follows the house words — supplier, Event Hub, and no typed prices', () => {
  /*
    MUTATION: write "vendor" or "website" or "₱500" into any entry → this fails.
    "supplier" never "vendor" and "Event Hub" never "website" are owner rules
    for every word a person reads; a typed peso figure is a price nothing
    watches (prices come from the catalogue through `price`).
  */
  const bad: string[] = [];
  const words = (f: (typeof FEATURE_PAGES)[number]) => {
    const out: string[] = [];
    for (const loc of ['en', 'tl'] as const) {
      out.push(f.name[loc], f.line[loc], f.title[loc], f.description[loc], f.answer[loc], f.forWho[loc]);
      out.push(...f.steps[loc], ...f.different[loc], ...f.keywords[loc]);
      for (const x of f.faq[loc]) out.push(x.q, x.a);
      for (const w of f.worksWith) out.push(w.how[loc]);
      for (const s of f.shots) out.push(s.alt[loc]);
    }
    return out;
  };
  for (const f of FEATURE_PAGES) {
    for (const text of words(f)) {
      if (/\bvendors?\b/i.test(text)) bad.push(`${f.slug}: says "vendor" — "${text}"`);
      if (/\bwebsites?\b/i.test(text)) bad.push(`${f.slug}: says "website" — "${text}"`);
      if (/₱\s*\d|\bPHP\s*\d/.test(text)) bad.push(`${f.slug}: types a price — "${text}"`);
    }
  }
  assert.deepEqual(bad, [], `\n  ${bad.join('\n  ')}`);
});

test('both languages say the same number of things', () => {
  // MUTATION: drop one FAQ or one "different" line from either locale → this fails.
  const bad: string[] = [];
  for (const f of FEATURE_PAGES) {
    if (f.steps.en.length !== 3 || f.steps.tl.length !== 3) bad.push(`${f.slug}: steps must be exactly 3`);
    if (f.different.en.length !== f.different.tl.length) bad.push(`${f.slug}: "different" differs EN/TL`);
    if (f.different.en.length < 3 || f.different.en.length > 5) bad.push(`${f.slug}: "different" must be 3–5`);
    if (f.faq.en.length !== f.faq.tl.length) bad.push(`${f.slug}: FAQ differs EN/TL`);
    if (f.faq.en.length < 3 || f.faq.en.length > 6) bad.push(`${f.slug}: FAQ must be 3–6`);
    if (f.worksWith.length < 2 || f.worksWith.length > 5) bad.push(`${f.slug}: "works with" must be 2–5`);
    for (const w of f.worksWith) {
      if (w.slug === f.slug) bad.push(`${f.slug}: "works with" links to itself`);
    }
    if (f.line.en.split(/\s+/).length > 12) bad.push(`${f.slug}: hub line over 12 words`);
  }
  assert.deepEqual(bad, [], `\n  ${bad.join('\n  ')}`);
});

test('a feature with a product page carries that product’s own name', () => {
  // One name per product: the rail, the product page and the feature page agree.
  const bad: string[] = [];
  for (const f of FEATURE_PAGES) {
    const app = STUDIO_APPS.find((a) => a.href === f.moreHref);
    if (app && app.name !== f.name.en) bad.push(`${f.slug}: "${f.name.en}" but ${app.href} calls it "${app.name}"`);
  }
  assert.deepEqual(bad, [], `\n  ${bad.join('\n  ')}`);
});
