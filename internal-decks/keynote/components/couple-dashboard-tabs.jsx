// Remaining couple dashboard tabs + the vendor dashboard.

// ─────────────────────────── Vendors tab — pipeline + thread
const VendorsTab = ({ expand, setExpand }) => {
  const vendors = SETNAYAN_DATA.vendors;
  const sel = vendors.find(v => v.id === expand) || vendors[0];
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="display" style={{ fontSize: 36 }}>VENDORS</div>
          <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4 }}>
            Booked, in proposal, or just inquired — every vendor in one ledger. Click any to open the thread.
          </div>
        </div>
        <button className="btn btn-orange" style={{ padding: "8px 14px", fontSize: 13 }}>+ Find vendors</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {vendors.map((v, i) => {
            const isSel = v.id === sel.id;
            return (
              <button key={v.id} onClick={() => setExpand(v.id)} style={{
                width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                background: isSel ? "var(--orange-4)" : "var(--paper)",
                borderTop: i === 0 ? "none" : "1px solid var(--line-soft)",
                padding: "14px 18px", display: "grid",
                gridTemplateColumns: "auto 1fr auto auto", gap: 14, alignItems: "center",
                fontFamily: "var(--sans)",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--paper-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--orange-2)", fontSize: 14, fontWeight: 500 }}>
                  {v.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                    {v.name}
                    {v.verified && <span style={{ fontSize: 10, color: "var(--orange-2)" }}>✓</span>}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 2 }}>{v.category} · {v.lead}</div>
                </div>
                <StatusChip status={v.status} />
                <div style={{ textAlign: "right" }}>
                  {v.total > 0 && (
                    <>
                      <div className="mono" style={{ fontSize: 11, color: "var(--ink)" }}>₱{v.total.toLocaleString()}</div>
                      <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)" }}>{v.paid}% paid</div>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        <aside className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="label-mono">{sel.category}</div>
              <div style={{ fontFamily: "var(--display)", fontWeight: 700, textTransform: "uppercase", fontSize: 22, color: "var(--ink)", marginTop: 2 }}>
                {sel.name}
              </div>
            </div>
            <StatusChip status={sel.status} />
          </div>
          <div style={{ padding: 12, borderRadius: 10, background: "var(--paper-2)" }}>
            <div className="label-mono" style={{ fontSize: 10 }}>Next milestone</div>
            <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 4 }}>{sel.next}</div>
          </div>
          {sel.total > 0 && (
            <div>
              <div className="label-mono" style={{ fontSize: 10 }}>Payment</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <span className="mono" style={{ fontSize: 12, color: "var(--ink)" }}>
                  ₱{Math.round(sel.total * sel.paid / 100).toLocaleString()} of ₱{sel.total.toLocaleString()}
                </span>
                <span className="mono" style={{ fontSize: 11, color: "var(--orange-2)" }}>{sel.paid}% paid</span>
              </div>
              <div style={{ marginTop: 8, height: 6, background: "var(--paper-2)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: sel.paid + "%", height: "100%", background: "var(--orange)" }} />
              </div>
            </div>
          )}
          <div>
            <div className="label-mono" style={{ fontSize: 10 }}>Thread</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {sel.thread.length === 0 && (
                <div style={{ padding: 12, fontSize: 12, color: "var(--slate-3)", textAlign: "center", border: "1px dashed var(--line)", borderRadius: 8 }}>
                  No messages yet
                </div>
              )}
              {sel.thread.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.from === "you" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  background: m.from === "you" ? "var(--ink)" : "var(--paper-2)",
                  color: m.from === "you" ? "var(--paper)" : "var(--ink)",
                  padding: "10px 12px", borderRadius: 10, fontSize: 13,
                }}>
                  {m.from !== "you" && <div className="mono" style={{ fontSize: 10, color: "var(--orange-2)", marginBottom: 2 }}>{m.from}</div>}
                  <div style={{ lineHeight: 1.45 }}>{m.text}</div>
                  <div className="mono" style={{ fontSize: 9, opacity: 0.6, marginTop: 4 }}>{m.at}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <input placeholder="Reply…" style={{
                flex: 1, padding: "10px 12px", borderRadius: 8,
                border: "1px solid var(--line)", fontSize: 13, fontFamily: "var(--sans)", background: "var(--paper)",
                outline: "none",
              }} />
              <button className="btn btn-orange" style={{ padding: "8px 14px", fontSize: 12 }}>Send</button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
};

const StatusChip = ({ status }) => {
  const map = {
    Booked:   { bg: "var(--sage)",      fg: "var(--sage-deep)",   dot: "var(--sage-deep)" },
    Proposal: { bg: "var(--orange-4)",  fg: "var(--orange-2)",    dot: "var(--orange)" },
    Inquiry:  { bg: "var(--paper-2)",   fg: "var(--slate-2)",     dot: "var(--slate-3)" },
  }[status];
  return (
    <span style={{
      background: map.bg, color: map.fg,
      padding: "4px 10px", borderRadius: 999, fontSize: 11,
      display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: map.dot }} />
      {status}
    </span>
  );
};

// ─────────────────────────── Schedule tab
const ScheduleTab = ({ done, setDone }) => (
  <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
      <div>
        <div className="display" style={{ fontSize: 36 }}>SCHEDULE</div>
        <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4 }}>
          Every milestone, payment deadline, and vendor meeting in one timeline. Click an item to mark complete.
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>Subscribe .ics</button>
        <button className="btn btn-orange" style={{ padding: "8px 14px", fontSize: 13 }}>+ Add milestone</button>
      </div>
    </div>
    <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 6 }}>
      {SETNAYAN_DATA.timeline.map((t, i) => {
        const isDone = done[i] || t.done;
        return (
          <div key={i} onClick={() => setDone({ ...done, [i]: !isDone })} style={{
            display: "grid", gridTemplateColumns: "120px auto 1fr auto", gap: 18, alignItems: "center",
            padding: "14px 8px", borderTop: i === 0 ? "none" : "1px solid var(--line-soft)",
            cursor: "pointer",
            background: t.hero ? "var(--orange-4)" : "transparent",
            borderRadius: t.hero ? 10 : 0,
          }}>
            <div>
              <div className="mono" style={{ fontSize: 12, color: "var(--ink)", fontWeight: 500 }}>{t.date}</div>
              <div className="mono" style={{ fontSize: 9, color: "var(--slate-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>{t.type}</div>
            </div>
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              border: `1.5px solid ${isDone ? "var(--sage-deep)" : "var(--line)"}`,
              background: isDone ? "var(--sage-deep)" : "transparent",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
            }}>{isDone && "✓"}</div>
            <div style={{
              fontSize: 15, color: isDone ? "var(--slate-3)" : "var(--ink)",
              textDecoration: isDone ? "line-through" : "none",
              fontFamily: t.hero ? "var(--display)" : "var(--sans)",
              fontWeight: t.hero ? 700 : 400,
              fontSize: t.hero ? 18 : 15,
              textTransform: t.hero ? "uppercase" : "none",
            }}>
              {t.label}
            </div>
            {t.hero && <span style={{ fontSize: 12, color: "var(--orange-2)", fontWeight: 500 }}>Wedding day</span>}
          </div>
        );
      })}
    </div>
  </>
);

