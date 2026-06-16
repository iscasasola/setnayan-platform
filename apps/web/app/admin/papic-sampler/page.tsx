import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Camera } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';

// Free Papic sampler — usage + cross-event abuse watch.
//
// The sampler is 1-per-event (enforced by papic_provision_sampler), so the real
// abuse vector is ONE person spinning up many events to farm free Papic. This
// read-only surface surfaces exactly that: every event with a free sampler, who
// the couple is, how much they've used, and a ⚠ flag on any couple running 2+
// sampler events. Admin layout gates access (app/admin/layout.tsx).

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Free Papic sampler · Admin' };

export default async function AdminPapicSamplerPage() {
  const admin = createAdminClient();

  const { data: seatRows } = await admin
    .from('paparazzi_seats')
    .select('event_id, claimer_user_id, claimed_at')
    .eq('is_free_sampler', true);
  const seats = seatRows ?? [];
  const eventIds = Array.from(new Set(seats.map((s) => s.event_id as string)));

  const backLink = '/admin/addons';

  if (eventIds.length === 0) {
    return (
      <section className="space-y-6">
        <Link href={backLink} className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--m-orange-2)]">
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Back to add-ons
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Camera aria-hidden className="h-6 w-6" strokeWidth={1.75} /> Free Papic sampler
        </h1>
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          No couple has started a free Papic sampler yet.
        </p>
      </section>
    );
  }

  const [eventRes, coupleRes, photoRes] = await Promise.all([
    admin.from('events').select('event_id, display_name, created_at').in('event_id', eventIds),
    admin.from('event_members').select('event_id, user_id').eq('member_type', 'couple').in('event_id', eventIds),
    admin
      .from('papic_photos')
      .select('event_id')
      .not('expires_at', 'is', null)
      .gt('expires_at', new Date().toISOString())
      .in('event_id', eventIds),
  ]);

  const eventInfo = new Map<string, { name: string; created: string | null }>();
  for (const e of eventRes.data ?? []) {
    eventInfo.set(e.event_id as string, {
      name: ((e.display_name as string | null) ?? '').trim() || 'Untitled wedding',
      created: (e.created_at as string | null) ?? null,
    });
  }

  const coupleByEvent = new Map<string, string>();
  for (const c of coupleRes.data ?? []) {
    if (!coupleByEvent.has(c.event_id as string)) {
      coupleByEvent.set(c.event_id as string, c.user_id as string);
    }
  }

  const coupleUserIds = Array.from(new Set([...coupleByEvent.values()]));
  const { data: userRows } = coupleUserIds.length
    ? await admin.from('users').select('id, email, display_name').in('id', coupleUserIds)
    : { data: [] as Array<{ id: string; email: string | null; display_name: string | null }> };
  const userInfo = new Map<string, { email: string; name: string }>();
  for (const u of userRows ?? []) {
    userInfo.set(u.id as string, {
      email: ((u.email as string | null) ?? '').trim() || '—',
      name: ((u.display_name as string | null) ?? '').trim() || '',
    });
  }

  const photoCount = new Map<string, number>();
  for (const p of photoRes.data ?? []) {
    const eid = p.event_id as string;
    photoCount.set(eid, (photoCount.get(eid) ?? 0) + 1);
  }

  const seatTotal = new Map<string, number>();
  const seatClaimed = new Map<string, number>();
  for (const s of seats) {
    const eid = s.event_id as string;
    seatTotal.set(eid, (seatTotal.get(eid) ?? 0) + 1);
    if (s.claimer_user_id) seatClaimed.set(eid, (seatClaimed.get(eid) ?? 0) + 1);
  }

  // Cross-event abuse signal — how many sampler events each couple runs.
  const eventsPerCouple = new Map<string, number>();
  for (const eid of eventIds) {
    const u = coupleByEvent.get(eid);
    if (u) eventsPerCouple.set(u, (eventsPerCouple.get(u) ?? 0) + 1);
  }

  const rows = eventIds
    .map((eid) => {
      const couple = coupleByEvent.get(eid) ?? null;
      const u = couple ? userInfo.get(couple) : undefined;
      return {
        eventId: eid,
        name: eventInfo.get(eid)?.name ?? 'Untitled wedding',
        coupleEmail: u?.email ?? '—',
        coupleName: u?.name ?? '',
        seats: seatTotal.get(eid) ?? 0,
        claimed: seatClaimed.get(eid) ?? 0,
        photos: photoCount.get(eid) ?? 0,
        coupleEventCount: couple ? (eventsPerCouple.get(couple) ?? 1) : 1,
      };
    })
    // Multi-event couples first (the abuse signal), then by photos used.
    .sort((a, b) => b.coupleEventCount - a.coupleEventCount || b.photos - a.photos);

  const distinctCouples = eventsPerCouple.size;
  const flaggedCouples = [...eventsPerCouple.values()].filter((n) => n >= 2).length;

  return (
    <section className="space-y-6">
      <Link href={backLink} className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--m-orange-2)]">
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Back to add-ons
      </Link>

      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Camera aria-hidden className="h-6 w-6" strokeWidth={1.75} /> Free Papic sampler
        </h1>
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          {rows.length} {rows.length === 1 ? 'event' : 'events'} · {distinctCouples}{' '}
          {distinctCouples === 1 ? 'couple' : 'couples'}
          {flaggedCouples > 0 ? (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              <AlertTriangle aria-hidden className="h-3 w-3" strokeWidth={2} />
              {flaggedCouples} {flaggedCouples === 1 ? 'couple' : 'couples'} with 2+ sampler events
            </span>
          ) : null}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--m-line)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: 'var(--m-slate)' }}>
              <th className="px-3 py-2 font-medium">Wedding</th>
              <th className="px-3 py-2 font-medium">Couple</th>
              <th className="px-3 py-2 font-medium">Seats</th>
              <th className="px-3 py-2 font-medium">Photos</th>
              <th className="px-3 py-2 font-medium">Sampler events</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.eventId} className="border-t" style={{ borderColor: 'var(--m-line-soft)' }}>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">
                  <span style={{ color: 'var(--m-ink)' }}>{r.coupleEmail}</span>
                  {r.coupleName ? (
                    <span className="ml-1" style={{ color: 'var(--m-slate)' }}>· {r.coupleName}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  {r.claimed}/{r.seats} claimed
                </td>
                <td className="px-3 py-2">{r.photos}</td>
                <td className="px-3 py-2">
                  {r.coupleEventCount >= 2 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      <AlertTriangle aria-hidden className="h-3 w-3" strokeWidth={2} />
                      {r.coupleEventCount}
                    </span>
                  ) : (
                    r.coupleEventCount
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
