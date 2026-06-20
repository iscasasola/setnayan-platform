import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, DoorOpen, MapPin } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';
import { canViewSlugEvent } from '@/lib/slug-access';
import { Logo } from '@/app/_components/logo';
import {
  DEFAULT_ENTRANCE,
  INDOOR_BLUEPRINT_SERVICE_KEY,
  type EntrancePos,
  clampPct,
} from '@/lib/indoor-blueprint';
import type { EventTableRow } from '@/lib/seating';
import { WayfindingMap } from '@/app/_components/wayfinding-map';
import { LiveRefresher } from '@/app/_components/live-refresher';

export const metadata = { title: 'Find your table · Setnayan' };

// Guest-facing, gated, behind a session cookie — never statically cached.
export const dynamic = 'force-dynamic';

/**
 * /[slug]/find-my-table — the guest-facing half of the Indoor Blueprint SKU
 * (₱1,499 · closes v2-catalog.ts INDOOR_BLUEPRINT 'partial' "entrance-to-table
 * nav not built"). A signed-in guest taps "Find my table" from their
 * invitation page and lands here: their assigned table highlighted on the
 * couple's floor plan, the venue entrance marked, a path drawn from the door.
 *
 * SAFETY / gating — this is a gated guest surface, NOT the always-rendered
 * public landing page:
 *   • Resolves the event by slug (admin client — public route, no RLS session).
 *   • Requires a valid guest-session cookie for THIS event; otherwise renders a
 *     friendly "open this from your invitation" prompt (no seating data read).
 *   • Gates on the event owning a paid INDOOR_BLUEPRINT order BEFORE any
 *     seating query runs — unowned events show an "ask the couple" message.
 * The seating reads use the admin client (the public route carries no RLS
 * session) but are constrained to this event_id + this guest_id and carry no
 * extra PII beyond table labels the guest is meant to see — mirrors the
 * invitation_widgets admin read on the landing page.
 */

type Props = { params: Promise<{ slug: string }> };

