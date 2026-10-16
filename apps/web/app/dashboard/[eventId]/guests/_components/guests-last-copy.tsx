'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useLastSeenScope } from '@/app/_components/last-seen/last-seen-scope';
import { REFRESH_TIMEOUT_MS, noteLastSeenShown, refreshPhase } from '@/app/_components/last-seen/last-seen-mark';
import { GuestsScreen } from './guests-screen';
import { RoleNamesProvider } from './role-names-context';
import { useKeptGuestList } from './guest-list-copy';

/**
 * 📋 THE GUEST LIST OPENS FROM THE PHONE (owner 2026-10-16: *"loads fast instead of always waiting for that
 * 2.5 sec load everytime"*) — the Guest list's loading screen.
 *
 * While the server renders the fresh list, this draws the host's LAST COPY of it (`guest-list-copy.ts`) with
 * the REAL screen — the same `GuestsScreen`, so the rows sit exactly where the fresh ones will land, and the
 * host can already scroll, fold a section or search a name. Over it, the one last-seen mark:
 * "Showing your last copy · updating…". When the fresh list arrives, Next swaps this screen for the page,
 * and the mark says "Updated just now" (`LastSeenCapture`).
 *
 * 🔒 THE HONEST-READ RULES (lib/guests.ts, guests-read-is-honest.test.ts):
 *  · nothing on the copy writes — no Select, no Remove, no Add (`GuestsScreen` `copy`);
 *  · offline, or no fresh list after `REFRESH_TIMEOUT_MS`, and the mark changes to "Couldn't update —
 *    showing your last copy from <when>. It may be out of date." with Try again; the copy dims;
 *  · nothing kept (a first visit, another account, a filtered address) → the skeleton, as before.
 */
export function GuestsLastCopy({ children }: { children: ReactNode }) {
  const scope = useLastSeenScope();
  const kept = useKeptGuestList(true);
  const [waited, setWaited] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (!kept) return;
    noteLastSeenShown('guests');
    setOnline(navigator.onLine !== false);
    const timer = window.setTimeout(() => setWaited(REFRESH_TIMEOUT_MS), REFRESH_TIMEOUT_MS);
    const off = () => setOnline(false);
    window.addEventListener('offline', off);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('offline', off);
    };
  }, [kept]);

  if (!kept || !scope) return <>{children}</>;
  const { list, savedAt } = kept;
  return (
    <RoleNamesProvider names={list.roleNames}>
      {/* The page's own frame (InspectorLayout › master › section), so the copy sits where the list lands. */}
      <div className="sn-inspector-shell sn-inspector-shell--card" data-open="false">
        <div className="sn-inspector-master">
          <section className="sn-col max-w-none flex flex-col gap-6" data-roster-full-width="">
            <div className="flex flex-col gap-4" data-guests-title-group="">
              <h1 className="sr-only">Guests</h1>
            </div>
            <div className="flex min-w-0 flex-col gap-4" data-guests-blocks="">
              <GuestsScreen
                eventId={scope.eventId}
                gview="list"
                guests={list.rows}
                measured
                hasSides={list.hasSides}
                groupsByGuest={list.groupsByGuest}
                groups={[]}
                tables={[]}
                tableByGuest={list.tableByGuest}
                songsByGuest={{}}
                linkedGuestIds={null}
                faceByGuest={list.faceByGuest}
                requests={list.requests}
                rootLabel={list.rootLabel}
                copy={{ phase: refreshPhase({ online, waitedMs: waited }), savedAt }}
              />
            </div>
          </section>
        </div>
      </div>
    </RoleNamesProvider>
  );
}
