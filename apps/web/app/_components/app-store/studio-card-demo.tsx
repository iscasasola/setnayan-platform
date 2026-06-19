'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  Play, Pause, Users, Check, ChevronUp, Music, QrCode, Download,
  Printer, Cloud, ShieldCheck, MapPin,
} from 'lucide-react';

const MULB = 'var(--m-mulberry, #5C2542)';
const GOLD = '#C5A059';
const BLUSH = '#F6ECEC';
const SAGE = '#9CAF88';
const CHAMP = '#d9c39a';
const SERIF = 'var(--font-serif, Georgia, serif)';

// On-card demo engine — the auto-playing "what it does + how to operate it"
// preview that plays when a couple opens a Studio app card. Two frame sources,
// in priority order:
//   1. RICH_SCENES[slug] — high-fidelity native frames built from the REAL
//      Setnayan UI (so they look exactly like the app, no screenshots/data
//      needed). This is what ships for flagship features today.
//   2. `frames` (DemoFrame[]) — a real app screenshot (`image`) or a tint
//      fallback, for features whose literal screenshots are captured later.
// Either way: a result caption ("what it does") + an operation hint ("how to
// operate it"), auto-advancing, play/pause + step dots. One engine, every card.

export type DemoFrame = {
  /** What it does — the result line above the frame. */
  caption: string;
  /** How to operate it — the small hint under the caption. */
  hint?: string;
  /** Real app screenshot URL (preferred). Falls back to a tint when absent. */
  image?: string;
  /** Fallback frame tint (CSS color) when no screenshot yet. */
  accent?: string;
};

type RichFrame = { caption: string; hint?: string; scene: ReactNode };

const ADVANCE_MS = 3000;

// Warm, varied tints standing in for candid photos inside the mockup chrome.
const TILE = ['#F0997B', '#5DCAA5', '#AFA9EC', '#FAC775', '#ED93B1', '#85B7EB'];
function tiles(n: number) {
  return Array.from({ length: n }, (_, k) => (
    <span
      key={k}
      className="block aspect-square rounded-md"
      style={{ background: TILE[k % TILE.length] }}
    />
  ));
}

// ── Papic — four real-UI scenes (camera · gallery · auto-tag · photos of you) ──
const PAPIC_SCENES: RichFrame[] = [
  {
    caption: 'A friend’s phone becomes a candid camera.',
    hint: 'Tap to shoot — no app to install.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-ink text-cream">
        <div className="flex items-center justify-between px-3 py-2.5 text-[10px] text-cream/70">
          <span className="font-mono tracking-[0.12em]">PAPIC · SEAT 2</span>
          <span className="rounded-full bg-cream/10 px-2 py-0.5">3 / 8</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center text-cream/40">
            <Users aria-hidden className="mx-auto h-9 w-9 text-cream/30" strokeWidth={1.5} />
            <p className="mt-1.5 text-[11px]">the first dance</p>
          </div>
        </div>
        <div className="flex justify-center pb-7 pt-3">
          <span className="h-14 w-14 rounded-full border-4 border-cream" />
        </div>
      </div>
    ),
  },
  {
    caption: 'Every shot lands in your gallery, instantly.',
    hint: 'You never lift a finger — it just fills up.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream text-ink">
        <div className="px-3 pb-2 pt-3 text-[12px] font-semibold">Your gallery</div>
        <div className="flex flex-wrap gap-1 px-3">
          <span className="rounded-full bg-terracotta px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-cream">All</span>
          <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-ink/55">Photos of us</span>
          <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-ink/55">Videos</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5 px-3">{tiles(9)}</div>
      </div>
    ),
  },
  {
    caption: 'The right people are found automatically.',
    hint: 'Or scan a guest’s QR to tag — no typing.',
    scene: (
      <div className="absolute inset-0 flex items-center justify-center bg-ink p-4">
        <div className="relative aspect-[3/4] w-[150px] overflow-hidden rounded-lg" style={{ background: '#F0997B' }}>
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-1 ring-white/70" />
          <span className="absolute left-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white">
            <Check aria-hidden className="h-3 w-3" strokeWidth={2.5} /> Maya
          </span>
        </div>
      </div>
    ),
  },
  {
    caption: 'Each guest finds the photos they’re in.',
    hint: '“Photos of you” fills through the day — theirs to keep.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream text-ink">
        <div className="flex items-center justify-between px-3 pt-3">
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-terracotta">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Photos of you
          </span>
          <span className="text-[10px] text-ink/55">12 tagged</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 px-3">{tiles(6)}</div>
      </div>
    ),
  },
];

