import Link from 'next/link';
import { Send } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ReadFailed } from '@/app/admin/_components/read-failed';
import { PostedFieldRow } from '@/app/admin/_components/posted-field-row';
import { ADMIN_FRAME } from '@/app/admin/_components/admin-frame';
import { LinkPickMenu } from '@/app/_components/link-pick-menu';
import { ActionButton } from '@/components/action-button';
import {
  TEMPLATE_MONEY,
  TEMPLATE_SUBLINE,
  TemplateEmpty,
  TemplateRows,
  TemplateSection,
} from '@/app/_components/template-rows';
import { formatCount } from '@/lib/format-number';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { requireAdmin } from '@/lib/admin/require-admin';
import { EVENT_PLANS } from '@/lib/features-page';
import { TIER_CAPS, VENDOR_TIERS, type VendorTier } from '@/lib/vendor-tier-caps';
import {
  EDITABLE_PLAN_KEYS,
  codeValue,
  planValueWords,
  planWords,
  type PlanContentRow,
} from '@/lib/vendor-plan-contents';
import { requestPlanContentsChange } from '@/app/admin/pricing/plan-contents-actions';

/**
 * CATALOGUE › PLAN CONTENTS — what each supplier and event plan includes.
 *
 * ⚖ Owner 2026-11-13, verbatim "Yes, add both" (specs DECISION_LOG "ADMIN GAINS ACCOUNT SUSPEND + EDITABLE PLAN
 * CONTENTS"). PORTED from the approved prototype `prototypes/admin_pub/catalogue.html` › Plan contents (`plan-pick`,
 * `cfm-cap`), not redrawn: one plan at a time behind a picker, each allowance a row with its value, a change asked for
 * in place, and the change history under it.
 *
 * 🔑 EVERY VALUE IS READ, NONE TYPED HERE: supplier allowances from `vendor_plan_contents` (seeded from TIER_CAPS,
 * which is the fallback), event-plan credits from `platform_retail_catalog_v2.included_papic_credits`, event-plan lines
 * from `EVENT_PLANS` (lib/features-page.ts). A failed read says so and offers no edit.
 *
 * ⛔ Only allowances whose readers follow the table can be edited (lib/vendor-plan-contents.ts). The rest of a plan
 * is listed read-only with where it lives, so nobody edits a number that changes nothing.
 */

type Props = {
  searchParams: Promise<{ plan?: string; saved?: string; error?: string }>;
};

type View = VendorTier | 'ev-free' | 'ev-plus' | 'ev-pro';
const EVENT_VIEWS = ['ev-free', 'ev-plus', 'ev-pro'] as const;

function coerceView(v: string | undefined): View {
  if ((VENDOR_TIERS as readonly string[]).includes(v ?? '')) return v as VendorTier;
  if ((EVENT_VIEWS as readonly string[]).includes(v ?? '')) return v as View;
  return 'pro';
}

/** Read-only allowances: what else a supplier plan includes, from TIER_CAPS, with the words a person reads. */
function readOnlyLines(plan: VendorTier): [string, string][] {
  const c = TIER_CAPS[plan];
  const yes = (b: boolean) => (b ? 'Included' : 'Not included');
  return [
    // ⛔ No "Service area" row: reach is not a plan allowance since 2026-11-19 (owner, "unlock the range. not plan
    // dependend anymore") — unverified 0 km, verified sets its own, on every plan.
    ['Free portfolio photos', planValueWords(Number.isFinite(c.portfolioPhotos) ? c.portfolioPhotos : null)],
    ['Search visibility', c.seoLevel],
    ['Own web address', yes(c.customWebsiteName)],
    ['Market insights', yes(c.marketIntel)],
    ['Performance trends', yes(c.performanceTrends)],
    ['Uploads on forms', yes(c.formMediaUploads)],
    ['Video links on forms', yes(c.formVideoLinks)],
  ];
}

