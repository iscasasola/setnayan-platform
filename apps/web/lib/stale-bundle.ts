/**
 * Telling a stale open tab apart from a real crash.
 *
 * ── WHAT HAPPENS ────────────────────────────────────────────────────────────
 * We deploy on every merge. A page someone already has open keeps asking for
 * the JavaScript files that existed when it loaded — and after a deploy those
 * filenames are gone. The browser cannot fetch them, React throws, and the
 * person sees:
 *
 *     Application error: a client-side exception has occurred
 *
 * Nothing is wrong with the site. A reload fixes it completely. But the message
 * says the opposite, so the reasonable reaction is to assume we are broken and
 * stop — which is exactly what the owner did, twice in one day, on a site that
 * was serving correctly the entire time. The second time, three deploys landed
 * in half an hour while his page sat open.
 *
 * 🔑 THIS IS INDISTINGUISHABLE FROM AN OUTAGE FROM THE OUTSIDE, AND IT IS THE
 * OPPOSITE OF ONE. Every vendor and couple with a tab open during a deploy sees
 * it. We cannot stop deploying; we can stop it reading as a failure.
 *
 * ── TWO SHAPES, ONE DISEASE (the second added 2026-09-15) ───────────────────
 * The file is named for the first one it caught, and the name is now too
 * narrow: the tab can be out of date about a SCRIPT (a chunk that moved) or
 * about an ACTION (a Server Action the new build answers differently). The
 * second is worse, because it strikes the moment somebody presses Save — so
 * the error lands exactly where a person is most likely to conclude their work
 * is gone, and their work is in fact already written.
 *
 * ⚠ THE NAME IS KEPT DELIBERATELY. `stale-bundle.test.ts`, `app/error.tsx` and
 * `app/global-error.tsx` all reference these symbols, and a rename buys a
 * tidier word at the cost of touching three guards — see the repo note that
 * some guards assert by file path. The docblock carries the meaning instead.
 *
 * ── 🔬 THIS IS A MITIGATION, NOT A CURE — AND HERE IS HOW TO FINISH IT ──────
 * What reloads is the SYMPTOM. Nobody has established WHY the follow-up request
 * comes back unreadable, and a symptom that stops being visible is a question
 * that stops being asked — which is why the open half is written HERE, in the
 * file, rather than left in a conversation.
 *
 * Measured and settled: the write always lands; no 5xx; no server digest; the
 * Server Action POST returns a healthy 303 with a Location, so the action ran.
 * Two candidates remain and nothing on the server can separate them:
 *   (a) the POST resolves against a NEWER deployment than the tab loaded from
 *       (skew protection IS on — 12h — and the deployment id IS embedded, so
 *        this is not simply "unconfigured"; verify on the Vercel PROJECT, never
 *        by grepping this repo, where the setting cannot exist);
 *   (b) middleware intercepts the follow-up. `middleware.ts` has NO RSC
 *       awareness anywhere and its matcher covers the dashboard.
 *
 * 🔑 ONE CAPTURE DECIDES IT, and it takes about ten seconds while the error is
 * on screen. Before reloading:
 *   1. DevTools → Network, tick **Preserve log** (the error page navigates and
 *      the entries vanish without it).
 *   2. Find the POST that returned 303, then the request DIRECTLY BELOW it — a
 *      GET to the same URL, usually carrying `_rsc=`.
 *   3. Read that GET's **content-type**:
 *        `text/x-component` → the payload was fine; look elsewhere.
 *        `text/html`        → it was handed a page where data was expected.
 *                             Then the `x-vercel-id` / any `location` header
 *                             says whether a deployment (a) or a redirect (b)
 *                             did it.
 *
 * ── AND A ONE-GLANCE DISCRIMINATOR WORTH KNOWING GENERALLY ─────────────────
 * `app/error.tsx` prints a "Reference: …" line ONLY when `error.digest` exists,
 * and a digest exists only for a SERVER-side failure. So whether that line is
 * on screen splits server-fault from client-fault before any log is opened —
 * on a screen the person is already looking at, at no cost. Its ABSENCE is what
 * identified this whole class.
 *
 * ── WHY MATCH ON THE MESSAGE, WHICH IS USUALLY A BAD IDEA ───────────────────
 * There is no error CODE for this. Webpack throws a plain `Error` with
 * `name === 'ChunkLoadError'`; Vite and Safari surface it as a failed dynamic
 * import with wording that varies by browser. The name check is the reliable
 * half and comes first; the text patterns are the fallback for engines that do
 * not set it. A false positive costs one reload — the same thing the person was
 * about to do by hand — so the failure mode of guessing wrong is mild in the
 * one direction and severe in the other.
 */

