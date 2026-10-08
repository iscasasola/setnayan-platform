/**
 * ⚡ LOOK › BACKGROUND, ON THE MAKER CANVAS NOW — the frame side.
 *
 * Owner, 2026-10-08, after picking a video card: *"took 8 seconds before a
 * background shows"*. MEASURED that day in the lab with production's latencies:
 * the files were never the wait (a 2.2 MB loop in ~0.6 s) — the PATH was: the
 * pick waited on its save (~1.5 s), the save owed a whole-Maker render (3–6 s),
 * and that render reloaded the canvas page (~2.5 s) before a pixel changed.
 *
 * Now the Maker posts the pick first (the editor bridge's own channel) and this
 * file LAYS it — on ONE layer the bridge itself draws over the page's ground
 * (`[data-main-ground-preview]`), never on anything a guest's page holds:
 *
 *   parent → frame  { source:'setnayan-editor', t:'mainGround', seq, lay }
 *     lay = { still, clip, position, color, image, size }   a picture (its still first, the clip
 *                                                           when it can play), a colour, a blend, a pattern
 *     lay = null                                            take it off (the save was refused)
 *   frame  → parent { source:'setnayan-site', t:'mainGround', seq, shown }   the still is on screen / could not load
 *   frame  → parent { source:'setnayan-site', t:'mainGround', seq, playing: true }  its clip is moving (the Maker's stopwatch)
 *   frame  → parent { source:'setnayan-site', t:'mainGround', redrawn: true } the page's own render is on screen
 *
 * 🔑 A PREVIEW, NEVER THE TRUTH. The save follows; once it lands the page
 * re-renders ITSELF in place (`{ t:'refresh' }`), and when THAT render is on
 * screen the layer is taken away (`redrawDone`) — what stays is what the server
 * drew, with its measured veil and colours. A pick laid while a redraw was
 * already on its way outlives it (that render is older than the pick).
 *
 * 🔒 NOTHING FROM THE MESSAGE BECOMES CSS UNCHECKED: an address must be this
 * origin's own path or an https URL with no quote, bracket or space; a colour a
 * 6-digit hex; a blend or pattern a gradient spelled in a closed alphabet (no
 * `url(`, no quote, no semicolon); a position one of three words. The bridge
 * also checks the message's origin. Tiny and dependency-free: it ships in the
 * guest page's bundle, behind the bridge.
 */

/** `lib/background-pick.ts` builds it (`backgroundLayOf`); a type only — nothing of the Maker's ships here. */
export type MainGroundLay = {
  still: string | null;
  clip: string | null;
  position: string;
  color: string | null;
  image: string | null;
  size: string | null;
};
export type MainGroundPreview = { seq: number; lay: MainGroundLay | null };

