import { UsersRound } from 'lucide-react';
import { formatCount } from '@/lib/format-number';
import { entourageSheetCount, type EntourageSheetSection } from '@/lib/supplier-march';

/**
 * 👥 ENTOURAGE — the per-person sheet template (hub tool `entourage`, DECISION_LOG 2026-11-23; drawing
 * `prototypes/hub_tools_working_2026-10-28/` template ②: a round mark, the name, the role on the right). REUSE: the
 * couple's own entourage (`loadMarch` → `entourageSheet`), read-only — only the couple changes it.
 *
 * Honest: `sections` null = not read, SAID as such (never "no entourage"); an empty list says the couple has not named
 * anyone yet.
 */
export function EntourageSheet({ sections }: { sections: readonly EntourageSheetSection[] | null }) {
  if (sections == null) {
    return (
      <div data-hub-tool="entourage" data-state="unreadable">
        <EntourageTitle />
        <p role="alert" className="mt-2 text-sn-md text-warn-800">
          We couldn’t load the couple’s entourage right now. Refresh to try again.
        </p>
      </div>
    );
  }
  const count = entourageSheetCount(sections);
  return (
    <div data-hub-tool="entourage" data-state="ok">
      <div className="flex items-center justify-between gap-2">
        <EntourageTitle />
        <span className="text-sn-md tabular-nums text-[color:var(--m-slate-2)]">
          {formatCount(count)} {count === 1 ? 'person' : 'people'}
        </span>
      </div>
      <p className="mt-1 text-sn-md text-[color:var(--m-slate-2)]">From the couple’s list. Only they can change it.</p>
      {count === 0 ? (
        <p className="mt-3 text-sn-md text-[color:var(--m-slate-2)]" data-entourage-empty="">
          The couple hasn’t named their entourage yet.
        </p>
      ) : (
        <div className="mt-2">
          {sections.map((section) => (
            <section key={section.key} aria-label={section.label} className="mt-3">
              <p className="text-sn-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]">{section.label}</p>
              <ul className="mt-1 [&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
                {section.people.map((p) => (
                  <li key={p.key} className="flex min-h-12 items-center gap-3 py-1.5" data-entourage-person="">
                    <span
                      aria-hidden
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sn-xs font-bold text-ink"
                      style={{ background: 'var(--m-line-soft)' }}
                    >
                      {p.initials}
                    </span>
                    <span className="min-w-0 flex-1 break-words text-sn-base text-ink">{p.name}</span>
                    {p.role ? <span className="shrink-0 text-right text-sn-md text-[color:var(--m-slate-2)]">{p.role}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** The tool's heading — the same as the checklists' (icon + title), so the tools read as one set. */
function EntourageTitle() {
  return (
    <h2 className="flex items-center gap-2 text-lg font-semibold">
      <UsersRound aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} /> Entourage
    </h2>
  );
}
