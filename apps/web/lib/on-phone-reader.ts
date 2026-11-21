/**
 * lib/on-phone-reader.ts — THE ONE on-phone picture reader (Tesseract.js).
 *
 * Owner, 17 Nov 2026: *"can we create our own in app reader so we do not need
 * ai to run?"* → *"Yes, swap it in"*. Moved here from #7924's
 * `received-drop-tile.tsx` so the admin's BDO drop, the buyer's "Upload Payment
 * Receipt" (/pay and the couple checkout drawer) and the admin's "Read it again"
 * all run the SAME reader at the SAME pinned versions. Do not fork it.
 *
 * 🔒 THE PICTURE NEVER LEAVES THE DEVICE FOR READING. Tesseract runs in a web
 * worker on the phone; only the TEXT it produced is ever posted, and plain code
 * (`lib/payment-proof-scan.ts`) decides what that text says. No outside AI.
 *
 * 📦 LAZY BY CONSTRUCTION. `tesseract.js` is only ever reached through the
 * dynamic `import()` below, so nothing of it lands in a page's first-load
 * bundle. The engine files (worker, wasm core, English data) come from
 * cdn.jsdelivr.net — already in the CSP for MediaPipe — at PINNED versions, so
 * a CDN update can never change what runs. They are cached after first use.
 *
 * ⛔ IT ONLY READS. Whatever it returns is advisory text. Nothing here, and
 * nothing that consumes it, approves, rejects or promotes a payment.
 */

/** Pinned. Changing a version changes what the reader sees — re-measure the samples. */
export const ON_PHONE_READER_PATHS = {
  workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',
  corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0',
  langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int',
} as const;

/** What the server records as the `model` of an on-phone read. */
export const ON_PHONE_READER_NAME = 'tesseract.js@7.0.0 (on the phone)';

/**
 * The most text any one picture may post. A receipt is a few hundred
 * characters; this is request size, not a judgement (= #7924's per-text cap).
 */
export const ON_PHONE_TEXT_MAX = 4000;

type Picture = File | Blob | string;

/**
 * Read many pictures with ONE worker. A picture that fails to read comes back
 * as '' — the caller decides what an empty read means (for the admin drop, an
 * "unreadable" row that is still counted).
 */
export async function readOnThisPhone(
  pictures: Picture[],
  onProgress?: (done: number) => void,
): Promise<string[]> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, ON_PHONE_READER_PATHS);
  const texts: string[] = [];
  try {
    for (const picture of pictures) {
      onProgress?.(texts.length + 1);
      try {
        const { data } = await worker.recognize(picture);
        texts.push(data.text ?? '');
      } catch {
        texts.push('');
      }
    }
  } finally {
    await worker.terminate();
  }
  return texts;
}

export type OnePhoneRead =
  | { status: 'ok'; text: string; ms: number }
  | { status: 'failed'; text: ''; ms: number };

type Worker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;

/**
 * ONE warm worker per page, for single reads. The engine (≈6.7 MB: wasm core +
 * English data) is the slow part of a FIRST use — measured 34 s on Slow 4G with
 * a 4×-slower CPU, 0.2 s once cached — so the proof step starts it the moment
 * it opens (`warmOnPhoneReader`), while the buyer is still finding their
 * screenshot, instead of after they pick it.
 */
let warm: Promise<Worker> | null = null;

function oneWorker(): Promise<Worker> {
  if (!warm) {
    warm = import('tesseract.js')
      .then(({ createWorker }) => createWorker('eng', 1, ON_PHONE_READER_PATHS))
      .catch((e) => {
        warm = null; // let the next attempt try again (signal back, CDN back)
        throw e;
      });
  }
  return warm;
}

/** Start loading the reader now. Never throws; a failure surfaces on the read. */
export function warmOnPhoneReader(): void {
  oneWorker().catch(() => undefined);
}

/**
 * Read ONE picture. Never throws: a reader that cannot load (offline, CDN
 * blocked, an old phone without wasm) is `failed`, which every caller draws as
 * a failure and never as an empty receipt.
 */
export async function readOnePictureOnThisPhone(picture: Picture): Promise<OnePhoneRead> {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const elapsed = () =>
    Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - started);
  try {
    const worker = await oneWorker();
    const { data } = await worker.recognize(picture);
    return { status: 'ok', text: (data.text ?? '').slice(0, ON_PHONE_TEXT_MAX), ms: elapsed() };
  } catch {
    return { status: 'failed', text: '', ms: elapsed() };
  }
}
