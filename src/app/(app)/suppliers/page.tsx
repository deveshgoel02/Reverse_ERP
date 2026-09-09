import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card } from "@/components/ui/Card";
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow } from "@/components/ui/Table";

export default async function SuppliersPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const suppliers = await prisma.supplier.findMany({
    where: { businessId: user.businessId },
    include: {
      products: { select: { id: true, brandId: true } },
      purchases: { select: { id: true, status: true, expectedDeliveryDate: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Suppliers</h1>
        <p className="text-sm text-text-muted">{suppliers.length} suppliers on record.</p>
      </div>

      <Card padding="p-0">
        <Table>
          <Thead>
            <Th>Name</Th>
            <Th>Phone</Th>
            <Th className="text-right">Lead Time</Th>
            <Th className="text-right">Products Supplied</Th>
            <Th className="text-right">Open Purchase Orders</Th>
          </Thead>
          <Tbody>
            {suppliers.length === 0 && <EmptyRow colSpan={5} message="No suppliers yet." />}
            {suppliers.map((s) => {
              const openPOs = s.purchases.filter((p) => p.status === "PENDING" || p.status === "PARTIALLY_RECEIVED").length;
              return (
                <Tr key={s.id}>
                  <Td className="font-medium text-text">{s.name}</Td>
                  <Td>{s.phone ?? "—"}</Td>
                  <Td className="text-right tabular-nums">{s.leadTimeDays ? `${s.leadTimeDays}d` : "—"}</Td>
                  <Td className="text-right tabular-nums">{s.products.length}</Td>
                  <Td className="text-right tabular-nums">{openPOs}</Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
