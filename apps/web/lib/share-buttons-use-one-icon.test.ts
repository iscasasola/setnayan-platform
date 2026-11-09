import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

/**
 * 📤 EVERY SHARE BUTTON WEARS ONE ICON — owner, 10 Nov 2026, verbatim: *"fix all the share buttons to have the same
 * icon. the box with the arrow up"*.
 *
 * That box is lucide `Share`. Before this, a share action wore one of four marks: `Share` (file buttons, 28 Oct),
 * `Share2` (the three-dot "node" — profile, public page, QR card, supplier invite, story card, shop cover…), `Send`
 * (the crew QR, the mood board) or a hand-drawn copy of the box (the guest's schedule and invite on the event page).
 * Now every control whose ACTION is sharing draws `Share`, at the size and stroke the file already used.
 *
 * The property, three ways (comments stripped, so a docblock that names an icon never trips it):
 *   1 · lucide `Share2` is imported nowhere under app/ · components/ · lib/ but the reasoned allow-list below;
 *   2 · a control whose label begins "Share" (`label="Share…"`, `label: 'Share…'`) passes `icon={Share}`;
 *   3 · an icon drawn right before the word "Share" inside a button is `<Share`, and no hand-drawn `<svg>` stands
 *       in for it.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

/**
 * `Share2` where it does NOT mean "share this" — each with a reason a reader can check. A new entry needs one;
 * "it was easier" is not a reason.
 */
const ALLOWED_SHARE2: Record<string, string> = {
  'app/_components/facebook-dual-stream-card.tsx':
    'a status card, not a button: Share2 reads as "a second destination" (the live stream also goes to Facebook)',
  'app/admin/_components/admin-nav-groups.tsx': 'the admin sidebar SECTION icon for "Social queue" — navigation, not a share action',
  'app/admin/studio/page.tsx': 'the admin Studio TAB icon for "Social queue" — navigation, not a share action',
  'lib/nav-icons.ts': 'the name→component registry the nav editor resolves lucideName "Share2" through (admin Social queue)',
  'lib/route-meta.ts': 'route metadata icon for the admin Social queue page — a page identity, not a share action',
  'app/dashboard/[eventId]/_components/supplier-connect-panel.tsx':
    '"Create their link" / "Try again" MAKE a supplier link (no share sheet opens); its share buttons already wear Share',
};

/**
 * A mark before the word "Share" that is deliberately NOT the share box — each with its reason.
 */
const ALLOWED_NON_SHARE_WORD: Record<string, string> = {
  'app/dashboard/[eventId]/access-requests/_components/request-card.tsx':
    'a grant/decline verdict toggle ("Share" = grant access to an area), paired with a Decline; the Check marks the choice',
  'app/dashboard/(account)/library/_components/photos-tab.tsx':
    '"Share the Memories link" opens Facebook\'s own sharer — the Facebook glyph names the destination (like realstories\' Facebook / Pinterest buttons)',
  'app/vendor-dashboard/clients/[eventId]/page.tsx':
    '"Share an album link" is a <summary> that opens a form where the supplier PASTES a link — Link2 names the input, nothing is shared from it',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const rel = (p: string) => relative(WEB, p).split(sep).join('/');
const SOURCES = ['app', 'components', 'lib']
  .flatMap((d) => walk(join(WEB, d)))
  .map((p) => ({ rel: rel(p), src: stripComments(readFileSync(p, 'utf8')) }))
  .filter(({ rel: r }) => !r.startsWith('app/dev/'));

/** The names a file imports from lucide-react (an `X as Y` alias counts as X). */
function lucideImports(src: string): string[] {
  const names: string[] = [];
  for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g)) {
    for (const spec of (m[1] ?? '').split(',')) {
      const name = spec.trim().split(/\s+as\s+/)[0]?.trim();
      if (name) names.push(name);
    }
  }
  return names;
}

test('the sweep reads app/ · components/ · lib/ and finds the share buttons (else it proves nothing)', () => {
  assert.ok(SOURCES.length > 800, `only ${SOURCES.length} files read`);
  const sharing = SOURCES.filter(({ src }) => /<Share\b|icon=\{Share\}|icon:\s*Share\b/.test(src));
  assert.ok(sharing.length >= 25, `only ${sharing.length} files draw lucide Share — the pattern has rotted`);
});

test('1 · lucide Share2 is imported nowhere but the reasoned allow-list', () => {
  const bad = SOURCES.filter(({ rel: r, src }) => !(r in ALLOWED_SHARE2) && lucideImports(src).includes('Share2')).map(
    ({ rel: r }) => r,
  );
  assert.deepEqual(bad, [], `a share button wears Share2 — use lucide Share (the box with the arrow up):\n${bad.join('\n')}`);
  for (const [r, why] of Object.entries(ALLOWED_SHARE2)) {
    const f = SOURCES.find((s) => s.rel === r);
    assert.ok(f, `${r}: allow-listed but gone — drop the line`);
    assert.ok(/\bShare2\b/.test(f.src), `${r}: allow-listed but no longer uses Share2 — drop the line`);
    assert.ok(why.length > 20, `${r}: an allow-list entry needs its reason`);
  }
});

