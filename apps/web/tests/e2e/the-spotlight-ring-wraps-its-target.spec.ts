import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * 🔦 THE SPOTLIGHT RING WRAPS ITS TARGET — measured in a real browser, on the REAL engine (`SpotlightTour`,
 * bundled), for EVERY step of EVERY spotlight tour in `lib/tours.ts`, at 375 · 390 · 1024 · 1440 · 1920 · 2000.
 *
 * Owner, 2026-10-23, his own Maker on a ~1000 pt desktop window: *"spotlight tours are misaligned"* — About the
 * Maker › "Step 2 of 2 · Apply when you like it" drew a thin flat pill ~40 px BELOW Apply, cut at the right edge,
 * Apply itself dimmed, the card centred at the top of the page. The app's sticky top bar sits UNDER the full-screen
 * Maker; the engine counted it as an obstacle and squeezed the ring out from under it (`lib/spotlight-geometry.ts`).
 *
 * Each tour's anchors are laid out on a fixture page shaped like the app: the sticky app top bar, a bottom dock
 * (phone) or a side rail (desktop) holding the `tab-*` steps, page parts of four shapes (a full-width row, an inset
 * card, a small button against the right edge, a card taller than the screen) — and for the Maker's own tour, the
 * full-screen Maker over all of it, Apply at the right end of its top bar. The mount sits inside a TRANSFORMED box
 * 40 px down (a page slide), which would carry a `position: fixed` ring off its button if the layers were not on
 * <body>. For every step it reads, once the step is lit:
 *   • the ring CONTAINS its target (every side of what is on screen), and the padding is EVEN (±1 px);
 *   • the target is LIT — the thing at its centre is the target, not a dimming blocker;
 *   • the ring's white outline is on screen when the target leaves room for it;
 *   • the card is on screen, does not cover the ring, and sits within 24 px of it — beside its target;
 * and a step whose target is missing is skipped, with no empty ring drawn meanwhile.
 *
 * ⚠ WHAT A PASS DOES NOT PROVE: the real pages' own geometry (the fixture stands in for it — the walk on the labs,
 * `shots-2026-10-19/rd-spotlight-ring-finds-its-target/`, is that); WebKit (this suite is Chromium); motion (reduced
 * motion is emulated so a measurement is never taken mid-glide).
 *
 * 🛡 Sabotaged (2026-10-23), each red alone — see the PR body for the counts.
 * Set `SHOTS_DIR` to keep a picture of every step.
 */

const WEB = join(__dirname, '..', '..');
const TSX_CLI = createRequire(join(WEB, '..', '..', 'package.json')).resolve('tsx/cli');
type Step = { anchor: string; title: string; welcome: boolean; go: boolean };
const RENDER = JSON.parse(
  execFileSync(process.execPath, [TSX_CLI, join(__dirname, 'the-spotlight-ring-wraps-its-target.render.ts')], {
    cwd: WEB,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }),
) as { tours: { key: string; inMaker: boolean; steps: Step[] }[]; engine: string };

const SHOTS = process.env.SHOTS_DIR;
const WIDTHS: ReadonlyArray<readonly [number, number]> = [
  [375, 812],
  [390, 844],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
  [2000, 1100],
];

