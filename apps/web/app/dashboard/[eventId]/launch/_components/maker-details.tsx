import Link from 'next/link';
import type { ReactNode } from 'react';
import { InfoTip } from '@/app/_components/info-tip';
import type { PrintParent, StoredPrintDetails } from '@/lib/print-pieces';
import { HubDraftField, HubSavesImmediately } from '../../website/_components/hub-draft-field';
import { PabuyaMessageEditor } from '../../pabuya/_components/pabuya-message-editor';
import { OpeningLineField } from './opening-line-field';
import { MAKER_DETAILS_LABEL } from './maker-bar';
import { SlugField } from '../../invitation/_components/slug-field';
import { MakerRsvpAsk } from './maker-rsvp-ask';
import type { RsvpAskConfig } from '@/lib/rsvp-ask';
import { siteOrigin } from '@/lib/site-origin';
import { publicEventPath } from '@/lib/public-event-url';
import { PRINT_PIECES } from '@/lib/print-pieces';

/**
 * DETAILS — the made-once panel of the Event Hub Maker: WHAT the stages and the
 * printed set include, and every line of wording (owner 2026-09-25, verbatim:
 * *"So they will check on what they want added from the sidebar menu. Guest List
 * · 3D Plan / 2D Plan / List · EGifts · Love Story · Schedule · Event Hub Link -
 * QR or place sticker here"* · *"yes mood board"* · *"toggles are better"*).
 *
 * 🔑 NOTHING IS RE-ENTERED. Each toggle names a source that already has a home
 * and reads it from there:
 *   Guest list → names on passes, parents on the card · Seat plan → the shipped
 *   seating print (3D · 2D · List) · E-Gifts → gift details + the thank-you
 *   message (`events.pabuya_message`, ONE source, edited here or on E-Gifts) ·
 *   Love Story · Schedule (guest-visible moments) · Mood Board → "Our colours"
 *   · Event Hub link → its QR, or a marked spot for an NFC sticker.
 * The written lines (opening line with templates, "Kindly reply" as a host /
 * coordinator / manual pick) and the special message live here too — and, at
 * the top, the Event Hub ADDRESS (owner: "Add the slug to details"), edited with
 * the shipped `SlugField` and shown with the QR every print carries.
 *
 * The special message saves into the DRAFT (guests read it on the Event Hub).
 * The rest writes live and says so (`every-maker-form-drafts-or-says-so.test.ts`):
 * the address is never drafted; the include toggles, opening line and "Kindly
 * reply" (`events.print_details`) shape only the printed set the couple
 * downloads — no guest page reads them; and the thank-you message is the
 * E-Gifts page's own column, edited there too.
 *
 * ── WHAT DO YOU ASK YOUR GUESTS? (owner 2026-09-25) ──────────────────────
 * The panel's newest section, `<MakerRsvpAsk>` — which of the RSVP form's OWN
 * questions this couple still asks: plus-ones, meal, dietary, a song request,
 * a note, a mobile number. UNLIKE every toggle above, a guest DOES read this
 * one (the reply card, live on the Event Hub), so it goes through the same
 * Draft → Apply door as the reveal and the logo (`events.rsvp_ask_config`,
 * `lib/rsvp-ask.ts`) — not the print words' live save.
 *
 * 🖼 DETAILS IS A PAGE (owner 2026-09-25: *"we do not want a pop up for details,
 * logo, hero, reveal and love story. we want their actual page to be on the body
 * of the editor"*). `MakerDetails` is the CONTROLS — these fields, where a
 * stage's controls sit — and `MakerDetailsPage` is the body: what the details
 * FEED, drawn as guests and printers will meet it (see its note for why).
 */
