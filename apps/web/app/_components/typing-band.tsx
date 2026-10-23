'use client';

/**
 * typing-band.tsx — THE BAND ON THE KEYBOARD: "Typing · <place>" and ✓ Done (owner 2026-10-24, "Yes", on
 * `prototypes/keyboard_rides_the_input_2026-10-24.html`: *"Like this."* — the Maker's — and *"This should be a
 * template that will make everyone adapt."*).
 *
 * It is the Maker's typing bar, extracted: the classes are `SP_KEY_BAR` / `SP_KEY_BAR_FIXED` / `SP_KEY_DONE`
 * (`lib/maker-stage-room.ts`), the words are "Typing · <place>", and the ONE action is the app's main button, Done.
 * Done blurs the open field (`document.activeElement.blur()`), which KEEPS what was typed (the typed row's rule); a
 * caller may pass its own `onDone` (the Maker's typing-in-place closes its session).
 *
 * Three ways to stand, one look:
 *   · in flow (`inline`) — the Maker's toolbar draws it over its one open field (`stage-tools.tsx`);
 *   · on the keyboard (`fixed`) — portaled to <body>, edge to edge, its foot on the keyboard's top
 *     (`bottom` px, else `useKeyboardRide().bottom`): the Maker's typing-in-place and its RSVP words;
 *   · over a row (`over`) — the same fixed band, standing on a bottom row that rides the keyboard (`ThumbRow`, the
 *     chat composer): its plate reaches down behind that row, so the band and the row read as ONE cream plate.
 *
 * Outside the Maker the band carries the app's own copy of the Maker's three neutrals (`[data-typing-band="app"]` in
 * globals.css, with a dark pair); inside it, it reads the Maker's (`STAGE_PANEL_VARS`) — so the Maker is unchanged.
 * This is the only typing band (`every-bottom-input-rides-the-keyboard.test.ts`).
 */
import { useEffect, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { SP_KEY_BAR, SP_KEY_BAR_FIXED, SP_KEY_DONE } from '@/lib/maker-stage-room';
import { useKeyboardRide } from '@/lib/keyboard-ride';

/** Done's default: leave the field (a press outside it KEEPS — the typed row's own rule). */
export function blurTyping() {
  (document.activeElement as HTMLElement | null)?.blur?.();
}

type Common = {
  /** What is being typed — "Search guests", "Names", "Message". */
  place: ReactNode;
  onDone?: () => void;
  /** Anything else of the bar (an error line, its own <style>), drawn inside it. */
  children?: ReactNode;
  /** Drawn first inside the bar (a `<style>` the bar carries). */
  before?: ReactNode;
  /** data-* / role / aria on the bar itself. */
  attrs?: Record<string, string | undefined>;
  barRef?: Ref<HTMLDivElement>;
  /** A press on the band never takes the focus from the field it types for (a band that lives only while the field
   *  is focused would close under the finger). Always on for `over`. */
  keepFocus?: boolean;
};

const holdFocus = (e: { preventDefault: () => void }) => e.preventDefault();

function Face({ place, onDone }: { place: ReactNode; onDone?: () => void }) {
  return (
    <>
      <span className="min-w-0 truncate">Typing · {place}</span>
      {/* Done is the bar's ONE action: the app's main button (the accent — `ActionButton`), never an ink pill. */}
      <span data-type-done="" className={SP_KEY_DONE}>
        <ActionButton tone="brand" main icon={Check} label="Done" onClick={onDone ?? blurTyping} />
      </span>
    </>
  );
}

/** In flow — the Maker's toolbar (`[data-stage-keys]`). */
export function TypingBand(props: Common & { inline: true; className?: string }): ReactNode;
/** Fixed to the keyboard's top, portaled to <body>. `bottom` px, else the one keyboard reading. */
export function TypingBand(props: Common & { fixed: true; bottom?: number; className?: string; style?: CSSProperties }): ReactNode;
/** Fixed over a riding row: `bottom` (px from the layout viewport's foot) and the row's `under` height (px). */
export function TypingBand(props: Common & { over: { bottom: number; under: number } }): ReactNode;
export function TypingBand(
  props: Common & { inline?: true; fixed?: true; over?: { bottom: number; under: number }; bottom?: number; className?: string; style?: CSSProperties },
): ReactNode {
  const { place, onDone, children, before, attrs, barRef, keepFocus } = props;
  const k = useKeyboardRide();
  const [here, setHere] = useState(false);
  useEffect(() => setHere(true), []);

  if (props.inline) {
    return (
      <div
        ref={barRef}
        {...attrs}
        onPointerDown={keepFocus ? holdFocus : undefined}
        onMouseDown={keepFocus ? holdFocus : undefined}
        className={`${props.className ?? ''} ${SP_KEY_BAR}`.trim()}
      >
        {before}
        <Face place={place} onDone={onDone} />
        {children}
      </div>
    );
  }
  if (!here) return null;
  if (props.over) {
    const { bottom, under } = props.over;
    return createPortal(
      <div
        ref={barRef}
        role="toolbar"
        aria-label={typeof place === 'string' ? `${place} — typing` : 'Typing'}
        data-typing-band="app"
        {...attrs}
        // The plate is the band (44) AND the row under it: one cream surface from the band's top to the keyboard.
        style={{ bottom, height: 44 + under }}
        // A press on the band never takes the focus from the field it is typing for (Done's own press blurs it).
        onPointerDown={holdFocus}
        onMouseDown={holdFocus}
        className="pointer-events-none fixed inset-x-0 z-[24] flex flex-col rounded-t-[18px] bg-[var(--tb-plate)]"
      >
        <div className={`pointer-events-auto !border-t-0 !bg-transparent ${SP_KEY_BAR_FIXED}`}>
          {before}
          <Face place={place} onDone={onDone} />
          {children}
        </div>
      </div>,
      document.body,
    );
  }
  return createPortal(
    <div
      ref={barRef}
      {...attrs}
      style={{ ...props.style, bottom: props.bottom ?? k.bottom }}
      className={`fixed inset-x-0 z-[85] ${props.className ?? ''} ${SP_KEY_BAR_FIXED}`.replace(/\s+/g, ' ')}
    >
      {before}
      <Face place={place} onDone={onDone} />
      {children}
    </div>,
    document.body,
  );
}
