/**
 * admin-page-starts-at-its-content.test.ts — the admin console stops drawing
 * its own page-name row.
 *
 * ── The decision this enforces is the OWNER'S, and it is three rungs deep ───
 * 2026-07-21 killed the eyebrow. 2026-08-18 killed the lede paragraph, after
 * the owner: *"we do not need these. it just eats up space."* 2026-08-21 killed
 * what was left — the back chevron and the 36px page name — after he pointed at
 * the Alaala page and said *"i still see this across most of pages"*, then chose
 * to remove the whole row so **each page starts straight at its content**.
 * Hours later the lone (i) went too. `DECISION_LOG.md` 2026-08-21 · PR #4664 ·
 * PR #4669 · the docblock on `app/_components/page-masthead.tsx`.
 *
 * That sweep was recorded as *"gone app-wide"* and it touched 133 files — but
 * it could only reach the pages that were already **PageMasthead call sites**.
 * A page that hand-rolled `<header><h1>Title</h1><p>lede</p></header>` was
 * invisible to it. Measured on `origin/main` @ `c65c64e77`, 2026-08-24: **54
 * files under `app/admin` still draw a visible `<h1>`**, in eight different type
 * treatments — `text-2xl` · `text-3xl` · `text-xl` · `sn-h1` · `font-serif` ·
 * `m-display-tight` · two of them painting a hardcoded hex. So half the console
 * starts at its content and half still spends a row repeating the name of the
 * menu item you just tapped.
 *
 * ⚠ THE SAME DEBT EXISTS OUTSIDE THIS TREE — 65 more files under `app/dashboard`
 * and `app/vendor-dashboard` draw a visible page title too. They are NOT this
 * guard's business (this session's territory is `app/admin/**`) and they are not
 * fixed by it. Naming the number here so nobody reads a green admin guard as
 * proof the app is done.
 *
 * ── AND TWO MASTHEAD GUARDS ALREADY EXISTED, NEITHER OF WHICH COULD SEE THIS ─
 * `page-masthead.test.ts` polices the COMPONENT — no eyebrow prop, no lede, no
 * back chevron, the h1 stays `sr-only`. It says nothing about whether any page
 * renders it. `lint-page-masthead.mjs` polices a `.sn-eye` element INSIDE a
 * `<header>` — the exact card-token drift that started this, deliberately
 * narrow, with a 15-file baseline. **Measured: not one of those 15 is an admin
 * file**, because no admin header used `.sn-eye`; they hand-rolled a plain
 * `<h1>` instead, which is invisible to both.
 *
 * 🔑 A DEFECT CAN LIVE IN THE SEAM BETWEEN TWO CORRECT GUARDS. Same shape as
 * the alpha-fill contrast bug that two working contrast guards both waved
 * through on 2026-08-13. This third guard is the seam, not a duplicate.
 *
 * ── Both regressions are silent ────────────────────────────────────────────
 * A 55th page that hand-rolls the row renders perfectly. A ported page whose
 * `<h1>` quietly comes back looks like a page with a title on it. Neither
 * throws, neither fails a build, and neither is visible in a diff unless you
 * are looking for it.
 *
 * 🛡 EVERY ASSERTION HERE WAS MUTATION-CHECKED AND THE MUTATION MEASURED — the
 * guarded thing broken on purpose, the OCCURRENCE COUNT printed before → after
 * to prove the sabotage landed, and the test confirmed RED before being
 * trusted. This repo has shipped guards that passed while the thing they guard
 * was gone; an unmeasured mutation proves nothing in either direction.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ADMIN = resolve(HERE, '..');

/** Every .tsx under app/admin, excluding tests. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

/**
 * Blank comments out before matching, keeping line numbers.
 *
 * 🔑 NOT COSMETIC, AND THIS REPO HAS PAID FOR IT TWICE. Every ported surface
 * carries a note naming the markup it removed — `<h1 className="text-2xl…">`,
 * `m-display-tight` — so a guard reading raw source finds the defect inside the
 * sentence announcing its own removal, and reports work that is already done.
 */
