// lib/papic-upload/transport.ts — THE ONE PLACE bytes leave the phone.
//
// Strategy B (owner 2026-10-23) PUTs from the page with fetch. Strategy C — the
// native iPhone build's background URLSession uploader, planned for 1.1 (corpus
// ROADMAP_TO_APPLE_CHECK_2026-10-06.md: native camera + background upload come
// after Apple) — plugs in HERE: the app registers a transport whose `put` hands
// the presigned URL + bytes to the OS, which keeps sending after the app is
// backgrounded. Nothing else in the uploader changes: signing, ordering,
// records and the status chip stay exactly as they are.

export interface PutRequest {
  url: string;
  contentType: string;
  body: Blob;
  /** Aborts the PUT (the replayer sizes a timeout to the bytes). */
  signal?: AbortSignal;
}

/** ok — stored. retry — try again later (fresh signature). */
export type PutResult = { ok: true } | { ok: false; status: number | null };

export interface PapicTransport {
  /** Short name for diagnostics ('fetch', 'ios-background', …). */
  name: string;
  put(req: PutRequest): Promise<PutResult>;
}

export const fetchTransport: PapicTransport = {
  name: 'fetch',
  async put(req) {
    try {
      const res = await fetch(req.url, {
        method: 'PUT',
        // Content-Type is signed into the URL; the browser derives the signed
        // Content-Length from the Blob itself.
        headers: { 'Content-Type': req.contentType },
        body: req.body,
        signal: req.signal,
      });
      return res.ok ? { ok: true } : { ok: false, status: res.status };
    } catch {
      return { ok: false, status: null };
    }
  },
};

let current: PapicTransport = fetchTransport;

/** The native app calls this once at start (strategy C). */
export function setPapicTransport(t: PapicTransport): void {
  current = t;
}

export function papicTransport(): PapicTransport {
  return current;
}

/** A PUT gets 30 s plus time for its bytes at a slow 32 KB/s. */
export function putTimeoutMs(bytes: number): number {
  return 30_000 + Math.ceil(bytes / 32_000) * 1000;
}