/** The fixture page: the app's frame, the tour's anchors in it, the engine mounted in a transformed box. */
async function build(page: Page, anchors: string[], inMaker: boolean, engine: string) {
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>');
  await page.evaluate(
    ({ anchors, inMaker }) => {
      const vw = document.documentElement.clientWidth;
      const phone = vw < 1024;
      const css = document.createElement('style');
      css.textContent =
        'body{margin:0;font:15px/1.4 system-ui;background:#f4f2ec}button{font:inherit}' +
        '.bar{position:sticky;top:0;z-index:20;height:56px;background:#fff;border-bottom:1px solid #ddd;display:flex;align-items:center;padding:0 16px}' +
        '.part{background:#fff;border:1px solid #ddd;border-radius:16px;margin:0 16px 320px}' +
        '.row{margin:0 0 320px;height:72px;background:#fff;border-block:1px solid #ddd}' +
        '.edge{display:flex;justify-content:flex-end;padding:0 8px;margin-bottom:320px}.edge button{height:44px;width:120px}' +
        '.tall{height:130vh}.card{height:180px}' +
        '.dock{position:fixed;left:0;right:0;bottom:0;z-index:30;height:64px;background:#fff;border-top:1px solid #ddd}' +
        '.dock nav{display:flex;height:100%}.dock nav button{flex:1;border:0;background:none}' +
        '.rail{position:fixed;left:0;top:56px;bottom:0;width:220px;z-index:25;background:#fff;border-right:1px solid #ddd;display:flex;flex-direction:column;padding:8px}' +
        '.rail button{height:44px;margin:2px 0}';
      document.head.appendChild(css);
      const el = (tag: string, cls: string, html = '') => {
        const n = document.createElement(tag);
        n.className = cls;
        n.innerHTML = html;
        return n;
      };
      document.body.appendChild(el('header', 'bar shell-topbar', 'The app’s own top bar'));
      const main = el('main', '');
      main.style.cssText = `padding-top:200px;${phone ? 'padding-bottom:200px' : 'margin-left:240px'}`;
      document.body.appendChild(main);
      const tabs = el('nav', '');
      const holder = phone ? el('div', 'dock') : el('div', 'rail');
      if (phone) holder.setAttribute('data-bottom-dock', '');
      holder.appendChild(tabs);
      document.body.appendChild(holder);
      let k = 0;
      for (const a of anchors) {
        if (document.querySelector(`[data-tour~="${a}"]`)) continue; // a step that lights the same part twice
        if (a.startsWith('maker-')) continue;
        if (a.startsWith('tab-')) {
          const b = el('button', '', a);
          b.setAttribute('data-tour', a);
          tabs.appendChild(b);
          continue;
        }
        const shape = k++ % 4;
        if (shape === 2) {
          const wrap = el('div', 'edge');
          const b = el('button', '', a);
          b.setAttribute('data-tour', a);
          wrap.appendChild(b);
          main.appendChild(wrap);
        } else {
          const p = el('div', shape === 0 ? 'row' : shape === 1 ? 'part card' : 'part tall', a);
          p.setAttribute('data-tour', a);
          main.appendChild(p);
        }
      }
      let mountParent: HTMLElement = document.body;
      if (inMaker) {
        // The full-screen Maker over the app — its top bar is `relative`, Apply at its right end.
        const shell = el('div', '');
        shell.setAttribute('data-maker-shell', '');
        shell.style.cssText = 'position:fixed;inset:0;z-index:80;display:flex;flex-direction:column;background:#fbfaf7';
        const bar = el('header', '');
        bar.style.cssText = 'position:relative;display:flex;align-items:center;gap:6px;height:52px;padding:0 8px;flex-shrink:0';
        bar.innerHTML =
          '<button style="height:40px;width:44px">✕</button><span style="flex:1"></span><button style="height:40px;width:44px">↶</button>' +
          '<button style="height:40px;width:44px">👁</button><span data-tour="maker-apply" style="position:relative;display:inline-flex"><button style="height:40px;width:92px">Apply</button></span>';
        const canvas = el('div', '');
        canvas.style.cssText = 'position:relative;flex:1;min-height:0';
        canvas.innerHTML = '<p data-tour="maker-hint" style="pointer-events:none;position:absolute;top:16px;left:50%;transform:translateX(-50%);margin:0;padding:8px 14px;background:#fff;border-radius:999px">Tap anything to change it</p>';
        const tools = el('div', '');
        tools.setAttribute('data-tour', 'maker-tools');
        tools.style.cssText = 'height:38%;flex-shrink:0;background:#fff;border-top:1px solid #ddd';
        tools.textContent = 'Page · Look · Event Details';
        shell.append(bar, canvas, tools);
        document.body.appendChild(shell);
        mountParent = shell;
      }
      // 🧭 A transformed box 40 px down — a page slide. A `position: fixed` ring inside it would be carried off its button.
      const frame = el('div', '');
      frame.style.cssText = 'position:relative;top:40px;transform:translateZ(0)';
      const host = el('div', '');
      host.id = 'spot-host';
      frame.appendChild(host);
      mountParent.appendChild(frame);
    },
    { anchors, inMaker },
  );
  await page.addScriptTag({ content: engine });
}

type Measure = {
  vw: number;
  vh: number;
  ring: { left: number; top: number; right: number; bottom: number } | null;
  target: { left: number; top: number; right: number; bottom: number } | null;
  tip: { left: number; top: number; right: number; bottom: number } | null;
  lit: boolean;
  title: string;
};

