/**
 * lib/deep-search-pdf.ts — 📄 A DEEP SEARCH AS A FILE (owner, with the Supplier dashboard v13 approval 2026-10-29:
 * *"run search would also create a pdf file of the search created"*).
 *
 * The search's result, drawn on the SHARED PDF engine (`lib/share-pdf.ts` — the one every Setnayan paper uses, with its
 * Paper ▾: A4 · Letter · Long bond). This file only turns a result into a `SharePdfDoc`; it draws nothing itself.
 *
 *   page 1 · the mark + SETNAYAN · DEEP SEARCH · the shop's name · "Searched <date> · kept until <date>" · four figures
 *            (services · prices · places · to double-check — a count, never a zero for "unknown": a result is only drawn
 *            once complete, so each count is a fact)
 *   then   · the five findings, in the card's order (`DEEP_SEARCH_FINDINGS`): Business summary · Services we found ·
 *            Prices we found · Where you show up · Things to double-check — a finding the web gave nothing for says so
 *   last   · "Nothing on your page changes until you accept it" + how long it is kept
 *
 * 🔑 WHY THE FILE IS DRAWN FROM THE KEPT RESULT, NOT STORED BESIDE IT: the result (`vendor_web_dossiers`) is what is
 * kept 180 days; a second stored copy would be a second thing to delete and could outlive it. Drawn on demand from the
 * result, the PDF exists exactly as long as the search does — the route refuses once the keep window has passed — and
 * every share of it is the same words the supplier saw. (The shared engine's own rule: "Built on demand by a route —
 * never when a page opens.")
 *
 * PURE layout (no I/O): the route (`app/api/vendor/deep-search-pdf/route.ts`) does every read behind its gate.
 */
import { formatCount } from '@/lib/format-number';
import { sharePdf, type SharePdfDoc, type SharePdfPaper, type SharePdfSection } from '@/lib/share-pdf';
import type { VendorDossier } from '@/lib/vendor-deep-search';
import {
  DEEP_SEARCH_KEEP_DAYS,
  deepSearchCounts,
  deepSearchFindingTitle,
  deepSearchKeptUntil,
} from '@/lib/deep-search-findings';

export { deepSearchPdfFileName } from '@/lib/deep-search-findings';

export type DeepSearchPdfInput = {
  businessName: string;
  dossier: VendorDossier;
  /** The result's own stamp (`vendor_web_dossiers.created_at`). */
  searchedAt: string;
  generatedAt: Date;
  paper?: SharePdfPaper;
};

const CONFIDENCE: Record<VendorDossier['confidence'], string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

const day = (d: Date) =>
  d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });

/** The document the shared engine draws. Exported for the guard, which reads it without drawing. */
export function deepSearchPdfDoc(input: DeepSearchPdfInput): SharePdfDoc {
  const d = input.dossier;
  const n = deepSearchCounts(d);
  const searched = Number.isFinite(Date.parse(input.searchedAt)) ? new Date(input.searchedAt) : null;
  const until = deepSearchKeptUntil(input.searchedAt);
  const none = 'Nothing found on the web for this.';

  const sections: SharePdfSection[] = [
    {
      title: deepSearchFindingTitle('summary'),
      aside: CONFIDENCE[d.confidence],
      columns: [],
      rows: d.business_summary.trim() ? [{ main: d.business_summary.trim(), cells: [] }] : [],
      empty: none,
    },
    {
      title: deepSearchFindingTitle('services'),
      columns: [],
      rows: d.detected_services.map((s) => ({ main: s, cells: [] })),
      empty: none,
    },
    {
      title: deepSearchFindingTitle('prices'),
      columns: [{ label: 'PRICE', width: 110 }],
      rows: d.price_signals.map((p) => ({ main: p.label, sub: p.source_url, cells: [p.price] })),
      empty: none,
    },
    {
      title: deepSearchFindingTitle('presence'),
      columns: [],
      rows: d.web_presence.map((w) => ({ main: w.note ? `${w.platform} — ${w.note}` : w.platform, sub: w.url, cells: [] })),
      empty: none,
    },
    {
      title: deepSearchFindingTitle('flags'),
      columns: [],
      rows: d.consistency_flags.map((f) => ({ main: f, cells: [] })),
      empty: 'Nothing to double-check — what the web says matches your shop.',
    },
  ];
  if (d.ads_findings?.trim()) {
    sections.push({ title: 'Advertising', columns: [], rows: [{ main: d.ads_findings.trim(), cells: [] }] });
  }

  return {
    kind: 'DEEP SEARCH',
    title: input.businessName,
    meta: [searched ? `Searched ${day(searched)}` : null, until ? `Kept until ${day(until)}` : null],
    summary: {
      figures: [
        { label: 'SERVICES', value: formatCount(n.services) },
        { label: 'PRICES', value: formatCount(n.prices) },
        { label: 'PLACES', value: formatCount(n.presence) },
        { label: 'TO CHECK', value: formatCount(n.flags) },
      ],
    },
    sections,
    notes: [
      'What the web says about your shop — research from the open web. Nothing on your Setnayan page changes until you accept it.',
      `Kept ${DEEP_SEARCH_KEEP_DAYS} days from the search, then deleted.`,
    ],
    generatedAt: input.generatedAt,
    fileTitle: `${input.businessName} — Deep Search`,
    paper: input.paper,
  };
}

export async function deepSearchPdf(input: DeepSearchPdfInput): Promise<Uint8Array> {
  return sharePdf(deepSearchPdfDoc(input));
}
