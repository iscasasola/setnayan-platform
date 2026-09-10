/**
 * rail-data.ts — everything the SHARED rail needs from the server: who is
 * looking, the Studio group, and the marketplace folders.
 *
 * EXTRACTED FROM `front-door.tsx` 2026-08-13 (One Shell slice 0), unchanged in
 * behaviour. It moved because the rail now renders in two places — the public
 * front door and the signed-in account surfaces — and "which consoles does
 * this person hold" must have ONE answer. A second copy in the dashboard
 * layouts would have drifted the first time either side gained a row, and the
 * shop row's own history says so: it was gated on owning a `vendor_profiles`
 * row while `/vendor-dashboard` admits an owner OR a team member, so a hired
 * team member could open the console and be offered no door to it.
 *
 * ⚠ IMPORTING THIS DOES NOT PULL THE FEED. That is the point of the split —
 * the dashboard layouts need the account and the tools, and nothing else in
 * `front-door.tsx`.
 */
import 'server-only';
import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import { fetchUserRoleSummary } from '@/lib/roles';
import { fetchUserEvents } from '@/lib/events';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import {
  WEDDING_FOLDER_LABEL,
  WEDDING_FOLDER_SLUG,
  type WeddingFolder,
} from '@/lib/taxonomy';
import { FOLDER_SERVICE_COUNT } from '@/lib/taxonomy-folder-counts';

import { resolveProfile, type EventTypeProfile } from '@/lib/event-type-profile';
import { STUDIO_APPS } from '@/lib/studio-apps';
/*
  🔑 THE PURE ROW BUILDERS LIVE IN `lib/studio-rail.ts`, NOT HERE, and the
  reason is testability rather than tidiness: this module is `server-only`, so
  anything importing it — including a plain node test — dies on that import.
  The builders are pure functions over STUDIO_APPS with no session and no I/O,
  so they had no business behind that boundary. Re-exported so every existing
  import path keeps working.
*/
export {
  railToolsSignedIn,
  railToolsSignedOut,
  RAIL_TOOLS,
} from '@/lib/studio-rail';

import type { FrontDoorAccount, RailFolder, RailTool } from './front-door-shell';

/**
 * One marketplace folder, as the rail renders it.
 *
 * Shared for the same reason the account resolver is: the count beside each
 * name is a promise, and two copies of this mapping is two chances for the
 * public page and the signed-in page to quote different numbers for the same
 * category.
 */
export function toRailFolder(f: WeddingFolder): RailFolder {
  return {
    slug: WEDDING_FOLDER_SLUG[f],
    label: WEDDING_FOLDER_LABEL[f],
    count: FOLDER_SERVICE_COUNT[f] ?? 0,
  };
}

/**
 * The Studio group — ONE ROW PER PRODUCT, TWO BEHAVIOURS.
 *
 * Owner, 2026-08-14: *"the side menu when signed out, it will be able to show
 * demo. when logged in, it will be different view."*
 *
 *   SIGNED OUT → the row is a shop window. Where a live demo exists it OPENS
 *                THE DEMO; a stranger's question is "what is this?", and the
 *                demo answers it better than a page of copy. Every row also
 *                carries one line saying what the product does.
 *   SIGNED IN  → the row is a door into a thing they already own, and it must
 *                not send them back out to read marketing about a product they
 *                are paying for.
 *
 * 🔑 IT IS ONE ROW, NOT TWO — the same shape the shop and HQ rows already use.
 * A separate "demo" row would double the group for signed-out visitors and go
 * dead for everyone else.
 *
 * ⚠ SEVEN ROWS, EIGHT DOORWAYS. Alaala is the eighth public doorway but it
 * lives in the ACCOUNT SLOT ("What is Alaala?" signed out, "Alaala" signed
 * in), exactly as the prototype has it — so it is not repeated here.
 *
 * 🪤 PAKANTA IS DELIBERATELY ABSENT. It is sold, and it is reachable only from
 * inside the app — it has no public page. A row that goes nowhere is the one
 * thing this page forbids, so putting it here would be a fake door.
 * `doorway-invariants.test.ts` pins the eight that DO have public pages.
 */

