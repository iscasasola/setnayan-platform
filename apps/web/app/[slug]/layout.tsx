import { createAdminClient } from '@/lib/supabase/admin';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { getDayOfPhase } from '@/lib/day-of-mode';
import { readGuestSession } from '@/lib/guest-session';
import { DayOfAnnouncement } from './_components/day-of-announcement';
import { GuestLookScope } from './_components/guest-look-scope';
import { siteSkin } from './_components/skins/site-skin';
import { loadDayOfBroadcast, loadEventShell, loadGuestLook, type GuestLook } from './_lib/loaders';
import { resolveThemeGround } from './_lib/theme-ground';

/**
 * /[slug] guest-tree layout — the editorial-typography scope, the ONE place the
 * couple's look is worn, and the ONE mount of the coordinator's day-of
 * announcement.
 *
 * ── THE COUPLE'S LOOK, ON EVERY PAGE (2026-09-25) ─────────────────────────
 * Owner: *"event hub has the different menus that are not editable. but they
 * should still adapt to their theme"* — then, on applying it once at the top of
 * every guest page, *"yes place it there."*
 *
 * The theme, palette, art direction and the couple's Pro colours and face used
 * to be stamped on the `<main>` of three pages. Every other page of the tree —
 * the seat finder, the seat pass, the hub, the guest list, the venue — wore
 * Clean-Editorial whatever the couple chose. They are worn HERE now, by
 * `GuestLookScope`, and the pages that used to stamp them rely on it.
 *
 * `loadGuestLook` reads through the same `cache()`d `loadEventShell` row the
 * announcement below reads, so this costs no second event read; its privacy
 * argument and its gates are in its own docblock (`_lib/loaders.ts`). The door
 * (`/invite/*`) dresses itself and is left alone — see
 * `SEGMENTS_THAT_DRESS_THEMSELVES`.
 *
 * ⚠ BEST-EFFORT, LIKE THE ANNOUNCEMENT. A look that cannot be resolved renders
 * the page in the house look rather than taking the page down.
 *
 * ── THE TYPOGRAPHY SCOPE (unchanged) ──────────────────────────────────────
 * The 2026-07-12 Atelier finalization flipped the root font variables to the
 * chrome faces (Hanken Grotesk + Space Mono) so every marketing/dashboard
 * page reads one type system. The guest-facing invitation/event tree is the
 * owner-EXCLUDED surface family: couples' pages keep the wedding-editorial
 * register (Cormorant Garamond display · Manrope body · DM Mono labels).
 *
 * `.sn-editorial` (globals.css) remaps --font-display/--font-sans/--font-mono
 * back to the editorial faces (loaded as --font-editorial-* in the root
 * layout); `display: contents` keeps this wrapper out of the box model so no
 * guest page's layout shifts.
 *
 * ── WHY THE ANNOUNCEMENT MOVED HERE (2026-09-22) ──────────────────────────
 * 🚨 IT REACHED ONE PAGE IN TWELVE. `DayOfAnnouncement` was mounted inside
 * `_components/site-body.tsx`, and `SiteBody` is rendered by exactly one page:
 * `[slug]/page.tsx`. The guest tree has TWELVE pages — `/`, `/avatar`,
 * `/find-my-table`, `/find-seat`, `/hub`, `/invite`, `/pabuya`, `/print`,
 * `/recap`, `/seat`, `/venue`, `/welcome`. A guest reading their seat, the
 * floor plan, the gallery or the recap when the coordinator sent "phones down,
 * the ceremony is starting" saw NOTHING — and the coordinator had no way to
 * know, because from their side the message was sent.
 *
 * 🔑 THE COMPONENT'S OWN DOCBLOCK ALREADY CONDEMNED THIS. It records why the
 * announcement is deliberately not dismissible: *"an announcement a guest can
 * swipe away is worse than none, because the coordinator has no way to know it
 * was dismissed."* A message that never renders is the same failure with a
 * quieter cause — indistinguishable, from the coordinator's side, from one
 * nobody needed.
 *
 * A layout is the only node that wraps all twelve, so this is where it goes.
 *
 * ── WHAT THIS COSTS: NOTHING EXTRA ────────────────────────────────────────
 * Both reads are `cache()`-wrapped (`_lib/loaders.ts`) and `page.tsx` already
 * calls both with the same arguments. React dedupes them per request, so the
 * landing page still makes ONE `events` read and ONE `coordinator_broadcasts`
 * read, not two. On the other eleven pages this is the first and only call.
 *
 * ── THE GATES ARE THE LOADER'S, NOT RE-DERIVED HERE ───────────────────────
 * `loadDayOfBroadcast` returns null outside the live window — an announcement
 * is a thing shouted across a room and has no meaning the week before or the
 * month after. The timezone is the VENUE'S, resolved from its coordinates,
 * because a Vercel server in UTC once decided what time it was at a wedding in
 * Manila and got it eight hours wrong (see page.tsx's "two clocks" note).
 *
 * ⛔ GUESTS ONLY — THIS GATE IS THE WHOLE REASON THE LIFT IS NOT A ONE-LINER.
 * `day-of-announcement.test.ts` pins the ruling: *"An announcement is for the
 * people in the room; 'the ceremony is running late' is not for whoever was
 * forwarded the URL."* In `site-body.tsx` that gate was STRUCTURAL — the mount
 * sat inside the guest tree, so anonymous visitors could not reach it. A
 * layout wraps everyone, anonymous visitors included, so the gate has to be
 * asked for explicitly here or the lift would publish the coordinator's words
 * to anybody holding the link.
 *
 * The session must also be for THIS event: a guest of one wedding holding a
 * cookie must not read another couple's announcements. Same comparison
 * `page.tsx` makes for the ask-the-band door.
 *
 * ⚠ This layout does NOT re-implement the preview override (`forcedPhase`)
 * that `page.tsx` applies. Here only the real clock counts, which is the
 * honest answer for a guest.
 *
 * ⚠ AND IT NEVER THROWS. `loadEventShell` yields nothing for a slug that is
 * not an event, and every read below is best-effort. A wedding page must not
 * go down on the day because an announcement could not be read.
 */