export async function PlanContentsSurface({ searchParams }: Props) {
  await requireAdmin();
  const { plan: planRaw, saved, error } = await searchParams;
  const view = coerceView(planRaw);
  const admin = createAdminClient();

  return (
    <div>
      <PageMasthead title="Plan contents" />
      {/* 📐 Clean port (19 Nov): the lede went behind the ⓘ; the two rows of plan chips are ONE ▾ dropdown, grouped
          the same way and still a page address per plan (so the page stays server-rendered). */}
      <TemplateSection
        first
        label="Which plan"
        tip={
          <>
            What each plan includes. A change is asked here and confirmed by a second admin in Approvals, the same as
            a price. Lowering a number never takes anything from a shop: shops over it keep what they have and can&rsquo;t
            add more.
          </>
        }
      >
        <nav aria-label="Which plan" className="py-1">
          <LinkPickMenu
            label="Which plan"
            value={view}
            dataAttr="plan-contents-plan"
            options={[
              { group: 'Supplier plans', items: VENDOR_TIERS.map((t) => ({ key: t as View, label: planWords(t) })) },
              {
                group: 'Event plans',
                items: [
                  { key: 'ev-free' as View, label: 'Free' },
                  { key: 'ev-plus' as View, label: 'Event Plus' },
                  { key: 'ev-pro' as View, label: 'Event Pro' },
                ],
              },
            ].flatMap((g) =>
              g.items.map((it) => ({
                key: it.key,
                label: it.label,
                group: g.group,
                href: `/admin/pricing?tab=plan-contents&plan=${it.key}`,
              })),
            )}
          />
        </nav>
      </TemplateSection>

      {saved ? (
        <p role="status" className="mt-3 text-sm" style={{ color: 'rgb(var(--color-ok))' }}>
          {saved}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm" style={{ color: 'rgb(var(--color-warn))' }}>
          {error}
        </p>
      ) : null}

      {(EVENT_VIEWS as readonly string[]).includes(view) ? (
        <EventPlan view={view as (typeof EVENT_VIEWS)[number]} admin={admin} />
      ) : (
        <SupplierPlan plan={view as VendorTier} admin={admin} />
      )}
    </div>
  );
}

