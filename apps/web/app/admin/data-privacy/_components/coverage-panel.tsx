import type { PrivacyControlRow } from '@/lib/data-privacy-controls';
import { NPC_DOCUMENTS } from '@/lib/npc-documents';
import {
  CONTROL_COVERAGE,
  FILING_ACTIVITIES_WITHOUT_CONTROL,
  CANDIDATE_UNLISTED_FLOWS,
  computePrivacyCoverage,
} from '@/lib/privacy-coverage';
import { formatCount } from '@/lib/format-number';
import { Badge, One, Row, Rows, Sec } from '@/app/admin/app-performance/_components/insights-parts';

/** A row's second line that must be read whole — `Row` cuts its line with "…"; this lets it wrap instead. */
const whole = (text: string) => <span className="whitespace-normal">{text}</span>;

const docTitle = (key: string): string =>
  NPC_DOCUMENTS.find((d) => d.key === key)?.title ?? key;

/**
 * Filing coverage & drift — the bridge between the live control board and the
 * NPC filing. Flags (a) controls active but not declared to the regulator,
 * (b) activities declared (a DPIA) with no live control, and (c) candidate app
 * flows not yet on the board. Read-only; a server component.
 *
 * Drawn to the Insights drawing (admin_pub/insights.html › Privacy & NPC › Coverage & drift): the bridge sentence in
 * the opening ⓘ, each list a section of hairline rows — no tiles around read-only facts (T18).
 */
export function CoveragePanel({ controls }: { controls: PrivacyControlRow[] }) {
  const activeKeys = new Set(
    controls.filter((c) => c.status === 'active').map((c) => c.control_key),
  );
  const retiredKeys = new Set(
    controls.filter((c) => c.status === 'retired').map((c) => c.control_key),
  );
  const report = computePrivacyCoverage(activeKeys, retiredKeys);
  const titleFor = (key: string) =>
    controls.find((c) => c.control_key === key)?.title ?? key;

  return (
    <section data-privacy-coverage="">
      <One
        label={`${formatCount(report.declaredCount)} of ${formatCount(report.privacySensitiveTotal)} privacy-sensitive controls declared`}
      >
        The bridge between the switches and the NPC filing. Every privacy-sensitive control should be declared in the
        filing, and every declared activity should have a live control. Mismatches are flagged here.
      </One>

      {report.undeclaredActive.length > 0 ? (
        <>
          <Sec title="Live but not declared to the NPC" count={report.undeclaredActive.length} />
          <Rows label="Live but not declared to the NPC">
            {report.undeclaredActive.map((k) => (
              <Row
                key={k}
                title={titleFor(k)}
                sub={whole(CONTROL_COVERAGE[k].note || '⚠ Not in the filing')}
                tone="danger"
                trail={<Badge tone="danger">undeclared</Badge>}
              />
            ))}
          </Rows>
        </>
      ) : null}

      {/* Full control → filing map */}
      <Sec title="Every control" count={controls.filter((c) => CONTROL_COVERAGE[c.control_key as keyof typeof CONTROL_COVERAGE]).length} />
      <Rows label="Every control">
        {controls.map((c) => {
          const cov = CONTROL_COVERAGE[c.control_key as keyof typeof CONTROL_COVERAGE];
          if (!cov) return null;
          const isRetired = c.status === 'retired';
          const declared = cov.declaredIn.length > 0;
          const missing = !isRetired && cov.privacySensitive && !declared;
          return (
            <Row
              key={c.control_key}
              title={c.title}
              tone={missing ? 'danger' : undefined}
              sub={whole(
                isRetired
                  ? 'Retired · not live processing'
                  : !cov.privacySensitive
                    ? 'n/a · activation switch'
                    : declared
                      ? `Declared: ${cov.declaredIn.map(docTitle).join(', ')}`
                      : '⚠ Not in the filing',
              )}
              trail={
                isRetired ? (
                  <Badge tone="info">retired</Badge>
                ) : !cov.privacySensitive ? null : declared ? (
                  <Badge tone="ok">declared</Badge>
                ) : (
                  <Badge tone="danger">undeclared</Badge>
                )
              }
            />
          );
        })}
      </Rows>

      {/* Reverse drift: declared, but no live control */}
      <Sec title="Declared, but no live control" count={FILING_ACTIVITIES_WITHOUT_CONTROL.length} />
      {FILING_ACTIVITIES_WITHOUT_CONTROL.length === 0 ? (
        <p className="border-t border-ink/10 py-2.5 text-[13px] text-[var(--sn-success-deep)]">
          None — every declared activity now has a control on the board.
        </p>
      ) : (
        <Rows label="Declared, but no live control">
          {FILING_ACTIVITIES_WITHOUT_CONTROL.map((g) => (
            <Row key={g.docKey} title={g.activity} sub={whole(`${g.note} (${docTitle(g.docKey)})`)} tone="warn" />
          ))}
        </Rows>
      )}

      {/* Candidate flows not yet on the board */}
      <Sec
        title="Candidate flows to review (not yet listed)"
        about="A starting list from the corpus — not an exhaustive codebase audit."
        count={CANDIDATE_UNLISTED_FLOWS.length}
      />
      <Rows label="Candidate flows to review">
        {CANDIDATE_UNLISTED_FLOWS.map((f) => (
          <Row key={f.name} title={f.name} sub={whole(f.note)} />
        ))}
      </Rows>
    </section>
  );
}
