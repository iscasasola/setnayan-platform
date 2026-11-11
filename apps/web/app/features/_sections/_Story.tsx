import Image from 'next/image';
import Link from 'next/link';

import type { MarketingLocale } from '@/lib/marketing-i18n';
import { featureHref, featurePage } from '@/lib/feature-pages';
import { FEATURE_ROWS, PERSONAS, PRICE_WORDS, type Chapter, type FeatureRow, type Persona, type RowId } from '@/lib/features-page';
import s from '../features-story.module.css';
import { Moment } from '../_story-moments';
import { InfoIcon, StoryIcon } from '../_story-icons';

/**
 * THE STORY — /features v3 (owner-approved 11 Nov; DECISION_LOG "FEATURES PAGE v3 — APPROVED"). The life of an
 * event, told in numbered chapters per persona: eyebrow · headline · paragraph · live moment · rows. Every row comes
 * from ONE typed module (`lib/features-page.ts`); this file only draws them.
 *
 * All four personas are drawn on the server (search engines and screen readers get every row); the "I am" pick in
 * the hero shows one (`PersonaScope`, CSS on `data-persona`). A row:
 *   · links to its own feature page when it has one (the hub's links to `/features/<slug>` live on here);
 *   · otherwise opens its Problem → Solution, like its ⓘ — drawn here, hidden, and lifted into the sheet;
 *   · wears the "Coming" chip and a dashed icon when it is planned, and its ⓘ names the lane or ruling.
 *
 * English only: the rows have no Taglish yet, so /tl/features keeps its shipped groups (see `_PageBody.tsx`).
 */

function RowSheet({ id, persona }: { id: RowId; persona: Persona['key'] }) {
  const f: FeatureRow = FEATURE_ROWS[id];
  const coming = f.status === 'coming';
  const page = f.page ? featurePage(f.page) : undefined;
  const planLine = coming
    ? `Planned · ${f.plan ?? 'next'}`
    : f.plan
      ? `Live · still to come: ${f.plan}`
      : 'Live';
  const start = persona === 'suppliers' ? { href: '/for-suppliers', label: 'Open a shop · free' } : { href: '/signup', label: 'Start planning · free' };
  return (
    <>
      <div className={s.shHead}>
        <span className={s.glyph}>
          <StoryIcon name={f.icon} className={s.ic} />
        </span>
        <div>
          <div className={s.shName}>
            {f.name}
            {coming ? <span className={`${s.chip} ${s.chipWait} ${s.tag}`}>Coming</span> : null}
          </div>
          <div className={s.shPrice}>{PRICE_WORDS[f.price]}</div>
        </div>
      </div>
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
        <div className={s.shActions}>
          {page?.tryHref ? (
            <a className={`${s.btn} ${s.btnFill}`} href={page.tryHref}>
              <StoryIcon name="door" className={s.bi} />
              <span>Try it</span>
            </a>
          ) : page ? (
            <a className={`${s.btn} ${s.btnFill}`} href={featureHref(page.slug, 'en')}>
              <StoryIcon name="door" className={s.bi} />
              <span>Open {page.name.en}</span>
            </a>
          ) : (
            <a className={`${s.btn} ${s.btnFill}`} href={start.href}>
              <StoryIcon name="door" className={s.bi} />
              <span>{start.label}</span>
            </a>
          )}
        </div>
      )}
    </>
  );
}

function Row({ id, cid, persona }: { id: RowId; cid: string; persona: Persona['key'] }) {
  const f: FeatureRow = FEATURE_ROWS[id];
  const coming = f.status === 'coming';
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
          {coming ? <span className={`${s.chip} ${s.chipWait} ${s.tag}`}>Coming</span> : null}
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
        <button type="button" className={s.door} data-info={rid} aria-haspopup="dialog">
          {inner}
        </button>
      )}
      <button type="button" className={s.info} aria-label={`About ${f.name}`} aria-haspopup="dialog" data-info={rid}>
        <InfoIcon />
      </button>
      <div hidden data-sheet={rid}>
        <RowSheet id={id} persona={persona} />
      </div>
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
