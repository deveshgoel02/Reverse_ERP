import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Belt-and-braces: middleware already redirects unauthenticated requests,
  // but a server component should never assume a cookie parsed upstream is
  // still valid (e.g. race with logout).
  if (!user) redirect("/login");

  // Every tenant sees their own business name here, not a hard-coded brand —
  // this is a multi-tenant platform (Module 33); Shoe Xpress is the first
  // business, not the only one (see /signup).
  const business = await prisma.business.findUniqueOrThrow({ where: { id: user.businessId }, select: { name: true } });

  return (
    <AppShell businessName={business.name} userName={user.name} role={user.role}>
      {children}
    </AppShell>
  );
}
