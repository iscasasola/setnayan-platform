/**
 * YOUR PAGE — the draft a supplier builds before ONE Apply publishes it (simpler supplier dashboard, step 5 ·
 * prototype moment 7: "Edits are a draft; Apply publishes"; plan `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08` row
 * WebsiteEditor: "One Apply in the thumb row publishes the draft").
 *
 * 🔑 NOTHING NEW IS STORED ON THE SERVER. Every part in the draft is a column `updateVendorWebsiteField` already
 * writes (`microsite_about` · `microsite_featured_service_ids` · `microsite_sections` · `microsite_hero_photo_key` ·
 * `microsite_accent` · `microsite_pinned_review_id` · `microsite_featured_editorial_ids`). Until Apply, the changes
 * live in the supplier's own browser (one key per shop) — the "unsent draft" kind of browser storage — so leaving
 * the page, or switching a collection on from Your collections, does not lose them.
 *
 * Apply posts ONE form to `applyVendorPageDraft`, which runs the SAME per-field patch and plan gates as the
 * one-field action and writes every part in ONE update. Each part carries its own form names, which never collide,
 * so one FormData holds them all (`field` repeats once per part).
 *
 * Pure: the screen, Your collections and the guard read the same functions.
 */

import { MICROSITE_TOGGLEABLE_SECTIONS, isSectionVisible, type MicrositeSectionKey } from './vendor-microsite';

/** The page as it is published — the values the draft is compared against. */
export type PageSaved = {
  about: string;
  services: string[];
  sections: Record<MicrositeSectionKey, boolean>;
  /** '' = automatic (no cover picked). */
  hero: string;
  /** '' = the default accent. */
  accent: string;
  /** '' = no pinned review. */
  pin: string;
  stories: string[];
};

export type PagePart = keyof PageSaved;

/** What the supplier changed and has not applied. A part absent = unchanged. */
export type PageDraft = Partial<PageSaved>;

export const PAGE_PARTS: readonly PagePart[] = ['about', 'services', 'sections', 'hero', 'accent', 'pin', 'stories'];

/** The field name `updateVendorWebsiteField` / `applyVendorPageDraft` know each part by. */
export const PART_FIELD: Readonly<Record<PagePart, string>> = {
  about: 'microsite_about',
  services: 'microsite_featured_services',
  sections: 'microsite_sections',
  hero: 'microsite_hero_photo',
  accent: 'microsite_accent',
  pin: 'microsite_pinned_review',
  stories: 'microsite_featured_editorials',
};

/** The part's name as the supplier reads it on the page ("2 changes · About · Look"). */
export const PART_WORD: Readonly<Record<PagePart, string>> = {
  about: 'About',
  services: 'Services shown',
  sections: 'What shows',
  hero: 'Cover photo',
  accent: 'Look',
  pin: 'Reviews',
  stories: 'Stories',
};

/** Every toggleable section, read from the stored map (a missing key = shown). */
export function sectionsOf(stored: Record<string, boolean>): Record<MicrositeSectionKey, boolean> {
  return Object.fromEntries(
    MICROSITE_TOGGLEABLE_SECTIONS.map((s) => [s.key, isSectionVisible(stored, s.key)]),
  ) as Record<MicrositeSectionKey, boolean>;
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function samePart(part: PagePart, a: PageSaved[PagePart], b: PageSaved[PagePart]): boolean {
  if (part === 'services' || part === 'stories') return sameList(a as string[], b as string[]);
  if (part === 'sections') {
    const x = a as PageSaved['sections'];
    const y = b as PageSaved['sections'];
    return MICROSITE_TOGGLEABLE_SECTIONS.every((s) => x[s.key] === y[s.key]);
  }
  if (part === 'about') return String(a).trim() === String(b).trim();
  return a === b;
}

/** The draft with every part that equals the published page taken out — a change undone is no change. */
export function pruneDraft(draft: PageDraft, saved: PageSaved): PageDraft {
  const out: PageDraft = {};
  for (const part of PAGE_PARTS) {
    const v = draft[part];
    if (v === undefined) continue;
    if (!samePart(part, v, saved[part])) (out as Record<PagePart, unknown>)[part] = v;
  }
  return out;
}

/** The parts that differ from the published page, in the order couples scroll. */
export function changedParts(draft: PageDraft, saved: PageSaved): PagePart[] {
  const pruned = pruneDraft(draft, saved);
  return PAGE_PARTS.filter((p) => pruned[p] !== undefined);
}

/** The page as the supplier sees it while editing: the published page with the draft on top. */
export function withDraft(saved: PageSaved, draft: PageDraft): PageSaved {
  return { ...saved, ...pruneDraft(draft, saved) };
}

/** "2 changes · About · Look" — or null when there is nothing to apply. */
export function draftLine(draft: PageDraft, saved: PageSaved): string | null {
  const parts = changedParts(draft, saved);
  if (parts.length === 0) return null;
  return `${parts.length === 1 ? '1 change' : `${parts.length} changes`} · ${parts.map((p) => PART_WORD[p]).join(' · ')}`;
}

/** The [name, value] pairs ONE Apply posts — each changed part's `field` marker, then its own entries. */
export function draftEntries(draft: PageDraft, saved: PageSaved): [string, string][] {
  const pruned = pruneDraft(draft, saved);
  const out: [string, string][] = [];
  for (const part of PAGE_PARTS) {
    const v = pruned[part];
    if (v === undefined) continue;
    out.push(['field', PART_FIELD[part]]);
    switch (part) {
      case 'about':
      case 'hero':
      case 'accent':
      case 'pin':
        out.push([PART_FIELD[part], String(v)]);
        break;
      case 'services':
      case 'stories':
        for (const k of v as string[]) out.push([PART_FIELD[part], k]);
        break;
      case 'sections':
        for (const s of MICROSITE_TOGGLEABLE_SECTIONS) {
          if ((v as PageSaved['sections'])[s.key]) out.push([`section_${s.key}`, 'on']);
        }
        break;
    }
  }
  return out;
}

/** The browser key the draft is kept under — one per shop, so two shops on one phone never mix. */
export function draftStorageKey(vendorProfileId: string): string {
  return `setnayan.supplier.page-draft.${vendorProfileId}`;
}

const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/**
 * Read a stored draft back. Anything that is not the shape is dropped part by part — a draft written by an older
 * build, or edited by hand, can never reach Apply as something the action was not built for.
 */
export function parseStoredDraft(raw: string | null): PageDraft {
  if (!raw) return {};
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!v || typeof v !== 'object') return {};
  const o = v as Record<string, unknown>;
  const out: PageDraft = {};
  if (typeof o.about === 'string') out.about = o.about;
  if (isStrList(o.services)) out.services = o.services;
  if (isStrList(o.stories)) out.stories = o.stories;
  for (const k of ['hero', 'accent', 'pin'] as const) if (typeof o[k] === 'string') out[k] = o[k] as string;
  if (o.sections && typeof o.sections === 'object') {
    const s = o.sections as Record<string, unknown>;
    if (MICROSITE_TOGGLEABLE_SECTIONS.every((x) => typeof s[x.key] === 'boolean')) {
      out.sections = Object.fromEntries(
        MICROSITE_TOGGLEABLE_SECTIONS.map((x) => [x.key, s[x.key] as boolean]),
      ) as PageSaved['sections'];
    }
  }
  return out;
}
