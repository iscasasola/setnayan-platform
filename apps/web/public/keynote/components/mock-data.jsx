// Shared mock data for couple ↔ vendor dashboards.
// One wedding: Claire & Ice, 18 Dec 2026, La Castellana.
// Same booking, two perspectives. All booleans toggle live in the prototype.

const SETNAYAN_DATA = {
  event: {
    couple: "Claire & Ice",
    date: "18 · 12 · 2026",
    dateShort: "Dec 18, 2026",
    daysOut: 213,
    venue: "La Castellana, Negros Occidental",
    headcount: 213,
    confirmed: 166,
    pending: 47,
    budget: 2_000_000,
    spent: 1_240_000,
    phase: "Inviting",
  },

  guests: [
    { id: "g1", name: "Tita Cora Magsaysay",  group: "Bride's family",  rsvp: "yes",     table: 2,  plusOne: true,  diet: "—",       qr: "ci-001" },
    { id: "g2", name: "Lolo Eduardo",          group: "Bride's family",  rsvp: "yes",     table: 1,  plusOne: false, diet: "Soft food", qr: "ci-002" },
    { id: "g3", name: "Patricia & Mark Cruz",  group: "Bride's friends", rsvp: "yes",     table: 6,  plusOne: false, diet: "—",       qr: "ci-014" },
    { id: "g4", name: "Kuya JM",               group: "Groom's family",  rsvp: "pending", table: 3,  plusOne: true,  diet: "—",       qr: "ci-023" },
    { id: "g5", name: "Ate Ria + Sam",         group: "Groom's friends", rsvp: "pending", table: 7,  plusOne: false, diet: "Vegetarian", qr: "ci-031" },
    { id: "g6", name: "Pastor Reyes",          group: "Officiant",       rsvp: "yes",     table: 1,  plusOne: false, diet: "—",       qr: "ci-002" },
    { id: "g7", name: "Tito Boy",              group: "Bride's family",  rsvp: "no",      table: "—",plusOne: false, diet: "—",       qr: "ci-008" },
    { id: "g8", name: "The Lim Family (4)",    group: "Family friends",  rsvp: "pending", table: 9,  plusOne: false, diet: "1 pescatarian", qr: "ci-040" },
    { id: "g9", name: "Andrea & Marco",        group: "Sponsors",        rsvp: "yes",     table: 4,  plusOne: false, diet: "—",       qr: "ci-011" },
    { id: "g10",name: "Cousin Bea + Joaquin",  group: "Bride's family",  rsvp: "yes",     table: 5,  plusOne: false, diet: "Halal",    qr: "ci-018" },
  ],

  vendors: [
    {
      id: "v1", name: "Ato Catering",         category: "Catering",        status: "Booked",
      paid: 60, total: 380_000, next: "Final headcount lock · Dec 5",
      lead: "Joey Castro", verified: true,
      thread: [
        { from: "Ato Catering", at: "Yesterday 6:42pm", text: "Headcount locked at 213. Crew meals: 28." },
        { from: "you", at: "Yesterday 7:10pm", text: "Got it — added crew meal note to schedule." },
      ],
    },
    {
      id: "v2", name: "Bloom & Co. Florals",   category: "Florals",         status: "Booked",
      paid: 50, total: 145_000, next: "Sample swatch review · this week",
      lead: "Mika Reyes", verified: true,
      thread: [
        { from: "Bloom & Co.", at: "Today 10:18am", text: "Sample swatches dropped to your dashboard 🌸" },
      ],
    },
    {
      id: "v3", name: "Studio Sereno",         category: "Photography",     status: "Booked",
      paid: 30, total: 220_000, next: "Pre-nup shoot · Nov 14",
      lead: "Rafael Lim", verified: true,
      thread: [],
    },
    {
      id: "v4", name: "Manong Romy Trio",      category: "Reception music", status: "Proposal",
      paid: 0, total: 78_000, next: "Awaiting your sign-off",
      lead: "Romy Aguilar", verified: true,
      thread: [
        { from: "Manong Romy Trio", at: "2 days ago", text: "Updated set list per your notes — please review proposal." },
      ],
    },
    {
      id: "v5", name: "La Castellana Estate",  category: "Venue",           status: "Booked",
      paid: 100, total: 480_000, next: "Walkthrough · Nov 28",
      lead: "Vince Yulo",   verified: true,
      thread: [],
    },
    {
      id: "v6", name: "Ilaya Coordinators",    category: "Coordination",    status: "Booked",
      paid: 25, total: 95_000, next: "Run-of-show draft · Dec 1",
      lead: "Camille Lao",  verified: true,
      thread: [],
    },
    {
      id: "v7", name: "Hilom Make-up",         category: "Hair & Make-up",  status: "Inquiry",
      paid: 0, total: 0,         next: "Trial booking",
      lead: "Andrea Sy",    verified: false,
      thread: [],
    },
  ],

  timeline: [
    { date: "Nov 14",  label: "Pre-nup shoot — Studio Sereno",        type: "vendor",  done: true },
    { date: "Nov 28",  label: "Venue walkthrough — La Castellana",    type: "vendor",  done: false },
    { date: "Dec 1",   label: "Run-of-show draft from Ilaya",         type: "vendor",  done: false },
    { date: "Dec 5",   label: "Final headcount lock for caterer",     type: "deadline",done: false },
    { date: "Dec 8",   label: "Print individual QR sheets",           type: "task",    done: false },
    { date: "Dec 11",  label: "Crew arrival · La Castellana",         type: "day",     done: false },
    { date: "Dec 12",  label: "Ceremony · 4:00pm",                    type: "day",     done: false, hero: true },
    { date: "Dec 12",  label: "Reception · 6:30pm",                   type: "day",     done: false, hero: true },
  ],
};

window.SETNAYAN_DATA = SETNAYAN_DATA;
