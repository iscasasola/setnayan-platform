/**
 * public-help-says-what-is-true.test.ts — /help, /about's FAQ and /llms.txt say
 * what is true TODAY, to the public only.
 *
 * ── WHAT SHIPPED (sweep 2026-10-19, rows A3 · B3 · B6) ──────────────────────
 *   · A3 — the FAQ an App Store reviewer reads INSIDE the iPhone app said the
 *     app did not exist ("Native iOS and Android shells via Expo are on the
 *     V1.5 roadmap"), and called Setnayan "a pilot with a small family +
 *     friends cohort". llms.txt told answer engines "Pilot 2026-06-01, public
 *     launch 2026-12-01" and "Native apps are in preparation".
 *   · B3 — /help published the operations team's own guides to strangers: an
 *     "Admin" role card, "/admin has 8 sections … gated to internal admins
 *     (`is_internal=TRUE`)", the two-admin rules, the force-majeure queue.
 *     A role FILTER was the only thing between them and the public, and the
 *     unfiltered view, the FAQPage JSON-LD, /help/[slug], the sitemap and site
 *     search all ignore filters.
 *   · B6 — "celebration" where the house word is "event"; "honour" beside
 *     "honor" in role names.
 *
 * ── WHAT THIS GUARDS — PROPERTIES, NOT THE OLD SENTENCES ────────────────────
 *   1. No public help topic is for the team. The audience set is closed
 *      (PUBLIC_HELP_ROLES), and no slug or key from lib/help-admin.ts is
 *      reachable from the public corpus.
 *   2. No public route imports lib/help-admin.ts — only `app/admin/**` may.
 *   3. No public help or llms.txt text talks about a future: roadmap, pilot,
 *      beta, "coming", a version number, "in preparation", "not yet shipped",
 *      "once X is live", a launch date.
 *   4. No public help text exposes internals: a bare route path, a code span,
 *      a column name.
 *   5. House words in public help: never "celebration(s)", one spelling
 *      "honor". The Papic free-credit CONDITION (`PAPIC_FREE_CREDIT_CONDITION`,
 *      interpolated by help.ts rather than retyped) was exempt until it was
 *      reworded to "on your first event" on 2026-10-19; it is held here now.
 *   6. The mobile-app answer is ONE function, true in both App Store states,
 *      and never claims an Android app.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

import { HELP_TOPICS, HELP_ROLES, PUBLIC_HELP_ROLES, ALL_HELP_ARTICLES, findHelpArticle } from './help';
import { ADMIN_HELP_TOPICS } from './help-admin';
import { renderLlmsTxt } from './llms-txt';
import { INPUT_FOR_GUARDS } from './llms-txt-guard-input';
import { mobileAppAnswer } from './where-setnayan-runs';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

/** Every string a stranger can read from the public help corpus. */
function publicHelpTexts(): Array<{ where: string; text: string }> {
  const out: Array<{ where: string; text: string }> = [];
  for (const r of HELP_ROLES) out.push({ where: `role ${r.key}`, text: `${r.label} ${r.blurb}` });
  for (const t of HELP_TOPICS) {
    out.push({ where: `topic ${t.key}`, text: t.label });
    for (const a of t.articles) out.push({ where: `${t.key}/${a.slug}`, text: `${a.title}\n${a.body}` });
  }
  return out;
}

const STORE_URL = 'https://apps.apple.com/ph/app/setnayan/id0000000000';

/** Talk about a future, a phase or a version — never true of what ships today. */
const FUTURE_TALK: ReadonlyArray<[string, RegExp]> = [
  ['roadmap', /\broad\s?map\b/i],
  ['pilot', /\bpilot\b/i],
  ['beta', /\bbeta\b/i],
  ['coming', /\bcoming\b/i],
  ['a version number', /\bV\d+(?:\.\d+)?\b/],
  ['in preparation', /\bin preparation\b/i],
  ['not yet shipped/built/live', /\bnot yet (?:shipped|built|live|available|wired)\b/i],
  ['"once X is live"', /\bonce\b[^.]{0,60}\bis (?:live|wired|ready|approved|shipped)\b/i],
  ['a launch date or phase', /\b(?:public launch|launch date|rolling out in phases|ahead of the [A-Z][a-z]+ \d{4} launch)\b/i],
  ['Expo', /\bExpo\b/],
];

