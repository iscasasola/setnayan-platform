'use client';

import { createContext, useContext } from 'react';
import type { PrintField } from '@/lib/print-layout';

/**
 * ✍ "TAP IT, EDIT IT ON THE RIGHT" (owner 2026-09-28) — how a tap on a card's
 * print-only words reaches the Details editor. `PrintPreview` (in the body)
 * calls it; `DetailsWorkspace` provides it: it opens the editor (the sheet on a
 * phone) and puts the caret in that one field. Null outside Details — a
 * preview elsewhere draws no tap targets.
 */
export const DetailsTapContext = createContext<((field: PrintField) => void) | null>(null);

export function useDetailsTap(): ((field: PrintField) => void) | null {
  return useContext(DetailsTapContext);
}

/** Where each tappable field is typed — the form fields' own names, never a copy. */
export const PRINT_FIELD_INPUT: Record<PrintField, string> = {
  opening_line: 'opening_line',
  rsvp: 'rsvp_choice',
};

/** Its words for a screen reader. */
export const PRINT_FIELD_LABEL: Record<PrintField, string> = {
  opening_line: 'Edit the opening line',
  rsvp: 'Edit “Kindly reply”',
};

export type PrintFieldsHeader = { w: number; h: number; fields: Array<{ field: PrintField; x: number; y: number; w: number; h: number }> };

/** The route's `x-print-fields` header, checked — anything malformed is no tap targets, never a throw. */
export function parsePrintFields(raw: string | null): PrintFieldsHeader | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as PrintFieldsHeader;
    if (!(v && v.w > 0 && v.h > 0 && Array.isArray(v.fields))) return null;
    const fields = v.fields.filter(
      (f) => (f.field === 'opening_line' || f.field === 'rsvp') && [f.x, f.y, f.w, f.h].every((n) => Number.isFinite(n)),
    );
    return fields.length ? { w: v.w, h: v.h, fields } : null;
  } catch {
    return null;
  }
}

/**
 * ✍ THE SCENE A FACT'S EDITOR IS OPEN FOR (Details part 2b — "tap a fact on a
 * stage → the same Details field on the right"). The stage's inspector wraps a
 * Details item's OWN editor in this when it shows it for a scene (`w:<type>`),
 * so the editor can put what is typed on that scene as it is typed — the
 * canvas's `words` preview, `canvas-words.tsx`. Null in Details itself.
 */
export const DetailsFactSceneContext = createContext<string | null>(null);

export function useDetailsFactScene(): string | null {
  return useContext(DetailsFactSceneContext);
}
