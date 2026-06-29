/**
 * Pillar copy + per-pillar feature cards + the interactive preview mocks.
 *
 * Ported faithfully from the prototype
 * `03_Strategy/Home_ELN_Reskin_2026-06-28.html` (the 5 pillars + 27 mocks).
 * The hero `scene` gradients double as the dock thumbnails (clicking a pillar in
 * the dock swaps the hero photo + copy — see HomeReskin.tsx).
 *
 * Mocks are pure presentational JSX (no data) — they stand in for real product
 * screenshots that drop in later (handoff §7.2). Every class is `hr-`-prefixed
 * and scoped under `.home-reskin` (see home-reskin.css).
 */
import type { ReactNode } from 'react';

export type PillarHero = {
  /** anchor id of the pillar's full section (the Learn-more jump target) */
  id: string;
  name: string;
  role: string;
  /** hero headline shown when this dock item is selected */
  head: string;
  /** hero sub-copy shown when selected */
  desc: string;
  /** the CSS gradient that paints the full-screen hero + the dock thumbnail */
  photo: string;
};

export const HOME_SCENE =
  'radial-gradient(120% 80% at 50% 18%, #9DA2A8 0%, #7E838A 38%, #595D64 70%, #3C3F45 100%)';

export const PILLAR_HEROES: PillarHero[] = [
  {
    id: 'hr-p1',
    name: 'Ala Ala',
    role: 'Memory Hub',
    head: 'A photo album is a record. This is a memory.',
    desc: 'Where your celebrations live on — every event you hold and every event you attend, kept for life.',
    photo:
      'radial-gradient(120% 85% at 50% 25%, #B0ABA4 0%, #847d74 42%, #524c44 78%, #34302b 100%)',
  },
  {
    id: 'hr-p2',
    name: 'Likhaan',
    role: 'Creative Studio',
    head: 'Your event has a look. Give it a voice.',
    desc: 'A free studio that turns your plan into the invite, the page, the monogram, the capture — one look across it all.',
    photo: 'radial-gradient(90% 80% at 50% 40%, #B6ADBA 0%, #837b8a 42%, #463f4d 82%)',
  },
  {
    id: 'hr-p3',
    name: 'Planuhan',
    role: 'Planner',
    head: 'The planner that does the work.',
    desc: 'Guest list, seating, budget, schedule, mood board — one connected suite, free, for any event.',
    photo: 'radial-gradient(120% 90% at 50% 30%, #ABAEB2 0%, #7d8084 44%, #45484d 100%)',
  },
  {
    id: 'hr-p4',
    name: 'Surian',
    role: 'Setnayan AI',
    head: 'Twelve tabs. No decision.',
    desc: 'The quiet planning brain — the attention of a full coordination team, checking every option against your plan instantly.',
    photo: 'radial-gradient(100% 85% at 50% 35%, #A6AEB6 0%, #757d86 44%, #383f47 100%)',
  },
  {
    id: 'hr-p5',
    name: 'Tiangge',
    role: 'Marketplace',
    head: 'Vendors, verified. 0% commission.',
    desc: 'When you want vendors, they are here — verified reviews and a track record, the right price, and zero commission.',
    photo: 'linear-gradient(160deg, #BBB4AC 0%, #8a8077 46%, #524a40 100%)',
  },
];

export type FeatureCard = {
  ic: string;
  fn: string;
  /** feature blurb; `roll` is the italicized "rolling out / coming soon" tag */
  fl: ReactNode;
};

export type Pillar = {
  num: string; // "01 — Ala Ala · …"
  name: string; // headline
  def: ReactNode; // sub-copy (may contain <em>)
  widgetId: string; // dom id of the .hr-pwidget (also used by selFeat)
  barUrl: string; // address-bar text
  mocks: ReactNode[]; // the swappable preview mocks (index = feature card index)
  features: FeatureCard[];
};

/* ── Ala Ala mocks ──────────────────────────────────────────────────── */
const AlaEventTypes = (
  <div className="hr-pmock hr-m-ev" data-i="0">
    <div className="hr-me-evhead">
      <div className="hr-mk-t" style={{ marginBottom: 3 }}>
        Every event type
      </div>
      <div className="hr-mk-h" style={{ marginBottom: 0 }}>
        10 ready · more coming
      </div>
    </div>
    <div className="hr-me-evgrid">
      <span className="hr-me-ev">
        <span className="hr-me-gl">💍</span>Wedding
      </span>
      <span className="hr-me-ev">
        <span className="hr-me-gl">👑</span>Debut
      </span>
      <span className="hr-me-ev">
        <span className="hr-me-gl">🎈</span>Gender Reveal
      </span>
      <span className="hr-me-ev">
        <span className="hr-me-gl">🎂</span>Birthday
      </span>
      <span className="hr-me-ev">
        <span className="hr-me-gl">🥂</span>Celebration
      </span>
      <span className="hr-me-ev">
        <span className="hr-me-gl">✈️</span>Travel
      </span>
      <span className="hr-me-ev">
        <span className="hr-me-gl">🏢</span>Corporate
      </span>
      <span className="hr-me-ev">
        <span className="hr-me-gl">🏆</span>Tournament
      </span>
      <span className="hr-me-ev">
        <span className="hr-me-gl">🕯️</span>Christening
      </span>
      <span className="hr-me-ev">
        <span className="hr-me-gl">📅</span>Simple Event
      </span>
      <span className="hr-me-ev hr-me-soon">
        <span className="hr-me-gl">💞</span>Anniversary<span className="hr-me-tag">Soon</span>
      </span>
      <span className="hr-me-ev hr-me-soon">
        <span className="hr-me-gl">🎓</span>Graduation<span className="hr-me-tag">Soon</span>
      </span>
      <span className="hr-me-ev hr-me-soon">
        <span className="hr-me-gl">🤝</span>Reunion<span className="hr-me-tag">Soon</span>
      </span>
      <span className="hr-me-ev hr-me-soon">
        <span className="hr-me-gl">🌟</span>Gala Night<span className="hr-me-tag">Soon</span>
      </span>
    </div>
    <div className="hr-me-evnote">One memory hub for every life event — not weddings alone.</div>
  </div>
);