/** The ring, its target and the card, once the card for `title` is up and the ring has stopped moving. */
async function settled(page: Page, anchor: string, title: string): Promise<Measure> {
  await page.waitForFunction(
    (title) => {
      const tip = document.querySelector<HTMLElement>('[data-sn-spot] .sn-spot-tip');
      return !!tip && tip.querySelector('h4')?.textContent === title && tip.style.opacity === '1';
    },
    title,
    { timeout: 8000 },
  );
  let last = '';
  for (let n = 0; n < 12; n++) {
    const m = await page.evaluate((anchor) => {
      const box = (el: Element | null) => {
        const r = el?.getBoundingClientRect();
        return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
      };
      const all = [...document.querySelectorAll<HTMLElement>(`[data-tour~="${anchor}"]`)].filter((e) => e.getBoundingClientRect().width >= 4);
      const target = all.find((c) => !all.some((o) => o !== c && c.contains(o))) ?? null;
      let lit = false;
      if (target) {
        const r = target.getBoundingClientRect();
        const y = Math.min(Math.max(r.top + Math.min(r.height / 2, 22), 0), window.innerHeight - 1);
        // The hint line takes no taps — what is under it is what the blockers would cover.
        const hit = document.elementsFromPoint(r.left + r.width / 2, y).find((n) => !n.closest('.sn-spot-ring, .sn-spot-finger'));
        lit = !!hit && !hit.classList.contains('sn-spot-block') && (target === hit || target.contains(hit) || hit.contains(target) || getComputedStyle(target).pointerEvents === 'none');
      }
      return {
        vw: document.documentElement.clientWidth,
        vh: window.innerHeight,
        ring: box(document.querySelector('.sn-spot-ring')),
        target: box(target),
        tip: box(document.querySelector('[data-sn-spot] .sn-spot-tip')),
        lit,
        title: document.querySelector('[data-sn-spot] .sn-spot-tip h4')?.textContent ?? '',
      };
    }, anchor);
    const key = JSON.stringify([m.ring, m.tip, m.target]);
    if (key === last) return m;
    last = key;
    await page.waitForTimeout(400);
  }
  throw new Error(`the ring for "${title}" never stopped moving`);
}

function check(m: Measure, label: string) {
  expect(m.ring, `${label}: no ring`).not.toBeNull();
  expect(m.target, `${label}: the target is not on the page`).not.toBeNull();
  const ring = m.ring!;
  const t = m.target!;
  const rw = ring.right - ring.left;
  const rh = ring.bottom - ring.top;
  expect(rh, `${label}: the ring is a line (${rw}×${rh}) — the 2026-10-23 thin pill`).toBeGreaterThanOrEqual(12);
  // The target's part on screen (a card taller than the screen is cut at the screen and the bars).
  const tall = t.bottom - t.top > m.vh / 2;
  const vis = { left: Math.max(t.left, 0), right: Math.min(t.right, m.vw), top: Math.max(t.top, 0), bottom: Math.min(t.bottom, m.vh) };
  expect(ring.left, `${label}: the ring starts right of its target`).toBeLessThanOrEqual(vis.left + 0.5);
  expect(ring.right, `${label}: the ring stops short of its target's right edge`).toBeGreaterThanOrEqual(vis.right - 0.5);
  if (!tall) {
    expect(ring.top, `${label}: the ring starts BELOW its target (${ring.top} > ${t.top})`).toBeLessThanOrEqual(t.top + 0.5);
    expect(ring.bottom, `${label}: the ring stops short of its target's foot`).toBeGreaterThanOrEqual(t.bottom - 0.5);
    const pads = [t.left - ring.left, ring.right - t.right, t.top - ring.top, ring.bottom - t.bottom];
    expect(Math.max(...pads) - Math.min(...pads), `${label}: uneven padding ${pads.map((p) => p.toFixed(1)).join(' / ')}`).toBeLessThanOrEqual(1);
    if (t.right + 7 <= m.vw) expect(ring.right + 7, `${label}: the ring's outline is cut at the right edge`).toBeLessThanOrEqual(m.vw + 0.5);
  } else {
    expect(ring.bottom - ring.top, `${label}: the tall card's ring covers less than half the screen`).toBeGreaterThan(m.vh / 3);
  }
  expect(m.lit, `${label}: the target is dimmed — a blocker covers it`).toBe(true);
  // The card: on screen, off the ring, beside it.
  expect(m.tip, `${label}: no card`).not.toBeNull();
  const tip = m.tip!;
  expect(tip.left, `${label}: the card runs off the left`).toBeGreaterThanOrEqual(15.5);
  expect(tip.right, `${label}: the card runs off the right`).toBeLessThanOrEqual(m.vw - 15.5);
  const gapX = Math.max(0, tip.left - ring.right, ring.left - tip.right);
  const gapY = Math.max(0, tip.top - ring.bottom, ring.top - tip.bottom);
  /* A target taller than the screen with no room for the card on either side of it (a phone; a wide card on a
     desktop) leaves the card nowhere else: low on the screen, over the target. Everything else has room. */
  const cardW = Math.min(420, m.vw - 32);
  const nowhere = tall && m.vw - ring.right - 36 < cardW && ring.left - 36 < cardW;
  if (!nowhere) {
    expect(gapX + gapY, `${label}: the card covers its ring`).toBeGreaterThan(0);
    expect(Math.max(gapX, gapY), `${label}: the card is ${gapX.toFixed(0)}/${gapY.toFixed(0)} px from its ring — not beside it`).toBeLessThanOrEqual(24);
  }
}

