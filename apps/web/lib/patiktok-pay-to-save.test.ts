/**
 * PATIKTOK — FREE TO MAKE, PAID TO TAKE OUT.
 *
 * Owner, verbatim (2026-09-29): *"can we finish tiktok later or hide it."* →
 * *"yes use for free. but pay to save and share"*.
 *
 * What an audit found the same day: Patiktok is sold as `PATIKTOK_COMPILER`, yet
 * no server entry point asked whether it was paid — an unpaid couple could run
 * the booth, render, store and download reels. The rule now:
 *
 *   FREE  — record clips, queue a render, render + WATCH it (watermarked).
 *   PAID  — store the clean reel, download it, share it (recap), connect TikTok,
 *           post to TikTok. Measured on the SERVER by `patiktokSaveUnlocked`.
 *
 * WHAT THIS FILE PINS
 *   1. The rule table itself (`lib/patiktok-access.ts`).
 *   2. A CLOSED-SET SWEEP of every Patiktok server entry point: each exported
 *      action and each route under `app/api/patiktok` · `app/api/tiktok` is
 *      classified FREE or PAID, a PAID one asks the gate BEFORE its first side
 *      effect, and a FREE one never refuses on payment. A new entry point that
 *      is in neither list fails here — deciding its side is a deliberate act.
 *   3. Every place that mints a link to a stored reel is gated.
 *   4. The unpaid preview is watermarked and never uploaded; its mark is ◆ PRO,
 *      never a padlock.
 *   5. The two audit bugs stay fixed: the booth's template pick SAVES, and the
 *      "we email a print-ready PDF" promise is gone.
 *   6. "Connect TikTok" renders only when the TikTok app is configured.
 *
 * Source scans run on comment-STRIPPED code (`lib/strip-comments.ts`), so the
 * prose explaining a gate can never satisfy the gate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import {
  PATIKTOK_FREE_ACTIONS,
  PATIKTOK_PAID_ACTIONS,
  patiktokActionAllowed,
  type PatiktokAction,
} from './patiktok-access';
import { resolveBoothTemplates, serializeBoothTemplates } from './patiktok-booth-templates';
import { PATIKTOK_TEMPLATES } from './patiktok';

const WEB = dirname(dirname(fileURLToPath(import.meta.url))); // apps/web
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));

const STUDIO = join('app', 'dashboard', '[eventId]', 'studio', 'patiktok');
const ACTIONS = join(STUDIO, 'actions.ts');
const GALLERY = join(STUDIO, 'page.tsx');
const BOOTH = join(STUDIO, 'booth', 'page.tsx');
const RENDERER = join(STUDIO, '_components', 'reel-renderer.tsx');
const GATE = 'patiktokSaveUnlocked(';

/** The body of an exported function, from its `export` to the next top-level `export`. */
function exportedBody(src: string, name: string): string {
  const re = new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`);
  const m = re.exec(src);
  assert.ok(m, `expected exported function ${name}`);
  const rest = src.slice(m.index + m[0].length);
  const next = rest.search(/\nexport\s/);
  return next === -1 ? rest : rest.slice(0, next);
}

/** Assert the gate is asked, and asked before the first of `effects`. */
function gateBefore(body: string, effects: readonly string[], where: string) {
  const g = body.indexOf(GATE);
  assert.ok(g !== -1, `${where}: never asks ${GATE}…) — an unpaid event could save/share`);
  for (const e of effects) {
    const at = body.indexOf(e);
    assert.ok(at !== -1, `${where}: expected side effect ${e} not found (did the shape move?)`);
    assert.ok(g < at, `${where}: ${e} runs BEFORE the pay gate — the gate must come first`);
  }
}

// ── 1 · the rule ────────────────────────────────────────────────────────────

const ALL_ACTIONS: readonly PatiktokAction[] = [
  'record_clip',
  'queue_render',
  'preview',
  'save_reel',
  'download',
  'share',
  'connect_tiktok',
  'post_tiktok',
];

test('rule: making and watching are free; saving, downloading, sharing and TikTok are paid', () => {
  assert.deepEqual([...PATIKTOK_FREE_ACTIONS].sort(), ['preview', 'queue_render', 'record_clip']);
  assert.deepEqual(
    [...PATIKTOK_PAID_ACTIONS].sort(),
    ['connect_tiktok', 'download', 'post_tiktok', 'save_reel', 'share'],
  );
  for (const a of ALL_ACTIONS) {
    assert.ok(
      PATIKTOK_FREE_ACTIONS.has(a) !== PATIKTOK_PAID_ACTIONS.has(a),
      `${a} must sit on exactly one side of the line`,
    );
  }
});

test('rule: unpaid → every paid action refused, every free action allowed; paid → all allowed', () => {
  for (const a of ALL_ACTIONS) {
    assert.equal(
      patiktokActionAllowed(a, { saveUnlocked: false }),
      PATIKTOK_FREE_ACTIONS.has(a),
      `unpaid ${a}`,
    );
    assert.equal(patiktokActionAllowed(a, { saveUnlocked: true }), true, `paid ${a}`);
  }
});

// ── 2 · closed-set sweep of the server entry points ─────────────────────────

/** Every exported server action in the Patiktok studio, and its side. */
const ACTION_SIDES: Record<string, 'free' | 'paid' | 'reports'> = {
  submitPatiktokRender: 'free', // queue a render
  recordPatiktokClip: 'free', // record a clip
  matchPatiktokFace: 'free', // booth tag pre-fill
  claimPatiktokRenderJob: 'reports', // free to render; REPORTS saveUnlocked for the watermark
  failPatiktokRenderJob: 'free',
  disconnectPatiktokTiktok: 'free', // removing a credential is never paywalled
  savePatiktokBoothTemplates: 'free', // the booth's template pick
  finalizePatiktokRenderJob: 'paid', // stores the reel + mints its download link
};

test('sweep: every exported Patiktok action is classified (closed set)', () => {
  const src = code(ACTIONS);
  const found = [...src.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map((m) => m[1]);
  for (const name of found) {
    assert.ok(
      name && name in ACTION_SIDES,
      `new Patiktok action "${name}" — classify it FREE or PAID in ACTION_SIDES (owner rule: free to make, pay to save and share)`,
    );
  }
  for (const name of Object.keys(ACTION_SIDES)) {
    assert.ok(found.includes(name), `ACTION_SIDES lists ${name}, which no longer exists`);
  }
});

test('sweep: finalize (the save) asks the pay gate before storing, signing or emailing', () => {
  const body = exportedBody(code(ACTIONS), 'finalizePatiktokRenderJob');
  gateBefore(body, ['presignDisplayUrl(', "status: 'completed'", 'after('], 'finalizePatiktokRenderJob');
  assert.match(body, /needsPurchase:\s*true/, 'finalize must return a clean refusal, not a stored reel');
});

test('sweep: the free actions never refuse on payment', () => {
  const src = code(ACTIONS);
  for (const [name, side] of Object.entries(ACTION_SIDES)) {
    const body = exportedBody(src, name);
    if (side === 'free') {
      assert.ok(!body.includes(GATE), `${name} is FREE but asks the pay gate`);
    }
    if (side === 'reports') {
      assert.ok(body.includes(GATE), `${name} must report the server's saveUnlocked`);
      assert.ok(
        !/needsPurchase|PATIKTOK_SAVE_REFUSAL/.test(body),
        `${name} must never refuse a render on payment — previewing is free`,
      );
      assert.match(body, /\bsaveUnlocked,?\s*\n?\s*}/, `${name} must return saveUnlocked`);
    }
  }
});

