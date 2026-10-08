/**
 * RELEASE REHEARSAL — the walk.
 *
 * ONE story, in order, at 375×812, against the app built in production mode and
 * a throw-away database (`.github/workflows/release-rehearsal.yml`). It is the
 * launch-critical journey, with the Event Hub first:
 *
 *   A  the host signs in and lands on the event Home
 *   B  Event Hub Maker: Stages → Studio → a draft change → ✓ Apply → the guest
 *      page shows it (and did NOT show it before Apply)
 *   C  Guests › Setup → one guest's invitation link is copied (nothing is sent)
 *      → the guest opens it → replies yes → the host sees them coming
 *   D  the public page, signed out
 *   E  two screens left open for a minute with nothing pressed — what the app
 *      asks the database when nothing happened (owner rule: it should ask nothing)
 *
 * Every step: tells the request counter its name, asserts what a PERSON would
 * check (the name on the reply, the count on the tile — never just "it
 * loaded"), saves a screenshot, and writes its result to steps.json for the
 * summary. A failed step saves its screenshot and the page, names itself in a
 * GitHub error annotation, and the run goes red. The rest of that chapter is
 * marked "not reached"; an independent chapter still runs, so one run shows
 * every broken part of a release rather than only the first.
 *
 * ⛔ The browser refuses every address that is not this machine and records it.
 * Selectors are the app's own `data-*` hooks and accessible names — the same
 * ones its unit guards pin — so a renamed control fails here by name.
 */
import { test, expect, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { FIXTURE } from './fixture';
import { assertLocalUrl, isLocalUrl } from './local-only';

const OUT = process.env.REHEARSAL_OUT ?? path.resolve(__dirname, '../../rehearsal-out');
const SCREENS = path.join(OUT, 'screens');
const BASE = assertLocalUrl(process.env.REHEARSAL_BASE_URL ?? 'http://localhost:3000', 'the app under rehearsal').origin;
const COUNTER = process.env.REHEARSAL_COUNTER_URL
  ? assertLocalUrl(process.env.REHEARSAL_COUNTER_URL, 'the request counter').origin
  : '';
const PASSWORD = process.env.REHEARSAL_HOST_PASSWORD ?? '';

/** What the phone asked the APP for during a step — the reason behind its database count. */
type AppAsks = {
  /**
   * Screens the phone asked the app's server to draw: the one the person
   * opened, plus every screen the app loaded in the background on its own
   * (link preloads and the app's own preloader). Each one reads the database.
   */
  screens: number;
  /** Of those, the ones sent as a link preload. */
  preloads: number;
  /** Presses that reached the server (server actions). */
  presses: number;
};

type StepRecord = {
  chapter: string;
  title: string;
  /** The name this step has in the request counter's report. */
  counted?: string;
  ok: boolean | null;
  checks: string[];
  app: AppAsks;
  screenshot?: string;
  error?: string;
};

const records: StepRecord[] = [];
/** The step now running — the browser's requests to the app are filed under it. */
let running: StepRecord | null = null;
const blocked = new Map<string, number>();
let finished = false;

function writeReports(): void {
  fs.mkdirSync(SCREENS, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'steps.json'), JSON.stringify({ finished, steps: records }, null, 2));
  const hosts = [...blocked].map(([host, count]) => ({ host, count })).sort((a, b) => b.count - a.count);
  fs.writeFileSync(
    path.join(OUT, 'blocked-requests.json'),
    JSON.stringify({ total: hosts.reduce((n, h) => n + h.count, 0), hosts }, null, 2),
  );
}

const slugOf = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

/** A phone-sized context that can only talk to this machine. */
async function phone(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    // The service worker would answer from its own cache; a rehearsal must see
    // what the server sends. Reduced motion skips intro animations a person
    // would simply wait through.
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
  });
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    if (isLocalUrl(url)) {
      if (running && url.startsWith(BASE)) {
        const h = request.headers();
        if (h['next-action']) running.app.presses += 1;
        else if (request.resourceType() === 'document' || h['rsc']) {
          running.app.screens += 1;
          if (h['next-router-prefetch']) running.app.preloads += 1;
        }
      }
      return route.continue();
    }
    let host = 'unparseable';
    try {
      host = new URL(url).hostname;
    } catch {
      /* keep the placeholder */
    }
    blocked.set(host, (blocked.get(host) ?? 0) + 1);
    return route.abort('blockedbyclient');
  });
  // "Copy invitation link" hands the link to the clipboard. Keep the real
  // behaviour (the button still says "Copied") and remember what was copied.
  await context.addInitScript(() => {
    const w = window as unknown as { __rehearsalCopied?: string[] };
    w.__rehearsalCopied = [];
    const clip = navigator.clipboard;
    if (clip && typeof clip.writeText === 'function') {
      const original = clip.writeText.bind(clip);
      clip.writeText = async (text: string) => {
        w.__rehearsalCopied?.push(text);
        try {
          await original(text);
        } catch {
          /* a headless browser may refuse the real clipboard; the copy is kept above */
        }
      };
    }
  });
  return context;
}