import { unstable_isUnrecognizedActionError } from 'next/navigation';

/** Error shapes a browser produces when the JS it wants is no longer deployed. */
const STALE_PATTERNS = [
  /loading chunk \S+ failed/i,
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i, // Safari
  /'text\/html' is not a valid javascript mime type/i, // a 404 HTML page served where JS was expected

  // ── THE SECOND SHAPE: A STALE *ACTION*, NOT A STALE SCRIPT (2026-09-15) ────
  //
  // The owner reported an error page after saving a guest — twice, days apart.
  // Measured each time: THE WRITE LANDED. The email was in the database, the
  // rename was in the database, no 5xx was logged, no server digest was shown.
  // Reproduced live with the console open, the message was:
  //
  //     An unexpected response was received from the server.
  //
  // That is Next.js's Server Action transport error. It does NOT mean the
  // action failed — an action that throws is serialised properly and arrives
  // here as its own error WITH a `digest`. It means the reply could not be
  // read as an action response at all: the tab posted to a build that answers
  // differently than the one it loaded from.
  //
  // 🔑 SAME DISEASE AS THE CHUNKS ABOVE, ONE LAYER UP. The scripts case is a
  // tab asking for a FILE that moved; this is a tab asking for an ACTION that
  // moved. Both are "the tab is older than the server", both are cured by one
  // reload, and both currently read to the person as "I just lost my work" —
  // which is the opposite of the truth, because the work is already saved.
  //
  // ⚠ WHY THIS IS SAFE TO RELOAD ON, given the test right below it insists a
  // REAL crash must not be. This message is about the ENVELOPE, never about
  // the action's own logic. A failing action reaches the boundary as a normal
  // error with a digest, and `digest` is exactly what was ABSENT on the
  // owner's screen — the "Reference:" line the boundary prints was not there.
  // So this pattern cannot swallow an application bug: an application bug does
  // not produce this string.
  /an unexpected response was received from the server/i,
  // The sibling shape, when the follow-up navigation payload is the unreadable
  // half rather than the action's reply. Next usually recovers from this on its
  // own with a hard navigation; when it surfaces instead, a reload is the same
  // remedy it would have applied.
  /failed to fetch rsc payload/i,
];

export function isStaleBundleError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: unknown; message?: unknown; stack?: unknown };
  if (e.name === 'ChunkLoadError') return true;
  const message = typeof e.message === 'string' ? e.message : '';
  if (!message) return false;
  if (STALE_PATTERNS.some((p) => p.test(message))) return true;
  return isWebpackRuntimeMissingModule(e);
}

/**
 * ── THE THIRD SHAPE: webpack asked for a MODULE the new build no longer has (2026-11-10) ──
 *
 * Seen live on the owner's phone: Create on a service card SAVED (row in the
 * database), then `/vendor-dashboard/shop?saved=1&created=draft` drew "Something
 * on our end didn't work". Console:
 *
 *     TypeError: Cannot read properties of undefined (reading 'call')
 *         at c (…/_next/static/chunks/webpack-<hash>.js:1:128)
 *
 * That is webpack's own `__webpack_require__` calling `modules[id].call(...)` for an
 * id the old tab knows and the current deploy does not. A reload drew the page
 * fine. No pattern above matched it, so the boundary showed a crash for a save
 * that had worked.
 *
 * ⚠ NARROW ON PURPOSE — "a REAL crash is not mistaken for a stale tab" stays true:
 * the same message from APP code (`x.call` on undefined in our own chunk) is a
 * real bug. Only when the TOP stack frame is the webpack RUNTIME chunk is it this.
 */
function isWebpackRuntimeMissingModule(e: { name?: unknown; message?: unknown; stack?: unknown }): boolean {
  if (e.name !== 'TypeError') return false;
  if (typeof e.message !== 'string' || !/reading 'call'/.test(e.message)) return false;
  if (typeof e.stack !== 'string') return false;
  const firstFrame = e.stack.split('\n').find((l) => /^\s*at\s/.test(l)) ?? '';
  return /\/_next\/static\/chunks\/webpack-[^/]*\.js/.test(firstFrame);
}