export default async function FindMyTablePage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const admin = createAdminClient();

  const { data: event } = await admin
    .from('events')
    .select('event_id, display_name, slug, venue_name, event_type, event_date, landing_page_visibility')
    .ilike('slug', slug)
    .maybeSingle();

  if (!event || event.event_type !== 'wedding') notFound();

  // Visibility gate (owner 2026-06-20): a stranger guessing a private (pre-launch)
  // slug must not even see the couple's name in the sign-in prompt. Bounce them
  // to /[slug] (the lock screen). Cookie-bearing guests + hosts pass through.
  if (!(await canViewSlugEvent(event.event_id, event.landing_page_visibility))) {
    redirect(`/${slug}`);
  }

  // Guest must be signed in for THIS event (the redeem flow sets the cookie).
  const session = await readGuestSession();
  if (!session || session.event_id !== event.event_id) {
    return (
      <Shell displayName={event.display_name} slug={slug}>
        <PromptCard
          title="Open this from your invitation"
          body="Find your table is part of your personal invitation. Open your invitation link (or scan your QR), then tap “Find my table”."
        />
      </Shell>
    );
  }

  // Gate on the paid SKU BEFORE touching seating. Graceful-degrade on a
  // missing/legacy orders table (42P01 / 42703) → treat as not owned.
  let owns = false;
  const { data: ordersData, error: ordersError } = await admin
    .from('orders')
    .select('status')
    .eq('event_id', event.event_id)
    .eq('service_key', INDOOR_BLUEPRINT_SERVICE_KEY)
    .not('status', 'in', '("cancelled","refunded","lapsed")');
  if (ordersError && ordersError.code !== '42P01' && ordersError.code !== '42703') {
    throw new Error(`Failed to resolve Indoor Blueprint ownership: ${ordersError.message}`);
  }
  owns = (ordersData ?? []).length > 0;

  if (!owns) {
    return (
      <Shell displayName={event.display_name} slug={slug}>
        <PromptCard
          title="No venue map yet"
          body="The couple hasn’t added the Indoor Blueprint venue map for this wedding. You’ll find your table on the printed seating signs at the venue."
        />
      </Shell>
    );
  }

  // Resolve this guest's table assignment.
  const { data: assignment } = await admin
    .from('event_seat_assignments')
    .select('table_id')
    .eq('event_id', event.event_id)
    .eq('guest_id', session.guest_id)
    .maybeSingle();

  // Fetch this event's tables (admin client; constrained to event_id).
  const { data: tablesRaw } = await admin
    .from('event_tables')
    .select(
      'table_id,public_id,event_id,table_label,table_type,capacity,sort_order,x_pos,y_pos',
    )
    .eq('event_id', event.event_id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  const tables = (tablesRaw ?? []) as EventTableRow[];

  // Entrance marker (optional columns from migration 20260717000000) →
  // bottom-center default when unset / pre-migration.
  const entrance = await resolveEntrance(admin, event.event_id);

  const targetTableId = (assignment?.table_id as string | null) ?? null;
  const targetTable = tables.find((t) => t.table_id === targetTableId) ?? null;

  if (tables.length === 0) {
    return (
      <Shell displayName={event.display_name} slug={slug}>
        <PromptCard
          title="The floor plan is on its way"
          body="The couple is still arranging the venue layout. Check back closer to the day — your table map will appear here."
        />
      </Shell>
    );
  }

  return (
    <Shell displayName={event.display_name} slug={slug}>
      {/* Day-of: silently re-pull this guest's assignment so a live reseat
          re-lights the map without a manual reload (seat-finding PR 5). */}
      <LiveRefresher eventDate={event.event_date as string | null} />
      <div className="space-y-5">
        <header className="space-y-2 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            Find your table
          </p>
          {targetTable ? (
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              You&rsquo;re at{' '}
              <span className="text-success-700">{targetTable.table_label}</span>
            </h1>
          ) : (
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Your seat is being arranged
            </h1>
          )}
          {event.venue_name ? (
            <p className="inline-flex items-center justify-center gap-1.5 text-sm text-ink/60">
              <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              {event.venue_name}
            </p>
          ) : null}
        </header>

        <WayfindingMap
          tables={tables}
          entrance={entrance}
          targetTableId={targetTableId}
        />

        {targetTable ? (
          <p className="flex items-center justify-center gap-2 text-center text-sm text-ink/65">
            <DoorOpen aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
            Walk in from the entrance and follow the dotted path to your table.
          </p>
        ) : (
          <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-4 text-center text-sm text-ink/55">
            You haven&rsquo;t been seated at a table yet. Once the couple seats
            you, your spot lights up on this map.
          </p>
        )}

        <div className="text-center">
          <Link
            href={`/${slug}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
          >
            <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Back to your invitation
          </Link>
        </div>
      </div>
    </Shell>
  );
}

// Entrance resolver scoped to the admin read on this route (lib/fetchEntrance
// uses the RLS client; here we already hold the admin client + event_id).
async function resolveEntrance(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<EntrancePos> {
  const { data, error } = await admin
    .from('events')
    .select('venue_entrance_x, venue_entrance_y')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) return DEFAULT_ENTRANCE;
  const x = data?.venue_entrance_x;
  const y = data?.venue_entrance_y;
  if (typeof x === 'number' && typeof y === 'number') {
    return { x: clampPct(x), y: clampPct(y) };
  }
  return DEFAULT_ENTRANCE;
}

// ─────────────────────────────────────────────────────────────────────────
// Chrome — self-contained guest-microsite shell (does not import from the
// [slug] page to stay decoupled). Mirrors its InvitationShell look.
// ─────────────────────────────────────────────────────────────────────────

function Shell({
  displayName,
  slug,
  children,
}: {
  displayName: string;
  slug: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-cream text-ink">
      <header className="border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href={`/${slug}`} className="flex items-center gap-2 text-ink">
            <Logo height={28} />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">
              Setnayan
            </span>
          </Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
            {displayName}
          </span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>
      <footer className="border-t border-ink/10 px-4 py-8 text-center">
        <p className="font-serif text-lg italic text-terracotta">See you soon.</p>
        <p className="mt-3 text-xs text-ink/50">Powered by Setnayan · setnayan.com</p>
      </footer>
    </main>
  );
}

function PromptCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-cream p-6 text-center sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mx-auto mt-3 max-w-prose text-sm text-ink/60">{body}</p>
    </div>
  );
}