const AlaEditorial = (
  <div className="hr-pmock hr-me-ed" data-i="1">
    <div className="hr-me-mast">
      <span className="hr-nm">Alaala</span>
      <span className="hr-dt">The Reyes Wedding · Edition 01</span>
    </div>
    <div className="hr-me-beat">Beat 03 · The Ceremony</div>
    <h3 className="hr-me-hl">The first look.</h3>
    <div className="hr-me-spread">
      <div className="hr-me-fig" />
      <p className="hr-me-narr">
        He turned, and the whole room went quiet. <b>Twenty-two years</b> of friends and family,
        holding one breath at once.
      </p>
    </div>
    <div className="hr-me-quote">
      <span className="hr-qm">“</span>
      <p>I have never seen Lolo cry like that. The boy he raised, all grown — at the end of the aisle.</p>
      <span className="hr-att">— Tita Let, on the bride’s side</span>
    </div>
    <div className="hr-me-share">
      <span className="hr-lb">Share</span>
      <span className="hr-si">f</span>
      <span className="hr-si">◎</span>
      <span className="hr-si">𝕏</span>
      <span className="hr-si">↗</span>
      <span className="hr-more">Read full edition →</span>
    </div>
  </div>
);

const AlaDashboard = (
  <div className="hr-pmock hr-m-db2" data-i="2">
    <div className="hr-me-evhd">
      <div className="hr-mk">M&amp;J</div>
      <div className="hr-meta">
        <div className="hr-nm">Maria &amp; Jose</div>
        <div className="hr-sub">Wedding · Tagaytay Highlands</div>
      </div>
      <div className="hr-cd">Dec 12</div>
    </div>
    <div className="hr-me-tag">One event · everything in one place</div>
    <div className="hr-me-mods">
      <div className="hr-me-mod hr-live">
        <span className="hr-lab">Guests</span>
        <span className="hr-v">
          166<small> / 213</small>
        </span>
        <div className="hr-mbar">
          <i style={{ width: '78%' }} />
        </div>
      </div>
      <div className="hr-me-mod hr-live">
        <span className="hr-lab">Budget</span>
        <span className="hr-v">
          62%<small> settled</small>
        </span>
        <div className="hr-mbar">
          <i style={{ width: '62%' }} />
        </div>
      </div>
      <div className="hr-me-mod">
        <span className="hr-lab">Schedule</span>
        <span className="hr-v">9 items</span>
        <span className="hr-mchip">on track</span>
      </div>
      <div className="hr-me-mod">
        <span className="hr-lab">Seat plan</span>
        <span className="hr-v">18 tables</span>
        <span className="hr-mchip">draft</span>
      </div>
      <div className="hr-me-mod">
        <span className="hr-lab">Services</span>
        <span className="hr-v">5 active</span>
        <span className="hr-mchip">2 new</span>
      </div>
      <div className="hr-me-mod">
        <span className="hr-lab">Memories</span>
        <span className="hr-v">Editorial</span>
        <span className="hr-mchip">ready</span>
      </div>
    </div>
    <div className="hr-me-foot">
      <span className="hr-lb">Come back · share · revisit</span>
      <span className="hr-si" title="Share">
        ↗
      </span>
      <span className="hr-si hr-go" title="Revisit on the anniversary">
        ♡
      </span>
    </div>
  </div>
);

/* ── Likhaan mocks ──────────────────────────────────────────────────── */
const sw = (bg: string, h = 54): React.CSSProperties => ({
  position: 'relative',
  height: h,
  borderRadius: 8,
  background: bg,
});
const tagPill: React.CSSProperties = {
  position: 'absolute',
  bottom: 4,
  left: 4,
  fontSize: 8,
  background: 'rgba(0,0,0,.45)',
  color: '#fff',
  padding: '1px 6px',
  borderRadius: 10,
};

const LikhaanWebsite = (
  <div className="hr-pmock" data-i="0">
    <div
      style={{
        height: 72,
        borderRadius: 10,
        background: 'linear-gradient(120deg,#E7DCC8,#B7C2B0)',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--hr-serif)',
        fontStyle: 'italic',
        fontSize: 21,
        color: '#5b5347',
      }}
    >
      Claire &amp; Ice
    </div>
    <div
      style={{
        display: 'flex',
        gap: 8,
        fontSize: 10,
        fontFamily: 'var(--hr-mono)',
        letterSpacing: '.05em',
        textTransform: 'uppercase',
        color: 'var(--hr-grey-2)',
        marginBottom: 13,
      }}
    >
      <span>Story</span>
      <span>·</span>
      <span>Schedule</span>
      <span>·</span>
      <span>RSVP</span>
      <span>·</span>
      <span>Gallery</span>
    </div>
    <div className="hr-mline" style={{ width: '90%', marginBottom: 8 }} />
    <div className="hr-mline" style={{ width: '80%', marginBottom: 8 }} />
    <div className="hr-mline" style={{ width: '86%' }} />
    <div className="hr-mk-h" style={{ margin: '15px 0 0', color: '#97742f' }}>
      One link · updates live as your plan changes
    </div>
  </div>
);

