/**
 * the-public-page-shows-no-internals.test.ts — /features, /tl/features and every
 * feature page say what a visitor can use, in a visitor's words: no route path,
 * no code span, no column or flag name.
 *
 * QA 2026-10-22 (F2): the "who's who" section printed a path under each role —
 * `/dashboard`, `/vendor-dashboard`, `/[slug]`, `/admin` — in a <code> span, and
 * the team's card said "Gated behind is_internal". Our routing table and a
 * database column, published to strangers in two languages; the same class the
 * 2026-10-19 sweep removed from /help (row B3, `lib/public-help-says-what-is-true.test.ts`).
 *
 * HOW IT LOOKS — by RENDERING, not by reading the source. The hub is painted
 * with renderToStaticMarkup in both locales and the guard reads the text a
 * visitor sees (plus aria-label / alt / title, which a screen reader reads out).
 * A path that moves to a new constant, a new section or a new file is still
 * caught, and a path in a code comment is not (comments do not render). The
 * feature pages are async (they read the price catalogue), so their registry —
 * every prose field the page draws — is read directly.
 *
 * Domain-qualified addresses ("setnayan.com") are a thing a person can type and
 * are allowed; the JSON-LD <script> is for crawlers and is not visible text.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

import type { MarketingLocale } from '@/lib/marketing-i18n';

// The feature registry's types module carries `server-only`; outside Next it throws.
(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCALES: readonly MarketingLocale[] = ['en', 'tl'];

/** Internals a stranger should never be shown. Same family as the /help guard's list. */
const INTERNALS: ReadonlyArray<[string, RegExp]> = [
  // A path standing on its own: "/admin", "/vendor-dashboard", "/[slug]", "/explore".
  ['a bare route path', /(?:^|[\s(“"'‘])\/[a-z[][a-z0-9[\]-]*/],
  // A route-segment placeholder in any form.
  ['a route placeholder', /\[(?:slug|eventId|id|[a-z]+Id)\]/],
  // snake_case — a column, a flag, an env name.
  ['a column or flag name', /\b[a-z]+_[a-z0-9_]+\b/],
  ['an env name', /\b(?:NEXT_PUBLIC|SUPABASE|RESEND)_[A-Z_]+\b/],
  ['a code span', /`/],
];

function offenders(where: string, text: string): string[] {
  const out: string[] = [];
  for (const [what, re] of INTERNALS) {
    const m = re.exec(text);
    if (m) out.push(`${where}: ${what} — “…${text.slice(Math.max(0, m.index - 30), m.index + 40).trim()}…”`);
  }
  return out;
}

/**
 * Every section of the hub that paints synchronously, in page order. The one
 * left out, `_FeatureGroups`, is async (it reads the price catalogue) — its
 * words are the registry's `name` / `line`, held by the second test below.
 * `features-tagging.test.ts` holds the hub's section list; a new section added
 * to `_PageBody.tsx` without joining this list fails the count check here.
 */
const SYNC_SECTIONS = ['_Hero', '_Ecosystem', '_WhySetnayan', '_HowItWorks', '_FinalCTA'] as const;

async function paint(locale: MarketingLocale): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const html: string[] = [];
  for (const name of SYNC_SECTIONS) {
    const mod = (await import(`./_sections/${name}`)) as Record<string, unknown>;
    const comps = Object.values(mod).filter(
      (v): v is React.FC<{ locale: MarketingLocale }> => typeof v === 'function' && /^[A-Z]/.test((v as { name: string }).name),
    );
    assert.ok(comps.length > 0, `${name} exports no section component — re-point this guard`);
    for (const C of comps) html.push(renderToStaticMarkup(React.createElement(C, { locale })));
  }
  return html.join('\n');
}

test('every section the hub draws is painted here, or is the async catalogue one', () => {
  const body = readFileSync(join(HERE, '_PageBody.tsx'), 'utf8');
  const drawn = [...stripComments(body).matchAll(/from '\.\/_sections\/(_\w+)'/g)].map((m) => m[1]);
  assert.deepEqual(
    drawn.filter((s) => s !== '_FeatureGroups' && !(SYNC_SECTIONS as readonly string[]).includes(s!)),
    [],
    'a new /features section is not painted by this guard',
  );
});

/** Visible text + the attributes a screen reader speaks, one entry per node. */
function visibleStrings(html: string): string[] {
  const noScript = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
  const decode = (s: string) =>
    s
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  const out: string[] = [];
  for (const m of noScript.matchAll(/\s(?:aria-label|alt|title)="([^"]*)"/g)) out.push(decode(m[1]!));
  for (const t of noScript.split(/<[^>]+>/)) {
    const s = decode(t).trim();
    if (s) out.push(s);
  }
  return out;
}

test('the /features hub shows no route path, code span or column name — both locales (F2)', async () => {
  const found: string[] = [];
  for (const locale of LOCALES) {
    const html = await paint(locale);
    const strings = visibleStrings(html);
    console.log(`[no-internals] /features ${locale}: ${strings.length} visible strings`);
    // A painted page that says nothing proves nothing.
    assert.ok(strings.length > 100, `/features ${locale} painted only ${strings.length} strings — did the render fail?`);
    assert.ok(
      strings.some((s) => /who’s who|sino-sino/.test(s)),
      `/features ${locale}: the "who's who" section did not paint — this guard would be blind to it`,
    );
    if (/<code\b/.test(html)) found.push(`/features ${locale}: a <code> element`);
    for (const s of strings) found.push(...offenders(`/features ${locale}`, s));
  }
  assert.deepEqual(found, [], 'The public /features page shows internals to strangers:\n  ' + found.join('\n  '));
});

test('every feature page’s words show no route path, code span or column name (F2)', async () => {
  const { FEATURE_PAGES } = await import('@/lib/feature-pages');
  assert.ok(FEATURE_PAGES.length > 10, 'the feature registry is empty — re-point this guard');
  const found: string[] = [];
  let n = 0;
  for (const f of FEATURE_PAGES) {
    for (const l of LOCALES) {
      const prose: string[] = [
        f.name[l],
        f.line[l],
        f.title[l],
        f.description[l],
        f.answer[l],
        f.forWho[l],
        ...f.steps[l],
        ...f.different[l],
        ...f.worksWith.map((w) => w.how[l]),
        ...f.faq[l].flatMap((q) => [q.q, q.a]),
        ...f.shots.map((s) => s.alt[l]),
      ];
      for (const p of prose) {
        n++;
        found.push(...offenders(`/features/${f.slug} ${l}`, p));
      }
    }
  }
  console.log(`[no-internals] ${FEATURE_PAGES.length} feature pages, ${n} prose strings`);
  assert.deepEqual(found, [], 'A public feature page shows internals to strangers:\n  ' + found.join('\n  '));
});
