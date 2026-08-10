/**
 * GUARD — the public "what connecting Google does" page cannot describe a scope
 * we do not request, and cannot go stale when a scope changes.
 *
 * WHY THIS EXISTS. This page is submitted to Google's OAuth verification review.
 * If it names a permission string that no longer matches the one the code asks
 * for, the submission is refused and every resubmission costs days. The two
 * scope constants are maintained for their own reasons — they are what the
 * authorize URLs are built from — so this is not two hand-typed lists agreeing
 * with each other.
 *
 * It also pins the two claims that would be UNTRUE if the code changed under
 * them: that Setnayan never sends video, and that the Drive permission is
 * limited to files Setnayan created.
 *
 * And it pins the SHARE CARD — see the second guard block below. Next replaces
 * `openGraph`/`twitter` wholesale instead of merging them, so a partial override
 * silently deletes the parent's keys on this URL alone.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { metadata } from './page';

const PAGE = path.join(import.meta.dirname, 'page.tsx');
const WEB_ROOT = path.join(import.meta.dirname, '..', '..', '..');
const LAYOUT = path.join(WEB_ROOT, 'app', 'layout.tsx');

/**
 * The page's REAL exported metadata object, viewed loosely.
 *
 * Deliberately not the precisely-inferred type: under the inferred type,
 * deleting `twitter` from the page would be a TYPE error rather than a test
 * failure, so this guard could never be mutation-tested honestly. Loosening the
 * view means a deleted key arrives here as `undefined` and turns the assertion
 * below red — which is what a guard is for.
 */
type MetaImage = { url?: unknown; width?: unknown; height?: unknown };
const meta = metadata as unknown as {
  title?: unknown;
  description?: unknown;
  openGraph?: Record<string, unknown> & { images?: MetaImage[] };
  twitter?: Record<string, unknown> & { images?: unknown[] };
};

/**
 * The scope constants, read as TEXT out of the modules that declare them.
 * Both modules open with `import 'server-only'`, which throws the moment a node
 * test requires them, so importing the symbols is not available here. Reading
 * the real declaration is still reading the thing the authorize URLs are built
 * from — it is not a second hand-typed list.
 */
function declaredScopes(): string[] {
  const files = [
    path.join(WEB_ROOT, 'lib', 'panood-youtube.ts'),
    path.join(WEB_ROOT, 'lib', 'papic-drive.ts'),
  ];
  const out: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const decl = /export const (?:YOUTUBE|DRIVE)_OAUTH_SCOPES\s*=\s*\[([\s\S]*?)\]/.exec(src);
    assert.ok(
      decl,
      `Could not find the *_OAUTH_SCOPES array in ${path.basename(file)}. It is what ` +
        'the consent URL is built from; if it moved, move this guard with it.',
    );
    const scopes = decl[1]!.match(/https:\/\/www\.googleapis\.com\/auth\/[\w.]+/g) ?? [];
    assert.ok(
      scopes.length > 0,
      `${path.basename(file)} declares an *_OAUTH_SCOPES array with no scope in it.`,
    );
    out.push(...scopes);
  }
  return out;
}

/** Comment-stripped source: the page's own docblock quotes both scope strings. */
function renderedSource(): string {
  return readFileSync(PAGE, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

test('every scope the code requests is named on the public page', () => {
  const src = renderedSource();
  for (const scope of declaredScopes()) {
    assert.ok(
      src.includes(scope),
      `/privacy/google-access does not name the scope "${scope}", which the code ` +
        'actually requests at consent time. Google reviews the homepage/disclosure ' +
        'against the scopes on the consent screen; an unnamed scope is a refusal.',
    );
  }
});

test('the page names no Google scope the code does not request', () => {
  const src = renderedSource();
  const declared = new Set<string>(declaredScopes());
  const named = src.match(/https:\/\/www\.googleapis\.com\/auth\/[\w.]+/g) ?? [];
  for (const scope of named) {
    assert.ok(
      declared.has(scope),
      `/privacy/google-access claims Setnayan asks for "${scope}", but no OAuth ` +
        'constant requests it. Promising a permission we do not hold — or naming ' +
        'a retired one such as auth/youtube.upload, dropped 2026-07-25 — is a false ' +
        'statement in a document handed to a regulator-facing reviewer.',
    );
  }
});

/**
 * The top-level keys of an object literal, scanned depth-aware so nested keys
 * (an image's `width`, a scope string containing a colon) are never counted.
 * `src` must start at or before the object's opening brace.
 */
function topLevelKeys(src: string): string[] {
  const open = src.indexOf('{');
  assert.notEqual(open, -1, 'topLevelKeys() was handed something with no object in it.');
  const keys: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let token = '';
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i]!;
    if (quote !== null) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      token = '';
    } else if (ch === '{' || ch === '[' || ch === '(') {
      depth += 1;
      token = '';
    } else if (ch === '}' || ch === ']' || ch === ')') {
      depth -= 1;
      token = '';
      if (depth === 0) break;
    } else if (depth === 1 && ch === ':' && token !== '') {
      keys.push(token);
      token = '';
    } else if (/[A-Za-z0-9_$]/.test(ch)) {
      token += ch;
    } else {
      token = '';
    }
  }
  return keys;
}

/** Brace-match the object literal that follows `label` in `src`. */
function objectAfter(src: string, label: string, where: string): string {
  const at = src.indexOf(label);
  assert.notEqual(at, -1, `Could not find \`${label}\` in ${where}; if it moved, move this guard with it.`);
  const open = src.indexOf('{', at);
  assert.notEqual(open, -1, `\`${label}\` in ${where} is not followed by an object literal.`);
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i]!;
    if (quote !== null) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  assert.fail(`Unbalanced braces after \`${label}\` in ${where}.`);
}