// ── Save the Date — sealed → veil lift → film beat → add-to-calendar ──
const SAVE_THE_DATE_SCENES: RichFrame[] = [
  {
    caption: 'Your news arrives, beautifully sealed.',
    hint: 'Swipe the wax seal to open.',
    scene: (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream text-ink">
        <div
          className="flex h-[116px] w-[116px] items-center justify-center rounded-full text-cream/95 shadow-md"
          style={{ background: 'radial-gradient(circle at 36% 30%, #a85a44, #6b2a40)' }}
        >
          <span className="text-2xl" style={{ fontFamily: SERIF }}>M &amp; J</span>
        </div>
        <ChevronUp aria-hidden className="mt-6 h-4 w-4 text-ink/35" strokeWidth={2} />
        <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.28em] text-ink/55">Swipe to open</span>
      </div>
    ),
  },
  {
    caption: 'The veil lifts away.',
    hint: 'It opens on its own once you swipe.',
    scene: (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink text-cream">
        <div className="absolute inset-x-0 top-0 h-1/3" style={{ background: 'linear-gradient(rgba(255,255,255,.78), transparent)' }} />
        <span className="relative text-lg" style={{ fontFamily: SERIF, color: GOLD }}>M &amp; J</span>
        <span className="relative mt-1.5 h-px w-10" style={{ background: GOLD }} />
        <span className="relative mt-2 font-mono text-[9px] uppercase tracking-[0.25em] text-terracotta">Save the Date</span>
      </div>
    ),
  },
  {
    caption: 'Their story plays like a little film.',
    hint: 'Auto-plays; tap to step through it.',
    scene: (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream px-4 text-ink">
        <Music aria-hidden className="absolute right-3 top-3 h-3.5 w-3.5 text-ink/20" strokeWidth={2} />
        <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-terracotta">Mark your calendars</span>
        <span className="mt-2 text-3xl tracking-tight" style={{ fontFamily: SERIF }}>June 12</span>
        <span className="text-xl" style={{ fontFamily: SERIF }}>2027</span>
        <span className="mt-3 h-px w-8 bg-mulberry/40" />
      </div>
    ),
  },
  {
    caption: 'One tap and it’s on your calendar.',
    hint: 'Tap Add to calendar — done.',
    scene: (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream px-5 text-ink">
        <span className="text-xl" style={{ fontFamily: SERIF, color: GOLD }}>M &amp; J</span>
        <span className="mt-1 font-mono text-[8px] uppercase tracking-[0.28em] text-ink/55">Save the Date</span>
        <span className="mt-0.5 text-base italic" style={{ fontFamily: SERIF }}>June 12, 2027</span>
        <span className="mt-4 rounded-full bg-terracotta px-4 py-1.5 text-[11px] font-medium text-cream shadow-sm">Add to calendar</span>
        <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-emerald-600/15 px-2 py-1 text-[9px] font-medium text-emerald-700">
          <Check aria-hidden className="h-2.5 w-2.5" strokeWidth={2.5} /> Added — Jun 12
        </span>
      </div>
    ),
  },
];

// ── Animated Monogram — design → animate → website hero → keepsakes ──
const ANIMATED_MONOGRAM_SCENES: RichFrame[] = [
  {
    caption: 'Design a mark that’s truly yours.',
    hint: 'Tap a letter to restyle, pinch to size.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream px-3 pt-3 text-ink">
        <div className="flex items-center justify-between text-[8px]">
          <span className="font-mono uppercase tracking-[0.2em] text-ink/70">Setnayan</span>
          <span className="font-mono uppercase tracking-[0.15em]" style={{ color: GOLD }}>Vector studio</span>
        </div>
        <div className="mt-2 flex aspect-square items-center justify-center rounded-xl border border-ink/10 bg-white">
          <span className="text-3xl" style={{ fontFamily: SERIF, color: 'var(--m-mulberry, #5C2542)' }}>M&amp;J</span>
        </div>
        <p className="mt-2 font-mono text-[7px] uppercase tracking-[0.12em] text-ink/45">Font</p>
        <div className="mt-1 flex gap-1">
          {['Cardo', 'Gilda', 'Playfair'].map((f, k) => (
            <span key={f} className={`rounded px-1.5 py-0.5 text-[8px] ${k === 0 ? 'bg-ink text-cream' : 'bg-ink/5 text-ink/60'}`} style={{ fontFamily: SERIF }}>{f}</span>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          {['var(--m-mulberry,#5C2542)', GOLD, CHAMP, '#1b1b1d'].map((c, k) => (
            <span key={k} className="h-4 w-4 rounded-full" style={{ background: c, boxShadow: k === 0 ? `0 0 0 2px ${GOLD}` : undefined }} />
          ))}
        </div>
        <button type="button" className="mt-auto mb-4 w-full rounded-md bg-mulberry py-1.5 text-[10px] font-medium text-cream">Save as my monogram</button>
      </div>
    ),
  },
  {
    caption: 'Watch it come to life.',
    hint: 'Pick a motion — it plays on your page.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream px-3 pt-3 text-ink">
        <span className="font-mono text-[8px] uppercase tracking-[0.22em] text-terracotta">Animated monogram</span>
        <p className="mt-0.5 text-[13px] font-semibold tracking-tight">Your initials, drawn live</p>
        <div className="relative mt-2 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-white">
          <span className="text-3xl" style={{ fontFamily: SERIF, color: 'var(--m-mulberry,#5C2542)' }}>M&amp;J</span>
          <span className="absolute inset-y-4 left-1/3 w-6 -skew-x-12" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}66, transparent)` }} />
          <span className="absolute right-2 top-2 rounded-full bg-terracotta px-1.5 py-0.5 text-[7px] font-medium text-cream">Upgrade</span>
        </div>
        <div className="mt-2 flex gap-1 overflow-hidden">
          {['Drawn', 'Foil', 'Bloom', 'Halo'].map((m, k) => (
            <span key={m} className={`rounded-md px-1.5 py-1 text-[8px] ${k === 1 ? 'bg-ink/5 text-ink' : 'bg-ink/5 text-ink/55'}`} style={k === 1 ? { boxShadow: `0 0 0 1.5px ${GOLD}` } : undefined}>{m}</span>
          ))}
        </div>
        <div className="mt-auto mb-4">
          <p className="font-mono text-[8px] text-ink/55">One price for your wedding · ₱2,499</p>
          <button type="button" className="mt-1 w-full rounded-md bg-mulberry py-1.5 text-[10px] font-medium text-cream">Draw my monogram live</button>
        </div>
      </div>
    ),
  },
  {
    caption: 'It opens your wedding website.',
    hint: 'Guests see it bloom in as the page loads.',
    scene: (
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-ink" style={{ background: `linear-gradient(${BLUSH}, #f7f2ea)` }}>
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full" style={{ boxShadow: `0 0 0 1px ${GOLD}` }}>
          <span className="text-lg" style={{ fontFamily: SERIF, color: 'var(--m-mulberry,#5C2542)' }}>M&amp;J</span>
        </div>
        <span className="mt-3 text-xl" style={{ fontFamily: SERIF }}>Maria &amp; Juan</span>
        <span className="mt-2 h-px w-10" style={{ background: GOLD }} />
        <span className="mt-2 font-mono text-[8px] uppercase tracking-[0.25em] text-ink/60">December 14, 2026</span>
        <span className="mt-4 rounded-full border border-terracotta px-4 py-1 text-[10px] font-medium text-terracotta">RSVP</span>
      </div>
    ),
  },
  {
    caption: 'And every keepsake carries it.',
    hint: 'Same mark on your QR and save-the-date.',
    scene: (
      <div className="absolute inset-0 flex flex-col justify-center gap-2.5 bg-cream px-4 text-ink">
        <div className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white p-2.5">
          <div className="relative flex h-12 w-12 items-center justify-center rounded bg-ink/90 text-cream">
            <QrCode aria-hidden className="h-9 w-9" strokeWidth={1.25} />
            <span className="absolute flex h-4 w-4 items-center justify-center rounded-full bg-white text-[7px]" style={{ fontFamily: SERIF, color: 'var(--m-mulberry,#5C2542)' }}>MJ</span>
          </div>
          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink/55">Your mark at the heart of your QR</span>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: BLUSH }}>
          <span className="text-base" style={{ fontFamily: SERIF, color: GOLD }}>M &amp; J</span>
          <p className="mt-0.5 text-[11px]" style={{ fontFamily: SERIF }}>Save the Date</p>
          <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/55">12 · 14 · 2026</p>
        </div>
      </div>
    ),
  },
];

