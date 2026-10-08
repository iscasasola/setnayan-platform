/**
 * apps/web/lib/upload-send.ts — ONE FILE, DEVICE → STORAGE: SIGN IT, PUT IT, AND ALWAYS END.
 *
 * `<FileUpload>` used to hold this inline (ask `/api/upload` for a presigned URL, PUT the bytes with XHR for its
 * progress events). Lifted out, unchanged in what it sends, for two reasons:
 *
 *   1. EVERY RUN ENDS, AND SAYS HOW. Owner, 2026-10-08, on Studio › Love Story's photo slots: *"it does not
 *      upload"* — with a picture of a tile stuck at "0%" beside a spinner. A failure that looks like "still working"
 *      is the one disease this codebase keeps curing. `done` settles EXACTLY ONCE with one of five answers — it
 *      landed, the server refused it, the network failed, nothing moved for too long, or the person stopped it — so a
 *      caller cannot be left holding a spinner. The one silence the inline version still had is closed here: the
 *      SIGNING request had no clock at all, so a presign that never answered spun for ever.
 *   2. IT CAN BE RUN WITHOUT A BROWSER. `fetch`, `XMLHttpRequest` and the timers are handed in, so the test drives
 *      the real control flow against a 503, a thrown network error and a request that never answers
 *      (`lib/a-refused-upload-says-so.test.ts`) — the runner has no DOM, so this could not be asked of the component.
 *
 * `<FileUpload>` loads this file at the first upload (`await import`), so none of it — nor the watchdog — rides the
 * first load of a page that merely shows an uploader (the Maker's first-load budget).
 *
 * No React. No state. Nothing here decides what a failure LOOKS like — only that it is always reported.
 */
import { createStallWatchdog, type WatchdogTimers } from './stall-watchdog';

export type UploadJob = {
  file: File;
  /** The bucket key `/api/upload` takes ("media", "thread-files", …). */
  bucket: string;
  pathPrefix: string;
  contentType: string;
};

/**
 * Why a file did not land.
 *   refused   — a server answered, and the answer was no (the signer, or storage itself)
 *   network   — the request could not be made or broke (offline, DNS, a dropped connection)
 *   stalled   — nothing moved for `stallMs` (or storage never answered within `responseMs`)
 *   cancelled — the person stopped it
 */
export type UploadFailureKind = 'refused' | 'network' | 'stalled' | 'cancelled';

export type UploadOutcome =
  | { ok: true; r2Ref: string; displayUrl: string }
  | {
      ok: false;
      kind: UploadFailureKind;
      /** Which request failed: the signing, or the PUT of the bytes. */
      step: 'presign' | 'put';
      /** The server's own words, when it gave any (the signer's `{ error }`). */
      says: string | null;
      /** The HTTP status, when a server answered. */
      status: number | null;
      /** What was thrown, for the Problems list — never shown to a person. */
      error?: unknown;
    };

export type UploadHooks = {
  /** How long nothing may move — the signing request unanswered, or the PUT moving zero bytes — before it is dead. */
  stallMs: number;
  /** How long storage may take to ANSWER once every byte is handed over (a separate clock; see `file-upload.tsx`). */
  responseMs: number;
  /** 0–100, measured from the PUT itself. Never invented: no figure is given while only the signing is under way. */
  onProgress?: (pct: number) => void;
  /** A stall was declared (either step) — told once, before `done` settles. For the Problems list. */
  onStall?: () => void;
};

/** What the run talks to. Production passes nothing and gets the browser's. */
export type UploadEnv = {
  fetch?: typeof fetch;
  XMLHttpRequest?: typeof XMLHttpRequest;
  timers?: WatchdogTimers;
};

export type UploadRun = {
  /** Settles ONCE, always — never rejects. */
  done: Promise<UploadOutcome>;
  /** Settles when the bytes are on their way (the PUT is sent) or the run has already ended. Never rejects. */
  sent: Promise<void>;
  /** The person stopped it — works during the signing too. */
  cancel: () => void;
};