const LikhaanMonogram = (
  <div className="hr-pmock" data-i="1">
    <div className="hr-mk-h">Logo &amp; monogram</div>
    <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 16px' }}>
      <div
        style={{
          width: 90,
          height: 90,
          border: '1.5px solid var(--hr-pop2)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--hr-serif)',
          fontStyle: 'italic',
          fontSize: 32,
          color: '#5b5347',
        }}
      >
        C&amp;I
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="hr-mtile"
          style={{
            textAlign: 'center',
            padding: '11px 0',
            fontFamily: 'var(--hr-serif)',
            fontStyle: 'italic',
            color: '#97742f',
          }}
        >
          C&amp;I
        </div>
      ))}
    </div>
    <div className="hr-mk-h" style={{ margin: '13px 0 0', color: 'var(--hr-grey)' }}>
      One mark — invite, signage, gallery, save-the-date.
    </div>
  </div>
);

const LikhaanPapic = (
  <div className="hr-pmock" data-i="2">
    <div className="hr-mk-h">Papic · gallery</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
      <div style={sw('linear-gradient(135deg,#cdbfa6,#9fa99a)')}>
        <span style={tagPill}>Maria</span>
      </div>
      <div style={sw('linear-gradient(135deg,#b7c2b0,#8a8f86)')}>
        <span style={tagPill}>Jose</span>
      </div>
      <div style={sw('linear-gradient(135deg,#d8cdbb,#b1a692)')} />
      <div style={sw('linear-gradient(135deg,#a9b0b8,#7d848c)')} />
      <div style={sw('linear-gradient(135deg,#cabfa9,#9aa194)')}>
        <span style={tagPill}>Kuya Ben</span>
      </div>
      <div style={sw('linear-gradient(135deg,#c0c6bd,#8f958c)')}>
        <span
          style={{ position: 'absolute', top: 4, right: 5, fontSize: 9, color: '#fff', opacity: 0.85 }}
        >
          ⦰
        </span>
      </div>
    </div>
    <div className="hr-mk-h" style={{ margin: '12px 0 0', color: '#97742f' }}>
      Tag by QR today · auto face-tagging rolling out
    </div>
  </div>
);

const LikhaanLiveStudio = (
  <div className="hr-pmock" data-i="3">
    <div className="hr-mk-h">Live Studio · live</div>
    <div
      style={{
        position: 'relative',
        height: 118,
        borderRadius: 10,
        background: 'linear-gradient(120deg,#757d86,#383f47)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 24,
      }}
    >
      ▷
      <span
        style={{
          position: 'absolute',
          top: 9,
          left: 9,
          fontFamily: 'var(--hr-mono)',
          fontSize: 9,
          letterSpacing: '.08em',
          background: '#b3402f',
          color: '#fff',
          padding: '2px 8px',
          borderRadius: 20,
        }}
      >
        ● LIVE
      </span>
      <span
        style={{
          position: 'absolute',
          top: 11,
          right: 10,
          fontFamily: 'var(--hr-mono)',
          fontSize: 9,
          color: '#fff',
          opacity: 0.9,
        }}
      >
        2,418 watching
      </span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginTop: 8 }}>
      <div className="hr-msw hr-ph" style={{ height: 32, borderRadius: 7 }} />
      <div className="hr-msw hr-ph" style={{ height: 32, borderRadius: 7 }} />
      <div className="hr-msw hr-ph" style={{ height: 32, borderRadius: 7 }} />
    </div>
    <div className="hr-mk-h" style={{ margin: '11px 0 0', color: '#97742f' }}>
      For everyone who couldn’t make the trip · live streaming rolling out
    </div>
  </div>
);

