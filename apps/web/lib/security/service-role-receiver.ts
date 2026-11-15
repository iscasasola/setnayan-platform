/**
 * IS THIS `.from(` PROVABLY ON THE SERVICE ROLE? — the receiver proof shared by the column guards that hold a
 * column off browser sessions (`shop-contact-is-not-session-readable.test.ts`, `booking-money-is-not-session-
 * readable.test.ts`). Moved here unchanged from the first so the two guards cannot drift apart.
 *
 * 🔑 IT TESTS THE CLAIM, NOT A NAME. A receiver is accepted only when it is PROVABLY the service role:
 *   · `createAdminClient()` / `createMoneyWriterClient()` inline, or
 *   · an identifier bound to one of those in the SAME file (the NEAREST binding before the read), or
 *   · a function PARAMETER — and then EVERY call site of that function, in every source file, must pass one of
 *     the above in that position.
 * Anything else is a session read.
 */
import fs from 'node:fs';
import path from 'node:path';
import { APP_ROOT } from './select-column-scan';
import { stripComments } from '../strip-comments';

export const SERVICE_FACTORIES = ['createAdminClient', 'createMoneyWriterClient'];

export type Site = { file: string; line: number; table: string; columns: string[]; kind: string };

/** The expression a `.from(` at `fromIdx` is called on: `admin`, `createAdminClient()`, `supabase`… */
export function receiverBefore(src: string, fromIdx: number): string {
  let i = fromIdx - 1;
  while (i >= 0 && /\s/.test(src[i]!)) i--;
  if (src[i] === ')') {
    let depth = 0;
    let j = i;
    for (; j >= 0; j--) {
      if (src[j] === ')') depth++;
      else if (src[j] === '(') {
        depth--;
        if (depth === 0) break;
      }
    }
    let k = j - 1;
    while (k >= 0 && /[\w$.]/.test(src[k]!)) k--;
    const inner = src.slice(j + 1, i).trim();
    const callee = src.slice(k + 1, j).trim();
    // `(await createClient())` — a parenthesised expression, not a call.
    return callee ? `${callee}()` : inner.replace(/^await\s+/, '');
  }
  let k = i;
  while (k >= 0 && /[\w$.]/.test(src[k]!)) k--;
  return src.slice(k + 1, i + 1);
}

export function isServiceCall(expr: string): boolean {
  return SERVICE_FACTORIES.some((f) => new RegExp(`^(?:await\\s+)?${f}\\(\\)$`).test(expr.trim()));
}

/**
 * The NEAREST binding of `ident` before `at` (a file can bind `supabase` to the
 * session in one function and to the service role in another — "somewhere in
 * the file" would wave the session one through). Returns the bound expression
 * with its offset, or null when the nearest binding is not an assignment.
 */
export function nearestAssignment(src: string, ident: string, at: number): { expr: string; index: number } | null {
  const re = new RegExp(`(?<![\\w$.])${ident}\\s*(?::[^=;(){}]+)?=(?!=|>)\\s*([^;\\n]+)`, 'g');
  let best: { expr: string; index: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) && m.index < at) {
    const expr = m[1]!.trim();
    // `admin = null` (the export route's catch arm) cannot read anything — a
    // null receiver throws. Only a binding that yields a CLIENT counts.
    if (/^(null|undefined)\b/.test(expr)) continue;
    // `<CatalogView admin={admin} />` — a JSX ATTRIBUTE, not a binding. Taking
    // it as one made explore/page.tsx's createAdminClient() read look like a
    // session read the moment a second column set was scanned.
    if (/^\{[\w$\s]*\}/.test(expr)) continue;
    best = { expr, index: m.index };
  }
  return best;
}

export function boundToService(src: string, ident: string, at: number = src.length): boolean {
  const b = nearestAssignment(src, ident, at);
  return !!b && SERVICE_FACTORIES.some((f) => new RegExp(`^(?:await\\s+)?${f}\\s*\\(\\s*\\)`).test(b.expr));
}

/** Index of `ident` among the parameters of the function whose body holds `at`, and its name. */
export function enclosingParam(src: string, at: number, ident: string): { fn: string; index: number; at: number } | null {
  const head = src.slice(0, at);
  const re = /(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?)\s*\(([^)]*)\)/g;
  let best: { fn: string; index: number; at: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(head))) {
    const params = m[3]!.split(',').map((p) => p.trim().split(/[\s:=?]/)[0]);
    const index = params.indexOf(ident);
    if (index !== -1) best = { fn: (m[1] ?? m[2])!, index, at: m.index };
  }
  return best;
}

export function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((a) => a.trim());
}

/** Every call of `fn(` in the app, with the argument at `index` and whether it is the service role. */
export function callersPassService(files: string[], fn: string, index: number): { ok: boolean; calls: string[] } {
  const calls: string[] = [];
  let ok = true;
  for (const abs of files) {
    const src = stripComments(fs.readFileSync(abs, 'utf8'));
    const re = new RegExp(`(?<![\\w$.])${fn}\\(`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      // the declaration itself
      if (/function\s+$/.test(src.slice(Math.max(0, m.index - 12), m.index))) continue;
      let depth = 1;
      let j = re.lastIndex;
      for (; j < src.length && depth > 0; j++) {
        if (src[j] === '(') depth++;
        else if (src[j] === ')') depth--;
      }
      const arg = splitArgs(src.slice(re.lastIndex, j - 1))[index] ?? '';
      const good = isServiceCall(arg) || (/^[\w$]+$/.test(arg) && boundToService(src, arg, m.index));
      calls.push(`${path.relative(APP_ROOT, abs)}:${src.slice(0, m.index).split('\n').length} ${fn}(${arg}, …) ${good ? 'service' : 'SESSION'}`);
      if (!good) ok = false;
    }
  }
  return { ok: ok && calls.length > 0, calls };
}

export function classifySite(
  files: string[],
  site: Site,
  rawSource?: string,
): { service: boolean; why: string } {
  const src = stripComments(rawSource ?? fs.readFileSync(path.join(APP_ROOT, site.file), 'utf8'));
  const lines = src.split('\n');
  const lineStart = lines.slice(0, site.line - 1).join('\n').length + (site.line > 1 ? 1 : 0);
  const fromIdx = src.indexOf('.from(', lineStart);
  if (site.kind === 'embed') return { service: false, why: 'an embed naming a closed column (none may exist)' };
  if (fromIdx === -1) return { service: false, why: 'could not find the .from( of this site' };
  const recv = receiverBefore(src, fromIdx);
  if (isServiceCall(recv)) return { service: true, why: `inline ${recv}` };
  if (!/^[\w$]+$/.test(recv)) return { service: false, why: `receiver \`${recv}\` is not provably the service role` };
  const assigned = nearestAssignment(src, recv, fromIdx);
  const param = enclosingParam(src, fromIdx, recv);
  // Whichever binding is CLOSER to the read wins.
  if (assigned && (!param || assigned.index > param.at)) {
    return boundToService(src, recv, fromIdx)
      ? { service: true, why: `\`${recv}\` = ${assigned.expr.slice(0, 40)}` }
      : { service: false, why: `receiver \`${recv}\` = ${assigned.expr.slice(0, 60)} — a browser-session client` };
  }
  if (param) {
    const { ok, calls } = callersPassService(files, param.fn, param.index);
    return {
      service: ok,
      why: `\`${recv}\` is parameter ${param.index} of ${param.fn}; callers:\n      ${calls.join('\n      ') || '(none found)'}`,
    };
  }
  return { service: false, why: `receiver \`${recv}\` is a browser-session client` };
}
