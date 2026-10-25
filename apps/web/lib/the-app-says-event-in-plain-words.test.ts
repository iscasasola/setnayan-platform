import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { DAY_OF_ENDS_PLAIN, DAY_OF_STARTS_PLAIN, getDayOfPhase } from '@/lib/day-of-mode';
import { HUB_OPEN_WINDOW_PLAIN, hasDayToday, phTodayIso } from '@/lib/vendor-day-picker';

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
  'lib/llms-txt.ts': 'machine-readable list of event types',
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
  // event-type keys / tags
  'lib/checklist-event-type-defs.ts': ['celebration'],
  'lib/event-anchor.ts': ['celebration'],
  'lib/event-brief.ts': ['celebration'],
  'lib/onboarding/type-questions.ts': ['celebration'],
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

/** Every piece of text in a file that could reach the screen, with its line. Comments and import paths are not copy. */
function copyIn(path: string, source = readFileSync(path, 'utf8')): { text: string; line: number }[] {
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: { text: string; line: number }[] = [];
  const push = (n: ts.Node, text: string) => out.push({ text, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
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
    for (const { text, line } of copy) {
      if (!NOUN.test(text) || keys.includes(text.trim())) continue;
      hits.push(`${rel}:${line} — ${JSON.stringify(text.replace(/\s+/g, ' ').trim().slice(0, 100))}`);
    }
  }
  assert.deepEqual(hits, [], 'House word: say "event", never "celebration" (or allow-list it here, with the reason):\n' + hits.join('\n'));
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
  assert.deepEqual(hits, [], 'Say when, in words ("noon the day before"), not "T-1h":\n' + hits.join('\n'));
  // the pattern itself bites on every shape the sweep found
  for (const s of ['T-1h', 'T+8h', '(T-1h → T+8h)', 'T+24hr', 'T-3 months', 'T-6mo', 'T+30d', 'T−1h']) assert.match(s, T_OFFSET, s);
  for (const s of ['T-shirt', 'at 8h', 'Type-1', 'GIFT-2']) assert.doesNotMatch(s, T_OFFSET, s);
});

test('the Hub says when it opens — and the words match the gate (midnight to midnight, Philippine time)', () => {
  assert.equal(HUB_OPEN_WINDOW_PLAIN, 'midnight to midnight, Philippine time');
  const day = [{ bookedDate: '2026-12-12' }];
  const at = (iso: string) => hasDayToday(day, phTodayIso(Date.parse(iso)));
  assert.equal(at('2026-12-11T15:59:59Z'), false, '23:59:59 the night before (PH) — not open yet');
  assert.equal(at('2026-12-11T16:00:00Z'), true, '00:00 on the day (PH) — open');
  assert.equal(at('2026-12-12T15:59:59Z'), true, '23:59:59 on the day (PH) — still open');
  assert.equal(at('2026-12-12T16:00:00Z'), false, '00:00 the day after (PH) — closed');
  // …and the page shows those words, through the constant, from the same clock.
  const PAGE = 'app/vendor-dashboard/on-the-day/page.tsx';
  const page = readFileSync(join(WEB, PAGE), 'utf8');
  // Counted as CODE (identifiers, not the import, not a comment) — a docblock naming the
  // constant must not stand in for a sentence that stopped using it.
  assert.equal(usesOf(PAGE, page, 'HUB_OPEN_WINDOW_PLAIN'), 4, 'the Hub page says when it opens in four places, all through the constant');
  const typed = (COPY.get(PAGE) ?? []).filter((c) => /midnight/i.test(c.text));
  assert.deepEqual(typed, [], 'the Hub page types the window out instead of reading HUB_OPEN_WINDOW_PLAIN');
  assert.match(page, /const phToday = \(\): string => phTodayIso\(\);/, 'the Hub page keeps its own clock again');
});

test('day-of mode says when it starts and ends — and the words match getDayOfPhase', () => {
  assert.equal(DAY_OF_STARTS_PLAIN, 'noon the day before');
  assert.equal(DAY_OF_ENDS_PLAIN, 'noon the day after');
  const tz = 'Asia/Manila';
  const phase = (iso: string) => getDayOfPhase('2026-12-12', tz, Date.parse(iso));
  assert.notEqual(phase('2026-12-11T03:59:59Z'), 'live', '11:59:59 the day before (Manila) — not yet');
  assert.equal(phase('2026-12-11T04:00:00Z'), 'live', 'noon the day before (Manila) — on');
  assert.equal(phase('2026-12-13T04:00:00Z'), 'live', 'noon the day after (Manila) — still on');
  assert.notEqual(phase('2026-12-13T04:00:01Z'), 'live', 'just past noon the day after — off');
  // the pages that say it read the constant
  const FEATURES = 'app/features/_sections/_HowItWorks.tsx';
  assert.equal(usesOf(FEATURES, readFileSync(join(WEB, FEATURES), 'utf8'), 'DAY_OF_STARTS_PLAIN'), 2, '/features says when day-of starts in two places');
  const help = readFileSync(join(WEB, 'lib/help.ts'), 'utf8');
  assert.match(help, /Available from \$\{DAY_OF_STARTS_PLAIN\} until \$\{DAY_OF_ENDS_PLAIN\}/);
});