// ─────────────────────────── Invitations tab — preview & QR sheet
const InvitationsTab = () => (
  <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
      <div>
        <div className="display" style={{ fontSize: 36 }}>INVITATIONS</div>
        <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4 }}>
          Each guest gets a personal QR. Scan opens RSVP, dress code, venue map, and seat assignment.
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>Edit design</button>
        <button className="btn btn-orange" style={{ padding: "8px 14px", fontSize: 13 }}>Send all 47</button>
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 22 }}>
      {/* Invitation preview */}
      <div className="card" style={{ padding: 0, overflow: "hidden", background: "var(--ivory)" }}>
        <div style={{ padding: "48px 36px", textAlign: "center" }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", letterSpacing: "0.18em" }}>
            TOGETHER WITH THEIR FAMILIES
          </div>
          <div className="serif" style={{ fontSize: 72, marginTop: 16, lineHeight: 1, color: "var(--ink)", fontStyle: "italic" }}>
            Maria<br />&amp; Ice
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 20, letterSpacing: "0.16em" }}>
            18 · 12 · 2026 · LA CASTELLANA
          </div>
          <div style={{ marginTop: 28, display: "inline-flex", alignItems: "center", gap: 14, padding: "14px 18px", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 12 }}>
            <div style={{ width: 70, height: 70, background: `repeating-conic-gradient(var(--ink) 0% 25%, var(--paper) 0% 50%) 50% / 8px 8px`, borderRadius: 4 }} />
            <div style={{ textAlign: "left" }}>
              <div className="label-mono">Personal QR · Patricia</div>
              <div style={{ fontSize: 14, color: "var(--ink)", marginTop: 2 }}>Opens RSVP, table, map</div>
            </div>
          </div>
        </div>
      </div>
      {/* Right: sending status + QR sheet preview */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="label-mono">Sending status</div>
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--slate)" }}>
              <span>Sent · opened</span>
              <span className="mono">166 / 213</span>
            </div>
            <div style={{ marginTop: 8, height: 8, background: "var(--paper-2)", borderRadius: 999, overflow: "hidden", display: "flex" }}>
              <div style={{ width: "78%", background: "var(--orange)" }} />
              <div style={{ width: "22%", background: "var(--line)" }} />
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div className="label-mono">Bulk actions</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
            {["Resend to pending", "Print QR sheet", "Export PDF", "Copy share links"].map(a => (
              <button key={a} className="btn btn-ghost" style={{ padding: "10px 14px", fontSize: 12, justifyContent: "flex-start" }}>{a} →</button>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 18, background: "var(--ink)", color: "var(--paper)", border: "none" }}>
          <div className="label-mono" style={{ color: "var(--orange-3)" }}>Monogram pack · upsell</div>
          <div style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
            Match the invitation across livestream lower thirds, LED loops, and reel watermark.
          </div>
          <button className="btn btn-orange" style={{ padding: "8px 14px", fontSize: 12, marginTop: 12 }}>Add monogram pack</button>
        </div>
      </div>
    </div>
  </>
);

