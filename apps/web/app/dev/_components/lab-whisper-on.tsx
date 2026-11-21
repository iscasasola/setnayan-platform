'use client';

/**
 * 🤫 LAB ONLY — turns the box to Whisper once, at mount, so a screenshot can show the Private chip and who it reaches
 * without a drag (`/dev/chat-lab?…&whisper=1`, `/dev/supplier-chat-lab?…&whisper=1`). Imported only by `/dev/*`.
 */
import { useEffect } from 'react';
import { setWhisper } from '@/app/_components/chat/whisper-mode';

export function LabWhisperOn({ threadId }: { threadId: string }) {
  useEffect(() => {
    setWhisper(threadId, true);
  }, [threadId]);
  return null;
}