export function MakerDetails({
  eventId,
  stored,
  hosts,
  parents,
  pabuyaMessage,
  specialMessage,
  specialMessageAction,
  hasPalette,
  hasGifts,
  flash,
  slug,
  slugAction,
  rsvpAsk,
  rsvpAskDrafted,
}: {
  /** The event's address — owner: "Add the slug to details". */
  slug: string | null;
  /** `updateEventSlug` bound to this event (the one writer, `findSlugConflict` behind it). */
  slugAction: (formData: FormData) => Promise<void>;
  eventId: string;
  stored: StoredPrintDetails;
  hosts: Array<{ moderatorId: string; label: string; contact: string | null }>;
  parents: PrintParent[];
  pabuyaMessage: string | null;
  specialMessage: string | null;
  specialMessageAction: (formData: FormData) => Promise<void>;
  /** The couple has a Mood Board palette to print. */
  hasPalette: boolean;
  /** The couple has E-Gifts set up. */
  hasGifts: boolean;
  flash: 'saved' | 'error' | null;
  /** The drafted-over-live `events.rsvp_ask_config` — "What do you ask your guests?" */
  rsvpAsk: RsvpAskConfig;
  /** The draft holds a different set of questions than what guests currently see. */
  rsvpAskDrafted: boolean;
}) {
  const PRINT_WORDS_ENDPOINT = '/api/hub-print/words';
  const inc = stored.include;
  const current = stored.rsvp?.kind === 'host' ? `host:${stored.rsvp.moderatorId}` : stored.rsvp?.kind === 'manual' ? 'manual' : '';
  const back = `/dashboard/${eventId}/launch?tool=details`;
  const base = `/dashboard/${eventId}`;
  return (
    <div data-maker-details="" className="px-1">
      <div className="flex flex-col gap-5">
        <p className="text-[13.5px] text-ink/75">
          Turn on what your printed set includes — each part is read from where it already lives, so nothing is typed
          twice. Your wording lives here too.
        </p>

        {/* ── Your Event Hub address — the one place it is edited (owner:
            "Add the slug to details"). The shipped SlugField: 3–32 characters,
            live availability, old links forward. Its QR — the one every print
            carries — is drawn on the page beside these fields. ── */}
        <section data-details-address="" className="flex flex-col gap-2 border-b border-ink/10 pb-5">
          <p className="text-sm font-semibold text-ink">Your Event Hub address</p>
          <SlugField eventId={eventId} initialSlug={slug ?? ''} saveAction={slugAction} />
          <HubSavesImmediately className="mt-1" />
        </section>

        {flash === 'saved' ? (
          <p role="status" className="rounded-md border border-success-300/60 bg-success-50 px-4 py-2 text-sm text-success-800">
            Saved.
          </p>
        ) : flash === 'error' ? (
          <p role="alert" className="rounded-md border border-danger-300/60 bg-danger-50 px-4 py-2 text-sm text-danger-800">
            That did not save. Nothing changed — please try again.
          </p>
        ) : null}

        <form action={PRINT_WORDS_ENDPOINT} method="post" data-details-include="" className="flex flex-col gap-1">
          <HubSavesImmediately />
          <input type="hidden" name="event_id" value={eventId} />
          {/* The include marker: a posted form ALWAYS carries it, so an
              all-off form still saves "off" instead of looking like no answer. */}
          <input type="hidden" name="include_form" value="1" />

          <Toggle name="inc_guest_names" label="Guest list — names on passes" on={inc.guestNames} />
          <Toggle
            name="inc_parents"
            label="Guest list — parents on the invitation"
            on={inc.parents}
            tip="Guests with the role Parents of the Bride or Parents of the Groom. Parents are optional — with none, the card leaves that part out."
          >
            {parents.length ? (
              <p className="text-xs text-ink/65">{parents.map((p) => p.name).join(' · ')}</p>
            ) : (
              <p className="text-xs text-ink/65">No parents on your guest list yet.</p>
            )}
            <Link href={`${base}/guests`} className="text-xs font-medium text-mulberry underline underline-offset-2">
              {parents.length ? 'Edit on Guest list' : 'Add parents on your Guest list'}
            </Link>
          </Toggle>
          <Toggle name="inc_seat_plan" label="Seat plan" on={inc.seatPlan !== 'none'} tip="Prints your seating chart from the Seat plan you already made.">
            <Segmented name="seat_plan_kind" value={inc.seatPlan === 'none' ? 'list' : inc.seatPlan} options={[['3d', '3D'], ['2d', '2D'], ['list', 'List']]} />
          </Toggle>
          <Toggle
            name="inc_gift_details"
            label="E-Gifts — gift details"
            on={inc.giftDetails && hasGifts}
            disabled={!hasGifts}
            note={hasGifts ? null : (
              <Link href={`${base}/pabuya`} className="underline underline-offset-2">
                Set up E-Gifts
              </Link>
            )}
            tip="Account numbers print masked (•••• 1234)."
          />
          <Toggle name="inc_thank_you" label="E-Gifts — thank-you message" on={inc.thankYou} />
          <Toggle name="inc_love_story" label="Love Story" on={inc.loveStory !== 'none'} tip="A short excerpt of your story on the Finer Details card." />
          <Toggle name="inc_schedule" label="Schedule — the program" on={inc.schedule} tip="Only the moments your guests can see." />
          <Toggle
            name="inc_mood_board"
            label="Mood Board — our colours"
            on={inc.moodBoard && hasPalette}
            disabled={!hasPalette}
            note={hasPalette ? null : (
              <Link href={`${base}/studio/mood-board`} className="underline underline-offset-2">
                Build your Mood Board first
              </Link>
            )}
          />
          {/* The QR is automatic (owner: "QR is automatic. NFC is optional. we need
              that QR code since it is universal and works for all") — stated,
              never a switch. The NFC spot is the optional extra. */}
          <div data-include="qr-always" className="flex min-h-11 items-center justify-between gap-3 border-b border-ink/5 py-2.5">
            <span className="text-sm text-ink">Event Hub QR code</span>
            <span className="text-xs font-medium text-ink/60">Always printed</span>
          </div>
          <Toggle
            name="inc_nfc"
            label="Add an NFC sticker spot"
            on={inc.nfc}
            tip="Use 25 mm round NFC stickers (NTAG213/215). Write your Event Hub link to them first. The spot prints beside the QR — on the calling card it takes the corner; where a format has no room for both, the QR stays and the spot is left off."
          />
          <Toggle name="inc_special_message" label="Special message" on={inc.specialMessage} />

          <div className="mt-3 flex flex-col gap-4 border-t border-ink/10 pt-4">
            <Toggle name="inc_opening_line" label="Opening line" on={inc.openingLine}>
              <OpeningLineField initial={stored.openingLine} />
            </Toggle>
            <Toggle name="inc_rsvp" label="Kindly reply" on={inc.rsvp} tip="A host or your coordinator, read from their account — or type it in.">
              <select
                name="rsvp_choice"
                defaultValue={current}
                aria-label="Who guests reply to"
                className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
              >
                <option value="">Choose…</option>
                {hosts.map((h) => (
                  <option key={h.moderatorId} value={`host:${h.moderatorId}`}>
                    {h.label}
                    {h.contact ? ` — ${h.contact}` : ' — no number on their account'}
                  </option>
                ))}
                <option value="manual">Type it in…</option>
              </select>
              <input
                name="rsvp_manual"
                defaultValue={stored.rsvp?.kind === 'manual' ? stored.rsvp.text : ''}
                maxLength={160}
                aria-label="Reply line, typed in"
                placeholder="If you chose “Type it in”: e.g. Reply by Nov 18 · Claire, 0917 …"
                className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
              />
            </Toggle>
          </div>
          <div className="pt-2">
            <button type="submit" className="button-primary text-sm">
              Save
            </button>
          </div>
        </form>

        {/* ── The thank-you message: ONE source, `events.pabuya_message` — the E-Gifts page reads the same column ── */}
        <div data-details-thank-you="" className="flex flex-col gap-1">
          <HubSavesImmediately />
          <PabuyaMessageEditor eventId={eventId} initialMessage={pabuyaMessage} />
          <p className="text-xs text-ink/55">
            The message on your{' '}
            <Link href={`${base}/pabuya`} className="underline underline-offset-2">
              E-Gifts
            </Link>{' '}
            page — one message, edited here or there.
          </p>
        </div>

        {/* ── Special message → events.special_message ── */}
        <form action={specialMessageAction} data-details-special="" className="flex flex-col gap-3 border-t border-ink/10 pt-4">
          <HubDraftField />
          <input type="hidden" name="return_to" value={back} />
          <label className="flex flex-col gap-1 text-sm text-ink/80">
            Special message — your closing words to guests
            <textarea
              name="message"
              defaultValue={specialMessage ?? ''}
              maxLength={600}
              rows={3}
              placeholder="A heartfelt note to everyone joining you…"
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
            />
          </label>
          <div>
            <button type="submit" className="button-primary text-sm">
              Save
            </button>
          </div>
        </form>

        {/* ── What do you ask your guests? → events.rsvp_ask_config, DRAFTED ──
            Owner 2026-09-25: a setup step for the RSVP form's own questions —
            unlike the print toggles above (events.print_details, live), this
            one changes what a GUEST sees, so it follows the Draft → Apply door
            like the reveal and the logo, not the print words' live save. */}
        <MakerRsvpAsk eventId={eventId} current={rsvpAsk} drafted={rsvpAskDrafted} />
      </div>
    </div>
  );
}

