import ts from 'typescript';

/**
 * Finds a QUANTITY a person reads that is printed without its thousands commas.
 *
 * Owner, 2026-09-27 (DECISION_LOG "EVERY NUMBER ON THE WEBSITE CARRIES
 * THOUSANDS COMMAS"): the event Overview's Papic tile read **"100050 shots
 * ready"**. *"all across the website. all needs to have a ','"*. The fix is one
 * formatter per kind — `formatCount` (lib/format-number.ts) for counts,
 * `formatPhp` & co. (lib/php.ts) for money — and this module is the DECISION
 * the repo-wide sweep in `numbers-carry-commas.test.ts` runs. It is pure (no
 * fs) so the test can RUN it over fixtures, not grep for it.
 *
 * ── WHAT IS A "RAW RENDER" ────────────────────────────────────────────────
 * A number-shaped expression reaching the reader UNFORMATTED:
 *   · a bare reference — `count`, `stats.total`, `papic.shotsLeft`
 *   · `guests.length`
 *   · arithmetic on those — `total - used`, `Math.max(0, credits)`
 *   · a stringification that drops grouping — `String(n)`, `n.toString()`,
 *     `n.toFixed(2)`
 * …walking through `a ? b : c`, `a ?? b`, `a || b`, `a && b`, parentheses,
 * `!` and `as`. Any OTHER call (`formatCount(n)`, `formatPhp(n)`,
 * `n.toLocaleString('en-PH')`, a plural helper) counts as formatted.
 *
 * ── WHERE IT LOOKS, AND WHY THERE ─────────────────────────────────────────
 *   · `jsx`       a `{…}` CHILD of a JSX element — text the page shows.
 *   · `template`  a `${…}` span of a template literal that is display copy
 *                 (not a key, class, URL, query, log line or error — see
 *                 `isNonDisplayTemplate`). Emails, share text, aria-labels.
 *
 * ── WHAT MAKES IT A QUANTITY — THREE INDEPENDENT SIGNALS ──────────────────
 *   1. `name`  the value's own name says so (QUANTITY_NAME), unless its prefix
 *              or suffix says it is a flag or a label (`hasPhotos`,
 *              `countLabel`, `pointsPct`).
 *   2. `noun`  whatever it is called, the copy right after it is a counted
 *              noun (`{n} guests`, `${k} photos`), or it stands on either side
 *              of a bare "of" / "/" (`{done} of {total}`, `{used}/{cap}`).
 *              This is the half that does not depend on anybody's naming.
 *   3. `money` it sits right after a hand-typed "₱" (`₱${fee}`): a peso figure
 *              that skipped `formatPhp` (lib/php.ts), the one money formatter.
 *
 * A bare NAME whose nearest declaration binds it to text (a string, a
 * template, `x.toLocaleString(…)`, a `format…`/`peso…` call, or `: string`) is
 * not a raw number — `const count = points.toLocaleString('en-PH')` is
 * already grouped. `String()` / `.toFixed()` never count as text.
 *
 * 🔑 A PROPERTY, NOT A PHRASING: no signal looks for a formatter's NAME
 * to call a site clean. A call is presumed to format; a reference, `.length`,
 * arithmetic or `String()` is presumed not to. Renaming a helper cannot make a
 * raw render pass, and a raw render cannot hide behind a comment.
 *
 * ⚠ KNOWN BLIND SPOTS (a syntactic scan, not a type check): a number held in a
 * variable with a neutral name AND not followed by a counted noun (`{n}` alone
 * in a tile) is not seen; nor is a value that escapes into a helper which then
 * prints it raw. `CountUp` is covered by its own rendered test instead.
 */

export type RawNumberWhere = 'jsx' | 'template';
export type RawNumberSignal = 'name' | 'noun' | 'money';

export type RawNumberFinding = {
  where: RawNumberWhere;
  signal: RawNumberSignal;
  /** The raw expression, whitespace-collapsed — the allowlist key with the path. */
  expr: string;
  line: number;
  /** Source offsets of the raw expression (for tooling; never an allowlist key). */
  start: number;
  end: number;
};

