"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { User } from "@prisma/client";
import { CATEGORIES, type Category } from "@/lib/constants";
import type { EventDTO } from "@/lib/events";

export type ModalState = { mode: "create"; start: Date; end: Date } | { mode: "edit"; event: EventDTO };

interface Props {
  state: ModalState;
  users: User[];
  currentUserId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EventModal({ state, users, currentUserId, onClose, onSaved }: Props) {
  const existing = state.mode === "edit" ? state.event : null;
  const initialStart = existing ? new Date(existing.start) : (state as { start: Date }).start;
  const initialEnd = existing ? new Date(existing.end) : (state as { end: Date }).end;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [date, setDate] = useState(format(initialStart, "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState(format(initialStart, "HH:mm"));
  const [endTime, setEndTime] = useState(format(initialEnd, "HH:mm"));
  const [category, setCategory] = useState<Category>(existing?.category ?? "Internal");
  const [ownerId, setOwnerId] = useState(existing?.ownerId ?? currentUserId);
  const [attendeeIds, setAttendeeIds] = useState<string[]>(existing?.attendeeIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleAttendee(id: string) {
    setAttendeeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    if (end <= start) return setError("End time must be after start time");

    setBusy(true);
    setError(null);
    const res = await fetch(existing ? `/api/events/${existing.id}` : "/api/events", {
      method: existing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        start: start.toISOString(),
        end: end.toISOString(),
        category,
        ownerId,
        attendeeIds: attendeeIds.filter((id) => id !== ownerId),
      }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Save failed");
    onSaved();
  }

  async function remove() {
    if (!existing || !confirm(`Delete "${existing.title}"?`)) return;
    setBusy(true);
    const res = await fetch(`/api/events/${existing.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setError("Delete failed");
    onSaved();
  }

  const input = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-lg bg-white p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold">{existing ? "Edit event" : "New event"}</h2>

        <label className="block text-sm">
          Title
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </label>

        <div className="grid grid-cols-3 gap-2">
          <label className="block text-sm">
            Date
            <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="block text-sm">
            Start
            <input type="time" className={input} value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </label>
          <label className="block text-sm">
            End
            <input type="time" className={input} value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm">
            Category
            <select className={input} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Owner
            <select className={input} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="text-sm">
          <legend>Attendees</legend>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {users
              .filter((u) => u.id !== ownerId)
              .map((u) => (
                <label key={u.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={attendeeIds.includes(u.id)} onChange={() => toggleAttendee(u.id)} />
                  {u.name}
                </label>
              ))}
          </div>
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-2 pt-2">
          {existing && (
            <button type="button" onClick={remove} disabled={busy} className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
              Delete
            </button>
          )}
          <button type="button" onClick={onClose} className="ml-auto rounded-md px-3 py-1.5 text-sm hover:bg-slate-100">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