/** A function with this shape can stand in for storage (the dev lab's does; nothing in production passes one). */
export type UploadSend = (job: UploadJob, hooks: UploadHooks, env?: UploadEnv) => UploadRun;

export const sendToStorage: UploadSend = (job, hooks, env = {}) => {
  const doFetch = env.fetch ?? globalThis.fetch;
  const Xhr = env.XMLHttpRequest ?? globalThis.XMLHttpRequest;
  const { file, bucket, pathPrefix, contentType } = job;

  let settled = false;
  let settle!: (out: UploadOutcome) => void;
  let markSent!: () => void;
  const done = new Promise<UploadOutcome>((resolve) => (settle = resolve));
  const sent = new Promise<void>((resolve) => (markSent = resolve));
  /** What "stop" means right now — the signing's abort, then the PUT's. */
  let stopNow: () => void = () => {};
  /** The clock of the step under way — settled with the run, so it can never fire after the answer. */
  let clock: { settle: () => void } | null = null;

  /** THE ONE EXIT. Every path below ends here, and only the first call counts. */
  const finish = (out: UploadOutcome) => {
    if (settled) return;
    settled = true;
    clock?.settle();
    settle(out);
    markSent();
  };
  const stalled = (step: 'presign' | 'put') => {
    if (settled) return;
    hooks.onStall?.();
    finish({ ok: false, kind: 'stalled', step, says: null, status: null });
  };

  // ── Step 1 · the signing ───────────────────────────────────────────────────
  // 🔑 IT HAS A CLOCK. Before this file the signing was a bare `await fetch` — a request that never answered left
  // the tile at 0% beside a spinner for ever, with nothing that could ever end it.
  const abort = typeof AbortController === 'function' ? new AbortController() : null;
  const signing = createStallWatchdog({
    timeoutMs: hooks.stallMs,
    timers: env.timers,
    onStall: () => {
      stalled('presign');
      abort?.abort();
    },
  });
  clock = signing;
  stopNow = () => {
    finish({ ok: false, kind: 'cancelled', step: 'presign', says: null, status: null });
    abort?.abort();
  };
  signing.arm();

  void (async () => {
    let presign: { uploadUrl: string; r2Ref: string; displayUrl: string };
    try {
      const res = await doFetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket, pathPrefix, filename: file.name, contentType, sizeBytes: file.size }),
        signal: abort?.signal,
      });
      if (settled) return;
      // A refusal may carry no JSON at all (a proxy's HTML page): it is still a refusal, with its status.
      const data = (await res.json().catch(() => null)) as
        | { uploadUrl?: unknown; r2Ref?: unknown; displayUrl?: unknown; error?: unknown }
        | null;
      if (settled) return;
      const said = data && typeof data.error === 'string' ? data.error : null;
      if (!res.ok || said !== null || !data || typeof data.uploadUrl !== 'string' || typeof data.r2Ref !== 'string') {
        return finish({ ok: false, kind: 'refused', step: 'presign', says: said, status: res.status });
      }
      presign = { uploadUrl: data.uploadUrl, r2Ref: data.r2Ref, displayUrl: typeof data.displayUrl === 'string' ? data.displayUrl : '' };
    } catch (error) {
      return finish({ ok: false, kind: 'network', step: 'presign', says: null, status: null, error });
    }
    signing.settle();

    // ── Step 2 · PUT the bytes (XHR rather than fetch, for `upload.onprogress`) ──
    const xhr = new Xhr();

    // STALL WATCHDOG. Every other failure below announces itself with an event — `error`, `abort`, a non-2xx
    // `load`. A transfer that simply DIES fires none of them. XHR's own `xhr.timeout` is the wrong instrument: it
    // caps TOTAL duration, so it would kill a slow-but-healthy large file. This one measures SILENCE — it is reset
    // by every progress event, so it only fires when no byte has moved for `stallMs`.
    const watchdog = createStallWatchdog({
      timeoutMs: hooks.stallMs,
      timers: env.timers,
      onStall: () => {
        // Said FIRST, so the `abort` event the next line fires cannot be read as "the person stopped it".
        stalled('put');
        try {
          xhr.abort();
        } catch {
          /* already dead — nothing left to stop */
        }
      },
    });
    clock = watchdog;
    stopNow = () => {
      finish({ ok: false, kind: 'cancelled', step: 'put', says: null, status: null });
      try {
        xhr.abort();
      } catch {
        /* already dead */
      }
    };

    // Every byte is now on the network stack. No further upload-progress event can fire, so hand the clock over to
    // the response budget rather than leaving the transfer clock armed against a wait it cannot measure.
    xhr.upload.addEventListener('loadend', () => {
      watchdog.arm(hooks.responseMs);
    });
    xhr.upload.addEventListener('progress', (evt) => {
      // Re-armed BEFORE the computable check: bytes moved either way, which is the only thing this clock measures.
      watchdog.arm();
      if (!evt.lengthComputable || settled) return;
      hooks.onProgress?.(Math.round((evt.loaded / evt.total) * 100));
    });
    xhr.addEventListener('error', () => finish({ ok: false, kind: 'network', step: 'put', says: null, status: null }));
    xhr.addEventListener('abort', () => finish({ ok: false, kind: 'cancelled', step: 'put', says: null, status: null }));
    xhr.addEventListener('load', () => {
      // R2 returns 200 OR 201 on success — anything 2xx is a win.
      if (xhr.status >= 200 && xhr.status < 300) finish({ ok: true, r2Ref: presign.r2Ref, displayUrl: presign.displayUrl });
      else finish({ ok: false, kind: 'refused', step: 'put', says: null, status: xhr.status });
    });

    try {
      xhr.open('PUT', presign.uploadUrl, true);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.send(file);
    } catch (error) {
      return finish({ ok: false, kind: 'network', step: 'put', says: null, status: null, error });
    }
    // Armed here too, so a request that never connects at all is caught — not only one that starts and then stops.
    watchdog.arm();
    markSent();
  })();

  return { done, sent, cancel: () => stopNow() };
};

