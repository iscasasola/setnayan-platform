/**
 * Integrity watch › Cards — the fifth tab (service card checks, owner 2026-10-26; approved prototype frames 2, 3, 4,
 * 7). Presentational only: every prop is resolved data (`../cards-data.ts`), so `/dev/card-checks-lab` draws these
 * same components from fixtures.
 *
 * House rules kept: frames only on pressables (each row is pressable — it opens the card; evidence blocks are split
 * by dividers, not boxed); choices are one dropdown (status, reason); 44 px targets; light + dark via tokens.
 */
import Link from 'next/link';
import { ServiceCardView } from '@/app/_components/service-card-view';
import { InfoTip } from '@/app/_components/info-tip';
import { LinkPickMenu } from '@/app/_components/link-pick-menu';
import { SubmitButton } from '@/app/_components/submit-button';
import { relativeTime } from '@/lib/activity';
import { isWordsOnly, type CardReason } from '@/lib/service-card-checks';
import { quotedList } from '@/lib/service-card-check-copy';
import { addClaimWord, allowClaimWordForShop, removeClaimWord } from '../card-actions';
import { BULK_FORM_ID, BulkApproveBar, VerdictPanel } from './cards-client';
import {
  REASON_CHIP,
  type CardOpenView,
  type CardQueueRow,
  type CardReasonFilter,
  type CardStatusFilter,
  type ClaimWordRow,
} from './cards-types';

const CHIP_STYLE: Record<string, { background: string; color: string }> = {
  photo: { background: 'rgb(var(--color-danger) / 0.12)', color: 'rgb(var(--color-danger))' },
  price: { background: 'var(--m-orange-4)', color: 'rgb(var(--color-warn))' },
  service: { background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' },
  words: { background: 'var(--m-paper-2)', color: 'var(--m-ink)' },
  muted: { background: 'var(--m-paper-2)', color: 'var(--m-slate-2)' },
};

export function ReasonChip({ code, extra }: { code: CardReason['code'] | 'docs'; extra?: string }) {
  const c = code === 'docs' ? { label: 'Shop not yet verified', tone: 'muted' } : REASON_CHIP[code];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold"
      style={CHIP_STYLE[c.tone]}
      data-card-chip={code}
    >
      {c.label}
      {extra ? ` · ${extra}` : ''}
    </span>
  );
}

function chipsFor(row: { reasons: CardReason[]; shopVerified: boolean }) {
  const out = row.reasons.map((r) => {
    const extra = r.code === 'words' && row.reasons.length === 1 ? quotedList(r.hits) : undefined;
    return <ReasonChip key={r.code} code={r.code} extra={extra} />;
  });
  if (!row.shopVerified) out.push(<ReasonChip key="docs" code="docs" />);
  return out;
}

const STATUS_OPTIONS: { key: CardStatusFilter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'approved', label: 'Approved' },
  { key: 'asked_to_fix', label: 'Asked to fix' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];
const REASON_OPTIONS: { key: CardReasonFilter; label: string }[] = [
  { key: 'any', label: 'Any reason' },
  { key: 'photo', label: 'Photo seen elsewhere' },
  { key: 'price', label: 'Price outside band' },
  { key: 'service', label: 'Wrong service' },
  { key: 'words', label: 'Claim words' },
  { key: 'check_unavailable', label: 'Check didn’t finish' },
];

