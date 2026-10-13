import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { computeDashboard, RANGE_LABELS, resolveRange, type AnalyticsEvent, type RangeKey } from "@/lib/analytics";
import { CATEGORY_COLORS, isCategory } from "@/lib/constants";
import { AnalyticsFilters } from "@/components/AnalyticsFilters";
import { CategoryChart, MeetingComparisonCharts, WeekdayChart } from "@/components/AnalyticsCharts";

type SearchParams = Promise<{ user?: string; range?: string }>;

const fmtHours = (h: number) => `${h.toFixed(1)}h`;

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rangeKey: RangeKey = params.range && params.range in RANGE_LABELS ? (params.range as RangeKey) : "this-week";
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  const selectedUser = users.find((u) => u.id === params.user) ?? null;
  const range = resolveRange(rangeKey);

  // Load events overlapping the range and convert them to the analytics shape.
  const rows = await prisma.event.findMany({
    where: { start: { lt: range.end }, end: { gt: range.start } },
    include: { attendees: { select: { id: true } } },
  });
  const events: AnalyticsEvent[] = rows
    .filter((r) => isCategory(r.category))
    .map((r) => ({
      id: r.id,
      title: r.title,
      start: r.start,
      end: r.end,
      category: r.category as AnalyticsEvent["category"],
      ownerId: r.ownerId,
      attendeeIds: r.attendees.map((a) => a.id),
    }));

  const data = computeDashboard(events, range, selectedUser?.id ?? null, users.map((u) => u.id));
  const { busyFree } = data;

  const cards = [
    { label: "Busy hours", value: fmtHours(busyFree.busyHours), sub: `of ${fmtHours(busyFree.workingHours)} working time` },
    { label: "Free hours", value: fmtHours(busyFree.freeHours), sub: "within 9am–5pm, Mon–Fri" },
    { label: "Utilisation", value: `${Math.round(data.utilization * 100)}%`, sub: "busy ÷ working hours" },
    { label: "Meetings", value: String(data.meetings.count), sub: "product, sales & internal" },
    { label: "Avg meeting length", value: `${Math.round(data.meetings.averageMinutes)} min`, sub: "across all meetings" },
    {
      label: "Busiest day",
      value: data.busiestDay?.day ?? "—",
      sub: data.busiestDay ? `${fmtHours(data.busiestDay.hours)} busy` : "no busy time",
    },
  ];

  const busyPct = busyFree.workingHours ? (busyFree.busyHours / busyFree.workingHours) * 100 : 0;
  const lastDay = new Date(range.end.getTime() - 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold">Analytics</h1>
          <p className="text-sm text-slate-600">
            {selectedUser ? selectedUser.name : `All users (${users.length} people)`} ·{" "}
            {format(range.start, "d MMM")} – {format(lastDay, "d MMM yyyy")}
          </p>
        </div>
        <AnalyticsFilters users={users} userId={selectedUser?.id ?? "all"} range={rangeKey} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold">{c.value}</div>
            <div className="mt-1 text-xs text-slate-500">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Busy vs free meter */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium">Busy vs free working hours</h2>
        <p className="mb-3 text-xs text-slate-500">
          Overlapping events are merged, so double-booked time is only counted once.
          {!selectedUser && " Summed across all users."}
        </p>
        <div className="flex h-6 gap-0.5 overflow-hidden rounded">
          <div className="rounded-l bg-[#2a78d6]" style={{ width: `${busyPct}%` }} />
          <div className="flex-1 rounded-r bg-[#cde2fb]" />
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#2a78d6]" /> Busy {fmtHours(busyFree.busyHours)} (
            {Math.round(busyPct)}%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#cde2fb]" /> Free {fmtHours(busyFree.freeHours)} (
            {Math.round(100 - busyPct)}%)
          </span>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium">Hours by category</h2>
          <p className="mb-2 text-xs text-slate-500">Total event hours{selectedUser ? "" : " (each event counted once)"}</p>
          <CategoryChart
            data={Object.entries(data.hoursByCategory).map(([category, hours]) => ({
              category,
              hours: Math.round(hours * 10) / 10,
              color: CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS],
            }))}
          />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium">Busy hours by weekday</h2>
          <p className="mb-2 text-xs text-slate-500">Busy working hours per day of the week</p>
          <WeekdayChart
            data={data.weekdayBusy.map((d) => ({ ...d, hours: Math.round(d.hours * 10) / 10 }))}
            busiest={data.busiestDay?.day.slice(0, 3) ?? null}
          />
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium">Product vs sales meetings</h2>
        <p className="mb-2 text-xs text-slate-500">
          Product: {data.productVsSales.product.count} meetings, {fmtHours(data.productVsSales.product.hours)} · Sales:{" "}
          {data.productVsSales.sales.count} meetings, {fmtHours(data.productVsSales.sales.hours)}
        </p>
        <MeetingComparisonCharts
          product={data.productVsSales.product}
          sales={data.productVsSales.sales}
          colors={{ product: CATEGORY_COLORS["Product Meeting"], sales: CATEGORY_COLORS["Sales Meeting"] }}
        />
      </section>
    </div>
  );
}
