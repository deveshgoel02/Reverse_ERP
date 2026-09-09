import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit/log";

export const createSalesmanSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email("Invalid email.").optional().or(z.literal("")),
});

export type CreateSalesmanInput = z.infer<typeof createSalesmanSchema>;

export async function createSalesman(businessId: string, actorId: string, input: CreateSalesmanInput) {
  const salesman = await prisma.salesman.create({
    data: {
      businessId,
      name: input.name,
      phone: input.phone || undefined,
      email: input.email || undefined,
    },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: "CREATE",
    entityType: "Salesman",
    entityId: salesman.id,
    newValue: { name: salesman.name },
  });

  return salesman;
}
