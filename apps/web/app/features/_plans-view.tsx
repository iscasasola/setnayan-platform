import Link from 'next/link';
import type { CSSProperties } from 'react';

import { EVENT_PLANS, SUPPLIER_PLANS, planLines, type PlanColumn } from '@/lib/features-page';
import { featurePriceLabel, resolveFeaturePrice, type CatalogueRow } from '@/lib/feature-pages/price';
import s from './features-story.module.css';
import { StoryIcon } from './_story-icons';
import { PlanKinds } from './_story-client';

/**
 * THE PLANS COMPARE — "Free is complete. Pay for the show." (v3, owner-approved 11 Nov).
 *
 * 🔑 NO PESO IS TYPED. Each paid column names its catalogue code (`lib/features-page.ts`): Event Plus / Event Pro
 * read `platform_retail_catalog_v2`, Solo / Pro / Ultra read `vendor_billing_catalog`, both through the hub's ONE
 * reader (`readFeatureCatalogue`, handed in as `rows`) and the same resolver the feature pages use. An unreadable or
 * inactive row draws "See pricing" — never a guessed figure. Pure and synchronous, so the no-internals guard can
 * paint it with `rows = null`.
 */

function PlanCol({ plan, rows, href, hrefLabel }: { plan: PlanColumn; rows: readonly CatalogueRow[] | null; href: string; hrefLabel: string }) {
  const price =
    plan.price.kind === 'free'
      ? 'Free'
      : featurePriceLabel(resolveFeaturePrice({ kind: 'paid', catalogue: plan.price.catalogue, codes: plan.price.codes }, rows), 'en');
  return (
    <div className={s.plan} data-plan={plan.name}>
      <h3 className={s.plName}>{plan.name}</h3>
      <p className={s.plTag}>{plan.tag}</p>
      <p className={s.plPrice} data-plan-price="">
        {price}
      </p>
      <ul>
        {planLines(plan, rows).map((l) => (
          <li key={l}>
            <StoryIcon name="check" className={s.ci} />
            <span>{l}</span>
          </li>
        ))}
      </ul>
      <Link className={`${s.btn} ${s.btnLine}`} href={href}>
        <StoryIcon name="tag" className={s.bi} />
        <span>{hrefLabel}</span>
      </Link>
    </div>
  );
}

export function PlansCompare({ rows = null }: { rows?: readonly CatalogueRow[] | null }) {
  return (
    <section className={s.plans} id="plans" aria-labelledby="plans-h">
      <div className={`${s.gut} ${s.wide}`}>
        <h2 id="plans-h">Free is complete. Pay for the show.</h2>
        <p className={s.plansSub}>
          The planning is free with every account. Plans add the look, the motion, the credits and the team seats.
        </p>
        <PlanKinds
          label="Compare"
          options={[
            {
              key: 'event',
              label: 'Event plans',
              panel: (
                <div className={s.plangrid} style={{ '--cols': EVENT_PLANS.length } as CSSProperties}>
                  {EVENT_PLANS.map((p) => (
                    <PlanCol key={p.name} plan={p} rows={rows} href="/pricing" hrefLabel="See on pricing" />
                  ))}
                </div>
              ),
            },
            {
              key: 'supplier',
              label: 'Supplier plans',
              panel: (
                <div className={s.plangrid} style={{ '--cols': SUPPLIER_PLANS.length } as CSSProperties}>
                  {SUPPLIER_PLANS.map((p) => (
                    <PlanCol key={p.name} plan={p} rows={rows} href="/for-suppliers" hrefLabel="See the supplier plans" />
                  ))}
                </div>
              ),
            },
          ]}
        />
        <p className={s.planFoot}>
          One unlock covers everyone on the event. A supplier may include Event Plus or Pro in a package. FaceBlock is
          never sold.
        </p>
      </div>
    </section>
  );
}
