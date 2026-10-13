/**
 * Analytics calculations for the dashboard.
 *
 * Everything in this file is a pure function: it takes plain event objects and a
 * date range and returns numbers. No database or React code lives here, which
 * keeps the logic easy to read, change and unit test.
 *
 * Key definitions (change them here and the whole dashboard follows):
 *
 *  - Working time:  9:00–17:00, Monday–Friday, in the server's local time zone.
 *  - Busy time:     the part of a user's working time covered by at least one
 *                   event they own or attend. Overlapping events are merged
 *                   first, so two events at 10:00–11:00 count as 1 busy hour,
 *                   not 2. Time outside working hours is ignored.
 *  - Free time:     working time minus busy time.
 *  - "All users":   busy/free are summed per person (5 people × 40h = 200h of
 *                   capacity per week). Event-based stats (hours by category,
 *                   meeting counts) count each event once, however many people
 *                   attend it.
 *  - Event hours:   an event's duration clipped to the selected date range
 *                   (not to working hours) — a 2h meeting is 2h even at 18:00.
 *  - Meetings:      events in MEETING_CATEGORIES (Product, Sales, Internal).
 */

import { CATEGORIES, MEETING_CATEGORIES, type Category } from "./constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnalyticsEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  category: Category;
  ownerId: string;
  attendeeIds: string[];
}

/** A half-open date range: start is included, end is excluded. */
export interface DateRange {
  start: Date;
  end: Date;
}

/** A time interval in epoch milliseconds, half-open [start, end). */
export interface Interval {
  start: number;
  end: number;
}

export type RangeKey = "this-week" | "last-week" | "this-month";

export const RANGE_LABELS: Record<RangeKey, string> = {
  "this-week": "This week",
  "last-week": "Last week",
  "this-month": "This month",
};

/** Working-day definition. Days use JS numbering: 0 = Sunday … 6 = Saturday. */
export const WORKDAY = {
  startHour: 9,
  endHour: 17,
  days: [1, 2, 3, 4, 5],
};

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const HOUR_MS = 60 * 60 * 1000;
const toHours = (ms: number) => ms / HOUR_MS;

// ---------------------------------------------------------------------------
// Date ranges
// ---------------------------------------------------------------------------

/** Monday 00:00 of the week containing `date` (weeks start on Monday). */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

/** Turn a preset like "this-week" into concrete start/end dates. */
export function resolveRange(key: RangeKey, now: Date = new Date()): DateRange {
  const weekStart = startOfWeek(now);
  const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  switch (key) {
    case "this-week":
      return { start: weekStart, end: addDays(weekStart, 7) };
    case "last-week":
      return { start: addDays(weekStart, -7), end: weekStart };
    case "this-month":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      };
  }
}

// ---------------------------------------------------------------------------
// Interval helpers (the core of the busy/free calculation)
// ---------------------------------------------------------------------------

/**
 * Merge overlapping or touching intervals into a sorted, non-overlapping list.
 * Example: [9–11, 10–12, 14–15] → [9–12, 14–15]
 */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .map((i) => ({ ...i }))
    .sort((a, b) => a.start - b.start);

  const merged: Interval[] = [];
  for (const current of sorted) {
    const last = merged[merged.length - 1];
    if (last && current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }
  return merged;
}

/** Total length (ms) of the overlap between one interval and a merged list. */
export function overlapMs(window: Interval, merged: Interval[]): number {
  let total = 0;
  for (const i of merged) {
    const start = Math.max(window.start, i.start);
    const end = Math.min(window.end, i.end);
    if (end > start) total += end - start;
  }
  return total;
}

/**
 * All working-hour windows (e.g. Mon 9:00–17:00) inside a date range,
 * clipped to the range edges.
 */
export function workingWindows(range: DateRange): Interval[] {
  const windows: Interval[] = [];
  const day = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());

  while (day < range.end) {
    if (WORKDAY.days.includes(day.getDay())) {
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), WORKDAY.startHour).getTime();
      const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), WORKDAY.endHour).getTime();
      const clipped = {
        start: Math.max(start, range.start.getTime()),
        end: Math.min(end, range.end.getTime()),
      };
      if (clipped.end > clipped.start) windows.push(clipped);
    }
    day.setDate(day.getDate() + 1);
  }
  return windows;
}

// ---------------------------------------------------------------------------
// Event filtering
// ---------------------------------------------------------------------------

/** True if the user owns or attends the event. */
export function involvesUser(event: AnalyticsEvent, userId: string): boolean {
  return event.ownerId === userId || event.attendeeIds.includes(userId);
}

/** Events that overlap the range at all. */
export function eventsInRange(events: AnalyticsEvent[], range: DateRange): AnalyticsEvent[] {
  return events.filter((e) => e.end > range.start && e.start < range.end);
}

/** Event duration in hours, clipped to the range. */
export function clippedHours(event: AnalyticsEvent, range: DateRange): number {
  const start = Math.max(event.start.getTime(), range.start.getTime());
  const end = Math.min(event.end.getTime(), range.end.getTime());
  return end > start ? toHours(end - start) : 0;
}

// ---------------------------------------------------------------------------
// Busy vs free
// ---------------------------------------------------------------------------

export interface BusyFree {
  workingHours: number;
  busyHours: number;
  freeHours: number;
  /** Busy hours per weekday, indexed 0 (Sunday) … 6 (Saturday). */
  busyByWeekday: number[];
}