/** The quantity words the owner's rule is about (and what the Papic tile tripped on). */
export const QUANTITY_NAME =
  /(count|total|shots|photos|credits|guests|captures|views|points|amount|bytes)/i;

/** The same list as whole WORDS of a name (see `nameWords`). */
const QUANTITY_WORD =
  /^(count|counts|total|totals|shots|photos|credits|guests|captures|views|points|amount|amounts|bytes|headcount|pax)$/;

/** A name that STARTS like this is a flag, not a figure: `hasPhotos`, `showCount`. */
const FLAG_PREFIX =
  /^(is|has|have|show|shows|can|should|did|was|were|with|without|no|allow|allows|enable|enabled|needs|want|wants|use|uses|set|get|on|handle|toggle|include|includes|hide)[A-Z_]/;

/**
 * A name that ENDS like this is a label, an id, a ratio or a collection — not a
 * count to group. (`pointsPct` is a percentage under 1,000; `countLabel` is
 * already a string; `photosUrl` is an address.)
 */
const NOT_A_QUANTITY_SUFFIX =
  /(label|labels|text|url|urls|href|id|ids|key|keys|str|string|copy|line|lines|title|name|names|noun|word|words|pct|percent|percentage|ratio|rate|fraction|index|idx|class|classname|style|tone|color|colour|icon|kind|type|mode|status|state|message|msg|hint|caption|display|formatted|fmt|pretty|phrase|summary|note|unit|units|suffix|prefix|chip|pill|badge|sentence|node|el|ref|at|date|time|visible|open|enabled|disabled|list|map|set|rows|items|array|slot|slots|query|path|href|src|limit|cap|max|min|step|column|col|field|by|fn|cb|handler|error|err|sql|payload|data|body|html|json)$/i;

/** Counted nouns: whatever the value is called, `N <noun>` is a quantity. */
export const COUNTED_NOUN =
  /^\s*(?:more\s+|new\s+|of\s+|x\s+|×\s*)?(guests?|photos?|shots?|credits?|captures?|views?|points?|pts|people|persons?|attendees?|seats?|tickets?|items?|orders?|bookings?|events?|suppliers?|vendors?|videos?|clips?|messages?|files?|likes?|votes?|rsvps?|pax|downloads?|uploads?|images?|pictures?|prints?|copies|invites?|invitations?|sponsors?|tables?\s+of|replies|reviews?|inquiries|leads?|visitors?|visits?|clicks?|followers?|members?|couples?|accounts?|users?|bytes|kb|mb|gb|coins?|tokens?|stars?|hearts?|reactions?|comments?|scans?|taps?|plays?)\b/i;

/** JSX attributes whose value is never read as prose. */
const NON_DISPLAY_ATTR =
  /^(key|className|class|href|src|srcSet|id|style|htmlFor|name|d|viewBox|transform|width|height|to|action|formAction|value|defaultValue|min|max|step|type|role|target|rel|method|encType|accept|pattern|form|list|points|x|y|cx|cy|r|rx|ry|x1|x2|y1|y2|fill|stroke|strokeDasharray|strokeDashoffset|offset|gradientTransform|path|as|sizes|media|poster|download|lang|dir|tabIndex|autoComplete|inputMode|slot|ref|data-[\w-]+)$/;

/** A call whose template argument is plumbing, not copy. */
const NON_DISPLAY_CALLEE =
  /(^|\.)(log|info|warn|error|debug|trace|captureException|captureMessage|addBreadcrumb|fetch|redirect|permanentRedirect|push|replace|prefetch|revalidatePath|revalidateTag|from|eq|neq|in|or|and|filter|ilike|like|select|rpc|order|match|contains|textSearch|setAttribute|querySelector|querySelectorAll|getElementById|encodeURIComponent|encodeURI|createHash|update|digest|assert|equal|ok|strictEqual|deepEqual|match|test|exec|RegExp|URL|URLSearchParams|Error|TypeError|RangeError|keyframes|css|animate|setProperty|translate|scale|rotate|toFixed|padStart|padEnd|join|split|localStorage|sessionStorage|getItem|setItem|removeItem|set|get|has|delete|cookies|headers|append|put|upload|download|createSignedUrl|createSignedUploadUrl|getPublicUrl|list|remove|move|copy|storage|toDataURL|drawImage|fillText|measureText|require|import)$/;

