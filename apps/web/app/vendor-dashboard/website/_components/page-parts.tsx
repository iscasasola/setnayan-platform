'use client';

import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Eye, Share2 } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { Badge } from '@/app/_components/badge';
import { PaidMark } from '@/app/_components/paid-mark';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { useToast } from '@/app/_components/toast/toast-provider';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { formatCount } from '@/lib/format-number';
import {
  MICROSITE_ABOUT_MAX,
  MICROSITE_ACCENTS,
  MICROSITE_DEFAULT_ACCENT_KEY,
  MICROSITE_FEATURED_EDITORIALS_MAX,
  MICROSITE_FEATURED_SERVICES_MAX,
} from '@/lib/vendor-microsite';
import {
  changedParts,
  draftEntries,
  draftLine,
  pruneDraft,
  withDraft,
  type PageSaved,
} from '@/lib/supplier-page-draft';
import { DatesRow } from '../../customers/_components/dates-row';
import { SupplierThumbRow } from '../../_components/supplier-thumb-row';
import { applyVendorPageDraft } from '../../actions';
import { usePageDraft } from './use-page-draft';
import type { PagePlanLine } from '../page-data';

/**
 * YOUR PAGE — the page as couples see it on top, then one row per part in the order they scroll (simpler supplier
 * dashboard step 5 · prototype moment 7, `SCREENS.page`):
 *
 *   details · cover · about · services shown · photos and videos · reviews · where you work · badges · Look ◆ ·
 *   your own web address · auto-reply · what each plan adds        thumb: View my page · Apply
 *
 * 🔑 EDITS ARE A DRAFT; APPLY PUBLISHES. Every part below changes the draft (`usePageDraft` — the supplier's own
 * browser, one key per shop) and the face on top shows it at once; nothing reaches couples until Apply, which posts
 * the whole draft ONCE (`applyVendorPageDraft`: the same per-part rules as the old instant saves, all or nothing).
 * The old editor (`shop/_components/website-editor.tsx`) saved every tap the moment it was made — a half-finished
 * page was live while the supplier was still choosing.
 *
 * Parts that are not page curation keep their own save, as they did: your web address (a domain is DNS work, not a
 * draft), auto-reply (it answers messages, it is not on the page), and the details rows (they go to Your details).
 * ◆ marks a plan's part and never blocks: every control works for every plan, and Apply is where a plan is asked.
 */
export type PageClientData = {
  vendorId: string;
  businessName: string;
  publicPath: string | null;
  displayHost: string;
  live: boolean;
  visible: boolean;
  isVerified: boolean;
  kindWord: string | null;
  whereLine: string;
  yearsLabel: string | null;
  rating: number | null;
  reviewCount: number | null;
  saved: PageSaved;
  services: { key: string; label: string }[];
  portfolio: { key: string; url: string }[];
  photoCount: number;
  videoCount: number;
  reviews: { id: string; label: string }[] | null;
  stories: { id: string; label: string }[] | null;
  personalizeAsks: boolean;
  proAsks: boolean;
  storeShell: boolean;
  plans: PagePlanLine[];
};

