/**
 * The five shared marketing widgets — ONE set, used by /for-suppliers and /for-coordinators (owner 5 Nov:
 * "this widget applies to both suppliers and coordinator page"; DECISION_LOG 2026-11-05 "THE SHARED MARKETING
 * WIDGETS ARE BUILT IN FOR SUPPLIERS (#7268); FOR COORDINATORS (#7269) REUSES THEM"). Ported from the controller's
 * prototype (artifact WAh2zYfLCurgknopQBf9WV v3):
 *
 *   TradeEco ............ "One event. Everyone connected." — nine real flows, lit by role
 *   TradePlans .......... five plan cards: price · one line · page preview · three facts · limits · every tool
 *   TradeSpecialTools ... the trade's own slot: suppliers' "your part of the event"; coordinators pass their own
 *   TradeMarketing ...... printable cards and tarps · QR, NFC tap and link · what a package can include + gifts
 *   TradeRewards ........ badges and the gift each one pays
 *
 * Everything said is read from `trade-data.ts` (plan tools from VENDOR_TIER_SECTIONS, limits from TIER_CAPS, QR
 * jobs from SUPPLIER_QR_MODES, medals from badge-tiers) or passed in by the page (prices from getVendorPrices, the
 * live booking-fee schedule). No buttons that leave the page (owner: "just do not add buttons").
 */
import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import type { BookingFeeSchedule } from '@/lib/booking-fee';
import { BookingFeeLine } from '@/app/_components/booking-fee-line';
import { formatCount } from '@/lib/format-number';
import { giftProducts, packageTools } from '@/app/for-suppliers/_components/supplier-page-words';
import css from './trade.module.css';
import { EcoFlows, FoldList, FormatPicker, PlanMore, PlanRow } from './trade-client';
import {
  BADGE_REWARDS,
  FLOWS,
  LIMIT_LABELS,
  PRINT_FORMATS,
  PRINT_SCENES,
  REWARD_KINDS,
  ROLE_LABEL,
  SUPPLIER_DAY_TOOLS,
  SUPPLIER_EVENT_ACCESS,
  SUPPLIER_OWN_TOOLS,
  TRADE_PHOTOS,
  drawnQrPath,
  planCards,
  qrJobs,
  rewardLadder,
  type Role,
} from './trade-data';

export type Trade = 'supplier' | 'coordinator';

function Head({ id, kicker, title, lede }: { id: string; kicker: string; title: string; lede?: ReactNode }) {
  return (
    <div className={css.head}>
      <p className={css.kicker}>{kicker}</p>
      <h2 id={id} className={css.h2}>
        {title}
      </h2>
      {lede ? <p className={css.lede}>{lede}</p> : null}
    </div>
  );
}

/** A picture slot: the real file once it is in TRADE_PHOTOS, a quiet described stand-in until then. */
function Photo({ shot, alt, className, label, children }: { shot: string; alt: string; className?: string; label?: string; children?: ReactNode }) {
  const src = TRADE_PHOTOS[shot] ?? null;
  return (
    <div className={`${css.photo} ${className ?? ''}`} data-shot={shot}>
      {src ? (
        <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 50vw, 100vw" />
      ) : (
        <div className={css.standin} role="img" aria-label={alt}>
          {children ?? (
            <span className={css.standinMark}>
              <b>Photo coming</b>
              <span>{alt}</span>
            </span>
          )}
        </div>
      )}
      {label ? <span className={css.photoLabel}>{label}</span> : null}
    </div>
  );
}

function DrawnQr({ seed }: { seed: number }) {
  return (
    <svg viewBox="0 0 25 25" shapeRendering="crispEdges" aria-hidden>
      <path className={css.qrInk} fillRule="evenodd" d={drawnQrPath(seed)} />
    </svg>
  );
}

/* ── 1 · ONE EVENT. EVERYONE CONNECTED. ───────────────────────────────────────────────────────────────── */

export function TradeEco({ trade }: { trade: Trade }) {
  const roles: Role[] = ['supplier', 'coordinator', 'host', 'guest'];
  return (
    <section className={css.sec} id="how-it-fits" aria-labelledby="tw-h-eco">
      <div className={css.wrap}>
        <Head
          id="tw-h-eco"
          kicker="How it fits together"
          title="One event. Everyone connected."
          lede="Hosts, guests, the coordinator and every supplier work on the same event. One action, and the others see it."
        />
        <EcoFlows flows={FLOWS} roles={roles.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} initial={trade} />
      </div>
    </section>
  );
}

/* ── 2 · PLANS ────────────────────────────────────────────────────────────────────────────────────────── */

export type TradePlanPrices = { soloMonthly: string | null; proMonthly: string | null; enterpriseMonthly: string | null };