const Likhaan3D = (
  <div className="hr-pmock" data-i="4">
    <div className="hr-mk-h">3D Plan · walk to your seat</div>
    <div
      style={{
        position: 'relative',
        border: '1px solid var(--hr-line)',
        borderRadius: 10,
        height: 128,
        marginTop: 4,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '46%',
          height: 7,
          borderRadius: 4,
          background: 'rgba(197,160,89,.45)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 7,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'var(--hr-mono)',
          fontSize: 8,
          color: 'var(--hr-grey-2)',
        }}
      >
        STAGE
      </div>
      <div
        style={{
          position: 'absolute',
          inset: '34px 18px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span className="hr-mtbl" />
        <span className="hr-mtbl" style={{ borderColor: '#4F6B4A', borderWidth: '2.2px' }} />
        <span className="hr-mtbl" />
        <span className="hr-mtbl" />
      </div>
      <span
        style={{
          position: 'absolute',
          bottom: 16,
          left: 24,
          fontSize: 9,
          fontFamily: 'var(--hr-mono)',
          color: '#4F6B4A',
        }}
      >
        ● You → Table 7
      </span>
    </div>
    <div className="hr-mk-h" style={{ margin: '10px 0 0', color: '#97742f' }}>
      2D live today · 3D walk-to-seat on the roadmap
    </div>
  </div>
);

/* ── Planuhan mocks ─────────────────────────────────────────────────── */
const PlanGuests = (
  <div className="hr-pmock" data-i="0">
    <div className="hr-mk-h">Guest list · 166 / 213 going</div>
    <div className="hr-mrow">
      <span className="hr-mdot" />
      Maria Santos<span className="hr-mchip hr-ok">Going</span>
    </div>
    <div className="hr-mrow">
      <span className="hr-mdot" />
      Jose Reyes<span className="hr-mchip hr-ok">Going</span>
    </div>
    <div className="hr-mrow">
      <span className="hr-mdot" />
      Tita Let<span className="hr-mchip">No reply</span>
    </div>
    <div className="hr-mrow">
      <span className="hr-mdot" />
      Unknown — not on your list<span className="hr-mchip hr-warn">Gate-crasher</span>
    </div>
    <div className="hr-mrow">
      <span className="hr-mdot" />
      Kuya Ben<span className="hr-mchip hr-ok">Going</span>
    </div>
  </div>
);

const PlanSeat = (
  <div className="hr-pmock" data-i="1">
    <div className="hr-mk-h">Seat plan · reception</div>
    <div
      style={{
        height: 8,
        width: '60%',
        margin: '6px auto 18px',
        borderRadius: 4,
        background: 'rgba(197,160,89,.3)',
      }}
    />
    <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="hr-mtbl" />
      ))}
    </div>
    <div className="hr-mk-h" style={{ margin: '18px 0 0', color: 'var(--hr-grey)' }}>
      Rules keep the right people together — and apart.
    </div>
  </div>
);

const PlanMood = (
  <div className="hr-pmock" data-i="2">
    <div className="hr-mk-h">Mood board · your palette</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 12 }}>
      <div className="hr-msw" style={{ background: '#E7DCC8' }} />
      <div className="hr-msw" style={{ background: '#B7C2B0' }} />
      <div className="hr-msw" style={{ background: '#C9A96E' }} />
      <div className="hr-msw" style={{ background: '#8A6F55' }} />
      <div className="hr-msw" style={{ background: '#EDEAE0' }} />
    </div>
    <div className="hr-mgrid2">
      <div className="hr-msw hr-ph" style={{ height: 64, borderRadius: 10 }} />
      <div className="hr-msw hr-ph" style={{ height: 64, borderRadius: 10 }} />
    </div>
    <div className="hr-mbtn-s" style={{ marginTop: 14 }}>
      Share with all vendors →
    </div>
  </div>
);

const budgetRow = (label: string, sub: string, w: string) => (
  <>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12,
        color: 'var(--hr-ink)',
        margin: '12px 0 5px',
      }}
    >
      {label}
      <span style={{ color: 'var(--hr-grey-2)' }}>{sub}</span>
    </div>
    <div className="hr-mbar">
      <i style={{ width: w }} />
    </div>
  </>
);

const PlanBudget = (
  <div className="hr-pmock" data-i="3">
    <div className="hr-mk-h">Budget · 62% settled</div>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12,
        color: 'var(--hr-ink)',
        marginBottom: 5,
      }}
    >
      Catering<span style={{ color: 'var(--hr-grey-2)' }}>paid</span>
    </div>
    <div className="hr-mbar">
      <i style={{ width: '100%' }} />
    </div>
    {budgetRow('Venue', '50%', '50%')}
    {budgetRow('Photography', '30%', '30%')}
    <div className="hr-mk-h" style={{ margin: '16px 0 0', color: '#97742f' }}>
      Next due · Caterer final · in 12 days
    </div>
  </div>
);

const PlanDate = (
  <div className="hr-pmock" data-i="4">
    <div className="hr-mk-h">Date picker · December 2026</div>
    <div className="hr-mcal">
      <span>S</span>
      <span>M</span>
      <span>T</span>
      <span>W</span>
      <span>T</span>
      <span>F</span>
      <span>S</span>
      <span>·</span>
      <span>1</span>
      <span>2</span>
      <span>3</span>
      <span className="hr-free">4</span>
      <span>5</span>
      <span className="hr-free">6</span>
      <span>7</span>
      <span>8</span>
      <span className="hr-free">9</span>
      <span>10</span>
      <span>11</span>
      <span className="hr-on">12</span>
      <span>13</span>
      <span>14</span>
      <span className="hr-free">15</span>
      <span>16</span>
      <span>17</span>
      <span>18</span>
      <span>19</span>
      <span className="hr-free">20</span>
    </div>
    <div className="hr-mk-h" style={{ margin: '14px 0 0', color: '#97742f' }}>
      Dec 12 · 9 vendors free that day
    </div>
  </div>
);

const PlanChecklist = (
  <div className="hr-pmock" data-i="5">
    <div className="hr-mk-h">Checklist · 3 of 5 done</div>
    <div className="hr-mck">
      <span className="hr-mbox hr-on" />
      Book the venue
    </div>
    <div className="hr-mck">
      <span className="hr-mbox hr-on" />
      Send save-the-dates
    </div>
    <div className="hr-mck">
      <span className="hr-mbox hr-on" />
      Lock the caterer
    </div>
    <div className="hr-mck">
      <span className="hr-mbox" />
      Final headcount
    </div>
    <div className="hr-mck">
      <span className="hr-mbox" />
      Print seating QR sheets
    </div>
  </div>
);

