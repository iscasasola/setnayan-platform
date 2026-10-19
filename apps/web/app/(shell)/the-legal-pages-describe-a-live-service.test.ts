import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { POLICY_LINKS } from '@/lib/policy-links';
import { copyStrings } from '@/lib/public-copy-strings';

/**
 * THE PUBLIC LEGAL PAGES DESCRIBE A LIVE SERVICE (owner 2026-10-19, corpus DECISION_LOG
 * "TWO MORE RECOMMENDATIONS APPROVED": "'limited pilot' is removed from /privacy — a wording-only edit").
 *
 * App Review 2.2 rejects a beta, and a privacy policy that calls the product a pilot reads as one. /privacy's
 * connection-tree section said "limited pilot", "piloting" and "During the pilot"; the fix rewrote only those words
 * and kept every promise (both-parties-only, consent first, retention, the NPC filing).
 *
 * ── THE PROPERTY ─────────────────────────────────────────────────────────────
 * No string a READER sees on a public legal page calls Setnayan or a feature a pilot or a beta. Read through
 * `copyStrings` (JSX text + reader-visible literals), so a code comment explaining this rule — or an identifier such
 * as `kin-pilot` — never convicts the page.
 *
 * ── WHICH PAGES — DERIVED, NOT TYPED ────────────────────────────────────────
 * Every `page.tsx` under `app/(shell)/` that renders through `LegalLayout`, plus every page `POLICY_LINKS` points at
 * (/privacy keeps its own layout), plus /refunds. A new legal page that uses the legal chrome joins on its own.
 *
 * MUTATION: put "This feature is a limited pilot" back into privacy/page.tsx, or "Setnayan is in beta" into
 * terms/page.tsx → this fails, naming the file and line.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

const PILOT_WORDING = /\b(?:pilot(?:s|ed|ing)?|beta)\b/i;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === 'page.tsx') out.push(p);
  }
  return out;
}

function pageFor(href: string): string {
  return join(HERE, ...href.replace(/^\//, '').split('/'), 'page.tsx');
}

function legalPages(): string[] {
  const set = new Set<string>();
  for (const p of walk(HERE)) {
    if (/\bLegalLayout\b/.test(readFileSync(p, 'utf8'))) set.add(p);
  }
  for (const href of [...POLICY_LINKS.map((l) => l.href), '/refunds']) {
    const p = pageFor(href);
    assert.ok(existsSync(p), `${href} has no page at ${relative(HERE, p)} — the guard cannot read it`);
    set.add(p);
  }
  return [...set].sort();
}

test('the guard reads every policy page, including /privacy (which has its own layout)', () => {
  const pages = legalPages().map((p) => relative(HERE, p).split(sep).join('/'));
  for (const must of [
    'privacy/page.tsx',
    'terms/page.tsx',
    'refunds/page.tsx',
    'acceptable-use/page.tsx',
    'cookies/page.tsx',
  ]) {
    assert.ok(pages.includes(must), `${must} is not read — got ${pages.join(', ')}`);
  }
});

test('the matcher catches pilot/beta wording and leaves look-alikes alone', () => {
  for (const bad of ['limited pilot', 'Setnayan is piloting a', 'During the pilot', 'in Beta', 'pilots']) {
    assert.match(bad, PILOT_WORDING, bad);
  }
  for (const ok of ['Pilipinas', 'alphabetical', 'betamax-free', 'autopilotless']) {
    // "betamax-free" contains "beta" only as a prefix of a longer word.
    assert.doesNotMatch(ok, PILOT_WORDING, ok);
  }
});

test('no public legal page calls Setnayan or a feature a pilot or a beta', () => {
  const hits: string[] = [];
  for (const p of legalPages()) {
    for (const s of copyStrings(readFileSync(p, 'utf8'), p)) {
      if (PILOT_WORDING.test(s.text)) {
        hits.push(`${relative(HERE, p).split(sep).join('/')}:${s.line}  "${s.text.trim().replace(/\s+/g, ' ')}"`);
      }
    }
  }
  assert.deepEqual(hits, [], `pilot/beta wording on a public legal page:\n  ${hits.join('\n  ')}`);
});
