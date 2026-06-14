import Link from 'next/link';

import { ADD_ONS, addOnHref } from '@/lib/add-ons-catalog';

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

      {/* ── Close — every piece adds to the Alaala ── */}
      <footer className="rounded-2xl border p-5 text-center sm:p-6" style={{ borderColor: 'var(--m-line)' }}>
        <p className="text-[15px]" style={{ color: 'var(--m-slate)' }}>
          Every piece you add becomes part of your <span className="italic">Alaala</span>.
        </p>
        <div className="mt-4">
          <Link
            href={`/dashboard/${eventId}/add-ons`}
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
