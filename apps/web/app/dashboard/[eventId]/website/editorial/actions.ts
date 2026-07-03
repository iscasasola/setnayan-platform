'use server';

// Server action for the consolidated Editorial editor (iteration 0046). Writes
// the couple's content overrides + section visibility into
// `event_editorial.draft_json` (the compose engine already prefers these fields
// over its auto-written defaults) and the draft/published status. Host
// membership is verified on the user session; the upsert itself runs through the
// admin client because event_editorial is owned by the server-side composer
// (the couple has no direct write RLS on it) — same trust model as the data
// loader. Existing draft_json keys we don't manage (e.g. seeded `reviews`) are
// preserved by merging rather than replacing.

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { scanEditorial } from '@/lib/editorial-scan';
import {
  EDITORIAL_SECTION_KEYS,
  type ChapterOverride,
  type EditorialSections,
} from '@/app/[slug]/_components/editorial/data';

async function hostUserId(eventId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: moderator } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  if (moderator) return user.id;

  const { data: legacy } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  return legacy?.member_type === 'couple' ? user.id : null;
}

export type EditorialEditorInput = {
  headline: string;
  deck: string;
  superKicker: string;
  byline: string;
  leadParagraphs: string; // raw textarea — split on blank lines
  pullQuote: string;
  sections: EditorialSections;
  // "As the Day Unfolded" per-chapter curation. The ARRAY ORDER is the couple's
  // chosen chapter order; only rows that DIFFER from the auto default are sent (an
  // untouched chapter carries no override row). Each targets a chapter by leadId.
  chapterOverrides: ChapterOverride[];
  publish: boolean;
};

/** Cap the persisted per-moment story so a runaway paste can't bloat draft_json.
 *  The editor soft-caps at ~400 chars with a counter; this is the hard ceiling. */
const CHAPTER_WRITEUP_MAX = 600;
/** Cap the moment name. Comfortably past the longest canonical moment. */
const CHAPTER_TITLE_MAX = 80;

/**
 * Sanitize + cap the client's chapterOverrides before persisting.
 *
 * The client sends an override row per chapter ONLY when the couple has made any
 * change (rename / write-up / hide / reorder) — and because the loader front-loads
 * overridden chapters in array order, a reorder REQUIRES the full ordered set (a
 * bare `{ leadId }` row holds a chapter's position without renaming it). So this
 * KEEPS bare rows (they carry order), dedupes by leadId, and trims + caps text.
 * When the couple has made no changes at all the client sends `[]` and the key is
 * deleted (no override row → pure auto behaviour). Malformed rows are dropped.
 */
function sanitizeChapterOverrides(input: ChapterOverride[]): ChapterOverride[] {
  if (!Array.isArray(input)) return [];
  const out: ChapterOverride[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const leadId = typeof raw?.leadId === 'string' ? raw.leadId.trim() : '';
    if (!leadId || seen.has(leadId)) continue;
    const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, CHAPTER_TITLE_MAX) : '';
    const writeUp =
      typeof raw.writeUp === 'string' ? raw.writeUp.trim().slice(0, CHAPTER_WRITEUP_MAX) : '';
    const hidden = raw.hidden === true;
    seen.add(leadId);
    out.push({
      leadId,
      ...(title ? { title } : {}),
      ...(writeUp ? { writeUp } : {}),
      ...(hidden ? { hidden: true } : {}),
    });
  }
  return out;
}

