import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { DAY_OF_ENDS_PLAIN, DAY_OF_STARTS_PLAIN, getDayOfPhase } from '@/lib/day-of-mode';
import { HUB_OPEN_WINDOW_PLAIN, hasDayToday, phTodayIso } from '@/lib/vendor-day-picker';
import { publicHelpSourceText } from '@/lib/help-sources.test-helper';

/**
 * THE APP SAYS "EVENT", AND SAYS WHEN THINGS OPEN IN WORDS A PERSON USES.
 *
 * Owner, 2026-10-04 (DECISION_LOG "ONE WORD: EVENT"): *"yes, use event
 * everywhere."* Two folders already had their own guard (the front door, the
 * guest path); the rest of the app did not, and the 2026-10-21 sweep found the
 * Events board saying *"your celebration moves up here"* and ~290 more strings
 * like it. Same sweep: the supplier Hub's empty day said *"(T-1h → T+8h)"* —
 * jargon to a florist, and UNTRUE: the Hub's gate is the Philippine calendar
 * day, midnight to midnight (`hasDayToday` + `phTodayIso`). /features, help
 * and the tour said "T-1h" for day-of mode, which starts at noon the day before.
 *
 * 🔑 KEYED ON PROPERTIES, NOT SENTENCES. Every string a source file under
 * app/ · lib/ · components/ can put on screen — JSX text, string and template
 * literals — is read through the TypeScript parser, so a comment is never
 * mistaken for copy, a REWORDED sentence is caught as surely as the old one,
 * and a new file is covered the day it lands.
 *
 * WHAT IS ALLOWED, AND WHY (each entry must still match something, so the list
 * cannot rot into a blanket pass):
 *   · whole files/folders that are not customer copy (owner console, labs),
 *     legal text (changes go through the owner), editorial prose where
 *     "celebration" is ordinary English and not the name of the thing (blog,
 *     traditions, recap magazine), and the event TYPE that is literally named
 *     "Celebration" (Salu-salo);
 *   · one-word DATA KEYS — an event-type key, the terminology `occasionNoun`
 *     default that `watchLiveOccasion` translates at output — listed per file.
 * The verb is not the noun: "celebrate" / "celebrating" / "celebratory" do not
 * match.
 */

const WEB = process.cwd();
const ROOTS = ['app', 'lib', 'components'];

/** The noun, as a name for the thing — the verb forms do not match. */
const NOUN = /\bcelebrations?\b/i;
/** "T-1h", "T+8h", "T+24hr", "T-3 months", "T-6mo", "T+30d" — offset notation from a spec, not a sentence. */
const T_OFFSET = /\bT\s*[-+−–]\s*\d+\s*(?:h|hrs?|hours?|d|days?|w|wks?|weeks?|m|mos?|mins?|months?)\b/i;