/** A variable/property name that holds plumbing, not copy. */
const NON_DISPLAY_BINDING_WORD =
  /^(key|keys|id|url|href|path|slug|class|classname|query|sql|cache|storage|filename|file|filepath|selector|style|transform|gradient|clip|mask|filter|shadow|color|colour|fill|stroke|viewbox|d|points|width|height|size|pos|position|offset|margin|padding|inset|translate|grid|template|cols|columns|rows|area|areas|font|delay|duration|anchor|hash|token|cookie|header|etag|sig|signature|log|debug|trace|reason|code|err|error|detail|stack|dedupe|idempotency|lock|channel|topic|room|bucket|prefix|suffix|pattern|regex|re|filepath|classname|viewbox|x|y|aspect|ratio)$/;

/** Judged on the LAST WORD of the name, so `headlined` is not read as `…d`. */
function bindingIsPlumbing(name: string): boolean {
  const words = nameWords(name);
  const last = words[words.length - 1] ?? '';
  return NON_DISPLAY_BINDING_WORD.test(last);
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The last identifier of an access chain: `a.b.guestCount` → `guestCount`. */
function leafName(node: ts.Expression): string | null {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) {
    if (node.name.text === 'length') {
      const obj = leafName(node.expression);
      return obj === null ? null : `${obj}.length`;
    }
    return node.name.text;
  }
  if (ts.isElementAccessExpression(node)) {
    const arg = node.argumentExpression;
    if (ts.isStringLiteral(arg)) return arg.text;
    // `SAFETY_POINTS[0]` is one ITEM of a list, not a figure.
    if (ts.isNumericLiteral(arg)) return null;
    return leafName(node.expression);
  }
  return null;
}

/**
 * The words of an identifier: `lockedGuestCount` → [locked, guest, count],
 * `hit_count_30d` → [hit, count, 30d]. Matching WORDS rather than substrings is
 * what keeps `discountReason`, `account_number` and `countdown` out.
 */
export function nameWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

/** Does a NAME read as a quantity? */
export function isQuantityName(name: string): boolean {
  let base = name;
  if (name.endsWith('.length')) {
    base = name.slice(0, -'.length'.length);
    return nameWords(base).some((w) => QUANTITY_WORD.test(w)) && !FLAG_PREFIX.test(base);
  }
  const words = nameWords(base);
  if (!words.some((w) => QUANTITY_WORD.test(w))) return false;
  if (FLAG_PREFIX.test(base)) return false;
  const last = words[words.length - 1] ?? '';
  // An exact quantity word as the LAST word is a quantity (`guestCount`,
  // `total`); anything else ending in a label/id/ratio word is not.
  if (!QUANTITY_WORD.test(last) && NOT_A_QUANTITY_SUFFIX.test(last)) return false;
  return true;
}

/**
 * A name that reads as a STRING, not a number — the `noun` signal must not fire
 * on `{label} photos` or `{words.theHost}'s guests`.
 */
const STRINGY_WORD =
  /^(label|labels|name|names|text|title|lower|upper|possessive|host|organizer|organiser|email|reason|medal|noun|word|words|copy|verb|phrase|singular|plural|str|string|kind|type|category|categories|slug|url|href|id|ids|verified|pending|asked|changed|driven|drift|refs|summary|headline|caption|line|emoji|icon|status|state|tone|message|hint|note)$/;

export function isStringyName(name: string): boolean {
  const words = nameWords(name.replace(/\.length$/, ''));
  const last = words[words.length - 1] ?? '';
  return STRINGY_WORD.test(last);
}

