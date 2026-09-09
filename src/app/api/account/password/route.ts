import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { writeAuditLog } from "@/lib/audit/log";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = changePasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { currentPassword, newPassword } = parsed.data;

  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const ok = await verifyPassword(currentPassword, dbUser.passwordHash);
  if (!ok) return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  // Never write the password itself to the audit trail, only that it changed.
  await writeAuditLog({
    businessId: user.businessId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    note: "Changed own password",
  });

  return NextResponse.json({ ok: true });
}