const code = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => (l.trimStart().startsWith('//') ? '' : l))
    .join('\n');

const read = (rel: string) => readFileSync(join(ADMIN, rel), 'utf8');

/**
 * A file draws a page-name row when it renders an `<h1>` that is not `sr-only`.
 *
 * The opening tag is matched ACROSS LINES on purpose: four of the offenders
 * found on 2026-08-24 wrapped their attributes, so a line-at-a-time matcher saw
 * a bare `<h1` with no className and could not tell hidden from visible. A
 * SEARCH THAT CANNOT MATCH IS NOT A NEGATIVE RESULT.
 */
function drawsAVisibleTitle(src: string): boolean {
  for (const m of code(src).matchAll(/<h1\b[^>]*>/g)) {
    if (!/sr-only/.test(m[0])) return true;
  }
  return false;
}

/**
 * 🛑 THE EXEMPTION MUST PROVE ITSELF.
 *
 * A bare list of filenames carrying its reason in a comment is the shape that
 * has now failed four times in this repo: the reason vanishes, the line
 * survives, and the exemption goes on exempting something else. So each entry
 * names a pattern that must STILL match the file. If it stops matching, the
 * exemption voids and the file is reported like any other.
 */
const NOT_A_PAGE_NAME: Array<{ file: string; why: string; proof: RegExp }> = [
  {
    file: 'error.tsx',
    // The h1 here is not the name of a page — it is the only sentence on a
    // screen that exists because something crashed ("This surface crashed —
    // here's exactly why."). Hiding it would leave an operator staring at a
    // stack of mono text with nothing saying what happened. The row the owner
    // removed is the one that repeats the menu item you just tapped; this is
    // the opposite of that.
    why: 'the error boundary — its h1 IS the message, not a page name',
    proof: /reset:\s*\(\)\s*=>\s*void/,
  },
  {
    file: 'compliance/data-sheet/page.tsx',
    // 🖨 THE ONE ADMIN SCREEN THAT IS A DOCUMENT, NOT A SCREEN. Its own copy
    // tells the operator to "copy or print this to file with the National
    // Privacy Commission", and `sr-only` is `position:absolute` + `clip` — it
    // does not print. Converting this page would hand the owner an NPC filing
    // with no heading on it, which is a worse defect than the row it removes.
    // The owner's rule is about a page repeating the menu item you just
    // tapped; a title on a document you file with a regulator is not that.
    why: 'a printed NPC filing — an sr-only title would not appear on the paper',
    proof: /print this to file with the National/,
  },
];

function exemptionHolds(rel: string, src: string): boolean {
  const e = NOT_A_PAGE_NAME.find((x) => x.file === rel);
  return e ? e.proof.test(src) : false;
}

/* ══════════════════════════════════════════════════════════════════════════
   1 · THE BILL, NAMED — and it can only shrink
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The admin files that still draw their own page-name row. 54 at this guard's
 * landing, 50 after PR 1/4, 34 after PR 2/4 (the tabbed consoles), 18 after
 * PR 3/4 (the money-and-records desks), and **0 after PR 4/4 took the judgement
 * queues and the record pages**.
 *
 * ⚖ A FILE NOT ON THIS LIST DRAWING A TITLE FAILS. Converting one of these also
 * FAILS, telling you to delete its line. **Never add a line to go green** —
 * each one is a screen spending a row to answer a question the operator already
 * answered by tapping the thing that brought them here.
 *
 * A BASELINE IS A BILL, NOT A DECISION. This one is visible and directional.
 */
