/**
 * lib/setup-papers.ts — STEP 5 OF A NEW SHOP'S TODAY: ONE ROW PER REQUIRED PAPER (pure — no I/O, no clock).
 *
 * Owner 7 Nov 2026 (build-sessions/PLAN-SUPPLIER-GO-LIVE-BUILD-2026-11-07.md, Track C1; prototype
 * `open-shop-redesign.html` v21 `paneDocs`): "Upload each document (one row per required paper)." Each row saves the
 * moment its file is in and says where that paper stands.
 *
 * 🔑 THE ROWS ARE `REQUIRED_DOC_SLOT_KEYS`, NEVER A HAND LIST. The four papers (owner 2026-07-03) and their words
 * live in `lib/vendor-verification.ts` `DOC_SLOTS`; a fifth required paper appears here by itself, a retired one
 * leaves by itself. 🔒 app/vendor-dashboard/_components/the-papers-and-the-qr-hold.test.ts
 *
 * 🔑 A REFUSED READ IS NEVER "NONE". The latest application is read by `loadDetailsData` with a measured flag
 * (`verifyMeasured`). Unmeasured → `null` here, and the screen says it could not load the papers — never four
 * empty rows inviting a supplier to send again what Setnayan already holds (the shape of
 * `app/vendor-dashboard/reads-are-honest.test.ts`).
 *
 * How each state is read off the LATEST application (`vendor_verification_applications`):
 *   none       nothing on file (no application, a withdrawn one, or a draft without this paper)
 *   uploaded   in the draft — saved, not sent for review yet
 *   review     sent: `pending_review` / `in_review`
 *   approved   the application was approved
 *   new_copy   Setnayan sent the papers back (`rejected`). The next upload starts a NEW draft with nothing in it
 *              (`resolveEditableDraft`), so every paper truly needs a new copy — not only the one the reason names.
 */
import {
  DOC_SLOTS,
  REQUIRED_DOC_SLOT_KEYS,
  isSlotComplete,
  type DocUpload,
  type DocUploadMap,
} from '@/lib/vendor-verification';

export type PaperState = 'none' | 'uploaded' | 'review' | 'approved' | 'new_copy';

export type SetupPaper = {
  /** `DOC_SLOTS[].key` — one of `REQUIRED_DOC_SLOT_KEYS`. */
  key: string;
  /** 1-based, among the required papers. */
  n: number;
  label: string;
  state: PaperState;
  /** The stored file (`r2_key`) while it can still be replaced — a draft's paper. Null otherwise. */
  ref: string | null;
  /** Whether a file can be added or replaced now (nothing is in review or approved). */
  editable: boolean;
};

/** The word for each state, as the row's badge says it. */
export const PAPER_STATE_WORD: Readonly<Record<PaperState, string>> = {
  none: 'Not sent yet',
  uploaded: 'Uploaded',
  review: 'Under review',
  approved: 'Approved',
  new_copy: 'Needs a new copy',
};

/** What a paper may be, as the shipped upload takes it (`verify-pairs.tsx` `PaperSide`). */
export const PAPER_MAX_MB = 15;
export const PAPER_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] as const;
/** The shipped hint's words (`DOC_SLOTS` "PDF / JPG / PNG up to 15 MB."). */
export const PAPER_FILES = 'PDF / JPG / PNG up to 15 MB';

const LOCKED = new Set(['pending_review', 'in_review', 'approved']);

function refOf(v: DocUpload): string | null {
  return v && typeof v === 'object' && !Array.isArray(v) && typeof (v as { r2_key?: unknown }).r2_key === 'string'
    ? ((v as { r2_key: string }).r2_key)
    : null;
}

/**
 * The four rows. `measured` false (the application read was refused) → null: the caller says so, never "none".
 */
export function setupPapers(input: { measured: boolean; status: string | null; uploads: DocUploadMap | null }): SetupPaper[] | null {
  if (!input.measured) return null;
  const status = input.status;
  const uploads = input.uploads ?? {};
  const editable = !(status != null && LOCKED.has(status));
  return DOC_SLOTS.filter((s) => REQUIRED_DOC_SLOT_KEYS.has(s.key)).map((slot, i) => {
    const v = uploads[slot.key];
    const present = isSlotComplete(slot.key, v);
    const state: PaperState =
      status === 'rejected'
        ? 'new_copy'
        : !present
          ? 'none'
          : status === 'pending_review' || status === 'in_review'
            ? 'review'
            : status === 'approved'
              ? 'approved'
              : status === 'draft'
                ? 'uploaded'
                : 'none';
    return {
      key: slot.key,
      n: i + 1,
      label: slot.label,
      state,
      ref: status === 'draft' && present ? refOf(v) : null,
      editable,
    };
  });
}

/** How many of the papers are in (uploaded, under review or approved) — the line's "N of 4 in". */
export function papersIn(papers: readonly SetupPaper[]): number {
  return papers.filter((p) => p.state === 'uploaded' || p.state === 'review' || p.state === 'approved').length;
}
