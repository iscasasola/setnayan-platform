"use client";

import { useMemo, useState } from "react";
import {
  familyForRole,
  guestDisplayName,
  type Event,
  type Guest,
  type Household,
  type RsvpStatus,
  type WeddingTable,
} from "@/lib/db/types";
import { StatsStrip } from "./stats-strip";
import { Toolbar, type ToolbarFilterState } from "./toolbar";
import { FacetsSidebar } from "./facets-sidebar";
import { DesktopList } from "./desktop-list";
import { MobileList } from "./mobile-list";
import { MobileAppHeader } from "./mobile-app-header";
import { MobileStatusRow } from "./mobile-status-row";
import { MobileChipRail } from "./mobile-chip-rail";
import { DetailDrawer } from "./detail-drawer";
import { GuestFormDialog } from "./guest-form-dialog";
import { CsvImportDialog } from "./csv-import-dialog";
import { buildDisplayRows } from "./pairing";
import { DEFAULT_FACET, type FacetState } from "./facet-state";

interface Props {
  event: Event;
  initialGuests: Guest[];
  households: Household[];
  tables: WeddingTable[];
}

export function GuestsPage({ event, initialGuests, households, tables }: Props) {
  // Filter state
  const [filter, setFilter] = useState<ToolbarFilterState>({
    search: "",
    status: "all",
    side: "all",
    sort: "last_name",
  });
  const [facet, setFacet] = useState<FacetState>(DEFAULT_FACET);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // Selection state
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCsvDialog, setShowCsvDialog] = useState(false);

  // Derived: filtered guests (independent of pairing)
  const filteredGuests = useMemo(() => {
    return applyFilters(initialGuests, filter, facet, selectedTags);
  }, [initialGuests, filter, facet, selectedTags]);

  // Derived: display rows (paired guests collapse into a single row)
  const displayRows = useMemo(
    () => sortRows(buildDisplayRows(filteredGuests, households), filter.sort),
    [filteredGuests, households, filter.sort],
  );

  // Counts for chips and facet sidebar
  const counts = useMemo(() => computeCounts(initialGuests), [initialGuests]);
  const facetCounts = useMemo(() => computeFacetCounts(initialGuests), [initialGuests]);
  const scheduleBlockCounts = useMemo(() => computeBlockCounts(initialGuests), [initialGuests]);

  // Custom tags collected from data
  const customTags = useMemo(() => {
    const set = new Set<string>();
    for (const g of initialGuests) for (const t of g.custom_tags) set.add(t);
    return Array.from(set).sort();
  }, [initialGuests]);

  // Plus-one lookups: primary → +1 row, +1 → primary host. Built once over all
  // guests (not the filtered set) so the relation survives any active filter.
  const plusOneByPrimaryId = useMemo(() => {
    const map = new Map<string, Guest>();
    for (const g of initialGuests) {
      if (g.plus_one_of_guest_id) map.set(g.plus_one_of_guest_id, g);
    }
    return map;
  }, [initialGuests]);

  const hostByPlusOneId = useMemo(() => {
    const byId = new Map(initialGuests.map((g) => [g.guest_id, g] as const));
    const map = new Map<string, Guest>();
    for (const g of initialGuests) {
      if (g.plus_one_of_guest_id) {
        const host = byId.get(g.plus_one_of_guest_id);
        if (host) map.set(g.guest_id, host);
      }
    }
    return map;
  }, [initialGuests]);

  const selectedGuest = selectedGuestId
    ? initialGuests.find((g) => g.guest_id === selectedGuestId) ?? null
    : null;
  const selectedPartner = selectedGuest?.pair_with_guest_id
    ? initialGuests.find((g) => g.guest_id === selectedGuest.pair_with_guest_id) ?? null
    : null;
  const selectedHousehold = selectedGuest?.household_id
    ? households.find((h) => h.household_id === selectedGuest.household_id) ?? null
    : null;
  const selectedTable = selectedGuest?.table_assignment_id
    ? tables.find((t) => t.table_id === selectedGuest.table_assignment_id) ?? null
    : null;
  const editingGuest = editingGuestId
    ? initialGuests.find((g) => g.guest_id === editingGuestId) ?? null
    : null;

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  return (
    <div className="dash-page-wrap relative">
      {/* Mobile-only app header (back / Guests / count / search). Hidden on desktop. */}
      <MobileAppHeader
        totalCount={initialGuests.length}
        searchValue={filter.search}
        onSearchChange={(v) => setFilter((f) => ({ ...f, search: v }))}
      />

      {/* Mobile-only status row + chip rail. Hidden on desktop. */}
      <MobileStatusRow guests={initialGuests} />
      <MobileChipRail
        filter={filter}
        onFilterChange={(p) => setFilter((f) => ({ ...f, ...p }))}
        facet={facet}
        onFacetChange={setFacet}
        customTags={customTags}
        selectedTags={selectedTags}
        onTagToggle={toggleTag}
        counts={counts}
      />

      {/* Mobile list */}
      <MobileList
        rows={displayRows}
        onSelect={setSelectedGuestId}
        hostByPlusOneId={hostByPlusOneId}
      />

      {/* Desktop wrapper — hidden on mobile, full layout on lg+ */}
      <div className="hidden lg:block">
        <div className="px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-6">
            {/* Page header (desktop) */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="meta-label mb-2">Dashboard / Guests</p>
                <h1 className="display-title">Guest List</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowCsvDialog(true)}
                  className="btn-ghost"
                >
                  <span aria-hidden>⤓</span> Import CSV
                </button>
                <button
                  type="button"
                  disabled
                  className="btn-ghost cursor-not-allowed opacity-60"
                  title="Export ships in a follow-up work order"
                >
                  <span aria-hidden>⇪</span> Export
                </button>
                <button
                  type="button"
                  disabled
                  className="btn-default cursor-not-allowed opacity-60"
                  title="Invitations ship in a follow-up work order"
                >
                  <span aria-hidden>✉</span> Send invitations
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddDialog(true)}
                  className="btn-accent"
                >
                  <span aria-hidden>＋</span> Add guest
                </button>
              </div>
            </div>

            {/* Stats strip (desktop only) */}
            <StatsStrip
              guests={filteredGuests}
              households={households}
              rsvpDeadline={event.rsvp_deadline}
            />

            {/* Toolbar (desktop only) */}
            <Toolbar
              state={filter}
              onChange={(p) => setFilter((f) => ({ ...f, ...p }))}
              counts={counts}
            />

            {/* Body: facets sidebar + list */}
            <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
              <FacetsSidebar
                state={facet}
                onChange={setFacet}
                counts={facetCounts}
                households={households}
                customTags={customTags}
                onTagToggle={toggleTag}
                selectedTags={selectedTags}
                scheduleBlockCounts={scheduleBlockCounts}
              />
              <div className="min-w-0">
                <DesktopList
                  rows={displayRows}
                  selectedGuestId={selectedGuestId}
                  onSelect={setSelectedGuestId}
                  plusOneByPrimaryId={plusOneByPrimaryId}
                  hostByPlusOneId={hostByPlusOneId}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile FAB (+ Add guest) — sits above the bottom tab bar */}
      <button
        type="button"
        onClick={() => setShowAddDialog(true)}
        aria-label="Add guest"
        className="fixed right-5 z-20 grid place-items-center rounded-full bg-accent text-white active:scale-95 lg:hidden"
        style={{
          width: 60,
          height: 60,
          bottom: "calc(76px + env(safe-area-inset-bottom, 0))",
          boxShadow: "0 12px 28px rgba(201, 123, 75, 0.45)",
        }}
      >
        <span aria-hidden className="text-2xl font-light leading-none">＋</span>
      </button>

      {/* Detail drawer */}
      {selectedGuest && (
        <DetailDrawer
          guest={selectedGuest}
          partner={selectedPartner}
          household={selectedHousehold}
          table={selectedTable}
          onClose={() => setSelectedGuestId(null)}
          onEdit={(id) => {
            setEditingGuestId(id);
            setSelectedGuestId(null);
          }}
        />
      )}

      {/* Add dialog */}
      {showAddDialog && (
        <GuestFormDialog
          mode={{ kind: "add" }}
          households={households}
          onClose={() => setShowAddDialog(false)}
        />
      )}

      {/* Edit dialog */}
      {editingGuest && (
        <GuestFormDialog
          mode={{ kind: "edit", guest: editingGuest }}
          households={households}
          onClose={() => setEditingGuestId(null)}
        />
      )}

      {/* CSV import */}
      {showCsvDialog && <CsvImportDialog onClose={() => setShowCsvDialog(false)} />}
    </div>
  );
}