const TITLE_ROW_BILL: string[] = [
  // 🎉 EMPTY, AND IT STAYS EMPTY. Every admin screen now starts at its content.
  // The two files that still render a visible <h1> are in NOT_A_PAGE_NAME
  // above, each pinned to a pattern that must still match — the error boundary
  // (its h1 IS the crash message) and the NPC data sheet (a document the owner
  // prints and files, where an sr-only title would not appear on the paper).
  //
  // ⚖ AN EMPTY LIST IS THE ONE STATE THIS GUARD CANNOT PROVE ANYTHING FROM ON
  // ITS OWN — a sweep that matched nothing produces exactly the same empty
  // array as a console with nothing left to fix. That is what rule 2's floor
  // is for: 95 admin files must still RENDER the masthead, so an empty bill
  // and a broken walk() cannot pass together.
].sort();

test('no new admin screen draws its own page-name row', () => {
  const found: string[] = [];
  for (const file of walk(ADMIN)) {
    const rel = file.slice(ADMIN.length + 1);
    const src = readFileSync(file, 'utf8');
    if (!drawsAVisibleTitle(src)) continue;
    if (exemptionHolds(rel, src)) continue;
    found.push(rel);
  }
  assert.deepEqual(
    found.sort(),
    TITLE_ROW_BILL,
    'A file NOT on this list draws a visible <h1>. Render <PageMasthead ' +
      'title="…" /> instead — it keeps the name in the document for screen ' +
      'readers, skip links and heading order at zero pixels, and carries any ' +
      'buttons the old header held. A file still ON the list that no longer ' +
      'matches has been converted — delete its line. Never add a line to go green.',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   2 · THE POSITIVE HALF — without it, deleting every port also passes
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Rule 1 is satisfied by a page that renders NO heading at all — which would
 * strip the console of the one thing a screen reader announces on arrival and
 * the one thing a skip link can point at. So the adoption is floored: 45 admin
 * files wore the masthead before this guard, 47 after PR 1/4 and 63 after
 * PR 2/4, 78 after PR 3/4 and 95 after PR 4/4. The PR-1 figure was TWO, not
 * three, because the moodboard library already wore it on its success branch
 * and this PR only added the second instance INSIDE that same file. Counting
 * conversions instead of files would have set the floor one above what the
 * tree can reach, which is a guard that fails on landing and gets lowered
 * rather than read.
 *
 * 🔑 FLOORED, NOT PINNED TO AN EXACT NUMBER. Every later conversion raises it,
 * and a guard that had to be edited on every PR would be edited without being
 * read.
 */
test('the admin console really wears the shared masthead', () => {
  let wearing = 0;
  for (const file of walk(ADMIN)) {
    if (/<PageMasthead\b/.test(code(readFileSync(file, 'utf8')))) wearing += 1;
  }
  assert.ok(
    wearing >= 95,
    `only ${wearing} admin files render <PageMasthead> — expected at least 95. ` +
      'A page with no heading at all satisfies rule 1 and tells a screen ' +
      'reader nothing; the name belongs in the document, at zero pixels.',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   3 · THE CONVERTED SURFACES KEEP THEIR NAME AND THEIR DOORWAYS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 25 of the old app-wide headers held the ONLY doorway to another surface, and
 * the same is true here — `/admin/website-media` holds its own upload control,
 * `/admin/integrity-watch` holds Rescan listings. Deleting a header is not
 * permission to delete what was in it.
 */
const PORTED: Array<{ file: string; namesItself: string }> = [
  // `namesItself` is the EXACT source text that hands the name to the masthead,
  // not a description of it — so the assertion cannot pass on a file that
  // renders the component and forgets to tell it what the page is called.
  { file: '_components/mobile-landing-grid.tsx', namesItself: 'title={title}' },
  {
    file: 'connection-logs/connection-logs-client.tsx',
    namesItself: 'title="Connection Logs"',
  },
  {
    file: 'studio/_surfaces/moodboard-library-surface.tsx',
    namesItself: 'title="Moodboard Library"',
  },
  // ── PR 2/4 · the tabbed consoles ────────────────────────────────────────
  {
    file: 'app-performance/_surfaces/growth-surface.tsx',
    namesItself: 'title="Growth & Population"',
  },
  {
    file: 'app-performance/_surfaces/interconnections-surface.tsx',
    namesItself: 'title="Interconnections"',
  },
  {
    file: 'app-performance/_surfaces/overview-surface.tsx',
    namesItself: 'title="App Performance"',
  },
  {
    file: 'pricing/_surfaces/pricing-surface.tsx',
    namesItself: 'title="Pricing & Catalog"',
  },
  {
    file: 'pricing/_surfaces/custom-plans-surface.tsx',
    namesItself: 'title="Custom plans"',
  },
  {
    file: 'pricing/_surfaces/price-bands-surface.tsx',
    namesItself: 'title="Price bands"',
  },
  {
    file: 'pricing/_surfaces/free-windows-surface.tsx',
    namesItself: 'title="Free windows"',
  },
  {
    file: 'settings/_surfaces/settings-surface.tsx',
    namesItself: 'title="Platform settings"',
  },
  {
    file: 'settings/_surfaces/compliance-surface.tsx',
    namesItself: 'title="Compliance"',
  },
  {
    file: 'settings/_surfaces/demo-mode-surface.tsx',
    namesItself: 'title="Demo mode"',
  },
  {
    file: 'settings/_surfaces/notifications-surface.tsx',
    namesItself: 'title="Notifications"',
  },
  { file: 'studio/_surfaces/recaps-surface.tsx', namesItself: 'title="Recaps"' },
  {
    file: 'studio/_surfaces/reveal-studio-surface.tsx',
    namesItself: 'title="Reveal Studio"',
  },
  {
    file: 'studio/_surfaces/songs-surface.tsx',
    namesItself: 'title="Master song catalogue"',
  },
  { file: 'ugat/_surfaces/menus-surface.tsx', namesItself: 'title="Menus & icons"' },
  {
    file: 'ugat/_surfaces/wedding-traditions-surface.tsx',
    namesItself: 'title="Wedding traditions"',
  },
  // ── PR 3/4 · the money and records desks ────────────────────────────────
  { file: 'receipts/page.tsx', namesItself: 'title="Transaction receipts"' },
  { file: 'subscriptions/page.tsx', namesItself: 'title="Subscriptions"' },
  { file: 'budget-planner/page.tsx', namesItself: 'title="Budget Planner"' },
  { file: 'founder-seats/page.tsx', namesItself: 'title="Founder seats"' },
  {
    file: 'settings/payment-methods/page.tsx',
    namesItself: 'title="Payment methods"',
  },
  {
    file: 'verification-docs/page.tsx',
    namesItself: 'title="Vendor verification documents"',
  },
  { file: 'website-media/page.tsx', namesItself: 'title="Website media"' },
  {
    file: 'background-videos/page.tsx',
    namesItself: 'title="Homepage background videos"',
  },
  {
    file: 'live-studio-channels/page.tsx',
    namesItself: 'title="Setnayan channel pool"',
  },
  { file: 'pakanta/page.tsx', namesItself: 'title="Pakanta queue"' },
  { file: 'demand/page.tsx', namesItself: 'title="Demand Radar"' },
  {
    file: 'vendor-recommendations/page.tsx',
    namesItself: 'title="Vendor recommendations"',
  },
  { file: 'help/page.tsx', namesItself: 'title="Help inbox"' },
  { file: 'integrations/page.tsx', namesItself: 'title="Integrations"' },
  { file: 'secrets/page.tsx', namesItself: 'title="Secrets & Rotation"' },
  // ── PR 4/4 · the judgement queues ───────────────────────────────────────
  { file: 'chat-flags/page.tsx', namesItself: 'title="Chat contact flags"' },
  {
    file: 'concierge-abuse/page.tsx',
    namesItself: 'title="Today’s Focus enforcement"',
  },
  { file: 'integrity-watch/page.tsx', namesItself: 'title="Integrity watch"' },
  { file: 'repost-watch/page.tsx', namesItself: 'title="Repost watch"' },
  { file: 'reviews/page.tsx', namesItself: 'title="Review moderation"' },
  { file: 'user-reports/page.tsx', namesItself: 'title="User reports"' },
  { file: 'force-majeure/page.tsx', namesItself: 'title="Force majeure"' },
  { file: 'editorial-review/page.tsx', namesItself: 'title="Editorial review"' },
  {
    file: 'vendors/[vendorProfileId]/edit/page.tsx',
    namesItself: 'title="Edit unclaimed vendor"',
  },
];

/**
 * ── AND THE RECORD PAGES, WHICH ARE THE ONE PLACE THE HEADING IS NOT A PAGE
 *    NAME ──────────────────────────────────────────────────────────────────
 *
 * The owner removed the row that repeats the menu item you just tapped. On a
 * record page the heading is the RECORD — a person's name, a shop's name, a
 * flag's reference, the event type this screen edits. That is the content, it
 * is why you opened the page, and hiding it would be deleting DATA rather than
 * chrome.
 *
 * ⚖ So these eight were ported the other way: the visible line is unchanged
 * and keeps its exact type treatment, only its element moves from `<h1>` to
 * `<p>`, and `titleNode` carries the same words into the masthead at zero
 * pixels. One heading, in the document, where a screen reader announces it on
 * arrival and a skip link can point at it.
 *
 * The rule below is what stops a later pass "finishing the job" by deleting
 * the visible name too — which on these pages would leave a person's record
 * with nothing on it saying whose record it is.
 */
const RECORD_PAGES: Array<{ file: string; keepsVisible: RegExp; why: string }> = [
  {
    file: 'users/[userId]/page.tsx',
    keepsVisible: /<p className="truncate font-serif text-2xl text-ink">\{displayName\}<\/p>/,
    why: 'whose account this is',
  },
  {
    file: 'force-majeure/[flagId]/page.tsx',
    keepsVisible: /\{row\.public_id\}\s*<\/p>/,
    why: 'which flag you are deciding',
  },
  {
    file: 'editorial-review/[editorialId]/page.tsx',
    keepsVisible: /\{event\?\.display_name \?\? 'Unnamed couple'\}\s*<\/p>/,
    why: 'whose editorial is held back from them',
  },
  {
    file: 'vendors/[vendorProfileId]/plan/page.tsx',
    keepsVisible: /Plan · \{vendor\.business_name\}/,
    why: 'whose plan you are about to change',
  },
  {
    file: 'vendors/[vendorProfileId]/team/page.tsx',
    keepsVisible: /business_name \?\? 'Vendor'\} · Team/,
    why: 'whose team you are looking at',
  },
  {
    file: 'event-types/[eventType]/categories/page.tsx',
    keepsVisible: /\{row\.emoji\}<\/span>/,
    why: 'which event type these categories belong to',
  },
  {
    file: 'event-types/[eventType]/onboarding/page.tsx',
    keepsVisible: /\{vocab\.emoji\} \{vocab\.label_en\} · Onboarding content/,
    why: 'which event type this content belongs to',
  },
  {
    file: 'event-types/[eventType]/profile/page.tsx',
    keepsVisible: /\{vocab\.emoji\} \{vocab\.label_en\} · Onboarding profile/,
    why: 'which event type this profile belongs to',
  },
];

test('a record page keeps its record NAME visible, and moves only the heading element', () => {
  const offenders: string[] = [];
  for (const { file, keepsVisible, why } of RECORD_PAGES) {
    const src = code(read(file));
    if (!/<PageMasthead\b[^>]*titleNode=/.test(src) && !/titleNode=/.test(src)) {
      offenders.push(`${file} (no titleNode — the record's name is not in the document)`);
    }
    if (!keepsVisible.test(src)) {
      offenders.push(`${file} (the visible name is gone — nothing says ${why})`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'On a record page the name is the CONTENT. Hiding it is deleting data, ' +
      `not chrome. Offenders: ${offenders.join(', ')}`,
  );
});


test('each surface ported here still names itself, at zero pixels', () => {
  const offenders: string[] = [];
  for (const { file, namesItself } of PORTED) {
    const src = code(read(file));
    if (!/<PageMasthead\b/.test(src)) {
      offenders.push(`${file} (no PageMasthead)`);
      continue;
    }
    if (!src.includes(namesItself)) {
      offenders.push(`${file} (does not pass ${namesItself})`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'Hiding the title is not deleting it: the h1 is what a screen reader ' +
      `announces on arrival. Offenders: ${offenders.join(', ')}`,
  );
});

test('the moodboard library names itself on the branch a person only sees when it is broken', () => {
  // 🔑 THE SWEEP PORTED WHAT IT COULD SEE RENDERING. This file's SUCCESS branch
  // was converted months ago and its ERROR branch — the screen an operator only
  // reaches when the read has already failed — kept the old row, so the page
  // carried TWO <h1>s depending on which way the query went. Both branches now
  // pass through the same masthead.
  const src = code(read('studio/_surfaces/moodboard-library-surface.tsx'));
  assert.equal(
    (src.match(/<PageMasthead\b/g) ?? []).length,
    2,
    'both the error branch and the success branch render the masthead — one ' +
      'each, so the page has exactly one h1 whichever way the read goes',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   4 · THE ROW'S OTHER TWO RUNGS DO NOT COME BACK WITH IT
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The eyebrow died first (2026-07-21) and the lede second (2026-08-18). The
 * landing grid was still drawing BOTH above its title — a mono "Admin" over a
 * 30px name over a sentence — on the three surfaces that map the whole console.
 * Removing only the title would have left the two rungs the owner killed first.
 */
test('the landing grid draws no eyebrow, no title and no subtitle', () => {
  const src = code(read('_components/mobile-landing-grid.tsx'));
  assert.doesNotMatch(
    src,
    /m-display-tight/,
    'the 30px page name is the rung the owner pointed at directly',
  );
  assert.doesNotMatch(
    src,
    /m-label-mono[^]{0,120}Admin/,
    'the mono "Admin" eyebrow above it is rung one, killed 2026-07-21',
  );
  assert.doesNotMatch(
    src,
    /\bsubtitle\b/,
    'and the subtitle prop goes with it, at the three call sites too — a prop ' +
      'nothing reads is the debt this repo keeps paying for',
  );
});

test('the dead landing accordion is gone, not left importing a type', () => {
  // Built 2026-06-08 to replace the flat grid, never mounted, superseded on
  // 2026-08-04 when the grid itself gained grouping, search and a desktop
  // width. It had ZERO importers for eleven weeks while carrying its own copy
  // of the retired header row — so the row could have come back through a
  // component nothing renders.
  const files = walk(ADMIN).map((f) => f.slice(ADMIN.length + 1));
  assert.equal(
    files.includes('_components/mobile-landing-accordion.tsx'),
    false,
    'MobileLandingAccordion had no consumers. A component nothing renders is ' +
      'not a design that survived — it is a second answer to a question the ' +
      'grid already answers.',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   5 · DELETING A HEADER IS NOT PERMISSION TO DELETE WHAT WAS IN IT
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The app-wide sweep measured this cost rather than estimating it: 25 of the
 * old headers held the ONLY doorway to another surface, and 16 routes lost
 * their only on-page way up a level. The same trap is here, and `lint-port-no-
 * lost-controls` catches a lost LINK but has nothing to say about a lost
 * BADGE — a badge is not a control, and losing it is worse than losing a link,
 * because the numbers underneath it stay on screen and become untrue.
 *
 * These three are each the only thing of their kind on their screen.
 */
const HELD_IN_THE_OLD_HEADER: Array<{ file: string; keeps: RegExp; why: string }> = [
  {
    file: 'pricing/_surfaces/pricing-surface.tsx',
    keeps: /href="\/admin\/addons\/pricing-report"/,
    why: 'the ONLY export path for the legacy v1 service_catalog — re-homed into this header on 2026-07-21 precisely so it would not be orphaned',
  },
  {
    file: 'app-performance/_surfaces/growth-surface.tsx',
    keeps: /Illustrative demo data/,
    why: 'the only thing on the screen saying these counts are not real',
  },
  {
    file: 'app-performance/_surfaces/overview-surface.tsx',
    keeps: /Entity curves: demo data/,
    why: 'same — every curve below it is wrong without it',
  },
  {
    file: 'subscriptions/page.tsx',
    keeps: /\{pending\.length\} pending/,
    why: 'the number of vendors waiting on somebody at this desk — a count, not a page name',
  },
  {
    file: 'integrity-watch/page.tsx',
    keeps: /action=\{rescanAction\}/,
    why: 'the only way to re-run the screening from this screen',
  },
  {
    file: 'repost-watch/page.tsx',
    keeps: /action=\{rescanAllRepostWatch\}/,
    why: 'the only way to re-run the reverse-image match from this screen',
  },
];

/**
 * 🪤 EXACTLY ONE, NOT AT LEAST ONE — AND THIS RULE WAS DECORATIVE UNTIL THE
 *    MUTATION RUN SAID SO.
 *
 * The first cut asked only whether the pattern still MATCHED the file. Three of
 * the phrases it pinned appear more than once in their own file — `chat-flags`
 * repeats "Setnayan staff don't read chats" on every row, `repost-watch` says
 * "never touches the image" twice, and "starter content" occurs SIX times in
 * wedding-traditions. So deleting the sentence from the lede left a second
 * occurrence standing and the guard reported GREEN. Measured: 2 → 1 and 3 → 2,
 * both green, both proving nothing.
 *
 * Requiring an exact count of ONE fixes it in both directions: a deletion drops
 * to 0 and fails, and a future duplicate that would re-arm the same blind spot
 * goes to 2 and fails too — so nobody can quietly restore the hole.
 */
const occurrences = (src: string, re: RegExp): number =>
  (src.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)) ?? [])
    .length;

test('what the old header held survived the header', () => {
  const offenders: string[] = [];
  for (const { file, keeps, why } of HELD_IN_THE_OLD_HEADER) {
    const n = occurrences(code(read(file)), keeps);
    if (n !== 1) offenders.push(`${file} — ${n} matches (want exactly 1) for ${why}`);
  }
  assert.deepEqual(offenders, [], offenders.join(' · '));
});

/**
 * ⚖ AND THE SENTENCES THAT SURVIVED HAD TO EARN IT, ONE AT A TIME.
 *
 * Rung four's rule is not "delete every lede" — it is that a sentence a person
 * genuinely needs in order to USE the page belongs IN the page, beside the
 * thing it governs. Applied here that split 16 ledes roughly down the middle.
 * Orientation went (`Notifications`: "operational alerts routed to your admin
 * account", above a list of exactly that). These three stayed because deleting
 * them costs something real, and they are pinned so a later tidy-up cannot
 * quietly finish the job.
 */
const SENTENCES_THAT_EARNED_THEIR_KEEP: Array<{ file: string; keeps: RegExp; why: string }> = [
  {
    file: 'settings/_surfaces/settings-surface.tsx',
    keeps: /these are not BIR ORs/,
    why: 'mistaking this screen for BIR Official Receipts is a tax problem, not a layout one',
  },
  {
    file: 'studio/_surfaces/reveal-studio-surface.tsx',
    keeps: /go live on couple sites/,
    why: 'nothing else says a slider here reaches strangers’ wedding pages',
  },
  {
    file: 'ugat/_surfaces/wedding-traditions-surface.tsx',
    keeps: /This is starter content; validate each religion/,
    why: 'it goes live to couples with no deploy and several religions are still unvalidated',
  },
  {
    file: 'verification-docs/page.tsx',
    keeps: /Deleting is permanent and there is no undo/,
    why: 'these are strangers’ government IDs and the only control is an irreversible delete',
  },
  {
    file: 'website-media/page.tsx',
    keeps: /are not shown on this page and cannot/,
    why: 'it is the sentence that says how far the Delete button reaches — and how far it does not',
  },
  {
    file: 'secrets/page.tsx',
    keeps: /Values are write-only/,
    why: 'without it, an operator looking for a key they already hold concludes the page is broken',
  },
  {
    file: 'chat-flags/page.tsx',
    keeps: /This queue shows only the/,
    why: 'the strongest case in the console — without it a reviewer thinks they are about to read somebody’s private conversation',
  },
  {
    file: 'repost-watch/page.tsx',
    keeps: /Detect-and-review only/,
    why: 'on a queue about one vendor allegedly using another’s photograph, it is what stops a reviewer expecting a takedown',
  },
  {
    file: 'force-majeure/page.tsx',
    keeps: /7-day auto-resolution timer/,
    why: 'a judgement desk where NOT deciding is itself a decision has to say so on the screen',
  },
  /* ⚖ MONEY'S LEDE WAS RETIRED 2026-08-25 AND ITS REASON RETIRED WITH IT.
     It read "the act-now money queues live in Overview, not here" — true only
     while this page had no money on it. The ledger above the grid now names
     those four queues and shows their counts, so the sentence would now be
     contradicted by the links directly above it. Removed because the condition
     it described ended, NOT to go green: the guard is what caught the removal
     and made this reasoning necessary. */
];

/**
 * 🛑 AND `note` MUST NOT BECOME `subtitle` UNDER A NEW NAME.
 *
 * The retired prop carried orientation on all three landings — "every admin
 * page there is, grouped and searchable", over a grid of exactly that. Its
 * replacement exists for one thing a grid of links genuinely cannot say: where
 * something that is NOT on this page lives. Exactly one page has ever needed
 * it. If a second appears, this fails and the person adding it has to say what
 * their sentence points at that the cards do not.
 */
test('the landing grid’s note slot is used once, for a pointer off the page', () => {
  const users = ['more/page.tsx', 'directory/page.tsx', 'money/page.tsx'].filter((rel) =>
    /\bnote=\{/.test(code(read(rel))),
  );
  /* 🛑 THIS LIST IS NOW EMPTY, AND THAT IS THE DELIBERATE UPDATE THE MESSAGE
     BELOW ASKS FOR — 2026-08-25. Money's note said the act-now money queues
     "live in Overview, not here". The transactions ledger now sits above that
     grid and links Payments · Fees owed · Payouts · Subscriptions BY NAME with
     their live counts, so the sentence no longer points off the page: the page
     goes there. The harm it existed to prevent — somebody looking for Payments
     on the Money page and concluding it is missing — is closed by a link with a
     number on it, which is strictly better than a sentence saying "elsewhere".
     The prop is KEPT, not deleted: the rule it enforces is still the right one
     for whatever legitimately needs it next. */
  assert.deepEqual(
    users,
    [],
    '`note` is for a sentence pointing somewhere the cards do NOT go, not for a ' +
      'subtitle. If a landing needs one, say in its call site what it ' +
      'points at — then update this list deliberately.',
  );
});

test('the ledes that were kept were kept for a reason that is still there', () => {
  const offenders: string[] = [];
  for (const { file, keeps, why } of SENTENCES_THAT_EARNED_THEIR_KEEP) {
    // Exactly one — see the note above `occurrences`. A phrase that also
    // appears on every row of the table below the lede cannot tell you the
    // lede is still there.
    const n = occurrences(code(read(file)), keeps);
    if (n !== 1) offenders.push(`${file} — ${n} matches (want exactly 1): ${why}`);
  }
  assert.deepEqual(offenders, [], offenders.join(' · '));
});
