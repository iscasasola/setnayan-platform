## 2026-08-04 · fix(schedule): a 2 PM booking stopped meaning 10 PM

Two more places read the venue's wall clock as if it were a UTC instant.

**Booking an appointment.** The "Date & time" box on the appointments panel
posted a plain time with no timezone attached. On the server — which runs in UTC
— a **2 PM** site visit was written down as **2 PM UTC**, and every screen that
shows it in Philippine time then displayed **10 PM** to both the couple and the
vendor. Nothing errored; the appointment simply sat at the wrong hour.

Two other appointment forms had dodged this by hand-typing the offset into the
value. That works until a third form is added and nobody remembers — which is
exactly what happened. The conversion now happens once, where the value lands,
so a plain date-and-time box is safe by default and the offset is typed nowhere.

**The vendor's calendar subscription.** The timeline feed stamped every moment
as UTC, so a photographer who added the wedding to their phone found the 2 PM
ceremony sitting in their diary at **10 PM** — eight hours after everyone else
arrived. The feed now declares the venue's timezone and anchors each moment to
it, so the wedding lands at the hour it actually happens no matter where the
vendor is standing.

Also checked and found sound: the coordinator's call-time value, which compares
two schedule times against each other rather than against a real clock, and
which nothing displays yet.

SPEC IMPACT: None.
