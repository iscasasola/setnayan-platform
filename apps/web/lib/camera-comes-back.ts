/**
 * THE CAMERA COMES BACK — the framework-free half of `useCameraThatComesBack`.
 *
 * ── The defect (Duo + iPad audit 2026-10-19, row W4, checklist point 9) ────
 * Every camera page opened `getUserMedia` once and then trusted the stream for
 * the life of the page. iOS ends WKWebView capture when the app goes to the
 * background, and opening or closing an iPhone Duo can move the page to the
 * other camera — so the preview stayed FROZEN or BLACK, with no recovery short
 * of a reload. No page listened for the track ending, for a mute, or for the
 * page coming back. (Live Watch's camera, `panood-camera-publish.tsx`, did
 * listen for `visibilitychange` — but only to re-send its heartbeat, never to
 * reopen the camera, so it had the same frozen preview.)
 *
 * ── What this does ──────────────────────────────────────────────────────────
 * While a page has a LIVE camera, `watchCamera` listens for the four ways a
 * camera dies under the page and asks the page — once — to reopen it with its
 * own constraints (same facing, same size):
 *
 *   1. the page comes back (`visibilitychange` → visible, after being hidden);
 *   2. a video track ends (`ended`);
 *   3. a video track stays muted past `CAMERA_MUTE_GRACE_MS` while visible
 *      (a short mute is the system borrowing the camera; it often comes back);
 *   4. the window turns (portrait ↔ landscape) or its WIDTH moves by
 *      `CAMERA_RESIZE_WIDTH_RATIO` or more — the Duo opening or closing. A
 *      height-only change never counts: that is an on-screen keyboard.
 *
 * Rules it keeps:
 *   · NEVER DOUBLE-OPENS. One request per live session; every later trigger is
 *     ignored until the page re-arms the watch (by going not-live → live again).
 *   · NEVER WHILE HIDDEN. iOS refuses `getUserMedia` in the background, so a
 *     trigger while hidden waits for the page to come back.
 *   · NEVER MID-TAKE. While `isHeld()` is true (a clip is recording, a take is
 *     being reviewed or uploaded) the request waits and runs when it clears —
 *     a restart is NOT a new shot and must never cut, post or charge one.
 *   · NEVER A TIGHT LOOP. A camera that dies within `CAMERA_QUICK_DEATH_MS` of
 *     opening is a "quick death"; after `CAMERA_RESTART_LIMIT` of those inside
 *     `CAMERA_RESTART_WINDOW_MS` it waits for the window to free instead of
 *     giving up, so a camera that keeps dying is retried, slowly. A camera that
 *     lived longer resets the count — turning a phone back and forth, or coming
 *     back from the home screen five times, is never throttled.
 *
 * The page's `restart` is its OWN open path (stop the old tracks, show its
 * shipped "starting the camera" state, open with the same constraints). This
 * module never calls `getUserMedia` itself.
 *
 * Kept free of React and the DOM globals so it runs under `node:test` with a
 * fake document / window / track (see `camera-comes-back.test.ts`).
 */

/** A short mute is the OS borrowing the camera; only a lasting one is dead. */
export const CAMERA_MUTE_GRACE_MS = 1200;
/** Resize events arrive in bursts while a window or a Duo moves — let it settle. */
export const CAMERA_RESIZE_SETTLE_MS = 350;
/** A width move this large (or any portrait ↔ landscape turn) reopens the camera. */
export const CAMERA_RESIZE_WIDTH_RATIO = 0.25;
/** While held, how often to look whether the take has finished. */
export const CAMERA_HOLD_POLL_MS = 400;
/** A camera that dies sooner than this after opening died "young" … */
export const CAMERA_QUICK_DEATH_MS = 2_000;
/** … and after this many young deaths in a row … */
export const CAMERA_RESTART_LIMIT = 3;
/** … inside this window, the next reopen waits for the window to free. */
export const CAMERA_RESTART_WINDOW_MS = 30_000;
/**
 * If the page has not re-armed the watch this long after a request (its
 * restart did not toggle `live`), the watch re-arms itself on whatever stream
 * the page now holds, so one missed answer can never switch recovery off.
 */
