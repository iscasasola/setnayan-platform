import { expect, test } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * E2E repro for the 3D Plan phone-demo walk→sit→arrival chain (bug observed
 * live: tapping "Where am I seated?" plays the walk + chair-pull-back sit
 * choreography VISUALLY, but the view's phase never reaches 'arrived' — the
 * pill stays "Walking you in…" and "You're at <table>" never appears).
 *
 * The chain under test: Walker useFrame raw>=1 → walk.onComplete → beginSit
 * (plan3d-scene.tsx scripted-walk effect) → SitController pull/step/tuck/
 * settle → finish() → onSeated → onWalkComplete → guest-view
 * setPhase('arrived').
 *
 * Unlike the other specs in this folder (pure logic or public pages), this
 * one needs a REAL `demo_sessions` row, so it mints one directly against
 * Supabase REST with the service-role key from `apps/web/.env.local` —
 * exactly the row `mintPlan3DGuestQr` (app/_actions/plan3d-demo-actions.ts)
 * would insert, bound to a seated guest of the public Maria & Jose sample
 * event. When those env vars are absent (e.g. CI against a Vercel preview
 * with no service key), the whole spec skips instead of false-failing.
 *
 * WebGL: headless Chromium renders via SwiftShader; if the canvas/WebGL
 * context can't init in this environment the spec logs and SKIPS — a broken
 * GPU stack is not the bug under investigation.
 */

// --- env: load apps/web/.env.local the way `next start` would -----------------

function loadLocalEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  // tests/e2e/ → apps/web/.env.local
  const envPath = join(__dirname, '..', '..', '.env.local');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m?.[1] != null && m[2] != null) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
  return out;
}

const localEnv = loadLocalEnv();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;

// --- Supabase REST helpers (service-role, RLS-bypassed — test-only) -----------

async function rest(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase REST ${init.method ?? 'GET'} ${path} → ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Same token shape `lib/demo-sessions.ts#mintToken` produces. */
function mintToken(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * Finds a seated, non-deleted guest of the Maria & Jose sample event and
 * mints a `demo_sessions` row bound to them — mirroring
 * `mintPlan3DGuestQr` without going through the desktop overlay UI.
 */
async function mintDemoSession(): Promise<{ tokenA: string; guestId: string }> {
  const events = (await rest(
    `events?is_sample=eq.true&slug=eq.maria-and-jose&event_type=eq.wedding&select=event_id&limit=1`,
  )) as Array<{ event_id: string }>;
  const eventId = events?.[0]?.event_id;
  if (!eventId) throw new Error('Sample event maria-and-jose (is_sample=true) not found in this database.');

  const seats = (await rest(
    `event_seat_assignments?event_id=eq.${eventId}&select=guest_id&order=seat_number.asc&limit=25`,
  )) as Array<{ guest_id: string }>;
  if (!seats?.length) throw new Error('Sample event has no seat assignments — the demo needs a seated guest.');

  // resolvePlan3DGuestToken only sees guests with deleted_at IS NULL, so
  // filter the seated ids through the same gate before binding.
  const seatedIds = [...new Set(seats.map((s) => s.guest_id))];
  const guests = (await rest(
    `guests?event_id=eq.${eventId}&guest_id=in.(${seatedIds.join(',')})&deleted_at=is.null&select=guest_id&limit=1`,
  )) as Array<{ guest_id: string }>;
  const guestId = guests?.[0]?.guest_id;
  if (!guestId) throw new Error('No seated, non-deleted sample guest found to bind the demo session to.');

  const tokenA = mintToken();
  const inserted = (await rest(`demo_sessions`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      demo_kind: '3d_plan',
      token_a: tokenA,
      token_b: mintToken(),
      expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
      bound_ref: guestId,
    }),
  })) as Array<{ token_a: string }>;
  if (!inserted?.length) throw new Error('demo_sessions insert returned no row.');

  return { tokenA, guestId };
}