function routesUnder(dir: string): string[] {
  const abs = join(WEB, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n === 'route.ts') out.push(relative(WEB, p).split(sep).join('/'));
    }
  };
  walk(abs);
  return out.sort();
}

/** Every Patiktok / TikTok API route, and the side effect its gate must precede. */
const ROUTE_GATES: Record<string, readonly string[]> = {
  'app/api/patiktok/upload/route.ts': ['presignUploadUrl('],
  'app/api/tiktok/auth/start/route.ts': ["from('patiktok_oauth_state')", 'buildAuthorizeUrl('],
  'app/api/tiktok/auth/callback/route.ts': ['exchangeCodeForToken(', 'sealToken('],
};

test('sweep: every Patiktok/TikTok API route is classified and gated before its side effect', () => {
  const routes = [...routesUnder('app/api/patiktok'), ...routesUnder('app/api/tiktok')];
  assert.ok(routes.length > 0, 'found no routes — the sweep is looking in the wrong place');
  for (const r of routes) {
    assert.ok(r in ROUTE_GATES, `new route ${r} — classify it in ROUTE_GATES (free, or gated)`);
  }
  for (const [r, effects] of Object.entries(ROUTE_GATES)) {
    gateBefore(code(r), effects, r);
  }
});

test('sweep: the upload route gates the REEL only — a booth clip stays free', () => {
  const src = code('app/api/patiktok/upload/route.ts');
  const reelBranch = src.indexOf("if (kind === 'reel') {");
  const gate = src.indexOf(GATE);
  assert.ok(reelBranch !== -1 && gate > reelBranch, 'the pay gate must sit inside the kind === "reel" branch');
  // The gate opens that branch — before the job lookup and the presign.
  assert.ok(gate < src.indexOf('UUID_RE.test(', reelBranch), 'the pay gate must open the reel branch');
  assert.match(src, /status:\s*402/, 'an unpaid reel upload is a clean 402 refusal');
  assert.equal(src.split(GATE).length - 1, 1, 'exactly one gate call — clips must not be gated');
});

