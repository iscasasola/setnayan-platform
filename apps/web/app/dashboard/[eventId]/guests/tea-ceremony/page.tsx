import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import {
  fetchGuestsByEvent,
  guestDisplayName,
  ROLE_LABELS,
  type GuestRow,
} from '@/lib/guests';
import { roleImportanceRank } from '@/lib/role-groups';
import { isChineseWedding } from '@/lib/chinese-wedding';
import { PrintButton } from '@/components/print-button';

export const metadata = { title: 'Tea ceremony serving order' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * Chinese (Tsinoy) tea-ceremony serving-order helper — the signature free
 * couple tool for a Chinese wedding.
 *
 * The tea ceremony (敬茶) is the heart of the day: the couple kneels and serves
 * tea to their elders, GROOM'S SIDE FIRST then the BRIDE'S, each side in order
 * of seniority. Getting the order right matters, so this lays out a single
 * printable list both families can review beforehand.
 *
 * Gating + privacy:
 *   - Ceremony-gated via isChineseWedding (primary OR secondary 'chinese', per
 *     the locked overlay model). A non-Chinese event 404s the route.
 *   - It is a FREE tool — never routed through the paid add-ons catalog.
 *   - It reads the couple-only guest roster (RLS Pattern B on public.guests);
 *     this route lives under the auth-gated couple dashboard and is never
 *     exposed on public / guest surfaces. A serving order materializes family
 *     elders + relationships, which is family-sensitive.
 *
 * Ordering (reuses the existing precedence backbone — no parallel order):
 *   1. side bucket — groom's side, then bride's, then any "both sides" guests
 *   2. seniority_rank ascending, NULLs last (couple-set within-side order)
 *   3. roleImportanceRank() of the guest's most-important role (the same engine
 *      the guest list ranks by) — so VIP family / parents float up for unranked
 *      guests
 *   4. display name, as a stable final tiebreak
 */