// ─── Filtering / sorting / counts ──────────────────────────────────────────

function applyFilters(
  guests: Guest[],
  filter: ToolbarFilterState,
  facet: FacetState,
  selectedTags: Set<string>,
): Guest[] {
  const search = filter.search.trim().toLowerCase();
  return guests.filter((g) => {
    // Search
    if (search) {
      const haystack = [
        g.first_name,
        g.last_name,
        g.display_name ?? "",
        g.role,
        g.group_category,
        ...g.custom_tags,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    // Status filter
    if (filter.status !== "all" && g.rsvp_status !== filter.status) return false;
    // Side filter
    if (filter.side !== "all" && g.side !== filter.side) return false;
    // Tag filter (additive — must include ALL selected tags)
    if (selectedTags.size > 0) {
      for (const t of selectedTags) if (!g.custom_tags.includes(t)) return false;
    }
    // Facet
    switch (facet.kind) {
      case "all":
        break;
      case "family":
        if (familyForRole(g.role) !== facet.value) return false;
        break;
      case "role":
        if (g.role !== facet.value) return false;
        break;
      case "secondary_sponsors":
        if (!(SECONDARY_SPONSOR_ROLES as ReadonlyArray<string>).includes(g.role)) return false;
        break;
      case "group":
        if (g.group_category !== facet.value) return false;
        break;
      case "household":
        if (g.household_id !== facet.value) return false;
        break;
      case "block":
        if (!g.invited_to_blocks.includes(facet.value)) return false;
        break;
    }
    return true;
  });
}

const SECONDARY_SPONSOR_ROLES = [
  "candle_sponsor",
  "veil_sponsor",
  "cord_sponsor",
  "coin_sponsor",
] as const satisfies ReadonlyArray<Guest["role"]>;

function sortRows(
  rows: ReturnType<typeof buildDisplayRows>,
  sort: ToolbarFilterState["sort"],
): ReturnType<typeof buildDisplayRows> {
  const sorted = [...rows];
  switch (sort) {
    case "first_name":
      sorted.sort((a, b) => a.primary.first_name.localeCompare(b.primary.first_name));
      break;
    case "last_name":
      sorted.sort((a, b) => a.primary.last_name.localeCompare(b.primary.last_name));
      break;
    case "rsvp_responded_at":
      sorted.sort((a, b) => {
        const ax = a.primary.rsvp_responded_at ?? "";
        const bx = b.primary.rsvp_responded_at ?? "";
        return bx.localeCompare(ax); // most recent first
      });
      break;
    case "role":
      sorted.sort((a, b) => {
        const order = { sponsor: 0, entourage: 1, bearer: 2, guest: 3 };
        const af = order[familyForRole(a.primary.role)];
        const bf = order[familyForRole(b.primary.role)];
        return af - bf || a.primary.last_name.localeCompare(b.primary.last_name);
      });
      break;
  }
  return sorted;
}

function computeCounts(guests: Guest[]): {
  all: number;
  pending: number;
  attending: number;
  declined: number;
  maybe: number;
  bride: number;
  groom: number;
  both: number;
} {
  return guests.reduce(
    (acc, g) => {
      acc.all += 1;
      acc[g.rsvp_status as RsvpStatus] += 1;
      acc[g.side] += 1;
      return acc;
    },
    { all: 0, pending: 0, attending: 0, declined: 0, maybe: 0, bride: 0, groom: 0, both: 0 },
  );
}

function computeFacetCounts(guests: Guest[]): Record<string, number> {
  const counts: Record<string, number> = { all: guests.length };
  for (const g of guests) {
    const fam = familyForRole(g.role);
    counts[`fam:${fam}`] = (counts[`fam:${fam}`] ?? 0) + 1;
    counts[`role:${g.role}`] = (counts[`role:${g.role}`] ?? 0) + 1;
    counts[`group:${g.group_category}`] = (counts[`group:${g.group_category}`] ?? 0) + 1;
    if (g.household_id) {
      counts[`household:${g.household_id}`] = (counts[`household:${g.household_id}`] ?? 0) + 1;
    }
    if ((SECONDARY_SPONSOR_ROLES as ReadonlyArray<string>).includes(g.role)) {
      counts.secondary_sponsors = (counts.secondary_sponsors ?? 0) + 1;
    }
  }
  return counts;
}

function computeBlockCounts(guests: Guest[]): Record<string, number> {
  const counts: Record<string, number> = {
    ceremony: 0,
    reception: 0,
    cocktails: 0,
    after_party: 0,
    rehearsal_dinner: 0,
  };
  for (const g of guests) {
    for (const b of g.invited_to_blocks) {
      counts[b] = (counts[b] ?? 0) + 1;
    }
  }
  return counts;
}

// Helper: non-paired guest display name for the orchestrator's lookups.
export const _guestDisplayName = guestDisplayName;