export const CAMERA_RESTART_ANSWER_MS = 10_000;

export type CameraRestartReason = 'visible' | 'ended' | 'muted' | 'resize';

type Listener = () => void;
export interface EventTargetLike {
  addEventListener(type: string, listener: Listener): void;
  removeEventListener(type: string, listener: Listener): void;
}
export interface TrackLike extends EventTargetLike {
  readonly readyState: string;
  readonly muted: boolean;
}
export interface StreamLike {
  getVideoTracks(): TrackLike[];
}

export interface KeepAliveEnv {
  doc: EventTargetLike & { readonly hidden: boolean };
  win: EventTargetLike & { readonly innerWidth: number; readonly innerHeight: number };
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  now: () => number;
}

export type WatchCameraOptions = {
  /** The stream the page is showing right now. */
  getStream: () => StreamLike | null;
  /** The page's own reopen path. Called at most once per watch. */
  restart: (reason: CameraRestartReason) => void;
  /** True while a reopen would destroy work (recording, review, upload). */
  isHeld: () => boolean;
  /**
   * Timestamps of recent quick deaths, shared across watches of one page so
   * the loop limit survives the re-arm that every restart causes. Mutated in
   * place.
   */
  history: number[];
  env?: KeepAliveEnv;
};

function browserEnv(): KeepAliveEnv | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  return {
    doc: document,
    win: window,
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (h) => window.clearTimeout(h as number),
    now: () => Date.now(),
  };
}

/** Did the window turn, or did its width move far enough to be another screen? */
export function isCameraScreenChange(
  from: { width: number; height: number },
  to: { width: number; height: number },
): boolean {
  if (from.width <= 0 || from.height <= 0) return false;
  const turned = from.width > from.height !== to.width > to.height;
  const widthMoved = Math.abs(to.width - from.width) / from.width >= CAMERA_RESIZE_WIDTH_RATIO;
  return turned || widthMoved;
}

/**
 * Watch ONE live camera session. Call when the page's camera goes live; call
 * the returned function when it stops being live (or the page unmounts).
 */
