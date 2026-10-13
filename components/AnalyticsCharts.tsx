"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Shared chart chrome: recessive grid and axes, muted labels.
const GRID = "#e1e0d9";
const AXIS_TICK = { fill: "#52514e", fontSize: 12 };
const tooltipStyle = { fontSize: 12, borderRadius: 6, border: "1px solid #e1e0d9" };
const cursor = { fill: "rgba(11,11,11,0.05)" };

export function CategoryChart({ data }: { data: { category: string; hours: number; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 40 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} unit="h" />
        <YAxis type="category" dataKey="category" tick={AXIS_TICK} width={110} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
        <Tooltip cursor={cursor} contentStyle={tooltipStyle} formatter={(v) => [`${v}h`, "Hours"]} />
        <Bar isAnimationActive={false} dataKey="hours" radius={[0, 4, 4, 0]} maxBarSize={28}>
          {data.map((d) => (
            <Cell key={d.category} fill={d.color} />
          ))}
          <LabelList dataKey="hours" position="right" formatter={(v) => `${v}h`} style={{ fill: "#52514e", fontSize: 12 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WeekdayChart({ data, busiest }: { data: { day: string; hours: number }[]; busiest: string | null }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 20 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="day" tick={AXIS_TICK} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} unit="h" width={40} />
        <Tooltip cursor={cursor} contentStyle={tooltipStyle} formatter={(v) => [`${v}h`, "Busy"]} />
        <Bar isAnimationActive={false} dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((d) => (
            <Cell key={d.day} fill={d.day === busiest ? "#1c5cab" : "#86b6ef"} />
          ))}
          <LabelList
            dataKey="hours"
            position="top"
            formatter={(v) => `${v}h`}
            style={{ fill: "#52514e", fontSize: 12 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface CountAndHours {
  count: number;
  hours: number;
}

/** Two small charts (count, hours) rather than one dual-axis chart. */
export function MeetingComparisonCharts({
  product,
  sales,
  colors,
}: {
  product: CountAndHours;
  sales: CountAndHours;
  colors: { product: string; sales: string };
}) {
  const panels = [
    { title: "Meeting count", key: "count" as const, unit: "" },
    { title: "Meeting hours", key: "hours" as const, unit: "h" },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {panels.map((p) => {
        const data = [
          { team: "Product", value: Math.round(product[p.key] * 10) / 10, color: colors.product },
          { team: "Sales", value: Math.round(sales[p.key] * 10) / 10, color: colors.sales },
        ];
        return (
          <div key={p.key}>
            <h3 className="text-sm text-slate-600">{p.title}</h3>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={data} layout="vertical" margin={{ left: 10, right: 40 }} barCategoryGap={8}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="team" tick={AXIS_TICK} width={60} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
                <Tooltip cursor={cursor} contentStyle={tooltipStyle} formatter={(v) => [`${v}${p.unit}`, p.title]} />
                <Bar isAnimationActive={false} dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {data.map((d) => (
                    <Cell key={d.team} fill={d.color} />
                  ))}
                  <LabelList dataKey="value" position="right" formatter={(v) => `${v}${p.unit}`} style={{ fill: "#52514e", fontSize: 12 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}
