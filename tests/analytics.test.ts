import { describe, expect, it } from "vitest";
import {
  busiestDay,
  busyFreeForEvents,
  busyFreeForUsers,
  computeDashboard,
  mergeIntervals,
  resolveRange,
  type AnalyticsEvent,
  type DateRange,
} from "@/lib/analytics";
import type { Category } from "@/lib/constants";

// Dates are built with the local-time constructor so tests pass in any time zone.
// Monday 12 October 2026 is the reference week.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);

let nextId = 1;
function event(
  start: Date,
  end: Date,
  opts: { ownerId?: string; attendeeIds?: string[]; category?: Category } = {},
): AnalyticsEvent {
  return {
    id: String(nextId++),
    title: "Test",
    start,
    end,
    category: opts.category ?? "Internal",
    ownerId: opts.ownerId ?? "u1",
    attendeeIds: opts.attendeeIds ?? [],
  };
}

const MONDAY: DateRange = { start: at(12, 0), end: at(13, 0) };
const WEEK: DateRange = { start: at(12, 0), end: at(19, 0) };

describe("mergeIntervals", () => {
  it("merges overlapping and touching intervals, keeps gaps", () => {
    const merged = mergeIntervals([
      { start: 10, end: 12 },
      { start: 1, end: 3 },
      { start: 2, end: 5 },
      { start: 5, end: 6 }, // touches previous
    ]);
    expect(merged).toEqual([
      { start: 1, end: 6 },
      { start: 10, end: 12 },
    ]);
  });

  it("ignores zero-length or inverted intervals", () => {
    expect(mergeIntervals([{ start: 5, end: 5 }, { start: 8, end: 4 }])).toEqual([]);
  });
});

describe("busyFreeForEvents", () => {
  it("is entirely free with no events", () => {
    const r = busyFreeForEvents([], MONDAY);
    expect(r.workingHours).toBe(8);
    expect(r.busyHours).toBe(0);
    expect(r.freeHours).toBe(8);
  });

  it("counts a single event inside working hours", () => {
    const r = busyFreeForEvents([event(at(12, 10), at(12, 11, 30))], MONDAY);
    expect(r.busyHours).toBe(1.5);
    expect(r.freeHours).toBe(6.5);
  });

  it("does not double count overlapping events", () => {
    // 9–11 and 10–12 overlap → 9–12 = 3 busy hours (not 4)
    const r = busyFreeForEvents([event(at(12, 9), at(12, 11)), event(at(12, 10), at(12, 12))], MONDAY);
    expect(r.busyHours).toBe(3);
    expect(r.freeHours).toBe(5);
  });

  it("does not double count an event nested inside another", () => {
    const r = busyFreeForEvents([event(at(12, 9), at(12, 13)), event(at(12, 10), at(12, 11))], MONDAY);
    expect(r.busyHours).toBe(4);
  });

  it("handles identical duplicate events", () => {
    const r = busyFreeForEvents([event(at(12, 14), at(12, 15)), event(at(12, 14), at(12, 15))], MONDAY);
    expect(r.busyHours).toBe(1);
  });

  it("clips events to 9am–5pm", () => {
    // 8:00–10:00 → only 9–10 counts; 16:30–18:00 → only 16:30–17:00 counts
    const r = busyFreeForEvents([event(at(12, 8), at(12, 10)), event(at(12, 16, 30), at(12, 18))], MONDAY);
    expect(r.busyHours).toBe(1.5);
  });

  it("ignores weekend events and evenings", () => {
    const r = busyFreeForEvents(
      [event(at(17, 10), at(17, 12)), event(at(14, 19), at(14, 21))], // Saturday, Wed evening
      WEEK,
    );
    expect(r.workingHours).toBe(40);
    expect(r.busyHours).toBe(0);
  });

  it("splits a multi-day event across working days", () => {
    // Monday 15:00 → Tuesday 11:00 = 2h Monday + 2h Tuesday
    const r = busyFreeForEvents([event(at(12, 15), at(13, 11))], WEEK);
    expect(r.busyHours).toBe(4);
    expect(r.busyByWeekday[1]).toBe(2); // Monday
    expect(r.busyByWeekday[2]).toBe(2); // Tuesday
  });

  it("clips working time to the edges of the range", () => {
    // Range starts Monday at noon → 5 working hours that day
    const r = busyFreeForEvents([event(at(12, 9), at(12, 14))], { start: at(12, 12), end: at(13, 0) });
    expect(r.workingHours).toBe(5);
    expect(r.busyHours).toBe(2);
  });
});

describe("busyFreeForUsers", () => {
  it("sums each person separately, using only their own events", () => {
    const events = [
      event(at(12, 9), at(12, 10), { ownerId: "u1", attendeeIds: ["u2"] }), // both busy 1h
      event(at(12, 9, 30), at(12, 11), { ownerId: "u2" }), // u2 overlaps → u2 busy 9–11
    ];
    const r = busyFreeForUsers(events, MONDAY, ["u1", "u2"]);
    expect(r.workingHours).toBe(16);
    expect(r.busyHours).toBe(1 + 2);
    expect(r.freeHours).toBe(13);
  });
});

describe("computeDashboard", () => {
  const events = [
    event(at(12, 9), at(12, 10), { category: "Product Meeting", ownerId: "u1", attendeeIds: ["u2"] }),
    event(at(13, 13), at(13, 13, 30), { category: "Sales Meeting", ownerId: "u2" }),
    event(at(14, 10), at(14, 12), { category: "Focus Time", ownerId: "u1" }),
    event(at(5, 10), at(5, 11), { category: "Internal", ownerId: "u1" }), // previous week
  ];

  it("filters to one user's events", () => {
    const d = computeDashboard(events, WEEK, "u1", ["u1", "u2"]);
    expect(d.hoursByCategory["Product Meeting"]).toBe(1);
    expect(d.hoursByCategory["Sales Meeting"]).toBe(0);
    expect(d.hoursByCategory["Focus Time"]).toBe(2);
    expect(d.hoursByCategory.Internal).toBe(0); // outside range
    expect(d.busyFree.busyHours).toBe(3);
    expect(d.busiestDay).toEqual({ day: "Wednesday", hours: 2 });
  });

  it("counts each event once for all users", () => {
    const d = computeDashboard(events, WEEK, null, ["u1", "u2"]);
    expect(d.productVsSales.product).toEqual({ count: 1, hours: 1 });
    expect(d.productVsSales.sales).toEqual({ count: 1, hours: 0.5 });
    expect(d.meetings).toEqual({ count: 2, averageMinutes: 45 });
    expect(d.busyFree.workingHours).toBe(80);
  });
});

describe("helpers", () => {
  it("busiestDay returns null when nobody is busy", () => {
    expect(busiestDay([0, 0, 0, 0, 0, 0, 0])).toBeNull();
  });

  it("resolveRange uses Monday-start weeks and calendar months", () => {
    const now = at(14, 15); // Wednesday
    expect(resolveRange("this-week", now)).toEqual({ start: at(12, 0), end: at(19, 0) });
    expect(resolveRange("last-week", now)).toEqual({ start: at(5, 0), end: at(12, 0) });
    expect(resolveRange("this-month", now)).toEqual({ start: new Date(2026, 9, 1), end: new Date(2026, 10, 1) });
  });
});
