'use client';

/**
 * The lab's shell with a LIVE Build body (Suppliers PR3): the REAL
 * `ServicesTakeover` and the REAL `BuildBody`, with the five writes answered
 * from fixtures held in this component — the lab has no session and no
 * database. The view is computed by the same pure functions the page calls
 * (`lib/suppliers-build.ts`), and a save goes through the same `planSaveAs`
 * the server action decides with, so twin detection behaves as it will live.
 *
 *   ?tab=build            open on Build
 *   &build=garden         …with "Garden build" already in use (bar: Saved)
 *   &build=none           …a new event's Build: no picks, no saved builds
 *   &build=unread         …the saved builds could not be read
 *   &build=answers        …Bituin (picked) said no to the booking ask
 */
import { useMemo, useRef, useState, type ComponentProps } from 'react';
import { ServicesTakeover } from '@/app/dashboard/[eventId]/vendors/_components/services-takeover';
import { BuildBody, BuildWritesStandInCtx, type BuildWrites } from '@/app/dashboard/[eventId]/vendors/_components/build-body';
import { BookStandInCtx, BookThisBuild } from '@/app/dashboard/[eventId]/vendors/_components/book-this-build';
import type { FinalizeVendorResult } from '@/app/dashboard/[eventId]/vendors/actions';
import { MerkadoGuardBanner } from '@/app/dashboard/[eventId]/vendors/_components/merkado-guard-banner';
import { displayBuildTitle, planSaveAs, sortSavedBuilds } from '@/lib/named-builds';
import { buildLinesOf, buildViewOf, lineSupplier } from '@/lib/suppliers-build';
import { teamMoney } from '@/lib/your-team';
import {
  LAB_BUILD_BLOCKED,
  LAB_BUILD_BUDGET_PHP,
  LAB_BUILD_DATE_FIT,
  LAB_BUILD_DAY,
  LAB_BUILD_INCLUSIONS,
  LAB_BUILD_PRICES,
  LAB_BUILD_TILES,
  LAB_SAVED_BUILDS,
  labBuildFree,
  type LabSavedBuild,
} from './build-fixtures';

type ShellProps = Omit<ComponentProps<typeof ServicesTakeover>, 'tally' | 'buildBody' | 'buildSlot' | 'compareSlot'>;

const ok = async () => ({ ok: true as const });
const row = (b: LabSavedBuild) => ({ build_id: b.id, label: null, title: b.title, created_at: String(b.created).padStart(6, '0'), picks: b.picks });

