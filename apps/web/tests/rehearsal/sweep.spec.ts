/**
 * RELEASE REHEARSAL — THE CONTROL SWEEP.
 *
 * The walk (`journey.spec.ts`) proves one story. This presses EVERYTHING: it
 * signs in as the rehearsal couple and, separately, the rehearsal supplier,
 * opens every dashboard screen the app's own route map names
 * (`lib/ugat/screens.generated.json`), and presses every control on it —
 *
 *   · buttons, tabs, disclosures and in-page view switches;
 *   · native selects and every dropdown / menu: opened, and EACH option picked
 *     (then the original choice put back);
 *   · toggles: pressed, then pressed back;
 *   · sheets and dialogs: opened, every control inside pressed, then closed.
 *
 * — at 375 px first, then on a desktop. It FAILS on:
 *   · an error screen ("Something on our end didn't work." and the other boundaries);
 *   · an uncaught page error, or any console error;
 *   · any 5xx response from this machine.
 * (What the rehearsal's own stubs make — refused outside addresses, the storage
 * stub — is counted and printed, never a failure: `sweep-rules.ts` NOISE.)
 *
 * It never presses a destructive, money or outward-facing control (delete, pay,
 * send, publish, sign out…): `sweep-rules.ts` SKIP_CONTROLS, matched by the
 * control's accessible name. Every skip is printed.
 *
 * Every route, how many controls were pressed, and every failure with its
 * route, control and error text go to `sweep-<persona>-<width>.json`, which
 * `summary.mjs` turns into REHEARSAL.md's "Every control, pressed" section.
 *
 * ⛔ The browser refuses every address that is not this machine (`local-only.ts`).
 */
import { test, expect, devices, type Browser, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { FIXTURE, REPLY_STATE_GUESTS } from './fixture';
import { assertLocalUrl, isLocalUrl } from './local-only';
import {
  ERROR_SCREEN_TEXT,
  SKIP_CONTROLS,
  SKIP_OPTIONS,
  consoleNoise,
  failureKey,
  fillRoute,
  planRoutes,
  responseNoise,
  routeParams,
  routePattern,
  skipReason,
  type Persona,
  type ScreenRow,
} from './sweep-rules';

const OUT = process.env.REHEARSAL_OUT ?? path.resolve(__dirname, '../../rehearsal-out');
const SCREENS = path.join(OUT, 'screens');
const BASE = assertLocalUrl(process.env.REHEARSAL_BASE_URL ?? 'http://localhost:3000', 'the app under rehearsal').origin;
const COUNTER = process.env.REHEARSAL_COUNTER_URL
  ? assertLocalUrl(process.env.REHEARSAL_COUNTER_URL, 'the request counter').origin
  : '';
const PASSWORDS: Record<Persona, string> = {
  couple: process.env.REHEARSAL_HOST_PASSWORD ?? '',
  supplier: process.env.REHEARSAL_SUPPLIER_PASSWORD ?? '',
};
const EMAILS: Record<Persona, string> = { couple: FIXTURE.hostEmail, supplier: FIXTURE.supplier.email };
const HOME: Record<Persona, string> = { couple: `/dashboard/${FIXTURE.eventId}`, supplier: '/vendor-dashboard' };

/** Minutes ONE persona at ONE width may take. Routes past it are listed as "not reached", never as passed. */
const SWEEP_MINUTES = Number(process.env.SWEEP_MINUTES || 110);
const ROUTE_SECONDS = Number(process.env.SWEEP_ROUTE_SECONDS || 150);
const ROUTE_PRESSES = 150;
const OPTIONS_PER_DROPDOWN = 12;
/** Rows of one list (30 guests, 12 suppliers) — the first few are pressed, the rest counted. */
const ROW_REPEATS = 5;
const MAX_FAILURE_SHOTS = 40;
/** In-page views (?gview=…) of one screen that are swept as screens of their own. */
const VIEWS_PER_SCREEN = 8;

type Width = 'phone' | 'desktop';
type Kind = 'button' | 'tab' | 'disclosure' | 'view-link' | 'radio' | 'toggle' | 'select' | 'popup';
type FailKind = 'error-screen' | 'page-error' | 'console-error' | 'http-5xx';

type Control = {
  key: string;
  css: string;
  kind: Kind;
  name: string;
  shell: boolean;
  group: string | null;
  disabled: boolean;
};

type Failure = {
  persona: Persona;
  width: Width;
  route: string;
  url: string;
  control: string;
  kind: FailKind;
  text: string;
  key: string;
  screenshot?: string;
};

type RouteResult = {
  route: string;
  label: string;
  url: string;
  status: 'swept' | 'error-on-load' | 'not-reached' | 'no-fixture' | 'signed-out' | 'harness-error';
  landed?: string;
  pressed: number;
  options: number;
  dialogs: number;
  skipped: Array<{ name: string; reason: string }>;
  unpressable: Array<{ name: string; why: string }>;
  disabled: number;
  repeats: number;
  shared: number;
  budgetLeft: number;
  failures: number;
  seconds: number;
  notes: string[];
};

type Report = {
  persona: Persona;
  width: Width;
  part: string;
  /** Tabs the sweep had to replace, and the screen that trapped each. */
  tabsReplaced: string[];
  finished: boolean;
  minutes: number;
  routes: RouteResult[];
  left: Array<{ route: string; reason: string }>;
  failures: Failure[];
  noise: Record<string, { why: string; count: number }>;
  blocked: Record<string, number>;
  nativeDialogs: string[];
  /**
   * What the app's OWN fault observer (`lib/telemetry/fault-observer.ts`) reported
   * while the sweep pressed — a dead tap, an action that answered an error, a
   * dead end. Listed for a look; not failures of the sweep (an uncaught crash is
   * already one, from the page itself).
   */
  appFaults: AppFault[];
};

type AppFault = { route: string; control: string; type: string; element: string; message: string };

const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
const firstLine = (e: unknown) =>
  (e instanceof Error ? e.message : String(e))
    // eslint-disable-next-line no-control-regex -- Playwright colours its messages
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)[0]
    ?.slice(0, 200) ?? 'unknown';