const PlanPrint = (
  <div className="hr-pmock" data-i="6">
    <div className="hr-mk-h">Print / export</div>
    <div
      style={{
        flex: 1,
        border: '1px solid var(--hr-line)',
        borderRadius: 8,
        background: '#fff',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div className="hr-mline" style={{ width: '50%', height: 8, background: 'var(--hr-pop2)', opacity: 0.5 }} />
      <div className="hr-mline" style={{ width: '92%' }} />
      <div className="hr-mline" style={{ width: '84%' }} />
      <div className="hr-mline" style={{ width: '88%' }} />
      <div className="hr-mline" style={{ width: '60%' }} />
    </div>
    <div className="hr-mbtn-s" style={{ marginTop: 14 }}>
      ↧ Export PDF
    </div>
  </div>
);

const PlanScheduler = (
  <div className="hr-pmock" data-i="7">
    <div className="hr-mk-h">Scheduler · day-of</div>
    <div className="hr-mtl-row">
      <span className="hr-t">2:00 PM</span>Crew call · setup begins
    </div>
    <div className="hr-mtl-row">
      <span className="hr-t">4:00 PM</span>Ceremony
    </div>
    <div className="hr-mtl-row">
      <span className="hr-t">6:30 PM</span>Reception · dinner
    </div>
    <div className="hr-mtl-row">
      <span className="hr-t">8:00 PM</span>First dance
    </div>
    <div className="hr-mtl-row">
      <span className="hr-t">10:30 PM</span>Send-off
    </div>
  </div>
);

/* ── Surian mocks ───────────────────────────────────────────────────── */
const SurianFilter = (
  <div className="hr-pmock" data-i="0">
    <div className="hr-mk-h">Smart filtering · photography</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 13 }}>
      <span style={{ fontFamily: 'var(--hr-serif)', fontStyle: 'italic', fontSize: 28, color: '#2f2d2a' }}>
        6
      </span>
      <span style={{ fontSize: 11, color: 'var(--hr-grey)' }}>of 847 vendors fit your plan</span>
    </div>
    <div className="hr-mrow">
      <span className="hr-mdot" />
      Studio Sereno<span className="hr-mchip hr-ok">92% fit</span>
    </div>
    <div className="hr-mrow">
      <span className="hr-mdot" />
      Lumière Films<span className="hr-mchip hr-ok">88% fit</span>
    </div>
    <div className="hr-mrow">
      <span className="hr-mdot" />
      North Light Co.<span className="hr-mchip hr-ok">85% fit</span>
    </div>
    <div className="hr-mk-h" style={{ margin: '13px 0 0', color: '#97742f' }}>
      Budget · date · style — every option checked instantly
    </div>
  </div>
);

const SurianChecklist = (
  <div className="hr-pmock" data-i="1">
    <div className="hr-mk-h">Adaptive checklist · reshaped</div>
    <div className="hr-mck">
      <span className="hr-mbox hr-on" />
      Lock the date
    </div>
    <div className="hr-mck">
      <span className="hr-mbox hr-on" />
      Book the venue
    </div>
    <div className="hr-mck">
      <span className="hr-mbox" />
      Book the caterer
      <span
        style={{
          color: '#97742f',
          marginLeft: 8,
          fontSize: 10,
          fontFamily: 'var(--hr-mono)',
          textTransform: 'uppercase',
          letterSpacing: '.05em',
        }}
      >
        now, to stay on pace
      </span>
    </div>
    <div className="hr-mck">
      <span className="hr-mbox" />
      Send save-the-dates
    </div>
    <div className="hr-mck">
      <span className="hr-mbox" />
      Final headcount
    </div>
    <div className="hr-mk-h" style={{ margin: '12px 0 0', color: '#97742f' }}>
      Re-paced for Dec 12 · 164 days out
    </div>
  </div>
);

const surianBudgetRow = (label: string, pct: string, w: string, first = false) => (
  <>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12,
        color: 'var(--hr-ink)',
        margin: first ? '0 0 5px' : '11px 0 5px',
      }}
    >
      {label}
      <span style={{ color: 'var(--hr-grey-2)' }}>{pct}</span>
    </div>
    <div className="hr-mbar">
      <i style={{ width: w }} />
    </div>
  </>
);

const SurianBudget = (
  <div className="hr-pmock" data-i="2">
    <div className="hr-mk-h">Smart budgeting · ₱420,000</div>
    {surianBudgetRow('Venue', '35%', '35%', true)}
    {surianBudgetRow('Catering', '30%', '30%')}
    {surianBudgetRow('Photography', '12%', '12%')}
    {surianBudgetRow('Everything else', '23%', '23%')}
    <div className="hr-mk-h" style={{ margin: '14px 0 0', color: '#97742f' }}>
      Adjusts as guests, date, and choices shift
    </div>
  </div>
);

