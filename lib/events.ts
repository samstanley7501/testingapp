// Helpers shared by the event API routes.
import type { Event, User } from "@prisma/client";
import { isCategory, type Category } from "./constants";

/** Shape of an event sent to the browser (dates as ISO strings). */
export interface EventDTO {
  id: string;
  title: string;
  start: string;
  end: string;
  category: Category;
  ownerId: string;
  attendeeIds: string[];
}

export function toDTO(event: Event & { attendees: Pick<User, "id">[] }): EventDTO {
  return {
    id: event.id,
    title: event.title,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    category: event.category as Category,
    ownerId: event.ownerId,
    attendeeIds: event.attendees.map((a) => a.id),
  };
}

export interface EventInput {
  title: string;
  start: Date;
  end: Date;
  category: Category;
  ownerId: string;
  attendeeIds: string[];
}

/** Validate a create/update request body. Returns an error message or the parsed input. */
export function parseEventInput(body: unknown): { error: string } | { input: EventInput } {
  if (!body || typeof body !== "object") return { error: "Invalid JSON body" };
  const b = body as Record<string, unknown>;

  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return { error: "Title is required" };

  const start = new Date(String(b.start));
  const end = new Date(String(b.end));
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { error: "Start and end must be valid dates" };
  if (end <= start) return { error: "End must be after start" };

  if (!isCategory(b.category)) return { error: "Unknown category" };
  if (typeof b.ownerId !== "string" || !b.ownerId) return { error: "Owner is required" };

  const attendeeIds = Array.isArray(b.attendeeIds)
    ? [...new Set(b.attendeeIds.filter((id): id is string => typeof id === "string" && id !== b.ownerId))]
    : [];

  return { input: { title, start, end, category: b.category, ownerId: b.ownerId, attendeeIds } };
}