/**
 * ── A THIRD SHAPE: A REJECTED ACTION, NOT AN UNREADABLE ONE (2026-09-25) ────
 *
 * Incident: the iOS app (a Capacitor WebView on www.setnayan.com) opened
 * /login before a production deploy had finished posting to the NEW
 * deployment. Vercel's runtime log:
 *
 *     POST /login 404 … [Error: Failed to find Server Action "40ba73…".
 *     This request might be from an older or newer deployment.]
 *
 * The person saw the generic crash card. Unlike the transport-error shape
 * above, the server never ran the action at all — it could not find it. Same
 * disease as the other two shapes (a tab older than the server), a different
 * throw site, and it does NOT match any `STALE_PATTERNS` regex above.
 *
 * Confirmed by reading Next's own source for the version pinned in
 * package.json (`node_modules/next/dist/client/components/router-reducer/
 * reducers/server-action-reducer.js`): the client checks a response header
 * BEFORE ever falling through to the generic "unexpected response" branch —
 *
 *     const unrecognizedActionHeader = res.headers.get(NEXT_ACTION_NOT_FOUND_HEADER);
 *     if (unrecognizedActionHeader === '1') {
 *       throw new UnrecognizedActionError('Server Action "' + actionId + '" was not found on the server. ...');
 *     }
 *
 * — and the server-side throw producing the Vercel log line above lives in
 * `server/app-render/action-utils.ts`'s `getActionNotFoundError`. Next ships
 * its own public discriminator for exactly this: `next/navigation`'s
 * `unstable_isUnrecognizedActionError`, documented at
 * `node_modules/next/dist/client/components/unrecognized-action-error.d.ts`
 * as "This can happen if the client and the server are not from the same
 * deployment... Reloading the page will fix this mismatch." Preferred over
 * this file's usual `name`/`message` fallback: Next owns both the throw site
 * and the check, so hand-matching would drift the moment either changes. The
 * `name === 'UnrecognizedActionError'` / message fallback below exists only
 * for a test (or a future caller) constructing the shape without importing
 * the real class.
 */
export function isDeploymentSkewError(error: unknown): boolean {
  if (unstable_isUnrecognizedActionError(error)) return true;
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: unknown; message?: unknown };
  if (e.name === 'UnrecognizedActionError') return true;
  const message = typeof e.message === 'string' ? e.message : '';
  if (!message) return false;
  return (
    /failed to find server action/i.test(message) ||
    /this request might be from an older or newer deployment/i.test(message)
  );
}

/** Where the one-shot marker lives. Session-scoped: a new tab starts fresh. */
export const STALE_RELOAD_KEY = 'setnayan:stale-bundle-reloaded';

/**
 * Where a deployment-skew reload's cause is kept ACROSS the reload, so
 * `DeferredObservability` can tell Sentry it happened once the app is back up
 * — at level 'info', never as an error, because the reload already fixed it.
 * Mirrors `STYLESHEET_FAILURE_KEY` in lib/stylesheet-recovery.ts, the sibling
 * mitigation for the CSS-never-arrived case, which established this pattern.
 */
export const DEPLOYMENT_SKEW_FAILURE_KEY = 'setnayan:deployment-skew-failure';

/**
 * Reload once to pick up the current build. Returns true when it started one.
 *
 * 🔑 ONCE, AND THE GUARD IS THE WHOLE POINT. If the error is NOT a stale bundle
 * — or the new build throws too — reloading on every failure is an infinite
 * refresh loop on a page the person cannot read or leave. That is worse than
 * the message we are replacing. The marker is cleared on any successful render,
 * so a genuine second occurrence later still gets its one reload.
 */
export function reloadForStaleBundle(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  reload: () => void,
): boolean {
  if (storage.getItem(STALE_RELOAD_KEY)) return false;
  storage.setItem(STALE_RELOAD_KEY, '1');
  reload();
  return true;
}

/**
 * Reload once for a deployment-skew error, recording why first so the report
 * survives the reload (see `DEPLOYMENT_SKEW_FAILURE_KEY` above).
 *
 * Deliberately shares `reloadForStaleBundle`'s ONE-per-session budget
 * (`STALE_RELOAD_KEY`): whichever of the two shapes a tab hits first, it gets
 * exactly one automatic reload, not one of each. A tab that reloaded once for
 * a stale SCRIPT and then, on the fresh load, still somehow posts a stale
 * ACTION should show the normal error card, not a second silent refresh.
 */
export function reloadForDeploymentSkew(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  reload: () => void,
  error: unknown,
): boolean {
  try {
    storage.setItem(
      DEPLOYMENT_SKEW_FAILURE_KEY,
      JSON.stringify({
        message: error instanceof Error ? error.message : String(error),
        path: typeof window !== 'undefined' ? window.location.pathname : '',
        at: new Date().toISOString(),
      }),
    );
  } catch {
    // Storage disabled — the reload still happens; only the report is lost.
  }
  return reloadForStaleBundle(storage, reload);
}

