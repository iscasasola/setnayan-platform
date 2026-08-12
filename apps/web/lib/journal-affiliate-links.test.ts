import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALL_BLOG_ARTICLES,
  isValidShopHref,
  articleHasShopLinks,
  AFFILIATE_DISCLOSURE,
  blogPlainText,
  type BlogBlock,
} from './blog';

/**
 * AN AFFILIATE LINK THAT IS WRONG STILL LOOKS RIGHT.
 *
 * Three failures in this feature are all SILENT — the page renders, the reader
 * clicks, nothing errors, and the only symptom is an absence:
 *
 *   1. A missing rel="sponsored". Google reads a commercial link without it as
 *      a paid link scheme and the penalty lands on the DOMAIN — all 81 Journal
 *      articles, i.e. precisely the organic traffic the affiliate money depends
 *      on. Nothing in the app can detect this; we would find out as a ranking
 *      collapse months later with no event to point at.
 *   2. A missing disclosure. The link works, the money arrives, and we have
 *      quietly stopped telling readers that an article earns. That is a trust
 *      failure, and trust is the whole product.
 *   3. A malformed href. Earns ₱0 forever while looking exactly like one that
 *      earns — the failure mode of every affiliate programme.
 *
 * 🪤 NON-VACUITY — the trap this file is built around. There are ZERO shop
 * blocks authored today, so scanning the real article set proves NOTHING on its
 * own; a guard that cannot fail is decoration, and this repo has shipped five
 * of those in one week. So the tests below come from three directions:
 *   • the PREDICATE is proven to reject the mistakes an editor will actually
 *     make (relative path, http, our own domain),
 *   • the DETECTOR is proven to fire on a synthetic block, so it has not
 *     silently stopped matching the union,
 *   • the RENDERER's rel and the PAGE's disclosure are read out of source with
 *     comments stripped first — because a rule that lives only in a comment is
 *     exactly what a comment-matching guard would happily accept.
 * The day the first shop block is authored, this is already armed.
 */

const WEB = join(import.meta.dirname, '..');
const SHOP_LINK_SRC = join(WEB, 'app/blog/[slug]/_components/shop-link.tsx');
const ARTICLE_PAGE_SRC = join(WEB, 'app/blog/[slug]/page.tsx');

/** Source with comments removed. Without this, every assertion below could be
 *  satisfied by prose ABOUT the rule instead of the rule — the exact way a
 *  removal comment blinded an earlier guard in this repo. */