/** The routes come from the ref's own generated map — the app under rehearsal, not this harness. */
function readScreens(): ScreenRow[] {
  const file = path.resolve(__dirname, '../../lib/ugat/screens.generated.json');
  const j = JSON.parse(fs.readFileSync(file, 'utf8')) as { screens: ScreenRow[] };
  return j.screens;
}

function eventDateYmd(): string {
  // seed.sql: event_date = current_date + 60 (the database's date; Manila is close enough at a day's grain).
  const d = new Date(Date.now() + 60 * 86_400_000);
  return d.toISOString().slice(0, 10);
}

// ── THE BROWSER PAGE: ITS OWN LISTENERS, ITS OWN COUNTS ──────────────────────

class Sweep {
  readonly report: Report;
  private page: Page;
  /** Tabs replaced because they refused to leave a screen (every goto came back ERR_ABORTED). */
  private renewals = 0;
  private inflight = new Set<unknown>();
  private lastNet = Date.now();
  private now: { route: string; url: string; control: string } = { route: '(sign in)', url: '', control: '(page load)' };
  private shots = 0;
  /** Shell controls (top bar, rail, bottom nav) already pressed at this width — pressed once, not on every screen. */
  private shellPressed = new Map<string, string>();
  /** Concrete addresses of [param] routes, found on the screens already opened. */
  readonly seen = new Set<string>();
  private routeFailures = 0;
  /** When the page last started to move — a fetch it cut short then is the sweep's doing. */
  private lastNav = 0;

  constructor(
    page: Page,
    readonly persona: Persona,
    readonly width: Width,
    /** "" or "-1of2": this test's share of the persona's screens. */
    readonly part: string,
  ) {
    this.page = page;
    this.report = {
      persona,
      width,
      part,
      finished: false,
      minutes: SWEEP_MINUTES,
      routes: [],
      left: [],
      failures: [],
      noise: {},
      blocked: {},
      nativeDialogs: [],
      appFaults: [],
      tabsReplaced: [],
    };
    this.attach(page);
  }

