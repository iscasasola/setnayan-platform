/**
 * lib/egift-method-merge.ts — A WAY TO GIVE, EDITED ON TWO SCREENS (owner 2026-10-18, round 3 of "two hosts never
 * overwrite each other"; the pattern is `lib/merge-from-base.ts`, the guest card's row shape).
 *
 * Editing a way (`saveEgiftMethod`) posted all six fields from the form's copy — so a form opened before the other host
 * fixed the account number put the OLD number back (a guest then sends money to it). Now the form also posts what it
 * started from (`MERGE_BASE_FIELD`: those fields as the way stood when the form opened), and only the fields THIS screen
 * changed are written. A field missing from the base counts as changed (Studio › E-Gifts sends a base only for the
 * label, note and QR it carries forward unseen). No base (an older page): every field, as before.
 *
 * Pure — no React, no I/O: the action, both senders and the test use it.
 */
import { changedFields } from './merge-from-base';

export const EGIFT_EDIT_FIELDS = ['method_kind', 'label', 'account_name', 'handle', 'qr_r2_key', 'note'] as const;
export type EgiftEditField = (typeof EGIFT_EDIT_FIELDS)[number];

/** One spelling: trimmed, '' = none — how the action reads a posted field. */
const norm = (v: unknown): string | null => (typeof v === 'string' ? v.trim() : '') || null;

/** The fields this edit changed from its base — `null` = no usable base: write them all. */
export function egiftFieldsThisScreenChanged(rawBase: unknown, mine: Readonly<Record<EgiftEditField, unknown>>): Set<EgiftEditField> | null {
  let base: unknown = rawBase;
  if (typeof rawBase === 'string') {
    try {
      base = JSON.parse(rawBase) as unknown;
    } catch {
      return null;
    }
  }
  if (!base || typeof base !== 'object' || Array.isArray(base)) return null;
  const b: Record<string, unknown> = {};
  const m: Record<string, unknown> = {};
  for (const f of EGIFT_EDIT_FIELDS) {
    if (f in (base as object)) b[f] = norm((base as Record<string, unknown>)[f]);
    m[f] = norm(mine[f]);
  }
  return changedFields(b, m) as Set<EgiftEditField>;
}