function codeOnly(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

type ShopBlock = Extract<BlogBlock, { type: 'shop' }>;

function shopBlocksIn(
  articles: ReadonlyArray<{ slug: string; blocks: ReadonlyArray<BlogBlock> }>,
): Array<{ slug: string; index: number; block: ShopBlock }> {
  const out: Array<{ slug: string; index: number; block: ShopBlock }> = [];
  for (const article of articles) {
    article.blocks.forEach((block, index) => {
      if (block.type === 'shop') {
        out.push({ slug: article.slug, index, block: block as ShopBlock });
      }
    });
  }
  return out;
}

// ─── 1. The rel. The one that costs us the whole site. ───────────────────────

test('the outbound shop link is marked sponsored + nofollow + noopener + noreferrer', () => {
  const src = codeOnly(SHOP_LINK_SRC);
  const relMatch = src.match(/rel\s*=\s*["']([^"']+)["']/);
  assert.ok(
    relMatch,
    'ShopLink renders no rel= attribute at all. A commercial link without ' +
      'rel="sponsored" is read by Google as a paid link scheme and the penalty ' +
      'lands on the whole domain — every Journal article, not just this one.',
  );
  const rel = relMatch![1].split(/\s+/);
  for (const token of ['sponsored', 'nofollow', 'noopener', 'noreferrer']) {
    assert.ok(
      rel.includes(token),
      `ShopLink's rel is "${relMatch![1]}" — missing "${token}". All four are ` +
        'load-bearing; see the component docblock before thinning this list.',
    );
  }
});

test('the shop link opens the merchant in a new tab', () => {
  const src = codeOnly(SHOP_LINK_SRC);
  assert.match(
    src,
    /target\s*=\s*["']_blank["']/,
    'A reader who taps a shop link and loses their place in the article is a ' +
      'reader who does not come back to finish it.',
  );
});

test('the shop link survives without analytics — the href is plain HTML', () => {
  const src = codeOnly(SHOP_LINK_SRC);
  assert.doesNotMatch(
    src,
    /preventDefault\s*\(/,
    'The navigation must not be intercepted. An affiliate link that only ' +
      'works after hydration earns nothing from the reader who taps it early.',
  );
  assert.match(
    src,
    /catch\s*(\{|\()/,
    'The analytics call must be wrapped — a blocked or un-inited SDK must ' +
      'never swallow the click.',
  );
});

// ─── The two defects the FIRST cut of this component shipped. ────────────────
// Both were caught by reading the existing PostHog provider instead of trusting
// the obvious import. Neither would ever have produced an error.

test('the shop link does not statically import posthog-js', () => {
  const src = codeOnly(SHOP_LINK_SRC);
  assert.doesNotMatch(
    src,
    /^\s*import\s+[^;]*\bfrom\s+['"]posthog-js['"]/m,
    'A static import drops ~60 kB gzipped into the ARTICLE bundle — on the one ' +
      'page whose whole job is to rank and load fast. The provider lazy-loads ' +
      'it into its own chunk for exactly this reason; load it inside onClick.',
  );
  assert.match(
    src,
    /import\(\s*['"]posthog-js['"]\s*\)/,
    'The click counter should still exist — just deferred to the click.',
  );
});

test('the shop link refuses to count a click without analytics consent', () => {
  const src = codeOnly(SHOP_LINK_SRC);
  assert.match(
    src,
    /analyticsAllowed\s*\(\s*\)/,
    'Counting a click from a reader who declined analytics is third-party ' +
      'tracking — which /privacy tells the public we do not do. That promise ' +
      'is precisely what keeps affiliate links clear of the display-ad problem.',
  );
  // The gate must SHORT-CIRCUIT, not merely be consulted. Calling a check and
  // dropping its answer reads as more thorough than not checking at all.
  assert.match(
    src,
    /if\s*\(\s*!\s*analyticsAllowed\s*\(\s*\)\s*\)\s*return/,
    'analyticsAllowed() is called but nothing acts on it.',
  );
});

// ─── 2. The disclosure. Derived, never hand-added. ───────────────────────────

test('the article page derives the disclosure from the blocks', () => {
  const src = codeOnly(ARTICLE_PAGE_SRC);
  assert.match(
    src,
    /articleHasShopLinks\s*\(\s*article\.blocks\s*\)/,
    'The disclosure must be driven by the article\'s own blocks. Hand-adding ' +
      'it means an editor can ship a shopping link without one — and can ' +
      'leave a stale one after removing the last link.',
  );
  assert.match(
    src,
    /\{\s*AFFILIATE_DISCLOSURE\s*\}/,
    'articleHasShopLinks is called but AFFILIATE_DISCLOSURE is never rendered ' +
      '— calling a check and dropping its answer reads as MORE thorough than ' +
      'not checking at all.',
  );
});

test('the disclosure actually says money changes hands', () => {
  const text = AFFILIATE_DISCLOSURE.toLowerCase();
  assert.ok(
    text.includes('commission'),
    'A disclosure that does not name the commission is not a disclosure.',
  );
  assert.ok(
    text.includes('no extra cost') || text.includes('costs you nothing'),
    'Readers assume an affiliate link costs them more. Say that it does not.',
  );
});

test('articleHasShopLinks fires on a real shop block, and only then', () => {
  const withShop: BlogBlock[] = [
    { type: 'p', text: 'Prose.' },
    {
      type: 'shop',
      text: 'The barong we keep coming back to.',
      href: 'https://shopee.ph/example?aff=setnayan',
      label: 'See it on Shopee',
      merchant: 'Shopee',
    },
  ];
  const withoutShop: BlogBlock[] = [
    { type: 'p', text: 'Prose.' },
    { type: 'cta', text: 'Plan yours.', href: '/signup', label: 'Start free' },
  ];
  assert.equal(articleHasShopLinks(withShop), true);
  assert.equal(articleHasShopLinks(withoutShop), false);
});

// ─── 3. The href predicate. Rejects what an editor will actually paste. ──────

test('isValidShopHref accepts real merchant links', () => {
  for (const href of [
    'https://shopee.ph/product/12345?af_id=setnayan',
    'https://www.lazada.com.ph/products/x-i123.html?sub_aff_id=journal',
    'https://invol.co/aff_m?offer_id=101&aff_id=99',
  ]) {
    assert.equal(isValidShopHref(href), true, `should accept ${href}`);
  }
});

test('isValidShopHref rejects the four mistakes an editor makes', () => {
  const rejected: Array<[string, string]> = [
    ['/explore', 'a relative path — that is a cta block, not a shop block'],
    ['http://shopee.ph/x', 'plain http — mixed content, and no longer indexed'],
    ['https://www.setnayan.com/explore', 'our OWN domain'],
    ['shopee.ph/x', 'no scheme at all'],
  ];
  for (const [href, why] of rejected) {
    assert.equal(isValidShopHref(href), false, `should reject ${href} (${why})`);
  }
});

test('an affiliate link to our own domain can never be marked nofollow', () => {
  // Marking an INTERNAL link rel="sponsored nofollow" tells Google to distrust
  // our own hub-and-spoke linking — the opposite of what the Journal is for.
  for (const host of ['setnayan.com', 'www.setnayan.com', 'setnayan.ph']) {
    assert.equal(isValidShopHref(`https://${host}/anything`), false, host);
  }
});

// ─── 4. Armed for the first real link. ──────────────────────────────────────

test('every authored shop block is well-formed', () => {
  for (const { slug, index, block } of shopBlocksIn(ALL_BLOG_ARTICLES)) {
    assert.ok(
      isValidShopHref(block.href),
      `${slug} block ${index}: href "${block.href}" earns ₱0 and looks fine.`,
    );
    assert.ok(
      block.merchant.trim().length > 0,
      `${slug} block ${index}: a link must name where it sends the reader.`,
    );
    assert.ok(
      block.label.trim().length > 0 && block.text.trim().length > 0,
      `${slug} block ${index}: needs both prose and a button label.`,
    );
  }
});

test('shop prose reaches articleBody, merchant and label do not', () => {
  const blocks: BlogBlock[] = [
    {
      type: 'shop',
      text: 'A recommendation sentence.',
      href: 'https://shopee.ph/x',
      label: 'Buy on Shopee',
      merchant: 'Shopee',
    },
  ];
  const flat = blogPlainText(blocks);
  assert.match(flat, /A recommendation sentence\./);
  assert.doesNotMatch(
    flat,
    /Buy on Shopee/,
    'The button label must stay out of the meta description and JSON-LD.',
  );
});
