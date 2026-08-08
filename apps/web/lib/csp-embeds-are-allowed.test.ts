/**
 * csp-embeds-are-allowed.test.ts — an iframe the CSP forbids is a grey box.
 *
 * WHAT IT COST (measured on the live site, 2026-08-08). The owner approved his
 * own shop, opened the public address, and the location map was an empty grey
 * panel with a broken-content glyph. `openstreetmap.org` responds 200 and the
 * markup was perfect; the enforced `frame-src` in next.config.ts simply never
 * listed it, so Chrome refused the frame. Nothing threw. Nothing logged
 * anything a person would read. The map had been dead on every shop page with
 * coordinates since it shipped.
 *
 * 🔑 THE DISEASE, NOT THE INSTANCE: a blocked iframe fails EXACTLY like a
 * missing one. Same family as a phantom column (query rejected, not thrown), a
 * phantom enum value, and an `r2://` reference in an `<img>` — the browser or
 * the database declines, and the only symptom is an absence.
 *
 * next.config.ts already said "New embed origins later extend this one list."
 * That comment was true, correct, and did not stop this. A sentence is not a
 * mechanism.
 *
 * ⚠ ON SCOPE. This resolves an iframe `src` only as far as the FILE it lives
 * in: a literal, or a local `const` holding one. A src built from a prop or a
 * row (`watchLive.embedUrl`) cannot be known statically, so it is COUNTED AND
 * PRINTED rather than dropped — an unchecked embed you can see is worth more
 * than a clean report that quietly skipped it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

function sources(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (p.endsWith('.tsx') && !p.endsWith('.test.tsx')) out.push(p);
  }
  return out;
}

/** The ENFORCED policy — the report-only one blocks nothing and proves nothing. */
function enforcedFrameSrc(): string {
  const config = readFileSync(join(WEB, 'next.config.ts'), 'utf8');
  // Anchored on the directive so a bare /frame-src/ can't match the word inside
  // a comment. Same anchoring as watch-live-block.test.ts.
  const match = /frame-src 'self'[^"']*/.exec(config);
  assert.notEqual(match, null, 'no enforced frame-src directive found in next.config.ts');
  return match![0];
}

/** Hosts an iframe in this file is pointed at, as far as the file itself says. */
function embedHosts(code: string): { hosts: Set<string>; unresolved: string[] } {
  const hosts = new Set<string>();
  const unresolved: string[] = [];

  for (const frame of code.matchAll(/<iframe\b[\s\S]{0,400}?src=(?:\{([^}]*)\}|"([^"]*)")/g)) {
    const expr = (frame[1] ?? frame[2] ?? '').trim();
    if (!expr) continue;

    // A literal src, or a `const` whose initialiser we can read in this file.
    const literal = /^https?:\/\//.test(expr) ? expr : null;
    let text = literal;
    if (!text && /^[A-Za-z_$][\w$]*$/.test(expr)) {
      const decl = new RegExp(
        `(?:const|let|var)\\s+${expr}\\s*(?::[^=]*)?=([\\s\\S]{0,600}?);`,
      ).exec(code);
      text = decl?.[1] ?? null;
    }
    if (!text) {
      unresolved.push(expr);
      continue;
    }

    const urls = [...text.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)]
      .map((m) => m[1])
      .filter((h): h is string => Boolean(h));
    if (urls.length === 0) {
      // Resolvable, and same-origin — a relative path needs no allowlist entry
      // beyond `'self'`, which is always present.
      continue;
    }
    for (const h of urls) hosts.add(h);
  }

  return { hosts, unresolved };
}

test('every iframe host the app embeds is allowed by the enforced frame-src', () => {
  const frameSrc = enforcedFrameSrc();
  const offenders: string[] = [];
  const unresolvedSites: string[] = [];
  let checked = 0;

  for (const file of sources(join(WEB, 'app')).concat(sources(join(WEB, 'components')))) {
    const code = readFileSync(file, 'utf8');
    if (!code.includes('<iframe')) continue;
    const rel = relative(WEB, file);
    const { hosts, unresolved } = embedHosts(code);
    for (const u of unresolved) unresolvedSites.push(`${rel} — src={${u}}`);
    for (const host of hosts) {
      checked += 1;
      if (!frameSrc.includes(host)) offenders.push(`${rel} — embeds ${host}`);
    }
  }

  // NO SILENT CAP. Anything this guard could not resolve is named out loud, so
  // "0 failures" is never mistaken for "everything is covered".
  if (unresolvedSites.length > 0) {
    console.log(
      `csp-embeds: ${checked} host(s) checked · ${unresolvedSites.length} iframe src(s) ` +
        `not statically resolvable (verify these by hand):\n  ${unresolvedSites.join('\n  ')}`,
    );
  }

  assert.deepEqual(
    offenders,
    [],
    `An iframe points at a host the enforced CSP blocks. It will render as an ` +
      `EMPTY GREY BOX — no error, no console warning worth noticing, and no test ` +
      `will catch it. Add the origin to frame-src in next.config.ts, or stop ` +
      `embedding it.\n\nfr` + `ame-src: ${frameSrc}\n\n${offenders.join('\n')}`,
  );
});

test('the map host that caused this stays in frame-src', () => {
  // The general sweep above only fires while an iframe still names the host in
  // a way it can resolve. This one pins the specific regression: if the map
  // moves to a prop-fed src, the sweep goes quiet and the origin could be
  // dropped from the policy with nothing to notice.
  assert.match(
    enforcedFrameSrc(),
    /openstreetmap\.org/,
    'the OpenStreetMap embed host fell out of frame-src — the vendor location ' +
      'map on every shop page silently reverts to a grey box',
  );
});
