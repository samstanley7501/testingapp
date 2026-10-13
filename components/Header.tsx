"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@prisma/client";

export function Header({ users, currentUserId }: { users: User[]; currentUserId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();

  function switchUser(id: string) {
    document.cookie = `currentUserId=${id}; path=/; max-age=31536000; samesite=lax`;
    router.refresh(); // re-render server components with the new user
  }

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        pathname === href ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <span className="mr-2 font-semibold">📅 Team Calendar</span>
        <nav className="flex gap-1">
          {navLink("/", "Calendar")}
          {navLink("/analytics", "Analytics")}
        </nav>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          Signed in as
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-900"
            value={currentUserId ?? ""}
            onChange={(e) => switchUser(e.target.value)}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.team})
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
