'use server';

/**
 * Server action for the Website Pro "Site colours" editor (Launch settings-first
 * design · Design_Launch_Settings_2026-07-24 §4.4 · PR-C). Writes two NET-NEW
 * columns — events.site_bg_color + events.site_button_color (#rrggbb hex or NULL
 * · migration 20270930244819) — which override the Mood-Board-derived
 * --color-cream / --color-mulberry tokens on the couple's guest site.
 *
 * Auth mirrors the Our Photos / hero-photo editors: host membership via
 * event_moderators (canonical) OR the legacy event_members couple row, through
 * the shared requireHostMembership gate.
 *
 * Pro gate: these are Website Pro perks. The EDITOR page renders a locked
 * upsell when the event doesn't own Website Pro, but the action is also the
 * enforcement point of last resort — it re-checks eventCoupleWebsiteProActive
 * and refuses to persist for a non-Pro event (defence-in-depth; a non-Pro save
 * would be inert on the guest site anyway, since the renderer gates on Pro too).
 *
 * Validation: each field is either a strict `#rrggbb` hex OR empty. Empty
 * CLEARS the column (→ NULL → the site falls back to the Mood-Board palette /
 * brand default for that role). Anything malformed bounces with an error and
 * writes nothing.
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireHostMembership } from '@/lib/host-gate';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { revalidateGuestSite, revalidateWebsiteEditor } from '@/lib/revalidate-site';

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Normalise a form field to a lowercased `#rrggbb`, `null` (cleared), or the
 *  sentinel `false` for a malformed value the caller must reject. */
function parseHexField(raw: FormDataEntryValue | null): string | null | false {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (v === '') return null; // empty = clear the column
  return HEX.test(v) ? v.toLowerCase() : false;
}

export async function updateSiteColors(
  eventId: string,
  formData: FormData,
): Promise<void> {
  await requireHostMembership(eventId);

  // Defence-in-depth Pro gate — the page already shows a locked upsell to
  // non-Pro couples; refuse the write too. Admin client: orders RLS is
  // purchaser-scoped, so a co-host who didn't place the order still resolves
  // the shared event ownership (same reason the buy pages use admin).
  const proActive = await eventCoupleWebsiteProActive(createAdminClient(), eventId);
  if (!proActive) {
    redirect(`/dashboard/${eventId}/studio/website-pro`);
  }

  const bg = parseHexField(formData.get('bg_color'));
  const button = parseHexField(formData.get('button_color'));

  if (bg === false || button === false) {
    redirect(
      `/dashboard/${eventId}/website/colors?error=${encodeURIComponent(
        'Please use a 6-digit hex colour like #A9834B, or leave it blank to use your palette.',
      )}`,
    );
  }

  const supabase = await createClient();
  const { data: event, error } = await supabase
    .from('events')
    .update({ site_bg_color: bg, site_button_color: button })
    .eq('event_id', eventId)
    .select('slug')
    .maybeSingle();

  if (error) {
    redirect(
      `/dashboard/${eventId}/website/colors?error=${encodeURIComponent(
        'Could not save. Please try again.',
      )}`,
    );
  }

  revalidateWebsiteEditor(eventId, 'colors');
  revalidateGuestSite(event?.slug);
  redirect(`/dashboard/${eventId}/website/colors?saved=1`);
}
