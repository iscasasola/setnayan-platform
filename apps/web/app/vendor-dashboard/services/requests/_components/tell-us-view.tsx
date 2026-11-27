'use client';

import { ChevronLeft, ListChecks, Search } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import {
  TEMPLATE_SUBLINE,
  TemplateFail,
  TemplateRow,
  TemplateRows,
  TemplateSection,
} from '@/app/_components/template-rows';
import { RequestNameForm } from './name-fields';
import { othersPlace, SERVICE_REQUESTS_HREF } from '@/lib/service-requests';
import type { RequestGroup } from '@/lib/service-requests.server';

/** What the old address `/services/requests/new` carried (it forwards into the maker with these). */
export type TellUsSearch = { group?: string; tile?: string; error?: string; wantCategory?: string };

/** Where the three steps stand: no group (1 · pick a group), a group (2 · pick a category), a tile (3 · name it). */
export type TellUsAt = { group?: string; tile?: string };

/**
 * "CAN'T FIND YOURS? TELL US WHAT YOU DO" — three steps that open IN PLACE inside the card maker's layer (final check
 * B9, drawing `final-check-area-5_2026-11-25.html` § B9, approved 25 Nov; owner rulings 2026-11-13, ruling 1):
 *   1 · Pick a group      — the same grouped list couples browse (`getCoverageTaxonomy`).
 *   2 · Pick a category   — each row already says where they land: "<category> › Others".
 *   3 · Name your service — 2–80 characters + an optional note, posted to the SHIPPED `proposeCategory` with the
 *       category as `tile_id`.
 * A press is a step (`go`), never a page load; the layer's ‹ steps back (`TellUsHost`), and from step 1 returns to the
 * maker as it was. "Search again" goes back to the maker's own search. Rendered by `TellUsHost` and, on fixtures, by
 * /dev/service-requests-lab.
 */
export function TellUsWhatYouDoView({
  groups,
  at,
  go,
  searchAgain,
  error,
  fromMaker,
  retry,
}: {
  /** null = the categories could not be read (said, with Try again — never an empty list). */
  groups: readonly RequestGroup[] | null;
  at: TellUsAt;
  go: (to: TellUsAt) => void;
  /** Back to the maker's search ("Search again"). */
  searchAgain: () => void;
  error?: string | null;
  /** Carried through the submit, so the request's page still offers "Back to your card". */
  fromMaker: boolean;
  /** Where Try again re-reads the categories. */
  retry: string;
}) {
  const tile = at.tile && groups ? groups.flatMap((g) => g.categories).find((c) => c.tileId === at.tile) ?? null : null;
  const group = tile
    ? groups?.find((g) => g.categories.some((c) => c.tileId === tile.tileId)) ?? null
    : at.group && groups
      ? groups.find((g) => g.id === at.group) ?? null
      : null;

  const errorLine = error ? (
    <p role="alert" className="py-2 text-sn-base font-semibold" style={{ color: 'rgb(var(--color-danger))' }}>
      {error}
    </p>
  ) : null;

  if (!groups) {
    return (
      <div className="space-y-2 px-4 py-4 sm:px-6" data-request-step="unread">
        <TemplateSection label="Where does it belong?" first>
          <TemplateFail data="request-tree" retryHref={retry}>
            <strong>Couldn&rsquo;t load the categories.</strong> Nothing was sent.
          </TemplateFail>
        </TemplateSection>
      </div>
    );
  }

  // ── Step 3 · Name your service ─────────────────────────────────────────────
  if (tile && group) {
    return (
      <div className="space-y-2 px-4 py-4 sm:px-6" data-request-step="name">
        <TemplateSection label="Name your service" first right="Step 3 of 3">
          {errorLine}
          <RequestNameForm
            tileId={tile.tileId}
            fromMaker={fromMaker}
            before={
              <div>
                <p className="mb-1 text-sn-md font-semibold text-ink">Category</p>
                <button
                  type="button"
                  onClick={() => go({ group: group.id })}
                  className="sn-press flex min-h-11 w-full items-center justify-between rounded-full border border-[color:var(--m-line)] px-4 text-sn-base text-ink"
                  aria-label="Change category"
                >
                  <span>
                    {group.label} › {tile.label}
                  </span>
                  <span aria-hidden className="text-mulberry">▾</span>
                </button>
                <p className={`mt-1 ${TEMPLATE_SUBLINE}`}>Tap to change.</p>
              </div>
            }
            after={
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 border-y border-[color:var(--m-line)] py-3 text-sn-base">
                <dt className="font-semibold text-ink">Now</dt>
                <dd className="text-[color:var(--m-slate-2)]">
                  You go under <b className="text-ink">{othersPlace(tile.label)}</b>. Make your cards today — they file
                  under Miscellaneous until we place your service, and stay online while you wait.
                </dd>
                <dt className="font-semibold text-ink">Then</dt>
                <dd className="text-[color:var(--m-slate-2)]">
                  We add your service, move it to one we have, or keep it for your shop. Your cards move with it. You
                  get a notice either way.
                </dd>
              </dl>
            }
          />
        </TemplateSection>
      </div>
    );
  }

  // ── Step 2 · Pick a category ───────────────────────────────────────────────
  if (group) {
    return (
      <div className="space-y-2 px-4 py-4 sm:px-6" data-request-step="category">
        <TemplateSection label="Pick a category" first tip="Your service will sit here until we place it exactly." right="Step 2 of 3">
          {errorLine}
          <TemplateRows label="Categories">
            {group.categories.map((c) => (
              <TemplateRow
                key={c.tileId}
                onPress={() => go({ tile: c.tileId })}
                title={c.label}
                line={
                  <>
                    {group.label} › {c.label} › <b>Others</b>
                  </>
                }
              />
            ))}
          </TemplateRows>
        </TemplateSection>
        <div className="pt-2">
          <ActionButton tone="neutral" icon={<ChevronLeft aria-hidden />} label="Other groups" onClick={() => go({})} />
        </div>
      </div>
    );
  }

  // ── Step 1 · Pick a group ──────────────────────────────────────────────────
  return (
    <div className="space-y-2 px-4 py-4 sm:px-6" data-request-step="group">
      <TemplateSection label="Where does it belong?" first tip="The same list couples browse. Open the group closest to what you do." right="Step 1 of 3">
        {errorLine}
        <TemplateRows label="Groups">
          {groups.map((g) => (
            <TemplateRow
              key={g.id}
              onPress={() => go({ group: g.id })}
              title={g.label}
              line={`${g.categories.length} ${g.categories.length === 1 ? 'category' : 'categories'}`}
            />
          ))}
        </TemplateRows>
      </TemplateSection>
      <div className="flex flex-wrap gap-2 pt-2">
        <ActionButton tone="info" icon={<Search aria-hidden />} label="Search again" onClick={searchAgain} />
        <ActionButton tone="neutral" icon={<ListChecks aria-hidden />} label="Your requests" href={SERVICE_REQUESTS_HREF} />
      </div>
    </div>
  );
}
