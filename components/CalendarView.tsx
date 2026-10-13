"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, isSameDay } from "date-fns";
import type { User } from "@prisma/client";
import { CATEGORIES, CATEGORY_COLORS } from "@/lib/constants";
import { startOfWeek } from "@/lib/analytics";
import type { EventDTO } from "@/lib/events";
import { EventModal, type ModalState } from "./EventModal";

// Visible hours of the day grid and the height of one hour in pixels.
const START_HOUR = 7;
const END_HOUR = 20;
const HOUR_PX = 48;

type View = "week" | "day";

interface Positioned {
  event: EventDTO;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

/**
 * Lay out one day's events: position by time, and put overlapping events
 * side by side in "lanes" so they don't cover each other.
 */
function layoutDay(events: EventDTO[], day: Date): Positioned[] {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), START_HOUR).getTime();
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), END_HOUR).getTime();

  const items = events
    .map((event) => ({
      event,
      start: Math.max(new Date(event.start).getTime(), dayStart),
      end: Math.min(new Date(event.end).getTime(), dayEnd),
    }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const result: Positioned[] = [];
  let cluster: (Positioned & { end: number })[] = [];
  let clusterEnd = 0;

  const flush = () => {
    const lanes = Math.max(...cluster.map((c) => c.lane)) + 1;
    cluster.forEach((c) => result.push({ ...c, lanes }));
    cluster = [];
  };

  for (const item of items) {
    if (cluster.length && item.start >= clusterEnd) flush();
    // First lane whose last event has finished
    let lane = 0;
    while (cluster.some((c) => c.lane === lane && c.end > item.start)) lane++;
    cluster.push({
      event: item.event,
      top: ((item.start - dayStart) / 3_600_000) * HOUR_PX,
      height: Math.max(((item.end - item.start) / 3_600_000) * HOUR_PX, 18),
      lane,
      lanes: 1,
      end: item.end,
    });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  if (cluster.length) flush();
  return result;
}

export function CalendarView({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [overlayAll, setOverlayAll] = useState(false);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const currentUser = usersById.get(currentUserId);

  const days = useMemo(() => {
    if (view === "day") return [new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())];
    const monday = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [view, anchor]);

  const rangeStart = days[0];
  const rangeEnd = addDays(days[days.length - 1], 1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ start: rangeStart.toISOString(), end: rangeEnd.toISOString() });
      const res = await fetch(`/api/events?${params}`);
      if (!res.ok) throw new Error(`Failed to load events (${res.status})`);
      setEvents(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart.getTime(), rangeEnd.getTime()]);

  useEffect(() => {
    load();
  }, [load]);

  // Selected user's events (owned or attending), or everyone's when overlaying.
  const visible = overlayAll
    ? events
    : events.filter((e) => e.ownerId === currentUserId || e.attendeeIds.includes(currentUserId));

  const step = view === "week" ? 7 : 1;
  const title =
    view === "week"
      ? `${format(days[0], "d MMM")} – ${format(days[6], "d MMM yyyy")}`
      : format(days[0], "EEEE d MMMM yyyy");

  function onSlotClick(day: Date, e: React.MouseEvent<HTMLDivElement>) {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const minutes = Math.floor((y / HOUR_PX) * 2) * 30; // snap to 30 min
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), START_HOUR, minutes);
    setModal({ mode: "create", start, end: new Date(start.getTime() + 60 * 60_000) });
  }

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const today = new Date();

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border border-slate-300 bg-white text-sm">
          <button className="px-3 py-1.5 hover:bg-slate-100" onClick={() => setAnchor(addDays(anchor, -step))}>
            ‹ Prev
          </button>
          <button className="border-x border-slate-300 px-3 py-1.5 hover:bg-slate-100" onClick={() => setAnchor(new Date())}>
            Today
          </button>
          <button className="px-3 py-1.5 hover:bg-slate-100" onClick={() => setAnchor(addDays(anchor, step))}>
            Next ›
          </button>
        </div>
        <h1 className="text-lg font-semibold">{title}</h1>
        {loading && <span className="text-sm text-slate-500">Loading…</span>}

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={overlayAll} onChange={(e) => setOverlayAll(e.target.checked)} />
            Show all users
          </label>
          <div className="flex overflow-hidden rounded-md border border-slate-300 bg-white text-sm">
            {(["week", "day"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 capitalize ${view === v ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span>
          Showing {overlayAll ? "all users" : <strong className="text-slate-900">{currentUser?.name}</strong>}
        </span>
        {CATEGORIES.map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CATEGORY_COLORS[c] }} />
            {c}
          </span>
        ))}
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <div className={view === "week" ? "min-w-[800px]" : ""}>
          {/* Day headers */}
          <div className="flex border-b border-slate-200">
            <div className="w-14 shrink-0" />
            {days.map((d) => (
              <button
                key={d.toISOString()}
                onClick={() => {
                  setAnchor(d);
                  setView("day");
                }}
                className={`flex-1 border-l border-slate-200 py-2 text-center text-sm hover:bg-slate-50 ${
                  isSameDay(d, today) ? "font-semibold text-blue-700" : "text-slate-700"
                }`}
              >
                {format(d, "EEE d")}
              </button>
            ))}
          </div>

          <div className="flex">
            {/* Hour labels */}
            <div className="w-14 shrink-0">
              {hours.map((h) => (
                <div key={h} className="relative text-right text-xs text-slate-500" style={{ height: HOUR_PX }}>
                  <span className="absolute -top-2 right-2">{h > START_HOUR ? `${String(h).padStart(2, "0")}:00` : ""}</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day) => {
              const dayEvents = visible.filter((e) => {
                const s = new Date(e.start);
                const en = new Date(e.end);
                return s < addDays(day, 1) && en > day;
              });
              return (
                <div
                  key={day.toISOString()}
                  className="relative flex-1 cursor-pointer border-l border-slate-200"
                  style={{ height: hours.length * HOUR_PX }}
                  onClick={(e) => onSlotClick(day, e)}
                >
                  {/* Hour lines, with working hours (9–17 on weekdays) shaded white */}
                  {hours.map((h) => {
                    const working = h >= 9 && h < 17 && day.getDay() >= 1 && day.getDay() <= 5;
                    return (
                      <div
                        key={h}
                        className={`border-t border-slate-100 ${working ? "" : "bg-slate-50"}`}
                        style={{ height: HOUR_PX }}
                      />
                    );
                  })}

                  {layoutDay(dayEvents, day).map(({ event, top, height, lane, lanes }) => {
                    const color = CATEGORY_COLORS[event.category];
                    const owner = usersById.get(event.ownerId);
                    return (
                      <button
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setModal({ mode: "edit", event });
                        }}
                        className="absolute overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-xs leading-tight shadow-sm ring-2 ring-white hover:z-10 hover:shadow-md"
                        style={{
                          top,
                          height,
                          left: `calc(${(lane / lanes) * 100}% + 2px)`,
                          width: `calc(${100 / lanes}% - 4px)`,
                          background: `color-mix(in srgb, ${color} 18%, white)`,
                          borderLeftColor: color,
                        }}
                        title={`${event.title}\n${format(new Date(event.start), "HH:mm")}–${format(new Date(event.end), "HH:mm")} · ${event.category}\nOwner: ${owner?.name ?? "?"}`}
                      >
                        <div className="flex items-center gap-1 font-medium text-slate-900">
                          {overlayAll && owner && (
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: owner.color }} />
                          )}
                          <span className="truncate">{event.title}</span>
                        </div>
                        {height > 30 && (
                          <div className="truncate text-slate-600">
                            {format(new Date(event.start), "HH:mm")}–{format(new Date(event.end), "HH:mm")}
                            {overlayAll && owner ? ` · ${owner.name.split(" ")[0]}` : ""}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {overlayAll && (
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          {users.map((u) => (
            <span key={u.id} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: u.color }} />
              {u.name}
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500">Click an empty slot to create an event, or click an event to edit it.</p>

      {modal && (
        <EventModal
          state={modal}
          users={users}
          currentUserId={currentUserId}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}
