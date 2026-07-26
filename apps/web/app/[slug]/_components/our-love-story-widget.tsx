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

  // Pahina chapter grammar (design 2026-07-25 §7). NOTE: this widget carries an
  // UNNUMBERED eyebrow on purpose — `OurStory` also renders a story chapter (№ 02)
  // from the same `love_story` column on a different path, and a couple who
  // enables this widget could surface both on one page. Two "№ 02" headings would
  // break the magazine conceit; the label alone reads correctly either way.
  return (
    <section className="space-y-6">
      <p className="pahina-eyebrow">
        <span>Our love story</span>
      </p>
      {howWeMet ? (
        <div>
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/45">
            How we met
          </p>
          <p className="mt-2 max-w-prose whitespace-pre-line text-base leading-relaxed text-ink/80">
            {howWeMet}
          </p>
        </div>
      ) : null}
      {proposal ? (
        <div>
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/45">
            The proposal{proposalSetting ? ` · ${proposalSetting}` : ''}
          </p>
          <p className="mt-2 max-w-prose whitespace-pre-line text-base leading-relaxed text-ink/80">
            {proposal}
          </p>
        </div>
      ) : null}
      {milestones.length > 0 ? (
        <ol className="max-w-prose space-y-5 pt-1">
          {milestones.map((m, i) => (
            <li key={i} className="border-l border-ink/12 pl-5">
              {m.year ? (
                <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-gild">
                  {m.year}
                </p>
              ) : null}
              {m.title ? (
                <p className="mt-1 font-pahina text-xl font-light leading-snug text-ink">
                  {m.title}
                </p>
              ) : null}
              {m.note ? <p className="mt-1 text-sm leading-relaxed text-ink/65">{m.note}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
