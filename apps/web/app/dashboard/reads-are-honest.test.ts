/**
 * reads-are-honest.test.ts — a couple's screen may not state an absence it did
 * not measure.
 *
 * ── The defect, in one sentence ────────────────────────────────────────────
 * Supabase RESOLVES with `{ error }` instead of throwing. So a refused read — a
 * phantom column, a stale enum value, an unapplied migration, a missing grant —
 * arrives as `data: null`, `?? []` turns it into an empty list, and the screen
 * states an absence nobody measured. On the couple's side that sentence is read
 * by two people planning the biggest day they will pay for:
 *
 *   unlisted guests ... "Nobody to review right now." → while people wait to be
 *                        kept or removed, and never are
 *   add categories ..... every category offered again → and Add here SENDS A
 *                        SUPPLIER AN INQUIRY, so the refusal costs a message
 *   invitation ......... "Your optional sections will appear here." → about a
 *                        page that is live, complete, and has all twelve rows
 *   package booking .... a receipt with a price and not one line on it
 *   save-the-date ...... "0 total · 0 last 7 days · 0 today"
 *   Studio ............. a coordinator's suggestion never reaches the couple,
 *                        and the coordinator is invited to send it again
 *
 * ── Why this guard exists at all ───────────────────────────────────────────
 * The same class was closed in the supplier tree (`app/vendor-dashboard/
 * reads-are-honest.test.ts`, 31 reads / 16 files) and in the explore/tour/papic
 * sweep — and that second one shipped WITHOUT a per-tree guard, which is why
 * the class walked straight back into this tree. A fix without a guard is a
 * fix with an expiry date.
 *
 * ── What is exempt, and by SHAPE rather than by file ───────────────────────
 * ⚠ A GUARD THAT EXEMPTS BY *FILE* EXEMPTS THE CODE IT POLICES. So nothing here
 * is exempt for being in a particular file. Two shapes are exempt:
 *
 *   1. `const { data: { user } } = await supabase.auth.getUser()` — the session
 *      read. It has no `{ error }` half worth branching on and every caller
 *      already redirects when `user` is absent.
 *   2. A read whose absence IMMEDIATELY DENIES the whole surface —
 *      `if (!membership) redirect(…)`, `if (!event) notFound()`. There the
 *      absence refuses rather than states, and failing closed IS the fix.
 *      Pulling those in would make this guard cry wolf on ~42 correct call
 *      sites, and a guard that cries wolf teaches you to skim past the one time
 *      it is right.
 *
 * `actions.ts` / `*-actions.ts` / `_actions/` are out of scope for the same
 * reason as (2): there an absence denies (`if (!row) return { error }`).
 *
 * ── The baseline is a BILL, not a decision ────────────────────────────────
 * Every line in KNOWN_UNBOUND is a place a couple can still be told something
 * that was never measured. It is keyed by file + variable + COUNT so a moved
 * line cannot rot it, and it is checked in BOTH directions: a new offender
 * fails, and so does a fixed one whose line was left behind. The list only ever
 * gets shorter. Do not add to it to make this test pass.
 *
 * 🛡 Mutation-checked by occurrence count, before → after, each rule proved RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, '..', '..');

/** Comments blanked, newlines preserved, so a reported line is the real line. */
const blank = (s: string): string => s.replace(/[^\n]/g, ' ');
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^([ \t]*)\/\/.*$/gm, (m) => blank(m));

/**
 * THE SUBJECT LIST IS DERIVED FROM THE TREE, NEVER HAND-ENUMERATED. A hand
 * written list is a list of the files somebody thought of; a new screen added
 * tomorrow has to be covered without anybody remembering this file exists.
 */
function renderFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      if (entry === '_actions' || entry === 'node_modules') continue;
      renderFiles(abs, acc);
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (/\.test\.tsx?$/.test(entry)) continue;
    if (/^actions\.ts$/.test(entry) || /-actions\.ts$/.test(entry)) continue;
    acc.push(relative(WEB_ROOT, abs));
  }
  return acc;
}