export function watchCamera(opts: WatchCameraOptions): () => void {
  const env = opts.env ?? browserEnv();
  if (!env) return () => {};
  const { doc, win } = env;

  let done = false; // this watch is over (disposed)
  let requested = false; // asked the page to reopen; ignore everything else
  let pending: CameraRestartReason | null = null;
  let sawHidden = doc.hidden;
  let armedAt = env.now();
  let base = { width: win.innerWidth, height: win.innerHeight };

  let muteTimer: unknown = null;
  let resizeTimer: unknown = null;
  let holdTimer: unknown = null;
  let limitTimer: unknown = null;
  let answerTimer: unknown = null;

  const clear = (h: unknown) => {
    if (h != null) env.clearTimeout(h);
  };

  let trackOff: Array<() => void> = [];
  const detachTracks = () => {
    for (const off of trackOff) off();
    trackOff = [];
    clear(muteTimer);
    muteTimer = null;
  };

  const fire = (reason: CameraRestartReason) => {
    requested = true;
    pending = null;
    detachTracks(); // stopping the old tracks must not echo back as 'ended'
    if (env.now() - armedAt < CAMERA_QUICK_DEATH_MS) opts.history.push(env.now());
    else opts.history.length = 0; // it lived — a fresh streak
    // Re-arm on our own if the page never answers (see CAMERA_RESTART_ANSWER_MS).
    answerTimer = env.setTimeout(() => {
      answerTimer = null;
      if (done) return;
      requested = false;
      armedAt = env.now();
      base = { width: win.innerWidth, height: win.innerHeight };
      attachTracks();
    }, CAMERA_RESTART_ANSWER_MS);
    opts.restart(reason);
  };

  const request = (reason: CameraRestartReason) => {
    if (done || requested) return;
    pending = pending ?? reason;
    if (doc.hidden) return; // runs on the way back (visibilitychange)
    if (opts.isHeld()) {
      if (holdTimer == null) {
        const poll = () => {
          holdTimer = null;
          if (done || requested || pending == null) return;
          if (!doc.hidden && !opts.isHeld()) request(pending);
          else holdTimer = env.setTimeout(poll, CAMERA_HOLD_POLL_MS);
        };
        holdTimer = env.setTimeout(poll, CAMERA_HOLD_POLL_MS);
      }
      return;
    }
    const now = env.now();
    const recent = opts.history.filter((t) => now - t < CAMERA_RESTART_WINDOW_MS);
    opts.history.splice(0, opts.history.length, ...recent);
    const young = now - armedAt < CAMERA_QUICK_DEATH_MS;
    if (young && recent.length >= CAMERA_RESTART_LIMIT) {
      // Too many in a row — wait for the oldest to leave the window, then retry.
      if (limitTimer == null) {
        const wait = CAMERA_RESTART_WINDOW_MS - (now - recent[0]!) + 1;
        limitTimer = env.setTimeout(() => {
          limitTimer = null;
          if (pending != null) request(pending);
        }, wait);
      }
      return;
    }
    fire(pending);
  };

  const attachTracks = () => {
    detachTracks();
    const tracks = opts.getStream()?.getVideoTracks() ?? [];
    for (const track of tracks) {
      const onEnded = () => request('ended');
      const onMute = () => {
        clear(muteTimer);
        muteTimer = env.setTimeout(() => {
          muteTimer = null;
          if (track.muted && !doc.hidden) request('muted');
        }, CAMERA_MUTE_GRACE_MS);
      };
      const onUnmute = () => {
        clear(muteTimer);
        muteTimer = null;
      };
      track.addEventListener('ended', onEnded);
      track.addEventListener('mute', onMute);
      track.addEventListener('unmute', onUnmute);
      trackOff.push(() => {
        track.removeEventListener('ended', onEnded);
        track.removeEventListener('mute', onMute);
        track.removeEventListener('unmute', onUnmute);
      });
    }
    // A track that died before we got here is already dead — do not wait for
    // an event that has been and gone.
    if (tracks.some((t) => t.readyState === 'ended')) request('ended');
    else if (tracks.some((t) => t.muted)) {
      const first = tracks.find((t) => t.muted)!;
      muteTimer = env.setTimeout(() => {
        muteTimer = null;
        if (first.muted && !doc.hidden) request('muted');
      }, CAMERA_MUTE_GRACE_MS);
    }
  };

  const onVisibility = () => {
    if (doc.hidden) {
      sawHidden = true;
      clear(muteTimer); // muting while hidden is expected, not a death
      muteTimer = null;
      return;
    }
    if (sawHidden || pending != null) {
      sawHidden = false;
      request(pending ?? 'visible');
    }
  };

  const onResize = () => {
    clear(resizeTimer);
    resizeTimer = env.setTimeout(() => {
      resizeTimer = null;
      const now = { width: win.innerWidth, height: win.innerHeight };
      if (isCameraScreenChange(base, now)) {
        base = now;
        request('resize');
      }
    }, CAMERA_RESIZE_SETTLE_MS);
  };

  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('resize', onResize);
  win.addEventListener('orientationchange', onResize);
  attachTracks();

  return () => {
    done = true;
    detachTracks();
    doc.removeEventListener('visibilitychange', onVisibility);
    win.removeEventListener('resize', onResize);
    win.removeEventListener('orientationchange', onResize);
    clear(resizeTimer);
    clear(holdTimer);
    clear(limitTimer);
    clear(answerTimer);
  };
}
