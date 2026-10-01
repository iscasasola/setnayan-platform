'use server';

/**
 * Server action for the dress-code editor (CLAUDE.md 2026-05-22).
 *
 * Reads the host's form submission, validates it against the same shape the
 * landing-page renderer expects (`apps/web/app/[slug]/page.tsx` DressCodeWidget),
 * stamps `events.dress_code_config`, and revalidates both the dashboard hub +
 * the public slug URL so the change shows up on the guest-facing page without
 * waiting for a redeploy.
 *
 * Validation lives server-side here (NOT just client-side) because the form
 * fields are simple HTML inputs — anyone POSTing a longer-than-80-char title
 * or a 100-item dos[] would otherwise blow the JSONB column up. Limits match
 * the migration comment in 20260605030000_events_dress_code_config.sql.
 */
import { landAfterWrite } from '@/lib/maker-land.server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  ATTIRE_STYLES,
  isAttireStyle,
  sanitizeCallTime,
  type RoleAttireMap,
  type RoleAttireRule,
} from '@/lib/role-dress-code';
import { sanitizeGroupAttire, type GroupAttireMap } from '@/lib/role-group-dress-code';
import { roleLabel } from '@/lib/entourage';
import type { GuestRole } from '@/lib/guests';
import { getCurrentUser } from '@/lib/auth';
import { requireHostMembership } from '@/lib/host-gate';
import { draftEventsAndReturn, draftedEventColumn, isHubDraftWrite } from '@/lib/hub-draft-store';
import { detailsItemHref } from '@/lib/maker-details-items';

// Hard caps — keep in sync with the migration comment AND the editor UI hints.
const TITLE_MAX = 80;
const DESCRIPTION_MAX = 600;
const LIST_ITEM_MAX = 80;
const LIST_LENGTH_MAX = 8;
const PALETTE_LENGTH_MAX = 6;
const SWATCH_NAME_MAX = 32;
const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;
const NOT_SAVED = 'Not saved — this account can’t change the dress code. Ask the couple to save it.';

export type DressCodeConfig = {
  title: string;
  description: string;
  dos: string[];
  donts: string[];
  palette: { name: string; hex: string }[];
  /** Per-role attire, owner 2026-09-20 — lib/role-dress-code.ts. */
  roles: RoleAttireMap;
  /**
   * Per-GROUP attire — the coarse tier above `roles`.
   *
   * 🔑 BOTH TIERS ARE STORED; neither is derived from the other. `roles` is the
   * override and must survive a group edit untouched, or a couple loses a
   * months-old answer they wrote for one ninang. `resolveAttireFor` decides
   * which one a reader gets, and it is the ONLY place that decides.
   */
  groups: GroupAttireMap;
  /**
   * 👗 THE OUTFIT FIGURE, ON OR OFF (owner 2026-09-30: *"they can opt not to
   * add this"*). The small drawn person above the colour chips on the guest's
   * dress-code scene (`RoleFigure`). ON unless the couple turned it off — an
   * absent key reads as `true`, so every event saved before this switch keeps
   * today's look.
   */
  show_figure: boolean;
};

/**
 * Coerce a FormData value to a string + trim. Empty string is the
 * canonical "absent" — the landing-page renderer's empty-state branch
 * triggers when every field is empty/zero-length.
 */
