import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardShell, { type NavUser } from "@/components/nav/DashboardShell";
import { verifySessionToken, SESSION_COOKIE } from "@/infrastructure/security/session";
import { prisma } from "@/infrastructure/db/prisma";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  let user: NavUser | null = null;

  if (session) {
    // Revalidación en servidor: cuenta activa y versión de sesión vigente.
    const dbUser = await prisma.user.findUnique({
      where: { id: session.uid },
      select: { username: true, role: true, isActive: true, sessionVersion: true },
    });

    if (!dbUser || !dbUser.isActive || dbUser.sessionVersion !== session.sv) {
      redirect("/login");
    }

    user = { username: dbUser.username, role: dbUser.role };
  }

  return (
    <DashboardShell user={user}>{children}</DashboardShell>
  );
}
