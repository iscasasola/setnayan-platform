/**
 * lib/pick-load.ts — HOW MUCH OF A PICKED FILE HAS ARRIVED. MEASURED, NEVER INVENTED.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9, "Style card while a file loads"):
 * *"when pressed. show a loading screen 0-100 pie to know how long til it uploads"* —
 * and his *"yes"* to the controller's limit: a pie ONLY where progress is really
 * measured; a plain save shows its words and never a percentage.
 *
 * So every number here is read off something the pick was ALREADY doing — no
 * request is added to learn it:
 *   · a PICTURE (a scene, their photo): the colour read's own `fetch`, read as a
 *     stream — bytes so far over the `Content-Length` the server sent
 *     (`readBlobWithProgress`);
 *   · a FILM: `buffered` over `duration` of the very `<video>` that will play on
 *     the sample screen (`filmLoadPct`, told through `createFilmLoads`);
 *   · an UPLOAD: `FileUpload`'s own figure (`xhr.upload` progress), handed up as is.
 *
 * 🔑 NO TOTAL, NO PIE. A response with no `Content-Length`, a compressed one (its
 * length counts other bytes than the stream yields), a film whose duration is not
 * known yet: the answer is `null`, and the card shows no percentage at all.
 *
 * Pure (the fetch reader takes a `Response`; the film store takes plain numbers).
 * Held by `lib/a-loading-pick-is-honest.test.ts`.
 */

/** 0–100, whole, never 100 before every byte is in — or null where there is no total to measure against. */
export function loadPct(loaded: number, total: number | null | undefined): number | null {
  if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0) return null;
  if (!Number.isFinite(loaded) || loaded <= 0) return 0;
  if (loaded >= total) return 100;
  return Math.min(99, Math.floor((loaded / total) * 100));
}

/** The total a response promises for the bytes its stream will yield — null when it promises none we can trust. */
export function responseTotal(headers: { get(name: string): string | null }): number | null {
  const encoding = (headers.get('content-encoding') ?? '').trim().toLowerCase();
  /* A compressed body: `Content-Length` counts the wire, the stream yields the unpacked bytes — two different sums. */
  if (encoding && encoding !== 'identity') return null;
  const raw = headers.get('content-length');
  if (raw === null || !/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

/**
 * The response's bytes as a Blob, telling how much has arrived on the way. `onPct(null)` = this file cannot be
 * measured (the body is then read whole, as before). The SAME request the caller made — nothing is asked twice.
 */
export async function readBlobWithProgress(res: Response, onPct: (pct: number | null) => void): Promise<Blob> {
  const total = responseTotal(res.headers);
  if (total === null || !res.body) {
    onPct(null);
    return res.blob();
  }
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let loaded = 0;
  onPct(0);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    parts.push(value);
    loaded += value.byteLength;
    onPct(loadPct(loaded, total));
  }
  return new Blob(parts as BlobPart[], { type: res.headers.get('content-type') ?? '' });
}

/** `video.buffered` — only what is read of it. */
export type BufferedLike = { length: number; end(index: number): number };

/** How much of a film is in: the furthest second buffered over its length — null until the length is known. */
export function filmLoadPct(buffered: BufferedLike | null | undefined, duration: number): number | null {
  if (!Number.isFinite(duration) || duration <= 0) return null;
  let end = 0;
  const n = buffered?.length ?? 0;
  for (let i = 0; i < n; i += 1) end = Math.max(end, buffered!.end(i));
  return loadPct(end, duration);
}

/** What the sample's `<video>` says of the film it holds: how much is in, and whether it has what it needs to be the background. */
export type FilmLoad = {
  pct: number | null;
  /** It MOVES — or it never will here (reduced motion, a refused play, a film that failed: its still stands). Nothing more to wait for. */
  ready: boolean;
};

/**
 * The films on their way, by address. The element that plays a film TELLS (`tell`); the pick that waits for it
 * HEARS (`wait`). `begin` forgets what was known of an address — a pick starts it afresh, so an old "ready" from the
 * last time this film was worn can never let a new pick through.
 */
export function createFilmLoads() {
  const loads = new Map<string, FilmLoad>();
  const ears = new Map<string, Set<(l: FilmLoad) => void>>();
  return {
    begin(src: string): void {
      loads.delete(src);
    },
    tell(src: string | null | undefined, load: FilmLoad): void {
      if (!src) return;
      loads.set(src, load);
      for (const hear of [...(ears.get(src) ?? [])]) hear(load);
    },
    read: (src: string): FilmLoad | null => loads.get(src) ?? null,
    /**
     * Resolves TRUE once the film is ready, FALSE when `signal` aborts first (the pick was cancelled). `onPct` hears
     * every figure on the way. No timer, no poll: it only ever answers a `tell`.
     */
    wait(src: string, onPct: (pct: number | null) => void, signal: AbortSignal): Promise<boolean> {
      return new Promise<boolean>((resolve) => {
        if (signal.aborted) return resolve(false);
        const mine = ears.get(src) ?? new Set<(l: FilmLoad) => void>();
        ears.set(src, mine);
        const leave = () => {
          mine.delete(hear);
          if (mine.size === 0) ears.delete(src);
          signal.removeEventListener('abort', gone);
        };
        const hear = (l: FilmLoad) => {
          onPct(l.pct);
          if (!l.ready) return;
          leave();
          resolve(true);
        };
        const gone = () => {
          leave();
          resolve(false);
        };
        mine.add(hear);
        signal.addEventListener('abort', gone);
        const known = loads.get(src);
        if (known) hear(known);
      });
    },
    /** Picks still waiting on an address — the test's probe. */
    waiting: (src: string) => ears.get(src)?.size ?? 0,
  };
}

const shared = createFilmLoads();
export const beginFilmLoad = shared.begin;
export const tellFilmLoad = shared.tell;
export const waitFilmLoad = shared.wait;
