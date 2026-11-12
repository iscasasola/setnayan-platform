import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight, Calendar, Check, CreditCard, Lock, MessageSquare, Pencil, Plus, Send, ShoppingBasket } from 'lucide-react';
import {
  FRAME_LIFT_SHADOW,
  derive,
  type AppColours,
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
