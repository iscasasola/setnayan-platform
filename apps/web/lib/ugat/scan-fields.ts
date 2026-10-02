/**
 * scan-fields.ts — fill the FIELDS layer of the Root map from the code.
 *
 * Same posture as `scan-screens.ts` (part 1): 🔑 SCANNED, NEVER TYPED. A
 * hand-written list of "which form saves what" is a list of what somebody
 * remembered. This reads the code and writes `fields.generated.json`, and
 * `scripts/check-ugat-screens.mjs` refuses a committed file that drifted.
 *
 * Filesystem access — generator, its tests and the CI check only.
 *
 * ── WHAT IT READS ───────────────────────────────────────────────────────────
 *  WRITES   `.from('t')…insert/update/upsert({ … })` — each key of the object
 *           literal is a home `t.key`; a nested object literal is a jsonb key
 *           `t.col.sub`. The object may be written inline, bound to a name in
 *           the same function (`const payload = { … }; payload.x = …`), inside
 *           `[…]` or a `.map(() => ({ … }))`, or spread in
 *           (`...(x ? { k } : {})`). `.rpc('fn', { … })` writes `rpc:fn.key`.
 *           An argument it cannot see into writes `t.?` (a table, columns unknown).
 *  FIELDS   inside any function that takes a FormData: `formData.get('x')`
 *           (and getAll/has). The value is followed through the function's
 *           own variables (`const first = clean(formData.get('first_name'))`).
 *           A field whose value reaches a write is SAVED there; one handed to
 *           another function, used as a row key (`.eq(…)`) or returned is
 *           USED; one that reaches none of those is DROPPED.
 *  FORMS    `<form action={X}>` and `formAction={X}` — X resolved through
 *           imports, `.bind(…)`, `useActionState(…)` and, one level up, a prop
 *           passed by the component's callers. Every static `name=` inside the
 *           form is an input; one no resolved action reads is NOT READ.
 *  READS    `.from('t')…select('a, b, rel(c)')` → `t.a`, `t.b`, `rel.c`;
 *           `select('*')` or no argument → `t.*`.
 *  STORES   `localStorage.setItem('k', …)` / sessionStorage.
 *  CALCS    a call to a `CALCULATIONS` anchor (`daysUntil(` …).
 *
 * ── WHICH SCREEN ────────────────────────────────────────────────────────────
 * A screen's code is its page plus what it imports: files under app/ and
 * components/ are followed three imports deep; a lib/ file is included but
 * not followed further (lib fans out into everything). A screen WRITES what
 * the server actions in that code write ('use server' files, inline 'use
 * server' functions, and direct client writes in app/components files).
 *
 * ── WHAT IT CANNOT SEE ──────────────────────────────────────────────────────
 * A payload assembled across files, a key computed at run time (`[k]: v`), a
 * `fetch('/api/…')` POST (the route handler's writes are recorded as writers,
 * but not tied to the screen), and inputs rendered by a child component (their
 * `name=` sits in the child's file). So "dropped" means "no path found in
 * this code" — every finding names the file to read before acting.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

import { CALCULATIONS, type ActionFacts, type FormFacts, type ScreenFacts, type UgatFieldsMap } from './fields';
import { listSources, readQuoted, readTemplate, PH } from './scan-screens';
import type { UgatScreensMap } from './screens';

/* ═══════════════════════════ small lexing helpers ═══════════════════════════ */

/** Index of the closer matching the opener at `i` (`{`, `(`, `[`), string-aware. -1 if none. */
export function closeOf(src: string, i: number): number {
  let depth = 0;
  let k = i;
  while (k < src.length) {
    const c = src[k];
    if (c === "'" || c === '"') {
      k = readQuoted(src, k).end;
      continue;
    }
    if (c === '`') {
      k = readTemplate(src, k).end;
      continue;
    }
    if (c === '{' || c === '(' || c === '[') depth += 1;
    else if (c === '}' || c === ')' || c === ']') {
      depth -= 1;
      if (depth === 0) return k;
      if (depth < 0) return -1;
    }
    k += 1;
  }
  return -1;
}

