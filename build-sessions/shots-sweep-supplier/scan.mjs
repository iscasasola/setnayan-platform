// node scan.mjs <webroot>  — supplier sweep scan (comments not stripped; counts source lines/tokens)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = process.argv[2];
const dirs = ['app/vendor-dashboard', 'app/vendor-invite'];
const files = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); const s = statSync(p);
  if (s.isDirectory()) walk(p); else if (/\.(tsx|ts|css)$/.test(n) && !/\.test\./.test(n)) files.push(p); } };
for (const d of dirs) walk(join(root, d));
const WHITE_BG = /(?<![\w-])(?:[a-z0-9]+:)*!?bg-(?:white|cream|surface|raised|paper)(?![\w-])(?!\/)/;
const HEX_WHITE = /bg-\[#(?:fff|ffffff|fdfbf7|fbfbfa|fbfaf7|fffdf8)\]|background(?:Color)?:\s*['"]?#(?:fff|ffffff|fdfbf7|fbfbfa|fffdf8)\b/i;
const FULL = /min-h-(?:screen|dvh|svh|\[100(?:dvh|vh|svh)\])|h-screen|h-dvh|fixed inset-0/;
const BORDER = /(?<![\w-])(?:[a-z0-9]+:)*border(?![\w-])/;
const RADIUS = /(?<![\w-])(?:[a-z0-9]+:)*rounded-(?:lg|xl|2xl|3xl|card|tile)(?![\w-])/;
const SHADOW = /(?<![\w-])(?:[a-z0-9]+:)*shadow(?:-(?:sm|md|lg|xl|2xl|\[[^\]]+\]))?(?![\w-])/;
const FILL = /(?<![\w-])bg-(?:mulberry|ink|terracotta|ok|danger|warn|link)(?![\w-])(?!\/)/;
const c = { pageWhite: 0, hexWhite: 0, frame: 0, frameShadow: 0, handButton: 0, bgWhiteAll: 0 };
const per = {};
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    const t = l.trim(); if (t.startsWith('//') || t.startsWith('*')) return;
    const hit = (k) => { c[k]++; (per[k] ??= []).push(`${f}:${i + 1}`); };
    if (/(?<![\w-])bg-white(?![\w-])/.test(l)) hit('bgWhiteAll');
    if (HEX_WHITE.test(l)) hit('hexWhite');
    if (FULL.test(l) && (WHITE_BG.test(l) || HEX_WHITE.test(l))) hit('pageWhite');
    if (BORDER.test(l) && RADIUS.test(l) && WHITE_BG.test(l)) { hit('frame'); if (SHADOW.test(l)) hit('frameShadow'); }
    const back = lines.slice(Math.max(0, i - 3), i + 1).join(' ');
    if (/<button\b/.test(back) && !/<\/button>|<[A-Z]\w*Button/.test(lines.slice(Math.max(0,i-3), i).join(' ')) && /className=/.test(l) && FILL.test(l) && /rounded/.test(l)) hit('handButton');
  });
}
console.log(JSON.stringify({ files: files.length, ...c }, null, 0));
if (process.argv[3]) for (const k of process.argv[3].split(',')) console.log(k + '\n  ' + (per[k] ?? []).join('\n  '));
// second pass: raw <button> opening tags with a hand-typed filled look; and no-card combos (border + container radius)
let btn = 0, combo = 0; const btnList = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const re = /<button\b([\s\S]*?)>/g; let m;
  while ((m = re.exec(src))) { const tag = m[1];
    if (/className=/.test(tag) && FILL.test(tag) && /rounded/.test(tag) && /\bpx-|h-\d|py-/.test(tag)) { btn++; btnList.push(f + ':' + src.slice(0, m.index).split('\n').length); } }
  for (const l of src.split('\n')) { const t = l.trim(); if (t.startsWith('//')||t.startsWith('*')) continue; if (BORDER.test(l) && RADIUS.test(l)) combo++; }
}
console.log(JSON.stringify({ rawFilledButtons: btn, borderPlusContainerRadius: combo }));
if (process.env.BTN) console.log(btnList.join('\n'));
