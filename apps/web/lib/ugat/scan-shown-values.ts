/**
 * scan-shown-values.ts — the SHOWN-VALUES check of the Root map (part 2,
 * slice 5).
 *
 * Owner, 2026-10-02 (DECISION_LOG "THE ROOT MAP ALSO CATCHES A NUMBER THAT
 * LOOKS LIVE BUT IS TYPED IN"): "if for example we say 190 days to go on the
 * screen, but all along the 190 days was hardcoded…". And ("TWO MORE THINGS
 * EVERY BUILD IS CHECKED FOR"): "the Root map's Shown-values check also flags
 * the SAME fact shown twice on one screen (e.g. days to go in the first screen
 * and again in a tile)".
 *
 *   typed-number  a digit next to a unit — days · guests · pax · tables · seats
 *                 · photos · couples · % · ₱ — written into a screen's text (a
 *                 JSX text node or a string literal in a `.tsx` file) instead
 *                 of coming from a variable. `{count} guests` is a variable and
 *                 is never flagged; `"190 days to go"` is. A RULE CONSTANT —
 *                 "within 7 days", "0% commission", "₱0", "(8/10/12 seats)" —
 *                 is allowed by `RULE_CONSTANTS`, each with its reason.
 *   duplicate     one calculation (`CALCULATIONS` in fields.ts) drawn by two
 *                 different files on one screen — the Home case, where the new
 *                 first screen shipped on top of the old tiles.
 *
 * Not scanned (the owner's sweep used the same fence, PROTOTYPE_VALUE_LEAKS
 * 2026-10-02): tests, `app/dev`, `app/prototype`, `app/demo-capture`,
 * `app/tour`, and files named demo/sample/fixture/mock — samples by design.
 * `lib/` copy is not scanned either (most of it is policy text); a number a
 * lib helper words for a screen reaches it through a variable.
 *
 * Filesystem access — generator, tests and the CI check only.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

import { CALCULATIONS } from './fields';
import { listSources, readQuoted, readTemplate } from './scan-screens';
import { screenFiles } from './scan-fields';
import type { Finding } from './root-map-checks';
import type { UgatScreensMap } from './screens';

/** Files that are samples by design — never a real event's screen. */
export const SAMPLE_PATH =
  /(?:^app\/(?:dev|prototype|demo-capture|tour)\/)|(?:demo|sample|fixture|mock|storybook)[^/]*\.tsx$|\.test\.tsx?$/i;

/**
 * Typed numbers that ARE the rule, not a reading. Each family has its reason;
 * a match anywhere in the sentence lets that one number through.
 */
export const RULE_CONSTANTS: ReadonlyArray<{ re: RegExp; why: string }> = [
  { re: /\b(?:within|after|every|for|up to|at least|than|over|under|per|each|in|first|last|past|next|from|keep(?:s)?|stay(?:s)?|lasts?)\s+(?:the\s+)?\d+\s*(?:-\s*)?days?\b/i, why: 'a time window the app enforces ("within 7 days", "every 28 days")' },
  { re: /\b\d+\s*-\s*days?\b|\b\d+\s*days?\s+(?:before|after|of|notice|grace|trial|window|in advance|prior|free|left to|to (?:pay|reply|confirm|cancel|respond|claim|accept|agree|decide|refund|try))\b/i, why: 'a period stated as a rule ("30-day", "7 days before")' },
  { re: /\b(?:commission|deposit|balance|off|discount|refund|fee|cap|vat|tax|keep|interest|markup|share|split|downpayment|down payment|surcharge|save|of the (?:total|price|amount))\b/i, why: 'a percentage or amount that is a policy, not a count ("0% commission", "save 20%")' },
  { re: /(?:\/\s*|\bevery\s+)?\b28\s*days\b/i, why: 'the 28-day billing cycle every supplier plan runs on' },
  { re: /₱\s?0(?!\d|[,.]\d)/, why: '"₱0" — free, the one price that never moves' },
  { re: /\d+(?:\s*\/\s*\d+)+\s*(?:seats|guests|pax)/i, why: 'a menu of sizes ("8/10/12 seats"), not a count' },
  { re: /\b(?:up to|max(?:imum)?|min(?:imum)?|at most|no more than|limit|capped at|cap of|cap)\s*\d+/i, why: 'a limit the app enforces ("up to 3 photos")' },
  { re: /\b100\s?%/, why: '"100%" — the whole of something (keep 100%, 100% yours)' },
  { re: /\b\d+\s*(?:-|–|to)\s*\d+\s*(?:days?|guests?|pax|tables?|seats?|photos?|%)/i, why: 'a range given as guidance ("150–200 guests"), not a reading' },
  // A fixed EXAMPLE sentence, on purpose — the Voice-match preview. Voice never carries facts
  // (`assertFactFree`), so the card shows the SHAPE of a price answer with sample figures.
  { re: /^Our (?:starting rates — .*\bfrom|Signature package is) ₱[\d,]+/, why: 'the Voice-match preview is a fixed EXAMPLE sentence (voice never carries facts), not a reading' },
  // The Add-a-service explainer's sample card — plainly labelled "A sample card — this is what couples browse."
  // It shows the SHAPE of a card (a starting price is one of its fields), not a reading from anyone's shop.
  { re: /^from ₱[\d,]+ per event$/, why: 'the sample card on the Add-a-service explainer, labelled as a sample — not a reading' },
];