/** Paths (a trailing `/` = the whole folder) whose "celebration" is not the name of the thing. */
const NOUN_ALLOWED_PATHS: Record<string, string> = {
  'app/admin/': 'owner console — not customer-facing',
  'lib/admin/': 'owner console — not customer-facing',
  'lib/ugat/': 'internal system map — not customer-facing',
  'lib/erasure/': 'internal erasure register — not customer-facing',
  'lib/data-subject-register.ts': 'internal data-subject register — not customer-facing',
  'app/dev/': 'dev labs — never shipped to customers',
  'lib/blog-batches/': 'editorial articles — ordinary English prose',
  'lib/blog.ts': 'editorial articles — ordinary English prose',
  'lib/auspicious-date.ts': 'cultural/astrological prose about dates',
  'lib/wedding-traditions.ts': 'cultural prose about wedding customs',
  'lib/real-weddings.ts': 'editorial case studies',
  'lib/playlist.ts': "song-moment prose ('the first minute of the celebration')",
  'lib/schedule-templates.ts': "a block of the day ('Celebration lunch'), not the event",
  'lib/schedule-run-of-show.ts': "a phase of the day ('Celebration & socials'), not the event",
  'lib/monogram-motion.ts': "figurative ('a little celebration every time a guest arrives')",
  'lib/kwento-magazine.ts': "recap section title — the party part, as against the ceremony",
  'lib/kwento-moments.ts': 'recap section title, as above',
  'app/[slug]/_components/editorial/': 'recap editorial prose and sample headlines',
  'app/[slug]/print/': 'printed recap editorial prose',
  'app/dashboard/[eventId]/story/_components/editorial-editor.tsx': 'placeholder mirroring the editorial sample headlines',
  'app/dashboard/[eventId]/date-selection/': "sukob tradition prose about siblings' separate weddings",
  'app/onboarding/wedding/_data/experience-personas.ts': "persona names ('The Grand Celebration') and vibe prose",
  'app/onboarding/wedding/_data/wedding-cities.ts': 'destination prose',
  'app/onboarding/wedding/_components/welcome-moments.tsx': "statistics prose ('every kind of celebration')",
  'lib/onboarding/generic-content.ts': 'persona names and vibe prose',
  'lib/onboarding/specialty-catalog.ts': 'the event TYPE named Celebration (Salu-salo) and its matching rule',
  'app/dashboard/(account)/create-event/_components/event-types.ts': 'the event TYPE named Celebration',
  'lib/checklist.ts': 'the event TYPE named Celebration',
  'lib/event-type-profile.ts': 'terminology DATA (occasionNoun) — translated at output by watchLiveOccasion',
  // Rewritten 20 Nov (PR #8041) from specs SETNAYAN_FOR_SEARCH_AND_AI_2026-11-20.md: the whole file renders /llms.txt,
  // a document for search engines and AI assistants — never an app screen. "celebration" appears in it about a dozen
  // times, NOT only in the brand line: the brand line ("the home of every Filipino celebration", owner 19 Nov / "Yes,
  // brand lines" 20 Nov) and its repeats in the entity card and About; the source's own prose ("Every celebration, all
  // in one place, for life", "the place a Filipino celebration lives", "Not every event type is a celebration", the
  // Debut definition, the "Filipino celebrations specifically?" FAQ, "structurally different"); and the event-type list. The prose is one template inside `renderLlmsTxt`,
  // so no named declaration can be allowed instead; a whole-file pass is the only shape that fits. Its retired lines
  // are held by lib/seo/the-retired-words-stay-gone.test.ts.
  'lib/llms-txt.ts': '/llms.txt for search and AI, not an app screen — "celebration" ~a dozen times, brand line and prose (see the note above)',
  'app/llms.txt/': 'machine-readable summary for crawlers',
  'lib/celebration-poster-words.ts': 'poster artwork word list',
  'lib/watermark-server.ts': 'seal artwork drawn on photos',
  'app/dashboard/[eventId]/launch/_components/celebration-pick.tsx': "the RSVP 'Celebration' feature (the yes-animation), not the event",
  'app/dashboard/[eventId]/launch/_components/maker-rsvp-ask.tsx': "the RSVP 'Celebration' feature name",
};