type Raw = { node: ts.Expression; names: string[] };

/**
 * The raw number-shaped leaves an expression can evaluate to, walking the
 * branches a value passes through untouched. A call (other than `String`,
 * `.toString`, `.toFixed`, `Math.*`) is treated as a formatter and stops the walk.
 */
function rawLeaves(expr: ts.Expression, out: Raw[]): void {
  let e = expr;
  while (
    ts.isParenthesizedExpression(e) ||
    ts.isNonNullExpression(e) ||
    ts.isAsExpression(e) ||
    ts.isSatisfiesExpression(e) ||
    ts.isTypeAssertionExpression(e)
  ) {
    e = e.expression;
  }
  if (ts.isConditionalExpression(e)) {
    rawLeaves(e.whenTrue, out);
    rawLeaves(e.whenFalse, out);
    return;
  }
  if (ts.isBinaryExpression(e)) {
    const op = e.operatorToken.kind;
    if (
      op === ts.SyntaxKind.QuestionQuestionToken ||
      op === ts.SyntaxKind.BarBarToken
    ) {
      rawLeaves(e.left, out);
      rawLeaves(e.right, out);
      return;
    }
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
      rawLeaves(e.right, out);
      return;
    }
    if (
      op === ts.SyntaxKind.MinusToken ||
      op === ts.SyntaxKind.AsteriskToken ||
      op === ts.SyntaxKind.SlashToken ||
      op === ts.SyntaxKind.PercentToken ||
      op === ts.SyntaxKind.PlusToken
    ) {
      // `+` on two strings is concatenation; only a numeric-looking pair counts.
      const inner: Raw[] = [];
      rawLeaves(e.left, inner);
      rawLeaves(e.right, inner);
      if (inner.length > 0 || op !== ts.SyntaxKind.PlusToken) {
        const names = inner.flatMap((r) => r.names);
        if (op === ts.SyntaxKind.PlusToken && names.length === 0) return;
        out.push({ node: e, names });
      }
      return;
    }
    return;
  }
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.MinusToken) {
    rawLeaves(e.operand, out);
    return;
  }
  if (ts.isCallExpression(e)) {
    const callee = e.expression;
    // String(n)
    if (ts.isIdentifier(callee) && (callee.text === 'String' || callee.text === 'Number')) {
      const inner: Raw[] = [];
      if (e.arguments[0]) rawLeaves(e.arguments[0], inner);
      if (inner.length > 0) out.push({ node: e, names: inner.flatMap((r) => r.names) });
      return;
    }
    if (ts.isPropertyAccessExpression(callee)) {
      const method = callee.name.text;
      // n.toString() / n.toFixed(2) — a string with no grouping.
      if (method === 'toString' || method === 'toFixed') {
        const inner: Raw[] = [];
        rawLeaves(callee.expression, inner);
        const names = inner.flatMap((r) => r.names);
        const own = leafName(callee.expression);
        if (inner.length > 0 || own !== null) {
          out.push({ node: e, names: own !== null ? [...names, own] : names });
        }
        return;
      }
      // Math.max(0, credits) — still a bare number.
      if (ts.isIdentifier(callee.expression) && callee.expression.text === 'Math') {
        const inner: Raw[] = [];
        for (const a of e.arguments) rawLeaves(a, inner);
        out.push({ node: e, names: inner.flatMap((r) => r.names) });
        return;
      }
    }
    return; // any other call formats
  }
  const name = leafName(e);
  if (name !== null) {
    out.push({ node: e, names: [name] });
    return;
  }
  if (ts.isNumericLiteral(e)) {
    out.push({ node: e, names: [] });
  }
}

