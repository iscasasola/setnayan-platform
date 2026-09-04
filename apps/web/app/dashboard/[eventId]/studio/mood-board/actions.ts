'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  isMoodboardSlotKey,
  isMoodboardSlotPosition,
  type MoodboardSlotPosition,
} from '@/lib/moodboard-slots';
import {
  SUPPLIER_GALLERY_ASSET_TYPE,
  normalizeGalleryQuery,
  shapeGalleryPage,
  slotHasSupplierTrade,
  type GalleryPage,
  type RawGalleryRow,
} from '@/lib/moodboard-gallery';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { sanitizeRolePalette, type PaletteKey, type RolePalette } from '@/lib/mood-board';
import { sanitizeReceptionDesign, type ReceptionDesign } from '@/lib/reception-scene';
import {
  mergeRolePalette,
  mergeReceptionDesign,
  mergeTheme,
  replaceRolePalette,
  replaceReceptionDesign,
  replaceTheme,
  emptyTemplateInspirationSlots,
  nextMoodboardStyleFamily,
  normalizeThemeTemplateQuery,
  TEMPLATE_INSPIRATION_SLOT_ASSETS,
  summaryIsEmpty,
  type ApplyMode,
  type ApplyTemplateSummary,
  type MoodboardThemeTemplate,
  type ThemeTemplatePage,
} from '@/lib/moodboard-templates';
import {
  validateThemeSelection,
  selectionIsEmpty,
  type ThemeTextReading,
} from '@/lib/theme-text-intent';
import { readThemeTextWithModel } from '@/lib/theme-text-intent-model';
import {
  normalizeRenderPoolQuery,
  shapeRenderPoolPage,
  type RawPoolRow,
  type RenderPoolPage,
} from '@/lib/moodboard-render-pool';
import { pickedRenderObjectKey } from '@/lib/moodboard-gallery-copy';
import { r2GetBytes, r2Upload, r2SignedGet, R2_BUCKETS, isR2Configured } from '@/lib/r2';
import { RENDER_BUCKET_KEY } from '@/lib/bucket-routing';

