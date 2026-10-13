// "Authentication" for this prototype: the current user is just a cookie set
// by the dropdown in the header. Falls back to the first user.
import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { prisma } from "./prisma";

export const CURRENT_USER_COOKIE = "currentUserId";

export async function getUsersAndCurrent(): Promise<{ users: User[]; currentUser: User | null }> {
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  const id = (await cookies()).get(CURRENT_USER_COOKIE)?.value;
  return { users, currentUser: users.find((u) => u.id === id) ?? users[0] ?? null };
}
