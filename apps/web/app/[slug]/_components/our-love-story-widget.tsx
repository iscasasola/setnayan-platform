/**
 * Our Love Story — read-only render of events.love_story collected by the
 * onboarding Love Stage (Increment A.2). Renders How-we-met · The proposal ·
 * a milestones timeline; hides entirely when the story is empty. Defensive
 * parse — love_story is JSONB (unknown) with a rich, evolving shape.
 */
export function OurLoveStoryWidget({ config }: { config: unknown }) {
  const c = config && typeof config === 'object' ? (config as Record<string, unknown>) : {};
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const howWeMet = str(c.how_we_met);
  const proposal = str(c.proposal);
  const proposalSetting = str(c.proposal_setting);
  const milestones = (Array.isArray(c.milestones) ? (c.milestones as unknown[]) : [])
    .map((m) => {
      const mm = m && typeof m === 'object' ? (m as Record<string, unknown>) : {};
      const year = typeof mm.year === 'number' ? String(mm.year) : str(mm.year);
      return {
        year,
        title: str(mm.title) || str(mm.label) || str(mm.what),
        note: str(mm.note) || str(mm.text) || str(mm.detail),
      };
    })
    .filter((m) => m.year || m.title || m.note);

  if (!howWeMet && !proposal && milestones.length === 0) return null;

  return (
    <section className="space-y-5 rounded-xl border border-ink/10 bg-cream p-6">
      <p className="text-center font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
        Our love story
      </p>
      {howWeMet ? (
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/45">How we met</p>
          <p className="mx-auto mt-1.5 max-w-prose whitespace-pre-line text-sm leading-relaxed text-ink/80">
            {howWeMet}
          </p>
        </div>
      ) : null}
      {proposal ? (
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/45">
            The proposal{proposalSetting ? ` · ${proposalSetting}` : ''}
          </p>
          <p className="mx-auto mt-1.5 max-w-prose whitespace-pre-line text-sm leading-relaxed text-ink/80">
            {proposal}
          </p>
        </div>
      ) : null}
      {milestones.length > 0 ? (
        <ol className="mx-auto max-w-sm space-y-3 pt-1">
          {milestones.map((m, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-terracotta" aria-hidden />
              <div>
                {m.year ? (
                  <p className="font-mono text-xs uppercase tracking-[0.15em] text-terracotta">
                    {m.year}
                  </p>
                ) : null}
                {m.title ? (
                  <p className="font-serif text-base italic leading-snug text-ink">{m.title}</p>
                ) : null}
                {m.note ? <p className="text-xs leading-relaxed text-ink/65">{m.note}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