/** Split `text` at depth-0 commas (string-aware). */
function splitTop(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  let k = 0;
  while (k < text.length) {
    const c = text[k];
    if (c === "'" || c === '"') {
      k = readQuoted(text, k).end;
      continue;
    }
    if (c === '`') {
      k = readTemplate(text, k).end;
      continue;
    }
    if (c === '{' || c === '(' || c === '[') depth += 1;
    else if (c === '}' || c === ')' || c === ']') depth -= 1;
    else if (c === ',' && depth === 0) {
      out.push(text.slice(start, k));
      start = k + 1;
    }
    k += 1;
  }
  out.push(text.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** The literal value of a quoted or template string at the start of `text` (placeholders as `*`). */
function literalAt(text: string): string | null {
  const t = text.trimStart();
  const off = text.length - t.length;
  if (t[0] === "'" || t[0] === '"') return readQuoted(text, off).value;
  if (t[0] === '`') return readTemplate(text, off).lit.value.split(PH).join('*');
  return null;
}

/** End of the statement starting at `i`: the first depth-0 `;`, or a closer of the enclosing block. */
function statementEnd(src: string, i: number, max = 4000): number {
  let depth = 0;
  let k = i;
  const stop = Math.min(src.length, i + max);
  while (k < stop) {
    const c = src[k];
    if (c === "'" || c === '"') {
      k = readQuoted(src, k).end;
      continue;
    }
    if (c === '`') {
      k = readTemplate(src, k).end;
      continue;
    }
    if (c === '{' || c === '(' || c === '[') depth += 1;
    else if (c === '}' || c === ')' || c === ']') {
      if (depth === 0) return k;
      depth -= 1;
    } else if (c === ';' && depth === 0) return k;
    k += 1;
  }
  return stop;
}

/** Text with every string/template body blanked, so identifiers in strings are not mistaken for uses. */
function blankStrings(src: string): string {
  let out = '';
  let k = 0;
  while (k < src.length) {
    const c = src[k];
    if (c === "'" || c === '"') {
      const end = readQuoted(src, k).end;
      out += c + ' '.repeat(Math.max(0, end - k - 2)) + (end - k >= 2 ? c : '');
      k = end;
      continue;
    }
    if (c === '`') {
      // keep `${…}` bodies — they are code.
      let j = k + 1;
      out += '`';
      while (j < src.length && src[j] !== '`') {
        if (src[j] === '\\') {
          out += '  ';
          j += 2;
          continue;
        }
        if (src[j] === '$' && src[j + 1] === '{') {
          const close = closeOf(src, j + 1);
          const end = close < 0 ? src.length : close;
          out += '${' + blankStrings(src.slice(j + 2, end)) + '}';
          j = end + 1;
          continue;
        }
        out += src[j] === '\n' ? '\n' : ' ';
        j += 1;
      }
      out += '`';
      k = j + 1;
      continue;
    }
    out += c;
    k += 1;
  }
  return out;
}

/* ═══════════════════════════ functions in a file ═══════════════════════════ */

interface Fn {
  name: string;
  params: string;
  /** body span, `{`…`}` inclusive. */
  start: number;
  end: number;
  exported: boolean;
}

function functionsIn(src: string): Fn[] {
  const out: Fn[] = [];
  const push = (name: string, exported: boolean, parenAt: number) => {
    const pClose = closeOf(src, parenAt);
    if (pClose < 0) return;
    // optional return type (which may itself be `{ … }`), then `=>`? then `{`
    let k = pClose + 1;
    const ws = () => {
      while (k < src.length && /\s/.test(src[k]!)) k += 1;
    };
    ws();
    if (src[k] === ':') {
      k += 1;
      // A `{` is the body only when a complete type has just ended; after `:`,
      // `|`, `&`, `keyof`… it is a type literal (`): { ok: true } | { ok: false } {`).
      let expectType = true;
      for (let guard = 0; guard < 400 && k < src.length; guard += 1) {
        ws();
        const c = src[k]!;
        if (c === '{' && !expectType) break; // the body
        if (src.startsWith('=>', k)) break;
        if (c === '{' || c === '(' || c === '[') {
          const e = closeOf(src, k);
          if (e < 0) return;
          k = e + 1;
          expectType = false;
        } else if (c === '<') {
          let d = 0;
          while (k < src.length) {
            if (src[k] === '<') d += 1;
            else if (src[k] === '>') {
              d -= 1;
              if (d === 0) break;
            }
            k += 1;
          }
          k += 1;
          expectType = false;
        } else if (c === "'" || c === '"') {
          k = readQuoted(src, k).end;
          expectType = false;
        } else if (/[\w$]/.test(c)) {
          const w = src.slice(k).match(/^[\w$.]+/)![0];
          k += w.length;
          expectType = /^(?:keyof|typeof|readonly|infer|is|asserts|new)$/.test(w);
        } else if (c === '|' || c === '&' || c === '?' || c === ':') {
          k += 1;
          expectType = true;
        } else if (c === ';' || c === ',' || c === ')') return;
        else k += 1;
      }
    }
    ws();
    if (src.startsWith('=>', k)) {
      k += 2;
      ws();
    }
    if (src[k] !== '{') return;
    const end = closeOf(src, k);
    if (end < 0) return;
    out.push({ name, params: src.slice(parenAt + 1, pClose), start: k, end, exported });
  };
  for (const m of src.matchAll(/\b(export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*(?:<[^>()]*>)?\s*\(/g)) {
    push(m[2]!, Boolean(m[1]), m.index! + m[0].length - 1);
  }
  for (const m of src.matchAll(/\b(export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*(?:async\s*)?(?:<[^>()]*>)?\(/g)) {
    push(m[2]!, Boolean(m[1]), m.index! + m[0].length - 1);
  }
  return out.sort((a, b) => a.start - b.start);
}

/* ═══════════════════════════ imports ═══════════════════════════ */

interface ImportBinding {
  spec: string;
  /** the exported name in the source module; `*` for a namespace, `default` for a default import. */
  imported: string;
}

function importsIn(src: string): Map<string, ImportBinding> {
  const out = new Map<string, ImportBinding>();
  for (const m of src.matchAll(/\bimport\s+(?:type\s+)?([^;'"]*?)\s+from\s*['"]([^'"]+)['"]/g)) {
    const clause = m[1]!.trim();
    const spec = m[2]!;
    const ns = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (ns) out.set(ns[1]!, { spec, imported: '*' });
    const def = clause.match(/^([A-Za-z_$][\w$]*)\s*(?:,|$)/);
    if (def) out.set(def[1]!, { spec, imported: 'default' });
    const named = clause.match(/\{([^}]*)\}/);
    if (named) {
      for (const part of named[1]!.split(',')) {
        const p = part.trim().replace(/^type\s+/, '');
        if (!p) continue;
        const [a, b] = p.split(/\s+as\s+/).map((x) => x.trim());
        out.set((b ?? a)!, { spec, imported: a! });
      }
    }
  }
  return out;
}

/* ═══════════════════════════ object literals → homes ═══════════════════════════ */

interface Entry {
  key: string;
  value: string;
}

/** Entries of the object literal whose `{` is at `text[i]`. Spreads of literal objects are merged. */
function objectEntries(
  text: string,
  i: number,
  resolveIdent: (name: string) => string | null,
  depth = 0,
  extraAssign: (name: string) => Entry[] = () => [],
): Entry[] {
  const close = closeOf(text, i);
  if (close < 0) return [];
  const out: Entry[] = [];
  for (const part of splitTop(text.slice(i + 1, close))) {
    if (part.startsWith('...')) {
      const expr = part.slice(3).trim();
      if (depth > 3) continue;
      if (/^[A-Za-z_$][\w$]*$/.test(expr)) {
        const bound = resolveIdent(expr);
        if (bound) {
          const b = bound.indexOf('{');
          if (b >= 0) out.push(...objectEntries(bound, b, resolveIdent, depth + 1, extraAssign));
        }
        // `const patch = {}; patch.first_name = first; …update({ ...patch })`
        out.push(...extraAssign(expr));
        continue;
      }
      // `...(cond ? { a } : {})` — every literal object inside the spread.
      let k = 0;
      while ((k = expr.indexOf('{', k)) >= 0) {
        const c = closeOf(expr, k);
        if (c < 0) break;
        out.push(...objectEntries(expr, k, resolveIdent, depth + 1, extraAssign));
        k = c + 1;
      }
      continue;
    }
    const kv = part.match(/^(?:([A-Za-z_$][\w$]*)|'([^']+)'|"([^"]+)")\s*:\s*([\s\S]*)$/);
    if (kv) {
      out.push({ key: (kv[1] ?? kv[2] ?? kv[3])!, value: kv[4]! });
      continue;
    }
    if (/^[A-Za-z_$][\w$]*$/.test(part)) out.push({ key: part, value: part });
    // `[k]: v`, methods, getters: not statically a column.
  }
  return out;
}

/** Homes (and the value text feeding each) for one write argument. */
function homesOf(
  prefix: string,
  argText: string,
  resolveIdent: (name: string) => string | null,
  extraAssign: (name: string) => Entry[],
): Array<{ home: string; value: string }> {
  let text = argText.trim().replace(/\s+as\s+[\w.<>[\]|' ]+$/, '');
  let objText: string | null = null;
  let extra: Entry[] = [];
  if (text.startsWith('{')) objText = text;
  else if (text.startsWith('[')) {
    const b = text.indexOf('{');
    objText = b >= 0 ? text.slice(b) : null;
  } else if (/^[A-Za-z_$][\w$]*$/.test(text)) {
    const bound = resolveIdent(text);
    extra = extraAssign(text);
    if (bound) {
      // The LAST `=> ({` is the shape that is written: `.map(a => ({…})).filter(…).map(b => ({…}))`.
      const arrows = [...bound.matchAll(/=>\s*\(\s*\{/g)];
      const arrow = arrows.length ? arrows[arrows.length - 1]!.index! : -1;
      const b = arrow >= 0 ? bound.indexOf('{', arrow) : bound.trimStart().startsWith('{') || bound.trimStart().startsWith('[') ? bound.indexOf('{') : -1;
      if (b >= 0) objText = bound.slice(b);
    }
  } else {
    const arrow = text.search(/=>\s*\(\s*\{/);
    if (arrow >= 0) objText = text.slice(text.indexOf('{', arrow));
  }
  const out: Array<{ home: string; value: string }> = [];
  const walk = (p: string, entries: Entry[], depth: number) => {
    for (const e of entries) {
      const v = e.value.trim();
      if (v.startsWith('{') && depth < 3) {
        const inner = objectEntries(v, 0, resolveIdent, 0, extraAssign);
        if (inner.length) {
          walk(`${p}.${e.key}`, inner, depth + 1);
          continue;
        }
      }
      out.push({ home: `${p}.${e.key}`, value: e.value });
    }
  };
  if (objText) walk(prefix, objectEntries(objText, 0, resolveIdent, 0, extraAssign), 0);
  walk(prefix, extra, 0);
  if (out.length === 0) out.push({ home: `${prefix}.?`, value: text });
  return out;
}

interface WriteSite {
  at: number;
  table: string;
  homes: Array<{ home: string; value: string }>;
  /** The whole argument text — a field named anywhere in it reached the write. */
  arg: string;
}

const WRITE_VERB = /\.(insert|update|upsert)\s*\(/g;

function writeSites(
  src: string,
  scope: { start: number; end: number },
  resolveIdentAt: (name: string, at: number) => string | null,
  extraAssign: (name: string) => Entry[],
): WriteSite[] {
  const out: WriteSite[] = [];
  const body = src.slice(scope.start, scope.end);
  for (const m of body.matchAll(/\.from\(\s*(['"`])([a-z_][a-z0-9_]*)\1\s*\)/g)) {
    const at = scope.start + m.index! + m[0].length;
    const segEnd = statementEnd(src, at);
    const seg = src.slice(at, Math.min(segEnd, scope.end));
    // Only the chain hanging off THIS .from — stop at the next .from(.
    const nextFrom = seg.search(/\.from\(/);
    const chain = nextFrom >= 0 ? seg.slice(0, nextFrom) : seg;
    for (const v of chain.matchAll(WRITE_VERB)) {
      const open = v.index! + v[0].length - 1;
      const close = closeOf(chain, open);
      if (close < 0) continue;
      const args = splitTop(chain.slice(open + 1, close));
      const arg = args[0] ?? '';
      const resolveIdent = (name: string) => resolveIdentAt(name, at);
      out.push({ at, table: m[2]!, homes: homesOf(m[2]!, arg, resolveIdent, extraAssign), arg });
      break; // one verb per chain
    }
  }
  for (const m of body.matchAll(/\.rpc\(\s*(['"`])([a-z_][a-z0-9_]*)\1\s*,/g)) {
    const at = scope.start + m.index! + m[0].length;
    const open = scope.start + m.index! + m[0].indexOf('(');
    const close = closeOf(src, open);
    if (close < 0) continue;
    const args = splitTop(src.slice(open + 1, close));
    const arg = args[1] ?? '';
    const resolveIdent = (name: string) => resolveIdentAt(name, at);
    out.push({ at, table: `rpc:${m[2]}`, homes: homesOf(`rpc:${m[2]}`, arg, resolveIdent, extraAssign), arg });
  }
  return out;
}

/* ═══════════════════════════ field flow inside one function ═══════════════════════════ */

const PURE_CALLEE =
  /^(?:String|Number|Boolean|BigInt|parseInt|parseFloat|isNaN|isFinite|Math\.\w+|Number\.\w+|JSON\.parse|Array\.isArray|Array\.from|Object\.keys|encodeURIComponent|decodeURIComponent|notFound|console\.\w+|Error|TypeError|RangeError|clean\w*|str\w*|trim\w*|text|asString|toStr\w*|is[A-Z]\w*|valid\w*|assert\w*|has[A-Z]\w*|if|while|switch|for|catch|typeof|new Date|Date|Date\.parse|.*\.(?:trim|toLowerCase|toUpperCase|slice|substring|split|replace|replaceAll|includes|has|test|match|startsWith|endsWith|indexOf|padStart|padEnd|toFixed|localeCompare|getTime|some|every|find|filter|length))$/;

/**
 * The innermost-to-outermost callees whose argument list encloses `pos` in
 * `body`, plus `'return'` when the statement holding `pos` is a `return` (a
 * value handed back to the caller is used).
 */
function enclosingCallees(body: string, pos: number): string[] {
  const out: string[] = [];
  let depth = 0;
  let k = pos - 1;
  const stmtStart = (at: number) => {
    if (/^\s*return\b/.test(body.slice(at, at + 40))) out.push('return');
  };
  for (; k >= 0; k -= 1) {
    const c = body[k];
    if (c === ')' || c === ']' || c === '}') depth += 1;
    else if (c === '(' || c === '[' || c === '{') {
      if (depth > 0) {
        depth -= 1;
        continue;
      }
      if (c === '(') {
        const before = body.slice(Math.max(0, k - 80), k);
        const callee = before.match(/([A-Za-z_$][\w$.]*(?:\([^()]*\))?(?:\.[A-Za-z_$][\w$]*)*)\s*$/)?.[1] ?? '';
        out.push(callee.replace(/\([^()]*\)/g, ''));
      } else if (c === '{') {
        // A block `{` (after `)`, `=>`, `else`, `try`, `do` or a statement end) ends the search.
        const before = body.slice(Math.max(0, k - 12), k).trimEnd();
        if (/(?:\)|=>|else|try|do|finally|;|^)$/.test(before) || before === '') {
          stmtStart(k + 1);
          return out;
        }
      }
    } else if (c === ';' && depth === 0) {
      stmtStart(k + 1);
      return out;
    }
  }
  stmtStart(0);
  return out;
}

interface HelperReads {
  /** Fields the helper reads by literal name. */
  fields: string[];
  known: boolean;
  /** Parameter positions the helper uses as a key: `fd.get(key)` → the index of `key`. */
  keyParams: number[];
}

interface FlowResult {
  fields: string[];
  readsAll: boolean;
  handedOff: Set<string>;
  saves: Record<string, string[]>;
  dropped: string[];
}

function flowIn(
  src: string,
  fn: Fn,
  formObjs: string[],
  writes: WriteSite[],
  helperReads: (name: string, objArgIndex: number) => HelperReads | null,
): FlowResult {
  const body = src.slice(fn.start, fn.end + 1);
  const objAlt = formObjs.map((o) => o.replace(/\$/g, '\\$')).join('|');
  const getRe = new RegExp(`\\b(?:${objAlt})\\s*\\.(?:get|getAll|has)\\(\\s*`, 'g');
  const objWord = new RegExp(`(?<![\\w$.])(?:${objAlt})(?![\\w$])`);
  /**
   * Every field read in `text`: `formData.get('x')`, and a keyed reader
   * `str(formData, 'x')` — but only when the helper really does
   * `<param>.get(<key param>)`. `back(formData, 'bad_name')` passes a string
   * too, and is not a read.
   */
  const readsOf = (text: string): Array<{ field: string; at: number }> => {
    const out: Array<{ field: string; at: number }> = [];
    for (const m of text.matchAll(getRe)) {
      const lit = literalAt(text.slice(m.index! + m[0].length));
      if (lit !== null) out.push({ field: lit.replace(/\u0000/g, '*'), at: m.index! });
    }
    for (const m of text.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\(/g)) {
      if (!objWord.test(text.slice(m.index! + m[0].length, m.index! + m[0].length + 120))) continue;
      if (/^(?:get|getAll|has|String|Boolean|Number|if|while|for|switch|function)$/.test(m[1]!)) continue;
      const open = m.index! + m[0].length - 1;
      const close = closeOf(text, open);
      if (close < 0) continue;
      const args = splitTop(text.slice(open + 1, close));
      const objIdx = args.findIndex((x) => new RegExp(`^(?:${objAlt})$`).test(x));
      if (objIdx < 0) continue;
      const h = helperReads(m[1]!, objIdx);
      if (!h || !h.known) continue;
      // `const pricing = parsePricingFields(formData)` — the result carries every
      // field the helper reads, so `{ ...pricing }` in a write saves them.
      if (h.keyParams.length === 0) for (const f of h.fields) out.push({ field: f, at: m.index! });
      args.forEach((arg, i) => {
        if (!h.keyParams.includes(i)) return;
        const lit = literalAt(arg);
        if (lit !== null) out.push({ field: lit.replace(/\u0000/g, '*'), at: m.index! });
      });
    }
    return out;
  };
  const fieldsAt = readsOf(body);
  // A key the code computes (`for (const f of FIELDS) formData.get(f)`) reads
  // fields this scan cannot list — so nothing here may be judged dropped. A key
  // that is one of the function's own parameters is a keyed reader, handled
  // by its callers.
  const paramNames = splitTop(fn.params).map((x) => x.match(/^([A-Za-z_$][\w$]*)/)?.[1] ?? '');
  let dynamicKeys = false;
  for (const m of body.matchAll(getRe)) {
    if (literalAt(body.slice(m.index! + m[0].length)) !== null) continue;
    const id = body.slice(m.index! + m[0].length).match(/^([A-Za-z_$][\w$]*)\s*\)/)?.[1];
    if (id && paramNames.includes(id)) continue;
    dynamicKeys = true;
  }
  const readsAll = dynamicKeys || new RegExp(
    `Object\\.fromEntries\\(\\s*(?:${objAlt})\\b|\\b(?:${objAlt})\\.(?:entries|keys|values|forEach)\\(|\\bof\\s+(?:${objAlt})\\b|\\[\\s*\\.\\.\\.(?:${objAlt})\\b`,
  ).test(body);

  const handedOff = new Set<string>();
  const fields = new Set(fieldsAt.map((f) => f.field));
  let unknownHelper = false;
  // A helper the FormData is handed to: `parseThing(formData)`.
  for (const m of body.matchAll(new RegExp(`\\b([A-Za-z_$][\\w$]*)\\(([^()]{0,200}?)(?<![\\w$.])(?:${objAlt})\\s*[,)]`, 'g'))) {
    const name = m[1]!;
    if (/^(?:get|getAll|has|String|Boolean|Number)$/.test(name)) continue;
    const idx = (m[2]!.match(/,/g) ?? []).length;
    const r = helperReads(name, idx);
    if (!r || !r.known) unknownHelper = true;
    else if (r.keyParams.length === 0) for (const f of r.fields) (fields.add(f), handedOff.add(f));
  }

  // Variables derived from a field, through the function's own declarations.
  const derived = new Map<string, Set<string>>(); // var → fields
  const decls: Array<{ names: string[]; init: string; span: [number, number] }> = [];
  for (const m of body.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*|\{[^=]*?\}|\[[^=]*?\])\s*(?::[^=\n]+)?=(?![=>])\s*/g)) {
    const start = m.index! + m[0].length;
    const end = statementEnd(body, start, 3000);
    const pat = m[1]!;
    const names = /^[A-Za-z_$]/.test(pat)
      ? [pat]
      : [...pat.slice(1, -1).matchAll(/(?:[A-Za-z_$][\w$]*\s*:\s*)?(?:\.\.\.)?([A-Za-z_$][\w$]*)(?=\s*(?:,|=|$))/g)].map((x) => x[1]!);
    decls.push({ names, init: body.slice(start, end), span: [m.index!, end] });
  }
  for (const m of body.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*(?:\?\?|\|\||&&)?=(?![=>])\s*/g)) {
    const before = body.slice(Math.max(0, m.index! - 8), m.index!);
    if (/(?:const|let|var)\s+$/.test(before)) continue;
    const start = m.index! + m[0].length;
    const end = statementEnd(body, start, 3000);
    decls.push({ names: [m[1]!], init: body.slice(start, end), span: [m.index!, end] });
  }
  // `patch.first_name = first` — the object now carries the field into whatever writes it.
  for (const m of body.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)(?:\.[A-Za-z_$][\w$]*|\[[^\]\n]{1,60}\])+\s*=(?![=>])\s*/g)) {
    const start = m.index! + m[0].length;
    const end = statementEnd(body, start, 3000);
    decls.push({ names: [m[1]!], init: body.slice(start, end), span: [start, end] });
  }
  const initFields = (init: string): Set<string> => new Set(readsOf(init).map((r) => r.field));
  // The result of a database call is a new value (a row id, an error), not the
  // field that went in — `const { data: inserted } = await …insert({ name })`
  // does not carry `name` into `inserted.guest_id`.
  const isDbCall = (init: string) => /\.(?:from|rpc|insert|update|upsert|select|delete)\s*\(/.test(init);
  for (let pass = 0; pass < 4; pass += 1) {
    for (const d of decls) {
      if (isDbCall(d.init)) continue;
      const s = initFields(d.init);
      const code = blankStrings(d.init);
      for (const [v, fs] of derived) if (new RegExp(`(?<![\\w$.])${v.replace(/\$/g, '\\$')}(?![\\w$])`).test(code)) for (const f of fs) s.add(f);
      if (s.size === 0) continue;
      for (const n of d.names) {
        if (!derived.has(n)) derived.set(n, new Set());
        for (const f of s) derived.get(n)!.add(f);
      }
    }
  }

  // Which fields reach which write.
  const saves: Record<string, string[]> = {};
  const addSave = (f: string, home: string) => {
    (saves[f] ??= []).includes(home) || saves[f]!.push(home);
  };
  const reaches = (text: string): Set<string> => {
    const s = initFields(text);
    const code = blankStrings(text);
    for (const [v, fs] of derived) if (new RegExp(`(?<![\\w$.])${v.replace(/\$/g, '\\$')}(?![\\w$])`).test(code)) for (const f of fs) s.add(f);
    return s;
  };
  const inFn = (w: WriteSite) => w.at >= fn.start && w.at <= fn.end;
  for (const w of writes.filter(inFn)) {
    const all = reaches(w.arg);
    for (const h of w.homes) for (const f of reaches(h.value)) addSave(f, h.home);
    // A field in the argument but not attributable to one key (a bound payload) reached the table.
    for (const f of all) if (!saves[f]) addSave(f, `${w.table}.?`);
  }

  // USED without a write: handed to a non-pure call, a row key, or returned.
  const used = new Set<string>(Object.keys(saves));
  for (const f of handedOff) used.add(f);
  const blank = blankStrings(body);
  /**
   * Where an occurrence sits relative to the declarations: in a binding
   * position (`const x =` — not a use), inside the initializer of a variable
   * that is itself derived (that variable carries the field on), or neither.
   */
  const placeOf = (pos: number): 'binding' | 'carried' | 'free' => {
    for (const d of decls) {
      if (pos < d.span[0] || pos >= d.span[1]) continue;
      const eq = body.indexOf('=', d.span[0]);
      if (eq >= 0 && pos < eq) return 'binding';
      if (d.names.some((n) => derived.has(n))) return 'carried';
    }
    return 'free';
  };
  /**
   * A field tested in an `if (…)` whose branch writes — sets a payload key
   * (`row.visibility = 'coordinator_only'`) or calls a write — IS saved, as a
   * choice between values. `if (formData.get('prep') === 'on') row.x = …`.
   */
  const guardsAWrite = (pos: number): boolean => {
    let depth = 0;
    for (let k = pos - 1; k >= 0; k -= 1) {
      const c = blank[k];
      if (c === ')' || c === ']' || c === '}') depth += 1;
      else if (c === '(' || c === '[' || c === '{') {
        if (depth > 0) {
          depth -= 1;
          continue;
        }
        if (c !== '(') return false;
        if (!/\b(?:if|else\s+if)\s*$/.test(blank.slice(Math.max(0, k - 10), k))) continue;
        const close = closeOf(body, k);
        if (close < 0) return false;
        let j = close + 1;
        while (j < body.length && /\s/.test(body[j]!)) j += 1;
        const branch = body[j] === '{' ? body.slice(j, closeOf(body, j) + 1) : body.slice(j, statementEnd(body, j));
        return /\.(?:insert|update|upsert|rpc)\s*\(|[\w$\])]\s*\.\s*[\w$]+\s*=(?![=>])|\[[^\]\n]+\]\s*=(?![=>])/.test(branch);
      } else if (c === ';' && depth === 0) return false;
    }
    return false;
  };
  const judge = (pos: number, fs: Iterable<string>) => {
    if (guardsAWrite(pos)) {
      for (const f of fs) used.add(f);
      return;
    }
    const callees = enclosingCallees(blank, pos);
    if (callees.some((c) => c && !PURE_CALLEE.test(c))) for (const f of fs) used.add(f);
  };
  for (const [v, fs] of derived) {
    const re = new RegExp(`(?<![\\w$.])${v.replace(/\$/g, '\\$')}(?![\\w$])(?!\\s*:)`, 'g');
    for (const m of blank.matchAll(re)) {
      if (placeOf(m.index!) === 'binding') continue;
      judge(m.index!, fs);
    }
  }
  for (const f of fieldsAt) {
    // A field read inline (not through a variable that carries it).
    if (placeOf(f.at) === 'binding') continue;
    judge(f.at, [f.field]);
  }
  const dropped = readsAll || unknownHelper ? [] : [...fields].filter((f) => !used.has(f)).sort();
  for (const k of Object.keys(saves)) saves[k]!.sort();
  return { fields: [...fields].sort(), readsAll: readsAll || unknownHelper, handedOff, saves, dropped };
}

/* ═══════════════════════════ selects → reads ═══════════════════════════ */

export function parseSelect(table: string, sel: string): string[] {
  const out: string[] = [];
  const s = sel.replace(/\s+/g, ' ').trim();
  if (s === '' || s === '*') return [`${table}.*`];
  for (const item of splitTop(s)) {
    const nested = item.match(/^(?:[A-Za-z_]\w*\s*:\s*)?([a-z_][a-z0-9_]*)(?:![\w]+)*\s*\(([\s\S]*)\)$/);
    if (nested) {
      out.push(...parseSelect(nested[1]!, nested[2]!));
      continue;
    }
    const col = item.match(/^(?:[A-Za-z_]\w*\s*:\s*)?([a-z_][a-z0-9_]*|\*)(?:->>?[\s\S]*)?(?:::\w+)?$/);
    if (col) out.push(`${table}.${col[1]}`);
  }
  return out;
}

function readsIn(src: string, constOf: (name: string) => string | null): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/\.from\(\s*(['"`])([a-z_][a-z0-9_]*)\1\s*\)/g)) {
    const at = m.index! + m[0].length;
    const seg = src.slice(at, statementEnd(src, at));
    const nextFrom = seg.search(/\.from\(/);
    const chain = nextFrom >= 0 ? seg.slice(0, nextFrom) : seg;
    const sm = chain.match(/\.select\(\s*/);
    if (!sm) continue;
    const argText = chain.slice(sm.index! + sm[0].length);
    if (/^\)/.test(argText)) {
      out.push(`${m[2]}.*`);
      continue;
    }
    let lit = literalAt(argText);
    if (lit === null) {
      const id = argText.match(/^([A-Za-z_$][\w$]*)\s*[,)]/)?.[1];
      lit = id ? constOf(id) : null;
      if (lit === null) {
        // `'a, b' + REST` — the literal head still names columns.
        continue;
      }
    }
    // Concatenations: `'a, b, ' + 'c'` — read every literal in the argument.
    const close = closeOf(chain, chain.indexOf('(', sm.index!));
    const full = close > 0 ? chain.slice(sm.index! + sm[0].length, close) : argText;
    const parts = splitTop(full);
    const first = parts[0] ?? '';
    const lits: string[] = [];
    let k = 0;
    while (k < first.length) {
      const c = first[k];
      if (c === "'" || c === '"') {
        const r = readQuoted(first, k);
        lits.push(r.value);
        k = r.end;
        continue;
      }
      if (c === '`') {
        const r = readTemplate(first, k);
        lits.push(r.lit.value.replace(/\u0000/g, ''));
        k = r.end;
        continue;
      }
      k += 1;
    }
    const text = lits.length ? lits.join('') : lit;
    out.push(...parseSelect(m[2]!, text.replace(/\s*,\s*,/g, ',').replace(/^,|,$/g, '')));
  }
  return out;
}

/* ═══════════════════════════ forms ═══════════════════════════ */

interface RawForm {
  from: string;
  actionExprs: string[];
  inputs: string[];
  /** Capitalised components rendered inside the form — their own inputs post with it. */
  children: string[];
}

function formsIn(rel: string, src: string): RawForm[] {
  const out: RawForm[] = [];
  for (const m of src.matchAll(/<form\b/g)) {
    // the opening tag ends at the first depth-0 `>` that is not `=>`
    let k = m.index! + 5;
    let depth = 0;
    let openEnd = -1;
    while (k < src.length) {
      const c = src[k];
      if (c === "'" || c === '"') {
        k = readQuoted(src, k).end;
        continue;
      }
      if (c === '`') {
        k = readTemplate(src, k).end;
        continue;
      }
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0 && src[k - 1] !== '=') {
        openEnd = k;
        break;
      }
      k += 1;
    }
    if (openEnd < 0) continue;
    const open = src.slice(m.index!, openEnd + 1);
    const closeAt = src.indexOf('</form>', openEnd);
    const inner = closeAt > 0 ? src.slice(openEnd, closeAt) : '';
    const exprs: string[] = [];
    for (const a of (open + inner).matchAll(/\b(?:action|formAction)=\{/g)) {
      const base = a.index! + a[0].length - 1;
      const whole = open + inner;
      const c = closeOf(whole, base);
      if (c > 0) exprs.push(whole.slice(base + 1, c).trim());
    }
    const inputs = new Set<string>();
    for (const n of inner.matchAll(/<([A-Za-z][\w.]*)\b[^<>]*?\bname=(?:"([^"]+)"|'([^']+)'|\{\s*['"]([^'"]+)['"]\s*\}|\{`([^`$]+)`\})/g)) {
      if (/^meta$/i.test(n[1]!)) continue;
      const name = (n[2] ?? n[3] ?? n[4] ?? n[5])!;
      if (/\s/.test(name)) continue;
      inputs.add(name);
    }
    if (exprs.length === 0 && inputs.size === 0) continue;
    const children = [...new Set([...inner.matchAll(/<([A-Z][\w]*)\b/g)].map((c) => c[1]!))].sort();
    out.push({ from: rel, actionExprs: exprs, inputs: [...inputs].sort(), children });
  }
  return out;
}

/* ═══════════════════════════ the scan ═══════════════════════════ */

export interface ScanFieldsOptions {
  webRoot: string;
  screens: UgatScreensMap;
}

interface FileFacts {
  rel: string;
  src: string;
  isServerModule: boolean;
  fns: Fn[];
  imports: Map<string, ImportBinding>;
  consts: Map<string, string>;
  writes: WriteSite[];
  reads: string[];
  forms: RawForm[];
  stores: string[];
  calls: Set<string>;
}

const CALC_ANCHORS = new Set(CALCULATIONS.flatMap((c) => c.anchors));

export function scanFields(opts: ScanFieldsOptions): UgatFieldsMap {
  const { webRoot } = opts;
  const sources = listSources(webRoot).filter((r) => r !== 'next.config.ts' && r !== 'middleware.ts');
  const sourceSet = new Set(sources);

  const resolveSpec = (fromRel: string, spec: string): string | null => {
    let base: string;
    if (spec.startsWith('@/')) base = spec.slice(2);
    else if (spec.startsWith('.')) base = join(dirname(fromRel), spec).split(sep).join('/');
    else return null;
    for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) {
      const cand = base + ext;
      if (sourceSet.has(cand)) return cand;
      if (/\.(ts|tsx)$/.test(cand) && !sourceSet.has(cand) && existsSync(join(webRoot, cand))) return cand;
    }
    return null;
  };

  const cache = new Map<string, FileFacts>();
  const facts = (rel: string): FileFacts => {
    const hit = cache.get(rel);
    if (hit) return hit;
    let src = '';
    try {
      src = stripComments(readFileSync(join(webRoot, rel), 'utf8'));
    } catch {
      src = '';
    }
    const isServerModule = /^\s*(['"])use server\1/.test(src);
    const fns = functionsIn(src);
    const imports = importsIn(src);
    const consts = new Map<string, string>();
    const declsOf = new Map<string, Array<{ at: number; text: string }>>();
    for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=(?![=>])\s*/g)) {
      const start = m.index! + m[0].length;
      const text = src.slice(start, statementEnd(src, start, 6000));
      if (!consts.has(m[1]!)) consts.set(m[1]!, text);
      if (!declsOf.has(m[1]!)) declsOf.set(m[1]!, []);
      declsOf.get(m[1]!)!.push({ at: m.index!, text });
    }
    /** The declaration of `name` nearest BEFORE `at` — names are reused across functions. */
    const resolveIdentAt = (name: string, at: number): string | null => {
      const ds = declsOf.get(name);
      if (!ds) return null;
      let best: string | null = null;
      for (const d of ds) if (d.at < at) best = d.text;
      return best;
    };
    const extraAssign = (name: string): Entry[] => {
      const out: Entry[] = [];
      for (const a of src.matchAll(new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}(?:\\.([A-Za-z_$][\\w$]*)|\\[\\s*['"]([^'"]+)['"]\\s*\\])\\s*=(?![=>])\\s*`, 'g'))) {
        const start = a.index! + a[0].length;
        out.push({ key: (a[1] ?? a[2])!, value: src.slice(start, statementEnd(src, start, 2000)) });
      }
      return out;
    };
    const writes = /\.(?:insert|update|upsert|rpc)\s*\(/.test(src)
      ? writeSites(src, { start: 0, end: src.length }, resolveIdentAt, extraAssign)
      : [];
    const constLiteral = (name: string): string | null => {
      const c = consts.get(name);
      return c ? literalAt(c) : null;
    };
    const reads = src.includes('.select(') ? readsIn(src, constLiteral) : [];
    const forms = rel.endsWith('.tsx') && src.includes('<form') ? formsIn(rel, src) : [];
    const stores: string[] = [];
    for (const m of src.matchAll(/\b(?:window\.)?(local|session)Storage\.setItem\(\s*/g)) {
      const lit = literalAt(src.slice(m.index! + m[0].length));
      if (lit) stores.push(`store:${m[1]}Storage.${lit}`);
    }
    const calls = new Set<string>();
    for (const a of CALC_ANCHORS) if (new RegExp(`(?<![\\w$.])${a}\\s*\\(`).test(src)) calls.add(a);
    const f: FileFacts = { rel, src, isServerModule, fns, imports, consts, writes, reads, forms, stores, calls };
    cache.set(rel, f);
    return f;
  };

  /* ── actions: every function that takes a FormData ── */
  const actionCache = new Map<string, ActionFacts | null>();
  const formObjsOf = (fn: Fn): string[] => {
    const objs = new Set<string>();
    for (const m of fn.params.matchAll(/([A-Za-z_$][\w$]*)\s*\??\s*:\s*FormData\b/g)) objs.add(m[1]!);
    for (const m of fn.params.matchAll(/(?<![\w$.])(formData|fd)\b(?!\s*:)/g)) objs.add(m[1]!);
    return [...objs];
  };
  const fnByName = (f: FileFacts, name: string): Fn | undefined =>
    f.fns.find((x) => x.name === name);

  const helperCache = new Map<string, HelperReads>();
  const helperReadsFor =
    (f: FileFacts, depth: number) =>
    (name: string, argIdx: number): HelperReads | null => {
      const unknown: HelperReads = { fields: [], known: false, keyParams: [] };
      if (depth > 2) return unknown;
      let file = f;
      let fname = name;
      if (!fnByName(f, name)) {
        const imp = f.imports.get(name);
        if (!imp || imp.imported === '*' || imp.imported === 'default') return unknown;
        const target = resolveSpec(f.rel, imp.spec);
        if (!target) return unknown;
        file = facts(target);
        fname = imp.imported;
      }
      const key = `${file.rel}#${fname}#${argIdx}`;
      const hit = helperCache.get(key);
      if (hit) return hit;
      helperCache.set(key, unknown); // recursion guard
      const fn = fnByName(file, fname);
      if (!fn) return unknown;
      const params = splitTop(fn.params).map((x) => x.match(/^([A-Za-z_$][\w$]*)/)?.[1] ?? '');
      const p = params[argIdx];
      if (!p) return unknown;
      const fbody = file.src.slice(fn.start, fn.end + 1);
      const keyParams: number[] = [];
      for (const m of fbody.matchAll(new RegExp(`(?<![\\w$.])${p.replace(/\$/g, '\\$')}\\s*\\.(?:get|getAll|has)\\(\\s*([A-Za-z_$][\\w$]*)\\s*\\)`, 'g'))) {
        const i = params.indexOf(m[1]!);
        if (i >= 0 && !keyParams.includes(i)) keyParams.push(i);
      }
      const r = flowIn(file.src, fn, [p], [], helperReadsFor(file, depth + 1));
      const out: HelperReads = { fields: r.fields, known: !r.readsAll, keyParams };
      helperCache.set(key, out);
      return out;
    };

  const actionFacts = (rel: string, name: string): ActionFacts | null => {
    const ref = `${rel}#${name}`;
    if (actionCache.has(ref)) return actionCache.get(ref)!;
    actionCache.set(ref, null);
    const f = facts(rel);
    const fn = fnByName(f, name);
    if (!fn) return null;
    const objs = formObjsOf(fn);
    const inFn = f.writes.filter((w) => w.at >= fn.start && w.at <= fn.end);
    // Only a function a person's submit lands in is an action: a server action
    // ('use server' export or inline), or a component's own submit handler. A
    // parse helper (`str(fd, 'x')`, `parseInvitedToBlocks(fd)`) is followed
    // through the action that calls it — looked at alone, its field is used in
    // a condition and returned, which would read as "dropped".
    const head = f.src.slice(fn.start + 1, fn.start + 80);
    const isAction =
      (f.isServerModule && fn.exported) || /^\s*(['"])use server\1/.test(head) || (objs.length > 0 && rel.endsWith('.tsx') && !fn.exported);
    if (!isAction) return null;
    const flow = objs.length
      ? flowIn(f.src, fn, objs, f.writes, helperReadsFor(f, 0))
      : { fields: [], readsAll: false, saves: {}, dropped: [] as string[] };
    const writes = [...new Set(inFn.flatMap((w) => w.homes.map((h) => h.home)))].sort();
    const a: ActionFacts = {
      ref,
      fields: flow.fields,
      readsAll: flow.readsAll,
      writes,
      saves: flow.saves,
      dropped: flow.dropped,
    };
    actionCache.set(ref, a);
    return a;
  };

  /* ── who imports whom (for prop-passed actions) ── */
  const importers = new Map<string, Array<{ rel: string; local: string; imported: string }>>();
  for (const rel of sources) {
    if (!rel.endsWith('.tsx')) continue;
    const f = facts(rel);
    for (const [local, b] of f.imports) {
      const t = resolveSpec(rel, b.spec);
      if (!t) continue;
      if (!importers.has(t)) importers.set(t, []);
      importers.get(t)!.push({ rel, local, imported: b.imported });
    }
  }

  /** Resolve an action expression in a file to action refs. */
  const resolveAction = (rel: string, exprIn: string, depth = 0): string[] | null => {
    if (depth > 3) return null;
    const f = facts(rel);
    let expr = exprIn.trim().replace(/\.bind(?:\([\s\S]*\))?$/, '').replace(/^\(\s*|\s*\)$/g, '').trim();
    if (/=>|\bfunction\b/.test(expr)) {
      // an inline handler: the action it calls with the FormData.
      const call = expr.match(/(?:await\s+)?([A-Za-z_$][\w$.]*)\(\s*(?:[^(),]*,\s*)*(?:fd|formData|data|form)\s*\)/);
      if (!call) return null;
      expr = call[1]!;
    }
    const ns = expr.match(/^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/);
    if (ns) {
      const imp = f.imports.get(ns[1]!);
      if (imp?.imported === '*') {
        const t = resolveSpec(rel, imp.spec);
        if (t && actionFacts(t, ns[2]!)) return [`${t}#${ns[2]}`];
      }
      return null;
    }
    if (!/^[A-Za-z_$][\w$]*$/.test(expr)) return null;
    const imp = f.imports.get(expr);
    if (imp && imp.imported !== '*' && imp.imported !== 'default') {
      const t = resolveSpec(rel, imp.spec);
      if (t && actionFacts(t, imp.imported)) return [`${t}#${imp.imported}`];
      return null;
    }
    if (fnByName(f, expr) && actionFacts(rel, expr)) return [`${rel}#${expr}`];
    // const X = Y.bind(…) / useActionState(Y, …) / useFormState(Y, …) / useCallback(Y …)
    const bound = f.src.match(
      new RegExp(`(?:const|let)\\s+(?:${expr.replace(/\$/g, '\\$')}|\\[[^\\]]*\\b${expr.replace(/\$/g, '\\$')}\\b[^\\]]*\\])\\s*(?::[^=\\n]+)?=\\s*(?:React\\.)?(?:(?:useActionState|useFormState|useCallback|useTransition)\\(\\s*)?([A-Za-z_$][\\w$.]*)`),
    );
    if (bound && bound[1] !== expr && !/^(?:use|React)/.test(bound[1]!)) {
      return resolveAction(rel, bound[1]!.replace(/\.bind$/, ''), depth + 1);
    }
    // A prop: the callers pass it.
    const callers = importers.get(rel) ?? [];
    const out = new Set<string>();
    for (const c of callers) {
      const cf = facts(c.rel);
      for (const m of cf.src.matchAll(new RegExp(`<${c.local.replace(/\$/g, '\\$')}\\b[^>]*?\\b${expr.replace(/\$/g, '\\$')}=\\{`, 'g'))) {
        const open = m.index! + m[0].length - 1;
        const close = closeOf(cf.src, open);
        if (close < 0) continue;
        const r = resolveAction(c.rel, cf.src.slice(open + 1, close), depth + 1);
        if (r) for (const x of r) out.add(x);
      }
    }
    return out.size ? [...out] : null;
  };

  /* ── every file once: forms, writers, stores ── */
  const forms: FormFacts[] = [];
  const writers: Array<{ from: string; homes: string[] }> = [];
  const stores: Array<{ from: string; key: string }> = [];
  for (const rel of sources) {
    const f = facts(rel);
    if (f.writes.length) {
      writers.push({ from: rel, homes: [...new Set(f.writes.flatMap((w) => w.homes.map((h) => h.home)))].sort() });
    }
    for (const s of f.stores) stores.push({ from: rel, key: s });
    // Every FormData action in the file, so actions no form names are still mapped.
    for (const fn of f.fns) if (formObjsOf(fn).length || (f.isServerModule && fn.exported)) actionFacts(rel, fn.name);
    for (let raw of f.forms) {
      // A child component's own static inputs post with this form
      // (`<GuestNameFields />` holds first_name/last_name). One level down.
      const childInputs = new Set<string>(raw.inputs);
      for (const c of raw.children) {
        const imp = f.imports.get(c);
        if (!imp || imp.imported === '*') continue;
        const t = resolveSpec(rel, imp.spec);
        if (!t || !t.endsWith('.tsx')) continue;
        for (const n of facts(t).src.matchAll(/<(?:input|select|textarea)\b[^<>]*?\bname=(?:"([^"]+)"|'([^']+)'|\{\s*['"]([^'"]+)['"]\s*\})/g)) {
          const name = (n[1] ?? n[2] ?? n[3])!;
          if (!/\s/.test(name)) childInputs.add(name);
        }
      }
      raw = { ...raw, inputs: [...childInputs].sort() };
      const refs = new Set<string>();
      let unknown = raw.actionExprs.length === 0;
      for (const e of raw.actionExprs) {
        const r = resolveAction(rel, e);
        if (!r) unknown = true;
        else for (const x of r) refs.add(x);
      }
      const acts = [...refs].map((r) => actionCache.get(r)).filter((a): a is ActionFacts => Boolean(a));
      const judge = !unknown && acts.length > 0 && acts.every((a) => !a.readsAll);
      const reads = (input: string) =>
        acts.some((a) =>
          a.fields.some((fl) =>
            fl.includes('*') ? new RegExp(`^${fl.split('*').map((p) => p.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&')).join('.*')}$`).test(input) : fl === input,
          ),
        );
      forms.push({
        from: rel,
        actions: [...refs].sort(),
        inputs: raw.inputs,
        notRead: judge ? raw.inputs.filter((i) => !reads(i)) : [],
      });
    }
  }

  /* ── screens ── */
  const screenFacts: ScreenFacts[] = opts.screens.screens.map((s) => {
    const seen = new Set<string>([s.file]);
    let frontier = [s.file];
    for (let hop = 0; hop < 3; hop += 1) {
      const next: string[] = [];
      for (const rel of frontier) {
        if (rel.startsWith('lib/') && rel !== s.file) continue; // lib is a leaf
        for (const b of facts(rel).imports.values()) {
          const t = resolveSpec(rel, b.spec);
          if (!t || seen.has(t)) continue;
          if (t.startsWith('app/admin/')) continue;
          seen.add(t);
          next.push(t);
        }
      }
      frontier = next;
    }
    const files = [...seen].sort();
    const reads = new Set<string>();
    const writes = new Set<string>();
    const actions = new Set<string>();
    const calcs = new Set<string>();
    for (const rel of files) {
      const f = facts(rel);
      for (const r of f.reads) reads.add(r);
      const writesHere = !rel.startsWith('lib/') || f.isServerModule || /-?actions\.ts$/.test(rel);
      if (writesHere) for (const w of f.writes) for (const h of w.homes) writes.add(h.home);
      for (const fn of f.fns) {
        const a = actionCache.get(`${rel}#${fn.name}`);
        if (a) actions.add(a.ref);
      }
      for (const c of CALCULATIONS) if (c.anchors.some((a) => f.calls.has(a))) calcs.add(c.id);
    }
    return {
      id: s.id,
      reads: [...reads].sort(),
      writes: [...writes].sort(),
      actions: [...actions].sort(),
      calcs: [...calcs].sort(),
    };
  });

  const actions = [...actionCache.values()].filter((a): a is ActionFacts => Boolean(a)).sort((a, b) => a.ref.localeCompare(b.ref));
  forms.sort((a, b) => a.from.localeCompare(b.from) || a.inputs.join().localeCompare(b.inputs.join()));
  stores.sort((a, b) => a.key.localeCompare(b.key) || a.from.localeCompare(b.from));
  return { version: 1, screens: screenFacts, actions, forms, writers, stores };
}

/** The import closure a screen's checks look at — exported so the shown-values check uses the same files. */
const closureMemo = new Map<string, { sources: Set<string>; imports: Map<string, string[]> }>();
export function screenFiles(webRoot: string, pageFile: string): string[] {
  let memo = closureMemo.get(webRoot);
  if (!memo) {
    memo = { sources: new Set(listSources(webRoot)), imports: new Map() };
    closureMemo.set(webRoot, memo);
  }
  const { sources, imports } = memo;
  const resolve = (fromRel: string, spec: string): string | null => {
    let base: string;
    if (spec.startsWith('@/')) base = spec.slice(2);
    else if (spec.startsWith('.')) base = join(dirname(fromRel), spec).split(sep).join('/');
    else return null;
    for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) if (sources.has(base + ext)) return base + ext;
    return null;
  };
  const importsOf = (rel: string): string[] => {
    const hit = imports.get(rel);
    if (hit) return hit;
    let src = '';
    try {
      src = stripComments(readFileSync(join(webRoot, rel), 'utf8'));
    } catch {
      /* unreadable */
    }
    const out = [...importsIn(src).values()].map((b) => resolve(rel, b.spec)).filter((t): t is string => Boolean(t));
    imports.set(rel, out);
    return out;
  };
  const seen = new Set<string>([pageFile]);
  let frontier = [pageFile];
  for (let hop = 0; hop < 3; hop += 1) {
    const next: string[] = [];
    for (const rel of frontier) {
      if (rel.startsWith('lib/') && rel !== pageFile) continue;
      for (const t of importsOf(rel)) {
        if (seen.has(t) || t.startsWith('app/admin/')) continue;
        seen.add(t);
        next.push(t);
      }
    }
    frontier = next;
  }
  return [...seen].sort();
}
