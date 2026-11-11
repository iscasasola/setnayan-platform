import Image from 'next/image';
import Link from 'next/link';

import type { MarketingLocale } from '@/lib/marketing-i18n';
import { featureHref, featurePage } from '@/lib/feature-pages';
import { FEATURE_ROWS, PERSONAS, PRICE_WORDS, type Chapter, isComing, type FeatureRow, type Persona, type RowId } from '@/lib/features-page';
import { Explain } from '@/app/_components/explain';
import s from '../features-story.module.css';
import { Moment } from '../_story-sample-moments';
import { StoryIcon } from '../_story-icons';
import { RowSheet } from '../_row-sheet';
import { ComingChip } from '../_coming-chip';

/**
 * THE STORY — /features v3 (owner-approved 11 Nov; DECISION_LOG "FEATURES PAGE v3 — APPROVED"). The life of an
 * event, told in numbered chapters per persona: eyebrow · headline · paragraph · live moment · rows. Every row comes
 * from ONE typed module (`lib/features-page.ts`); this file only draws them.
 *
 * All four personas are drawn on the server (search engines and screen readers get every row); the "I am" pick in
 * the hero shows one (`PersonaScope`, CSS on `data-persona`). A row:
 *   · links to its own feature page when it has one (the hub's links to `/features/<slug>` live on here);
 *   · carries the house ⓘ (`<Explain>` — the app's one ⓘ, `there-is-one-info-dot.test.ts`): Problem → Solution →
 *     Why, in a centred popup on a phone and an attached note on a computer (`_row-sheet.tsx`);
 *   · wears the "Coming" chip and a dashed icon when it is planned, and its ⓘ names the lane or ruling.
 *
 * English only: the rows have no Taglish yet, so /tl/features keeps its shipped groups (see `_PageBody.tsx`).
 */

function Row({ id, cid, persona }: { id: RowId; cid: string; persona: Persona['key'] }) {
  const f: FeatureRow = FEATURE_ROWS[id];
  const coming = isComing(f);
  const rid = `${cid}-${id}`;
  const page = f.page ? featurePage(f.page) : undefined;
  const inner = (
    <>
      <span className={s.glyph}>
        <StoryIcon name={f.icon} className={s.ic} />
      </span>
      <span className={s.body}>
        <span className={s.name}>
          {f.name}
          {coming ? <ComingChip /> : null}
        </span>
        <span className={s.line}>{f.line}</span>
        <span className={s.meta}>
          {page?.tryHref ? <span className={s.try}>Try it</span> : null}
          <span className={s.price}>{PRICE_WORDS[f.price]}</span>
        </span>
      </span>
    </>
  );
  return (
    <li className={`${s.row} ${coming ? s.isComing : ''}`} data-row={id} data-status={f.status} data-reg={f.reg.join(',')}>
      {page ? (
        <Link className={s.door} href={featureHref(page.slug, 'en')}>
          {inner}
        </Link>
      ) : (
        <div className={s.door}>{inner}</div>
      )}
      <Explain title={f.name} label={`About ${f.name}`} className={s.info} data={rid}>
        <RowSheet id={id} persona={persona} />
      </Explain>
    </li>
  );
}

function ChapterBlock({ p, c, i }: { p: Persona; c: Chapter; i: number }) {
  const cid = `${p.key}-${i + 1}`;
  return (
    <>
      {c.photo ? (
        <figure className={s.strip}>
          <div className={s.stripFrame}>
            <Image src={c.photo.src} alt={c.photo.alt} fill sizes="100vw" className={s.stripImg} />
          </div>
          <figcaption className={s.gut}>{c.photo.alt}</figcaption>
        </figure>
      ) : null}
      <section className={s.chapter} id={cid} data-chapter="" aria-labelledby={`${cid}-h`}>
        <div className={`${s.chHead} ${s.gut}`}>
          <p className={s.eye}>
            <span className={s.numEye}>{String(i + 1).padStart(2, '0')}</span> {c.eye}
          </p>
          <h2 id={`${cid}-h`}>{c.title}</h2>
          <p className={s.chLine}>{c.line}</p>
        </div>
        <div className={`${s.chMoment} ${s.gut}`}>
          <Moment kind={c.moment} />
        </div>
        <div className={`${s.chRows} ${s.gut}`}>
          <ul className={s.rows}>
            {c.groups.map(([g, ids]) => [
              <li key={`g-${g}`} className={s.grpHead}>
                <span>{g}</span>
                <span className={s.grpN}>{ids.length}</span>
              </li>,
              ...ids.map((id) => <Row key={id} id={id} cid={cid} persona={p.key} />),
            ])}
          </ul>
        </div>
      </section>
    </>
  );
}

export function FeaturesStory({ locale }: { locale: MarketingLocale }) {
  if (locale !== 'en') return null;
  return (
    <>
      {PERSONAS.map((p) => (
        <div key={p.key} data-persona={p.key} data-story={p.key}>
          {p.chapters.map((c, i) => (
            <ChapterBlock key={c.eye} p={p} c={c} i={i} />
          ))}
        </div>
      ))}
    </>
  );
}
