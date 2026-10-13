/**
 * A FINGER PICKS THE RSVP ANSWER — in WebKit, the engine of every iPhone browser. Touched, not clicked.
 *
 * 🚨 Found on the batch-3 walk (2026-10-13, Maker lab, WebKit at 375×812 touch) and LIVE on main: on the Maker's RSVP
 * stage a finger's tap on the Yes / No answer lines never picked them — a mouse click did. The frame's own events,
 * logged in the lab: `pointerdown · touchstart · pointerup · touchend` and NO click; the one `preventDefault()` on
 * the way was the canvas bridge's `onDown`, on the pointerdown — it refuses the press that would focus a field, and
 * the two answers are `<label>`s (`INERT_FIELDS`). In WebKit a cancelled TOUCH pointerdown cancels the tap's click
 * too (Chromium still sends it, which is why only Safari lost it). The question line, no label, was picked fine.
 *
 * So this bundles the REAL bridge (`rsvp-canvas-bridge.tsx`, esbuild), mounts it in a frame over the answers' own
 * markup (`rsvp-widget.tsx`'s label · sr-only radio · word span, after the section's marker), and taps with a
 * TOUCHSCREEN in WebKit:
 *   • the tap on Yes must reach the Maker as a pick of the `yes` line (the bridge's own message);
 *   • the answer still does not tick, and no field takes focus — the canvas is not the real RSVP (owner 2026-10-07).
 * A mouse click is pressed too, and the question line touched, so the harness is proven to hear what it asserts.
 *
 * ⚠ WebKit is the Safari engine, not a real iPhone. CI's runners have no WebKit (the e2e job installs Chromium only),
 * so there the browser half is SKIPPED, said by name — the source guard at the end runs everywhere.
 *
 * Run: `pnpm test:unit` (from apps/web)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const BRIDGE = join(WEB, 'app/[slug]/_components/rsvp-canvas-bridge.tsx');
const ORIGIN = 'http://rsvp-canvas.test';

async function bundle(): Promise<string> {
  /* esbuild is tsx's own (not a direct dependency, so no types here): only `build` is used. */
  type Esbuild = { build: (o: Record<string, unknown>) => Promise<{ outputFiles: Array<{ text: string }> }> };
  const esbuild = createRequire(createRequire(join(WEB, 'package.json')).resolve('tsx'))('esbuild') as Esbuild;
  const out = await esbuild.build({
    stdin: {
      contents: `import { createElement } from 'react'; import { createRoot } from 'react-dom/client'; import { RsvpCanvasBridge } from ${JSON.stringify(BRIDGE)};
        createRoot(document.getElementById('bridge')).render(createElement(RsvpCanvasBridge));`,
      resolveDir: WEB,
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    alias: { '@': WEB },
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  });
  return out.outputFiles[0]!.text;
}

/* The answers as `rsvp-widget.tsx` draws them on the canvas — after the section's marker, as the Maker's page does. */
const FRAME = `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><style>.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}label{display:flex;min-height:48px;align-items:center;justify-content:center;cursor:pointer;border:1px solid}</style>
<body><div id=bridge></div><div id=page><span data-maker-section="f:rsvp" hidden></span>
<form><fieldset>
  <span data-rsvp-line="question" style="display:block;padding:16px">Will you celebrate with us?</span>
  <label data-rsvp-line="yes" data-rsvp-answer=""><input type="radio" name="rsvp_status" value="attending" class="sr-only"><span data-rsvp-word="yes">Joyfully accept</span></label>
  <label data-rsvp-line="no" data-rsvp-answer=""><input type="radio" name="rsvp_status" value="declined" class="sr-only"><span data-rsvp-word="no">Regretfully decline</span></label>
  <input name="note" placeholder="A note" style="display:block;width:100%;height:44px">
</fieldset></form></div>
<script>/* React delegates its listeners to the root that holds the page — WebKit sends a finger's click only to what listens. */document.getElementById('page').addEventListener('click',()=>{});</script><script src="/bridge.js"></script></body>`;
const OUTER = `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><body style="margin:0">
<iframe id=f src="/frame.html" style="border:0;width:375px;height:700px"></iframe>
<script>window.__heard=[];addEventListener('message',(e)=>{if(e.data&&e.data.source==='setnayan-site'&&e.data.t!=='rsvpReady')window.__heard.push(e.data)});</script></body>`;

function webkitThere(): string | null {
  try {
    const { webkit } = createRequire(join(WEB, 'package.json'))('@playwright/test') as typeof import('@playwright/test');
    const p = webkit.executablePath();
    return existsSync(p) ? null : `WebKit is not installed here (${p})`;
  } catch (e) {
    return `Playwright cannot be loaded (${String(e).slice(0, 80)})`;
  }
}

