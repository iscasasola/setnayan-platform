import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { APP_ONLY_ATTR, isStoreShellWebOnlyPath } from '@/lib/store-shell';
import { stripComments } from '@/lib/strip-comments';

/**
 * 🍎 THE APP'S SUPPLIER DOOR NAMES NO PRICE (controller 22 Nov 2026; drawing
 * `prototypes/app_supplier_door_2026-11-22`).
 *
 * The iPhone app hides "For suppliers" and "For coordinators" (both show plan prices — App Review 3.1.1, owner ruling
 * #6729 "the app names no paid service"), so a supplier inside the app had no way to sign up. The door added back is
 * ONE plain "Open your shop" row into the FREE sign-up, and the sign-up it opens, asked for by the store shell, sells no
 * plan and shows no price. This file holds both halves:
 *
 *   ① every `data-app-only` rail link opens a door the app does not refuse, is none of the paid pages, and its words
 *      carry no peso, no digit and no plan name — exactly ONE such door when signed out and ONE when signed in (gated
 *      on `canOpenShop`);
 *   ② `/open-shop` asked for by the store shell drops `?plan=` and the plan ladder, and the wizard in that mode holds
 *      the picks to Free, never shows the plan sheet, says only "Add more later." at the pick (no ⓘ) and keeps the fee
 *      line with no ⓘ and no number; nothing in the wizard links a paid page.
 *
 * Why a source read and not a render: the wizard imports a server action (`taken-sign-in` → `login/actions` →
 * `lib/auth`), which cannot load outside Next. The pins below are the store-shell BRANCHES themselves.
 *
 * SABOTAGE (22 Nov 2026, run once each, went red, restored): the signed-out row's href set to `/for-suppliers`
 * → ① red ("refused in the app"); `!storeShell &&` taken off `overFree` → ② red.
 *
 * Run: cd apps/web && npx tsx --test app/_components/frontdoor/the-app-supplier-door-names-no-price.test.ts
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

const SHELL = 'app/_components/frontdoor/front-door-shell.tsx';
const PAGE = 'app/open-shop/page.tsx';
const WIZARD = 'app/open-shop/_components/open-shop-wizard.tsx';
const CARDS = 'app/open-shop/_components/service-cards.tsx';

/** The paid pages the app's door must never open, refused list or not. */
const PAID_PAGES = ['/for-suppliers', '/for-coordinators', '/pricing', '/vendor-dashboard/subscription'];
/** A price or a plan in words: a peso, any digit, a percent, or a plan's name. */
const NAMES_A_PRICE = /₱|\d|%|\bplans?\b|\bpricing\b|\b(?:Supplier Plus|Plus|Pro|Ultra|Solo|Enterprise)\b/i;

type Door = { href: string; words: string; branch: 'signed-in' | 'signed-out' | 'neither'; gatedOnShop: boolean; line: number };

