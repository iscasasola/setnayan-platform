import Link from 'next/link';
import { Search, Sparkle, MailCheck, Trash2, Ban, KeyRound, Undo2, Gift, ChevronRight, XCircle, LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { logAdminDataAccess } from '@/lib/admin-data-access';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { MiniTour } from '@/app/_components/mini-tour';
import {
  blacklistUser,
  confirmUserEmail,
  deleteUser,
  forceSignOutUser,
  issueCompGrant,
  resetUserPassword,
  revokeCompGrant,
  toggleTeamMember,
  unblacklistEmail,
} from '@/app/admin/users/actions';
import {
  describeReach,
  describeScope,
  describeSource,
  fetchCompGrantsForUser,
  formatRetailValueCentavos,
  type CompGrantRow,
} from '@/lib/comp-grants';
import {
  fetchV2CustomerCatalog,
  supplierSkuCategory,
  fetchV2BundleCatalog,
  fetchV2VendorCatalog,
} from '@/lib/v2-catalog';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { Badge } from '@/app/_components/badge';
import {
  TEMPLATE_SUBLINE,
  TemplateEmpty,
  TemplateFail,
  TemplateRow,
  TemplateRows,
  TemplateSection,
} from '@/app/_components/template-rows';
import { logQueryError } from '@/lib/supabase/error-detect';
import { PersonMore } from '../_components/person-more';
import { PeopleFilterChips } from '../_components/people-filter-chips';
import { PageMasthead } from '@/app/_components/page-masthead';
import { COMP_GRANT_CO_REVIEW_PESOS } from '@/lib/rule-constants';
import { formatCount } from '@/lib/format-number';
import { holdDateWords } from '@/lib/account-suspension';

/**
 * The ceiling on BOTH reads this surface makes — the account list and the
 * blacklist. One constant, used at the `.limit()` and handed to the table as
 * `cap`, so the disclosure and the query can never drift. The old header prose
 * said "Latest 200 accounts" as a second hand-typed copy of this number; it now
 * derives from it.
 */
const ACCOUNT_ROW_LIMIT = 200;

/** A pickable service for the comp-grant SKU picker (catalog-driven). */
type ServiceOption = {
  sku_code: string;
  display_name: string;
  category: string;
  price_centavos: number;
};

type UserRow = {
  user_id: string;
  public_id: string;
  email: string | null;
  display_name: string | null;
  account_type: 'customer' | 'vendor' | 'admin';
  is_internal: boolean;
  is_team_member: boolean;
  created_at: string;
  /** ⏸ Account suspend (owner 2026-11-13) — NULL = not on hold. */
  suspended_at: string | null;
  suspended_until: string | null;
  suspended_reason: string | null;
};

type BlacklistRow = {
  id: string;
  email: string;
  reason: string | null;
  blacklisted_at: string;
};

// 'team_pool' filter retired 2026-11-05 with the service-credit pool it was named for (owner: "retire").
// 'suspended' added 2026-11-13 (owner, ACCOUNT SUSPEND — prototype people.html "⏸ Suspended").
type Filter = 'all' | 'customer' | 'vendor' | 'internal' | 'suspended' | 'blacklisted';

/**
 * UsersSurface — the Users LIST body, re-homed byte-identical from
 * app/admin/users/page.tsx into the tabbed /admin/accounts studio (Accounts
 * Studio slice 1). Behaviour is unchanged: the ?q + ?filter allowlist, the
 * inline comp-grants expand panel, the ~9 server-action forms (imported from
 * their unchanged @/app/admin/users/actions location), the RA 10173
 * logAdminDataAccess + after() audit side-effects, and the MiniTour ALL move
 * with the body. Only three things differ, all mechanical:
 *   1. It accepts the surface's own searchParams (q, filter, …) as props from
 *      the /admin/accounts shell instead of awaiting them itself.
 *   2. The filter/search form posts to /admin/accounts with a hidden
 *      tab=users input so submitting a filter stays on the Users tab.
 *   3. buildToggleHref + the reset-password/force-sign-out redirect targets
 *      point at /admin/accounts?tab=users instead of /admin/users.
 */
/**
 * ── 2026-08-17 · BOTH tables onto <ConsoleTable> ─────────────────────────────
 * This file held TWO tables — the account list and the blacklist — and FOUR
 * places that could print a zero or an emptiness over something nobody read:
 *
 *   1. "No users match."            ← on a refused read, on the accounts screen.
 *   2. "No blacklisted emails."     ← same, and this one is a security list.
 *   3. "No comp grants on this account yet."  ← the grants fetch is wrapped in a
 *      `try { … } catch { [] }`, so a thrown failure read as "never been given
 *      anything". Somebody deciding whether to gift a service was shown a clean
 *      slate that might not be one.
 *   4. "No catalog SKUs found."     ← the catalog fetch, same swallowing catch,
 *      and the consequence is a comp-grant form with nothing to tick.
 *
 * ⚖ WHY (1) WAS WORSE THAN THE OTHERS DESPITE HAVING AN ERROR BANNER. The banner
 * above the table did render the message — and then the table underneath said
 * "No users match." in a calmer voice. Two statements about one event, and the
 * confident one is the one a reader takes as the answer. The banner is gone; the
 * table now says the one true thing.
 *
 * 🔀 THE ONE COMPOSITION CHANGE, and it is forced, not chosen: the comp-grants
 * panel used to be an extra `<tr>` with `colSpan={6}` injected under the
 * expanded user. ConsoleTable renders exactly one row per row — deliberately,
 * because that is what makes the states uniform — so the panel now renders
 * directly BELOW the table. It keeps its `id`, so the row's `aria-controls`
 * still resolves to it; only one user can be expanded at a time, so there is
 * only ever one panel; and on a phone it is no longer trapped inside a
 * horizontally scrolling table. Nothing in it was redrawn.
 */
export async function UsersSurface({
  q: qRaw,
  filter: filterRaw,
  tempPassword,
  forEmail,
  expandUserId,
  grantBanner,
  signedOut,
  error,
}: {
  q: string;
  filter: string;
  tempPassword: string | null;
  forEmail: string | null;
  expandUserId: string | null;
  grantBanner: string | null;
  signedOut: string | null;
  error: string | null;
}) {
  const q = (qRaw ?? '').trim();
  const filter = (filterRaw ?? 'all') as Filter;

  const admin = createAdminClient();

  // Blacklisted view: pulls from `blacklisted_emails` instead of `users`.
  // Both start as null = NOT MEASURED. Only one of the two reads runs, so the
  // other one staying null is correct: nothing was counted, so there is no count.
  let blacklistRows: BlacklistRow[] | null = null;
  let userRows: UserRow[] | null = null;
  // The `{ error }` object itself, not `error.message`. The message alone cannot
  // be handed to the table, and a string is what made the old banner the only
  // place the failure could be said.
  let readError: { message?: string } | null = null;

  if (filter === 'blacklisted') {
    let bq = admin
      .from('blacklisted_emails')
      .select('id,email,reason,blacklisted_at')
      .order('blacklisted_at', { ascending: false })
      .limit(ACCOUNT_ROW_LIMIT);
    if (q.length > 0) bq = bq.ilike('email', `%${q}%`);
    const { data, error } = await bq;
    blacklistRows = data as BlacklistRow[] | null;
    readError = error;
  } else {
    let query = admin
      .from('users')
      .select(
        'user_id,public_id,email,display_name,account_type,is_internal,is_team_member,created_at,suspended_at,suspended_until,suspended_reason',
      )
      .order('created_at', { ascending: false })
      .limit(ACCOUNT_ROW_LIMIT);

    if (filter === 'customer' || filter === 'vendor') {
      query = query.eq('account_type', filter);
    } else if (filter === 'internal') {
      query = query.eq('is_internal', true);
    } else if (filter === 'suspended') {
      // On hold now — a passed Until the hourly lift has not reached yet still shows, with its date, until it is lifted.
      query = query.not('suspended_at', 'is', null);
    }

    if (q.length > 0) {
      query = query.or(
        `email.ilike.%${q}%,display_name.ilike.%${q}%,public_id.ilike.%${q}%`,
      );
    }

    const { data, error } = await query;
    userRows = data as UserRow[] | null;
    readError = error;
  }

  /** The flattened list, for the lookups below that genuinely need an array. */
  const listedUsers = userRows ?? [];

  // "Add to team" opens a two-admin approval (§ 9.1 — is_team_member is an
  // admin role) and grants nothing by itself. Without this read the button
  // would look exactly as it did before it was pressed. null = not measured:
  // the button then stays as it was, and a second press is refused by the
  // one-pending-request check in toggleTeamMember, never doubled.
  let pendingTeamGrants: Set<string> | null = null;
  const teamCandidates = listedUsers.filter((u) => !u.is_team_member && !u.is_internal).map((u) => u.user_id);
  if (teamCandidates.length > 0) {
    const { data: pending, error: pendingErr } = await admin
      .from('admin_approval_requests')
      .select('target_user_id')
      .eq('action_type', 'grant_team_member')
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .in('target_user_id', teamCandidates);
    if (pendingErr) {
      console.error('[UsersSurface] pending team-member requests read failed', pendingErr.message);
    } else {
      pendingTeamGrants = new Set(
        ((pending ?? []) as Array<{ target_user_id: string | null }>)
          .map((r) => r.target_user_id)
          .filter((id): id is string => !!id),
      );
    }
  }

  // Fetch comp grants for the expanded user (if the panel is open AND the
  // user shows up in the current list — protects against stale ?expand
  // params after a filter change).
  //
  // null = the fetch failed. It was `catch { expandedGrants = [] }`, which the
  // panel then rendered as "No comp grants on this account yet" — a clean slate
  // shown to somebody about to decide whether to gift a service, when the truth
  // was that we had not looked.
  let expandedGrants: CompGrantRow[] | null = null;
  if (expandUserId && listedUsers.some((u) => u.user_id === expandUserId)) {
    try {
      expandedGrants = await fetchCompGrantsForUser(admin, expandUserId);
    } catch {
      expandedGrants = null;
    }
    // RA 10173 access trail (admin account-access model Phase 1a): record —
    // post-response, non-fatal — that this admin opened this account's detail.
    // Never blocks render; logging failures are swallowed by the helper.
    const viewedUserId = expandUserId;
    after(async () => {
      const supabase = await createClient();
      const {
        data: { user: actingAdmin },
      } = await supabase.auth.getUser();
      await logAdminDataAccess(admin, {
        adminUserId: actingAdmin?.id ?? null,
        accessedUserId: viewedUserId,
        surface: 'admin_users_detail',
      });
    });
  }

  // Catalog for the comp-grant SKU picker — fetched once per page load, shared
  // across every expanded panel. Auto-populates from the live catalog tables so
  // new paid SKUs appear as they land. Degrades to [] on error (the panel then
  // shows "No catalog SKUs found").
  // null = the catalog read failed, which the form used to render as "No catalog
  // SKUs found." — indistinguishable from a genuinely empty catalog, on the one
  // control whose whole job is picking a SKU.
  let compGrantServices: ServiceOption[] | null = null;
  try {
    const [customers, bundles, vendors] = await Promise.all([
      fetchV2CustomerCatalog({ forAdmin: true }),
      fetchV2BundleCatalog(),
      fetchV2VendorCatalog(),
    ]);
    compGrantServices = [
      ...customers.map((c) => ({
        sku_code: c.service_code,
        display_name: c.title,
        category: 'Customer service',
        price_centavos: Math.round(c.retail_price_php * 100),
      })),
      ...bundles.map((b) => ({
        sku_code: b.package_code,
        display_name: b.title,
        category: 'Bundle',
        price_centavos: Math.round(b.retail_price_php * 100),
      })),
      ...vendors.map((v) => ({
        sku_code: v.sku_code,
        display_name: v.title,
        category: supplierSkuCategory(v.offering_type),
        price_centavos: Math.round(v.price_php * 100),
      })),
    ].sort((a, b) =>
      a.category === b.category
        ? a.display_name.localeCompare(b.display_name)
        : a.category.localeCompare(b.category),
    );
  } catch {
    compGrantServices = null;
  }

  return (
    // 📐 One column, never wider than 760 (template rule 12) — the People frame at 1280.
    <div className="mx-auto w-full max-w-[760px]">
      <PageMasthead
        title="Users"
      />

      {grantBanner ? (
        <section
          role="status"
          className="mb-6 rounded-2xl border border-success-300/60 bg-success-50/80 px-5 py-4"
        >
          <p className="text-sm text-success-900">{grantBanner}</p>
        </section>
      ) : null}

      {signedOut ? (
        <section
          role="status"
          className="mb-6 rounded-2xl border border-success-300/60 bg-success-50/80 px-5 py-4"
        >
          <p className="text-sm text-success-900">
            Force sign-out complete — that user&rsquo;s sessions are revoked on
            every device. Audit-logged.
          </p>
        </section>
      ) : null}

      {error ? (
        <section
          role="alert"
          className="mb-6 rounded-2xl border border-danger-300/60 bg-danger-50/80 px-5 py-4"
        >
          <p className="text-sm text-danger-900">{error}</p>
        </section>
      ) : null}

      {tempPassword ? (
        <section
          role="status"
          className="mb-6 space-y-3 rounded-2xl border border-warn-300/60 bg-warn-50/80 p-5"
        >
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-warn-900">
              Temporary password generated
            </p>
            <p className="text-sm text-warn-900">
              Share this with{' '}
              {forEmail ? (
                <span className="font-medium">{forEmail}</span>
              ) : (
                'the user'
              )}{' '}
              via a secure channel (DM, in-person, encrypted message). It&apos;s
              delivered by a one-time httpOnly cookie (never the URL) and expires
              within a couple of minutes — copy it now.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-md bg-white/70 p-3">
            <code className="break-all font-mono text-lg font-semibold text-ink">
              {tempPassword}
            </code>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              Select all + copy
            </span>
          </div>
          <p className="text-xs text-warn-900/85">
            Have the user sign in with this temp password, then change it
            immediately from their Profile page (Personal info → Change
            password).
          </p>
        </section>
      ) : null}

      {/* 📐 The People frame (owner-approved 2026-11-14): the filters are soft chips, the search one field — Enter
          searches, keeping the chip picked. Same `?q` + `?filter` as before. */}
      <PeopleFilterChips filter={filter} q={q} />
      <form className="mb-1" method="get" action="/admin/accounts" role="search">
        <input type="hidden" name="tab" value="users" />
        {filter !== 'all' ? <input type="hidden" name="filter" value={filter} /> : null}
        <label className="relative block">
          <span className="sr-only">Search name, email or ID</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--m-slate-2)]"
            strokeWidth={1.75}
          />
          <input
            name="q"
            defaultValue={q}
            placeholder={filter === 'blacklisted' ? 'Search blocked emails' : 'Search name, email or ID'}
            className="input-field min-h-12 pl-9"
          />
        </label>
      </form>

      {/* The raw-message error banner is GONE. It said the true thing and then
          the table said "No users match." underneath it — one event, two
          voices, and the calm one wins. The table owns the refusal now, names
          what could not be read, and states in words that this is not a count
          of zero. */}

      {filter === 'blacklisted' ? (
        <BlacklistTable rows={blacklistRows} readError={readError} />
      ) : (
        <UsersTable
          rows={userRows}
          readError={readError}
          q={q}
          filter={filter}
          expandUserId={expandUserId}
          expandedGrants={expandedGrants}
          services={compGrantServices}
          pendingTeamGrants={pendingTeamGrants}
        />
      )}
      <MiniTour tourKey="admin_users_v1" />
    </div>
  );
}

