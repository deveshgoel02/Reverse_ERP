import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow } from "@/components/ui/Table";
import { formatDate, formatINR } from "@/lib/ui/format";

export default async function PurchasesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const purchases = await prisma.purchase.findMany({
    where: { businessId: user.businessId },
    include: { supplier: true, items: true },
    orderBy: { orderDate: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">Purchases</h1>
          <p className="text-sm text-text-muted">Most recent 100 purchase orders — ordered vs. received.</p>
        </div>
        <LinkButton href="/purchases/new" variant="primary">
          + Create Purchase Order
        </LinkButton>
      </div>

      <Card padding="p-0">
        <Table>
          <Thead>
            <Th>PO Ref</Th>
            <Th>Date</Th>
            <Th>Supplier</Th>
            <Th className="text-right">Ordered</Th>
            <Th className="text-right">Received</Th>
            <Th className="text-right">Value</Th>
            <Th>Status</Th>
          </Thead>
          <Tbody>
            {purchases.length === 0 && <EmptyRow colSpan={7} message="No purchase orders recorded yet." />}
            {purchases.map((p) => {
              const ordered = p.items.reduce((sum, i) => sum + i.quantityOrdered, 0);
              const received = p.items.reduce((sum, i) => sum + i.quantityReceived, 0);
              const value = p.items.reduce((sum, i) => sum + i.quantityOrdered * Number(i.unitCost), 0);
              return (
                <Tr key={p.id}>
                  <Td className="font-mono text-xs">{p.invoiceRef ?? p.id.slice(0, 8)}</Td>
                  <Td className="text-text-muted">{formatDate(p.orderDate)}</Td>
                  <Td>{p.supplier.name}</Td>
                  <Td className="text-right tabular-nums">{ordered}</Td>
                  <Td className="text-right tabular-nums">{received}</Td>
                  <Td className="text-right tabular-nums">{formatINR(value)}</Td>
                  <Td>
                    <Badge level={p.status === "RECEIVED" ? "healthy" : p.status === "CANCELLED" ? "neutral" : "watch"}>
                      {p.status.replace(/_/g, " ")}
                    </Badge>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
