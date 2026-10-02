/**
 * retired-names-scan.ts — finds a RETIRED FEATURE NAME where a person would
 * read it, and ignores it where only code reads it.
 *
 * ── THE RULE (owner, 2026-09-29) ────────────────────────────────────────────
 * *"Only Papic is customized and all other namings should be generic."*
 * Pakanta → **Music Maker** · Samahan → **Group** · Alaala → **Memories** ·
 * Alaga → **Loved ones** · Panood / Live Studio → **Live Watch** · Kwento → **Photo Notes**.
 * Papic and Patiktok keep their names.
 * The rename is of WORDS ON A SCREEN. Identifiers are deliberately NOT renamed:
 * `/studio/pakanta`, `pakanta_song_r2_key`, `samahan_stories`, the `PAKANTA`
 * SKU code and `lib/alaala-wall.ts` all stay, so old links keep working and
 * history keeps its keys (DECISION_LOG "ONLY PAPIC KEEPS A CUSTOM NAME").
 *
 * So the question a scanner must answer is per OCCURRENCE, not per file: is
 * this spelling a thing a couple, guest, supplier or admin reads — or is it a
 * key, a route, a column, a class name, an import path?
 *
 * ── HOW IT DECIDES (by AST position, never by a word list of files) ────────
 * Only two AST positions can put text on a screen: a JSX text child, and a
 * string/template literal. Comments are never visited, so prose ABOUT the old
 * names (every docblock in this area has some) cannot trip it.
 *
 *   · JSX text                         → every whole-word hit is visible.
 *   · a literal containing whitespace  → it is prose; a whole-word hit is
 *                                        visible UNLESS it is glued to code
 *                                        punctuation (`/pakanta`, `samahan_id`,
 *                                        `alaala-orb`, `admin.sidebar.pakanta`).
 *   · a literal with NO whitespace     → it is a key/route/path, EXCEPT when
 *                                        the whole literal is the Title-case
 *                                        word itself (`'Pakanta'`, `'Samahans'`)
 *                                        — that is a label. ALL-CAPS
 *                                        (`'PAKANTA'`) is the SKU code, kept.
 *   · an argument to `console.*` or a  → a server log line; skipped.
 *     `logXxx(…)` helper
 *   · a row's `common` context         → the ordinary word ("ang kwento" is
 *                                        Tagalog for "the story"); skipped.
 *
 * A lowercase bare literal (`'pakanta'`, `'samahan'`) is a key by construction
 * and is allowed. A capitalised one is a label and is not.
 *
 * ── ADDING A NAME LATER IS ONE LINE ─────────────────────────────────────────
 * When the owner retires another name, add a row to `RETIRED_NAMES` and fix what the guard
 * then prints — nothing else in this file changes.
 */
import ts from 'typescript';

export interface RetiredName {
  /** The retired spelling, as it used to be written on screen. */
  readonly was: string;
  /** What a person reads now. */
  readonly now: string;
  /** Regex SOURCE for the word, case-insensitive; an optional plural `s` is added. */
  readonly pattern: string;
  /**
   * Regex SOURCE (case-insensitive) matched against the text AROUND a hit that
   * marks the word as an ordinary word, not the feature. "kwento" is plain
   * Tagalog for "story" — *"Ibahagi ang inyong kwento"* is a sentence, not a
   * product name, and must stay.
   */
  readonly common?: string;
  /**
   * Match the exact spelling only. "On the Day" is the retired stage NAME;
   * "on the day of the wedding" is plain English and must stay.
   */
  readonly caseSensitive?: boolean;
}

export const RETIRED_NAMES: readonly RetiredName[] = [
  { was: 'Pakanta', now: 'Music Maker', pattern: 'pakanta' },
  { was: 'Samahan', now: 'Group', pattern: 'samahan' },
  // "Alaala" was also written "Ala Ala" / "Ala-ala" on screen.
  { was: 'Alaala', now: 'Memories', pattern: 'ala[- ]?ala' },
  { was: 'Alaga', now: 'Loved ones', pattern: 'alaga' },
  // Papic and Patiktok KEEP their names (DECISION_LOG 2026-09-29 "PATIKTOK
  // KEEPS ITS NAME") — never add them here.
  // Panood → Live Watch (owner 2026-09-30, verbatim: *"Live Watch seem
  // better"* — DECISION_LOG "THREE OF THE CONTROLLER'S OPEN QUESTIONS
  // ANSWERED" addendum). It was "Watch Live" (NINE PENDING DECISIONS #6), then
  // "Live Studio" (2026-09-29); "Watch Live" stays fine on the guest's watch
  // page. Code keys, routes and SKU codes (`panood`, `live-studio`,
  // `LIVE_STUDIO`) are identifiers and stay.
  { was: 'Panood', now: 'Live Watch', pattern: 'panood' },
  // …and the name it had for one day is retired with it.
  { was: 'Live Studio', now: 'Live Watch', pattern: 'live studio' },
  // Kwento → Photo Notes (owner 2026-09-29 "NINE PENDING DECISIONS" #9). The
  // Tagalog noun ("ang kwento", "inyong kwento") is a word, not the feature.
  {
    was: 'Kwento',
    now: 'Photo Notes',
    pattern: 'kwento',
    common: '\\b(?:ang|inyong|iyong|aming|ating|kanilang|kanyang|mong|ng)\\s+$',
  },
];