// ── Mood Board — palette → recolor → reception → concept book ──
function paletteStrip(colors: string[]) {
  return (
    <div className="flex gap-0.5 overflow-hidden rounded">
      {colors.map((c, k) => <span key={k} className="h-1.5 flex-1" style={{ background: c }} />)}
    </div>
  );
}
const PAL = ['var(--m-mulberry,#5C2542)', CHAMP, '#bf6a43', SAGE];
const MOOD_BOARD_SCENES: RichFrame[] = [
  {
    caption: 'Pick the colors of your day.',
    hint: 'Tap a swatch to set each color.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream px-3 pt-3 text-ink">
        <p className="text-[14px] font-semibold tracking-tight">Mood Board</p>
        <p className="text-[9px] text-ink/60">Set your palette once, see it everywhere.</p>
        <p className="mt-2 font-mono text-[7px] uppercase tracking-[0.15em] text-ink/55">Venue</p>
        <div className="mt-1 rounded-lg border border-ink/10 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium">Reception palette</span>
            <span className="rounded-full bg-emerald-600/15 px-1.5 py-0.5 font-mono text-[7px] text-emerald-700">4 / 3–6</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {PAL.map((c, k) => <span key={k} className="h-6 w-6 rounded-full" style={{ background: c }} />)}
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-terracotta text-[11px] text-terracotta">+</span>
          </div>
        </div>
        <button type="button" className="mt-auto mb-4 self-end rounded-md bg-terracotta px-4 py-1.5 text-[10px] font-medium text-cream">Save palette</button>
      </div>
    ),
  },
  {
    caption: 'See your colors on every part.',
    hint: 'Cards repaint to match your palette.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream px-3 pt-3 text-ink">
        <p className="text-[13px] font-semibold tracking-tight">In your colors</p>
        <p className="text-[8px] text-ink/60">One picture per color decision.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            { label: 'Bouquet', c: '#bf6a43' },
            { label: 'Ceremony', c: CHAMP },
            { label: 'Bride', c: BLUSH },
            { label: 'Party', c: 'var(--m-mulberry,#5C2542)' },
          ].map((x) => (
            <div key={x.label} className="overflow-hidden rounded-lg border border-ink/10">
              <span className="block h-12 w-full" style={{ background: x.c }} />
              <div className="p-1.5">
                <span className="text-[8px] font-medium">{x.label}</span>
                {paletteStrip(PAL)}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    caption: 'Style your reception room.',
    hint: 'Tap a part — ceiling, tables, stage.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream px-3 pt-3 text-ink">
        <p className="text-[13px] font-semibold tracking-tight">Design your reception</p>
        <p className="text-[8px] text-ink/60">Tap a part of the room.</p>
        <div className="mt-2 flex-1 overflow-hidden rounded-lg border border-ink/10 p-2">
          <span className="block h-4 w-full rounded-sm" style={{ background: CHAMP }} />
          <span className="mx-auto mt-1.5 block h-8 w-2/3 rounded-sm" style={{ background: 'var(--m-mulberry,#5C2542)' }} />
          <div className="mt-2 flex justify-center gap-2">
            {[0, 1, 2].map((k) => (
              <span key={k} className="h-7 w-7 rounded-full" style={{ background: '#bf6a43', boxShadow: k === 1 ? '0 0 0 2px #bf6a43, 0 0 0 4px #ffffff' : undefined }} />
            ))}
          </div>
        </div>
        <div className="mt-2 mb-3 flex gap-1">
          {['Round', 'Champagne', 'Tall florals'].map((m, k) => (
            <span key={m} className={`rounded-full px-2 py-0.5 text-[8px] ${k === 0 ? 'bg-terracotta text-cream' : 'border border-ink/10 text-ink/60'}`}>{m}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    caption: 'One vision your whole team shares.',
    hint: 'Save and share the concept book.',
    scene: (
      <div className="absolute inset-0 flex flex-col items-center bg-cream px-4 pt-3 text-ink">
        <p className="self-start text-[13px] font-semibold tracking-tight">Your concept book</p>
        <p className="self-start text-[8px] text-ink/60">Palette, reception, attire — one PDF.</p>
        <div className="mt-2 w-[96px] overflow-hidden rounded-md border border-ink/10 bg-white p-2 text-center shadow-sm">
          <span className="text-[10px]" style={{ fontFamily: SERIF }}>Maria &amp; Juan</span>
          {paletteStrip(PAL)}
          <div className="mt-1.5 space-y-1">
            <span className="block h-1.5 w-full rounded bg-ink/10" />
            <span className="block h-1.5 w-3/4 rounded bg-ink/10" />
            <span className="block h-1.5 w-full rounded bg-ink/10" />
          </div>
        </div>
        <button type="button" className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-terracotta px-3 py-1.5 text-[10px] font-medium text-cream">
          <Download aria-hidden className="h-3 w-3" strokeWidth={2} /> Download
        </button>
        <span className="mt-1.5 font-mono text-[7px] uppercase tracking-[0.15em] text-ink/45">Free · one vision every vendor pulls from</span>
      </div>
    ),
  },
];

// ── Custom QR per guest — branded → compare → all guests → print pack ──
function qrCard(name: string, role: string) {
  return (
    <div key={name} className="rounded-lg border border-ink/10 bg-white p-2 text-center">
      <QrCode aria-hidden className="mx-auto h-9 w-9" strokeWidth={1} style={{ color: MULB }} />
      <p className="mt-1 text-[8px] italic" style={{ fontFamily: SERIF }}>{name}</p>
      <p className="font-mono text-[6px] uppercase tracking-[0.15em] text-ink/50">{role}</p>
    </div>
  );
}
const CUSTOM_QR_SCENES: RichFrame[] = [
  {
    caption: 'A code worthy of your invitation.',
    hint: 'Open Custom QR per guest in Studio.',
    scene: (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream px-4 text-ink">
        <span className="font-mono text-[8px] uppercase tracking-[0.22em] text-terracotta">Custom QR per guest</span>
        <div className="mt-3 rounded-xl border border-ink/10 bg-white p-4 text-center">
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
            <QrCode aria-hidden className="h-24 w-24" strokeWidth={0.75} style={{ color: MULB }} />
            <span className="absolute flex h-8 w-8 items-center justify-center rounded-full text-[10px] text-cream ring-2 ring-cream" style={{ background: MULB, fontFamily: SERIF }}>A&amp;J</span>
          </div>
          <p className="mt-2 text-[12px] italic" style={{ fontFamily: SERIF }}>Anjelica &amp; José</p>
          <p className="font-mono text-[7px] uppercase tracking-[0.2em] text-ink/55">December 14 · 2026</p>
        </div>
      </div>
    ),
  },
  {
    caption: 'See plain become unmistakably yours.',
    hint: 'Compare the default and branded code.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream px-3 pt-4 text-ink">
        <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-terracotta">Your QR, two ways</span>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-ink/10 bg-white p-2 text-center">
            <QrCode aria-hidden className="mx-auto h-12 w-12 text-ink" strokeWidth={0.75} />
            <p className="mt-1 text-[8px] font-medium">Default — free</p>
          </div>
          <div className="relative rounded-lg border-2 border-terracotta bg-white p-2 text-center">
            <span className="absolute right-1 top-1 rounded-full bg-terracotta px-1 py-0.5 text-[6px] font-medium text-cream">Upgrade</span>
            <QrCode aria-hidden className="mx-auto h-12 w-12" strokeWidth={0.75} style={{ color: MULB }} />
            <p className="mt-1 text-[8px] font-medium">Branded</p>
          </div>
        </div>
        <button type="button" className="mt-auto mb-4 w-full rounded-md bg-mulberry py-1.5 text-[10px] font-medium text-cream">Brand my guests’ QRs</button>
      </div>
    ),
  },
  {
    caption: 'Every guest, already done.',
    hint: 'Open after purchase to see them all.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream px-3 pt-3 text-ink">
        <div className="flex items-center gap-1.5 rounded-md bg-emerald-600/12 px-2 py-1.5">
          <Check aria-hidden className="h-3 w-3 text-emerald-700" strokeWidth={2.5} />
          <span className="text-[9px] font-medium text-emerald-800">Your branded QR cards are ready</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {qrCard('Anjelica', 'Bride')}
          {qrCard('José M.', 'Groom')}
          {qrCard('Lola Rosa', 'Ninang')}
          {qrCard('Tito Ben', 'Guest')}
        </div>
      </div>
    ),
  },
  {
    caption: 'Hand the whole set to your stationer.',
    hint: 'Tap Print all (A4).',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream px-3 pt-3 text-ink">
        <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-terracotta">Print pack · A4</span>
        <p className="text-[11px] font-semibold">Ready for your stationer</p>
        <div className="mt-2 flex-1 rounded-lg border border-dashed border-ink/25 bg-white p-2">
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 6 }, (_, k) => (
              <div key={k} className="rounded border border-ink/5 p-1 text-center" style={{ background: '#FAF7F2' }}>
                <QrCode aria-hidden className="mx-auto h-7 w-7" strokeWidth={0.75} style={{ color: MULB }} />
              </div>
            ))}
          </div>
        </div>
        <button type="button" className="mt-2 mb-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-white py-1.5 text-[10px] font-medium">
          <Printer aria-hidden className="h-3 w-3" strokeWidth={2} /> Print all (A4)
        </button>
      </div>
    ),
  },
];

