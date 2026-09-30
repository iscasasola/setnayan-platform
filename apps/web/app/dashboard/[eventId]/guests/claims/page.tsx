import Link from 'next/link';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { ArrowLeft, ArrowLeftRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { loadRoleNames } from '@/lib/role-names.server';
import { RoleNamesProvider } from '../_components/role-names-context';
import { getCurrentUser } from '@/lib/auth';
import { guestFullName, RSVP_LABELS, type GuestRole, type RsvpStatus } from '@/lib/guests';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { candidateName, unlinkedCandidates } from '@/lib/unlisted-guests';
import {
  REQUEST_ANSWERS,
  keepLineFor,
  maskMobile,
  readRequestedSeats,
  requestAge,
  suggestRequestMatch,
} from '@/lib/guest-requests';
import { PageMasthead } from '@/app/_components/page-masthead';
import { LinkPicker } from './link-picker';
import { KeepQuickAdd } from './keep-quick-add';
import { SubmitButton } from '@/app/_components/submit-button';
import { logQueryError } from '@/lib/supabase/error-detect';
import { keepGuestAction, removeGuestAction, linkGuestAction, undoAcceptAction, undoDeclineAction } from './actions';
import { Check, Undo2, X } from 'lucide-react';
import { SendInviteActions } from '../_components/send-invite';
import { loadInviteSetup } from '../_components/invite-message-setup';
import { fetchInvitationBase } from '../_components/guest-card-data';
import { REQUEST_WORDS, undoStillOpen } from '@/lib/request-key';
import { ENTOURAGE_COLUMNS } from '@/lib/entourage';

export const metadata = { title: 'Requests' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    error?: string;
    done?: string;
    bound?: string;
    /** The row just decided (frame G2) — drawn with its next step and Undo. */
    who?: string;
    /** `1` = drawn IN PLACE in the Event Hub Maker (Details › RSVP › Requests
     *  waiting, part 2b): no way back, no masthead, and each save stays put. */
    maker?: string;
  }>;
};

type RequestRow = {
  guest_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  email: string | null;
  mobile: string | null;
  rsvp_status: RsvpStatus;
  notes: string | null;
  created_at: string;
};

/** What reached the person after Keep or Link (`doneOnRequests` in actions.ts). */
const DONE_COPY: Record<string, string> = {
  // 📵 Nothing is emailed (owner 2026-09-29). Their own link already opens.
  kept: 'Done — they’re on your list. The link they already have now opens their invitation.',
  declined: 'Declined.',
};

/**
 * GUEST LIST → REQUESTS (guest pathway, owner 2026-09-26: *"REQUESTS IS THE ONE
 * WORD"*, and the shipped verbs *"Keep remove and link"*). The route stays
 * `claims`; every word on screen says Requests.
 *
 * A request is someone WITHOUT a key who asked to join — they are NOT inside
 * and the event is NOT in their account until the couple acts
 * (`app/join/[eventId]/actions.ts`). Each shows what they answered and the
 * person on the list they most look like (a SUGGESTION — a name is not a
 * secret). Keep adds them; Link merges them into the guest they really are;
 * both issue their key. Remove tells them nothing. Guests who added themselves
 * before 2026-09-27 are here too, and stay inside until the couple decides.
 *
 * House style (DESIGN_BRIEF 2026-09-24): no bordered cards, the number is the
 * hero, one dark button per request.
 */
