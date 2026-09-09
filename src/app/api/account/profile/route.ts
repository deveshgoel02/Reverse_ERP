import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit/log";

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = updateProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { name, email } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: "Another account already uses that email." }, { status: 409 });
  }

  const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name, email: normalizedEmail },
  });

  await writeAuditLog({
    businessId: user.businessId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    previousValue: { name: before.name, email: before.email },
    newValue: { name: updated.name, email: updated.email },
    note: "Updated own profile",
  });

  return NextResponse.json({ user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role } });
}
