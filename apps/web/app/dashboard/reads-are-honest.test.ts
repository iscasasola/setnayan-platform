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

/**
 * 🔑 A GUARD IS ONLY AS WIDE AS THE SHAPES IT MATCHES, and the first cut of this
 * one knew exactly one: `const { data … }`. A COUNT is the same defect in a
 * different destructure — `const { count } = await …select(…, { count: 'exact',
 * head: true })` — and `count ?? 0` is the purest form of it, because the zero
 * it invents is indistinguishable from a real one. Found this way, after the
 * data sweep was already green: "0 cameras ready" on the Papic page, and a
 * daily render cap that could never fire because an unread count read as
 * "nothing rendered yet". A cap that fails open is not a cap.
 */
function unboundCounts(): Offender[] {
  const found: Offender[] = [];
  for (const file of renderFiles(HERE)) {
    const src = stripComments(readFileSync(join(WEB_ROOT, file), 'utf8'));
    for (const m of src.matchAll(/const\s*\{([^}]*\bcount\b[^}]*)\}\s*=\s*await/g)) {
      if (/\berror\b/.test(m[0])) continue;
      const named = /count\s*:\s*([A-Za-z0-9_$]+)/.exec(m[1] ?? '');
      const at = m.index ?? 0;
      found.push({
        file,
        line: src.slice(0, at).split('\n').length,
        name: named?.[1] ?? 'count',
      });
    }
  }
  return found;
}

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

/** The same bill, for counts. Same rules: shrink it, never grow it. */
const KNOWN_UNBOUND_COUNTS: Record<string, number> = {};

