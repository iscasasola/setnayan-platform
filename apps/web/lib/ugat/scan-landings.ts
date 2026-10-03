/**
 * scan-landings.ts — the LANDING check of the Root map (part 2, slice 4).
 *
 * Owner, 2026-10-02 (DECISION_LOG "THE ROOT MAP ALSO CATCHES 'PRESSED BUT WENT
 * TO THE WRONG PLACE'…"): "every door must reach a real page AND its #section
 * exists on that page AND the door's words match the destination (a 'Messages'
 * row must land on Messages, not the roster); forwarding stubs that still have
 * doors are retargeted."
 *
 *   real page        part 1 already reports a door to nowhere (`brokenDoors`).
 *   #section         a door written `/x#guests` (or `#guests` on the same
 *                    page) needs `guests` somewhere in the destination's code
 *                    — an `id="guests"`, an `id: 'guests'`, a constant. Its
 *                    complete absence is the finding; a computed id is given
 *                    the benefit of the doubt.
 *   the door's words the label a person taps (the link's text, its
 *                    `aria-label`, or the `label:`/`title:` beside an `href:`)
 *                    against the destination's own words: its metadata title,
 *                    its masthead/`<h1>`, its menu label, the static words of
 *                    its address, through `LANDING_SYNONYMS`. A label with no
 *                    word left after `GENERIC_WORDS` ("Open", "See all") is not
 *                    judged.
 *   retarget         a door that lands on a legacy stub (a page that only
 *                    forwards) — it works, through an old address.
 *
 * Filesystem access — generator, tests and the CI check only.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

import { listSources, readQuoted, readTemplate, scanScreens, type ScanScreensOptions } from './scan-screens';
import { closeOf } from './scan-fields';
import type { Finding } from './root-map-checks';
import type { UgatScreensMap } from './screens';

/* ═══════════════════════════ words ═══════════════════════════ */

/** Words that say "go", not "where". A label made only of these is not judged. */
export const GENERIC_WORDS: ReadonlySet<string> = new Set(
  (
    'open see view go back to the your my our a an and or of for more all here this that continue next start get started ' +
    'learn manage edit change add new done save try it now click tap then with in on at from page show hide close ' +
    'set up setup check out read full list details detail info home main everything anything something one two ' +
    'first last other now later today yes no ok okay let lets us we you me i is are be do make finish keep use ' +
    'about how what where when why who which find out browse visit jump take continue upgrade unlock buy ' +
    // calls to action and brand marks — they say "act", not "where"
    'setnayan free secure turn preview ask review work works planning welcome inside latest there his her their ' +
    'full whole else every each any guide tour cancel exit thanks not me breadcrumb'
  ).split(' '),
);

/**
 * Words that name the same place. Reasoned per group: each is one area of the
 * app that its screens, menus and buttons call by different names — the
 * owner's own vocabulary (DECISION_LOG: "Event Hub, not website", "Live Watch"
 * for Panood, "suppliers" for vendors, "Your info" for Event Details) and the
 * route words the code kept from before a rename.
 */
export const LANDING_SYNONYMS: ReadonlyArray<readonly string[]> = [
  ['guest', 'people', 'invite', 'invitee', 'rsvp', 'roster', 'reply', 'attendee', 'list', 'sponsor', 'entourage'],
  ['supplier', 'vendor', 'team', 'bench', 'booking', 'book', 'lock', 'shop', 'store', 'service', 'marketplace', 'explore'],
  ['message', 'chat', 'inbox', 'thread', 'conversation'],
  ['budget', 'money', 'pay', 'payment', 'cost', 'owe', 'owing', 'paid', 'bill', 'order', 'checkout', 'receipt', 'purchase', 'price', 'pricing', 'earning', 'payout'],
  ['schedule', 'timeline', 'program', 'run', 'show', 'day', 'calendar', 'date', 'moment', 'agenda'],
  ['hub', 'website', 'site', 'invitation', 'maker', 'launch', 'design', 'theme', 'look', 'story', 'page', 'editor'],
  ['photo', 'papic', 'gallery', 'memory', 'memories', 'picture', 'album', 'library', 'capture', 'moment'],
  ['seat', 'seating', 'table', 'plan3d', 'plan', 'floor', 'room', 'layout'],
  ['detail', 'info', 'setting', 'settings', 'profile', 'account', 'preference'],
  ['live', 'panood', 'watch', 'stream', 'broadcast', 'studio'],
  ['checklist', 'task', 'todo', 'plan', 'planning'],
  ['help', 'support', 'faq', 'question'],
  ['sign', 'login', 'log', 'signin', 'signup', 'account', 'join'],
  ['event', 'dashboard', 'celebration', 'wedding'],
  ['creator', 'storyteller', 'chapter', 'story', 'stories', 'realstory', 'journal', 'blog', 'article'],
  ['supplier', 'market', 'directory', 'compare', 'shortlist', 'saved'],
  ['download', 'app', 'install', 'pwa', 'desktop', 'phone'],
  ['feature', 'tool', 'pricing', 'plan'],
  ['addon', 'add', 'on', 'service', 'studio', 'suite', 'extra'],
  ['taglish', 'tl', 'tagalog', 'english', 'about'],
];