/**
 * WHICH EVENT A SIGNED-IN PERSON'S STUDIO ROWS SHOULD OPEN — or none.
 *
 * Returns the single organiser event when there is exactly one, and `null`
 * otherwise. `null` is a REAL ANSWER with two meanings the caller distinguishes
 * by nothing: with no events the rows keep their public pages (the page that
 * explains the product is what somebody without an event needs), and with
 * several the rows point at `/dashboard`, the board that IS the picker.
 *
 * 🔑 IT NEVER GUESSES `events[0]`. That would open somebody's OTHER wedding,
 * and the guest-doors work already settled that a door opening onto the wrong
 * thing — or onto a refusal — is worse than a door that asks.
 *
 * Every read is React `cache()`d at source and shared with the rail's account
 * resolver and the command index, so this adds no round trip. It fails soft to
 * `{ eventId: null, count: 0 }`: a rail that throws is a blank page, and a rail
 * pointing at public pages is a correct one.
 */
export const resolveRailStudioEvent = cache(
  async (
    /*
      ─── THE EVENT YOU ARE STANDING IN WINS ────────────────────────────────
      Owner, 2026-08-21: *"what we want is for that Studio to still show on the
      sidebar, but now it is link to that event."*

      Without this the rows can only guess, and the guess is deliberately timid:
      somebody with two weddings gets sent to the board to pick, even while they
      are already inside one of them. That was right when nothing knew which
      event was open. The event layout knows, so it says.

      🔒 IT IS STILL CHECKED, NEVER TRUSTED. The id is matched against the
      person's OWN organiser events below; an id they do not organise falls
      through to the count-based answer exactly as before. A rail row is a door,
      and a door built from an unverified path parameter is a door into somebody
      else's wedding.
    */
    preferEventId?: string | null,
  ): Promise<{ eventId: string | null; count: number; profile: EventTypeProfile | null }> => {
    const none = { eventId: null, count: 0, profile: null };
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return none;
      // ORGANISER events only. A guest membership cannot open a Studio tool —
      // the couple dashboard admits `member_type = 'couple'` and would 404.
      const events = await fetchUserEvents(supabase, user.id, 'couple');
      const live = events.filter((e) => !e.archived);

      /*
        🔑 THE ARCHIVED LIST IS SEARCHED TOO, and on purpose. A put-away event
        still opens from the board and its tools still work; refusing to point
        the rail at the very event whose page is on screen would be a rail that
        disagrees with the page under it.
      */
      const standing = preferEventId
        ? (live.find((e) => e.event_id === preferEventId) ??
           events.find((e) => e.event_id === preferEventId))
        : undefined;
      if (standing) {
        return {
          eventId: standing.event_id,
          count: Math.max(1, live.length),
          profile: await resolveProfile(standing.event_type ?? 'wedding'),
        };
      }

      if (live.length !== 1) return { eventId: null, count: live.length, profile: null };
      const only = live[0];
      // Narrowing, not defence: `length !== 1` already returned above, so this
      // can only be undefined if that check changes. Failing soft here keeps a
      // future edit from throwing on the shared rail.
      if (!only) return none;
      return {
        eventId: only.event_id,
        count: 1,
        profile: await resolveProfile(only.event_type ?? 'wedding'),
      };
    } catch {
      return none;
    }
  },
);

function initialsFrom(email: string | null, name: string | null): string {
  const src = (name ?? '').trim() || (email ?? '').trim();
  if (!src) return '··';
  const parts = src.replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
  return (
    parts
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '··'
  );
}

/**
 * Who is looking, and what their account slot should say.
 *
 * Everything here is best-effort by design: a failed profile read must never
 * blank the front door for a stranger. It degrades to the signed-out slot,
 * which is a correct page rather than a broken one.
 */
