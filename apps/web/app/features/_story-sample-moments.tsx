import Image from 'next/image';
import type { CSSProperties } from 'react';

import type { MomentKind } from '@/lib/features-page';
import s from './features-story.module.css';
import { LockIcon, StoryIcon } from './_story-icons';

/**
 * THE LIVE MOMENTS — the depicted app screen beside each chapter (v3, owner-approved 11 Nov), ported from the
 * prototype's `moment()` one for one. CSS/SVG only; motion starts when `_story-client.tsx` marks the moment
 * `data-on` as it scrolls into view, and every moment is drawn finished under "reduce motion".
 *
 * A moment is a PICTURE of the app, not the app: the names, numbers and dates are an illustrative sample event
 * (Clarisse & Joaquin), and its buttons are drawn, not pressable — except the run of show's "Shift everything",
 * which only moves the times on the picture. Photos are the repo's own marketing renders (never base64).
 */

const d = (n: number) => ({ '--d': n }) as CSSProperties;

function Bar({ title }: { title: string }) {
  return (
    <div className={s.mb}>
      <span className={s.mbDot} />
      <span>{title}</span>
    </div>
  );
}

function Tile({ src, i, figure = false }: { src: string; i: number; figure?: boolean }) {
  const Tag = figure ? 'figure' : 'i';
  return (
    <Tag className={s.tile} style={d(i)}>
      <Image src={src} alt="" fill sizes="160px" className={s.tileImg} />
    </Tag>
  );
}

/** A figure the moment counts up to. The server draws the final number; the island counts up to it. */
function Num({ to }: { to: number }) {
  return <b data-count-to={to}>{to.toLocaleString('en-PH')}</b>;
}

const PHOTO = {
  debut: '/marketing/2026-11-04/hero-debut.webp',
  phones: '/marketing/2026-11-04/problem-02-phones.webp',
  caterer: '/marketing/for-suppliers-2026-11-06/supplier-caterer-hero.webp',
  papic: '/marketing/2026-11-04/addon-papic.webp',
  reunion: '/marketing/2026-11-04/hero-reunion.webp',
  christening: '/marketing/2026-11-04/hero-christening.webp',
  sister: '/marketing/2026-11-04/real-sister.webp',
  abroad: '/marketing/2026-11-04/problem-10-family-abroad.webp',
  birthday: '/marketing/2026-11-04/hero-birthday.webp',
} as const;

const SEAT_TABLES: readonly (readonly [number, number])[] = [
  [40, 40],
  [120, 36],
  [200, 44],
  [60, 112],
  [150, 110],
  [230, 104],
];

