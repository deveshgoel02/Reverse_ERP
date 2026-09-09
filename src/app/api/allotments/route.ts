import { NextResponse } from "next/server";
import { requireUser, requireRole, AuthError } from "@/lib/auth/current-user";
import { createAllotmentSchema, createAllotment } from "@/lib/allotments/create";

// Deliberately does NOT run generateAlertsForBusiness() here — that full
// business-wide scan is expensive (mirrors how creating a StockDeadline
// doesn't trigger it either, see src/app/(app)/deadlines/actions.ts). The
// new allotment's deadline-approaching alert surfaces on the next natural
// pipeline trigger (a sale, an import, or the 6-hourly scheduled
// recompute) rather than blocking this request on a full rescan.
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    requireRole(user, "MANAGER");

    const parsed = createAllotmentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid allotment data." }, { status: 400 });
    }

    let allotment;
    try {
      allotment = await createAllotment(user.businessId, user.id, parsed.data);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create allotment." }, { status: 400 });
    }

    return NextResponse.json({ allotment });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