/**
 * WHAT THE UPLOADER DOES WITH AN ENDING — the whole table, in one place:
 *   landed  — the file joins the value (the ONLY ending that does)
 *   stopped — the person stopped it: its tile goes, and nothing is said
 *   tile    — it did not upload and the caller keeps failures as tiles (`failedSays`): a tile that says so, with
 *             Try again and ✕
 *   line    — it did not upload: the uploader's one line says why
 * A failure is never `landed`, and never `stopped` (silence) — whatever its cause.
 */
export type UploadEnding = 'landed' | 'stopped' | 'tile' | 'line';
export function uploadEnding(out: UploadOutcome, keepsFailed: boolean): UploadEnding {
  if (out.ok) return 'landed';
  if (out.kind === 'cancelled') return 'stopped';
  return keepsFailed ? 'tile' : 'line';
}

/**
 * The line `<FileUpload>` has always shown for a failure — the same words, per cause, now in one place. Null for a
 * stop the person asked for (nothing to say). `name` is the file as the person picked it.
 */
export function uploadProblemLine(out: UploadOutcome, name: string): string | null {
  if (out.ok || out.kind === 'cancelled') return null;
  if (out.kind === 'stalled') return `${name} stopped uploading — check your connection and pick it again.`;
  if (out.step === 'presign') {
    if (out.kind === 'refused') return out.says ?? `Presign failed (${out.status})`;
    return out.error instanceof Error ? out.error.message : 'Network error.';
  }
  if (out.kind === 'refused') return `R2 rejected ${name} (status ${out.status}). Try a different file or contact support.`;
  return `Upload failed for ${name}. Check your connection and retry.`;
}

/**
 * Did the SERVER explain a refusal in words meant for the person who picked the file (too large, the wrong kind, the
 * allowance is full)? Those words are worth showing beside "Couldn't upload this photo." — a 5xx's are the
 * operator's, and are not.
 */
export function uploadRefusalReason(out: UploadOutcome): string | null {
  if (out.ok || out.kind !== 'refused' || out.step !== 'presign') return null;
  return out.says && out.status !== null && out.status >= 400 && out.status < 500 ? out.says : null;
}
