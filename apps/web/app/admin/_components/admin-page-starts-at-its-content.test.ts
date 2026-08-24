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
 * landing, 50 after PR 1/4, **34 after PR 2/4 took the sixteen tabbed-console
 * surfaces** — the ones where the tab strip above already carried the name and
 * the row underneath was the second copy of it.
 *
 * ⚖ A FILE NOT ON THIS LIST DRAWING A TITLE FAILS. Converting one of these also
 * FAILS, telling you to delete its line. **Never add a line to go green** —
 * each one is a screen spending a row to answer a question the operator already
 * answered by tapping the thing that brought them here.
 *
 * A BASELINE IS A BILL, NOT A DECISION. This one is visible and directional.
 */
const TITLE_ROW_BILL = [
  'background-videos/page.tsx',
  'budget-planner/page.tsx',
  'chat-flags/page.tsx',
  'compliance/data-sheet/page.tsx',
  'concierge-abuse/page.tsx',
  'demand/page.tsx',
  'editorial-review/[editorialId]/page.tsx',
  'editorial-review/page.tsx',
  'event-types/[eventType]/categories/page.tsx',
  'event-types/[eventType]/onboarding/page.tsx',
  'event-types/[eventType]/profile/page.tsx',
  'force-majeure/[flagId]/page.tsx',
  'force-majeure/page.tsx',
  'founder-seats/page.tsx',
  'help/page.tsx',
  'integrations/page.tsx',
  'integrity-watch/page.tsx',
  'live-studio-channels/page.tsx',
  'pakanta/page.tsx',
  'receipts/page.tsx',
  'repost-watch/page.tsx',
  'reviews/page.tsx',
  'secrets/page.tsx',
  'settings/payment-methods/page.tsx',
  'subscriptions/page.tsx',
  'user-reports/page.tsx',
  'users/[userId]/page.tsx',
  'vendor-recommendations/page.tsx',
  'vendors/[vendorProfileId]/edit/page.tsx',
  'vendors/[vendorProfileId]/plan/page.tsx',
  'vendors/[vendorProfileId]/team/page.tsx',
  'verification-docs/page.tsx',
  'website-media/page.tsx',
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
 * PR 2/4. The PR-1 figure was TWO, not
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
    wearing >= 63,
    `only ${wearing} admin files render <PageMasthead> — expected at least 63. ` +
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
];

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
];

test('what the old header held survived the header', () => {
  const offenders: string[] = [];
  for (const { file, keeps, why } of HELD_IN_THE_OLD_HEADER) {
    if (!keeps.test(code(read(file)))) offenders.push(`${file} — lost ${why}`);
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
    keeps: /starter content/,
    why: 'it goes live to couples with no deploy and several religions are still unvalidated',
  },
];

test('the ledes that were kept were kept for a reason that is still there', () => {
  const offenders: string[] = [];
  for (const { file, keeps, why } of SENTENCES_THAT_EARNED_THEIR_KEEP) {
    if (!keeps.test(code(read(file)))) offenders.push(`${file} — lost the sentence: ${why}`);
  }
  assert.deepEqual(offenders, [], offenders.join(' · '));
});
