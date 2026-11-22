'use client';

import { createContext } from 'react';

/**
 * 🧰 THE TOOL IS INSIDE THE TEXT BOX (Unichat part B, 20 Nov 2026; approved drawing `UNICHAT-LIVE-2026-11-19.html`:
 * "tap +, pick one. The text box becomes that tool"). Whoever draws a draft card inside the composer (a phone) or in
 * the third column (a computer) wraps it in this. Inside it a card drops its own frame, head and ✕ — the box is the
 * frame, its row says the tool's name and its ← is the way back — and a step card hands its Next / Send to the box's
 * own Send place (`sendSlot`), so Send sits where Send always is and says what it sends.
 */
export type ChatToolFrameValue = { sendSlot: HTMLElement | null };
export const ChatToolFrame = createContext<ChatToolFrameValue | null>(null);
