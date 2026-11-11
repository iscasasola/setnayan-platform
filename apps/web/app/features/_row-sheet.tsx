import { featureHref, featurePage } from '@/lib/feature-pages';
import { FEATURE_ROWS, PRICE_WORDS, isComing, type FeatureRow, type PersonaKey, type RowId } from '@/lib/features-page';
import s from './features-story.module.css';
import { StoryIcon } from './_story-icons';
import { ComingChip } from './_coming-chip';

/**
 * What a /features row's ⓘ says (v3): the price words, Problem → Solution → Why it matters (DRAFT copy, from
 * `lib/features-page.ts`), the plan line — "Planned · <lane or ruling>" for a coming row — and one way in for a live
 * row. It is the body of the house `<Explain>` (`_sections/_Story.tsx`), which titles it with the row's name.
 * A coming row offers no button: nothing to open yet is not a door.
 */
export function RowSheet({ id, persona }: { id: RowId; persona: PersonaKey }) {
  const f: FeatureRow = FEATURE_ROWS[id];
  const coming = isComing(f);
  const page = f.page ? featurePage(f.page) : undefined;
  const planLine = coming ? `Planned · ${f.plan ?? 'next'}` : f.plan ? `Live · still to come: ${f.plan}` : 'Live';
  const start =
    persona === 'suppliers'
      ? { href: '/for-suppliers', label: 'Open a shop · free' }
      : { href: '/signup', label: 'Start planning · free' };
  const action = page?.tryHref
    ? { href: page.tryHref, label: 'Try it' }
    : page
      ? { href: featureHref(page.slug, 'en'), label: `Open ${page.name.en}` }
      : start;
  return (
    <div data-row-sheet={id}>
      <p className={s.shPrice}>
        {coming ? <ComingChip lead /> : null}
        {PRICE_WORDS[f.price]}
      </p>
      <dl className={s.ps}>
        <dt>Problem</dt>
        <dd>{f.problem}</dd>
        <dt>Solution</dt>
        <dd>{f.solution}</dd>
        <dt>Why it matters</dt>
        <dd>{f.why}</dd>
      </dl>
      <p className={s.shPlan}>{planLine}</p>
      {coming ? null : (
        <p className={s.shActions}>
          <a className={`${s.btn} ${s.btnFill}`} href={action.href}>
            <StoryIcon name="door" className={s.bi} />
            <span>{action.label}</span>
          </a>
        </p>
      )}
    </div>
  );
}