/**
 * Busy and free working hours for ONE person, given the events they are
 * involved in. Overlapping events are merged so time is never double counted.
 */
export function busyFreeForEvents(events: AnalyticsEvent[], range: DateRange): BusyFree {
  const merged = mergeIntervals(events.map((e) => ({ start: e.start.getTime(), end: e.end.getTime() })));
  const busyByWeekday = [0, 0, 0, 0, 0, 0, 0];
  let workingMs = 0;
  let busyMs = 0;

  for (const window of workingWindows(range)) {
    const busy = overlapMs(window, merged);
    workingMs += window.end - window.start;
    busyMs += busy;
    busyByWeekday[new Date(window.start).getDay()] += toHours(busy);
  }

  return {
    workingHours: toHours(workingMs),
    busyHours: toHours(busyMs),
    freeHours: toHours(workingMs - busyMs),
    busyByWeekday,
  };
}

/**
 * Busy/free summed over several people. Each person's time is calculated
 * separately (using only their own events) and then added together.
 */
export function busyFreeForUsers(events: AnalyticsEvent[], range: DateRange, userIds: string[]): BusyFree {
  const total: BusyFree = { workingHours: 0, busyHours: 0, freeHours: 0, busyByWeekday: [0, 0, 0, 0, 0, 0, 0] };
  for (const userId of userIds) {
    const result = busyFreeForEvents(
      events.filter((e) => involvesUser(e, userId)),
      range,
    );
    total.workingHours += result.workingHours;
    total.busyHours += result.busyHours;
    total.freeHours += result.freeHours;
    result.busyByWeekday.forEach((h, i) => (total.busyByWeekday[i] += h));
  }
  return total;
}

// ---------------------------------------------------------------------------
// Event-based stats
// ---------------------------------------------------------------------------

/** Total event hours per category (every category present, even if 0). */
export function hoursByCategory(events: AnalyticsEvent[], range: DateRange): Record<Category, number> {
  const result = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  for (const e of events) result[e.category] += clippedHours(e, range);
  return result;
}

export interface CountAndHours {
  count: number;
  hours: number;
}

/** Meeting count and hours for Product vs Sales meetings. */
export function productVsSales(
  events: AnalyticsEvent[],
  range: DateRange,
): { product: CountAndHours; sales: CountAndHours } {
  const tally = (category: Category): CountAndHours => {
    const matching = events.filter((e) => e.category === category);
    return {
      count: matching.length,
      hours: matching.reduce((sum, e) => sum + clippedHours(e, range), 0),
    };
  };
  return { product: tally("Product Meeting"), sales: tally("Sales Meeting") };
}

/** Number of meetings and their average length in minutes (0 if none). */
export function meetingStats(events: AnalyticsEvent[]): { count: number; averageMinutes: number } {
  const meetings = events.filter((e) => MEETING_CATEGORIES.includes(e.category));
  if (meetings.length === 0) return { count: 0, averageMinutes: 0 };
  const totalMinutes = meetings.reduce((sum, e) => sum + (e.end.getTime() - e.start.getTime()) / 60000, 0);
  return { count: meetings.length, averageMinutes: totalMinutes / meetings.length };
}

/** The weekday with the most busy hours, or null if there is no busy time. */
export function busiestDay(busyByWeekday: number[]): { day: string; hours: number } | null {
  let best = -1;
  busyByWeekday.forEach((hours, i) => {
    if (hours > 0 && (best === -1 || hours > busyByWeekday[best])) best = i;
  });
  return best === -1 ? null : { day: WEEKDAY_NAMES[best], hours: busyByWeekday[best] };
}

// ---------------------------------------------------------------------------
// Dashboard: everything the /analytics page needs, in one call
// ---------------------------------------------------------------------------

export interface DashboardData {
  range: DateRange;
  peopleCount: number;
  busyFree: BusyFree;
  utilization: number; // busy / working, 0–1
  hoursByCategory: Record<Category, number>;
  productVsSales: { product: CountAndHours; sales: CountAndHours };
  meetings: { count: number; averageMinutes: number };
  busiestDay: { day: string; hours: number } | null;
  /** Busy hours for Mon–Fri, for the weekday chart. */
  weekdayBusy: { day: string; hours: number }[];
}

/**
 * Build all dashboard numbers.
 *
 * @param events     all events (any range; they are filtered here)
 * @param range      the selected date range
 * @param userId     a user id, or null for "all users"
 * @param allUserIds every user id (used when userId is null)
 */
export function computeDashboard(
  events: AnalyticsEvent[],
  range: DateRange,
  userId: string | null,
  allUserIds: string[],
): DashboardData {
  const inRange = eventsInRange(events, range);
  const scoped = userId ? inRange.filter((e) => involvesUser(e, userId)) : inRange;
  const people = userId ? [userId] : allUserIds;

  const busyFree = busyFreeForUsers(scoped, range, people);

  return {
    range,
    peopleCount: people.length,
    busyFree,
    utilization: busyFree.workingHours > 0 ? busyFree.busyHours / busyFree.workingHours : 0,
    hoursByCategory: hoursByCategory(scoped, range),
    productVsSales: productVsSales(scoped, range),
    meetings: meetingStats(scoped),
    busiestDay: busiestDay(busyFree.busyByWeekday),
    weekdayBusy: WORKDAY.days.map((d) => ({ day: WEEKDAY_NAMES[d].slice(0, 3), hours: busyFree.busyByWeekday[d] })),
  };
}
