import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchGuestsByEvent } from '@/lib/guests';
import { roleGroupOf, type RoleGroup } from '@/lib/role-groups';
import { sanitizeRolePalette, type PaletteKey } from '@/lib/mood-board';
import { saveRolePalette } from './actions';
import { PaletteEditor } from './_components/palette-editor';

export const metadata = { title: 'Mood Board' };

type Props = { params: Promise<{ eventId: string }> };

export default async function MoodBoardPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [eventRes, guests] = await Promise.all([
    supabase
      .from('events')
      .select('event_id, display_name, role_palette, mood_board_updated_at')
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchGuestsByEvent(supabase, eventId),
  ]);
  const event = eventRes.data;
  if (!event) notFound();

  const palette = sanitizeRolePalette(event.role_palette ?? {});

  // Conditional rendering: a role-family palette section only shows when at
  // least one guest exists in that group. Couples + venue palettes always show.
  const presentRoleGroups = new Set<RoleGroup>();
  for (const g of guests) {
    const group = roleGroupOf(g.role);
    if (group !== 'guest') presentRoleGroups.add(group);
  }
  const visibleKeys = new Set<PaletteKey>([
    'ceremony',
    'reception',
    'bride',
    'groom',
    'guest',
  ]);
  if (presentRoleGroups.has('wedding_party')) visibleKeys.add('wedding_party');
  if (presentRoleGroups.has('principal_sponsors')) visibleKeys.add('principal_sponsors');
  if (presentRoleGroups.has('secondary_sponsors')) visibleKeys.add('secondary_sponsors');
  if (presentRoleGroups.has('bearers_flower_girl')) visibleKeys.add('bearers_flower_girl');
  if (presentRoleGroups.has('officiants')) visibleKeys.add('officiants');

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/services`}
        className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
      >
        ‹ Back to services
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Mood Board
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Three families: Venue (ceremony + reception), Couple (bride + groom), and Roles
          (only the role groups you actually have guests in). The Guest List shows each
          role&rsquo;s first color as a small dot beside the chip. The 20-theme curated
          library + Setnayan Guide rule engine + custom-role palettes ship in a later
          revision.
        </p>
        {event.mood_board_updated_at ? (
          <p className="text-xs text-ink/55">
            Last saved {new Date(event.mood_board_updated_at).toLocaleString()}
          </p>
        ) : null}
      </header>

      <PaletteEditor
        eventId={eventId}
        initial={palette}
        visibleKeys={Array.from(visibleKeys)}
        saveAction={saveRolePalette}
      />

      <section className="space-y-3 rounded-2xl border border-dashed border-ink/15 bg-cream p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Coming later
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-ink/65">
          <li>Custom role palettes (define your own role with its own colors)</li>
          <li>20-theme curated library</li>
          <li>Setnayan Guide rule engine (cohesion · contrast · temperature · saturation)</li>
          <li>Venue palette extraction from venue photos</li>
          <li>Guests pick their dress-code color from the &ldquo;Plain guests&rdquo; palette</li>
          <li>Save palettes as named moods you can swap between</li>
        </ul>
      </section>
    </div>
  );
}
