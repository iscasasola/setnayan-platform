#!/usr/bin/env node
/**
 * 📸 DEMO-SHOP SHOTS — TRUE screenshots of Setnayan Productions for the For Suppliers / For Coordinators widgets.
 *
 * Every picture is the REAL page the app serves (`next dev` against a local, throwaway database), never a drawing:
 *
 *   1. the public shop page `/v/setnayan-productions` at each plan (Free · Verified · Supplier Plus · Pro · Ultra) — the seed
 *      moves the SAME shop to each plan in turn — at three sizes (mobile 390×844 · tablet 820×1180 · desktop
 *      1440×900), light and dark; a viewport shot (for the device photos) and a full-page shot each;
 *   2. signed in as Juan dela Cruz, at mobile 390: his part of a host's wedding (`/vendor-dashboard/clients/<id>`),
 *      the debut he runs with Full access (`/dashboard/<id>`), his QR codes page, and the pages a QR / NFC tap /
 *      direct link opens (the shop page, Check a date, the shortlist door);
 *   3. his badges from the EXISTING print route (`/api/vendor/badges`, as him) placed on the calling card and the four
 *      tarps by `/dev/supplier-print-lab`, exported as PNG previews;
 *   4. one contact sheet PNG per size, one for the signed-in views and one for the prints → docs/demo-shop/.
 *
 * Raw shots go to apps/web/demo-shop-shots/ (gitignored). Only the contact sheets are committed.
 *
 * 🌙 DARK: requested the way a person gets it — the Dark choice (`sn-theme=dark`), signed in, a phone that prefers
 * dark. The script then ASKS the page whether it painted dark (`<html class="dark">`). A page that has not joined
 * dark mode yet (`DARK_READY`, lib/appearance.ts) stays light, and its "dark" shot is recorded as not painted rather
 * than saved as a copy of the light one.
 *
 * 🛑 LOCAL ONLY. Refuses any Supabase URL that is not 127.0.0.1 / localhost. See README.md for the stack.
 *
 *   node scripts/demo-shop/demo-shop-shots.mjs                 # everything
 *   node scripts/demo-shop/demo-shop-shots.mjs --only=shop     # shop | views | prints | sheets
 *   BASE=http://localhost:3000 CHROMIUM_PATH=/path/to/chrome   # optional
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SignJWT } from 'jose';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = await import('@playwright/test'));
}

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const REPO = join(WEB, '..', '..');
const OUT = join(WEB, 'demo-shop-shots');
const SHEETS = join(REPO, 'docs', 'demo-shop');
const BASE = (process.env.BASE ?? 'http://localhost:3000').replace(/\/+$/, '');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice('--only='.length) || null;
const want = (part) => !ONLY || ONLY.split(',').includes(part);

// ── the stand-in's keys, and the local-only guard ─────────────────────────
const ENV_FILE = join(HERE, '.local-env');
if (!existsSync(ENV_FILE)) throw new Error('No scripts/demo-shop/.local-env — start local-supabase.mjs first (README.md).');
const env = Object.fromEntries(
  readFileSync(ENV_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const host = new URL(SUPABASE_URL).hostname;
if (host !== '127.0.0.1' && host !== 'localhost') throw new Error(`demo-shop-shots: refusing non-local Supabase "${SUPABASE_URL}".`);

// Fixed by the fixture (setnayan-productions.fixture.ts / seed-setnayan-productions.ts).
const SLUG = 'setnayan-productions';
const JUAN = { id: '5e7a0000-0000-4000-8000-00000000a001', email: 'juan@setnayan-productions.demo.setnayan.local' };
const BEA = { id: '5e7a0000-0000-4000-8000-a00000000002', email: 'bea.reyes@demo.setnayan.local' };
const HOST_EVENT = '5e7a0000-0000-4000-8000-e00000000001';
const COORD_EVENT = '5e7a0000-0000-4000-8000-e00000000002';

const PLANS = [
  { plan: 'free', label: 'Free' },
  { plan: 'verified', label: 'Verified' },
  { plan: 'solo', label: 'Supplier Plus' },
  { plan: 'pro', label: 'Pro' },
  { plan: 'ultra', label: 'Ultra' },
];
const SIZES = [
  { size: 'mobile', width: 390, height: 844 },
  { size: 'tablet', width: 820, height: 1180 },
  { size: 'desktop', width: 1440, height: 900 },
];
const THEMES = ['light', 'dark'];
const PIECES = ['calling-card', 'tarp', 'backdrop', 'rollup', 'table-front'];
/**
 * The design templates — the app's print themes, READ from lib/invite-themes.ts (`INVITE_THEME_IDS` for the order,
 * each theme's `name` and `tier`), never typed here, so a new theme is photographed with no change to this script.
 */