/**
 * The cookie notice sits over the bottom of a phone screen — answer it once per
 * visitor, as a person would. Best effort: where it is not shown, or sits under
 * a sheet (the sign-in card covers it), there is nothing for a person to press
 * either, and the walk moves on.
 */
async function answerCookieNotice(page: Page): Promise<void> {
  const essential = page
    .getByRole('region', { name: 'Cookie consent' })
    .getByRole('button', { name: 'Essential only' });
  try {
    await essential.click({ timeout: 5_000 });
  } catch {
    /* not on this screen */
  }
}

/** Park a page on nothing, so what it would keep asking is not billed to another visitor's step. */
async function rest(page: Page): Promise<void> {
  await page.goto('about:blank').catch(() => {});
}

/** Read the request counter. `stepDb` is what the running step has cost so far. */
async function counted(): Promise<{ total: number; stepDb: number }> {
  if (!COUNTER) return { total: -1, stepDb: -1 };
  try {
    const j = (await (await fetch(`${COUNTER}/__rehearsal/total`)).json()) as { total?: number; stepDb?: number };
    return { total: Number(j.total ?? -1), stepDb: Number(j.stepDb ?? -1) };
  } catch {
    return { total: -1, stepDb: -1 };
  }
}

/**
 * Wait until the database has heard nothing for a moment. The browser going
 * quiet is not enough: the server may still be drawing the screens it was asked
 * to preload, and those requests belong to THIS step, not the next one.
 */