const AUTH_DESTRUCTURE = /const\s*\{\s*\n?\s*data:\s*\{\s*user\s*\}/;

/** Reads whose absence refuses the surface outright — see exemption (2). */
const deniesOutright = (after: string, name: string): boolean => {
  const esc = name.replace(/\$/g, '\\$');
  return new RegExp(
    `if\\s*\\(\\s*!${esc}\\b[^)]*\\)\\s*(\\{[^}]*)?` +
      `(notFound\\(\\)|redirect\\(|return null|return new NextResponse|return NextResponse|throw )`,
  ).test(after);
};

type Offender = { file: string; line: number; name: string };

function unboundReads(): Offender[] {
  const found: Offender[] = [];
  for (const file of renderFiles(HERE)) {
    const src = stripComments(readFileSync(join(WEB_ROOT, file), 'utf8'));
    for (const m of src.matchAll(/const\s*\{([^}]*\bdata\b[^}]*)\}\s*=\s*await/g)) {
      if (AUTH_DESTRUCTURE.test(m[0])) continue;
      if (/\berror\b/.test(m[0])) continue;
      const named = /data\s*:\s*([A-Za-z0-9_$]+)/.exec(m[1] ?? '');
      const name = named?.[1] ?? 'data';
      const at = m.index ?? 0;
      const after = src.slice(at, at + 2500);
      if (deniesOutright(after, name)) continue;
      found.push({ file, line: src.slice(0, at).split('\n').length, name });
    }
  }
  return found;
}

/**
 * THE BILL. `<file>::<variable>` → how many unbound reads of that name are
 * still there. Shrink it; never grow it.
 */
