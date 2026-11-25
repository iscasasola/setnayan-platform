// 🧭 THE ONE WAY A FILE'S BYTES ARE KEPT IN THE PHONE'S OFFLINE DATABASE — shared by Papic's saved shots
// (`lib/papic-upload/store.ts`) and the supplier's files written offline (`lib/offline/supplier-queue.ts`, controller
// review #2: "one upload kind, reusing lib/papic-upload/store.ts").
//
// SAFARI'S PRIVATE / EPHEMERAL STORAGE REFUSES A Blob IN IndexedDB ("Error preparing Blob/File data to be stored") but
// takes the same bytes as an ArrayBuffer — measured in Playwright WebKit, 2026-10-23. So a write is tried with the Blob
// and, refused, made again with the bytes; a read gives a Blob back either way.

/** What an item's payload carries for its bytes: the Blob, or the same bytes and their type. */
export type StoredBytes = { blob: Blob } | { buffer: ArrayBuffer; type: string };

/** Write `blob` with `write` — as a Blob, or as its bytes where the browser refuses a Blob. */
export async function keepBytes<T>(blob: Blob, write: (bytes: StoredBytes) => Promise<T>): Promise<T> {
  try {
    return await write({ blob });
  } catch {
    return write({ buffer: await blob.arrayBuffer(), type: blob.type });
  }
}

/** The bytes a payload kept, as a Blob; null when it kept none. */
export function bytesBack(payload: Record<string, unknown> | null | undefined): Blob | null {
  const blob = payload?.blob;
  if (blob instanceof Blob) return blob;
  const buffer = payload?.buffer;
  if (buffer instanceof ArrayBuffer) return new Blob([buffer], { type: typeof payload?.type === 'string' ? payload.type : '' });
  return null;
}