  /** Every listener the sweep needs, on one tab. */
  private attach(page: Page): void {
    // The app reports its own faults to /api/telemetry/client-fault. Outside a
    // production deployment that route records nothing and answers 500
    // (`backgroundWritesAllowed`), so the sweep answers it here and keeps what
    // the app said — it is the app telling us which press did nothing.
    void page.route('**/api/telemetry/client-fault', async (route) => {
      const raw = route.request().postData() ?? '';
      try {
        const body = JSON.parse(raw) as Record<string, unknown>;
        if (!Array.isArray(body.loads) && !Array.isArray(body.counts)) {
          const list = Array.isArray(body.faults) ? (body.faults as Record<string, unknown>[]) : [body];
          for (const f of list) {
            if (this.report.appFaults.length >= 500) break;
            // A burst of taps is the sweep opening one dropdown once per option, not a person losing patience.
            if (String(f.event_type) === 'RAGE_TAP') {
              this.noise('rage-tap', "the app's RAGE_TAP: the sweep reopens a dropdown once per option, faster than a person");
              continue;
            }
            this.report.appFaults.push({
              route: this.now.route,
              control: this.now.control,
              type: String(f.event_type ?? 'unknown'),
              element: String(f.element_name ?? '').slice(0, 120),
              message: String(f.error_message ?? '').slice(0, 300),
            });
          }
        }
      } catch {
        /* not JSON — nothing to keep */
      }
      await route.fulfill({ status: 204, body: '' }).catch(() => {});
    });

    page.on('request', (r) => {
      if (r.isNavigationRequest() && r.frame() === page.mainFrame()) this.lastNav = Date.now();
      if (!isLocalUrl(r.url())) return;
      const t = r.resourceType();
      if (t === 'websocket' || t === 'eventsource' || t === 'media') return;
      this.inflight.add(r);
      this.lastNet = Date.now();
    });
    const done = (r: unknown) => {
      if (this.inflight.delete(r)) this.lastNet = Date.now();
    };
    page.on('requestfinished', done);
    page.on('requestfailed', done);

    page.on('pageerror', (e) => {
      const stack = (e.stack ?? '').split('\n').slice(1, 3).map((l) => l.trim()).join(' ');
      this.fail('page-error', `${e.name}: ${e.message}${stack ? ` — ${stack}` : ''}`);
    });
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const text = m.text();
      const src = m.location()?.url ?? '';
      // A 5xx is already counted from its response, with its address.
      if (/Failed to load resource: the server responded with a status of 5\d\d/.test(text)) return;
      const noise = consoleNoise(text, src);
      if (noise) return this.noise(noise.id, noise.why);
      if (/Failed to fetch|NetworkError when attempting to fetch|Load failed/.test(text) && Date.now() - this.lastNav < 3000) {
        return this.noise('navigation-cut', 'a request the sweep cut short by moving on (the page was left mid-load)');
      }
      this.fail('console-error', `${text.slice(0, 400)}${src && /Failed to load resource/.test(text) ? ` (${src.replace(BASE, '')})` : ''}`);
    });
    page.on('response', (r) => {
      if (r.status() < 500) return;
      const url = r.url();
      if (!isLocalUrl(url)) return;
      const noise = responseNoise(url);
      if (noise) return this.noise(noise.id, noise.why);
      const req = r.request();
      const action = req.headers()['next-action'] ? ' (a server action)' : '';
      this.fail('http-5xx', `${r.status()} ${req.method()} ${url.replace(BASE, '').slice(0, 160)}${action}`);
    });
    page.on('dialog', (d) => {
      if (this.report.nativeDialogs.length < 60) {
        this.report.nativeDialogs.push(`${this.now.route} · ${this.now.control}: ${d.type()} "${d.message().slice(0, 120)}" — dismissed`);
      }
      d.dismiss().catch(() => {});
    });
    // Registering these keeps the browser's own pickers from opening; nothing is chosen, nothing is saved.
    page.on('filechooser', () => {});
    page.on('download', (d) => {
      d.cancel().catch(() => {});
    });
    page.on('popup', (p) => {
      p.close().catch(() => {});
    });
  }

  /**
   * A tab that will not leave a screen (every address it is sent to comes back
   * ERR_ABORTED) is replaced by a fresh one in the same signed-in context, and
   * the screen that trapped it is named — that trap is itself worth a look.
   */
  private async renew(reason: string): Promise<void> {
    this.renewals += 1;
    this.report.tabsReplaced.push(`${this.now.route} · after "${this.now.control}": ${reason}`);
    const old = this.page;
    this.page = await old.context().newPage();
    this.attach(this.page);
    this.inflight.clear();
    await old.close({ runBeforeUnload: false }).catch(() => {});
  }

  private noise(id: string, why: string): void {
    const n = (this.report.noise[id] ??= { why, count: 0 });
    n.count += 1;
  }

  private fail(kind: FailKind, text: string): void {
    this.routeFailures += 1;
    const f: Failure = {
      persona: this.persona,
      width: this.width,
      route: this.now.route,
      url: this.now.url,
      control: this.now.control,
      kind,
      text,
      key: failureKey(kind, text),
    };
    this.report.failures.push(f);
    console.log(`::error title=Sweep (${this.persona} · ${this.width}) ${kind}::${f.route} · "${f.control}" — ${text.replace(/\r?\n/g, ' ').slice(0, 300)}`);
    if (this.shots < MAX_FAILURE_SHOTS) {
      this.shots += 1;
      const shot = `sweep-${this.persona}-${this.width}${this.part}-${String(this.shots).padStart(2, '0')}-${slugOf(kind + '-' + f.control)}.png`;
      f.screenshot = shot;
      this.page.screenshot({ path: path.join(SCREENS, shot) }).catch(() => {
        f.screenshot = undefined;
      });
    }
  }

  write(): void {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `sweep-${this.persona}-${this.width}${this.part}.json`), JSON.stringify(this.report, null, 2));
  }

  /** The browser has asked this machine for nothing for 300 ms (or `max` has passed). */
  async quiet(min = 200, max = 5000): Promise<void> {
    await this.page.waitForTimeout(min);
    const until = Date.now() + max;
    while (Date.now() < until) {
      if (this.inflight.size === 0 && Date.now() - this.lastNet >= 300) return;
      await this.page.waitForTimeout(100);
    }
  }

  path(): string {
    try {
      const u = new URL(this.page.url());
      return u.pathname + u.search;
    } catch {
      return '';
    }
  }

  async signIn(next: string): Promise<boolean> {
    const page = this.page;
    this.now = { route: '(sign in)', url: '/login', control: '(sign in)' };
    await page.goto(`${BASE}/login?next=${encodeURIComponent(next)}`, { waitUntil: 'domcontentloaded' });
    await page.locator('#hr-si-email:visible').first().fill(EMAILS[this.persona]);
    await page.locator('#hr-si-password:visible').first().fill(PASSWORDS[this.persona]);
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
    try {
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 45_000 });
      await this.quiet(300, 8000);
      return true;
    } catch {
      return false;
    }
  }

  /** Open an address; signs in again if the session was lost; replaces a tab that will not move. */
  async open(url: string): Promise<void> {
    this.inflight.clear();
    try {
      await this.page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    } catch (e) {
      if (!/ERR_ABORTED|Target (page, context or browser )?(has been )?closed|crashed/i.test(String(e)) || this.renewals >= 20) throw e;
      await this.renew(firstLine(e));
      await this.page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    }
    await this.quiet(300, 10_000);
    if (new URL(this.page.url()).pathname.startsWith('/login')) {
      if (await this.signIn(url)) {
        this.inflight.clear();
        await this.page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await this.quiet(300, 10_000);
      }
    }
  }

  async errorScreen(): Promise<string | null> {
    const source = ERROR_SCREEN_TEXT.source;
    return this.page
      .evaluate((src) => {
        const re = new RegExp(src, 'i');
        for (const h of Array.from(document.querySelectorAll('h1, h2'))) {
          const t = (h.textContent ?? '').replace(/\s+/g, ' ').trim();
          if (re.test(t)) {
            const ref = /Reference:?\s*[\w-]+/i.exec(document.body.innerText ?? '')?.[0];
            return ref ? `${t} · ${ref}` : t;
          }
        }
        return null;
      }, source)
      .catch(() => null);
  }

  /** Every same-origin address on the screen, for the [param] routes. */
  async collectLinks(): Promise<void> {
    const hrefs = await this.page
      .evaluate(() => Array.from(document.querySelectorAll('a[href]')).map((a) => (a as HTMLAnchorElement).href))
      .catch(() => [] as string[]);
    for (const h of hrefs) {
      try {
        const u = new URL(h);
        if (u.origin === BASE) this.seen.add(u.pathname.replace(/\/+$/, '') || '/');
      } catch {
        /* not an address */
      }
    }
  }

  /** Visible open dialogs and sheets, by their path in the page. */
  async dialogs(): Promise<string[]> {
    return this.page
      .evaluate(() => {
        const cssPath = (el: Element): string => {
          const parts: string[] = [];
          let e: Element | null = el;
          while (e && e !== document.body && e.parentElement) {
            let i = 1;
            let s = e.previousElementSibling;
            while (s) {
              if (s.tagName === e.tagName) i += 1;
              s = s.previousElementSibling;
            }
            parts.unshift(`${e.tagName.toLowerCase()}:nth-of-type(${i})`);
            e = e.parentElement;
          }
          return `body > ${parts.join(' > ')}`;
        };
        return Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"],dialog[open],[aria-modal="true"]'))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none';
          })
          .map(cssPath);
      })
      .catch(() => [] as string[]);
  }

  /** Every control a person could press, inside `scope` (a dialog) or on the whole screen. */
  async controls(scope: string | null): Promise<Control[]> {
    return this.page
      .evaluate((scopeCss) => {
        const root = scopeCss ? document.querySelector(scopeCss) : document.body;
        if (!root) return [];
        const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
        const visible = (el: Element): boolean => {
          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) return false;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none') return false;
          return !el.closest('[aria-hidden="true"],[inert]');
        };
        const cssPath = (el: Element): string => {
          const parts: string[] = [];
          let e: Element | null = el;
          while (e && e !== document.body && e.parentElement) {
            let i = 1;
            let s = e.previousElementSibling;
            while (s) {
              if (s.tagName === e.tagName) i += 1;
              s = s.previousElementSibling;
            }
            parts.unshift(`${e.tagName.toLowerCase()}:nth-of-type(${i})`);
            e = e.parentElement;
          }
          return `body > ${parts.join(' > ')}`;
        };
        const nameOf = (el: Element): string => {
          let n = clean(el.getAttribute('aria-label'));
          if (!n) {
            const ids = clean(el.getAttribute('aria-labelledby')).split(' ').filter(Boolean);
            n = clean(ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' '));
          }
          const tag = el.tagName;
          if (!n && (tag === 'SELECT' || tag === 'INPUT')) {
            const input = el as HTMLInputElement;
            n = clean(input.labels?.[0]?.textContent) || clean(input.getAttribute('name')) || clean(input.getAttribute('placeholder'));
            if (!n && tag === 'INPUT') n = clean(input.value);
          }
          if (!n) n = clean((el as HTMLElement).innerText ?? el.textContent);
          if (!n) n = clean(el.getAttribute('title'));
          if (!n) {
            const svg = el.querySelector('svg[class*="lucide-"]');
            const c = svg ? Array.from(svg.classList).find((x) => x.startsWith('lucide-') && x !== 'lucide') : null;
            n = c ? `(icon: ${c.slice('lucide-'.length)})` : '(unnamed)';
          }
          return n.slice(0, 90);
        };
        const SEL = [
          'button', '[role="button"]', 'input[type="button"]', 'input[type="submit"]', 'select',
          '[role="combobox"]', '[aria-haspopup]', '[role="tab"]', '[role="switch"]', '[role="checkbox"]',
          '[role="radio"]', 'input[type="checkbox"]', 'input[type="radio"]', 'summary', 'a[href]',
        ].join(',');
        const out: Array<{
          key: string; css: string; kind: string; name: string; shell: boolean; group: string | null; disabled: boolean;
        }> = [];
        const counts = new Map<string, number>();
        const used = new Set<Element>();
        for (const raw of Array.from(root.querySelectorAll(SEL))) {
          let el: Element = raw;
          const tag = el.tagName.toLowerCase();
          const role = el.getAttribute('role') ?? '';
          const type = (el.getAttribute('type') ?? '').toLowerCase();
          const popup = (el.getAttribute('aria-haspopup') ?? '').toLowerCase();
          // An input a label stands in for: press the label, as a finger would.
          if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
            const label = (el as HTMLInputElement).labels?.[0];
            if (label && visible(label)) el = label;
            else if (!visible(el)) continue;
          }
          if (used.has(el) || !visible(el)) continue;
          // Not inside an open dialog when the whole screen is listed: a dialog is swept when it is opened.
          if (!scopeCss && el.closest('[role="dialog"],[role="alertdialog"],dialog[open],[aria-modal="true"]')) continue;
          let kind = 'button';
          if (tag === 'a') {
            if (role === 'tab') kind = 'tab';
            else if (popup && popup !== 'false' && popup !== 'dialog') kind = 'popup';
            else {
              let u: URL;
              try {
                u = new URL((el as HTMLAnchorElement).href);
              } catch {
                continue;
              }
              // Only a switch WITHIN this screen (?view=…); a link to another screen is a route of its own.
              if (u.origin !== location.origin || u.pathname !== location.pathname || u.search === location.search) continue;
              kind = 'view-link';
            }
          } else if (tag === 'select') kind = 'select';
          else if (role === 'combobox' || ['listbox', 'menu', 'true', 'tree', 'grid'].includes(popup)) kind = 'popup';
          else if (
            role === 'switch' || role === 'checkbox' || el.hasAttribute('aria-pressed') ||
            (raw.tagName === 'INPUT' && type === 'checkbox')
          ) kind = 'toggle';
          else if (role === 'radio' || (raw.tagName === 'INPUT' && type === 'radio')) kind = 'radio';
          else if (role === 'tab') kind = 'tab';
          else if (tag === 'summary') kind = 'disclosure';
          // A combobox that is a text box (search-as-you-type) is typed into, not pressed.
          if (kind === 'popup' && tag === 'input' && type !== 'button') continue;
          used.add(el);
          const name = nameOf(raw === el ? el : raw.tagName === 'INPUT' ? el : raw);
          const base = `${kind}|${name}`;
          const occ = (counts.get(base) ?? 0) + 1;
          counts.set(base, occ);
          const container = el.closest('ul,ol,[role="list"],tbody,[role="grid"],[role="rowgroup"],[role="listbox"]');
          const dataNames = Array.from(el.attributes).map((a) => a.name).filter((n) => n.startsWith('data-')).sort().join(',');
          out.push({
            key: `${base}|${occ}`,
            css: cssPath(el),
            kind,
            name,
            shell: !scopeCss && !!el.closest('header,nav,footer,aside,[role="banner"],[role="navigation"],[role="contentinfo"],[role="complementary"]'),
            group: container ? `${cssPath(container)}|${kind}|${tag}|${dataNames}` : null,
            disabled:
              (el as HTMLButtonElement).disabled === true ||
              (raw as HTMLInputElement).disabled === true ||
              el.getAttribute('aria-disabled') === 'true',
          });
        }
        return out;
      }, scope)
      .then((list) => list as Control[])
      .catch(() => [] as Control[]);
  }

  /** The options a dropdown or menu shows right now (that `before` did not). */
  async visibleOptions(): Promise<Array<{ css: string; name: string; role: string; selected: boolean }>> {
    return this.page
      .evaluate(() => {
        const cssPath = (el: Element): string => {
          const parts: string[] = [];
          let e: Element | null = el;
          while (e && e !== document.body && e.parentElement) {
            let i = 1;
            let s = e.previousElementSibling;
            while (s) {
              if (s.tagName === e.tagName) i += 1;
              s = s.previousElementSibling;
            }
            parts.unshift(`${e.tagName.toLowerCase()}:nth-of-type(${i})`);
            e = e.parentElement;
          }
          return `body > ${parts.join(' > ')}`;
        };
        return Array.from(document.querySelectorAll('[role="option"],[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"]'))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && el.getAttribute('aria-disabled') !== 'true';
          })
          .map((el) => ({
            css: cssPath(el),
            name: ((el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.textContent || '').replace(/\s+/g, ' ').trim() || '(unnamed)').slice(0, 90),
            role: el.getAttribute('role') ?? 'option',
            selected: el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-checked') === 'true',
          }));
      })
      .catch(() => []);
  }

  // ── PRESSING ────────────────────────────────────────────────────────────

  private setNow(route: string, url: string, control: string): void {
    this.now = { route, url, control };
  }

  /** After every press: the error screen, a lost session, a screen that moved. */
  private async afterPress(ctx: RouteCtx): Promise<'same' | 'moved'> {
    const err = await this.errorScreen();
    if (err) {
      this.fail('error-screen', err);
      await this.open(ctx.base);
      return 'moved';
    }
    const here = this.path();
    if (here !== ctx.base) {
      if (here.startsWith('/login')) ctx.result.notes.push(`signed out after "${this.now.control}" — signed back in`);
      // A view of THIS screen (?gview=seats, ?seg=…) is a screen of its own: queued, swept after this one.
      else if (ctx.views && here.split('?')[0] === ctx.base.split('?')[0] && ctx.views.size < VIEWS_PER_SCREEN) ctx.views.add(here);
      await this.open(ctx.base);
      return 'moved';
    }
    return 'same';
  }

  private async click(css: string): Promise<string | null> {
    try {
      await this.page.locator(css).first().click({ timeout: 4000 });
      return null;
    } catch (e) {
      return firstLine(e);
    }
  }

  /** Press the steps that open a dialog again (after the screen was reloaded). */
  private async replay(chain: ChainStep[]): Promise<boolean> {
    for (const step of chain) {
      const now = await this.controls(step.scope);
      const c = now.find((x) => x.css === step.css && x.kind === step.kind) ?? now.find((x) => x.key === step.key);
      if (!c || (await this.click(c.css))) return false;
      await this.quiet(200, 4000);
      if (step.option) {
        const opts = await this.visibleOptions();
        const o = opts.find((x) => x.name === step.option);
        if (!o || (await this.click(o.css))) return false;
        await this.quiet(200, 4000);
      }
    }
    return true;
  }

  /**
   * Put the screen back the way the scope expects it: the screen itself, or the
   * screen with its dialog open. A dialog opened again may sit at a new place in
   * the page; `scope.css` follows it.
   */
  private async restore(ctx: RouteCtx, scope: Scope): Promise<boolean> {
    if (!scope.css) return true;
    const open = await this.dialogs();
    if (open.includes(scope.css)) return true;
    if (this.path() !== ctx.base || scope.chain.length === 0) await this.open(ctx.base);
    else await this.page.keyboard.press('Escape').catch(() => {});
    const before = await this.dialogs();
    if (!(await this.replay(scope.chain))) return false;
    const after = await this.dialogs();
    const fresh = after.filter((d) => !before.includes(d));
    const now = fresh[fresh.length - 1] ?? (scope.chain.length === 0 ? after[after.length - 1] : undefined);
    if (!now) return false;
    scope.css = now;
    return true;
  }

  private async closeDialogs(ctx: RouteCtx, keep: string[]): Promise<void> {
    for (let i = 0; i < 3; i++) {
      const open = (await this.dialogs()).filter((d) => !keep.includes(d));
      if (open.length === 0) return;
      await this.page.keyboard.press('Escape').catch(() => {});
      await this.quiet(150, 2000);
      const still = (await this.dialogs()).filter((d) => !keep.includes(d));
      if (still.length === 0) return;
      // Its own close button, by the words a close button uses.
      const inside = await this.controls(still[still.length - 1]!);
      const close = inside.find((c) => /^(close|cancel|done|back|not now|maybe later|skip|dismiss|×|\(icon: x\))$/i.test(c.name));
      if (close) {
        await this.click(close.css);
        await this.quiet(150, 2000);
      }
    }
    if ((await this.dialogs()).filter((d) => !keep.includes(d)).length > 0) {
      ctx.result.notes.push('a dialog would not close (Escape, its own close button) — the screen was reloaded');
      await this.open(ctx.base);
    }
  }

  /** Press every control inside `scope`. Depth 0 = the screen; 1 = a dialog the screen opened. */
  async sweepScope(ctx: RouteCtx, scope: Scope, depth: number): Promise<void> {
    const handled = new Set<string>();
    const perGroup = new Map<string, number>();
    for (let guard = 0; guard < ROUTE_PRESSES * 2; guard++) {
      if (Date.now() > ctx.deadline || ctx.presses >= ROUTE_PRESSES) {
        const left = (await this.controls(scope.css)).filter((c) => !handled.has(c.key)).length;
        ctx.result.budgetLeft += left;
        if (left > 0) ctx.result.notes.push(`${left} control(s) ${scope.css ? 'in a dialog ' : ''}not pressed: the screen's budget (${ROUTE_SECONDS}s / ${ROUTE_PRESSES} presses) ran out`);
        return;
      }
      if (!(await this.restore(ctx, scope))) {
        ctx.result.notes.push(`a dialog opened by "${scope.chain.map((s) => s.option ?? s.name).join(' › ')}" could not be opened again — the rest of it was not pressed`);
        return;
      }
      const list = await this.controls(scope.css);
      const c = list.find((x) => !handled.has(x.key));
      if (!c) return;
      handled.add(c.key);

      const skip = skipReason(c.name, SKIP_CONTROLS);
      if (skip) {
        if (!ctx.result.skipped.some((s) => s.name === c.name)) ctx.result.skipped.push({ name: c.name, reason: skip });
        continue;
      }
      if (c.disabled) {
        ctx.result.disabled += 1;
        continue;
      }
      const shellKey = `${c.kind}|${c.name}`;
      if (c.shell && depth === 0) {
        if (this.shellPressed.has(shellKey)) {
          ctx.result.shared += 1;
          continue;
        }
        this.shellPressed.set(shellKey, ctx.route);
      }
      if (c.group) {
        const n = (perGroup.get(c.group) ?? 0) + 1;
        perGroup.set(c.group, n);
        if (n > ROW_REPEATS) {
          ctx.result.repeats += 1;
          continue;
        }
      }

      const label = scope.chain.length ? `${scope.chain.map((s) => s.option ?? s.name).join(' › ')} › ${c.name}` : c.name;
      this.setNow(ctx.route, ctx.base, `${label} [${c.kind}]`);
      const beforeDialogs = await this.dialogs();
      ctx.presses += 1;

      if (c.kind === 'select') {
        await this.pressSelect(ctx, c);
        await this.afterPress(ctx);
        continue;
      }
      if (c.kind === 'popup') {
        await this.pressPopup(ctx, scope, c, depth, beforeDialogs);
        continue;
      }

      const why = await this.click(c.css);
      if (why) {
        ctx.result.unpressable.push({ name: label, why });
        ctx.presses -= 1;
        continue;
      }
      ctx.result.pressed += 1;
      await this.quiet();
      if (c.kind === 'toggle') {
        // Put it back: a toggle pressed twice leaves the event as it was.
        if ((await this.afterPress(ctx)) === 'same') {
          const again = (await this.controls(scope.css)).find((x) => x.css === c.css && x.kind === 'toggle');
          if (again && !(await this.click(again.css))) await this.quiet();
        } else continue;
      }
      if ((await this.afterPress(ctx)) === 'moved') continue;
      await this.afterOpen(ctx, scope, c, null, depth, beforeDialogs);
    }
  }

  /** A press that opened a dialog: sweep inside it (one level deep), then close it. */
  private async afterOpen(ctx: RouteCtx, scope: Scope, c: Control, option: string | null, depth: number, before: string[]): Promise<void> {
    const after = await this.dialogs();
    const opened = after.filter((d) => !before.includes(d));
    if (opened.length === 0) return;
    ctx.result.dialogs += 1;
    if (depth === 0) {
      const chain: ChainStep[] = [...scope.chain, { scope: scope.css, css: c.css, key: c.key, kind: c.kind, name: c.name, option: option ?? undefined }];
      await this.sweepScope(ctx, { css: opened[opened.length - 1]!, chain }, depth + 1);
    }
    this.setNow(ctx.route, ctx.base, `${c.name}${option ? ` › ${option}` : ''} (closing its dialog)`);
    await this.closeDialogs(ctx, before);
    await this.afterPress(ctx);
  }

  private async pressSelect(ctx: RouteCtx, c: Control): Promise<void> {
    const sel = () => this.page.locator(c.css).first();
    let options: Array<{ value: string; label: string; disabled: boolean }> = [];
    let original = '';
    try {
      options = await sel().evaluate((s) =>
        Array.from((s as HTMLSelectElement).options).map((o) => ({ value: o.value, label: (o.label || o.text).trim(), disabled: o.disabled })),
      );
      original = await sel().inputValue({ timeout: 3000 });
    } catch (e) {
      ctx.result.unpressable.push({ name: c.name, why: firstLine(e) });
      return;
    }
    let picked = 0;
    for (const o of options) {
      if (picked >= OPTIONS_PER_DROPDOWN) {
        ctx.result.notes.push(`"${c.name}": only the first ${OPTIONS_PER_DROPDOWN} of ${options.length} options were picked`);
        break;
      }
      if (o.disabled || o.value === original) continue;
      const skip = skipReason(o.label, SKIP_OPTIONS);
      if (skip) {
        ctx.result.skipped.push({ name: `${c.name} › ${o.label}`, reason: skip });
        continue;
      }
      this.setNow(ctx.route, ctx.base, `${c.name} › ${o.label} [select]`);
      try {
        await sel().selectOption(o.value, { timeout: 4000 });
      } catch (e) {
        ctx.result.unpressable.push({ name: `${c.name} › ${o.label}`, why: firstLine(e) });
        continue;
      }
      picked += 1;
      ctx.result.options += 1;
      await this.quiet();
      if ((await this.afterPress(ctx)) === 'moved') continue;
    }
    ctx.result.pressed += 1;
    // Put the first choice back.
    try {
      if ((await sel().inputValue({ timeout: 2000 })) !== original) {
        await sel().selectOption(original, { timeout: 4000 });
        await this.quiet();
      }
    } catch {
      /* the select left with the screen; the reload put the saved value back */
    }
  }

  private async pressPopup(ctx: RouteCtx, scope: Scope, c: Control, depth: number, beforeDialogs: string[]): Promise<void> {
    const before = new Set((await this.visibleOptions()).map((o) => o.css));
    const why = await this.click(c.css);
    if (why) {
      ctx.result.unpressable.push({ name: c.name, why });
      return;
    }
    ctx.result.pressed += 1;
    await this.quiet(250, 4000);
    if ((await this.errorScreen()) !== null) {
      await this.afterPress(ctx);
      return;
    }
    const shown = (await this.visibleOptions()).filter((o) => !before.has(o.css));
    if (shown.length === 0) {
      // It opened something other than a list (a sheet, a panel) — handled like any press.
      if ((await this.afterPress(ctx)) === 'moved') return;
      await this.afterOpen(ctx, scope, c, null, depth, beforeDialogs);
      return;
    }
    const original = shown.find((o) => o.selected)?.name ?? null;
    const names = shown.map((o) => ({ name: o.name, role: o.role }));
    let picked = 0;
    let last: string | null = null;
    for (const [i, o] of names.entries()) {
      if (picked >= OPTIONS_PER_DROPDOWN) {
        ctx.result.notes.push(`"${c.name}": only the first ${OPTIONS_PER_DROPDOWN} of ${names.length} options were picked`);
        break;
      }
      const list = o.role === 'menuitem' ? SKIP_CONTROLS : SKIP_OPTIONS;
      const skip = skipReason(o.name, list);
      if (skip) {
        ctx.result.skipped.push({ name: `${c.name} › ${o.name}`, reason: skip });
        continue;
      }
      // Open it again for every option after the first.
      let now = await this.visibleOptions();
      let target = now.find((x) => x.name === o.name);
      if (!target && i > 0) {
        if (this.path() !== ctx.base) await this.open(ctx.base);
        if (scope.css && !(await this.restore(ctx, scope))) return;
        const trigger = (await this.controls(scope.css)).find((x) => x.css === c.css) ?? (await this.controls(scope.css)).find((x) => x.key === c.key);
        if (!trigger || (await this.click(trigger.css))) {
          ctx.result.notes.push(`"${c.name}" could not be opened again after "${last ?? ''}"`);
          return;
        }
        await this.quiet(250, 4000);
        now = await this.visibleOptions();
        target = now.find((x) => x.name === o.name);
      }
      if (!target) {
        ctx.result.unpressable.push({ name: `${c.name} › ${o.name}`, why: 'the option was not shown when the list was opened again' });
        continue;
      }
      this.setNow(ctx.route, ctx.base, `${scope.chain.length ? `${scope.chain.map((s) => s.option ?? s.name).join(' › ')} › ` : ''}${c.name} › ${o.name} [${o.role}]`);
      const dialogsBefore = await this.dialogs();
      const err = await this.click(target.css);
      if (err) {
        ctx.result.unpressable.push({ name: `${c.name} › ${o.name}`, why: err });
        continue;
      }
      picked += 1;
      last = o.name;
      ctx.result.options += 1;
      await this.quiet();
      if ((await this.afterPress(ctx)) === 'moved') continue;
      // A menu item that opened a sheet: swept like any other opener.
      const opened = (await this.dialogs()).filter((d) => !dialogsBefore.includes(d));
      if (opened.length > 0) await this.afterOpen(ctx, scope, c, o.name, depth, dialogsBefore);
      else if ((await this.visibleOptions()).some((x) => x.name === o.name)) await this.page.keyboard.press('Escape').catch(() => {});
    }
    // Put the first choice back, so a reply dropdown leaves the guest as they were.
    if (original && last && last !== original) {
      this.setNow(ctx.route, ctx.base, `${c.name} › ${original} (putting the first choice back)`);
      if (scope.css && !(await this.restore(ctx, scope))) return;
      const trigger = (await this.controls(scope.css)).find((x) => x.css === c.css);
      if (trigger && !(await this.click(trigger.css))) {
        await this.quiet(250, 4000);
        const back = (await this.visibleOptions()).find((x) => x.name === original);
        if (back && !(await this.click(back.css))) await this.quiet();
        await this.afterPress(ctx);
      }
    }
    await this.page.keyboard.press('Escape').catch(() => {});
  }

  /** One screen: open it, press everything on it, write the row. */
  async sweepRoute(route: string, label: string, url: string, deadline: number, isView = false): Promise<void> {
    const started = Date.now();
    this.routeFailures = 0;
    const result: RouteResult = {
      route, label, url, status: 'swept', pressed: 0, options: 0, dialogs: 0, skipped: [], unpressable: [],
      disabled: 0, repeats: 0, shared: 0, budgetLeft: 0, failures: 0, seconds: 0, notes: [],
    };
    this.report.routes.push(result);
    this.setNow(route, url, '(page load)');
    let views: string[] = [];
    try {
      await this.open(url);
      const landed = this.path();
      if (landed.startsWith('/login')) {
        result.status = 'signed-out';
        result.notes.push('the screen sent the signed-in account to the sign-in page, twice');
        return;
      }
      if (new URL(this.page.url()).pathname !== url.split('?')[0]) result.landed = landed;
      const err = await this.errorScreen();
      if (err) {
        this.fail('error-screen', err);
        result.status = 'error-on-load';
        return;
      }
      await this.collectLinks();
      const ctx: RouteCtx = {
        route,
        base: landed,
        deadline: Math.min(deadline, started + ROUTE_SECONDS * 1000),
        presses: 0,
        result,
        views: isView ? null : new Set<string>(),
      };
      // A sheet that is open the moment the screen loads is swept first, as it stands.
      for (const d of await this.dialogs()) {
        result.notes.push('a dialog was already open when the screen loaded — swept as it stood');
        await this.sweepScope(ctx, { css: d, chain: [] }, 1);
      }
      await this.sweepScope(ctx, { css: null, chain: [] }, 0);
      views = [...(ctx.views ?? [])];
    } catch (e) {
      // A harness stumble on one screen is said, and the sweep moves on.
      result.status = 'harness-error';
      result.notes.push(`the sweep itself stopped on this screen: ${firstLine(e)}`);
    } finally {
      result.failures = this.routeFailures;
      result.seconds = Math.round((Date.now() - started) / 1000);
      this.write();
    }
    for (const v of views) {
      const search = v.slice(v.indexOf('?'));
      if (Date.now() > deadline) {
        this.report.routes.push(notReached(`${label} ${search}`, v));
        continue;
      }
      await this.sweepRoute(route, `${label} ${search}`, v, deadline, true);
    }
  }
}