/**
 * ── A FOURTH SHAPE: A REQUEST THE PHONE CUT OFF (2026-10-06) ────────────────
 *
 * Incident: the owner's Maker, on his iPhone, on the Wedding March — the root
 * crash card at 01:17Z. He did nothing: he left the tab and came back. The
 * Problems list (`app_telemetry_logs`, PAGE_CRASH) recorded the ONE line:
 *
 *     TypeError: Load failed
 *
 * That is Safari's wording for a `fetch` that never finished — the request was
 * cut (a tab sent to the background suspends its connections; a deploy landed
 * at 01:15Z while a march save was still streaming its reply; the network
 * dropped). Two minutes earlier the same tab logged a march save with "no
 * answer after 15s" (BUTTON_TIMEOUT, `joinEntourageLine`). A Server Action's
 * reply carries the re-rendered page whenever the action revalidates — and the
 * march's do — so when the stream is cut mid-reply, the half-read page throws
 * the transport error INTO RENDERING, and the nearest boundary is the root.
 *
 * 🔑 NOTHING IS WRONG WITH THE EVENT, AND THE PERSON IS TOLD THE OPPOSITE. The
 * write had either landed or not; a reload shows which. Same remedy as the
 * three shapes above, the same ONE-per-session budget.
 *
 * ⚠ MATCHED EXACTLY, NEVER AS A SUBSTRING. These are the WHOLE messages each
 * engine gives a `fetch` that failed at the network — a `TypeError` with
 * nothing else in it. An application bug does not produce them; a message that
 * merely contains "failed to fetch" (a failed dynamic import, which is a stale
 * SCRIPT) is the first shape's, not this one's.
 */
const INTERRUPTED_REQUEST_MESSAGES = [
  /^load failed\.?$/i, // Safari
  /^failed to fetch\.?$/i, // Chromium
  /^networkerror when attempting to fetch resource\.?$/i, // Firefox
  /^the network connection was lost\.?$/i, // Safari, mid-stream
];

export function isInterruptedRequestError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: unknown; message?: unknown };
  if (e.name !== 'TypeError') return false;
  const message = typeof e.message === 'string' ? e.message.trim() : '';
  return INTERRUPTED_REQUEST_MESSAGES.some((p) => p.test(message));
}

/**
 * Reload once for a cut-off request — but not into an offline page: when the
 * browser says it is offline, the reload waits for it to be back (`whenOnline`).
 * Shares `STALE_RELOAD_KEY`'s one-per-session budget; the marker is written
 * before anything waits, so a second failure while waiting cannot queue a
 * second reload.
 */
export function reloadForInterruptedRequest(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  reload: () => void,
  online: boolean,
  whenOnline: (go: () => void) => void,
): boolean {
  if (storage.getItem(STALE_RELOAD_KEY)) return false;
  storage.setItem(STALE_RELOAD_KEY, '1');
  if (online) reload();
  else whenOnline(reload);
  return true;
}

/**
 * ── ONE CALL FOR EVERY ERROR BOUNDARY (Build 5 F6, 2026-11-10) ───────────────
 *
 * The three reload shapes above were wired into `app/error.tsx` (and `global-error.tsx`) ONLY. But Next hands an
 * error to the NEAREST boundary, and the supplier dashboard has its own (`app/vendor-dashboard/error.tsx`) — so the
 * exact case the webpack-runtime shape was written for (Create on a service card → `/vendor-dashboard/shop?saved=1`
 * on a tab older than the deploy) never reached the root boundary's reload. It drew the crash page, and the crash
 * fired the browser's error report + its on-error replay to Sentry's ingest, which answered **429** — the one 429 in
 * the console on that walk. A recovered stale tab sends nothing and draws no crash.
 *
 * Returns true when a reload is under way (the boundary should report nothing and draw as little as possible).
 * Same one-per-session budget (`STALE_RELOAD_KEY`) as before — a second failure shows the boundary's card.
 */
export function recoverStaleTab(error: unknown): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const storage = window.sessionStorage;
    const reload = () => window.location.reload();
    if (isDeploymentSkewError(error)) return reloadForDeploymentSkew(storage, reload, error);
    if (isStaleBundleError(error)) return reloadForStaleBundle(storage, reload);
    if (isInterruptedRequestError(error)) {
      const whenOnline = (go: () => void) => window.addEventListener('online', go, { once: true });
      return reloadForInterruptedRequest(storage, reload, navigator.onLine !== false, whenOnline);
    }
  } catch {
    // Storage refused outright: no marker means no safe one-shot, so no reload — the card shows as before.
  }
  return false;
}

/**
 * Sentry's `beforeSend` filter: a stale tab is deploy skew the boundary cures with one reload — not a bug to file,
 * and not worth an error event plus a full on-error session replay against the Sentry quota (the 429, F6).
 */
export function isRecoverableTabError(error: unknown): boolean {
  return isDeploymentSkewError(error) || isStaleBundleError(error);
}