/** Every JSX element in the source carrying `data-app-only` — its href, its words, and which account branch holds it. */
function appOnlyDoors(source: string): Door[] {
  const sf = ts.createSourceFile('x.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Door[] = [];
  const wordsOf = (n: ts.Node): string => {
    const parts: string[] = [];
    const walk = (k: ts.Node) => {
      if (ts.isJsxText(k)) parts.push(k.text);
      else if (ts.isStringLiteral(k) && !ts.isJsxAttribute(k.parent)) parts.push(k.text);
      ts.forEachChild(k, walk);
    };
    if (ts.isJsxElement(n)) n.children.forEach(walk);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  };
  const visit = (n: ts.Node) => {
    const opening = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null;
    if (opening?.attributes.properties.some((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === APP_ONLY_ATTR)) {
      const hrefAttr = opening.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === 'href');
      const href =
        hrefAttr && ts.isJsxAttribute(hrefAttr) && hrefAttr.initializer && ts.isStringLiteral(hrefAttr.initializer)
          ? hrefAttr.initializer.text
          : '(not a literal href)';
      let branch: Door['branch'] = 'neither';
      let gatedOnShop = false;
      for (let c: ts.Node = n, p = n.parent; p; c = p, p = p.parent) {
        if (ts.isConditionalExpression(p)) {
          const cond = p.condition.getText(sf);
          if (cond === 'account.canOpenShop' && c === p.whenTrue) gatedOnShop = true;
          if (cond === 'account.signedIn' && branch === 'neither') branch = c === p.whenTrue ? 'signed-in' : 'signed-out';
        }
      }
      out.push({ href, words: wordsOf(n), branch, gatedOnShop, line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** What a door gets wrong — empty when it opens a free, unrefused page and names no price. */
function doorFaults(d: Door): string[] {
  const bad: string[] = [];
  if (!d.href.startsWith('/')) bad.push(`${d.href} is not a literal in-app path`);
  else if (isStoreShellWebOnlyPath(d.href)) bad.push(`${d.href} is refused in the app`);
  if (PAID_PAGES.some((p) => d.href === p || d.href.startsWith(`${p}/`) || d.href.startsWith(`${p}?`)))
    bad.push(`${d.href} is a paid page`);
  if (NAMES_A_PRICE.test(d.words)) bad.push(`its words "${d.words}" name a price or a plan`);
  return bad;
}

/* ── ① THE RAIL ─────────────────────────────────────────────────────────────────────────────────────────────── */

test('① every data-app-only rail link opens a free, unrefused door and names no price', () => {
  const doors = appOnlyDoors(read(SHELL));
  assert.ok(doors.length >= 2, `anti-vacuity: only ${doors.length} data-app-only links found in the rail`);
  const bad = doors.flatMap((d) => doorFaults(d).map((f) => `${SHELL}:${d.line} — ${f}`));
  assert.deepEqual(bad, [], 'The app shows this row. It must open the free sign-up and say no price, no plan.');
});

test('① exactly one door signed out and one signed in — the signed-in one only while the account may open a shop', () => {
  const doors = appOnlyDoors(read(SHELL));
  const out = doors.filter((d) => d.branch === 'signed-out');
  const inn = doors.filter((d) => d.branch === 'signed-in');
  assert.equal(out.length, 1, `signed-out app doors: ${out.map((d) => `${d.href}@${d.line}`).join(', ') || 'none'}`);
  assert.equal(inn.length, 1, `signed-in app doors: ${inn.map((d) => `${d.href}@${d.line}`).join(', ') || 'none'}`);
  assert.equal(inn[0]!.gatedOnShop, true, 'the signed-in door shows to an account that cannot open a shop');
  assert.equal(doors.filter((d) => d.branch === 'neither').length, 0, 'an app door outside the signed-in/out branches');
  for (const d of [...out, ...inn]) assert.equal(d.href, '/open-shop', 'the app door opens the free sign-up');
});

test('① the checker catches a paid door, a priced label and a refused page', () => {
  const one = (src: string) => appOnlyDoors(`const a = ${src};`).flatMap(doorFaults);
  assert.equal(one('<Link href="/open-shop" data-app-only="">Open your shop</Link>').length, 0);
  assert.ok(one('<Link href="/for-suppliers" data-app-only="">Open your shop</Link>').length > 0);
  assert.ok(one('<Link href="/pricing" data-app-only="">Open</Link>').length > 0);
  assert.ok(one('<Link href="/open-shop" data-app-only="">Open your shop · Pro</Link>').length > 0);
  assert.ok(one('<Link href="/open-shop" data-app-only="">From ₱0</Link>').length > 0);
  assert.ok(one('<Link href="/open-shop" data-app-only=""><span>{"3 plans"}</span></Link>').length > 0);
});

test('① data-app-only is hidden everywhere but the app, before first paint', () => {
  assert.match(read('app/globals.css'), /html:not\(\[data-store-shell\]\)\s*\[data-app-only\]\s*\{\s*display:\s*none\s*!important;/);
});

/* ── ② THE SIGN-UP IT OPENS ─────────────────────────────────────────────────────────────────────────────────── */

test('② /open-shop asked for by the app drops ?plan= and the plan ladder', () => {
  const page = stripComments(read(PAGE));
  assert.match(page, /const storeShell = await isStoreShellRequest\(\);/);
  assert.match(page, /const plan = storeShell \? undefined : askedPlan;/);
  assert.equal((page.match(/\baskedPlan\b/g) ?? []).length, 2, 'askedPlan is read somewhere other than through `plan`');
  assert.match(page, /storeShell=\{storeShell\}/);
  assert.match(page, /planCategories=\{storeShell \? \[\] : categoryLadder\(\)\}/);
});

test('② the wizard in the app: no plan sheet, picks held to Free, "Add more later." with no ⓘ', () => {
  const w = stripComments(read(WIZARD));
  assert.match(w, /const overFree = !storeShell && holdsMoreThanFree\(/, 'the plan sheet can open in the app');
  assert.equal((w.match(/<PlanOnLastScreen\b/g) ?? []).length, 1);
  assert.match(w, /\{overFree \? <PlanOnLastScreen /, 'the plan sheet is drawn without the overFree gate');
  assert.match(w, /freeOnly=\{storeShell\}/, 'the service cards are not held to Free in the app');
  assert.match(w, /if \(d\.added\?\.length && !storeShell\) setAdded\(/, 'a web draft re-adds services in the app');
  // The step-1 hint: the app branch is the plain line and nothing else.
  const hint = w.slice(w.indexOf('data-open-shop-plan-hint'));
  const app = /\{storeShell \? \(\s*([\s\S]*?)\s*\) : planCategories\.length > 0 \?/.exec(hint);
  assert.ok(app, 'the step-1 hint has no store-shell branch');
  assert.equal(app[1], "'Add more later.'");
});

test('② the fee line in the app keeps its words and loses its ⓘ and its number', () => {
  const w = stripComments(read(WIZARD));
  assert.match(w, /\{feeNotice && !storeShell \? \(/, 'the ⓘ with the live rate shows in the app');
  const m = /<p data-open-shop-fee-plain=""[^>]*>([\s\S]*?)<\/p>/.exec(w);
  assert.ok(m, 'the app has no plain fee line');
  const body = m[1]!.trim();
  assert.equal(body, 'Free to open, free to run. You pay only when a couple books you through Setnayan.');
  assert.doesNotMatch(body, /[{<₱%\d]/);
});

test('② the cards in the app add nothing past the main and show no plan meter', () => {
  const c = stripComments(read(CARDS));
  assert.match(c, /const over = !freeOnly && holdsMoreThanFree\(list\);/);
  assert.match(c, /\{remain\.length && !freeOnly \? \(/, '"Also do …" shows in the app');
  assert.match(c, /\{adding \|\| freeOnly \? null : \(/, '"Another category" shows in the app');
  assert.match(c, /\{adding && !freeOnly \? \(/, 'the add picker opens in the app');
  assert.match(c, /\{freeOnly \? null : <CoverageMeter /, 'the plan meter shows in the app');
});

test('② nothing in the sign-up links a paid page', () => {
  for (const f of [WIZARD, CARDS, 'app/open-shop/_components/plan-sheet.tsx']) {
    const src = stripComments(read(f));
    for (const p of PAID_PAGES) assert.ok(!src.includes(`'${p}`) && !src.includes(`"${p}`) && !src.includes(`\`${p}`), `${f} links ${p}`);
  }
});