const KNOWN_UNBOUND: Record<string, number> = {
  'app/dashboard/(account)/create-event/wedding-guard.ts::data': 1,
  'app/dashboard/(account)/library/_data/attended-vendors.ts::rows': 1,
  'app/dashboard/(account)/library/_data/editorials.ts::data': 4,
  'app/dashboard/(account)/library/_data/photos-albums.ts::member': 1,
  'app/dashboard/(account)/library/_data/photos-albums.ts::slugRows': 1,
  'app/dashboard/(account)/library/_data/saved-vendors.ts::profileData': 1,
  'app/dashboard/(account)/library/_data/saved-vendors.ts::statsData': 1,
  'app/dashboard/(account)/people/life-stories.ts::data': 1,
  'app/dashboard/(account)/profile/concierge/page.tsx::eventDetail': 1,
  'app/dashboard/(account)/profile/page.tsx::consentEvents': 1,
  'app/dashboard/(account)/profile/page.tsx::faceProfile': 1,
  'app/dashboard/(account)/profile/page.tsx::shareConsentRows': 1,
  'app/dashboard/(launcher)/_components/creator-benefits.tsx::data': 1,
  'app/dashboard/[eventId]/checklist/page.tsx::data': 1,
  'app/dashboard/[eventId]/checklist/page.tsx::eventRow': 1,
  'app/dashboard/[eventId]/clearance/page.tsx::event': 1,
  'app/dashboard/[eventId]/clearance/page.tsx::membership': 1,
  'app/dashboard/[eventId]/galleries/page.tsx::membership': 1,
  'app/dashboard/[eventId]/launch/page.tsx::membership': 1,
  'app/dashboard/[eventId]/live/page.tsx::membership': 1,
  'app/dashboard/[eventId]/messages/[threadId]/page.tsx::eventRow': 1,
  'app/dashboard/[eventId]/messages/[threadId]/page.tsx::vendor': 1,
  'app/dashboard/[eventId]/messages/page.tsx::vendor': 1,
  'app/dashboard/[eventId]/pabuya/page.tsx::eventRow': 1,
  'app/dashboard/[eventId]/page.tsx::data': 1,
  'app/dashboard/[eventId]/page.tsx::papicViewerMembership': 1,
  'app/dashboard/[eventId]/schedule/_components/emcee-picks.tsx::booked': 1,
  'app/dashboard/[eventId]/schedule/_components/emcee-picks.tsx::profiles': 1,
  'app/dashboard/[eventId]/seating/lab/_components/couple-3d-plan-unlock-notice.tsx::vendor': 1,
  'app/dashboard/[eventId]/sponsors/page.tsx::legacy': 1,
  'app/dashboard/[eventId]/sponsors/page.tsx::modCheck': 1,
  'app/dashboard/[eventId]/studio/[addon]/page.tsx::me': 1,
  'app/dashboard/[eventId]/studio/mood-board/concept-pdf/route.ts::inspoRows': 1,
  'app/dashboard/[eventId]/studio/page.tsx::membership': 1,
  'app/dashboard/[eventId]/studio/page.tsx::moderator': 1,
  'app/dashboard/[eventId]/studio/pakanta/page.tsx::draft': 1,
  'app/dashboard/[eventId]/studio/panood/setup/page.tsx::grantRaw': 1,
  'app/dashboard/[eventId]/studio/papic/_components/vendor-media-controls.tsx::captureRows': 1,
  'app/dashboard/[eventId]/studio/papic/crew/poster/page.tsx::event': 1,
  'app/dashboard/[eventId]/studio/papic/crew/poster/page.tsx::joinTokenRow': 1,
  'app/dashboard/[eventId]/studio/papic/moderation/_components/kwento-queue.tsx::guests': 1,
  'app/dashboard/[eventId]/studio/papic/moderation/_components/kwento-queue.tsx::messages': 1,
  'app/dashboard/[eventId]/studio/papic/recap/page.tsx::recapDriveGrant': 1,
  'app/dashboard/[eventId]/studio/papic/vendor-challenges-approval.tsx::data': 1,
  'app/dashboard/[eventId]/studio/patiktok/[templateId]/page.tsx::event': 1,
  'app/dashboard/[eventId]/studio/patiktok/[templateId]/page.tsx::tracksRaw': 1,
  'app/dashboard/[eventId]/studio/patiktok/booth/page.tsx::event': 1,
  'app/dashboard/[eventId]/studio/patiktok/booth/page.tsx::tableRows': 1,
  'app/dashboard/[eventId]/studio/photo-delivery/page.tsx::driveGrant': 1,
  'app/dashboard/[eventId]/studio/photo-delivery/page.tsx::event': 1,
  'app/dashboard/[eventId]/studio/photo-delivery/page.tsx::latestJob': 1,
  'app/dashboard/[eventId]/studio/save-the-date/page.tsx::event': 1,
  'app/dashboard/[eventId]/studio/save-the-date/stamp/page.tsx::event': 1,
  'app/dashboard/[eventId]/vendors/[vendorId]/review/page.tsx::ev': 1,
  'app/dashboard/[eventId]/vendors/[vendorId]/review/page.tsx::evtRow': 1,
  'app/dashboard/[eventId]/vendors/[vendorId]/review/page.tsx::recRow': 1,
  'app/dashboard/[eventId]/vendors/[vendorId]/review/page.tsx::vp': 2,
  'app/dashboard/[eventId]/vendors/packages/[bookingId]/page.tsx::vendor': 1,
  'app/dashboard/[eventId]/vendors/page.tsx::data': 3,
  'app/dashboard/[eventId]/website/editorial/page.tsx::ed': 1,
  'app/dashboard/[eventId]/website/editorial/page.tsx::me': 1,
  'app/dashboard/[eventId]/website/privacy/page.tsx::me': 1,
  'app/dashboard/[eventId]/website/widgets/page.tsx::previewGuest': 1,
};

test('the couple tree is big enough that an empty sweep cannot pass', () => {
  // FLOOR. A sweep that silently matches nothing looks exactly like a clean
  // result — the failure mode that let a 36-target audit report on zero.
  const files = renderFiles(HERE);
  assert.ok(
    files.length >= 400,
    `Only ${files.length} files scanned under app/dashboard. This guard derives ` +
      'its subject list from the tree; a collapse to near-zero means the walk ' +
      'broke, not that the tree is clean.',
  );
});

