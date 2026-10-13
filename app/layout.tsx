import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { getUsersAndCurrent } from "@/lib/current-user";

export const metadata: Metadata = {
  title: "Team Calendar",
  description: "Multi-user calendar with a business analytics dashboard",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { users, currentUser } = await getUsersAndCurrent();
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Header users={users} currentUserId={currentUser?.id ?? null} />
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
