/**
 * EVERY KEEP-OR-DELETE PROMISE ON /privacy, /terms AND /cookies NAMES THE THING
 * THAT KEEPS IT.
 *
 * ── WHY THIS EXISTS (DPO pack, 2026-10-22) ──────────────────────────────────
 * The DPO measured the public pages against the shipped code and found promises
 * with nothing behind them: /privacy said a closed account had "a short 30–90
 * day tail, then permanent deletion", /terms said "soft-deleted accounts are
 * retained for 30 days" — no code has ever had a tail or a timer; erasure blanks
 * the person at once and keeps the business records. /privacy promised support
 * tickets deleted at 2 years and device records pruned at 24 months — no job
 * exists for either — and said the device hash is "deleted when you delete your
 * account", which the erasure engine deliberately does not do. Each line read as
 * a fact. A regulator reads them as commitments.
 *
 * ── THE PROPERTY ────────────────────────────────────────────────────────────
 * Every sentence a READER sees on the three pages that promises keeping or
 * deleting something on a clock or on an event — plus every line of the
 * /privacy retention schedule — is claimed by one row of `PROMISES`, and every
 * row names its mechanism, which this test then finds in the code:
 *
 *   job     a periodic sweep: its key is in PERIODIC_JOBS and its body is in
 *           the named file;
 *   code    a code path that does it when a person acts (withdraw, disconnect,
 *           erasure, a cascade written in a migration);
 *   human   a person does it — named queue in the code, never "automatic";
 *   vendor  the provider does it under its own setting — named, never ours;
 *   kept    nothing is deleted, and the sentence must not claim otherwise.
 *
 * A new promise with no row fails. A row whose words left the page fails (a
 * stale table is how a mapping rots). A row whose file or symbol is gone fails.
 * So a sweep that is deleted takes its promise down with it.
 *
 * ── WHAT IT READS ───────────────────────────────────────────────────────────
 * The JSX text of each page's default export, parsed with TypeScript — not a
 * regex over the file — so a code comment explaining a rule never convicts the
 * page, and inline `<strong>not</strong>` is kept (dropping it would turn "is
 * not deleted" into "is deleted"). `{CONSTANT}` reads as "N".
 * OUT OF SCOPE, ON PURPOSE: the cookie table's lifetimes on /cookies. Those are
 * kept by the browser from each cookie's own max-age, not by a job of ours.
 *
 * MUTATION (run when this was written — see the PR): put "Support tickets are
 * deleted 2 years after the ticket closes." back on /privacy → fails as a
 * promise with no mechanism; rename `face-selfie-papic-close` in the registry →
 * fails on the 12-hour row; reword the face line → fails as a stale row.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { PERIODIC_JOB_KEYS } from './periodic-job-registry';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = {
  privacy: 'app/(shell)/privacy/page.tsx',
  terms: 'app/(shell)/terms/page.tsx',
  cookies: 'app/(shell)/cookies/page.tsx',
} as const;
type Page = keyof typeof PAGES;

// ── Reading the page the way a person does ──────────────────────────────────

const ENTITIES: Record<string, string> = {
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—',
  amp: '&', nbsp: ' ', sect: '§', rarr: '→', '#9889': '⚡',
};
/** Elements that start a new run of text — a sentence never spans two of them. */
const BLOCKS = new Set([
  'p', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'header', 'section', 'article',
  'main', 'div', 'Section', 'LegalSection', 'LegalLayout', 'CookieList',
]);

type Block = { text: string; schedule: boolean };