// ── Photo Delivery — connect → hold → copy → delivered ──
const PHOTO_DELIVERY_SCENES: RichFrame[] = [
  {
    caption: 'Every photo, in your hands.',
    hint: 'Tap Connect Google Drive to begin.',
    scene: (
      <div className="absolute inset-0 flex flex-col justify-center bg-cream px-4 text-ink">
        <p className="text-[14px] font-semibold tracking-tight">Keep your own copy in Drive</p>
        <p className="mt-1.5 text-[10px] text-ink/65">We drop every finished photo into one folder you own, forever.</p>
        <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-md border border-terracotta/50 px-2 py-1 text-[8px] text-terracotta">
          <ShieldCheck aria-hidden className="h-3 w-3" strokeWidth={2} /> Only the folder it creates
        </span>
        <button type="button" className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-md bg-mulberry py-2 text-[11px] font-medium text-cream">
          <Cloud aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Connect Google Drive
        </button>
      </div>
    ),
  },
  {
    caption: 'Setnayan holds them till you’re ready.',
    hint: 'Tap Release to Drive when review’s done.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream px-4 pt-4 text-ink">
        <div className="rounded-lg bg-emerald-600/10 p-3">
          <div className="flex items-center gap-1.5 text-emerald-800">
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} /><span className="text-[11px] font-semibold">Drive connected</span>
          </div>
          <p className="mt-1 font-mono text-[7px] text-emerald-700/80">Folder: Setnayan · Maria &amp; Juan</p>
        </div>
        <div className="mt-3 rounded-lg border border-ink/10 bg-white p-3" style={{ borderTopColor: GOLD, borderTopWidth: 2 }}>
          <p className="text-[11px] font-medium">Ready when you are</p>
          <p className="mt-0.5 text-[9px] text-ink/60">Release the full archive in one pass.</p>
          <button type="button" className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-mulberry py-1.5 text-[10px] font-medium text-cream">
            <Cloud aria-hidden className="h-3 w-3" strokeWidth={2} /> Release to Drive
          </button>
        </div>
      </div>
    ),
  },
  {
    caption: 'The originals copy themselves over.',
    hint: 'Just watch — it runs in the background.',
    scene: (
      <div className="absolute inset-0 flex flex-col justify-center bg-cream px-4 text-ink">
        <div className="rounded-lg border border-ink/10 bg-white p-3">
          <p className="text-2xl font-semibold tracking-tight">847<span className="text-sm text-ink/40"> / 1,372</span></p>
          <p className="text-[9px] text-ink/60">photos · 5.2 GB of 8.4 GB</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-emerald-600" style={{ width: '62%' }} /></div>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 text-[7px] text-terracotta">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-terracotta" /> Live sync active
          </span>
        </div>
      </div>
    ),
  },
  {
    caption: 'Yours to keep — and guests get theirs.',
    hint: 'Tap Open in Drive for the full archive.',
    scene: (
      <div className="absolute inset-0 flex flex-col justify-center bg-cream px-4 text-ink">
        <div className="rounded-lg bg-emerald-600/10 p-3">
          <p className="font-mono text-[7px] uppercase tracking-[0.18em] text-emerald-700">Delivery complete</p>
          <p className="mt-1 text-[13px] font-semibold text-emerald-900">All photos are in your Drive</p>
          <p className="mt-0.5 text-[9px] text-emerald-800/80">1,372 files · 8.4 GB · 5-year backup kept.</p>
          <button type="button" className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[10px] font-medium text-white">Open in Drive</button>
        </div>
        <div className="mt-2 rounded-lg border border-ink/10 bg-white p-2.5 text-[9px] text-ink/65" style={{ borderLeftColor: GOLD, borderLeftWidth: 3 }}>
          Your guests get the photos they’re in — shared automatically.
        </div>
      </div>
    ),
  },
];