export function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[_\-/]/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !/^\d+$/.test(w))
    .map((w) => (w.length > 4 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}

/** Does the label name the destination? `true` also when there is nothing to judge. */
export function wordsMatch(label: string, destination: string[]): boolean {
  const said = wordsOf(label).filter((w) => !GENERIC_WORDS.has(w));
  if (said.length === 0) return true;
  const dest = new Set(destination.flatMap(wordsOf));
  for (const g of LANDING_SYNONYMS) if (g.some((w) => dest.has(w))) for (const w of g) dest.add(w);
  return said.some((w) => dest.has(w));
}

/* ═══════════════════════════ labels ═══════════════════════════ */

function stripJsx(text: string): string {
  let t = text;
  for (let i = 0; i < 4; i += 1) t = t.replace(/\{[^{}]*\}/g, ' ');
  return t
    .replace(/<[^<>]*>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The words a person reads on the door whose address starts at `at`. */
export function labelAt(src: string, at: number): string | null {
  // 1. Inside a JSX tag? The nearest `<Tag` before `at` with no closing `>` between.
  const lt = src.lastIndexOf('<', at);
  if (lt >= 0) {
    const between = stripJsx(src.slice(lt, at).replace(/=>/g, ''));
    const tag = src.slice(lt).match(/^<([A-Za-z][\w.]*)/)?.[1];
    if (tag && !between.includes('>') && at - lt < 800) {
      // the end of the opening tag
      let k = at;
      let depth = 0;
      let openEnd = -1;
      while (k < src.length && k - at < 3000) {
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
      if (openEnd > 0) {
        const open = src.slice(lt, openEnd + 1);
        const prop = open.match(/\b(?:aria-label|title|label)=(?:"([^"]+)"|'([^']+)'|\{\s*['"`]([^'"`$]+)['"`]\s*\})/);
        const propText = prop ? (prop[1] ?? prop[2] ?? prop[3])! : null;
        if (src[openEnd - 1] === '/') return propText;
        const close = src.indexOf(`</${tag}>`, openEnd);
        if (close > 0 && close - openEnd < 4000) {
          const inner = stripJsx(src.slice(openEnd + 1, close));
          if (inner) return inner.slice(0, 120);
        }
        return propText;
      }
    }
  }
  // 2. An object literal: `{ label: 'Messages', href: '/…' }`.
  let depth = 0;
  for (let k = at - 1; k >= 0 && at - k < 1200; k -= 1) {
    const c = src[k];
    if (c === '}' || c === ')' || c === ']') depth += 1;
    else if (c === '(' || c === '[') {
      if (depth === 0) return null;
      depth -= 1;
    } else if (c === '{') {
      if (depth > 0) {
        depth -= 1;
        continue;
      }
      const end = closeOf(src, k);
      if (end < 0) return null;
      const obj = src.slice(k, end + 1);
      for (const key of ['label', 'title', 'name', 'text', 'cta', 'heading']) {
        const m = obj.match(new RegExp(`\\b${key}\\s*:\\s*(?:'([^']+)'|"([^"]+)"|\`([^\`$]+)\`)`));
        if (m) return (m[1] ?? m[2] ?? m[3])!;
      }
      return null;
    }
  }
  return null;
}

/* ═══════════════════════════ destination words ═══════════════════════════ */

function destinationWords(webRoot: string, route: string, file: string, menuLabels: Map<string, string[]>): string[] {
  let src = '';
  try {
    src = stripComments(readFileSync(join(webRoot, file), 'utf8'));
  } catch {
    /* unreadable */
  }
  const out: string[] = [];
  for (const m of src.matchAll(/\btitle\s*[:=]\s*(?:'([^']+)'|"([^"]+)"|`([^`$]+)`|\{\s*['"`]([^'"`$]+)['"`]\s*\})/g)) out.push((m[1] ?? m[2] ?? m[3] ?? m[4])!);
  for (const m of src.matchAll(/<h1\b[^>]*>([\s\S]{0,300}?)<\/h1>/g)) out.push(stripJsx(m[1]!));
  for (const m of src.matchAll(/\b(?:eyebrow|heading|kicker)=(?:"([^"]+)"|'([^']+)')/g)) out.push((m[1] ?? m[2])!);
  out.push(...(menuLabels.get(route) ?? []));
  out.push(route.split('/').filter((s) => s && !s.startsWith('[')).join(' '));
  // A guest's event page has no static words in its address — it IS the invitation.
  if (route === '/[slug]' || route.startsWith('/[slug]/')) out.push('invitation event hub page');
  if (route === '/') out.push('home setnayan');
  return out;
}

