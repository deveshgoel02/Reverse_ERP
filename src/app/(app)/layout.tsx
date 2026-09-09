import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

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
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar businessName={business.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userName={user.name} role={user.role} />
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