export function PageParts({
  d,
  domainBody,
  autoReplyBody,
}: {
  d: PageClientData;
  /** Your own web address — the shipped DomainManager (its own saves). */
  domainBody: ReactNode;
  /** The shipped auto-reply card, or null while its switch is off. */
  autoReplyBody: ReactNode | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const { draft, setDraft, clear, ready } = usePageDraft(d.vendorId, d.saved);
  const shown = useMemo(() => withDraft(d.saved, draft), [d.saved, draft]);
  const line = draftLine(draft, d.saved);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  const change = useCallback(
    (part: Partial<PageSaved>) => setDraft((cur) => pruneDraft({ ...cur, ...part }, d.saved)),
    [setDraft, d.saved],
  );

  const apply = () => {
    const entries = draftEntries(draft, d.saved);
    if (entries.length === 0) return;
    const fd = new FormData();
    for (const [k, v] of entries) fd.append(k, v);
    setStatus('Applying to your page…');
    start(async () => {
      const res = await applyVendorPageDraft(null, fd);
      if (!res.ok) {
        setStatus(res.error);
        toast.error(res.error);
        return;
      }
      clear();
      setStatus(null);
      toast.success(d.live ? 'Your page is updated — couples see it now.' : 'Saved — couples see it once Setnayan lists your shop.');
      router.refresh();
    });
  };

  const share = async () => {
    if (!d.publicPath) return;
    const url = `${window.location.origin}${d.publicPath}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: d.businessName, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Link copied.');
    } catch {
      /* the share sheet was closed — nothing to say */
    }
  };

  const cover = shown.hero ? d.portfolio.find((p) => p.key === shown.hero)?.url : d.portfolio[0]?.url;
  const accent = MICROSITE_ACCENTS.find((a) => a.key === (shown.accent || MICROSITE_DEFAULT_ACCENT_KEY));
  const ratingLine =
    d.rating === null
      ? null
      : d.reviewCount
        ? `${d.rating.toFixed(1)} ★ · ${formatCount(d.reviewCount)}`
        : 'No reviews yet';
  const diamond = (on: boolean) => (on ? ' · ◆' : '');

  return (
    <>
      {/* ── The page as couples see it ─────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white" data-page-face="">
        <div
          className="relative flex h-[132px] items-end bg-cover bg-center px-3.5 py-2.5"
          style={{
            backgroundImage: cover
              ? `linear-gradient(to top, rgb(0 0 0 / 0.55), transparent 60%), url(${JSON.stringify(cover)})`
              : `linear-gradient(160deg, ${accent?.swatch ?? '#d8b58a'}, rgb(var(--color-ink) / 0.75))`,
          }}
        >
          <span className="truncate text-lg font-semibold text-white">{d.businessName}</span>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-2.5">
          <span className="min-w-0 flex-1 truncate text-sm text-ink/60">
            {[ratingLine, d.kindWord].filter(Boolean).join(' · ')}
          </span>
          <Badge tone={d.live ? 'ok' : 'quiet'} data="page-live">
            {d.live ? 'Couples can see it' : 'Not shown yet'}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2 px-3.5 pb-3.5">
          {d.publicPath && d.visible ? (
            <ActionButton tone="neutral" icon={Eye} label="View my page" href={d.publicPath} target="_blank" />
          ) : (
            <ActionButton tone="neutral" icon={Eye} label="View my page" waiting />
          )}
          <ActionButton tone="neutral" icon={Share2} label="Share my page" onClick={share} waiting={!d.publicPath || !d.live} />
        </div>
        {!d.live ? (
          <p className="border-t border-ink/10 px-3.5 py-2.5 text-[13px] text-ink/60">
            Only you can open it for now. Couples see it once Setnayan checks your documents and lists your shop.
          </p>
        ) : null}
      </div>

      {line || status ? (
        <p className="text-[13.5px] font-medium text-ink" data-page-status="" aria-live="polite">
          {pending || status ? status : `${line} — not on your page until you Apply`}
        </p>
      ) : null}

      <p className="sn-eye pt-1">Tap a part to change it</p>
      <div className="divide-y divide-ink/10" data-page-parts="" data-ready={ready ? '' : undefined}>
        <DatesRow
          data="page-details"
          title="Your details"
          line="Name and logo · what you do · where · contact · documents"
          href="/vendor-dashboard/profile"
        />

        <Fold anchor="cover" data="page-cover" title={`Cover photo${diamond(d.proAsks)}`} line={shown.hero ? 'Your pick' : 'Automatic — your first photo'}>
          <div className="space-y-2 pb-4">
            {d.proAsks ? <PlanAsk plan="Pro" /> : null}
            {d.portfolio.length === 0 ? (
              <DatesRow data="page-cover-empty" title="No photos yet" line="Add photos to your collections first" href="/vendor-dashboard/collections" />
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                <PickTile selected={shown.hero === ''} onClick={() => change({ hero: '' })} label="Automatic" />
                {d.portfolio.map((p) => (
                  <PickTile key={p.key} selected={shown.hero === p.key} onClick={() => change({ hero: p.key })} photo={p.url} label="Use as cover" />
                ))}
              </div>
            )}
          </div>
        </Fold>

        <Fold anchor="about" data="page-about" title={`About${diamond(d.personalizeAsks)}`} line={shown.about ? shown.about.split(/(?<=[.!?])\s/)[0] : 'One paragraph · optional'}>
          <div className="space-y-2 pb-4">
            {d.personalizeAsks ? <PlanAsk plan="Solo" /> : null}
            <textarea
              value={shown.about}
              onChange={(e) => change({ about: e.target.value })}
              maxLength={MICROSITE_ABOUT_MAX}
              rows={4}
              placeholder="Two or three sentences on who you are and the couples you work with."
              className="input-field w-full"
              aria-label="About"
            />
            <p className="text-xs tabular-nums text-ink/50">
              {formatCount(shown.about.length)}/{formatCount(MICROSITE_ABOUT_MAX)}
            </p>
          </div>
        </Fold>

        <Fold
          anchor="services"
          data="page-services"
          title={`Services shown first${diamond(d.personalizeAsks)}`}
          line={`${formatCount(shown.services.length)} of ${formatCount(Math.min(MICROSITE_FEATURED_SERVICES_MAX, d.services.length))} picked`}
        >
          <div className="pb-4">
            {d.services.length === 0 ? (
              <DatesRow data="page-services-empty" title="Nothing to pick yet" line="Add what you do first" href="/vendor-dashboard/profile#what" />
            ) : (
              d.services.map((s) => {
                const on = shown.services.includes(s.key);
                const full = !on && shown.services.length >= MICROSITE_FEATURED_SERVICES_MAX;
                return (
                  <SwitchRow
                    key={s.key}
                    title={s.label}
                    on={on}
                    disabled={full}
                    note={full ? `Up to ${MICROSITE_FEATURED_SERVICES_MAX}` : undefined}
                    onToggle={() =>
                      change({ services: on ? shown.services.filter((x) => x !== s.key) : [...shown.services, s.key] })
                    }
                  />
                );
              })
            )}
          </div>
        </Fold>

        <Fold
          anchor="photos"
          data="page-photos"
          title="Photos and videos"
          line={`${formatCount(d.photoCount)} photos · ${formatCount(d.videoCount)} videos · from your collections`}
          aside={
            <Badge tone={shown.sections.portfolio ? 'ok' : 'quiet'} data="page-photos">
              {shown.sections.portfolio ? 'Shown' : 'Hidden'}
            </Badge>
          }
        >
          <div className="pb-4">
            <SwitchRow
              title="Show them on my page"
              on={shown.sections.portfolio}
              onToggle={() => change({ sections: { ...shown.sections, portfolio: !shown.sections.portfolio } })}
            />
            <DatesRow data="page-photos-pick" title="Pick from your collections" line="Add · take out · Instagram" href="/vendor-dashboard/collections" />
          </div>
        </Fold>

        <Fold anchor="reviews" data="page-reviews" title="Reviews and stories" line={ratingLine ?? 'Could not be read just now'}>
          <div className="space-y-1 pb-4">
            <p className="pt-1 text-[13px] font-semibold text-ink">Pinned at the top{diamond(d.proAsks)}</p>
            {d.proAsks ? <PlanAsk plan="Pro" /> : null}
            {d.reviews === null ? (
              <p className="text-sm text-ink/60">Your reviews could not be read just now.</p>
            ) : d.reviews.length === 0 ? (
              <p className="text-sm text-ink/60">No reviews yet — once a couple reviews you, pin one here.</p>
            ) : (
              <PickMenu
                label="Pinned review"
                value={shown.pin || '__none'}
                options={[{ key: '__none', label: 'None — newest first' }, ...d.reviews.map((r) => ({ key: r.id, label: r.label }))]}
                onPick={(k) => change({ pin: k === '__none' ? '' : k })}
                dataAttr="data-page-pin"
                className="min-h-11 w-full"
              />
            )}
            <SwitchRow
              title="Who trusts you"
              line="The shops that recommend you"
              on={shown.sections.trusted_by}
              onToggle={() => change({ sections: { ...shown.sections, trusted_by: !shown.sections.trusted_by } })}
            />
            <SwitchRow
              title="Stories"
              line="Weddings you worked on, as their couples told them"
              on={shown.sections.editorials}
              onToggle={() => change({ sections: { ...shown.sections, editorials: !shown.sections.editorials } })}
            />
            {d.stories && d.stories.length > 0 ? (
              <PickMenu
                label="Stories shown first"
                value={null}
                buttonText={`Shown first${diamond(d.proAsks)} · ${formatCount(shown.stories.length)} of ${formatCount(Math.min(MICROSITE_FEATURED_EDITORIALS_MAX, d.stories.length))}`}
                options={d.stories.map((s) => ({ key: s.id, label: s.label }))}
                picked={shown.stories}
                onPick={(k) =>
                  change({
                    stories: shown.stories.includes(k)
                      ? shown.stories.filter((x) => x !== k)
                      : shown.stories.length >= MICROSITE_FEATURED_EDITORIALS_MAX
                        ? shown.stories
                        : [...shown.stories, k],
                  })
                }
                dataAttr="data-page-stories"
                className="min-h-11 w-full"
              />
            ) : null}
            <DatesRow data="page-reply" title="Reply to a review" href="/vendor-dashboard/reviews" />
          </div>
        </Fold>

        <DatesRow data="page-where" title="Where you work" line={d.whereLine} href="/vendor-dashboard/profile#where" />

        <DatesRow
          data="page-badges"
          title="Awards and badges"
          line={[d.isVerified ? 'Verified' : null, d.yearsLabel, 'they show by themselves'].filter(Boolean).join(' · ')}
        />

        <Fold
          anchor="look"
          data="page-look"
          title={`Look${diamond(d.personalizeAsks)}`}
          line={accent?.label ?? 'Your colour'}
          lead={<span aria-hidden className="h-5 w-5 flex-none rounded-full border border-ink/10" style={{ background: accent?.swatch }} />}
        >
          <div className="space-y-2 pb-4">
            {d.personalizeAsks ? <PlanAsk plan="Solo" /> : null}
            <PickMenu
              label="Your colour"
              value={shown.accent || MICROSITE_DEFAULT_ACCENT_KEY}
              options={MICROSITE_ACCENTS.map((a) => ({
                key: a.key,
                label: a.label,
                preview: <span aria-hidden className="inline-block h-4 w-4 rounded-full" style={{ background: a.swatch }} />,
              }))}
              onPick={(k) => change({ accent: k === MICROSITE_DEFAULT_ACCENT_KEY ? '' : k })}
              dataAttr="data-page-accent"
              className="min-h-11 w-full"
            />
          </div>
        </Fold>

        <Fold
          anchor="domain"
          data="page-domain"
          title="Your web address"
          line={d.publicPath ? `${d.displayHost}${d.publicPath}` : 'Name your shop first'}
        >
          <div className="pb-4">{domainBody}</div>
        </Fold>

        {autoReplyBody ? (
          <Fold anchor="auto-reply" data="page-autoreply" title="Auto-reply" line="Answers the first message">
            <div className="pb-4">{autoReplyBody}</div>
          </Fold>
        ) : null}

        {d.storeShell ? null : (
          <Fold anchor="plans" data="page-plans" title="What each plan adds" line={d.plans.map((p) => (p.pro ? `${p.plan} ◆` : p.plan)).join(' · ')}>
            <div className="pb-4">
              {d.plans.map((p) => (
                <DatesRow key={p.plan} data={`page-plan-${p.plan.toLowerCase()}`} title={p.pro ? `◆ ${p.plan}` : p.plan} line={p.line} />
              ))}
              <DatesRow data="page-plans-see" title="See plans" href="/vendor-dashboard/subscription" />
            </div>
          </Fold>
        )}
      </div>

      <SupplierThumbRow name="page" label="Your page">
        {d.publicPath && d.visible ? (
          <ActionButton tone="neutral" icon={Eye} label="View my page" href={d.publicPath} target="_blank" />
        ) : (
          <ActionButton tone="neutral" icon={Eye} label="View my page" waiting />
        )}
        <ActionButton
          tone="brand"
          main
          icon={Check}
          label={pending ? 'Applying…' : 'Apply'}
          onClick={apply}
          waiting={pending || changedParts(draft, d.saved).length === 0}
          aria-pressed={pending}
        />
      </SupplierThumbRow>
    </>
  );
}

/** ◆ — a plan's part. Information, never a lock: the control works, and Apply is where the plan is asked. */
function PlanAsk({ plan }: { plan: 'Solo' | 'Pro' }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-ink/60">
      <PaidMark state="try" label={`Part of ${plan} — try it here; Apply asks for ${plan}`} text={plan.toUpperCase()} size="xs" />
      Part of {plan}. Try it here — Apply asks for the plan.
    </p>
  );
}

function SwitchRow({
  title,
  line,
  note,
  on,
  disabled,
  onToggle,
}: {
  title: string;
  line?: string;
  note?: string;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex min-h-[56px] items-center gap-3 border-t border-ink/10 py-2 first:border-t-0">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-ink">{title}</span>
        {line || note ? <span className="block text-[13px] text-ink/55">{note ?? line}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        disabled={disabled}
        onClick={onToggle}
        className={SWITCH_BUTTON}
      >
        <SwitchTrack on={on} />
      </button>
    </div>
  );
}

function PickTile({
  selected,
  onClick,
  photo,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  photo?: string;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={`sn-press relative flex aspect-[4/3] min-h-11 items-center justify-center overflow-hidden rounded-lg border-2 ${selected ? 'border-sn-accent' : 'border-ink/10'}`}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs text-ink/60">{label}</span>
      )}
      {selected ? (
        <span aria-hidden className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sn-accent text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}
