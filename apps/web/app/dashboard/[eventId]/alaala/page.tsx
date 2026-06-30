import Link from 'next/link';

import { ADD_ONS, addOnHref } from '@/lib/add-ons-catalog';
import { getKwentoDensity, type KwentoDensityRow } from '@/lib/kwento-density';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';

/**
 * Alaala — the couple's living-memory hub (Lane 2 of the Alaala embed).
 *
 * Owner 2026-06-15: make the Living-Memories pillar ("Alaala" — Tagalog for
 * memory/keepsake) the app's winning piece, embedded throughout. The Studio hub
 * (/add-ons) is the *store*; this is the *story* — it lays out the arc of the
 * day (opening → moment → people → stories → look & sound → kept forever) so the
 * couple sees their wedding as one living memory being assembled, not a flat
 * grid of SKUs. Each stage links into the real catalog feature that fills it.
 *
 * Server component, catalog-driven (no per-event data yet — ownership/"watch it
 * fill with real content" is a follow-up). Calm v2.1 surface, --m-* tokens.
 * Canonical pillar def: spec corpus `03_Strategy/Alaala_Pillar_2026-06-15.md`.
 */

export const metadata = { title: 'Alaala' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string }> };

// A chip is a catalog feature (by `key`) or an explicit label+href. `note`
// adds a small qualifier (e.g. "free with Papic" for Kwento, which isn't its
// own SKU). `label` overrides the catalog label when set.
type Chip = { key?: string; label?: string; href?: string; note?: string };

type Stage = { eyebrow: string; title: string; line: string; chips: ReadonlyArray<Chip> };

// The arc of the day. Each stage = a memory role; chips = the features that
// fill it. Feeling first; the feature is the quiet means, not the headline.
const ARC: ReadonlyArray<Stage> = [
  {
    eyebrow: 'The opening',
    title: 'How it begins',
    line: 'The first glimpse — your save-the-date and the branded invite that set the tone before anyone arrives.',
    chips: [{ key: 'save-the-date' }, { key: 'custom-qr-guest' }],
  },
  {
    eyebrow: 'The moment',
    title: 'What the day actually was',
    line: 'Candid capture by the people right beside you — the reactions and laughter the one camera up front will always miss.',
    chips: [{ key: 'papic' }, { key: 'patiktok' }],
  },
  {
    eyebrow: 'The people',
    title: 'Everyone who couldn’t be there',
    line: 'Brought into the room — your lola who couldn’t travel, the family overseas — to see your day as if they were standing in it.',
    chips: [{ key: 'panood' }],
  },
  {
    eyebrow: 'The stories',
    title: 'The night, told back to you',
    line: 'The small moments you never saw — your guests leave them for you, in their own words, beside the photo it happened in.',
    chips: [{ key: 'papic', label: 'Kwento', note: 'free with Papic' }],
  },
  {
    eyebrow: 'The look & the sound',
    title: 'Unmistakably yours',
    line: 'Your palette, your monogram, and your wedding’s own song — woven through every piece so it could only be yours.',
    chips: [
      { key: 'mood-board' },
      { key: 'animated-monogram' },
      { key: 'pakanta' },
      { key: 'led' },
      { key: 'music-creator' },
      { key: 'playlist' },
    ],
  },
  {
    eyebrow: 'Kept forever',
    title: 'Your front-page story',
    line: 'One living page that moves and grows — yours to keep, and to hold in your hands when you want to.',
    chips: [{ key: 'landing-page' }, { key: 'photo-delivery' }, { key: 'indoor-blueprint' }],
  },
];

