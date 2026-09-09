import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card } from "@/components/ui/Card";
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow } from "@/components/ui/Table";
import { formatDate, formatINR } from "@/lib/ui/format";

export default async function CustomersPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const customers = await prisma.customer.findMany({
    where: { businessId: user.businessId },
    orderBy: { name: "asc" },
    take: 200,
  });

  const salesAgg = await prisma.sale.groupBy({
    by: ["customerId"],
    where: { businessId: user.businessId, customerId: { not: null } },
    _count: true,
    _max: { saleDate: true },
  });
  const saleItemTotals = await prisma.saleItem.findMany({
    where: { sale: { businessId: user.businessId } },
    select: { totalAmount: true, sale: { select: { customerId: true } } },
  });
  const totalsByCustomer = new Map<string, number>();
  for (const item of saleItemTotals) {
    const cid = item.sale.customerId;
    if (!cid) continue;
    totalsByCustomer.set(cid, (totalsByCustomer.get(cid) ?? 0) + Number(item.totalAmount));
  }
  const aggMap = new Map(salesAgg.map((a) => [a.customerId, a]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Customers</h1>
        <p className="text-sm text-text-muted">{customers.length} customers on record.</p>
      </div>

      <Card padding="p-0">
        <Table>
          <Thead>
            <Th>Name</Th>
            <Th>City</Th>
            <Th className="text-right">Orders</Th>
            <Th className="text-right">Total Purchases</Th>
            <Th>Last Purchase</Th>
          </Thead>
          <Tbody>
            {customers.length === 0 && <EmptyRow colSpan={5} message="No customers yet." />}
            {customers.map((c) => {
              const agg = aggMap.get(c.id);
              return (
                <Tr key={c.id}>
                  <Td className="font-medium text-text">{c.name}</Td>
                  <Td>{c.city ?? "—"}</Td>
                  <Td className="text-right tabular-nums">{agg?._count ?? 0}</Td>
                  <Td className="text-right tabular-nums">{formatINR(totalsByCustomer.get(c.id) ?? 0)}</Td>
                  <Td className="text-text-muted">{agg?._max.saleDate ? formatDate(agg._max.saleDate) : "—"}</Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