/* ═══════════════════════════ the scan ═══════════════════════════ */

export interface LandingScanOptions {
  webRoot: string;
  screens: UgatScreensMap;
  /** Same overrides scanScreens takes (tests). */
  builders?: ScanScreensOptions['builders'];
  tableNodes?: ScanScreensOptions['tableNodes'];
}

export function scanLandings(opts: LandingScanOptions): Finding[] {
  const { webRoot, screens } = opts;
  const byRoute = new Map(screens.screens.map((s) => [s.route, s]));
  const doors: Array<{ from: string; at: number; src: string; address: string; routes: string[]; kind: string }> = [];
  scanScreens({ webRoot, builders: opts.builders, tableNodes: opts.tableNodes, onDoor: (d) => doors.push(d) });

  // The code each screen draws — page + imports, app/components 3 deep, lib as a leaf.
  const sources = new Set(listSources(webRoot));
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
  const resolve = (fromRel: string, spec: string): string | null => {
    let base: string;
    if (spec.startsWith('@/')) base = spec.slice(2);
    else if (spec.startsWith('.')) base = join(dirname(fromRel), spec).split(sep).join('/');
    else return null;
    for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) if (sources.has(base + ext)) return base + ext;
    return null;
  };
  const closureCache = new Map<string, string[]>();
  const closure = (page: string): string[] => {
    const hit = closureCache.get(page);
    if (hit) return hit;
    const seen = new Set<string>([page]);
    let frontier = [page];
    for (let hop = 0; hop < 3; hop += 1) {
      const next: string[] = [];
      for (const rel of frontier) {
        if (rel.startsWith('lib/') && rel !== page) continue;
        for (const m of read(rel).matchAll(/\b(?:import|export)\s[^;'"`]*?from\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) {
          const t = resolve(rel, (m[1] ?? m[2])!);
          if (!t || seen.has(t)) continue;
          seen.add(t);
          next.push(t);
        }
      }
      frontier = next;
    }
    const out = [...seen];
    closureCache.set(page, out);
    return out;
  };
  const hasSection = (route: string, id: string): boolean => {
    // `#top` scrolls to the top of any page — the HTML standard's own fragment.
    if (id === 'top') return true;
    const s = byRoute.get(route);
    if (!s) return true;
    const needle = new RegExp(`['"\`]${id.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&')}['"\`]|[-:]${id.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&')}['"\`]`);
    return closure(s.file).some((f) => needle.test(read(f)));
  };

  // Menu labels per route, from the menu registry: `label: "…"` … `route: "…"`.
  const menuLabels = new Map<string, string[]>();
  const reg = read('lib/nav-registry-defaults.ts');
  for (const m of reg.matchAll(/\{[^{}]*?\blabel:\s*"([^"]+)"[^{}]*?\broute:\s*"([^"]+)"[^{}]*\}/g)) {
    const r = m[2]!.replace(/\$\{[^}]+\}|\[[^\]]+\]/g, '[x]');
    for (const s of screens.screens) {
      if (s.route.replace(/\[[^\]]+\]/g, '[x]') === r) {
        if (!menuLabels.has(s.route)) menuLabels.set(s.route, []);
        menuLabels.get(s.route)!.push(m[1]!);
      }
    }
  }
  const destCache = new Map<string, string[]>();
  const destOf = (route: string) => {
    if (!destCache.has(route)) {
      const s = byRoute.get(route)!;
      destCache.set(route, destinationWords(webRoot, route, s.file, menuLabels));
    }
    return destCache.get(route)!;
  };

  const out: Finding[] = [];
  const seen = new Set<string>();
  const push = (f: Finding) => {
    const k = `${f.check}\u0000${f.key}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(f);
  };

  for (const d of doors) {
    if (d.from.startsWith('app/admin/') || /^app\/(dev|prototype|demo-capture)\//.test(d.from)) continue;
    const hash = d.address.match(/#([A-Za-z][\w-]*)$/)?.[1] ?? null;
    for (const route of d.routes) {
      const target = byRoute.get(route);
      if (!target) continue;
      // retarget — the door lands on a page that only forwards.
      if (target.status === 'stub') {
        push({
          check: 'retarget',
          key: `${d.from} → ${route}`,
          screens: [route],
          file: d.from,
          plain: `A door in ${d.from} still points at ${route}, an old address that only forwards to ${target.redirectsTo ?? 'another page'}.`,
        });
        continue;
      }
      if (hash && !hasSection(route, hash)) {
        push({
          check: 'missing-section',
          key: `${d.from} → ${route}#${hash}`,
          screens: [route],
          file: d.from,
          plain: `A door in ${d.from} goes to ${route}#${hash}, but that page has no "${hash}" section to land on.`,
        });
      }
      // Words are judged where a person reads them: components and menu
      // config. A server action's or a notification's `title:` is a message
      // about the event, not the words on a button.
      const uiFile = d.from.endsWith('.tsx') || /(?:nav|menu|rail|bar|links|command|doors?)[^/]*\.ts$/.test(d.from);
      // Only a link has words on it; a redirect() or router.push() has none.
      const tapped = d.kind === 'link' || d.kind === 'nav-registry';
      const label = uiFile && tapped ? labelAt(d.src, d.at) : null;
      const readable = label !== null && !/[(){}$;?=]|=>/.test(label) && wordsOf(label).length <= 8;
      // A door to `/guests#plus-ones` names the SECTION, so the section is a destination word.
      if (label && readable && !wordsMatch(label, [...destOf(route), ...(hash ? [hash] : [])])) {
        push({
          check: 'wrong-words',
          key: `${d.from} "${label}" → ${route}`,
          screens: [route],
          file: d.from,
          plain: `"${label}" in ${d.from} opens ${route}, whose own words are "${destOf(route).filter(Boolean).slice(0, 2).join(' / ')}".`,
        });
      }
    }
  }

  // Same-page sections: `href="#plan"` lands on whichever screen draws it.
  for (const rel of sources) {
    if (!rel.startsWith('app/') && !rel.startsWith('components/')) continue;
    if (rel.startsWith('app/admin/') || /^app\/(dev|prototype|demo-capture)\//.test(rel)) continue;
    const src = read(rel);
    if (!src.includes("'#") && !src.includes('"#') && !src.includes('`#')) continue;
    for (const m of src.matchAll(/\b(?:href|[a-z]\w*Href)\s*(?:=|:)\s*\{?\s*['"`]#([A-Za-z][\w-]*)['"`]/g)) {
      const id = m[1]!;
      const hosts = screens.screens.filter((s) => s.status !== 'stub' && closure(s.file).includes(rel));
      if (hosts.length === 0) continue;
      if (hosts.some((s) => hasSection(s.route, id))) continue;
      push({
        check: 'missing-section',
        key: `${rel} → #${id}`,
        screens: hosts.map((s) => s.route).sort(),
        file: rel,
        plain: `A door in ${rel} jumps to "#${id}" on the same page, but no "${id}" section is drawn there.`,
      });
    }
  }

  return out.sort((a, b) => a.check.localeCompare(b.check) || a.key.localeCompare(b.key));
}