async function settle(maxMs = 30_000): Promise<void> {
  if (!COUNTER) return;
  const until = Date.now() + maxMs;
  let last = -2;
  let same = 0;
  while (Date.now() < until) {
    const { total } = await counted();
    if (total === last) {
      same += 1;
      if (same >= 3) return;
    } else {
      same = 0;
      last = total;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

/** A figure on the Home counts up for a moment — read it once it stops moving. */
async function settledNumber(tile: Locator): Promise<number> {
  let last = Number.NaN;
  for (let i = 0; i < 40; i++) {
    const m = /\d[\d,]*/.exec(await tile.innerText());
    const now = m ? Number(m[0].replace(/,/g, '')) : Number.NaN;
    if (!Number.isNaN(now) && now === last) return now;
    last = now;
    await tile.page().waitForTimeout(500);
  }
  throw new Error('the figure never settled on a number');
}

class Walk {
  private n = 0;
  private broken = new Set<string>();

  /** True when an earlier step of a chapter this one needs has failed. */
  private blockedBy(needs: readonly string[]): string | undefined {
    return needs.find((c) => this.broken.has(c));
  }

  async step(
    chapter: string,
    title: string,
    page: () => Page,
    run: (check: (what: string) => void) => Promise<void>,
    needs: readonly string[] = [],
  ): Promise<void> {
    this.n += 1;
    const num = String(this.n).padStart(2, '0');
    const record: StepRecord = { chapter, title, ok: null, checks: [], app: { screens: 0, preloads: 0, presses: 0 } };
    records.push(record);

    const waitingOn = this.blockedBy([chapter, ...needs]);
    if (waitingOn) {
      record.error = `not reached — an earlier step of "${waitingOn}" failed`;
      writeReports();
      return;
    }

    record.counted = `${num} ${title}`;
    if (COUNTER) {
      await fetch(`${COUNTER}/__rehearsal/step?name=${encodeURIComponent(record.counted)}`).catch(() => {});
    }
    running = record;

    try {
      await run((what) => record.checks.push(what));
      // Let the screen settle the way an eye would before the picture is taken
      // — and so the background loads it set off are counted under THIS step.
      await page().waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await settle();
      await page().evaluate(() => window.scrollTo(0, 0)).catch(() => {});
      record.screenshot = `${num}-${slugOf(title)}.png`;
      await page().screenshot({ path: path.join(SCREENS, record.screenshot) });
      record.ok = true;
    } catch (e) {
      record.ok = false;
      const message = (e instanceof Error ? e.message : String(e))
        // eslint-disable-next-line no-control-regex -- Playwright colours its messages; the summary is plain text
        .replace(/\u001b\[[0-9;]*m/g, '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 6)
        .join(' ')
        .slice(0, 600);
      record.error = message;
      this.broken.add(chapter);
      record.screenshot = `${num}-${slugOf(title)}-FAILED.png`;
      try {
        const p = page();
        await p.screenshot({ path: path.join(SCREENS, record.screenshot), fullPage: true });
        fs.writeFileSync(path.join(OUT, `failure-${num}-${slugOf(title)}.html`), await p.content());
        fs.writeFileSync(path.join(OUT, `failure-${num}-${slugOf(title)}.url.txt`), p.url());
      } catch {
        record.screenshot = undefined;
      }
      // Loud, named, and on the run page — not only in an artifact.
      await settle(10_000);
      console.log(
        `::error title=Rehearsal failed at step ${num}: ${title}::${message.replace(/\r?\n/g, ' ')} — screenshot: rehearsal-screens/${record.screenshot ?? '(none)'}`,
      );
    }
    writeReports();
  }
}

test('the launch-critical journey', async ({ browser }) => {
  expect(PASSWORD, 'the workflow hands the host password in by env').not.toBe('');
  fs.mkdirSync(SCREENS, { recursive: true });

  const walk = new Walk();
  const hostCtx = await phone(browser);
  const guestCtx = await phone(browser);
  const strangerCtx = await phone(browser);
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();
  const stranger = await strangerCtx.newPage();

  const eventUrl = `/dashboard/${FIXTURE.eventId}`;
  const invited = FIXTURE.invitedGuest;
  // Unique to this run, so "the guest page shows it" cannot pass on old text.
  const note = `See you at the rehearsal — ${Date.now().toString(36)}.`;
  let comingBefore = -1;
  let inviteLink = '';

  // ── A · THE HOST ────────────────────────────────────────────────────────
  await walk.step('A · Host', 'Sign in as the host', () => host, async (check) => {
    await host.goto(`${BASE}/login?next=${encodeURIComponent(eventUrl)}`);
    await expect(host.getByRole('heading', { name: 'Sign in to Setnayan.' })).toBeVisible();
    await host.locator('#hr-si-email').fill(FIXTURE.hostEmail);
    await host.locator('#hr-si-password').fill(PASSWORD);
    await host.getByRole('button', { name: 'Continue', exact: true }).click();
    await host.waitForURL((u) => u.pathname === eventUrl, { timeout: 45_000 });
    await answerCookieNotice(host);
    check('the password is accepted and the host lands on their event');
  });

  await walk.step('A · Host', 'The event Home', () => host, async (check) => {
    // Opened again on its own, so this row of the request table is the Home's
    // cost and nothing else's (the row above also holds the sign-in).
    await host.reload();
    const home = host.locator('section[aria-label="Home"]');
    await expect(home).toBeVisible();
    await expect(host.locator('[data-home-cover] h1').first()).toContainText(FIXTURE.eventName);
    check(`the event is "${FIXTURE.eventName}"`);
    await expect(host.locator('[data-home-guests-unread]')).toHaveCount(0);
    const coming = host.locator('a[data-home-tile="coming"]');
    await expect(coming).toBeVisible();
    comingBefore = await settledNumber(coming);
    // The seed made this many say yes; the couple's own two rows may count too.
    expect(comingBefore).toBeGreaterThanOrEqual(FIXTURE.attendingAtStart);
    expect(comingBefore).toBeLessThanOrEqual(FIXTURE.attendingAtStart + 2);
    check(`the "coming" tile reads ${comingBefore} (the fixture has ${FIXTURE.attendingAtStart} guests who said yes)`);
    await expect(host.getByRole('link', { name: 'Edit your Event Hub' }).first()).toBeVisible();
    check('the Event Hub door is on the Home');
  });

  // ── B · THE EVENT HUB MAKER ─────────────────────────────────────────────
  await walk.step('B · Event Hub', 'Open the Event Hub Maker — Stages', () => host, async (check) => {
    await host.goto(`${BASE}${eventUrl}/launch`);
    await expect(host.locator('[data-maker-shell]').first()).toBeVisible({ timeout: 45_000 });
    const sides = host.getByRole('group', { name: 'Stages or Studio' });
    await expect(sides).toBeVisible();
    check('the Maker opens with Stages | Studio on top');
    // A new event's Maker opens on Studio (by design: nothing covers Stages).
    await sides.locator('[data-seg="stages"]').click();
    await expect(sides.locator('[data-seg="stages"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(host.locator('[data-stage-tools]').first()).toBeVisible({ timeout: 30_000 });
    const canvas = host.frameLocator('iframe[data-maker-canvas-frame="shown"]');
    for (const name of FIXTURE.hostNames) {
      await expect(canvas.getByText(name, { exact: false }).first()).toBeVisible({ timeout: 45_000 });
    }
    check(`Stages shows the guest page itself, with ${FIXTURE.hostNames.join(' & ')} on it`);
    await expect(host.locator('[data-maker-apply] button:visible').first()).toBeDisabled();
    check('✓ Apply is off — nothing is waiting');
  }, ['A · Host']);

  await walk.step('B · Event Hub', 'Studio', () => host, async (check) => {
    const sides = host.getByRole('group', { name: 'Stages or Studio' });
    await sides.locator('[data-seg="studio"]').click();
    await expect(sides.locator('[data-seg="studio"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(host.locator('[data-studio-home]')).toBeVisible();
    await expect(host.locator('[data-studio-tile]')).toHaveCount(11);
    check('Studio shows its eleven tiles');
    await expect(host.locator('[data-studio-tile="info"]')).toBeVisible();
    await expect(host.locator('[data-studio-ready]')).toContainText('of 11 ready');
    check(`it says "${(await host.locator('[data-studio-ready]').innerText()).trim()}"`);
  }, ['A · Host']);

  await walk.step('B · Event Hub', 'Change the draft — a new note to guests', () => host, async (check) => {
    await host.locator('[data-studio-tile="info"]').click();
    // The Info form keeps every field mounted; the one on screen is the one a person types in.
    const box = host.locator('textarea[data-same-field="special_message"]:visible').first();
    await expect(box).toBeVisible({ timeout: 30_000 });
    await box.scrollIntoViewIfNeeded();
    await expect(box).toHaveAttribute('aria-label', 'Special message — your closing words to guests');
    await box.fill(note);
    await expect(host.locator('[data-special-save-state="saved"]').first()).toBeAttached({ timeout: 20_000 });
    check('typing saves to the draft (no Save button)');
    await expect(host.locator('[data-maker-apply-count]:visible').first()).toBeVisible();
    await expect(host.locator('[data-maker-apply] button:visible').first()).toBeEnabled();
    check('✓ Apply now shows a change waiting');
    // A draft is the host's alone until Apply.
    await stranger.goto(`${BASE}/${FIXTURE.slug}`);
    await expect(stranger.locator('h1[data-motion="arrive-names"]:visible').first()).toBeVisible();
    await expect(stranger.getByText(note)).toHaveCount(0);
    check('the guest page does NOT show the draft yet');
    await rest(stranger);
  }, ['A · Host']);

  await walk.step('B · Event Hub', '✓ Apply', () => host, async (check) => {
    await host.locator('[data-maker-apply] button:visible').first().click();
    const sheet = host.locator('[data-apply-pro-sheet]');
    await expect(sheet).toBeVisible();
    const withoutPro = sheet.locator('[data-apply-pro-without]');
    if (await withoutPro.count()) {
      await withoutPro.click();
      check('Apply asked about Pro effects; applied without them');
    } else {
      await expect(sheet).toContainText('Ready to apply');
      await sheet.getByRole('button', { name: 'Apply', exact: true }).click();
      check('the sheet says "Ready to apply"');
    }
    await expect(sheet).toBeHidden({ timeout: 30_000 });
    await expect(host.locator('[data-maker-save-status="error"], [data-maker-save-status="held"]')).toHaveCount(0);
    await expect(host.locator('[data-maker-apply-count]')).toHaveCount(0, { timeout: 30_000 });
    check('nothing is left waiting — the change is live');
  }, ['A · Host']);

  await walk.step('B · Event Hub', 'The guest page shows the change', () => stranger, async (check) => {
    await stranger.goto(`${BASE}/${FIXTURE.slug}`);
    await expect(stranger.locator('h1[data-motion="arrive-names"]:visible').first()).toBeVisible({ timeout: 45_000 });
    await answerCookieNotice(stranger);
    // The note lives under the page's Details tab — where a guest would look for it.
    await stranger.getByRole('link', { name: 'Details', exact: true }).first().click();
    await stranger.waitForURL((u) => u.searchParams.get('tab') === 'details', { timeout: 30_000 });
    await expect(stranger.locator('.pahina-plate:visible', { hasText: note }).first()).toBeVisible({ timeout: 30_000 });
    check('the new note is on the guest page, under Details');
  }, ['A · Host']);

  // ── C · INVITE → REPLY ──────────────────────────────────────────────────
  await walk.step('C · Guests', 'Guests › Setup', () => host, async (check) => {
    await rest(stranger);
    await host.goto(`${BASE}${eventUrl}/guests?gview=share`);
    await expect(host.locator('[data-guest-setup]')).toBeVisible({ timeout: 45_000 });
    await expect(host.locator('a[data-guests-seg="share"]')).toHaveAttribute('aria-current', 'page');
    check('Setup is the open view of the guest list');
    const send = host.locator('[data-testid="setup-send"]');
    await expect(send).toBeVisible();
    await expect(send).toContainText(/Send to \d+/);
    check(`Invitations offers "${(await send.innerText()).trim().replace(/\s+/g, ' ')}"`);
  }, ['A · Host']);

  await walk.step('C · Guests', 'Send to one guest — copy their invitation link', () => host, async (check) => {
    await host.goto(`${BASE}${eventUrl}/guests/${invited.id}`);
    const cell = host.locator('button[data-guest-invite-cell]:visible').first();
    await expect(cell).toBeVisible({ timeout: 45_000 });
    await expect(cell).toHaveAttribute('aria-label', `Invite ${invited.fullName}`);
    check(`the card is ${invited.fullName}'s, and they have not been invited yet`);
    await cell.click();
    const panel = host.locator('[data-guest-invite-panel]');
    await expect(panel).toBeVisible();
    await panel.locator('[data-guest-invite-copy-link]').click();
    await expect(panel.locator('[data-guest-invite-copy-link]')).toContainText('Copied');
    const copied = await host.evaluate(() => (window as unknown as { __rehearsalCopied?: string[] }).__rehearsalCopied ?? []);
    inviteLink = copied[copied.length - 1] ?? '';
    const link = assertLocalUrl(inviteLink, 'the copied invitation link');
    expect(link.pathname).toBe(`/${FIXTURE.slug}`);
    expect(link.searchParams.get('invite') ?? '').not.toBe('');
    check(`the link opens this event (/${FIXTURE.slug}) and carries ${invited.firstName}'s own key`);
    check('copied only — nothing was emailed, texted or shared');
  }, ['A · Host']);

  await walk.step('C · Guests', 'The guest opens the link', () => guest, async (check) => {
    await rest(host);
    await guest.goto(inviteLink);
    await guest.waitForURL((u) => u.pathname.includes('/invite/'), { timeout: 45_000 });
    await answerCookieNotice(guest);
    const door = guest.locator('[data-door-header]');
    await expect(door).toBeVisible();
    for (const name of FIXTURE.hostNames) await expect(door).toContainText(name);
    check(`the door names the hosts (${FIXTURE.hostNames.join(' & ')})`);
    await expect(guest.locator('a[data-landing-reply]')).toBeVisible();
    check('"Reply to the invitation" is offered');
  }, ['A · Host']);

  await walk.step('C · Guests', 'The guest replies yes', () => guest, async (check) => {
    await guest.locator('a[data-landing-reply]').click();
    await guest.waitForURL((u) => u.pathname.endsWith('/invite/reply'), { timeout: 45_000 });
    await expect(guest.locator('[data-reply-for]')).toContainText(invited.firstName);
    check(`the reply is addressed to ${invited.fullName}`);
    await guest.locator('label[data-rsvp-answer]', { hasText: 'Joyfully accepts' }).click();
    await guest.locator('#contact_mobile').fill('09171234567');
    await guest.locator('#rsvp_terms').check();
    await guest.getByRole('button', { name: 'Send my reply' }).click();
    await guest.waitForURL((u) => u.searchParams.get('rsvp') === 'ok', { timeout: 45_000 });
    const popup = guest.locator('[data-ticket-popup]');
    if (await popup.isVisible().catch(() => false)) {
      await popup.getByRole('button', { name: 'Close' }).first().click();
    }
    await expect(guest.locator('[data-landing-done]')).toBeVisible();
    await expect(guest.locator('[data-landing-heading]')).toContainText('You replied');
    check('the page answers "You replied — see you there"');
  }, ['A · Host']);

  await walk.step('C · Guests', 'The host sees the guest is coming', () => host, async (check) => {
    await rest(guest);
    await host.goto(`${BASE}${eventUrl}/guests?q=${encodeURIComponent(invited.lastName)}`);
    const row = host.locator(`[data-guest-row][data-guest-id="${invited.id}"]:visible`).first();
    await expect(row).toBeVisible({ timeout: 45_000 });
    await expect(row).toContainText('Attending');
    check(`${invited.fullName} is marked Attending in the guest list`);
    await host.goto(`${BASE}${eventUrl}`);
    await expect(host.locator('a[data-home-tile="coming"]')).toContainText(String(comingBefore + 1), { timeout: 20_000 });
    check(`the Home's "coming" count went ${comingBefore} → ${comingBefore + 1}`);
  }, ['A · Host']);

  // ── E (first half) · THE HOST'S HOME, LEFT OPEN ─────────────────────────
  const IDLE_SECONDS = 60;
  await walk.step('E · Left open', `The host's Home, left open for ${IDLE_SECONDS} seconds`, () => host, async (check) => {
    // The step above ended on the Home and waited for it to go quiet. Nothing
    // is pressed here: whatever is counted now, the app asked on its own.
    await expect(host.locator('section[aria-label="Home"]')).toBeVisible();
    await host.waitForTimeout(IDLE_SECONDS * 1000);
    await expect(host.locator('section[aria-label="Home"]')).toBeVisible();
    const { stepDb } = await counted();
    check(`nothing was pressed for ${IDLE_SECONDS} s — the app made ${stepDb < 0 ? 'an unread number of' : stepDb} database requests on its own`);
  }, ['A · Host', 'C · Guests']);

  // ── D · A STRANGER ──────────────────────────────────────────────────────
  await walk.step('D · Public', 'The public guest page, signed out', () => stranger, async (check) => {
    await rest(host);
    await rest(guest);
    await strangerCtx.clearCookies();
    await stranger.goto(`${BASE}/${FIXTURE.slug}`);
    const names = stranger.locator('h1[data-motion="arrive-names"]:visible').first();
    await expect(names).toBeVisible({ timeout: 45_000 });
    await answerCookieNotice(stranger);
    for (const name of FIXTURE.hostNames) await expect(names).toContainText(name);
    check(`the hosts' names are on the page (${FIXTURE.hostNames.join(' & ')})`);
    const date = stranger.locator('p[data-motion="arrive-date"]:visible').first();
    await expect(date).toBeVisible();
    await expect(date).toContainText(/\d/);
    check(`the date reads "${(await date.innerText()).trim().replace(/\s+/g, ' ')}"`);
    await expect(stranger.getByText(invited.fullName)).toHaveCount(0);
    check('no guest is named to a stranger');
  });

  await walk.step('E · Left open', `The guest page, left open for ${IDLE_SECONDS} seconds`, () => stranger, async (check) => {
    const names = stranger.locator('h1[data-motion="arrive-names"]:visible').first();
    await expect(names).toBeVisible();
    await stranger.waitForTimeout(IDLE_SECONDS * 1000);
    await expect(names).toBeVisible();
    const { stepDb } = await counted();
    check(`nothing was pressed for ${IDLE_SECONDS} s — the app made ${stepDb < 0 ? 'an unread number of' : stepDb} database requests on its own`);
  }, ['D · Public']);

  finished = true;
  writeReports();
  await Promise.all([hostCtx.close(), guestCtx.close(), strangerCtx.close()]);

  const failed = records.filter((r) => r.ok !== true);
  expect(
    failed.map((r) => `${r.title}: ${r.error ?? 'failed'}`),
    'every step of the rehearsal must pass',
  ).toEqual([]);
});