type ChainStep = { scope: string | null; css: string; key: string; kind: Kind; name: string; option?: string };
type Scope = { css: string | null; chain: ChainStep[] };
type RouteCtx = {
  route: string;
  base: string;
  deadline: number;
  presses: number;
  result: RouteResult;
  /** Views of the screen found while pressing it (only on the screen's first address, not on its views). */
  views: Set<string> | null;
};

// ── THE CONTEXT ────────────────────────────────────────────────────────────

async function openContext(browser: Browser, width: Width, blocked: Record<string, number>): Promise<BrowserContext> {
  const shape =
    width === 'phone'
      ? { ...devices['Pixel 5'], viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 }
      : { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
  const context = await browser.newContext({
    ...shape,
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
    locale: 'en-PH',
    timezoneId: 'Asia/Manila',
    acceptDownloads: true,
    permissions: ['geolocation'],
    geolocation: { latitude: 14.5995, longitude: 120.9842 },
  });
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (isLocalUrl(url)) return route.continue();
    let host = 'unparseable';
    try {
      host = new URL(url).hostname;
    } catch {
      /* keep the placeholder */
    }
    blocked[host] = (blocked[host] ?? 0) + 1;
    return route.abort('blockedbyclient');
  });
  // "Copy" buttons write to the clipboard; a headless browser may refuse it. Keep the press, drop the write.
  await context.addInitScript(() => {
    const clip = navigator.clipboard;
    if (clip && typeof clip.writeText === 'function') clip.writeText = async () => {};
  });
  return context;
}

