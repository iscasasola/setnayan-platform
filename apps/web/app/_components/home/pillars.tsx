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
import Link from 'next/link';

export type PillarHero = {
  /** stable tile id (also the admin background-video slot key) */
  id: string;
  /**
   * Anchor id of the below-fold section this tile's "Learn more" jumps to —
   * Decoupled from `id` because the below-fold sections still render the
   * original five pillar suites (see PILLAR_SECTION_IDS).
   */
  sectionId: string | null;
  /**
   * When set, jumping ALSO pre-selects this feature card in the target
   * pillar's interactive widget (pillar = index into PILLARS, card = index
   * into that pillar's mocks/features) and centers it in the carousel — so
   * the product tiles (Papic · Panood · 3D Plan) land on the Likha section
   * with their own preview already showing.
   */
  feat?: { pillar: number; card: number };
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

// Dock assignment (owner 2026-07-03): the five dock tiles are the flagship
// PRODUCTS — Ala ala (Memory Hub) · Suri (Setnayan AI) · Papic · Panood · 3D
// Plan. Suri opens the one-page Setnayan AI story takeover. Every tile has a
// jump target on the page (owner 2026-07-03): Ala ala → its own section,
// Suri → the Suri section, and Papic / Panood / 3D Plan → the Likha section
// with their feature card pre-selected (`feat`). Slot gradients + anchor ids
// retained from the prior pillar dock (the admin background-video slots are
// positional — /admin/background-videos labels may want a refresh).
export const PILLAR_HEROES: PillarHero[] = [
  {
    id: 'hr-p1',
    sectionId: 'hr-p1',
    name: 'Ala ala',
    role: 'Memory Hub',
    head: 'A gallery stores photos. This keeps the memory.',
    desc: 'Free, for life — every event you host and attend, kept as a living story long after the day.',
    photo:
      'radial-gradient(120% 85% at 50% 25%, #B0ABA4 0%, #847d74 42%, #524c44 78%, #34302b 100%)',
  },
  {
    id: 'hr-p2',
    sectionId: 'hr-p4',
    name: 'Suri',
    role: 'Setnayan AI',
    head: 'Skip the chatbot. It watches your event for you.',
    desc: 'Your planning brain — it tracks the vendors you’re eyeing and the ones you’ve booked, and taps you only when something actually needs you.',
    photo: 'radial-gradient(100% 85% at 50% 35%, #A6AEB6 0%, #757d86 44%, #383f47 100%)',
  },
  {
    id: 'hr-p3',
    sectionId: 'hr-p2',
    feat: { pillar: 1, card: 2 }, // Likha → Papic preview
    name: 'Papic',
    role: 'Candid capture',
    head: 'No photographer can be everywhere. Guests can.',
    desc: 'Your crew and guests catch what one photographer can’t — every photo and clip lands in one gallery, tagged to who’s in it, in real time.',
    photo: 'radial-gradient(90% 80% at 50% 40%, #B6ADBA 0%, #837b8a 42%, #463f4d 82%)',
  },
  {
    id: 'hr-p4',
    sectionId: 'hr-p2',
    feat: { pillar: 1, card: 3 }, // Likha → Live Studio preview
    name: 'Panood',
    role: 'Live Studio',
    head: 'The ones who couldn’t come get a front-row seat.',
    desc: 'Stream straight to your event page in one tap — free with a single camera. Bring the multicam control room when you want a full broadcast.',
    photo: 'radial-gradient(120% 90% at 50% 30%, #ABAEB2 0%, #7d8084 44%, #45484d 100%)',
  },
  {
    id: 'hr-p5',
    sectionId: 'hr-p2',
    feat: { pillar: 1, card: 4 }, // Likha → 3D Plan preview
    name: '3D Plan',
    role: 'Seating in 3D',
    head: 'Stand in the room before the day arrives.',
    desc: 'Build your seating chart, then step inside it in 3D — place every table, check the sightlines, and walk the room as your guests will.',
    photo: 'linear-gradient(160deg, #BBB4AC 0%, #8a8077 46%, #524a40 100%)',
  },
];

/** Anchor ids for the below-fold pillar sections, in PILLARS order (the
 *  original five suites: Ala Ala · Likha · Plano · Suri · Tiangge). Kept as
 *  the historical hr-p1..p5 so PillarHero.sectionId can target them. */
export const PILLAR_SECTION_IDS = ['hr-p1', 'hr-p2', 'hr-p3', 'hr-p4', 'hr-p5'];

export type FeatureCard = {
  ic: string;
  fn: string;
  /** feature blurb; `roll` is the italicized "rolling out / coming soon" tag */
  fl: ReactNode;
};

export type Pillar = {
  num: string; // '01' — section numeral (serif, gold)
  tag: string; // Filipino pillar name — 'Ala Ala'
  role: string; // English role — 'Memory Hub' (per <name> · <role> convention)
  name: string; // headline — the owner-authored hook line
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
      <span className="hr-dt">Maria &amp; Juan · Edition 01</span>
    </div>
    <div className="hr-me-beat">Beat 02 · The first look</div>
    <h3 className="hr-me-hl">The exact second his composure gave up.</h3>
    <div className="hr-me-spread">
      <div className="hr-me-fig" />
      <p className="hr-me-narr">
        Juan waited at the end of the garden path with his back turned. He heard her step on the
        gravel — and <b>nobody coached what happened next</b>.
      </p>
    </div>
    <div className="hr-me-quote">
      <span className="hr-qm">“</span>
      <p>When Maria walked in, the whole garden went quiet. Even the birds.</p>
      <span className="hr-att">— Ate Celine, Maid of Honor</span>
    </div>
    <div className="hr-me-share">
      <span className="hr-lb">Share</span>
      <span className="hr-si">f</span>
      <span className="hr-si">◎</span>
      <span className="hr-si">𝕏</span>
      <span className="hr-si">↗</span>
      {/* Two COMPLETE sample editorials (owner 2026-07-03) — these are real,
          readable pages at /realstories, not mock chrome. */}
      <Link className="hr-more" href="/realstories/maria-and-juan-tagaytay-garden-wedding">
        Read full edition →
      </Link>
    </div>
    <div className="hr-mk-h" style={{ margin: '10px 0 0', color: '#97742f' }}>
      <Link href="/realstories/sofia-reyes-makati-debut" style={{ color: 'inherit' }}>
        Also complete: Sofia&rsquo;s debut · Edition 06 →
      </Link>
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

/* ── Likha mocks ──────────────────────────────────────────────────── */
const sw = (bg: string, h = 54): React.CSSProperties => ({
  position: 'relative',
  height: h,
  borderRadius: 'var(--hr-r8)',
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
  borderRadius: 'var(--hr-r10)',
};

const LikhaanWebsite = (
  <div className="hr-pmock" data-i="0">
    <div
      style={{
        height: 72,
        borderRadius: 'var(--hr-r10)',
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
    <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
      {['Orig', 'Retro', 'Mono', 'Cine', 'Lomo'].map((s, i) => (
        <span
          key={s}
          style={{
            fontFamily: 'var(--hr-mono)',
            fontSize: 8.5,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            padding: '3px 9px',
            borderRadius: 'var(--hr-r20)',
            border: '1px solid var(--hr-line)',
            background: i === 0 ? '#2f2d2a' : 'transparent',
            color: i === 0 ? '#f2f0ec' : 'var(--hr-grey)',
          }}
        >
          {s}
        </span>
      ))}
    </div>
    <div className="hr-mk-h" style={{ margin: '10px 0 0', color: '#97742f' }}>
      Five looks · face tagging on the phone · try it live from the Papic tile
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
        borderRadius: 'var(--hr-r10)',
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
          borderRadius: 'var(--hr-r20)',
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
      <div className="hr-msw hr-ph" style={{ height: 32, borderRadius: 'var(--hr-r7)' }} />
      <div className="hr-msw hr-ph" style={{ height: 32, borderRadius: 'var(--hr-r7)' }} />
      <div className="hr-msw hr-ph" style={{ height: 32, borderRadius: 'var(--hr-r7)' }} />
    </div>
    <div className="hr-mk-h" style={{ margin: '11px 0 0', color: '#97742f' }}>
      A real control room — cut between phone cameras live · try it from the Panood tile
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
        borderRadius: 'var(--hr-r10)',
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
          borderRadius: 'var(--hr-r4)',
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
      Click a guest → their phone walks entrance to seat · try it from the 3D Plan tile
    </div>
  </div>
);

/* ── Plano mocks ─────────────────────────────────────────────────── */
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
        borderRadius: 'var(--hr-r4)',
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
      <div className="hr-msw hr-ph" style={{ height: 64, borderRadius: 'var(--hr-r10)' }} />
      <div className="hr-msw hr-ph" style={{ height: 64, borderRadius: 'var(--hr-r10)' }} />
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
        borderRadius: 'var(--hr-r8)',
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

/* ── Suri mocks ───────────────────────────────────────────────────── */
const SurianFilter = (
  <div className="hr-pmock" data-i="0">
    <div className="hr-mk-h">Filtering &amp; sorting · photography</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 13 }}>
      <span style={{ fontFamily: 'var(--hr-serif)', fontStyle: 'italic', fontSize: 28, color: '#2f2d2a' }}>
        6
      </span>
      <span style={{ fontSize: 11, color: 'var(--hr-grey)' }}>of 847 vendors fit your plan — ranked</span>
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
      Budget · date · venue · style — checked and ranked in an instant
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

const SurianWatch = (
  <div className="hr-pmock" data-i="3">
    <div className="hr-mk-h">The watch system · standing guard</div>
    <div className="hr-mrow">
      <span className="hr-mdot" />
      Deposit due Friday · Bloom &amp; Co.<span className="hr-mchip hr-ok">tapped you</span>
    </div>
    <div className="hr-mrow">
      <span className="hr-mdot" />
      Quote changed −₱8,000 · Lumière<span className="hr-mchip hr-ok">flagged</span>
    </div>
    <div className="hr-mrow">
      <span className="hr-mdot" />
      Double-booking risk · Dec 12<span className="hr-mchip hr-ok">caught</span>
    </div>
    <div className="hr-mrow">
      <span className="hr-mdot" />
      Everything else<span className="hr-mchip">quiet</span>
    </div>
    <div className="hr-mk-h" style={{ margin: '13px 0 0', color: '#97742f' }}>
      One calm weekly digest — loud only when it can&rsquo;t wait
    </div>
  </div>
);

const SurianAutoBuild = (
  <div className="hr-pmock" data-i="4">
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
    num: '01',
    tag: 'Ala Ala',
    role: 'Memory Hub',
    name: 'A photo album is just a record. This is the memory itself.',
    def: (
      <>
        The heart of it all. Planning ends when the day is over — your memories shouldn’t have to.
        Every event you <em>hold</em> and every event you <em>attend</em> lives on here, one
        continuous archive that grows richer year after year. Not a tool you close after the guests
        leave. A home you keep coming back to.
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
        fl: (
          <>
            Far more memorable than scribbling in a photo album. Every event becomes an editorial —
            a real storyline you can relive, as if you were there again: write-ups, photos, what
            your guests said, and short clips (not full films) — shareable straight to your socials.
            The front-page story of your life.{' '}
            <em>
              Read two complete sample editions now — a Tagaytay wedding and a Makati debut.
            </em>
          </>
        ),
      },
      {
        ic: '▦',
        fn: 'Dashboard',
        fl: 'The all-in-one command center for a single event — guests, budget, schedule, services, and memories in one place you come back to, share, and revisit on the anniversaries. (Your home lists every event; this one runs the event itself.)',
      },
    ],
  },
  {
    num: '02',
    tag: 'Likha',
    role: 'Creative Studio',
    name: 'Your event has a look. Give it a voice.',
    def: (
      <>
        <em>Likha</em> means “to create.” Your free creative studio — the whole look and feel of
        your celebration in one workspace: an adaptive website that stays alive, your own monogram,
        Papic candid capture, Live Studio for the ones who couldn’t make the trip, and the 3D Plan.
        And it keeps growing.
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
            Modern candid capture — five looks (Original · Retro · Mono · Cine · Lomo), face tagging
            that happens right on the phone, and every photo lands in your gallery, tagged or not.{' '}
            <em>Try it live from the Papic tile — you and a friend, right now.</em>
          </>
        ),
      },
      {
        ic: '▷',
        fn: 'Live Studio',
        fl: (
          <>
            Your phones become the cameras, and you get a real control room — cut between angles
            live for everyone who couldn’t make the trip. <em>Try the control room from the Panood
            tile — two phones.</em> Full event livestream rolling out.
          </>
        ),
      },
      {
        ic: '⬡',
        fn: '3D Plan',
        fl: (
          <>
            Click a guest and their phone walks them from the entrance to their seat — in a real 3D
            room, right on your website. <em>Try it from the 3D Plan tile.</em> Your 2D seat plan,
            guest list, and mood board stay free; the full 3D Plan is the paid unlock.
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
    num: '03',
    tag: 'Plano',
    role: 'The Ultimate Planner',
    name: 'Your spreadsheet doesn’t know your day.',
    def: (
      <>
        <em>Plano</em> means “to plan.” Gone are the days of scattered documents. One free,
        connected suite where every detail intertwines — change a single thing and the guest list,
        seat plan, budget, checklist, and schedule all stay honest, automatically. The reason to
        open the app on a Tuesday night.
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
            Free to print — seating, mood board, QR, and invites today, with every Plano tool
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
    num: '04',
    tag: 'Suri',
    role: 'Setnayan AI',
    name: 'You are the host, not the coordinator.',
    def: (
      <>
        <em>Suri</em> means “to analyze closely.” The quiet planning brain — it checks every option
        against your budget, date, and venue in an instant and ranks the short list worth choosing
        from, reshapes your checklist and budget as things change, and stands watch over every
        vendor you’re eyeing or booked — catching risks before they happen. You choose instead of
        drown. <span style={{ opacity: 0.7 }}>Unlocks with a paid tier.</span>
      </>
    ),
    widgetId: 'hr-awSurian',
    barUrl: 'setnayan.com/surian',
    mocks: [SurianFilter, SurianChecklist, SurianBudget, SurianWatch, SurianAutoBuild],
    features: [
      {
        ic: '⌖',
        fn: 'Filtering & sorting',
        fl: 'Thinking of many things at once is hard. Every option is checked against your budget, date, venue, and style in an instant — then ranked, so the best fits surface first. No more inquiring into dead ends and losing hours.',
      },
      {
        ic: '✓',
        fn: 'Adaptive checklist',
        fl: 'The adaptive system reshapes your checklist as things change — every step re-paced and recomputed around your date, guest count, and picks, so planning stays steady instead of frantic.',
      },
      {
        ic: '₱',
        fn: 'Smart budgeting',
        fl: 'The budget planner always knows where you stand. Allocations adjust on their own as guests, dates, and choices shift — every peso visible, nothing recomputed by hand.',
      },
      {
        ic: '◉',
        fn: 'The watch system',
        fl: 'It watches the vendors you’re eyeing and the ones you’ve booked — a deposit due, a price change, a double-booking, a deadline about to slip. One calm weekly digest; loud only when it can’t wait.',
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
    num: '05',
    tag: 'Tiangge',
    role: 'The Marketplace',
    name: 'Supporting cast — there when you’re ready, invisible when you’re not.',
    def: (
      <>
        <em>Tiangge</em> — the marketplace, on your terms. Plano, Likha, and Ala Ala stand on their
        own; when you’re ready for vendors, they arrive verified, with real reviews and a real
        track record, matched to what you actually need. Talking to them is free — and commission
        is 0%. What the vendor charges is what you pay.
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