// ── Patiktok — pick → set → render → ready ──
const PATIKTOK_SCENES: RichFrame[] = [
  {
    caption: 'Pick a vertical look you love.',
    hint: 'Tap a style to choose it.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream px-3 pt-3 text-ink">
        <span className="font-mono text-[7px] uppercase tracking-[0.2em] text-terracotta">Patiktok · reel station</span>
        <p className="text-[12px] font-semibold">Pick the reel templates</p>
        <div className="mt-1.5 flex gap-1">
          <span className="rounded-full bg-terracotta px-2 py-0.5 text-[7px] text-cream">All</span>
          <span className="rounded-full border border-ink/10 px-2 py-0.5 text-[7px] text-ink/55">Ceremony</span>
          <span className="rounded-full border border-ink/10 px-2 py-0.5 text-[7px] text-ink/55">Reception</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="flex aspect-[9/16] flex-col justify-between overflow-hidden rounded-lg border border-ink/10 p-2" style={{ background: '#FAF7F2' }}>
            <span className="h-1 w-full rounded bg-terracotta" />
            <span className="text-center text-[10px]" style={{ fontFamily: SERIF, color: '#5a3a2a' }}>Ana &amp; Marco</span>
            <div className="flex gap-0.5">{PAL.map((c, k) => <span key={k} className="h-1 flex-1" style={{ background: c }} />)}</div>
          </div>
          <div className="flex aspect-[9/16] items-center justify-center overflow-hidden rounded-lg border border-ink/10" style={{ background: '#0F0F0F' }}>
            <span className="text-[10px]" style={{ fontFamily: SERIF, color: GOLD }}>A &amp; M</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    caption: 'Set the length and the song.',
    hint: 'Slide the length, pick a track.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream px-3 pt-3 text-ink">
        <span className="font-mono text-[7px] uppercase tracking-[0.2em] text-terracotta">Cebu Sunrise</span>
        <div className="mt-1.5 rounded-lg border border-ink/10 bg-white p-2.5">
          <p className="text-[10px] font-medium">Render this reel</p>
          <div className="mt-2 flex items-center justify-between text-[9px]"><span className="text-ink/60">Mimic duration</span><span className="font-mono">15s</span></div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-ink/10"><div className="relative h-full w-1/2 rounded-full bg-terracotta"><span className="absolute -right-1.5 -top-1 h-3.5 w-3.5 rounded-full bg-terracotta" /></div></div>
          <div className="mt-3 flex items-center gap-1.5 rounded-md border border-ink/15 px-2 py-1.5 text-[9px]">
            <Music aria-hidden className="h-3 w-3 text-ink/50" /><span className="text-ink/70">Auto-pick from template</span>
          </div>
          <button type="button" className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-mulberry py-1.5 text-[10px] font-medium text-cream">Render reel</button>
        </div>
      </div>
    ),
  },
  {
    caption: 'Watch it come together right here.',
    hint: 'Tap Render — keep the tab open.',
    scene: (
      <div className="absolute inset-0 flex flex-col justify-center bg-cream px-4 text-ink">
        <div className="rounded-md bg-emerald-600/10 px-2 py-1 text-[8px] font-medium text-emerald-800">Render queued — ready soon</div>
        <div className="mt-2 rounded-lg p-3" style={{ background: 'rgba(92,37,66,.05)', border: '1px solid rgba(92,37,66,.3)' }}>
          <p className="text-[10px] font-medium" style={{ color: MULB }}>Rendering in your browser… 68%</p>
          <div className="mt-2 h-2 w-full rounded-full bg-ink/10"><div className="h-full rounded-full" style={{ width: '68%', background: MULB }} /></div>
          <p className="mt-1.5 text-[8px] text-ink/55">No server, no wait queue.</p>
        </div>
      </div>
    ),
  },
  {
    caption: 'Your reel, ready to share.',
    hint: 'Tap Download, post to your stories.',
    scene: (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream px-4 text-ink">
        <div className="flex aspect-[9/16] w-[128px] items-center justify-center rounded-lg bg-black text-cream"><Play aria-hidden className="h-6 w-6" strokeWidth={1.5} /></div>
        <button type="button" className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[10px] font-medium text-white">
          <Download aria-hidden className="h-3 w-3" strokeWidth={2} /> Download reel
        </button>
        <span className="mt-1.5 font-mono text-[7px] uppercase tracking-[0.15em] text-ink/45">Saved to your event gallery</span>
      </div>
    ),
  },
];

