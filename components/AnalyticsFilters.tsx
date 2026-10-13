"use client";

import { useRouter } from "next/navigation";
import type { User } from "@prisma/client";
import { RANGE_LABELS, type RangeKey } from "@/lib/analytics";

/** User + date range filters. They live in the URL so views can be bookmarked. */
export function AnalyticsFilters({ users, userId, range }: { users: User[]; userId: string; range: RangeKey }) {
  const router = useRouter();

  function update(next: { user?: string; range?: string }) {
    const params = new URLSearchParams({ user: userId, range, ...next });
    router.push(`/analytics?${params}`);
  }

  const select = "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm";

  return (
    <div className="ml-auto flex flex-wrap gap-2">
      <select className={select} value={userId} onChange={(e) => update({ user: e.target.value })} aria-label="User">
        <option value="all">All users</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} ({u.team})
          </option>
        ))}
      </select>
      <div className="flex overflow-hidden rounded-md border border-slate-300 bg-white text-sm">
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
          <button
            key={key}
            onClick={() => update({ range: key })}
            className={`px-3 py-1.5 ${range === key ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
          >
            {RANGE_LABELS[key]}
          </button>
        ))}
      </div>
    </div>
  );
}
