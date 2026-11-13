import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { getAdminPowersFor } from '@/lib/admin/can.server';
import { canWith, refusalFor } from '@/lib/admin/can';
import { ADMIN_AREA_LIST, adminAreaLabel } from '@/lib/admin/areas';
import { isOwnerProfile } from '@/lib/admin/owner';
import { SELF_APPROVAL_WORD } from '@/lib/admin/self-approval';
import { maybeRunOwnerApprovals } from '@/lib/admin/self-approval-runner';
import { logQueryError } from '@/lib/supabase/error-detect';
import { PageMasthead } from '@/app/_components/page-masthead';
import { SubmitButton } from '@/app/_components/submit-button';
import { InfoTip } from '@/app/_components/info-tip';
import { ErrorState } from '@/app/_components/states/error-state';
import { addAdmin, saveAdminAreas, takeAllAreasAway } from './actions';

export const metadata = { title: 'Team · Admin' };

/**
 * TEAM — who can open /admin, and what each person may do there.
 * Ported from the approved drawing (Setnayan-specs prototypes/admin_pub/admin.html
 * `page('team', …)`), DECISION_LOG 2026-11-13 "ADMIN TEAM: AREAS × LEVELS".
 * The owner is shown as "everything" and locked. Changing anything takes
 * Team · Escalated; without it the controls are greyed and the ⓘ says why.
 */

type Person = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  is_internal: boolean | null;
  is_team_member: boolean | null;
  account_type: string | null;
};
type ScopeRow = { user_id: string; area: string; level: string };

function roleWords(p: Person): string {
  const parts: string[] = [];
  if (p.is_internal) parts.push('Internal');
  if (p.account_type === 'admin') parts.push('Admin');
  if (p.is_team_member) parts.push('Team member');
  return parts.join(' · ') || 'Admin';
}