export default async function RequestsPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const { error: actionError, done, maker, who } = await searchParams;
  const inMaker = maker === '1';

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  // The couple's own words for roles (owner 2026-09-30) — the Keep line says them.
  const roleNames = await loadRoleNames(supabase, eventId, 'RequestsPage.roleNames');

  // Couple-only surface.
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!membership) redirect(`/dashboard/${eventId}`);

  // ⚠ THE SENTENCE BELOW THIS READ IS "Nobody is waiting." Supabase RESOLVES
  // ⚠ with { error } rather than throwing, so a refused read arrives as
  // ⚠ `data: null`, `?? []` turns it into an empty list, and that sentence
  // ⚠ would be printed to a couple who has people waiting — who then never get
  // ⚠ an answer. Bind the error and gate the claim on whether the read happened.
  const { data: rowsRaw, error: rowsError } = await supabase
    .from('guests')
    .select('guest_id, first_name, last_name, display_name, email, mobile, rsvp_status, notes, created_at')
    .eq('event_id', eventId)
    .eq('entry_source', 'self_added_unlisted')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (rowsError) {
    logQueryError('RequestsPage.requests', rowsError, { event_id: eventId }, 'graceful_degrade');
  }
  const unlistedMeasured = !rowsError && rowsRaw !== null;
  const rows = (rowsRaw ?? []) as RequestRow[];

  // Who a request can be LINKED to — host-seeded, non-deleted, and not yet
  // bound to an account (owner 2026-09-21). Measured separately: one read can be
  // refused while the other is not, and a refused read here hides Link, which
  // would read as "there is nobody to link them to".
  type Candidate = {
    guest_id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    role: string | null;
    extra_roles: string[] | null;
  };
  let candidates: Candidate[] = [];
  let candidatesMeasured = true;
  if (rows.length > 0) {
    const { data: candRaw, error: candError } = await supabase
      .from('guests')
      .select('guest_id, first_name, last_name, display_name, role, extra_roles')
      .eq('event_id', eventId)
      .eq('entry_source', 'host_seeded')
      .is('deleted_at', null)
      .order('last_name', { ascending: true })
      .limit(500);
    if (candError) {
      logQueryError('RequestsPage.mergeCandidates', candError, { event_id: eventId }, 'graceful_degrade');
    }
    candidatesMeasured = !candError && candRaw !== null;
    candidates = (candRaw ?? []) as Candidate[];

    // Read with the admin client — the couple's own session may not see other
    // people's memberships — AFTER the couple check above.
    const { data: boundRaw, error: boundError } = await createAdminClient()
      .from('event_members')
      .select('guest_id')
      .eq('event_id', eventId)
      .not('guest_id', 'is', null);
    if (boundError) {
      logQueryError('RequestsPage.linked', boundError, { event_id: eventId }, 'graceful_degrade');
      candidatesMeasured = false;
      candidates = [];
    } else {
      candidates = unlinkedCandidates(candidates, new Set((boundRaw ?? []).map((m) => m.guest_id as string)));
    }
  }

  // The Keep form's choices — what THIS event offers (the action re-checks).
  const [{ offeredRoles }, { data: groupsRaw }] =
    rows.length > 0
      ? await Promise.all([
          resolveRoleSetForEvent(eventId),
          supabase.from('guest_groups').select('group_id, label, team_side').eq('event_id', eventId).order('label'),
        ])
      : [{ offeredRoles: [] as GuestRole[] }, { data: [] }];
  const groupChoices = (groupsRaw ?? []) as { group_id: string; label: string; team_side: string }[];

  // The suggested match for each request — a suggestion the couple acts on with
  // Link, never a bind (a name is not a secret).
  const seeds = candidates.map((c) => ({ guestId: c.guest_id, name: candidateName(c), email: null, role: c.role }));
  const byId = new Map(candidates.map((c) => [c.guest_id, c]));
  const items = rows.map((g) => {
    const name = (g.display_name?.trim() || `${g.first_name} ${g.last_name === '—' ? '' : g.last_name}`).trim();
    const hit = suggestRequestMatch(name, seeds);
    return { g, name, match: hit ? (byId.get(hit.guestId) ?? null) : null };
  });
  const lookAlikes = items.filter((i) => i.match).length;

  /* ── THE ROW JUST DECIDED (owner 2026-09-29, DECISION_LOG "TICKETS ON THE
     THANK-YOU SCREEN" (2) + "NO EMAIL TO GUESTS" (3); prototype
     guest_ticket_flow_2026-09-29.html frame G2). Accepted: their QR and link
     already open their invitation, so nothing HAS to be sent — the couple may
     nudge with the shared Send invite · Copy message (the one message builder,
     #6146). Declined: what their QR will say. Both carry Undo for a moment. */
  let decided: ReactNode = null;
  if (!inMaker && who && (done === 'kept' || done === 'declined')) {
    const { data: row, error: rowError } = await createAdminClient()
      .from('guests')
      .select(`${ENTOURAGE_COLUMNS}, qr_token, invitation_sent_at, entry_source, deleted_at, updated_at, rsvp_status`)
      .eq('guest_id', who)
      .eq('event_id', eventId)
      .maybeSingle();
    // Unread → the plain "Done" line below, never a row that says nothing happened.
    if (rowError) logQueryError('RequestsPage.decided', rowError, { event_id: eventId }, 'graceful_degrade');
    const who_ = row
      ? ((row.display_name as string | null)?.trim() || `${row.first_name ?? ''} ${row.last_name === '—' ? '' : (row.last_name ?? '')}`.trim())
      : '';
    const now = Date.now();
    if (row && done === 'kept' && !row.deleted_at) {
      const [setup, base] = await Promise.all([
        loadInviteSetup(supabase, eventId),
        (async () => {
          const { data: ev, error: evError } = await supabase.from('events').select('slug').eq('event_id', eventId).maybeSingle();
          // Unread → no link on Send invite (it says so itself), never a wrong one.
          if (evError) logQueryError('RequestsPage.decided.slug', evError, { event_id: eventId }, 'graceful_degrade');
          return fetchInvitationBase(eventId, (ev?.slug as string | null) ?? null);
        })(),
      ]);
      decided = (
        <section className="mt-4 border-l-2 border-success-700 py-1 pl-3" data-request-decided="accepted" role="status">
          <p className="text-lg font-semibold text-ink">{who_}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-success-800">
            <Check aria-hidden className="h-4 w-4" strokeWidth={2.25} />
            Accepted · just now · their QR and link now open their invitation
          </p>
          <div className="mt-3">
            <SendInviteActions
              eventId={eventId}
              guest={{
                guestId: row.guest_id as string,
                formalName: guestFullName(row),
                firstName: (row.first_name as string | null) ?? null,
                fullName: who_,
                inviteUrl: base && row.qr_token ? `${base}?invite=${row.qr_token as string}` : null,
                sentAt: (row.invitation_sent_at as string | null) ?? null,
              }}
              facts={setup.facts}
              template={setup.template}
              extra={
                undoStillOpen(row.updated_at as string | null, now) ? (
                  <form action={undoAcceptAction.bind(null, eventId)}>
                    <input type="hidden" name="guest_id" value={row.guest_id as string} />
                    <SubmitButton overlay={false} pendingLabel="Undoing…" className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-ink/70">
                      <Undo2 aria-hidden className="h-4 w-4" /> Undo
                    </SubmitButton>
                  </form>
                ) : null
              }
            />
          </div>
        </section>
      );
    } else if (row && done === 'declined' && row.deleted_at) {
      decided = (
        <section className="mt-4 border-l-2 border-danger-700 py-1 pl-3" data-request-decided="declined" role="status">
          <p className="text-lg font-semibold text-ink">{who_}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-danger-800">
            <X aria-hidden className="h-4 w-4" strokeWidth={2.25} />
            Declined · just now · their QR will say “{REQUEST_WORDS.declined}”
          </p>
          {undoStillOpen(row.deleted_at as string | null, now) ? (
            <form action={undoDeclineAction.bind(null, eventId)} className="mt-2">
              <input type="hidden" name="guest_id" value={row.guest_id as string} />
              <SubmitButton overlay={false} pendingLabel="Undoing…" className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink/[0.06] px-4 text-sm font-medium text-ink">
                <Undo2 aria-hidden className="h-4 w-4" /> Undo
              </SubmitButton>
            </form>
          ) : null}
        </section>
      );
    }
  }
  const answerLabel = (s: RsvpStatus) => REQUEST_ANSWERS.find((a) => a.value === s)?.label ?? RSVP_LABELS[s];

  return (
    <div className={inMaker ? 'w-full' : 'mx-auto w-full max-w-2xl px-4 py-6 sm:px-6'} data-requests-page="">
      {/* In the Maker these rows sit inside RSVP's own panel — the panel is the way back. */}
      {inMaker ? null : (
        <>
          <Link
            href={`/dashboard/${eventId}/guests`}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Guest List
          </Link>

          <PageMasthead title="Requests" />
          <p aria-hidden className="mt-2 text-3xl font-semibold tracking-tight text-ink">
            Requests
          </p>
        </>
      )}

      {actionError ? (
        <p role="alert" className="mt-4 border-l-2 border-danger-700 pl-3 text-sm text-danger-900">
          {actionError}
        </p>
      ) : null}
      {decided ? (
        decided
      ) : done && DONE_COPY[done] ? (
        <p role="status" className="mt-4 border-l-2 border-success-700 pl-3 text-sm text-success-800">
          {DONE_COPY[done]}
        </p>
      ) : null}

      {!unlistedMeasured ? (
        <p role="alert" className="mt-8 border-l-2 border-mulberry/70 pl-3 text-sm text-ink/70">
          <strong className="text-ink">We couldn&rsquo;t load your requests.</strong> This does not mean nobody asked.
          Nobody has been added or removed &mdash; reload in a moment and they will be here.
        </p>
      ) : rows.length === 0 ? (
        <div className="mt-8 flex items-baseline gap-4">
          <span className="font-serif text-7xl leading-none text-ink">0</span>
          <p className="text-sm text-ink/60">Nobody is waiting. When someone without a key asks to join, they appear here.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center gap-4">
            <span className="font-serif text-7xl leading-none text-ink" data-requests-count={rows.length}>
              {rows.length}
            </span>
            <div className="text-sm">
              <p className="text-ink/70">asked to join</p>
              {lookAlikes > 0 ? (
                <p className="text-terracotta-700">
                  {lookAlikes} {lookAlikes === 1 ? 'looks like someone' : 'look like people'} already on your list
                </p>
              ) : null}
            </div>
          </div>

          <ul className="mt-6 divide-y divide-ink/10 border-t border-ink/10">
            {items.map(({ g, name, match }) => {
              const seats = readRequestedSeats(g.notes);
              const meta = [
                answerLabel(g.rsvp_status),
                seats > 1 ? `${seats} seats` : null,
                maskMobile(g.mobile),
                g.email,
                requestAge(g.created_at),
              ].filter(Boolean);
              return (
                <li key={g.guest_id} className="py-5" data-request={g.guest_id}>
                  <p className="text-xl font-semibold text-ink">{name}</p>
                  <p className="mt-0.5 text-sm text-ink/60">{meta.join(' · ')}</p>
                  {match ? (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-terracotta-700" data-request-match="">
                      <ArrowLeftRight aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
                      Same as <span className="font-semibold text-ink">{candidateName(match)}</span>
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-ink/55">No one like this on your list</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    {/* ACCEPT (the shipped KEEP — onto the list, with the name,
                        side, role and group the couple chooses, owner
                        2026-09-21, prefilled with what they typed and the seats
                        they asked for). Worded Accept · Decline · Link per the
                        approved prototype (guest_ticket_flow_2026-09-29, G1). */}
                    <details className="group/keep">
                      <summary
                        className={`sn-press inline-flex min-h-11 cursor-pointer list-none items-center rounded-full px-5 text-sm font-semibold [&::-webkit-details-marker]:hidden ${
                          match ? 'bg-ink/[0.06] text-ink' : 'bg-ink text-cream'
                        }`}
                      >
                        Accept
                      </summary>
                      <form action={keepGuestAction.bind(null, eventId)} className={`mt-3 space-y-3 ${inMaker ? 'w-full' : 'w-[min(100vw-2rem,36rem)]'}`}>
                        <input type="hidden" name="guest_id" value={g.guest_id} />
                        {inMaker ? null : <input type="hidden" name="from" value="requests" />}
                        <RoleNamesProvider names={roleNames}>
                          <KeepQuickAdd
                            defaultLine={keepLineFor(name, g.notes)}
                            offeredRoles={offeredRoles}
                            existingGroups={groupChoices.map((gr) => gr.label.toLowerCase())}
                          />
                        </RoleNamesProvider>
                        <SubmitButton className="button-primary" pendingLabel="Adding…">
                          Add to my list
                        </SubmitButton>
                      </form>
                    </details>

                    <form action={removeGuestAction.bind(null, eventId)}>
                      <input type="hidden" name="guest_id" value={g.guest_id} />
                      {inMaker ? null : <input type="hidden" name="from" value="requests" />}
                      <SubmitButton
                        overlay={false}
                        pendingLabel="Declining…"
                        className="sn-press inline-flex min-h-11 items-center rounded-full bg-ink/[0.06] px-5 text-sm font-semibold text-ink"
                      >
                        Decline
                      </SubmitButton>
                    </form>

                    {/* LINK — they are someone already on the list. */}
                    {candidates.length > 0 ? (
                      <details className="group/link">
                        <summary
                          className={`sn-press inline-flex min-h-11 cursor-pointer list-none items-center rounded-full px-5 text-sm font-semibold [&::-webkit-details-marker]:hidden ${
                            match ? 'bg-ink text-cream' : 'bg-ink/[0.06] text-ink'
                          }`}
                        >
                          Link
                        </summary>
                        <form
                          action={linkGuestAction.bind(null, eventId)}
                          className={`mt-3 flex flex-wrap items-center gap-2 ${inMaker ? 'w-full' : 'w-[min(100vw-2rem,36rem)]'}`}
                        >
                          <input type="hidden" name="guest_id" value={g.guest_id} />
                          {inMaker ? null : <input type="hidden" name="from" value="requests" />}
                          <span className="text-sm text-ink/60">Same as</span>
                          <LinkPicker candidates={candidates} initial={match} />
                          <SubmitButton className="button-primary" pendingLabel="Linking…">
                            Link
                          </SubmitButton>
                        </form>
                      </details>
                    ) : !candidatesMeasured ? (
                      <p className="text-sm text-ink/55">
                        We couldn&rsquo;t load your guest list just now, so Link is not offered. Reload in a moment.
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-6 text-sm text-ink/55">
            They already hold their own QR and link. Accept or Link and it opens their invitation; Decline and it
            says &ldquo;{REQUEST_WORDS.declined}&rdquo; Nothing is emailed.
          </p>
        </>
      )}
    </div>
  );
}