export default async function GuestTreeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let broadcast: { body: string; createdAt: string } | null = null;
  let eventId: string | null = null;

  try {
    const event = await loadEventShell(slug);
    if (event?.event_id) {
      eventId = event.event_id;
      // GUESTS ONLY, and only a guest of THIS event.
      const session = await readGuestSession();
      const isThisEventsGuest = session?.event_id === event.event_id;
      const venueTz = eventTimezoneFromCoords(
        event.venue_latitude,
        event.venue_longitude,
      );
      const isLive = event.event_date
        ? getDayOfPhase(event.event_date, venueTz) === 'live'
        : false;
      broadcast = isThisEventsGuest
        ? await loadDayOfBroadcast(createAdminClient(), event.event_id, isLive)
        : null;
    }
  } catch {
    // Best-effort, deliberately silent: the announcement is an addition to the
    // page, never a precondition for it.
    broadcast = null;
  }

  // THE COUPLE'S LOOK — best-effort for the same reason: a page in the house
  // look is a page; a page that 500s because a palette could not be read is not.
  let look: GuestLook | null = null;
  try {
    look = await loadGuestLook(slug);
  } catch {
    look = null;
  }
  /*
    The theme's font classes and the `--accent` its material mixes with come
    from the site skin, the one place they are declared. Its `ground` is NOT
    drawn here: the textured grounds carry the couple's reveal photo, and this
    layout wraps the private landing (see `resolveHubTheme`). `GuestLookScope`
    lays the plain paper instead.
  */
  const skin = look?.theme ? siteSkin(look.theme, { accent: look.accent }) : undefined;
  const style =
    look && (look.vars || skin) ? { ...(look.vars ?? {}), ...((skin?.style as Record<string, string>) ?? {}) } : null;
  /*
    The theme's LOOP and scrim. Unlike the couple's reveal photo this is
    Setnayan's own public theme art, so the layout may draw it on every page —
    the private landing included — and it is resolved here, once, not per page.
  */
  const ground = look?.theme ? resolveThemeGround(look.theme, { ownColours: Boolean(look.vars) }) : null;

  return (
    <GuestLookScope
      theme={look?.theme ?? null}
      art={look?.art ?? null}
      fontClassName={skin?.className ?? ''}
      style={style}
      ground={ground}
    >
      {/* THE COORDINATOR'S WORDS, ON EVERY PAGE OF THE TREE. Sticky so it
          follows the reader down a long page — the guest who needs "phones
          down" is the one already scrolled into their seat card. */}
      {broadcast && eventId ? (
        <div className="sticky top-0 z-50">
          <DayOfAnnouncement body={broadcast.body} eventId={eventId} />
        </div>
      ) : null}
      {children}
    </GuestLookScope>
  );
}