// Build the canonical query-string for a row's expand/collapse toggle.
// Preserves q + filter so the panel can toggle without losing search context.
// Targets the /admin/accounts?tab=users studio route (Accounts Studio slice 1).
function buildToggleHref(opts: {
  q: string;
  filter: Filter;
  expandUserId: string | null;
  rowUserId: string;
}): string {
  const params = new URLSearchParams();
  params.set('tab', 'users');
  if (opts.q) params.set('q', opts.q);
  if (opts.filter !== 'all') params.set('filter', opts.filter);
  // Toggle: if this row is already expanded, drop the param; otherwise set it.
  if (opts.expandUserId !== opts.rowUserId) {
    params.set('expand', opts.rowUserId);
  }
  const qs = params.toString();
  return `/admin/accounts?${qs}#u-${opts.rowUserId}`;
}

/** Couple · Supplier · Admin — the word rule (template rule 14): say supplier, never "VENDOR". */
function kindWord(t: UserRow['account_type']): string {
  return t === 'customer' ? 'Couple' : t === 'vendor' ? 'Supplier' : 'Admin';
}

/** "14 Nov" — and the year only when it is not this year, so an old account never reads as a new one. */
function joinedWords(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear();
  return d.toLocaleDateString('en-PH', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'Asia/Manila',
  });
}

