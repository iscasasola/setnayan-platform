/**
 * 🔳 THE BOOKED QR FORM KEEPS WHAT WAS TYPED WHEN GENERATE REFUSES (W1 RW-378, live 027f641).
 *
 * A refusal comes back as a redirect (`?mode=locked&error=<reason>`), and the form came back EMPTY — the supplier
 * retyped the client, the date, the quotation and the schedule, and re-uploaded the proof, to try again. Now the form
 * writes its unsent draft here as it submits, and the page that arrives with the refusal (`refused`) takes it back.
 * A visit with no refusal drops any old draft, so a stale one never fills a fresh form.
 *
 * Browser storage for a per-viewer convenience (an unsent draft) — every read and write is guarded, and the form works
 * without it. Nothing here is a record: the code is made only by `issueLockedQr`.
 *
 * 🔒 `app/vendor-dashboard/invite/the-booked-qr-reads-the-one-taxonomy.test.ts`.
 */
import type { LockedQrInitial } from '@/app/vendor-dashboard/invite/_components/locked-qr-generator';

export const LOCKED_QR_DRAFT_KEY = 'sn:locked-qr-draft';
/** A draft older than this is not "the form you just sent". */
export const LOCKED_QR_DRAFT_MAX_AGE_MS = 30 * 60 * 1000;

export type LockedQrDraft = {
  /** The outside booking the code was for, or null — a draft only comes back to the same booking. */
  blockId: string | null;
  /** The waiting code being changed, or null. */
  replaces: string | null;
  clientName: string;
  eventType: string;
  serviceRefs: string[];
  eventDate: string;
  description: string;
  contractId: string;
  total: string;
  initialPaid: string;
  schedule: { label: string; amount: string; date: string }[];
  lines: { label: string; amount: string }[];
  proofRef: string;
  remembranceRef: string;
};

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The tab's sessionStorage, or null where it cannot be reached (private mode, blocked site data, the server). */
export function draftStore(): Store | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function saveLockedQrDraft(store: Store | null, draft: LockedQrDraft, nowMs: number): void {
  if (!store) return;
  try {
    store.setItem(LOCKED_QR_DRAFT_KEY, JSON.stringify({ at: nowMs, draft }));
  } catch {
    /* full or blocked — the refusal still says what to fix */
  }
}

export function clearLockedQrDraft(store: Store | null): void {
  try {
    store?.removeItem(LOCKED_QR_DRAFT_KEY);
  } catch {
    /* nothing to clear */
  }
}

const str = (v: unknown): v is string => typeof v === 'string';

/** Take the draft back (once): only a fresh, well-formed one, for the same outside booking. */
export function takeLockedQrDraft(store: Store | null, blockId: string | null, nowMs: number): LockedQrDraft | null {
  if (!store) return null;
  let raw: string | null = null;
  try {
    raw = store.getItem(LOCKED_QR_DRAFT_KEY);
  } catch {
    return null;
  }
  clearLockedQrDraft(store);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { at?: unknown; draft?: Partial<LockedQrDraft> };
    const d = parsed.draft;
    if (typeof parsed.at !== 'number' || nowMs - parsed.at > LOCKED_QR_DRAFT_MAX_AGE_MS || !d) return null;
    if ((d.blockId ?? null) !== blockId) return null;
    const fields = [d.clientName, d.eventType, d.eventDate, d.description, d.contractId, d.total, d.initialPaid, d.proofRef, d.remembranceRef];
    if (!fields.every(str) || !Array.isArray(d.serviceRefs) || !Array.isArray(d.schedule) || !Array.isArray(d.lines)) return null;
    return {
      blockId,
      replaces: str(d.replaces) ? d.replaces : null,
      clientName: d.clientName!,
      eventType: d.eventType!,
      serviceRefs: d.serviceRefs.filter(str),
      eventDate: d.eventDate!,
      description: d.description!,
      contractId: d.contractId!,
      total: d.total!,
      initialPaid: d.initialPaid!,
      schedule: d.schedule.filter((r) => r && str(r.label) && str(r.amount) && str(r.date)),
      lines: d.lines.filter((l) => l && str(l.label) && str(l.amount)),
      proofRef: d.proofRef!,
      remembranceRef: d.remembranceRef!,
    };
  } catch {
    return null;
  }
}

/** A kept draft, read back into the shape the form already opens filled from (`initial`). */
export function lockedQrInitialFromDraft(d: LockedQrDraft): LockedQrInitial {
  return {
    replaces: d.replaces ?? '',
    clientName: d.clientName,
    eventType: d.eventType,
    eventDate: d.eventDate,
    description: d.description,
    serviceRefs: d.serviceRefs,
    contractId: d.contractId,
    total: d.total,
    initialPaid: d.initialPaid,
    schedule: d.schedule,
    lines: d.lines.map((l) => ({ label: l.label, detail: null, amount_centavos: Math.round((Number(l.amount) || 0) * 100) })),
    proofRef: d.proofRef,
    remembranceRef: d.remembranceRef,
  };
}