export async function resolveRailAccount(): Promise<FrontDoorAccount> {
  const signedOut: FrontDoorAccount = {
    signedIn: false,
    initials: '··',
    shopName: null,
    isAdmin: false,
  };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return signedOut;

    // ⚠ A REJECTED QUERY IS NOT A THROWN ERROR — `error` is checked, not
    // caught. A phantom column here would otherwise render a signed-in person
    // a signed-out rail with nothing said about it.
    const [
      { count: eventCount, error: eventErr },
      roles,
      { count: storyCount, error: storyErr },
    ] = await Promise.all([
      /*
        ⚠ THE SAME NARROWING /dashboard USES, or the two numbers disagree.
        `fetchUserEvents` filters `hidden_at IS NULL` (lib/events.ts) because
        a declined or left membership stamps that column — and the launcher
        then drops archived events too. Counting raw memberships made the
        rail promise "5 Events" and the board show 3, with no way for the
        person to find the missing two.

        `hidden_at` is matched here; archived is a property of the EVENT, not
        the membership, so it is excluded via the join rather than counted.
      */
      supabase
        .from('event_members')
        .select('event_id, events!inner(archived)', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('hidden_at', null)
        .eq('events.archived', false),
      /*
        ONE ROLE SUMMARY, NOT THREE HAND-ROLLED READS. fetchUserRoleSummary
        exists for exactly this question — "which consoles does this user
        have access to right now" — is cache()d, and uses THE admin predicate.

        ⚠ IT ALSO CLOSES A GAP THE HAND-ROLLED VERSION HAD. The rail gated the
        shop row on owning a `vendor_profiles` row, while /vendor-dashboard
        admits an OWNER **or** a `vendor_team_members` member. A shop's hired
        team member could open the console and get no row offering it. Latent
        today (prod: 0 team members who own nothing) — it bites the first hire.
      */
      fetchUserRoleSummary(supabase, user.id),
      // How many chapters this person has written — the same set the
      // destination lists as "Your chapters (N)", every status.
      supabase
        .from('creator_chapters')
        .select('chapter_id', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]);

    // The shop row's avatar wants a presigned display URL, never the raw
    // `r2://` ref vendor_profiles.logo_url stores (see VendorAvatar's
    // doc comment). Resolved unconditionally against the FIRST vendor profile
    // fetchUserRoleSummary already read — no extra round trip to the table.
    const shopLogoUrl = roles.hasVendorAccess
      ? await displayUrlForStoredAsset(roles.vendorProfiles[0]?.logo_url)
      : null;

    return {
      signedIn: true,
      initials: initialsFrom(
        user.email ?? null,
        (user.user_metadata?.full_name as string | undefined) ?? null,
      ),
      // null ⇒ "couldn't load". Never 0 for a failed read.
      eventCount: eventErr ? null : (eventCount ?? 0),
      // ⚠ DELIBERATELY UNDEFINED — not null, not 0. The Alaala total is a
      // cross-event photo count this page does not compute, and a number we
      // have not measured is worse than no number. The row renders without a
      // count rather than claiming a failure that never happened.
      alaalaCount: undefined,
      // Named from the summary so a TEAM MEMBER gets the row too, matching what
      // /vendor-dashboard actually admits. Falls back to a neutral word rather
      // than hiding the row when access is real but no name came back.
      shopName: roles.hasVendorAccess
        ? (roles.vendorProfiles[0]?.business_name ?? 'Your shop')
        : null,
      shopLogoUrl,
      // A FAILED READ MUST NOT GRANT THE ROW — a rejected query hides HQ rather
      // than offering a door that then refuses. The opposite direction from the
      // counts, and the right one: a missing row is a nuisance, an
      // offered-then-denied one is a lie.
      isAdmin: roles.hasAdminAccess,
      // null ⇒ "couldn't load". A real 0 is a real answer here — the desk is
      // open to everyone, so nothing is being hidden by showing zero.
      storyChapterCount: storyErr ? null : (storyCount ?? 0),
    };
  } catch {
    return signedOut;
  }
}
