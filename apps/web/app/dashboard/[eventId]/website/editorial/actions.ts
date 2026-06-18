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
  publish: boolean;
};

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
