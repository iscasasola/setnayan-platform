'use client';

/**
 * MobileGuestCarousel — the Guest list's head on a phone (and a tablet): the
 * approved Fable rows, frame A (owner 2026-09-30,
 * `prototypes/guest_list_rows_2026-09-30_fable.html`). Top to bottom:
 *
 *   · "Guest list" · Share the link · + Add (the quick-add line and "Add from
 *     your people" open under it)
 *   · the Guest target meter — unchanged
 *   · one search field with Sort ▾ beside it
 *   · four dropdowns — RSVP ▾ · Side ▾ · Role ▾ · Group ▾ — each ONE list, the
 *     same component and the same URL params as the computer (`roster-controls`)
 *
 * What left (each MOVED, none lost — the design's ledger):
 *   · the Build → Invite → Confirm → Seat → Day-of ribbon and "Needs you" → the
 *     page's requests strip, the Guest list part picker, the event menu;
 *   · the Roster / Groups / Day-of segment and the RSVP count pills → Sort ▾
 *     and RSVP ▾; the counts line sits above the rows;
 *   · "Select guests" + the Assign sheet → a long press on any row, and the
 *     bulk bar at the bottom (Invite selected · Set group ▾ · Set table ▾ · ⋯);
 *   · the masthead "Invite" that shared the one event link → "Share the link",
 *     so Invite means one guest's ticket everywhere.
 *
 * The guest ROWS render in `GuestListMultiselect` below (one source of truth).
 * All `lg:hidden`; the computer keeps its own head.
 */

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, List, Plus, Share2 } from 'lucide-react';
import { OpenAddFromPeopleButton } from './add-from-people-sheet';
import type { GuestGroupWithCount, PaxProgress } from '@/lib/guests';
import { LiveSearch } from './live-search';
import { quickAddGuest } from '../quick-add-actions';
import { trackFailure } from '@/lib/telemetry/track-error';
import { formatCount } from '@/lib/format-number';
import { RosterFilters, RosterSort } from './roster-controls';

type Opt = { key: string; label: string };

export function MobileGuestCarousel({
  eventId,
  q,
  sorts,
  currentSort,
  views,
  groups,
  tags,
  measured = true,
  total,
  paxProgress,
  joinUrl = null,
  hasSides,
  maybeCount,
}: {
  eventId: string;
  q: string;
  sorts: Opt[];
  currentSort: string;
  views: Opt[];
  groups: GuestGroupWithCount[];
  tags: string[];
  /**
   * False when the guest read was REFUSED — the title then never says a
   * headcount it did not measure.
   */
  measured?: boolean;
  total: number;
  /** Pax-target progress (Adaptive Pax Pricing Phase 2); null = no target set. */
  paxProgress: PaxProgress | null;
  /** The ONE event link ("Share the link"); null when it cannot be handed out. */
  joinUrl?: string | null;
  /** A birthday has no sides — no Side dropdown. */
  hasSides: boolean;
  /** Maybe is listed only while somebody still holds that answer. */
  maybeCount: number;
}) {
  // The quick-add line opens under the title's + Add.
  const [addOpen, setAddOpen] = useState(false);
  const searchParams = useSearchParams();
  const mapMode = searchParams.get('gview') === 'map';

  return (
    <div className="gl-settle space-y-3 lg:hidden" data-roster-phone-head="">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-[28px] leading-tight text-ink">
          Guest list
          {measured ? (
            <span className="sr-only">
              {' '}
              · {formatCount(total)} {total === 1 ? 'guest' : 'guests'}
            </span>
          ) : null}
        </h2>
        <div className="flex shrink-0 items-center gap-1.5">
          {joinUrl ? <ShareTheLinkButton joinUrl={joinUrl} /> : null}
          <button
            type="button"
            onClick={() => setAddOpen((o) => !o)}
            aria-expanded={addOpen}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-ink px-4 text-sm font-medium text-cream"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            Add
          </button>
        </div>
      </div>

      {addOpen ? (
        <div className="space-y-2 rounded-2xl border border-ink/10 bg-cream/60 p-3">
          <QuickAddInlineForm eventId={eventId} />
          {/* 🔴 THE PHONE'S ONLY DOOR TO THE PICKER — import the opener, never
              re-dispatch its event name by hand. */}
          <OpenAddFromPeopleButton className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink/75 hover:border-ink/30 hover:text-ink" />
        </div>
      ) : null}

      {/* Guest target (Adaptive Pax Pricing Phase 2) — unchanged; hidden with no target. */}
      {paxProgress ? (
        <div>
          <div className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="font-mono uppercase tracking-[0.12em] text-terracotta-700">
              {paxProgress.exceeded ? 'Now planning for' : 'Guest target'}
            </span>
            <span className="tabular-nums text-ink/70">
              {paxProgress.exceeded
                ? `${formatCount(paxProgress.headcount)} · ${paxProgress.overBy} over ${paxProgress.target}`
                : `${formatCount(paxProgress.headcount)} of ${formatCount(paxProgress.target)} · ${paxProgress.progressPct}%`}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10">
            <div
              className={`h-full rounded-full ${paxProgress.exceeded ? 'bg-terracotta-700' : 'bg-terracotta'}`}
              style={{ width: `${paxProgress.exceeded ? 100 : paxProgress.progressPct}%` }}
            />
          </div>
        </div>
      ) : null}

      {mapMode ? (
        <div className="flex items-center justify-between gap-2 text-xs text-ink/55">
          <span>Mind map is showing.</span>
          <Link
            href={`/dashboard/${eventId}/guests`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-1.5 font-medium text-ink"
          >
            <List className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Back to the list
          </Link>
        </div>
      ) : (
        /* Stays in reach while the list scrolls. `--fd-bar` is the shell's own
           MEASURED bar height, so this can never sit under the shared top bar
           (guests-keeps-the-shell-bar.test.ts). */
        <div className="sticky top-[calc(var(--fd-bar,0px)+0.25rem)] z-30 -mx-1 space-y-2 rounded-b-2xl bg-cream/90 px-1 pb-2 pt-1 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <LiveSearch initialValue={q} placeholder="Search a guest" />
            </div>
            <RosterSort sorts={sorts} current={currentSort} />
          </div>
          <RosterFilters hasSides={hasSides} views={views} groups={groups} tags={tags} maybeCount={maybeCount} />
        </div>
      )}
    </div>
  );
}

/**
 * SHARE THE LINK — the ONE event link anybody can open to ask to join (was the
 * masthead's "Invite"; renamed so Invite means one guest's ticket everywhere).
 */
function ShareTheLinkButton({ joinUrl }: { joinUrl: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'You’re invited', url: joinUrl });
      } catch {
        // They closed the share sheet — nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard?.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked — the Share the link tab above the list remains.
    }
  };
  return (
    <button
      type="button"
      onClick={share}
      aria-label="Share the event link"
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 text-xs font-medium text-ink/80 hover:border-ink/30"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success-700" strokeWidth={2.5} aria-hidden />
      ) : (
        <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      )}
      {copied ? 'Copied' : 'Share the link'}
    </button>
  );
}

