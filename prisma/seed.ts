/**
 * Seed script: 5 users and ~4 weeks of events (the 3 weeks before the current
 * week, plus the current week) so the calendar and dashboard have data
 * straight away. Uses a fixed random seed so every run gives the same
 * pattern relative to "today".
 *
 * Run with: npm run db:seed   (or as part of `npx prisma migrate reset`)
 */
import { PrismaClient } from "@prisma/client";
import type { Category } from "../lib/constants";
import { startOfWeek } from "../lib/analytics";

const prisma = new PrismaClient();

// Small deterministic PRNG (mulberry32) so seed data is reproducible.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(42);
const pick = <T,>(items: T[]): T => items[Math.floor(random() * items.length)];
const chance = (p: number) => random() < p;

const USERS = [
  { name: "Alice Chen", email: "alice@example.com", team: "Product", color: "#6250d6" },
  { name: "Ben Okafor", email: "ben@example.com", team: "Product", color: "#008300" },
  { name: "Priya Patel", email: "priya@example.com", team: "Product", color: "#256abf" },
  { name: "Dan Murphy", email: "dan@example.com", team: "Sales", color: "#e34948" },
  { name: "Erin Walsh", email: "erin@example.com", team: "Sales", color: "#b36b00" },
];

interface Draft {
  title: string;
  start: Date;
  end: Date;
  category: Category;
  ownerId: string;
  attendeeIds: string[];
}