export async function saveRolePalette(formData: FormData) {
  const eventId = formData.get('event_id');
  const paletteJson = formData.get('palette_json');
  if (typeof eventId !== 'string' || typeof paletteJson !== 'string') {
    throw new Error('Invalid input');
  }

  let parsed: unknown = {};
  try {
    parsed = JSON.parse(paletteJson);
  } catch {
    throw new Error('Palette payload was not valid JSON');
  }
  const sanitized = sanitizeRolePalette(parsed);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('events')
    .update({
      role_palette: sanitized,
      mood_board_updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}`, 'layout');
}

/** ⚠ slotPosition is deliberately NOT re-spelled as `1 | 2` here. It was, and
 *  the widening to three photos per slot missed it — the call site papered
 *  over the mismatch with `as 1 | 2`, so a drag onto the third position type-
 *  lied instead of failing to compile. One source of truth: the constant. */
export type MoodboardSlotRef = { slotKey: string; slotPosition: MoodboardSlotPosition };

/**
 * Swap the images occupying two inspiration-board cells — the drag-reorder
 * affordance on the redesigned canvas (Mood Board redesign, 2026-09-02).
 * Works within one slot (swap its two positions) or across slots (move an
 * image from one named slot into another), since every slot has exactly two
 * fixed positions and no new schema is needed to express "swap what's here".
 *
 * Implementation note: `event_inspiration_assets` enforces
 * UNIQUE(event_id, slot_key, slot_position) WHERE removed_at IS NULL, so a
 * straight two-row UPDATE swap can collide mid-flight. This does it in three
 * steps via a temporary negative slot_position, which never collides with a
 * real (positive) position — same "two round trips is fine for this" trade-off
 * this file already makes elsewhere (see saveAttireGuidePaletteColor's old
 * read-modify-write, now removed, and uploadMoodboardSlot's soft-delete step).
 * Either or both cells may be empty; a no-op (same cell) returns immediately.
 */
export async function reorderMoodboardSlot(
  eventId: string,
  from: MoodboardSlotRef,
  to: MoodboardSlotRef,
): Promise<void> {
  if (from.slotKey === to.slotKey && from.slotPosition === to.slotPosition) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const findActive = (ref: MoodboardSlotRef) =>
    supabase
      .from('event_inspiration_assets')
      .select('inspiration_id')
      .eq('event_id', eventId)
      .eq('slot_key', ref.slotKey)
      .eq('slot_position', ref.slotPosition)
      .is('removed_at', null)
      .maybeSingle();

  const [{ data: fromRow, error: fromErr }, { data: toRow, error: toErr }] = await Promise.all([
    findActive(from),
    findActive(to),
  ]);
  if (fromErr) throw new Error(fromErr.message);
  if (toErr) throw new Error(toErr.message);
  if (!fromRow) return; // nothing to move

  // 1. Park `from` at a temp negative position so it can never collide with
  //    the real (positive) position `to` is about to vacate.
  const tempPosition = -1;
  const { error: parkErr } = await supabase
    .from('event_inspiration_assets')
    .update({ slot_position: tempPosition })
    .eq('inspiration_id', fromRow.inspiration_id);
  if (parkErr) throw new Error(parkErr.message);

  // 2. If the destination was occupied, move that image into the vacated
  //    `from` cell.
  if (toRow) {
    const { error: swapErr } = await supabase
      .from('event_inspiration_assets')
      .update({ slot_key: from.slotKey, slot_position: from.slotPosition })
      .eq('inspiration_id', toRow.inspiration_id);
    if (swapErr) throw new Error(swapErr.message);
  }

  // 3. Land `from`'s image in the destination cell.
  const { error: landErr } = await supabase
    .from('event_inspiration_assets')
    .update({ slot_key: to.slotKey, slot_position: to.slotPosition })
    .eq('inspiration_id', fromRow.inspiration_id);
  if (landErr) throw new Error(landErr.message);

  revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
}

const THEME_NAME_MAX = 80;
const THEME_DESCRIPTION_MAX = 280;

/**
 * Save the couple's "Overall Theme" name + description (Mood Board redesign,
 * 2026-09-02). Schema columns: events.moodboard_theme_name / _description
 * (migration 20271193183599). Follows the exact validation/auth pattern of
 * saveRolePalette above (saveReceptionDesign moved to seating/actions.ts,
 * 2026-09-03 relocation) — RLS-gated via the user's own supabase client,
 * never the admin client.
 */
export async function saveMoodboardTheme(
  eventId: string,
  theme: { name: string; description: string },
): Promise<void> {
  const name = theme.name.trim().slice(0, THEME_NAME_MAX);
  const description = theme.description.trim().slice(0, THEME_DESCRIPTION_MAX);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS enforces host-only writes on their own events via event_members.
  const { error } = await supabase
    .from('events')
    .update({
      moodboard_theme_name: name || null,
      moodboard_theme_description: description || null,
      mood_board_updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
}

// ── the theme description finally does something ─────────────────────────

/**
 * READ the couple's own sentence. Nothing is written; nothing on the board
 * moves. The reading comes back for the couple to look at, edit and confirm —
 * see the "Read my description" flow in _components/theme-card.tsx.
 *
 * 🔑 WHY THIS ACTION EXISTS AT ALL. `events.moodboard_theme_description` has
 * been saved, displayed on the vendor board and printed on the concept-PDF
 * cover since 20271193183599, and read by NOTHING. Its placeholder invited a
 * sentence and then ignored it — the owner typed "i want to feel christmas
 * vibe with a hint of classy elegance" and nothing happened. Their verdict:
 * "if this will not help me generate a theme, remove it." This is the other
 * choice.
 *
 * The deterministic dictionary answers first and for free
 * (lib/theme-text-intent.ts); the model arm is reached only when it finds
 * nothing at all, and degrades silently to the dictionary's answer when
 * ANTHROPIC_API_KEY is unset (lib/theme-text-intent-model.ts).
 *
 * ⚠ The sentence is NOT read back out of the database here — the couple's
 * unsaved edit is what they expect to be read. That is safe because the
 * reading is a pure classification into closed vocabularies: the worst a
 * forged sentence can produce is a set of chips the same signed-in user could
 * already have tapped by hand, and `applyThemeIntent` below re-validates
 * every one of them before anything reaches `events`.
 */
export async function readMoodboardThemeDescription(text: string): Promise<ThemeTextReading> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return readThemeTextWithModel(typeof text === 'string' ? text : '');
}

export type ThemeIntentApplySummary = {
  filledPaletteRoles: PaletteKey[];
  filledReceptionZones: string[];
  styleFamily: string | null;
  nothingToFill: boolean;
};

/**
 * APPLY the chips the couple KEPT. Fill-empty only, exactly like
 * `applyMoodboardTemplate`'s default mode — a reading of their own sentence
 * must never overwrite a colour or a zone they already chose by hand.
 *
 * 🛑 THE PAYLOAD IS NOT TRUSTED. It arrives from the browser after the couple
 * removed chips, so it goes through `validateThemeSelection` — the same
 * whitelist the model arm's reply passes through. A mood, family, colour name
 * or motif id that is not a member of a shipped vocabulary is dropped, and a
 * colour's hex is ALWAYS re-derived from the name we stock rather than taken
 * from the caller.
 *
 * Moods are deliberately NOT written to the event: they steer the theme
 * gallery client-side (which mood to open it on) and are not board content.
 * The style family IS written, through `nextMoodboardStyleFamily` in
 * fill-empty mode, because `events.moodboard_style_family` is the existing
 * home for exactly that fact.
 */
export async function applyThemeIntent(
  eventId: string,
  selection: unknown,
): Promise<ThemeIntentApplySummary> {
  const kept = validateThemeSelection(selection);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (selectionIsEmpty(kept)) {
    return {
      filledPaletteRoles: [],
      filledReceptionZones: [],
      styleFamily: null,
      nothingToFill: true,
    };
  }

  const { data: eventRow, error: eventErr } = await supabase
    .from('events')
    .select('role_palette, reception_design, moodboard_style_family')
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventErr) throw new Error(eventErr.message);
  if (!eventRow) throw new Error('Event not found');

  const currentPalette = sanitizeRolePalette(eventRow.role_palette ?? {});
  const currentDesign = sanitizeReceptionDesign(eventRow.reception_design ?? {});

  // The colours the couple's sentence named ARE the reception scheme — the
  // same key the theme gallery's swatch strip leads with. `mergeRolePalette`
  // then fills it only if they have not set it themselves.
  const proposedPalette: RolePalette =
    kept.colours.length > 0 ? { reception: kept.colours.map((c) => c.hex) } : {};
  const { merged: mergedPalette, filledKeys } = mergeRolePalette(currentPalette, proposedPalette);

  // A zone that ACCEPTS several treatments gets several — "paper lanterns AND
  // fairy lights" is one real ceiling, and `sanitizeReceptionDesign` is what
  // decides which attributes allow it. Collecting into arrays here and letting
  // the sanitizer collapse the single-select ones keeps that rule in one place.
  const proposedDesign: ReceptionDesign = {};
  for (const m of kept.motifs) {
    const part = (proposedDesign[m.part] ?? {}) as Record<string, string[]>;
    part[m.attribute] = [...(part[m.attribute] ?? []), m.option];
    proposedDesign[m.part] = part;
  }
  const { merged: mergedDesign, filledZones } = mergeReceptionDesign(
    currentDesign,
    sanitizeReceptionDesign(proposedDesign),
  );

  const styleFamilyToWrite = kept.families[0]
    ? nextMoodboardStyleFamily(
        'fill_empty',
        (eventRow as { moodboard_style_family?: string | null }).moodboard_style_family ?? null,
        kept.families[0],
      )
    : null;

  const paletteChanged = filledKeys.length > 0;
  const designChanged = filledZones.length > 0;

  if (paletteChanged || designChanged || styleFamilyToWrite) {
    const update: Record<string, unknown> = {};
    // Same rule as applyMoodboardTemplate: the couple-visible "last saved"
    // stamp moves only when something the couple can SEE changed. Recording
    // the style family alone is provenance, not a save.
    if (paletteChanged || designChanged) update.mood_board_updated_at = new Date().toISOString();
    if (paletteChanged) update.role_palette = mergedPalette;
    if (designChanged) update.reception_design = mergedDesign;
    if (styleFamilyToWrite) update.moodboard_style_family = styleFamilyToWrite;

    const { error: updateErr } = await supabase
      .from('events')
      .update(update)
      .eq('event_id', eventId);
    if (updateErr) throw new Error(updateErr.message);

    revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
    revalidatePath(`/dashboard/${eventId}/seating/lab`);
  }

  return {
    filledPaletteRoles: filledKeys,
    filledReceptionZones: filledZones,
    styleFamily: styleFamilyToWrite,
    nothingToFill: !paletteChanged && !designChanged && !styleFamilyToWrite,
  };
}

/** The columns the gallery actually renders. Deliberately spelled out rather
 *  than `*`: `role_palette` and `reception_design` are JSONB blobs and are the
 *  reason an unbounded read of this table was expensive. */
const THEME_TEMPLATE_COLUMNS =
  'template_id, style_family, mood_tag, name, description, role_palette, reception_design, sort_order';

/**
 * ONE PAGE of theme templates for a single (style family, mood) pair.
 *
 * 🛑 WHY THIS ACTION EXISTS — a shipping regression, fixed 2026-09-03.
 * `page.tsx` used to `select(...)` this table with NO filter and NO limit and
 * hand the whole array to the gallery as a prop. That was tolerable at 100
 * rows and became a real cost at 2,600 (migrations 20271194462267 +
 * 20271196372720): every couple, on every mood-board load, downloaded 2,600
 * rows — two JSONB blobs each — into the RSC payload, then re-filtered them
 * in the browser. The page no longer reads this table AT ALL; the gallery
 * fetches through here, only after the couple has answered both narrowing
 * questions, and only ~6 rows at a time.
 *
 * Inputs are whitelisted, never interpolated: `normalizeThemeTemplateQuery`
 * accepts a `styleFamily`/`moodTag` only when it is EXACTLY one of the
 * shipped vocabulary strings (the same 10+10 the CHECK constraints in
 * 20271195711446 enforce), and clamps `limit` to THEME_TEMPLATE_MAX_LIMIT
 * (24) and `offset` to THEME_TEMPLATE_MAX_OFFSET — so no client can ask for
 * thousands of rows, whatever it sends.
 *
 * Auth follows this file's house shape (the user's own RLS-scoped client,
 * never the admin client). There is no ownership check to make:
 * `moodboard_theme_templates` is admin-authored public-read reference
 * content — the same rows for every couple — so the only gate that matters
 * is "is somebody signed in".
 */
export async function fetchThemeTemplates(input: {
  styleFamily: string;
  moodTag: string;
  limit?: number;
  offset?: number;
}): Promise<ThemeTemplatePage> {
  const query = normalizeThemeTemplateQuery(input);
  if (!query) throw new Error('Unknown theme style or mood');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data, count, error }, moodCount] = await Promise.all([
    supabase
      .from('moodboard_theme_templates')
      .select(THEME_TEMPLATE_COLUMNS, { count: 'exact' })
      .eq('style_family', query.styleFamily)
      .eq('mood_tag', query.moodTag)
      .order('sort_order', { ascending: true })
      .order('template_id', { ascending: true })
      .range(query.offset, query.offset + query.limit - 1),
    // Rows carrying this MOOD in ANY setting. `head: true` fetches no rows —
    // it is a COUNT, and it is what lets the gallery tell "not in this
    // setting" apart from "this feeling has no themes at all", which is the
    // live state of `festive_celebratory`. See ThemeTemplatePage.moodTotal.
    supabase
      .from('moodboard_theme_templates')
      .select('template_id', { count: 'exact', head: true })
      .eq('mood_tag', query.moodTag),
  ]);
  if (error) throw new Error(error.message);

  return {
    templates: (data ?? []) as unknown as MoodboardThemeTemplate[],
    total: count ?? 0,
    // A failed count degrades to 0, which reads as "no themes with this
    // feeling" — the same message the couple gets from a genuine zero, and
    // never a false claim that themes exist.
    moodTotal: moodCount.error ? 0 : (moodCount.count ?? 0),
    offset: query.offset,
    limit: query.limit,
  };
}

/**
 * Apply a curated theme TEMPLATE (public.moodboard_theme_templates) to the
 * couple's board — "pick a look, seed your board" (Mood Board redesign
 * follow-up, 2026-09-03).
 *
 * TWO MODES (owner directive, 2026-09-03 follow-up — the 2nd mode is new):
 *   • `fill_empty` (default, and the ONLY mode before this follow-up) — NEVER
 *     overwrites anything the couple already set. Every field it might touch
 *     — role_palette keys, reception_design zones, moodboard_theme_name/
 *     _description, event_inspiration_assets slots — is filled ONLY when
 *     currently empty (mergeRolePalette / mergeReceptionDesign / mergeTheme).
 *   • `replace_all` — REPLACES role_palette / reception_design / theme
 *     name+description with the template's values (replaceRolePalette /
 *     replaceReceptionDesign / replaceTheme), regardless of what the couple
 *     had. Still scoped to exactly those fields: `room_dressing` /
 *     `custom_roles` (couple-authored, templates never set either) and
 *     inspiration photos are untouched in BOTH modes — see those functions'
 *     own docblocks in lib/moodboard-templates.ts for why. The client
 *     confirms with the couple before calling this mode (template-gallery.tsx)
 *     since it's destructive; this action itself does not re-confirm.
 *
 * STYLE-FAMILY PROVENANCE (2026-09-03, second follow-up): both modes now also
 * persist `events.moodboard_style_family` — the record of WHICH of the 10
 * style families produced this board. It is not a cosmetic field: the AI
 * decor-layer pilot's `resolveDecorLayer` returns the flat SVG for a null
 * family and always did, so with nothing writing it the pilot was dormant for
 * every event that ever existed. `nextMoodboardStyleFamily` honors each mode
 * (fill_empty writes only into a NULL; replace_all always writes), and it is
 * excluded from `summaryIsEmpty` on purpose — it is provenance, not board
 * content, so recording it must not turn "already personalized — nothing to
 * fill in" into a false claim that something was filled.
 *
 * A couple who's already fully customized their board and applies
 * `fill_empty` gets a `summaryIsEmpty` result — the UI shows "already
 * personalized — nothing to fill in" rather than silently doing nothing with
 * no explanation. (`replace_all` essentially always changes something, so
 * `nothingToFill` is only ever true for it if the template itself carries no
 * palette/design/theme content at all.)
 *
 * Inspiration slots are the one part that needs a DB lookup mid-flight: for
 * each currently-empty slot in TEMPLATE_INSPIRATION_SLOT_ASSETS (the
 * attire-adjacent slots — venue/backdrop/ceiling/etc. have no style-tagged
 * asset to offer, per that module's own comment), look up a
 * moodboard_library_assets row matching the template's style_family via the
 * SAME style_theme column + join pattern page.tsx already uses for the
 * "In your colors" read path (approved, not retired), and use its own
 * moodboard_asset_color_ranges as that slot's 6 sampled hexes — cycling if
 * fewer than 6 exist, exactly like moodboard-board.tsx's `autoEdits` cycles a
 * palette over regions. If an asset has literally zero tagged colors we skip
 * that slot rather than inventing hex values.
 */
export async function applyMoodboardTemplate(
  eventId: string,
  templateId: string,
  mode: ApplyMode = 'fill_empty',
): Promise<ApplyTemplateSummary & { nothingToFill: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: templateRow, error: templateErr }, { data: eventRow, error: eventErr }] =
    await Promise.all([
      supabase
        .from('moodboard_theme_templates')
        .select('template_id, style_family, mood_tag, name, description, role_palette, reception_design')
        .eq('template_id', templateId)
        .maybeSingle(),
      supabase
        .from('events')
        .select(
          'role_palette, reception_design, moodboard_theme_name, moodboard_theme_description, moodboard_style_family',
        )
        .eq('event_id', eventId)
        .maybeSingle(),
    ]);
  if (templateErr) throw new Error(templateErr.message);
  if (eventErr) throw new Error(eventErr.message);
  if (!templateRow) throw new Error('Template not found');
  if (!eventRow) throw new Error('Event not found');

  const template = templateRow as unknown as MoodboardThemeTemplate;
  const currentPalette = sanitizeRolePalette(eventRow.role_palette ?? {});
  const currentDesign = sanitizeReceptionDesign(eventRow.reception_design ?? {});

  let mergedPalette: RolePalette;
  let filledPaletteRoles: PaletteKey[];
  let mergedDesign: ReceptionDesign;
  let filledReceptionZones: string[];
  let mergedName: string | null;
  let mergedDescription: string | null;
  let filledThemeName: boolean;
  let filledThemeDescription: boolean;

  if (mode === 'replace_all') {
    const paletteResult = replaceRolePalette(currentPalette, template.role_palette);
    mergedPalette = paletteResult.merged;
    filledPaletteRoles = paletteResult.changedKeys;
    const designResult = replaceReceptionDesign(currentDesign, template.reception_design);
    mergedDesign = designResult.merged;
    filledReceptionZones = designResult.changedZones;
    const themeResult = replaceTheme(template.name, template.description);
    mergedName = themeResult.name;
    mergedDescription = themeResult.description;
    filledThemeName = true;
    filledThemeDescription = true;
  } else {
    const paletteResult = mergeRolePalette(currentPalette, template.role_palette);
    mergedPalette = paletteResult.merged;
    filledPaletteRoles = paletteResult.filledKeys;
    const designResult = mergeReceptionDesign(currentDesign, template.reception_design);
    mergedDesign = designResult.merged;
    filledReceptionZones = designResult.filledZones;
    const themeResult = mergeTheme(
      eventRow.moodboard_theme_name ?? null,
      eventRow.moodboard_theme_description ?? null,
      template.name,
      template.description,
    );
    mergedName = themeResult.name;
    mergedDescription = themeResult.description;
    filledThemeName = themeResult.filledName;
    filledThemeDescription = themeResult.filledDescription;
  }

  // ── inspiration slots — the one part needing a DB round trip ────────────
  const { data: activeRows, error: activeErr } = await supabase
    .from('event_inspiration_assets')
    .select('slot_key')
    .eq('event_id', eventId)
    .is('removed_at', null);
  if (activeErr) throw new Error(activeErr.message);
  const occupiedSlotKeys = new Set((activeRows ?? []).map((r) => r.slot_key as string));
  const candidateSlots = emptyTemplateInspirationSlots(occupiedSlotKeys);

  const filledInspirationSlots: string[] = [];
  if (candidateSlots.length > 0) {
    for (const slotKey of candidateSlots) {
      const assetDef = TEMPLATE_INSPIRATION_SLOT_ASSETS[slotKey];
      if (!assetDef) continue;
      const { data: assetRows } = await supabase
        .from('moodboard_library_assets')
        .select(
          `asset_id, storage_path,
           moodboard_asset_color_ranges ( slot_id, sampled_hex )`,
        )
        .eq('asset_type', assetDef.asset_type)
        .eq('asset_subtype', assetDef.asset_subtype)
        .eq('style_theme', template.style_family)
        .not('approved_at', 'is', null)
        .is('retired_at', null)
        .limit(1);
      const asset = (assetRows ?? [])[0] as
        | {
            asset_id: string;
            storage_path: string;
            moodboard_asset_color_ranges:
              | { slot_id: number; sampled_hex: string }[]
              | { slot_id: number; sampled_hex: string }
              | null;
          }
        | undefined;
      if (!asset) continue;
      const ranges = Array.isArray(asset.moodboard_asset_color_ranges)
        ? asset.moodboard_asset_color_ranges
        : asset.moodboard_asset_color_ranges
          ? [asset.moodboard_asset_color_ranges]
          : [];
      const rawHexes = ranges
        .slice()
        .sort((a, b) => a.slot_id - b.slot_id)
        .map((r) => r.sampled_hex);
      if (rawHexes.length === 0) continue; // no real color to write — skip, don't invent one
      const hexes = Array.from({ length: 6 }, (_, i) => rawHexes[i % rawHexes.length]!);

      const { error: insertErr } = await supabase.from('event_inspiration_assets').insert({
        event_id: eventId,
        added_by_user_id: user.id,
        slot_key: slotKey,
        slot_position: 1,
        // MB10 — THIS ROW USED TO CLAIM THE COUPLE PASTED IT OFF THE INTERNET.
        // It is a library photo, copied by `applyMoodboardTemplate`, and
        // 'url_paste' was simply the closest of the two modes that existed.
        // Now that provenance is expressible it is recorded: the mode says
        // where it came from and `library_asset_id` says which row, so a
        // template-seeded tile is as traceable as one the couple picked
        // herself. The DB biconditional makes the pair inseparable.
        source_kind: 'gallery_pick',
        library_asset_id: asset.asset_id,
        image_url: asset.storage_path,
        sampled_hex_1: hexes[0],
        sampled_hex_2: hexes[1],
        sampled_hex_3: hexes[2],
        sampled_hex_4: hexes[3],
        sampled_hex_5: hexes[4],
        sampled_hex_6: hexes[5],
      });
      if (!insertErr) filledInspirationSlots.push(slotKey);
    }
  }

  const summary: ApplyTemplateSummary = {
    mode,
    filledPaletteRoles,
    filledReceptionZones,
    filledInspirationSlots,
    filledThemeName,
    filledThemeDescription,
  };
  const nothingToFill = summaryIsEmpty(summary);

  // Only write to `events` when something in it actually changed — an
  // event-row UPDATE + mood_board_updated_at bump for a couple who has
  // nothing left to fill would be a no-op write that still touches
  // updated_at, misleadingly implying a save happened.
  const paletteChanged = filledPaletteRoles.length > 0;
  const designChanged = filledReceptionZones.length > 0;
  const themeChanged = filledThemeName || filledThemeDescription;

  // WHICH style family produced this board — the provenance the AI decor-layer
  // pilot needs and nothing used to record (see nextMoodboardStyleFamily's
  // docblock). `null` means "leave the stored value alone".
  const styleFamilyToWrite = nextMoodboardStyleFamily(
    mode,
    (eventRow as { moodboard_style_family?: string | null }).moodboard_style_family ?? null,
    template.style_family,
  );

  if (paletteChanged || designChanged || themeChanged || styleFamilyToWrite) {
    const update: Record<string, unknown> = {};
    // Bump the couple-visible "last saved" stamp ONLY when something the
    // couple can SEE changed. Recording the style family is internal
    // provenance — writing it alone must not tell a fully-personalized couple
    // their board was just saved when nothing on it moved.
    if (paletteChanged || designChanged || themeChanged) {
      update.mood_board_updated_at = new Date().toISOString();
    }
    if (paletteChanged) update.role_palette = mergedPalette as RolePalette;
    if (designChanged) update.reception_design = mergedDesign as ReceptionDesign;
    if (filledThemeName) update.moodboard_theme_name = mergedName;
    if (filledThemeDescription) update.moodboard_theme_description = mergedDescription;
    if (styleFamilyToWrite) update.moodboard_style_family = styleFamilyToWrite;

    const { error: updateErr } = await supabase
      .from('events')
      .update(update)
      .eq('event_id', eventId);
    if (updateErr) throw new Error(updateErr.message);
  }

  if (
    paletteChanged ||
    designChanged ||
    themeChanged ||
    styleFamilyToWrite ||
    filledInspirationSlots.length > 0
  ) {
    revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
    // The Seat Plan lab reads role_palette / reception_design AND (new) the
    // stored style family that drives its decor-layer resolution, so it has to
    // be revalidated too — same reasoning saveReceptionDesign already applies
    // in the other direction (seating/actions.ts revalidates the mood board).
    revalidatePath(`/dashboard/${eventId}/seating/lab`);
  }

  return { ...summary, nothingToFill };
}

/**
 * "Share with vendors" — pings every booked marketplace vendor on the event
 * that the couple's Mood Board is ready for their eyes (Mood Board · Surface B,
 * 2026-06-28).
 *
 * Free convenience layer, no paywall: a booked vendor ALREADY has read access to
 * the board via the get_vendor_mood_board SECURITY DEFINER RPC. This action just
 * drops an in-app notification per booked vendor deep-linking to that read-only
 * view, so the couple doesn't have to chase them down a chat thread.
 *
 * "Booked" mirrors the RPC's gate EXACTLY: any event_vendors row for this event
 * whose marketplace_vendor_id is non-null (no status filter — same as the RPC's
 * `EXISTS (… WHERE marketplace_vendor_id = vendor_profile_id)`). V1 default is
 * all-booked; no category filtering (locked).
 *
 * RLS: the host-scope read on event_vendors is enforced by the caller's session
 * (the host owns this event). Vendor user_id resolution + the notification
 * insert go through the service-role admin client (vendor_profiles + notifications
 * are not host-readable), mirroring the booking_confirmed emit in
 * dashboard/[eventId]/vendors/actions.ts. Returns the count so the page can toast
 * "Shared with N vendors".
 */
export async function shareMoodBoardWithVendors(
  eventId: string,
): Promise<{ sharedCount: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Host-scoped read: RLS only returns event_vendors rows for events the caller
  // is a member of, so this both authorizes the action and gathers the targets.
  const { data: vendorRows, error: vendorErr } = await supabase
    .from('event_vendors')
    .select('marketplace_vendor_id')
    .eq('event_id', eventId)
    .not('marketplace_vendor_id', 'is', null);
  if (vendorErr) throw new Error(vendorErr.message);

  // Distinct profiles — one vendor can hold several event_vendors rows (one per
  // category), but we ping them once.
  const profileIds = Array.from(
    new Set(
      (vendorRows ?? [])
        .map((r) => r.marketplace_vendor_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (profileIds.length === 0) return { sharedCount: 0 };

  // Resolve each booked vendor profile to its account user_id + grab the event
  // display name for the notification copy. vendor_profiles + the notification
  // insert are not host-readable, so this goes through the admin client.
  const admin = createAdminClient();
  const [{ data: profiles }, { data: eventRow }] = await Promise.all([
    admin
      .from('vendor_profiles')
      .select('vendor_profile_id, user_id')
      .in('vendor_profile_id', profileIds),
    admin
      .from('events')
      .select('display_name')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);

  const eventDisplay =
    (eventRow as { display_name: string | null } | null)?.display_name ?? 'A couple';

  const userIds = Array.from(
    new Set(
      (profiles ?? [])
        .map((p) => (p as { user_id: string | null }).user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  // Best-effort fan-out — emitNotification fails soft internally, so one vendor's
  // hiccup never blocks the rest. sharedCount reflects vendors we attempted to
  // notify (those with a resolvable account), which drives the couple's toast.
  await Promise.all(
    userIds.map((vendorUserId) =>
      emitNotification({
        userId: vendorUserId,
        type: 'mood_board_share',
        title: `${eventDisplay} shared their mood board`,
        body: `${eventDisplay} shared their mood board with you — open it to align your styling, decor, or booth to their palette and reception design.`,
        relatedUrl: `/vendor-dashboard/clients/${eventId}/mood-board`,
      }),
    ),
  );

  return { sharedCount: userIds.length };
}

/* ══════════════════════════════════════════════════════════════════════════
   MB10 · THE SUPPLIER GALLERY — browse, credited, and CAPPED
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * One page of supplier gallery photos for one inspiration slot.
 *
 * 🛑 CAPPED ON THE SERVER, NOT BY THE CALLER. Every request goes through
 * `normalizeGalleryQuery`, which clamps limit to GALLERY_MAX_LIMIT and offset
 * to GALLERY_MAX_OFFSET whatever arrives — including nothing at all — and the
 * clamped pair is then handed to `.range()` unconditionally. There is no branch
 * in this function that reads the table without a range. `template-gallery.tsx`
 * shipped the opposite shape (the WHOLE moodboard_theme_templates table through
 * the RSC payload) and PR #5113 had to kill it; the supplier gallery grows with
 * every shop that uploads, so it has no ceiling anyone here controls.
 *
 * The shop is embedded rather than looked up per row, and `vendor_profiles`'
 * public-read policy does the filtering: a photo whose shop is unverified comes
 * back with a NULL embed and `shapeGalleryPage` withholds it instead of
 * rendering an uncredited tile. `total` counts approved rows and `withheld`
 * counts what we dropped, so "nobody has uploaded" and "we hold photos we
 * cannot credit" reach the couple as two different sentences.
 */
export async function fetchGalleryAssets(input: {
  slotKey: string;
  limit?: number;
  offset?: number;
}): Promise<GalleryPage> {
  const query = normalizeGalleryQuery(input);
  if (!query) throw new Error('No supplier gallery for that slot');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, count, error } = await supabase
    .from('moodboard_library_assets')
    .select(
      `asset_id, label, storage_path, vendor_profile_id,
       shop:vendor_profiles ( business_name, services ),
       ranges:moodboard_asset_color_ranges ( slot_id, sampled_hex )`,
      { count: 'exact' },
    )
    .eq('asset_type', SUPPLIER_GALLERY_ASSET_TYPE)
    .eq('asset_subtype', query.slotKey)
    .not('approved_at', 'is', null)
    .is('retired_at', null)
    .order('created_at', { ascending: false })
    .order('asset_id', { ascending: true })
    .range(query.offset, query.offset + query.limit - 1);
  // A failed read THROWS. The picker catches it and says so — an empty grid
  // that means "the fetch died" must never render as "no supplier has
  // uploaded", which is a real and different answer.
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as RawGalleryRow[];
  const { assets, withheld } = shapeGalleryPage(query.slotKey, rows);
  const total = count ?? 0;

  return {
    assets,
    total,
    withheld,
    offset: query.offset,
    limit: query.limit,
    hasMore: query.offset + query.limit < total,
  };
}

/**
 * Save one gallery photo into one inspiration slot — the couple's pick.
 *
 * 🔑 THE PROVENANCE IS THE WHOLE POINT, so it is written in the same INSERT
 * and the DATABASE refuses the row without it: `event_inspiration_assets_
 * gallery_pick_has_provenance` is a biconditional between
 * `source_kind = 'gallery_pick'` and `library_asset_id IS NOT NULL`. A future
 * edit that drops the id cannot merely lose the credit quietly — the insert
 * fails.
 *
 * The six hexes come from the asset's own sampled colours, cycled to six, and
 * an asset with none is refused rather than padded with invented colour (see
 * shapeGalleryPage). The colours are re-read HERE rather than trusted from the
 * client: the browser only ever received them as display swatches.
 */
export async function applyGalleryPick(input: {
  eventId: string;
  slotKey: string;
  slotPosition: number;
  assetId: string;
}): Promise<{ status: 'ok' | 'error'; imageUrl?: string; message?: string }> {
  if (!isMoodboardSlotKey(input.slotKey) || !slotHasSupplierTrade(input.slotKey)) {
    return { status: 'error', message: 'That slot has no supplier gallery.' };
  }
  if (!isMoodboardSlotPosition(input.slotPosition)) {
    return { status: 'error', message: 'That photo slot does not exist.' };
  }
  if (typeof input.assetId !== 'string' || input.assetId.length === 0) {
    return { status: 'error', message: 'Pick a photo first.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Re-read under the couple's own client, so RLS re-decides both halves: the
  // asset must be approved + un-retired AND its shop publicly readable. The
  // same shaping the picker used, so anything it would have withheld is
  // refused here too — the two cannot drift because they call one function.
  const { data: assetRow, error: assetErr } = await supabase
    .from('moodboard_library_assets')
    .select(
      `asset_id, label, storage_path, vendor_profile_id,
       shop:vendor_profiles ( business_name, services ),
       ranges:moodboard_asset_color_ranges ( slot_id, sampled_hex )`,
    )
    .eq('asset_id', input.assetId)
    .eq('asset_type', SUPPLIER_GALLERY_ASSET_TYPE)
    .eq('asset_subtype', input.slotKey)
    .not('approved_at', 'is', null)
    .is('retired_at', null)
    .maybeSingle();
  if (assetErr) return { status: 'error', message: assetErr.message };
  if (!assetRow) return { status: 'error', message: 'That photo is no longer available.' };

  const { assets } = shapeGalleryPage(input.slotKey, [
    assetRow as unknown as RawGalleryRow,
  ]);
  const asset = assets[0];
  if (!asset) {
    return { status: 'error', message: 'That photo is not ready to save yet.' };
  }

  // Replace-in-place, mirroring uploadMoodboardSlot: soft-delete whatever holds
  // this cell so the partial UNIQUE(event_id, slot_key, slot_position) WHERE
  // removed_at IS NULL lets the new row land.
  await supabase
    .from('event_inspiration_assets')
    .update({ removed_at: new Date().toISOString() })
    .eq('event_id', input.eventId)
    .eq('slot_key', input.slotKey)
    .eq('slot_position', input.slotPosition)
    .is('removed_at', null);

  const { error: insertErr } = await supabase.from('event_inspiration_assets').insert({
    event_id: input.eventId,
    added_by_user_id: user.id,
    slot_key: input.slotKey,
    slot_position: input.slotPosition,
    source_kind: 'gallery_pick',
    library_asset_id: asset.assetId,
    image_url: asset.imageUrl,
    sampled_hex_1: asset.swatches[0],
    sampled_hex_2: asset.swatches[1],
    sampled_hex_3: asset.swatches[2],
    sampled_hex_4: asset.swatches[3],
    sampled_hex_5: asset.swatches[4],
    sampled_hex_6: asset.swatches[5],
  });
  if (insertErr) return { status: 'error', message: insertErr.message };

  revalidatePath(`/dashboard/${input.eventId}/studio/mood-board`);
  return { status: 'ok', imageUrl: asset.imageUrl };
}

/* ══════════════════════════════════════════════════════════════════════════
   MB9 · THE INSPIRATION POOL — other couples' renders, as REFERENCE PHOTOS
   ══════════════════════════════════════════════════════════════════════════

   ⛔ THE CACHE IS CANCELLED. The original MB9 substituted a "close enough"
   prior render for a new one and told the couple it was free. Owner,
   2026-09-03: *"no need to give free renders. always charge for renders."*
   Neither function below reads `config_digest`, scores similarity, or returns
   a price, and neither can produce an image.

   🔑 THESE TWO ACTIONS LIVE HERE, BESIDE `applyGalleryPick`, AND NOT IN
   `render-actions.ts`. That file is the PAID path — it holds the credit read,
   the debit RPC and the provider call. Picking a reference is the same act as
   picking a florist's photo: one row in `event_inspiration_assets` and no
   other table touched. Putting it in the paid file would put it one import
   away from the machinery that spends money, which is exactly the distance
   `the-render-pool-pick-is-free.test.ts` measures.
*/

/**
 * One page of the cross-event inspiration pool for one slot.
 *
 * The RPC is the sanctioned door: `event_renders`' RLS is Pattern B and grants
 * a member their OWN event's rows only — the table's own migration header says
 * cross-event reads must go through a SECURITY DEFINER function "never by
 * widening this policy". The function returns four columns and nothing that
 * would say whose wedding it was.
 *
 * 🛑 CAPPED TWICE, AND NEITHER CAP IS THE CALLER'S. `normalizeRenderPoolQuery`
 * clamps whatever arrives (including nothing, NaN, Infinity, a negative) and
 * the SQL clamps again inside the function. There is no code path here that
 * reads the pool unbounded.
 *
 * 🔒 THE URL IS MINTED FROM `gallery_image_key`, WHICH IS THE WATERMARKED COPY.
 * The RPC does not return `image_key` at all, so there is no unmarked key in
 * this function's reach to sign by mistake.
 */
export async function fetchRenderPool(input: {
  eventId: string;
  slotKey: string;
  limit?: number;
  offset?: number;
}): Promise<RenderPoolPage> {
  const query = normalizeRenderPoolQuery(input);
  if (!query) throw new Error('Not an inspiration slot');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('moodboard_inspiration_pool', {
    p_event_id: input.eventId,
    p_part_ids: query.partIds,
    p_limit: query.limit,
    p_offset: query.offset,
    p_render_id: null,
  });
  // A failed read THROWS. The picker catches it and says so — an empty grid
  // that means "the fetch died" must never render as "nobody has shared a
  // render", which is a real and different answer.
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as RawPoolRow[];
  const { renders, withheld, total } = await shapeRenderPoolPage(rows, (key) =>
    r2SignedGet({ bucket: R2_BUCKETS[RENDER_BUCKET_KEY], key, expiresIn: 60 * 60 }).catch(
      () => null,
    ),
  );

  return {
    renders,
    total,
    withheld,
    offset: query.offset,
    limit: query.limit,
    hasMore: query.offset + query.limit < total,
  };
}

/**
 * Save one pooled render into one inspiration slot.
 *
 * 🔑 THIS COSTS NOTHING AND CANNOT COST ANYTHING. It reads no config, calls no
 * provider, and touches neither `event_render_credit_usage` nor
 * `moodboard_begin_render`. What it writes is one `event_inspiration_assets`
 * row — the same table, the same shape and the same replace-in-place as a
 * photo the couple uploaded themselves. Held by
 * `the-render-pool-pick-is-free.test.ts`, which reads this function's body.
 *
 * ADMISSION IS RE-CHECKED THROUGH THE SAME PREDICATE the browse used:
 * `moodboard_inspiration_pool` with `p_render_id` set. So a render whose event
 * withdrew consent, or that an admin quarantined, between the picker opening
 * and the couple tapping Save is refused here — and the two checks cannot
 * drift, because there is only one.
 *
 * ⚠ THE BYTES ARE COPIED, NOT LINKED. The pool's URL is a one-hour presigned
 * GET of a PRIVATE object; storing it in `image_url` (which is NOT NULL and
 * permanent) would give the couple a tile that goes dead in an hour and looks
 * like a deleted photo. So the WATERMARKED bytes are copied into this couple's
 * own `inspiration/<eventId>/` prefix in the public bucket, exactly where their
 * own uploads live — which is also what the tile now is.
 */
export async function applyRenderPick(input: {
  eventId: string;
  slotKey: string;
  slotPosition: number;
  renderId: string;
}): Promise<{ status: 'ok' | 'error'; imageUrl?: string; message?: string }> {
  if (!isMoodboardSlotKey(input.slotKey)) {
    return { status: 'error', message: 'That slot does not exist.' };
  }
  if (!isMoodboardSlotPosition(input.slotPosition)) {
    return { status: 'error', message: 'That photo slot does not exist.' };
  }
  if (typeof input.renderId !== 'string' || input.renderId.length === 0) {
    return { status: 'error', message: 'Pick a photo first.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('moodboard_inspiration_pool', {
    p_event_id: input.eventId,
    p_part_ids: null,
    p_limit: 1,
    p_offset: 0,
    p_render_id: input.renderId,
  });
  if (error) return { status: 'error', message: error.message };
  const row = ((data ?? []) as RawPoolRow[])[0];
  if (!row) return { status: 'error', message: 'That photo is no longer available.' };

  // The same shaping the picker used, so anything it would have withheld — a
  // render with no palette to sample — is refused here too rather than written
  // to the board with six invented colours.
  const shaped = await shapeRenderPoolPage([row], async (key) => key);
  const picked = shaped.renders[0];
  if (!picked) return { status: 'error', message: 'That photo is not ready to save yet.' };

  if (!isR2Configured()) {
    return { status: 'error', message: 'Saving photos is unavailable right now.' };
  }

  let publicUrl: string;
  const destinationKey = pickedRenderObjectKey(input.eventId, input.renderId);
  try {
    // Read the WATERMARKED object's bytes server-side and re-upload them under
    // this couple's own prefix. Not `r2Copy`: that helper copies within ONE
    // bucket, and this crosses from the private bucket to the public one — the
    // only crossing in the whole path, and it happens only for a render whose
    // event has consented to exactly this.
    const source = await r2GetBytes({
      bucket: R2_BUCKETS[RENDER_BUCKET_KEY],
      key: row.gallery_image_key!,
    });
    publicUrl = await r2Upload({
      bucket: R2_BUCKETS.media,
      key: destinationKey,
      body: source.bytes,
      contentType: source.contentType ?? 'image/jpeg',
    });
  } catch {
    return { status: 'error', message: 'Could not save that photo — try again.' };
  }

  // Replace-in-place, mirroring uploadMoodboardSlot and applyGalleryPick: the
  // partial UNIQUE(event_id, slot_key, slot_position) WHERE removed_at IS NULL
  // needs the cell freed before the new row lands.
  await supabase
    .from('event_inspiration_assets')
    .update({ removed_at: new Date().toISOString() })
    .eq('event_id', input.eventId)
    .eq('slot_key', input.slotKey)
    .eq('slot_position', input.slotPosition)
    .is('removed_at', null);

  const { error: insertErr } = await supabase.from('event_inspiration_assets').insert({
    event_id: input.eventId,
    added_by_user_id: user.id,
    slot_key: input.slotKey,
    slot_position: input.slotPosition,
    // The database refuses this row without `source_render_id`: the
    // biconditional CHECK `(source_kind = 'render_pick') = (source_render_id IS
    // NOT NULL)` makes a reference that forgot what it references
    // unrepresentable, exactly as MB10's gallery_pick provenance does.
    source_kind: 'render_pick',
    source_render_id: input.renderId,
    image_url: publicUrl,
    r2_key: destinationKey,
    sampled_hex_1: picked.swatches[0],
    sampled_hex_2: picked.swatches[1],
    sampled_hex_3: picked.swatches[2],
    sampled_hex_4: picked.swatches[3],
    sampled_hex_5: picked.swatches[4],
    sampled_hex_6: picked.swatches[5],
  });
  if (insertErr) return { status: 'error', message: insertErr.message };

  revalidatePath(`/dashboard/${input.eventId}/studio/mood-board`);
  return { status: 'ok', imageUrl: publicUrl };
}
