import { channelForZoneIndex, formatChannel } from './live-studio-control';

/**
 * WHAT GOES ON A PRINTED CAMERA CARD — and what deliberately does not.
 *
 * ── THE DEFECT THIS EXISTS TO CLOSE ─────────────────────────────────────────
 * The printable hand-out used to render one card per camera SEAT, titled
 * `Camera 3` from the seat's own index, under the retired per-seat model. The
 * controller a host actually operates mints one join code **per CHANNEL** and
 * names it the way the host named it — `CH 3 · Main stage`. Two vocabularies for
 * the same QR, so the operator holding "Camera 3" had nothing on screen to match
 * it to.
 *
 * It also printed seats bound to NO channel. Those QRs work — a phone claims the
 * seat — and the camera then appears on no channel and can never go on air. A card
 * that leads nowhere, handed out at a venue, on a day that cannot be re-run.
 *
 * ── WHY THIS IS A MODULE AND NOT A LOOP IN THE PAGE ─────────────────────────
 * Two surfaces need the same answer: the sheet renders the cards, and the
 * controller decides whether to offer the "Print" doorway at all. If the doorway
 * counted one thing and the sheet printed another, the host is promised cards that
 * do not appear — the same class of silent disagreement the cards themselves were
 * suffering from. One function, both callers.
 *
 * Captions come from `formatChannel`, which is the ONE place channel captions are
 * composed anywhere in Live Studio, so a printed card cannot word itself
 * differently from the screen.
 */

/** One channel, plus whatever its bound camera seat resolved to. */
export type ChannelCardInput = {
  zoneId: number;
  /** The channel's own ordering index — `channelForZoneIndex` turns it into CH n. */
  zoneIndex: number;
  label: string;
  venueLabel?: string | null;
  /**
   * The join link, or null. `fetchChannelCameras` already returns null for a
   * CLAIMED seat (the link is a live credential that would let a second phone take
   * the camera) and for a REVOKED one (the token is dead — a QR that silently
   * cannot work). Those two decisions are made THERE, once; nothing here
   * re-derives them.
   */
  claimUrl?: string | null;
  /** Whether a seat exists at all, and its state — used only to explain an absence. */
  hasSeat: boolean;
  claimed?: boolean;
  revoked?: boolean;
};

export type CameraCard = {
  zoneId: number;
  channel: number;
  /** `CH 3 · Main stage` — identical to the control room's caption. */
  title: string;
  venue: string | null;
  claimUrl: string;
};

/** A channel with nothing printable, and the plain-English reason. */
export type WaitingChannel = {
  zoneId: number;
  channel: number;
  title: string;
  why: string;
};

export type CameraCardSheet = {
  cards: CameraCard[];
  /**
   * NEVER a silent omission. A channel missing from the sheet is a camera nobody
   * gets handed a code for, and an absence the host cannot see is how you arrive at
   * a venue one camera short. The page lists these on screen, off the printed page.
   */
  waiting: WaitingChannel[];
};

/**
 * Split an event's channels into "has a card to print" and "does not, and here is
 * why". Pure and total: every channel lands in exactly one list.
 */
export function buildCameraCards(rows: readonly ChannelCardInput[]): CameraCardSheet {
  const cards: CameraCard[] = [];
  const waiting: WaitingChannel[] = [];

  for (const row of rows) {
    const channel = channelForZoneIndex(row.zoneIndex);
    const title = formatChannel(channel, row.label);
    const claimUrl = row.claimUrl ?? null;

    if (claimUrl) {
      cards.push({
        zoneId: row.zoneId,
        channel,
        title,
        venue: row.venueLabel?.trim() || null,
        claimUrl,
      });
      continue;
    }

    waiting.push({
      zoneId: row.zoneId,
      channel,
      title,
      why: !row.hasSeat
        ? 'no join code yet — make one in the control room'
        : row.claimed
          ? 'a phone has already joined this channel'
          : row.revoked
            ? 'its code was retired — make a new one in the control room'
            : 'no join code to hand out yet',
    });
  }

  return { cards, waiting };
}

/**
 * How many cards the sheet would actually print.
 *
 * The controller calls this to decide whether to show the "Print" doorway: a link
 * onto "nothing to print yet" is a fake door, and it must count exactly what the
 * sheet produces rather than approximating it.
 */
export function printableCardCount(rows: readonly ChannelCardInput[]): number {
  return buildCameraCards(rows).cards.length;
}