export async function saveEditorial(
  eventId: string,
  input: EditorialEditorInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await hostUserId(eventId);
  if (!userId) return { ok: false, error: 'You don’t have access to this wedding.' };

  const admin = createAdminClient();

  // Merge into whatever draft_json already exists (preserve unmanaged keys).
  const { data: existing } = await admin
    .from('event_editorial')
    .select('draft_json, published_at')
    .eq('event_id', eventId)
    .maybeSingle();
  const base =
    existing?.draft_json && typeof existing.draft_json === 'object'
      ? (existing.draft_json as Record<string, unknown>)
      : {};

  const t = (s: string) => s.trim();
  const draft: Record<string, unknown> = { ...base };
  // Only persist non-empty overrides — blank fields let the engine auto-write.
  const setOrDrop = (key: string, value: string) => {
    const v = t(value);
    if (v) draft[key] = v;
    else delete draft[key];
  };
  setOrDrop('headline', input.headline);
  setOrDrop('deck', input.deck);
  setOrDrop('super', input.superKicker);
  setOrDrop('byline', input.byline);
  setOrDrop('pull_quote', input.pullQuote);

  const paras = input.leadParagraphs
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paras.length) draft.lead_paragraphs = paras;
  else delete draft.lead_paragraphs;

  // Section visibility map (only `false` hides; default-on otherwise).
  const sections: Record<string, boolean> = {};
  for (const key of EDITORIAL_SECTION_KEYS) sections[key] = input.sections[key] !== false;
  draft.sections = sections;

  // "As the Day Unfolded" per-chapter curation. Persist the ordered, sanitized
  // set; an empty result deletes the key so the chapters revert to pure auto.
  const chapterOverrides = sanitizeChapterOverrides(input.chapterOverrides);
  if (chapterOverrides.length) draft.chapterOverrides = chapterOverrides;
  else delete draft.chapterOverrides;

  const nowIso = new Date().toISOString();
  const { error } = await admin.from('event_editorial').upsert(
    {
      event_id: eventId,
      draft_json: draft,
      status: input.publish ? 'published' : 'draft',
      edited_by_couple: true,
      published_at: input.publish ? (existing?.published_at ?? nowIso) : existing?.published_at ?? null,
      updated_at: nowIso,
    },
    { onConflict: 'event_id' },
  );
  if (error) return { ok: false, error: 'Could not save. Please try again.' };

  const { data: ev } = await admin
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();

  revalidatePath(`/dashboard/${eventId}/website/editorial`);
  revalidatePath(`/dashboard/${eventId}/website`);
  if (ev?.slug) {
    revalidatePath(`/${ev.slug}`);
  }

  // Fire quality scan in the background after the response is sent.
  // Only triggers when the editorial is in the default 'pending' state
  // (first save). Re-scans are triggered from the admin review queue.
  const { data: saved } = await admin
    .from('event_editorial')
    .select('editorial_id, scan_status')
    .eq('event_id', eventId)
    .maybeSingle();
  if (saved?.scan_status === 'pending') {
    const eid = saved.editorial_id;
    after(() => scanEditorial(eid));
  }

  return { ok: true };
}

/**
 * Real Stories showcase consent, co-located on the editorial editor so the
 * couple can publish AND choose to be featured in one place (instead of hunting
 * for the separate privacy-page toggle). Mirrors `setShowcaseConsent` in
 * website/privacy/actions.ts — sets/clears the caller's OWN
 * `users.public_summary_consent_at` via the admin client (the users self-update
 * path isn't exposed to the auth client), gated on host membership.
 *
 * RA 10173: consent stays an EXPLICIT, reversible opt-in — this only flips the
 * couple's own flag when they ask. It deliberately does NOT touch
 * `landing_page_visibility`; a private page still won't surface (the
 * loadPublishedShowcases `!= 'private'` guard), and the editor surfaces that
 * caveat rather than silently making the page public.
 *
 * Wedding-gated on opt-IN (server-side, behind the wedding-only UI toggle):
 * `public_summary_consent_at` is a per-USER flag and Real Stories only
 * aggregates weddings (loadPublishedShowcases filters event_type='wedding'), so
 * a non-wedding event must not be able to flip it (a direct action call would
 * otherwise set consent that affects the user's OTHER wedding events). Opt-OUT
 * is always allowed.
 */
export async function setStoryShowcase(
  eventId: string,
  optIn: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await hostUserId(eventId);
  if (!userId) return { ok: false, error: 'You don’t have access to this wedding.' };

  const admin = createAdminClient();

  if (optIn) {
    const { data: ev } = await admin
      .from('events')
      .select('event_type')
      .eq('event_id', eventId)
      .maybeSingle();
    if (((ev?.event_type as string | null) ?? 'wedding') !== 'wedding') {
      return { ok: false, error: 'Real Stories features weddings only.' };
    }
  }

  const { error } = await admin
    .from('users')
    .update({ public_summary_consent_at: optIn ? new Date().toISOString() : null })
    .eq('user_id', userId);
  if (error) return { ok: false, error: 'Could not update. Please try again.' };

  revalidatePath(`/dashboard/${eventId}/website/editorial`);
  revalidatePath(`/dashboard/${eventId}/website/privacy`);
  return { ok: true };
}
