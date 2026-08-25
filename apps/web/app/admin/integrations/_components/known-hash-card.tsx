import { ShieldAlert, ShieldCheck } from 'lucide-react';
import type { KnownHashIntegrationStatus } from '@/lib/known-hash-match';

// CSAM known-hash matching — READ-ONLY status.
//
// There is no toggle here on purpose. This integration cannot be switched on
// from an admin console: it requires the ORGANISATION to enrol with a hash
// provider (PhotoDNA / NCMEC / IWF) and to sign the NPC Circular 16-02
// processor agreement. Rendering a switch would imply otherwise.
//
// The card's job is the opposite of most cards on this page: it exists to make
// an ABSENT control visible. It states plainly that nothing is being checked,
// and counts the media that went through unchecked.

export function KnownHashCard({ status }: { status: KnownHashIntegrationStatus }) {
  const enrolled = status.enrolled;
  return (
    <div
      className={`space-y-3 rounded-2xl border p-5 ${
        enrolled ? 'border-ink/10 bg-cream' : 'border-amber-300/70 bg-amber-50/60'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            enrolled
              ? 'bg-emerald-100 text-emerald-900'
              : 'bg-amber-200/80 text-amber-950'
          }`}
        >
          {enrolled ? (
            <ShieldCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <ShieldAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          {enrolled ? 'Enrolled' : 'Not enrolled'}
        </span>
        <h3 className="text-sm font-semibold text-ink/90">
          CSAM known-hash matching
        </h3>
      </div>

      <p className="text-sm text-ink/80">{status.headline}</p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-ink/45">Provider</dt>
          <dd className="font-mono text-ink/80">{status.providerId ?? 'none'}</dd>
        </div>
        <div>
          <dt className="text-ink/45">Recording hook</dt>
          <dd className="font-mono text-ink/80">{status.hookEnabled ? 'on' : 'off'}</dd>
        </div>
        <div>
          <dt className="text-ink/45">Recorded unchecked</dt>
          <dd className="font-mono text-ink/80">
            {status.countsUnavailable ? 'unknown' : status.uncheckedCount}
          </dd>
        </div>
        <div>
          <dt className="text-ink/45">Provider-cleared</dt>
          <dd className="font-mono text-ink/80">
            {status.countsUnavailable ? 'unknown' : status.counts.no_match}
          </dd>
        </div>
      </dl>

      {status.countsUnavailable ? (
        <p className="text-xs text-ink/55">
          These counts could not be read, so they are <strong>unknown</strong> — deliberately not shown as zero. An
          unreadable table and an empty one return the same value, and “0
          unchecked” would be the exact wrong reading.
        </p>
      ) : null}

      {!enrolled ? (
        <div className="space-y-2 rounded-xl border border-amber-300/60 bg-amber-100/50 p-3 text-xs text-amber-950">
          <p>
            <strong>No known-hash matching is running on any upload.</strong>{' '}
            Uploads are screened by the NSFW classifier only. The hook records
            what happened per object so the exposure is countable, but recording
            an absence is not a control.
          </p>
          <p className="font-medium">To make this real — both are owner/DPO acts, not code:</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              Enrol the organisation with a hash provider — Microsoft PhotoDNA
              Cloud Service, NCMEC, or the Internet Watch Foundation — and execute
              their agreement.
            </li>
            <li>
              Sign the <strong>NPC Circular 16-02</strong> processor agreement
              with that provider and add the matching ROPA row.
            </li>
          </ol>
          <p>
            Only then does an adapter get wired into{' '}
            <code>resolveKnownHashProvider()</code>. Until then this card is
            telling you the truth, not reporting a fault.
          </p>
        </div>
      ) : null}
    </div>
  );
}
