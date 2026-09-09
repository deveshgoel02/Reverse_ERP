import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";

const signupSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

/**
 * Creates a brand-new tenant — Module 33 "scalability": Shoe Xpress is the
 * first business, but every table is already scoped by businessId, so
 * onboarding another business needs nothing beyond this route. The new
 * business starts completely empty (no demo data) — the intended path in
 * is the Import wizard, matching the reverse-ERP philosophy.
 */
export async function POST(request: Request) {
  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid signup details." }, { status: 400 });
  }
  const { businessName, ownerName, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const business = await prisma.business.create({ data: { name: businessName } });
  const user = await prisma.user.create({
    data: {
      businessId: business.id,
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      name: ownerName,
      role: "OWNER",
    },
  });

  await writeAuditLog({
    businessId: business.id,
    actorId: user.id,
    action: "CREATE",
    entityType: "Business",
    entityId: business.id,
    newValue: { name: business.name },
    note: "New tenant signup",
  });

  const token = await createSessionToken({ userId: user.id, businessId: user.businessId, role: user.role });
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: "/",
  });

  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