export function CardsQueue({
  rows,
  openCount,
  status,
  reason,
  now,
  basePath = '/admin/integrity-watch',
}: {
  rows: CardQueueRow[] | null;
  openCount: number;
  status: CardStatusFilter;
  reason: CardReasonFilter;
  now: Date;
  basePath?: string;
}) {
  const href = (s: CardStatusFilter, r: CardReasonFilter) =>
    `${basePath}?tab=cards&status=${s}${r === 'any' ? '' : `&reason=${r}`}`;
  return (
    <section data-cards-queue="">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink/60">Show</span>
          <LinkPickMenu
            label="Status"
            value={status}
            options={STATUS_OPTIONS.map((o) => ({
              key: o.key,
              label: o.key === 'open' ? `Open · ${openCount}` : o.label,
              href: href(o.key, reason),
            }))}
            dataAttr="cards-status"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink/60">Reason</span>
          <LinkPickMenu
            label="Reason"
            value={reason}
            options={REASON_OPTIONS.map((o) => ({ key: o.key, label: o.label, href: href(status, o.key) }))}
            dataAttr="cards-reason"
          />
        </div>
        <div className="ml-auto">
          <BulkApproveBar />
        </div>
      </div>

      {rows === null ? (
        <p role="alert" className="py-3 text-sm text-ink/70">
          Cards couldn’t load right now. We’ve logged it — refresh in a moment.
        </p>
      ) : rows.length === 0 ? (
        <p className="py-3 text-sm text-ink/65">No cards waiting.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const obvious = isWordsOnly(r.reasons) && (r.status === 'open' || r.status === 'asked_to_fix');
            return (
              <li
                key={r.flagId}
                className="relative grid grid-cols-[28px_56px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-2xl border p-3 lg:grid-cols-[28px_64px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_auto] lg:gap-x-4 lg:p-4"
                style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
                data-card-row={r.publicId}
              >
                {/* The whole row opens the card; the tick box sits above that link. */}
                <Link
                  href={`${basePath}?tab=cards&open=${r.publicId}`}
                  aria-label={`Open ${r.title}`}
                  className="sn-press absolute inset-0 rounded-2xl"
                />
                <label className="relative z-10 flex h-11 w-7 items-center justify-center">
                  <input
                    type="checkbox"
                    name="flag_id"
                    value={r.flagId}
                    form={BULK_FORM_ID}
                    disabled={!obvious}
                    aria-label={`Select ${r.title}`}
                    title={obvious ? 'Select for bulk approve' : 'Open it — this reason needs a look'}
                    className="h-5 w-5 disabled:opacity-30"
                  />
                </label>
                {r.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.coverUrl} alt="" className="pointer-events-none h-14 w-14 rounded-xl object-cover lg:h-16 lg:w-16" />
                ) : (
                  <span aria-hidden className="pointer-events-none h-14 w-14 rounded-xl lg:h-16 lg:w-16" style={{ background: 'var(--m-paper-2)' }} />
                )}
                <div className="pointer-events-none min-w-0">
                  <div className="text-[15px] font-semibold leading-snug text-ink lg:text-base">{r.title}</div>
                  <div className="mt-0.5 text-[13px] text-ink/60 lg:hidden">
                    {r.shopName} · {r.filedLabel}
                  </div>
                  <div className="mt-0.5 hidden text-[13px] text-ink/60 lg:block">{r.priceLine}</div>
                </div>
                <div className="pointer-events-none hidden min-w-0 text-[15px] text-ink lg:block">
                  {r.shopName}
                  <small className="block text-[12px] text-ink/55">{r.shopLine}</small>
                </div>
                <div className="pointer-events-none hidden min-w-0 text-[15px] text-ink lg:block">
                  {r.filedLabel}
                  {r.readsLike ? <small className="block text-[12px] text-ink/55">reads like {r.readsLike}</small> : null}
                </div>
                <div className="pointer-events-none col-span-3 col-start-1 flex flex-wrap gap-1.5 lg:col-span-1 lg:col-start-auto">
                  {chipsFor(r)}
                  {r.status === 'asked_to_fix' ? <span className="text-[12px] text-ink/55">asked to fix</span> : null}
                  {r.afterReject ? <span className="text-[12px] text-ink/55">saved again after a reject</span> : null}
                </div>
                <div className="pointer-events-none col-span-3 text-[13px] text-ink/60 lg:col-span-1 lg:text-right">
                  {relativeTime(r.age, now)}
                  {r.overSla ? <small className="block font-semibold" style={{ color: 'rgb(var(--color-warn))' }}>over 72h</small> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PriceRail({ r }: { r: Extract<CardReason, { code: 'price' }> }) {
  const max = Math.max(r.highPhp, r.pricePhp) * 1.1 || 1;
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / max) * 100))}%`;
  const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;
  return (
    <div className="mt-3">
      <div className="relative h-2.5 rounded-full" style={{ background: 'var(--m-paper-2)' }}>
        <span className="absolute top-0 h-2.5 rounded-full" style={{ left: pct(r.lowPhp), width: `calc(${pct(r.highPhp)} - ${pct(r.lowPhp)})`, background: 'var(--m-sage)' }} />
        <span className="absolute -top-1 h-4.5 w-0.5" style={{ left: pct(r.medianPhp), background: 'var(--m-slate-2)', height: 18 }} />
        <span className="absolute -top-1.5 h-5 w-5 -translate-x-1/2 rounded-full" style={{ left: pct(r.pricePhp), background: 'rgb(var(--color-warn))' }} title="This card" />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 font-mono text-[12px] text-ink/55">
        <span>low {peso(r.lowPhp)}</span>
        <span>median {peso(r.medianPhp)}</span>
        <span>high {peso(r.highPhp)}</span>
        <b className="text-ink">this card {peso(r.pricePhp)}</b>
      </div>
    </div>
  );
}

function markWords(title: string, hits: readonly string[]) {
  if (hits.length === 0) return title;
  const esc = hits.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const parts = title.split(new RegExp(`(${esc})`, 'ig'));
  return parts.map((p, i) =>
    hits.some((h) => h.toLowerCase() === p.toLowerCase()) ? (
      <mark key={i} className="rounded px-1" style={{ background: 'var(--m-orange-4)', color: 'inherit' }}>{p}</mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

const BASIS_WORD: Record<string, string> = { per_pax: ' per guest', per_hour: ' per hour', fixed: '' };

export function CardOpen({
  view,
  now,
  basePath = '/admin/integrity-watch',
}: {
  view: CardOpenView;
  now: Date;
  basePath?: string;
}) {
  const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;
  const holding = view.status === 'open' || view.status === 'asked_to_fix' || view.status === 'rejected';
  return (
    <section data-card-open={view.publicId}>
      <p className="mb-4 flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink/60">
        <Link href={`${basePath}?tab=cards`} className="inline-flex min-h-11 items-center underline underline-offset-2">‹ Cards</Link>
        <span>· <span className="font-mono">{view.publicId}</span> · flagged {relativeTime(view.flaggedAt, now)} ·</span>
        <Link href={`/admin/vendors/${view.vendorProfileId}`} className="inline-flex min-h-11 items-center text-sn-accent">Open supplier →</Link>
      </p>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/50">As couples would see it</p>
          <ServiceCardView card={view.card} detailsEnabled={false} />
          <p className="mt-4 flex flex-wrap items-center gap-2 text-[15px]">
            <b className="text-ink">{view.shopName}</b>
            <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={view.shopVerified ? { background: 'var(--m-sage)', color: 'rgb(var(--color-success, 43 116 74))' } : CHIP_STYLE.muted}>
              {view.shopState}
            </span>
          </p>
          <p className="mt-1 text-[14px] text-ink/60">{view.shopLine}</p>
          <p className="mt-3 text-[14px] text-ink/60">
            Filed under <b className="text-ink">{view.filedLabel}</b>
          </p>
          {view.shopCovers ? <p className="mt-1 text-[14px] text-ink/60">shop covers {view.shopCovers}</p> : null}
        </div>

        <div className="min-w-0">
          {view.afterReject ? (
            <p className="mb-3 text-[14px] text-ink/60">Saved again after a reject — this version waits for you whatever the checks said.</p>
          ) : null}
          {view.status === 'asked_to_fix' && view.resolutionNotes ? (
            <p className="mb-3 text-[14px] text-ink/60">You asked: “{view.resolutionNotes}”</p>
          ) : null}
          <ul className="divide-y" style={{ borderColor: 'var(--m-line)' }}>
            {view.reasons.map((r) => (
              <li key={r.code} className="py-5 first:pt-0" style={{ borderColor: 'var(--m-line)' }}>
                {r.code === 'photo' ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <ReasonChip code="photo" />
                      <span className="text-[17px] font-semibold text-ink">
                        {r.matches.some((m) => m.which === 'cover') ? 'The cover matches a photo on another shop' : 'A showcase photo matches a photo on another shop'}
                      </span>
                    </div>
                    {view.pairs.map((p) => (
                      <div key={p.imageFlagPublicId} className="mt-3">
                        <p className="text-[14px] text-ink/60">
                          Hamming {p.hamming}/64 · the match is the one {p.stillOpen ? 'already open' : 'recorded'} on Repost watch ({p.imageFlagPublicId}). Approving here resolves both.
                        </p>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          {[
                            { eb: 'This card’s photo', url: p.thisUrl, cap: p.thisCaption, tone: 'rgb(var(--color-danger))' },
                            { eb: 'Seen earlier on', url: p.sourceUrl, cap: p.sourceCaption, tone: 'var(--m-slate-2)' },
                          ].map((side) => (
                            <figure key={side.eb} className="min-w-0">
                              <figcaption className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: side.tone }}>{side.eb}</figcaption>
                              {side.url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={side.url} alt="" className="aspect-[16/9] w-full rounded-xl object-cover" />
                              ) : (
                                <span aria-hidden className="block aspect-[16/9] w-full rounded-xl" style={{ background: 'var(--m-paper-2)' }} />
                              )}
                              <p className="mt-2 text-[13px] text-ink/60">{side.cap}</p>
                            </figure>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                ) : r.code === 'price' ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <ReasonChip code="price" />
                      <span className="text-[17px] font-semibold text-ink">
                        {peso(r.pricePhp)}{BASIS_WORD[r.basis] ?? ''} where {view.filedLabel} runs {peso(r.lowPhp)}–{peso(r.highPhp)}
                      </span>
                    </div>
                    <p className="mt-2 text-[14px] text-ink/60">
                      Band: {view.filedLabel} · {view.bandRegionLabel ?? r.region} · All sizes · {r.sampleN} suppliers (Admin › Pricing › Price bands). Held below {Math.round((1 - r.tolerance) * 100)}% of low — the tolerance is admin-set.
                    </p>
                    <PriceRail r={r} />
                  </>
                ) : r.code === 'service' ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <ReasonChip code="service" />
                      <span className="text-[17px] font-semibold text-ink">Filed under {r.filedLabel}, reads like {r.matchedLabel}</span>
                    </div>
                    <p className="mt-2 text-[14px] text-ink/60">Words matched a reviewed search word of another service and none of its own.</p>
                    <dl className="mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-2 text-[15px]">
                      <dt className="text-ink/60">Filed under</dt>
                      <dd className="text-ink">{r.filedLabel}</dd>
                      <dt className="text-ink/60">Words found</dt>
                      <dd className="text-ink">{r.words.map((w) => `“${w}”`).join(', ')} → <b>{r.matchedLabel}</b> (search words, Admin › Categories)</dd>
                      <dt className="text-ink/60">Its own words</dt>
                      <dd className="text-ink">none of {r.ownWords.map((w) => `“${w}”`).join(', ') || 'its words'}</dd>
                    </dl>
                  </>
                ) : r.code === 'words' ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <ReasonChip code="words" />
                      <span className="text-[17px] font-semibold text-ink">
                        {r.hits.length === 1 ? 'One word from the list' : `${['', 'One', 'Two', 'Three', 'Four', 'Five'][r.hits.length] ?? r.hits.length} words from the list`}
                      </span>
                    </div>
                    <p className="mt-2 text-[14px] text-ink/60">The list lives under this tab. “Not a problem” allows that word for this shop only, from now on.</p>
                    <p className="mt-3 text-[17px] text-ink">“{markWords(view.title, r.hits)}”</p>
                    {holding ? (
                      <div className="mt-3 flex flex-wrap gap-3">
                        {r.hits.map((h) => (
                          <form key={h} action={allowClaimWordForShop}>
                            <input type="hidden" name="flag_id" value={view.flagId} />
                            <input type="hidden" name="phrase" value={h} />
                            <SubmitButton className="sn-press inline-flex min-h-11 items-center rounded-full border px-4 text-[14px] text-ink" pendingLabel="Allowing…">
                              Not a problem — stop flagging “{h}” for this shop
                            </SubmitButton>
                          </form>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <ReasonChip code="check_unavailable" />
                      <span className="text-[17px] font-semibold text-ink">The automatic check couldn’t finish</span>
                    </div>
                    <p className="mt-2 text-[14px] text-ink/60">
                      It couldn’t read: {r.checks.map((c) => ({ photo: 'photo matches', price: 'the price band', service: 'the search words', words: 'the claim words' })[c]).join(' · ') || 'its rules'}. Approve runs it again first.
                    </p>
                  </>
                )}
              </li>
            ))}
            {view.reasons.length === 0 ? (
              <li className="py-5 first:pt-0 text-[14px] text-ink/60">No automatic reason on this version — it is here because the card was rejected before.</li>
            ) : null}
          </ul>
          {holding ? <VerdictPanel flagId={view.flagId} canApprove /> : (
            <p className="border-t pt-4 text-[14px] text-ink/60" style={{ borderColor: 'var(--m-line)' }}>
              {view.status === 'approved' ? 'Approved' : 'Closed'}{view.resolutionNotes ? ` — ${view.resolutionNotes}` : ''}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function ClaimWordsFold({ words, open = false }: { words: ClaimWordRow[] | null; open?: boolean }) {
  return (
    <details open={open} className="mt-8 border-t pt-4" style={{ borderColor: 'var(--m-line)' }} data-claim-words="">
      <summary className="sn-press flex min-h-11 cursor-pointer list-none items-center gap-2">
        <span className="text-base font-semibold text-ink">Words that flag a card</span>
        <span className="text-[13px] text-ink/55">{words ? `· ${words.length}` : ''}</span>
      </summary>
      <div className="mt-2">
        <InfoTip label="Matched as whole words, any case." labelAs="p" labelClassName="text-[13px] text-ink/60" align="start" ariaLabel="About this list">
          <span className="block">Matched as whole words, any case, in the title, the inclusion lines and the add-on names. A hit never blocks a save — it holds the card for a look.</span>
          <span className="mt-2 block">Removing a word here does not re-open or close any card already in the list.</span>
        </InfoTip>
        {words === null ? (
          <p role="alert" className="py-3 text-sm text-ink/70">The list couldn’t load right now — refresh in a moment.</p>
        ) : (
          <ul className="mt-2 divide-y" style={{ borderColor: 'var(--m-line)' }}>
            {words.map((w) => (
              <li key={w.phrase} className="grid grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)_44px] items-center gap-3 py-1" style={{ borderColor: 'var(--m-line)' }}>
                <span className="text-[15px] text-ink">{w.phrase}</span>
                <span className="text-[13px] text-ink/55">{w.note ?? ''}</span>
                <form action={removeClaimWord}>
                  <input type="hidden" name="phrase" value={w.phrase} />
                  <button type="submit" aria-label={`Remove ${w.phrase}`} className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full text-lg text-ink/60">×</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addClaimWord} className="mt-3 flex flex-wrap gap-3">
          <input type="text" name="phrase" required maxLength={60} placeholder="Add a word or phrase" aria-label="Add a word" className="input-field min-h-11 min-w-0 flex-1" />
          <SubmitButton className="sn-press inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold text-sn-accent" pendingLabel="Adding…">Add</SubmitButton>
        </form>
      </div>
    </details>
  );
}