// ── LED Background — hero → templates → customize → ready ──
const LED_SCENES: RichFrame[] = [
  {
    caption: 'Your name, twenty feet tall on stage.',
    hint: 'Tap to open the background maker.',
    scene: (
      <div className="absolute inset-0 flex flex-col" style={{ background: 'radial-gradient(circle at 50% 35%, #0F2A4A, #050D1F)' }}>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="flex aspect-video w-full items-center justify-center rounded" style={{ background: 'radial-gradient(circle, #14365e, #08182e)' }}>
            <span className="text-2xl" style={{ fontFamily: SERIF, color: GOLD }}>A &amp; R</span>
          </div>
        </div>
        <div className="px-4 pb-7 text-center text-cream">
          <span className="font-mono text-[8px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>Pailaw · LED background</span>
          <p className="mt-1 text-base" style={{ fontFamily: SERIF }}>Your name, twenty feet tall.</p>
          <span className="mt-3 inline-block rounded-full bg-terracotta px-4 py-1 text-[10px] font-medium text-cream">Choose template</span>
        </div>
      </div>
    ),
  },
  {
    caption: 'Pick the look that’s yours.',
    hint: 'Tap a template card to select.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream px-3 pt-3 text-ink">
        <div className="flex items-center justify-between"><p className="text-[12px] font-semibold">Pick a template</p><span className="font-mono text-[7px] text-ink/55">10 motifs</span></div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border-2 border-terracotta" style={{ background: 'linear-gradient(135deg,#3A1226,#8B1E3F)' }}><span className="font-mono text-[8px] uppercase" style={{ color: GOLD }}>Velvet Sweep</span></div>
          <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-ink/10" style={{ background: '#0B0B0B' }}><span className="font-mono text-[8px] uppercase" style={{ color: GOLD }}>Gold Particles</span></div>
          <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-ink/10" style={{ background: '#0B1530' }}><span className="font-mono text-[8px] uppercase" style={{ color: GOLD }}>Constellation</span></div>
          <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-ink/10" style={{ background: 'radial-gradient(circle,#e8d5b5,#cbb088)' }}><span className="font-mono text-[8px] uppercase text-ink/60">Capiz</span></div>
        </div>
      </div>
    ),
  },
  {
    caption: 'Your photos and monogram, woven in.',
    hint: 'Toggle Photo Pool to blend your photos.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream px-3 pt-3 text-ink">
        <span className="font-mono text-[7px] uppercase tracking-[0.18em] text-ink/55">Customizing · Velvet Sweep</span>
        <div className="mt-1.5 flex aspect-video items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg,#3A1226,#8B1E3F)' }}><span className="text-lg" style={{ fontFamily: SERIF, color: GOLD }}>A &amp; R</span></div>
        <div className="mt-2 flex items-center justify-between rounded-md border border-ink/10 px-2 py-1.5">
          <span className="text-[9px]">Photo Pool blend</span>
          <span className="flex h-3.5 w-6 items-center rounded-full bg-terracotta px-0.5"><span className="ml-auto h-2.5 w-2.5 rounded-full bg-cream" /></span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {['5 min', '10 min', '30 min'].map((m, k) => (
            <span key={m} className={`rounded-md py-1 text-center text-[8px] ${k === 1 ? 'border border-terracotta bg-terracotta/5 text-ink' : 'border border-ink/10 text-ink/55'}`}>{m}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    caption: 'Ready for the venue to play.',
    hint: 'Tap save — we hand it to the venue.',
    scene: (
      <div className="absolute inset-0 flex flex-col justify-center bg-emerald-50 px-4 text-ink">
        <div className="flex items-center gap-1.5"><Check aria-hidden className="h-4 w-4 text-emerald-700" strokeWidth={2.5} /><span className="text-[12px] font-semibold text-emerald-900">Draft saved</span></div>
        <p className="mt-1 text-[9px] text-emerald-800/80">A venue-ready master that plays offline — no Wi-Fi needed.</p>
        <div className="mt-3 space-y-1 rounded-lg bg-white/70 p-2.5 text-[8px]">
          <div className="flex justify-between"><span className="font-mono text-ink/50">TEMPLATE</span><span>Velvet Sweep</span></div>
          <div className="flex justify-between"><span className="font-mono text-ink/50">LOOP</span><span>10 min · Photo blend</span></div>
          <div className="flex justify-between"><span className="font-mono text-ink/50">DELIVERY</span><span style={{ color: GOLD }}>To the venue</span></div>
        </div>
      </div>
    ),
  },
];

// ── Indoor Blueprint — place → light up → guest view → calm ──
const DOTTED = {
  backgroundImage: 'radial-gradient(circle, rgba(0,0,0,.09) 1px, transparent 1px)',
  backgroundSize: '10px 10px',
  backgroundColor: '#faf6ef',
};
function floorMap(litT3: boolean) {
  return (
    <div className="relative flex-1 rounded-lg border border-ink/10" style={DOTTED}>
      <span className="absolute left-1/2 top-1.5 -translate-x-1/2 rounded-full bg-ink/80 px-2 py-0.5 text-[6px] text-cream">Stage / Head</span>
      <span className="absolute left-5 top-9 h-5 w-5 rounded-full border-2 border-ink/20" />
      <span className="absolute right-5 top-9 h-5 w-5 rounded-full border-2 border-ink/20" />
      {litT3 ? (
        <span className="absolute bottom-12 left-5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[6px] font-medium text-white ring-2 ring-emerald-300">T3</span>
      ) : (
        <span className="absolute bottom-12 left-5 h-5 w-5 rounded-full border-2 border-ink/20" />
      )}
      <span className="absolute bottom-12 right-5 h-5 w-5 rounded-full border-2 border-ink/20" />
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border-2 border-terracotta px-1.5 py-0.5 text-[6px] text-terracotta">Entrance</span>
    </div>
  );
}
const INDOOR_BLUEPRINT_SCENES: RichFrame[] = [
  {
    caption: 'Place your venue’s front door once.',
    hint: 'Drag the entrance in, tap Save.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream px-3 pt-3 text-ink">
        <span className="font-mono text-[7px] uppercase tracking-[0.2em] text-terracotta">Indoor Blueprint</span>
        <p className="text-[11px] font-semibold">Your whole venue, mapped</p>
        {floorMap(false)}
        <button type="button" className="mt-2 mb-3 self-end rounded-md bg-mulberry px-3 py-1.5 text-[10px] font-medium text-cream">Save entrance</button>
      </div>
    ),
  },
  {
    caption: 'Each guest’s table lights up green.',
    hint: 'Preview any guest — their seat appears.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream px-3 pt-3 text-ink">
        <p className="text-center text-[11px] font-semibold">You’re at <span className="text-emerald-600">Table 3</span></p>
        {floorMap(true)}
        <p className="mt-2 mb-3 text-center text-[8px] text-ink/55">Follow the path to your table.</p>
      </div>
    ),
  },
  {
    caption: 'Guests open their map from the invite.',
    hint: 'Tap “Find my table” on your page.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream px-3 pt-3 text-ink">
        <div className="flex items-center justify-between border-b border-ink/10 pb-1.5 text-[8px]"><span className="font-mono">Setnayan</span><span className="font-mono text-ink/55">Liza &amp; Marco</span></div>
        <p className="mt-1.5 text-center font-mono text-[7px] uppercase tracking-[0.2em] text-terracotta">Find your table</p>
        <p className="text-center text-[13px] font-semibold">You’re at <span className="text-emerald-700">Table 3</span></p>
        <p className="flex items-center justify-center gap-1 text-[8px] text-ink/55"><MapPin aria-hidden className="h-2.5 w-2.5" /> Blue Leaf Pavilion</p>
        <div className="mt-1.5 flex-1">{floorMap(true)}</div>
      </div>
    ),
  },
  {
    caption: 'No crowd at the board, calm arrivals.',
    hint: 'Everyone seats themselves on arrival.',
    scene: (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink px-5 text-center text-cream">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-emerald-500"><Check aria-hidden className="h-5 w-5 text-emerald-400" strokeWidth={2} /></div>
        <span className="mt-3 font-mono text-[8px] uppercase tracking-[0.22em]" style={{ color: GOLD }}>Arrived</span>
        <p className="mt-1 text-base" style={{ fontFamily: SERIF }}>Everyone finds their seat, calmly</p>
        <p className="mt-1.5 text-[9px] text-cream/55">No crowd at the board. No one wanders.</p>
      </div>
    ),
  },
];

