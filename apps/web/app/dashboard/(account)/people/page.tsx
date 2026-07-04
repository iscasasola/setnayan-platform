import { Users, HeartHandshake, Sparkles, Lock } from 'lucide-react';

export const metadata = {
  title: 'People',
};

/**
 * People — the reserved home for the person-spine connections layer
 * (owner-locked 2026-07-04, 03_Strategy/People_Graph_and_Lifelong_Identity_
 * 2026-07-04.md). This is a Phase-0 RESERVED page: it renders a preview of what
 * arrives with connections in Phase 2 (which is gated behind the `people` table
 * + PH counsel) and wires up no graph data itself. It gives the feature its
 * permanent nav home from day one so the real flow drops in without a repaint.
 *
 * Three connection layers, all mutually confirmed and event-seeded:
 *   - Family (blood/affinal) — first-degree only: spouse · parent · sibling ·
 *     child. Grandparents / cousins / in-laws are derived, never declared.
 *   - Godparents (ritual kinship) — ninong/ninang, EVENT-created (kasal /
 *     binyag / kumpil), no retroactive backfill.
 *   - Friends — a lighter co-presence layer, distinct from kinship.
 */
export default function PeoplePage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">People</h1>
        <p className="text-base text-ink/60">
          Family, godparents, and friends — the people your celebrations connect.
        </p>
      </header>

      <div className="mb-8 flex items-start gap-3 rounded-xl border border-ink/10 bg-cream p-4">
        <Sparkles aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" />
        <p className="text-sm text-ink/70">
          <span className="font-medium text-ink">Coming with connections.</span> Each
          person is suggested from your events, then mutually confirmed — nothing connects
          until both sides agree. This is where it will live.
        </p>
      </div>

      <div className="space-y-8">
        <ReservedSection
          title="Family"
          note="You only add your closest five — spouse, parent, sibling, child. Grandparents, cousins, and in-laws appear automatically."
        >
          <div className="flex flex-wrap gap-2">
            {['Spouse', 'Parent', 'Sibling', 'Child'].map((rel) => (
              <span
                key={rel}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white/60 px-3 py-1.5 text-sm text-ink/50"
              >
                <span aria-hidden className="text-terracotta/70">
                  +
                </span>
                {rel}
              </span>
            ))}
          </div>
        </ReservedSection>

        <ReservedSection
          title="Godparents · Ninong / Ninang"
          note="Created from your binyag, wedding, and confirmation roles. Kumpare/kumare links form automatically."
          icon={<HeartHandshake aria-hidden className="h-4 w-4 text-ink/40" />}
        >
          <ul className="space-y-2">
            <PreviewPerson name="Elena Reyes" detail="Ninang · from your binyag" />
            <PreviewPerson name="Ramon Cruz" detail="Ninong · principal sponsor, a wedding" />
          </ul>
        </ReservedSection>

        <ReservedSection
          title="Friends"
          note="Suggested from the people you've celebrated with — a lighter connection, separate from family."
          icon={<Users aria-hidden className="h-4 w-4 text-ink/40" />}
        />

        <div className="flex flex-wrap gap-2 border-t border-ink/10 pt-6">
          {['Mutually confirmed', 'Adults first', 'Private to you'].map((g) => (
            <span
              key={g}
              className="rounded-full border border-ink/10 bg-cream px-3 py-1 text-xs text-ink/60"
            >
              {g}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReservedSection({
  title,
  note,
  icon,
  children,
}: {
  title: string;
  note: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h2 className="text-base font-semibold text-ink">{title}</h2>
      </div>
      <p className="mb-3 text-sm text-ink/55">{note}</p>
      {children}
    </section>
  );
}

function PreviewPerson({ name, detail }: { name: string; detail: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <li className="flex items-center gap-3 rounded-lg border border-ink/10 bg-cream p-3 opacity-70">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/20 bg-white/60 font-serif text-sm italic text-ink"
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{name}</p>
        <p className="truncate text-xs text-ink/55">{detail}</p>
      </div>
      <Lock aria-hidden className="h-4 w-4 shrink-0 text-ink/40" />
    </li>
  );
}
