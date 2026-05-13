import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ROLE_GROUP_LABELS, type RoleGroup } from '@/lib/role-groups';
import {
  DEFAULT_ROLE_PALETTE_SUGGESTIONS,
  sanitizeRolePalette,
  type RolePalette,
} from '@/lib/mood-board';
import { saveRolePalette } from './actions';

export const metadata = { title: 'Mood Board' };

const GROUPS: ReadonlyArray<RoleGroup> = [
  'wedding_party',
  'principal_sponsors',
  'secondary_sponsors',
  'bearers_flower_girl',
  'officiants',
  'other_roles',
];

type Props = { params: Promise<{ eventId: string }> };

export default async function MoodBoardPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name, role_palette, mood_board_updated_at')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  const palette: RolePalette = sanitizeRolePalette(event.role_palette ?? {});

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/services`}
        className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
      >
        ‹ Back to services
      </Link>

      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Iteration 0010 · Mood Board (V1 MVP)
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Per-role palette
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Pick an accent color for each role group. The Guest List shows the color as a small
          dot beside the role chip, so your wedding party and sponsors are visually distinct
          at a glance. The full Setnayan Guide rule engine + 20-theme library ship in a later
          revision.
        </p>
      </header>

      <form action={saveRolePalette} className="space-y-6">
        <input type="hidden" name="event_id" value={eventId} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {GROUPS.map((group) => {
            const current = palette[group] ?? DEFAULT_ROLE_PALETTE_SUGGESTIONS[group];
            return (
              <label
                key={group}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-cream p-4"
              >
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-ink">
                    {ROLE_GROUP_LABELS[group]}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
                    {current}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-9 w-9 rounded-md border border-ink/15"
                    style={{ backgroundColor: current }}
                  />
                  <input
                    type="color"
                    name={group}
                    defaultValue={current}
                    className="h-10 w-12 cursor-pointer rounded-md border border-ink/10 bg-cream p-0.5"
                  />
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="submit" className="button-primary">
            Save palette
          </button>
          {event.mood_board_updated_at ? (
            <span className="text-xs text-ink/55">
              Last saved {new Date(event.mood_board_updated_at).toLocaleString()}
            </span>
          ) : (
            <span className="text-xs text-ink/55">Not saved yet</span>
          )}
        </div>
      </form>

      <section className="space-y-3 rounded-2xl border border-dashed border-ink/15 bg-cream p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Coming later
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-ink/65">
          <li>20-theme curated library</li>
          <li>Setnayan Guide rule engine (cohesion · contrast · temperature · saturation)</li>
          <li>Venue palette extraction from venue photos</li>
          <li>Save palettes as named moods you can swap between</li>
        </ul>
      </section>
    </div>
  );
}
