/**
 * /v/[slug]/guest-review?event=<eventId> — A GUEST RATES ONE SUPPLIER THEY SAW AT WORK (owner, 6 Nov 2026).
 *
 * Owner, verbatim: *"Guest review and cohosts' review are different. Cohosts reviews are the ones who experience
 * planning with the supplier. Guests only experience the end result."* Prototype § 7 (the form), § 8 (the doors),
 * § 10 (the thank-you): claude.ai/artifact/GWJhmWLcRijfyofpTLLs8o.
 *
 *   · ONE supplier, ONE event — the address names both, so a guest at two weddings the same shop served is never
 *     guessed wrong. Door 1: the supplier's On-the-day guest QR now carries the event it was shown for.
 *   · WHO is never typed: the pass this browser holds for the event, or the account's bound seat.
 *   · THE GATE is the one writer's (`vendor_guest_review_submit`): checked in at the door (this page's door), or a
 *     received scanner claim (the scanner's own pop-up door, #7291 — it calls the same writer).
 *   · THE CARD shows by name only — never a price (owner, 6 Nov).
 *   · Every state is SAID: a refused read is "couldn't load", not an empty form; not on the door list is said, with
 *     the shop's page offered (prototype § 7: "never a silent empty form").
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSessionForEvent } from '@/lib/guest-one-path.server';
import { getGuestOwnShots } from '@/lib/guest-live-gallery';
import { formatEventTypeLabel } from '@/lib/reviews';
import { guestShownName, readServiceTitles, GUEST_REVIEW_REFUSAL_LINE } from '@/lib/guest-reviews';
import { GuestReviewForm, type GuestReviewCard } from './_components/guest-review-form';
import { GuestReviewHeader as Header } from './_components/guest-review-header';
import { CouldNotLoad, NotOnDoorList, Said, Shell } from './_components/guest-review-states';
import { sendGuestReview } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Rate a supplier', robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOOKED = ['contracted', 'deposit_paid', 'delivered', 'complete'];

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ event?: string }> };

export default async function GuestReviewPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { event } = await searchParams;
  const admin = createAdminClient();

  const { data: shopRow, error: shopErr } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name')
    .eq('business_slug', slug)
    .maybeSingle();
  if (shopErr) {
    console.error('[supabase-error] app/v/[slug]/guest-review/page.tsx · from:vendor_profiles.select', shopErr);
    return <Shell><CouldNotLoad /></Shell>;
  }
  if (!shopRow) notFound();
  const shop = shopRow as { vendor_profile_id: string; business_name: string | null };
  const shopName = shop.business_name?.trim() || 'This supplier';
  const shopHref = `/v/${slug}#reviews`;

  const eventId = typeof event === 'string' && UUID.test(event) ? event : null;
  const session = eventId ? await readGuestSessionForEvent(eventId) : null;
  if (!eventId || !session) return <Shell><NotOnDoorList shopName={shopName} shopHref={shopHref} /></Shell>;

  const [evRes, checkinRes, bookingRes, existingRes, guestRes] = await Promise.all([
    admin.from('events').select('display_name, event_type, slug').eq('event_id', eventId).maybeSingle(),
    admin.from('guest_checkins').select('checked_in_at').eq('event_id', eventId).eq('guest_id', session.guest_id).maybeSingle(),
    admin
      .from('event_vendors')
      .select('service_id, status, marketplace_vendor_id, linked_vendor_profile_id')
      .eq('event_id', eventId)
      .or(`marketplace_vendor_id.eq.${shop.vendor_profile_id},linked_vendor_profile_id.eq.${shop.vendor_profile_id}`),
    admin
      .from('vendor_guest_reviews')
      .select('review_id')
      .eq('event_id', eventId)
      .eq('guest_id', session.guest_id)
      .eq('vendor_profile_id', shop.vendor_profile_id)
      .maybeSingle(),
    admin.from('guests').select('first_name, last_name').eq('guest_id', session.guest_id).maybeSingle(),
  ]);
  const readErr = evRes.error ?? checkinRes.error ?? bookingRes.error ?? existingRes.error ?? guestRes.error;
  if (readErr) {
    console.error('[supabase-error] app/v/[slug]/guest-review/page.tsx · guest review gate reads', readErr);
    return <Shell><CouldNotLoad /></Shell>;
  }

  const ev = evRes.data as { display_name: string | null; event_type: string | null; slug: string | null } | null;
  if (!ev) return <Shell><NotOnDoorList shopName={shopName} shopHref={shopHref} /></Shell>;
  const backHref = ev.slug ? `/${ev.slug}` : shopHref;
  const eventTitle = `${ev.display_name?.trim() || 'the'}’s ${formatEventTypeLabel(ev.event_type).toLowerCase()}`;

  const checkedInAt = (checkinRes.data as { checked_in_at?: string } | null)?.checked_in_at ?? null;
  // 🚪 THIS door is the door check-in. The scanner's "received" door (#7291) asks in its own pop-up and calls the same
  // writer (`submitGuestReview`), which admits a received claim itself — so this page never reads that table.
  if (!checkedInAt) {
    return <Shell><NotOnDoorList shopName={shopName} shopHref={shopHref} /></Shell>;
  }

  const bookings = ((bookingRes.data ?? []) as Array<{ service_id: string | null; status: string }>).filter((b) =>
    BOOKED.includes(b.status),
  );
  if (bookings.length === 0) {
    return (
      <Shell>
        <Header shopName={shopName} eventTitle={eventTitle} />
        <Said line={GUEST_REVIEW_REFUSAL_LINE.supplier_not_on_event} href={backHref} cta="Back to the event" />
      </Shell>
    );
  }

  if (existingRes.data) {
    return (
      <Shell>
        <Header shopName={shopName} eventTitle={eventTitle} />
        <Said line={GUEST_REVIEW_REFUSAL_LINE.already_reviewed} href={backHref} cta="Back to the event" />
      </Shell>
    );
  }

  const serviceIds = bookings.map((b) => b.service_id).filter((s): s is string => Boolean(s));
  const [titles, shots] = await Promise.all([readServiceTitles(admin, serviceIds), getGuestOwnShots(eventId, session.guest_id, 12)]);
  if (titles === null) return <Shell><CouldNotLoad /></Shell>;
  const cards: GuestReviewCard[] = [...titles.entries()].map(([serviceId, title]) => ({ serviceId, title }));

  const g = guestRes.data as { first_name: string | null; last_name: string | null } | null;
  const stampDay = checkedInAt ? new Date(checkedInAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : null;
  const checkedInLabel = `Checked in at the door${stampDay ? ` · ${stampDay}` : ''}`;

  return (
    <Shell>
      <Header shopName={shopName} eventTitle={eventTitle} />
      <GuestReviewForm
        action={sendGuestReview}
        slug={slug}
        eventId={eventId}
        shopName={shopName}
        cards={cards}
        shots={(shots?.shots ?? []).map((s) => ({ id: s.id, url: s.url }))}
        names={{
          name: guestShownName(g?.first_name ?? null, g?.last_name ?? null, 'name'),
          initials: guestShownName(g?.first_name ?? null, g?.last_name ?? null, 'initials'),
        }}
        checkedInLabel={checkedInLabel}
        backHref={backHref}
      />
      <p className="mt-2.5 text-xs text-ink/70">No communication, price or schedule questions — a guest never dealt with those.</p>
    </Shell>
  );
}