export function TradePlans({
  trade,
  prices,
  fee,
  extra,
  fullTable,
}: {
  trade: Trade;
  prices: TradePlanPrices;
  fee: BookingFeeSchedule | null;
  /** The trade's own tools (For Coordinators' slot); empty on /for-suppliers. */
  extra?: { title: string; tools: readonly string[] };
  /** The full side-by-side matrix, behind a fold under the compare grid. */
  fullTable?: ReactNode;
}) {
  const cards = planCards(prices);
  return (
    <section className={css.sec} id="plans" aria-labelledby="tw-h-plans">
      <div className={css.wrap}>
        <Head
          id="tw-h-plans"
          kicker="Plans"
          title={trade === 'coordinator' ? 'Same plans as every supplier. Plus tools only coordinators get.' : 'Free to join. Paid plans open once you’re Verified.'}
          lede="Every tool you need to run your business is free. Paid plans add reach, a bigger team and more branches. Prices are per 4 weeks."
        />
        <PlanRow options={cards.map((c) => ({ key: c.key, label: `${c.name} · ${c.price ?? 'price unavailable'}` }))}>
          {cards.map((c) => (
            <article key={c.key} className={css.plan} data-plan={c.key}>
              <div className={css.planName}>
                <h3 className={css.h3}>{c.name}</h3>
                {c.price ? (
                  <span className={css.price}>
                    {c.price}
                    <small>/ 4 weeks</small>
                  </span>
                ) : (
                  <span className={`${css.price} ${css.priceNone}`}>Price unavailable</span>
                )}
              </div>
              <p className={css.one}>
                {c.lead ? <b>{c.lead}</b> : null} {c.rest}
              </p>
              <div className={css.mid}>
                <div className={css.siteWrap}>
                  <span className={css.cap}>Your page on {c.name}</span>
                  <div className={css.phone} role="img" aria-label={`Your Setnayan page on ${c.name}: ${c.shotNote}`}>
                    {TRADE_PHOTOS[c.shot] ? (
                      <Image src={TRADE_PHOTOS[c.shot]!} alt="" fill sizes="126px" />
                    ) : (
                      <div className={css.phoneStandin} aria-hidden>
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                      </div>
                    )}
                  </div>
                </div>
                <ul className={css.facts}>
                  {c.facts.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
              <PlanMore>
                <dl className={css.limits}>
                  {LIMIT_LABELS.map((label, i) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd className={c.limits[i] ? undefined : css.no}>{c.limits[i] ?? '—'}</dd>
                    </div>
                  ))}
                </dl>
                <p className={css.plus}>{c.plus}</p>
                <div>
                  {c.groups.map((g) => (
                    <details key={`${c.key}-${g.h}`} className={css.grp} open>
                      <summary>
                        {g.h || `${c.name} adds`}
                        <span>{formatCount(g.items.length)}</span>
                      </summary>
                      <ul className={css.dots}>
                        {g.items.map((it) => (
                          <li key={it.n}>{it.n}</li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              </PlanMore>
            </article>
          ))}
        </PlanRow>
        <details className={`${css.more} ${css.cmpFold}`}>
          <summary>Compare all five at a glance</summary>
          <div className={css.cmp}>
            <div className={css.cmpH}>
              <span className={css.cmpL} />
              {cards.map((c) => (
                <span key={c.key}>{c.name}</span>
              ))}
            </div>
            {LIMIT_LABELS.map((label, i) => (
              <div key={label} className={css.cmpR}>
                <span className={css.cmpL}>{label}</span>
                {cards.map((c) => (
                  <span key={c.key} className={c.limits[i] ? undefined : css.no}>
                    {c.limits[i] ?? '—'}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </details>
        {fullTable ? (
          <details className={css.more}>
            <summary>Every tool, side by side</summary>
            {fullTable}
          </details>
        ) : null}
        {extra && extra.tools.length > 0 ? (
          <div className={css.extra}>
            <h3 className={css.h3}>{extra.title}</h3>
            <FoldList items={extra.tools} />
          </div>
        ) : null}
        <p className={`${css.fine} ${css.fee}`}>
          <BookingFeeLine fee={fee} /> Your own clients are free, always.
        </p>
      </div>
    </section>
  );
}

/* ── 3 · SPECIAL TOOLS ────────────────────────────────────────────────────────────────────────────────── */

export type SpecialCopy = { title: string; line?: string; items: readonly ReactNode[]; small?: boolean };

export function TradeSpecialTools({
  kicker,
  title,
  lede,
  visual,
  copy,
  tools = [],
}: {
  kicker: string;
  title: string;
  lede: string;
  /** The left-hand picture: a drawn sample or a photo slot. */
  visual: ReactNode;
  copy: readonly SpecialCopy[];
  tools?: readonly { title: string; tag: string; items: readonly string[] }[];
}) {
  return (
    <section className={css.sec} id="special-tools" aria-labelledby="tw-h-sp">
      <div className={css.wrap}>
        <Head id="tw-h-sp" kicker={kicker} title={title} lede={lede} />
        <div className={css.spot}>
          {visual}
          {copy.map((c) => (
            <div key={c.title} className={css.spotCopy}>
              {c.small ? <h4 className={css.h4}>{c.title}</h4> : <h3 className={css.h3}>{c.title}</h3>}
              {c.line ? <p className={css.line}>{c.line}</p> : null}
              <FoldList items={c.items} />
            </div>
          ))}
        </div>
        {tools.length > 0 ? (
          <div className={css.tools}>
            {tools.map((t) => (
              <div key={t.title} className={css.tool}>
                <div className={css.toolHead}>
                  <h4 className={css.h4}>{t.title}</h4>
                  <span className={css.ftag}>{t.tag}</span>
                </div>
                <ul className={css.dots}>
                  {t.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** The supplier's slot: "your part of the event" — a drawn sample of the run of show, what a booked supplier can
 *  do inside the host's event, and the three day tools. */
export function SupplierSpecialTools() {
  return (
    <TradeSpecialTools
      kicker="Your part of the event"
      title="Every event you’re booked on, in one place. Your part lives in it."
      lede="Free on every plan. Open it on your phone at the venue."
      visual={
        <div className={css.ui} role="img" aria-label="A sample of a florist’s part of a wedding’s run of show, with a countdown clock">
          <p className={css.uiCap}>Your part · a sample wedding</p>
          <div className={css.clock}>
            <b>00:14:20</b>
            <span>5 min ahead</span>
          </div>
          <div className={css.ros}>
            <div className={css.rosRow}>
              <span className={css.rosT}>3:00 PM</span>
              <span>
                <b>Ceremony florals set</b>
                <small>Garden, main aisle</small>
              </span>
              <span className={css.st}>Done</span>
            </div>
            <div className={`${css.rosRow} ${css.rosNow}`}>
              <span className={css.rosT}>5:30 PM</span>
              <span>
                <b>Reception centrepieces</b>
                <small>Hall, 18 tables</small>
              </span>
              <span className={css.st}>Now</span>
            </div>
            <div className={css.rosRow}>
              <span className={css.rosT}>6:15 PM</span>
              <span>
                <b>Bouquet toss handover</b>
                <small>Stage left</small>
              </span>
              <span className={`${css.st} ${css.stNext}`}>Next</span>
            </div>
          </div>
        </div>
      }
      copy={[
        {
          title: 'Your own access to the host’s event',
          line: 'Once you’re booked, you get access to the parts of the event you need, so you can supply your details yourself.',
          items: SUPPLIER_EVENT_ACCESS,
        },
        { title: 'Plus your own tools', items: SUPPLIER_OWN_TOOLS, small: true },
      ]}
      tools={SUPPLIER_DAY_TOOLS}
    />
  );
}

/* ── 4 · FREE MARKETING TOOLS ─────────────────────────────────────────────────────────────────────────── */

export function TradeMarketing({ lede }: { lede: string }) {
  const jobs = qrJobs();
  const tools = packageTools();
  const gifts = giftProducts();
  return (
    <section className={css.sec} id="marketing" aria-labelledby="tw-h-mk">
      <div className={css.wrap}>
        <Head id="tw-h-mk" kicker="Marketing tools · free" title="Print it, post it, scan it. Free on every plan." lede={lede} />
        <div className={css.mk}>
          <article className={`${css.mkt} ${css.mktPrints}`}>
            <div className={css.mktCopy}>
              <h3 className={css.h3}>
                Calling cards and tarpaulins, designed for you <span className={css.ftag}>Free</span>
              </h3>
              <p className={css.line}>
                We make the design from your shop (your name, Verified seal, badges, rating and QR) in every size.
                Download it and print it anywhere.
              </p>
            </div>
            <div className={css.scenes} aria-label="Your prints in use">
              {PRINT_SCENES.map((s) => (
                <Photo key={s.shot} shot={s.shot} alt={s.alt} label={s.label} className={css.scene} />
              ))}
            </div>
            <FormatPicker
              formats={PRINT_FORMATS.map((f) => ({
                key: f.key,
                label: f.label,
                mock: (
                  <Photo shot={f.shot} alt={`Your ${f.label.toLowerCase()} in your shop design`} className={css.mock}>
                    <span
                      className={f.key === 'card' ? `${css.mockDesign} ${css.mockCard}` : css.mockDesign}
                      style={{ aspectRatio: f.ratio } as CSSProperties}
                    >
                      {f.label}
                    </span>
                  </Photo>
                ),
              }))}
            />
          </article>
          <article className={`${css.mkt} ${css.mktQr}`}>
            <Photo shot="marketing-qr" alt="Your six QR codes: Inquiry, Booking, Check a date, My page, Crew and Review" className={css.qrArt}>
              <div className={css.qrs}>
                {jobs.map((j, i) => (
                  <div key={j.tile}>
                    <DrawnQr seed={i + 11} />
                    {j.tile}
                  </div>
                ))}
              </div>
            </Photo>
            <div className={css.mktCopy}>
              <h3 className={css.h3}>
                QR, NFC tap and a direct link: three ways in <span className={css.ftag}>Free</span>
              </h3>
              <p className={css.line}>
                Every code also works as an NFC tap and as a plain link you can paste anywhere. {formatCount(jobs.length)} of
                each, one per job, in your shop’s design.
              </p>
              <FoldList items={jobs.map((j) => j.line)} className={css.dots} />
            </div>
          </article>
          {/* Owner 5 Nov: the "Your package" section is FOLDED in here, not a sixth widget. */}
          <article className={css.mkt} aria-labelledby="tw-h-pkg">
            <div className={css.mktCopy}>
              <h3 id="tw-h-pkg" className={css.h3}>
                Put Setnayan in your package <span className={css.ftag}>Free</span>
              </h3>
              <p className={css.line}>
                Every couple who books you gets these planning tools free, so they are yours to offer. Then add a gift to
                their event.
              </p>
            </div>
            <div className={css.pkg}>
              <FoldList
                first={8}
                className={css.pkgTools}
                items={tools.map((t) => (
                  <>
                    <b>{t.name}</b>
                    <span>{t.line}</span>
                  </>
                ))}
              />
              <div className={css.mktCopy}>
                <h4 className={css.h4}>Gifts you can give their event</h4>
                <ul className={css.dots}>
                  {gifts.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
                <p className={css.fine}>Add a gift on a service card or a quote. Your couple receives the full product.</p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ── 5 · BADGES AND REWARDS ───────────────────────────────────────────────────────────────────────────── */

export function TradeRewards({ lede }: { lede: string }) {
  const ladder = rewardLadder();
  const sample = ladder[1];
  return (
    <section className={css.sec} id="rewards" aria-labelledby="tw-h-rw">
      <div className={css.wrap}>
        <Head id="tw-h-rw" kicker="Badges and rewards" title="Grow with us. Earn gifts for your next clients." lede={lede} />
        {sample ? (
          <div className={css.rwNext} aria-label="An example of your badge page">
            <div className={css.rwTop}>
              <span className={css.medal}>{sample.medal.toUpperCase()}</span>
              <div>
                <div className={css.rwT}>Events on Setnayan · an example</div>
                <div className={css.rwS}>
                  A few more events to {sample.medal} ({sample.step})
                </div>
              </div>
            </div>
            <div className={css.bar} role="img" aria-label="Almost there">
              <i style={{ width: '92%' }} />
            </div>
            <div className={css.gets}>
              Next reward: <b>{sample.reward}</b> for your next client
            </div>
          </div>
        ) : null}
        <ul className={css.kinds}>
          {REWARD_KINDS.map((k) => (
            <li key={k.name} className={css.kind}>
              <span className={css.kindMark} aria-hidden>
                {k.mark}
              </span>
              <h4 className={css.h4}>{k.name}</h4>
              <p>{k.line}</p>
            </li>
          ))}
        </ul>
        <p className={css.rwCap}>Events on Setnayan</p>
        <ol className={css.ladder}>
          {ladder.map((r) => (
            <li key={r.step}>
              <span className={css.ladderN}>
                {r.step}
                <small>{r.medal}</small>
              </span>
              <span className={css.ladderG}>{r.reward}</span>
            </li>
          ))}
        </ol>
        <details className={`${css.more} ${css.all}`}>
          <summary>Every badge and its reward</summary>
          <ul>
            {BADGE_REWARDS.map((b) => (
              <li key={b.badge}>
                <span className={css.allB}>{b.badge}</span>
                <span className={css.allH}>{b.how}</span>
                <span className={css.allG}>{b.reward}</span>
              </li>
            ))}
          </ul>
        </details>
        <p className={css.fine} style={{ marginTop: 18 }}>
          Rewards land in your gifts. Add one to any quote and it reaches your client’s event when they pay. A free booking
          fee applies by itself to your next booking that has a fee. Every badge pays once, and rewards don’t expire.
        </p>
      </div>
    </section>
  );
}