/** Exact strings, per file, that are data rather than copy. */
const NOUN_ALLOWED_STRINGS: Record<string, string[]> = {
  // the terminology `occasion` default — translated to "event" at output by watchLiveOccasion
  'app/[slug]/_components/empty-states.tsx': ['celebration'],
  'app/[slug]/_components/event-words-provider.tsx': ['celebration'],
  'app/[slug]/_components/spotlight-card.tsx': ['celebration'],
  'app/[slug]/_lib/event-words.ts': ['celebration'],
  'lib/invitation-words-draft.ts': ['celebration'],
  'lib/watch-live-occasion.ts': ['celebration'],
  // the sample event's frozen copy of a wedding's `EventWords` (held equal to eventWordsFromProfile by its own test)
  'lib/sample-event/hub.ts': ['celebration'],
  // event-type keys / tags
  'lib/checklist-event-type-defs.ts': ['celebration'],
  // the KEY of the roster row whose shown word becomes "Other events" — the supplier door (walk 13 Nov, F-W1-06) and
  // Discover's Occasion filter (walk 18 Nov, R7)
  'lib/event-type-shown-words.ts': ['celebration'],
  'lib/event-anchor.ts': ['celebration'],
  'lib/event-brief.ts': ['celebration'],
  'lib/onboarding/type-questions.ts': ['celebration'],
  // the generic type's KEY — never drawn; it keeps it off the "Kind of event" choices (2026-10-28)
  'lib/event-type-requests.ts': ['celebration'],
  'lib/papic-challenge-pool.ts': ['celebration'],
  'lib/papic-event-access.ts': ['celebration'],
  'lib/supplier-find.ts': ['celebrations'],
  'lib/rsvp-ask.ts': ['celebration'],
  // words matched or drawn, not said
  'lib/theme-text-intent.ts': ['celebration'],
  'lib/moodboard-gallery-upload.ts': ['CELEBRATION'],
  // a music mood's name in the App Store demo card
  'app/_components/app-store/studio-card-demo.tsx': ['Joyful celebration'],
};

/**
 * 🏷 THE BRAND LINES — the ONLY places "celebration" is the right word (owner 19 Nov ruling: brand lines say
 * celebration, everything else says event; confirmed for these lines 20 Nov, "Yes, brand lines", on PR #8041).
 *
 * 🔑 NAMED DECLARATIONS, NEVER A PATTERN. Each entry is the dotted name of the declaration that owns the string —
 * `CONST` for `const CONST = '…'`, `obj.prop` for a property of `const obj = { prop: '…' }` (array steps are skipped).
 * A string anywhere else in the same file — a button, a plan name, a pricing row, another AI answer — still fails.
 * Some entries do not say "celebration" today (they are cleared to); the rot check below requires each named
 * declaration to EXIST, so a rename cannot leave a permission pointing at nothing.
 * ⚠ The front-page hero is drawn inline in `app/_components/frontdoor/front-door-anchor.tsx` (no named constant) and
 * has its own guard, `the-front-door-says-event.test.ts`; it joins this list when its line moves into a constant.
 */
const NOUN_ALLOWED_BRAND_LINES: Record<string, string[]> = {
  'app/layout.tsx': [
    'SITE_TITLE', // the title of every page that sets none, and the share title
    'SITE_DESCRIPTION', // the default description and the share card's description
    'organizationJsonLd.description', // the Organization JSON-LD on every page
    'baseMetadata.openGraph.images.alt', // the share card
  ],
  'lib/seo/ai-answers.ts': ['WHAT_IS_SETNAYAN_ANSWER'], // "What is Setnayan?" — the one answer that is a brand line
  'lib/email-template.ts': ['EMAIL_TAGLINE'], // the tagline under every branded email
};

const T_OFFSET_ALLOWED_PATHS: Record<string, string> = {
  'app/(shell)/privacy/': 'legal text — the retention schedule; changes go through the owner',
  'app/admin/': 'owner console — not customer-facing',
};

const allowedBy = (rel: string, table: Record<string, string>) =>
  Object.keys(table).find((p) => (p.endsWith('/') ? rel.startsWith(p) : rel === p));

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
    }
  };
  for (const r of ROOTS) if (existsSync(join(WEB, r))) walk(join(WEB, r));
  return out;
}

/**
 * The dotted name of the declaration that owns a string: `SITE_TITLE`, `organizationJsonLd.description`. Walks up
 * through property assignments (array elements are skipped) to the variable declaration; `undefined` when the string
 * sits anywhere else — a function body, a return, a JSX child — so no brand-line permission can reach it.
 */
function ownerOf(n: ts.Node): string | undefined {
  const props: string[] = [];
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    if (ts.isPropertyAssignment(p)) {
      if (!(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) return undefined;
      props.unshift(p.name.text);
    } else if (ts.isVariableDeclaration(p)) {
      return ts.isIdentifier(p.name) ? [p.name.text, ...props].join('.') : undefined;
    } else if (!(ts.isObjectLiteralExpression(p) || ts.isArrayLiteralExpression(p) || ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isSatisfiesExpression(p))) {
      return undefined;
    }
  }
  return undefined;
}