test('sweep: posting to TikTok asks the gate first', () => {
  const body = exportedBody(code('lib/patiktok-tiktok.ts'), 'publishPatiktokCompilation');
  gateBefore(body, ["return { ok: false, reason: 'not-implemented' }"], 'publishPatiktokCompilation');
});

// ── 3 · every link to a stored reel is gated ────────────────────────────────

/** Files that read patiktok_render_jobs AND sign a URL — each must be gated. */
const REEL_SIGNERS = new Set([
  'app/dashboard/[eventId]/studio/patiktok/actions.ts', // finalize — gated above
  'app/dashboard/[eventId]/studio/patiktok/page.tsx', // "Your renders" download
  'lib/auto-recap.ts', // the public recap page
  'app/api/patiktok/upload/route.ts', // the reel's upload URL — gated in ROUTE_GATES
]);

test('sweep: every file that signs a link to a Patiktok reel is known (closed set)', () => {
  const hits: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(join(WEB, d))) {
      if (n === 'node_modules' || n === '.next') continue;
      const rel = join(d, n);
      if (statSync(join(WEB, rel)).isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) {
        const s = code(rel);
        if (/from\(\s*['"`]patiktok_render_jobs['"`]\s*\)/.test(s) && /presign\w*\(/.test(s)) {
          hits.push(rel.split(sep).join('/'));
        }
      }
    }
  };
  walk('app');
  walk('lib');
  assert.ok(hits.length > 0, 'found no reel signers — the sweep is looking in the wrong place');
  for (const h of hits) {
    assert.ok(REEL_SIGNERS.has(h), `${h} signs a link to a Patiktok reel — gate it on patiktokSaveUnlocked and list it`);
  }
});

