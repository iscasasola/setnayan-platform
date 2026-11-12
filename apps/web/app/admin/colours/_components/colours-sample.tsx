import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight, Calendar, Check, CreditCard, Lock, MessageSquare, Pencil, Plus, Send, ShoppingBasket } from 'lucide-react';
import {
  FRAME_LIFT_SHADOW,
  TILE_KEYS,
  TILE_LABEL,
  derive,
  lightestPoint,
  type AppColours,
  type JobKey,
} from '@/lib/app-colours';
import s from './colours-preview.module.css';

/** The draft as the preview's own custom properties — the preview reads these and nothing of the app's. */
export function previewVars(d: AppColours): CSSProperties {
  return {
    '--pv-bg': d.page,
    '--pv-g1': d.bandFrom,
    '--pv-g2': d.bandTo,
    '--pv-ga': d.bandAngle,
    '--pv-band-ink': 'rgb(var(--sn-on-band))',
    '--pv-card': d.frameFill,
    '--pv-r': `${d.frameRadius}px`,
    '--pv-sh': FRAME_LIFT_SHADOW[d.frameLift],
    '--pv-money': d.money,
    '--pv-decision': d.decision,
    '--pv-dword': derive.decisionWord(d.decision),
    '--pv-priv': d.private,
    '--pv-priv-text': derive.privateText(d.private),
    '--pv-priv-tint': derive.privateTint(d.private),
    '--pv-toggle': d.toggle,
    '--pv-booked': d.tiles.booked,
    '--pv-schedule': d.tiles.schedule,
    '--pv-asked': d.tiles.asked,
    '--pv-collect': d.tiles.collect,
  } as CSSProperties;
}

export const pv = s;

function Cat({ tc, w, icon, name, note }: { tc: string; w: string; icon: ReactNode; name: string; note: string }) {
  return (
    <div className={s.cat} style={{ '--tc': tc, '--w': w } as CSSProperties}>
      <span className={s.tile}>{icon}</span>
      <div className={s.catText}>
        <b>
          {name}
          <small>{note}</small>
        </b>
        <div className={s.bar}>
          <i />
        </div>
      </div>
    </div>
  );
}

/**
 * A couple's Home, painted from the draft — the prototype's "Live preview · a couple's Home", piece for piece: the
 * band with its big number and two white chips; a frame of category rows with Pay / Add / Edit; a frame of switches
 * and pills; a frame with a private note. Static: nothing in it is a control.
 */