// Inline rapid-add (Living Roster P4) — first + last, Enter to add, loop.
function QuickAddInlineForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const [addError, setAddError] = useState('');
  const firstRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<HTMLInputElement>(null);

  const addGuest = async () => {
    // Both names are required (the server enforces this too, but check
    // client-side first so the user gets instant feedback).
    if (!first.trim() || !last.trim() || busy) return;
    setAddError('');
    setBusy(true);
    try {
      const result = await quickAddGuest(eventId, {
        first_name: first.trim(),
        last_name: last.trim(),
        side: 'both',
        role: 'guest',
      });
      if (!result.ok) {
        // Server returned a specific error (validation, DB constraint, etc.).
        // Surface it immediately rather than silently clearing the form.
        setAddError(result.error);
        void trackFailure({
          eventType: 'SUPABASE_SAVE_ERROR',
          elementName: 'Add guest',
          filePath:
            'app/dashboard/[eventId]/guests/_components/mobile-guest-carousel.tsx',
          error: result.error,
          payload: { eventId },
        });
        return;
      }
      setCount((n) => n + 1);
      setFirst('');
      setLast('');
      router.refresh();
      // Return the cursor to First name for the next rapid entry. DEFERRED a
      // tick on purpose: at this point the inputs are still disabled={busy}
      // (busy resets in the finally below, which hasn't run yet), and focus()
      // is a no-op on a disabled element — so a synchronous call here silently
      // failed to loop back (owner-reported 2026-06-03). The timeout lets React
      // flush busy=false + re-enable the field first. Mirrors QuickAddSheet.
      setTimeout(() => firstRef.current?.focus(), 0);
    } catch {
      setAddError('Something went wrong — try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleFirstKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Empty first name + Enter is a no-op — the rapid-add loop never "finishes"
    // (owner directive 2026-06-03: no more double-Enter to end the session).
    if (!first.trim()) return;
    lastRef.current?.focus();
  };

  const handleLastKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Require last name before submitting — don't fire addGuest on an empty field.
    if (!last.trim()) return;
    void addGuest();
  };

  const inputCls =
    'w-full rounded-xl border border-ink/15 bg-cream px-4 py-3 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none disabled:opacity-50';

  return (
    // The session count sits above the inputs; first + last share one row so
    // the panel stays compact under the top tab bar.
    <div className="flex flex-col gap-3">
      {addError ? (
        <p className="text-center text-xs font-medium text-danger-600">{addError}</p>
      ) : count > 0 ? (
        <p className="text-center text-xs text-ink/50">
          {formatCount(count)} {count === 1 ? 'guest' : 'guests'} added this session
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <input
          ref={firstRef}
          type="text"
          inputMode="text"
          autoCapitalize="words"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="First name"
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          onKeyDown={handleFirstKeyDown}
          disabled={busy}
          className={inputCls}
        />
        <input
          ref={lastRef}
          type="text"
          inputMode="text"
          autoCapitalize="words"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Last name"
          value={last}
          onChange={(e) => setLast(e.target.value)}
          onKeyDown={handleLastKeyDown}
          disabled={busy}
          className={inputCls}
        />
      </div>
    </div>
  );
}