async function SupplierPlan({ plan, admin }: { plan: VendorTier; admin: ReturnType<typeof createAdminClient> }) {
  const [rowsRes, histRes, pendingRes, shopsRes] = await Promise.all([
    admin.from('vendor_plan_contents').select('plan, key, value').eq('plan', plan),
    admin
      .from('vendor_plan_content_changes')
      .select('change_id, key, old_value, new_value, changed_at')
      .eq('plan', plan)
      .order('changed_at', { ascending: false })
      .limit(20),
    admin
      .from('admin_approval_requests')
      .select('target_id, rationale')
      .eq('action_type', 'approve_plan_contents_change')
      .eq('status', 'pending')
      .like('target_id', `${plan}:%`),
    admin.from('vendor_profiles').select('vendor_profile_id', { count: 'exact', head: true }).eq('tier_state', plan),
  ]);
  if (rowsRes.error) logQueryError('PlanContents (rows)', rowsRes.error);
  if (histRes.error) logQueryError('PlanContents (history)', histRes.error);
  if (pendingRes.error) logQueryError('PlanContents (pending)', pendingRes.error);
  if (shopsRes.error) logQueryError('PlanContents (shops)', shopsRes.error);

  const rows = (rowsRes.data ?? []) as PlanContentRow[];
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const pending = new Map(
    ((pendingRes.data ?? []) as { target_id: string; rationale: string | null }[]).map((p) => [
      p.target_id.split(':')[1] ?? '',
      p.rationale ?? '',
    ]),
  );
  const labelOf = new Map(EDITABLE_PLAN_KEYS.map((d) => [d.key, d.label]));

  return (
    <>
      <TemplateSection
        label={`What ${planWords(plan)} includes`}
        tip="Seeded from the code values (TIER_CAPS); the code value is used if a row is missing."
        right={shopsRes.error ? 'Shops on this plan: couldn’t count.' : `Shops on this plan: ${shopsRes.count ?? 0}.`}
      >
        {rowsRes.error ? (
          <ReadFailed what="the plan table — editing stays off until it reads" />
        ) : (
          <TemplateRows label={`What ${planWords(plan)} includes`}>
            {EDITABLE_PLAN_KEYS.map((def) => {
              const stored = byKey.has(def.key) ? (byKey.get(def.key) ?? null) : codeValue(plan, def.capKey);
              const code = codeValue(plan, def.capKey);
              const waiting = pending.get(def.key);
              return (
                <li key={def.key} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{def.label}</span>
                    <span className={`text-sm ${TEMPLATE_MONEY}`}>{planValueWords(stored)}</span>
                  </div>
                  <p className={`mt-0.5 ${TEMPLATE_SUBLINE}`}>
                    Read by {def.readBy}.{stored !== code ? ` Code value: ${planValueWords(code)}.` : ''}
                  </p>
                  {waiting ? (
                    <p className="mt-2 rounded-md bg-ink/[0.04] px-2 py-1 text-xs text-ink/70">
                      Waiting in Approvals: {waiting}
                    </p>
                  ) : (
                    <form action={requestPlanContentsChange} className="mt-2 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="kind" value="supplier" />
                      <input type="hidden" name="plan" value={plan} />
                      <input type="hidden" name="key" value={def.key} />
                      <div className="min-w-[14rem] flex-1">
                        <PostedFieldRow
                          name={`New number · ${def.label}`}
                          empty={stored === null ? 'No limit' : String(stored)}
                          fieldName="value"
                          inputMode="numeric"
                          maxLength={6}
                        />
                      </div>
                      {def.noLimitAllowed ? (
                        <label className="flex items-center gap-1.5 text-xs text-ink/70">
                          <input type="checkbox" name="no_limit" /> No limit
                        </label>
                      ) : null}
                      <ActionButton tone="neutral" type="submit" icon={<Send aria-hidden strokeWidth={1.9} />} label="Ask to change" />
                    </form>
                  )}
                </li>
              );
            })}
          </TemplateRows>
        )}
      </TemplateSection>

      <TemplateSection
        label={`Also in ${planWords(plan)}`}
        tip={
          <>
            Set in code today (lib/vendor-tier-caps.ts). Not editable here yet, because the screens that print them do not
            read the plan table.
          </>
        }
      >
        <dl className={`${ADMIN_FRAME} grid grid-cols-1 gap-x-4 gap-y-2 p-4 text-sm sm:grid-cols-2`}>
          {readOnlyLines(plan).map(([l, v]) => (
            <div key={l} className="flex justify-between gap-2">
              <dt className="text-ink/60">{l}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </TemplateSection>

      <TemplateSection label="Change history">
        {histRes.error ? (
          <ReadFailed what="the change history" />
        ) : (histRes.data ?? []).length === 0 ? (
          <TemplateEmpty>
            No change recorded for {planWords(plan)} since this screen opened — every earlier change was a code release.
          </TemplateEmpty>
        ) : (
          <TemplateRows label="Change history">
            {(
              (histRes.data ?? []) as {
                change_id: number;
                key: string;
                old_value: number | null;
                new_value: number | null;
                changed_at: string;
              }[]
            ).map((h) => (
              <li key={h.change_id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span className="text-ink">
                  {labelOf.get(h.key) ?? h.key}: {planValueWords(h.old_value)} → {planValueWords(h.new_value)}
                </span>
                <span className="text-xs text-ink/55">{h.changed_at.slice(0, 10)}</span>
              </li>
            ))}
          </TemplateRows>
        )}
      </TemplateSection>
    </>
  );
}

async function EventPlan({
  view,
  admin,
}: {
  view: (typeof EVENT_VIEWS)[number];
  admin: ReturnType<typeof createAdminClient>;
}) {
  const column = EVENT_PLANS[view === 'ev-free' ? 0 : view === 'ev-plus' ? 1 : 2]!;
  const code = view === 'ev-plus' ? 'EVENT_PLUS' : view === 'ev-pro' ? 'COUPLE_WEBSITE_PRO' : null;

  const catalogRes = code
    ? await admin
        .from('platform_retail_catalog_v2')
        .select('title, retail_price_php, included_papic_credits')
        .eq('service_code', code)
        .maybeSingle()
    : null;
  if (catalogRes?.error) logQueryError('PlanContents (event catalogue)', catalogRes.error);
  const poolRes =
    view === 'ev-free'
      ? await admin.from('papic_event_pool_config').select('free_grant_points').eq('config_key', 'default').maybeSingle()
      : null;
  if (poolRes?.error) logQueryError('PlanContents (free grant)', poolRes.error);

  const row = catalogRes?.data as
    | { title: string | null; retail_price_php: number | string; included_papic_credits: number | null }
    | null
    | undefined;
  const pendingRes = code
    ? await admin
        .from('admin_approval_requests')
        .select('rationale')
        .eq('action_type', 'approve_plan_contents_change')
        .eq('status', 'pending')
        .eq('target_id', `event:${code}:included_papic_credits`)
        .maybeSingle()
    : null;

  return (
    <>
      <TemplateSection
        label={`What ${column.name} includes`}
        tip={
          <>
            {column.tag} The lines are the Plans page&rsquo;s own (lib/features-page.ts EVENT_PLANS); events that already
            bought a plan keep what they got. The other event-plan lines are copy on the Plans page, not settings — no
            number is held for them, so there is nothing to edit here.
          </>
        }
      >
      <div className={`${ADMIN_FRAME} p-4`}>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-ink">
          {column.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>

        {view === 'ev-free' ? (
          poolRes?.error ? (
            <ReadFailed what="the free Papic grant" />
          ) : (
            <div className="text-sm text-ink">
              Free Papic credits on every event:{' '}
              <span className={TEMPLATE_MONEY}>
                {(() => {
                  const n = (poolRes?.data as { free_grant_points?: number } | null)?.free_grant_points;
                  return typeof n === 'number' ? formatCount(n) : '—';
                })()}
              </span>{' '}
              <Link href="/admin/pricing?tab=papic-shots" className="text-xs underline">
                edited on Papic shot prices
              </Link>
            </div>
          )
        ) : catalogRes?.error || !row ? (
          <ReadFailed what="this plan’s catalogue row — editing stays off until it reads" />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink">
              Price:{' '}
              <span className={TEMPLATE_MONEY}>₱{Number(row.retail_price_php).toLocaleString('en-PH')}</span>{' '}
              <Link href="/admin/pricing?tab=pricing" className="text-xs underline">
                its own row on Pricing
              </Link>
            </p>
            <div>
              <p className="text-sm text-ink">
                Papic credits included:{' '}
                <span className={TEMPLATE_MONEY}>
                  {row.included_papic_credits === null ? 'None' : formatCount(Number(row.included_papic_credits))}
                </span>
              </p>
              {pendingRes?.data ? (
                <p className="mt-2 rounded-md bg-ink/[0.04] px-2 py-1 text-xs text-ink/70">
                  Waiting in Approvals: {(pendingRes.data as { rationale: string | null }).rationale}
                </p>
              ) : (
                <form action={requestPlanContentsChange} className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="kind" value="event" />
                  <input type="hidden" name="service_code" value={code ?? ''} />
                  <div className="min-w-[14rem] flex-1">
                    <PostedFieldRow
                      name="New number · Papic credits included"
                      empty={String(row.included_papic_credits ?? 0)}
                      fieldName="value"
                      inputMode="numeric"
                      maxLength={7}
                    />
                  </div>
                  <ActionButton tone="neutral" type="submit" icon={<Send aria-hidden strokeWidth={1.9} />} label="Ask to change" />
                </form>
              )}
              <p className={`mt-1 ${TEMPLATE_SUBLINE}`}>
                An upgrade still tops up to the higher plan&rsquo;s number — never both.
              </p>
            </div>
          </div>
        )}
      </div>
      </TemplateSection>
    </>
  );
}
