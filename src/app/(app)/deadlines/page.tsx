import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow } from "@/components/ui/Table";
import { formatDate, daysUntil } from "@/lib/ui/format";
import { NewDeadlineForm } from "./NewDeadlineForm";
import { CancelDeadlineButton } from "./DeadlineActions";

export default async function DeadlinesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [deadlines, skus] = await Promise.all([
    prisma.stockDeadline.findMany({
      where: { businessId: user.businessId, status: { in: ["OPEN", "MISSED"] } },
      include: { sku: { include: { product: true } } },
      orderBy: { deadlineDate: "asc" },
    }),
    prisma.sku.findMany({
      where: { businessId: user.businessId, status: "ACTIVE" },
      include: { product: true },
      orderBy: { code: "asc" },
      take: 300,
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Stock Deadlines</h1>
        <p className="text-sm text-text-muted">Assign expected movement dates for outstanding stock and track them here.</p>
      </div>

      <Card>
        <CardHeader title="Add a Deadline" />
        <NewDeadlineForm skus={skus.map((s) => ({ id: s.id, label: `${s.product.name} (${s.code})` }))} />
      </Card>

      <Card padding="p-0">
        <Table>
          <Thead>
            <Th>Product</Th>
            <Th className="text-right">Quantity</Th>
            <Th>Deadline</Th>
            <Th>Priority</Th>
            <Th>Status</Th>
            <Th></Th>
          </Thead>
          <Tbody>
            {deadlines.length === 0 && <EmptyRow colSpan={6} message="No open stock deadlines." />}
            {deadlines.map((d) => {
              const daysLeft = daysUntil(d.deadlineDate);
              return (
                <Tr key={d.id}>
                  <Td>
                    {d.sku.product.name} <span className="text-text-muted">({d.sku.code})</span>
                  </Td>
                  <Td className="text-right tabular-nums">{d.quantity}</Td>
                  <Td>{formatDate(d.deadlineDate)}</Td>
                  <Td>{d.priority}</Td>
                  <Td>
                    <Badge level={d.status === "MISSED" ? "critical" : daysLeft <= 7 ? "warning" : "watch"}>
                      {d.status === "MISSED" ? "Missed" : `${daysLeft}d left`}
                    </Badge>
                  </Td>
                  <Td>
                    <CancelDeadlineButton id={d.id} />
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
