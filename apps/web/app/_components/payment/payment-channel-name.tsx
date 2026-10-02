/**
 * app/_components/payment/payment-channel-name.tsx — a payment's channel, said
 * as the receiving account's NAME.
 *
 * `payments.channel` stores an account ID ("gcash", "bdo", and now whatever the
 * admin adds — "maribank-7k2q"). The id is a key, not a word: the owner's
 * ruling (2026-10-02, "say any bank or e-wallet") opened the list to any bank,
 * and the first new account would have printed its raw id on a couple's order
 * page and a supplier's booking-fee page. This reads the name from the same
 * list checkout shows (`channelLabel`), so a rename in Admin → Payment methods
 * reaches every payment line.
 *
 * Server-safe (no hooks): both order pages are server components.
 */
import { channelLabel, type ChannelSettings } from '@/lib/payment-channels';

export function PaymentChannelName({
  settings,
  channel,
}: {
  settings: ChannelSettings;
  channel: string | null | undefined;
}) {
  return <span data-payment-channel>{channelLabel(settings, channel)}</span>;
}