export default async function TeaCeremonyPage({ params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/dashboard/${eventId}/guests/tea-ceremony`)}`);
  }

  const supabase = await createClient();
  const { data: eventRow } = await supabase
    .from('events')
    .select('event_id, display_name, ceremony_type, secondary_ceremony_type')
    .eq('event_id', eventId)
    .maybeSingle();

  // RLS-denied (not the couple's event) OR not a Chinese wedding → 404. The
  // ceremony gate is the whole reason this tool exists; non-Chinese events
  // should never reach it.
  if (!eventRow || !isChineseWedding(eventRow)) {
    notFound();
  }

  const guests = await fetchGuestsByEvent(supabase, eventId);

  // The couple are the SERVERS, not the served — drop them from the order.
  // Plus-one TBA placeholder rows add nothing to a serving list, so drop them
  // too (they carry no relation/seniority and aren't elders).
  const served = guests.filter(
    (g) => g.role !== 'bride' && g.role !== 'groom' && !g.plus_one_of_guest_id,
  );

  const groomSide = sortServeOrder(served.filter((g) => g.side === 'groom'));
  const brideSide = sortServeOrder(served.filter((g) => g.side === 'bride'));
  const bothSides = sortServeOrder(served.filter((g) => g.side === 'both'));

  const hasAnyone = groomSide.length + brideSide.length + bothSides.length > 0;

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/dashboard/${eventId}/guests`}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55 hover:text-terracotta"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          Back to guest list
        </Link>
        <PrintButton />
      </div>

      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta-700">
          Tea ceremony · 敬茶
        </p>
        <h1 className="font-display text-3xl italic tracking-tight text-ink sm:text-4xl">
          Your serving order
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-ink/70 sm:text-base">
          On the day, you and your partner serve tea to your elders — the
          groom&rsquo;s side first, then the bride&rsquo;s, each in order of
          seniority. Review this list with both families and set the within-side
          order on each guest if the seniority needs adjusting.
        </p>
      </header>

      {hasAnyone ? (
        <ol className="list-none space-y-6 p-0">
          <SideBlock
            eventId={eventId}
            heading="Groom’s side"
            order={1}
            guests={groomSide}
            startNumber={1}
          />
          <SideBlock
            eventId={eventId}
            heading="Bride’s side"
            order={2}
            guests={brideSide}
            startNumber={groomSide.length + 1}
          />
          {bothSides.length > 0 ? (
            <SideBlock
              eventId={eventId}
              heading="Both sides"
              order={3}
              guests={bothSides}
              startNumber={groomSide.length + brideSide.length + 1}
              note="Guests tied to both families — serve them where it feels right for your families."
            />
          ) : null}
        </ol>
      ) : (
        <EmptyState eventId={eventId} />
      )}

      <p className="text-xs text-ink/55 print:mt-8">
        General guidance to help you prepare — every family keeps the tea
        ceremony a little differently. Confirm the order with both families and
        your elders. Set each guest&rsquo;s within-side order and relationship
        on their guest detail page.
      </p>
    </section>
  );
}

/**
 * Sort a single side's guests into serve order. Pure — reused per side so the
 * groom's and bride's lists rank identically. seniority_rank ascending (NULLs
 * last), then the shared roleImportanceRank() backbone, then name.
 */
function sortServeOrder(rows: GuestRow[]): GuestRow[] {
  return [...rows].sort((a, b) => {
    const ar = a.seniority_rank;
    const br = b.seniority_rank;
    // NULL ranks sort after any explicit rank.
    if (ar !== br) {
      if (ar === null) return 1;
      if (br === null) return -1;
      return ar - br;
    }
    const ai = mostImportantRoleRank(a);
    const bi = mostImportantRoleRank(b);
    if (ai !== bi) return ai - bi;
    return guestDisplayName(a).localeCompare(guestDisplayName(b));
  });
}

/**
 * The precedence index of a guest's MOST important role (primary or extra),
 * via the shared lib/role-groups roleImportanceRank() — so a Bridesmaid who is
 * also a parent ranks by the parent role. Lower = more important.
 */
function mostImportantRoleRank(g: GuestRow): number {
  let best = roleImportanceRank(g.role);
  for (const r of g.extra_roles ?? []) {
    const rank = roleImportanceRank(r);
    if (rank < best) best = rank;
  }
  return best;
}

function SideBlock({
  eventId,
  heading,
  order,
  guests,
  startNumber,
  note,
}: {
  eventId: string;
  heading: string;
  order: number;
  guests: GuestRow[];
  startNumber: number;
  note?: string;
}) {
  return (
    <li className="space-y-3 break-inside-avoid">
      <div className="flex items-baseline gap-2 border-b border-ink/10 pb-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta-700">
          {order === 1 ? 'First' : order === 2 ? 'Then' : 'Also'}
        </span>
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          {heading}
        </h2>
        <span className="ml-auto font-mono text-[11px] text-ink/45">
          {guests.length === 1 ? '1 elder' : `${guests.length} elders`}
        </span>
      </div>
      {note ? <p className="text-xs text-ink/55">{note}</p> : null}
      {guests.length > 0 ? (
        <ol className="space-y-2">
          {guests.map((g, i) => (
            <ServeRow
              key={g.guest_id}
              eventId={eventId}
              guest={g}
              number={startNumber + i}
            />
          ))}
        </ol>
      ) : (
        <p className="rounded-lg border border-dashed border-ink/15 bg-cream px-4 py-3 text-sm text-ink/55">
          No one on this side yet. Add their family to your guest list and mark
          the side.
        </p>
      )}
    </li>
  );
}

function ServeRow({
  eventId,
  guest,
  number,
}: {
  eventId: string;
  guest: GuestRow;
  number: number;
}) {
  const relation = guest.relation?.trim() || null;
  return (
    <li className="flex items-center gap-3 rounded-lg border border-ink/10 bg-cream px-4 py-2.5 break-inside-avoid">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracotta/10 font-mono text-xs font-semibold text-terracotta-700">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">
          {guestDisplayName(guest)}
        </p>
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
          {[relation, ROLE_LABELS[guest.role]].filter(Boolean).join(' · ')}
        </p>
      </div>
      <Link
        href={`/dashboard/${eventId}/guests/${guest.guest_id}`}
        className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/40 underline-offset-2 hover:text-terracotta hover:underline print:hidden"
      >
        Edit
      </Link>
    </li>
  );
}

function EmptyState({ eventId }: { eventId: string }) {
  return (
    <div className="rounded-xl border border-ink/15 bg-cream p-6 text-sm text-ink/70">
      <p>
        Once you add your families to the guest list and mark each one&rsquo;s
        side, they&rsquo;ll appear here in serving order. Set a relationship and
        a within-side order on each elder to fine-tune the sequence.
      </p>
      <Link
        href={`/dashboard/${eventId}/guests/new`}
        className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.15em] text-terracotta-700 underline"
      >
        Add a guest
      </Link>
    </div>
  );
}