/** The plain text on either side of a JSX child expression. */
function jsxNeighbourText(node: ts.JsxExpression): { before: string; after: string } {
  const parent = node.parent;
  if (!parent || !(ts.isJsxElement(parent) || ts.isJsxFragment(parent))) {
    return { before: '', after: '' };
  }
  const kids = parent.children;
  const i = kids.indexOf(node as unknown as ts.JsxChild);
  const prev = kids[i - 1];
  const next = kids[i + 1];
  let after = next && ts.isJsxText(next) ? next.text : '';
  // `<strong>{n}</strong>{' '}guests` — the figure is the element's only content,
  // so the words that follow the ELEMENT are the words that follow the figure.
  const onlyChild = kids.filter((k) => !(ts.isJsxText(k) && k.containsOnlyTriviaWhiteSpaces)).length === 1;
  if (!after.trim() && onlyChild && ts.isJsxElement(parent)) after = textAfterElement(parent);
  return {
    before: prev && ts.isJsxText(prev) ? prev.text : '',
    after,
  };
}

/** The first plain text after an element, stepping over `{' '}` spacers. */
function textAfterElement(el: ts.JsxElement): string {
  const holder = el.parent;
  if (!holder || !(ts.isJsxElement(holder) || ts.isJsxFragment(holder))) return '';
  const kids = holder.children;
  for (let j = kids.indexOf(el) + 1; j < kids.length; j++) {
    const k = kids[j]!;
    if (ts.isJsxText(k)) {
      if (k.text.trim()) return ' ' + k.text.trimStart();
      continue;
    }
    if (ts.isJsxExpression(k) && k.expression && ts.isStringLiteral(k.expression) && !k.expression.text.trim()) {
      continue;
    }
    return '';
  }
  return '';
}

/** `3 of 1,200` · `12 / 3,000` — a figure beside another figure. */
const OF_OR_SLASH = /^\s*(of|\/)\s*$/;

/**
 * Whether a call's result is already TEXT (so a name bound to it is not a raw
 * number). `String()` / `.toFixed()` / `.toString()` are deliberately NOT here:
 * they are exactly the stringifications that drop the grouping.
 */
const TEXT_CALLEE =
  // ⚠ Not `…Php` / `php…`: `centavosToPhp` returns a NUMBER.
  /^(format\w*|fmt\w*|toLocaleString|join|peso|pesos|pesoText|pesoLabel|pesoFigure|pesoFromCentavos|php|plural\w*|pad\w*|trim|toUpperCase|toLowerCase|replace|slice)$|(Label|Text|Line|Copy|Phrase|Words|Sentence|Pesos)$/;

function isTextInitializer(init: ts.Expression): boolean {
  let e = init;
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e)) {
    e = e.expression;
  }
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isTemplateExpression(e)) {
    return true;
  }
  // `null` / `undefined` carry no digits to group (`cond ? feePesos(x) : null`).
  if (e.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(e) && e.text === 'undefined')) {
    return true;
  }
  if (ts.isConditionalExpression(e)) {
    return isTextInitializer(e.whenTrue) && isTextInitializer(e.whenFalse);
  }
  if (
    ts.isBinaryExpression(e) &&
    (e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      e.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  ) {
    return isTextInitializer(e.left) && isTextInitializer(e.right);
  }
  if (ts.isCallExpression(e)) {
    const c = e.expression;
    const name = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : '';
    if (name === 'String' || name === 'toFixed' || name === 'toString') return false;
    return TEXT_CALLEE.test(name);
  }
  return false;
}

type Binding = { scope: ts.Node; isText: boolean };

/** The block / function / file a declaration is visible in. */
function scopeOf(decl: ts.Node): ts.Node {
  if (ts.isParameter(decl)) return decl.parent;
  let n: ts.Node | undefined = decl.parent;
  while (n && !(ts.isBlock(n) || ts.isSourceFile(n) || ts.isFunctionLike(n) || ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isCaseClause(n))) {
    n = n.parent;
  }
  return n ?? decl.getSourceFile();
}

