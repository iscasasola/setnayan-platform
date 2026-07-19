import 'server-only';
import { renderBrandedEmail } from '@/lib/email-template';

// Godchild BIRTHDAY REMINDER email (date-anchor · Phase 3 family graph).
//
// A daily CRON-FREE job (runGodchildBirthdayReminders in lib/daily-email-jobs.ts,
// fired from public-page after() traffic) resolves the (ninong/ninang → godchild)
// pairs whose next birthday is ~2 weeks out (via godchildren_with_birthday_soon)
// and sends each godparent this gentle heads-up. This module only SHAPES the
// email; the job does the DB read, the per-(godparent, year) idempotency lock,
// and the actual sendEmail() call.
//
// The recipient is a THIRD PARTY the guardian added (not necessarily a Setnayan
// user), so the copy is self-contained, sets no account expectation, and always
// carries a real opt-out — the godparent can also be silenced from the guardian's
// side (reminders_enabled). No e-gift CTA yet (that surface isn't live); the CTA
// is a soft link home.

export const GODCHILD_SUPPORT_EMAIL = 'support@setnayan.com';

export type GodchildReminderEmailParts = {
  /** The godparent's name, e.g. "Tita Baby". */
  godparentName: string;
  /** ninong | ninang | null (null → neutral "godparent"). */
  role: string | null;
  /** The child's first name / display name. */
  godchildName: string;
  /** The age the child is turning (>= 1). */
  turningAge: number;
  /** Friendly birthday label, e.g. "Sun, Sep 21". */
  birthdayLabel: string;
  /** Days until the birthday (for the countdown line). */
  daysAway: number;
  /** Absolute URL for the soft CTA (home). */
  ctaHref: string;
};

export type GodchildReminderEmail = {
  subject: string;
  text: string;
  html: string;
};

/** "in 3 days" / "in about 2 weeks" — a warm, imprecise countdown. Pure. */
function awayPhrase(daysAway: number): string {
  const d = Math.max(0, Math.trunc(daysAway));
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d < 14) return `in ${d} days`;
  const weeks = Math.round(d / 7);
  return weeks <= 1 ? 'in about a week' : `in about ${weeks} weeks`;
}

/** "godchild" possessive framing from the role. Pure. */
function roleWord(role: string | null): string {
  return role === 'ninong' || role === 'ninang' ? role : 'godparent';
}

/**
 * Build the godchild birthday-reminder email for one godparent. Pure: the caller
 * pairs the returned parts in sendEmail() and adds the RFC 8058 unsubscribe
 * headers.
 */
export function buildGodchildReminderEmail(
  parts: GodchildReminderEmailParts,
): GodchildReminderEmail {
  const { godparentName, role, godchildName, turningAge, birthdayLabel, daysAway, ctaHref } = parts;
  const who = (godparentName ?? '').trim() || 'there';
  const child = (godchildName ?? '').trim() || 'your godchild';
  const away = awayPhrase(daysAway);
  const rw = roleWord(role);

  const subject = `${child}'s birthday is coming up 🎂`;

  const greeting = `Hi ${who},`;
  const p1 = `${child} — your ${rw === 'godparent' ? 'godchild' : `inaanak, as their ${rw}`} — turns ${turningAge} ${away} (${birthdayLabel}).`;
  const p2 = `Just a gentle nudge so it doesn't slip by. A greeting, a small gift, or simply being there means the world at this age.`;
  const p3 = `Salamat for being part of their story. 💛`;

  const text = [
    greeting,
    '',
    p1,
    '',
    p2,
    '',
    p3,
    '',
    `— Set na 'yan.`,
    '',
    `You're receiving this because ${child}'s family added you as their ${rw} on Setnayan and turned on birthday reminders. To stop these, reply with "unsubscribe" or email ${GODCHILD_SUPPORT_EMAIL} — or ask their family to switch reminders off.`,
  ].join('\n');

  const html = renderBrandedEmail({
    heading: `${child}'s birthday is coming up 🎂`,
    paragraphs: [greeting, p1, p2, p3],
    ctaLabel: 'Open Setnayan',
    ctaHref,
    footnote: `You're receiving this because ${child}'s family added you as their ${rw} on Setnayan and turned on birthday reminders. To stop these, reply with "unsubscribe" or email ${GODCHILD_SUPPORT_EMAIL} — or ask their family to switch reminders off.`,
  });

  return { subject, text, html };
}

/** RFC 8058 one-click unsubscribe headers for the godchild-reminder send. Pure. */
export function godchildReminderUnsubscribeHeaders(): Record<string, string> {
  return {
    'List-Unsubscribe': `<mailto:${GODCHILD_SUPPORT_EMAIL}?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
