import { ExternalLink, Info } from 'lucide-react';
import type { VendorDossier } from '@/lib/vendor-deep-search';

/**
 * "What We Learned" — presentational render of a VendorDossier for the vendor's
 * OWN Deep Search result. Directive-less so it renders in BOTH the server page
 * (history) and the client runner (fresh result). Framed as an auto-fill review:
 * everything here is a suggestion the vendor copies into their profile.
 */

const CONFIDENCE_LABEL: Record<VendorDossier['confidence'], string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/50">{title}</p>
      <div className="mt-1.5 text-sm text-ink/80">{children}</div>
    </div>
  );
}

export function DossierView({ dossier }: { dossier: VendorDossier }) {
  const hasServices = dossier.detected_services.length > 0;
  const hasPrices = dossier.price_signals.length > 0;
  const hasPresence = dossier.web_presence.length > 0;
  const hasFlags = dossier.consistency_flags.length > 0;

  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: 'var(--m-line)', background: 'rgba(255,255,255,.72)' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/50">
          What we learned
        </p>
        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium text-ink/60"
          style={{ borderColor: 'var(--m-line)' }}
        >
          {CONFIDENCE_LABEL[dossier.confidence]}
        </span>
      </div>

      <Section title="Business summary">
        <p className="max-w-prose leading-relaxed">{dossier.business_summary}</p>
      </Section>

      {hasServices ? (
        <Section title="Services we found">
          <ul className="flex flex-wrap gap-1.5">
            {dossier.detected_services.map((s, i) => (
              <li
                key={`${s}-${i}`}
                className="rounded-full border px-2.5 py-0.5 text-xs text-ink/75"
                style={{ borderColor: 'var(--m-line)' }}
              >
                {s}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {hasPrices ? (
        <Section title="Prices we found on the web">
          <ul className="space-y-1.5">
            {dossier.price_signals.map((p, i) => (
              <li key={`${p.label}-${i}`} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-sm font-semibold text-ink">{p.price}</span>
                <span className="text-xs text-ink/60">{p.label}</span>
                {p.source_url ? (
                  <a
                    href={p.source_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-0.5 text-xs text-mulberry hover:underline"
                  >
                    source <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {hasPresence ? (
        <Section title="Where your business shows up online">
          <ul className="space-y-1.5">
            {dossier.web_presence.map((w, i) => (
              <li key={`${w.platform}-${i}`} className="text-sm">
                <span className="font-medium text-ink">{w.platform}</span>
                {w.url ? (
                  <>
                    {' — '}
                    <a
                      href={w.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-0.5 text-mulberry hover:underline"
                    >
                      open <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden />
                    </a>
                  </>
                ) : null}
                {w.note ? <span className="text-ink/60"> · {w.note}</span> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {dossier.ads_findings ? (
        <Section title="Advertising">
          <p className="max-w-prose leading-relaxed">{dossier.ads_findings}</p>
        </Section>
      ) : null}

      {hasFlags ? (
        <Section title="Things to double-check">
          <ul className="space-y-1">
            {dossier.consistency_flags.map((f, i) => (
              <li key={`${f}-${i}`} className="flex items-start gap-1.5 text-sm text-ink/75">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange" strokeWidth={1.75} aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <p className="mt-4 text-[11px] leading-relaxed text-ink/50">
        This is a research snapshot from the open web — review it and copy anything
        accurate into your Shop profile. We never change your profile automatically.
      </p>
    </div>
  );
}
