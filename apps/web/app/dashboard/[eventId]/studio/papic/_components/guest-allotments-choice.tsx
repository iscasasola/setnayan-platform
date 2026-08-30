// 🔒 THE READ BELOW IS SERVER-SIDE ONLY, AND IT IS ALREADY ENFORCED — this line
// is defence in depth, not the thing that creates the property.
//
// `papic_guest_spend_ceilings` is RLS-on and REVOKEd from PUBLIC, anon and
// authenticated; service_role reaches it, and service_role only exists on the
// server. `lint-server-only-boundary.mjs` already treats `lib/supabase/admin.ts`
// as a boundary — not because that file declares `server-only` (it does not),
// but because it is named in that script's EXTRA_BOUNDARY_MODULES, whose own
// comment says the entry "is what makes that a mechanism instead of a sentence".
// Measured: a 'use client' file importing this component fails the guard with or
// without the line below.
//
// ⚠ SO WHY KEEP IT. The guard's chain runs through the admin import. If this
// component ever stops importing the admin client directly — a helper, a
// refactor, a split — that edge disappears and the boundary goes with it. This
// line is local and survives that. It costs nothing and it does not depend on
// another file's allowlist staying correct.
import 'server-only';

import { Coins } from 'lucide-react';

import { SubmitButton } from '@/app/_components/submit-button';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventPapicGuestActive } from '@/lib/papic-guest';
import { readEventPoolStatus } from '@/lib/papic-event-pool';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  ALLOTMENT_RPC,
  ALLOTMENT_STORAGE,
  suggestedAllotment,
  splitTheRest,
  summariseAllotments,
  type AllotmentRole,
} from '@/lib/papic-guest-allotments';
import { setGuestAllotment, setGuestAllotments, releaseTheRest } from '../actions';
import { SettingRow } from './setting-row';

/**
 * "HOW MANY CREDITS EACH GUEST GETS" — the couple's own numbers, one row.
 *
 * Named guests get a specific number. Everyone else splits what is left,
 * equally. Whatever does not divide evenly is spare. A button opens the rest to
 * everyone, and an automatic release does the same late in the celebration.
 *
 * ── THE ROW IS ABSENT WHEN THERE IS NOTHING TO DECIDE ───────────────────────
 * Two ways, and both are deliberate:
 *
 *   1. **No guest cameras on this event** → `eventPapicGuestActive` is false and
 *      this returns null. Dividing an allowance among guests who cannot shoot
 *      is a control that governs nothing — the empty-promise shape this project
 *      keeps getting caught by. Same rule as `GuestCamerasChoice`.
 *   2. **The ceiling storage is not there yet** → the SELECT below refuses and
 *      this returns null.
 *
 * 🔑 (2) IS THE MERGE GATE, ENFORCED BY THE CODE RATHER THAN BY A PROMISE. The
 * per-guest ceiling's columns land with the ceiling migration, which is being
 * built in parallel. Until it is applied, PostgREST refuses the whole query for
 * an unknown column and no row is drawn — so if this were to reach production
 * early, a couple would see NOTHING rather than a control that saves a number
 * the database ignores. That is the `papic_uploads_open` defect this tree has
 * already paid for once, and the honest failure is the absent row.
 *
 * ⚠ The refusal is LOGGED rather than swallowed. `GuestCamerasChoice`'s own
 * docblock records what silence cost there: `papic_guest_capture_early` carried
 * no SELECT grant, so the host's switch was never once on screen for weeks and
 * nothing anywhere said so.
 */
