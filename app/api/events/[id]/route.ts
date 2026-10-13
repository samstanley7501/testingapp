import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseEventInput, toDTO } from "@/lib/events";

type Params = { params: Promise<{ id: string }> };

// PUT /api/events/:id — replace an event's fields.
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const parsed = parseEventInput(await req.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { attendeeIds, ...data } = parsed.input;
  try {
    const event = await prisma.event.update({
      where: { id },
      data: { ...data, attendees: { set: attendeeIds.map((a) => ({ id: a })) } },
      include: { attendees: { select: { id: true } } },
    });
    return NextResponse.json(toDTO(event));
  } catch {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
}

// DELETE /api/events/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.event.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
}
