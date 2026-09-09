import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow } from "@/components/ui/Table";
import { formatDate, formatINR, daysUntil } from "@/lib/ui/format";
import { getAllotmentProgressBatch } from "@/lib/allotments/progress";
import { CancelAllotmentButton } from "./AllotmentActions";

export default async function AllotmentsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const allotments = await prisma.allotment.findMany({
    where: { businessId: user.businessId, status: { in: ["OPEN", "MISSED"] } },
    include: {
      salesman: { select: { name: true } },
      customer: { select: { name: true } },
      brand: { select: { name: true } },
    },
    orderBy: { deadlineDate: "asc" },
  });

  const progressBySalesman = await getAllotmentProgressBatch(allotments);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">Salesman Allotments</h1>
          <p className="text-sm text-text-muted">
            Allot a salesman a quantity of a brand to sell to a party by a deadline, with an incentive. Progress is tracked
            automatically from actual sales.
          </p>
        </div>
        <Link href="/allotments/new">
          <Button variant="primary">+ New Allotment</Button>
        </Link>
      </div>

      <Card padding="p-0">
        <Table>
          <Thead>
            <Th>Salesman</Th>
            <Th>Party</Th>
            <Th>Brand</Th>
            <Th className="text-right">Target</Th>
            <Th className="text-right">Sold</Th>
            <Th className="text-right">Remaining</Th>
            <Th>Progress</Th>
            <Th className="text-right">Incentive</Th>
            <Th>Deadline</Th>
            <Th></Th>
          </Thead>
          <Tbody>
            {allotments.length === 0 && <EmptyRow colSpan={10} message="No open allotments — allot one above." />}
            {allotments.map((a) => {
              const progress = progressBySalesman.get(a.id)!;
              const daysLeft = daysUntil(a.deadlineDate);
              const isMissed = a.status === "MISSED";
              return (
                <Tr key={a.id}>
                  <Td className="font-medium text-text">{a.salesman.name}</Td>
                  <Td>{a.customer.name}</Td>
                  <Td>{a.brand.name}</Td>
                  <Td className="text-right tabular-nums">{a.targetQuantity}</Td>
                  <Td className="text-right tabular-nums">{progress.soldQty}</Td>
                  <Td className="text-right tabular-nums">{progress.remainingQty}</Td>
                  <Td className="min-w-[8rem]">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-bg">
                      <div
                        className={`h-full rounded-full ${progress.percent >= 100 ? "bg-[var(--status-healthy-text)]" : "bg-primary"}`}
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    <span className="text-xs text-text-muted">{progress.percent}%</span>
                  </Td>
                  <Td className="text-right tabular-nums">{formatINR(Number(a.incentiveAmount))}</Td>
                  <Td>
                    <div>{formatDate(a.deadlineDate)}</div>
                    <Badge level={isMissed ? "critical" : daysLeft <= 7 ? "warning" : daysLeft <= 14 ? "watch" : "neutral"}>
                      {isMissed ? "Missed" : `${daysLeft}d left`}
                    </Badge>
                  </Td>
                  <Td>
                    <CancelAllotmentButton id={a.id} />
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