// ─────────────────────────── Payments tab
const BudgetTab = () => (
  <>
    <div>
      <div className="display" style={{ fontSize: 36 }}>BUDGET</div>
      <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4 }}>
        Track every vendor commitment + payment in one place. Setnayan doesn't process these —
        you and your vendors settle directly — but the ledger lives here for your sanity.
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
      <Stat k="Budget" v="₱2.0M" hint="locked in" />
      <Stat k="Committed" v="₱1.40M" hint="across 6 vendors" tone="orange" />
      <Stat k="Paid" v="₱624K" hint="44% of committed" tone="sage" />
      <Stat k="Due in 30d" v="₱176K" hint="2 milestones" />
    </div>
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--paper-2)" }}>
            {["Vendor", "Milestone", "Amount", "Due", "Status", "Your receipt"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "12px 14px", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--slate-2)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            ["La Castellana Estate", "Full venue payment",     "₱480,000", "Paid · Oct 14", "paid"],
            ["Studio Sereno",        "Booking retainer (30%)", "₱66,000",  "Paid · Sep 22", "paid"],
            ["Ato Catering",         "60% midpoint",           "₱228,000", "Paid · Nov 1",  "paid"],
            ["Ato Catering",         "Final 40%",              "₱152,000", "Due · Dec 7",   "due"],
            ["Bloom & Co. Florals",  "Final 50%",              "₱72,500",  "Due · Dec 9",   "due"],
            ["Ilaya Coordinators",   "Final 75%",              "₱71,250",  "Due · Dec 10",  "due"],
          ].map(([v, m, amt, due, status], i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--line-soft)" }}>
              <td style={{ padding: "12px 14px", color: "var(--ink)", fontWeight: 500 }}>{v}</td>
              <td style={{ padding: "12px 14px", color: "var(--slate)" }}>{m}</td>
              <td style={{ padding: "12px 14px", color: "var(--ink)", fontFamily: "var(--mono)" }}>{amt}</td>
              <td style={{ padding: "12px 14px", color: "var(--slate)", fontFamily: "var(--mono)", fontSize: 11 }}>{due}</td>
              <td style={{ padding: "12px 14px" }}>
                <span style={{
                  background: status === "paid" ? "var(--sage)" : "var(--orange-4)",
                  color:      status === "paid" ? "var(--sage-deep)" : "var(--orange-2)",
                  padding: "3px 9px", borderRadius: 999, fontSize: 11,
                }}>{status === "paid" ? "Paid" : "Due"}</span>
              </td>
              <td style={{ padding: "12px 14px" }}>
                {status === "paid"
                  ? <a href="#" style={{ fontSize: 12, color: "var(--orange-2)", textDecoration: "none" }} className="mono">Upload receipt ↗</a>
                  : <span className="mono" style={{ fontSize: 11, color: "var(--slate-3)" }}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="card" style={{ padding: 18, background: "var(--paper-2)", display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "center" }}>
      <div className="display" style={{ fontSize: 24, color: "var(--orange-2)" }}>0%</div>
      <div style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.55 }}>
        Setnayan never takes a cut of vendor bookings. What your vendor lists is what you pay them — the platform stays out of the transaction.
        Productions services (Panood, Papic, Pro Website, etc.) live on a separate ledger in the Productions tab.
      </div>
    </div>
  </>
);