/**
 * DETAILS' PAGE — the Maker's body while Details is picked.
 *
 * 🔑 WHY THIS IS THE "ACTUAL PAGE". Details has no page of its own on the guest
 * site; it FEEDS two things, and both are drawn here as they will be met:
 *
 *   1 · the Event Hub ADDRESS and its QR — the one every printed piece carries
 *       (`/api/website/qr/<slug>`, the same PNG the prints embed);
 *   2 · the two cards the wording fills — The Invitation (opening line, parents,
 *       "Kindly reply") and The Finer Details (E-Gifts, the thank-you message,
 *       the Love Story, the program, your colours, the special message) — drawn
 *       by the SAME route and layout Prints & Tickets uses (`/api/hub-print`,
 *       screen mode: a marked sample for a free couple, the real piece for Pro).
 *
 * Fields laid out as a page would only repeat the controls beside it; this shows
 * what they DO. Each save redirects back here and the cards redraw (`stamp`).
 */
export function MakerDetailsPage({
  eventId,
  slug,
  stamp,
}: {
  eventId: string;
  slug: string | null;
  /** Changes on every server render, so a save redraws the cards. */
  stamp: string;
}) {
  const card = (piece: 'invitation' | 'details') =>
    `/api/hub-print/${piece}?event=${encodeURIComponent(eventId)}&mode=screen&v=${encodeURIComponent(stamp)}`;
  const address = slug ? `${siteOrigin().replace(/^https?:\/\//, '')}${publicEventPath(slug)}` : null;
  const CARDS = [
    { piece: 'invitation', fed: 'Your opening line, your parents and “Kindly reply”.' },
    { piece: 'details', fed: 'E-Gifts, the thank-you message, your Love Story, the program, your colours and your special message.' },
  ] as const;
  return (
    <div
      data-maker-details-page=""
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[radial-gradient(120%_90%_at_50%_0%,rgba(203,167,102,.10),transparent_60%)] px-4 py-5 sm:px-6"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">What your details make</p>
          <p className="font-serif text-2xl text-ink">{MAKER_DETAILS_LABEL}</p>
          <p className="max-w-xl text-sm text-ink/70">
            Your address and its QR, and the cards your wording fills. Change a field and save — the cards redraw.
          </p>
        </header>

        <section
          data-details-page-address=""
          className="flex flex-col items-center gap-3 rounded-md bg-white/80 p-4 text-center shadow-[0_1px_2px_rgba(40,34,24,.06)] sm:flex-row sm:text-left"
        >
          {slug ? (
            // eslint-disable-next-line @next/next/no-img-element -- our own QR route, a PNG
            <img
              src={`/api/website/qr/${encodeURIComponent(slug)}`}
              alt="QR code for your Event Hub address"
              width={176}
              height={176}
              className="h-40 w-40 shrink-0 bg-white p-1 sm:h-44 sm:w-44"
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Your Event Hub address</p>
            {address ? (
              <p className="mt-1 break-all font-serif text-xl text-ink" data-details-page-url="">
                {address}
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink/70">No address yet — choose one beside this page.</p>
            )}
            <p className="mt-2 text-[12.5px] text-ink/60">Every printed piece carries this QR. Guests scan it to open your Event Hub.</p>
          </div>
        </section>

        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2" data-details-page-cards="">
          {CARDS.map(({ piece, fed }) => (
            <li key={piece} className="flex flex-col items-center gap-2" data-details-page-card={piece}>
              <div className="flex h-[320px] w-full items-center justify-center rounded-md bg-ink/[0.04] p-4 sm:h-[380px]">
                {/* eslint-disable-next-line @next/next/no-img-element -- the piece IS a generated image from our own route */}
                <img
                  src={card(piece)}
                  alt={PRINT_PIECES[piece].label}
                  loading="lazy"
                  className="max-h-full max-w-full drop-shadow-[0_18px_24px_rgba(0,0,0,0.28)]"
                />
              </div>
              <p className="text-sm font-semibold text-ink">{PRINT_PIECES[piece].label}</p>
              <p className="max-w-xs text-center text-xs text-ink/60">{fed}</p>
            </li>
          ))}
        </ul>

        <p className="text-sm text-ink/70">
          The whole set — passes, the poster, sizes and downloads — is in{' '}
          <Link href={`/dashboard/${eventId}/launch?tool=prints`} className="font-medium text-mulberry underline underline-offset-2">
            Prints &amp; Tickets
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/**
 * One include item: its name on the left, an ⓘ when it needs one, a single-knob
 * switch on the right (owner: "toggles are better"). Sub-options show under it
 * only while it is ON — CSS alone (`group-has`), so it works before hydration.
 */
function Toggle({
  name,
  label,
  on,
  tip,
  disabled = false,
  note = null,
  children,
}: {
  name: string;
  label: string;
  on: boolean;
  tip?: string;
  disabled?: boolean;
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="group/inc flex flex-col gap-2 border-b border-ink/5 py-2.5 last:border-0" data-include={name}>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-sm text-ink">
          {/* InfoTip prints its own label beside the ⓘ — one name, never two. */}
          {tip ? (
            <InfoTip label={label} align="start">
              {tip}
            </InfoTip>
          ) : (
            label
          )}
        </span>
        <input type="checkbox" role="switch" name={name} defaultChecked={on} disabled={disabled} className="peer sr-only" />
        <span
          aria-hidden
          className="relative h-6 w-11 shrink-0 rounded-full bg-ink/20 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-terracotta-700 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-mulberry peer-disabled:opacity-40"
        />
      </label>
      {note ? <p className="text-xs text-ink/60">{note}</p> : null}
      {children ? (
        <div className="hidden flex-col gap-2 pl-1 group-has-[[role=switch]:checked]/inc:flex">{children}</div>
      ) : null}
    </div>
  );
}

/** A small segmented choice (radio buttons that look like one control). */
function Segmented({ name, value, options }: { name: string; value: string; options: Array<[string, string]> }) {
  return (
    <div role="radiogroup" className="inline-flex w-fit rounded-full bg-ink/5 p-0.5">
      {options.map(([v, label]) => (
        <label key={v} className="cursor-pointer">
          <input type="radio" name={name} value={v} defaultChecked={value === v} className="peer sr-only" />
          <span className="inline-flex min-h-9 items-center rounded-full px-3 text-[13px] font-medium text-ink/65 peer-checked:bg-white peer-checked:text-ink peer-checked:shadow-sm">
            {label}
          </span>
        </label>
      ))}
    </div>
  );
}