// ── THE TESTS: each persona, phone first, then desktop ─────────────────────

async function sweepPersona(browser: Browser, persona: Persona, width: Width, shard: number, shards: number): Promise<Report> {
  expect(PASSWORDS[persona], `the workflow hands the ${persona} password in by env`).not.toBe('');
  fs.mkdirSync(SCREENS, { recursive: true });
  const blocked: Record<string, number> = {};
  const context = await openContext(browser, width, blocked);
  const page = await context.newPage();
  const sweep = new Sweep(page, persona, width, shards > 1 ? `-${shard + 1}of${shards}` : '');
  sweep.report.blocked = blocked;
  const deadline = Date.now() + SWEEP_MINUTES * 60_000;

  try {
    const signedIn = await sweep.signIn(HOME[persona]);
    expect(signedIn, `the ${persona} account signs in`).toBe(true);

    const plan = planRoutes(readScreens(), persona);
    // This test's share: every `shards`-th screen. Redirect-only screens are named by the first share only.
    const mine = plan.sweep.filter((_, i) => i % shards === shard);
    sweep.report.left = shard === 0 ? plan.left : [];
    // The guest card first: it is where the reply dropdown crashed on 2026-11-23, and a card per reply state is the point.
    const first = mine.filter((s) => /\/guests\/\[guestId\]$/.test(s.route));
    const statics = mine.filter((s) => !first.includes(s) && routeParams(s.route).filter((p) => p !== 'eventId').length === 0);
    const dynamics = [...first, ...mine.filter((s) => !first.includes(s) && !statics.includes(s))];
    // The request counter files what the sweep costs under its own row, not the walk's last step.
    if (COUNTER) await fetch(`${COUNTER}/__rehearsal/step?name=${encodeURIComponent('(the control sweep)')}`).catch(() => {});

    // The guest cards before anything else.
    await sweepDynamics(first);
    for (const s of statics) {
      const url = fillRoute(s.route, { eventId: FIXTURE.eventId });
      if (!url) continue;
      if (Date.now() > deadline) {
        sweep.report.routes.push(notReached(s.route, url));
        continue;
      }
      await sweep.sweepRoute(s.route, s.route, url, deadline);
    }

    await sweepDynamics(dynamics.filter((s) => !first.includes(s)));
    sweep.report.finished = true;
  } finally {
    sweep.write();
    await context.close().catch(() => {});
  }
  return sweep.report;

  // [param] screens: the fixture's own ids where it has them, else the first
  // address of that shape a swept screen linked to.
  async function sweepDynamics(list: ScreenRow[]): Promise<void> {
    for (const s of list) {
      const instances: Array<{ url: string; label: string }> = [];
      if (persona === 'couple' && /\[guestId\]$/.test(s.route)) {
        const all = [
          ...REPLY_STATE_GUESTS.map((g) => ({ id: g.id, label: `${g.firstName} ${g.lastName} · ${g.rsvp}${g.setBy ? ` (set by the ${g.setBy})` : ''}${g.invited ? '' : ', not invited'}${g.plusOne ? ', with a plus-one' : ''}` })),
        ];
        for (const g of all) {
          const url = fillRoute(s.route, { eventId: FIXTURE.eventId, guestId: g.id });
          if (url) instances.push({ url, label: `${s.route} — ${g.label}` });
        }
      } else {
        const re = routePattern(s.route);
        const found = [...sweep.seen].find((p) => {
          const m = re.exec(p);
          return !!m && (persona !== 'couple' || p.includes(FIXTURE.eventId));
        });
        const fallback =
          /\[date\]$/.test(s.route) ? fillRoute(s.route, { eventId: FIXTURE.eventId, date: eventDateYmd() }) : null;
        const url = found ?? fallback;
        if (url) instances.push({ url, label: found ? s.route : `${s.route} (the event's own date)` });
      }
      if (instances.length === 0) {
        sweep.report.routes.push({
          ...notReached(s.route, ''),
          status: 'no-fixture',
          notes: [`no swept screen linked to one, and the fixture has no id for ${routeParams(s.route).filter((p) => p !== 'eventId').map((p) => `[${p}]`).join(' ')}`],
        });
        continue;
      }
      for (const inst of instances) {
        if (Date.now() > deadline) {
          sweep.report.routes.push(notReached(inst.label, inst.url));
          continue;
        }
        await sweep.sweepRoute(s.route, inst.label, inst.url, deadline);
      }
    }
  }
}