// ─────────────────────────── Shortlist tab — saved vendors for later
const ShortlistTab = () => {
  const saved = [
    { name: "Studio Mira",        cat: "Photography",     loc: "Makati",     base: "from ₱195K", hue: 200, savedAgo: "2d", perk: "Free engagement shoot" },
    { name: "Bloom & Co.",        cat: "Florals",         loc: "Tagaytay",   base: "from ₱90K",  hue: 25,  savedAgo: "5d", perk: "Sampaguita upgrade · free" },
    { name: "Vista Drones",       cat: "Photography",     loc: "Tagaytay",   base: "from ₱85K",  hue: 200, savedAgo: "1w", perk: "20% off second-shooter" },
    { name: "Tinta Calligraphy",  cat: "Stationery",      loc: "Manila",     base: "from ₱18K",  hue: 320, savedAgo: "1w", perk: "Free monogram on envelopes" },
    { name: "Lakas Lights",       cat: "Lights & Sound",  loc: "Pampanga",   base: "from ₱120K", hue: 270, savedAgo: "2w", perk: "Free 30-min DJ overrun" },
    { name: "Indak Dance Crew",   cat: "Entertainment",   loc: "Cebu",       base: "from ₱45K",  hue: 50,  savedAgo: "2w", perk: "1 extra choreo session" },
    { name: "Hilom Make-up",      cat: "Hair & Make-up",  loc: "Davao",      base: "from ₱45K",  hue: 340, savedAgo: "3w", perk: "Free pre-nup HMUA trial" },
    { name: "Sila Events",        cat: "Coordination",    loc: "Iloilo",     base: "from ₱85K",  hue: 110, savedAgo: "3w", perk: "Free run-of-show consult" },
    { name: "Bukid Catering",     cat: "Catering",        loc: "Pampanga",   base: "₱1,400/head",hue: 80,  savedAgo: "4w", perk: "Tasting fee waived (₱3,500)" },
    { name: "La Castellana",      cat: "Venue",           loc: "Negros Occ.",base: "from ₱350K", hue: 140, savedAgo: "4w", perk: "Free venue walkthrough" },
    { name: "Manong Romy Trio",   cat: "Reception music", loc: "Iloilo",     base: "from ₱68K",  hue: 50,  savedAgo: "5w", perk: "Free 2-song custom set" },
    { name: "Photo Delivery PH",  cat: "Photo handoff",   loc: "QC",         base: "from ₱3,500",hue: 200, savedAgo: "5w", perk: "30-day storage extension" },
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="display" style={{ fontSize: 36 }}>SHORTLIST · 12 saved</div>
          <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4 }}>
            Vendors you've saved for later. One-tap message, see exclusive Setnayan perks, remove anytime.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>Sort by date saved</button>
          <button className="btn btn-orange" style={{ padding: "8px 14px", fontSize: 13 }}>Message all (12)</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {saved.map(v => (
          <div key={v.name} className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
            <button style={{
              position: "absolute", top: 10, right: 10, zIndex: 2,
              width: 28, height: 28, borderRadius: "50%",
              background: "var(--orange)", color: "#fff", border: "none",
              fontSize: 14, cursor: "pointer",
            }} aria-label="Remove from shortlist">♥</button>
            <div style={{ aspectRatio: "16/9", background: `linear-gradient(135deg, oklch(72% 0.10 ${v.hue}) 0%, oklch(86% 0.05 ${(v.hue + 40) % 360}) 100%)` }} />
            <div style={{ padding: 16 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)" }}>{v.cat} · {v.loc} · saved {v.savedAgo} ago</div>
              <div style={{ fontSize: 15, color: "var(--ink)", fontWeight: 500, marginTop: 4 }}>{v.name}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink)", marginTop: 6 }}>{v.base}</div>
              <div style={{ marginTop: 10, padding: 10, background: "var(--orange-4)", borderRadius: 8 }}>
                <div className="mono" style={{ fontSize: 9, color: "var(--orange-2)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
                  Setnayan-exclusive perk
                </div>
                <div style={{ fontSize: 12, color: "var(--ink)", marginTop: 2 }}>{v.perk}</div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                <button className="btn btn-orange" style={{ padding: "8px 12px", fontSize: 12, flex: 1, justifyContent: "center" }}>Message</button>
                <button className="btn btn-ghost" style={{ padding: "8px 12px", fontSize: 12 }}>View ↗</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 22, background: "var(--ink)", color: "var(--paper)", border: "none", display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "center" }}>
        <div>
          <div className="label-mono" style={{ color: "var(--orange-3)" }}>Why book through Setnayan</div>
          <div style={{ fontSize: 14, color: "var(--paper)", marginTop: 4, lineHeight: 1.55 }}>
            Every Setnayan-exclusive perk above only triggers when you book through us. Off-platform DMs miss the perk, miss the milestone protection, miss the BIR receipt, miss everything that comes after.
          </div>
        </div>
        <button className="btn btn-orange btn-lg">Send 12 inquiries · one tap</button>
      </div>
    </>
  );
};

Object.assign(window, { VendorsTab, ScheduleTab, InvitationsTab, BudgetTab, ShortlistTab });
