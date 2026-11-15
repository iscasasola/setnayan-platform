#!/usr/bin/env node
/**
 * COLOUR JOB MAP (owner 12 Nov 2026: "start mapping the elements in the app so the dashboards will be mapped
 * properly to that admin page").
 *
 * Admin › Colours sets colour by JOB, not by screen. This scanner reads every .tsx in the app (the guest Event
 * Hub `app/[slug]`, dev labs and tests excluded) and sorts each colour use into the job it serves:
 *
 *   PAGE      the page behind everything                      bg-page · --sn-page-bg
 *   FRAME     a card/panel sitting on the page                 bg-white|raised|cream|paper|surface + rounded
 *   MONEY     pay · confirm · commit money                     tone="ok" · bg-ok · --color-ok
 *   DECISION  the forward step                                 tone="brand" · button-primary · bg-mulberry
 *   TOGGLE    what is ON / PICKED (switch, picked pill)        sn-accent · bg-terracotta (selected gold)
 *   PRIVATE   private chat                                     --color-private*
 *   TILE      category icon tiles + bars                       sn-cat-* · cat-*
 *   OTHER     info · warn · danger · neutral tones             tone="info|warn|danger|neutral" · bg-danger …
 *   STRAY     a colour NOT on any token — will NOT follow the admin page
 *             (raw #hex in a className/style, or a Tailwind palette colour like bg-emerald-600)
 *
 * It reads class strings, so it maps what the CODE says, not pixels — a FRAME count is "a token-painted
 * rounded surface", and a screen still needs a human look for the header band (no class names a band today).
 *
 *   node scripts/colour-job-map.mjs                 → markdown to stdout
 *   node scripts/colour-job-map.mjs --json out.json → also write the raw rows
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../apps/web/', import.meta.url).pathname;
const SCAN = ['app', 'components'];
const SKIP_DIR = /(^|\/)(node_modules|\.next|dev|\[slug\])(\/|$)/;
const SKIP_FILE = /\.(test|spec|harness)\.tsx?$/;

/** Where a file lives → which dashboard the owner will think of. First match wins. */
const AREAS = [
  ['Couple · event dashboard', /^app\/dashboard\/\[eventId\]\//],
  ['Couple · account', /^app\/dashboard\/\(account\)\//],
  ['Couple · home / launcher', /^app\/dashboard\//],
  ['Supplier dashboard', /^app\/vendor-dashboard\//],
  ['Admin (HQ)', /^app\/admin\//],
  ['Public pages', /^app\/\(shell\)\/|^app\/(blog|help|about|pricing|download|waitlist|tl|v|sample|legal)\//],
  ['Sign-up / onboarding', /^app\/(onboarding|signup|login|auth|join)\//],
  ['Papic camera', /^app\/papic\//],
  ['Shared components', /^app\/_components\/|^components\//],
  ['Other', /./],
];

const PALETTE =
  '(?:red|blue|green|emerald|sky|amber|yellow|orange|purple|violet|pink|rose|indigo|teal|cyan|lime|fuchsia|slate|gray|zinc|neutral|stone)';
const RULES = [
  ['PRIVATE', /color-private|\b(?:bg|text|border|ring)-private\b/g],
  ['TILE', /--sn-cat-[a-z]+|\b(?:bg|text|border|ring|fill|stroke)-cat-[a-z]+/g],
  ['PAGE', /\bbg-page\b|--sn-page-bg/g],
  ['MONEY', /tone=["']ok["']|\b(?:bg|text|border|ring)-ok\b(?:\/\d+)?|--color-ok/g],
  ['DECISION', /tone=["']brand["']|\bbutton-primary\b|\bbg-mulberry(?:-\d+)?\b|--color-mulberry|--m-cta/g],
  ['TOGGLE', /\b(?:bg|text|border|ring|accent|fill)-sn-accent\b(?:\/\d+)?|--sn-accent|\bbg-terracotta\b|--m-nav-active/g],
  ['OTHER', /tone=["'](?:info|warn|danger|neutral)["']|\b(?:bg|text|border|ring)-(?:info|warn|danger)\b(?:\/\d+)?/g],
  ['STRAY', new RegExp(`\\b(?:bg|text|border|ring|from|via|to|fill|stroke|outline|divide|shadow)-${PALETTE}-\\d{2,3}\\b`, 'g')],
];
const FRAME_SURFACE = /\bbg-(?:white|raised|cream|paper|surface)\b|var\(--surface\)|var\(--m-paper\)/;
const ROUNDED = /\brounded(?:-[a-z0-9[\]-]+)?\b/;
/** A class-ish string: className="…", className={`…`}, cn('…'), or a style hex. */
const CLASS_STR = /className=(?:"([^"]*)"|\{`([^`]*)`\})|cn\(\s*['"`]([^'"`]*)['"`]/g;
const HEX_IN_CLASS = /\[#[0-9a-fA-F]{3,8}\]|(?:color|background(?:Color)?|borderColor)\s*:\s*['"]#[0-9a-fA-F]{3,8}/g;

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(ROOT, p);
    if (SKIP_DIR.test(rel)) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name) && !SKIP_FILE.test(name)) out.push(rel);
  }
  return out;
}

const files = SCAN.flatMap((d) => walk(join(ROOT, d), []));
const rows = [];
for (const rel of files) {
  const src = readFileSync(join(ROOT, rel), 'utf8');
  const area = AREAS.find(([, re]) => re.test(rel))[0];
  const counts = {};
  const strays = new Map();
  const bump = (job, n = 1) => (counts[job] = (counts[job] ?? 0) + n);
  for (const [job, re] of RULES) {
    for (const m of src.matchAll(re)) {
      bump(job);
      if (job === 'STRAY') strays.set(m[0], (strays.get(m[0]) ?? 0) + 1);
    }
  }
  for (const m of src.matchAll(HEX_IN_CLASS)) {
    bump('STRAY');
    strays.set(m[0], (strays.get(m[0]) ?? 0) + 1);
  }
  for (const m of src.matchAll(CLASS_STR)) {
    const s = m[1] ?? m[2] ?? m[3] ?? '';
    if (FRAME_SURFACE.test(s) && ROUNDED.test(s)) bump('FRAME');
  }
  if (/role=["']switch["']/.test(src)) bump('SWITCH_SITES');
  if (Object.keys(counts).length) rows.push({ file: rel, area, counts, strays: Object.fromEntries(strays) });
}

const JOBS = ['PAGE', 'FRAME', 'MONEY', 'DECISION', 'TOGGLE', 'PRIVATE', 'TILE', 'OTHER', 'STRAY'];
const byArea = new Map();
for (const r of rows) {
  const a = byArea.get(r.area) ?? { files: 0, strayFiles: 0, switchFiles: 0, ...Object.fromEntries(JOBS.map((j) => [j, 0])) };
  a.files++;
  for (const j of JOBS) a[j] += r.counts[j] ?? 0;
  if (r.counts.STRAY) a.strayFiles++;
  if (r.counts.SWITCH_SITES) a.switchFiles++;
  byArea.set(r.area, a);
}

const out = [];
out.push(`# Colour job map — generated ${new Date().toISOString().slice(0, 10)} by scripts/colour-job-map.mjs`);
out.push('');
out.push(`${files.length} screen files scanned (guest Event Hub, dev labs and tests excluded); ${rows.length} use a colour.`);
out.push('');
out.push('## By dashboard — uses per job');
out.push('');
out.push(`| Area | files | ${JOBS.join(' | ')} | files with STRAY | files with a switch |`);
out.push(`|---|---:|${JOBS.map(() => '---:').join('|')}|---:|---:|`);
for (const [area] of AREAS) {
  const a = byArea.get(area);
  if (!a) continue;
  out.push(`| ${area} | ${a.files} | ${JOBS.map((j) => a[j]).join(' | ')} | ${a.strayFiles} | ${a.switchFiles} |`);
}
out.push('');
out.push('## STRAY colours — what will NOT follow the admin page (top 40 by count)');
out.push('');
const strayTotals = new Map();
for (const r of rows) for (const [k, n] of Object.entries(r.strays)) strayTotals.set(k, (strayTotals.get(k) ?? 0) + n);
out.push('| Class / value | uses |');
out.push('|---|---:|');
for (const [k, n] of [...strayTotals].sort((a, b) => b[1] - a[1]).slice(0, 40)) out.push(`| \`${k}\` | ${n} |`);
out.push('');
out.push('## STRAY by file, per dashboard (top 25 files each)');
for (const [area] of AREAS) {
  const list = rows.filter((r) => r.area === area && r.counts.STRAY).sort((a, b) => b.counts.STRAY - a.counts.STRAY);
  if (!list.length) continue;
  out.push('');
  out.push(`### ${area} — ${list.length} files`);
  out.push('');
  for (const r of list.slice(0, 25)) {
    const top = Object.entries(r.strays).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `\`${k}\`×${n}`).join(' ');
    out.push(`- \`${r.file}\` — ${r.counts.STRAY}: ${top}`);
  }
}
console.log(out.join('\n'));
const ji = process.argv.indexOf('--json');
if (ji > 0) writeFileSync(process.argv[ji + 1], JSON.stringify(rows, null, 1));