export function ColoursPreview({ d }: { d: AppColours }) {
  const flat = d.bandFrom === d.bandTo && d.frameLift === 'none';
  const cls = [s.pv, d.touches.wave ? s.wave : '', d.touches.overlap ? s.overlap : '', flat ? s.flat : '', d.frameLift === 'none' ? s.lined : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} style={previewVars(d)} aria-hidden data-colours-preview="">
      <div className={s.phonebar}>
        <span>9:41</span>
        <span>●●● ⌔</span>
      </div>
      <div className={s.band}>
        <div className={s.eyebrow}>Maria &amp; Jose · 14 Feb 2027</div>
        <div className={s.big}>
          ₱148,500<small>left of ₱320,000</small>
        </div>
        <div className={s.sub}>42 days to go · 3 things need you</div>
        <div className={s.chips}>
          <span className={`${s.chip} ${s.chipMoney}`}>
            <i>
              <CreditCard />
            </i>
            Pay deposit
          </span>
          <span className={`${s.chip} ${s.chipDecision}`}>
            <i>
              <ArrowRight />
            </i>
            Next: choose a date
          </span>
        </div>
      </div>
      <div className={s.body}>
        <div className={s.frame}>
          <h4>
            Where it goes <small>this month</small>
          </h4>
          <Cat tc="var(--pv-booked)" w="72%" icon={<Check />} name="Booked" note="₱96,000" />
          <Cat tc="var(--pv-schedule)" w="45%" icon={<Calendar />} name="Schedules" note="4 this week" />
          <Cat tc="var(--pv-asked)" w="30%" icon={<MessageSquare />} name="Asked" note="2 quotes waiting" />
          <Cat tc="var(--pv-collect)" w="58%" icon={<ShoppingBasket />} name="To collect" note="₱25,000 due" />
          <div className={s.row}>
            <span className={`${s.btn} ${s.money}`}>
              <CreditCard />
              Pay ₱25,000
            </span>
            <span className={`${s.btn} ${s.decisionOut}`}>
              <Plus />
              Add
            </span>
            <span className={`${s.btn} ${s.neutral}`}>
              <Pencil />
              Edit
            </span>
          </div>
        </div>

        <div className={s.frame}>
          <h4>Guest page</h4>
          <div className={s.set} style={{ marginTop: 8 }}>
            <div className={s.setText}>
              Show the countdown<small>Guests see days to go</small>
            </div>
            <span className={`${s.switch} ${s.switchOn}`} />
          </div>
          <div className={s.set}>
            <div className={s.setText}>
              Let guests bring a plus-one<small>Off for the ceremony</small>
            </div>
            <span className={s.switch} />
          </div>
          <div className={s.set}>
            <div className={s.setText}>Reply by</div>
          </div>
          <div className={s.pills}>
            <span className={s.pill}>2 weeks</span>
            <span className={`${s.pill} ${s.pillOn}`}>1 month</span>
            <span className={s.pill}>Custom</span>
          </div>
        </div>

        <div className={s.frame}>
          <h4>
            Studio Lumen <small>Photography</small>
          </h4>
          <div className={s.chat}>
            <div className={s.msg}>We can hold 14 Feb for you until Friday.</div>
            <div className={`${s.msg} ${s.priv}`}>
              <div className={s.strip}>
                <Lock className="mr-1 inline h-3 w-3 align-[-1px]" />
                Private · only you and Jose
              </div>
              <div className={s.privText}>Let&apos;s pay the deposit after payday?</div>
            </div>
          </div>
          <div className={s.compose}>
            <div className={s.box}>
              <Lock className="h-3.5 w-3.5" style={{ color: 'var(--pv-priv)' }} /> Private note to Jose…
            </div>
            <span className={s.send}>
              <Send />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One job's sample strip on the editor row — sample figures, never a reading (this file is a SAMPLE by name). */
export function Sample({ job, d }: { job: JobKey; d: AppColours }) {
  const wrap = (children: ReactNode) => (
    <div className={pv.sample} style={previewVars(d)} aria-hidden>
      {children}
    </div>
  );
  const band = `linear-gradient(${d.bandAngle}, ${d.bandFrom}, ${d.bandTo})`;
  switch (job) {
    case 'page':
      return wrap(
        <div className="flex-1 rounded-md px-3 py-2.5" style={{ background: d.page }}>
          <span className="font-semibold text-ink">Good morning, Maria</span>
        </div>,
      );
    case 'band':
      return wrap(
        <>
          <div className="flex-1 rounded-md px-3.5 py-3 text-white" style={{ background: band }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em]">Budget left</div>
            <div className="text-[26px] font-extrabold tracking-[-0.02em]">₱148,500</div>
          </div>
          <span className="font-mono text-[12px] text-ink/60">lightest point {lightestPoint(d.bandFrom, d.bandTo)}</span>
        </>,
      );
    case 'frame':
      return wrap(
        <div className="flex-1 rounded-md px-3.5 pb-1 pt-3.5" style={{ background: band }}>
          <div className={`${pv.frame} relative top-2`} style={{ borderColor: d.frameLift === 'none' ? 'var(--m-line)' : 'transparent' }}>
            <b className="text-[13px]">Where it goes</b>
            <div className="text-[12px] text-[color:var(--m-slate-2)]">Booked · Schedules · Asked</div>
          </div>
        </div>,
      );
    case 'money':
      return wrap(
        <>
          <span className={pv.sampleBand}>
            <span className={`${pv.chip} ${pv.chipMoney}`}>
              <i>
                <CreditCard />
              </i>
              Pay deposit
            </span>
          </span>
          <span className={`${pv.btn} ${pv.money}`}>Pay ₱25,000</span>
          <span className={`${pv.btn} ${pv.moneyOut}`}>Confirm</span>
        </>,
      );
    case 'decision':
      return wrap(
        <>
          <span className={pv.sampleBand}>
            <span className={`${pv.chip} ${pv.chipDecision}`}>
              <i>
                <ArrowRight />
              </i>
              Next
            </span>
          </span>
          <span className={`${pv.btn} ${pv.decision}`}>Next: choose a date</span>
          <span className={`${pv.btn} ${pv.decisionOut}`}>Add</span>
          <span className="font-mono text-[12px] text-ink/60">outlined word {derive.decisionWord(d.decision)}</span>
        </>,
      );
    case 'private':
      return wrap(
        <>
          <div className={`${pv.msg} ${pv.priv} max-w-none flex-1`}>
            <div className={pv.strip}>🔒 Private · only you and Jose</div>
            <div className={pv.privText}>After payday?</div>
          </div>
          <span className="font-mono text-[12px] text-ink/60">
            words {derive.privateText(d.private)} · wash {derive.privateTint(d.private)}
          </span>
        </>,
      );
    case 'toggle':
      return wrap(
        <>
          <span className={`${pv.switch} ${pv.switchOn}`} />
          <span className={pv.switch} />
          <span className={`${pv.pill} ${pv.pillOn}`}>1 month</span>
          <span className={pv.pill}>Custom</span>
        </>,
      );
    case 'tiles':
      return wrap(
        <>
          {TILE_KEYS.map((k, i) => (
            <div key={k} className={`${pv.cat} min-w-[140px] flex-1`} style={{ '--tc': d.tiles[k], '--w': `${[72, 45, 30, 58][i]}%` } as CSSProperties}>
              <span className={pv.tile}>
                <Check />
              </span>
              <div className={pv.catText}>
                <b>{TILE_LABEL[k]}</b>
                <div className={pv.bar}>
                  <i />
                </div>
              </div>
            </div>
          ))}
        </>,
      );
  }
}