/** Internals a stranger should never be shown. */
const INTERNALS: ReadonlyArray<[string, RegExp]> = [
  // A route path standing on its own ("/vendor-dashboard", "/admin/users") —
  // a domain-qualified one ("setnayan.com/pricing") is a link a person can type.
  ['a bare route path', /(?:^|[\s(“"'])\/[a-z][a-z0-9-]*(?:\/[a-z[\]-]*)*/],
  ['a code span', /`/],
  ['a column or flag name', /\b(?:is_internal|admin_audit_log|display_name|user_id)\b/],
];

test('the public help has no audience for the team (B3)', () => {
  assert.deepEqual(
    HELP_ROLES.map((r) => r.key).sort(),
    [...PUBLIC_HELP_ROLES].sort(),
    'HELP_ROLES and PUBLIC_HELP_ROLES disagree — every role card /help draws must be a public audience',
  );
  const allowed = new Set<string>(PUBLIC_HELP_ROLES);
  const offenders: string[] = [];
  for (const t of HELP_TOPICS) {
    if (t.roles.length === 0) offenders.push(`${t.key}: no audience at all`);
    for (const r of t.roles) if (!allowed.has(r)) offenders.push(`${t.key}: audience "${r}"`);
  }
  assert.deepEqual(offenders, [], 'A public help topic is addressed to someone who is not the public:\n  ' + offenders.join('\n  '));
});

test('no operations guide is reachable from the public corpus (B3)', () => {
  assert.ok(ADMIN_HELP_TOPICS.length > 0, 'lib/help-admin.ts is empty — has the content moved again? re-point this guard');
  const publicKeys = new Set(HELP_TOPICS.map((t) => t.key));
  const leaked: string[] = [];
  for (const t of ADMIN_HELP_TOPICS) {
    assert.equal(t.audience, 'admin');
    if (publicKeys.has(t.key)) leaked.push(`topic ${t.key}`);
    for (const a of t.articles) if (findHelpArticle(a.slug)) leaked.push(`/help/${a.slug}`);
  }
  // …and by content, so a copy under a NEW slug is caught too.
  const publicBodies = new Set(ALL_HELP_ARTICLES.map(({ article }) => article.body));
  for (const t of ADMIN_HELP_TOPICS) for (const a of t.articles) if (publicBodies.has(a.body)) leaked.push(`body of ${a.slug}`);
  assert.deepEqual(leaked, [], 'An operations guide is published on the public help:\n  ' + leaked.join('\n  '));
});

function sources(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, acc);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) acc.push(full);
  }
  return acc;
}

test('only /admin may import the operations guides (B3)', () => {
  const files = sources(join(WEB, 'app')).concat(sources(join(WEB, 'lib')), sources(join(WEB, 'components')));
  const importers = files.filter((f) => /['"](?:@\/lib\/|\.{1,2}\/(?:[\w-]+\/)*)help-admin['"]/.test(stripComments(readFileSync(f, 'utf8'))));
  const outside = importers
    .map((f) => relative(WEB, f))
    .filter((rel) => !rel.startsWith('app/admin/'));
  console.log(`[public-help] ${importers.length} importer(s) of help-admin, ${outside.length} outside app/admin`);
  assert.deepEqual(outside, [], 'A non-admin file imports lib/help-admin.ts — the operations guides would reach the public:\n  ' + outside.join('\n  '));
});

test('public help and llms.txt never talk about a future (A3)', () => {
  const llms = [undefined, STORE_URL].map((url) => {
    const prev = process.env.NEXT_PUBLIC_IOS_APP_STORE_URL;
    if (url) process.env.NEXT_PUBLIC_IOS_APP_STORE_URL = url;
    else delete process.env.NEXT_PUBLIC_IOS_APP_STORE_URL;
    try {
      return { where: `llms.txt (store url ${url ? 'set' : 'unset'})`, text: renderLlmsTxt(INPUT_FOR_GUARDS) };
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_IOS_APP_STORE_URL;
      else process.env.NEXT_PUBLIC_IOS_APP_STORE_URL = prev;
    }
  });
  const offenders: string[] = [];
  for (const { where, text } of publicHelpTexts().concat(llms)) {
    for (const [name, re] of FUTURE_TALK) {
      const m = re.exec(text);
      if (m) offenders.push(`${where}: ${name} — "…${text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')}…"`);
    }
  }
  console.log(`[public-help] ${publicHelpTexts().length} help strings + 2 llms renders scanned, ${offenders.length} future-talk hit(s)`);
  assert.deepEqual(offenders, [], 'Public copy describes a roadmap, phase or version instead of what ships today. Say what is true now, or say nothing:\n  ' + offenders.join('\n  '));
});

test('public help exposes no internals (B3)', () => {
  const offenders: string[] = [];
  for (const { where, text } of publicHelpTexts()) {
    for (const [name, re] of INTERNALS) {
      const m = re.exec(text);
      if (m) offenders.push(`${where}: ${name} — "${m[0].trim()}"`);
    }
  }
  assert.deepEqual(offenders, [], 'Public help shows a stranger the inside of the app:\n  ' + offenders.join('\n  '));
});

test('public help uses the house words (B6)', () => {
  const offenders: string[] = [];
  for (const { where, text } of publicHelpTexts()) {
    // The free-credit condition is one shared constant with its own guard. It
    // said "first celebration" until 2026-10-19 and was exempt here; it now says
    // "first event", so it is held to the same house words as everything else.
    const own = text;
    const c = /\bcelebrations?\b/i.exec(own);
    if (c) offenders.push(`${where}: "${c[0]}" — say "event"`);
    const h = /\bhonour\b/i.exec(own);
    if (h) offenders.push(`${where}: "${h[0]}" — the role name is spelled "honor"`);
  }
  assert.deepEqual(offenders, [], 'Public help strays from the house words:\n  ' + offenders.join('\n  '));
});

test('the mobile-app answer is one function, true in both App Store states (A3)', () => {
  const unlisted = mobileAppAnswer(undefined);
  const listed = mobileAppAnswer(STORE_URL);

  for (const [state, text] of [['unlisted', unlisted], ['listed', listed]] as const) {
    assert.match(text, /home screen/, `${state}: the installable web app is not named`);
    assert.match(text, /setnayan\.com\/download/, `${state}: the desktop app is not named`);
    assert.doesNotMatch(text, /Google Play|Play Store|Android app/i, `${state}: claims an Android app, and none is published`);
  }
  // Until the App Store listing exists, the answer neither denies nor promises it.
  assert.doesNotMatch(unlisted, /App Store|iPhone app|Setnayan app/i, 'unlisted: names an iPhone app nobody can download yet');
  // Once it exists, it is named, with its link LAST — /help/[slug] links every
  // `https?://\S+`, so punctuation after the URL would become part of it.
  assert.ok(listed.includes('App Store') && listed.endsWith(STORE_URL), 'listed: the App Store link is missing or not last');

  // Every surface prints the same answer, so they cannot drift apart again.
  assert.equal(findHelpArticle('does-setnayan-have-mobile-app')?.article.body, mobileAppAnswer(), '/help types its own mobile-app answer');
  assert.ok(renderLlmsTxt(INPUT_FOR_GUARDS).includes(mobileAppAnswer()), '/llms.txt types its own mobile-app answer');
});