test('1b · the allow-listed supplier panel uses Share2 only on the make-a-link buttons', () => {
  const src = SOURCES.find((s) => s.rel === 'app/dashboard/[eventId]/_components/supplier-connect-panel.tsx')!.src;
  const uses = [...src.matchAll(/icon=\{Share2\}[\s\S]{0,80}?label=\{([^}]*)\}/g)].map((m) => m[1] ?? '');
  assert.equal((src.match(/\bShare2\b/g) ?? []).length - 1, uses.length, 'a Share2 in the panel is not on a labelled button');
  for (const label of uses) assert.match(label, /Create their link|Try again/, `Share2 on a share action: ${label}`);
});

/** A JSX element that starts at `<Tag` and ends at its first `/>` (props hold `=>`, never `/>`). */
function selfClosing(src: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}\\b`, 'g');
  for (const m of src.matchAll(re)) {
    const end = src.indexOf('/>', m.index!);
    if (end > 0) out.push(src.slice(m.index!, end));
  }
  return out;
}

test('2 · a control labelled "Share…" passes icon={Share}', () => {
  const bad: string[] = [];
  let seen = 0;
  for (const { rel: r, src } of SOURCES) {
    for (const tag of ['ActionButton', 'CoverIcon', 'MenuRow', 'HomeCardRow']) {
      for (const el of selfClosing(src, tag)) {
        if (!/\blabel=\{?\s*['"`]Share\b/.test(el)) continue;
        const icon = el.match(/\bicon=\{\s*<?\s*([A-Za-z0-9_]+)/)?.[1];
        if (!icon) continue;
        seen++;
        if (icon !== 'Share') bad.push(`${r} → <${tag} label="Share…" icon={${icon}}>`);
      }
    }
    for (const m of src.matchAll(/\blabel:\s*['"`]Share\b[^}\n]*?\bicon:\s*([A-Za-z0-9_]+)/g)) {
      seen++;
      if (m[1] !== 'Share') bad.push(`${r} → { label: 'Share…', icon: ${m[1]} }`);
    }
  }
  assert.ok(seen >= 8, `only ${seen} "Share…" controls found — the pattern has rotted`);
  assert.deepEqual(bad, [], `a share control wears another icon — use lucide Share:\n${bad.join('\n')}`);
});

test('3 · the icon drawn before the word "Share" in a button is <Share, never a hand-drawn svg', () => {
  const bad: string[] = [];
  for (const { rel: r, src } of SOURCES) {
    if (r in ALLOWED_NON_SHARE_WORD) continue;
    const re = /<([A-Za-z0-9_]+)\b(?:[^<>]|=>)*?\/>\s*(?:<span className="lbl">\s*)?(?:\{[^}]*\?\s*['"])?Share\b(?!d)/g;
    for (const m of src.matchAll(re)) {
      if (m[1] !== 'Share') bad.push(`${r} → <${m[1]} /> Share`);
    }
    for (const m of src.matchAll(/<\/svg>\s*(?:<span[^>]*>\s*)?(?:Share\b|\{label\})/g)) {
      const around = src.slice(Math.max(0, m.index! - 400), m.index!);
      if (/navigator\.share|shareBlobToDevice|onClick=\{share\}/.test(src) && /M8 10V2M5 5l3-3 3 3/.test(around)) {
        bad.push(`${r} → a hand-drawn share-box svg`);
      }
    }
  }
  assert.deepEqual(bad, [], `a share button draws another mark — use lucide Share:\n${bad.join('\n')}`);
  for (const [r, why] of Object.entries(ALLOWED_NON_SHARE_WORD)) {
    assert.ok(SOURCES.some((s) => s.rel === r), `${r}: allow-listed but gone — drop the line`);
    assert.ok(why.length > 20, `${r}: an allow-list entry needs its reason`);
  }
});

test('the share buttons the owner named wear Share (anchored per file)', () => {
  const must: Array<[string, RegExp]> = [
    ['app/_components/profile-share-button.tsx', /<Share aria-hidden/],
    ['app/_components/public-page-actions.tsx', /<Share aria-hidden/],
    ['app/_components/qr-card.tsx', /data-qr-share="">\s*<Share aria-hidden/],
    ['app/[slug]/recap/_components/save-story-card-button.tsx', /<Share aria-hidden/],
    ['app/papic/me/[token]/_components/guest-story-maker.tsx', /<Share aria-hidden[^/]*\/>\s*Share my Story/],
    ['app/vendor-dashboard/shop/_components/shop-cover.tsx', /<CoverIcon label="Share" icon=\{<Share aria-hidden/],
    ['app/vendor-dashboard/shop/_components/shop-cover.tsx', /shareShopLink\([\s\S]{0,300}?<Share aria-hidden[^/]*\/>\s*Share/],
    ['app/dashboard/[eventId]/studio/mood-board/_components/share-with-vendors-button.tsx', /<Share className="h-4 w-4" aria-hidden \/>\s*Share with suppliers/],
    ['app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx', /icon=\{Share\} label="Share with your supplier"/],
    ['app/vendor-dashboard/on-the-day/_components/crew-panel.tsx', /icon=\{Share\} label="Share"/],
    ['app/[slug]/_components/share-your-schedule.tsx', /<Share aria-hidden/],
    ['app/[slug]/_components/send-their-invite.tsx', /<Share aria-hidden/],
    ['app/_components/gallery/lightbox-save-button.tsx', /\bShare\b/],
  ];
  for (const [r, re] of must) {
    const f = SOURCES.find((s) => s.rel === r);
    assert.ok(f, `${r}: gone — re-anchor this line`);
    assert.match(f.src, re, `${r}: the share button no longer wears lucide Share`);
  }
});