test('a count that could not be read never renders as a zero', () => {
  // FLOOR. An empty sweep looks exactly like a clean result — and this rule is
  // the one most likely to silently stop matching, because it depends on the
  // `{ count }` destructure staying the shape Supabase hands back. Measured
  // 2026-08-24: 10 count destructures in this tree's render files, all bound.
  const everyCount = renderFiles(HERE).reduce((n, file) => {
    const src = stripComments(readFileSync(join(WEB_ROOT, file), 'utf8'));
    return n + [...src.matchAll(/const\s*\{[^}]*\bcount\b[^}]*\}\s*=\s*await/g)].length;
  }, 0);
  assert.ok(
    everyCount >= 8,
    `Only ${everyCount} count reads seen in the whole tree. The scan has stopped ` +
      'matching — that is not the same as the tree being clean.',
  );

  const counts = new Map<string, number>();
  const where = new Map<string, string[]>();
  for (const o of unboundCounts()) {
    const key = `${o.file}::${o.name}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    where.set(key, [...(where.get(key) ?? []), `${o.file}:${o.line}`]);
  }
  const fresh: string[] = [];
  for (const [key, n] of counts) {
    const allowed = KNOWN_UNBOUND_COUNTS[key] ?? 0;
    if (n > allowed) fresh.push(`${key} → ${n} unbound (${where.get(key)?.join(', ')})`);
  }
  assert.deepEqual(
    fresh,
    [],
    'A refused count arrives as `count: null`, and `?? 0` turns it into a zero ' +
      'nobody measured — the one wrong answer that looks exactly like a right ' +
      `one. Bind the error. New: ${fresh.join(' · ')}`,
  );
  const stale: string[] = [];
  for (const [key, allowed] of Object.entries(KNOWN_UNBOUND_COUNTS)) {
    if ((counts.get(key) ?? 0) < allowed) stale.push(key);
  }
  assert.deepEqual(stale, [], `Fixed — delete these from KNOWN_UNBOUND_COUNTS: ${stale.join(' · ')}`);
});

/**
 * POSITIVE CONTROL. Rule 2 can be satisfied by binding an error and throwing it
 * away; logging never changed a single pixel. These are the surfaces where the
 * empty state is a CLAIM about the couple's own event, so each must gate that
 * claim on whether the read actually happened AND say so to the person reading.
 *
 * 🪤 THE FIRST DRAFT OF THIS TEST WAS DECORATIVE AND THE MUTATION RUN CAUGHT IT.
 * It asked only whether the word "Measured" appeared ANYWHERE in the file. The
 * unlisted-guests screen has TWO measured flags, so renaming one left the other
 * matching and the guard stayed GREEN with the claim ungated (measured: 2 → 1
 * occurrences, still passing). A COUNT OVER A FILE CANNOT SAY WHICH CLAIM IS
 * STILL GUARDED. Every gate is now named individually, exactly as it is written
 * at the point where the sentence is decided.
 */
const MUST_GATE: Array<{ file: string; why: string; gates: RegExp[] }> = [
  {
    file: '[eventId]/guests/claims/page.tsx',
    why: '"Nobody to review right now."',
    gates: [/\{!unlistedMeasured \? \(/, /\) : !candidatesMeasured \? \(/],
  },
  {
    file: '[eventId]/vendors/categories/page.tsx',
    why: 'offers categories they already have — and Add sends a supplier an inquiry',
    gates: [/\{picksMeasured \? \(/],
  },
  {
    file: '[eventId]/website/widgets/page.tsx',
    why: '"Your optional sections will appear here."',
    gates: [/\{!widgetsMeasured \? \(/, /widgetsMeasured\s*\n?\s*\? 'Your optional sections/],
  },
  {
    file: '[eventId]/vendors/packages/[bookingId]/page.tsx',
    why: 'a receipt with a price and no lines',
    gates: [/\{!itemsMeasured \? \(/],
  },
  {
    file: '[eventId]/studio/save-the-date/page.tsx',
    why: '"0 total · 0 last 7 days · 0 today"',
    gates: [/const stdViewsMeasured = !stdViewsError && stdViewRows !== null;/],
  },
  {
    file: '[eventId]/studio/page.tsx',
    why: 'a suggestion that never arrives, and a coordinator told to send it again',
    gates: [/\{!recsMeasured \|\| !vendorRecsMeasured \? \(/, /if \(!recsMeasured\) \{/],
  },
  {
    file: '[eventId]/studio/pakanta/page.tsx',
    why: 'a blank form that overwrites the answers they already saved',
    gates: [/const draftMeasured = !draftError;/, /\{!draftMeasured \? \(/],
  },
  {
    file: '[eventId]/website/editorial/page.tsx',
    why: 'their whole written story, blank — and saving replaces it',
    gates: [/draftMeasured = !edError;/, /\{!draftMeasured \? \(/],
  },
  {
    file: '[eventId]/studio/panood/setup/page.tsx',
    why: '"not connected" about a channel that is connected',
    gates: [/const grantMeasured = !grantError;/, /\) : !grantMeasured \? \(/],
  },
  {
    file: '[eventId]/studio/papic/moderation/_components/kwento-queue.tsx',
    why: 'an event where nobody wrote anything, while messages sit unreviewed',
    gates: [/if \(messagesError\) \{/],
  },
  {
    file: '[eventId]/studio/papic/vendor-challenges-approval.tsx',
    why: 'a supplier waiting on an okay that is never asked for',
    gates: [/if \(error\) \{/],
  },
  {
    file: '[eventId]/schedule/_components/emcee-picks.tsx',
    why: 'the host block removed from the schedule without a word',
    gates: [/if \(bookedError\) \{/, /if \(profilesError\) \{/, /function EmceePicksUnread\(\)/],
  },
];

test('the screens that state an absence carry a measured gate AND say so on screen', () => {
  const missing: string[] = [];
  for (const { file, why, gates } of MUST_GATE) {
    const src = stripComments(readFileSync(join(HERE, file), 'utf8'));
    for (const gate of gates) {
      if (!gate.test(src)) missing.push(`${file} (${why}) — gate gone: ${gate}`);
    }
    // The flag alone changes nothing a person can see.
    if (!/We couldn|couldn’t/.test(src)) missing.push(`${file} (${why}) — nothing said on screen`);
  }
  assert.deepEqual(
    missing,
    [],
    'Each of these states an absence somewhere. That claim must be gated on the ' +
      'read having happened AND the refusal must be visible to the person ' +
      `reading it. Missing: ${missing.join(' · ')}`,
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

  // THE MISSED HALF. `vendorRows` above it was already handled, and the comment
  // there refuses to claim "no supplier has taken photos" — the claim arrived
  // one read later anyway, through `captureRows`.
  const media = stripComments(
    readFileSync(join(HERE, '[eventId]/studio/papic/_components/vendor-media-controls.tsx'), 'utf8'),
  );
  assert.match(
    media,
    /if \(capturesError\) \{[\s\S]*?return null;/,
    'A refused captures read must not be filtered down into "no supplier has ' +
      'taken photos" — the read above it already refuses to make that claim.',
  );

  // A COUNT THAT IS ALSO A CAP. An unread count of today's renders used to read
  // as "nothing rendered yet", so the daily soft cap could never fire.
  const booth = stripComments(
    readFileSync(join(HERE, '[eventId]/studio/patiktok/booth/page.tsx'), 'utf8'),
  );
  assert.match(
    booth,
    /const submissionsMeasured = !submissionsCountError && submissionsCount !== null;/,
    'The booth must know whether it counted today’s renders at all — a cap that ' +
      'fails open is not a cap.',
  );
  assert.match(
    booth,
    /const faceEnabled = !faceEnrollCountError &&/,
    'An unread consent count must not read as "nobody consented"; the face ' +
      'pre-fill fails closed, but knowingly.',
  );

  const papic = stripComments(
    readFileSync(join(HERE, '[eventId]/studio/papic/page.tsx'), 'utf8'),
  );
  assert.match(
    papic,
    /guestCameraCount = guestCameraCountError \? null : count \?\? 0;/,
    '"0 cameras ready" to a couple whose guests all hold one. An unread count ' +
      'is not zero.',
  );
  assert.match(
    papic,
    /if \(guestCameraCount !== null && guestCameraCount !== expected\)/,
    'A write triggered by a read that failed is a write nobody asked for.',
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