export function Moment({ kind }: { kind: MomentKind }) {
  switch (kind) {
    case 'palette':
      return (
        <div className={s.mo} data-mo="palette">
          <Bar title="Mood Board" />
          <div className={s.swatches} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <span className={s.ring} />
          </div>
          <div className={s.hubcard}>
            <div className={s.hcBand} />
            <div className={s.hcMark}>C·J</div>
            <div className={s.hcNames}>Clarisse &amp; Joaquin</div>
            <div className={s.hcDate}>14 Feb 2027 · Tagaytay</div>
            <div className={s.hcRoles}>
              <span>Entourage</span>
              <span>Ninangs</span>
              <span>Guests</span>
            </div>
          </div>
          <p className={s.moCap}>Mood Board → Event Hub. The palette you pick dresses the page, the roles and the prints.</p>
        </div>
      );
    case 'rsvp':
      return (
        <div className={s.mo} data-mo="rsvp">
          <Bar title="Event Hub · Invitation" />
          <div className={`${s.hubcard} ${s.hubcardSmall}`}>
            <svg className={s.mono} viewBox="0 0 80 80" aria-hidden="true">
              <circle className={s.m1} cx="32" cy="40" r="22" />
              <circle className={s.m2} cx="48" cy="40" r="22" />
              <path className={s.m3} d="M40 14v52" />
            </svg>
            <div>
              <div className={s.hcNames}>Clarisse &amp; Joaquin</div>
              <div className={s.hcDate}>Reply by 20 Jan</div>
            </div>
          </div>
          <div className={s.count}>
            <Num to={186} />
            <span>of 220 replied</span>
          </div>
          <ul className={s.glist}>
            {(
              [
                ['Tita Ruth Villanueva', 'Going', false],
                ['Miguel Santos', 'Going', false],
                ['Lola Nena', 'Going', false],
                ['Paolo and Bea Reyes', 'Not yet', true],
              ] as const
            ).map(([n, t, wait], i) => (
              <li key={n} style={d(i)}>
                <span className={s.av}>{n[0]}</span>
                <span className={s.gn}>{n}</span>
                <span className={`${s.chip} ${wait ? s.chipWait : ''}`}>{t}</span>
              </li>
            ))}
          </ul>
          <svg className={s.seats} viewBox="0 0 270 150" role="img" aria-label="Seat plan filling">
            {SEAT_TABLES.map(([cx, cy], t) => (
              <g key={t}>
                <circle className={s.tb} cx={cx} cy={cy} r={14} />
                {Array.from({ length: 8 }, (_, k) => {
                  const a = (k / 8) * 2 * Math.PI;
                  return (
                    <circle
                      key={k}
                      className={s.st}
                      style={d(t * 8 + k)}
                      cx={(cx + Math.cos(a) * 24).toFixed(1)}
                      cy={(cy + Math.sin(a) * 24).toFixed(1)}
                      r={4.2}
                    />
                  );
                })}
              </g>
            ))}
          </svg>
          <p className={s.moCap}>Each reply lands in the Guest list; the Seat Plan and the meal counts fill themselves.</p>
        </div>
      );
    case 'chat':
      return (
        <div className={s.mo} data-mo="chat">
          <Bar title="Lola Nena’s Catering · Verified" />
          <div className={s.thread}>
            <div className={`${s.msg} ${s.msgMe}`} style={d(0)}>
              Hi po! 180 guests, 14 Feb in Tagaytay. Buffet with a lechon station?
            </div>
            <div className={s.msg} style={d(1)}>
              Yes po, free that day. Sending the quotation now.
            </div>
            <div className={s.qcard} style={d(2)}>
              <div className={s.qcH}>
                <StoryIcon name="quote" className={s.ci} />
                <span>Quotation</span>
                <span className={s.qcV}>Valid until 28 Nov</span>
              </div>
              <div className={s.qcL}>
                <span>Buffet · 180 pax</span>
                <span>Lechon station</span>
                <span>Service crew · 8</span>
              </div>
              <div className={s.qcPlan}>Payment plan · 30% · 40% · balance on the day</div>
              <div className={s.btnRow} aria-hidden="true">
                <span className={`${s.btn} ${s.btnLine}`}>
                  <StoryIcon name="swap" className={s.bi} />
                  <span>Ask for a change</span>
                </span>
                <span className={`${s.btn} ${s.btnFill}`}>
                  <StoryIcon name="check" className={s.bi} />
                  <span>Accept and book</span>
                </span>
              </div>
            </div>
            <div className={`${s.msg} ${s.msgSys}`} style={d(3)}>
              <StoryIcon name="check" className={s.ci} /> Booked · the payment plan is now in your Budget
            </div>
          </div>
          <p className={s.moCap}>Quote, payment plan and every change are cards in one chat. Nothing is a screenshot.</p>
        </div>
      );
    case 'hub':
      return (
        <div className={s.mo} data-mo="hub">
          <Bar title="Event Hub · The Day" />
          <ol className={s.stages}>
            <li>Save the Date</li>
            <li>Invitation</li>
            <li className={s.now}>The Day</li>
            <li>After</li>
            <li className={s.prog} aria-hidden="true" />
          </ol>
          <div className={s.livegrid}>
            <div className={s.lt}>
              <span className={s.ltK}>Schedule · now</span>
              <b>First dance</b>
              <span className={s.ltS}>8:40 pm · running on time</span>
            </div>
            <div className={s.lt}>
              <span className={s.ltK}>Live Watch</span>
              <b>
                <span data-count-to={312}>312</span> watching
              </b>
              <span className={s.ltS}>Toronto · Dubai · Cebu</span>
            </div>
          </div>
          <div>
            <div className={s.ppH}>
              Papic · <span data-count-to={1284}>1,284</span> photos
            </div>
            <div className={s.ppGrid}>
              {[PHOTO.debut, PHOTO.phones, PHOTO.caterer, PHOTO.papic, PHOTO.reunion, PHOTO.christening].map((src, i) => (
                <Tile key={src} src={src} i={i} />
              ))}
            </div>
          </div>
          <p className={s.moCap}>The Hub switches to the day on its own. Every guest phone shoots into one album, sorted by face.</p>
        </div>
      );
    case 'memories':
      return (
        <div className={s.mo} data-mo="memories">
          <Bar title="Memories · Clarisse & Joaquin" />
          <div className={s.memgrid}>
            {[PHOTO.christening, PHOTO.sister, PHOTO.reunion, PHOTO.abroad, PHOTO.birthday].map((src, i) => (
              <Tile key={src} src={src} i={i} figure />
            ))}
          </div>
          <div className={s.count}>
            <Num to={42} />
            <span>photos you were in</span>
          </div>
          <ul className={s.facts}>
            <li>
              <StoryIcon name="check" className={s.ci} /> 1,284 photos · 14 videos · the stream
            </li>
            <li>
              <StoryIcon name="check" className={s.ci} /> Gifts went straight to your GCash
            </li>
            <li>
              <StoryIcon name="check" className={s.ci} /> The Post Event story is live on your link
            </li>
          </ul>
          <p className={s.moCap}>The same link, after the day. Kept for life; the next family learns from it if you share it.</p>
        </div>
      );
    case 'pass':
      return (
        <div className={s.mo} data-mo="pass">
          <Bar title="Your pass" />
          <div className={s.pass}>
            <div className={s.psTop}>
              <span className={s.hcMark}>C·J</span>
              <div>
                <div className={s.hcNames}>Tita Ruth Villanueva</div>
                <div className={s.hcDate}>Reception · Table 12 · Seat 3</div>
              </div>
            </div>
            <div className={s.qr} aria-hidden="true">
              {Array.from({ length: 49 }, (_, i) => (
                <i key={i} />
              ))}
            </div>
            <div className={s.stamp}>
              <StoryIcon name="check" className={s.ci} /> Checked in · 6:12 pm
            </div>
          </div>
          <p className={s.moCap}>One QR: your RSVP, the door, your table, and your own photos after.</p>
        </div>
      );
    case 'shop':
      return (
        <div className={s.mo} data-mo="shop">
          <Bar title="My Shop" />
          <div className={s.shop}>
            <div className={s.shTop}>
              <span className={s.logo}>LN</span>
              <div>
                <div className={s.hcNames}>
                  Lola Nena’s Catering{' '}
                  <span className={s.vbadge}>
                    <StoryIcon name="badge" className={s.ci} /> Verified
                  </span>
                </div>
                <div className={s.hcDate}>Quezon City · 38 events</div>
              </div>
            </div>
            <div className={s.scard}>
              <div>
                <b>Buffet for 150–300</b>
                <span className={s.hcDate}>3 photos · 2 bundles · off-season offer</span>
              </div>
              <span className={`${s.sw} ${s.swGo}`} aria-hidden="true">
                <span className={s.knob} />
                <span className={s.wOff}>Offline</span>
                <span className={s.wOn}>Online</span>
              </span>
            </div>
            <div className={`${s.scard} ${s.dim}`}>
              <div>
                <b>Lechon station</b>
                <span className={s.hcDate}>Draft</span>
              </div>
              <span className={s.sw} aria-hidden="true">
                <span className={s.knob} />
                <span className={s.wOff}>Offline</span>
              </span>
            </div>
          </div>
          <p className={s.moCap}>Two steps to open. Build as many cards as you like; switch one Online when it is ready.</p>
        </div>
      );
    case 'paid':
      return (
        <div className={s.mo} data-mo="paid">
          <Bar title="Payment plan · Clarisse & Joaquin" />
          <ul className={s.payplan}>
            {(
              [
                ['30% · booking', 'Paid · 1 Dec'],
                ['40% · a month before', 'Paid · 14 Jan'],
                ['Balance · on the day', 'Paid · 14 Feb'],
              ] as const
            ).map(([a, b], i) => (
              <li key={a} style={d(i)}>
                <span>{a}</span>
                <span className={s.paid}>
                  <StoryIcon name="check" className={s.ci} /> {b}
                </span>
              </li>
            ))}
          </ul>
          <div className={s.count}>
            <Num to={4} />
            <span>events paid this month</span>
          </div>
          <ul className={s.facts}>
            <li>
              <StoryIcon name="check" className={s.ci} /> Each payment posts a receipt card in the chat
            </li>
            <li>
              <StoryIcon name="check" className={s.ci} /> Your own clients: no fee, ever
            </li>
          </ul>
          <p className={s.moCap}>The plan always pays all. What lands in the chat lands in your earnings.</p>
        </div>
      );
    case 'reviews':
      return (
        <div className={s.mo} data-mo="reviews">
          <Bar title="Reviews · 24 h after the event" />
          <div className={s.review}>
            <div className={s.stars} role="img" aria-label="Five stars">
              {[0, 1, 2, 3, 4].map((i) => (
                <i key={i} style={d(i)}>
                  <StoryIcon name="star" className={s.ci} />
                </i>
              ))}
            </div>
            <p>“Hindi kami nag-alala sa food. Nag-adjust sila nang mag-180 to 210 ang guests.”</p>
            <span className={s.hcDate}>Clarisse R. · Wedding · Tagaytay</span>
          </div>
          <div className={s.count}>
            <Num to={38} />
            <span>events in your track record</span>
          </div>
          <div className={s.ana}>
            <div className={s.ppH}>Analytics · inquiries, last 7 weeks</div>
            <div className={s.bars} aria-hidden="true">
              {[40, 55, 35, 70, 62, 88, 76].map((h, i) => (
                <i key={i} style={{ '--h': `${h}%`, '--d': i } as CSSProperties} />
              ))}
            </div>
            <div className={s.rec}>
              <StoryIcon name="spark" className={s.ci} /> June and July look light. Set up an off-season offer.
            </div>
          </div>
          <p className={s.moCap}>Proof grows on its own. Every graph taps to what we would do about it.</p>
        </div>
      );
    case 'coord':
      return (
        <div className={s.mo} data-mo="coord">
          <Bar title="Run of show · Clarisse & Joaquin" />
          <ol className={s.ros}>
            {(
              [
                ['5:30 pm', 'Doors · check-in'],
                ['6:15 pm', 'Entrance of the entourage'],
                ['6:40 pm', 'Grand entrance'],
                ['7:10 pm', 'Dinner is served'],
                ['8:40 pm', 'First dance'],
              ] as const
            ).map(([t, m], i) => (
              <li key={t} style={d(i)}>
                <span className={s.t} data-t={t}>
                  {t}
                </span>
                <span>{m}</span>
              </li>
            ))}
            <li className={s.nowline} aria-hidden="true" />
          </ol>
          <div className={s.count}>
            <Num to={174} />
            <span>of 180 checked in</span>
          </div>
          <div className={s.shift}>
            <span className={`${s.btn} ${s.btnLine}`}>
              <StoryIcon name="clock" className={s.bi} />
              <span>Running 12 min late</span>
            </span>
            <button type="button" className={`${s.btn} ${s.btnFill}`} data-shift="">
              <StoryIcon name="swap" className={s.bi} />
              <span>Shift everything</span>
            </button>
          </div>
          <p className={s.moCap}>Move one moment and every supplier’s time moves with it. Nothing is set in stone.</p>
        </div>
      );
    case 'family':
      return (
        <div className={s.mo} data-mo="family">
          <Bar title="Home · your events" />
          <ol className={s.fam}>
            {(
              [
                ['2019', 'Christening', 'Mateo'],
                ['2024', '7th birthday', 'Mateo'],
                ['2027', 'Wedding', 'Clarisse & Joaquin'],
                ['2031', '60th', 'Mama Nena'],
                ['2052', 'Golden anniversary', 'Clarisse & Joaquin'],
              ] as const
            ).map(([y, e, w], i) => (
              <li key={y} style={d(i)}>
                <span className={s.yr}>{y}</span>
                <span className={s.ev}>{e}</span>
                <span className={s.who}>{w}</span>
              </li>
            ))}
          </ol>
          <div className={s.count}>
            <Num to={42} />
            <span>people saved once, on every event</span>
          </div>
          <p className={s.moCap}>A family’s events hang on its people. Each one starts pre-filled; every memory lands in one library.</p>
        </div>
      );
    case 'cardrow':
      return (
        <div className={s.mo} data-mo="cardrow">
          <Bar title="Shop · your bundles and services" />
          <div className={`${s.scard} ${s.scardBig}`}>
            <div className={s.scPhoto}>
              <Image src={PHOTO.caterer} alt="" fill sizes="96px" className={s.tileImg} />
            </div>
            <div className={s.scBody}>
              <b>Buffet for 150–300</b>
              <span className={s.hcDate}>Inclusions · 3 forms · 12 reviews · 9 photos</span>
              <span className={s.offer}>Best offer showing · 10% off June dates</span>
            </div>
          </div>
          <div className={s.cardrowActions} aria-hidden="true">
            <span className={`${s.btn} ${s.btnLine}`}>
              <StoryIcon name="swap" className={s.bi} />
              <span>Edit</span>
            </span>
            <span className={`${s.btn} ${s.btnLine}`}>
              <StoryIcon name="reply" className={s.bi} />
              <span>Share</span>
            </span>
            <span className={`${s.sw} ${s.swGo}`}>
              <span className={s.knob} />
              <span className={s.wOff}>Offline</span>
              <span className={s.wOn}>Online</span>
            </span>
          </div>
          <p className={s.locknote}>
            <LockIcon className={s.lock} /> 2 open bookings · this card stays on
          </p>
          <p className={s.moCap}>Edit · Share to a client’s chat · Online. A card with open bookings cannot be deleted or turned off.</p>
        </div>
      );
  }
}