/** Every `const`/`let`/parameter binding in the file, by name. */
function collectBindings(sf: ts.SourceFile): Map<string, Binding[]> {
  const out = new Map<string, Binding[]>();
  const visit = (n: ts.Node) => {
    if ((ts.isVariableDeclaration(n) || ts.isParameter(n)) && ts.isIdentifier(n.name)) {
      let isText = false;
      if (n.type) isText = n.type.kind === ts.SyntaxKind.StringKeyword;
      else if (n.initializer) isText = isTextInitializer(n.initializer);
      const list = out.get(n.name.text) ?? [];
      list.push({ scope: scopeOf(n), isText });
      out.set(n.name.text, list);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/**
 * Whether a bare name, AT THIS USE, is bound to text: the NEAREST enclosing
 * declaration of that name is a string or a formatter's result, or is declared
 * `: string` (`const count = points.toLocaleString('en-PH')` is already
 * grouped). A numeric binding of the same name elsewhere in the file does not
 * matter; one in an enclosing scope does.
 */
function boundToText(id: ts.Identifier, bindings: Map<string, Binding[]>, sf: ts.SourceFile): boolean {
  const list = bindings.get(id.text);
  if (!list) return false;
  const pos = id.getStart(sf);
  let best: Binding | null = null;
  for (const b of list) {
    if (b.scope.getStart(sf) > pos || b.scope.getEnd() < pos) continue;
    if (!best || b.scope.getEnd() - b.scope.getStart(sf) < best.scope.getEnd() - best.scope.getStart(sf)) {
      best = b;
    }
  }
  return best?.isText ?? false;
}

/** Whether a template literal is plumbing (a key, URL, class, query, log) rather than copy. */
export function isNonDisplayTemplate(tpl: ts.TemplateExpression): boolean {
  if (ts.isTaggedTemplateExpression(tpl.parent)) return true;
  const head = tpl.head.text;
  // A URL / path / query / CSS value.
  if (/^(\/|https?:|mailto:|tel:|#|\?|\.|data:|blob:|rgba?\(|hsla?\(|oklch\(|var\(|calc\(|url\(|linear-gradient|radial-gradient|translate|scale|rotate|matrix|repeat\(|minmax\()/i.test(head)) {
    return true;
  }
  let n: ts.Node = tpl;
  for (let depth = 0; n.parent && depth < 8; depth++) {
    const p: ts.Node = n.parent;
    if (ts.isJsxAttribute(p)) {
      const attr = p.name.getText();
      return NON_DISPLAY_ATTR.test(attr) || bindingIsPlumbing(attr);
    }
    if (ts.isPropertyAssignment(p) && p.initializer === n) {
      const key = p.name.getText().replace(/['"]/g, '');
      if (bindingIsPlumbing(key) || NON_DISPLAY_ATTR.test(key)) return true;
    }
    if (ts.isVariableDeclaration(p) && p.initializer === n) {
      const nm = p.name.getText();
      return bindingIsPlumbing(nm);
    }
    if (ts.isCallExpression(p) || ts.isNewExpression(p)) {
      const callee = p.expression.getText();
      return NON_DISPLAY_CALLEE.test(callee);
    }
    if (ts.isThrowStatement(p)) return true;
    if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const target = p.left.getText();
      if (/\.(style|className|href|src|id|textContent)\b|\.style\./.test(target)) return true;
      const last = target.split('.').pop() ?? '';
      return bindingIsPlumbing(last);
    }
    if (ts.isReturnStatement(p) || ts.isArrowFunction(p)) {
      // Returned from a function — judged by the function's own name, if any.
      const fn = ts.findAncestor(p, (a) => ts.isFunctionDeclaration(a) || ts.isVariableDeclaration(a) || ts.isMethodDeclaration(a) || ts.isPropertyAssignment(a));
      if (fn && 'name' in fn && fn.name) {
        const nm = (fn.name as ts.Node).getText();
        if (bindingIsPlumbing(nm) || /^(key|id|url|href|path|slug|cache|storage|class)/i.test(nm)) return true;
      }
      // An inline callback prop — `rowKey={(r) => `…`}` — is judged by its prop.
      const arrow = ts.isArrowFunction(p) ? p : ts.findAncestor(p, ts.isArrowFunction);
      const holder = arrow?.parent;
      if (holder && ts.isJsxExpression(holder) && holder.parent && ts.isJsxAttribute(holder.parent)) {
        const attr = holder.parent.name.getText();
        return NON_DISPLAY_ATTR.test(attr) || bindingIsPlumbing(attr);
      }
      return false;
    }
    n = p;
  }
  return false;
}

function spanIsPlumbing(before: string, after: string): boolean {
  // `?page=${n}`, `/p/${n}`, `row-${n}`, `${n}px`, `${n}%`, `${n}ms`
  if (/[=/?&#_\-:.@]$/.test(before)) return true;
  if (/^(px|%|ms|s\b|deg|rem|em|vh|vw|dvh|svh|fr|pt|ch|x\b|\)|\/|,\s*\d|\.\d|-|_|:|\.)/.test(after)) return true;
  return false;
}

/**
 * Scan one file's source for raw quantity renders. `fileName` decides only the
 * parser mode (`.tsx` → JSX), never whether the file is scanned.
 */
export function scanRawNumbers(fileName: string, source: string): RawNumberFinding[] {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const out: RawNumberFinding[] = [];
  const seen = new Set<number>();
  const bindings = collectBindings(sf);

  const report = (where: RawNumberWhere, raw: Raw, beforeText: string, followText: string) => {
    // A bare name bound (in its nearest scope) to text is not a raw number.
    if (ts.isIdentifier(raw.node) && boundToText(raw.node, bindings, sf)) return;
    let signal: RawNumberSignal | null = null;
    // `₱${n}` — a peso figure hand-spelled; it belongs to lib/php.ts's formatPhp.
    // A compact label (`₱850K`, `₱1.2M`) is below 1,000 by construction.
    if (/₱\s*$/.test(beforeText) && !/^[KkMmBb](?![a-z])/.test(followText) && !ts.isNumericLiteral(raw.node)) {
      signal = 'money';
    } else if (raw.names.some(isQuantityName)) signal = 'name';
    else if (
      (COUNTED_NOUN.test(followText) || OF_OR_SLASH.test(followText) || OF_OR_SLASH.test(beforeText)) &&
      !ts.isNumericLiteral(raw.node) &&
      !raw.names.some(isStringyName)
    ) {
      signal = 'noun';
    }
    if (!signal) return;
    const expr = collapse(raw.node.getText(sf));
    const line = sf.getLineAndCharacterOfPosition(raw.node.getStart(sf)).line + 1;
    const k = raw.node.getStart(sf);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ where, signal, expr, line, start: raw.node.getStart(sf), end: raw.node.getEnd() });
  };

  const visit = (node: ts.Node) => {
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      node.parent &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      const leaves: Raw[] = [];
      rawLeaves(node.expression, leaves);
      const { before, after } = jsxNeighbourText(node);
      for (const r of leaves) report('jsx', r, before, after);
    }
    if (ts.isTemplateExpression(node) && !isNonDisplayTemplate(node)) {
      const spans = node.templateSpans;
      for (let i = 0; i < spans.length; i++) {
        const span = spans[i]!;
        const before = i === 0 ? node.head.text : spans[i - 1]!.literal.text;
        const after = span.literal.text;
        if (spanIsPlumbing(before, after)) continue;
        const leaves: Raw[] = [];
        rawLeaves(span.expression, leaves);
        for (const r of leaves) report('template', r, before, after);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** One allowlist row: `<path> :: <expr> :: <reason>`. */
export type AllowRow = { path: string; expr: string; reason: string };

export function parseAllowlist(text: string): AllowRow[] {
  const rows: AllowRow[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(' :: ');
    if (parts.length < 3) {
      throw new Error(`allowlist row needs "path :: expr :: reason": ${line}`);
    }
    const [path, expr, ...rest] = parts;
    rows.push({ path: path!.trim(), expr: collapse(expr!), reason: rest.join(' :: ').trim() });
  }
  return rows;
}