const TEMPLATES = (() => {
  const src = readFileSync(join(WEB, 'lib', 'invite-themes.ts'), 'utf8');
  const block = src.slice(src.indexOf('export const INVITE_THEME_IDS'), src.indexOf('] as const', src.indexOf('export const INVITE_THEME_IDS')));
  const ids = (block.match(/'([a-z-]+)'/g) ?? []).map((q) => q.slice(1, -1));
  const out = ids.map((id) => {
    const at = src.indexOf(`    id: '${id}',`);
    const name = /name: '([^']+)'/.exec(src.slice(at, at + 200))?.[1] ?? id;
    const tier = /tier: '([^']+)'/.exec(src.slice(at, at + 300))?.[1] ?? 'pro';
    return { id, name, tier };
  });
  if (out.length === 0) throw new Error('demo-shop-shots: read 0 design templates from lib/invite-themes.ts — did its shape change?');
  return out;
})();

// ── a signed-in session the way @supabase/ssr stores it ───────────────────
async function sessionCookies(user) {
  const key = new TextEncoder().encode(env.DEMO_SHOP_JWT_SECRET);
  const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
  const access = await new SignJWT({ sub: user.id, role: 'authenticated', aud: 'authenticated', email: user.email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(key);
  const session = {
    access_token: access,
    refresh_token: 'local-demo-refresh',
    token_type: 'bearer',
    expires_in: 6 * 3600,
    expires_at: exp,
    user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, app_metadata: {}, user_metadata: {} },
  };
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const name = `sb-${host.split('.')[0]}-auth-token`;
  const url = new URL(BASE);
  const CHUNK = 3180;
  const parts = value.length <= CHUNK ? [[name, value]] : Array.from({ length: Math.ceil(value.length / CHUNK) }, (_, i) => [`${name}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK)]);
  return parts.map(([n, v]) => ({ name: n, value: v, domain: url.hostname, path: '/', httpOnly: false, sameSite: 'Lax' }));
}

function seed(plan) {
  const r = spawnSync(join(REPO, 'node_modules', '.bin', 'tsx'), ['scripts/seed-demo-vendors.ts', '--showcase=setnayan-productions', `--plan=${plan}`], {
    cwd: WEB,
    env: { ...process.env, ...env, SUPABASE_URL },
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`seed --plan=${plan} failed:\n${r.stdout}\n${r.stderr}`);
  return r.stdout.trim().split('\n').pop();
}

/** The demo pictures, served by the app itself (gitignored copy). */
function servePictures() {
  const to = join(WEB, 'public', 'demo-shop-local');
  mkdirSync(to, { recursive: true });
  for (const f of readdirSync(join(HERE, 'images'))) copyFileSync(join(HERE, 'images', f), join(to, f));
}

const manifest = [];
function note(entry) {
  manifest.push(entry);
  console.log(`  ${entry.file ? relative(WEB, entry.file) : '—'}  ${entry.what}${entry.dark === false ? '  (dark not painted — page is light-only today)' : ''}`);
}

async function settle(page) {
  // The reach map's tiles come from OpenStreetMap; where that is unreachable, do not wait forever for them.
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  // Every picture that started loading has arrived (or failed) — a shot never catches a blank frame mid-load.
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(600);
}

async function shoot(browser, { url, width, height, theme, who, file, what, full = true, focus = null, extra = {} }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: theme === 'dark' ? 'dark' : 'light',
    ...(width < 600 ? { isMobile: true, hasTouch: true } : {}),
  });
  const cookies = who ? await sessionCookies(who) : [];
  if (theme === 'dark') cookies.push({ name: 'sn-theme', value: 'dark', domain: new URL(BASE).hostname, path: '/', sameSite: 'Lax' });
  if (cookies.length) await ctx.addCookies(cookies);
  // The person's own "not now" on the push-notification banner (push-notification-registrar.tsx's cooldown key),
  // and no Next.js dev-tools badge — that badge is `next dev` furniture, not the page.
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('setnayan_push_banner_dismissed_until', String(Date.now() + 864e5 * 365));
    } catch {}
    const hide = () => document.querySelectorAll('nextjs-portal').forEach((n) => n.remove());
    new MutationObserver(hide).observe(document, { childList: true, subtree: true });
  });
  const page = await ctx.newPage();
  // `next dev` restarts itself near its memory ceiling; a load that lands on a restart is tried again, not skipped.
  let res = null;
  for (let attempt = 1; ; attempt++) {
    try {
      res = await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
      break;
    } catch (e) {
      if (attempt >= 4) throw e;
      console.log(`  (retry ${attempt} ${url}: ${String(e.message).split('\n')[0]})`);
      await page.waitForTimeout(15_000);
    }
  }
  await settle(page);
  const status = res?.status() ?? 0;
  // A page may forward itself after it loads (a client redirect); ask again once it has settled.
  const isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark'));
  const painted = await isDark().catch(async () => {
    await settle(page);
    return isDark();
  });
  if (theme === 'dark' && !painted) {
    note({ what, url, theme, width, height, status, dark: false, ...extra });
    await ctx.close();
    return;
  }
  const finalPath = new URL(page.url()).pathname;
  // A view whose subject sits below the fold opens the viewport shot there (the full-page shot is unchanged).
  if (focus) {
    await page
      .locator(focus)
      .first()
      .evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 96))
      .catch(() => console.log(`  (focus "${focus}" not found on ${url})`));
    await page.waitForTimeout(400);
  }
  mkdirSync(dirname(file), { recursive: true });
  await page.screenshot({ path: file });
  if (full) await page.screenshot({ path: file.replace(/\.png$/, '-full.png'), fullPage: true });
  note({ what, url, finalPath, theme, width, height, status, file, ...extra });
  await ctx.close();
}

async function main() {
  servePictures();
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

  // 1 · the shop page, every plan × size × theme ───────────────────────────
  if (want('shop')) {
    for (const p of PLANS) {
      console.log(seed(p.plan));
      for (const s of SIZES) {
        for (const theme of THEMES) {
          await shoot(browser, {
            url: `/v/${SLUG}`,
            width: s.width,
            height: s.height,
            theme,
            // Dark needs a signed-in person (signed-out is always light). Bea is a couple, not on the shop's team, so
            // the page is the public one a visitor sees.
            who: theme === 'dark' ? BEA : null,
            file: join(OUT, 'shop', `${p.plan}-${s.size}-${theme}.png`),
            what: `Shop page · ${p.label} · ${s.size} ${s.width}×${s.height} · ${theme}`,
            extra: { kind: 'shop', plan: p.plan, size: s.size },
          });
        }
      }
    }
  }

  // 2 · signed in as Juan, mobile 390, at the Pro plan ────────────────────
  if (want('views') || want('prints')) console.log(seed('pro'));
  if (want('views')) {
    const views = [
      { key: 'supplier-event', url: `/vendor-dashboard/clients/${HOST_EVENT}`, what: 'Supplier · his part of a host’s wedding' },
      { key: 'supplier-event-schedule', url: `/vendor-dashboard/clients/${HOST_EVENT}?tab=schedule`, focus: 'text=Up next', what: 'Supplier · his part of the schedule' },
      { key: 'coordinator-full-access', url: `/dashboard/${COORD_EVENT}`, what: 'Coordinator · Full access to the debut he runs' },
      { key: 'coordinator-events-you-run', url: '/vendor-dashboard/on-the-day', what: 'Coordinator · Events you run' },
      { key: 'qr-codes-page', url: '/vendor-dashboard/invite?mode=page', what: 'Supplier · his QR codes (My page)' },
      { key: 'landing-my-page', url: `/v/${SLUG}`, who: null, what: 'Landing · QR / NFC tap / direct link → his page' },
      { key: 'landing-check-a-date', url: `/v/${SLUG}/dates`, who: null, what: 'Landing · Check a date code' },
      { key: 'landing-shortlist', url: `/vendor-invite/${SLUG}`, who: null, what: 'Landing · Shortlist code' },
    ];
    for (const v of views) {
      for (const theme of THEMES) {
        await shoot(browser, {
          url: v.url,
          width: 390,
          height: 844,
          theme,
          who: v.who === null ? (theme === 'dark' ? BEA : null) : JUAN,
          focus: v.focus ?? null,
          file: join(OUT, 'views', `${v.key}-mobile-${theme}.png`),
          what: `${v.what} · mobile 390×844 · ${theme}`,
          extra: { kind: 'view', key: v.key, size: 'mobile' },
        });
      }
    }
  }

  // 3 · prints: the badges from the existing route, on the five pieces, in every design template ──
  if (want('prints')) {
    const ctx = await browser.newContext();
    await ctx.addCookies(await sessionCookies(JUAN));
    mkdirSync(join(OUT, 'prints'), { recursive: true });
    let haveBadges = true;
    // The route's own two grounds: `light` for a paper template, `dark` for a dark one or a picture under a dark scrim.
    for (const ground of ['light', 'dark']) {
      const res = await ctx.request.get(`${BASE}/api/vendor/badges?badge=all&ground=${ground}`);
      const svg = res.ok() ? await res.text() : null;
      const served = join(WEB, 'public', 'demo-shop-local', `sp-badges-${ground}.svg`);
      if (svg) {
        writeFileSync(served, svg);
        writeFileSync(join(OUT, 'prints', `sp-badges-${ground}.svg`), svg);
      } else {
        rmSync(served, { force: true });
        haveBadges = false;
      }
      console.log(`  /api/vendor/badges?ground=${ground} → ${res.status()}${svg ? ` · ${svg.length} bytes` : ''}`);
    }
    await ctx.close();

    const ctx2 = await browser.newContext({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 1 });
    for (const piece of PIECES) {
      for (const t of TEMPLATES) {
        // A fresh page per print: each one inlines its template's faces, and one page reused fifty times outgrew a
        // container's memory and was killed mid-run (measured).
        const page = await ctx2.newPage();
        const url = `/dev/supplier-print-lab?slug=${SLUG}&piece=${piece}&template=${t.id}${haveBadges ? '&badges=1' : ''}`;
        await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
        await settle(page);
        const el = page.locator('[data-print-piece]');
        const file = join(OUT, 'prints', piece, `${t.id}.png`);
        mkdirSync(dirname(file), { recursive: true });
        await el.screenshot({ path: file });
        const size = await el.getAttribute('data-print-size');
        const picture = await el.getAttribute('data-print-picture');
        // Does any word or code leave the trim? A crop is reported, never shipped quietly.
        const overflow = await el.evaluate((root) => {
          const r = root.getBoundingClientRect();
          return [...root.querySelectorAll('h1,p,li,img,svg,span')].some((n) => {
            const b = n.getBoundingClientRect();
            return b.width > 0 && (b.right > r.right + 1 || b.bottom > r.bottom + 1 || b.left < r.left - 1);
          });
        });
        if (overflow) console.log(`  ⚠ ${piece} · ${t.name}: something runs past the trim`);
        note({ what: `Print · ${piece} · ${size} · ${t.name}`, url, file, kind: 'print', key: piece, template: t.id, templateName: t.name, tier: t.tier, printSize: size, picture, overflow });
        await page.close();
      }
    }
    await ctx2.close();
  }

  // A partial run (--only) keeps the other parts' entries, so the sheets still show everything.
  const kept = existsSync(join(OUT, 'manifest.json'))
    ? JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8')).filter((m) => !manifest.some((n) => n.kind === m.kind))
    : [];
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify([...kept, ...manifest], null, 2));

  // 4 · contact sheets ─────────────────────────────────────────────────────
  if (want('sheets') || !ONLY) await contactSheets(browser);
  await browser.close();
}

/** One sheet per size (plans across, light row then dark row), one for the signed-in views, one for the prints. */
async function contactSheets(browser) {
  const all = existsSync(join(OUT, 'manifest.json')) ? JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8')) : manifest;
  mkdirSync(SHEETS, { recursive: true });
  const img = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
  const css = `body{margin:0;background:#fff;font-family:'Hanken Grotesk',Helvetica,Arial,sans-serif;color:#2C2A29}
    h1{font-size:28px;font-weight:600;margin:0 0 4px} p.sub{margin:0 0 24px;color:#6b6560;font-size:15px}
    .wrap{padding:40px} .grid{display:grid;gap:24px;align-items:start} figure{margin:0}
    figure img{width:100%;display:block;border:1px solid #e7e2da;border-radius:10px}
    figcaption{font-size:14px;margin-top:8px;line-height:1.35} figcaption b{font-weight:600}
    .none{border:1px dashed #d8d1c6;border-radius:10px;padding:16px;font-size:13px;color:#6b6560}`;
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 1 });
  async function render(name, html) {
    await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body><div class="wrap">${html}</div></body></html>`);
    await page.waitForTimeout(300);
    const file = join(SHEETS, name);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  sheet ${relative(REPO, file)}`);
  }

  for (const s of SIZES) {
    const cells = [];
    for (const theme of THEMES) {
      for (const p of PLANS) {
        const e = all.find((m) => m.kind === 'shop' && m.plan === p.plan && m.size === s.size && m.theme === theme);
        cells.push(
          e?.file
            ? `<figure><img src="${img(e.file)}"><figcaption><b>${p.label}</b> · ${theme}<br>${relative(WEB, e.file)}</figcaption></figure>`
            : `<figure><div class="none"><b>${p.label}</b> · ${theme}<br>${theme === 'dark' ? 'Not painted: the shop page is light-only today (DARK_READY).' : 'missing'}</div></figure>`,
        );
      }
    }
    const colW = s.size === 'desktop' ? 1 : 1;
    await render(
      `contact-${s.size}.png`,
      `<h1>Setnayan Productions · shop page · ${s.size} ${s.width}×${s.height}</h1>
       <p class="sub">The real /v/setnayan-productions page at each plan, from a local database. Viewport shots; full-page shots sit beside them as *-full.png.</p>
       <div class="grid" style="grid-template-columns:repeat(5,${colW}fr)">${cells.join('')}</div>`,
    );
  }

  const views = all.filter((m) => m.kind === 'view');
  if (views.length) {
    const cells = views
      .filter((m) => m.theme === 'light')
      .map((m) => `<figure><img src="${img(m.file)}"><figcaption><b>${m.what.replace(/ · mobile.*$/, '')}</b><br>${m.url}${m.finalPath && m.finalPath !== m.url.split('?')[0] ? ` → ${m.finalPath}` : ''}</figcaption></figure>`);
    const dark = views.filter((m) => m.theme === 'dark');
    const darkLine = dark.every((m) => m.dark === false)
      ? 'Dark: none of these pages paints dark yet (DARK_READY in lib/appearance.ts), so no dark shots exist.'
      : `Dark shots: ${dark.filter((m) => m.file).length}`;
    await render(
      'contact-mobile-views.png',
      `<h1>Setnayan Productions · signed-in views and landing pages · mobile 390×844</h1>
       <p class="sub">Signed in as Juan dela Cruz unless marked Landing (a visitor). ${darkLine}</p>
       <div class="grid" style="grid-template-columns:repeat(4,1fr)">${cells.join('')}</div>`,
    );
  }

  const prints = all.filter((m) => m.kind === 'print');
  for (const piece of PIECES) {
    const mine = prints.filter((m) => m.key === piece);
    if (!mine.length) continue;
    const stand = mine.some((m) => m.picture === 'theme-colours');
    const cells = mine.map(
      (m) => `<figure><img src="${img(m.file)}"><figcaption><b>${m.templateName}</b> · ${m.tier === 'free' ? 'free template' : '◆ Pro template'}</figcaption></figure>`,
    );
    const cols = piece === 'rollup' ? 10 : piece === 'backdrop' || piece === 'calling-card' ? 5 : 4;
    await render(
      `contact-prints-${piece}.png`,
      `<h1>Setnayan Productions · ${piece} · ${mine[0].printSize} · in every design template (preview)</h1>
       <p class="sub">The app's print themes (printLooksFor). Badges from GET /api/vendor/badges as Juan · the My page QR from renderUrlQrSvg · NFC tap and direct link on every piece.${stand ? ' Theme pictures live on R2, unreachable from where this ran — each theme’s own picture colours stand in.' : ''}</p>
       <div class="grid" style="grid-template-columns:repeat(${cols},1fr)">${cells.join('')}</div>`,
    );
  }
  await page.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