test('every read that STATES an absence binds the error it may be refused with', () => {
  const counts = new Map<string, number>();
  const where = new Map<string, string[]>();
  for (const o of unboundReads()) {
    const key = `${o.file}::${o.name}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    where.set(key, [...(where.get(key) ?? []), `${o.file}:${o.line}`]);
  }

  const fresh: string[] = [];
  for (const [key, n] of counts) {
    const allowed = KNOWN_UNBOUND[key] ?? 0;
    if (n > allowed) fresh.push(`${key} → ${n} unbound, ${allowed} on the bill (${where.get(key)?.join(', ')})`);
  }
  assert.deepEqual(
    fresh,
    [],
    'A read here can be REFUSED, and an unbound error means the refusal arrives ' +
      'as `data: null` and renders as "you have none". Bind it, log it with ' +
      'logQueryError(…, "graceful_degrade"), and where the absence changes what ' +
      `the screen states, say so on screen. New: ${fresh.join(' · ')}`,
  );

  // THE OTHER DIRECTION. A bill line left behind after the fix is how a
  // baseline rots into permission.
  const stale: string[] = [];
  for (const [key, allowed] of Object.entries(KNOWN_UNBOUND)) {
    const n = counts.get(key) ?? 0;
    if (n < allowed) stale.push(`${key} → ${n} left, bill still says ${allowed}`);
  }
  assert.deepEqual(
    stale,
    [],
    `Fixed — now delete (or lower) these lines in KNOWN_UNBOUND: ${stale.join(' · ')}`,
  );
});

/**
 * POSITIVE CONTROL. Rule 2 can be satisfied by binding an error and throwing it
 * away; logging never changed a single pixel. These are the surfaces where the
 * empty state is a CLAIM about the couple's own event, so each must gate that
 * claim on whether the read actually happened AND say so to the person reading.
 */
const MUST_GATE: Array<[file: string, why: string]> = [
  ['[eventId]/guests/claims/page.tsx', '"Nobody to review right now."'],
  ['[eventId]/vendors/categories/page.tsx', 'offers categories they already have'],
  ['[eventId]/website/widgets/page.tsx', '"Your optional sections will appear here."'],
  ['[eventId]/vendors/packages/[bookingId]/page.tsx', 'a receipt with no lines'],
  ['[eventId]/studio/save-the-date/page.tsx', '"0 total · 0 last 7 days · 0 today"'],
  ['[eventId]/studio/page.tsx', 'a suggestion that never arrives'],
];

test('the screens that state an absence carry a measured flag AND say so on screen', () => {
  const missing: string[] = [];
  for (const [rel, why] of MUST_GATE) {
    const src = stripComments(readFileSync(join(HERE, rel), 'utf8'));
    const gated = /Measured\b/.test(src);
    const spoken = /We couldn/.test(src) || /couldn’t|couldn&rsquo;t/.test(src);
    if (!gated || !spoken) missing.push(`${rel} (${why}) — ${gated ? '' : 'no measured flag; '}${spoken ? '' : 'nothing said on screen'}`);
  }
  assert.deepEqual(
    missing,
    [],
    'Each of these states an absence somewhere. That claim must be gated on a ' +
      'measured flag AND the refusal must be visible to the person reading it. ' +
      `Missing: ${missing.join(' · ')}`,
  );
});

/**
 * The three worst individual claims, pinned by their arithmetic rather than by
 * a file-level word count — a count over a file cannot say WHICH half is still
 * right, which is how a lane-B assertion went green with the zero restored.
 */
test('a refused read never renders as a count of zero or an emptied money document', () => {
  const std = stripComments(
    readFileSync(join(HERE, '[eventId]/studio/save-the-date/page.tsx'), 'utf8'),
  );
  for (const half of ['total', 'last7', 'today'] as const) {
    assert.match(
      std,
      new RegExp(`stdViews \\? stdViews\\.${half}\\.toLocaleString\\(\\) : '—'`),
      `The save-the-date "${half}" figure must be an em-dash when the views were ` +
        'not read. "0" is a claim that nobody opened it.',
    );
  }

  const pkg = stripComments(
    readFileSync(join(HERE, '[eventId]/vendors/packages/[bookingId]/page.tsx'), 'utf8'),
  );
  assert.match(
    pkg,
    /itemsMeasured\s*=\s*!itemsError\s*&&\s*itemsRows\s*!==\s*null/,
    'The booking receipt must know whether its lines were read at all.',
  );

  const cats = stripComments(
    readFileSync(join(HERE, '[eventId]/vendors/categories/page.tsx'), 'utf8'),
  );
  assert.match(
    cats,
    /picksMeasured \? \(\s*<UnlockCategoriesList/,
    'Adding a category sends a supplier an inquiry. An unmeasured read must not ' +
      'be allowed to offer one — the list is held back, not lengthened.',
  );
});
