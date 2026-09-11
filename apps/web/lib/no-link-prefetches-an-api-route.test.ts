/**
 * NO next/link <Link> PREFETCHES AN /api/ ROUTE.
 *
 * Found by the Story's step-8 live drive (2026-09-11): every visit to a host's Papic studio
 * logged a CORS error and posted a CSP `connect-src` report. `<Link>` prefetches the hrefs in
 * view, and "Connect Google Drive" pointed at `/api/oauth/drive/start`, which answers with a 302
 * to accounts.google.com — so the PREFETCH (a fetch) followed the redirect cross-origin and was
 * refused. Nothing looked broken; every console-error and CSP check was polluted, and a CSP
 * report went out per page view. An /api/ route is an OAuth start, a download or a JSON
 * document: a person needs a full navigation there, which is what a plain `<a>` gives.
 *
 * ── WHAT THIS GUARD CLAIMS, EXACTLY ────────────────────────────────────────────────────────────
 * No next/link `<Link>` in app/, lib/ or components/ has an href that is an /api/ URL unless it
 * says `prefetch={false}` — whether the URL is written on the tag itself, OR handed in through a
 * prop by a caller (`connectHref={`/api/…`}` → a component that renders `<Link href={connectHref}>`),
 * which is how three of the fifteen found here reached a Link. Source is read through the repo's
 * one comment stripper. A detector self-test proves each arm can fire, and population floors
 * prove the scan is still finding what it claims to check.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(e) && !/\.test\.tsx$/.test(e)) out.push(p);
  }
  return out;
}

/** Opening JSX tags `<Name …>` — brace- and quote-aware, so `>` inside `{…}` does not end it. */
function openingTags(src: string, name: string): Array<{ at: number; text: string }> {
  const out: Array<{ at: number; text: string }> = [];
  const re = new RegExp(`<${name}(?=[\\s>/])`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + name.length + 1;
    let depth = 0;
    let q: string | null = null;
    for (; i < src.length; i += 1) {
      const c = src[i];
      if (q) {
        if (c === q && src[i - 1] !== '\\') q = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        q = c;
        continue;
      }
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) break;
    }
    out.push({ at: m.index, text: src.slice(m.index, i + 1) });
  }
  return out;
}

const linkAlias = (src: string): string | null =>
  src.match(/import\s+(\w+)\s+from\s+['"]next\/link['"]/)?.[1] ?? null;
const hrefOf = (tag: string): string =>
  tag.match(/\bhref=(\{[\s\S]*?\}(?=\s|\/?>)|"[^"]*"|'[^']*')/)?.[1] ?? '';
const noPrefetch = (tag: string) => /\bprefetch=\{false\}/.test(tag);
const API = /^[{]?\s*[`'"]\/api\//;

/** Arm 1: a Link whose own href is an /api/ URL. */
export function literalOffenders(src: string): string[] {
  const alias = linkAlias(src);
  if (!alias) return [];
  return openingTags(src, alias)
    .filter((t) => API.test(hrefOf(t.text)))
    .filter((t) => !noPrefetch(t.text))
    .map((t) => t.text.replace(/\s+/g, ' ').slice(0, 90));
}

/** Arm 2's other half: in a component's file, the Links that render `href={prop}`. */
export function linksRenderingProp(src: string, prop: string): string[] {
  const alias = linkAlias(src);
  if (!alias) return [];
  return openingTags(src, alias)
    .filter((t) => new RegExp(`^\\{\\s*${prop}\\s*\\}$`).test(hrefOf(t.text)))
    .filter((t) => !noPrefetch(t.text))
    .map((t) => t.text.replace(/\s+/g, ' ').slice(0, 90));
}

/** Arm 2: `<Comp prop={`/api/…`}>` — which component, which prop. */
function apiPropsPassed(src: string): Array<{ comp: string; prop: string }> {
  const out: Array<{ comp: string; prop: string }> = [];
  const re = /<([A-Z]\w*)(?=[\s>/])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const tag = openingTags(src.slice(m.index), m[1]!)[0]?.text ?? '';
    const pr = /\b([a-zA-Z]\w*)=(\{\s*[`'"]\/api\/|"\/api\/|'\/api\/)/g;
    let p: RegExpExecArray | null;
    while ((p = pr.exec(tag))) if (p[1] !== 'href') out.push({ comp: m[1]!, prop: p[1]! });
  }
  return out;
}

/** Where `Comp` is defined, as seen from `file`: an import it names, or the file itself. */
function fileOf(comp: string, file: string, src: string): string | null {
  const imp = new RegExp(`import\\s*(?:\\{[^}]*\\b${comp}\\b[^}]*\\}|${comp})\\s*from\\s*['"]([^'"]+)['"]`).exec(src);
  if (!imp) return new RegExp(`function\\s+${comp}\\b|const\\s+${comp}\\s*=`).test(src) ? file : null;
  const spec = imp[1]!;
  const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(file), spec) : null;
  if (!base) return null;
  for (const c of [`${base}.tsx`, `${base}.ts`, join(base, 'index.tsx')]) if (existsSync(c)) return c;
  return null;
}

test('the detector can fire — each arm, on a sample', () => {
  const bad = `import Link from 'next/link';\nexport const A = () => <Link href={\`/api/oauth/x?e=\${id}\`} className="b">x</Link>;`;
  const ok = `import Link from 'next/link';\nexport const A = () => <Link prefetch={false} href="/api/x">x</Link>;`;
  const page = `import Link from 'next/link';\nexport const B = ({ connectHref }: { connectHref: string }) => <Link href={connectHref}>go</Link>;`;
  assert.equal(literalOffenders(bad).length, 1);
  assert.equal(literalOffenders(ok).length, 0);
  assert.equal(linksRenderingProp(page, 'connectHref').length, 1);
  assert.deepEqual(apiPropsPassed(`<Card connectHref={\`/api/oauth/y\`} />`), [{ comp: 'Card', prop: 'connectHref' }]);
});

test('no next/link <Link> prefetches an /api/ route — on the tag or through a prop', () => {
  const files = ['app', 'lib', 'components'].flatMap((d) => walk(join(WEB, d)));
  const offenders: string[] = [];
  let linkTags = 0;
  let propPairs = 0;
  for (const file of files) {
    const src = stripComments(readFileSync(file, 'utf8'));
    const alias = linkAlias(src);
    if (alias) linkTags += openingTags(src, alias).length;
    for (const o of literalOffenders(src)) offenders.push(`${file.replace(`${WEB}/`, '')} · ${o}`);
    for (const { comp, prop } of apiPropsPassed(src)) {
      const target = fileOf(comp, file, src);
      if (!target) continue;
      propPairs += 1;
      const tsrc = stripComments(readFileSync(target, 'utf8'));
      for (const o of linksRenderingProp(tsrc, prop))
        offenders.push(`${target.replace(`${WEB}/`, '')} · <${comp} ${prop}> is fed an /api/ URL by ${file.replace(`${WEB}/`, '')} and renders it as ${o}`);
    }
  }
  console.log(`# [api-links] Link tags scanned: ${linkTags} · /api/ props traced: ${propPairs} · offenders: ${offenders.length}`);
  // A zero population is a broken guard, not a clean repo.
  assert.ok(linkTags >= 200, `scanned only ${linkTags} <Link> tags — the scan has stopped seeing them`);
  assert.ok(propPairs >= 3, `traced only ${propPairs} /api/ props into components — the resolver has stopped finding them`);
  assert.deepEqual(offenders, [], `\n${offenders.join('\n')}\n— use a plain <a> (a full navigation) or prefetch={false}`);
});