test.describe.configure({ mode: 'parallel' });

for (const [w, h] of WIDTHS) {
  for (const tour of RENDER.tours) {
    test(`${w}×${h} · ${tour.key}: every ring wraps its target, lit, evenly, the card beside it`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await build(page, tour.steps.map((s) => s.anchor), tour.inMaker, RENDER.engine);
      await page.evaluate(({ steps, inMaker }) => (window as never as { __spot: { mount: (h: Element, s: unknown, m: boolean) => void } }).__spot.mount(document.getElementById('spot-host')!, steps, inMaker), {
        steps: tour.steps,
        inMaker: tour.inMaker,
      });
      expect(tour.steps.length, 'a tour with no steps').toBeGreaterThan(0);
      for (const [n, step] of tour.steps.entries()) {
        const title = step.welcome ? step.title.replace('{name}', 'Isabel') : step.title;
        const label = `${w} ${tour.key} #${n + 1} ${step.anchor}`;
        const m = await settled(page, step.anchor, title);
        if (SHOTS) {
          mkdirSync(SHOTS, { recursive: true });
          await page.screenshot({ path: join(SHOTS, `${tour.key}-${String(n + 1).padStart(2, '0')}-${step.anchor}-${w}.png`) });
        }
        check(m, label);
        // On to the next: Next (a doorway's Next taps the lit part itself, as the sample's did).
        if (n < tour.steps.length - 1) await page.click('[data-sn-spot] .sn-spot-go');
      }
    });
  }

  test(`${w}×${h} · a step whose target is missing is skipped — and no empty ring is drawn meanwhile`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const steps: Step[] = [
      { anchor: 'lab-first', title: 'First', welcome: false, go: false },
      { anchor: 'lab-not-on-this-page', title: 'Missing', welcome: false, go: false },
      { anchor: 'lab-third', title: 'Third', welcome: false, go: false },
    ];
    await build(page, ['lab-first', 'lab-third'], false, RENDER.engine);
    await page.evaluate((steps) => (window as never as { __spot: { mount: (h: Element, s: unknown, m: boolean) => void } }).__spot.mount(document.getElementById('spot-host')!, steps, false), steps);
    check(await settled(page, 'lab-first', 'First'), `${w} missing-step tour #1`);
    await page.click('[data-sn-spot] .sn-spot-go');
    // Watch the wait: whatever ring is drawn is a real one, never a line, and the card never says "Missing".
    const seen = await page.evaluate(async () => {
      const out: { h: number; title: string; opacity: string }[] = [];
      const t0 = performance.now();
      while (performance.now() - t0 < 6000) {
        const r = document.querySelector('.sn-spot-ring')?.getBoundingClientRect();
        const tip = document.querySelector<HTMLElement>('[data-sn-spot] .sn-spot-tip');
        out.push({ h: r ? r.height : -1, title: tip?.querySelector('h4')?.textContent ?? '', opacity: tip?.style.opacity ?? '' });
        if (tip?.querySelector('h4')?.textContent === 'Third' && tip.style.opacity === '1') break;
        await new Promise((r) => setTimeout(r, 100));
      }
      return out;
    });
    expect(seen.filter((s) => s.h >= 0 && s.h < 12).length, 'an empty ring was drawn while the target was missing').toBe(0);
    expect(seen.filter((s) => s.title === 'Missing' && s.opacity === '1').length, 'the card for a missing target was shown').toBe(0);
    check(await settled(page, 'lab-third', 'Third'), `${w} missing-step tour #3`);
  });
}