const SurianAutoBuild = (
  <div className="hr-pmock" data-i="3">
    <div className="hr-mk-h">Auto Build · 150 pax</div>
    <div className="hr-mrow">
      Venue<span className="hr-mchip">from ₱120,000</span>
    </div>
    <div className="hr-mrow">
      Catering · 150 pax<span className="hr-mchip">from ₱150,000</span>
    </div>
    <div className="hr-mrow">
      Photography<span className="hr-mchip">from ₱45,000</span>
    </div>
    <div className="hr-mrow">
      Coordination<span className="hr-mchip">from ₱35,000</span>
    </div>
    <div className="hr-mk-h" style={{ margin: '13px 0 0', color: 'var(--hr-pop1)' }}>
      One tap · from each vendor’s starting price for your pax · coming soon
    </div>
  </div>
);

/* ── Tiangge mocks ──────────────────────────────────────────────────── */
const TiVerified = (
  <div className="hr-pmock" data-i="0">
    <div className="hr-mk-h">Verified vendors</div>
    <div className="hr-mrow">
      <span className="hr-mdot" />
      Studio Sereno · Photography<span className="hr-mchip hr-ok">✓ Verified</span>
    </div>
    <div className="hr-mrow">
      <span className="hr-mdot" />
      Bloom &amp; Co. Florals<span className="hr-mchip hr-ok">✓ Verified</span>
    </div>
    <div className="hr-mrow">
      <span className="hr-mdot" />
      Manila Caterer<span className="hr-mchip hr-ok">✓ Verified</span>
    </div>
    <div className="hr-mrow">
      <span className="hr-mdot" />
      Tagaytay Coordinator<span className="hr-mchip hr-ok">✓ Verified</span>
    </div>
    <div className="hr-mk-h" style={{ margin: '12px 0 0', color: '#97742f' }}>
      Checked before they ever reach you
    </div>
  </div>
);

const TiTrack = (
  <div className="hr-pmock" data-i="1">
    <div className="hr-mk-h">Track record · Studio Sereno</div>
    <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', marginBottom: 11 }}>
      <span style={{ fontFamily: 'var(--hr-serif)', fontStyle: 'italic', fontSize: 26, color: '#2f2d2a' }}>
        4.9
      </span>
      <span style={{ color: 'var(--hr-pop2)', letterSpacing: '1px' }}>★★★★★</span>
      <span style={{ fontSize: 11, color: 'var(--hr-grey)' }}>· 3 past events</span>
    </div>
    <div
      className="hr-mtile"
      style={{ marginBottom: 8, fontSize: 11.5, color: 'var(--hr-ink)', lineHeight: 1.45 }}
    >
      “Showed up early, delivered in a week.” <span style={{ color: 'var(--hr-grey-2)' }}>— Ana, Dec 2025</span>
    </div>
    <div className="hr-mtile" style={{ fontSize: 11.5, color: 'var(--hr-ink)', lineHeight: 1.45 }}>
      “Exactly the look we moodboarded.” <span style={{ color: 'var(--hr-grey-2)' }}>— Paolo, Oct 2025</span>
    </div>
    <div className="hr-mk-h" style={{ margin: '12px 0 0', color: '#97742f' }}>
      Verified reviews from real events — not a curated portfolio
    </div>
  </div>
);

const TiPerf = (
  <div className="hr-pmock" data-i="2">
    <div className="hr-mk-h">Performance breakdown</div>
    {surianBudgetRow('Response time', 'avg 2 hrs', '92%', true)}
    {surianBudgetRow('Re-book rate', '78%', '78%')}
    {surianBudgetRow('Completion', '100%', '100%')}
    <div className="hr-mk-h" style={{ margin: '14px 0 0', color: 'var(--hr-pop1)' }}>
      The numbers behind the rating · rolling out
    </div>
  </div>
);

const TiQuote = (
  <div className="hr-pmock" data-i="3">
    <div className="hr-mk-h">Your custom quote</div>
    <div className="hr-mrow">
      Coverage · 8 hrs<span className="hr-mchip">included</span>
    </div>
    <div className="hr-mrow">
      Second shooter<span className="hr-mchip hr-ok">added</span>
    </div>
    <div className="hr-mrow">
      Same-day reel<span className="hr-mchip hr-ok">added</span>
    </div>
    <div className="hr-mrow">
      Album · 30 pages<span className="hr-mchip hr-ok">added</span>
    </div>
    <div className="hr-mk-h" style={{ margin: '12px 0 0', color: '#97742f' }}>
      Every spec you want — at the right price, not one-size-fits-all
    </div>
  </div>
);

const TiExclusive = (
  <div className="hr-pmock" data-i="4">
    <div className="hr-mk-h">Setnayan Exclusive</div>
    <div className="hr-mtile" style={{ textAlign: 'center', padding: '22px 14px' }}>
      <div style={{ fontSize: 24, color: 'var(--hr-pop2)' }}>✦</div>
      <div
        style={{
          fontFamily: 'var(--hr-serif)',
          fontStyle: 'italic',
          fontSize: 19,
          color: '#2f2d2a',
          marginTop: 7,
        }}
      >
        Free engagement shoot
      </div>
      <div style={{ fontSize: 11, color: 'var(--hr-grey)', marginTop: 5 }}>
        Only when you book Studio Sereno through Setnayan
      </div>
    </div>
    <div className="hr-mk-h" style={{ margin: '12px 0 0', color: '#97742f' }}>
      A gift from every vendor — found only here
    </div>
  </div>
);