const RICH_SCENES: Record<string, RichFrame[]> = {
  papic: PAPIC_SCENES,
  'save-the-date': SAVE_THE_DATE_SCENES,
  'animated-monogram': ANIMATED_MONOGRAM_SCENES,
  'mood-board': MOOD_BOARD_SCENES,
  'custom-qr-guest': CUSTOM_QR_SCENES,
  'photo-delivery': PHOTO_DELIVERY_SCENES,
  patiktok: PATIKTOK_SCENES,
  led: LED_SCENES,
  'indoor-blueprint': INDOOR_BLUEPRINT_SCENES,
};

/** Slugs that have a built-in native demo — lets the layout render the demo
 *  section even when a feature has no image/data `demo` frames yet. */
export const RICH_DEMO_SLUGS = Object.keys(RICH_SCENES);

export function StudioCardDemo({
  frames,
  slug,
  label = 'How it works',
}: {
  frames: DemoFrame[];
  /** Studio feature slug — enables high-fidelity native scenes when registered. */
  slug?: string;
  label?: string;
}) {
  const rich = slug ? RICH_SCENES[slug] : undefined;
  const useRich = Boolean(rich && rich.length > 0);
  const count = useRich ? rich!.length : frames.length;

  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || count < 2) return;
    const t = setInterval(() => setI((p) => (p + 1) % count), ADVANCE_MS);
    return () => clearInterval(t);
  }, [playing, count]);

  if (count === 0) return null;
  const idx = Math.min(i, count - 1);
  const richF = useRich ? rich![idx] : undefined;
  const dataF = useRich ? undefined : frames[idx];
  const caption = richF?.caption ?? dataF?.caption ?? '';
  const hint = richF?.hint ?? dataF?.hint;

  return (
    <figure className="m-0 flex flex-col items-center gap-4 rounded-2xl border border-ink/10 bg-cream/60 p-6 sm:p-8">
      <figcaption className="min-h-[52px] text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-terracotta">{label}</p>
        <p className="mt-1 text-base font-semibold tracking-tight text-ink">{caption}</p>
        {hint ? <p className="mt-1 text-xs text-ink/60">{hint}</p> : null}
      </figcaption>

      <div className="w-[244px] overflow-hidden rounded-[30px] border-[7px] border-ink bg-ink">
        <div key={idx} className="relative aspect-[9/19] w-full bg-ink animate-[studioDemoFade_.32s_ease]">
          {richF ? (
            richF.scene
          ) : dataF?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataF.image} alt={caption} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div
              aria-hidden
              className="flex h-full w-full items-center justify-center"
              style={{ background: dataF?.accent ?? '#1f1f22' }}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cream/45">preview</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pause demo' : 'Play demo'}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/70 transition hover:bg-ink/10"
        >
          {playing ? (
            <Pause aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <Play aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          )}
        </button>
        <ul className="flex items-center gap-2" aria-label="Demo steps">
          {Array.from({ length: count }, (_, k) => (
            <li key={k}>
              <button
                type="button"
                onClick={() => setI(k)}
                aria-label={`Step ${k + 1}`}
                aria-current={k === idx}
                className={`h-2 w-2 rounded-full transition ${k === idx ? 'bg-ink' : 'bg-ink/25 hover:bg-ink/40'}`}
              />
            </li>
          ))}
        </ul>
      </div>

      <style>{`@keyframes studioDemoFade{from{opacity:.35}to{opacity:1}}`}</style>
    </figure>
  );
}
