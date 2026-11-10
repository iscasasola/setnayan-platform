'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { MenuSettingsButton } from '@/app/_components/menu-settings-button';
import { useToast } from '@/app/_components/toast/toast-provider';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { DatesRow } from '../../customers/_components/dates-row';
import { walletRowTitle } from '@/lib/shop-wallet';
import { portfolioCountLabel } from '@/lib/portfolio-count-label';
import { COLLECTION_SECTION_NAME as SECTION_NAME, WHO_BADGE, collectionRows, type CollectionsInput } from '@/lib/supplier-collections';
import { draftLine, pruneDraft, withDraft, type PageSaved } from '@/lib/supplier-page-draft';
import { usePageDraft } from '../../website/_components/use-page-draft';

/** One album Show can play: a collection's key or a group album's "<group>:<key>". */
export type ShowChoice = { key: string; title: string };

/** "Not picked yet" is a choice inside the dropdown (HOUSE_TEMPLATES T16), never an empty control. */
export const SHOW_NONE = 'none';

/**
 * 🖼 PORTFOLIO ⚙ — the shipped `MenuSettingsButton` sheet for the Portfolio tab (THE ONE BUILD A3 W15 Phase A, lane C4).
 *
 * WHO SEES WHAT — moved IN from the collections list (owner 9 Nov: *"Shouldnt this be in settings?"*; DECISION_LOG
 * "PORTFOLIO PROTOTYPE APPROVED FOR BUILD 5"; owner 11 Nov "SUPPLIER ASKS b–e ANSWERED" (d): the collections stay in
 * Portfolio and their who-sees-it controls live in the Portfolio's OWN ⚙ — NOT Shop › Settings):
 *   · Who sees each collection: On my page · Private · Shared with a couple. Only a collection a shipped column makes
 *     switchable (the page gallery, `pageSwitch`) gets the dropdown; the rest say who sees them, read-only.
 *   · 🔑 THE PAGE DROPDOWN IS A PAGE DRAFT CHANGE, NOT A SAVE — the same browser draft Your page applies (`usePageDraft`),
 *     so nothing reaches couples until Apply on Your page: "Shown on your page after Apply", word for word as before.
 *   · Show plays: ONE dropdown (approved (5)) — it was the ✓ circle on every row. The ▶ stays in the thumb row's menu.
 * THE SHOP'S FREE ROOM — as shipped: "12 of 50 free photos" and the rule in the uploader's words; the shop wallet;
 * Storage plans NOT ON SALE YET (no price shown or typed). ✂ No "What Show includes" toggles (map row 70 INVENTED).
 * 🔒 collections/the-portfolio-is-collections.test.ts · website/your-page-applies-once.test.ts
 */
export function PortfolioSettings({
  photos,
  free,
  allowanceUnread,
  walletBalance,
  cover = false,
  vendorId,
  input,
  saved,
  showChoices,
  picked,
  onPick,
}: {
  /** Drawn on the Portfolio band: the cover's ink (`MenuSettingsButton`'s own `cover` look). */
  cover?: boolean;
  photos: number;
  free: number;
  allowanceUnread: boolean;
  walletBalance: number | null;
  vendorId: string;
  input: CollectionsInput;
  saved: PageSaved;
  /** The albums that hold photos — what Show can play. */
  showChoices: readonly ShowChoice[];
  picked: string | null;
  onPick: (key: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const { draft, setDraft } = usePageDraft(vendorId, saved);
  const shown = withDraft(saved, draft);
  const rows = collectionRows({ ...input, page: { ...input.page, shown: shown.sections.portfolio } });
  const waiting = draftLine(draft, saved);
  const nf = (x: number) => x.toLocaleString('en-PH');

  const togglePage = (next: boolean) => {
    if (next === shown.sections.portfolio) return;
    setDraft((cur) => pruneDraft({ ...cur, sections: { ...shown.sections, portfolio: next } }, saved));
    toast.success(next ? 'Shown on your page after Apply' : 'Taken off your page after Apply');
  };

  return (
    <MenuSettingsButton menu="portfolio" open={open} onOpenChange={setOpen} cover={cover}>
      <div className="px-4 pb-6 pt-1" data-portfolio-settings="">
        {waiting ? (
          <Link
            href="/vendor-dashboard/website"
            className="sn-press mb-2 flex min-h-11 items-center gap-2 rounded-xl bg-[color-mix(in_srgb,rgb(var(--color-warn))_12%,transparent)] px-3 py-2 text-[13.5px] font-medium text-ink"
            data-collections-waiting=""
          >
            <span className="min-w-0 flex-1">{waiting} — Apply on Your page</span>
            <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} />
          </Link>
        ) : null}

        <p className="sn-eye pt-2">Who sees each collection</p>
        <ul className="divide-y divide-ink/10" data-portfolio-who="">
          {rows.map((r) => (
            <li key={r.key} className="flex min-h-[56px] items-center gap-3 py-2" data-portfolio-who-row={r.key}>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px] font-medium text-ink">{SECTION_NAME[r.key]}</b>
                <small className="block truncate text-[12.5px] text-ink/60">{r.line}</small>
              </span>
              {r.pageSwitch ? (
                <PickMenu
                  label={`Who sees ${SECTION_NAME[r.key]}`}
                  value={shown.sections.portfolio ? 'page' : 'private'}
                  options={[
                    { key: 'page', label: WHO_BADGE.page.word },
                    { key: 'private', label: WHO_BADGE.private.word },
                  ]}
                  onPick={(k) => togglePage(k === 'page')}
                  dataAttr="data-portfolio-who-pick"
                  className="min-h-11 max-w-[52%] flex-none"
                />
              ) : (
                <span
                  className="inline-flex h-10 max-w-[52%] flex-none items-center rounded-full border border-dashed border-ink/20 px-3 text-[13px] text-ink/65"
                  data-portfolio-who-word={r.key}
                >
                  <span className="truncate">{WHO_BADGE[r.who].word}</span>
                </span>
              )}
            </li>
          ))}
        </ul>

        <p className="sn-eye pt-5">Show plays</p>
        <div className="space-y-1.5 pt-1.5" data-portfolio-show-plays="">
          <PickMenu
            label="Show plays"
            value={picked ?? SHOW_NONE}
            options={[{ key: SHOW_NONE, label: 'Not picked yet' }, ...showChoices.map((c) => ({ key: c.key, label: c.title }))]}
            onPick={(k) => onPick(k === SHOW_NONE ? null : k)}
            dataAttr="data-portfolio-show-pick"
            className="min-h-11 w-full"
          />
          <p className="text-[12.5px] text-ink/60">The ▶ in the thumb row’s menu plays this album full screen.</p>
        </div>

        <p className="sn-eye pt-5">Your photos</p>
        <div className="divide-y divide-ink/10">
          <DatesRow
            data="portfolio-free"
            title={allowanceUnread ? 'Couldn’t read your photo allowance' : portfolioCountLabel(photos, free)}
            line={`The first ${nf(free)} are free. After that each photo uses 1 Papic credit from your shop wallet — paid once, kept while your shop exists. Taking one off frees a free spot.`}
          />
          <DatesRow data="portfolio-wallet" title={walletRowTitle(walletBalance)} line={walletBalance == null ? 'Couldn’t read your wallet just now' : 'Pays for photos past your free room'} />
          <DatesRow data="portfolio-storage" title="Storage plans" line="Not on sale yet" />
        </div>
      </div>
    </MenuSettingsButton>
  );
}
