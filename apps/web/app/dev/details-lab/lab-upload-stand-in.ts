/**
 * 🧪 THE LAB'S STAND-IN FOR STORAGE (DEV-ONLY — `/dev/maker-lab`, which refuses production).
 *
 * Owner, 2026-10-08, on Studio › Love Story in the lab: *"it does not upload"*. The lab is his only way to see that
 * page, and a lab has no file storage — so there an upload could never succeed, and he could never see a photo land,
 * its figure, Done held while it is on its way, or the square's count go up.
 *
 * This stands in for `sendToStorage` (`lib/upload-send.ts`, the same shape) so the REAL uploader, the REAL slots and
 * the REAL row run on a photo he picks. EXACTLY what it fakes — everything else on screen is the shipped code:
 *   · NO REQUEST IS MADE. Nothing is signed, nothing is sent; the file never leaves the browser.
 *   · THE PHOTO is kept in the browser's memory (an object URL). A reload forgets it.
 *   · THE REF is made up (`r2://setnayan-media/events/lab/love-story/…`) — nothing exists at it.
 *   · THE FIGURE is a timer (six steps, under two seconds), NOT measured bytes.
 *   · NOTHING IS SCREENED — the server's photo check does not run.
 * So the failures can be looked at too, by the file's NAME:
 *   · a name starting `fail`  → refused, as a server's 503 would be;
 *   · a name starting `stall` → moves nothing, and is given up on after the slots' own wait.
 *
 * Reached only through the Love Story slots' `SlotsUploadStandIn`, which only the lab provides
 * (`lib/the-lab-can-upload.test.ts`). No React here, so that test runs it with hand-turned timers.
 */
import type { UploadOutcome, UploadSend } from '@/lib/upload-send';

/** The figures the lab shows, in order — a few steps, ending at 100. */
export const LAB_UPLOAD_STEPS = [8, 27, 49, 68, 86, 100] as const;
/** The pause before each step. */
export const LAB_UPLOAD_STEP_MS = 260;
/** Where the made-up refs sit — the fixture's own two photos are here too. */
export const LAB_REF_PREFIX = 'r2://setnayan-media/events/lab/love-story/';

type Timers = { setTimeout: (fn: () => void, ms: number) => unknown; clearTimeout: (handle: unknown) => void };
const REAL: Timers = { setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms), clearTimeout: (h) => globalThis.clearTimeout(h as never) };

export function labUploadStandIn(
  /** A photo "landed": its made-up ref and where the browser holds it — the lab adds it to the pictures it can draw. */
  onLanded: (ref: string, url: string) => void,
  env: { timers?: Timers; urlOf?: (file: File) => string } = {},
): UploadSend {
  const timers = env.timers ?? REAL;
  const urlOf = env.urlOf ?? ((file: File) => URL.createObjectURL(file));
  let seq = 0;
  return ({ file }, hooks) => {
    let ended = false;
    let handle: unknown;
    let settle!: (out: UploadOutcome) => void;
    const done = new Promise<UploadOutcome>((resolve) => (settle = resolve));
    const finish = (out: UploadOutcome) => {
      if (ended) return;
      ended = true;
      timers.clearTimeout(handle);
      settle(out);
    };
    const name = file.name.toLowerCase();
    if (name.startsWith('stall')) {
      handle = timers.setTimeout(() => finish({ ok: false, kind: 'stalled', step: 'put', says: null, status: null }), hooks.stallMs);
    } else {
      let i = 0;
      const step = () => {
        if (ended) return;
        if (name.startsWith('fail') && i === 1) return finish({ ok: false, kind: 'refused', step: 'presign', says: null, status: 503 });
        if (i < LAB_UPLOAD_STEPS.length) {
          hooks.onProgress?.(LAB_UPLOAD_STEPS[i]!);
          i += 1;
          handle = timers.setTimeout(step, LAB_UPLOAD_STEP_MS);
          return;
        }
        const ext = /\.(png|webp)$/.exec(name)?.[1] ?? 'jpg';
        const ref = `${LAB_REF_PREFIX}picked-${(seq += 1)}.${ext}`;
        const url = urlOf(file);
        onLanded(ref, url);
        finish({ ok: true, r2Ref: ref, displayUrl: url });
      };
      handle = timers.setTimeout(step, LAB_UPLOAD_STEP_MS);
    }
    return {
      done,
      sent: Promise.resolve(),
      cancel: () => finish({ ok: false, kind: 'cancelled', step: 'put', says: null, status: null }),
    };
  };
}
