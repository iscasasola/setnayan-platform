'use client';

/**
 * ✋ A MESSAGE'S PRESS-AND-HOLD MENU (Supplier Build 3 · Lane A). Hold a bubble (≈ half a second; right-click on a
 * desktop) and a small menu opens under it. One item today — **Reply privately** (owner, 9 Nov: "they can also send
 * private message anytime"), which pre-picks that message's SENDER and puts the message box in private mode
 * ("Private message to [name]"). Offered only on someone else's message that a person wrote (never yours, never the auto-reply).
 *
 * The hold never toggles the heart: the tap that ends a hold is swallowed (`consumeTap`), so ♥ stays ONE TAP.
 * 🔒 lib/a-private-message-looks-private.test.ts
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Lock } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

export const HOLD_MS = 450;

/** One hook for the whole stream: which message's menu is open, and the handlers a bubble spreads. */
export function useMessageHold() {
  const [openId, setOpenId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  const holdProps = useCallback(
    (messageId: string) => ({
      onPointerDown: (e: ReactPointerEvent) => {
        if (e.button !== 0) return;
        held.current = false;
        cancel();
        timer.current = setTimeout(() => {
          held.current = true;
          setOpenId(messageId);
        }, HOLD_MS);
      },
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onContextMenu: (e: { preventDefault: () => void }) => {
        e.preventDefault();
        cancel();
        setOpenId(messageId);
      },
    }),
    [cancel],
  );
  /** True once, for the click that ends a hold — the bubble then skips its heart. */
  const consumeTap = useCallback(() => {
    if (!held.current) return false;
    held.current = false;
    return true;
  }, []);
  return { openId, close: () => setOpenId(null), holdProps, consumeTap };
}

export function MessageHoldMenu({
  senderName,
  alignEnd,
  onReplyPrivately,
}: {
  senderName: string;
  alignEnd: boolean;
  onReplyPrivately: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="Message options"
      className={`mt-1 flex ${alignEnd ? 'self-end' : 'self-start pl-[38px]'}`}
      data-chat-hold-menu=""
    >
      <ActionButton
        tone="info"
        icon={Lock}
        label="Reply privately"
        name={`Reply to ${senderName} privately`}
        onClick={onReplyPrivately}
        data-testid="chat-reply-privately"
      />
    </div>
  );
}
