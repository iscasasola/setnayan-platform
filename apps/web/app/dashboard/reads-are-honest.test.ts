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
 * ── ⛔ WHAT THIS GUARD CANNOT CATCH — the third state, written down on purpose ─
 * The brief asks for three states to be told apart: **empty · could not be read ·
 * refused by permission.** The first two are here. The third is NOT, and it is
 * not an oversight — it is unreachable from this layer.
 *
 * A row withheld by RLS is not an error. PostgREST returns **200 with zero
 * rows**, `error` is null, and `count` is 0. A coordinator reading a
 * couple-scoped table and a couple with genuinely nothing get the SAME VALUE,
 * and no amount of error-binding can separate them. It has already cost this
 * product once: `4ba5ced17` — *"the home tile told coordinators '0 cameras out'
 * mid-shoot — an RLS silent-zero."*
 *
 * 🔑 So the only defence is at the CALL SITE, and it is a design question, not a
 * lint: **does this screen admit a role the read is not scoped to?** If yes, the
 * empty state must be phrased for that role, or the read must be widened, or the
 * screen must not offer the section at all. `studio/page.tsx` is the worked
 * example in the honest direction — its comment records that RLS returns no rows
 * to a coordinator and that this is what makes the strip couple-only.
 *
 * Do not add a rule here that guesses at policies. It would cry wolf on every
 * correct deliberate use of RLS-as-filter, and a guard that cries wolf teaches
 * you to skim past the one time it is right.
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
/**
 * ONE source for the count shape, used by BOTH the rule and its floor.
 * 🪤 THE FIRST DRAFT HAD TWO, AND THE MUTATION RUN CAUGHT IT: breaking the
 * scanner's regex left the floor's own copy still matching, so the sweep went
 * blind and the test stayed GREEN (measured: the sabotage landed, 0 failures).
 * A floor that measures a different thing from the rule it floors is not a
 * floor. Fresh RegExp per use — a /g literal carries lastIndex between calls.
 */
const COUNT_DESTRUCTURE = String.raw`const\s*\{([^}]*\bcount\b[^}]*)\}\s*=\s*await`;
const countMatches = (src: string) => [...src.matchAll(new RegExp(COUNT_DESTRUCTURE, 'g'))];

