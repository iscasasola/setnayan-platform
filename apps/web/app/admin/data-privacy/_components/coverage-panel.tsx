import { FileWarning, AlertTriangle, Link2 } from 'lucide-react';
import type { PrivacyControlRow } from '@/lib/data-privacy-controls';
import { NPC_DOCUMENTS } from '@/lib/npc-documents';
import {
  CONTROL_COVERAGE,
  FILING_ACTIVITIES_WITHOUT_CONTROL,
  CANDIDATE_UNLISTED_FLOWS,
  computePrivacyCoverage,
} from '@/lib/privacy-coverage';

const docTitle = (key: string): string =>
  NPC_DOCUMENTS.find((d) => d.key === key)?.title ?? key;

/**
 * Filing coverage & drift — the bridge between the live control board and the
 * NPC filing. Flags (a) controls active but not declared to the regulator,
 * (b) activities declared (a DPIA) with no live control, and (c) candidate app
 * flows not yet on the board. Read-only; a server component.
 */
export function CoveragePanel({ controls }: { controls: PrivacyControlRow[] }) {
  const activeKeys = new Set(
    controls.filter((c) => c.status === 'active').map((c) => c.control_key),
  );
  const report = computePrivacyCoverage(activeKeys);
  const titleFor = (key: string) =>
    controls.find((c) => c.control_key === key)?.title ?? key;

  return (
    <section className="mt-10">
      <h2 className="sn-sec flex items-center gap-2">
        <Link2 aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Filing coverage &amp; drift
      </h2>
      <p className="mt-1 max-w-2xl text-sm" style={{ color: 'var(--m-slate-2)' }}>
        The bridge between the switches above and the NPC filing below. Every privacy-sensitive
        control should be <strong>declared</strong> in the filing, and every declared activity
        should have a <strong>live control</strong>. Mismatches are flagged here.
        <span className="mt-1 block" style={{ color: 'var(--m-slate-3)' }}>
          {report.declaredCount} of {report.privacySensitiveTotal} privacy-sensitive controls declared.
        </span>
      </p>

      {report.undeclaredActive.length > 0 ? (
        <div className="sn-tile mt-4" style={{ borderColor: 'var(--sn-danger, #b42318)' }}>
          <p
            className="flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--sn-danger, #b42318)' }}
          >
            <AlertTriangle aria-hidden className="h-4 w-4" strokeWidth={2} />
            Live but not declared to the NPC ({report.undeclaredActive.length})
          </p>
          <ul className="mt-2 space-y-2">
            {report.undeclaredActive.map((k) => (
              <li key={k} className="text-sm">
                <span className="font-medium" style={{ color: 'var(--m-ink)' }}>
                  {titleFor(k)}
                </span>
                {CONTROL_COVERAGE[k].note ? (
                  <span className="block text-xs" style={{ color: 'var(--m-slate-2)' }}>
                    {CONTROL_COVERAGE[k].note}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Full control → filing map */}
      <ul className="mt-4 space-y-1.5">
        {controls.map((c) => {
          const cov = CONTROL_COVERAGE[c.control_key as keyof typeof CONTROL_COVERAGE];
          if (!cov) return null;
          const declared = cov.declaredIn.length > 0;
          const tone = !cov.privacySensitive
            ? 'var(--m-slate-3)'
            : declared
              ? 'var(--sn-success, #157347)'
              : 'var(--sn-danger, #b42318)';
          return (
            <li
              key={c.control_key}
              className="sn-tile flex flex-wrap items-start justify-between gap-2 py-2.5"
            >
              <span className="min-w-0 text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                {c.title}
              </span>
              <span className="text-xs" style={{ color: tone }}>
                {!cov.privacySensitive
                  ? 'n/a · activation switch'
                  : declared
                    ? `Declared: ${cov.declaredIn.map(docTitle).join(', ')}`
                    : '⚠ Not in the filing'}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Reverse drift: declared, but no live control */}
      <div className="mt-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--m-slate-3)' }}>
          Declared, but no live control
        </p>
        <ul className="mt-2 space-y-1.5">
          {FILING_ACTIVITIES_WITHOUT_CONTROL.map((g) => (
            <li key={g.docKey} className="sn-tile py-2.5">
              <p className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                <FileWarning
                  aria-hidden
                  className="mr-1.5 inline h-4 w-4 align-[-2px]"
                  style={{ color: 'var(--m-orange-2)' }}
                  strokeWidth={1.75}
                />
                {g.activity}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate-2)' }}>
                {g.note} <span style={{ color: 'var(--m-slate-3)' }}>({docTitle(g.docKey)})</span>
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* Candidate flows not yet on the board */}
      <div className="mt-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--m-slate-3)' }}>
          Candidate flows to review (not yet listed)
        </p>
        <ul className="mt-2 space-y-1.5">
          {CANDIDATE_UNLISTED_FLOWS.map((f) => (
            <li key={f.name} className="sn-tile py-2.5">
              <p className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                {f.name}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate-2)' }}>
                {f.note}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs" style={{ color: 'var(--m-slate-3)' }}>
          A starting list from the corpus — not an exhaustive codebase audit.
        </p>
      </div>
    </section>
  );
}
