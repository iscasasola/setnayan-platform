import { featureHref, featurePage } from '@/lib/feature-pages';
import { routes } from '@/lib/routes';
import { FEATURE_ROWS, PRICE_WORDS, isComing, type FeatureRow, type PersonaKey, type RowId } from '@/lib/features-page';
import s from './features-story.module.css';
import { StoryIcon } from './_story-icons';
import { ComingChip } from './_coming-chip';

/**
 * What a /features row's ⓘ says (v3): the price words, Problem → Solution → Why it matters (DRAFT copy, from
 * `lib/features-page.ts`), the status — the `<ComingChip>` on a coming row, a "Live" line on a live one (L9 P16, 27 Nov:
 * build lanes and rulings stay internal; the `plan` field is for the team, never drawn; "Coming" is said once, by the
 * chip, so the Root map sees one status and not a second count) — and one way in for a live row. It is the body of the house `<Explain>` (`_sections/_Story.tsx`), which titles it with the row's name.
 * A coming row offers no button: nothing to open yet is not a door.
 */
export function RowSheet({ id, persona }: { id: RowId; persona: PersonaKey }) {
  const f: FeatureRow = FEATURE_ROWS[id];
  const coming = isComing(f);
  const page = f.page ? featurePage(f.page) : undefined;
  const start =
    persona === 'suppliers'
      ? { href: '/for-suppliers', label: 'Open a shop · free' }
      : { href: routes.start(), label: 'Start planning · free' };
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
      {coming ? null : <p className={s.shPlan}>Live</p>}
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