const POSITIONS = ['center', 'center top', 'center bottom'];
const HEX = /^#[0-9a-f]{6}$/i;
/** Gradients only — letters, digits and the punctuation a gradient or a `var(--…)` needs. */
const PAINT = /^[a-z0-9#(),.%\s/-]{1,1200}$/i;
const UNSAFE_URL = /[\s"'()<>\\]/;

function addressOk(u: unknown, origin: string): u is string {
  if (typeof u !== 'string' || u.length === 0 || u.length > 2048 || UNSAFE_URL.test(u)) return false;
  if (u.startsWith('/')) return !u.startsWith('//');
  return u.startsWith('https://') || u.startsWith(`${origin}/`);
}
const paintOk = (v: unknown): v is string => typeof v === 'string' && PAINT.test(v) && !/url|image|expression/i.test(v);

/** The message's payload, or null when any part of it is not what the Maker's own builder writes. */
export function sanitizeMainGroundPreview(data: unknown, origin: string): MainGroundPreview | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { seq?: unknown; lay?: unknown };
  if (typeof d.seq !== 'number' || !Number.isSafeInteger(d.seq) || d.seq < 1) return null;
  if (d.lay === null) return { seq: d.seq, lay: null };
  if (!d.lay || typeof d.lay !== 'object') return null;
  const l = d.lay as Record<string, unknown>;
  const opt = <T,>(v: unknown, ok: (x: unknown) => x is T): T | null | undefined => (v === null || v === undefined ? null : ok(v) ? v : undefined);
  const still = opt(l.still, (x): x is string => addressOk(x, origin));
  const clip = opt(l.clip, (x): x is string => addressOk(x, origin));
  const color = opt(l.color, (x): x is string => typeof x === 'string' && HEX.test(x));
  const image = opt(l.image, paintOk);
  const size = opt(l.size, paintOk);
  const position = typeof l.position === 'string' && POSITIONS.includes(l.position) ? l.position : null;
  if (still === undefined || clip === undefined || color === undefined || image === undefined || size === undefined || !position) return null;
  return { seq: d.seq, lay: { still, clip, position, color, image, size } };
}

export type MainGroundPreviewer = {
  lay(preview: MainGroundPreview): void;
  /** The page was just asked to re-render itself. */
  redrawStarted(): void;
  /** …and that render is on screen: the server's own ground is the truth now. */
  redrawDone(): void;
};

/**
 * The previewer for ONE canvas document. `layer` is the bridge's own element
 * (`fixed inset-0 -z-10`, after every ground the page draws, `hidden` at rest);
 * `tell` posts to the Maker.
 */
export function createMainGroundPreviewer(
  layer: HTMLElement,
  tell: (m: { seq: number; shown: boolean } | { seq: number; playing: true } | { redrawn: true }) => void,
): MainGroundPreviewer {
  const doc = layer.ownerDocument;
  const win = doc.defaultView;
  let seq = 0;
  let atRedraw = 0;
  const off = () => {
    layer.hidden = true;
    layer.replaceChildren();
    layer.removeAttribute('style');
  };
  const paint = (l: MainGroundLay) => {
    layer.style.backgroundColor = l.color ?? (l.still ? '' : 'rgb(var(--color-cream))');
    layer.style.backgroundImage = l.image ?? '';
    layer.style.backgroundSize = l.size ?? '';
  };
  const calm = () =>
    Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) ||
    (win?.navigator as { connection?: { saveData?: boolean } } | undefined)?.connection?.saveData === true;
  return {
    lay({ seq: n, lay: l }) {
      if (n < seq) return; // an older pick's message, late
      seq = n;
      if (!l) return off();
      if (!l.still) {
        /* A colour, a blend, a pattern: nothing to fetch. */
        layer.replaceChildren();
        paint(l);
        layer.hidden = false;
        tell({ seq: n, shown: true });
        return;
      }
      /* A picture: its still first — and the layer keeps what it showed until this one is READY, so a second pick
         never flashes back to the saved background on its way to the new one. */
      const img = new (win?.Image ?? Image)();
      img.onload = () => {
        if (seq !== n) return;
        const still = doc.createElement('div');
        still.className = 'absolute inset-0 bg-cover';
        still.style.backgroundImage = `url(${JSON.stringify(l.still)})`;
        still.style.backgroundPosition = l.position;
        layer.replaceChildren(still);
        paint(l);
        layer.hidden = false;
        (win?.requestAnimationFrame ?? ((f: () => void) => f()))(() => seq === n && tell({ seq: n, shown: true }));
        if (!l.clip || calm()) return;
        /* …then the clip, invisible until it MOVES (the guest page's own rule): a clip that cannot play leaves the still. */
        const clip = doc.createElement('video');
        clip.muted = true;
        clip.loop = true;
        clip.playsInline = true;
        clip.preload = 'auto';
        clip.setAttribute('aria-hidden', 'true');
        clip.className = 'absolute inset-0 h-full w-full object-cover';
        clip.style.objectPosition = l.position;
        clip.style.opacity = '0';
        clip.style.transition = 'opacity 200ms';
        clip.addEventListener(
          'playing',
          () => {
            clip.style.opacity = '1';
            if (seq === n) tell({ seq: n, playing: true });
          },
          { once: true },
        );
        clip.addEventListener('error', () => clip.remove(), { once: true });
        clip.src = l.clip;
        layer.append(clip);
        void clip.play().catch(() => {});
      };
      img.onerror = () => seq === n && tell({ seq: n, shown: false });
      img.src = l.still;
    },
    redrawStarted() {
      atRedraw = seq;
    },
    redrawDone() {
      tell({ redrawn: true });
      if (seq !== atRedraw || layer.hidden) return;
      const n = seq;
      const drop = () => seq === n && off();
      /* A moving preview waits (briefly) for the page's own clip to move, so the swap is not a still frame between two films. */
      const mine = layer.querySelector('video');
      const theirs = [...doc.querySelectorAll<HTMLVideoElement>('[data-main-ground] video, [data-guest-ground] video')].find((v) => !layer.contains(v));
      if (mine && !mine.paused && theirs && (theirs.paused || theirs.currentTime === 0)) {
        theirs.addEventListener('playing', drop, { once: true });
        win?.setTimeout(drop, 2500);
      } else drop();
    },
  };
}