/**
 * The keys the ROOT LAYOUT states for `openGraph` / `twitter`, read out of the
 * declaration that actually produces the parent tags. Derived, not hand-typed:
 * adding a key to the layout raises the bar here automatically, which is the
 * only version of "an override must be COMPLETE" that cannot go stale.
 *
 * `baseMetadata` is the right source: layout.tsx's generateMetadata() spreads it
 * and overrides `icons` only, so these two objects ARE the inherited card. The
 * layout cannot simply be imported — it pulls in globals.css, which node cannot
 * parse — so its declaration is read as text.
 */
function layoutKeys(which: 'openGraph' | 'twitter'): string[] {
  // Comments are stripped FIRST, both kinds. layout.tsx's own prose mentions
  // "twitter:card", and an un-stripped read matched that sentence instead of the
  // object — the guard then demanded a key nobody had ever set. `//` inside a URL
  // is preserved by requiring the slashes not to follow a colon.
  const src = readFileSync(LAYOUT, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const rootMetadata = objectAfter(src, 'const baseMetadata', 'app/layout.tsx');
  const keys = topLevelKeys(objectAfter(rootMetadata, `${which}:`, 'app/layout.tsx baseMetadata'));
  assert.ok(keys.length > 0, `app/layout.tsx declares an empty \`${which}\` object.`);
  return keys;
}

/**
 * GUARD — Next REPLACES `openGraph`/`twitter` wholesale rather than merging them
 * (next/dist/lib/metadata/resolve-metadata.js, `case 'openGraph':`). Measured on
 * the live homepage 2026-08-09: a three-key override there deleted og:site_name,
 * og:type, og:locale and the 1200×630 card from `/` alone. This page shipped with
 * the SAME partial shape — no `images`, and no `twitter` object at all, so the
 * legal summary would have been shared under the layout's marketing words.
 *
 * These assertions run against the page's REAL exported object, not its source
 * text, so they pin the behaviour rather than one line of code. Mutation-tested
 * 2026-08-09: dropping `images`, dropping the whole `twitter` object, downgrading
 * the card to 'summary', and pointing twitter's words back at the marketing copy
 * each turn this file red.
 */
for (const which of ['openGraph', 'twitter'] as const) {
  test(`the page's ${which} override restates every key the root layout sets`, () => {
    const override = meta[which];
    assert.ok(
      override && typeof override === 'object',
      `app/privacy/google-access/page.tsx declares no \`${which}\` object. Next does ` +
        'not merge it — omitting it hands this legal summary the ROOT LAYOUT\'s ' +
        'marketing title and description, and declaring a partial one deletes ' +
        'whatever it leaves out. State it in full or not at all.',
    );
    const present = Object.keys(override);
    for (const key of layoutKeys(which)) {
      assert.ok(
        present.includes(key),
        `app/privacy/google-access/page.tsx overrides \`${which}\` without \`${key}\`, ` +
          `which app/layout.tsx sets. The override REPLACES the parent, so \`${key}\` ` +
          'is deleted on this URL only — silently, with no error and no failing type. ' +
          'An override object must be COMPLETE, not a patch.',
      );
    }
  });
}

test('the page keeps the 1200×630 brand card on both cards', () => {
  const image = meta.openGraph?.images?.[0];
  assert.ok(image, 'The page\'s openGraph.images array is missing or empty — sharing this URL renders a bare link.');
  assert.equal(typeof image.url, 'string');
  assert.ok((image.url as string).length > 0, 'openGraph image url is empty.');
  assert.equal(image.width, 1200, 'The shared card must stay the 1200×630 size Google, Facebook and X all render large.');
  assert.equal(image.height, 630, 'The shared card must stay the 1200×630 size Google, Facebook and X all render large.');

  assert.equal(
    meta.twitter?.card,
    'summary_large_image',
    "The twitter override must state `card: 'summary_large_image'`. Without it Next " +
      'auto-fills the tiny "summary" thumbnail — exactly how the homepage degraded.',
  );
  assert.ok(
    Array.isArray(meta.twitter?.images) && meta.twitter.images.length > 0,
    'The twitter override declares no image, so a large card has nothing to show.',
  );
});

test('the shared card carries THIS page\'s words, not the marketing homepage\'s', () => {
  for (const [which, override] of [
    ['openGraph', meta.openGraph],
    ['twitter', meta.twitter],
  ] as const) {
    assert.equal(
      override?.title,
      meta.title,
      `The ${which} title must be this page's own title. Anyone handed this URL — a ` +
        'Google reviewer included — must see a legal summary described as one, not ' +
        "under Setnayan's wedding-marketing headline.",
    );
    assert.equal(
      override?.description,
      meta.description,
      `The ${which} description must be this page's own description, for the same reason.`,
    );
  }
});

test('the two load-bearing factual claims are still on the page', () => {
  const src = renderedSource();

  assert.match(
    src,
    /does not send the video itself/,
    'The page must keep saying Setnayan does not send the video itself. Setnayan ' +
      'never transmits a video byte — the couple\'s own encoder pushes to the ' +
      'stream key — and Google\'s sensitive-scope review asks exactly this.',
  );
  assert.match(
    src,
    /restricts Setnayan to\s+files and folders the Setnayan app itself\s+created/,
    'The page must keep the "only files and folders the Setnayan app itself ' +
      'created" limit on the Drive permission. That limit is the whole reason ' +
      'drive.file is safe to grant, and it is the sentence a reviewer looks for.',
  );
});