/** Every piece of text in a file that could reach the screen, with its line. Comments and import paths are not copy. */
function copyIn(path: string, source = readFileSync(path, 'utf8')): { text: string; line: number; owner?: string }[] {
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: { text: string; line: number; owner?: string }[] = [];
  const push = (n: ts.Node, text: string) =>
    out.push({ text, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, owner: ownerOf(n) });
  const walk = (n: ts.Node) => {
    if (n.kind === ts.SyntaxKind.JsxText) push(n, n.getText(sf));
    else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const p = n.parent;
      const isModulePath =
        ts.isImportDeclaration(p) ||
        ts.isExportDeclaration(p) ||
        ts.isExternalModuleReference(p) ||
        (ts.isCallExpression(p) && /^(import|require)$/.test(p.expression.getText(sf)));
      if (!isModulePath) push(n, n.text);
    } else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) push(n, n.text);
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

/** How many times `name` is used as a value in code — never the import, never a comment. */
function usesOf(path: string, source: string, name: string): number {
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  let n = 0;
  const walk = (node: ts.Node) => {
    if (ts.isIdentifier(node) && node.text === name && !ts.isImportSpecifier(node.parent)) n++;
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return n;
}

const FILES = sourceFiles();
const COPY = new Map(FILES.map((f) => [relative(WEB, f), copyIn(f)]));

test('the anchor: the reader walks the whole app and finds real copy, never a comment', () => {
  assert.ok(FILES.length > 1500, `only ${FILES.length} source files — run from apps/web`);
  const board = COPY.get('app/dashboard/(launcher)/page.tsx');
  assert.ok(board, 'the Events board moved — re-point the anchor');
  assert.ok(board.some((c) => /moves up here/.test(c.text)), 'the reader did not pick up the Events board copy');
  // A comment is not copy (the guard would otherwise convict the docblock explaining a fix).
  assert.ok(copyIn('x.ts', '// your celebration moves up here\nconst a = 1;').length === 0);
  assert.ok(copyIn('x.ts', "import y from './celebration-engine';").length === 0);
  assert.equal(copyIn('x.tsx', 'const a = <p>On the day, your celebration</p>;').length, 1);
});

test('no customer-facing string names the thing a "celebration"', () => {
  const hits: string[] = [];
  for (const [rel, copy] of COPY) {
    if (allowedBy(rel, NOUN_ALLOWED_PATHS)) continue;
    const keys = NOUN_ALLOWED_STRINGS[rel] ?? [];
    const brand = NOUN_ALLOWED_BRAND_LINES[rel] ?? [];
    for (const { text, line, owner } of copy) {
      if (!NOUN.test(text) || keys.includes(text.trim())) continue;
      if (owner && brand.includes(owner)) continue;
      hits.push(`${rel}:${line} — ${JSON.stringify(text.replace(/\s+/g, ' ').trim().slice(0, 100))}`);
    }
  }
  assert.deepEqual(hits, [], 'House word: say "event", never "celebration" (or allow-list it here, with the reason):\n' + hits.join('\n'));
});

// The brand-line permission is a NAME, not a file: it reaches exactly the named declaration and nothing beside it.
test('a brand-line permission covers only its named declaration', () => {
  const src = [
    "const SITE_TITLE = 'Setnayan · The home of every Filipino celebration';",
    "const organizationJsonLd = { name: 'x', description: 'every Filipino celebration', other: 'a celebration' };",
    "const BUTTON = 'Start your celebration';",
    "export function aiAnswers() { return [{ id: 'free', answer: 'every celebration is free' }]; }",
    "const WHAT_IS_SETNAYAN_ANSWER = 'Setnayan is the home of every Filipino celebration.';",
  ].join('\n');
  const owners = copyIn('x.ts', src).filter((c) => NOUN.test(c.text)).map((c) => c.owner ?? '(none)');
  assert.deepEqual(owners, ['SITE_TITLE', 'organizationJsonLd.description', 'organizationJsonLd.other', 'BUTTON', '(none)', 'WHAT_IS_SETNAYAN_ANSWER']);
  const allowed = ['SITE_TITLE', 'organizationJsonLd.description', 'WHAT_IS_SETNAYAN_ANSWER'];
  const red = owners.filter((o) => !allowed.includes(o));
  // a sibling property, a button and a non-brand AI answer all still fail
  assert.deepEqual(red, ['organizationJsonLd.other', 'BUTTON', '(none)']);
});

test('the install manifest (name, description) never names the thing a "celebration"', () => {
  const m = JSON.parse(readFileSync(join(WEB, 'public/manifest.json'), 'utf8')) as Record<string, unknown>;
  const said = ['name', 'short_name', 'description'].map((k) => String(m[k] ?? '')).filter(Boolean);
  assert.ok(said.length >= 2, 'the manifest lost its name/description — re-point this check');
  assert.deepEqual(said.filter((t) => NOUN.test(t)), [], 'public/manifest.json says "celebration"');
  // The owner's tagline, as he changed it on 2026-10-22 (DECISION_LOG "TAGLINE SAYS EVENT").
  assert.ok(String(m.description).startsWith('Plan, share and relive every event'));
});

test('every allow-list entry still matches something — the list cannot rot into a blanket pass', () => {
  const stale: string[] = [];
  for (const p of Object.keys(NOUN_ALLOWED_PATHS)) {
    const used = [...COPY].some(([rel, copy]) => (p.endsWith('/') ? rel.startsWith(p) : rel === p) && copy.some((c) => NOUN.test(c.text)));
    if (!used) stale.push(`path ${p}`);
  }
  for (const [rel, keys] of Object.entries(NOUN_ALLOWED_STRINGS)) {
    const copy = COPY.get(rel) ?? [];
    for (const k of keys) if (!copy.some((c) => c.text.trim() === k)) stale.push(`${rel} → ${JSON.stringify(k)}`);
  }
  for (const [rel, names] of Object.entries(NOUN_ALLOWED_BRAND_LINES)) {
    const copy = COPY.get(rel) ?? [];
    for (const name of names) if (!copy.some((c) => c.owner === name)) stale.push(`brand line ${rel} → ${name}`);
  }
  for (const p of Object.keys(T_OFFSET_ALLOWED_PATHS)) {
    if (![...COPY].some(([rel, copy]) => rel.startsWith(p) && copy.some((c) => T_OFFSET.test(c.text)))) stale.push(`T-offset path ${p}`);
  }
  assert.deepEqual(stale, [], 'These allow-list entries match nothing any more — delete them:\n' + stale.join('\n'));
});

test('no UI string uses "T-1h" / "T+8h" offset notation', () => {
  const hits: string[] = [];
  for (const [rel, copy] of COPY) {
    if (allowedBy(rel, T_OFFSET_ALLOWED_PATHS)) continue;
    for (const { text, line } of copy) {
      if (T_OFFSET.test(text)) hits.push(`${rel}:${line} — ${JSON.stringify(text.replace(/\s+/g, ' ').trim().slice(0, 100))}`);
    }
  }
  assert.deepEqual(hits, [], 'Say when, in words ("6am on the day"), not "T-1h":\n' + hits.join('\n'));
  // the pattern itself bites on every shape the sweep found
  for (const s of ['T-1h', 'T+8h', '(T-1h → T+8h)', 'T+24hr', 'T-3 months', 'T-6mo', 'T+30d', 'T−1h']) assert.match(s, T_OFFSET, s);
  for (const s of ['T-shirt', 'at 8h', 'Type-1', 'GIFT-2']) assert.doesNotMatch(s, T_OFFSET, s);
});

test('the Hub says when it opens — and the words match the gate (6am to 6am, Philippine time — the one clock)', () => {
  // ⏱ Owner ruling 2, 10 Nov 2026: the supplier's "today" desk closes at 06:00 the morning after, with The Day.
  assert.equal(HUB_OPEN_WINDOW_PLAIN, '6am to 6am the next morning, Philippine time');
  const day = [{ bookedDate: '2026-12-12' }];
  const at = (iso: string) => hasDayToday(day, phTodayIso(Date.parse(iso)));
  assert.equal(at('2026-12-11T21:59:59Z'), false, '05:59:59 on the day (PH) — not open yet');
  assert.equal(at('2026-12-11T22:00:00Z'), true, '06:00 on the day (PH) — open');
  assert.equal(at('2026-12-12T16:30:00Z'), true, '00:30 the morning after (PH) — still open (the after-party)');
  assert.equal(at('2026-12-12T21:59:59Z'), true, '05:59:59 the morning after (PH) — still open');
  assert.equal(at('2026-12-12T22:00:00Z'), false, '06:00 the morning after (PH) — closed');
  // …and the page shows those words, through the constant, from the same clock.
  const PAGE = 'app/vendor-dashboard/on-the-day/page.tsx';
  const page = readFileSync(join(WEB, PAGE), 'utf8');
  // Counted as CODE (identifiers, not the import, not a comment) — a docblock naming the
  // constant must not stand in for a sentence that stopped using it.
  // v13 (2026-10-29): the page says it twice (no events yet · The Day) and the event card once ("opens here on …").
  assert.equal(usesOf(PAGE, page, 'HUB_OPEN_WINDOW_PLAIN'), 2, 'the Hub page says when it opens in two places, all through the constant');
  const CARD = 'app/vendor-dashboard/on-the-day/_components/hub-screen.tsx';
  assert.equal(usesOf(CARD, readFileSync(join(WEB, CARD), 'utf8'), 'HUB_OPEN_WINDOW_PLAIN'), 1, 'the event card does not say when the Event Hub opens');
  const typed = [...(COPY.get(PAGE) ?? []), ...(COPY.get(CARD) ?? [])].filter((c) => /midnight|6 ?am/i.test(c.text));
  assert.deepEqual(typed, [], 'the Hub types the window out instead of reading HUB_OPEN_WINDOW_PLAIN');
  assert.match(page, /const phToday = \(\): string => phTodayIso\(\);/, 'the Hub page keeps its own clock again');
});

test('day-of mode says when it starts and ends — and the words match getDayOfPhase', () => {
  // ⏱ The one clock (owner ruling, 10 Nov 2026): 06:00 on the day → 06:00 the morning after the last day, venue time.
  assert.equal(DAY_OF_STARTS_PLAIN, '6am on the day');
  assert.equal(DAY_OF_ENDS_PLAIN, '6am the morning after');
  const tz = 'Asia/Manila';
  const phase = (iso: string) => getDayOfPhase('2026-12-12', tz, Date.parse(iso));
  assert.notEqual(phase('2026-12-11T21:59:59Z'), 'live', '05:59:59 on the day (Manila) — not yet');
  assert.equal(phase('2026-12-11T22:00:00Z'), 'live', '6am on the day (Manila) — on');
  assert.equal(phase('2026-12-12T21:59:59Z'), 'live', '05:59:59 the morning after — still on');
  assert.notEqual(phase('2026-12-12T22:00:00Z'), 'live', '6am the morning after — off');
  // the pages that say it read the constant
  const FEATURES = 'app/features/_sections/_HowItWorks.tsx';
  assert.equal(usesOf(FEATURES, readFileSync(join(WEB, FEATURES), 'utf8'), 'DAY_OF_STARTS_PLAIN'), 2, '/features says when day-of starts in two places');
  const help = publicHelpSourceText(); // help split 2026-11-14: every lib/help/*.ts
  assert.match(help, /Available from \$\{DAY_OF_STARTS_PLAIN\} until \$\{DAY_OF_ENDS_PLAIN\}/);
});
