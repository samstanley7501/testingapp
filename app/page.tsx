import { CalendarView } from "@/components/CalendarView";
import { getUsersAndCurrent } from "@/lib/current-user";

export default async function CalendarPage() {
  const { users, currentUser } = await getUsersAndCurrent();
  if (!currentUser) {
    return <p className="text-slate-600">No users found. Run <code>npm run db:seed</code> to add sample data.</p>;
  }
  return <CalendarView users={users} currentUserId={currentUser.id} />;
}