function asString(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Read repeated form fields (e.g. `dos[]`) into a string array,
 * dropping blanks and clamping each entry's length + the list length.
 *
 * The editor renders N rows for dos / donts / palette and submits the
 * values via repeated form fields. This helper survives both arrays
 * (`getAll('dos')`) and missing-entirely (returns empty array).
 */
function readList(formData: FormData, name: string, maxItem: number, maxLen: number): string[] {
  return formData
    .getAll(name)
    .map((v) => (typeof v === 'string' ? v.trim().slice(0, maxItem) : ''))
    .filter((s) => s.length > 0)
    .slice(0, maxLen);
}

/**
 * Update the host's dress-code config. Auth + RLS enforce that only event
 * members (couple / host moderators) can write — the server action runs
 * with the host's JWT, not the admin client.
 *
 * Errors redirect back to the editor with `?error=...`; success redirects
 * back with `?saved=1` so the page can show a polite confirmation chip.
 */
export async function updateDressCode(
  eventId: string,
  formData: FormData,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // ----- Parse + validate ------------------------------------------------
  const title = asString(formData.get('title')).slice(0, TITLE_MAX);
  const description = asString(formData.get('description')).slice(0, DESCRIPTION_MAX);
  const dos = readList(formData, 'dos', LIST_ITEM_MAX, LIST_LENGTH_MAX);
  const donts = readList(formData, 'donts', LIST_ITEM_MAX, LIST_LENGTH_MAX);
  // 👗 The figure switch posts a hidden 'off' and, when ticked, an 'on' after it
  // (`dress-code-fields.tsx`). Nothing posted at all (some other form) keeps it
  // ON — the default is today's look, never a silent removal.
  const figureValues = formData.getAll('show_figure');
  const show_figure = figureValues.length === 0 || figureValues.includes('on');

  // Palette comes in as two parallel arrays — palette_name[] and palette_hex[]
  // submitted by the editor's dynamic swatch rows. Zip them, drop empty pairs,
  // reject malformed hex (the rest of the row would still save).
  const paletteNames = formData
    .getAll('palette_name')
    .map((v) => (typeof v === 'string' ? v.trim().slice(0, SWATCH_NAME_MAX) : ''));
  const paletteHexes = formData
    .getAll('palette_hex')
    .map((v) => (typeof v === 'string' ? v.trim() : ''));

  // ── PER-ROLE ATTIRE (owner 2026-09-20). Two parallel arrays, same idiom as
  // the palette above: role_key[] and role_style[], plus an optional note.
  // An empty style means "not set" and REMOVES the role's instruction — the
  // couple must be able to take back a wrong answer, and an unset role renders
  // as "not said yet" rather than as a stale one.
  const roleKeys = formData.getAll('role_key').map((v) => String(v));
  const roleStyles = formData.getAll('role_style').map((v) => String(v));
  const roleNotes = formData.getAll('role_note').map((v) => String(v));
  // ⏰ The fourth parallel array (owner 2026-09-23). `sanitizeCallTime` accepts
  // `HH:MM` and NOTHING else — a half-read "7" repaired into 07:00 is a wrong
  // alarm, which is worse than no alarm. An unreadable value drops to null and
  // the role simply carries no time.
  const roleCallTimes = formData.getAll('role_call_time').map((v) => String(v));
  const roles: RoleAttireMap = {};
  for (let i = 0; i < roleKeys.length; i += 1) {
    const key = roleKeys[i] ?? '';
    const style = roleStyles[i] ?? '';
    if (!key || roleLabel(key as GuestRole) === null) continue;
    if (!isAttireStyle(style)) continue; // '' = not set → no entry
    const note = (roleNotes[i] ?? '').trim().slice(0, 120);
    const callTime = sanitizeCallTime(roleCallTimes[i]);
    const rule: RoleAttireRule = { style };
    if (note) rule.note = note;
    if (callTime) rule.callTime = callTime;
    roles[key as GuestRole] = rule;
  }
  // ── PER-GROUP ATTIRE. The same four-parallel-array idiom, one tier coarser.
  // Built raw and then handed to `sanitizeGroupAttire`, so the editor's save
  // path and the reader's parse path validate through ONE function — a group
  // this build does not know is dropped in both places or in neither.
  const groupKeys = formData.getAll('group_key').map((v) => String(v));
  const groupStyles = formData.getAll('group_style').map((v) => String(v));
  const groupNotes = formData.getAll('group_note').map((v) => String(v));
  const groupCallTimes = formData.getAll('group_call_time').map((v) => String(v));
  const rawGroups: Record<string, unknown> = {};
  for (let i = 0; i < groupKeys.length; i += 1) {
    const key = groupKeys[i] ?? '';
    if (!key) continue;
    // '' = "Not set" → no entry, which REMOVES the group's instruction. A couple
    // must be able to take back a wrong answer for a whole group as easily as
    // for one person.
    rawGroups[key] = {
      style: groupStyles[i] ?? '',
      note: groupNotes[i] ?? '',
      callTime: groupCallTimes[i] ?? '',
    };
  }
  const groups = sanitizeGroupAttire(rawGroups);

  void ATTIRE_STYLES;

  const palette: { name: string; hex: string }[] = [];
  for (let i = 0; i < Math.min(paletteNames.length, paletteHexes.length); i += 1) {
    const name = paletteNames[i] ?? '';
    const hex = paletteHexes[i] ?? '';
    if (!name && !hex) continue; // empty row — skip
    if (!HEX_PATTERN.test(hex)) {
      redirect(
        `/dashboard/${eventId}/website/dress-code?error=${encodeURIComponent(`Palette swatch ${i + 1}: hex must look like #RRGGBB.`)}`,
      );
    }
    palette.push({ name: name || hex.toUpperCase(), hex: hex.toUpperCase() });
    if (palette.length >= PALETTE_LENGTH_MAX) break;
  }

  const config: DressCodeConfig = {
    title,
    description,
    dos,
    donts,
    palette,
    roles,
    groups,
    show_figure,
  };

  // ----- The draft door (the Event Hub Maker · `<HubDraftField />`) --------
  // The same validated config, into the couple's draft; guests keep the live
  // dress code until Apply.
  if (isHubDraftWrite(formData)) {
    await requireHostMembership(eventId);
    return draftEventsAndReturn(
      eventId,
      { dress_code_config: config },
      formData,
      `/dashboard/${eventId}/website/editor?open=dress-code`,
    );
  }

  // ----- Persist ----------------------------------------------------------
  const supabase = await createClient();
  const { data: written, error } = await supabase
    .from('events')
    .update({
      dress_code_config: config,
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
    .select('event_id');

  if (error) {
    redirect(
      `/dashboard/${eventId}/website/dress-code?error=${encodeURIComponent(error.message)}`,
    );
  }
  // 🔑 A ZERO-ROW UPDATE IS NOT A SAVE. The live row is writable only by the
  // couple (`couple_can_update_event`); anyone else's UPDATE matches nothing,
  // raises nothing — and used to be told "Saved".
  if (!written || written.length === 0) {
    redirect(
      `/dashboard/${eventId}/website/dress-code?error=${encodeURIComponent(NOT_SAVED)}`,
    );
  }

  // Revalidate the dashboard hub so its preview iframe + the public slug
  // page both reflect the new dress code on the next render.
  revalidatePath(`/dashboard/${eventId}/website`);
  revalidatePath(`/dashboard/${eventId}/website/dress-code`);

  // Pull the slug so we can revalidate the public landing page too.
  const { data: event } = await supabase
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();
  if (event?.slug) {
    revalidatePath(`/${event.slug}`);
  }

  return landAfterWrite(formData, `/dashboard/${eventId}/website/dress-code?saved=1`, '?saved=1');
}

/**
 * ✅ THE DO'S AND DON'TS ALONE — the Mood Board's copy of the two lists (owner
 * 2026-09-30: *"do's and don'ts should be on the mood board as well"*).
 *
 * ONE SOURCE: the same `events.dress_code_config.dos` / `.donts` the guest's
 * dress-code scene reads and the Dress code editor writes — never a second
 * copy. Only the two lists come from the form; every other field of the
 * config is read back and kept, because `updateDressCode` rebuilds the WHOLE
 * config from what is posted, and a form holding only the lists would wipe the
 * headline, the palette and every role's outfit.
 *
 * From the Maker (`HubDraftField`) it merges into the DRAFT — the same place the
 * Dress code scene saves — so an edit in either place shows in the other, and
 * guests meet it at Apply. From the Mood Board's own page it writes live.
 */
export async function updateDressCodeLists(eventId: string, formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const dos = readList(formData, 'dos', LIST_ITEM_MAX, LIST_LENGTH_MAX);
  const donts = readList(formData, 'donts', LIST_ITEM_MAX, LIST_LENGTH_MAX);
  const supabase = await createClient();

  if (isHubDraftWrite(formData)) {
    await requireHostMembership(eventId);
    // Build on the DRAFTED config when there is one (a failed read throws —
    // building on live then would overwrite the couple's drafted dress code).
    const drafted = await draftedEventColumn(eventId, 'dress_code_config');
    let base: unknown = drafted.drafted ? drafted.value : null;
    if (!drafted.drafted) {
      const { data, error } = await supabase
        .from('events')
        .select('dress_code_config')
        .eq('event_id', eventId)
        .maybeSingle();
      if (error || !data) throw new Error('The dress code could not be read just now. Nothing was changed.');
      base = (data as { dress_code_config: unknown }).dress_code_config;
    }
    return draftEventsAndReturn(
      eventId,
      { dress_code_config: withLists(base, dos, donts) },
      formData,
      detailsItemHref(eventId, 'mood-board'),
    );
  }

  const back = `/dashboard/${eventId}/studio/mood-board`;
  const { data: current, error: readError } = await supabase
    .from('events')
    .select('dress_code_config, slug')
    .eq('event_id', eventId)
    .maybeSingle();
  if (readError || !current) {
    redirect(`${back}?error=${encodeURIComponent('The dress code could not be read just now. Nothing was changed.')}`);
  }
  const row = current as { dress_code_config: unknown; slug: string | null };
  const { data: written, error } = await supabase
    .from('events')
    .update({
      dress_code_config: withLists(row.dress_code_config, dos, donts),
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
    .select('event_id');
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  if (!written || written.length === 0) redirect(`${back}?error=${encodeURIComponent(NOT_SAVED)}`);

  revalidatePath(`/dashboard/${eventId}/website/dress-code`);
  revalidatePath(back);
  if (row.slug) revalidatePath(`/${row.slug}`);
  return landAfterWrite(formData, `${back}?saved=1`, '?saved=1');
}

/** `config` with its two lists replaced and every other key kept as stored. */
function withLists(config: unknown, dos: string[], donts: string[]): Record<string, unknown> {
  const base = config && typeof config === 'object' && !Array.isArray(config) ? (config as Record<string, unknown>) : {};
  return { ...base, dos, donts };
}