function notReached(route: string, url: string): RouteResult {
  return {
    route, label: route, url, status: 'not-reached', pressed: 0, options: 0, dialogs: 0, skipped: [], unpressable: [],
    disabled: 0, repeats: 0, shared: 0, budgetLeft: 0, failures: 0, seconds: 0,
    notes: [`not reached: this width's ${SWEEP_MINUTES}-minute budget ran out`],
  };
}

function assertClean(r: Report): void {
  const seen = new Map<string, { f: Failure; n: number }>();
  for (const f of r.failures) {
    const e = seen.get(f.key);
    if (e) e.n += 1;
    else seen.set(f.key, { f, n: 1 });
  }
  const lines = [...seen.values()].map(({ f, n }) => `${f.kind} · ${f.route} · "${f.control}" — ${f.text.slice(0, 240)}${n > 1 ? ` (×${n})` : ''}`);
  const unreached = r.routes.filter((x) => x.status === 'not-reached').length;
  expect(lines, `every control on every ${r.persona} screen at ${r.width} width works`).toEqual([]);
  expect(r.finished && unreached === 0, `the ${r.persona} sweep at ${r.width} width reached every screen of its list (${unreached} not reached)`).toBe(true);
}

test.describe.configure({ mode: 'parallel' });

/**
 * The couple has about twice the supplier's screens, so its list is shared
 * between two tests (every other screen each). Declared phone-first: with fewer
 * workers than tests, every 375 px part runs before any desktop one.
 */
const SHARDS: Record<Persona, number> = { couple: Number(process.env.SWEEP_COUPLE_SHARDS || 2), supplier: 1 };
for (const width of ['phone', 'desktop'] as const) {
  for (const persona of ['couple', 'supplier'] as const) {
    for (let shard = 0; shard < SHARDS[persona]; shard++) {
      const part = SHARDS[persona] > 1 ? ` · part ${shard + 1} of ${SHARDS[persona]}` : '';
      test(`every control — ${persona} · ${width === 'phone' ? '375 px' : 'desktop 1280 px'}${part}`, async ({ browser }) => {
        test.setTimeout((SWEEP_MINUTES + 15) * 60_000);
        const report = await sweepPersona(browser, persona, width, shard, SHARDS[persona]);
        assertClean(report);
      });
    }
  }
}
