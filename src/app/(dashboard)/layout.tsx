import { cookies } from "next/headers";
import TopNav, { type NavUser } from "@/components/nav/TopNav";
import { verifySessionToken, SESSION_COOKIE } from "@/infrastructure/security/session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  const user: NavUser | null = session
    ? { username: session.username, role: session.role }
    : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav user={user} />
      <main>{children}</main>
    </div>
  );
}