test('gallery: download links are minted only for a paid event', () => {
  const src = code(GALLERY);
  assert.match(
    src,
    /if\s*\(\s*patiktokActive\s*&&\s*isR2Configured\(\)/,
    'the download presign must be conditioned on patiktokActive',
  );
  assert.ok(
    src.indexOf('const patiktokActive') < src.indexOf('presignDisplayUrl('),
    'paid state must be measured before any reel link is signed',
  );
});

test('recap: the public recap shows reels only for a paid event', () => {
  const src = code('lib/auto-recap.ts');
  const read = src.indexOf("from('patiktok_render_jobs')");
  const gate = src.lastIndexOf(GATE, read);
  assert.ok(read !== -1 && gate !== -1 && read - gate < 300, 'the recap reel read must sit behind the pay gate');
});

// ── 4 · the preview: watermarked, never uploaded, ◆ not a padlock ───────────

test('preview: unpaid renders carry the watermark and stop before the upload', () => {
  const src = code(RENDERER);
  assert.match(
    src,
    /watermark:\s*claimed\.saveUnlocked\s*\?\s*undefined\s*:\s*PATIKTOK_PREVIEW_WATERMARK/,
    'the watermark must follow the SERVER answer from the claim',
  );
  const bail = src.search(/if\s*\(\s*!claimed\.saveUnlocked\s*\)\s*{[^}]*setPhase\('preview'\)[^}]*return;/);
  const upload = src.indexOf("'/api/patiktok/upload'");
  assert.ok(bail !== -1 && upload !== -1 && bail < upload, 'an unpaid preview must return before the upload');
  const rr = code('lib/reel-render.ts');
  assert.match(rr, /if\s*\(\s*template\.watermark\s*\)\s*drawWatermark\(/, 'drawOverlay must burn the watermark in');
});

test('preview: the save is marked ◆ PRO — never a padlock', () => {
  for (const f of [RENDERER, GALLERY]) {
    const src = code(f);
    assert.match(src, /<PaidMark\s+state="try"/, `${f} must mark save/share ◆ PRO`);
    assert.ok(!/state="locked"/.test(src), `${f} must not put a padlock on Patiktok`);
  }
});

// ── 5 · the two audit bugs ──────────────────────────────────────────────────

test('audit: no promise of an emailed print-ready PDF or a printed booth QR', () => {
  for (const f of [GALLERY, BOOTH, join(STUDIO, '[templateId]', 'page.tsx')]) {
    const src = code(f);
    assert.ok(!/print-ready PDF|We email/i.test(src), `${f} promises an emailed PDF that is not built`);
    assert.ok(!/printed Patiktok QR|Printable booth-operator QR/i.test(src), `${f} promises a printed QR that is not built`);
  }
});

test('audit: the booth template pick SAVES (gallery honours role, booth reads the saved pick)', () => {
  const gallery = code(GALLERY);
  assert.match(gallery, /role:\s*roleParam/, 'the gallery must read ?role=');
  assert.match(gallery, /action=\{savePatiktokBoothTemplates\}/, 'picking for a slot must post to the save action');
  const booth = code(BOOTH);
  assert.match(booth, /resolveBoothTemplates\(\{[\s\S]{0,200}saved:/, 'the booth must read the saved pick');
  assert.match(booth, /action=\{savePatiktokBoothTemplates\}/, 'swap must save, not only change the URL');
});

test('audit: resolveBoothTemplates — saved pick wins over defaults; params win over saved; never twice', () => {
  const [a, b, c] = PATIKTOK_TEMPLATES;
  assert.ok(a && b && c, 'needs three templates');
  const saved = serializeBoothTemplates(c.slug, a.slug);
  let r = resolveBoothTemplates({ saved });
  assert.equal(r.primary.slug, c.slug);
  assert.equal(r.backup.slug, a.slug);
  r = resolveBoothTemplates({ primaryParam: b.slug, saved });
  assert.equal(r.primary.slug, b.slug);
  assert.equal(r.backup.slug, a.slug);
  r = resolveBoothTemplates({ saved: 'nope|also-nope' });
  assert.equal(r.primary.slug, a.slug);
  assert.equal(r.backup.slug, b.slug);
  r = resolveBoothTemplates({ primaryParam: a.slug, backupParam: a.slug });
  assert.notEqual(r.backup.slug, r.primary.slug, 'the booth must never offer one template twice');
});

// ── 6 · Connect TikTok only when configured ─────────────────────────────────

test('connect: the TikTok panel mounts once, only when the app is configured and paid', () => {
  const src = code(GALLERY);
  assert.equal(src.split('<TiktokConnectPanel').length - 1, 1, 'one mount of the connect panel');
  assert.match(src, /\{tiktokAvailable\s*\?\s*\(\s*<TiktokConnectPanel/, 'connect must sit behind tiktokAvailable');
  const paidBranch = src.indexOf('{patiktokActive ? (');
  const mount = src.indexOf('<TiktokConnectPanel');
  const unpaidBranch = src.indexOf(') : (', paidBranch);
  assert.ok(paidBranch !== -1 && paidBranch < mount && mount < unpaidBranch, 'connect must sit in the paid branch');
  assert.equal(src.split('/api/tiktok/auth/start').length - 1, 1, 'one link to the connect route');
});