function AreaGrid({
  prefix,
  has,
  disabled,
}: {
  prefix: string;
  has: (area: string, level: 'basic' | 'escalated') => boolean;
  disabled: boolean;
}) {
  return (
    <div className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-white">
      {ADMIN_AREA_LIST.map((a) => (
        <div key={a.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <InfoTip label={a.label} labelClassName="text-sm font-semibold text-ink" align="start">
            Basic — {a.basic}.{' '}
            {a.escalated
              ? `Escalated — ${a.escalated}.`
              : 'Nothing here gives or takes anything, so Basic is the whole area.'}
          </InfoTip>
          <span className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name="basic"
                value={a.key}
                defaultChecked={has(a.key, 'basic') || has(a.key, 'escalated')}
                disabled={disabled}
                id={`${prefix}-b-${a.key}`}
              />
              Basic
            </label>
            {a.escalated ? (
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  name="escalated"
                  value={a.key}
                  defaultChecked={has(a.key, 'escalated')}
                  disabled={disabled}
                  id={`${prefix}-e-${a.key}`}
                />
                Escalated
              </label>
            ) : (
              <span className="w-[5.5rem] text-xs text-ink/45">—</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function TypedField({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold text-ink">
        Type {SELF_APPROVAL_WORD} to start the 24-hour wait now (optional)
      </span>
      <input
        name="typed"
        autoComplete="off"
        placeholder={SELF_APPROVAL_WORD}
        className="w-48 rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
      />
      <span className="text-xs text-ink/55">
        Giving Escalated waits 24 hours, then runs — you are emailed at the start and when it runs, and can cancel on
        Approvals. Leave it empty to send it to another Escalated admin instead.
      </span>
    </label>
  );
}

export default async function AdminTeamPage() {
  const { userId: meId } = await requireAdmin();
  after(() => maybeRunOwnerApprovals().catch(() => {}));
  const admin = createAdminClient();
  const powers = await getAdminPowersFor(meId);
  const canManage = canWith(powers, 'team', 'escalated');
  const manageWhy = canManage ? null : refusalFor(powers, 'team', 'escalated');

  const [peopleRes, scopesRes] = await Promise.all([
    admin
      .from('users')
      .select('user_id, email, display_name, is_internal, is_team_member, account_type')
      .or('account_type.eq.admin,is_internal.eq.true,is_team_member.eq.true')
      .order('created_at', { ascending: true }),
    admin.from('admin_scopes').select('user_id, area, level'),
  ]);
  if (peopleRes.error) logQueryError('AdminTeamPage.people', peopleRes.error, {}, 'graceful_degrade');
  if (scopesRes.error) logQueryError('AdminTeamPage.scopes', scopesRes.error, {}, 'graceful_degrade');
  const people = (peopleRes.data ?? null) as Person[] | null;
  const scopes = scopesRes.error ? null : ((scopesRes.data ?? []) as ScopeRow[]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMasthead title="Team" />

      <div className="mb-6">
        <InfoTip label="Who can open /admin, and what each person may do" labelClassName="text-sm text-ink/75" align="start">
          Each area has two levels. Basic is answering and simple steps that give nothing and can be undone. Escalated
          gives something or takes it away — money, refunds, gifts, prices, promos, bans, deletions, plan changes. The
          owner has every area and can’t be changed. Taking a level away is immediate; giving Escalated waits for a
          second admin, or for the owner’s typed word and 24 hours.
        </InfoTip>
      </div>

      {/* ADD AN ADMIN */}
      <section className="mb-10 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
        <h2 className="mb-1 sn-eye">Add an admin</h2>
        <p className="mb-4 text-xs text-ink/60">
          Name, email, then what they may do. They need a Setnayan account already. Making someone an admin waits for a
          second admin — or, for the owner, his typed word and 24 hours.
        </p>
        {manageWhy ? (
          <p className="mb-3 flex items-center gap-2 text-xs text-ink/60">
            <span>Adding admins is Escalated in Team.</span>
            <InfoTip label="" ariaLabel="Why it is greyed" align="start">
              {manageWhy}
            </InfoTip>
          </p>
        ) : null}
        <form action={addAdmin} className="grid gap-4">
          <fieldset disabled={!canManage} className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Their name</span>
              <input name="name" autoComplete="off" className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Their account email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="off"
                className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
              />
            </label>
          </fieldset>
          <AreaGrid prefix="new" has={() => false} disabled={!canManage} />
          <fieldset disabled={!canManage} className="grid gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Why (recorded in the Admin log)</span>
              <textarea name="why" required minLength={3} rows={2} className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm" />
            </label>
            <TypedField show={powers.isOwner} />
            <div>
              <SubmitButton
                pendingLabel="Adding…"
                className="rounded-md bg-mulberry px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Add
              </SubmitButton>
            </div>
          </fieldset>
        </form>
      </section>

      {/* THE TEAM */}
      <section>
        <h2 className="mb-3 sn-eye">Can open /admin ({people === null ? '—' : people.length})</h2>
        {people === null ? (
          <ErrorState
            title="Couldn’t load the team"
            broke={peopleRes.error?.message ? `The read was refused: ${peopleRes.error.message}` : 'The read did not complete.'}
            survived="Not the same as nobody — /admin is still locked to the same people."
            todo="Reload. If it repeats, the query is being rejected rather than returning nothing."
          />
        ) : (
          <ul className="space-y-3">
            {scopes === null ? (
              <li role="alert" className="rounded-xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4 text-sm text-ink/70">
                <strong className="text-ink">Areas could not be read.</strong> The ticks below may be empty when they are
                not. Do not save from this state — reload first.
              </li>
            ) : null}
            {people.map((p) => {
              const owner = isOwnerProfile(p);
              const mine = (scopes ?? []).filter((s) => s.user_id === p.user_id);
              const has = (area: string, level: 'basic' | 'escalated') =>
                mine.some((s) => s.area === area && s.level === level);
              const esc = mine.filter((s) => s.level === 'escalated').map((s) => adminAreaLabel(s.area));
              const basicOnly = mine
                .filter((s) => s.level === 'basic' && !has(s.area, 'escalated'))
                .map((s) => adminAreaLabel(s.area));
              const summary = owner
                ? 'Owner — every area, Basic and Escalated · can’t be changed'
                : [esc.length ? `Escalated: ${esc.join(' · ')}` : '', basicOnly.length ? `Basic: ${basicOnly.join(' · ')}` : '']
                    .filter(Boolean)
                    .join(' — ') || 'No areas yet — can open /admin and do nothing';
              const isMe = p.user_id === meId;
              const editable = canManage && !owner && !isMe && scopes !== null;
              return (
                <li key={p.user_id} className="sn-row p-4">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">
                        {p.display_name || p.email || p.user_id}
                        {isMe ? <span className="ml-2 text-xs font-normal text-ink/55">(you)</span> : null}
                      </span>
                      <span className="text-xs text-ink/60">
                        {p.email} · {owner ? 'Owner' : roleWords(p)}
                      </span>
                    </summary>
                    <p className="mt-2 text-sm text-ink/75">{summary}</p>
                    {owner ? (
                      <p className="mt-3 text-xs text-ink/55">🔒 Owner · everything. Nothing here can narrow the owner.</p>
                    ) : (
                      <form action={saveAdminAreas} className="mt-3 grid gap-3">
                        <input type="hidden" name="user_id" value={p.user_id} />
                        <AreaGrid prefix={p.user_id} has={has} disabled={!editable} />
                        {editable ? (
                          <>
                            <label className="flex flex-col gap-1 text-sm">
                              <span className="font-semibold text-ink">Why (recorded in the Admin log)</span>
                              <input name="why" autoComplete="off" className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm" />
                            </label>
                            <TypedField show={powers.isOwner} />
                            <div className="flex flex-wrap gap-2">
                              <SubmitButton
                                pendingLabel="Saving…"
                                className="rounded-md bg-mulberry px-4 py-2 text-sm font-semibold text-white"
                              >
                                Save
                              </SubmitButton>
                              <SubmitButton
                                formAction={takeAllAreasAway}
                                pendingLabel="Taking away…"
                                className="rounded-md border border-ink/20 bg-white px-4 py-2 text-sm font-semibold text-ink"
                              >
                                Take all away
                              </SubmitButton>
                            </div>
                          </>
                        ) : (
                          <p className="flex items-center gap-2 text-xs text-ink/55">
                            <span>{isMe ? 'Nobody edits their own areas.' : 'Changing areas is Escalated in Team.'}</span>
                            {manageWhy && !isMe ? (
                              <InfoTip label="" ariaLabel="Why it is greyed" align="start">
                                {manageWhy}
                              </InfoTip>
                            ) : null}
                          </p>
                        )}
                      </form>
                    )}
                    <p className="mt-3 text-xs">
                      <a className="text-link underline" href={`/admin/admin-log?person=${p.user_id}`}>
                        Their actions
                      </a>
                    </p>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