/** "GC" for Golden Catering; the email's first letters when there is no name. */
function initialsFor(u: UserRow): string {
  const src = (u.display_name ?? u.email ?? '?').replace(/@.*/, '');
  const words = src.split(/[\s._-]+/).filter(Boolean);
  return (words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?').slice(0, 2);
}

/** The ONE chip a row carries — On hold wins, then Internal, then Team (frame "Everything kept"). */
function personChip(u: UserRow): ReactNode {
  if (u.suspended_at) return <Badge tone="wait">On hold</Badge>;
  if (u.is_internal) return <Badge tone="quiet">Internal</Badge>;
  if (u.is_team_member) return <Badge tone="ok">Team</Badge>;
  return null;
}

/** A row of the ⋯ list — the template's 56 row: the whole row is the button. */
const MENU_ROW =
  'sn-press flex min-h-14 w-full items-center gap-3 border-t border-[color:var(--m-line)] py-2 text-left text-[15px] font-semibold text-ink disabled:opacity-60';

/**
 * The ⋯ list for one person (frame "After · ⋯ opened"): every action of today's row in plain words, the everyday ones
 * first, then the three that cannot be undone under their own red label — each one still behind the SAME
 * `ConfirmForm`, title and message as before. Server-rendered: the forms post the same server actions.
 */
function PersonActions({
  u,
  waiting,
  grantsHref,
  grantsOpen,
}: {
  u: UserRow;
  waiting: boolean;
  grantsHref: string;
  grantsOpen: boolean;
}) {
  const go = <ChevronRight aria-hidden className="ml-auto h-4 w-4 flex-none text-mulberry" strokeWidth={2.2} />;
  return (
    <div className="[&>*:first-child]:border-t-0">
      <Link href={`/admin/users/${u.user_id}`} className={MENU_ROW}>
        Open account {go}
      </Link>
      {u.is_internal ? (
        <p className={`flex min-h-14 items-center border-t border-[color:var(--m-line)] py-2 ${TEMPLATE_SUBLINE}`}>
          Locked (internal) — no actions here.
        </p>
      ) : (
        <>
          {waiting ? (
            <Link href="/admin/approvals" className={MENU_ROW}>
              Team · waiting on 2nd admin {go}
            </Link>
          ) : (
            <form action={toggleTeamMember}>
              <input type="hidden" name="user_id" value={u.user_id} />
              <input type="hidden" name="desired" value={u.is_team_member ? 'false' : 'true'} />
              <SubmitButton className={MENU_ROW} pendingLabel="…">
                <Sparkle aria-hidden className="h-4 w-4 flex-none" strokeWidth={2} />
                {u.is_team_member ? 'Remove from team' : 'Add to team'}
              </SubmitButton>
            </form>
          )}
          <form action={confirmUserEmail}>
            <input type="hidden" name="user_id" value={u.user_id} />
            <SubmitButton
              title="Force-confirm this user's email (idempotent — useful when Supabase email doesn't arrive)"
              className={MENU_ROW}
              pendingLabel="…"
            >
              <MailCheck aria-hidden className="h-4 w-4 flex-none" strokeWidth={2} />
              Confirm email
            </SubmitButton>
          </form>
          <form action={resetUserPassword}>
            <input type="hidden" name="user_id" value={u.user_id} />
            <SubmitButton
              title="Generate a temporary password to share with this user. Shown once at the top of the page."
              className={MENU_ROW}
              pendingLabel="Generating…"
            >
              <KeyRound aria-hidden className="h-4 w-4 flex-none" strokeWidth={2} />
              Reset password
            </SubmitButton>
          </form>
          <Link
            href={grantsHref}
            className={MENU_ROW}
            aria-expanded={grantsOpen}
            aria-controls={`grants-${u.user_id}`}
          >
            <Gift aria-hidden className="h-4 w-4 flex-none" strokeWidth={2} />
            {grantsOpen ? 'Hide comp grants' : 'Comp grants'} {go}
          </Link>

          <p
            className="mt-[18px] pb-1 text-[11.5px] font-bold uppercase tracking-[0.1em]"
            style={{ color: 'rgb(var(--color-danger))' }}
          >
            Danger · each asks you first
          </p>
          <ConfirmForm
            action={forceSignOutUser}
            title="Revoke all sessions?"
            confirmLabel="Sign out everywhere"
            message={`Force sign-out ${u.email ?? 'this user'}? They are signed out on EVERY device immediately — use for compromised accounts. Their data is untouched; they can log back in.`}
          >
            <input type="hidden" name="user_id" value={u.user_id} />
            <SubmitButton
              title="Revoke every session for this user (compromised-account remedy). Audit-logged."
              className={`${MENU_ROW} border-t-0`}
              style={{ color: 'rgb(var(--color-danger))' }}
              pendingLabel="Signing out…"
            >
              <LogOut aria-hidden className="h-4 w-4 flex-none" strokeWidth={2} />
              Sign out everywhere
            </SubmitButton>
          </ConfirmForm>
          <ConfirmForm
            action={deleteUser}
            title="Hard-delete this account?"
            confirmLabel="Delete permanently"
            message={`Hard-delete ${u.email ?? 'this user'}? Their auth identity is gone; all related data cascade-deletes; the EMAIL is freed for re-signup (e.g., switching from supplier to customer). Not reversible from this page.`}
          >
            <input type="hidden" name="user_id" value={u.user_id} />
            <SubmitButton
              title="Delete the user. The email is freed for re-signup."
              className={MENU_ROW}
              style={{ color: 'rgb(var(--color-danger))' }}
              pendingLabel="Deleting…"
            >
              <Trash2 aria-hidden className="h-4 w-4 flex-none" strokeWidth={2} />
              Delete account
            </SubmitButton>
          </ConfirmForm>
          <ConfirmForm
            action={blacklistUser}
            title="Blacklist this email?"
            confirmLabel="Blacklist & delete"
            message={`Blacklist ${u.email ?? 'this user'}? The user is hard-deleted AND the email is permanently blocked from signing up again. Reverse via the Blacklisted filter → Unblacklist.`}
          >
            <input type="hidden" name="user_id" value={u.user_id} />
            <SubmitButton
              title="Delete the user AND permanently block this email from re-registering."
              className={MENU_ROW}
              style={{ color: 'rgb(var(--color-danger))' }}
              pendingLabel="…"
            >
              <Ban aria-hidden className="h-4 w-4 flex-none" strokeWidth={2} />
              Delete and block this email
            </SubmitButton>
          </ConfirmForm>
        </>
      )}
    </div>
  );
}

function UsersTable({
  rows,
  readError,
  q,
  filter,
  expandUserId,
  expandedGrants,
  services,
  pendingTeamGrants,
}: {
  rows: UserRow[] | null;
  readError: { message?: string } | null;
  q: string;
  filter: Filter;
  expandUserId: string | null;
  expandedGrants: CompGrantRow[] | null;
  services: ServiceOption[] | null;
  pendingTeamGrants: Set<string> | null;
}) {
  // The one expanded user, resolved BEFORE the list renders — the grants panel is a sibling of the list.
  const expanded = (rows ?? []).find((u) => u.user_id === expandUserId) ?? null;
  // 🪤 A refused read is never "no accounts" (T28/T29): the amber line names it, and the refusal's own words go to
  // the log, never to the screen. `rows === null` with no error is NOT MEASURED, which is the same answer.
  const unread = Boolean(readError) || rows === null;
  if (readError) logQueryError('admin/accounts (the account list)', readError);
  const list = rows ?? [];
  const capped = list.length >= ACCOUNT_ROW_LIMIT;

  return (
    <>
      <TemplateSection label={q ? 'Matching · newest first' : 'Newest first'} first data="people">
        {unread ? (
          <TemplateFail retryHref="/admin/accounts?tab=users" data="people">
            Couldn&rsquo;t read the account list &mdash; not the same as nobody signed up.
          </TemplateFail>
        ) : list.length === 0 ? (
          <TemplateEmpty data="people">
            {q ? 'No account matches that search.' : 'No accounts in this filter.'}
          </TemplateEmpty>
        ) : (
          <>
            {/* 1280 column heads — the frame's "Name · Kind · Joined"; a phone carries the same facts in the grey line. */}
            <div
              aria-hidden
              className="hidden items-center gap-2.5 pb-1 pl-[50px] pr-[52px] text-[12px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)] md:flex"
            >
              <span className="flex-1">Name</span>
              <span className="w-24">Kind</span>
              <span className="w-24">Joined</span>
              <span className="w-[84px]" />
            </div>
            <TemplateRows label="People">
              {list.map((u) => {
                const name = u.display_name?.trim() || u.email || 'No name';
                const waiting = !u.is_team_member && !u.is_internal && Boolean(pendingTeamGrants?.has(u.user_id));
                const held = u.suspended_at
                  ? u.suspended_until
                    ? `on hold until ${holdDateWords(u.suspended_until)}`
                    : 'on hold until lifted'
                  : null;
                const phoneLine = [
                  kindWord(u.account_type),
                  held ?? `joined ${joinedWords(u.created_at)}`,
                  waiting ? 'team · waiting on 2nd admin' : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                const wideLine = [u.email ?? '—', held, waiting ? 'team · waiting on 2nd admin' : null]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <TemplateRow
                    key={u.user_id}
                    data={u.user_id}
                    edge={u.suspended_at ? 'due' : undefined}
                    lead={
                      // The `#u-<id>` anchor buildToggleHref points at lives here.
                      <span
                        id={`u-${u.user_id}`}
                        aria-hidden
                        className="sn-initials grid h-10 w-10 place-items-center rounded-full text-[13px] font-semibold"
                      >
                        {initialsFor(u)}
                      </span>
                    }
                    title={name}
                    line={
                      <>
                        <span className="md:hidden">{phoneLine}</span>
                        <span className="hidden md:inline">{wideLine}</span>
                      </>
                    }
                    right={
                      <>
                        <span className="hidden w-24 text-[14px] text-ink md:inline">{kindWord(u.account_type)}</span>
                        <span className="hidden w-24 text-[14px] tabular-nums text-ink md:inline">
                          {joinedWords(u.created_at)}
                        </span>
                        <span className="flex justify-end md:w-[84px]">{personChip(u)}</span>
                        <PersonMore name={name} head={`${kindWord(u.account_type)} · ${u.email ?? '—'} · ${u.public_id}`}>
                          <PersonActions
                            u={u}
                            waiting={waiting}
                            grantsHref={buildToggleHref({ q, filter, expandUserId, rowUserId: u.user_id })}
                            grantsOpen={expandUserId === u.user_id}
                          />
                        </PersonMore>
                      </>
                    }
                  />
                );
              })}
            </TemplateRows>
            {capped ? (
              <p className={`py-2 ${TEMPLATE_SUBLINE}`}>
                Showing the first {ACCOUNT_ROW_LIMIT.toLocaleString()}. There are more — this is not the whole list.
              </p>
            ) : null}
          </>
        )}
      </TemplateSection>

      {/* The comp-grants panel — a SIBLING of the list. It keeps the `grants-<id>` id the ⋯ list's Comp grants row
          points at, and only one account can be expanded at a time, so there is only ever one. */}
      {expanded && !expanded.is_internal ? (
        <section
          id={`grants-${expanded.user_id}`}
          className="mt-4 rounded-xl border border-terracotta/15 bg-white/70 px-4 py-5"
        >
          <CompGrantsPanel
            userId={expanded.user_id}
            userEmail={expanded.email}
            grants={expandedGrants}
            services={services}
          />
        </section>
      ) : null}

      {expanded && expanded.is_internal ? (
        <section
          id={`grants-${expanded.user_id}`}
          className="mt-4 rounded-xl border border-[color:var(--sn-info)]/30 bg-[var(--sn-info-soft)] px-4 py-4"
        >
          <p className="text-sm text-[color:var(--sn-info)]">
            This is an internal account (§ 10a) — it already carries a permanent
            grant for every Setnayan service. Per-SKU comps are not allowed on
            top.
          </p>
        </section>
      ) : null}
    </>
  );
}

function BlacklistTable({
  rows,
  readError,
}: {
  rows: BlacklistRow[] | null;
  readError: { message?: string } | null;
}) {
  return (
    <ConsoleTable
      rows={rows}
      readPermitted
      readError={readError}
      reads="the blocked-email list"
      cap={ACCOUNT_ROW_LIMIT}
      label="Blacklisted emails"
      minWidth="36rem"
      rowKey={(b) => b.id}
      empty={{
        Icon: Ban,
        // ⚖ THIS EMPTY STATE MATTERS MORE THAN IT LOOKS. It is a security list;
        // "nothing is blocked" and "we could not read what is blocked" are
        // opposite operational facts, and before this they were the same
        // sentence. The verified note is what says which one you are reading.
        title: 'No blocked emails',
        blurb:
          'Nothing is on the blacklist. Blacklisting happens from the account list — it deletes the account and permanently blocks the address from signing up again.',
      }}
      columns={[
        {
          header: 'Email',
          cell: (b) => <span className="font-medium text-ink">{b.email}</span>,
        },
        {
          header: 'Reason',
          cell: (b) => <span className="text-ink/70">{b.reason ?? '—'}</span>,
        },
        {
          header: 'Blacklisted',
          hideBelow: 'md',
          mono: true,
          cell: (b) => (
            <span className="text-ink/70">{b.blacklisted_at.slice(0, 10)}</span>
          ),
        },
        {
          header: 'Actions',
          align: 'right',
          cell: (b) => (
            <ConfirmForm
              action={unblacklistEmail}
              title="Allow signup again?"
              confirmLabel="Unblacklist"
              destructive={false}
              message={`Remove ${b.email} from the blacklist? This email will be able to sign up again.`}
            >
              <input type="hidden" name="blacklist_id" value={b.id} />
              <SubmitButton
                className="inline-flex items-center gap-1 rounded-md bg-success-100 px-2 py-1 text-xs font-medium text-success-900 hover:bg-success-200 disabled:opacity-60"
                pendingLabel="…"
              >
                <Undo2 className="h-3 w-3" strokeWidth={2} />
                Unblacklist
              </SubmitButton>
            </ConfirmForm>
          ),
        },
      ]}
    />
  );
}

/**
 * Comp grants panel — renders inline below the target user row.
 *
 * Layout split into two columns at md+: existing grants list (left) +
 * issue form (right). On mobile they stack. The form is a plain
 * <form action={issueCompGrant}> so server-action validation errors
 * bubble through Next's built-in error UI.
 */
function CompGrantsPanel({
  userId,
  userEmail,
  grants,
  services,
}: {
  userId: string;
  userEmail: string | null;
  /** null = the grants fetch failed. NOT the same as "this account has none". */
  grants: CompGrantRow[] | null;
  /** null = the catalog fetch failed. NOT the same as "there are no SKUs". */
  services: ServiceOption[] | null;
}) {
  const grouped = (services ?? []).reduce<Map<string, ServiceOption[]>>((acc, s) => {
    const list = acc.get(s.category) ?? [];
    list.push(s);
    acc.set(s.category, list);
    return acc;
  }, new Map());
  const active = (grants ?? []).filter((g) => g.revoked_at === null);
  const revoked = (grants ?? []).filter((g) => g.revoked_at !== null);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">
          Comp grants for {userEmail ?? 'this user'}
        </h3>
        {grants === null ? (
          <p
            role="alert"
            className="rounded-lg border border-danger-300/60 bg-danger-50/60 px-4 py-4 text-sm text-danger-900"
          >
            <strong>Couldn&apos;t read this account&apos;s comp grants.</strong>{' '}
            This is not a statement that it has none — it may already hold an
            active grant for the very thing you are about to gift. Reload before
            issuing anything.
          </p>
        ) : grants.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink/15 px-4 py-6 text-sm text-ink/70">
            No comp grants on this account yet. Issue one with the form
            on the right to gift a service.
          </p>
        ) : (
          <ul className="space-y-2">
            {active.map((g) => (
              <GrantCard key={g.grant_id} grant={g} revoked={false} />
            ))}
            {revoked.length > 0 ? (
              <>
                <p className="pt-3 text-[11px] uppercase tracking-[0.15em] text-ink/45">
                  Revoked
                </p>
                {revoked.map((g) => (
                  <GrantCard key={g.grant_id} grant={g} revoked={true} />
                ))}
              </>
            ) : null}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">Issue a comp grant</h3>
        <form action={issueCompGrant} className="space-y-3 rounded-xl border border-ink/10 bg-white p-4">
          <input type="hidden" name="user_id" value={userId} />
          <div>
            <label
              htmlFor={`scope-${userId}`}
              className="mb-1 block text-xs font-medium text-ink/70"
            >
              Scope
            </label>
            <select
              id={`scope-${userId}`}
              name="scope"
              required
              defaultValue="specific_skus"
              className="input-field"
            >
              <option value="specific_skus">Specific services</option>
              <option value="all_services">Every Setnayan service</option>
            </select>
            <p className="mt-1 text-xs text-ink/55">
              &ldquo;Every service&rdquo; is broad — usually reserved for goodwill remediation.
            </p>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-ink/70">
              Services (only when scope is specific services)
            </p>
            {services === null ? (
              <p className="rounded-md border border-danger-300/60 bg-danger-50/60 px-3 py-2 text-xs text-danger-900">
                The service catalog could not be read, so there is nothing to tick
                here. That is a failed read, <strong>not</strong> an empty
                catalog — issuing a specific-services grant now would scope it to
                nothing.
              </p>
            ) : grouped.size === 0 ? (
              <p className="text-xs text-ink/70">No catalog SKUs found.</p>
            ) : (
              <div className="max-h-56 space-y-4 overflow-y-auto rounded-lg border border-ink/10 bg-white p-3">
                {Array.from(grouped.entries()).map(([category, skus]) => (
                  <div key={category}>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                      {category}
                    </p>
                    <div className="space-y-1.5">
                      {skus.map((s) => (
                        <label
                          key={s.sku_code}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-ink/[0.03]"
                        >
                          <input
                            type="checkbox"
                            name="scoped_skus"
                            value={s.sku_code}
                            className="h-3.5 w-3.5 accent-terracotta-600"
                          />
                          <span className="flex-1 text-ink">{s.display_name}</span>
                          <span className="font-mono text-[10px] text-ink/40">
                            {s.sku_code}
                          </span>
                          <span className="text-ink/55">
                            ₱{(s.price_centavos / 100).toLocaleString()}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={`retail-${userId}`}
                className="mb-1 block text-xs font-medium text-ink/70"
              >
                Retail value (₱)
              </label>
              <input
                id={`retail-${userId}`}
                name="retail_value_php"
                type="number"
                min="0"
                step="1"
                placeholder="2499"
                className="input-field"
              />
              <p className="mt-1 text-xs text-ink/55">
                Optional but recommended for audit. Grants over ₱{formatCount(COMP_GRANT_CO_REVIEW_PESOS)} get
                flagged for co-approval.
              </p>
            </div>
            <div>
              <label
                htmlFor={`expiry-${userId}`}
                className="mb-1 block text-xs font-medium text-ink/70"
              >
                Expires
              </label>
              <input
                id={`expiry-${userId}`}
                name="expiry_at"
                type="datetime-local"
                className="input-field"
              />
              <p className="mt-1 text-xs text-ink/55">
                Leave blank to grant lifetime access.
              </p>
            </div>
          </div>
          <div>
            <label
              htmlFor={`rationale-${userId}`}
              className="mb-1 block text-xs font-medium text-ink/70"
            >
              Rationale (min 20 characters)
            </label>
            <textarea
              id={`rationale-${userId}`}
              name="rationale"
              rows={3}
              required
              minLength={20}
              placeholder="Couple was bound to wrong test event during pilot · gifting Animated Monogram as remediation."
              className="input-field"
            />
            <p className="mt-1 text-xs text-ink/55">
              Audit-grade · shows up in the admin activity record so any
              future review can see why the comp landed.
            </p>
          </div>
          <SubmitButton
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-mulberry px-3 py-1.5 text-sm font-medium text-cream hover:bg-mulberry-700 disabled:opacity-60"
            pendingLabel="Issuing…"
          >
            <Gift className="h-3.5 w-3.5" strokeWidth={2} />
            Issue comp grant
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

/**
 * Render a single comp_grants row as a compact card. Active grants get
 * a Revoke form (with required reason); revoked grants just render
 * their state.
 */
function GrantCard({ grant, revoked }: { grant: CompGrantRow; revoked: boolean }) {
  return (
    <li
      className={`rounded-lg border px-3 py-2.5 ${
        revoked
          ? 'border-ink/10 bg-ink/[0.02] text-ink/60'
          : 'border-success-200/70 bg-success-50/50'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink/60">
            {grant.public_id}
          </p>
          <p className="text-sm font-medium text-ink">
            {describeScope(grant.scope, grant.scoped_skus)}
          </p>
          {/* Reach, never omitted — an event-scoped comp and an account-wide
              one printed identically here until 2026-09-06. */}
          <p className="text-xs font-medium text-ink/70">
            <span className="text-ink/45">Applies to:</span> {describeReach(grant)}
          </p>
          <p className="text-xs text-ink/60">
            {describeSource(grant.source)} ·{' '}
            {formatRetailValueCentavos(grant.retail_value_centavos)} retail value
          </p>
          {grant.scope === 'specific_skus' && grant.scoped_skus ? (
            <p className="font-mono text-[11px] text-ink/55">
              {grant.scoped_skus.join(', ')}
            </p>
          ) : null}
          {grant.rationale ? (
            <p className="text-xs text-ink/70">
              <span className="text-ink/45">Why:</span> {grant.rationale}
            </p>
          ) : null}
          <p className="text-[11px] text-ink/45">
            Issued {grant.created_at.slice(0, 10)}
            {grant.expiry ? ` · expires ${grant.expiry.slice(0, 10)}` : ' · no expiry'}
            {revoked && grant.revoked_at
              ? ` · revoked ${grant.revoked_at.slice(0, 10)}`
              : null}
          </p>
        </div>
        {!revoked ? (
          <ConfirmForm
            action={revokeCompGrant}
            title="Revoke this grant?"
            confirmLabel="Revoke"
            message={`Revoke comp grant ${grant.public_id}? This stops future uses but doesn't refund any order that's already used it. Reason is required.`}
            className="shrink-0"
          >
            <input type="hidden" name="grant_id" value={grant.grant_id} />
            <input
              type="hidden"
              name="reason"
              value="Revoked from admin/users panel"
            />
            <SubmitButton
              title="Revoke this grant. The audit log captures it."
              className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-1 text-xs font-medium text-ink/70 hover:bg-danger-100 hover:text-danger-900 disabled:opacity-60"
              pendingLabel="…"
            >
              <XCircle className="h-3 w-3" strokeWidth={2} />
              Revoke
            </SubmitButton>
          </ConfirmForm>
        ) : null}
      </div>
    </li>
  );
}