async function main() {
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  const users = [];
  for (const u of USERS) users.push(await prisma.user.create({ data: u }));
  const [alice, ben, priya, dan, erin] = users;
  const product = [alice, ben, priya];
  const sales = [dan, erin];
  const everyone = users;

  const drafts: Draft[] = [];
  // Busy intervals per user, used to avoid piling random events on top of each other.
  const busy = new Map<string, { start: number; end: number }[]>(users.map((u) => [u.id, []]));

  const at = (day: Date, hour: number, minute = 0) =>
    new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);

  const isFree = (ids: string[], start: Date, end: Date) =>
    ids.every((id) => busy.get(id)!.every((b) => end.getTime() <= b.start || start.getTime() >= b.end));

  function add(draft: Draft) {
    drafts.push(draft);
    for (const id of [draft.ownerId, ...draft.attendeeIds]) {
      busy.get(id)!.push({ start: draft.start.getTime(), end: draft.end.getTime() });
    }
  }

  /** Try to place an event at a random free slot on the given day. */
  function addRandom(
    day: Date,
    title: string,
    category: Category,
    ownerId: string,
    attendeeIds: string[],
    minutes: number,
    hours: [number, number] = [9, 17],
  ) {
    for (let attempt = 0; attempt < 15; attempt++) {
      const latestStart = hours[1] * 60 - minutes;
      const slots = Math.floor((latestStart - hours[0] * 60) / 30) + 1;
      const startMin = hours[0] * 60 + Math.floor(random() * slots) * 30;
      const start = at(day, Math.floor(startMin / 60), startMin % 60);
      const end = new Date(start.getTime() + minutes * 60000);
      if (isFree([ownerId, ...attendeeIds], start, end)) {
        add({ title, start, end, category, ownerId, attendeeIds });
        return;
      }
    }
  }

  const thisWeek = startOfWeek(new Date());
  const CUSTOMERS = ["Acme Corp", "Globex", "Initech", "Umbrella", "Stark Industries", "Wayne Enterprises", "Hooli"];

  for (let w = -3; w <= 0; w++) {
    const monday = new Date(thisWeek.getFullYear(), thisWeek.getMonth(), thisWeek.getDate() + w * 7);
    const day = (offset: number) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset);

    // --- Fixed recurring meetings ------------------------------------------
    for (let d = 0; d < 5; d++) {
      add({
        title: "Product stand-up",
        start: at(day(d), 9, 30),
        end: at(day(d), 9, 45),
        category: "Product Meeting",
        ownerId: alice.id,
        attendeeIds: [ben.id, priya.id],
      });
    }
    add({
      title: "Sales pipeline review",
      start: at(day(0), 10),
      end: at(day(0), 11),
      category: "Sales Meeting",
      ownerId: dan.id,
      attendeeIds: [erin.id],
    });
    if (w % 2 === 0) {
      add({
        title: "Sprint planning",
        start: at(day(0), 13),
        end: at(day(0), 15),
        category: "Product Meeting",
        ownerId: priya.id,
        attendeeIds: [alice.id, ben.id],
      });
    } else {
      add({
        title: "Sprint retro",
        start: at(day(4), 14),
        end: at(day(4), 15),
        category: "Product Meeting",
        ownerId: priya.id,
        attendeeIds: [alice.id, ben.id],
      });
    }
    add({
      title: "Roadmap sync (Product × Sales)",
      start: at(day(2), 11),
      end: at(day(2), 12),
      category: "Internal",
      ownerId: alice.id,
      attendeeIds: [dan.id, erin.id],
    });
    add({
      title: "All-hands",
      start: at(day(4), 16),
      end: at(day(4), 17),
      category: "Internal",
      ownerId: erin.id,
      attendeeIds: everyone.filter((u) => u.id !== erin.id).map((u) => u.id),
    });

    // --- 1:1s ----------------------------------------------------------------
    addRandom(day(1), "1:1 Alice / Ben", "Internal", alice.id, [ben.id], 30);
    addRandom(day(1), "1:1 Alice / Priya", "Internal", alice.id, [priya.id], 30);
    addRandom(day(3), "1:1 Dan / Erin", "Internal", dan.id, [erin.id], 30);

    // --- Sales: customer calls and demos -----------------------------------
    for (const rep of sales) {
      const calls = 4 + Math.floor(random() * 4);
      for (let i = 0; i < calls; i++) {
        const customer = pick(CUSTOMERS);
        if (chance(0.25)) {
          // Product demo with a product person along
          addRandom(day(Math.floor(random() * 5)), `Demo: ${customer}`, "Sales Meeting", rep.id, [pick(product).id], 60);
        } else {
          addRandom(
            day(Math.floor(random() * 5)),
            `${pick(["Discovery call", "Follow-up", "Negotiation", "Check-in"])}: ${customer}`,
            "Sales Meeting",
            rep.id,
            [],
            pick([30, 30, 45, 60]),
          );
        }
      }
      addRandom(day(Math.floor(random() * 5)), "Proposal writing", "Focus Time", rep.id, [], 90);
    }

    // --- Product: design reviews, user interviews and focus time -----------
    for (const pm of product) {
      if (chance(0.7)) {
        addRandom(day(Math.floor(random() * 5)), "Design review", "Product Meeting", pm.id,
          product.filter((p) => p.id !== pm.id && chance(0.6)).map((p) => p.id), 60);
      }
      if (chance(0.5)) {
        addRandom(day(Math.floor(random() * 5)), "User interview", "Product Meeting", pm.id, [], 45);
      }
      const focusBlocks = 2 + Math.floor(random() * 3);
      for (let i = 0; i < focusBlocks; i++) {
        addRandom(day(Math.floor(random() * 5)), "Focus: deep work", "Focus Time", pm.id, [], pick([90, 120, 120]));
      }
    }

    // --- Miscellaneous -------------------------------------------------------
    for (const u of everyone) {
      if (chance(0.4)) {
        addRandom(day(Math.floor(random() * 5)), pick(["Dentist", "Lunch & learn", "Team lunch", "Training"]),
          "Other", u.id, [], 60, [11, 15]);
      }
    }

    // A few deliberate double-bookings, so overlap handling shows up.
    if (chance(0.7)) {
      add({
        title: "Urgent: escalation call",
        start: at(day(1), 10, 30),
        end: at(day(1), 11, 30),
        category: "Sales Meeting",
        ownerId: dan.id,
        attendeeIds: [ben.id],
      });
    }
  }

  for (const d of drafts) {
    await prisma.event.create({
      data: {
        title: d.title,
        start: d.start,
        end: d.end,
        category: d.category,
        ownerId: d.ownerId,
        attendees: { connect: d.attendeeIds.map((id) => ({ id })) },
      },
    });
  }

  console.log(`Seeded ${users.length} users and ${drafts.length} events.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
