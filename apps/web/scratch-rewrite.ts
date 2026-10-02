import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { isVisibleHit } from './lib/retired-names-scan';

type Rule = { re: string; to: (m: string) => string };
const cap = (m: string, w: string) => (m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w);
const SETS: Record<string, Rule[]> = {
  money: [
    { re: 'down-?payment(?:s)?', to: (m) => cap(m, 'first payment') },
    { re: 'deposit(?:s)?', to: (m) => cap(m, m.toLowerCase().endsWith('s') ? 'payments' : 'payment') },
    { re: 'installment(?:s)?', to: (m) => cap(m, m.toLowerCase().endsWith('s') ? 'payments' : 'payment') },
  ],
  proposal: [{ re: 'proposal(?:s)?', to: (m) => cap(m, m.toLowerCase().endsWith('s') ? 'quotes' : 'quote') }],
  day: [{ re: 'on the day', to: () => 'The Day' }],
  lock: [
    {
      re: 'lock(?:ed|ing|s)? (?:it |them |you |him |her )?in\\b',
      to: (m) => {
        const l = m.toLowerCase();
        if (l.startsWith('locked in')) return cap(m, 'booked');
        if (l.startsWith('locking in')) return cap(m, 'booking');
        if (l.startsWith('locks in')) return cap(m, 'books');
        const obj = /(it|them|you|him|her) in$/.exec(l);
        return cap(m, 'book') + (obj ? ' ' + obj[1] : '');
      },
    },
    {
      re: 'lock(?:ed|ing|s)?',
      to: (m) => {
        const l = m.toLowerCase();
        return cap(m, l === 'lock' ? 'book' : l === 'locks' ? 'books' : l === 'locked' ? 'booked' : 'booking');
      },
    },
  ],
};
const set = process.argv[2];
const exclude = new RegExp(process.argv[3] || '^$'); // path
const include = new RegExp(process.argv[4] || '.');
const skipText = /awaiting vendor confirmation|SKIP_ME/;
function* src(d: string): Generator<string> { for (const e of readdirSync(d)) { if (['node_modules','.next','.tmp'].includes(e)) continue; const p = join(d,e); if (statSync(p).isDirectory()) yield* src(p); else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e) && !e.endsWith('.d.ts')) yield p; } }
const rules = SETS[set].map((r) => ({ ...r, rx: new RegExp(r.re, set === 'day' ? 'g' : 'gi') }));
let changed = 0;
for (const r of ['app','lib','components']) for (const f of src(r)) {
  if (exclude.test(f) || !include.test(f)) continue;
  const source = readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, source, ts.ScriptTarget.Latest, true, f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits: { s: number; e: number; t: string }[] = [];
  const doNode = (s: number, e: number, jsx: boolean, judge: string, judgeOffset: number) => {
    const raw = source.slice(s, e);
    if (skipText.test(judge)) return;
    // find hits in `raw`, judged against `judge` text (cooked) — map by order
    let out = raw; let delta = 0;
    for (const rule of rules) {
      const hits = [...raw.matchAll(rule.rx)];
      for (const m of hits) {
        // visibility judged on raw text around the hit (raw ≈ cooked here)
        if (!isVisibleHit(raw, m.index!, m[0].length, jsx)) continue;
        // `day` rule is case sensitive on exact text; 'on the day' lowercase exempt
        if (set === 'day' && m[0] !== 'On the Day') continue;
        const rep = rule.to(m[0]);
        out = out.slice(0, m.index! + delta) + rep + out.slice(m.index! + m[0].length + delta);
        delta += rep.length - m[0].length;
      }
    }
    if (out !== raw) edits.push({ s, e, t: out });
  };
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ((ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'console') || (ts.isIdentifier(node.expression) && /^log[A-Z]/.test(node.expression.text)))) return;
    if (ts.isJsxText(node)) doNode(node.getStart(sf), node.end, true, node.text, 0);
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const p = node.parent;
      if (!(p && (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)))) doNode(node.getStart(sf) + 1, node.end - 1, false, node.text, 0);
    } else if (ts.isTemplateExpression(node)) {
      const pieces = [node.head, ...node.templateSpans.map((x) => x.literal)];
      for (const pc of pieces) {
        const s = pc.getStart(sf) + 1; // after ` or }
        const e = pc.end - (ts.isTemplateTail(pc) ? 1 : 2); // before ` or ${
        // judge whole template prose: use text with whitespace → treat as prose (jsx=false but has whitespace guaranteed?)
        doNode(s, e, false, pc.text, 0);
      }
      for (const sp of node.templateSpans) visit(sp.expression);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!edits.length) continue;
  edits.sort((a, b) => b.s - a.s);
  let outSrc = source;
  for (const ed of edits) outSrc = outSrc.slice(0, ed.s) + ed.t + outSrc.slice(ed.e);
  writeFileSync(f, outSrc); changed++;
}
console.error('rewrote', changed, 'files');
