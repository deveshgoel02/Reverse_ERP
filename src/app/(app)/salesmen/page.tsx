import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card, CardHeader } from "@/components/ui/Card";
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow } from "@/components/ui/Table";
import { formatINR } from "@/lib/ui/format";
import { NewSalesmanForm } from "./NewSalesmanForm";

export default async function SalesmenPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const salesmen = await prisma.salesman.findMany({
    where: { businessId: user.businessId, active: true },
    include: {
      allotments: { where: { status: "OPEN" }, select: { id: true } },
      sales: { select: { items: { select: { totalAmount: true } } } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Salesmen</h1>
        <p className="text-sm text-text-muted">Your sales team — allot targets to them from Allotments.</p>
      </div>

      <Card>
        <CardHeader title="Add a Salesman" />
        <NewSalesmanForm />
      </Card>

      <Card padding="p-0">
        <Table>
          <Thead>
            <Th>Name</Th>
            <Th>Phone</Th>
            <Th>Email</Th>
            <Th className="text-right">Open Allotments</Th>
            <Th className="text-right">Total Sales (all time)</Th>
          </Thead>
          <Tbody>
            {salesmen.length === 0 && <EmptyRow colSpan={5} message="No salesmen yet — add one above." />}
            {salesmen.map((s) => {
              const totalSales = s.sales.reduce((sum, sale) => sum + sale.items.reduce((iSum, i) => iSum + Number(i.totalAmount), 0), 0);
              return (
                <Tr key={s.id}>
                  <Td className="font-medium text-text">{s.name}</Td>
                  <Td>{s.phone ?? "—"}</Td>
                  <Td>{s.email ?? "—"}</Td>
                  <Td className="text-right tabular-nums">{s.allotments.length}</Td>
                  <Td className="text-right tabular-nums">{formatINR(totalSales)}</Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