export default async function AlaalaPage({ params }: Props) {
  const { eventId } = await params;
  const byKey = new Map(ADD_ONS.map((a) => [a.key, a]));

  // Fetch density map and recent approved stories in parallel.
  // If either fails (Papic not active, no data), we silently hide the sections.
  const admin = createAdminClient();
  const [densityRows, { data: recentStories }] = await Promise.all([
    getKwentoDensity(eventId, 5).catch(() => []),
    admin
      .from('photo_messages')
      .select('message_id, body_text, source_id, guest_id')
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .order('updated_at', { ascending: false })
      .limit(3)
      .then((r) => r, () => ({ data: null })),
  ]);

  // Resolve thumbnail URLs for the top density photos.
  type DensityCard = {
    photoId: string;
    density: number;
    preview: string | null;
    thumbUrl: string | null;
  };

  const densityCards: DensityCard[] = densityRows.length
    ? await Promise.all(
        densityRows.map(async (row: KwentoDensityRow) => {
          // Try to get a thumbnail from papic_guest_captures.r2_key first.
          let thumbUrl: string | null = null;
          try {
            const { data: cap } = await admin
              .from('papic_guest_captures')
              .select('r2_key')
              .eq('capture_id', row.photoId)
              .maybeSingle();
            if (cap?.r2_key) {
              thumbUrl = await displayUrlForStoredAsset(cap.r2_key as string, {
                ttlSeconds: 60 * 60,
              });
            }
          } catch {
            // no thumbnail — card still shows density badge
          }
          return { ...row, thumbUrl };
        }),
      )
    : [];

  // Resolve guest names for the Mga Boses pull-quotes.
  type VoiceQuote = {
    messageId: string;
    text: string;
    authorName: string;
  };

  const voiceQuotes: VoiceQuote[] = [];
  if (recentStories && recentStories.length > 0) {
    const guestIds = [...new Set((recentStories as Array<{ guest_id: string | null }>).map((r) => r.guest_id).filter(Boolean) as string[])];
    const { data: guests } = guestIds.length
      ? await admin
          .from('guests')
          .select('guest_id, first_name, display_name')
          .in('guest_id', guestIds)
      : { data: [] };
    const guestMap = new Map(
      (guests ?? []).map((g: { guest_id: string; first_name?: string; display_name?: string }) => [
        g.guest_id,
        (g.display_name as string) || (g.first_name as string) || 'A guest',
      ]),
    );
    for (const row of recentStories as Array<{
      message_id: string;
      body_text: string;
      guest_id: string | null;
    }>) {
      voiceQuotes.push({
        messageId: row.message_id,
        text: (row.body_text ?? '').slice(0, 200),
        authorName: row.guest_id ? (guestMap.get(row.guest_id) ?? 'A guest') : 'A guest',
      });
    }
  }

  function resolve(chip: Chip) {
    const entry = chip.key ? byKey.get(chip.key) : undefined;
    const label = chip.label ?? entry?.label ?? chip.key ?? '';
    const href = chip.href ?? (chip.key ? addOnHref(chip.key, eventId) : undefined);
    const comingSoon = entry ? entry.status === 'coming_soon' : false;
    return { label, href, comingSoon, note: chip.note };
  }

  return (
    <section className="space-y-10">
      {/* ── Header — name the pillar + the promise + the guardrail ── */}
      <header className="space-y-3">
        <p
          className="m-eyebrow font-mono text-[11px] uppercase tracking-[0.22em]"
          style={{ color: 'var(--m-orange-2)' }}
        >
          Alaala · the memory you keep
        </p>
        <h1
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ color: 'var(--m-ink)' }}
        >
          Your wedding, kept alive.
        </h1>
        <p className="max-w-prose text-base leading-relaxed" style={{ color: 'var(--m-slate)' }}>
          This is your <span className="italic">Alaala</span> — the living memory of your day, made
          from everything Setnayan helps you capture and keep. Watch it come together, piece by
          piece.
        </p>
        <p className="max-w-prose text-sm leading-relaxed" style={{ color: 'var(--m-slate-2)' }}>
          And it never gets in the way. The day stays yours — the tech just quietly remembers it.
        </p>
      </header>

      {/* ── Most storied moments (only when Kwentos exist) ── */}
      {densityCards.length > 0 ? (
        <div className="space-y-3">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.2em]"
            style={{ color: 'var(--m-orange-2)' }}
          >
            Most storied moments
          </p>
          <ul className="flex gap-3 overflow-x-auto pb-1">
            {densityCards.map((card) => (
              <li
                key={card.photoId}
                className="relative shrink-0 w-28 rounded-xl overflow-hidden border"
                style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
              >
                {card.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.thumbUrl}
                    alt=""
                    loading="lazy"
                    className="h-28 w-28 object-cover"
                  />
                ) : (
                  <div className="h-28 w-28" style={{ background: 'var(--m-paper)' }} />
                )}
                <div
                  className="absolute top-1.5 right-1.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                  style={{
                    background: card.density >= 3 ? '#D97706' : card.density === 2 ? '#B45309' : 'rgba(0,0,0,0.45)',
                    color: '#fff',
                  }}
                >
                  {card.density}
                </div>
                {card.preview ? (
                  <p
                    className="px-2 py-1.5 text-[11px] leading-tight line-clamp-2"
                    style={{ color: 'var(--m-slate)' }}
                  >
                    {card.preview}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ── The arc of the day ── */}
      <ol className="space-y-4">
        {ARC.map((stage, i) => (
          <li
            key={stage.eyebrow}
            className="rounded-2xl border p-5 sm:p-6"
            style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
          >
            <div className="flex items-baseline gap-3">
              <span
                className="font-mono text-[11px] tabular-nums"
                style={{ color: 'var(--m-orange-3)' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                className="m-eyebrow font-mono text-[11px] uppercase tracking-[0.2em]"
                style={{ color: 'var(--m-orange-2)' }}
              >
                {stage.eyebrow}
              </span>
            </div>

            <h2 className="mt-2 text-xl font-semibold tracking-tight" style={{ color: 'var(--m-ink)' }}>
              {stage.title}
            </h2>
            <p className="mt-1.5 max-w-prose text-[14.5px] leading-relaxed" style={{ color: 'var(--m-slate)' }}>
              {stage.line}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {stage.chips.map((chip, j) => {
                const r = resolve(chip);
                const inner = (
                  <>
                    <span style={{ color: 'var(--m-ink)', fontWeight: 500 }}>{r.label}</span>
                    {r.note ? (
                      <span style={{ color: 'var(--m-slate-2)' }}> · {r.note}</span>
                    ) : null}
                    {r.comingSoon ? (
                      <span style={{ color: 'var(--m-slate-3)' }}> · soon</span>
                    ) : null}
                  </>
                );
                const chipClass =
                  'inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] transition-colors';
                return r.href && !r.comingSoon ? (
                  <Link
                    key={`${chip.key ?? r.label}-${j}`}
                    href={r.href}
                    className={`${chipClass} hover:border-[var(--m-orange)]`}
                    style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
                  >
                    {inner}
                  </Link>
                ) : (
                  <span
                    key={`${chip.key ?? r.label}-${j}`}
                    className={chipClass}
                    style={{ borderColor: 'var(--m-line-soft)', background: 'var(--m-paper)' }}
                  >
                    {inner}
                  </span>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      {/* ── Mga Boses — what your guests are saying (only when stories exist) ── */}
      {voiceQuotes.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <p
              className="font-mono text-[11px] uppercase tracking-[0.2em]"
              style={{ color: 'var(--m-orange-2)' }}
            >
              Mga Boses · what your guests are saying
            </p>
            <Link
              href={`/dashboard/${eventId}/studio/papic/moderation`}
              className="text-[12px]"
              style={{ color: 'var(--m-orange-2)' }}
            >
              See all →
            </Link>
          </div>
          <ul className="space-y-3">
            {voiceQuotes.map((q) => (
              <li
                key={q.messageId}
                className="rounded-xl border p-4"
                style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
              >
                <p
                  className="text-[14px] leading-relaxed italic"
                  style={{ color: 'var(--m-slate)' }}
                >
                  &ldquo;{q.text}{q.text.length >= 200 ? '…' : ''}&rdquo;
                </p>
                <p
                  className="mt-1.5 text-[12px] font-medium"
                  style={{ color: 'var(--m-slate-2)' }}
                >
                  — {q.authorName}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ── Story Assignments entry-point ── */}
      <div
        className="rounded-2xl border p-5 sm:p-6"
        style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
      >
        <p
          className="font-mono text-[11px] uppercase tracking-[0.2em]"
          style={{ color: 'var(--m-orange-2)' }}
        >
          Story Assignments
        </p>
        <h2 className="mt-2 text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
          Ask the right person to tell each story
        </h2>
        <p className="mt-1 max-w-prose text-[13.5px] leading-relaxed" style={{ color: 'var(--m-slate)' }}>
          Assign a guest to each of the 10 locked editorial moments — the Bridal March, the First
          Dance, the Money Dance and more. They&rsquo;ll get a gentle nudge to write what they
          witnessed, in their own words.
        </p>
        <Link
          href={`/dashboard/${eventId}/alaala/assignments`}
          className="mt-4 inline-flex items-center rounded-full px-4 py-2 text-[13px] font-medium transition"
          style={{ background: 'var(--m-mulberry)', color: '#fff' }}
        >
          Manage assignments →
        </Link>
      </div>

      {/* ── Close — every piece adds to the Alaala ── */}
      <footer className="rounded-2xl border p-5 text-center sm:p-6" style={{ borderColor: 'var(--m-line)' }}>
        <p className="text-[15px]" style={{ color: 'var(--m-slate)' }}>
          Every piece you add becomes part of your <span className="italic">Alaala</span>.
        </p>
        <div className="mt-4">
          <Link
            href={`/dashboard/${eventId}/studio`}
            className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium"
            style={{ background: 'var(--m-mulberry)', color: '#fff' }}
          >
            Add to your Alaala
          </Link>
        </div>
      </footer>
    </section>
  );
}