const UNIT_NUMBER = /(?<![\w.$#/-])(\d[\d,]*(?:\.\d+)?)\s*(days?|guests?|pax|tables?|seats?|photos?|couples?)\b/i;
const PERCENT = /(?<![\w.$#/(-])(\d+(?:\.\d+)?)\s?%(?=[\s,.)!?:;]|$)/;
const PESO = /₱\s?\d[\d,]*(?:\.\d+)?/;
/** A string that is a style, not a sentence. */
const CSS_LIKE = /(?:gradient|calc\(|translate|rgba?\(|hsla?\(|oklch|color-mix|px\b|rem\b|vh\b|vw\b|deg\b|ease|cubic|inset|scale\(|opacity|var\(--|origin|uniform|vec[234]|[;{}]|:\s*-?\d|\bcenter\s+\d|^[\d.\s%,]+$)/i;

/** Every piece of text a `.tsx` file can render: JSX text nodes and string literals (placeholders and class names skipped). */
export function renderedTextIn(src: string): string[] {
  const out: string[] = [];
  // JSX text, including the words after or before an expression:
  // `<p>{n} days to go</p>` draws " days to go".
  // (tag→tag, expression→tag, tag→expression — never `}…{`, which is code).
  for (const m of src.matchAll(/>([^<>{}]+)<|\}([^<>{}]+)<|>([^<>{}]+)\{/g)) {
    // `&apos;` and friends are words, not code — read them before judging.
    const t = (m[1] ?? m[2] ?? m[3])!.replace(/&(?:apos|rsquo|lsquo);/g, "'").replace(/&(?:quot|ldquo|rdquo);/g, '"').replace(/&amp;/g, '&').replace(/&[a-z]+;|&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();
    // Code that slipped between braces — not prose, which may well use "; " and "(".
    const code = /=>|\bconst\s|\breturn\s|\w\(\s*'[^']*'\s*\)|;\s*$|;\s*(?:const|let|var|return|if)\b/.test(t);
    if (t && /[A-Za-z₱%]/.test(t) && !code && (m[1] !== undefined || !CSS_LIKE.test(t))) out.push(t);
  }
  let k = 0;
  while (k < src.length) {
    const c = src[k];
    if (c === "'" || c === '"' || c === '`') {
      const before = src.slice(Math.max(0, k - 24), k);
      const r = c === '`' ? { end: readTemplate(src, k).end, value: readTemplate(src, k).lit.value } : readQuoted(src, k);
      k = r.end;
      if (/(?:placeholder|className|class|style|d|viewBox|points|transform|src|href|id|key|type|name|rel|target|accept|pattern|inputMode|autoComplete)\s*[=:]\s*\{?\s*$/.test(before)) continue;
      if (/\b(?:import|from|require)\s*\(?\s*$/.test(before)) continue;
      // A `${…}` is a value read at run time: it becomes `#`, so "# attending"
      // reads as "a number from a variable, then a unit" — never a typed number.
      const t = r.value.replace(/\u0000/g, '#').replace(/\s+/g, ' ').trim();
      if (t && /[A-Za-z]/.test(t) && !CSS_LIKE.test(t)) out.push(t);
      continue;
    }
    k += 1;
  }
  return out;
}

/** The typed live-looking numbers in one piece of text, or none. */
export function typedNumbersIn(text: string): string[] {
  if (RULE_CONSTANTS.some((r) => r.re.test(text))) return [];
  const out: string[] = [];
  for (const re of [UNIT_NUMBER, PERCENT, PESO]) {
    const m = text.match(re);
    if (m) out.push(m[0].trim());
  }
  return out;
}

export interface ShownValuesOptions {
  webRoot: string;
  screens: UgatScreensMap;
}

export function scanShownValues(opts: ShownValuesOptions): Finding[] {
  const { webRoot, screens } = opts;
  const out: Finding[] = [];
  const srcCache = new Map<string, string>();
  const read = (rel: string) => {
    if (!srcCache.has(rel)) {
      try {
        srcCache.set(rel, stripComments(readFileSync(join(webRoot, rel), 'utf8')));
      } catch {
        srcCache.set(rel, '');
      }
    }
    return srcCache.get(rel)!;
  };

  // Which screens draw a file — for the finding's screen names.
  const closures = new Map<string, string[]>();
  for (const s of screens.screens) if (s.status !== 'stub') closures.set(s.route, screenFiles(webRoot, s.file));
  const screensOf = (rel: string) => [...closures].filter(([, files]) => files.includes(rel)).map(([r]) => r).sort();

  /* ── typed numbers ── */
  const seen = new Set<string>();
  for (const rel of listSources(webRoot)) {
    if (!rel.endsWith('.tsx') || !(rel.startsWith('app/') || rel.startsWith('components/'))) continue;
    if (SAMPLE_PATH.test(rel)) continue;
    for (const text of renderedTextIn(read(rel))) {
      const hits = typedNumbersIn(text);
      if (hits.length === 0) continue;
      const excerpt = text.length > 70 ? `${text.slice(0, 67)}…` : text;
      const key = `${rel} "${excerpt}"`;
      if (seen.has(key)) continue;
      seen.add(key);
      const on = screensOf(rel);
      out.push({
        check: 'typed-number',
        key,
        screens: on,
        file: rel,
        plain: `"${excerpt}" — ${hits.join(', ')} is typed into the text, not read from the event.`,
      });
    }
  }

  /* ── the same fact drawn twice on one screen ── */
  // A component DRAWS a calculation when it computes it (calls an anchor) or
  // writes its words. Only components count (`.tsx` under app/ or components/):
  // a lib helper is imported for many reasons, and a screen that imports it
  // does not thereby show what it can word.
  for (const s of screens.screens) {
    if (s.status === 'stub' || s.area === 'internal') continue;
    const files = (closures.get(s.route) ?? []).filter((f) => f.endsWith('.tsx') && !f.startsWith('lib/') && !SAMPLE_PATH.test(f));
    for (const calc of CALCULATIONS) {
      const calls = new RegExp(`(?<![\\w$.])(?:${calc.anchors.join('|')})\\s*\\(`);
      const drawers = files.filter((f) => {
        const src = read(f);
        return calls.test(src) || renderedTextIn(src).some((t) => calc.renders.some((re) => re.test(t)));
      });
      if (drawers.length < 2) continue;
      out.push({
        check: 'duplicate',
        key: `${s.route} shows ${calc.id}`,
        screens: [s.route],
        file: drawers[0]!,
        plain: `${s.route} works out or draws "${calc.name}" in ${drawers.length} places (${drawers.join(', ')}) — one fact, shown once.`,
      });
    }
  }
  return out.sort((a, b) => a.check.localeCompare(b.check) || a.key.localeCompare(b.key));
}
