import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Palette } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { PALETTE_LIMITS, PALETTE_ORDER, type PaletteKey, type RolePalette } from '@/lib/mood-board';
import { renderVenueSvg, type ReceptionDesign, type RoleColors } from '@/lib/reception-scene';

export const metadata = { title: 'Mood Board · Vendor' };

/**
 * Read-only mood board for booked vendors — lets them align their booth,
 * decor, florals, or styling to the couple's palette + reception design.
 *
 * Booked-gate lives in the get_vendor_mood_board SECURITY DEFINER RPC:
 * raises if the calling vendor isn't in event_vendors for this event.
 *
 * No guest data, no PII — only palette colors, reception design choices,
 * and uploaded inspiration reference images.
 */

type MoodBoardData = {
  display_name: string | null;
  role_palette: Record<string, string[]>;
  reception_design: ReceptionDesign;
  mood_board_updated_at: string | null;
  inspirations: Array<{ slot_key: string; slot_position: number; image_url: string }>;
};

type Props = { params: Promise<{ eventId: string }> };

export default async function VendorMoodBoardPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const { data, error } = await supabase.rpc('get_vendor_mood_board', {
    p_event_id: eventId,
  });
  if (error || !data) redirect(`/vendor-dashboard/clients/${eventId}`);

  const board = data as MoodBoardData;
  const palette = (board.role_palette ?? {}) as RolePalette;

  // Build palette rows — only keys that have at least one color saved
  const paletteRows = PALETTE_ORDER.map((key) => ({
    key,
    label: PALETTE_LIMITS[key as PaletteKey]?.label ?? key,
    colors: palette[key as PaletteKey] ?? [],
  })).filter((r) => r.colors.length > 0);

  // Reception scene SVG — server-rendered, palette-tinted, read-only
  const roleColors: RoleColors = {
    bride: palette.bride?.[0],
    groom: palette.groom?.[0],
    party: palette.wedding_party?.[0],
    guest: palette.guest?.[0],
    guestPalette: palette.guest ?? [],
  };
  const receptionSvg = renderVenueSvg(
    board.reception_design ?? {},
    palette.reception ?? [],
    roleColors,
  );

  const hasInspiration = board.inspirations.length > 0;
  const hasPalette = paletteRows.length > 0;
  const hasReception =
    board.reception_design && Object.keys(board.reception_design).length > 0;
  const nothingYet = !hasPalette && !hasReception && !hasInspiration;

  return (
    <div className="space-y-6">
      <Link
        href={`/vendor-dashboard/clients/${eventId}`}
        className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to event brief
      </Link>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          <Palette className="h-7 w-7 text-terracotta" aria-hidden />
          Mood Board
        </h1>
        {board.display_name ? (
          <p className="text-base text-ink/60">{board.display_name}</p>
        ) : null}
        {board.mood_board_updated_at ? (
          <p className="text-xs text-ink/40">
            Last updated by the couple{' '}
            {new Date(board.mood_board_updated_at).toLocaleDateString('en-PH', {
              dateStyle: 'medium',
            })}
          </p>
        ) : null}
      </header>

      {nothingYet ? (
        <div className="rounded-2xl border border-ink/10 bg-cream px-6 py-10 text-center">
          <p className="text-base text-ink/55">
            The couple hasn&rsquo;t set their mood board yet. Check back once they&rsquo;ve saved
            their palette.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Palette */}
          {hasPalette ? (
            <section className="rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold">Palette</h2>
              <ul className="space-y-3">
                {paletteRows.map(({ key, label, colors }) => (
                  <li key={key} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-ink/70">{label}</span>
                    <span className="flex flex-wrap justify-end gap-1.5">
                      {colors.map((hex, i) => (
                        <span
                          key={`${hex}-${i}`}
                          title={hex}
                          className="h-7 w-7 rounded-full border border-ink/15 shadow-sm"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Reception scene — read-only SVG render */}
          {hasReception ? (
            <section className="rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
              <h2 className="mb-1 text-lg font-semibold">Reception design</h2>
              <p className="mb-4 text-sm text-ink/55">
                The couple&rsquo;s chosen materials and treatments — ceiling, backdrop, stage,
                tables, entrance — rendered in their palette.
              </p>
              <div
                className="overflow-hidden rounded-xl"
                dangerouslySetInnerHTML={{ __html: receptionSvg }}
              />
            </section>
          ) : null}

          {/* Inspiration photos */}
          {hasInspiration ? (
            <section className="rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
              <h2 className="mb-1 text-lg font-semibold">Inspirations</h2>
              <p className="mb-4 text-sm text-ink/55">
                Reference images the couple uploaded — venues, backdrops, florals, styling
                they love.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {board.inspirations.map((item) => (
                  <div
                    key={`${item.slot_key}-${item.slot_position}`}
                    className="aspect-square overflow-hidden rounded-xl bg-ink/5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