const TiCommission = (
  <div className="hr-pmock" data-i="5">
    <div className="hr-mk-h">What you pay</div>
    <div className="hr-mrow">
      Vendor’s price<span style={{ marginLeft: 'auto', color: 'var(--hr-ink)' }}>₱85,000</span>
    </div>
    <div className="hr-mrow">
      Setnayan commission
      <span style={{ marginLeft: 'auto', color: '#46663f', fontWeight: 600 }}>₱0</span>
    </div>
    <div className="hr-mrow" style={{ borderBottom: 'none' }}>
      <b style={{ fontSize: 13, color: '#2f2d2a' }}>You pay</b>
      <span
        style={{
          marginLeft: 'auto',
          fontFamily: 'var(--hr-serif)',
          fontStyle: 'italic',
          fontSize: 21,
          color: '#2f2d2a',
        }}
      >
        ₱85,000
      </span>
    </div>
    <div className="hr-mk-h" style={{ margin: '11px 0 0', color: '#97742f' }}>
      0% commission · no cut off the top
    </div>
  </div>
);

export const PILLARS: Pillar[] = [
  {
    num: '01 — Ala Ala · Your collection of memories, kept for life',
    name: 'A photo album is a record. This is a memory.',
    def: (
      <>
        This is the heart of it. The plan ends when the day ends; the memory doesn’t have to. Every
        event you <em>hold</em> and every event you <em>attend</em> lands here — your growing
        collection of memories, kept safe, accumulating year over year in one place that belongs to
        you. Not a tool you close after the day. A home you keep coming back to.
      </>
    ),
    widgetId: 'hr-awAla',
    barUrl: 'setnayan.com/ala-ala',
    mocks: [AlaEventTypes, AlaEditorial, AlaDashboard],
    features: [
      {
        ic: '◈',
        fn: 'Every event type',
        fl: (
          <>
            Ten event types ready today — wedding, debut, birthday, christening, gender reveal,
            celebration, travel, corporate, tournament, and a simple event — with anniversary,
            graduation, reunion, and gala night rolling out. The widest variety in the market.{' '}
            <em>10 live · 4 rolling out</em>
          </>
        ),
      },
      {
        ic: '¶',
        fn: 'Editorials',
        fl: 'Far more memorable than scribbling in a photo album. Every event becomes an editorial — a real storyline you can relive, as if you were there again: write-ups, photos, what your guests said, and short clips (not full films) — shareable straight to your socials. The front-page story of your life.',
      },
      {
        ic: '▦',
        fn: 'Dashboard',
        fl: 'The all-in-one command center for a single event — guests, budget, schedule, services, and memories in one place you come back to, share, and revisit on the anniversaries. (Your home lists every event; this one runs the event itself.)',
      },
    ],
  },
  {
    num: '02 — Likhaan · Creative Studio',
    name: 'Your event has a look. Give it a voice.',
    def: (
      <>
        <em>Likhaan</em> means “a place to create.” A free studio that turns your plan into something
        guests can see and feel — an adaptive website that stays alive, your own monogram, Papic
        candid capture, Live Studio, and the 3D Plan. And it keeps growing.
      </>
    ),
    widgetId: 'hr-awLikhaan',
    barUrl: 'setnayan.com/claire-and-ice',
    mocks: [LikhaanWebsite, LikhaanMonogram, LikhaanPapic, LikhaanLiveStudio, Likhaan3D],
    features: [
      {
        ic: '◷',
        fn: 'Adaptive website',
        fl: 'A single-link event page that changes and adapts to what’s happening, in real time. No more static sites — it adjusts from planning all the way to the end of the event, finishing as your very own editorial.',
      },
      {
        ic: '❖',
        fn: 'Logo & monogram',
        fl: 'Logo and monogram designs that stay simple, but far more efficient than what’s on the market — your mark across every surface of the event.',
      },
      {
        ic: '◎',
        fn: 'Papic',
        fl: (
          <>
            Modern event capture — themes, face-blocking, and face tagging. Tag by QR today; auto
            face-tagging is rolling out. Either way, every photo lands in your gallery.{' '}
            <em>Auto-tagging rolling out</em>
          </>
        ),
      },
      {
        ic: '▷',
        fn: 'Live Studio',
        fl: (
          <>
            Document the event without high-end cameras — stream it live to everyone who couldn’t be
            there. <em>Live streaming rolling out</em>
          </>
        ),
      },
      {
        ic: '⬡',
        fn: '3D Plan',
        fl: (
          <>
            Your 2D seat plan, guest list, and mood board are free. The full 3D Plan — a 3D
            walk-to-seat your guests open right on your website — is the paid unlock. 2D live today;{' '}
            <em>3D on the roadmap</em>.
          </>
        ),
      },
      {
        ic: '✦',
        fn: 'And it keeps growing',
        fl: 'We continuously add new creative tools to push your event further — and they land already connected to everything you’ve made.',
      },
    ],
  },
  {
    num: '03 — Planuhan · Planner',
    name: 'Your spreadsheet doesn’t know your day.',
    def: (
      <>
        <em>Planuhan</em> means “a place to plan.” A free, connected suite where every piece talks to
        the others — guest list, seat plan, budget, date picker, checklist, scheduler. Change one
        thing and the whole plan stays honest. The reason to open the app on a Tuesday night.
      </>
    ),
    widgetId: 'hr-awPlanuhan',
    barUrl: 'setnayan.com/planuhan',
    mocks: [
      PlanGuests,
      PlanSeat,
      PlanMood,
      PlanBudget,
      PlanDate,
      PlanChecklist,
      PlanPrint,
      PlanScheduler,
    ],
    features: [
      {
        ic: '◍',
        fn: 'Guest list',
        fl: (
          <>
            Guests self-RSVP, each with their own QR code, and you add anyone yourself. Flag
            gate-crashers — people who RSVP but aren’t on your list — and give every guest a personal
            assistant. <em>Gate-crasher flagging + assistant rolling out</em>
          </>
        ),
      },
      {
        ic: '⊞',
        fn: 'Seat plan',
        fl: (
          <>
            So much easier, with clean integration to the guest list. Set rules so the guests who
            should be kept apart always are. 2D live today. <em>3D walk-to-seat rolling out</em>
          </>
        ),
      },
      {
        ic: '❑',
        fn: 'Mood board',
        fl: 'Create palettes and collect your inspirations in one place — then share them with all your vendors in one tap.',
      },
      {
        ic: '₱',
        fn: 'Budget planner',
        fl: 'Track every payment in one place, with a schedule that guides you to what’s due next — so nothing slips.',
      },
      {
        ic: '◷',
        fn: 'Date picker',
        fl: 'No longer a one-pick gamble. No research, no statistics to chase — we hand you the best information on your target dates, with tips and a list of every compatible vendor free that day.',
      },
      {
        ic: '✓',
        fn: 'Checklist',
        fl: 'A guide that makes sure you don’t skip the things that make your event work.',
      },
      {
        ic: '▤',
        fn: 'Printable PDF',
        fl: (
          <>
            Free to print — seating, mood board, QR, and invites today, with every Planuhan tool
            rolling out. <em>All tools printable rolling out</em>
          </>
        ),
      },
      {
        ic: '◔',
        fn: 'Scheduler',
        fl: 'The complete schedule of everything you need, so nothing is forgotten.',
      },
    ],
  },
  {
    num: '04 — Surian · Setnayan AI',
    name: 'Twelve tabs, and you’ve decided nothing.',
    def: (
      <>
        <em>Surian</em> means “where every option is weighed.” The quiet planning brain — the
        attention of a full coordination team, checking every option against your plan instantly. It
        narrows the field to a few good options, reshapes your checklist, and guides your budget, so
        you choose instead of drown. <span style={{ opacity: 0.7 }}>Unlocks with a paid tier.</span>
      </>
    ),
    widgetId: 'hr-awSurian',
    barUrl: 'setnayan.com/surian',
    mocks: [SurianFilter, SurianChecklist, SurianBudget, SurianAutoBuild],
    features: [
      {
        ic: '⌖',
        fn: 'Smart filtering',
        fl: 'Thinking of many things at once is hard. The adaptive system paces and adjusts itself to filter your planning, so any service you pick fits your plan — no more inquiring into dead ends and losing hours.',
      },
      {
        ic: '✓',
        fn: 'Adaptive checklist',
        fl: 'An advanced checklist that adjusts and computes all your steps, for steady-paced planning with far less stress.',
      },
      {
        ic: '₱',
        fn: 'Smart budgeting',
        fl: 'Always know exactly where your budget stands, and it adjusts properly as guests, dates, and choices shift.',
      },
      {
        ic: '◆',
        fn: 'Auto Build',
        fl: (
          <>
            No time to line up vendors? One tap builds a full service set from each vendor’s starting
            price for your guest count (your pax is shown up front), ready to adjust.{' '}
            <em>Coming soon</em>
          </>
        ),
      },
    ],
  },
  {
    num: '05 — Tiangge · Marketplace',
    name: 'And when you want vendors — verified, 0% commission.',
    def: (
      <>
        <em>Tiangge</em> — the marketplace, when you want it. You don’t need it to get full value:
        Planuhan, Likhaan, and Ala Ala stand on their own. But when you’re ready for vendors, they’re
        verified, with real reviews and a track record, the right price, and 0% commission.
        Supporting cast — there when you’re ready, invisible when you’re not.
      </>
    ),
    widgetId: 'hr-awTiangge',
    barUrl: 'setnayan.com/marketplace',
    mocks: [TiVerified, TiTrack, TiPerf, TiQuote, TiExclusive, TiCommission],
    features: [
      {
        ic: '✓',
        fn: 'Verified & checked',
        fl: 'Every vendor is verified and checked before they ever reach you.',
      },
      {
        ic: '▥',
        fn: 'Track record you can trust',
        fl: 'Verified reviews and a real track record from their past events — not a portfolio they curated to flatter themselves.',
      },
      {
        ic: '▲',
        fn: 'Performance breakdown',
        fl: (
          <>
            Response time, re-book rate, and completion — the numbers that show how a vendor actually
            performs. <em>Rolling out</em>
          </>
        ),
      },
      {
        ic: '❖',
        fn: 'Customized, at the right price',
        fl: 'No one price, one product for everyone. You keep the personal experience of talking to your vendors and customizing everything to the very end — every specification you want, at the right price.',
      },
      {
        ic: '✦',
        fn: 'Setnayan Exclusive',
        fl: 'Each vendor gives you a special gift available only at Setnayan — plus special discounts, gifts, and benefits.',
      },
      {
        ic: '⊘',
        fn: '0% commission',
        fl: 'What the vendor charges is what you pay. We don’t take a cut off the top.',
      },
    ],
  },
];