export interface RetiredNameFinding {
  readonly was: string;
  readonly now: string;
  readonly line: number;
  /** The literal / JSX text the hit sits in, collapsed to one line. */
  readonly text: string;
  /** The same text, longer — for a reasoned allowlist that must match past the first 140 characters. */
  readonly context: string;
}

/** Code punctuation that glues a word into a key, route, path or class name. */
const GLUED_BEFORE = /[A-Za-z0-9_/.\-@#=?&:${]$/;
const GLUED_AFTER = /^(?:[A-Za-z0-9_/\-(}]|!(?:inner|left)|\.[a-z_])/;

const CODE_ATTR = /^(className|id|key|href|src|name|type|role|htmlFor|style|slot|data-.*)$/;

function wordRe(name: RetiredName): RegExp {
  return new RegExp(`${name.pattern}(?:s)?`, name.caseSensitive ? 'g' : 'gi');
}

/**
 * Is the hit at `index` (length `len`) inside `text` a word a person reads?
 * `jsx` = the text is a JSX child (always prose).
 */
export function isVisibleHit(text: string, index: number, len: number, jsx: boolean): boolean {
  const before = text.slice(0, index);
  const after = text.slice(index + len);
  // Part of a longer word ("pakantaSong", "xsamahan") is never this name.
  if (/[A-Za-z0-9]$/.test(before) || /^[A-Za-z0-9]/.test(after)) return false;
  if (jsx) return true;
  if (/\s/.test(text.trim())) {
    return !GLUED_BEFORE.test(before) && !GLUED_AFTER.test(after);
  }
  // No whitespace: a key, route or path — unless the literal IS the
  // capitalised word (a label such as `'Pakanta'`).
  // ALL-CAPS bare (`'PAKANTA'`) is a SKU code, which is kept on purpose.
  const bare = text.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
  return bare.length === len && /^[A-Z][a-z]/.test(bare);
}

function collapse(s: string, max = 140): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Scan one file's SOURCE. `fileName` decides only the parser mode. */
export function scanRetiredNames(
  fileName: string,
  source: string,
  names: readonly RetiredName[] = RETIRED_NAMES,
): RetiredNameFinding[] {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const out: RetiredNameFinding[] = [];

  const check = (node: ts.Node, text: string, jsx: boolean) => {
    // A stylesheet held in a string carries `/* … */` notes no person reads.
    if (!jsx && text.includes('{') && text.includes('/*')) text = text.replace(/\/\*[\s\S]*?\*\//g, ' ');
    for (const name of names) {
      for (const m of text.matchAll(wordRe(name))) {
        if (!isVisibleHit(text, m.index!, m[0].length, jsx)) continue;
        if (name.common && new RegExp(name.common, 'i').test(text.slice(0, m.index!))) continue;
        out.push({
          was: name.was,
          now: name.now,
          line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          text: collapse(text),
          context: collapse(text, 1200),
        });
      }
    }
  };

  const visit = (node: ts.Node) => {
    // `console.*(…)` and `logXxx(…)` text goes to a server log, never to a screen.
    if (
      ts.isCallExpression(node) &&
      ((ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'console') ||
        (ts.isIdentifier(node.expression) && /^log[A-Z]/.test(node.expression.text)))
    ) {
      return;
    }
    if (ts.isJsxText(node)) {
      check(node, node.text, true);
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      // An import/export specifier is a path, never a word on a screen.
      const p = node.parent;
      // …nor is a class name, id, key or route held in a JSX attribute.
      const codeAttr = p && ts.isJsxAttribute(p) && CODE_ATTR.test(p.name.getText(sf));
      if (!(p && (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p))) && !codeAttr) {
        check(node, node.text, false);
      }
    } else if (ts.isTemplateExpression(node)) {
      // Judge the template as ONE piece of prose — its whitespace lives in the
      // head/spans together — with each `${…}` hole collapsed to a placeholder.
      const joined =
        node.head.text + node.templateSpans.map((s) => `\u0000${s.literal.text}`).join('');
      check(node, joined, false);
      for (const s of node.templateSpans) visit(s.expression);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}
