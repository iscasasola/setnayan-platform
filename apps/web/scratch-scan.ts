import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { scanRetiredNames } from './lib/retired-names-scan';
const WORDS: Record<string, any> = {
  bench: { was: 'bench', now: 'Save', pattern: 'bench(?:es)?' },
  proposal: { was: 'proposal', now: 'quote', pattern: 'proposal' },
  money: { was: 'deposit', now: 'payment', pattern: 'deposit|down[- ]?payment|installment' },
  lock: { was: 'lock', now: 'book', pattern: 'lock(?:ed|ing)?' },
  day: [{ was: 'On the Day', now: 'The Day', pattern: 'On the Day', caseSensitive: true }, { was: 'On the day', now: 'The Day', pattern: '^\\s*on the day\\s*[·:]?\\s*$' }],
  payday: { was: 'payday', now: 'Money in', pattern: 'payday' },
};
function* src(d: string): Generator<string> { for (const e of readdirSync(d)) { if (['node_modules','.next','.tmp'].includes(e)) continue; const p = join(d,e); if (statSync(p).isDirectory()) yield* src(p); else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e) && !e.endsWith('.d.ts')) yield p; } }
const which = process.argv[2];
const out: string[] = [];
for (const r of ['app','lib','components']) for (const f of src(r)) {
  for (const h of scanRetiredNames(f, readFileSync(f,'utf8'), ([] as any[]).concat(WORDS[which]))) out.push(`${f}:${h.line}  ${h.text}`);
}
console.log(out.join('\n')); console.error(which, out.length, 'findings in', new Set(out.map(l=>l.split(':')[0])).size, 'files');
