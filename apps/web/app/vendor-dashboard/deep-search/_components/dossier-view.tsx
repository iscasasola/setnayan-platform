import { ExternalLink, Info } from 'lucide-react';
import type { VendorDossier } from '@/lib/vendor-deep-search';
import { Badge } from '@/app/_components/badge';
import { TEMPLATE_MONEY, TEMPLATE_SUBLINE } from '@/app/_components/template-rows';
import { SharePdfButton } from '@/app/_components/share-pdf-button';
import {
  DEEP_SEARCH_KEEP_DAYS,
  deepSearchFindingTitle,
  deepSearchPdfFileName,
  deepSearchPdfHref,
} from '@/lib/deep-search-findings';

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
    <div className="mt-[18px] first:mt-0">
      <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">{title}</p>
      <div className="mt-1.5 text-[15px] text-ink">{children}</div>
    </div>
  );
}

export function DossierView({
  dossier,
  pdf,
}: {
  dossier: VendorDossier;
  /**
   * 📄 The search's PDF (owner 2026-10-29: *"run search would also create a pdf file of the search created"*) — the
   * shared Share button with Paper ▾, made from this same result by `/api/vendor/deep-search-pdf`. Null when the
   * result is not kept any more (or not stored yet): no button, never a file that cannot be made.
   */
  pdf?: { dossierId: number; searchedAt: string | null } | null;
}) {
  const hasServices = dossier.detected_services.length > 0;
  const hasPrices = dossier.price_signals.length > 0;
  const hasPresence = dossier.web_presence.length > 0;
  const hasFlags = dossier.consistency_flags.length > 0;

  return (
    <div className="border-t border-[color:var(--m-line)] pt-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">
          What we learned
        </p>
        <Badge tone={dossier.confidence === 'high' ? 'ok' : dossier.confidence === 'medium' ? 'wait' : 'quiet'}>
          {CONFIDENCE_LABEL[dossier.confidence]}
        </Badge>
      </div>

      <Section title={deepSearchFindingTitle('summary')}>
        <p className="max-w-prose leading-relaxed">{dossier.business_summary}</p>
      </Section>

      {hasServices ? (
        <Section title={deepSearchFindingTitle('services')}>
          <ul className="flex flex-wrap gap-1.5">
            {dossier.detected_services.map((s, i) => (
              <li
                key={`${s}-${i}`}
                className="rounded-full border border-[color:var(--m-line)] px-2.5 py-0.5 text-[13px] text-ink"
              >
                {s}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {hasPrices ? (
        <Section title={deepSearchFindingTitle('prices')}>
          <ul className="space-y-1.5">
            {dossier.price_signals.map((p, i) => (
              <li key={`${p.label}-${i}`} className="flex flex-wrap items-baseline gap-x-2">
                <span className={`text-[15px] ${TEMPLATE_MONEY}`}>{p.price}</span>
                <span className={TEMPLATE_SUBLINE}>{p.label}</span>
                {p.source_url ? (
                  <a
                    href={p.source_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex min-h-11 items-center gap-0.5 text-[13px] text-mulberry hover:underline"
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
        <Section title={deepSearchFindingTitle('presence')}>
          <ul className="space-y-1.5">
            {dossier.web_presence.map((w, i) => (
              <li key={`${w.platform}-${i}`} className="text-[15px]">
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
                {w.note ? <span className="text-[color:var(--m-slate-2)]"> · {w.note}</span> : null}
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
        <Section title={deepSearchFindingTitle('flags')}>
          <ul className="space-y-1">
            {dossier.consistency_flags.map((f, i) => (
              <li key={`${f}-${i}`} className="flex items-start gap-1.5 text-[15px] text-ink">
                <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'rgb(var(--color-warn))' }} strokeWidth={1.75} aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <p className={`mt-4 ${TEMPLATE_SUBLINE}`}>
        This is a research snapshot from the open web — review it and copy anything
        accurate into your Shop profile. We never change your profile automatically.
        Kept {DEEP_SEARCH_KEEP_DAYS} days, then deleted.
      </p>
      {pdf ? (
        <div className="mt-3" data-deep-search-pdf="">
          <SharePdfButton
            href={deepSearchPdfHref(pdf.dossierId)}
            fileName={deepSearchPdfFileName(pdf.searchedAt)}
            name="Share this search (PDF)"
            papers="document"
          />
        </div>
      ) : null}
    </div>
  );
}