test('WebKit, a finger: a tap on Yes / No picks that line — and ticks nothing, focuses nothing', async (t) => {
  const missing = webkitThere();
  if (missing) return t.skip(`${missing} — the source guard below still runs`);
  const { webkit, devices } = createRequire(join(WEB, 'package.json'))('@playwright/test') as typeof import('@playwright/test');
  const js = await bundle();
  const browser = await webkit.launch();
  try {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 812 } });
    await ctx.route(`${ORIGIN}/**`, (r) => {
      const path = new URL(r.request().url()).pathname;
      if (path === '/bridge.js') return r.fulfill({ contentType: 'text/javascript', body: js });
      if (path === '/frame.html') return r.fulfill({ contentType: 'text/html', body: FRAME });
      return r.fulfill({ contentType: 'text/html', body: OUTER });
    });
    const page = await ctx.newPage();
    if (process.env.DEBUG_RSVP_TAP) page.on('console', (m) => console.log('[frame]', m.type(), m.text().slice(0, 300)));
    if (process.env.DEBUG_RSVP_TAP) page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
    await page.goto(`${ORIGIN}/`);
    const frame = page.frames().find((f) => f.url().endsWith('/frame.html'))!;
    await frame.waitForFunction(() => document.querySelector('[data-rsvp-line="yes"] input')?.hasAttribute('inert'));
    const heard = async () => page.evaluate(() => (window as unknown as { __heard: Array<Record<string, unknown>> }).__heard.splice(0));
    const touch = async (sel: string) => {
      const b = (await page.frameLocator('#f').locator(sel).boundingBox())!;
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForTimeout(500);
    };
    /* The harness hears a finger at all: the question line has no label. */
    if (process.env.DEBUG_RSVP_TAP) {
      await page.frameLocator('#f').locator('[data-rsvp-line="question"]').click();
      await page.waitForTimeout(300);
      console.log('mouse question heard', JSON.stringify(await heard()));
    }
    await touch('[data-rsvp-line="question"]');
    assert.ok((await heard()).some((m) => m.t === 'rsvpPick'), 'the harness heard no pick of the question — it cannot prove the answers');
    for (const line of ['yes', 'no']) {
      await touch(`[data-rsvp-line="${line}"]`);
      const got = await heard();
      assert.ok(
        got.some((m) => m.t === 'rsvpPick' && m.line === line),
        `a finger on "${line}" reached the Maker as ${JSON.stringify(got)} — WebKit dropped the tap's click`,
      );
    }
    const page2 = await frame.evaluate(() => ({
      ticked: [...document.querySelectorAll<HTMLInputElement>('input[type=radio]')].some((r) => r.checked),
      focus: document.activeElement?.tagName ?? null,
    }));
    assert.equal(page2.ticked, false, 'the canvas is not the real RSVP — a tap must never tick the answer');
    assert.notEqual(page2.focus, 'INPUT', 'a tap must never focus a field (no keyboard)');
    await touch('input[name="note"]');
    assert.notEqual(await frame.evaluate(() => document.activeElement?.tagName ?? null), 'INPUT', 'a finger on a field must not focus it');
    /* …and a mouse, as it always could. */
    await page.frameLocator('#f').locator('[data-rsvp-line="yes"]').click();
    await page.waitForTimeout(300);
    assert.ok((await heard()).some((m) => m.t === 'rsvpPick' && m.line === 'yes'), 'a mouse click on Yes no longer picks it');
  } finally {
    await browser.close();
  }
});

test('the bridge never cancels a finger’s pointerdown (it refuses the field’s focus on the mousedown instead)', () => {
  const src = stripComments(readFileSync(BRIDGE, 'utf8'));
  const down = src.slice(src.indexOf('const onDown = (e: Event) => {'), src.indexOf('const onKey = (e: Event) => {'));
  assert.ok(down.length > 50, 'onDown not found in rsvp-canvas-bridge.tsx');
  const touchOut = down.search(/if \(e\.type === 'pointerdown' && \(e as PointerEvent\)\.pointerType !== 'mouse'\) return;/);
  assert.ok(touchOut > 0, 'onDown must return before cancelling a touch / pen pointerdown');
  assert.ok(touchOut < down.indexOf('e.preventDefault()'), '…and BEFORE its preventDefault');
  assert.match(src, /document\.addEventListener\('mousedown', onDown, true\);/, 'the mousedown that refuses the focus must still be heard');
});