export async function GuestAllotmentsChoice({
  eventId,
  variant = 'card',
}: {
  eventId: string;
  variant?: 'card' | 'row';
}) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data, error } = await supabase
    .from('events')
    .select(
      `${ALLOTMENT_STORAGE.enabled}, ${ALLOTMENT_STORAGE.everyoneElse}, ${ALLOTMENT_STORAGE.releasedAt}`,
    )
    .eq('event_id', eventId)
    .maybeSingle();

  if (error) {
    logQueryError('GuestAllotmentsChoice.event', error, { eventId }, 'graceful_degrade');
    return null;
  }
  if (!data) return null;

  // Nothing to divide if guests cannot shoot at all.
  const active = await eventPapicGuestActive(admin, eventId);
  if (!active) return null;

  const row = data as Record<string, unknown>;
  const enabled = row[ALLOTMENT_STORAGE.enabled] === true;
  const storedEveryoneElse = row[ALLOTMENT_STORAGE.everyoneElse];
  const everyoneElse =
    typeof storedEveryoneElse === 'number' ? storedEveryoneElse : null;
  const releasedAt =
    typeof row[ALLOTMENT_STORAGE.releasedAt] === 'string'
      ? (row[ALLOTMENT_STORAGE.releasedAt] as string)
      : null;

  // The pot, the head count, and the allotments already chosen.
  //
  // 🪤 THE HEAD COUNT COMES FROM `papic_event_guest_headcount`, NOT FROM
  // `papic_event_pool_status.guest_count`. That field is set to a literal 0 on
  // every event that is NOT flat-pass — `v_guests := 0` in the ELSE branch — and
  // the free grant is armed on render, so in practice that is every celebration
  // we will ever draw this row on. Dividing by it gives a nonsense share, and
  // the couple would be shown one number while their guests were given another.
  // The database divides by this function; so do we.
  const [pool, headcountResult, guestsResult, allotmentsResult, sponsorsResult] = await Promise.all([
    readEventPoolStatus(admin, eventId).catch(() => null),
    admin.rpc(ALLOTMENT_RPC.headcount, { p_event_id: eventId }),
    admin
      .from('guests')
      .select('guest_id, first_name, last_name, display_name')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('first_name', { ascending: true }),
    // ⛔ RLS-on and REVOKEd from anon and authenticated — unreachable from a
    // browser. This is the server-side admin client, which service_role still
    // holds, and it is the only way to show WHICH guests are named and with
    // what number. The resolver answers "what does this guest get", not "did
    // somebody choose it", so it cannot drive this list on its own.
    admin.from(ALLOTMENT_STORAGE.table).select('guest_id, points').eq('event_id', eventId),
    admin
      .from('event_sponsors')
      .select('sponsor_tier, linked_guest_id')
      .eq('event_id', eventId)
      .not('linked_guest_id', 'is', null),
  ]);

  const guests = (guestsResult.data ?? []) as Array<{
    guest_id: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
  }>;
  const allotments = new Map<string, number>(
    ((allotmentsResult.data ?? []) as Array<{ guest_id: string; points: number }>).map((a) => [
      a.guest_id,
      a.points,
    ]),
  );

  // 🔑 SPONSORS ARE REAL, USER-AUTHORED DATA — `event_sponsors` is written by a
  // shipped dashboard, and `linked_guest_id` is the join back to the list. The
  // role only supplies a SUGGESTED opening number; a saved allotment always
  // wins, and nothing re-applies the suggestion over an edit.
  const roleOf = new Map<string, AllotmentRole>(
    ((sponsorsResult.data ?? []) as Array<{
      sponsor_tier: AllotmentRole;
      linked_guest_id: string;
    }>).map((s) => [s.linked_guest_id, s.sponsor_tier]),
  );

  // ⚠ `pool.status.totalPoints` is the POT. It is NOT `points_per_guest`, which
  // sizes the pot (guest_count × points_per_guest, clamped) and is a different
  // number wearing a similar phrase — see `papic-guest-allotments.ts`.
  const pot = pool?.status.totalPoints ?? 0;
  const guestCount =
    typeof headcountResult.data === 'number' && headcountResult.data > 0
      ? headcountResult.data
      : guests.length;
  const named = [...allotments.values()];
  const inputs = { pot, guestCount, named, everyoneElse };
  const split = splitTheRest(inputs);
  const summary = summariseAllotments(inputs);

  const nameOf = (g: (typeof guests)[number]) =>
    g.display_name?.trim() || [g.first_name, g.last_name].filter(Boolean).join(' ').trim() || 'Guest';

  const control = (
    <div className="space-y-5">
      <p className="text-sm text-ink/65">
        {enabled
          ? 'Each guest has their own number of credits. Name anyone you want to give more, and everyone else splits what is left.'
          : 'Right now every guest draws from the same pot until it runs out. Turn this on to give each guest their own number.'}
      </p>

      {/* The switch — two explicit buttons, never a flip. */}
      <form action={setGuestAllotments} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="enabled" value={enabled ? '0' : '1'} />
        {enabled ? (
          <input type="hidden" name="everyone_else" value={everyoneElse ?? ''} />
        ) : null}
        <SubmitButton className={enabled ? 'sn-btn-secondary' : 'sn-btn-primary'}>
          {enabled ? 'Turn this off' : 'Turn this on'}
        </SubmitButton>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/50">
          {enabled ? 'On' : 'Off'}
        </span>
      </form>

      {enabled ? (
        <>
          {/* THE LIVE LINE — what the couple's choices actually add up to. */}
          <p
            className={`rounded-lg px-3 py-2 font-mono text-[11.5px] ${
              split.overCommitted ? 'bg-terracotta/10 text-terracotta' : 'bg-ink/5 text-ink/70'
            }`}
          >
            {summary}
          </p>

          {/* Everyone else. Blank is not zero — it means "work it out for me". */}
          <form action={setGuestAllotments} className="space-y-2">
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="enabled" value="1" />
            <label className="block text-sm font-medium text-ink">
              Everyone you have not named
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                name="everyone_else"
                min={1}
                step={1}
                defaultValue={everyoneElse ?? ''}
                placeholder={String(split.perHead)}
                className="w-28 rounded-lg border border-ink/15 px-3 py-1.5 text-sm"
              />
              <SubmitButton className="sn-btn-secondary">Save</SubmitButton>
            </div>
            <p className="text-xs text-ink/55">
              Leave this empty and they simply share what is left — {split.perHead} credits each
              right now. The smallest you can set is 1: everyone who comes gets at least one
              photograph. To give one person nothing, name them below and set them to 0.
            </p>
          </form>

          {/* NAMING GUESTS — the real new control. */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">Give someone their own number</p>
            {guests.length === 0 ? (
              <p className="text-xs text-ink/55">
                Your guest list is empty. Add guests and you can name them here.
              </p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
                {guests.map((g) => {
                  const role = roleOf.get(g.guest_id) ?? 'guest';
                  const saved = allotments.get(g.guest_id);
                  return (
                    <li key={g.guest_id}>
                      <form
                        action={setGuestAllotment}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink/[0.03]"
                      >
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="guest_id" value={g.guest_id} />
                        <span className="flex-1 truncate text-sm text-ink">
                          {nameOf(g)}
                          {role !== 'guest' ? (
                            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
                              {role}
                            </span>
                          ) : null}
                        </span>
                        <input
                          type="number"
                          name="allotment"
                          min={0}
                          step={1}
                          defaultValue={saved ?? ''}
                          placeholder={String(suggestedAllotment(role, split.perHead))}
                          aria-label={`Credits for ${nameOf(g)}`}
                          className="w-20 rounded-lg border border-ink/15 px-2 py-1 text-sm"
                        />
                        <SubmitButton className="rounded-lg bg-ink/5 px-2.5 py-1 text-xs font-medium text-ink/70 hover:bg-ink/10">
                          Save
                        </SubmitButton>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-xs text-ink/55">
              Sponsors open with a bigger suggested number — clear a box to stop naming that guest.
              Whatever a named guest does not use stays theirs.
            </p>
          </div>

          {/* THE RELEASE. */}
          <form action={releaseTheRest} className="space-y-2 border-t border-ink/10 pt-4">
            <input type="hidden" name="event_id" value={eventId} />
            <p className="text-sm font-medium text-ink">Open the rest to everyone</p>
            <p className="text-xs text-ink/55">
              {releasedAt
                ? 'Already open — the spare credits are anyone’s.'
                : 'Frees the spare credits so any guest can use them. This happens automatically late in your celebration too. Credits you gave a named guest stay hers.'}
            </p>
            {releasedAt ? null : (
              <SubmitButton className="sn-btn-secondary">Open the rest to everyone</SubmitButton>
            )}
          </form>
        </>
      ) : null}
    </div>
  );

  const value = !enabled
    ? 'Off'
    : split.overCommitted
      ? 'Over'
      : `${split.perHead} each`;

  if (variant === 'row') {
    return (
      <SettingRow
        icon={<Coins aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
        label="How many credits each guest gets"
        value={value}
        sheetTitle="How many credits each guest gets"
      >
        {control}
      </SettingRow>
    );
  }

  return (
    <section className="space-y-3 sn-tile p-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Coins aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          How many credits each guest gets
        </h2>
      </div>
      {control}
    </section>
  );
}
