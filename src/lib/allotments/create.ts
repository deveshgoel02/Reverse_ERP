import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit/log";

export const createAllotmentSchema = z.object({
  salesmanId: z.string().min(1, "Salesman is required."),
  customerId: z.string().min(1, "Party (customer) is required."),
  brandId: z.string().min(1, "Brand is required."),
  targetQuantity: z.coerce.number().int().positive("Target quantity must be a positive number."),
  incentiveAmount: z.coerce.number().nonnegative().default(0),
  deadlineDate: z.string().min(1, "Deadline is required."),
  notes: z.string().optional(),
});

export type CreateAllotmentInput = z.infer<typeof createAllotmentSchema>;

/**
 * Admin allots a salesman a target: sell N units of one brand to one party
 * (customer) by a deadline, for a given incentive. Progress against this is
 * computed on read (src/lib/allotments/progress.ts) from real sales — this
 * function only records the target itself.
 */
export async function createAllotment(businessId: string, actorId: string, input: CreateAllotmentInput) {
  const [salesman, customer, brand] = await Promise.all([
    prisma.salesman.findFirst({ where: { id: input.salesmanId, businessId } }),
    prisma.customer.findFirst({ where: { id: input.customerId, businessId } }),
    prisma.brand.findFirst({ where: { id: input.brandId, businessId } }),
  ]);
  if (!salesman) throw new Error("Salesman not found.");
  if (!customer) throw new Error("Customer not found.");
  if (!brand) throw new Error("Brand not found.");

  const allotment = await prisma.allotment.create({
    data: {
      businessId,
      salesmanId: input.salesmanId,
      customerId: input.customerId,
      brandId: input.brandId,
      targetQuantity: input.targetQuantity,
      incentiveAmount: input.incentiveAmount,
      deadlineDate: new Date(input.deadlineDate),
      notes: input.notes || undefined,
    },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: "CREATE",
    entityType: "Allotment",
    entityId: allotment.id,
    newValue: {
      salesman: salesman.name,
      customer: customer.name,
      brand: brand.name,
      targetQuantity: allotment.targetQuantity,
      incentiveAmount: Number(allotment.incentiveAmount),
      deadlineDate: allotment.deadlineDate,
    },
  });

  return allotment;
}
