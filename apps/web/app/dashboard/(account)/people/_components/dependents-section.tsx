import Link from 'next/link';
import { logQueryError } from '@/lib/supabase/error-detect';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { myLovedOnes, spouseIdSet } from '@/lib/my-loved-ones';
import { manilaToday } from '@/lib/std-views';
import {
  DEPENDENT_RELATIONSHIP_LABELS,
  DEPENDENT_KIND_LABELS,
  fenceBand,
  dependentNextMilestone,
  isClaimEligible,
  isPersonDependent,
  type DependentSex,
  type DependentKind,
} from '@/lib/dependent-people';
import { SubmitButton } from '@/app/_components/submit-button';
import { Trash2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import { PostedPick } from '@/app/dashboard/[eventId]/_components/posted-pick';
import { CopyButton } from '@/app/dashboard/[eventId]/studio/papic/crew/_components/copy-button';
import {
  deleteDependent,
  addGodparent,
  deleteGodparent,
  setDependentSharing,
  createHandoverLink,
  revokeHandoverLink,
  emailHandoverLink,
} from '../dependent-actions';
import { StayConfirmForm, StayForm } from '@/app/_components/stay-form';

/**
 * "Alaga" — the dependent capture (Phase 3 family graph · flag-gated).
 * Product name owner-locked 2026-07-16: Alaga in all user-facing copy;
 * "dependents" stays the technical/legal term (schema, RLS, counsel docs).
 * Rendered only when dependentPeopleEnabled(). An alaga is a person, a pet, or
 * anything else you care for — an account created inside your account, owned
 * by you. Only a PERSON carries a birthdate/religion + the age fence (child
 * <18 / elder >50) and can later claim the profile as their own account at 18;
 * pets/other are just a name (+ optional birthday). Milestones + godparents
 * apply to the person case only.
 */

type DependentRow = {
  dependent_id: string;
  dependent_kind: DependentKind | null;
  name: string;
  birth_date: string | null;
  sex: DependentSex | null;
  religion: string | null;
  relationship: string | null;
  owner_user_id: string;
  shared_with_spouse: boolean;
  handed_over_at: string | null;
  claimed_user_id: string | null;
  handed_over_by_user_id: string | null;
  claim_token: string | null;
  claim_token_purpose: string | null;
  claim_token_expires_at: string | null;
};

type GodparentRow = {
  godparent_id: string;
  dependent_id: string;
  godparent_name: string;
  role: string | null;
};

const FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
function fmt(iso: string): string {
  return FMT.format(new Date(`${iso}T12:00:00+08:00`));
}

export async function DependentsSection() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const myUserId = user?.id ?? '';

  // RLS now returns MY dependents + any my spouse marked shared (PR-G household).
  const { data, error: dataError } = await supabase
    .from('dependents')
    .select('dependent_id, dependent_kind, name, birth_date, sex, religion, relationship, owner_user_id, shared_with_spouse, handed_over_at, claimed_user_id, handed_over_by_user_id, claim_token, claim_token_purpose, claim_token_expires_at')
    .order('created_at', { ascending: true });
  // ⚠ the dependents this person added. Refused, their list reads as empty — people
  // ⚠ they entered by hand simply are not there.
  if (dataError) {
    logQueryError('DependentsSection.data', dataError, {}, 'graceful_degrade');
  }
  const rows = (data ?? []) as DependentRow[];
  const today = manilaToday();

  // Absolute base for hand-over links (same pattern as the Papic crew page).
  const h = await headers();
  const host = h.get('host') ?? 'www.setnayan.com';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const appUrl = `${proto}://${host}`;

  // Do I have a spouse on Setnayan? Only then is the "share with spouse" toggle
  // meaningful. current_spouse_user_ids() returns the co-host(s) of my wedding.
  const { data: spouseIds, error: spouseIdsError } = await supabase.rpc('current_spouse_user_ids');
  // ⚠ the spouse link. Refused, it reads as unset.
  if (spouseIdsError) {
    logQueryError('DependentsSection.spouseIds', spouseIdsError, {}, 'graceful_degrade');
  }
  const hasSpouse = Array.isArray(spouseIds) && spouseIds.length > 0;

  // 🔒 WHOSE ROWS BELONG ON THIS PAGE — decided here, not by RLS. RLS also admits
  // an ADMIN to every dependent on the platform, and this list used to render
  // whatever came back, labelling every row that was not the viewer's own
  // "Shared by your spouse". On 2026-09-25 the owner (an admin, no registered
  // spouse) saw another user's business, "Indigo Caterers", on his own People
  // page tagged "Shared by your spouse". A personal page shows: my own rows,
  // rows I handed over (read-only history), and rows my ACTUAL spouse shared.
  // 🔑 THE RULE LIVES IN `lib/my-loved-ones.ts` — the People roster's count reads
  // the SAME function (2026-09-29: it didn't, and "Loved ones 1" sat above "No
  // loved ones yet." for the owner, counting that same Indigo Caterers row).
  const spouseSet = spouseIdSet(spouseIds);
  const dependents = myLovedOnes(rows, myUserId, spouseSet);

  // Godparents (ninong/ninang) per dependent — RLS scopes to the owner's rows.
  const { data: gpData, error: gpDataError } = await supabase
    .from('godparents')
    .select('godparent_id, dependent_id, godparent_name, role')
    .order('created_at', { ascending: true });
  // ⚠ godparent links. Refused, a named godparent disappears.
  if (gpDataError) {
    logQueryError('DependentsSection.gpData', gpDataError, {}, 'graceful_degrade');
  }
  const godparentsByDependent = new Map<string, GodparentRow[]>();
  for (const g of (gpData ?? []) as GodparentRow[]) {
    const list = godparentsByDependent.get(g.dependent_id) ?? [];
    list.push(g);
    godparentsByDependent.set(g.dependent_id, list);
  }

  return (
    // The ALAGA VIEW (owner 2026-09-28, People redesign): the page's picker
    // already names it and the page draws "Add an alaga" at its head, so this
    // section carries neither a second heading nor a second door.
    <section aria-label="Loved ones">

      {dependents.length > 0 ? (
        <ul className="mb-6 divide-y divide-ink/10 border-b border-ink/10">
          {dependents.map((d) => {
            // Fence band, milestones + godparents are the PERSON case only — a
            // pet's birthday is never a "debut". Legacy rows (null kind) = person.
            const isPersonRow = isPersonDependent(d.dependent_kind);
            const band = isPersonRow && d.birth_date ? fenceBand(d.birth_date, today) : null;
            const next = isPersonRow && d.birth_date ? dependentNextMilestone(d.birth_date, d.sex, today) : null;
            const mine = d.owner_user_id === myUserId;
            // Hand-over states (owner-locked 2026-07-16): a claim is a TRUE
            // ownership transfer — the claimant becomes owner (full control,
            // incl. erasure); the former guardian keeps read-only history via
            // handed_over_by. Link mint: person needs age ≥18 proof; pet/other
            // always.
            const handedOver = !!d.handed_over_at;
            const claimedByMe = d.claimed_user_id === myUserId;
            const fromMe = d.handed_over_by_user_id === myUserId;
            const canMintLink =
              mine && !handedOver && (!isPersonRow || isClaimEligible(d.birth_date, today));
            const linkActive =
              !!d.claim_token &&
              !!d.claim_token_expires_at &&
              new Date(d.claim_token_expires_at) > new Date();
            const gps = godparentsByDependent.get(d.dependent_id) ?? [];
            return (
              <li key={d.dependent_id} className="py-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    {/* THE NAME IS THE DOOR. Until 2026-08-31 there was no route
                        to an alaga at all — a business had no timeline, and
                        neither did a child. The page exists now; this is how
                        anyone reaches it. */}
                    <Link
                      href={`/dashboard/people/${d.dependent_id}`}
                      className="inline-flex min-h-11 items-center font-semibold text-ink underline-offset-2 hover:underline"
                    >
                      {d.name}
                    </Link>
                    <p className="truncate text-[13px] text-ink/70">
                      {claimedByMe
                        ? 'You'
                        : d.dependent_kind && d.dependent_kind !== 'person'
                          ? DEPENDENT_KIND_LABELS[d.dependent_kind]
                          : d.relationship
                            ? DEPENDENT_RELATIONSHIP_LABELS[d.relationship as keyof typeof DEPENDENT_RELATIONSHIP_LABELS]
                            : 'My loved one'}
                      {band === 'child' ? ' · under 18' : band === 'elder' ? ' · over 50' : ''}
                      {next ? ` · next: turns ${next.age} on ${fmt(next.dateISO)}` : ''}
                    </p>
                    {/* Debut happens FROM the alaga (owner 2026-07-17): when the
                        next milestone is their debut (18 F / 21 M), open the door. */}
                    {isPersonRow && !handedOver && next && next.age === (d.sex === 'male' ? 21 : 18) ? (
                      <Link
                        href="/onboarding/debut"
                        className="ab ab-brand mt-1 inline-flex min-h-11 items-center justify-center gap-1.5"
                      >
                        Plan {d.name}&rsquo;s debut →
                      </Link>
                    ) : null}
                  </div>
                  {handedOver ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={claimedByMe ? 'ok' : 'quiet'}>
                        {claimedByMe
                          ? 'Your own profile'
                          : `Their own account since ${fmt(d.handed_over_at!.slice(0, 10))}`}
                      </Badge>
                      {claimedByMe ? (
                        // The claimant owns the record now — RA 10173 erasure
                        // is theirs to exercise (the former guardian cannot).
                        <StayConfirmForm
                          door="accPeople.deleteDependent"
                          action={deleteDependent}
                          title="Erase this record?"
                          message={`Permanently erase your profile record${fromMe ? '' : ' (your former guardian will lose their copy too)'}? This cannot be undone.`}
                          confirmLabel="Erase"
                        >
                          <input type="hidden" name="dependent_id" value={d.dependent_id} />
                          <ActionButton type="submit" tone="danger" icon={<Trash2 aria-hidden />} label="Erase" />
                        </StayConfirmForm>
                      ) : null}
                    </div>
                  ) : mine ? (
                    <StayConfirmForm
                      door="accPeople.deleteDependent"
                      action={deleteDependent}
                      title="Remove this record?"
                      message={`Remove ${d.name}? This permanently deletes their record.`}
                      confirmLabel="Remove"
                      className="shrink-0"
                    >
                      <input type="hidden" name="dependent_id" value={d.dependent_id} />
                      <ActionButton type="submit" tone="danger" icon={<Trash2 aria-hidden />} label="Remove" />
                    </StayConfirmForm>
                  ) : (
                    <Badge tone="quiet">Shared by your spouse</Badge>
                  )}
                </div>

                {/* Hand-over / transfer-care link (owner-locked 2026-07-16):
                    a PERSON of age claims their own account; a pet/other
                    rehomes to a new guardian. One active link, 7-day expiry. */}
                {canMintLink ? (
                  <div className="mt-2">
                    {linkActive ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <CopyButton
                          value={`${appUrl}/claim/${d.claim_token}`}
                          label={isPersonRow ? 'Copy hand-over link' : 'Copy transfer link'}
                        />
                        <span className="text-xs text-[color:var(--sn-ink-500)]">
                          expires {fmt(d.claim_token_expires_at!.slice(0, 10))}
                        </span>
                        <StayForm door="accPeople.revokeHandoverLink" action={revokeHandoverLink}>
                          <input type="hidden" name="dependent_id" value={d.dependent_id} />
                          <SubmitButton
                            className="ab ab-danger inline-flex min-h-11 items-center justify-center gap-1.5"
                            pendingLabel="Revoking…"
                          >
                            Revoke
                          </SubmitButton>
                        </StayForm>
                        <StayForm door="accPeople.emailHandoverLink" action={emailHandoverLink} className="flex w-full items-center gap-2 sm:w-auto">
                          <input type="hidden" name="dependent_id" value={d.dependent_id} />
                          <input
                            autoComplete="off"
                            type="email"
                            name="recipient"
                            required
                            placeholder={isPersonRow ? `${d.name}'s email` : "New keeper's email"}
                            aria-label={`Email the ${isPersonRow ? 'hand-over' : 'transfer'} link for ${d.name}`}
                            className="input-field h-11 flex-1 py-1 text-sm sm:max-w-[13rem]"
                          />
                          <SubmitButton
                            className="ab ab-info inline-flex min-h-11 items-center justify-center gap-1.5"
                            pendingLabel="Sending…"
                          >
                            Email it
                          </SubmitButton>
                        </StayForm>
                      </div>
                    ) : (
                      <StayForm door="accPeople.createHandoverLink" action={createHandoverLink}>
                        <input type="hidden" name="dependent_id" value={d.dependent_id} />
                        <SubmitButton
                          className="ab ab-neutral inline-flex min-h-11 items-center justify-center gap-1.5"
                          pendingLabel="Creating…"
                        >
                          {isPersonRow
                            ? `${d.name} is of age — create their hand-over link`
                            : 'Transfer care to someone else'}
                        </SubmitButton>
                      </StayForm>
                    )}
                  </div>
                ) : null}

                {/* Share-with-spouse toggle — my own rows, only if I have a spouse */}
                {mine && !handedOver && hasSpouse ? (
                  <StayForm door="accPeople.setDependentSharing" action={setDependentSharing} className="mt-2">
                    <input type="hidden" name="dependent_id" value={d.dependent_id} />
                    <input type="hidden" name="share" value={d.shared_with_spouse ? '0' : '1'} />
                    <SubmitButton
                      className="ab ab-neutral inline-flex min-h-11 items-center justify-center gap-1.5"
                      pendingLabel="Saving…"
                    >
                      {d.shared_with_spouse
                        ? '✓ Shared with your spouse — tap to make private'
                        : 'Share with your spouse'}
                    </SubmitButton>
                  </StayForm>
                ) : null}

                {/* Godparents (ninong / ninang) — editable while a child is
                    under guardianship; read-only to the claimed adult (their
                    own baptismal record, via godparents_subject_read RLS). */}
                {band === 'child' || (claimedByMe && gps.length > 0) ? (
                  <div className="mt-3 border-t border-ink/10 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--sn-ink-500)]">
                      Ninong &amp; ninang
                    </p>
                    {gps.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {gps.map((g) => (
                          <li key={g.godparent_id} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-ink/[0.06] py-0.5 pl-3 pr-0.5 text-[13px] text-ink">
                            <span>
                              {g.godparent_name}
                              {g.role ? <span className="text-ink/70"> · {g.role}</span> : null}
                            </span>
                            {mine && band === 'child' ? (
                              <StayConfirmForm
                                door="accPeople.deleteGodparent"
                                action={deleteGodparent}
                                title="Remove godparent?"
                                message={`Remove ${g.godparent_name}?`}
                                confirmLabel="Remove"
                              >
                                <input type="hidden" name="godparent_id" value={g.godparent_id} />
                                <button
                                  type="submit"
                                  aria-label={`Remove ${g.godparent_name}`}
                                  className="relative grid h-7 w-7 place-items-center rounded-full text-ink/70 transition-colors before:absolute before:-inset-2 before:content-[''] hover:text-[rgb(var(--color-danger))]"
                                >
                                  <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} />
                                </button>
                              </StayConfirmForm>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {mine && band === 'child' ? (
                      <StayForm door="accPeople.addGodparent" action={addGodparent} className="mt-2 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="dependent_id" value={d.dependent_id} />
                        <input
                          name="godparent_name"
                          className="input-field h-11 flex-1 py-1 text-sm sm:max-w-[12rem]"
                          placeholder="Add a ninong or ninang"
                          aria-label={`Godparent name for ${d.name}`}
                          required
                        />
                        <PostedPick
                          name="role"
                          label="Role"
                          className="block w-36"
                          options={[
                            { key: 'ninong', label: 'Ninong' },
                            { key: 'ninang', label: 'Ninang' },
                          ]}
                        />
                        <input
                          autoComplete="off"
                          name="godparent_email"
                          type="email"
                          className="input-field h-11 flex-1 py-1 text-sm sm:max-w-[13rem]"
                          placeholder="Email (optional — for reminders)"
                          aria-label={`Godparent email for ${d.name}`}
                        />
                        <SubmitButton className="ab ab-ok inline-flex min-h-11 items-center justify-center gap-1.5" pendingLabel="Adding…">
                          Add
                        </SubmitButton>
                      </StayForm>
                    ) : gps.length === 0 ? (
                      <p className="mt-1 text-[13px] text-ink/70">No godparents added.</p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        /* 🔴 THIS BRANCH WAS `null` — A HEADING WITH NOTHING UNDER IT. With no
           alaga yet the section rendered the word "Alaga" and then the next
           section's heading, so the page answered "what is an alaga and how do
           I get one" with silence. Samahan, in the same column, has always
           answered its own empty state with a sentence and a way in; the two
           sections disagreed about what an empty list looks like. */
        <div className="mb-4">
          <InfoTip label="No loved ones yet." labelClassName="text-sm text-ink/70" align="start">
            Add a child, an elder, a pet, or anything else you look after — their profile lives inside yours until they
            take it over.
          </InfoTip>
        </div>
      )}

      {/* THE ADD BUTTON LIVES AT THE HEAD OF THE ALAGA VIEW, ONCE (owner
          2026-09-28: *"we already agreed this will be on the alaga and samahan
          row"*, pointing at the People redesign — supersedes both the 2026-08-22
          header row and the 2026-09-23 copy that stood here, under the list,
          whose ruling it CONTINUES: *"Alaga should be together meaning Alaga
          will have a button to create an alaga under it same to samahan."*).
          `page.tsx` draws <AddAlagaButton> above this section; drawing it here
          too would put the same door on one screen twice. Pinned by
          `the-buttons-live-together.test.ts` + `alaga-has-its-own-door.test.ts`. */}
    </section>
  );
}