export function LabSuppliersShell({ start, bookedCount, ...shell }: ShellProps & { start: string | null }) {
  const [builds, setBuilds] = useState<LabSavedBuild[]>(start === 'none' ? [] : LAB_SAVED_BUILDS);
  // tile → the supplier pinned to the build there.
  const [picks, setPicks] = useState<Record<string, string>>(
    start === 'garden' ? { catering: 'v-luntian' } : start === 'answers' ? { catering: 'v-bituin' } : {},
  );
  // Suppliers the couple has asked to book — they wait for their yes.
  const [asked, setAsked] = useState<ReadonlySet<string>>(new Set());
  const tiles = useMemo(
    () =>
      LAB_BUILD_TILES.map((t) => ({
        ...t,
        vendors:
          start === 'none'
            ? []
            : t.vendors.map((x) => ({
                ...x,
                // `&build=answers`: Bituin said no, Hiraya let the window run out.
                lockState: asked.has(x.vendorId)
                  ? ('requested' as const)
                  : start === 'answers' && x.vendorId === 'v-bituin'
                    ? ('declined' as const)
                    : start === 'answers' && x.vendorId === 'v-hiraya'
                      ? ('expired' as const)
                      : ('none' as const),
              })),
      })),
    [asked, start],
  );

  const view = useMemo(() => {
    const lines = buildLinesOf({
      tiles,
      priceOf: (id) => LAB_BUILD_PRICES[id] ?? null,
      inclusionsOf: (id) => LAB_BUILD_INCLUSIONS[id] ?? [],
      inBuild: new Set(Object.values(picks)),
      blocked: LAB_BUILD_BLOCKED,
    });
    const booked = lines.flatMap((l) => (l.booked ? [l.booked] : []));
    const money = teamMoney({
      lockedCentavos: booked.reduce((sum, s) => sum + (s.pricePhp ?? 0), 0) * 100,
      lockedUnpricedCount: booked.filter((s) => s.pricePhp == null).length,
      candidateCostsPhp: lines.flatMap((l) => (l.pick && !l.booked ? [l.pick.pricePhp] : [])),
      budgetPhp: LAB_BUILD_BUDGET_PHP,
    });
    const ordered = sortSavedBuilds(builds.map(row));
    const draft = buildViewOf({ lines, money, dateFit: LAB_BUILD_DATE_FIT, dateLabel: LAB_BUILD_DAY, saved: [], buildsMeasured: true, freeByBuildId: {} });
    return buildViewOf({
      lines,
      money,
      dateFit: LAB_BUILD_DATE_FIT,
      dateLabel: LAB_BUILD_DAY,
      saved: ordered.map((b, i) => ({ id: b.build_id, name: displayBuildTitle(b, i), title: b.title, budgetPhp: LAB_BUILD_BUDGET_PHP, picks: b.picks })),
      buildsMeasured: start !== 'unread',
      freeByBuildId: Object.fromEntries([['current', labBuildFree(draft.snapshot.picks)], ...builds.map((b) => [b.id, labBuildFree(b.picks)] as const)]),
    });
  }, [builds, picks, tiles, start]);

  // The saved builds as they are NOW — an Undo runs a write captured a render ago.
  const buildsNow = useRef(builds);
  buildsNow.current = builds;
  const writes = useMemo<BuildWrites>(() => {
    const tileOf = (vendorId: string) => LAB_BUILD_TILES.find((t) => t.vendors.some((x) => x.vendorId === vendorId))?.tile ?? null;
    return {
      setPick: async ({ vendorId }) => {
        const tile = tileOf(vendorId);
        if (tile) setPicks((now) => ({ ...now, [tile]: vendorId }));
        return ok();
      },
      removePick: async ({ vendorId }) => {
        setPicks((now) => Object.fromEntries(Object.entries(now).filter(([, id]) => id !== vendorId)));
        return ok();
      },
      save: async ({ rawName, overwriteBuildId, snapshot }) => {
        const plan = planSaveAs({ rawName, overwriteBuildId: overwriteBuildId ?? null, existing: buildsNow.current.map(row), picks: snapshot.picks });
        if (plan.mode === 'twin') return { ok: false, error: `Already saved — exactly “${plan.twinTitle}”` };
        if (plan.mode === 'unchanged') return { ok: false, error: 'Nothing changed' };
        if (plan.mode === 'overwrite') {
          setBuilds((now) => now.map((b) => (b.id === plan.buildId ? { ...b, title: plan.title, picks: snapshot.picks } : b)));
        } else {
          setBuilds((now) => [
            ...now,
            { id: `b-${now.length + 1}-${snapshot.picks.length}`, title: plan.title, budgetPhp: snapshot.budgetPhp, created: Date.now(), picks: snapshot.picks },
          ]);
        }
        return ok();
      },
      remove: async ({ buildId }) => {
        setBuilds((now) => now.filter((b) => b.id !== buildId));
        return ok();
      },
      use: async ({ picks: next }) => {
        setPicks(Object.fromEntries(next.flatMap((x) => (tileOf(x.vendorId) ? [[tileOf(x.vendorId)!, x.vendorId] as const] : []))));
        return ok();
      },
    };
  }, []);

  // What the booking answers in the lab: Bituin is asked at once; Hiraya's
  // booking makes the date official (one yes, then asked); Luntian books by
  // time slot (its own step on the card).
  const book = useMemo(
    () =>
      async (fields: Array<[string, string]>): Promise<FinalizeVendorResult> => {
        const get = (k: string) => fields.find(([key]) => key === k)?.[1] ?? '';
        const vendorId = get('vendor_id');
        const vendorName = LAB_BUILD_TILES.flatMap((t) => t.vendors).find((x) => x.vendorId === vendorId)?.name ?? 'Supplier';
        await new Promise((r) => setTimeout(r, 200));
        if (vendorId === 'v-luntian') return { status: 'slot_required', vendorId, vendorName };
        if (vendorId === 'v-hiraya' && get('confirm_date_lock') !== '1') {
          return { status: 'date_will_lock', vendorId, vendorName, resultingDate: '2026-12-12', dateLabel: 'Saturday, December 12, 2026', impact: null };
        }
        setAsked((now) => new Set(now).add(vendorId));
        return { status: 'lock_requested', vendorId, vendorName, expiresAt: '2026-10-12T00:00:00Z' };
      },
    [],
  );

  const picked = view.lines.filter((l) => lineSupplier(l) != null).length;
  return (
    <BookStandInCtx.Provider value={book}>
    <BuildWritesStandInCtx.Provider value={writes}>
      <ServicesTakeover
        {...shell}
        bookedCount={bookedCount}
        tally={{ filled: view.counts.filled, total: view.counts.total, knownPhp: view.money.bookedPhp + view.money.toBookPhp, unpriced: view.money.unpriced }}
        buildBody={
          <BuildBody
            eventId={shell.eventId}
            view={view}
            basePath="/dev/suppliers-lab"
            guardSlot={picked > 0 ? <MerkadoGuardBanner guard={{ ok: true, issues: [] }} demand={[]} /> : null}
            bookSlot={
              <BookThisBuild
                eventId={shell.eventId}
                basePath="/dev/suppliers-lab"
                picks={view.lines.flatMap((l) =>
                  l.pick && !l.booked && !l.pickAsked
                    ? [{ vendorId: l.pick.vendorId, name: l.pick.name, tile: l.tile, category: l.label, blockedNote: l.pickNote }]
                    : [],
                )}
              />
            }
          />
        }
      />
    </BuildWritesStandInCtx.Provider>
    </BookStandInCtx.Provider>
  );
}