async function deleteDemoSession(tokenA: string): Promise<void> {
  try {
    await rest(`demo_sessions?token_a=eq.${tokenA}`, { method: 'DELETE' });
  } catch {
    /* best-effort cleanup — the 20-min TTL + purge sweep catches leftovers */
  }
}

// --- the repro -----------------------------------------------------------------

test.describe('3D Plan demo — walk → sit → arrival chain', () => {
  test.skip(
    !SUPABASE_URL || !SERVICE_KEY,
    'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available (checked process.env and apps/web/.env.local) — cannot mint a demo session.',
  );

  test('"Where am I seated?" ends in the "You\'re at <table>" arrival pill', async ({ page }, testInfo) => {
    // The scripted walk is long (entrance → across the room → sit clip), so
    // give the whole test a generous ceiling well above the 60s arrival budget.
    test.setTimeout(150_000);

    const consoleLines: string[] = [];
    page.on('console', (msg) => {
      const line = `[browser:${msg.type()}] ${msg.text()}`;
      consoleLines.push(line);
      if (msg.type() === 'error' || msg.type() === 'warning') console.log(line);
    });
    page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));

    const { tokenA, guestId } = await mintDemoSession();
    console.log(`[repro] minted demo session token_a=${tokenA} bound_ref=${guestId}`);

    try {
      await page.goto(`/3d_plan/demo/${tokenA}`);

      // Fail fast + loud if the token failed closed instead of resolving.
      await expect(
        page.getByRole('heading', { name: 'This demo link expired' }),
        'token resolved to the dead-end page — session mint or resolve is broken, not the walk chain',
      ).toHaveCount(0);

      const walkButton = page.getByRole('button', { name: 'Where am I seated?' });
      await expect(walkButton).toBeVisible({ timeout: 15_000 });

      // WebGL probe — the R3F canvas is a client-side dynamic import; if this
      // environment can't stand up a GL context (no SwiftShader), the walk can
      // never play, which is NOT the bug under test → skip, don't false-fail.
      const webglOk = await page.evaluate(() => {
        const c = document.createElement('canvas');
        return !!(c.getContext('webgl2') || c.getContext('webgl'));
      });
      let canvasOk = true;
      try {
        await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 30_000 });
      } catch {
        canvasOk = false;
      }
      if (!webglOk || !canvasOk) {
        console.log(`[repro] WebGL unavailable in this environment (webglOk=${webglOk} canvasOk=${canvasOk}) — skipping.`);
        test.skip(true, 'WebGL/canvas failed to init in headless Chromium — cannot exercise the 3D walk here.');
      }

      await walkButton.click();

      // Sanity: the click registered — phase 'walking' flips the pill label.
      await expect(page.getByRole('button', { name: 'Walking you in…' })).toBeVisible({ timeout: 5_000 });
      console.log('[repro] walk started (pill flipped to "Walking you in…")');

      // THE assertion under test: phase must reach 'arrived'. The apostrophe
      // in the component is U+2019 (&rsquo;), so match loosely.
      await expect(
        page.getByText(/You.re at /),
        'walk+sit choreography played but phase never reached \'arrived\' — the onComplete → beginSit → onSeated → onWalkComplete chain dropped',
      ).toBeVisible({ timeout: 60_000 });
      console.log('[repro] ARRIVED — "You\'re at <table>" rendered.');
    } finally {
      await testInfo.attach('browser-console.log', { body: consoleLines.join('\n'), contentType: 'text/plain' });
      await deleteDemoSession(tokenA);
    }
  });

  /**
   * Regression guard for the 2026-07-08 arrival-chain hang: in a starved rAF
   * environment (hidden tab, the embedded dev-preview panel — frames arrive in
   * on-demand bursts, `visibilityState` stays 'hidden'), the walk's wall-clock
   * `raw` hits 1 on the first delivered frame, but the OLD sit clip then
   * needed one MORE frame per phase (pull → step → tuck → ~12 settle frames)
   * before `finish()` → the pill hung at "Walking you in…" forever while the
   * figure LOOKED seated. Completion must be wall-clock-owned: after total
   * starvation, a handful of manually pumped frames must land the arrival.
   * (Verified red on the pre-fix build with this exact pump budget.)
   */
  test('arrival survives a starved rAF stream (frames pumped by hand)', async ({ page }, testInfo) => {
    test.setTimeout(150_000);

    // Stub rAF BEFORE any page script: frames are delivered ONLY via
    // window.__pump(), modelling the frames-on-demand preview panel.
    await page.addInitScript(() => {
      const queue: Array<[number, FrameRequestCallback]> = [];
      let id = 0;
      window.requestAnimationFrame = (cb: FrameRequestCallback) => {
        queue.push([++id, cb]);
        return id;
      };
      window.cancelAnimationFrame = (cid: number) => {
        const i = queue.findIndex(([qid]) => qid === cid);
        if (i >= 0) queue.splice(i, 1);
      };
      (window as unknown as { __pump: () => number }).__pump = () => {
        const q = queue.splice(0);
        const t = performance.now();
        for (const [, cb] of q) cb(t);
        return q.length;
      };
    });
    const pump = () => page.evaluate(() => (window as unknown as { __pump: () => number }).__pump());

    const consoleLines: string[] = [];
    page.on('console', (msg) => {
      consoleLines.push(`[browser:${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));

    const { tokenA, guestId } = await mintDemoSession();
    console.log(`[repro] minted demo session token_a=${tokenA} bound_ref=${guestId}`);

    try {
      await page.goto(`/3d_plan/demo/${tokenA}`);
      await expect(
        page.getByRole('heading', { name: 'This demo link expired' }),
        'token resolved to the dead-end page — session mint or resolve is broken, not the walk chain',
      ).toHaveCount(0);

      const walkButton = page.getByRole('button', { name: 'Where am I seated?' });
      await expect(walkButton).toBeVisible({ timeout: 15_000 });
      const webglOk = await page.evaluate(() => {
        const c = document.createElement('canvas');
        return !!(c.getContext('webgl2') || c.getContext('webgl'));
      });
      let canvasOk = true;
      try {
        await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 30_000 });
      } catch {
        canvasOk = false;
      }
      if (!webglOk || !canvasOk) {
        test.skip(true, 'WebGL/canvas failed to init in headless Chromium — cannot exercise the 3D walk here.');
      }

      await walkButton.click();
      await expect(page.getByRole('button', { name: 'Walking you in…' })).toBeVisible({ timeout: 5_000 });
      console.log('[repro] walk started under starved rAF (zero frames flowing)');

      // Total starvation for the whole walk duration — the wall clock runs,
      // no frames do. The demo walk is ~15 s; 17 s guarantees raw >= 1.
      await page.waitForTimeout(17_000);

      // Frame 1: the Walker fires onComplete instantly (wall-clock raw) and
      // beginSit commits the SitController. The commit itself needs no rAF,
      // but SwiftShader shader work can delay it a few seconds — the spaced
      // pumps below leave room for it. Old code needed 4+ post-mount frames
      // (one per phase); fixed code completes the whole owed clip on its
      // FIRST post-mount frame, so this budget stays red for regressions.
      await pump();
      await page.waitForTimeout(6_000);
      await pump(); // first (or spare) post-mount frame — carries the owed clip
      await page.waitForTimeout(2_000);
      await pump(); // spare, in case the mount commit landed after pump 2
      await expect(
        page.getByText(/You.re at /),
        'sit clip did not complete once frames resumed — completion is frame-count-bound again (see sit-controller advance/carry-over)',
      ).toBeVisible({ timeout: 5_000 });
      console.log('[repro] ARRIVED after starved-rAF resume — chain is wall-clock-owned.');
    } finally {
      await testInfo.attach('browser-console.log', { body: consoleLines.join('\n'), contentType: 'text/plain' });
      await deleteDemoSession(tokenA);
    }
  });
});
