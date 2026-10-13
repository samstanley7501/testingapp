import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseEventInput, toDTO } from "@/lib/events";

// GET /api/events?start=ISO&end=ISO — all events overlapping the range.
export async function GET(req: NextRequest) {
  const start = new Date(req.nextUrl.searchParams.get("start") ?? "");
  const end = new Date(req.nextUrl.searchParams.get("end") ?? "");
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: "start and end query params are required" }, { status: 400 });
  }

  const events = await prisma.event.findMany({
    where: { start: { lt: end }, end: { gt: start } },
    include: { attendees: { select: { id: true } } },
    orderBy: { start: "asc" },
  });
  return NextResponse.json(events.map(toDTO));
}

// POST /api/events — create an event.
export async function POST(req: NextRequest) {
  const parsed = parseEventInput(await req.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { attendeeIds, ...data } = parsed.input;
  const event = await prisma.event.create({
    data: { ...data, attendees: { connect: attendeeIds.map((id) => ({ id })) } },
    include: { attendees: { select: { id: true } } },
  });
  return NextResponse.json(toDTO(event), { status: 201 });
}
