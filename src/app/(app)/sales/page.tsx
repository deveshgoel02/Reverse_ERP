import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card } from "@/components/ui/Card";
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow } from "@/components/ui/Table";
import { formatDate, formatINR } from "@/lib/ui/format";

export default async function SalesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const sales = await prisma.sale.findMany({
    where: { businessId: user.businessId },
    include: { customer: true, items: true },
    orderBy: { saleDate: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Sales</h1>
        <p className="text-sm text-text-muted">Most recent 100 invoices.</p>
      </div>

      <Card padding="p-0">
        <Table>
          <Thead>
            <Th>Invoice</Th>
            <Th>Date</Th>
            <Th>Customer</Th>
            <Th className="text-right">Items</Th>
            <Th className="text-right">Total</Th>
          </Thead>
          <Tbody>
            {sales.length === 0 && <EmptyRow colSpan={5} message="No sales recorded yet." />}
            {sales.map((s) => {
              const total = s.items.reduce((sum, i) => sum + Number(i.totalAmount), 0);
              return (
                <Tr key={s.id}>
                  <Td className="font-mono text-xs">{s.invoiceRef ?? s.id.slice(0, 8)}</Td>
                  <Td className="text-text-muted">{formatDate(s.saleDate)}</Td>
                  <Td>{s.customer?.name ?? "Walk-in"}</Td>
                  <Td className="text-right tabular-nums">{s.items.length}</Td>
                  <Td className="text-right tabular-nums font-medium">{formatINR(total)}</Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
