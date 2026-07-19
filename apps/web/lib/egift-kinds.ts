/**
 * apps/web/lib/egift-kinds.ts
 *
 * Pabuya e-gift RAIL METADATA — the five kinds a couple can add as an e-gift
 * destination (matching the migration's method_kind CHECK). Pure data + label
 * helpers ONLY — no 'server-only', no server imports — so both the client
 * dashboard manager and the (server-rendered) public guest surface can share it.
 *
 * CORE INVARIANT reminder: these are the couple's OWN handles. Setnayan never
 * holds money; the guest sends directly to the account these describe.
 */

export const EGIFT_METHOD_KINDS = [
  'gcash',
  'maya',
  'bank',
  'paypal',
  'other',
] as const;

export type EgiftMethodKind = (typeof EGIFT_METHOD_KINDS)[number];

export function isEgiftMethodKind(value: unknown): value is EgiftMethodKind {
  return (
    typeof value === 'string' &&
    (EGIFT_METHOD_KINDS as readonly string[]).includes(value)
  );
}

export type EgiftKindMeta = {
  kind: EgiftMethodKind;
  /** Default display label the couple can override. */
  defaultLabel: string;
  /** One-line description shown under the kind in the picker. */
  blurb: string;
  /** Field label for the handle input (varies per rail). */
  handleLabel: string;
  /** Placeholder guiding what to type into the handle input. */
  handlePlaceholder: string;
  /** Whether a QR image is the primary way guests act on this rail. */
  qrPrimary: boolean;
};

export const EGIFT_KIND_META: Record<EgiftMethodKind, EgiftKindMeta> = {
  gcash: {
    kind: 'gcash',
    defaultLabel: 'GCash',
    blurb: 'Scan-to-send from any GCash app.',
    handleLabel: 'GCash number',
    handlePlaceholder: '0917 123 4567',
    qrPrimary: true,
  },
  maya: {
    kind: 'maya',
    defaultLabel: 'Maya',
    blurb: 'Scan-to-send from the Maya app.',
    handleLabel: 'Maya number',
    handlePlaceholder: '0917 123 4567',
    qrPrimary: true,
  },
  bank: {
    kind: 'bank',
    defaultLabel: 'Bank transfer',
    blurb: 'A bank account guests can transfer to.',
    handleLabel: 'Account number',
    handlePlaceholder: '1234 5678 90',
    qrPrimary: false,
  },
  paypal: {
    kind: 'paypal',
    defaultLabel: 'PayPal',
    blurb: 'For guests sending from abroad.',
    handleLabel: 'PayPal.me link or email',
    handlePlaceholder: 'paypal.me/yourname',
    qrPrimary: false,
  },
  other: {
    kind: 'other',
    defaultLabel: 'Other',
    blurb: 'Any other way guests can send a gift.',
    handleLabel: 'Handle / number / link',
    handlePlaceholder: 'How guests should send it',
    qrPrimary: false,
  },
};

export function egiftKindMeta(kind: string): EgiftKindMeta {
  return isEgiftMethodKind(kind) ? EGIFT_KIND_META[kind] : EGIFT_KIND_META.other;
}