/** The reader-visible text of a page's default export, as blocks. */
export function readerBlocks(src: string, file: string): Block[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const blocks: Block[] = [];
  let buf = '';
  let schedule = 0; // depth inside <Section id="retention">
  const flush = () => {
    const text = buf.replace(/&([#\w]+);/g, (m, k: string) => ENTITIES[k] ?? m).replace(/\s+/g, ' ').trim();
    if (text) blocks.push({ text, schedule: schedule > 0 });
    buf = '';
  };
  const opening = (n: ts.JsxElement | ts.JsxSelfClosingElement) =>
    ts.isJsxElement(n) ? n.openingElement : n;
  const isSchedule = (n: ts.JsxElement | ts.JsxSelfClosingElement) =>
    opening(n).attributes.properties.some(
      (a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'id' && a.initializer?.getText(sf) === '"retention"',
    );
  const visit = (n: ts.Node): void => {
    if (ts.isJsxAttributes(n)) return;
    if (ts.isJsxText(n)) {
      buf += n.text;
      return;
    }
    if (ts.isJsxExpression(n)) {
      const e = n.expression;
      if (!e) return; // {/* a comment */}
      if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
        buf += e.text;
        return;
      }
      if (ts.isIdentifier(e) || ts.isPropertyAccessExpression(e)) {
        buf += ' N ';
        return;
      }
    }
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      const block = BLOCKS.has(opening(n).tagName.getText(sf));
      const sched = isSchedule(n);
      if (block) flush();
      if (sched) schedule++;
      ts.forEachChild(n, visit);
      if (block) flush();
      if (sched) schedule--;
      return;
    }
    ts.forEachChild(n, visit);
  };
  const fn = sf.statements.find(
    (s) => ts.isFunctionDeclaration(s) && s.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword),
  );
  assert.ok(fn, `${file}: no default-exported page function — the guard cannot read it`);
  visit(fn);
  flush();
  return blocks;
}

type Sentence = { text: string; schedule: boolean };

export function readerSentences(src: string, file: string): Sentence[] {
  return readerBlocks(src, file).flatMap((b) =>
    b.text
      .split(/(?<=[.!?;])\s+(?=[A-Z(“‘])/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text) => ({ text, schedule: b.schedule })),
  );
}

// ── What counts as a promise ────────────────────────────────────────────────

const KEEP_OR_DELETE =
  /\b(?:delet\w*|eras(?:e|ed|es|ing|ure)|purg\w*|prun\w*|remov\w*|blank\w*|expir\w*|kept|keep|keeps|retain\w*|retention|wip(?:e|ed|es))\b/i;
const ON_A_CLOCK_OR_AN_EVENT =
  /\b(?:N|\d+|one|two|three|six|ten|twelve)[\s-](?:business\s)?(?:hours?|days?|weeks?|months?|years?)\b|\bwithin\b|\bafter\b|\bautomatic\w*|\brolling\b|\btimer\b|\bnext day\b|\bstraight away\b|\bimmediately\b|\bat once\b|\bwhen\b|\bwith (?:the|your|its|their) (?:event|account|guest)\b|\buntil\b|\bfor life\b|\bwhile\b|\bweekly\b|\bdaily\b/i;

export function isPromise(s: Sentence): boolean {
  return s.schedule || (KEEP_OR_DELETE.test(s.text) && ON_A_CLOCK_OR_AN_EVENT.test(s.text));
}

// ── The mechanisms ──────────────────────────────────────────────────────────

/** A file under apps/web (or supabase/ via ../../) and a pattern its CODE must match. */
type Where = { file: string; has: RegExp };
type Mechanism =
  | { kind: 'job'; job: string; where: Where }
  | { kind: 'code'; where: Where }
  | { kind: 'human'; where: Where }
  | { kind: 'vendor'; who: string }
  | { kind: 'kept'; why: string };

type Promise_ = { page: Page; quote: string; m: Mechanism };

const ERASURE: Where = { file: 'lib/erasure/purge.ts', has: /export async function eraseUserAccount\b/ };
const DELETION_QUEUE: Where = { file: 'app/admin/account-deletions/actions.ts', has: /export async function approveAndDelete\b/ };
const VISITS_SQL: Where = {
  file: '../../supabase/migrations/20271282829207_site_visits_daily.sql',
  has: /delete from public\.site_visit_salts where day < /i,
};
const GIFTS_CASCADE: Where = {
  file: '../../supabase/migrations/20271266228704_the_wish_list_two_tables.sql',
  has: /create table[^;]*event_gift_records[\s\S]*?event_id[^,]*references public\.events[^,]*on delete cascade/i,
};

/* Each `quote` is a piece of ONE sentence as the reader sees it. Keep them short. */
const PROMISES: readonly Promise_[] = [
  // ── /privacy · Apple sign-in, visits, device identifier ──
  { page: 'privacy', quote: 'used only to cancel the Apple link when you delete your account', m: { kind: 'code', where: { file: 'lib/erasure/purge.ts', has: /apple_sign_in_revoked/ } } },
  { page: 'privacy', quote: 'We do keep one daily count of visits', m: { kind: 'kept', why: 'site_visit_days holds only daily totals; nothing per person — see the visits rows below.' } },
  { page: 'privacy', quote: 'That day’s code and that day’s random value are deleted the next day', m: { kind: 'code', where: VISITS_SQL } },
  { page: 'privacy', quote: 'What we keep is only the daily totals', m: { kind: 'kept', why: 'site_visit_days is the only table kept; it has no per-person column.' } },
  { page: 'privacy', quote: 'It is not deleted when you delete your account', m: { kind: 'kept', why: 'user_devices is a DELIBERATE_EXCLUSION of erasure (lib/erasure/coverage-guardrail.test.ts), pending the DPO device review.' } },
  { page: 'privacy', quote: 'Nothing deletes it on a timer yet; how long we keep it', m: { kind: 'kept', why: 'No job prunes user_devices — the 24-month promise was withdrawn for that reason.' } },
  // ── /privacy · face data ──
  { page: 'privacy', quote: 'Your selfie and your face vector are erased 12 hours after the event ends', m: { kind: 'job', job: 'face-selfie-papic-close', where: { file: 'lib/face-selfie-erase.ts', has: /runClaimedJob\(\s*'face-selfie-papic-close'/ } } },
  { page: 'privacy', quote: 'erased 12 hours after the event ends (sooner if you sign out), and a weekly check deletes anything left 3 months after the event ends', m: { kind: 'job', job: 'face-data-retention', where: { file: 'lib/face-data-retention.ts', has: /runClaimedJob\(\s*'face-data-retention'/ } } },
  { page: 'privacy', quote: 'withdrawing your consent or asking us to remove it deletes it immediately', m: { kind: 'code', where: { file: 'app/[slug]/actions.ts', has: /eraseGuestFaceData/ } } },
  { page: 'privacy', quote: 'let you remove them at any time', m: { kind: 'code', where: { file: 'app/dashboard/(account)/profile/actions.ts', has: /export async function/ } } },
  // ── /privacy · connection tree, gifts, groups ──
  { page: 'privacy', quote: 'are both deleted after N days', m: { kind: 'job', job: 'connection-request-expiry', where: { file: 'lib/connection-request-expiry.ts', has: /expire_stale_connection_requests/ } } },
  { page: 'privacy', quote: 'they are deleted with your event', m: { kind: 'code', where: { file: '../../supabase/migrations/20270725802892_event_egift_methods.sql', has: /event_id\s+UUID NOT NULL REFERENCES public\.events\(event_id\) ON DELETE CASCADE/ } } },
  { page: 'privacy', quote: 'every record and screenshot is deleted with the event', m: { kind: 'code', where: GIFTS_CASCADE } },
  { page: 'privacy', quote: 'are removed when you leave a group or delete your account', m: { kind: 'code', where: ERASURE } },
  { page: 'privacy', quote: 'We have kept this feature deliberately narrow', m: { kind: 'job', job: 'connection-request-expiry', where: { file: 'lib/connection-request-expiry.ts', has: /expire_stale_connection_requests/ } } },
  // ── /privacy · photos, calls ──
  { page: 'privacy', quote: 'we remove its EXIF/GPS metadata first', m: { kind: 'kept', why: 'Not a retention clock — the strip on every outbound copy, guarded by the photo-share tests.' } },
  { page: 'privacy', quote: 'We keep only the fact that a call took place', m: { kind: 'kept', why: 'Call metadata only; no media is stored, so there is nothing to delete.' } },
  // ── /privacy · Deep Search ──
  { page: 'privacy', quote: 'delete it on a rolling 180-day basis', m: { kind: 'job', job: 'vendor-dossier-retention', where: { file: 'lib/vendor-dossier-retention.ts', has: /runClaimedJob\(\s*'vendor-dossier-retention'/ } } },
  { page: 'privacy', quote: 'the same rolling 180-day deletion described above', m: { kind: 'job', job: 'vendor-dossier-retention', where: { file: 'lib/vendor-dossier-retention.ts', has: /DOSSIER_RETENTION_DAYS/ } } },
  // ── /privacy · anti-fraud, public summary ──
  { page: 'privacy', quote: 'no data is deleted, and one review by our team reverses it', m: { kind: 'kept', why: 'An auto-hide is reversible and deletes nothing.' } },
  { page: 'privacy', quote: 'Permanent action (removing a vendor’s reviews', m: { kind: 'human', where: { file: 'app/admin/fraud/actions.ts', has: /pending a second admin/ } } },
  { page: 'privacy', quote: 'or keep it private', m: { kind: 'kept', why: 'Quoted reminder-email copy, not a retention promise.' } },
  { page: 'privacy', quote: 'removes the page from the index immediately', m: { kind: 'code', where: { file: 'app/dashboard/[eventId]/website/privacy/actions.ts', has: /export async function updateLandingPageVisibility\b/ } } },
  // ── /privacy · THE RETENTION SCHEDULE (every line is a promise) ──
  { page: 'privacy', quote: 'the full-resolution originals are kept for 6 months', m: { kind: 'job', job: 'papic-fullres-drop', where: { file: 'lib/papic-fullres-drop.ts', has: /runClaimedJob\(\s*'papic-fullres-drop'/ } } },
  { page: 'privacy', quote: 'That compressed copy of your Memories stays online, free, for life', m: { kind: 'kept', why: 'No job deletes the compressed copy (retention-copy-is-true.test.ts).' } },
  { page: 'privacy', quote: 'If you connect Google Drive, every original is also saved', m: { kind: 'kept', why: 'The Drive copy is the couple’s; we never delete it.' } },
  { page: 'privacy', quote: 'Face-recognition data — for the one event only', m: { kind: 'kept', why: 'Heading of the face line; its clocks are the next rows.' } },
  { page: 'privacy', quote: 'You can end it sooner at any time', m: { kind: 'code', where: { file: 'app/[slug]/actions.ts', has: /eraseGuestFaceData/ } } },
  { page: 'privacy', quote: 'Deleting it takes away no photo and no tag', m: { kind: 'kept', why: 'face-selfie-keeps-tags.test.ts holds it.' } },
  { page: 'privacy', quote: 'Messages between a couple and a vendor — 5 years after the event date', m: { kind: 'job', job: 'retention-sweep', where: { file: 'lib/retention-sweep.ts', has: /RETENTION_YEARS\s*=\s*5\b/ } } },
  { page: 'privacy', quote: 'Payments, receipts and official receipts — 10 years', m: { kind: 'kept', why: 'BIR floor: kept, never deleted early; nothing deletes them at 10 years either, and the page no longer says it does.' } },
  { page: 'privacy', quote: 'This one is a legal floor under BIR rules', m: { kind: 'kept', why: 'See the row above.' } },
  { page: 'privacy', quote: 'Contracts and e-signatures — 10 years', m: { kind: 'kept', why: 'Civil Code prescription; kept, no deletion promised.' } },
  { page: 'privacy', quote: 'Your account and profile — for as long as the account is open', m: { kind: 'kept', why: 'Kept while open; the deletion rows follow.' } },
  { page: 'privacy', quote: 'our team reviews the request within 24 hours', m: { kind: 'human', where: DELETION_QUEUE } },
  { page: 'privacy', quote: 'your name, email, phone and photo are blanked out straight away', m: { kind: 'code', where: { file: 'lib/erasure/coverage.ts', has: /USERS_ANONYMIZE_NULLS/ } } },
  { page: 'privacy', quote: 'There is no waiting period after that', m: { kind: 'kept', why: 'eraseUserAccount runs inside approveAndDelete — no grace timer exists.' } },
  { page: 'privacy', quote: 'Support messages — kept while your account is open', m: { kind: 'kept', why: 'No job deletes help_messages — the 2-year promise was withdrawn for that reason.' } },
  { page: 'privacy', quote: 'the words of your messages are blanked out', m: { kind: 'code', where: { file: 'lib/erasure/purge.ts', has: /'help-messages-anonymize'/ } } },
  { page: 'privacy', quote: 'Error reports — kept by Sentry', m: { kind: 'vendor', who: 'Sentry project data-retention setting (ERROR_LOG_RETENTION_DAYS documents it; no job of ours).' } },
  { page: 'privacy', quote: 'We run no deletion of our own for them', m: { kind: 'kept', why: 'True by absence; see the Sentry row.' } },
  { page: 'privacy', quote: 'The fraud-prevention device identifier — kept, and not deleted', m: { kind: 'kept', why: 'See the device rows above.' } },
  { page: 'privacy', quote: 'Nothing deletes it on a timer yet.', m: { kind: 'kept', why: 'See the device rows above.' } },
  { page: 'privacy', quote: 'Gift records (Pabuya) — until the event is deleted', m: { kind: 'code', where: GIFTS_CASCADE } },
  { page: 'privacy', quote: 'Daily visit codes — deleted the next day', m: { kind: 'code', where: VISITS_SQL } },
  { page: 'privacy', quote: 'our database provider keeps a daily backup for N days', m: { kind: 'vendor', who: 'Supabase daily physical backups, 7-day retention (owner screenshot 2026-10-23, Breach Policy § 3.1).' } },
  { page: 'privacy', quote: 'Something deleted from Setnayan can stay in a backup until that backup ages out', m: { kind: 'vendor', who: 'Supabase backup retention, as above.' } },
  { page: 'privacy', quote: 'Photos and files are not in these backups', m: { kind: 'kept', why: 'Supabase backups exclude storage; media lives on R2, which no backup covers (Breach Policy § 7.3).' } },
  { page: 'privacy', quote: 'Where you can end something sooner, you can', m: { kind: 'code', where: DELETION_QUEUE } },
  { page: 'privacy', quote: 'The two 10-year items are the exception', m: { kind: 'kept', why: 'Legal floors.' } },
  { page: 'privacy', quote: 'Different kinds of data have different lifespans', m: { kind: 'kept', why: 'The schedule’s own introduction.' } },
  { page: 'privacy', quote: 'This is the whole schedule.', m: { kind: 'kept', why: 'The schedule’s own introduction.' } },
  // ── /privacy · your rights ──
  { page: 'privacy', quote: 'your personal details are blanked out straight away — except records', m: { kind: 'code', where: ERASURE } },
  { page: 'privacy', quote: 'One thing is not yet automatic: the copy of your Google or Apple sign-in details', m: { kind: 'human', where: { file: 'lib/erasure/coverage-guardrail.test.ts', has: /'auth\.identities':/ } } },
  // ── /privacy · TikTok, YouTube, Drive ──
  { page: 'privacy', quote: 'Grants are kept until you revoke them — from your Setnayan profile or from TikTok', m: { kind: 'code', where: { file: 'app/dashboard/[eventId]/studio/patiktok/actions.ts', has: /revoked_at/ } } },
  { page: 'privacy', quote: 'We do not delete connections on a timer', m: { kind: 'kept', why: 'True by absence — no job deletes OAuth grants; disconnect erases the keys (rows above and below).' } },
  { page: 'privacy', quote: 'Setnayan cannot delete posts on your behalf', m: { kind: 'kept', why: 'Restraint — we hold no delete scope on TikTok.' } },
  { page: 'privacy', quote: 'Until you disconnect it, until you delete your Setnayan account', m: { kind: 'code', where: { file: 'app/api/oauth/youtube/disconnect/route.ts', has: /revoked_at/ } } },
  { page: 'privacy', quote: 'We keep the connection alive in the background', m: { kind: 'kept', why: 'Refresh only (oauth-refresh); no deletion.' } },
  { page: 'privacy', quote: 'We do not currently delete the connection on an automatic timer', m: { kind: 'kept', why: 'True by absence — no job deletes OAuth grants.' } },
  { page: 'privacy', quote: 'we will do so within 30 days', m: { kind: 'human', where: { file: 'app/api/oauth/youtube/disconnect/route.ts', has: /revoked_at/ } } },
  { page: 'privacy', quote: 'Setnayan never deletes anything on YouTube automatically', m: { kind: 'kept', why: 'Restraint.' } },
  { page: 'privacy', quote: 'Grants are kept until you revoke them — from your Google account', m: { kind: 'code', where: { file: 'app/dashboard/[eventId]/studio/photo-delivery/actions.ts', has: /revoked_at/ } } },
  { page: 'privacy', quote: 'are not deleted by Setnayan when the grant ends', m: { kind: 'kept', why: 'drive.file writes are the couple’s; nothing of ours deletes them.' } },
  { page: 'privacy', quote: 'Setnayan cannot delete files on your behalf', m: { kind: 'kept', why: 'Restraint after revocation.' } },
  // ── /terms ──
  { page: 'terms', quote: 'A deletion request is reviewed within 24 hours', m: { kind: 'human', where: DELETION_QUEUE } },
  { page: 'terms', quote: 'except for daily database backups, which age out within N days', m: { kind: 'vendor', who: 'Supabase daily physical backups, 7-day retention (owner screenshot 2026-10-23, Breach Policy § 3.1).' } },
  // ── /cookies ──
  { page: 'cookies', quote: 'That code and that day’s random value are deleted the next day', m: { kind: 'code', where: VISITS_SQL } },
  { page: 'cookies', quote: 'Only the daily totals are kept', m: { kind: 'kept', why: 'site_visit_days only.' } },
];

// ── The checks ──────────────────────────────────────────────────────────────

const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
/** Comment-stripped (the shared stripper), so a pattern is matched against CODE, never a note about it. */
const code = (rel: string) => stripComments(read(rel));

const sentencesOf = (p: Page) => readerSentences(read(PAGES[p]), PAGES[p]);

test('the reader keeps inline words and constants — "is not deleted" never reads as "is deleted"', () => {
  const s = readerSentences(
    `export default function P() { return (<p>It is <strong>not</strong> deleted after{' '}<strong>{DAYS} days</strong>.</p>); }`,
    'x.tsx',
  );
  assert.deepEqual(s.map((x) => x.text), ['It is not deleted after N days.']);
});

test('the detector catches the promises that shipped false, and leaves plain sentences alone', () => {
  for (const bad of [
    'When you close it, a short 30–90 day tail, then permanent deletion.',
    'Soft-deleted accounts are retained for 30 days before permanent removal.',
    'Support tickets — kept 2 years after the ticket closes.',
    'Device records unused for more than 24 months are pruned.',
    'The hash is pseudonymous, included in your data export, and deleted when you delete your account.',
  ]) {
    assert.ok(isPromise({ text: bad, schedule: false }), bad);
  }
  for (const ok of ['We respond within 15 business days.', 'You can use Setnayan with an email address.']) {
    assert.ok(!isPromise({ text: ok, schedule: false }), ok);
  }
});

test('every keep-or-delete promise on the three pages is claimed by a row', () => {
  const orphans: string[] = [];
  let seen = 0;
  for (const p of Object.keys(PAGES) as Page[]) {
    const rows = PROMISES.filter((r) => r.page === p);
    for (const s of sentencesOf(p)) {
      if (!isPromise(s)) continue;
      seen++;
      if (!rows.some((r) => s.text.includes(r.quote))) orphans.push(`${PAGES[p]}: "${s.text}"`);
    }
  }
  // A reader that reads nothing finds no orphans. Measured 2026-10-23: 66.
  assert.ok(seen >= 50, `only ${seen} promises were read — the reader is broken, so this proves nothing`);
  assert.deepEqual(
    orphans,
    [],
    'a promise to keep or delete something with no mechanism behind it. Find the job, code path or ' +
      'queue that does it and add a row to PROMISES — or, if nothing does it, reword the page to what ' +
      'is true. Never add a row that points at nothing:\n  ' +
      orphans.join('\n  '),
  );
});

test('every row still stands on its page — a stale table is how the mapping rots', () => {
  const stale = PROMISES.filter((r) => {
    const hits = sentencesOf(r.page).filter((s) => s.text.includes(r.quote));
    return hits.length === 0;
  }).map((r) => `${r.page}: "${r.quote}"`);
  assert.deepEqual(stale, [], `rows whose words are no longer on the page:\n  ${stale.join('\n  ')}`);
});

test('every mechanism a row names exists in the code', () => {
  const missing: string[] = [];
  for (const r of PROMISES) {
    const m = r.m;
    if (m.kind === 'job' && !PERIODIC_JOB_KEYS.includes(m.job)) missing.push(`"${r.quote}": job '${m.job}' is not in PERIODIC_JOBS`);
    if (m.kind === 'job' || m.kind === 'code' || m.kind === 'human') {
      if (!existsSync(join(WEB, m.where.file))) missing.push(`"${r.quote}": ${m.where.file} does not exist`);
      else if (!m.where.has.test(code(m.where.file))) missing.push(`"${r.quote}": ${m.where.file} no longer matches ${m.where.has}`);
    }
  }
  assert.deepEqual(missing, [], missing.join('\n'));
});

test('a "kept" or "human" row never hides an automatic deletion', () => {
  const lies: string[] = [];
  for (const r of PROMISES) {
    const s = sentencesOf(r.page).find((x) => x.text.includes(r.quote))?.text ?? '';
    // A "kept" sentence may say what is NOT deleted, never that something IS.
    if (
      r.m.kind === 'kept' &&
      /\b(?:is|are|gets?) (?:deleted|erased|purged|pruned)\b/i.test(s) &&
      !/\b(?:not|no [a-z]+ (?:is|are)) (?:deleted|erased)\b/i.test(s)
    ) {
      lies.push(`kept, but says it is deleted: "${s}"`);
    }
    // A person is not a sweep.
    if (r.m.kind === 'human' && /\b(?:automatically|on a timer|rolling|weekly check)\b/i.test(s) && !/\bnot yet automatic\b/i.test(s)) {
      lies.push(`a person does it, but the page says a machine does: "${s}"`);
    }
  }
  assert.deepEqual(lies, [], lies.join('\n'));
});

test('the withdrawn promises stay withdrawn', () => {
  const text = (p: Page) => sentencesOf(p).map((s) => s.text).join(' ');
  const all = `${text('privacy')} ${text('terms')} ${text('cookies')}`;
  for (const [re, why] of [
    [/30\s*[–-]\s*90 day/i, 'no deletion tail exists — erasure blanks the person at once'],
    [/retained for 30 days before permanent removal/i, 'no soft-delete timer exists'],
    [/2 years after the ticket closes/i, 'no job deletes support messages'],
    [/unused for more than 24 months are pruned/i, 'no job prunes device records'],
    [/included in your data export, and deleted when you delete your account/i, 'user_devices is neither exported nor erased'],
  ] as const) {
    assert.doesNotMatch(all, re, why);
  }
});