function unboundCounts(): Offender[] {
  const found: Offender[] = [];
  for (const file of renderFiles(HERE)) {
    const src = stripComments(readFileSync(join(WEB_ROOT, file), 'utf8'));
    for (const m of countMatches(src)) {
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

/**
 * 🔑 THE THIRD COSTUME, AND THE ONE THAT PROVES THE RULE. This guard shipped
 * knowing `const { data … }`, then grew to know `const { count … }` — and was
 * still blind to the shape that carries the MOST reads in this tree:
 *
 *   const [{ data: a }, { data: b }] = await Promise.all([ … ]);
 *
 * Seventy-two unbound reads in the couple tree sat inside one of these while
 * two passes of this file reported the tree clean. **A GUARD IS ONLY AS WIDE AS
 * THE SHAPES IT MATCHES**, and a parallel read is exactly where the PARTIAL
 * case lives: several sources composed into one screen, one refused, the
 * heading still claiming completeness.
 *
 * Fresh RegExp per use — a /g literal carries lastIndex between calls.
 */
const PARALLEL_DESTRUCTURE = String.raw`const\s*\[([\s\S]{0,900}?)\]\s*=\s*await`;
const parallelMatches = (src: string) => [
  ...src.matchAll(new RegExp(PARALLEL_DESTRUCTURE, 'g')),
];

/** Each `{ … }` element of a parallel read that names data/count. */
function parallelElements(src: string): Array<{ body: string; at: number }> {
  const out: Array<{ body: string; at: number }> = [];
  for (const m of parallelMatches(src)) {
    const head = m.index ?? 0;
    for (const el of (m[1] ?? '').matchAll(/\{([^}]*)\}/g)) {
      const body = el[1] ?? '';
      if (!/\bdata\b|\bcount\b/.test(body)) continue;
      if (/data:\s*\{\s*user\s*\}/.test(body)) continue;
      out.push({ body, at: head });
    }
  }
  return out;
}

/** The same bill, for parallel reads. */
const KNOWN_UNBOUND_PARALLEL: Record<string, number> = {
  // Outside the couple's event tree, like the sixteen on the bill above.
  'app/dashboard/(account)/profile/concierge/page.tsx::profile': 1,
};

test('a read inside a parallel batch binds its error too', () => {
  // FLOOR — this rule is worth nothing if the shape stops matching.
  // Measured 2026-08-24: 100+ such elements across this tree.
  const everyElement = renderFiles(HERE).reduce(
    (n, file) =>
      n + parallelElements(stripComments(readFileSync(join(WEB_ROOT, file), 'utf8'))).length,
    0,
  );
  assert.ok(
    everyElement >= 60,
    `Only ${everyElement} parallel-read elements seen. The scan has stopped ` +
      'matching — that is not the same as the tree being clean.',
  );

  const counts = new Map<string, number>();
  for (const file of renderFiles(HERE)) {
    const src = stripComments(readFileSync(join(WEB_ROOT, file), 'utf8'));
    for (const { body } of parallelElements(src)) {
      if (/\berror\b/.test(body)) continue;
      const named = /(?:data|count)\s*:\s*([A-Za-z0-9_$]+)/.exec(body);
      const key = `${file}::${named?.[1] ?? 'data'}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const fresh: string[] = [];
  for (const [key, n] of counts) {
    if (n > (KNOWN_UNBOUND_PARALLEL[key] ?? 0)) fresh.push(`${key} → ${n} unbound`);
  }
  assert.deepEqual(
    fresh,
    [],
    'A read run in parallel with others is still a read that can be refused — ' +
      'and it is the one that produces a HALF-BUILT screen that looks whole. ' +
      `Bind it. New: ${fresh.join(' · ')}`,
  );
  const stale = Object.entries(KNOWN_UNBOUND_PARALLEL)
    .filter(([k, allowed]) => (counts.get(k) ?? 0) < allowed)
    .map(([k]) => k);
  assert.deepEqual(stale, [], `Fixed — delete from KNOWN_UNBOUND_PARALLEL: ${stale.join(' · ')}`);
});

/**
 * The screens composed from several reads at once, where a refusal removes part
 * of what is shown WITHOUT the screen looking incomplete. The brief's own
 * example: a coordinator once read only the vendor documentation shots under a
 * card headed "Your gallery".
 */
const MUST_SAY_PARTIAL: Array<{ file: string; gate: RegExp }> = [
  { file: '[eventId]/guests/checkin/page.tsx', gate: /\{somethingRefused \? \(/ },
  { file: '[eventId]/guests/souvenirs/page.tsx', gate: /\{somethingRefused \? \(/ },
  { file: '[eventId]/hosts/page.tsx', gate: /\{hostsPartlyRefused \? \(/ },
  { file: '[eventId]/seating/walkthrough/page.tsx', gate: /\{walkthroughPartlyRefused \? \(/ },
  {
    file: '[eventId]/studio/papic/moderation/page.tsx',
    gate: /\{moderationPartlyRefused \? \(/,
  },
];

test('a partially-refused screen says so instead of presenting itself as complete', () => {
  // 🪤 THE FIRST DRAFT OF THIS TEST WAS DECORATION AND THE MUTATION RUN CAUGHT
  // IT. It asked only whether `<ReadRefusedNotice … partial` appeared in the
  // file — so replacing the CONDITION with `false` left the JSX sitting there,
  // unreachable, and the guard stayed GREEN (measured: the gate went 1 → 0
  // occurrences, 0 failures). **A COMPONENT THAT IS PRESENT IN THE SOURCE IS NOT
  // A COMPONENT ANYTHING CAN RENDER** — the same family as proving a card was
  // imported rather than mounted, one step further along. Both halves are named
  // now: the notice AND the flag that can switch it on.
  const missing: string[] = [];
  for (const { file, gate } of MUST_SAY_PARTIAL) {
    const src = stripComments(readFileSync(join(HERE, file), 'utf8'));
    if (!/<ReadRefusedNotice[\s\S]{0,200}?partial/.test(src)) {
      missing.push(`${file} — no partial notice`);
    }
    if (!gate.test(src)) missing.push(`${file} — nothing can switch it on: ${gate}`);
  }
  assert.deepEqual(
    missing,
    [],
    'These screens are built from several reads at once. When one is refused ' +
      'the page still renders and still looks whole, so it has to say that part ' +
      `of it is missing — and something has to be able to say it. ${missing.join(', ')}`,
  );
});

/**
 * 🔑 RULE 8 — AN ERROR THAT IS BOUND AND THEN THROWN AWAY. Rules 2 and 5 ask
 * only whether the error was NAMED. `if (error) return 0` names it, reads as
 * careful code, and states an absence nobody measured — it satisfied every
 * earlier rule in this file while doing the exact damage they exist to prevent.
 *
 * It cost the couple's own gallery hub: a refused count printed "As your guests
 * and cameras shoot, every photo gathers here" and pointed at *Open Papic*
 * instead of *View & download*, on the one page whose job is to reach photos
 * that already exist. This area has paid for it before — the Papic home tile
 * once told coordinators "0 cameras out" mid-shoot, an RLS silent-zero.
 *
 * ⚖ NOT EVERY ONE IS A DEFECT. A discard in the safe direction, ARGUED AT THE
 * CALL SITE, is a decision — the shared-pool hint fails to 0 because the
 * database refuses an over-hand-out anyway. Those go on the bill WITH the
 * reason, not into an exemption that would quietly cover the next one too.
 */
const ERROR_BRANCH = String.raw`if\s*\(\s*!?\s*\w*(?:[Ee]rror|Err)\b[^)]*\)\s*\{`;

/**
 * Every `if (…error…) { … }` branch, with its body — matched by BEHAVIOUR, not
 * by spelling.
 *
 * 🪤 THE FIRST DRAFT MATCHED ONLY THE TERSE ONE-LINER `if (error) return 0;`,
 * and the stale half of this very rule caught it within the hour: adding a log
 * line above the `return 0` moved the return two lines down, the pattern
 * stopped matching, and the guard reported the discard FIXED while it was still
 * there. **A LOGGED DISCARD IS STILL A DISCARD** — logging never changed a
 * single pixel. Ask what the branch RETURNS, not how it is written.
 */
function errorBranches(src: string): Array<{ body: string }> {
  const out: Array<{ body: string }> = [];
  for (const m of src.matchAll(new RegExp(ERROR_BRANCH, 'g'))) {
    let i = (m.index ?? 0) + m[0].length;
    let depth = 1;
    const from = i;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      i += 1;
    }
    out.push({ body: src.slice(from, i - 1) });
  }
  return out;
}

/**
 * A branch that FABRICATES a value rather than carrying the refusal.
 *
 * ⚖ `0` and `[]` only — and the omission of `null` is deliberate, decided after
 * the wider version cried wolf on the very fix this stream is shipping.
 * `return 0` and `return []` always invent data a nobody measured. `return null`
 * is AMBIGUOUS: from a value helper it is the honest "unknown" that lets the
 * caller say so (and is exactly what `countEventGuestCaptures` and
 * `fetchMarketplaceServices` now do); from a React component it means "render
 * nothing", which is sometimes the argued-safe answer.
 *
 * 🔑 A GUARD THAT CRIES WOLF TEACHES YOU TO SKIM PAST THE ONE TIME IT IS RIGHT,
 * so this rule stays narrow and SAYS what it does not cover: a component that
 * returns null on a refusal is not caught here. Rules 2, 5 and 7 catch the read
 * itself; this one catches the invented value.
 */
const fabricatedReturns = (body: string): number =>
  [...body.matchAll(/return\s*(?:0|\[\])\s*;/g)].length;

/**
 * 🪤 THE FIRST VERSION COUNTED BRANCHES AND THE MUTATION RUN CAUGHT IT. One
 * `if (error) { … }` can hold TWO returns — a legitimate `isMissingRelation →
 * []` and, below it, the discard. Counting the branch gave 1 either way, so
 * turning the honest `return null` into `return []` changed nothing the guard
 * could see (measured: the sabotage landed, 0 failures). **COUNT THE THING THE
 * BILL IS ABOUT — the fabricated value — not the container it sits in.**
 */
const discardMatches = (src: string) =>
  errorBranches(src).flatMap((b) =>
    Array.from({ length: fabricatedReturns(b.body) }, () => b),
  );

/**
 * THE BILL, with a reason on every line. Each is a bound error deliberately
 * discarded in the SAFE direction, argued where it happens.
 */
const KNOWN_DISCARDED: Record<string, number> = {
  // The shared-pool hint: failing to 0 can only refuse a hand-out the host
  // could have made, never permit one they could not. Logged, direction kept.
  'app/dashboard/[eventId]/studio/papic/_components/papic-cameras-card.tsx': 1,
  // `isMissingRelation(error) → []` — the table does not exist yet, so there
  // genuinely IS nothing to show. The other branch of that same function now
  // returns null and the panel says so.
  'app/dashboard/[eventId]/_components/vendor-marketplace-info.tsx': 1,
};

test('an error that is bound is not allowed to be thrown away', () => {
  // FLOOR — shared source with the rule, so blinding one blinds both.
  const everyBranch = renderFiles(HERE).reduce(
    (n, file) => n + errorBranches(stripComments(readFileSync(join(WEB_ROOT, file), 'utf8'))).length,
    0,
  );
  assert.ok(
    everyBranch >= 40,
    `Only ${everyBranch} error branches seen anywhere in this tree. The scan has ` +
      'stopped matching — that is not the same as the tree being clean.',
  );

  const counts = new Map<string, number>();
  for (const file of renderFiles(HERE)) {
    const n = discardMatches(stripComments(readFileSync(join(WEB_ROOT, file), 'utf8'))).length;
    if (n > 0) counts.set(file, n);
  }
  const fresh: string[] = [];
  for (const [file, n] of counts) {
    if (n > (KNOWN_DISCARDED[file] ?? 0)) fresh.push(`${file} → ${n} discarded`);
  }
  assert.deepEqual(
    fresh,
    [],
    'Naming the error and returning 0 or [] states an absence nobody ' +
      'measured — the same defect as never binding it, in careful clothes, and ' +
      'adding a log line does not change what the screen says. Either carry the ' +
      'refusal to the screen, or put it on KNOWN_DISCARDED with the reason the ' +
      `direction is safe. New: ${fresh.join(' · ')}`,
  );
  const stale = Object.entries(KNOWN_DISCARDED)
    .filter(([f, allowed]) => (counts.get(f) ?? 0) < allowed)
    .map(([f]) => f);
  assert.deepEqual(stale, [], `Fixed — delete from KNOWN_DISCARDED: ${stale.join(' · ')}`);
});

/**
 * The three cards that carried `if (error) return null; // pre-migration
 * graceful-degrade (42P01)`. The COMMENT named one cause; the CODE swallowed
 * every cause. Each must now narrow to the cause it names.
 */
const MUST_NARROW = [
  '[eventId]/messages/[threadId]/_components/thread-quotations-card.tsx',
  '[eventId]/vendors/[vendorId]/workspace/_components/vendor-proposals-card.tsx',
  '[eventId]/vendors/[vendorId]/workspace/_components/working-folder-notes.tsx',
];

test('a degrade written for a missing table does not also swallow a refusal', () => {
  const missing: string[] = [];
  for (const rel of MUST_NARROW) {
    const src = stripComments(readFileSync(join(HERE, rel), 'utf8'));
    if (!/if \(isMissingRelationError\(error\)\) return null;/.test(src)) {
      missing.push(`${rel} — no longer narrows to the missing-table case`);
    }
    if (!/<ReadRefusedNotice/.test(src)) missing.push(`${rel} — says nothing on a refusal`);
  }
  assert.deepEqual(
    missing,
    [],
    'These cards vanish when the read is refused, taking a quotation or a ' +
      'booking note off the screen of the person who needs it. Keep the silent ' +
      `degrade for the missing table only. ${missing.join(' · ')}`,
  );
});

test('a supplier is never blamed for a read WE could not make', () => {
  const panel = stripComments(
    readFileSync(join(HERE, '[eventId]/_components/vendor-marketplace-info.tsx'), 'utf8'),
  );
  assert.match(
    panel,
    /\{services === null \? \(/,
    '"{Supplier} hasn’t published a service list yet" is a claim about somebody ' +
      'else’s behaviour. It must be gated on our read having actually happened.',
  );
  assert.match(
    panel,
    /const hasAnything =[\s\S]{0,80}?services === null \|\|/,
    'The panel must stay mounted when the list is unread, or it cannot say so.',
  );
});

test('the gallery hub never says "collecting" about a gallery it could not count', () => {
  const hub = stripComments(
    readFileSync(join(HERE, '[eventId]/galleries/page.tsx'), 'utf8'),
  );
  assert.match(
    hub,
    /const papicCountMeasured = papicPhotoCount !== null && guestCaptureCount !== null;/,
    'Either half unread means the total is unknown — adding a measured number to ' +
      'an unread one and printing the sum is the same lie in smaller type.',
  );
  assert.match(
    hub,
    /viewLabel: ready \? 'View & download' : papicCountMeasured \? 'Open Papic' : 'Look anyway'/,
    'An uncounted gallery must not send the couple to the empty-state door.',
  );
});

/** The same bill, for counts. Same rules: shrink it, never grow it. */
const KNOWN_UNBOUND_COUNTS: Record<string, number> = {};

test('a count that could not be read never renders as a zero', () => {
  // FLOOR. An empty sweep looks exactly like a clean result — and this rule is
  // the one most likely to silently stop matching, because it depends on the
  // `{ count }` destructure staying the shape Supabase hands back. Measured
  // 2026-08-24: 10 count destructures in this tree's render files, all bound.
  const everyCount = renderFiles(HERE).reduce(
    (n, file) => n + countMatches(stripComments(readFileSync(join(WEB_ROOT, file), 'utf8'))).length,
    0,
  );
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
